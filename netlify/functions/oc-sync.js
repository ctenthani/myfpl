/**
 * Shared OC data sync
 * Tries Netlify Blobs (with explicit siteID/token), then JSONBin.io fallback.
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
        error: 'OC_SYNC_TOKEN is not set in Netlify environment variables. Add it, then redeploy.'
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

function blobStoreOptions() {
  const siteID =
    process.env.NETLIFY_SITE_ID ||
    process.env.SITE_ID ||
    process.env.BLOBS_SITE_ID ||
    '';
  const token =
    process.env.NETLIFY_BLOBS_TOKEN ||
    process.env.NETLIFY_AUTH_TOKEN ||
    process.env.BLOBS_TOKEN ||
    '';

  const opts = { name: STORE_NAME, consistency: 'strong' };
  // Supply manual credentials when auto context is missing (common on some deploys)
  if (siteID && token) {
    opts.siteID = siteID;
    opts.token = token;
  }
  return { opts, siteID: !!siteID, token: !!token };
}

async function blobsRead() {
  const { getStore } = require('@netlify/blobs');
  const { opts, siteID, token } = blobStoreOptions();
  if (!siteID || !token) {
    // Still try default context first
    try {
      const store = getStore({ name: STORE_NAME, consistency: 'strong' });
      const raw = await store.get(STATE_KEY, { type: 'json' });
      if (!raw || typeof raw !== 'object') return emptyState();
      return Object.assign(emptyState(), raw);
    } catch (e) {
      throw new Error(
        (e && e.message ? e.message : String(e)) +
          ' — Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN (or NETLIFY_BLOBS_TOKEN) in Netlify env, or use JSONBin fallback.'
      );
    }
  }
  const store = getStore(opts);
  const raw = await store.get(STATE_KEY, { type: 'json' });
  if (!raw || typeof raw !== 'object') return emptyState();
  return Object.assign(emptyState(), raw);
}

async function blobsWrite(state) {
  const { getStore } = require('@netlify/blobs');
  const { opts, siteID, token } = blobStoreOptions();
  if (!siteID || !token) {
    try {
      const store = getStore({ name: STORE_NAME, consistency: 'strong' });
      await store.setJSON(STATE_KEY, state);
      return;
    } catch (e) {
      throw new Error(
        (e && e.message ? e.message : String(e)) +
          ' — Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN in Netlify env, or use JSONBin fallback.'
      );
    }
  }
  const store = getStore(opts);
  await store.setJSON(STATE_KEY, state);
}

function jsonbinConfigured() {
  return !!(process.env.JSONBIN_BIN_ID && process.env.JSONBIN_API_KEY);
}

async function jsonbinRead() {
  const id = process.env.JSONBIN_BIN_ID;
  const key = process.env.JSONBIN_API_KEY;
  const res = await fetch('https://api.jsonbin.io/v3/b/' + id + '/latest', {
    headers: { 'X-Master-Key': key }
  });
  if (!res.ok) throw new Error('JSONBin read failed: ' + res.status + ' ' + (await res.text()));
  const data = await res.json();
  const record = data.record || data;
  if (!record || typeof record !== 'object') return emptyState();
  return Object.assign(emptyState(), record);
}

async function jsonbinWrite(state) {
  const id = process.env.JSONBIN_BIN_ID;
  const key = process.env.JSONBIN_API_KEY;
  const res = await fetch('https://api.jsonbin.io/v3/b/' + id, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': key,
      'X-Bin-Versioning': 'false'
    },
    body: JSON.stringify(state)
  });
  if (!res.ok) throw new Error('JSONBin write failed: ' + res.status + ' ' + (await res.text()));
}

function blobsCredentialsReady() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || process.env.BLOBS_SITE_ID || '';
  const token =
    process.env.NETLIFY_BLOBS_TOKEN ||
    process.env.NETLIFY_AUTH_TOKEN ||
    process.env.BLOBS_TOKEN ||
    '';
  return !!(siteID && token);
}

async function readState() {
  const errors = [];
  // Prefer JSONBin when configured
  if (jsonbinConfigured()) {
    try {
      return { state: await jsonbinRead(), backend: 'jsonbin' };
    } catch (e) {
      errors.push('jsonbin: ' + (e && e.message ? e.message : String(e)));
    }
  }
  // Only attempt Blobs when siteID + token are set (avoids noisy auto-context errors)
  if (blobsCredentialsReady()) {
    try {
      return { state: await blobsRead(), backend: 'blobs' };
    } catch (e) {
      errors.push('blobs: ' + (e && e.message ? e.message : String(e)));
    }
  } else {
    errors.push(
      'blobs: skipped (set NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN, or use JSONBin)'
    );
  }
  throw new Error(
    errors.join(' | ') +
      ' — Recommended: set JSONBIN_BIN_ID and JSONBIN_API_KEY on Netlify (free at jsonbin.io), then redeploy.'
  );
}

async function writeState(state) {
  const errors = [];
  if (jsonbinConfigured()) {
    try {
      await jsonbinWrite(state);
      return 'jsonbin';
    } catch (e) {
      errors.push('jsonbin: ' + (e && e.message ? e.message : String(e)));
    }
  }
  if (blobsCredentialsReady()) {
    try {
      await blobsWrite(state);
      return 'blobs';
    } catch (e) {
      errors.push('blobs: ' + (e && e.message ? e.message : String(e)));
    }
  } else {
    errors.push('blobs: skipped (credentials not set)');
  }
  throw new Error(
    errors.join(' | ') +
      ' — Set JSONBIN_BIN_ID + JSONBIN_API_KEY (recommended) or NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN, then redeploy.'
  );
}

function mergeState(current, body, role) {
  const next = Object.assign({}, current);
  if (Array.isArray(body.registrations)) {
    if (body.replaceRegistrations || body.registrations.length === 0) {
      // Full replace (clear all or explicit replace) — Chair should send replaceRegistrations: true
      next.registrations = body.registrations;
    } else {
      const keyOf = (r) =>
        String(r.phone || '').replace(/\s+/g, '').toLowerCase() +
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
      const e = new Error('Only Chair can replace payments');
      e.status = 403;
      throw e;
    }
    next.payments = body.payments;
  }
  if (body.replaceBibs && body.bibs && typeof body.bibs === 'object') {
    next.bibs = body.bibs;
  }
  if (body.replaceFinishes && body.finishes && typeof body.finishes === 'object') {
    next.finishes = body.finishes;
  }
  if (body.payments && typeof body.payments === 'object') {
    if (role !== 'chair') {
      const e = new Error('Only Chair can update payments');
      e.status = 403;
      throw e;
    }
    next.payments = Object.assign({}, current.payments || {}, body.payments);
  }
  if (body.bibs && typeof body.bibs === 'object') {
    next.bibs = Object.assign({}, current.bibs || {}, body.bibs);
  }
  if (body.finishes && typeof body.finishes === 'object') {
    next.finishes = Object.assign({}, current.finishes || {}, body.finishes);
  }
  if (body.attendance && typeof body.attendance === 'object') {
    next.attendance = Object.assign({}, current.attendance || {}, body.attendance);
  }
  if (body.signatures && typeof body.signatures === 'object') {
    if (role !== 'chair') {
      const e = new Error('Only Chair can update signatures');
      e.status = 403;
      throw e;
    }
    next.signatures = Object.assign({}, current.signatures || {}, body.signatures);
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
      if (role !== 'chair' && state.signatures) {
        state.signatures = {
          kalua: !!state.signatures.kalua,
          chinangwa: !!state.signatures.chinangwa,
          tenthani: !!state.signatures.tenthani,
          _presentOnly: true
        };
      }
      return json(200, { ok: true, backend, state });
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
    return json(500, {
      ok: false,
      error: 'Storage unavailable',
      detail,
      hint:
        'Recommended: set JSONBIN_BIN_ID + JSONBIN_API_KEY (free at jsonbin.io). Or set NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN for Blobs.'
    });
  }
};
