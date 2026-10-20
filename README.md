# Nova AI

Nova AI is a Next.js chat application backed by an Express API and MongoDB. Signed-in conversations and message attempts persist in MongoDB. The backend calls an OpenAI-compatible provider, keeps provider credentials on the server, streams authenticated responses, and applies per-account daily quotas.

## Architecture

- `test1fe/` — Next.js App Router UI, typed API client, auth/conversation providers, markdown rendering.
- `test1/` — Express API, Mongoose models, auth, conversation services, AI provider adapter, SMTP reset mail, structured logs.
- API routes are available under `/api/v1`. The older `/api` compatibility routes are retained for existing auth clients; they enforce the same private-route authentication checks.
- Access and refresh credentials are HttpOnly cookies. Passwords use bcrypt. Refresh tokens and password reset tokens are stored as hashes.
- AI requests use bounded recent context (`AI_CONTEXT_MESSAGES` and a character cap). Signed-in chat streams deltas and stores a completed or failed assistant attempt.

## Requirements

- Node.js 20.9 or newer (Node 22 LTS recommended).
- MongoDB 6.0 or newer, local or hosted.
- An API key and model from an OpenAI-compatible chat-completions provider. OpenRouter works with the example endpoint.
- SMTP credentials to deliver password-reset links.

## Configure

Create local environment files from the examples:

```sh
cp test1/.env.example test1/.env
cp test1fe/.env.example test1fe/.env
```

Set the following in `test1/.env`:

- `MONGODB_URI` — MongoDB connection string.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` — different random secrets, each at least 32 characters. For example, generate each with `openssl rand -hex 32`.
- `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` — provider credentials and model. Keep these only in the backend environment.
- `FRONTEND_URL` — allowed browser origin. Multiple origins can be comma-separated.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `PASSWORD_RESET_FRONTEND_URL` — set all SMTP credentials to enable reset email. If SMTP is not configured, reset requests fail with a safe service-unavailable response.
- `AUTH_DAILY_MESSAGE_LIMIT` — signed-in daily AI generation cap; defaults to 100.
- `TRUST_PROXY` — leave `false` for direct/local connections. Set it to the number of trusted reverse-proxy hops (commonly `1`) only when the API is behind that proxy, so IP-based rate limits use the client IP safely.

Set `NEXT_PUBLIC_API_URL` in `test1fe/.env` to the backend origin, without `/api`, for example `http://localhost:8690`.

The environment loader accepts the existing `DB_STRING`, `CorsUrl`, and `OPENROUTER_*` names as migration aliases. Do not commit `.env` files.

## Install and run

In one terminal:

```sh
cd test1
npm install
npm run loc
```

In another terminal:

```sh
cd test1fe
npm install
npm run dev
```

Open `http://localhost:3000`. The API listens on `http://localhost:8690` by default. `GET /api/v1/health` checks process liveness; `GET /api/v1/ready` also checks MongoDB connectivity.

## Main API

All success responses use `{ "success": true, "data": ... }`; errors return a safe message, error code, and request ID.

| Method | Route | Access |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Public |
| POST | `/api/v1/auth/login` | Public |
| POST | `/api/v1/auth/logout` | Cookie session |
| POST | `/api/v1/auth/refresh` | Refresh cookie |
| GET | `/api/v1/auth/me` | Signed in |
| POST | `/api/v1/auth/forgot-password` | Public, rate limited |
| POST | `/api/v1/auth/reset-password` | Reset token |
| POST / GET | `/api/v1/conversations` | Signed in; create or cursor-list |
| GET | `/api/v1/conversations/search?q=...` | Signed in; searches titles and messages |
| GET / PATCH / DELETE | `/api/v1/conversations/:id` | Owner only |
| GET | `/api/v1/conversations/:id/messages` | Owner only; cursor pagination |
| POST | `/api/v1/conversations/:id/messages` | Owner only; accepts JSON or `Accept: text/event-stream` |
| POST | `/api/v1/conversations/:id/messages/:messageId/regenerate` | Owner only; JSON or SSE |
| POST | `/api/v1/conversations/:id/messages/:messageId/stop` | Owner only; active API process |
| GET | `/api/v1/health`, `/api/v1/ready` | Public |

SSE events are `start`, `delta`, `done`, and `error`. Clients should send a stable `clientMessageId` when retrying the same user submission. A retry reuses the saved user message and does not create a duplicate user turn. Regeneration creates a separate assistant attempt.

## Checks

```sh
cd test1 && npm test
cd test1fe && npx tsc --noEmit && npx eslint
```

Manual end-to-end checklist:

1. Register, sign out, sign in, reload, and confirm the session is restored from cookies.
2. Open `/chatbot` as a guest and verify sign-in is required before any chat API request is made.
3. Sign in, send a streaming message, reload the route, and confirm messages load from history.
4. Create two conversations; search, rename, delete, and verify the active chat and sidebar update.
5. Stop a response, retry a failed response, regenerate a completed response, and verify the stored attempts.
6. Sign in as another account and confirm the first account's conversation IDs return not found.
7. Test invalid credentials, expired refresh cookies, oversized messages, missing provider credentials, provider timeouts, and password reset with a working SMTP mailbox.

## Operations and security

- The backend emits JSON logs in production and readable logs in development, with request IDs and durations. It deliberately omits cookies, credentials, and message bodies. Collect stdout/stderr with the deployment platform or a process manager and configure retention there; the application does not write rotating log files.
- Graceful SIGINT/SIGTERM handling closes the HTTP server and MongoDB connection. The app exposes health and readiness endpoints for process managers.
- Auth and short-window IP rate limits are in-memory per Node process. Authenticated daily AI quotas are stored in MongoDB. For multi-instance deployments, use a shared rate-limit store for the short-window limits.
- Stop-generation controllers are process-local. Route stop requests to the instance running that stream, or use a shared job/stream coordinator when deploying multiple API instances.
- Use HTTPS in production so cookies are Secure. Restrict `FRONTEND_URL`, configure MongoDB network access, rotate secrets, and use a trusted SMTP sender.
- Chat generation is unavailable to guests. The frontend redirects guests to sign-in, and every backend conversation and generation route requires a verified session.

## Dependency review

Backend dependency audit is clean after removing the development-only file watcher in favor of Node's built-in `--watch`. The frontend audit currently reports five high-severity findings through `eslint-config-next` → `fast-glob` → `micromatch` → `braces`. The registry does not currently provide the patched `braces@3.0.4` version suggested by the advisory, and downgrading the Next lint config would mismatch the installed Next 16 app. Re-run `npm audit` after the upstream packages publish a compatible fix.
# Nova_Ai
