const express = require('express');
const cors = require('cors');
const { localCommand } = require('./commands');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createApp({ store, provider, origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(value => value.trim()), rateLimit = 30 }) {
  const app = express();
  const busy = new Set();
  const requests = new Map();
  function takeRateSlot(req, res, message) {
    const now = Date.now();
    for (const [key, period] of requests) if (period.until <= now) requests.delete(key);
    const key = req.ip;
    const period = requests.get(key) || { count: 0, until: now + 60000 };
    if (period.count >= rateLimit) {
      res.setHeader('Retry-After', String(Math.ceil((period.until - now) / 1000)));
      res.status(429).json({ error: message });
      return false;
    }
    requests.set(key, { ...period, count: period.count + 1 });
    return true;
  }
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (req.headers.origin && !origins.includes(req.headers.origin)) return res.status(403).json({ error: 'This origin is not allowed.' });
    next();
  });
  app.use(cors({ origin: origins, allowedHeaders: ['Content-Type', 'X-Lisa-Client-Id'] }));
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok', aiConfigured: provider.ready, model: provider.model }));
  app.use((req, res, next) => {
    const owner = req.headers['x-lisa-client-id'];
    if (typeof owner !== 'string' || !UUID.test(owner)) return res.status(401).json({ error: 'A valid LISA client ID is required.' });
    req.owner = owner;
    next();
  });
  app.get('/api/conversations', (req, res) => res.json(store.list(req.owner)));
  app.post('/api/conversations', (req, res) => res.status(201).json(store.create(req.owner)));
  app.get('/api/conversations/:id', (req, res) => {
    const conversation = store.get(req.params.id, req.owner);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });
    res.json({ ...conversation, messages: store.messages(conversation.id) });
  });
  app.patch('/api/conversations/:id', (req, res) => {
    const { title } = req.body || {};
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 100) return res.status(400).json({ error: 'Title must contain 1–100 characters.' });
    if (!store.get(req.params.id, req.owner)) return res.status(404).json({ error: 'Conversation not found.' });
    if (busy.has(req.params.id)) return res.status(409).json({ error: 'Wait for the current response before renaming this conversation.' });
    res.json(store.rename(req.params.id, req.owner, title.trim()));
  });
  app.delete('/api/conversations/:id', (req, res) => {
    if (!store.get(req.params.id, req.owner)) return res.status(404).json({ error: 'Conversation not found.' });
    if (busy.has(req.params.id)) return res.status(409).json({ error: 'Wait for the current response before deleting this conversation.' });
    store.remove(req.params.id, req.owner);
    res.status(204).end();
  });
  app.post('/api/transcribe', express.raw({ type: () => true, limit: '5mb' }), async (req, res) => {
    const mimeType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const supportedTypes = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aac']);
    const language = typeof req.query.language === 'string' ? req.query.language : '';
    if (!supportedTypes.has(mimeType)) return res.status(415).json({ error: 'Unsupported audio format. Record WebM, OGG, MP4, MP3, WAV, or AAC audio.' });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'The audio recording is empty. Please try again.' });
    if (language.length > 35 || (language && !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(language))) return res.status(400).json({ error: 'Invalid voice language.' });
    if (!provider.ready || typeof provider.transcribe !== 'function') return res.status(503).json({ error: 'Audio transcription is not configured. Check GEMINI_API_KEY and restart the backend.' });
    if (!takeRateSlot(req, res, 'Too many voice requests. Please wait a minute.')) return;
    const controller = new AbortController();
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', disconnected);
    const timeout = setTimeout(() => controller.abort(), 65000);
    try {
      const result = await provider.transcribe({ audio: req.body, mimeType, language, signal: controller.signal });
      if (controller.signal.aborted) {
        if (!res.destroyed) res.status(504).json({ error: 'Audio transcription timed out. Please try again.' });
        return;
      }
      res.json(result);
    } catch (error) {
      if (res.destroyed) return;
      const status = controller.signal.aborted ? 504 : Number(error.status);
      const safeStatus = [400, 403, 404, 422, 429, 503, 504].includes(status) ? status : 502;
      const errors = {
        400: 'The AI provider rejected this recording. Please record it again.',
        403: 'The AI provider rejected your credentials or permissions. Check GEMINI_API_KEY.',
        404: 'The configured transcription model is unavailable. Check GEMINI_TRANSCRIBE_MODEL.',
        422: 'No speech could be transcribed. Tap the microphone and try again.',
        429: 'The AI provider quota was exceeded. Please wait and try again.',
        503: 'Audio transcription is temporarily unavailable. Please try again.',
        504: 'Audio transcription timed out. Please try again.',
        502: 'Could not transcribe the recording. Please check the connection and try again.',
      };
      res.status(safeStatus).json({ error: errors[safeStatus] });
    } finally {
      clearTimeout(timeout);
      res.off('close', disconnected);
    }
  });
  const ask = async (req, res) => {
    const { question, conversationId, research = false, timeZone = 'UTC' } = req.body || {};
    if (typeof question !== 'string' || !question.trim() || question.length > 12000) return res.status(400).json({ error: 'Question must contain 1–12,000 characters.' });
    if (typeof research !== 'boolean') return res.status(400).json({ error: 'Research must be true or false.' });
    if (conversationId !== undefined && (typeof conversationId !== 'string' || !UUID.test(conversationId))) return res.status(400).json({ error: 'Invalid conversation ID.' });
    let conversation = conversationId ? store.get(conversationId, req.owner) : null;
    if (conversationId && !conversation) return res.status(404).json({ error: 'Conversation not found.' });
    if (typeof timeZone !== 'string' || timeZone.length > 100) return res.status(400).json({ error: 'Invalid time zone.' });
    const localAnswer = localCommand(question, timeZone);
    if (!localAnswer && !provider.ready) return res.status(503).json({ error: 'AI is not configured. Add GEMINI_API_KEY to the backend .env file, then restart the backend.' });
    if (!takeRateSlot(req, res, 'Too many questions. Please wait a minute.')) return;
    if (!conversation) conversation = store.create(req.owner, question.trim().slice(0, 70));
    if (busy.has(conversation.id)) return res.status(409).json({ error: 'A response is already being generated for this conversation.' });
    busy.add(conversation.id);
    const controller = new AbortController();
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', disconnected);
    const timeout = setTimeout(() => controller.abort(), 65000);
    try {
      const all = store.messages(conversation.id).slice(-40);
      let history = [];
      let length = 0;
      for (let index = all.length - 2; index >= 0; index -= 2) {
        const pair = all.slice(index, index + 2);
        const size = pair.reduce((sum, message) => sum + message.content.length, 0);
        if (length + size > 48000) break;
        history = [...pair, ...history];
        length += size;
      }
      const result = localAnswer ? { answer: localAnswer, sources: [], searchSuggestions: '' } : await provider.generate({ question: question.trim(), history, research, signal: controller.signal });
      if (controller.signal.aborted) {
        if (!res.destroyed) res.status(504).json({ error: 'The response timed out. Please try again.' });
        return;
      }
      const messages = store.saveTurn(conversation.id, question.trim(), result.answer, result.sources, result.searchSuggestions);
      if (history.length === 0 && conversation.title === 'New conversation') store.rename(conversation.id, req.owner, question.trim().slice(0, 70));
      res.json({ ...result, conversationId: conversation.id, messages });
    } catch (error) {
      if (res.destroyed) return;
      const status = controller.signal.aborted ? 504 : Number(error.status);
      const safeStatus = [400, 403, 404, 422, 429, 503, 504].includes(status) ? status : 502;
      const errors = {
        400: 'The AI provider rejected this request. Check your model configuration.',
        403: 'The AI provider rejected your credentials or permissions. Check GEMINI_API_KEY.',
        404: 'The configured AI model is unavailable. Update GEMINI_MODEL in the backend .env file.',
        422: 'The model returned no text. Try rephrasing your question.',
        429: 'The AI provider quota was exceeded. Please wait and try again.',
        503: 'The AI provider is temporarily unavailable. Please try again.',
        504: 'The response timed out. Please try again.',
        502: 'Could not get an AI response. Please check the connection and try again.',
      };
      res.status(safeStatus).json({ error: errors[safeStatus] });
    } finally {
      clearTimeout(timeout);
      res.off('close', disconnected);
      busy.delete(conversation.id);
    }
  };
  app.post('/api/ask', ask);
  app.post('/ask', ask);
  app.use((req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
    res.status(status).json({ error: status === 413 ? 'Request is too large.' : status === 400 ? 'Invalid JSON request.' : 'An internal error occurred.' });
  });
  return app;
}
module.exports = { createApp };
