import http from 'node:http';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const SESSION_COOKIE_NAME = 'emojicut_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_JSON_BODY_BYTES = 30 * 1024 * 1024;
const PROCESS_SESSION_SECRET = randomBytes(32).toString('hex');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

export function normalizeBaseUrl(value, fallback = '') {
  const source = `${value || fallback || ''}`.trim();
  return source.replace(/\/+$/, '');
}

export function resolveOpenAIUrl(baseUrl, endpoint) {
  const normalizedBase = normalizeBaseUrl(baseUrl || DEFAULT_OPENAI_BASE_URL);
  const normalizedEndpoint = `${endpoint || ''}`.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedEndpoint}`;
}

export function parseDataUrl(input, fallbackMimeType = 'image/png') {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new HttpError(400, '图片数据为空');
  }

  const trimmed = input.trim();
  const match = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.+)$/s.exec(trimmed);
  if (!match) {
    throw new HttpError(400, '图片必须是 base64 data URL');
  }

  const mimeType = match[1] || fallbackMimeType;
  const base64 = match[2].replace(/\s/g, '');
  if (!base64) {
    throw new HttpError(400, '图片 base64 数据为空');
  }

  return {
    mimeType,
    base64,
    buffer: Buffer.from(base64, 'base64'),
  };
}

export function extractOpenAIImageData(payload) {
  const item = payload?.data?.[0];
  if (item?.b64_json) {
    return `data:image/png;base64,${item.b64_json}`;
  }
  if (typeof item?.url === 'string' && item.url.startsWith('data:')) {
    return item.url;
  }
  if (typeof item?.url === 'string' && /^https?:\/\//i.test(item.url)) {
    return item.url;
  }
  throw new HttpError(502, 'AI 服务没有返回图片数据');
}

export function sanitizeProviderError(raw, apiKey = '') {
  let text = '';
  if (typeof raw === 'string') {
    text = raw;
  } else {
    try {
      text = JSON.stringify(raw);
    } catch {
      text = String(raw);
    }
  }

  if (apiKey) {
    text = text.split(apiKey).join('[REDACTED_API_KEY]');
  }

  return text.length > 1200 ? `${text.slice(0, 1200)}…` : text;
}

export function createSessionToken(secret, issuedAt = Date.now()) {
  if (!secret) {
    throw new Error('Session secret is required');
  }
  const timestamp = String(issuedAt);
  const signature = createHmac('sha256', secret).update(timestamp).digest('base64url');
  return `${timestamp}.${signature}`;
}

export function verifySessionToken(token, secret, maxAgeMs = SESSION_MAX_AGE_MS, now = Date.now()) {
  if (!token || !secret || typeof token !== 'string') return false;

  const [timestamp, signature] = token.split('.');
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;

  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt) || issuedAt > now || now - issuedAt > maxAgeMs) return false;

  const expected = createHmac('sha256', secret).update(timestamp).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function getRuntimeConfig(env = process.env) {
  const provider = `${env.AI_PROVIDER || 'gemini'}`.trim().toLowerCase();
  const apiKey = env.API_KEY || env.OPENAI_API_KEY || env.GEMINI_API_KEY || '';
  const baseUrl = normalizeBaseUrl(
    env.API_BASE_URL || env.OPENAI_API_BASE_URL || env.GEMINI_API_BASE_URL,
    provider === 'openai' ? DEFAULT_OPENAI_BASE_URL : DEFAULT_GEMINI_BASE_URL
  );

  return {
    provider,
    apiKey,
    baseUrl,
    imageModel:
      env.IMAGE_MODEL ||
      env.MODEL_NAME ||
      env.OPENAI_IMAGE_MODEL ||
      (provider === 'openai' ? 'gpt-image-1' : 'gemini-3-pro-image-preview'),
    namingModel:
      env.NAMING_MODEL ||
      env.OPENAI_NAMING_MODEL ||
      (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash'),
    openAIImageEndpoint: env.OPENAI_IMAGE_ENDPOINT || '/images/edits',
    openAIChatEndpoint: env.OPENAI_CHAT_ENDPOINT || '/chat/completions',
    openAIImageSize: env.OPENAI_IMAGE_SIZE || '1024x1024',
    openAIResponseFormat: env.OPENAI_RESPONSE_FORMAT || '',
    geminiApiVersion: env.GEMINI_API_VERSION || 'v1beta',
    configured: Boolean(apiKey),
  };
}

function isAuthRequired(env = process.env) {
  return Boolean(env.APP_PASSWORD);
}

function getSessionSecret(env = process.env) {
  return env.SESSION_SECRET || env.APP_PASSWORD || PROCESS_SESSION_SECRET;
}

function safeEqualString(a, b) {
  const aBuffer = Buffer.from(String(a || ''));
  const bBuffer = Buffer.from(String(b || ''));
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = new Map();
  for (const pair of cookieHeader.split(';')) {
    const index = pair.indexOf('=');
    if (index === -1) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) cookies.set(key, decodeURIComponent(value));
  }
  return cookies;
}

function isAuthenticated(req, env = process.env) {
  if (!isAuthRequired(env)) return true;
  const token = parseCookies(req).get(SESSION_COOKIE_NAME);
  return verifySessionToken(token, getSessionSecret(env));
}

function buildSessionCookie(token, env = process.env) {
  const secure = env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(
    SESSION_MAX_AGE_MS / 1000
  )}${secure}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

async function readJsonBody(req, maxBytes = MAX_JSON_BODY_BYTES) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new HttpError(413, '请求体太大');
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, '请求 JSON 格式无效');
  }
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function requireAuth(req, res, env) {
  if (isAuthenticated(req, env)) return true;
  sendJson(res, 401, { error: '请先登录' });
  return false;
}

function assertConfigured(config) {
  if (!config.configured) {
    throw new HttpError(503, '服务器未配置 API_KEY');
  }
  if (!['gemini', 'openai'].includes(config.provider)) {
    throw new HttpError(500, `不支持的 AI_PROVIDER: ${config.provider}`);
  }
}

function assertPromptAndImage(body) {
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) throw new HttpError(400, '缺少 prompt');
  const referenceImage = typeof body.referenceImage === 'string' ? body.referenceImage : '';
  return { prompt, referenceImage };
}

async function parseProviderResponse(response, apiKey) {
  const text = await response.text();
  if (!response.ok) {
    throw new HttpError(
      response.status >= 400 && response.status < 500 ? 502 : response.status,
      `AI 服务错误 ${response.status}: ${sanitizeProviderError(text, apiKey)}`
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(502, 'AI 服务返回了无效 JSON');
  }
}

async function dataUrlFromRemoteImage(url, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new HttpError(502, `AI 图片地址下载失败 ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || 'image/png';
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return `data:${contentType};base64,${base64}`;
}

