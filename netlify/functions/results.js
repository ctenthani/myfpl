/**
 * Public live results GET /.netlify/functions/results
 */
const STORE_NAME = 'bt42-oc-sync';
const STATE_KEY = 'state';

function json(code, body) {
  return {
    statusCode: code,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function blobsCredentials() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || '';
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN || process.env.BLOBS_TOKEN || '';
  return { ready: !!(siteID && token), siteID, token };
}

async function readState() {
  const { getStore } = require('@netlify/blobs');
  const cred = blobsCredentials();
  const store = cred.ready
    ? getStore({ name: STORE_NAME, siteID: cred.siteID, token: cred.token })
    : getStore(STORE_NAME);
  try { return (await store.get(STATE_KEY, { type: 'json' })) || {}; } catch (e) { return {}; }
}

function keyOf(r, i) {
  const phone = String(r.phone || r.teamContactPhone || '').replace(/\s+/g, '');
  const name = String(r.fullName || '').trim().toLowerCase();
  if (phone && name) return phone + '|' + name;
  return phone || name || ('idx-' + i);
}

function distCode(d) {
  const s = String(d || '').toLowerCase();
  if (s.indexOf('42') >= 0) return '42.195';
  if (s.indexOf('10') >= 0) return '10';
  if (s.indexOf('5') >= 0) return '5';
  return s || '';
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }
  try {
    const state = await readState();
    const regs = Array.isArray(state.registrations) ? state.registrations : [];
    const fins = state.finishes || {};
    const bibs = state.bibs || {};
    const rows = regs.map((r, i) => {
      const k = keyOf(r, i);
      const fin = fins[k] || {};
      const bib = (bibs[k] && bibs[k].number) || '';
      return {
        name: r.fullName || '',
        distance: distCode(r.distance),
        bib: String(bib || ''),
        status: fin.status || 'on_course',
        time: fin.time || '',
        at: fin.finishedAt || ''
      };
    }).filter((r) => r.name);
    return json(200, { ok: true, updatedAt: state.updatedAt || new Date().toISOString(), rows: rows });
  } catch (e) {
    return json(200, { ok: true, rows: [], updatedAt: null, error: String(e && e.message ? e.message : e) });
  }
};
