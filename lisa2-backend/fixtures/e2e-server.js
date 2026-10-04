// Isolated browser-test backend: no real API key and no access to the user database.
const { createApp } = require('../app');
const { createStore } = require('../database');
const store = createStore(':memory:');
const provider = {
  ready: true,
  model: 'browser-test-model',
  async generate({ question, history, research, signal }) {
    if (question === 'slow request') await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 30000);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Cancelled')); }, { once: true });
    });
    if (question === 'fail request') throw Object.assign(new Error('Quota exceeded'), { status: 429 });
    return {
      answer: `**Test answer** to: ${question}\n\nPrevious messages: ${history.length}\n\n\`\`\`js\nconst working = true;\n\`\`\``,
      sources: research ? [{ title: 'Example source', url: 'https://example.com' }] : [],
      searchSuggestions: research ? '<a target="_blank" href="https://google.com/search?q=test">Search suggestions</a>' : '',
    };
  },
  async transcribe() {
    return { transcript: 'Recorded fallback question' };
  },
};
const port = Number(process.env.PORT || 5000);
const server = createApp({ store, provider }).listen(port, '127.0.0.1');
process.on('SIGTERM', () => server.close(() => { store.close(); process.exit(0); }));
