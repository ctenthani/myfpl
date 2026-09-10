/**
 * Public registration — writes to shared store (Blobs preferred, then JSONBin)
 * POST /.netlify/functions/register
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
  suppressedKeys: [],
  updatedAt: null,
  updatedBy: null
});

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

function json(status, body) {
  return { statusCode: status, headers: corsHeaders(), body: JSON.stringify(body) };
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

async function withBlobStore(fn) {
  const { getStore } = require('@netlify/blobs');
  const { siteID, token, ready } = blobsCredentials();
  const store = ready
    ? getStore({ name: STORE_NAME, siteID, token, consistency: 'strong' })
    : getStore({ name: STORE_NAME, consistency: 'strong' });
  return fn(store);
}

async function blobsRead() {
  return withBlobStore(async (store) => {
    const raw = await store.get(STATE_KEY, { type: 'json' });
    if (!raw || typeof raw !== 'object') return emptyState();
    return Object.assign(emptyState(), raw);
  });
}

async function blobsWrite(state) {
  return withBlobStore(async (store) => {
    await store.setJSON(STATE_KEY, state);
  });
}

function jsonbinConfigured() {
  return !!(envNonEmpty('JSONBIN_BIN_ID') && envNonEmpty('JSONBIN_API_KEY'));
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
  const res = await fetchWithTimeout(
    'https://api.jsonbin.io/v3/b/' + id + '/latest',
    { headers: { 'X-Master-Key': key } },
    8000
  );
  if (!res.ok) throw new Error('JSONBin read ' + res.status);
  const data = await res.json();
  return Object.assign(emptyState(), data.record || data || {});
}

async function jsonbinWrite(state) {
  const id = envNonEmpty('JSONBIN_BIN_ID');
  const key = envNonEmpty('JSONBIN_API_KEY');
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
    8000
  );
  if (!res.ok) throw new Error('JSONBin write ' + res.status);
}

function keyOf(r) {
  return (
    String(r.phone || '')
      .replace(/\s+/g, '')
      .toLowerCase() +
    '|' +
    String(r.fullName || '')
      .trim()
      .toLowerCase()
  );
}

function normalizeReg(body) {
  return {
    fullName: String(body.fullName || body.name || '').trim(),
    phone: String(body.phone || '').trim(),
    email: String(body.email || '').trim(),
    distance: String(body.distance || '').trim(),
    dob: String(body.dob || '').trim(),
    gender: String(body.gender || '').trim(),
    emergencyName: String(body.emergencyName || '').trim(),
    emergencyPhone: String(body.emergencyPhone || '').trim(),
    club: String(body.club || body.teamName || '').trim(),
    submittedAt: body.submittedAt || new Date().toISOString(),
    ageOnRaceDay: body.ageOnRaceDay != null ? body.ageOnRaceDay : null,
    feeMwk: body.feeMwk != null ? body.feeMwk : null,
    paymentRef: body.paymentRef ? String(body.paymentRef).trim() : '',
    paymentProof: (body.paymentProof && String(body.paymentProof).indexOf('data:') === 0)
      ? String(body.paymentProof).slice(0, 900000)
      : '',
    teamName: body.teamName ? String(body.teamName).trim() : '',
    teamId: body.teamId || '',
    regType: body.regType || 'individual',
    teamContactPhone: body.teamContactPhone || '',
    teamContactEmail: body.teamContactEmail || '',
    teamMemberIndex: body.teamMemberIndex || null,
    teamMemberCount: body.teamMemberCount || null,
    source: 'web-register'
  };
}

async function readState() {
  // Blobs only when credentials exist — do not wait on JSONBin (currently 522)
  if (blobsCredentials().ready) {
    return { state: await blobsRead(), backend: 'blobs' };
  }
  try {
    return { state: await blobsRead(), backend: 'blobs-auto' };
  } catch (e1) {
    if (jsonbinConfigured()) {
      try {
        return { state: await jsonbinRead(), backend: 'jsonbin' };
      } catch (e2) {
        throw new Error('No storage: blobs=' + (e1.message || e1) + ' jsonbin=' + (e2.message || e2));
      }
    }
    throw new Error('No storage backend: ' + (e1.message || e1));
  }
}

async function writeState(state) {
  if (blobsCredentials().ready) {
    await blobsWrite(state);
    return 'blobs';
  }
  try {
    await blobsWrite(state);
    return 'blobs-auto';
  } catch (e1) {
    if (jsonbinConfigured()) {
      await jsonbinWrite(state);
      return 'jsonbin';
    }
    throw e1;
  }
}


async function sendConfirmationEmail(reg) {
  const to = (reg.email || '').trim();
  if (!to) return;
  const apiKey = process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'BT42.195km Race <onboarding@resend.dev>';
  if (!apiKey) return;
  const name = reg.fullName || 'Athlete';
  const fee = reg.feeMwk != null ? '<p>Entry fee total: <strong>' + String(reg.feeMwk) + ' MWK</strong></p>' : '';
  const pop = reg.paymentRef ? '<p>Payment reference noted: <strong>' + String(reg.paymentRef).replace(/</g,'') + '</strong></p>' : '';
  let roster = '';
  if (Array.isArray(reg.teamMembersDetailed) && reg.teamMembersDetailed.length) {
    roster = '<p><strong>Team:</strong> ' + String(reg.teamName || '').replace(/</g,'') + '</p><p><strong>Members:</strong></p><ul>' +
      reg.teamMembersDetailed.map((m) => {
        const n = String(m.name || m.fullName || '').replace(/</g,'');
        const d = String(m.distance || '').replace(/</g,'');
        const f = m.feeMwk != null ? ' — ' + m.feeMwk + ' MWK' : '';
        return '<li>' + n + ' (' + d + ')' + f + '</li>';
      }).join('') + '</ul>';
  } else if (reg.distance) {
    roster = '<p>Distance: <strong>' + String(reg.distance).replace(/</g,'') + '</strong></p>';
  }
  const html = `<p>Dear ${String(name).replace(/</g,'')},</p>
<p>Thank you for registering for the <strong>BT42.195km Race</strong>.</p>
<p>Race day: <strong>27 September 2026</strong>, Blantyre.</p>
${roster}${fee}${pop}
<p>Your place is confirmed once payment is received:</p>
<ul>
<li>Bank transfer to account <strong>782637</strong></li>
<li>Reference: <strong>your full name + mobile number</strong> (one transfer can cover a whole team)</li>
</ul>
<p>You will receive <strong>one email per stage</strong> (payment verified, bibs) for the whole team. Certificates are issued per athlete after the race.</p>
<p>— Organising Committee, BT42.195km Race</p>`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: reg.teamName
          ? ('Team entry received — ' + String(reg.teamName) + ' — BT42.195km Race 2026')
          : 'Entry received — BT42.195km Race 2026',
        html
      })
    });
  } catch (e) { /* non-fatal */ }
}


