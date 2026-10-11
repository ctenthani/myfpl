const crypto = require('node:crypto');
const { getStore } = require('@netlify/blobs');
const LAUNCH = Date.parse('2026-12-01T00:00:00Z');
const site = () => (process.env.SITE_URL || 'https://myfpl.netlify.app').replace(/\/$/, '');
let nativeStore;
function configureStore(factory) { nativeStore = factory; }
function store() {
  if (nativeStore) return nativeStore({ name: 'myfpl-accounts', consistency: 'strong' });
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  return getStore({ name: 'myfpl-accounts', consistency: 'strong', ...(siteID && token ? { siteID, token } : {}) });
}
function secret() {
  const value = process.env.AUTH_SECRET || process.env.DIGEST_SECRET;
  if (!value || value.length < 24) throw Object.assign(new Error('Verified sign-in is not configured yet.'), { status: 503 });
  return crypto.createHmac('sha256', value).update('myfpl-account-v1').digest();
}
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const userId = email => hash(email.trim().toLowerCase());
function sign(value) { return crypto.createHmac('sha256', secret()).update(value).digest('base64url'); }
function token(email, teamId, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ email, teamId, sub: userId(email), exp: now + 7 * 86400000 })).toString('base64url');
  return payload + '.' + sign(payload);
}
function session(event, now = Date.now()) {
  const cookie = (event.headers || {}).cookie || (event.headers || {}).Cookie || '';
  const raw = cookie.split(';').map(x => x.trim()).find(x => x.startsWith('myfpl_session='))?.slice('myfpl_session='.length);
  if (!raw || raw.length > 2048) return null;
  const [payload, supplied, extra] = raw.split('.');
  if (!payload || !supplied || extra) return null;
  const expected = sign(payload);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
  try { const row = JSON.parse(Buffer.from(payload, 'base64url')); return row.exp > now && row.sub === userId(row.email) ? row : null; } catch { return null; }
}
function cookie(value) { return `myfpl_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${value ? 604800 : 0}`; }
function response(status, data, extra = {}) { return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra }, body: JSON.stringify(data) }; }
function sameOrigin(event) {
  const origin = (event.headers || {}).origin || (event.headers || {}).Origin;
  return !origin || origin === new URL(site()).origin;
}
function body(event) { if ((event.body || '').length > 25000) throw Object.assign(new Error('Request too large.'), { status: 413 }); return JSON.parse(event.body || '{}'); }
module.exports = { LAUNCH, site, store, configureStore, hash, userId, sign, token, session, cookie, response, sameOrigin, body };
