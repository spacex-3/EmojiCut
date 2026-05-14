# Server API/Auth Design

## Outcome
EmojiCut will support multi-user Docker deployment without exposing API keys in browser JavaScript and without storing generation history on the server.

## Architecture
- Keep the Vite React app for the UI and local browser-only fallback.
- Add a small dependency-free Node HTTP server (`server.mjs`) that:
  - serves the built `dist/` app;
  - exposes `/api/auth/*`, `/api/config`, `/api/generate-sticker`, and `/api/generate-name`;
  - reads API provider, base URL, key, models, and password from environment variables;
  - holds no database and writes no uploaded/generated images.
- The frontend detects server configuration via `/api/config`. If the server is configured, generation/naming calls go through the server. If not, it falls back to the existing browser-side Gemini-compatible settings.

## API Providers
- `AI_PROVIDER=gemini`: server calls Gemini `generateContent` using `API_BASE_URL` or Google default.
- `AI_PROVIDER=openai`: server calls OpenAI-compatible `/v1/images/edits` for sticker-sheet generation and `/v1/chat/completions` for sticker naming.
- Provider request/response errors are sanitized and capped before returning to the browser.

## Authentication
- `APP_PASSWORD` enables password auth. Empty/missing disables auth.
- Login uses `/api/auth/login` and an HttpOnly signed session cookie.
- API generation routes require authentication when `APP_PASSWORD` is set.
- Static assets remain public; without an authenticated API session the app renders a login screen.

## Privacy / No Records
- No database.
- No server-side image or prompt files.
- No request body, base64 image, prompt, response, or API key logs.
- Only a signed session cookie is persisted in the browser.
- Generated stickers remain in browser memory until the user downloads or refreshes.

## Delivery
- Add GitHub Actions workflow for `npm ci`, tests, and `npm run build`.
- Add `Dockerfile`, `.dockerignore`, and `docker-compose.yml` with API/password env variables.
