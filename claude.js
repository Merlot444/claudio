const { generateJson } = require('./llm');

function callClaude(prompt, options = {}) {
  return generateJson(prompt, options);
}

module.exports = { callClaude };
