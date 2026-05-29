require('dotenv').config();

const {
  bootstrapNeteaseLogin,
  boolEnv,
  neteaseBaseUrl,
  redactSensitiveText,
} = require('../netease-session');

async function main() {
  await bootstrapNeteaseLogin({
    baseUrl: neteaseBaseUrl(),
    required: boolEnv('NETEASE_REQUIRED', false),
  });
}

main().catch(err => {
  console.error(`[netease-login] ${redactSensitiveText(err.message)}`);
  process.exitCode = 1;
});
