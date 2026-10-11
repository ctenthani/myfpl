const core = require('./lib/account-core');
const paypal = require('./lib/paypal-core');
exports.handler = async event => {
  if (event.httpMethod !== 'POST') return core.response(405, { error: 'Method not allowed.' });
  try {
    if (!process.env.PAYPAL_WEBHOOK_ID) return core.response(503, { error: 'Webhook is not configured.' });
    const data = core.body(event), h = event.headers || {};
    const verification = await paypal.request('/v1/notifications/verify-webhook-signature', 'POST', { auth_algo: h['paypal-auth-algo'], cert_url: h['paypal-cert-url'], transmission_id: h['paypal-transmission-id'], transmission_sig: h['paypal-transmission-sig'], transmission_time: h['paypal-transmission-time'], webhook_id: process.env.PAYPAL_WEBHOOK_ID, webhook_event: data });
    if (verification.verification_status !== 'SUCCESS') return core.response(401, { error: 'Signature not verified.' });
    const s = core.store();
    if (await s.get('event:' + data.id)) return core.response(200, { duplicate: true });
    const resource = data.resource || {};
    let id = resource.billing_agreement_id || (String(resource.id || '').startsWith('I-') ? resource.id : null);
    if (!id && resource.sale_id) id = (await paypal.request('/v1/payments/sale/' + encodeURIComponent(resource.sale_id))).billing_agreement_id;
    if (!id) return core.response(200, { ignored: true });
    const index = await s.get('subscription:' + id, { type: 'json' });
    if (!index) return core.response(200, { ignored: true });
    const stored = await s.getWithMetadata('billing:' + index.user, { type: 'json' });
    const link = stored?.data;
    if (link?.id !== id) return core.response(200, { ignored: true });
    const refund = /REFUNDED|REVERSED/.test(data.event_type || '');
    const subscription = await paypal.request('/v1/billing/subscriptions/' + encodeURIComponent(id));
    const revokedAt = refund ? Date.now() : link.revokedAt || 0;
    const access = paypal.paidAccess(subscription, index.user, revokedAt);
    const changed = await s.setJSON('billing:' + index.user, { ...link, revokedAt, access, checkedAt: Date.now() }, { onlyIfMatch: stored.etag });
    if (!changed.modified) throw new Error('Concurrent billing update; retry');
    // Mark processed only after the entitlement write succeeds; failed deliveries can be retried.
    await s.setJSON('event:' + data.id, { at: Date.now(), type: data.event_type }, { onlyIfNew: true });
    return core.response(200, { ok: true });
  } catch { return core.response(503, { error: 'Webhook processing failed; retry delivery.' }); }
};
