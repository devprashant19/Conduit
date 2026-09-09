#!/usr/bin/env node
/**
 * Drive The Keeper the way the UI does — `brain:send` over the browser
 * WebSocket — and report what comes back.
 *
 * The Keeper is the one part of Conduit that cannot be checked by the smoke
 * test, because it needs a signed-in CLI. This makes its state observable:
 * which engine it chose, whether the turn produced an answer, and which of its
 * Conduit tools it actually called.
 *
 * Usage: node scripts/test-keeper.mjs ["a question"] [--new]
 *        --new starts a fresh conversation, so the answer is not shaped by
 *        whatever was said in the last one.
 * Env:   CONDUIT_URL, CONDUIT_AUTH, CONDUIT_KEEPER_ENGINE (codex | claude)
 */
import { WebSocket } from 'ws';

const BASE = process.env.CONDUIT_URL || 'http://localhost:3200';
const AUTH = process.env.CONDUIT_AUTH || '';
const args = process.argv.slice(2);
const FRESH = args.includes('--new');
const QUESTION = args.find((a) => !a.startsWith('--'))
  || 'List every project you can see, then stop. Keep it to one line.';
const TIMEOUT_MS = Number(process.env.KEEPER_TIMEOUT_MS || 180_000);

const headers = {};
if (AUTH) headers.Authorization = 'Basic ' + Buffer.from(AUTH).toString('base64');

const health = await fetch(BASE + '/api/health').then((r) => r.json()).catch(() => null);
if (!health?.ok) {
  console.error('Conduit is not running on ' + BASE + ' — start it with `npm run start:all`.');
  process.exit(2);
}

const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/ws', AUTH ? { headers } : undefined);
const messages = [];
let engine = '(unknown)';
let status = '';
let sawThinking = false;
let answer = '';
let errorText = '';

ws.on('message', (raw) => {
  let m;
  try { m = JSON.parse(raw.toString()); } catch { return; }
  if (m.type !== 'brain:event') return;
  const p = m.payload || {};
  if (p.kind === 'status') {
    status = p.status;
    if (p.status === 'thinking') sawThinking = true;
  }
  if (p.kind === 'state' && p.state?.engine) engine = p.state.engine;
  if (p.kind === 'append' && p.message) {
    const { role, text, tool } = p.message;
    messages.push({ role, tool, text: String(text || '') });
    if (role === 'assistant') answer = String(text || '');   // last one wins
    if (role === 'error') errorText = String(text || '');
  }
});

await new Promise((res, rej) => {
  ws.on('open', res);
  ws.on('error', rej);
  setTimeout(() => rej(new Error('websocket never opened')), 10_000);
});

console.log(`\nThe Keeper — ${BASE}`);
console.log(`asking: ${JSON.stringify(QUESTION)}\n`);

if (FRESH) {
  ws.send(JSON.stringify({ type: 'brain:new' }));
  await new Promise((r) => setTimeout(r, 1500));
}
ws.send(JSON.stringify({ type: 'brain:send', message: QUESTION }));

const started = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Done when the turn goes back to idle after having started, or on an error.
while (Date.now() - started < TIMEOUT_MS) {
  await sleep(1000);
  if (errorText) break;
  if (sawThinking && status === 'idle') break;
}
const elapsed = Math.round((Date.now() - started) / 1000);

console.log(`engine        : ${engine}`);
console.log(`turn started  : ${sawThinking}`);
console.log(`final status  : ${status || '(none)'}`);
console.log(`elapsed       : ${elapsed}s`);

const tools = messages.filter((m) => m.role === 'tool');
if (tools.length) {
  console.log(`\ntools called  : ${tools.length}`);
  for (const t of tools.slice(0, 8)) console.log(`  · ${t.tool}: ${t.text.slice(0, 90)}`);
}

if (errorText) {
  console.log(`\n✗ error:\n  ${errorText.split('\n').slice(0, 6).join('\n  ')}`);
} else if (answer) {
  console.log(`\n✓ answer:\n  ${answer.split('\n').slice(0, 10).join('\n  ')}`);
} else {
  console.log('\n✗ no answer and no error — the turn produced nothing.');
}

ws.close();
process.exit(errorText || !answer ? 1 : 0);
