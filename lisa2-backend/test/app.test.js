const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createStore } = require('../database');
const { createApp } = require('../app');
const { createProvider } = require('../provider');
const { localCommand } = require('../commands');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function fixture(t, options = {}) {
  const store = createStore(':memory:');
  const calls = [];
  const provider = options.provider || { ready: true, model: 'test-model', generate: async input => {
    calls.push(input);
    return { answer: `Answer to ${input.question}`, sources: [], searchSuggestions: '' };
  } };
  const server = createApp({ store, provider, ...options }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); });
  const owner = randomUUID();
  async function request(path, { body, headers, ...init } = {}) {
    const raw = Buffer.isBuffer(body);
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      ...init, headers: { 'Content-Type': 'application/json', 'X-Lisa-Client-Id': owner, ...headers },
      ...(body !== undefined ? { body: raw ? body : JSON.stringify(body) } : {}),
    });
    return { status: response.status, headers: response.headers, data: response.status === 204 ? null : await response.json() };
  }
  return { store, calls, owner, request };
}

test('follow-up questions receive complete saved history, and conversations can be renamed and deleted', async t => {
  const { request, calls } = await fixture(t);
  const created = await request('/api/conversations', { method: 'POST' });
  assert.equal(created.status, 201);
  const id = created.data.id;
  const first = await request('/api/ask', { method: 'POST', body: { question: 'My name is Alex', conversationId: id } });
  assert.equal(first.status, 200);
  assert.equal(first.data.messages.length, 2);
  await request('/api/ask', { method: 'POST', body: { question: 'What is my name?', conversationId: id, research: true } });
  assert.equal(calls[1].history[0].content, 'My name is Alex');
  assert.equal(calls[1].history[1].role, 'assistant');
  assert.equal(calls[1].research, true);
  const renamed = await request(`/api/conversations/${id}`, { method: 'PATCH', body: { title: 'My saved chat' } });
  assert.equal(renamed.data.title, 'My saved chat');
  assert.equal((await request(`/api/conversations/${id}`)).data.messages.length, 4);
  assert.equal((await request(`/api/conversations/${id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await request(`/api/conversations/${id}`)).status, 404);
});

test('another browser cannot list, read, rename, delete, or append to a conversation', async t => {
  const { request } = await fixture(t);
  const { data } = await request('/api/conversations', { method: 'POST' });
  const headers = { 'X-Lisa-Client-Id': randomUUID() };
  assert.deepEqual((await request('/api/conversations', { headers })).data, []);
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    assert.equal((await request(`/api/conversations/${data.id}`, { method, headers, ...(method === 'PATCH' ? { body: { title: 'stolen' } } : {}) })).status, 404);
  }
  assert.equal((await request('/api/ask', { method: 'POST', headers, body: { question: 'hello', conversationId: data.id } })).status, 404);
});

test('untrusted origins and missing client IDs are rejected', async t => {
  const { request } = await fixture(t);
  assert.equal((await request('/api/conversations', { headers: { 'X-Lisa-Client-Id': '' } })).status, 401);
  assert.equal((await request('/api/health', { headers: { Origin: 'https://untrusted.example' } })).status, 403);
  assert.equal((await request('/api/health', { headers: { Origin: 'http://localhost:5173' } })).status, 200);
  assert.equal((await request('/api/conversations', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' } })).status, 204);
});

test('invalid input, malformed JSON and oversized bodies return useful client errors', async t => {
  const { request } = await fixture(t);
  for (const body of [{}, { question: ' ' }, { question: 4 }, { question: 'x'.repeat(12001) }, { question: 'ok', research: 'yes' }, { question: 'ok', conversationId: '../private' }, { question: 'ok', timeZone: 5 }]) {
    assert.equal((await request('/api/ask', { method: 'POST', body })).status, 400);
  }
  assert.equal((await request('/api/ask', { method: 'POST', body: { question: 'x'.repeat(40000) } })).status, 413);
  assert.equal((await request('/api/ask', { method: 'POST', body: null })).status, 400);
});

test('missing AI configuration still allows persistent local commands', async t => {
  const provider = { ready: false, model: 'none' };
  const { request } = await fixture(t, { provider });
  assert.equal((await request('/api/health')).data.aiConfigured, false);
  assert.equal((await request('/api/ask', { method: 'POST', body: { question: 'Explain physics' } })).status, 503);
  const local = await request('/api/ask', { method: 'POST', body: { question: 'open youtube' } });
  assert.equal(local.status, 200);
  assert.match(local.data.answer, /https:\/\/www.youtube.com/);
  assert.equal((await request(`/api/conversations/${local.data.conversationId}`)).data.messages.length, 2);
});

test('recorded audio is validated and passed to the transcription provider', async t => {
  let captured;
  const provider = { ready: true, model: 'test', generate: async () => ({ answer: 'ok', sources: [] }), transcribe: async input => {
    captured = input;
    return { transcript: 'Hello from the recording' };
  } };
  const { request } = await fixture(t, { provider });
  const result = await request('/api/transcribe?language=en-IN', { method: 'POST', body: Buffer.from('audio-data'), headers: { 'Content-Type': 'audio/webm;codecs=opus' } });
  assert.equal(result.status, 200);
  assert.equal(result.data.transcript, 'Hello from the recording');
  assert.equal(captured.mimeType, 'audio/webm');
  assert.equal(captured.language, 'en-IN');
  assert.deepEqual(captured.audio, Buffer.from('audio-data'));
  assert.equal((await request('/api/transcribe', { method: 'POST', body: Buffer.from('text'), headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await request('/api/transcribe?language=invalid-language', { method: 'POST', body: Buffer.from('audio'), headers: { 'Content-Type': 'audio/webm' } })).status, 400);
});

test('audio transcription requires an AI provider with transcription support', async t => {
  const { request } = await fixture(t, { provider: { ready: false, model: 'none' } });
  const result = await request('/api/transcribe', { method: 'POST', body: Buffer.from('audio'), headers: { 'Content-Type': 'audio/webm' } });
  assert.equal(result.status, 503);
  assert.doesNotMatch(result.data.error, /undefined|secret/i);
});

test('provider failures do not save partial turns or expose secrets, and retry remains possible', async t => {
  let fail = true;
  const provider = { ready: true, model: 'test', generate: async () => {
    if (fail) throw Object.assign(new Error('secret-key=must-not-leak'), { status: 429 });
    return { answer: 'Recovered', sources: [] };
  } };
  const { request } = await fixture(t, { provider });
  const { data } = await request('/api/conversations', { method: 'POST' });
  const failed = await request('/api/ask', { method: 'POST', body: { question: 'hi', conversationId: data.id } });
  assert.equal(failed.status, 429);
  assert.doesNotMatch(failed.data.error, /secret-key/);
  assert.equal((await request(`/api/conversations/${data.id}`)).data.messages.length, 0);
  fail = false;
  assert.equal((await request('/api/ask', { method: 'POST', body: { question: 'hi', conversationId: data.id } })).status, 200);
});

test('rate limits cannot be bypassed by changing browser IDs', async t => {
  const { request } = await fixture(t, { rateLimit: 1 });
  assert.equal((await request('/api/ask', { method: 'POST', body: { question: 'hi' } })).status, 200);
  const limited = await request('/api/ask', { method: 'POST', body: { question: 'hi' }, headers: { 'X-Lisa-Client-Id': randomUUID() } });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});

test('concurrent questions and mutations cannot corrupt a pending conversation', async t => {
  let release;
  let started;
  const hasStarted = new Promise(resolve => { started = resolve; });
  const provider = { ready: true, model: 'test', generate: () => { started(); return new Promise(resolve => { release = () => resolve({ answer: 'Done', sources: [] }); }); } };
  const { request } = await fixture(t, { provider });
  const { data } = await request('/api/conversations', { method: 'POST' });
  const pending = request('/api/ask', { method: 'POST', body: { question: 'hi', conversationId: data.id } });
  await hasStarted;
  assert.equal((await request('/api/ask', { method: 'POST', body: { question: 'second', conversationId: data.id } })).status, 409);
  assert.equal((await request(`/api/conversations/${data.id}`, { method: 'DELETE' })).status, 409);
  assert.equal((await request(`/api/conversations/${data.id}`, { method: 'PATCH', body: { title: 'other' } })).status, 409);
  release();
  assert.equal((await pending).status, 200);
  assert.equal((await request(`/api/conversations/${data.id}`)).data.messages.length, 2);
});

test('context limits preserve complete turns', async t => {
  const { request, store, calls, owner } = await fixture(t);
  const conversation = store.create(owner);
  for (let index = 0; index < 30; index++) store.saveTurn(conversation.id, `q${index}`, `a${index}`);
  await request('/api/ask', { method: 'POST', body: { question: 'follow-up', conversationId: conversation.id } });
  assert.equal(calls[0].history.length, 40);
  assert.equal(calls[0].history[0].content, 'q10');
  assert.equal(calls[0].history.at(-1).role, 'assistant');
});

test('local commands match intent rather than arbitrary words inside AI questions', () => {
  assert.equal(localCommand('Explain time complexity'), null);
  assert.equal(localCommand('Why is YouTube popular?'), null);
  assert.match(localCommand('search for a & b'), /a%20%26%20b/);
  assert.match(localCommand('time', 'Asia/Calcutta'), /Asia\/Calcutta/);
});

test('the Gemini adapter supplies context and search configuration and filters unsafe source links', async () => {
  let captured;
  const provider = createProvider({ model: 'configured-model', client: { models: { generateContent: async input => {
    captured = input;
    return { text: 'A grounded answer', candidates: [{ groundingMetadata: {
      groundingChunks: [{ web: { uri: 'https://example.com', title: 'Example' } }, { web: { uri: 'javascript:alert(1)' } }, { web: { uri: 'https://example.com' } }],
      searchEntryPoint: { renderedContent: '<div>Search suggestions</div>' },
    } }] };
  } } } });
  const controller = new AbortController();
  const result = await provider.generate({ question: 'latest news', history: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }], research: true, signal: controller.signal });
  assert.equal(captured.model, 'configured-model');
  assert.deepEqual(captured.config.tools, [{ googleSearch: {} }]);
  assert.equal(captured.config.abortSignal, controller.signal);
  assert.equal(captured.contents[1].role, 'model');
  assert.equal(result.sources.length, 1);
  assert.equal(result.searchSuggestions, '<div>Search suggestions</div>');
});

test('the Gemini adapter transcribes inline audio without exposing extra model text', async () => {
  let captured;
  const provider = createProvider({ model: 'chat-model', transcribeModel: 'audio-model', client: { models: { generateContent: async input => {
    captured = input;
    return { text: '{"transcript":"Recorded question"}' };
  } } } });
  const signal = new AbortController().signal;
  const result = await provider.transcribe({ audio: Buffer.from('sound'), mimeType: 'audio/webm', language: 'en-US', signal });
  assert.equal(captured.model, 'audio-model');
  assert.equal(captured.contents[0].parts[1].inlineData.mimeType, 'audio/webm');
  assert.equal(captured.contents[0].parts[1].inlineData.data, Buffer.from('sound').toString('base64'));
  assert.equal(captured.config.abortSignal, signal);
  assert.equal(captured.config.responseMimeType, 'application/json');
  assert.deepEqual(result, { transcript: 'Recorded question' });
});

test('the Gemini adapter retries temporary provider failures', async () => {
  let attempts = 0;
  const provider = createProvider({ retryDelay: 0, client: { models: { generateContent: async () => {
    attempts++;
    if (attempts < 3) throw Object.assign(new Error('Temporarily unavailable'), { status: 503 });
    return { text: 'Recovered answer' };
  } } } });
  const result = await provider.generate({ question: 'hello', history: [], research: false, signal: new AbortController().signal });
  assert.equal(attempts, 3);
  assert.equal(result.answer, 'Recovered answer');
});

test('the Gemini adapter does not retry exhausted quota responses', async () => {
  let attempts = 0;
  const provider = createProvider({ retryDelay: 0, client: { models: { generateContent: async () => {
    attempts++;
    throw Object.assign(new Error('Quota exhausted'), { status: 429 });
  } } } });
  await assert.rejects(() => provider.generate({ question: 'hello', history: [], research: false, signal: new AbortController().signal }), { status: 429 });
  assert.equal(attempts, 1);
});

test('empty or blocked model output is reported as an error', async () => {
  const provider = createProvider({ client: { models: { generateContent: async () => ({ text: '' }) } } });
  await assert.rejects(() => provider.generate({ question: 'hi', history: [], research: false }), { status: 422 });
});

test('history survives a backend restart and an existing legacy database is preserved', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lisa-storage-test-'));
  const filename = path.join(directory, 'history.db');
  t.after(() => { fs.unlinkSync(filename); fs.rmdirSync(directory); });
  const legacy = new DatabaseSync(filename);
  legacy.exec("CREATE TABLE conversations (id INTEGER PRIMARY KEY, prompt TEXT, response TEXT); INSERT INTO conversations VALUES (1, 'Old question', 'Old answer');");
  legacy.close();
  const owner = randomUUID();
  const store = createStore(filename);
  const conversation = store.create(owner, 'Saved conversation');
  store.saveTurn(conversation.id, 'New question', 'New answer', [{ title: 'Source', url: 'https://example.com' }]);
  store.close();
  const reopened = createStore(filename);
  assert.equal(reopened.list(owner)[0].title, 'Saved conversation');
  assert.equal(reopened.messages(conversation.id)[1].sources[0].title, 'Source');
  reopened.close();
  const archived = new DatabaseSync(filename);
  assert.equal(archived.prepare('SELECT response FROM conversations WHERE id = 1').get().response, 'Old answer');
  archived.close();
});
