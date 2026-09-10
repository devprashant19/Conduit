#!/usr/bin/env node
/**
 * Does Amazon Nova 2 Sonic actually work here, with our tools?
 *
 * This is a gate, not a demo. The whole realtime-Keeper plan rests on Nova
 * handling several tools without misbehaving, and there are two open AWS
 * re:Post reports against `amazon.nova-2-sonic-v1:0` that say it might not:
 *
 *   1. `promptStart` rejected when `toolConfiguration` is included
 *   2. an infinite tool-calling loop when multiple tools are declared
 *
 * Conduit has 12 tools. This declares the 6 we intend to expose to voice and
 * finds out, before a single line of UI is written, which is the cheapest
 * possible place to learn it.
 *
 * Two parts:
 *   A. Tools  — a text turn that cannot be answered without calling a tool.
 *               Watches for the loop, and for repeated identical calls.
 *   B. Audio  — a spoken turn, measuring time to the first audio byte back.
 *               This is the number the whole plan exists to move (today: 7-9s).
 *
 * Tools run against the live Conduit API when it is up, and against clearly
 * labelled fixtures when it is not — the loop bug is about the model repeating
 * itself, which does not depend on the data being real.
 *
 * Usage:
 *   node scripts/check-nova.mjs            # both parts
 *   node scripts/check-nova.mjs --tools    # part A only (no audio needed)
 *
 * Env: AWS credentials via the usual chain, AWS_REGION (default us-east-1),
 *      NOVA_MODEL_ID to override the model.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';
import { BedrockRuntimeClient, InvokeModelWithBidirectionalStreamCommand }
  from '@aws-sdk/client-bedrock-runtime';
import { NodeHttp2Handler } from '@smithy/node-http-handler';

// Same two files, same precedence, as src/env.ts — a probe that cannot see the
// credentials the app uses is testing a different machine.
for (const file of [path.resolve(process.cwd(), '.env'), path.join(os.homedir(), '.conduit', '.env')]) {
  if (fs.existsSync(file)) dotenv.config({ path: file });
}

const MODEL_ID = process.env.NOVA_MODEL_ID || 'amazon.nova-2-sonic-v1:0';
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const BASE = process.env.CONDUIT_URL || 'http://localhost:3200';
const TOOLS_ONLY = process.argv.includes('--tools');

const INPUT_RATE = 16000;   // what Nova wants from us
const OUTPUT_RATE = 24000;  // what it sends back

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function t(ok, label, detail) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
  return ok;
}

// ── the six tools we intend to give the voice model ───────────────────
// Names and descriptions are lifted from src/conduit-mcp-server.ts: those
// description strings do prompt-engineering work, not just documentation.
const TOOLS = [
  {
    name: 'list_projects',
    description: 'List every project and the agents in it, with each agent\'s live status.',
    schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_agents',
    description: 'List the agents in one project with their live status.',
    schema: {
      type: 'object',
      properties: { project: { type: 'string', description: 'Project name or id.' } },
      required: ['project'],
    },
  },
  {
    name: 'get_agent_status',
    description: 'Get the live status of one agent.',
    schema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name or id.' },
        agent: { type: 'string', description: 'Agent name or id.' },
      },
      required: ['project', 'agent'],
    },
  },
  {
    name: 'start_agent',
    description: 'Start a stopped agent. Returns as soon as the process is up.',
    schema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name or id.' },
        agent: { type: 'string', description: 'Agent name or id.' },
      },
      required: ['project', 'agent'],
    },
  },
  {
    name: 'stop_agent',
    description: 'Stop a running agent.',
    schema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name or id.' },
        agent: { type: 'string', description: 'Agent name or id.' },
      },
      required: ['project', 'agent'],
    },
  },
  {
    name: 'broadcast',
    description: 'Send one message to every running agent at once. Use this instead of asking each agent in turn.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'What to say to them.' },
        project: { type: 'string', description: 'Optional: limit to one project.' },
      },
      required: ['message'],
    },
  },
];

const SYSTEM_PROMPT = [
  'You are The Keeper, the orchestrator of a multi-agent coding control centre.',
  'You are being heard, not read. Talk like a colleague standing next to the user:',
  'short, direct, no preamble. Most answers are one sentence.',
  'Use the tools to answer questions about projects and agents — never guess.',
  'Call each tool at most once for a given question. When you have the answer, say it and stop.',
].join(' ');

// ── talking to Conduit for real, when it is up ────────────────────────
let liveApi = false;
async function api(method, p, body) {
  const res = await fetch(BASE + '/api' + p, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

const FIXTURE = {
  projects: [{ name: 'demo', agents: [{ name: 'Alpha', cli: 'claude', status: 'stopped' }] }],
};

async function runTool(name, input) {
  if (!liveApi) {
    // Clearly labelled, so nobody mistakes a fixture run for a real one.
    if (name === 'list_projects') {
      return `[fixture] ## demo\n- Alpha (claude, stopped)`;
    }
    return `[fixture] ${name} ok`;
  }
  try {
    if (name === 'list_projects') {
      const projects = (await api('GET', '/projects')).json || [];
      const lines = [];
      for (const p of projects) {
        const agents = (await api('GET', `/projects/${p.id}/agents`)).json || [];
        lines.push(`## ${p.name}`);
        for (const a of agents) lines.push(`- ${a.name} (${a.cli}, ${a.status})`);
        if (!agents.length) lines.push('- (no agents)');
      }
      return lines.join('\n') || 'No projects.';
    }
    if (name === 'list_agents' || name === 'get_agent_status') {
      const projects = (await api('GET', '/projects')).json || [];
      const proj = projects.find((p) => p.name === input.project || p.id === input.project)
        || projects.find((p) => p.name?.toLowerCase().includes(String(input.project || '').toLowerCase()));
      if (!proj) return `No project matching "${input.project}".`;
      const agents = (await api('GET', `/projects/${proj.id}/agents`)).json || [];
      if (name === 'list_agents') {
        return agents.map((a) => `- ${a.name} (${a.cli}, ${a.status})`).join('\n') || 'No agents.';
      }
      const a = agents.find((x) => x.name === input.agent || x.id === input.agent);
      return a ? `${a.name} is ${a.status}.` : `No agent matching "${input.agent}".`;
    }
    // Deliberately NOT executing start/stop/broadcast against the user's real
    // agents from a probe. The model only needs a plausible result to decide
    // whether to call again — which is the behaviour under test.
    return `[not executed by the probe] ${name} would have run with ${JSON.stringify(input)}`;
  } catch (err) {
    return `Tool failed: ${String(err).slice(0, 120)}`;
  }
}

// ── a queue-backed async generator: we push events as we learn things ──
function eventStream() {
  const queue = [];
  let resolveNext = null;
  let closed = false;
  const encoder = new TextEncoder();

  return {
    push(event) {
      const bytes = encoder.encode(JSON.stringify(event));
      if (resolveNext) { const r = resolveNext; resolveNext = null; r({ value: { chunk: { bytes } }, done: false }); }
      else queue.push({ chunk: { bytes } });
    },
    close() {
      closed = true;
      if (resolveNext) { const r = resolveNext; resolveNext = null; r({ value: undefined, done: true }); }
    },
    [Symbol.asyncIterator]() {
      return {
        next() {
          if (queue.length) return Promise.resolve({ value: queue.shift(), done: false });
          if (closed) return Promise.resolve({ value: undefined, done: true });
          return new Promise((resolve) => { resolveNext = resolve; });
        },
      };
    },
  };
}

/** Generate a spoken WAV with Windows SAPI, then strip to raw PCM16 @16k. */
function speakToPcm(text) {
  if (process.platform !== 'win32') return null;
  const wav = path.join(os.tmpdir(), `nova-probe-${Date.now()}.wav`);
  const ps = `
    Add-Type -AssemblyName System.Speech
    $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
    $s.SetOutputToWaveFile('${wav}', $fmt)
    $s.Speak(${JSON.stringify(text)})
    $s.Dispose()
  `;
  try {
    execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore' });
    const buf = fs.readFileSync(wav);
    fs.unlinkSync(wav);
    // Skip the RIFF header by finding the 'data' chunk.
    const idx = buf.indexOf(Buffer.from('data', 'ascii'));
    return idx >= 0 ? buf.subarray(idx + 8) : buf.subarray(44);
  } catch {
    try { fs.unlinkSync(wav); } catch { /* ignore */ }
    return null;
  }
}

