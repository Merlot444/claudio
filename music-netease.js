const DEFAULT_TIMEOUT_MS = 8000;
const { getNeteaseConfig, redactSensitiveText } = require('./netease-session');

function getConfig() {
  const { baseUrl, cookie } = getNeteaseConfig();
  return { baseUrl, cookie };
}

function withTimeout(signal, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function requestJson(path, params = {}) {
  const { baseUrl, cookie } = getConfig();
  if (!baseUrl) return null;

  const url = new URL(baseUrl + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const timeout = withTimeout();
  try {
    const res = await fetch(url, {
      headers: cookie ? { Cookie: cookie } : undefined,
      signal: timeout.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    timeout.clear();
  }
}

function normalizeSong(raw) {
  if (!raw) return null;

  const artists = raw.artists || raw.ar || [];
  return {
    id: raw.id,
    title: raw.name,
    artist: artists.map(a => a.name).filter(Boolean).join(', '),
  };
}

async function searchSong(query) {
  try {
    const data = await requestJson('/search', {
      keywords: query,
      type: 1,
      limit: 1,
    });
    return normalizeSong(data?.result?.songs?.[0]);
  } catch (err) {
    console.warn('[netease] search failed:', redactSensitiveText(err.message));
    return null;
  }
}

async function getStreamUrl(query) {
  const { baseUrl } = getConfig();
  if (!baseUrl) return null;

  const song = await searchSong(query);
  if (!song?.id) return null;

  try {
    const data = await requestJson('/song/url/v1', {
      id: song.id,
      level: process.env.NETEASE_LEVEL || 'standard',
    });
    const item = data?.data?.[0];
    const url = item?.url;
    if (!url) {
      console.warn(`[netease] no playable url: ${song.title} - ${song.artist || 'unknown'}`);
      return null;
    }
    return url;
  } catch (err) {
    console.warn('[netease] url failed:', redactSensitiveText(err.message));
    return null;
  }
}

async function getLyrics(id) {
  if (!id) return null;

  try {
    const data = await requestJson('/lyric', { id });
    const lrc = data?.lrc?.lyric || '';
    const translated = data?.tlyric?.lyric || '';
    if (!lrc && !translated) return null;
    return { lrc, translated };
  } catch (err) {
    console.warn('[netease] lyric failed:', redactSensitiveText(err.message));
    return null;
  }
}

async function getTrack(query) {
  const { baseUrl } = getConfig();
  if (!baseUrl) return null;

  const song = await searchSong(query);
  if (!song?.id) return null;

  try {
    const data = await requestJson('/song/url/v1', {
      id: song.id,
      level: process.env.NETEASE_LEVEL || 'standard',
    });
    const item = data?.data?.[0];
    const streamUrl = item?.url;
    if (!streamUrl) {
      console.warn(`[netease] no playable url: ${song.title} - ${song.artist || 'unknown'}`);
      return null;
    }

    return {
      ...song,
      query,
      streamUrl,
      lyrics: await getLyrics(song.id),
    };
  } catch (err) {
    console.warn('[netease] track failed:', redactSensitiveText(err.message));
    return null;
  }
}

module.exports = { getStreamUrl, getTrack, searchSong, getLyrics };
