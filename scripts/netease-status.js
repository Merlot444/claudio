require('dotenv').config();

const {
  getNeteaseConfig,
  maskSecret,
  redactSensitiveText,
  requestNeteaseJson,
  verifyLoginStatus,
} = require('../netease-session');

async function main() {
  const config = getNeteaseConfig();
  console.log(`[netease-status] API base: ${config.baseUrl}`);

  try {
    const version = await requestNeteaseJson('/inner/version', {}, {
      baseUrl: config.baseUrl,
      withCookie: false,
      method: 'POST',
      timeoutMs: 1500,
    });
    const versionText = version?.data?.version || version?.version || 'unknown';
    console.log(`[netease-status] API connected: v${versionText}`);
  } catch (err) {
    console.error(`[netease-status] API not reachable: ${redactSensitiveText(err.message)}`);
    process.exitCode = 1;
    return;
  }

  if (!config.cookie) {
    console.log('[netease-status] Cookie: anonymous');
    return;
  }

  console.log(`[netease-status] Cookie source: ${config.cookieSource} ${maskSecret(config.cookie)}`);
  const status = await verifyLoginStatus({ baseUrl: config.baseUrl, cookie: config.cookie });
  if (status.valid) {
    console.log(`[netease-status] Login valid for user ${status.userId}`);
  } else {
    console.error(`[netease-status] Login invalid: ${redactSensitiveText(status.reason)}`);
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(`[netease-status] ${redactSensitiveText(err.message)}`);
  process.exitCode = 1;
});
