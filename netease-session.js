const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_NETEASE_BASE = 'http://127.0.0.1:3000';
const DEFAULT_REQUEST_TIMEOUT_MS = 8000;
const DEFAULT_LOGIN_TIMEOUT_MS = 180000;

const DATA_DIR = path.join(__dirname, 'data', 'netease');
const LOCAL_CONFIG_PATH = path.join(DATA_DIR, 'local.config.json');
const QR_LOGIN_PATH = path.join(DATA_DIR, 'qr-login.html');

function boolEnv(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined || value === '') return defaultValue;
  return /^(1|true|yes|on)$/i.test(value);
}

function neteaseBaseUrl() {
  return (process.env.NETEASE_API_BASE || DEFAULT_NETEASE_BASE).replace(/\/+$/, '');
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function readLocalConfig() {
  try {
    return readJson(LOCAL_CONFIG_PATH) || {};
  } catch (err) {
    console.warn(`[netease-login] Ignoring unreadable local config: ${redactSensitiveText(err.message)}`);
    return {};
  }
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function writeLocalConfig(nextConfig) {
  ensureDataDir();
  const previous = readLocalConfig();
  const merged = {
    ...previous,
    ...nextConfig,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(LOCAL_CONFIG_PATH, `${JSON.stringify(merged, null, 2)}\n`, { mode: 0o600 });
  try {
    fs.chmodSync(LOCAL_CONFIG_PATH, 0o600);
  } catch {
    // Best-effort on non-POSIX filesystems.
  }
  return merged;
}

function maskSecret(value) {
  if (!value) return '';
  const text = String(value);
  if (text.length <= 12) return `${text.slice(0, 2)}...${text.slice(-2)}`;
  return `${text.slice(0, 6)}...${text.slice(-6)}`;
}

function maskCookieField(match, prefix, value) {
  return `${prefix}${maskSecret(value)}`;
}

function redactSensitiveText(value) {
  if (!value) return value;
  return String(value)
    .replace(/\b(MUSIC_U=)([^;&\s]+)/gi, maskCookieField)
    .replace(/\b(__csrf=)([^;&\s]+)/gi, maskCookieField)
    .replace(/\b(cookie=)([^&\s]+)/gi, maskCookieField);
}

function hasNeteaseCookie(cookie) {
  return typeof cookie === 'string' && /MUSIC_U=|__csrf=/.test(cookie);
}

function resolveCookie() {
  const envCookie = process.env.NETEASE_COOKIE;
  if (hasNeteaseCookie(envCookie)) {
    return { cookie: envCookie, source: 'env', path: null };
  }

  const localConfig = readLocalConfig();
  if (hasNeteaseCookie(localConfig.cookie)) {
    return { cookie: localConfig.cookie, source: 'local', path: LOCAL_CONFIG_PATH };
  }

  return { cookie: '', source: 'anonymous', path: null };
}

function getNeteaseConfig() {
  const cookie = resolveCookie();
  return {
    baseUrl: neteaseBaseUrl(),
    cookie: cookie.cookie,
    cookieSource: cookie.source,
    cookiePath: cookie.path,
  };
}

async function requestNeteaseJson(pathname, params = {}, options = {}) {
  const baseUrl = (options.baseUrl || neteaseBaseUrl()).replace(/\/+$/, '');
  const cookie = options.cookie || '';
  const timeoutMs = Number(options.timeoutMs || process.env.NETEASE_REQUEST_TIMEOUT_MS || DEFAULT_REQUEST_TIMEOUT_MS);
  const url = new URL(pathname, `${baseUrl}/`);
  const query = { ...params };

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  url.searchParams.set('timestamp', String(Date.now()));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const method = options.method || 'GET';
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (method !== 'GET' && method !== 'HEAD') headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : '{}',
      signal: controller.signal,
    });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    if (!res.ok) {
      const message = redactSensitiveText(body?.message || body?.msg || `HTTP ${res.status}`);
      throw new Error(message);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function verifyLoginStatus({ baseUrl = neteaseBaseUrl(), cookie } = {}) {
  if (!hasNeteaseCookie(cookie)) {
    return { valid: false, userId: null, reason: 'missing-cookie' };
  }

  try {
    const status = await requestNeteaseJson('/login/status', {}, { baseUrl, cookie });
    const profile = status?.data?.profile || status?.profile;
    if (profile?.userId) {
      return { valid: true, userId: profile.userId, reason: 'ok' };
    }
    return { valid: false, userId: null, reason: 'profile-missing' };
  } catch (err) {
    return { valid: false, userId: null, reason: redactSensitiveText(err.message) };
  }
}

function writeQrLoginPage(qrImg, qrUrl) {
  ensureDataDir();
  fs.writeFileSync(QR_LOGIN_PATH, `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Netease Music Login</title></head>
<body style="font-family: system-ui, sans-serif; margin: 40px;">
  <h1>Netease Music Login</h1>
  <p>Scan this QR code with the Netease Cloud Music mobile app.</p>
  <img src="${qrImg}" alt="Netease Cloud Music login QR code" style="width: 260px; height: 260px;">
  ${qrUrl ? `<p><a href="${qrUrl}">Open QR link</a></p>` : ''}
</body>
</html>
`, 'utf8');
  return QR_LOGIN_PATH;
}

function openUrl(url) {
  if (!url) return false;
  if (process.env.CI || process.env.NO_OPEN || !boolEnv('NETEASE_LOGIN_OPEN', true)) return false;

  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const result = spawnSync(command, args, { stdio: 'ignore' });
  return result.status === 0;
}

async function createQrLogin({ baseUrl = neteaseBaseUrl() } = {}) {
  const keyData = await requestNeteaseJson('/login/qr/key', {}, { baseUrl, withCookie: false });
  const key = keyData?.data?.unikey;
  if (!key) throw new Error('Failed to get QR login key from NeteaseCloudMusicApi.');

  const qrData = await requestNeteaseJson('/login/qr/create', { key, qrimg: true }, { baseUrl, withCookie: false });
  const qrUrl = qrData?.data?.qrurl;
  const qrImg = qrData?.data?.qrimg;
  const qrPage = qrImg ? writeQrLoginPage(qrImg, qrUrl) : '';
  return { key, qrUrl, qrImg, qrPage };
}

async function pollQrLogin({ baseUrl = neteaseBaseUrl(), key, timeoutMs = DEFAULT_LOGIN_TIMEOUT_MS } = {}) {
  const deadline = Date.now() + Number(timeoutMs || DEFAULT_LOGIN_TIMEOUT_MS);
  let lastCode = null;

  while (Date.now() < deadline) {
    const state = await requestNeteaseJson('/login/qr/check', { key }, { baseUrl, withCookie: false });
    const code = Number(state?.code);
    if (code !== lastCode) {
      if (code === 801) console.log('[netease-login] Waiting for scan...');
      if (code === 802) console.log('[netease-login] Scan confirmed; waiting for final authorization...');
      lastCode = code;
    }
    if (code === 803 && state.cookie) return { ok: true, cookie: state.cookie };
    if (code === 800) return { ok: false, reason: 'QR code expired.' };
    await new Promise(resolve => setTimeout(resolve, 2500));
  }

  return { ok: false, reason: 'Login timed out before authorization completed.' };
}

async function bootstrapNeteaseLogin({ baseUrl = neteaseBaseUrl(), required = false } = {}) {
  const loginBootstrap = boolEnv('NETEASE_LOGIN_BOOTSTRAP', true);
  const resolved = resolveCookie();

  if (resolved.cookie) {
    const status = await verifyLoginStatus({ baseUrl, cookie: resolved.cookie });
    if (status.valid) {
      console.log(`[netease-login] Using ${resolved.source} cookie for user ${status.userId}: ${maskSecret(resolved.cookie)}`);
      return { ok: true, source: resolved.source, userId: status.userId };
    }

    console.warn(`[netease-login] ${resolved.source} cookie is present but not valid (${redactSensitiveText(status.reason)}).`);
  }

  if (!loginBootstrap) {
    console.log('[netease-login] Login bootstrap disabled; continuing with anonymous Netease access.');
    return { ok: false, source: 'anonymous', reason: 'disabled' };
  }

  console.log('[netease-login] No valid cookie found. Creating Netease QR login page...');
  const qr = await createQrLogin({ baseUrl });
  if (qr.qrUrl) console.log(`[netease-login] QR URL: ${qr.qrUrl}`);
  if (qr.qrPage) console.log(`[netease-login] QR page: ${qr.qrPage}`);

  const opened = openUrl(qr.qrPage || qr.qrUrl);
  console.log(`[netease-login] Browser open: ${opened ? 'attempted' : 'skipped'}`);

  const result = await pollQrLogin({
    baseUrl,
    key: qr.key,
    timeoutMs: Number(process.env.NETEASE_LOGIN_TIMEOUT_MS || DEFAULT_LOGIN_TIMEOUT_MS),
  });

  if (result.ok) {
    const saved = writeLocalConfig({ cookie: result.cookie, source: 'qr-login' });
    console.log(`[netease-login] Login succeeded. Cookie saved to ${LOCAL_CONFIG_PATH}: ${maskSecret(saved.cookie)}`);
    return { ok: true, source: 'qr-login' };
  }

  const message = `[netease-login] ${redactSensitiveText(result.reason)}`;
  if (required) throw new Error(message);
  console.warn(`${message} Continuing with anonymous Netease access.`);
  return { ok: false, source: 'anonymous', reason: result.reason };
}

module.exports = {
  DATA_DIR,
  LOCAL_CONFIG_PATH,
  QR_LOGIN_PATH,
  boolEnv,
  bootstrapNeteaseLogin,
  getNeteaseConfig,
  hasNeteaseCookie,
  maskSecret,
  neteaseBaseUrl,
  readJson,
  readLocalConfig,
  redactSensitiveText,
  requestNeteaseJson,
  resolveCookie,
  verifyLoginStatus,
  writeLocalConfig,
};