// ── one Nova session ──────────────────────────────────────────────────
async function runSession({ label, withTools, say, audio }) {
  console.log(`\n${label}`);

  const client = new BedrockRuntimeClient({
    region: REGION,
    requestHandler: new NodeHttp2Handler({
      requestTimeout: 300000, sessionTimeout: 300000,
      disableConcurrentStreams: false, maxConcurrentStreams: 20,
    }),
  });

  const promptName = randomUUID();
  const stream = eventStream();

  const result = {
    accepted: false, toolCalls: [], firstAudioMs: null, firstTextMs: null,
    assistantText: '', userTranscript: '', error: null, audioBytes: 0,
    events: new Set(), turnComplete: false,
  };

  stream.push({ event: { sessionStart: {
    inferenceConfiguration: { maxTokens: 1024, topP: 0.9, temperature: 0.7 },
    // Nova 2 addition. HIGH is what makes it cut in quickly rather than
    // waiting politely — the whole point of "respond immediately".
    turnDetectionConfiguration: { endpointingSensitivity: 'HIGH' },
  } } });

  const promptStart = {
    promptName,
    textOutputConfiguration: { mediaType: 'text/plain' },
    audioOutputConfiguration: {
      mediaType: 'audio/lpcm', sampleRateHertz: OUTPUT_RATE, sampleSizeBits: 16,
      channelCount: 1, voiceId: 'matthew', encoding: 'base64', audioType: 'SPEECH',
    },
  };
  if (withTools) {
    // The exact thing re:Post says gets rejected.
    promptStart.toolConfiguration = {
      tools: TOOLS.map((tool) => ({
        toolSpec: {
          name: tool.name,
          description: tool.description,
          inputSchema: { json: JSON.stringify(tool.schema) },
        },
      })),
    };
  }
  stream.push({ event: { promptStart } });

  // System prompt.
  const sysContent = randomUUID();
  stream.push({ event: { contentStart: {
    promptName, contentName: sysContent, type: 'TEXT', interactive: true,
    role: 'SYSTEM', textInputConfiguration: { mediaType: 'text/plain' },
  } } });
  stream.push({ event: { textInput: { promptName, contentName: sysContent, content: SYSTEM_PROMPT } } });
  stream.push({ event: { contentEnd: { promptName, contentName: sysContent } } });

  const started = Date.now();
  const command = new InvokeModelWithBidirectionalStreamCommand({ modelId: MODEL_ID, body: stream });

  let response;
  try {
    response = await client.send(command);
  } catch (err) {
    result.error = String(err?.message || err);
    return result;
  }

  // Feed the turn in once the stream is open.
  (async () => {
    await sleep(150);
    if (say) {
      const c = randomUUID();
      stream.push({ event: { contentStart: {
        promptName, contentName: c, type: 'TEXT', interactive: true,
        role: 'USER', textInputConfiguration: { mediaType: 'text/plain' },
      } } });
      stream.push({ event: { textInput: { promptName, contentName: c, content: say } } });
      stream.push({ event: { contentEnd: { promptName, contentName: c } } });
    }
    if (audio) {
      const c = randomUUID();
      stream.push({ event: { contentStart: {
        promptName, contentName: c, type: 'AUDIO', interactive: true, role: 'USER',
        audioInputConfiguration: {
          mediaType: 'audio/lpcm', sampleRateHertz: INPUT_RATE, sampleSizeBits: 16,
          channelCount: 1, audioType: 'SPEECH', encoding: 'base64',
        },
      } } });
      // 1024-sample frames, the cadence a microphone would produce.
      const FRAME = 2048;
      for (let i = 0; i < audio.length; i += FRAME) {
        stream.push({ event: { audioInput: {
          promptName, contentName: c,
          content: audio.subarray(i, Math.min(i + FRAME, audio.length)).toString('base64'),
        } } });
        await sleep(10);
      }
      stream.push({ event: { contentEnd: { promptName, contentName: c } } });
    }
  })();

  let role = '';
  const deadline = Date.now() + 60_000;
  try {
    for await (const chunk of response.body) {
      if (Date.now() > deadline) break;
      if (chunk.validationException) {
        result.error = `ValidationException: ${chunk.validationException.message}`;
        break;
      }
      if (chunk.modelStreamErrorException) {
        result.error = `ModelStreamError: ${chunk.modelStreamErrorException.message}`;
        break;
      }
      if (chunk.internalServerException) {
        result.error = `InternalServerError: ${chunk.internalServerException.message}`;
        break;
      }
      if (!chunk.chunk?.bytes) continue;

      let json;
      try { json = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes)); } catch { continue; }
      const ev = json.event;
      if (!ev) continue;
      result.accepted = true;
      for (const k of Object.keys(ev)) result.events.add(k);

      if (ev.contentStart) role = ev.contentStart.role || role;

      // The assistant finished a spoken turn: audio came, then the content
      // closed. Nothing more is coming unless we speak again, and waiting for
      // the 55s idle timeout would report a failure that did not happen.
      if (ev.contentEnd && role === 'ASSISTANT' && result.audioBytes > 0
          && ev.contentEnd.type !== 'TOOL') {
        result.turnComplete = true;
        break;
      }

      if (ev.textOutput) {
        if (result.firstTextMs === null) result.firstTextMs = Date.now() - started;
        const text = String(ev.textOutput.content || '');
        if (role === 'ASSISTANT') result.assistantText += text;
        else if (role === 'USER') result.userTranscript += text;
      }

      if (ev.audioOutput) {
        if (result.firstAudioMs === null) result.firstAudioMs = Date.now() - started;
        result.audioBytes += Buffer.from(ev.audioOutput.content || '', 'base64').length;
      }

      if (ev.toolUse) {
        result.toolCalls.push({
          name: ev.toolUse.toolName,
          input: ev.toolUse.content ?? ev.toolUse.input ?? '',
          id: ev.toolUse.toolUseId,
          at: Date.now() - started,
        });
      }

      if (ev.contentEnd && ev.contentEnd.type === 'TOOL') {
        const call = result.toolCalls[result.toolCalls.length - 1];
        if (call) {
          let parsed = {};
          try { parsed = typeof call.input === 'string' ? JSON.parse(call.input) : (call.input || {}); }
          catch { /* the model sent something unparseable — pass an empty object */ }
          const out = await runTool(call.name, parsed);
          const c = randomUUID();
          stream.push({ event: { contentStart: {
            promptName, contentName: c, interactive: false, type: 'TOOL',
            role: 'TOOL', toolResultInputConfiguration: {
              toolUseId: call.id, type: 'TEXT',
              textInputConfiguration: { mediaType: 'text/plain' },
            },
          } } });
          // Nova parses this, it does not just read it: a bare string comes
          // back as "Tool Response parsing error". It has to be JSON.
          stream.push({ event: { toolResult: {
            promptName, contentName: c, content: JSON.stringify({ result: out }),
          } } });
          stream.push({ event: { contentEnd: { promptName, contentName: c } } });
        }
      }

      // Runaway guard — the reported bug, caught rather than waited out.
      if (result.toolCalls.length > 12) {
        result.error = 'tool-call loop: more than 12 calls in one turn';
        break;
      }
      if (ev.completionEnd) break;
    }
  } catch (err) {
    result.error = result.error || String(err?.message || err);
  }

  try {
    stream.push({ event: { promptEnd: { promptName } } });
    stream.push({ event: { sessionEnd: {} } });
    stream.close();
  } catch { /* already gone */ }
  try { client.destroy(); } catch { /* ignore */ }
  return result;
}

