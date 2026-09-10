/**
 * Shared OC data sync — resilient storage
 * Order: Netlify Blobs (if siteID+token) → JSONBin (with retries)
 */

const STORE_NAME = 'bt42-oc-sync';
const STATE_KEY = 'state';

const emptyState = () => ({
  registrations: [],
  payments: {},
  bibs: {},
  finishes: {},
  attendance: {},
  signatures: {},
  staffUsers: [],
  siteContent: null,
  suppressedKeys: [],
  updatedAt: null,
  updatedBy: null
});

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-oc-token, x-oc-role',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
}

function json(status, body) {
  return { statusCode: status, headers: corsHeaders(), body: JSON.stringify(body) };
}

function getToken(event) {
  const h = event.headers || {};
  return h['x-oc-token'] || h['X-Oc-Token'] || '';
}

function getRole(event) {
  const h = event.headers || {};
  const r = (h['x-oc-role'] || h['X-Oc-Role'] || 'committee').toLowerCase();
  return r === 'chair' ? 'chair' : 'committee';
}

function assertAuth(event) {
  const expected = process.env.OC_SYNC_TOKEN || '';
  const token = getToken(event);
  if (!expected) {
    return {
      ok: false,
      response: json(503, {
        ok: false,
        error: 'OC_SYNC_TOKEN is not set in Netlify environment variables.'
      })
    };
  }
  if (token !== expected) {
    return {
      ok: false,
      response: json(401, { ok: false, error: 'Unauthorized — check OC_SYNC_TOKEN on this device' })
    };
  }
  return { ok: true };
}

function envNonEmpty(name) {
  const v = process.env[name];
  return v && String(v).trim().length > 0 ? String(v).trim() : '';
}

function blobsCredentials() {
  const siteID =
    envNonEmpty('NETLIFY_SITE_ID') ||
    envNonEmpty('SITE_ID') ||
    envNonEmpty('BLOBS_SITE_ID');
  const token =
    envNonEmpty('NETLIFY_BLOBS_TOKEN') ||
    envNonEmpty('NETLIFY_AUTH_TOKEN') ||
    envNonEmpty('BLOBS_TOKEN');
  return { siteID, token, ready: !!(siteID && token) };
}

async function blobsRead() {
  const { getStore } = require('@netlify/blobs');
  const { siteID, token, ready } = blobsCredentials();
  let store;
  if (ready) {
    store = getStore({ name: STORE_NAME, siteID, token, consistency: 'strong' });
  } else {
    // Auto context on Netlify (works on many deploys)
    store = getStore({ name: STORE_NAME, consistency: 'strong' });
  }
  const raw = await store.get(STATE_KEY, { type: 'json' });
  if (!raw || typeof raw !== 'object') return emptyState();
  return Object.assign(emptyState(), raw);
}

async function blobsWrite(state) {
  const { getStore } = require('@netlify/blobs');
  const { siteID, token, ready } = blobsCredentials();
  let store;
  if (ready) {
    store = getStore({ name: STORE_NAME, siteID, token, consistency: 'strong' });
  } else {
    store = getStore({ name: STORE_NAME, consistency: 'strong' });
  }
  await store.setJSON(STATE_KEY, state);
}

function jsonbinConfigured() {
  return !!(envNonEmpty('JSONBIN_BIN_ID') && envNonEmpty('JSONBIN_API_KEY'));
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url, options, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function jsonbinRead() {
  const id = envNonEmpty('JSONBIN_BIN_ID');
  const key = envNonEmpty('JSONBIN_API_KEY');
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetchWithTimeout(
        'https://api.jsonbin.io/v3/b/' + id + '/latest',
        { headers: { 'X-Master-Key': key } },
        12000
      );
      if (!res.ok) {
        lastErr = new Error('JSONBin read failed: ' + res.status);
        await sleep(500 * (i + 1));
        continue;
      }
      const data = await res.json();
      const record = data.record || data;
      if (!record || typeof record !== 'object') return emptyState();
      return Object.assign(emptyState(), record);
    } catch (e) {
      lastErr = e;
      await sleep(500 * (i + 1));
    }
  }
  throw new Error(
    'JSONBin unreachable (' +
      (lastErr && lastErr.message ? lastErr.message : 'timeout') +
      '). If this persists, set NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN for Blobs.'
  );
}

