const netease = require('./music-netease');
const ytDlp = require('./music-yt-dlp');

async function getStreamUrl(query) {
  const track = await getTrack(query);
  return track?.streamUrl || null;
}

async function getTrack(query) {
  const provider = process.env.MUSIC_PROVIDER || 'auto';
  console.log(`[音乐] 搜索: "${query}" (来源: ${provider})`);

  if (provider !== 'yt-dlp') {
    const neteaseTrack = await netease.getTrack(query);
    if (neteaseTrack) {
      console.log(`[音乐] 网易云找到: ${neteaseTrack.title || query}`);
      return neteaseTrack;
    }
    if (provider === 'netease') {
      console.log(`[音乐] 网易云未找到: "${query}"`);
      return null;
    }
    console.log(`[音乐] 网易云未找到，尝试 yt-dlp…`);
  }

  if (provider !== 'netease') {
    const ytTrack = await ytDlp.getTrack(query);
    if (ytTrack) {
      console.log(`[音乐] yt-dlp 找到: ${ytTrack.title || query}`);
    } else {
      console.log(`[音乐] yt-dlp 也未找到: "${query}"`);
    }
    return ytTrack;
  }

  return null;
}

module.exports = { getStreamUrl, getTrack, searchUrl: ytDlp.searchUrl };
