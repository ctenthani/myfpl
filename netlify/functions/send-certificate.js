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

function pickSigs(src, out) {
  const sigs = src && typeof src === 'object' ? src : {};
  ['kalua', 'chamwala', 'tenthani'].forEach((k) => {
    const v = sigs[k] || (k === 'chamwala' ? sigs.chinangwa : '');
    if (typeof v === 'string' && v.indexOf('data:image') === 0) out[k] = v;
  });
}

async function loadStoredSignatures() {
  const out = { kalua: '', chamwala: '', tenthani: '' };
  const tryBlobs = async () => {
    const { getStore } = require('@netlify/blobs');
    const siteID = envNonEmpty('NETLIFY_SITE_ID') || envNonEmpty('SITE_ID');
    const token = envNonEmpty('NETLIFY_BLOBS_TOKEN') || envNonEmpty('NETLIFY_AUTH_TOKEN');
    const store = (siteID && token)
      ? getStore({ name: 'bt42-oc-sync', siteID, token, consistency: 'strong' })
      : getStore({ name: 'bt42-oc-sync', consistency: 'strong' });
    try {
      const dedicated = await store.get('signatures', { type: 'json' });
      pickSigs(dedicated, out);
    } catch (e) { /* ignore */ }
    if (!out.kalua && !out.chamwala && !out.tenthani) {
      const raw = await store.get('state', { type: 'json' });
      pickSigs(raw && raw.signatures, out);
    }
  };
  try {
    await tryBlobs();
    if (out.kalua || out.chamwala || out.tenthani) return out;
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

  const title = opts.volunteer
    ? 'CERTIFICATE OF VOLUNTEER SERVICE'
    : (opts.isCompletion ? 'CERTIFICATE OF COMPLETION' : 'CERTIFICATE OF PARTICIPATION');
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
  const body = opts.volunteer
    ? ('served as a volunteer (' + distance + ') at the BT42.195km Race 2026, organised under the auspices of the Malawi National Council of Sports.')
    : opts.isCompletion
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

  const foot = opts.volunteer
    ? 'Official certificate · MNCS · Athletics Malawi · BT42.195km Race 2026 · Volunteer service'
    : opts.isCompletion
    ? 'Official certificate · MNCS · Athletics Malawi · BT42.195km Race 2026 · Completion certificate issued after verified finish'
    : 'Official certificate · MNCS · Athletics Malawi · BT42.195km Race 2026 · Participation certificate';
  drawCentered(foot, 42, 8, font, muted);

  return Buffer.from(await doc.save()).toString('base64');
}

async function embedDataImage(doc, dataUrl) {
  if (!dataUrl || dataUrl.indexOf('data:image') !== 0) return null;
  const m = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!m) return null;
  const bytes = Buffer.from(m[2], 'base64');
  try {
    if (m[1].toLowerCase() === 'png') return await doc.embedPng(bytes);
    return await doc.embedJpg(bytes);
  } catch (e) {
    try { return await doc.embedJpg(bytes); } catch (e2) { return null; }
  }
}