async function jsonbinWrite(state) {
  const id = envNonEmpty('JSONBIN_BIN_ID');
  const key = envNonEmpty('JSONBIN_API_KEY');
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetchWithTimeout(
        'https://api.jsonbin.io/v3/b/' + id,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': key,
            'X-Bin-Versioning': 'false'
          },
          body: JSON.stringify(state)
        },
        12000
      );
      if (!res.ok) {
        lastErr = new Error('JSONBin write failed: ' + res.status);
        await sleep(500 * (i + 1));
        continue;
      }
      return;
    } catch (e) {
      lastErr = e;
      await sleep(500 * (i + 1));
    }
  }
  throw new Error(
    'JSONBin write failed (' +
      (lastErr && lastErr.message ? lastErr.message : 'timeout') +
      ')'
  );
}


async function fetchNetlifyFormSubmissions() {
  const siteID = envNonEmpty('NETLIFY_SITE_ID') || envNonEmpty('SITE_ID');
  const token = envNonEmpty('NETLIFY_AUTH_TOKEN') || envNonEmpty('NETLIFY_BLOBS_TOKEN');
  const formId = envNonEmpty('NETLIFY_FORM_ID'); // optional explicit id
  if (!siteID || !token) return [];

  const headers = { Authorization: 'Bearer ' + token };

  // List forms, find bt42-registration unless form id set
  let fid = formId;
  if (!fid) {
    const fr = await fetchWithTimeout(
      'https://api.netlify.com/api/v1/sites/' + siteID + '/forms',
      { headers },
      10000
    );
    if (!fr.ok) throw new Error('Forms list HTTP ' + fr.status);
    const forms = await fr.json();
    const hit = (forms || []).find(
      (f) => f.name === 'bt42-registration' || f.name === 'registration'
    );
    if (!hit) return [];
    fid = hit.id;
  }

  const sr = await fetchWithTimeout(
    'https://api.netlify.com/api/v1/forms/' + fid + '/submissions?per_page=1000',
    { headers },
    15000
  );
  if (!sr.ok) throw new Error('Forms submissions HTTP ' + sr.status);
  const subs = await sr.json();
  return (subs || []).map((s) => {
    const d = s.data || s;
    return {
      fullName: d.fullName || d.name || d['Full Name'] || '',
      phone: d.phone || d.mobile || '',
      email: d.email || '',
      distance: d.distance || '',
      dob: d.dob || '',
      gender: d.gender || '',
      emergency: d.emergency || '',
      submittedAt: s.created_at || d.submittedAt || new Date().toISOString(),
      source: 'netlify-forms',
      formSubmissionId: s.id || s.number || null
    };
  }).filter((r) => r.fullName && r.phone);
}

function mergeRegistrationLists(primary, secondary) {
  const keyOf = (r) =>
    String(r.phone || '')
      .replace(/\s+/g, '')
      .toLowerCase() +
    '|' +
    String(r.fullName || '')
      .trim()
      .toLowerCase();
  const map = new Map();
  (primary || []).forEach((r) => map.set(keyOf(r), r));
  (secondary || []).forEach((r) => {
    const k = keyOf(r);
    if (!map.has(k)) map.set(k, r);
    else map.set(k, Object.assign({}, r, map.get(k))); // prefer primary fields
  });
  return Array.from(map.values()).sort((a, b) =>
    String(b.submittedAt || '').localeCompare(String(a.submittedAt || ''))
  );
}


async function readState() {
  const errors = [];
  // Prefer Blobs when credentials are set (more reliable than JSONBin today)
  if (blobsCredentials().ready) {
    try {
      return { state: await blobsRead(), backend: 'blobs' };
    } catch (e) {
      errors.push('blobs: ' + (e && e.message ? e.message : String(e)));
    }
  }
  if (jsonbinConfigured()) {
    try {
      return { state: await jsonbinRead(), backend: 'jsonbin' };
    } catch (e) {
      errors.push('jsonbin: ' + (e && e.message ? e.message : String(e)));
    }
  }
  // Last resort: Blobs auto-context
  try {
    return { state: await blobsRead(), backend: 'blobs-auto' };
  } catch (e) {
    errors.push('blobs-auto: ' + (e && e.message ? e.message : String(e)));
  }
  throw new Error(
    errors.join(' | ') +
      ' — JSONBin may be down. Set Site ID + Personal Access Token: NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN, then redeploy.'
  );
}

