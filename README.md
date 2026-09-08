# Marginal

Marginal is a React + Express writing assistant that learns a user's writing voice.

## Run locally

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:8787

The Vite dev server proxies `/api/*` to the Express server.

## Production on Render

This project is designed to run as **one Render Web Service**. Render should build the Vite frontend and then start Express, which serves `dist/` and the `/api/*` routes.

- Build Command: `npm install && npm run build`
- Start Command: `npm start`

Set these environment variables in Render:

- `GEMINI_API_KEY` — your server-side Google Gemini API key.
- `GEMINI_MODEL` — optional, defaults to `gemini-2.5-flash`.
- `DATABASE_URL` — recommended for persistent accounts and profiles; use the connection string from your Render Postgres database.

Without `DATABASE_URL`, the server falls back to a local JSON store for development. Render's default filesystem is ephemeral, so this fallback should not be used for production account persistence.
