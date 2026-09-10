/**
 * Email helper — confirmation, payment, bib, certificates (PDF with MNCS logo)
 */
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


function envNonEmpty(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : '';
}

async function loadStoredSignatures() {
  const out = { kalua: '', chamwala: '', tenthani: '' };
  try {
    const siteID = envNonEmpty('NETLIFY_SITE_ID') || envNonEmpty('SITE_ID');
    const token = envNonEmpty('NETLIFY_BLOBS_TOKEN') || envNonEmpty('NETLIFY_AUTH_TOKEN');
    if (siteID && token) {
      const { getStore } = require('@netlify/blobs');
      const store = getStore({ name: 'bt42-oc-sync', siteID, token, consistency: 'strong' });
      const raw = await store.get('state', { type: 'json' });
      const sigs = raw && raw.signatures ? raw.signatures : {};
      ['kalua', 'chamwala', 'tenthani'].forEach((k) => {
        const v = sigs[k] || (k === 'chamwala' ? sigs.chinangwa : '');
        if (typeof v === 'string' && v.indexOf('data:image') === 0) out[k] = v;
      });
      return out;
    }
  } catch (e) { /* ignore */ }
  try {
    const bin = envNonEmpty('JSONBIN_BIN_ID');
    const key = envNonEmpty('JSONBIN_API_KEY');
    if (bin && key) {
      const res = await fetch('https://api.jsonbin.io/v3/b/' + bin + '/latest', {
        headers: { 'X-Master-Key': key }
      });
      if (res.ok) {
        const j = await res.json();
        const sigs = (j.record && j.record.signatures) || {};
        ['kalua', 'chamwala', 'tenthani'].forEach((k) => {
          const v = sigs[k] || (k === 'chamwala' ? sigs.chinangwa : '');
          if (typeof v === 'string' && v.indexOf('data:image') === 0) out[k] = v;
        });
      }
    }
  } catch (e) { /* ignore */ }
  return out;
}

function mergeSigPayload(fromBody, fromStore) {
  const keys = ['kalua', 'chamwala', 'tenthani'];
  const out = {};
  keys.forEach((k) => {
    const a = fromBody && fromBody[k];
    const b = fromStore && fromStore[k];
    out[k] = (typeof a === 'string' && a.indexOf('data:image') === 0) ? a
      : (typeof b === 'string' && b.indexOf('data:image') === 0) ? b
      : '';
  });
  return out;
}

