#!/usr/bin/env node
/**
 * Click everything. Call everything. See what breaks.
 *
 * `browser-check` walks a happy path through a few controls. This is the
 * exhaustive pass: it enumerates every button, tab and control the app renders
 * on a real project with real running agents, clicks each one, and asserts the
 * app is still alive and silent afterwards. Then it calls every REST route and
 * checks the shape of what comes back.
 *
 * Two classes of failure it exists to catch, both of which have happened here:
 *
 *   - A control that renders but does nothing, or throws into the console where
 *     nobody looks. A dead button is invisible in a screenshot.
 *   - A route that answers 200 with the wrong shape, so the UI renders empty
 *     and the bug looks like "no data" rather than "broken endpoint".
 *
 * It also asserts terminal text integrity, because a wrapped line that silently
 * loses a character is indistinguishable from correct output by eye — that is
 * exactly how a two-column overflow survived several rounds of screenshots.
 *
 * Usage:
 *   npm run start:all
 *   npm run check:ui
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

const BASE = process.env.CONDUIT_URL || 'http://localhost:3200';
const AUTH = process.env.CONDUIT_AUTH || '';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CDP_PORT = 9878;
const WIDTH = 1440;
const HEIGHT = 900;

const headers = { 'Content-Type': 'application/json' };
if (AUTH) headers.Authorization = 'Basic ' + Buffer.from(AUTH).toString('base64');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const problems = [];
function t(ok, label, detail) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) { failures++; problems.push(`${label}${detail ? ` — ${detail}` : ''}`); }
  return ok;
}

async function api(method, p, body) {
  const res = await fetch(BASE + '/api' + p, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

const health = await fetch(BASE + '/api/health').then((r) => r.json()).catch(() => null);
if (!health?.ok) {
  console.error(`Conduit is not running on ${BASE} — start it with \`npm run start:all\`.`);
  process.exit(2);
}

// ── a project worth clicking around in ────────────────────────────────
const name = 'uicheck-' + Date.now().toString(36);
const cwd = path.join(os.tmpdir(), name);
fs.mkdirSync(cwd, { recursive: true });
const created = await api('POST', '/projects', { name, cwd, description: 'UI audit fixture' });
if (created.status !== 201) {
  console.error('could not create the fixture project:', created.status, created.json);
  process.exit(2);
}
const projectId = created.json.id;
for (const [n, cli, role] of [['Claude', 'claude', 'lead'], ['Gemini', 'gemini', 'tests']]) {
  await api('POST', `/projects/${projectId}/agents`, { name: n, cli, role });
}
const seeded = (await api('GET', `/projects/${projectId}/agents`)).json || [];
for (const a of seeded) await api('POST', `/projects/${projectId}/agents/${a.id}/start`);
await api('POST', `/projects/${projectId}/wiki/initialize`).catch(() => {});
await api('POST', `/projects/${projectId}/content`, {
  filename: 'notes.md', content: '# Notes\n\nSomething to click on.\n', createdBy: 'check',
});
await api('POST', `/projects/${projectId}/groupchat`, { message: 'Hello from the UI audit.' });

console.log(`\nUI audit — ${BASE}`);
console.log(`fixture: ${name} with ${seeded.length} agents\n`);
await sleep(8000);   // let the agents paint something

// ── drive a real browser ──────────────────────────────────────────────
const bin = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].filter(Boolean).find((p) => fs.existsSync(p));
if (!bin) { console.error('No Chromium-based browser found; set BROWSER=<path>'); process.exit(2); }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'conduit-ui-'));
const child = spawn(bin, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--disable-extensions', '--disable-component-extensions-with-background-pages',
  '--no-first-run', '--no-default-browser-check',
  `--window-size=${WIDTH},${HEIGHT}`,
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

let wsUrl = null;
for (let i = 0; i < 80 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json()).webSocketDebuggerUrl; }
  catch { await sleep(500); }
}
if (!wsUrl) { child.kill(); console.error('browser did not start'); process.exit(2); }

const cdp = new WebSocket(wsUrl, { maxPayload: 128 * 1024 * 1024 });
let msgId = 0;
const pending = new Map();
let sessionId = null;
/** Anything the page logs as an error, with the control that provoked it. */
const consoleErrors = [];
let currentAction = 'page load';
cdp.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params?.exceptionDetails;
    consoleErrors.push(`[${currentAction}] ${d?.exception?.description || d?.text || 'exception'}`);
  } else if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
    const text = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
    consoleErrors.push(`[${currentAction}] ${text}`);
  }
});
await new Promise((r) => cdp.on('open', r));

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    cdp.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

