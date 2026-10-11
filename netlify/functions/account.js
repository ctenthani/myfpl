const crypto = require('node:crypto');
const core = require('./lib/account-core');
exports.handler = async event => {
  try {
    if (!core.sameOrigin(event)) return core.response(403, { error: 'Use the MyFPL app to sign in.' });
    let s;
    if (event.httpMethod === 'GET') {
      const account = core.session(event);
      if (!account) return core.response(200, { signedIn: false, promotion: Date.now() < core.LAUNCH });
      s = core.store();
      const saved = await s.get('user:' + account.sub, { type: 'json' });
      if (!saved) return core.response(200, { signedIn: false });
      const { entitlement } = require('./lib/paypal-core');
      const access = await entitlement(account.sub, s);
      return core.response(200, { signedIn: true, owner: !!process.env.OWNER_EMAIL && saved.email === process.env.OWNER_EMAIL.trim().toLowerCase(), email: saved.email, teamId: saved.teamId, plan: access.plan, paidUntil: access.until || null, promotion: Date.now() < core.LAUNCH });
    }
    if (event.httpMethod !== 'POST') return core.response(405, { error: 'Method not allowed.' });
    const b = core.body(event);
    if (b.action === 'logout') return core.response(200, { ok: true }, { 'Set-Cookie': core.cookie('') });
    s = core.store();
    if (b.action === 'request') {
      const email = String(b.email || '').trim().toLowerCase();
      const teamId = Number(b.teamId);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120 || !Number.isSafeInteger(teamId) || teamId <= 0 || teamId > 100000000) return core.response(400, { error: 'Enter a valid email and FPL Team ID.' });
      if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) return core.response(503, { error: 'Email sign-in is being configured. You can use the free preview meanwhile.' });
      const bucket = Math.floor(Date.now() / 300000);
      const rate = await s.setJSON('rate:' + core.userId(email) + ':' + bucket, { requested: Date.now() }, { onlyIfNew: true });
      if (!rate.modified) return core.response(429, { error: 'Please wait five minutes before requesting another code.' });
      const challenge = crypto.randomBytes(24).toString('hex');
      const code = String(crypto.randomInt(100000, 1000000));
      await s.setJSON('challenge:' + challenge, { email, teamId, digest: core.sign(challenge + ':' + code), expires: Date.now() + 600000, attempts: 0, used: false });
      const sent = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.FROM_EMAIL, to: [email], subject: 'Your MyFPL sign-in code', text: `Your MyFPL code is ${code}. It expires in 10 minutes. This email verifies your MyFPL account only; never share your official FPL password. If you did not request this code, ignore this email.` }), signal: AbortSignal.timeout(12000) });
      if (!sent.ok) throw Object.assign(new Error('The sign-in email could not be delivered. Please try later.'), { status: 503 });
      return core.response(200, { challenge, message: 'Check your email for a six-digit code.' });
    }
    if (b.action === 'verify') {
      if (!/^[a-f0-9]{48}$/.test(b.challenge || '') || !/^\d{6}$/.test(b.code || '')) return core.response(400, { error: 'Enter the six-digit code from your email.' });
      const stored = await s.getWithMetadata('challenge:' + b.challenge, { type: 'json' });
      const row = stored?.data;
      if (!row || row.used || row.expires <= Date.now() || row.attempts >= 5) return core.response(401, { error: 'Code expired or already used. Request a new code.' });
      const valid = core.sign(b.challenge + ':' + b.code) === row.digest;
      const changed = await s.setJSON('challenge:' + b.challenge, { ...row, attempts: row.attempts + 1, used: valid }, { onlyIfMatch: stored.etag });
      if (!changed.modified) return core.response(409, { error: 'This code is being checked. Try again.' });
      if (!valid) return core.response(401, { error: 'Incorrect code.' });
      const id = core.userId(row.email);
      const prev = await s.get('user:' + id, { type: 'json' });
      await s.setJSON('user:' + id, { ...prev, email: row.email, teamId: row.teamId, verifiedAt: new Date().toISOString() });
      return core.response(200, { ok: true, email: row.email, teamId: row.teamId }, { 'Set-Cookie': core.cookie(core.token(row.email, row.teamId)) });
    }
    return core.response(400, { error: 'Unknown account action.' });
  } catch (error) { return core.response(error.status || 503, { error: error.status ? error.message : 'Account service is temporarily unavailable. Try again shortly.' }); }
};
