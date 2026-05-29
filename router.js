const NEXT_PATTERNS = /^(下一首|next|skip|跳过)$/i;
const PAUSE_PATTERNS = /^(暂停|pause|停一下)$/i;
const RESUME_PATTERNS = /^(继续|resume|play|播放)$/i;
const VOL_UP = /^(大声|音量大|louder|vol\s*up)$/i;
const VOL_DOWN = /^(小声|音量小|quieter|vol\s*down)$/i;
const SPEECH_ONLY_PATTERNS = /(测试.*声音|不要换歌|别换歌|不换歌|介绍当前|介绍一下当前|随便说两句|只说话|no\s*music|speech\s*only|what'?s playing)/i;

function route(message) {
  const msg = message.trim();
  if (NEXT_PATTERNS.test(msg)) return { action: 'next' };
  if (PAUSE_PATTERNS.test(msg)) return { action: 'pause' };
  if (RESUME_PATTERNS.test(msg)) return { action: 'resume' };
  if (VOL_UP.test(msg)) return { action: 'volume', delta: +10 };
  if (VOL_DOWN.test(msg)) return { action: 'volume', delta: -10 };
  if (SPEECH_ONLY_PATTERNS.test(msg)) return { action: 'claude', message: msg, mode: 'speech-only' };
  return { action: 'claude', message: msg, mode: 'music' };
}

module.exports = { route };