// ── run ───────────────────────────────────────────────────────────────
const health = await fetch(BASE + '/api/health').then((r) => r.json()).catch(() => null);
liveApi = !!health?.ok;

console.log(`\nNova 2 Sonic — ${MODEL_ID} in ${REGION}`);
console.log(`tools run against: ${liveApi ? BASE + ' (live)' : 'fixtures (Conduit not running)'}`);

// A. Does it accept toolConfiguration, and does it loop?
//
// Asked out loud, because Nova Sonic is audio-first: a TEXT/USER turn is not a
// turn trigger at all. Sending one and waiting produced exactly one event —
// `usageEvent` — and then "Timed out waiting for audio bytes or interactive
// content". Text content is for the system prompt; the user speaks.
const questionPcm = speakToPcm('What projects do I have, and what agents are in them? Answer in one sentence.');
if (!questionPcm || questionPcm.length < 8000) {
  console.log('\nCannot synthesise a test clip on this machine — the probe needs one.');
  process.exit(2);
}
const a = await runSession({
  label: `A. toolConfiguration and tool behaviour (asked aloud, ${(questionPcm.length / 2 / INPUT_RATE).toFixed(1)}s)`,
  withTools: true,
  audio: questionPcm,
});

if (a.error && /ValidationException/.test(a.error)) {
  t(false, 'promptStart accepted with toolConfiguration', a.error.slice(0, 220));
} else {
  t(a.accepted, 'promptStart accepted with toolConfiguration', a.error || 'no events came back');
}
t(!/tool-call loop/.test(a.error || ''), 'no tool-call loop', a.error);

