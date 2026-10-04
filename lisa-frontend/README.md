# LISA frontend

React workspace with persistent chat history, Markdown answers, web research sources, voice dictation, read-aloud, chat export, and light/dark themes.

See the [project README](../README.md) for setup, configuration, data handling, and GitHub maintenance.

```sh
npm install
npm run dev
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Requires Node.js 24+. The development server uses `http://127.0.0.1:5173` and proxies `/api` to `http://127.0.0.1:5000`. For a separately hosted frontend, configure `VITE_API_URL` using `.env.example`.

Browser tests run against an isolated in-memory backend. Stop your local development servers before running them; the tests reserve ports 5000 and 5173.
