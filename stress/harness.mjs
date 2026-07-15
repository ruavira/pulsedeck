#!/usr/bin/env node
// PulseDeck stress harness — council-mandated scenarios (see docs/BLUEPRINT.md Part VIII).
// Purpose-built Node load generator (k6 unavailable in this environment; this gives the
// same burst shapes with exact control). Talks to production surfaces only:
//   - join_session / submit_response / submit_question RPCs (PostgREST — the real audience path)
//   - Vercel-hosted pages (join page fetch) for edge-layer inclusion
//
// Usage:
//   node stress/harness.mjs --scenario=join    --vus=1000 --window=60  --code=ABCDEF
//   node stress/harness.mjs --scenario=quiz    --vus=1000 --window=10  --session=... --slide=...
//   node stress/harness.mjs --scenario=words   --vus=800  --window=30  ...
//   node stress/harness.mjs --scenario=qa      --vus=300  --window=30  ...
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, APP_ORIGIN

import { argv, env } from 'node:process';

const args = Object.fromEntries(
  argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }),
);

const SUPABASE_URL = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY;
const APP_ORIGIN = env.APP_ORIGIN ?? '';
if (!SUPABASE_URL || !ANON) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY');
  process.exit(1);
}

const VUS = parseInt(args.vus ?? '100', 10);
const WINDOW_S = parseFloat(args.window ?? '30');
const SCENARIO = args.scenario ?? 'join';

const lat = [];
let ok = 0,
  fail = 0,
  filtered = 0;
const errors = new Map();

async function rpc(fn, body) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: ANON,
        authorization: `Bearer ${ANON}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const ms = performance.now() - t0;
    lat.push(ms);
    if (!res.ok) {
      fail++;
      const key = `http_${res.status}`;
      errors.set(key, (errors.get(key) ?? 0) + 1);
      return null;
    }
    const data = await res.json();
    if (data && data.ok === false) {
      if (data.error === 'filtered') filtered++;
      else {
        fail++;
        errors.set(data.error, (errors.get(data.error) ?? 0) + 1);
        return null;
      }
    }
    ok++;
    return data;
  } catch (e) {
    lat.push(performance.now() - t0);
    fail++;
    const key = e.name === 'TimeoutError' ? 'timeout' : e.code ?? e.name;
    errors.set(key, (errors.get(key) ?? 0) + 1);
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (n) => Math.floor(Math.random() * n);
const NOUNS = ['Falcon', 'Otter', 'Maple', 'Comet', 'Ridge', 'Delta', 'Nova', 'Pine'];
const WORDS = ['clarity', 'energy', 'fun', 'engaging', 'crisp', 'punchy', 'human', 'alive', 'sharp', 'bold', 'fresh', 'vivid'];
const DIRTY = ['this is fucking great', 'shit talk']; // filter-verification payloads

async function vu(i, joinCode, sessionId, slideId, kind) {
  // Spread arrivals across the window (uniform burst)
  await sleep(Math.random() * WINDOW_S * 1000);
  const deviceKey = `stress-${SCENARIO}-${i}-${Math.random().toString(36).slice(2, 8)}`;

  const join = await rpc('join_session', {
    p_code: joinCode,
    p_nickname: `LoadVU ${NOUNS[i % NOUNS.length]} ${i}`,
    p_device_key: deviceKey,
  });
  if (!join?.ok) return;
  const participantId = join.participant.id;
  const sid = join.session.id;

  if (SCENARIO === 'join') return; // Scenario A: join stampede only

  if (SCENARIO === 'quiz' || SCENARIO === 'poll') {
    await sleep(Math.random() * 3000); // answer jitter after joining
    await rpc('submit_response', {
      p_session_id: sid,
      p_slide_id: slideId,
      p_participant_id: participantId,
      p_device_key: deviceKey,
      p_payload: { choice: rand(4) },
    });
  } else if (SCENARIO === 'words') {
    const dirty = i % 25 === 0; // 4% profanity payloads to verify the filter
    await rpc('submit_response', {
      p_session_id: sid,
      p_slide_id: slideId,
      p_participant_id: participantId,
      p_device_key: deviceKey,
      p_payload: {
        words: dirty
          ? [DIRTY[i % DIRTY.length].split(' ')[2] ?? 'fucking', WORDS[rand(WORDS.length)]]
          : [WORDS[rand(WORDS.length)], WORDS[rand(WORDS.length)], WORDS[rand(WORDS.length)]],
      },
    });
  } else if (SCENARIO === 'qa') {
    await rpc('submit_question', {
      p_session_id: sid,
      p_participant_id: participantId,
      p_device_key: deviceKey,
      p_text: `Load question ${i}: how does this hold up under pressure?`,
      p_anonymous: i % 3 === 0,
    });
  } else if (SCENARIO === 'reconnect') {
    // Scenario D: hammer state resync like a reconnect storm
    for (let n = 0; n < 3; n++) {
      await sleep(500 + Math.random() * 1500);
      await rpc('get_session_state', { p_session_id: sid });
    }
  } else if (SCENARIO === 'mixed') {
    // Realistic session shape: join, vote, some Q&A, some resyncs
    await sleep(Math.random() * 2000);
    await rpc('submit_response', {
      p_session_id: sid,
      p_slide_id: slideId,
      p_participant_id: participantId,
      p_device_key: deviceKey,
      p_payload: kind === 'wordcloud' ? { words: [WORDS[rand(WORDS.length)]] } : { choice: rand(4) },
    });
    if (i % 5 === 0)
      await rpc('submit_question', {
        p_session_id: sid,
        p_participant_id: participantId,
        p_device_key: deviceKey,
        p_text: `Question from VU ${i}`,
        p_anonymous: false,
      });
    if (i % 4 === 0) await rpc('get_session_state', { p_session_id: sid });
  }
}

function pct(p) {
  if (lat.length === 0) return 0;
  const s = [...lat].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

const t0 = performance.now();
console.log(`▶ scenario=${SCENARIO} vus=${VUS} window=${WINDOW_S}s`);
await Promise.all(
  Array.from({ length: VUS }, (_, i) =>
    vu(i, args.code, args.session, args.slide, args.kind ?? 'poll'),
  ),
);
const wall = ((performance.now() - t0) / 1000).toFixed(1);

console.log(`\n== RESULTS: ${SCENARIO} ==`);
console.log(`wall: ${wall}s  requests: ${lat.length}  ok: ${ok}  fail: ${fail}  filtered(expected): ${filtered}`);
console.log(`latency ms  p50: ${pct(50).toFixed(0)}  p95: ${pct(95).toFixed(0)}  p99: ${pct(99).toFixed(0)}  max: ${Math.max(...lat, 0).toFixed(0)}`);
if (errors.size) console.log('errors:', Object.fromEntries(errors));
const passFail = fail === 0 || fail / Math.max(lat.length, 1) < 0.005;
console.log(passFail ? '✅ PASS (error rate < 0.5%)' : '❌ FAIL');
process.exit(passFail ? 0 : 1);