async function buildVolunteerAppreciationPdf(opts) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const green = rgb(0.047, 0.396, 0.208);
  const darkGreen = rgb(0.02, 0.28, 0.14);
  const black = rgb(0.08, 0.08, 0.08);
  const muted = rgb(0.25, 0.35, 0.28);
  const gold = rgb(0.75, 0.58, 0.12);
  const red = rgb(0.75, 0.12, 0.12);

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: 0, width: 118, height, color: green });
  page.drawRectangle({ x: width - 36, y: 0, width: 36, height, color: rgb(0.95, 0.95, 0.95) });
  page.drawRectangle({ x: width - 28, y: 0, width: 14, height, color: red });
  page.drawRectangle({ x: width - 14, y: 0, width: 14, height, color: rgb(0.08, 0.08, 0.08) });
  page.drawRectangle({ x: 118, y: height - 18, width: width - 118, height: 18, color: green });

  try {
    const bytes = await fetchLogoBytes('/assets/mncs-logo.png');
    if (bytes) {
      let img = null;
      try { img = await doc.embedPng(bytes); } catch (e) { try { img = await doc.embedJpg(bytes); } catch (e2) {} }
      if (img) {
        const w = 78;
        const h = Math.min(78, (img.height / img.width) * w);
        page.drawImage(img, { x: 20, y: height - 110, width: w, height: h });
      }
    }
  } catch (e) { /* logo optional */ }

  page.drawText('MALAWI', { x: 22, y: 88, size: 11, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('SPORT', { x: 22, y: 74, size: 11, font: fontBold, color: rgb(0.85, 0.95, 0.4) });
  page.drawText('BT42.195km', { x: 18, y: 42, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('RACE 2026', { x: 18, y: 30, size: 9, font: fontBold, color: rgb(1, 1, 1) });

  const cx = (width + 118) / 2;
  const drawC = (text, y, size, fnt, color) => {
    const t = String(text || '');
    const w = fnt.widthOfTextAtSize(t, size);
    page.drawText(t, { x: cx - w / 2, y, size, font: fnt, color });
  };

  drawC('CERTIFICATE', height - 92, 32, fontBold, green);
  drawC('OF APPRECIATION', height - 128, 22, fontBold, green);
  drawC('This certificate is presented to', height - 168, 13, font, muted);

  const name = String(opts.fullName || 'Volunteer').slice(0, 80);
  const nameSize = name.length > 28 ? 22 : 28;
  drawC(name, height - 214, nameSize, fontBold, black);

  const role = String(opts.distance || opts.role || 'Race volunteer');
  const body1 = 'in appreciation for dedicated volunteerism and service';
  const body2 = 'to the Malawi National Council of Sports';
  const body3 = '(BT42.195km Race 2026 · Blantyre · 27 September 2026)';
  const body4 = role ? ('Crew role: ' + role) : '';
  drawC(body1, height - 258, 13, font, black);
  drawC(body2, height - 276, 13, font, black);
  drawC(body3, height - 296, 12, fontBold, darkGreen);
  if (body4) drawC(body4, height - 316, 11, font, muted);

  page.drawCircle({ x: width - 118, y: height - 168, size: 36, color: gold, borderColor: rgb(0.55, 0.4, 0.05), borderWidth: 2 });
  page.drawText('8TH', { x: width - 132, y: height - 162, size: 10, font: fontBold, color: rgb(0.25, 0.16, 0) });
  page.drawText('EDITION', { x: width - 140, y: height - 174, size: 8, font: fontBold, color: rgb(0.25, 0.16, 0) });

  const sigs = opts.signatures || {};
  const people = [
    { key: 'tenthani', name: 'Chifundo Tenthani', title: 'Chairperson — BT42.195km Race' },
    { key: 'chamwala', name: 'Kondwani Chamwala', title: 'President — Athletics Malawi' },
    { key: 'kalua', name: 'Jim Kalua', title: 'Chairman — MNCS' }
  ];
  const colW = 175;
  const startX = 150;
  const sigY = 78;
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    const x = startX + i * (colW + 18);
    const img = await embedDataImage(doc, sigs[p.key]);
    if (img) {
      const maxW = 150, maxH = 40;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const iw = img.width * scale, ih = img.height * scale;
      page.drawImage(img, { x: x + (colW - iw) / 2, y: sigY + 36, width: iw, height: ih });
    }
    page.drawLine({ start: { x: x + 8, y: sigY + 30 }, end: { x: x + colW - 8, y: sigY + 30 }, thickness: 0.8, color: green });
    const nw = fontBold.widthOfTextAtSize(p.name, 9);
    page.drawText(p.name, { x: x + (colW - nw) / 2, y: sigY + 16, size: 9, font: fontBold, color: black });
    const tw = font.widthOfTextAtSize(p.title, 7);
    page.drawText(p.title, { x: x + (colW - tw) / 2, y: sigY + 4, size: 7, font, color: muted });
  }

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
  if (type === 'volunteer_certificate') type = 'volunteer';
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
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/i.test(to) || /gamil\.com|gmial\.com|gnail\.com|gmail\.con|gmail\.cm|gmail\.co$/i.test(to)) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false, skipped: true, error: 'Invalid recipient email — not sent' }) };
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
<li>Bank transfer to National Bank of Malawi account <strong>782637</strong></li>
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
  } else if (type === 'volunteer') {
    const role = body.role || body.distance || 'Race volunteer';
    subject = body.subject || 'Certificate of Appreciation — BT42.195km Race 2026';
    html = body.html || `<p>Dear ${esc(fullName)},</p>
<p>Thank you for serving as a volunteer at the <strong>BT42.195km Race 2026</strong>.</p>
<p>Role: <strong>${esc(role)}</strong></p>
<p>Your official certificate of volunteer service is attached as a PDF.</p>
<p>Race day: <strong>${esc(raceDate)}</strong> · Blantyre</p>
<p>— Organising Committee, BT42.195km Race</p>`;
    try {
      let pdfB64 = '';
      if (typeof body.pdfBase64 === 'string' && body.pdfBase64.length > 80) {
        pdfB64 = body.pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      } else {
      const storedSigs = await loadStoredSignatures();
      pdfB64 = await buildCertificatePdf({
        fullName,
        distance: role,
        finishTime: '',
        reason: 'Volunteer service',
        isCompletion: false,
        volunteer: true,
        phone: body.phone || '',
        email: to,
        certId: body.certId || '',
        issued: body.issued || '',
        signatures: mergeSigPayload(body.signatures || {}, storedSigs)
      });
      }
      attachments.push({
        filename: 'BT42-Volunteer-Certificate.pdf',
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