async function writeState(state) {
  const errors = [];
  if (blobsCredentials().ready) {
    try {
      await blobsWrite(state);
      return 'blobs';
    } catch (e) {
      errors.push('blobs: ' + (e && e.message ? e.message : String(e)));
    }
  }
  if (jsonbinConfigured()) {
    try {
      await jsonbinWrite(state);
      return 'jsonbin';
    } catch (e) {
      errors.push('jsonbin: ' + (e && e.message ? e.message : String(e)));
    }
  }
  try {
    await blobsWrite(state);
    return 'blobs-auto';
  } catch (e) {
    errors.push('blobs-auto: ' + (e && e.message ? e.message : String(e)));
  }
  throw new Error(errors.join(' | '));
}

function mergeState(current, body, role) {
  const next = Object.assign({}, current);
  if (Array.isArray(body.registrations)) {
    if (body.replaceRegistrations || body.registrations.length === 0) {
      next.registrations = body.registrations;
    } else {
      const keyOf = (r) =>
        String(r.phone || '').replace(/\\s+/g, '').toLowerCase() +
        '|' +
        String(r.fullName || '').trim().toLowerCase();
      const map = new Map();
      (current.registrations || []).forEach((r) => map.set(keyOf(r), r));
      body.registrations.forEach((r) => {
        const k = keyOf(r);
        map.set(k, Object.assign({}, map.get(k) || {}, r));
      });
      next.registrations = Array.from(map.values());
    }
  }
  if (body.replacePayments && body.payments && typeof body.payments === 'object') {
    if (role !== 'chair') {
      // Ops may not wipe the whole map — merge instead
      next.payments = Object.assign({}, current.payments || {}, body.payments);
    } else {
      next.payments = body.payments;
    }
  } else if (body.payments && typeof body.payments === 'object') {
    // Chair and Ops (committee token) can verify / reject
    const cur = current.payments || {};
    const incoming = body.payments || {};
    const merged = Object.assign({}, cur);
    Object.keys(incoming).forEach((k) => {
      const inc = incoming[k] || {};
      const old = merged[k] || {};
      if (inc.status === 'verified' || inc.status === 'rejected') merged[k] = inc;
      else if (!old.status) merged[k] = inc;
    });
    next.payments = merged;
  }
  if (body.replaceBibs && body.bibs && typeof body.bibs === 'object') {
    next.bibs = body.bibs;
  } else if (body.bibs && typeof body.bibs === 'object') {
    next.bibs = Object.assign({}, current.bibs || {}, body.bibs);
  }
  if (body.replaceFinishes && body.finishes && typeof body.finishes === 'object') {
    next.finishes = body.finishes;
  } else if (body.finishes && typeof body.finishes === 'object') {
    next.finishes = Object.assign({}, current.finishes || {}, body.finishes);
  }
  if (body.attendance && typeof body.attendance === 'object') {
    next.attendance = Object.assign({}, current.attendance || {}, body.attendance);
  }
  if (body.siteContent && typeof body.siteContent === 'object') {
    if (role !== 'chair') {
      const e = new Error('Only Chair can update site content');
      e.statusCode = 403;
      throw e;
    }
    next.siteContent = body.siteContent;
  }
  if (body.staffUsers && Array.isArray(body.staffUsers)) {
    if (role !== 'chair') {
      const e = new Error('Only Chair can update staff users');
      e.statusCode = 403;
      throw e;
    }
    next.staffUsers = body.staffUsers;
  }
  if (body.signatures && typeof body.signatures === 'object') {
    if (role !== 'chair') {
      const e = new Error('Only Chair can update signatures');
      e.status = 403;
      throw e;
    }
    const curS = current.signatures || {};
    const incS = body.signatures || {};
    const pick = (k, alt) => {
      const v = incS[k] || (alt ? incS[alt] : '') || curS[k] || (alt ? curS[alt] : '');
      return (typeof v === 'string' && v.indexOf('data:image') === 0) ? v : (curS[k] || '');
    };
    next.signatures = {
      kalua: pick('kalua'),
      chamwala: pick('chamwala', 'chinangwa'),
      tenthani: pick('tenthani')
    };
  }
  if (Array.isArray(body.suppressedKeys)) {
    if (role !== 'chair') {
      const e = new Error('Only Chair can update suppressed keys');
      e.status = 403;
      throw e;
    }
    const set = new Set([...(current.suppressedKeys || []), ...body.suppressedKeys]);
    if (body.replaceSuppressed) {
      next.suppressedKeys = body.suppressedKeys;
    } else {
      next.suppressedKeys = Array.from(set);
    }
  }
  // Drop suppressed from registrations after any merge
  if (Array.isArray(next.suppressedKeys) && next.suppressedKeys.length) {
    const sup = new Set(next.suppressedKeys);
    const keyOf2 = (r) =>
      String(r.phone || '').replace(/\s+/g, '').toLowerCase() +
      '|' +
      String(r.fullName || '').trim().toLowerCase();
    next.registrations = (next.registrations || []).filter((r) => !sup.has(keyOf2(r)));
  }
  next.updatedAt = new Date().toISOString();
  next.updatedBy = role;
  return next;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  const auth = assertAuth(event);
  if (!auth.ok) return auth.response;

  const role = getRole(event);

  try {
    if (event.httpMethod === 'GET') {
      const { state, backend } = await readState();
      let formsCount = 0;
      let formsError = null;
      try {
        const fromForms = await fetchNetlifyFormSubmissions();
        formsCount = fromForms.length;
        if (fromForms.length) {
          let merged = mergeRegistrationLists(state.registrations || [], fromForms);
          const sup = new Set(state.suppressedKeys || []);
          if (sup.size) {
            const keyOf2 = (r) =>
              String(r.phone || '').replace(/\s+/g, '').toLowerCase() +
              '|' +
              String(r.fullName || '').trim().toLowerCase();
            merged = merged.filter((r) => !sup.has(keyOf2(r)));
          }
          if (JSON.stringify(merged) !== JSON.stringify(state.registrations || [])) {
            state.registrations = merged;
            state.updatedAt = new Date().toISOString();
            state.updatedBy = 'forms-merge';
            try {
              await writeState(state);
            } catch (e) {
              /* still return merged even if persist fails */
            }
          } else {
            state.registrations = merged;
          }
        }
      } catch (e) {
        formsError = e && e.message ? e.message : String(e);
      }
      if (role !== 'chair' && state.signatures) {
        state.signatures = {
          kalua: !!(state.signatures.kalua && String(state.signatures.kalua).indexOf('data:image') === 0),
          chamwala: !!(state.signatures.chamwala && String(state.signatures.chamwala).indexOf('data:image') === 0),
          tenthani: !!(state.signatures.tenthani && String(state.signatures.tenthani).indexOf('data:image') === 0),
          _presentOnly: true
        };
      }
      return json(200, {
        ok: true,
        backend,
        formsMerged: formsCount,
        formsError,
        state
      });
    }

    if (event.httpMethod === 'POST') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return json(400, { ok: false, error: 'Invalid JSON' });
      }
      const { state: current } = await readState();
      let next;
      try {
        next = mergeState(current, body, role);
      } catch (e) {
        return json(e.status || 400, { ok: false, error: e.message });
      }
      const backend = await writeState(next);
      return json(200, { ok: true, backend, state: next });
    }

    return json(405, { ok: false, error: 'Method Not Allowed' });
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    return json(502, {
      ok: false,
      error: 'Storage unavailable',
      detail,
      hint:
        'JSONBin is currently timing out. Add real values for NETLIFY_SITE_ID (Site settings → General → Site ID) and NETLIFY_AUTH_TOKEN (User settings → Personal access tokens), then Trigger deploy.'
    });
  }
};