async function fetchLogoBytes(path) {
  const base = [
    process.env.URL ? process.env.URL.replace(/\/$/, '') : null,
    process.env.DEPLOY_PRIME_URL ? process.env.DEPLOY_PRIME_URL.replace(/\/$/, '') : null,
    'https://btrace.netlify.app'
  ].filter(Boolean);
  for (const b of base) {
    try {
      const res = await fetch(b + path);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch (e) { /* try next */ }
  }
  return null;
}

async function buildCertificatePdf(opts) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]); // A4 landscape
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const { width, height } = page.getSize();

  const navy = rgb(0.106, 0.31, 0.447);
  const gold = rgb(0.490, 0.400, 0.031);
  const dark = rgb(0.12, 0.12, 0.12);
  const muted = rgb(0.35, 0.35, 0.35);
  const green = rgb(0.831, 0.675, 0.051);

  const drawCentered = (text, y, size, fnt, color) => {
    const t = String(text || '');
    const w = fnt.widthOfTextAtSize(t, size);
    page.drawText(t, { x: Math.max(48, (width - w) / 2), y, size, font: fnt, color });
  };

  const wrapCentered = (text, y, size, fnt, color, maxW) => {
    const words = String(text || '').split(/\s+/);
    let line = '';
    let cy = y;
    const lines = [];
    words.forEach((w) => {
      const trial = line ? line + ' ' + w : w;
      if (fnt.widthOfTextAtSize(trial, size) > maxW && line) {
        lines.push(line);
        line = w;
      } else line = trial;
    });
    if (line) lines.push(line);
    lines.forEach((ln) => {
      drawCentered(ln, cy, size, fnt, color);
      cy -= size + 5;
    });
    return cy;
  };

  // Full-page double frame (navy + gold) matching Control Room print
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderColor: navy, borderWidth: 8 });
  page.drawRectangle({ x: 28, y: 28, width: width - 56, height: height - 56, borderColor: green, borderWidth: 1.6 });

  // Logos
  try {
    const embedOne = async (path) => {
      const bytes = await fetchLogoBytes(path);
      if (!bytes) return null;
      try { return await doc.embedPng(bytes); } catch (e) {
        try { return await doc.embedJpg(bytes); } catch (e2) { return null; }
      }
    };
    const am = await embedOne('/assets/am-logo.png');
    const mncs = await embedOne('/assets/mncs-logo.png');
    const lw = 78;
    if (am) {
      const lh = Math.min(78, (am.height / am.width) * lw);
      page.drawImage(am, { x: 48, y: height - 118, width: lw, height: lh });
    }
    if (mncs) {
      const lh = Math.min(78, (mncs.height / mncs.width) * lw);
      page.drawImage(mncs, { x: width - 48 - lw, y: height - 118, width: lw, height: lh });
    }
  } catch (e) { /* logos optional */ }

  drawCentered('MALAWI NATIONAL COUNCIL OF SPORTS  ·  ATHLETICS MALAWI', height - 78, 11, fontBold, navy);
  drawCentered('BT42.195km Race 2026', height - 98, 18, fontBold, navy);
  drawCentered('Blantyre · Sunday, 27 September 2026', height - 118, 11, font, muted);

  const title = opts.isCompletion ? 'CERTIFICATE OF COMPLETION' : 'CERTIFICATE OF PARTICIPATION';
  drawCentered(title, height - 168, 26, fontBold, gold);
  drawCentered('This is to certify that', height - 200, 13, font, dark);

  const name = String(opts.fullName || 'Athlete').slice(0, 80);
  const nameSize = name.length > 32 ? 22 : 28;
  drawCentered(name, height - 242, nameSize, fontBold, dark);
  const nameW = Math.min(520, fontBold.widthOfTextAtSize(name, nameSize) + 40);
  page.drawLine({
    start: { x: (width - nameW) / 2, y: height - 250 },
    end: { x: (width + nameW) / 2, y: height - 250 },
    thickness: 0.8,
    color: rgb(0.75, 0.75, 0.75)
  });

  const distance = String(opts.distance || 'race');
  const finishTime = opts.finishTime ? String(opts.finishTime) : '';
  const body = opts.isCompletion
    ? ('has successfully completed the ' + distance + ' of the BT42.195km Race 2026' +
       (finishTime ? ' in a time of ' + finishTime : '') +
       ', organised under the auspices of the Malawi National Council of Sports.')
    : ('is a registered participant in the ' + distance +
       ' of the BT42.195km Race 2026, organised under the auspices of the Malawi National Council of Sports.');
  wrapCentered(body, height - 280, 12, font, dark, 640);

  const phone = String(opts.phone || '').replace(/[^\d+]/g, '');
  const email = String(opts.email || '');
  const certId = String(opts.certId || ((opts.isCompletion ? 'BT42-FIN-' : 'BT42-PART-') + Date.now().toString(36).toUpperCase()));
  const issued = String(opts.issued || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
  const meta = 'Certificate ID: ' + certId + '  ·  Issued: ' + issued +
    (phone ? '  ·  Tel: ' + phone : '') + (email ? '  ·  ' + email : '');
  drawCentered(meta, 168, 9, font, muted);

  // Signatures — three columns filling lower third
  const sigY = 88;
  const col = [70, 321, 572];
  const colW = 200;
  const peopleFull = [
    ['Jim Kalua', 'Chairman of the Council', 'Malawi National Council of Sports', 'kalua'],
    ['Kondwani Chamwala', 'President of Athletics Malawi', 'Athletics Malawi', 'chamwala'],
    ['Chifundo Tenthani', 'Chair, Organising Committee', 'BT42.195km Race 2026', 'tenthani']
  ];
  const sigImages = opts.signatures || {};
  for (let i = 0; i < peopleFull.length; i++) {
    const p = peopleFull[i];
    const dataUrl = sigImages[p[3]];
    if (dataUrl && typeof dataUrl === 'string' && dataUrl.indexOf('data:image') === 0) {
      try {
        const b64 = dataUrl.split(',')[1];
        const bytes = Buffer.from(b64, 'base64');
        let img = null;
        try { img = await doc.embedPng(bytes); } catch (e1) {
          try { img = await doc.embedJpg(bytes); } catch (e2) { img = null; }
        }
        if (img) {
          const maxW = 150;
          const maxH = 42;
          let iw = img.width;
          let ih = img.height;
          const scale = Math.min(maxW / iw, maxH / ih, 1);
          iw *= scale;
          ih *= scale;
          page.drawImage(img, {
            x: col[i] + (colW - iw) / 2,
            y: sigY + 38,
            width: iw,
            height: ih
          });
        }
      } catch (e) { /* skip bad image */ }
    }
    page.drawLine({
      start: { x: col[i] + 10, y: sigY + 34 },
      end: { x: col[i] + colW - 10, y: sigY + 34 },
      thickness: 0.9,
      color: dark
    });
    const nameW2 = fontBold.widthOfTextAtSize(p[0], 11);
    page.drawText(p[0], { x: col[i] + (colW - nameW2) / 2, y: sigY + 18, size: 11, font: fontBold, color: dark });
    const t1w = font.widthOfTextAtSize(p[1], 8);
    page.drawText(p[1], { x: col[i] + (colW - t1w) / 2, y: sigY + 6, size: 8, font, color: muted });
    const t2w = font.widthOfTextAtSize(p[2], 8);
    page.drawText(p[2], { x: col[i] + (colW - t2w) / 2, y: sigY - 6, size: 8, font, color: muted });
  }

  const foot = opts.isCompletion
    ? 'Official certificate · MNCS · Athletics Malawi · BT42.195km Race 2026 · Completion certificate issued after verified finish'
    : 'Official certificate · MNCS · Athletics Malawi · BT42.195km Race 2026 · Participation certificate';
  drawCentered(foot, 42, 8, font, muted);

  return Buffer.from(await doc.save()).toString('base64');
}

