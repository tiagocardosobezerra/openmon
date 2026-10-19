'use strict';

// Hides secrets in anything the pet shows: bubbles, OS notifications and
// the powers panels. Commands like `curl -H "Authorization: Bearer …"` or
// `API_KEY=… npm run deploy` should never end up on screen (or in a screen
// share) just because the agent ran them.

const MASK = '•••';

const RULES = [
  // Credentials in URLs: https://user:pass@host
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/:@]+:[^\s/@]+@/gi, `$1${MASK}@`],
  // Authorization headers.
  [/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{8,}/g, `$1 ${MASK}`],
  // Well-known key formats.
  [/\bsk-[A-Za-z0-9_-]{16,}/g, `sk-${MASK}`],
  [/\b(gh[pousr]_)[A-Za-z0-9]{20,}/g, `$1${MASK}`],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/g, `github_pat_${MASK}`],
  [/\b(xox[abposr]-)[A-Za-z0-9-]{10,}/g, `$1${MASK}`],
  [/\bAKIA[0-9A-Z]{16}\b/g, `AKIA${MASK}`],
  [/\bAIza[0-9A-Za-z_-]{30,}/g, `AIza${MASK}`],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, `jwt:${MASK}`],
  // --token xyz, --password=xyz, -p xyz after a password flag.
  [/(--?(?:token|password|passwd|pwd|secret|api[-_]?key|access[-_]?key|auth)(?:[= ]))("[^"]*"|'[^']*'|\S+)/gi, `$1${MASK}`],
  // KEY=value and key: value where the name says it is secret.
  [/\b([A-Za-z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|CREDENTIALS?|AUTH)[A-Za-z0-9_]*)(\s*[=:]\s*)(?!(?:Bearer|Basic|Token)\s|•••)("[^"]*"|'[^']*'|[^\s&"']+)/gi, `$1$2${MASK}`],
];

function redact(text) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out;
}

module.exports = { redact, MASK };
