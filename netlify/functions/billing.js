const crypto = require('node:crypto');
const core = require('./lib/account-core');
const paypal = require('./lib/paypal-core');
exports.handler = async event => {
  try {
    if (!core.sameOrigin(event)) return core.response(403, { error: 'Open subscriptions in MyFPL.' });
    const configured = !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.PAYPAL_WEBHOOK_ID && paypal.plans().pro && paypal.plans().ultra);
    const live = process.env.PAYPAL_ENV === 'live' && process.env.BILLING_LIVE_ENABLED === 'true';
    if (event.httpMethod === 'GET') return core.response(200, { configured, live, open: configured && live && Date.now() >= core.LAUNCH, prices: paypal.prices, launch: '2026-12-01', currency: 'USD' });
    if (event.httpMethod !== 'POST') return core.response(405, { error: 'Method not allowed.' });
    const session = core.session(event);
    if (!session) return core.response(401, { error: 'Verify your email before subscribing.' });
    if (!configured) return core.response(503, { error: 'PayPal billing is not configured. No payment has been taken.' });
    const s = core.store(), b = core.body(event);
    if (b.action === 'cancel') {
      const link = await s.get('billing:' + session.sub, { type: 'json' });
      if (!link?.id) return core.response(400, { error: 'No recurring subscription was found.' });
      await paypal.request('/v1/billing/subscriptions/' + encodeURIComponent(link.id) + '/cancel', 'POST', { reason: 'Cancelled by the MyFPL subscriber' });
      await s.setJSON('billing:' + session.sub, { ...link, checkedAt: 0 });
      return core.response(200, { ok: true, message: 'Renewal cancelled. Verified access remains until the paid period ends.' });
    }
    if (!live || Date.now() < core.LAUNCH) return core.response(503, { error: 'Subscriptions open on 1 December after billing verification. No payment has been taken.' });
    if (b.action !== 'create' || !paypal.plans()[b.plan]) return core.response(400, { error: 'Choose Pro or Ultra monthly.' });
    const existing = await s.get('billing:' + session.sub, { type: 'json' });
    if (existing?.id) {
      const old = await paypal.request('/v1/billing/subscriptions/' + encodeURIComponent(existing.id));
      if (['ACTIVE', 'APPROVAL_PENDING', 'APPROVED', 'SUSPENDED'].includes(old.status)) return core.response(409, { error: 'You already have a subscription or pending checkout. Manage it in PayPal before starting another.' });
    }
    const plan = await paypal.request('/v1/billing/plans/' + encodeURIComponent(paypal.plans()[b.plan]));
    const cycles = plan.billing_cycles || [];
    const cycle = cycles.find(x => x.tenure_type === 'REGULAR');
    if (plan.status !== 'ACTIVE' || cycles.length !== 1 || !cycle || cycle.total_cycles !== 0 || cycle.frequency?.interval_unit !== 'MONTH' || cycle.frequency?.interval_count !== 1 || cycle.pricing_scheme?.fixed_price?.currency_code !== 'USD' || cycle.pricing_scheme.fixed_price.value !== paypal.prices[b.plan] || Number(plan.payment_preferences?.setup_fee?.value || 0) !== 0) throw Object.assign(new Error('The merchant plan does not match the advertised monthly price. Checkout is disabled.'), { status: 503 });
    // Claim a per-account creation lease atomically to prevent double clicks from creating two subscriptions.
    const leaseKey = 'checkout-lock:' + session.sub + ':' + Math.floor(Date.now() / 300000);
    const lease = await s.setJSON(leaseKey, { at: Date.now() }, { onlyIfNew: true });
    if (!lease.modified) return core.response(409, { error: 'A checkout was recently requested. Please wait five minutes before trying again.' });
    const created = await paypal.request('/v1/billing/subscriptions', 'POST', { plan_id: paypal.plans()[b.plan], custom_id: session.sub, application_context: { brand_name: 'MyFPL', user_action: 'SUBSCRIBE_NOW', return_url: core.site() + '/?billing=return', cancel_url: core.site() + '/?billing=cancel' } }, { 'PayPal-Request-Id': crypto.randomUUID() });
    const approval = created.links?.find(x => x.rel === 'approve')?.href;
    if (!created.id || !approval || new URL(approval).protocol !== 'https:' || !['www.paypal.com', 'www.sandbox.paypal.com'].includes(new URL(approval).hostname)) throw new Error('No valid checkout approval URL');
    await s.setJSON('billing:' + session.sub, { id: created.id, plan: b.plan, checkedAt: 0 });
    await s.setJSON('subscription:' + created.id, { user: session.sub });
    return core.response(200, { approval });
  } catch (error) { return core.response(error.status || 503, { error: error.status ? error.message : 'Billing could not be completed. No access was activated; contact support if PayPal shows a payment.' }); }
};