const names = a.toolCalls.map((c) => c.name);
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
t(a.toolCalls.length > 0, 'it actually called a tool',
  'answered without one — it may be guessing');
t(dupes.length === 0, 'no tool called twice for one question', dupes.join(', '));
t(!!a.assistantText.trim(), 'it produced an answer', a.error || '(silence)');

console.log(`\n  tools called: ${names.length ? names.map((n, i) => `${n}@${a.toolCalls[i].at}ms`).join(' → ') : '(none)'}`);
console.log(`  event types seen: ${[...a.events].join(', ') || '(none)'}`);
if (a.assistantText.trim()) console.log(`  said: "${a.assistantText.trim().slice(0, 200)}"`);
if (a.error && !/tool-call loop/.test(a.error)) console.log(`  error: ${a.error.slice(0, 300)}`);
if (a.firstTextMs !== null) console.log(`  first text: ${a.firstTextMs}ms`);
if (a.userTranscript.trim()) console.log(`  heard: "${a.userTranscript.trim().slice(0, 140)}"`);
if (a.firstAudioMs !== null) {
  const clipMs = (questionPcm.length / 2 / INPUT_RATE) * 1000;
  const afterSpeech = Math.max(0, Math.round(a.firstAudioMs - clipMs));
  console.log(`  first audio: ${a.firstAudioMs}ms from open, ~${afterSpeech}ms after the clip ended`);
  t(afterSpeech < 2000, 'it replies within 2s of the user finishing', `${afterSpeech}ms`);
}

