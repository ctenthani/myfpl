/**
 * Netlify Function — TNM Mpamba webhook receiver (design implementation)
 *
 * Deploy path: /.netlify/functions/mpamba-webhook
 *
 * Setup:
 * 1. Agree payload + secret with TNM / payment aggregator for business code 500204
 * 2. Set MPAMBA_WEBHOOK_SECRET in Netlify env
 * 3. Point TNM callbacks to this URL
 * 4. Persist matches (Blobs, Supabase, Fauna, etc.) — placeholder uses response only
 *
 * This function validates and acknowledges payments. Wire storage to your
 * registration database so Control Room can read verified status.
 */

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secret = process.env.MPAMBA_WEBHOOK_SECRET || '';
  const headerSecret =
    (event.headers && (event.headers['x-webhook-secret'] || event.headers['x-mpamba-secret'])) || '';

  if (!secret || headerSecret !== secret) {
    return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Unauthorized' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
  }

  const businessCode = String(payload.businessCode || payload.business_code || '');
  if (businessCode && businessCode !== '500204') {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Unknown business code' }) };
  }

  const transactionId = payload.transactionId || payload.txn_id || payload.id;
  const msisdn = String(payload.msisdn || payload.phone || payload.reference || '').replace(/\s+/g, '');
  const amount = payload.amount;
  const paidAt = payload.paidAt || payload.timestamp || new Date().toISOString();

  if (!transactionId || !msisdn) {
    return {
      statusCode: 422,
      body: JSON.stringify({ ok: false, error: 'transactionId and msisdn/reference required' })
    };
  }

  // TODO: upsert into your store, e.g. Netlify Blobs / Supabase:
  // await store.set(`payment:${transactionId}`, { msisdn, amount, paidAt, status: 'verified' })
  // await matchRegistrationByPhone(msisdn)

  console.log(
    JSON.stringify({
      msg: 'mpamba_payment_verified',
      transactionId,
      msisdnMasked: msisdn.slice(0, 5) + '****',
      amount,
      paidAt
    })
  );

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      transactionId,
      status: 'verified',
      note: 'Persist this event to your registration store; Control Room can then auto-flip payment status.'
    })
  };
};