async function callOpenAIImageEdit(config, referenceImage, prompt, fetchImpl = fetch) {
  const parsedImage = parseDataUrl(referenceImage);
  const imageBlob = new Blob([parsedImage.buffer], { type: parsedImage.mimeType });
  const form = new FormData();
  form.append('model', config.imageModel);
  form.append('prompt', prompt);
  form.append('n', '1');
  form.append('size', config.openAIImageSize);
  if (config.openAIResponseFormat) {
    form.append('response_format', config.openAIResponseFormat);
  }
  form.append('image', imageBlob, `reference.${extensionForMimeType(parsedImage.mimeType)}`);

  const response = await fetchImpl(resolveOpenAIUrl(config.baseUrl, config.openAIImageEndpoint), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: form,
  });

  const payload = await parseProviderResponse(response, config.apiKey);
  const imageData = extractOpenAIImageData(payload);
  return /^https?:\/\//i.test(imageData) ? dataUrlFromRemoteImage(imageData, fetchImpl) : imageData;
}

async function callOpenAIName(config, imageDataUrl, fetchImpl = fetch) {
  const body = {
    model: config.namingModel,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              "Analyze this sticker. Return a JSON object with a 'filename' property (max 4 Chinese characters, describing mood or action). Example: {\"filename\":\"开心\"}",
          },
          {
            type: 'image_url',
            image_url: {
              url: imageDataUrl,
            },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
  };

  const response = await fetchImpl(resolveOpenAIUrl(config.baseUrl, config.openAIChatEndpoint), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await parseProviderResponse(response, config.apiKey);
  const content = payload?.choices?.[0]?.message?.content;
  return parseFilenameFromModelText(content);
}

async function callGeminiGenerate(config, referenceImage, prompt, fetchImpl = fetch) {
  const parsedImage = parseDataUrl(referenceImage);
  const response = await fetchImpl(
    `${config.baseUrl}/${config.geminiApiVersion}/models/${encodeURIComponent(config.imageModel)}:generateContent?key=${encodeURIComponent(
      config.apiKey
    )}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ inlineData: { mimeType: parsedImage.mimeType, data: parsedImage.base64 } }, { text: prompt }],
          },
        ],
      }),
    }
  );

  const payload = await parseProviderResponse(response, config.apiKey);
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data);
  if (!imagePart) {
    throw new HttpError(502, 'Gemini 没有返回图片数据');
  }
  const mimeType = imagePart.inlineData.mimeType || 'image/png';
  return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}

async function callGeminiName(config, imageDataUrl, fetchImpl = fetch) {
  const parsedImage = parseDataUrl(imageDataUrl);
  const response = await fetchImpl(
    `${config.baseUrl}/${config.geminiApiVersion}/models/${encodeURIComponent(config.namingModel)}:generateContent?key=${encodeURIComponent(
      config.apiKey
    )}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: parsedImage.mimeType, data: parsedImage.base64 } },
              {
                text:
                  "Analyze this sticker. Return a JSON object with a 'filename' property (max 4 Chinese characters, describing user mood or action). Example: '开心', '点赞', '暗中观察'.",
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              filename: { type: 'STRING' },
            },
          },
        },
      }),
    }
  );

  const payload = await parseProviderResponse(response, config.apiKey);
  const text = payload?.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
  return parseFilenameFromModelText(text);
}

