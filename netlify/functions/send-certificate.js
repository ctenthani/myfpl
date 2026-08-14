/**
 * Netlify Function — send completion / entry certificate email
 *
 * POST /.netlify/functions/send-certificate
 * Body: { type, fullName, email, phone, distance, finishTime, raceDate }
 *
 * Requires EMAIL_API_KEY + EMAIL_FROM (Resend example below).
 * Without keys, returns 501 so the UI still works offline.
 */

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
  }

  const to = (data.email || '').trim();
  if (!to) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        skipped: true,
        reason: 'No email on registration — certificate still available in Control Room'
      })
    };
  }

  const apiKey = process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'certificates@bt42.mw';

  if (!apiKey) {
    return {
      statusCode: 501,
      body: JSON.stringify({
        ok: false,
        error: 'EMAIL_API_KEY not configured. Certificate opened in browser; email not sent.'
      })
    };
  }

  const isCompletion = data.type === 'completion_certificate';
  const subject = isCompletion
    ? `Certificate of Completion — BT42.195 km Race 2026`
    : `Certificate of Participation — BT42.195 km Race 2026`;

  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto">
      <p>Dear ${escapeHtml(data.fullName || 'Athlete')},</p>
      <p>Congratulations from the <strong>Malawi National Council of Sports</strong> and the BT42.195 km Race Organising Committee.</p>
      <p>You are recorded as having <strong>${isCompletion ? 'completed' : 'registered for'}</strong>
         the <strong>${escapeHtml(data.distance || '')}</strong>
         ${data.finishTime ? ' in a time of <strong>' + escapeHtml(data.finishTime) + '</strong>' : ''}
         on <strong>${escapeHtml(data.raceDate || '19 September 2026')}</strong>.</p>
      <p>Your official certificate is issued under MNCS with electronic signatures of:</p>
      <ul>
        <li>Jim Kalua — Chairman of the Council</li>
        <li>Ivy Chinangwa — Acting Chief Executive Officer</li>
        <li>Chifundo Tenthani — Chair, Organising Committee</li>
      </ul>
      <p>Please keep this email. A printable certificate is also available from the organisers.</p>
      <p>Regards,<br/>BT42.195 km Race 2026 · Malawi National Council of Sports</p>
    </div>`;

  // Resend API example — swap for SendGrid/Mailgun as needed
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html
      })
    });
    const body = await res.text();
    if (!res.ok) {
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: body }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, provider: 'resend' }) };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) })
    };
  }
};

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
