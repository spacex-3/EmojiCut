# Server API/Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub Actions builds, OpenAI-compatible server-side API proxying, Docker Compose runtime configuration, and simple password auth without server-side generation records.

**Architecture:** A dependency-free Node server serves the Vite build and proxies AI calls using environment variables. The React client uses server config when present and otherwise keeps the existing local Gemini fallback.

**Tech Stack:** React 19, TypeScript, Vite, Node 20 HTTP/fetch/FormData, Docker, GitHub Actions.

---

### Task 1: Server tests

**Files:**
- Create: `tests/server.test.mjs`

- [ ] Write Node built-in tests for base URL normalization, OpenAI response parsing, data URL parsing, and signed session cookies.
- [ ] Run `node --test tests/server.test.mjs` and verify it fails because `server.mjs` does not exist yet.

### Task 2: Server implementation

**Files:**
- Create: `server.mjs`

- [ ] Export pure helpers used by tests.
- [ ] Implement static `dist/` serving and SPA fallback.
- [ ] Implement `/api/auth/status`, `/api/auth/login`, `/api/config`, `/api/generate-sticker`, and `/api/generate-name`.
- [ ] Implement Gemini and OpenAI-compatible provider calls.
- [ ] Ensure no request body, prompt, image base64, response body, or API key is logged.
- [ ] Run `node --test tests/server.test.mjs` and verify it passes.

### Task 3: Frontend integration

**Files:**
- Modify: `services/geminiService.ts`
- Modify: `App.tsx`
- Create: `components/LoginScreen.tsx`

- [ ] Make generation/naming use server endpoints when `/api/config` reports server configuration.
- [ ] Preserve current browser-local Gemini fallback for non-Docker local usage.
- [ ] Add login gate using `/api/auth/status` and `/api/auth/login`.
- [ ] Remove API request payload logging from browser code.

### Task 4: Packaging and CI

**Files:**
- Modify: `package.json`
- Create: `.github/workflows/build.yml`
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docker-compose.yml`
- Modify: `README.md`

- [ ] Add `test`, `serve`, and existing `build` scripts.
- [ ] Add GitHub Actions workflow that runs install, test, and build.
- [ ] Add Docker image build using the Vite build and `server.mjs` runtime.
- [ ] Add Compose env examples for `AI_PROVIDER`, `API_BASE_URL`, `API_KEY`, `IMAGE_MODEL`, `NAMING_MODEL`, and `APP_PASSWORD`.
- [ ] Document privacy/no-record behavior.

### Task 5: Verification

**Files:**
- All changed files

- [ ] Run `node --test tests/server.test.mjs`.
- [ ] Run `npm run build` if the local dependency tree responds; otherwise report the local node_modules hang and rely on CI workflow structure.
- [ ] Inspect changed files for accidental secret/log persistence.
