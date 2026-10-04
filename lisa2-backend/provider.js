const { GoogleGenAI } = require('@google/genai');

function retryable(error) {
  const status = Number(error?.status || error?.code);
  return error?.name === 'TypeError' || [429, 500, 502, 503, 504].includes(status);
}

function pause(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const error = new Error('Request aborted');
      error.name = 'AbortError';
      reject(error);
      return;
    }
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      const error = new Error('Request aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  });
}

async function withRetry(operation, signal, retryDelay) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= 2 || signal?.aborted || !retryable(error)) throw error;
      await pause(retryDelay * (2 ** attempt), signal);
    }
  }
}

function createProvider({ apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-flash-latest', transcribeModel = process.env.GEMINI_TRANSCRIBE_MODEL || model, client, retryDelay = 400 } = {}) {
  const ai = client || (apiKey ? new GoogleGenAI({ apiKey }) : null);
  return {
    ready: Boolean(ai), model,
    async generate({ question, history, research, signal }) {
      const response = await withRetry(() => ai.models.generateContent({
        model,
        contents: [...history.map(({ role, content }) => ({
          role: role === 'assistant' ? 'model' : 'user', parts: [{ text: content }],
        })), { role: 'user', parts: [{ text: question }] }],
        config: {
          systemInstruction: 'You are LISA, a helpful personal assistant. Use clear Markdown and fenced code blocks. Remember the supplied conversation context. Be candid about uncertainty. Never claim to have opened an app or performed an action unless a tool actually did it. When search is enabled, use it for current facts and cite your sources. Without search, do not claim to have verified current facts.',
          maxOutputTokens: 8192,
          ...(research ? { tools: [{ googleSearch: {} }] } : {}),
          httpOptions: { timeout: 60000 }, abortSignal: signal,
        },
      }), signal, retryDelay);
      const answer = response.text?.trim();
      if (!answer) {
        const error = new Error('The model returned no text.');
        error.status = 422;
        throw error;
      }
      const grounding = response.candidates?.[0]?.groundingMetadata;
      const sources = (grounding?.groundingChunks || []).flatMap(({ web }) => {
        if (!web?.uri || !/^https?:\/\//i.test(web.uri)) return [];
        return [{ title: web.title || web.uri, url: web.uri }];
      }).filter((source, index, all) => all.findIndex(item => item.url === source.url) === index);
      return { answer, sources, searchSuggestions: grounding?.searchEntryPoint?.renderedContent || '' };
    },
    async transcribe({ audio, mimeType, language, signal }) {
      const response = await withRetry(() => ai.models.generateContent({
        model: transcribeModel,
        contents: [{ role: 'user', parts: [
          { text: `Transcribe only the intelligible spoken words${language ? ` using the ${language} locale` : ''}. Do not describe the audio, speaker, background sounds, input, language, or emotion. If there is no intelligible speech, use an empty transcript.` },
          { inlineData: { mimeType, data: audio.toString('base64') } },
        ] }],
        config: {
          maxOutputTokens: 2048,
          temperature: 0,
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: 'object',
            properties: { transcript: { type: 'string', description: 'Only the words spoken in the audio, or an empty string when no speech is intelligible.' } },
            required: ['transcript'],
            additionalProperties: false,
          },
          httpOptions: { timeout: 60000 },
          abortSignal: signal,
        },
      }), signal, retryDelay);
      let transcript = '';
      try { transcript = JSON.parse(response.text || '{}').transcript?.trim() || ''; }
      catch { transcript = response.text?.replace(/^```(?:json)?\s*|\s*```$/g, '').replace(/^transcri(?:pt|ption)\s*:\s*/i, '').trim() || ''; }
      if (!transcript) {
        const error = new Error('The model returned no transcript.');
        error.status = 422;
        throw error;
      }
      return { transcript };
    },
  };
}
module.exports = { createProvider };
