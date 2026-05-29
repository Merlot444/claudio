const { spawn } = require('child_process');

const TIMEOUT_MS = 20000;

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error('yt-dlp timeout'));
    }, TIMEOUT_MS);

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => process.stderr.write(d));
    proc.on('close', () => {
      clearTimeout(timer);
      resolve(stdout.trim());
    });
    proc.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function searchUrl(query) {
  try {
    const out = await runYtDlp([`ytsearch1:${query}`, '--print', 'webpage_url', '--no-playlist']);
    const url = out.split('\n')[0].trim();
    return url.startsWith('http') ? url : null;
  } catch {
    return null;
  }
}

async function extractAudioUrl(videoUrl) {
  try {
    const out = await runYtDlp(['-x', '--get-url', videoUrl]);
    const url = out.split('\n')[0].trim();
    return url.startsWith('http') ? url : null;
  } catch {
    return null;
  }
}

async function getStreamUrl(query) {
  const videoUrl = await searchUrl(query);
  if (!videoUrl) return null;
  return extractAudioUrl(videoUrl);
}

async function getTrack(query) {
  const streamUrl = await getStreamUrl(query);
  if (!streamUrl) return null;

  const [title, artist] = query.split(' - ');
  return {
    query,
    title: title?.trim() || query,
    artist: artist?.trim() || '',
    streamUrl,
    lyrics: null,
  };
}

module.exports = { getStreamUrl, getTrack, searchUrl };
