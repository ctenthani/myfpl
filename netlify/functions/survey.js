/**
 * Public feedback POST /.netlify/functions/survey
 */
const STORE_NAME = 'bt42-oc-sync';
const STATE_KEY = 'state';

function json(code, body) {
  return {
    statusCode: code,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body)
  };
}

function blobsCredentials() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || '';
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN || process.env.BLOBS_TOKEN || '';
  return { ready: !!(siteID && token), siteID, token };
}

async function readWrite(mutator) {
  const { getStore } = require('@netlify/blobs');
  const cred = blobsCredentials();
  const store = cred.ready
    ? getStore({ name: STORE_NAME, siteID: cred.siteID, token: cred.token })
    : getStore(STORE_NAME);
  let state = {};
  try { state = (await store.get(STATE_KEY, { type: 'json' })) || {}; } catch (e) { state = {}; }
  if (!state || typeof state !== 'object') state = {};
  if (!Array.isArray(state.surveyResponses)) state.surveyResponses = [];
  mutator(state);
  state.updatedAt = new Date().toISOString();
  await store.setJSON(STATE_KEY, state);
  return state;
}

const OPEN_AT = Date.parse('2026-09-27T12:00:00+02:00');
const AUDIENCES = ['participant', 'volunteer', 'committee', 'media', 'public'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  if (event.httpMethod === 'GET') {
    return json(200, { ok: true, open: Date.now() >= OPEN_AT, openAt: '2026-09-27T12:00:00+02:00' });
  }
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'POST only' });
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { ok: false, error: 'Bad JSON' }); }
  const pretest = !!body.pretest;
  if (Date.now() < OPEN_AT && !pretest) {
    return json(403, { ok: false, error: 'Survey opens 27 September 2026 at 12:00 CAT' });
  }
  const audience = String(body.audience || '').toLowerCase();
  if (AUDIENCES.indexOf(audience) < 0) return json(400, { ok: false, error: 'Choose who you are' });
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};
  const rec = {
    id: 'sv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
    audience,
    answers,
    pretest,
    comment: String(body.comment || '').slice(0, 2000),
    submittedAt: new Date().toISOString()
  };
  try {
    await readWrite((state) => {
      state.surveyResponses.push(rec);
      if (state.surveyResponses.length > 4000) state.surveyResponses = state.surveyResponses.slice(-4000);
    });
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { ok: false, error: String(e && e.message ? e.message : e) });
  }
};
