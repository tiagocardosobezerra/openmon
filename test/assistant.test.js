'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createAssistant, claudeArgs } = require('../src/assistant');
const { readTranscript, messagesOf } = require('../src/transcript');

// A stand-in for `claude -p`: records what Openmon writes, and lets the test
// play Claude Code's side of the conversation.
function fakeClaude() {
  const runs = [];
  const spawn = (args, cwd) => {
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => child.emit('exit', null);
    const run = { args, cwd, child, sent: [] };
    child.stdin.on('data', (d) => {
      for (const line of String(d).split('\n')) if (line.trim()) run.sent.push(JSON.parse(line));
    });
    child.stdin.on('finish', () => setImmediate(() => child.emit('exit', 0)));
    run.say = (event) => child.stdout.write(`${JSON.stringify(event)}\n`);
    runs.push(run);
    return child;
  };
  return { runs, spawn };
}

const tick = () => new Promise((r) => setTimeout(r, 20));

test('claude arguments: stream JSON both ways, permissions asked of Openmon, a UUID session', () => {
  const id = '7a4be6be-457a-4b1d-8748-023f7f090cf2';
  const fresh = claudeArgs({ sessionId: id });
  assert.ok(fresh.includes('-p') && fresh.includes('stdio') && fresh.includes('--include-partial-messages'));
  assert.deepEqual(fresh.slice(-2), ['--session-id', id]);
  assert.deepEqual(claudeArgs({ sessionId: id, resume: true }).slice(-2), ['--resume', id]);
  assert.throws(() => claudeArgs({ sessionId: 'x; rm -rf /' }));
  assert.ok(!claudeArgs({ sessionId: id, model: 'opus && calc' }).includes('--model'));
});

test('a chat: streams the answer, lists tools, asks before a tool, counts the cost', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-chat-'));
  const fake = fakeClaude();
  const changes = [];
  const asked = [];
  const done = [];
  const a = createAssistant({
    dir,
    spawn: fake.spawn,
    onChange: (id, c) => changes.push(c),
    askPermission: async (chat, req) => {
      asked.push(req);
      return { decision: 'allow' };
    },
    onDone: (chat, line) => done.push(line),
  });
  const r = a.create({ cwd: dir, text: 'Crie nota.txt' });
  assert.equal(r.ok, true);
  const run = fake.runs[0];
  assert.equal(run.cwd, dir);
  assert.equal(run.sent[0].request.subtype, 'initialize');
  assert.equal(run.sent[1].type, 'user');
  assert.equal(run.sent[1].message.content[0].text, 'Crie nota.txt');
  assert.equal(a.list()[0].status, 'working');

  run.say({ type: 'stream_event', event: { type: 'message_start' } });
  run.say({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Vou ' } } });
  run.say({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'C:/x/nota.txt', content: 'ola' } }] } });
  run.say({ type: 'control_request', request_id: 'r1', request: { subtype: 'can_use_tool', tool_name: 'Write', input: { file_path: 'C:/x/nota.txt', content: 'ola' } } });
  await tick();
  assert.equal(asked[0].tool, 'Write');
  const answer = run.sent.find((m) => m.type === 'control_response');
  assert.equal(answer.response.request_id, 'r1');
  assert.equal(answer.response.response.behavior, 'allow');
  assert.deepEqual(answer.response.response.updatedInput, { file_path: 'C:/x/nota.txt', content: 'ola' });

  run.say({ type: 'assistant', message: { content: [{ type: 'text', text: 'Pronto: nota.txt criado.' }] } });
  run.say({ type: 'result', total_cost_usd: 0.02 });
  await tick();
  assert.ok(changes.some((c) => c.op === 'delta' && c.text === 'Vou '));
  const chat = a.get(r.id);
  assert.deepEqual(chat.messages.map((m) => m.role), ['user', 'tool', 'assistant']);
  assert.equal(chat.messages[1].text, 'Write: nota.txt');
  assert.equal(chat.status, 'idle');
  assert.equal(chat.costUsd, 0.02);
  assert.deepEqual(done, ['Pronto: nota.txt criado.']);
  assert.ok(a.owns(chat.sessionId));

  // A second message in the same process; the cost counts what grew.
  a.send(r.id, { text: 'Obrigado', images: [{ type: 'image/png', data: 'AAAA' }, { type: 'text/html', data: 'x' }] });
  const second = run.sent[run.sent.length - 1];
  assert.equal(second.message.content.length, 2);
  assert.equal(second.message.content[1].source.media_type, 'image/png');
  run.say({ type: 'result', total_cost_usd: 0.03 });
  await tick();
  assert.ok(Math.abs(a.get(r.id).costUsd - 0.03) < 1e-9);

  // Saved: a new assistant on the same folder finds the conversation.
  a.closeAll();
  await tick();
  const again = createAssistant({ dir, spawn: fake.spawn });
  assert.equal(again.list()[0].id, r.id);
  assert.equal(again.get(r.id).messages.length, 4);
  // Writing again resumes the same Claude Code session.
  again.send(r.id, { text: 'Mais uma' });
  assert.deepEqual(fake.runs[1].args.slice(-2), ['--resume', chat.sessionId]);
});

