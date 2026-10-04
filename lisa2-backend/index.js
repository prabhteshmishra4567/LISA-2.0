const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const { createStore } = require('./database');
const { createProvider } = require('./provider');
const { createApp } = require('./app');

const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || '127.0.0.1';
const store = createStore(process.env.DATABASE_PATH);
const provider = createProvider();
const app = createApp({ store, provider });
const server = app.listen(port, host, () => {
  console.log(`LISA API ready at http://${host}:${port}`);
  if (!provider.ready) console.log('Set GEMINI_API_KEY in lisa2-backend/.env to enable AI responses.');
});
function shutdown() {
  server.close(() => { store.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