function buildRegistrationsFromBody(body) {
  const base = {
    phone: body.phone || '',
    email: body.email || '',
    distance: body.distance || '',
    dob: body.dob || '',
    gender: body.gender || '',
    emergencyName: body.emergencyName || '',
    emergencyPhone: body.emergencyPhone || '',
    submittedAt: body.submittedAt || new Date().toISOString(),
    ageOnRaceDay: body.ageOnRaceDay,
    paymentRef: body.paymentRef || '',
    teamName: body.teamName || '',
    regType: body.regType || 'individual'
  };
  const proofOnce = (body.paymentProof && String(body.paymentProof).indexOf('data:') === 0)
    ? String(body.paymentProof).slice(0, 900000)
    : '';
  const detailed = Array.isArray(body.teamMembersDetailed) ? body.teamMembersDetailed : [];
  const members = Array.isArray(body.teamMembers)
    ? body.teamMembers.map((n) => String(n || '').trim()).filter(Boolean)
    : [];
  if (body.regType === 'team' && (detailed.length >= 2 || members.length >= 2)) {
    const teamId = 'team-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    const rows = detailed.length >= 2
      ? detailed
      : members.map((name) => ({ name: name, distance: body.distance, dob: body.dob, feeMwk: null, ageOnRaceDay: body.ageOnRaceDay }));
    return rows.map((m, i) => {
      const name = String(m.name || m.fullName || '').trim();
      const distance = String(m.distance || body.distance || '').trim();
      const dob = String(m.dob || '').trim();
      let age = m.ageOnRaceDay;
      if (dob && (age == null)) {
        const race = new Date('2026-09-27');
        const d0 = new Date(dob);
        age = race.getFullYear() - d0.getFullYear();
        const mm = race.getMonth() - d0.getMonth();
        if (mm < 0 || (mm === 0 && race.getDate() < d0.getDate())) age--;
      }
      const row = Object.assign({}, base, {
        fullName: name,
        distance: distance,
        dob: dob,
        ageOnRaceDay: age,
        feeMwk: m.feeMwk != null ? m.feeMwk : null,
        teamId: teamId,
        teamName: body.teamName || '',
        teamContactPhone: body.phone || '',
        teamContactEmail: body.email || '',
        paymentRef: body.paymentRef || '',
        regType: 'team',
        teamMemberIndex: i + 1,
        teamMemberCount: rows.length
      });
      // Attach slip image only once (first member) to avoid huge Blobs payloads
      if (i === 0 && proofOnce) row.paymentProof = proofOnce;
      return row;
    });
  }
  return [Object.assign({}, base, {
    fullName: body.fullName || body.name || '',
    feeMwk: body.feeMwk,
    regType: 'individual'
  })];
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method Not Allowed' });
  }

  if (process.env.REGISTRATION_ENABLED === 'false') {
    return json(403, { ok: false, error: 'Registration is closed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  const rawMembers = Array.isArray(body.teamMembers)
    ? body.teamMembers.map((n) => String(n || '').trim()).filter(Boolean)
    : [];
  const isTeam = body.regType === 'team' && (
    rawMembers.length >= 2 ||
    (Array.isArray(body.teamMembersDetailed) && body.teamMembersDetailed.length >= 2)
  );

  const hasTeamDetails = Array.isArray(body.teamMembersDetailed) && body.teamMembersDetailed.length >= 2;
  if (!body.phone) {
    return json(400, { ok: false, error: 'phone is required' });
  }
  if (!body.distance && !hasTeamDetails) {
    return json(400, { ok: false, error: 'phone and distance are required' });
  }
  if (!(body.email && String(body.email).trim() && String(body.email).indexOf('@') > 0)) {
    return json(400, { ok: false, error: 'Email is required so entrants receive confirmation, bib and certificate emails' });
  }
  if (body.regType !== 'team') {
    const nm = String(body.fullName || '').trim();
    if (nm.length < 3) {
      return json(400, { ok: false, error: 'Full name is required — this is the name printed on the certificate' });
    }
  }
  if (body.regType === 'team') {
    if (!(body.teamName && String(body.teamName).trim())) {
      return json(400, { ok: false, error: 'Team name is required' });
    }
  }
  // Ensure distance for downstream if only team details provided
  if (!body.distance && hasTeamDetails) {
    body.distance = body.teamMembersDetailed[0].distance || '10';
  }
  const popRef = String(body.paymentRef || '').trim();
  if (!popRef) {
    return json(400, {
      ok: false,
      error: 'Proof of payment is required: bank/SMS transaction ID or deposit reference'
    });
  }
  body.paymentRef = popRef;
  if (!isTeam && !(body.fullName || body.name)) {
    return json(400, { ok: false, error: 'fullName, phone and distance are required' });
  }
  if (isTeam && rawMembers.length < 2 && !(Array.isArray(body.teamMembersDetailed) && body.teamMembersDetailed.length >= 2)) {
    return json(400, { ok: false, error: 'Team registration needs at least 2 member names' });
  }

  if (isTeam && Array.isArray(body.teamMembersDetailed)) {
    for (const m of body.teamMembersDetailed) {
      if (String(m.distance || '') === '42.195') {
        const dob = m.dob ? new Date(m.dob) : null;
        if (!dob || isNaN(dob.getTime())) {
          return json(400, { ok: false, error: 'Marathon team members need a date of birth' });
        }
        const race = new Date('2026-09-27');
        let age = race.getFullYear() - dob.getFullYear();
        const mm = race.getMonth() - dob.getMonth();
        if (mm < 0 || (mm === 0 && race.getDate() < dob.getDate())) age--;
        if (age < 20) {
          return json(400, {
            ok: false,
            error: (m.name || 'A team member') + ' must be at least 20 on race day for the marathon'
          });
        }
      }
    }
  } else if (body.distance === '42.195' && body.dob) {
    const race = new Date('2026-09-27');
    const dob = new Date(body.dob);
    let age = race.getFullYear() - dob.getFullYear();
    const m = race.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && race.getDate() < dob.getDate())) age--;
    if (age < 20) {
      return json(400, {
        ok: false,
        error: 'Marathon entrants must be at least 20 years old on 27 September 2026'
      });
    }
    body.ageOnRaceDay = age;
  }

  const regs = buildRegistrationsFromBody(body).map(normalizeReg);

  try {
    const { state } = await readState();
    const list = Array.isArray(state.registrations) ? state.registrations.slice() : [];
    let added = 0;
    for (const reg of regs) {
      if (!reg.fullName || !reg.phone || !reg.distance) continue;
      const k = keyOf(reg);
      if ((state.suppressedKeys || []).includes(k)) {
        state.suppressedKeys = (state.suppressedKeys || []).filter((x) => x !== k);
      }
      const idx = list.findIndex((r) => keyOf(r) === k);
      if (idx >= 0) list[idx] = Object.assign({}, list[idx], reg);
      else {
        list.push(reg);
        added++;
      }
    }
    state.registrations = list;
    state.updatedAt = new Date().toISOString();
    state.updatedBy = isTeam ? 'register-team' : 'register';
    const backend = await writeState(state);

    // One confirmation email (team = full roster in a single message)
    try {
      await sendConfirmationEmail({
        fullName: isTeam
          ? (body.teamName ? String(body.teamName) + ' (team contact)' : 'Team contact')
          : (body.fullName || body.name || 'Athlete'),
        email: body.email,
        distance: body.distance,
        feeMwk: body.feeMwk,
        paymentRef: body.paymentRef,
        teamName: body.teamName || '',
        teamMembersDetailed: isTeam ? (body.teamMembersDetailed || regs.map((r) => ({
          name: r.fullName, distance: r.distance, feeMwk: r.feeMwk
        }))) : null
      });
    } catch (e) {}

    return json(200, {
      ok: true,
      backend,
      count: regs.length,
      message: isTeam
        ? ('Team registration saved (' + regs.length + ' runners)')
        : 'Registration saved to shared list'
    });
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    return json(500, {
      ok: false,
      error: 'Could not save registration',
      detail: msg,
      hint: /size|large|payload|body/i.test(msg)
        ? 'Try again without uploading a slip image — use the transaction ID only'
        : undefined
    });
  }
};