test('a chat: a denial carries the reason; a question gets your answers; stop interrupts', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-chat-'));
  const fake = fakeClaude();
  const a = createAssistant({
    dir,
    spawn: fake.spawn,
    askPermission: async () => ({ decision: 'deny', message: 'Não mexa nisso' }),
    askQuestion: async () => ({ 'Qual?': 'A' }),
  });
  const { id } = a.create({ cwd: dir, text: 'oi' });
  const run = fake.runs[0];
  run.say({ type: 'control_request', request_id: 'p', request: { subtype: 'can_use_tool', tool_name: 'Bash', input: { command: 'rm -rf x' } } });
  run.say({ type: 'control_request', request_id: 'q', request: { subtype: 'can_use_tool', tool_name: 'AskUserQuestion', input: { questions: [{ question: 'Qual?' }] } } });
  run.say({ type: 'control_request', request_id: 'h', request: { subtype: 'hook_callback' } });
  await tick();
  const by = (rid) => run.sent.find((m) => m.type === 'control_response' && m.response.request_id === rid).response;
  assert.equal(by('p').response.behavior, 'deny');
  assert.equal(by('p').response.message, 'Não mexa nisso');
  assert.deepEqual(by('q').response.updatedInput.answers, { 'Qual?': 'A' });
  assert.equal(by('h').subtype, 'error');
  assert.equal(a.stop(id), true);
  assert.equal(run.sent[run.sent.length - 1].request.subtype, 'interrupt');
});

test('a chat needs a real folder, and Claude Code missing says so', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-chat-'));
  const a = createAssistant({
    dir,
    spawn: () => {
      const e = new Error('spawn claude ENOENT');
      e.code = 'ENOENT';
      throw e;
    },
  });
  assert.equal(a.create({ cwd: path.join(dir, 'nope'), text: 'x' }).reason, 'folder');
  const r = a.create({ cwd: dir, text: 'x' });
  assert.equal(r.reason, 'missing');
  assert.equal(a.get(r.id).messages[0].code, 'missing');
});

test('transcript: what you and the agent said, one line per tool, no wrappers', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-tr-'));
  const file = path.join(dir, '.claude', 'projects', 'x', 's.jsonl');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lines = [
    { type: 'user', timestamp: '2026-10-23T10:00:00Z', message: { role: 'user', content: 'corrige os testes' } },
    { type: 'user', message: { role: 'user', content: '<command-name>/clear</command-name>' } },
    { type: 'assistant', message: { id: 'm1', content: [{ type: 'thinking', thinking: 'hm' }, { type: 'text', text: 'Vou olhar.' }] } },
    { type: 'assistant', message: { id: 'm1', content: [{ type: 'text', text: 'Vou olhar.' }] } },
    { type: 'assistant', message: { id: 'm2', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm test' } }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] } },
    { type: 'assistant', isSidechain: true, message: { content: [{ type: 'text', text: 'subagent' }] } },
  ];
  fs.writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
  const out = readTranscript(file);
  assert.deepEqual(out.map((m) => [m.role, m.text]), [['user', 'corrige os testes'], ['assistant', 'Vou olhar.'], ['tool', 'Bash: npm test']]);
  assert.equal(readTranscript(path.join(dir, 'other.jsonl')), null);
  // A message written on the pet arrives as a hook's output: shown as yours.
  const hook = fs.readFileSync(path.join(__dirname, '..', 'src', 'hook.js'), 'utf8');
  const mark = /`(Message from the user, sent from the Openmon desktop pet\. Treat it as the user's next message:)/.exec(hook);
  assert.ok(mark, 'hook.js still writes the line the transcript reader looks for');
  fs.appendFileSync(file, `${JSON.stringify({ type: 'user', message: { role: 'user', content: `<task-notification>
<summary>Stop hook feedback</summary>
</task-notification>
<system-reminder>
Stop hook blocking error from command "Stop": ${mark[1]}

Revise o projeto, por favor.
</system-reminder>` } })}
`);
  const last = readTranscript(file).pop();
  assert.deepEqual([last.role, last.text, last.via], ['user', 'Revise o projeto, por favor.', 'pet']);
  assert.deepEqual(messagesOf(null), []);
});

test('claude arguments: who the assistant is, its tools, only safe paths and names', () => {
  const id = '7a4be6be-457a-4b1d-8748-023f7f090cf2';
  const args = claudeArgs({ sessionId: id, model: 'haiku', systemFile: 'C:/Users/a b/.openmon/chats/persona-1.md', mcpConfig: 'C:/Users/a b/.openmon/chats/mcp.json', allowedTools: ['mcp__openmon', 'Read', 'Bash(rm -rf *)'] });
  assert.deepEqual(args.slice(args.indexOf('--model'), args.indexOf('--model') + 2), ['--model', 'haiku']);
  assert.ok(args.includes('--append-system-prompt-file') && args.includes('--mcp-config'));
  assert.equal(args[args.indexOf('--allowedTools') + 1], 'mcp__openmon,Read');
  const bad = claudeArgs({ sessionId: id, systemFile: 'C:/x" & calc & "', mcpConfig: 'a|b' });
  assert.ok(!bad.includes('--append-system-prompt-file') && !bad.includes('--mcp-config'));
});

test('mcp: initialize, the tool list, an unknown tool', async () => {
  const { handle, TOOLS } = require('../src/mcp');
  const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.result.serverInfo.name, 'openmon');
  const list = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map((t) => t.name), TOOLS.map((t) => t.name));
  assert.ok(['remind', 'schedule_task', 'remember', 'say', 'work_summary'].every((n) => TOOLS.some((t) => t.name === n)));
  assert.equal((await handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'nope' } })).error.code, -32602);
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
});
