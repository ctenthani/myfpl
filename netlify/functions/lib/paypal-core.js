const core = require('./account-core');
const plans = () => ({ pro: process.env.PAYPAL_PRO_PLAN_ID, ultra: process.env.PAYPAL_ULTRA_PLAN_ID });
const prices = { pro: '2.49', ultra: '4.99' };
const api = () => process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
let accessToken = null;
async function request(path, method = 'GET', data, extra = {}) {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) throw Object.assign(new Error('PayPal subscriptions are not configured yet.'), { status: 503 });
  if (!accessToken || accessToken.until < Date.now()) {
    const r = await fetch(api() + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_CLIENT_SECRET).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials', signal: AbortSignal.timeout(12000) });
    const j = await r.json();
    if (!r.ok || !j.access_token) throw new Error('PayPal authentication failed');
    accessToken = { value: j.access_token, until: Date.now() + Math.max(30, j.expires_in - 120) * 1000 };
  }
  const r = await fetch(api() + path, { method, headers: { Authorization: 'Bearer ' + accessToken.value, 'Content-Type': 'application/json', ...extra }, ...(data ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error('PayPal request failed');
  return r.status === 204 ? {} : r.json();
}
function paidAccess(subscription, user, revokedAt = 0, now = Date.now()) {
  const plan = Object.keys(plans()).find(k => plans()[k] && plans()[k] === subscription.plan_id);
  const payment = subscription.billing_info?.last_payment;
  if (!plan || subscription.custom_id !== user || !['ACTIVE', 'CANCELLED'].includes(subscription.status) || !payment || payment.amount?.currency_code !== 'USD' || Number(payment.amount.value) < Number(prices[plan])) return { plan: 'starter', until: 0 };
  const paidAt = Date.parse(payment.time);
  if (!Number.isFinite(paidAt) || paidAt <= revokedAt || paidAt > now + 300000) return { plan: 'starter', until: 0 };
  const end = new Date(paidAt);
  const day = end.getUTCDate(); end.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate(); end.setUTCDate(Math.min(day, lastDay));
  const next = Date.parse(subscription.billing_info.next_billing_time);
  const until = Number.isFinite(next) ? Math.min(end.getTime(), next) : end.getTime();
  return until > now ? { plan, until, subscriptionId: subscription.id, status: subscription.status } : { plan: 'starter', until: 0 };
}
async function entitlement(user, s) {
  const stored = await s.getWithMetadata('billing:' + user, { type: 'json' });
  const link = stored?.data;
  if (!link?.id) {
    // Existing owner-verified manual purchases remain usable after email verification.
    const account = await s.get('user:' + user, { type: 'json' });
    const { getStore } = require('@netlify/blobs');
    const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID, token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
    const legacy = getStore({ name: 'fpl-members', consistency: 'strong', ...(siteID && token ? { siteID, token } : {}) });
    const member = account?.email ? await legacy.get('email:' + account.email, { type: 'json' }) : null;
    return member && Number(member.teamId) === Number(account.teamId) && ['pro', 'ultra'].includes(member.plan) && Number(member.until) > Date.now() ? { plan: member.plan, until: member.until } : { plan: 'starter', until: 0 };
  }
  if (link.checkedAt && Date.now() - link.checkedAt < 120000) return link.access?.until > Date.now() ? link.access : { plan: 'starter', until: 0 };
  try {
    const subscription = await request('/v1/billing/subscriptions/' + encodeURIComponent(link.id));
    const access = paidAccess(subscription, user, link.revokedAt);
    const changed = await s.setJSON('billing:' + user, { ...link, access, checkedAt: Date.now() }, { onlyIfMatch: stored.etag });
    if (!changed.modified) return { plan: 'starter', until: 0, unavailable: true };
    return access;
  } catch { return { plan: 'starter', until: 0, unavailable: true }; }
}
module.exports = { plans, prices, api, request, paidAccess, entitlement };