function extensionForMimeType(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'png';
}

function parseFilenameFromModelText(content) {
  const text = Array.isArray(content)
    ? content.map((part) => part?.text || '').join('\n')
    : typeof content === 'string'
      ? content
      : '';
  if (!text.trim()) return 'sticker';

  try {
    const parsed = JSON.parse(text);
    return cleanFilename(parsed?.filename);
  } catch {
    const jsonMatch = /\{[\s\S]*\}/.exec(text);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return cleanFilename(parsed?.filename);
      } catch {
        // fall through to plain text cleanup
      }
    }
  }

  return cleanFilename(text);
}

function cleanFilename(value) {
  const cleaned = String(value || 'sticker')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '')
    .trim();
  return cleaned ? cleaned.slice(0, 12) : 'sticker';
}

async function handleApiRequest(req, res, url, env) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  if (url.pathname === '/api/auth/status' && req.method === 'GET') {
    sendJson(res, 200, {
      authRequired: isAuthRequired(env),
      authenticated: isAuthenticated(req, env),
    });
    return;
  }

  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await readJsonBody(req, 4096);
    if (!isAuthRequired(env)) {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (!safeEqualString(body.password, env.APP_PASSWORD)) {
      sendJson(res, 401, { error: '密码错误' });
      return;
    }

    const token = createSessionToken(getSessionSecret(env));
    sendJson(res, 200, { ok: true }, { 'Set-Cookie': buildSessionCookie(token, env) });
    return;
  }

  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie() });
    return;
  }

  if (!requireAuth(req, res, env)) return;

  if (url.pathname === '/api/config' && req.method === 'GET') {
    const config = getRuntimeConfig(env);
    sendJson(res, 200, {
      serverConfigured: config.configured,
      provider: config.provider,
      imageModel: config.configured ? config.imageModel : '',
      namingModel: config.configured ? config.namingModel : '',
      authRequired: isAuthRequired(env),
    });
    return;
  }

  if (url.pathname === '/api/generate-sticker' && req.method === 'POST') {
    const config = getRuntimeConfig(env);
    assertConfigured(config);
    const body = await readJsonBody(req);
    const { prompt, referenceImage } = assertPromptAndImage(body);
    const imageDataUrl =
      config.provider === 'openai'
        ? await callOpenAIImageEdit(config, referenceImage, prompt)
        : await callGeminiGenerate(config, referenceImage, prompt);
    sendJson(res, 200, { imageDataUrl });
    return;
  }

  if (url.pathname === '/api/generate-name' && req.method === 'POST') {
    const config = getRuntimeConfig(env);
    assertConfigured(config);
    const body = await readJsonBody(req);
    const imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : '';
    if (!imageDataUrl) throw new HttpError(400, '缺少 imageDataUrl');
    const filename =
      config.provider === 'openai' ? await callOpenAIName(config, imageDataUrl) : await callGeminiName(config, imageDataUrl);
    sendJson(res, 200, { filename });
    return;
  }

  sendJson(res, 404, { error: 'API not found' });
}

async function serveStatic(req, res, url, distDir) {
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  let filePath = path.resolve(distDir, relativePath);
  const distRoot = path.resolve(distDir);
  if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${path.sep}`)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  let file;
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    file = await fs.readFile(filePath);
  } catch {
    try {
      filePath = path.join(distRoot, 'index.html');
      file = await fs.readFile(filePath);
    } catch {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('dist/index.html not found. Run npm run build first.');
      return;
    }
  }

  res.writeHead(200, {
    'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': path.basename(filePath) === 'index.html' ? 'no-store' : 'public, max-age=31536000, immutable',
    'Content-Length': file.length,
  });
  if (req.method === 'HEAD') {
    res.end();
  } else {
    res.end(file);
  }
}

export function createEmojiCutServer(options = {}) {
  const env = options.env || process.env;
  const rootDir = options.rootDir || process.cwd();
  const distDir = options.distDir || path.join(rootDir, 'dist');

  return http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) {
        await handleApiRequest(req, res, url, env);
        return;
      }
      await serveStatic(req, res, url, distDir);
    } catch (error) {
      const statusCode = error instanceof HttpError ? error.statusCode : 500;
      const message = error instanceof Error ? error.message : '服务器错误';
      sendJson(res, statusCode, { error: message });
    }
  });
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedFile === currentFile) {
  const port = Number(process.env.PORT || 8080);
  const host = process.env.HOST || '0.0.0.0';
  const server = createEmojiCutServer();
  server.listen(port, host, () => {
    console.log(`EmojiCut server listening on http://${host}:${port}`);
  });
}
