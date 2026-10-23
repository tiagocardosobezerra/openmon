'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { redact } = require('../src/redact');
const { classify } = require('../src/classify');
const { createPowers } = require('../src/powers');

test('secrets are masked in commands, URLs and headers', () => {
  const cases = [
    ['API_KEY=abc123def456 npm run deploy', 'API_KEY=••• npm run deploy'],
    ['curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcdefghijk"', 'curl -H "Authorization: Bearer •••"'],
    ['git clone https://tiago:hunter2@github.com/x/y.git', 'git clone https://•••@github.com/x/y.git'],
    ['gh auth login --with-token ghp_ABCDEFGHIJKLMNOPQRSTUV1234', 'gh auth login --with-token •••'],
    ['mysql -u root --password=s3cret db', 'mysql -u root --password=••• db'],
    ['export OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuv', 'export OPENAI_API_KEY=•••'],
    ['aws s3 ls # key AKIAABCDEFGHIJKLMNOP', 'aws s3 ls # key AKIA•••'],
    ['npm test', 'npm test'],
    ['echo $TOKEN_COUNT', 'echo $TOKEN_COUNT'],
  ];
  for (const [input, expected] of cases) assert.equal(redact(input), expected, input);
});

test('masked before reaching bubbles, notifications and powers', () => {
  const sig = classify({ session_id: 's', hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'DB_PASSWORD=pw123 ./migrate' } });
  assert.equal(sig.detail, 'Allow Bash: DB_PASSWORD=••• ./migrate?');
  const p = createPowers();
  p.record({ session_id: 's', hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'curl https://x --token abcdefgh' } }, 's', 1);
  assert.equal(p.view()[0].shell[0].command, 'curl https://x --token •••');
});

test('a private key (PEM) is hidden whole, every line of it', () => {
  const { redact } = require('../src/redact');
  const pem = 'const k = `-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA1234\nabcdEFGH5678\n-----END RSA PRIVATE KEY-----`;';
  const out = redact(pem);
  assert.ok(!out.includes('MIIEow') && !out.includes('abcdEFGH'), out);
  assert.ok(out.includes('-----BEGIN RSA PRIVATE KEY-----'), out);
});