// B. How fast does it answer out loud?
if (!TOOLS_ONLY && failures === 0) {
  const pcm = speakToPcm('Hello, are you there? Answer in one short sentence.');
  if (!pcm || pcm.length < 8000) {
    console.log('\nB. spoken latency — skipped (could not synthesise a test clip)');
  } else {
    const b = await runSession({
      label: `B. spoken latency (${(pcm.length / 2 / INPUT_RATE).toFixed(1)}s of speech)`,
      withTools: true,
      audio: pcm,
    });
    t(b.firstAudioMs !== null, 'it answered out loud', b.error || 'no audio came back');
    if (b.firstAudioMs !== null) {
      // Measured from stream open; the clip itself takes ~2-3s to feed in.
      const afterSpeech = b.firstAudioMs - (pcm.length / 2 / INPUT_RATE) * 1000;
      console.log(`  first audio: ${b.firstAudioMs}ms from open, ~${Math.max(0, Math.round(afterSpeech))}ms after the clip ended`);
      console.log(`  audio returned: ${(b.audioBytes / 2 / OUTPUT_RATE).toFixed(1)}s`);
      if (b.userTranscript.trim()) console.log(`  heard: "${b.userTranscript.trim().slice(0, 120)}"`);
      if (b.assistantText.trim()) console.log(`  said: "${b.assistantText.trim().slice(0, 160)}"`);
      t(afterSpeech < 2000, 'it replies in under 2s of the user finishing',
        `${Math.round(afterSpeech)}ms`);
    }
  }
}

console.log(failures === 0
  ? '\nNova is viable here — the plan can proceed.\n'
  : `\n${failures} problem(s) — do NOT build on this yet; reopen the provider choice.\n`);
process.exit(failures === 0 ? 0 : 1);