const targets = await send('Target.getTargets');
const page = targets.result.targetInfos.find((x) => x.type === 'page');
sessionId = (await send('Target.attachToTarget', { targetId: page.targetId, flatten: true })).result.sessionId;
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false,
});

const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', {
    expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true,
  });
  if (r?.result?.exceptionDetails) {
    consoleErrors.push(`[${currentAction}] eval: ${r.result.exceptionDetails.text}`);
    return null;
  }
  return r?.result?.result?.value ?? null;
};

try {
  // The hash is read at boot, not on hashchange, so navigate then reload.
  await send('Page.navigate', { url: BASE + '/' });
  await sleep(1200);
  await evalJs(`localStorage.setItem('conduit-onboarding-completed','1');
                localStorage.setItem('conduit-onboarding-skipped','1'); return true;`);
  await send('Page.navigate', { url: BASE + '/#console' });
  await sleep(700);
  await send('Page.reload');
  await sleep(2800);

  t(await evalJs(`return !!document.querySelector('#root')?.firstElementChild;`),
    'the app mounts');

  const opened = await evalJs(`
    const el = [...document.querySelectorAll('.sb-project')]
      .find(e => e.textContent.trim().startsWith(${JSON.stringify(name)}));
    if (!el) return false;
    el.click(); return true;`);
  await sleep(3000);
  if (!t(opened, 'the fixture project opens from the sidebar')) throw new Error('no project');

  t(await evalJs(`return document.querySelectorAll('.terminal-container').length > 0;`),
    'terminal panes render for running agents');

  // ── terminal text integrity ─────────────────────────────────────────
  // A wrapped line that loses a character looks identical to correct output.
  // The project name is long and appears in the agent's command line, so it is
  // a natural canary: if it survives a wrap intact, columns are honest.
  currentAction = 'terminal text';
  const wrap = await evalJs(`
    const rows = document.querySelector('.terminal-container .xterm-rows');
    if (!rows) return null;
    const joined = [...rows.children].map(r => (r.textContent || '').replace(/\\s+$/, '')).join('');
    return JSON.stringify({
      hasName: joined.includes(${JSON.stringify(name)}),
      len: joined.length,
    });`);
  const wrapInfo = wrap ? JSON.parse(wrap) : null;
  t(!!wrapInfo && wrapInfo.len > 50, 'the terminal has painted text', JSON.stringify(wrapInfo));
  t(!!wrapInfo?.hasName,
    'a long string survives a line wrap with every character intact',
    'the project name did not reconstruct — columns are wider than the pane');

  // ── every tab ───────────────────────────────────────────────────────
  const tabs = await evalJs(`
    return JSON.stringify([...document.querySelectorAll('.gr-tab')].map(b => b.textContent.trim()));`);
  const tabNames = JSON.parse(tabs || '[]');
  t(tabNames.length >= 6, `all ${tabNames.length} tabs render`, tabNames.join(', '));

  for (const tab of tabNames) {
    currentAction = `tab: ${tab}`;
    const before = consoleErrors.length;
    const clicked = await evalJs(`
      const el = [...document.querySelectorAll('.gr-tab')]
        .find(b => b.textContent.trim() === ${JSON.stringify(tab)});
      if (!el) return false; el.click(); return true;`);
    await sleep(1100);
    const painted = await evalJs(`
      const body = document.querySelector('.gr-body') || document.querySelector('.panel');
      return !!body && body.getBoundingClientRect().height > 40;`);
    t(clicked && painted && consoleErrors.length === before,
      `${tab} opens and renders`,
      consoleErrors.slice(before).join(' | ') || (painted ? '' : 'nothing painted'));
  }

  // ── every button on the console, clicked ────────────────────────────
  await evalJs(`
    const el = [...document.querySelectorAll('.gr-tab')].find(b => /terminal/i.test(b.textContent));
    if (el) el.click(); return true;`);
  await sleep(1000);

  // Skip the ones that would end the run or leave a modal in the way.
  const SKIP = /stop all|delete|remove|close|sign out|new agent|start all/i;
  const buttons = await evalJs(`
    return JSON.stringify([...document.querySelectorAll('button')]
      .map((b, i) => ({ i, label: (b.textContent || b.title || b.getAttribute('aria-label') || '').trim().slice(0, 40),
                        visible: !!(b.offsetWidth || b.offsetHeight), disabled: b.disabled }))
      .filter(b => b.visible && !b.disabled));`);
  const allButtons = JSON.parse(buttons || '[]');
  const clickable = allButtons.filter((b) => b.label && !SKIP.test(b.label));
  console.log(`\n  clicking ${clickable.length} of ${allButtons.length} visible buttons (skipping destructive ones)\n`);

  let clickedOk = 0;
  for (const b of clickable) {
    currentAction = `button: ${b.label || '(icon)'}`;
    const before = consoleErrors.length;
    await evalJs(`
      const el = [...document.querySelectorAll('button')]
        .filter(x => (x.offsetWidth || x.offsetHeight) && !x.disabled)
        .find(x => ((x.textContent || x.title || x.getAttribute('aria-label') || '').trim().slice(0,40)) === ${JSON.stringify(b.label)});
      if (el) el.click(); return !!el;`);
    await sleep(350);
    // Anything modal that opened gets dismissed so the next click is not eaten.
    await evalJs(`
      const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      document.dispatchEvent(esc);
      document.querySelector('.modal-overlay, .settings-scrim')?.click();
      return true;`);
    await sleep(250);
    const alive = await evalJs(`return !!document.querySelector('#root')?.firstElementChild;`);
    if (!alive) { t(false, `clicking "${b.label}" did not blank the app`); break; }
    if (consoleErrors.length > before) {
      t(false, `"${b.label}" clicked without error`, consoleErrors.slice(before)[0]?.slice(0, 140));
    } else {
      clickedOk++;
    }
  }
  currentAction = 'after clicks';
  t(clickedOk === clickable.length, `all ${clickable.length} buttons clicked without error`,
    `${clickable.length - clickedOk} produced errors`);
  t(await evalJs(`return !!document.querySelector('#root')?.firstElementChild;`),
    'the app survived every click');

  // ── the browser's own buttons ───────────────────────────────────────
  // The app writes `#console` into the address bar, which pushes a history
  // entry. If nothing listens for it coming back, Back changes the URL and
  // leaves the view where it was — and the *second* Back leaves the site, from
  // a page that never appeared to move.
  currentAction = 'browser history';
  const view = () => evalJs(`return JSON.stringify({
    hash: location.hash,
    console: !!document.querySelector('.gr-tabs'),
    landing: !!document.querySelector('.landing-nav'),
  });`);

  await send('Page.navigate', { url: BASE + '/' });
  await sleep(800);
  await send('Page.reload');
  await sleep(2200);
  await evalJs(`
    const b = [...document.querySelectorAll('button')]
      .find(x => /open control center/i.test(x.textContent || ''));
    if (b) b.click(); return !!b;`);
  await sleep(1600);
  const inConsole = JSON.parse((await view()) || '{}');
  t(inConsole.console === true && inConsole.hash === '#console',
    'Open Control Center reaches the console and sets the URL', JSON.stringify(inConsole));

  await evalJs(`history.back(); return true;`);
  await sleep(1400);
  const back = JSON.parse((await view()) || '{}');
  t(back.landing === true && back.console === false,
    'the browser Back button returns to the landing page',
    `hash "${back.hash}" but console=${back.console} — the view did not follow the URL`);

  await evalJs(`history.forward(); return true;`);
  await sleep(1400);
  const fwd = JSON.parse((await view()) || '{}');
  t(fwd.console === true, 'and Forward returns to the console', JSON.stringify(fwd));

} catch (err) {
  t(false, 'the browser pass completed', String(err).slice(0, 160));
} finally {
  try { cdp.close(); } catch { /* ignore */ }
  child.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ── every REST route, and the shape of what comes back ────────────────
console.log('');
const ROUTES = [
  ['GET', '/health', (j) => j?.ok === true && typeof j.daemon === 'boolean'],
  ['GET', '/projects', (j) => Array.isArray(j)],
  ['GET', `/projects/${projectId}`, (j) => j?.project?.id === projectId && Array.isArray(j.agents)],
  ['GET', `/projects/${projectId}/agents`, (j) => Array.isArray(j) && j.every((a) => a.id && a.cli && a.status)],
  ['GET', `/projects/${projectId}/agents/previews`, (j) => j && typeof j === 'object'],
  ['GET', `/projects/${projectId}/groupchat`, (j) => Array.isArray(j?.messages)],
  ['GET', `/projects/${projectId}/content`, (j) => Array.isArray(j)],
  ['GET', `/projects/${projectId}/content/notes.md`, (j) => typeof j?.content === 'string' && j.content.includes('Notes')],
  ['GET', `/projects/${projectId}/wiki`, (j) => Array.isArray(j)],
  ['GET', `/projects/${projectId}/wiki/_index.md`, (j) => typeof j?.content === 'string'],
  ['GET', `/projects/${projectId}/wiki/status`, (j) => j && typeof j === 'object'],
  ['GET', `/projects/${projectId}/plans`, (j) => Array.isArray(j)],
  ['GET', `/projects/${projectId}/layout`, (j) => j && 'layout' in j],
  ['GET', `/activity?projectId=${projectId}`, (j) => Array.isArray(j)],
  ['GET', '/usage', (j) => j && typeof j === 'object'],
  ['GET', '/daemon/status', (j) => typeof j?.connected === 'boolean'],
  ['GET', '/voice/config', (j) => j?.config?.stt && j?.config?.tts && Array.isArray(j.providers)],
  ['GET', '/gate-settings', (j) => typeof j?.autoApproveRoutine === 'boolean'],
];

let routeOk = 0;
for (const [method, route, check] of ROUTES) {
  const r = await api(method, route);
  const ok = r.status === 200 && check(r.json);
  if (ok) routeOk++;
  else t(false, `${method} ${route}`, `${r.status} ${JSON.stringify(r.json).slice(0, 90)}`);
}
t(routeOk === ROUTES.length, `all ${ROUTES.length} REST routes answer with the right shape`,
  `${ROUTES.length - routeOk} wrong`);

if (consoleErrors.length) {
  console.log('\n  console errors:');
  for (const e of consoleErrors.slice(0, 8)) console.log(`    ${e.slice(0, 160)}`);
}

await api('DELETE', `/projects/${projectId}?removeData=true`).catch(() => {});
try { fs.rmSync(cwd, { recursive: true, force: true }); } catch { /* ignore */ }

console.log(failures === 0
  ? '\nevery control and every route behaves\n'
  : `\n${failures} problem(s):\n${problems.map((p) => '  · ' + p).join('\n')}\n`);
process.exit(failures === 0 ? 0 : 1);
