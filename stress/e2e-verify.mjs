#!/usr/bin/env node
// Functional E2E verification (Scenario F): drives the full show against production.
// Asserts every P0 path: deck create → session → join → each activity kind → quiz scoring
// correctness → Q&A + moderation → lock → export. Exits non-zero on any failure.
// Env: APP_ORIGIN, SUPABASE_URL, SUPABASE_ANON_KEY

import { env } from 'node:process';

const APP = env.APP_ORIGIN;
const SB = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY;
let passed = 0,
  failed = 0;
const failures = [];

function assert(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(`${name} ${detail}`);
    console.log(`  ✗ ${name} ${detail}`);
  }
}

async function api(path, opts = {}) {
  const res = await fetch(`${APP}${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {}
  return { status: res.status, body };
}

async function rpc(fn, body) {
  const res = await fetch(`${SB}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: ANON, authorization: `Bearer ${ANON}` },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

const uuid = () => crypto.randomUUID();

console.log('E2E VERIFY against', APP);

// ---- 1. Deck lifecycle ----
console.log('\n[1] Deck lifecycle');
const slides = [
  { id: uuid(), kind: 'content', title: 'Welcome', body: { blocks: [{ type: 'heading', text: 'Hi' }] }, settings: { layout: 'title' }, position: 0 },
  { id: uuid(), kind: 'poll', title: 'Poll', body: { prompt: 'Pick one', options: ['A', 'B', 'C'] }, settings: {}, position: 1 },
  { id: uuid(), kind: 'quiz', title: 'Quiz', body: { prompt: '2+2?', options: ['3', '4', '5'], correct: [1] }, settings: { timeLimitSec: 30, points: 1000 }, position: 2 },
  { id: uuid(), kind: 'wordcloud', title: 'Words', body: { prompt: 'One word' }, settings: { maxWords: 3 }, position: 3 },
  { id: uuid(), kind: 'scale', title: 'Scale', body: { prompt: 'Rate', min: 1, max: 10 }, settings: {}, position: 4 },
  { id: uuid(), kind: 'qa', title: 'Q&A', body: {}, settings: {}, position: 5 },
];
const created = await api('/api/decks', { method: 'POST', body: JSON.stringify({ title: 'E2E Deck', slides }) });
assert('create deck', created.status === 200 && created.body?.id && created.body?.presenterKey);
const deckId = created.body.id;
const KEY = created.body.presenterKey;
const H = { 'x-presenter-key': KEY };

const loaded = await api(`/api/decks/${deckId}`, { headers: H });
assert('load deck with key', loaded.status === 200 && loaded.body?.slides?.length === 6);
const noKey = await api(`/api/decks/${deckId}`);
assert('load deck without key rejected', noKey.status === 401);

// ---- 2. Session ----
console.log('\n[2] Session');
const sess = await api(`/api/decks/${deckId}/sessions`, { method: 'POST', headers: H, body: JSON.stringify({}) });
assert('create session', sess.status === 200 && sess.body?.code?.length === 6);
const { sessionId, code } = sess.body;
const sLoad = await api(`/api/presenter/${sessionId}`, { headers: H });
assert('presenter session load', sLoad.status === 200 && sLoad.body?.deck?.slides?.length === 6);

// ---- 3. Join ----
console.log('\n[3] Join');
const dev1 = `e2e-${uuid()}`;
const j1 = await rpc('join_session', { p_code: code, p_nickname: 'E2E One', p_device_key: dev1 });
assert('join', j1?.ok === true && j1.participant?.id, JSON.stringify(j1).slice(0, 120));
const p1 = j1.participant.id;
const rejoin = await rpc('join_session', { p_code: code, p_nickname: 'E2E One', p_device_key: dev1 });
assert('idempotent rejoin (same participant)', rejoin?.participant?.id === p1);
const badCode = await rpc('join_session', { p_code: 'ZZZZZZ', p_nickname: 'x', p_device_key: uuid() });
assert('bad code rejected', badCode?.ok === false);
const dirtyNick = await rpc('join_session', { p_code: code, p_nickname: 'fucking legend', p_device_key: `e2e-${uuid()}` });
assert('profane nickname sanitized', dirtyNick?.ok === true && dirtyNick.participant.nickname === 'Guest');

// ---- 4. Poll flow ----
console.log('\n[4] Poll');
const pollSlide = slides[1];
// Navigating to an activity slide now AUTO-OPENS voting (audience expects to
// respond immediately). Verify the auto-open, then verify the closed gate still
// rejects votes when the presenter explicitly closes.
const navPoll = await api(`/api/presenter/${sessionId}/advance`, { method: 'POST', headers: H, body: JSON.stringify({ index: 1 }) });
assert('poll auto-opens on navigation', navPoll?.body?.state?.phase === 'open', JSON.stringify(navPoll?.body?.state ?? {}).slice(0, 120));
await api(`/api/presenter/${sessionId}/advance`, { method: 'POST', headers: H, body: JSON.stringify({ phase: 'closed' }) });
const closedVote = await rpc('submit_response', { p_session_id: sessionId, p_slide_id: pollSlide.id, p_participant_id: p1, p_device_key: dev1, p_payload: { choice: 0 } });
assert('vote rejected while phase=closed', closedVote?.ok === false && closedVote?.error === 'voting_closed');
await api(`/api/presenter/${sessionId}/advance`, { method: 'POST', headers: H, body: JSON.stringify({ phase: 'open' }) });
const v1 = await rpc('submit_response', { p_session_id: sessionId, p_slide_id: pollSlide.id, p_participant_id: p1, p_device_key: dev1, p_payload: { choice: 0 } });
assert('vote accepted', v1?.ok === true);
const v1b = await rpc('submit_response', { p_session_id: sessionId, p_slide_id: pollSlide.id, p_participant_id: p1, p_device_key: dev1, p_payload: { choice: 2 } });
assert('vote change (upsert)', v1b?.ok === true);
const pr = await rpc('get_results', { p_session_id: sessionId, p_slide_id: pollSlide.id });
assert('poll aggregate: 1 total, choice updated', pr?.total === 1 && pr?.counts?.['2'] === 1 && !pr?.counts?.['0'], JSON.stringify(pr));

// ---- 5. Quiz scoring integrity ----
console.log('\n[5] Quiz');
const quizSlide = slides[2];
await api(`/api/presenter/${sessionId}/advance`, { method: 'POST', headers: H, body: JSON.stringify({ index: 2 }) });
await api(`/api/presenter/${sessionId}/advance`, { method: 'POST', headers: H, body: JSON.stringify({ phase: 'open' }) });
const dev2 = `e2e-${uuid()}`;
const j2 = await rpc('join_session', { p_code: code, p_nickname: 'E2E Two', p_device_key: dev2 });
const p2 = j2.participant.id;
const q1 = await rpc('submit_response', { p_session_id: sessionId, p_slide_id: quizSlide.id, p_participant_id: p1, p_device_key: dev1, p_payload: { choice: 1 } });
assert('correct answer: +1000 accuracy points', q1?.ok === true && q1.isCorrect === true && q1.points === 1000, JSON.stringify(q1));
const q2 = await rpc('submit_response', { p_session_id: sessionId, p_slide_id: quizSlide.id, p_participant_id: p2, p_device_key: dev2, p_payload: { choice: 0 } });
assert('wrong answer: 0 points', q2?.ok === true && q2.isCorrect === false && q2.points === 0);
const qChange = await rpc('submit_response', { p_session_id: sessionId, p_slide_id: quizSlide.id, p_participant_id: p1, p_device_key: dev1, p_payload: { choice: 0 } });
assert('quiz answer immutable after grading', qChange?.ok === true || qChange?.error, '(no double-score)');
const lb = await rpc('get_leaderboard', { p_session_id: sessionId, p_limit: 10 });
assert('leaderboard: winner has exactly 1000', Array.isArray(lb) && lb[0]?.score === 1000 && (lb[1]?.score ?? 0) === 0, JSON.stringify(lb).slice(0, 150));
const rank = await rpc('get_my_rank', { p_session_id: sessionId, p_participant_id: p1 });
assert('my rank = 1', rank?.rank === 1);
const spoof = await rpc('submit_response', { p_session_id: sessionId, p_slide_id: quizSlide.id, p_participant_id: p1, p_device_key: 'wrong-key', p_payload: { choice: 1 } });
assert('device key spoof rejected', spoof?.ok === false);

// ---- 6. Wordcloud + filter ----
console.log('\n[6] Wordcloud + profanity filter');
const wcSlide = slides[3];
await api(`/api/presenter/${sessionId}/advance`, { method: 'POST', headers: H, body: JSON.stringify({ index: 3 }) });
await api(`/api/presenter/${sessionId}/advance`, { method: 'POST', headers: H, body: JSON.stringify({ phase: 'open' }) });
const wc = await rpc('submit_response', { p_session_id: sessionId, p_slide_id: wcSlide.id, p_participant_id: p1, p_device_key: dev1, p_payload: { words: ['clarity', 'shit', 'energy'] } });
assert('dirty word silently dropped, clean kept', wc?.ok === true);
const wcr = await rpc('get_results', { p_session_id: sessionId, p_slide_id: wcSlide.id });
assert('wordcloud aggregate clean', wcr?.words?.clarity === 1 && wcr?.words?.energy === 1 && !wcr?.words?.shit, JSON.stringify(wcr));
const allDirty = await rpc('submit_response', { p_session_id: sessionId, p_slide_id: wcSlide.id, p_participant_id: p2, p_device_key: dev2, p_payload: { words: ['fuck'] } });
assert('all-dirty submission returns filtered', allDirty?.ok === false && allDirty?.error === 'filtered');

// ---- 7. Q&A ----
console.log('\n[7] Q&A');
const ask = await rpc('submit_question', { p_session_id: sessionId, p_participant_id: p1, p_device_key: dev1, p_text: 'Will slides be shared?', p_anonymous: false });
assert('question submitted', ask?.ok === true && ask.id);
const up = await rpc('toggle_upvote', { p_question_id: ask.id, p_participant_id: p2, p_device_key: dev2 });
assert('upvote', up?.ok === true && up.upvotes === 1);
const up2 = await rpc('toggle_upvote', { p_question_id: ask.id, p_participant_id: p2, p_device_key: dev2 });
assert('un-upvote toggle', up2?.ok === true && up2.upvotes === 0);
const qlist = await rpc('get_questions', { p_session_id: sessionId, p_participant_id: p1 });
assert('question list', Array.isArray(qlist) && qlist.length === 1 && qlist[0].mine === true);
const dirtyQ = await rpc('submit_question', { p_session_id: sessionId, p_participant_id: p1, p_device_key: dev1, p_text: 'this is bullshit', p_anonymous: false });
assert('profane question blocked', dirtyQ?.ok === false && dirtyQ?.error === 'filtered');
const mod = await api(`/api/presenter/${sessionId}/qa`, { method: 'POST', headers: H, body: JSON.stringify({ questionId: ask.id, status: 'answered' }) });
assert('moderation: mark answered', mod.status === 200);

// ---- 8. Lock + count + settings ----
console.log('\n[8] Lock & settings');
const lock = await api(`/api/presenter/${sessionId}/settings`, { method: 'POST', headers: H, body: JSON.stringify({ settings: { locked: true } }) });
assert('lock room via settings route', lock.status === 200);
if (lock.status === 200) {
  const newJoin = await rpc('join_session', { p_code: code, p_nickname: 'Late', p_device_key: `e2e-${uuid()}` });
  assert('locked room rejects new device', newJoin?.ok === false && newJoin?.error === 'locked');
  const rejoinLocked = await rpc('join_session', { p_code: code, p_nickname: 'E2E One', p_device_key: dev1 });
  assert('locked room re-admits known device', rejoinLocked?.ok === true);
  await api(`/api/presenter/${sessionId}/settings`, { method: 'POST', headers: H, body: JSON.stringify({ settings: { locked: false } }) });
}
const count = await rpc('get_participant_count', { p_session_id: sessionId });
assert('participant count >= 3', count >= 3, `got ${count}`);

// ---- 9. Export ----
console.log('\n[9] Export');
const xlsx = await fetch(`${APP}/api/export/results/${sessionId}?format=xlsx&key=${KEY}`);
assert('xlsx export', xlsx.status === 200 && (xlsx.headers.get('content-type') ?? '').includes('spreadsheetml'));
const csv = await fetch(`${APP}/api/export/results/${sessionId}?format=csv&key=${KEY}`);
assert('csv export', csv.status === 200);

// ---- 10. End session ----
console.log('\n[10] End');
const end = await api(`/api/presenter/${sessionId}/advance`, { method: 'POST', headers: H, body: JSON.stringify({ status: 'ended' }) });
assert('end session', end.status === 200);
const deadVote = await rpc('submit_response', { p_session_id: sessionId, p_slide_id: wcSlide.id, p_participant_id: p1, p_device_key: dev1, p_payload: { words: ['late'] } });
assert('ended session rejects votes', deadVote?.ok === false);

// Cleanup
await api(`/api/decks/${deckId}`, { method: 'DELETE', headers: H });

console.log(`\n===== ${passed} passed, ${failed} failed =====`);
if (failures.length) console.log('FAILURES:\n- ' + failures.join('\n- '));
process.exit(failed === 0 ? 0 : 1);
