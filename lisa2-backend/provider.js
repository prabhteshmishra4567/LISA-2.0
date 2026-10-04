const { GoogleGenAI } = require('@google/genai');

function createProvider({ apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-flash-latest', client } = {}) {
  const ai = client || (apiKey ? new GoogleGenAI({ apiKey }) : null);
  return {
    ready: Boolean(ai), model,
    async generate({ question, history, research, signal }) {
      const response = await ai.models.generateContent({
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
      });
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
  };
}
module.exports = { createProvider };