const recentSends = {};
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
  }

  const apiKey = process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'BT42.195km Race <onboarding@resend.dev>';
  if (!apiKey) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: false, skipped: true, error: 'EMAIL_API_KEY not configured' })
    };
  }

  let type = body.type || 'certificate';
  if (type === 'bib_assigned') type = 'bib';
  if (type === 'payment_verified') type = 'payment';
  if (type === 'participation_certificate') type = 'participation';
  if (type === 'completion_certificate') type = 'completion';
  const to = (body.to || body.email || '').trim();
  const fullName = body.fullName || 'Athlete';
  const distance = body.distance || '';
  const bib = body.bib || '';
  const raceDate = body.raceDate || '27 September 2026';
  const finishTime = body.finishTime || '';
  const reason = body.reason || '';

  if (!to) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: 'Recipient email required' }) };
  }
  const dedupeKey = [type, to.toLowerCase(), body.bib || '', body.subject || '', body.fullName || ''].join('|');
  const now = Date.now();
  if (recentSends[dedupeKey] && now - recentSends[dedupeKey] < 20000) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, skipped: true, deduped: true }) };
  }
  recentSends[dedupeKey] = now;

  let subject = 'BT42.195km Race 2026';
  let html = '';
  let attachments = [];

  if (type === 'confirmation') {
    subject = 'Entry received — BT42.195km Race 2026';
    html = `<p>Dear ${esc(fullName)},</p>
<p>Thank you for registering for the <strong>BT42.195km Race</strong> (${esc(distance)}).</p>
<p>Race day: <strong>${esc(raceDate)}</strong>, Blantyre.</p>
<p>Your place is confirmed once payment is received:</p>
<ul>
<li>Bank transfer to account <strong>782637</strong></li>
<li>Reference: <strong>your full name + mobile number</strong></li>
</ul>
<p>You will receive further email when payment is verified and when your bib is assigned.</p>
<p>— Organising Committee, BT42.195km Race</p>`;
  } else if (type === 'bib') {
    subject = body.subject || 'Bib number assigned — BT42.195km Race 2026';
    html = body.html || `<p>Dear ${esc(fullName)},</p>
<p>Your entry for the <strong>BT42.195km Race</strong> (${esc(distance)}) is confirmed.</p>
<p>Your <strong>bib number is ${esc(String(bib))}</strong>.</p>
<p>Race day: <strong>${esc(raceDate)}</strong>.</p>
<p>— Organising Committee, BT42.195km Race</p>`;
  } else if (type === 'payment') {
    subject = body.subject || 'Payment verified — BT42.195km Race 2026';
    html = body.html || `<p>Dear ${esc(fullName)},</p>
<p>We have verified your payment for the <strong>BT42.195km Race</strong> (${esc(distance)}).</p>
<p>Your bib number will be assigned next; watch for another email.</p>
<p>— Organising Committee, BT42.195km Race</p>`;
  } else if (type === 'completion' || type === 'participation' || type === 'certificate' || type === 'completion_certificate') {
    const asCompletion =
      type === 'completion' ||
      type === 'completion_certificate' ||
      !!finishTime ||
      (body.subject || '').toLowerCase().includes('completion');
    const finalCompletion = asCompletion && !(reason && /dnf/i.test(reason));

    subject =
      body.subject ||
      (finalCompletion
        ? 'Certificate of Completion — BT42.195km Race 2026'
        : 'Certificate of Participation — BT42.195km Race 2026');

    html = finalCompletion
      ? `<p>Dear ${esc(fullName)},</p><p>Congratulations on completing the <strong>${esc(distance)}</strong>. Your official certificate is attached as a PDF.</p><p>— Organising Committee, BT42.195km Race</p>`
      : `<p>Dear ${esc(fullName)},</p><p>Thank you for taking part in the <strong>${esc(distance)}</strong>. Your certificate of participation is attached as a PDF.</p><p>— Organising Committee, BT42.195km Race</p>`;

    try {
      const pdfB64 = await buildCertificatePdf({
        fullName,
        distance,
        finishTime,
        reason,
        isCompletion: finalCompletion,
        phone: body.phone || '',
        email: to,
        certId: body.certId || '',
        issued: body.issued || '',
        signatures: mergeSigPayload(body.signatures || {}, await loadStoredSignatures())
      });
      attachments.push({
        filename: finalCompletion
          ? 'BT42-Completion-Certificate.pdf'
          : 'BT42-Participation-Certificate.pdf',
        content: pdfB64
      });
    } catch (e) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: false, error: 'PDF generation failed: ' + (e.message || e) })
      };
    }
  } else {
    html = body.html || `<p>Dear ${esc(fullName)},</p><p>Message from BT42.195km Race.</p>`;
  }

  try {
    const payload = { from, to: [to], subject, html };
    if (attachments.length) payload.attachments = attachments;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: false, error: data.message || 'Email provider error', detail: data })
      };
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, provider: 'resend', id: data.id, pdf: attachments.length > 0 })
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: false, error: err.message || String(err) })
    };
  }
};
