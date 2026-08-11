/**
 * Matchday digest — works WITHOUT Netlify Blobs.
 *
 * Subscribers: set env MATCHDAY_EMAILS as comma-separated list, e.g.
 *   ctenthani@gmail.com,friend@gmail.com
 *
 * Optional Blobs still used if available (opt-in from Sign in).
 *
 * Schedule: hourly in netlify.toml — sends ~4h before GW deadline.
 * Manual: POST with x-digest-secret header.
 */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-digest-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json",
};

const WINDOW_MS = 35 * 60 * 1000;
const TARGET_BEFORE_MS = 4 * 60 * 60 * 1000;

function isSchedule(event) {
  if (event.headers && event.headers["x-netlify-event"] === "schedule") return true;
  if (event.isSchedule) return true;
  try {
    const body = JSON.parse(event.body || "{}");
    if (body.source === "schedule") return true;
  } catch (_) {}
  return false;
}

function emailsFromEnv() {
  const raw = process.env.MATCHDAY_EMAILS || "";
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

async function tryBlobEmails() {
  try {
    const { getStore } = require("@netlify/blobs");
    const subs = getStore("fpl-subs");
    const idx = (await subs.get("index:matchday", { type: "json" })) || {
      emails: [],
    };
    return idx.emails || [];
  } catch (_) {
    return [];
  }
}

async function tryBlobVotes(gw) {
  try {
    const { getStore } = require("@netlify/blobs");
    const votes = getStore("fpl-votes");
    return (await votes.get(`gw-${gw}`, { type: "json" })) || null;
  } catch (_) {
    return null;
  }
}

async function tryMarkSent(gw, payload) {
  try {
    const { getStore } = require("@netlify/blobs");
    const meta = getStore("fpl-digest-meta");
    await meta.setJSON(`sent-gw-${gw}`, payload);
    return true;
  } catch (_) {
    return false;
  }
}

async function tryAlreadySent(gw) {
  try {
    const { getStore } = require("@netlify/blobs");
    const meta = getStore("fpl-digest-meta");
    return (await meta.get(`sent-gw-${gw}`, { type: "json" })) || null;
  } catch (_) {
    return null;
  }
}

async function getNextDeadline() {
  const boot = await fetch(
    "https://fantasy.premierleague.com/api/bootstrap-static/",
    {
      headers: {
        "User-Agent": "FPL-Assistant-Digest/1.1",
        Accept: "application/json",
      },
    }
  ).then((r) => r.json());

  const events = boot.events || [];
  const next =
    events.find((e) => e.is_next) ||
    events.find((e) => e.is_current && !e.finished) ||
    events.find(
      (e) => e.deadline_time && new Date(e.deadline_time) > new Date()
    );

  if (!next || !next.deadline_time) return null;
  return {
    gw: next.id,
    name: next.name,
    deadline: new Date(next.deadline_time),
    elements: boot.elements || [],
  };
}

function buildEmail(gwInfo, topCaptain, topChip) {
  const site = process.env.SITE_URL || "https://myfpl.netlify.app";
  const dl = gwInfo.deadline.toUTCString();
  const subject = `GW${gwInfo.gw} deadline in ~4 hours · Captain: ${topCaptain}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <h2 style="margin-bottom:4px">Matchday reminder · GW${gwInfo.gw}</h2>
      <p style="color:#64748b;margin-top:0">${gwInfo.name || ""}</p>
      <p><strong>Deadline:</strong> ${dl}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0" />
      <p><strong>Captain poll leader:</strong> ${topCaptain}</p>
      <p><strong>Chip lean:</strong> ${topChip}</p>
      <p style="margin-top:20px">
        <a href="${site}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">
          Open FPL Assistant
        </a>
      </p>
      <p style="color:#64748b;font-size:12px;margin-top:24px">
        You receive this because your email is on the Matchday list.
      </p>
    </div>
  `;
  return { subject, html };
}

async function sendAll(emails, subject, html, apiKey, from) {
  const results = [];
  for (const email of emails) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: [email], subject, html }),
      });
      const text = await res.text();
      results.push({
        email,
        status: res.status,
        ok: res.ok,
        body: text.slice(0, 300),
      });
    } catch (e) {
      results.push({ email, ok: false, error: String(e) });
    }
  }
  return results;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  const scheduled = isSchedule(event);
  const method = event.httpMethod || "POST";

  if (!scheduled) {
    if (method !== "POST" && method !== "GET") {
      return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
    }
    const secret = process.env.DIGEST_SECRET || "";
    const provided =
      event.headers["x-digest-secret"] ||
      event.headers["X-Digest-Secret"] ||
      (event.queryStringParameters && event.queryStringParameters.secret) ||
      "";
    if (!secret || provided !== secret) {
      return {
        statusCode: 401,
        headers: cors,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }
  }

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch (_) {}
  const dryRun = !!body.dryRun;
  const force = !!body.force;

  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.FROM_EMAIL || "FPL Assistant <onboarding@resend.dev>";

  try {
    const gwInfo = await getNextDeadline();
    if (!gwInfo) {
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({
          ok: true,
          skipped: true,
          reason: "no upcoming deadline",
        }),
      };
    }

    const now = Date.now();
    const msToDeadline = gwInfo.deadline.getTime() - now;
    const inWindow =
      msToDeadline > 0 &&
      msToDeadline <= TARGET_BEFORE_MS + WINDOW_MS &&
      msToDeadline >= TARGET_BEFORE_MS - WINDOW_MS;
    const shouldSend = force || inWindow;

    const already = force ? null : await tryAlreadySent(gwInfo.gw);
    if (already && already.sentAt) {
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({
          ok: true,
          skipped: true,
          reason: "already sent for this GW",
          gw: gwInfo.gw,
          sentAt: already.sentAt,
          hoursToDeadline: +(msToDeadline / 3600000).toFixed(2),
        }),
      };
    }

    if (!shouldSend) {
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({
          ok: true,
          skipped: true,
          reason: "outside 4-hour-before-deadline window",
          gw: gwInfo.gw,
          deadline: gwInfo.deadline.toISOString(),
          hoursToDeadline: +(msToDeadline / 3600000).toFixed(2),
          targetHoursBefore: 4,
        }),
      };
    }

    const envEmails = emailsFromEnv();
    const blobEmails = await tryBlobEmails();
    const emails = [...new Set([...envEmails, ...blobEmails])];

    let topCaptain = "TBD";
    let topChip = "Hold chips";
    const voteData = await tryBlobVotes(gwInfo.gw);
    if (voteData) {
      const cap = voteData.captain || {};
      const chip = voteData.chip || {};
      const topC = Object.entries(cap).sort((a, b) => b[1] - a[1])[0];
      const topCh = Object.entries(chip).sort((a, b) => b[1] - a[1])[0];
      if (topC) {
        const el = gwInfo.elements.find((e) => String(e.id) === String(topC[0]));
        topCaptain = el ? el.web_name : `Player ${topC[0]}`;
      }
      if (topCh) {
        const labels = {
          tc: "Triple Captain",
          bb: "Bench Boost",
          fh: "Free Hit",
          wc: "Wildcard",
          none: "Hold chips",
        };
        topChip = labels[topCh[0]] || topCh[0];
      }
    }

    const { subject, html } = buildEmail(gwInfo, topCaptain, topChip);

    if (dryRun || !apiKey) {
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({
          ok: true,
          dryRun: true,
          wouldSend: emails.length,
          recipients: emails,
          subject,
          topCaptain,
          topChip,
          gw: gwInfo.gw,
          deadline: gwInfo.deadline.toISOString(),
          missingApiKey: !apiKey,
          note: emails.length
            ? "OK"
            : "Add MATCHDAY_EMAILS env var (comma-separated emails)",
        }),
      };
    }

    if (!emails.length) {
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({
          ok: true,
          sent: 0,
          reason: "no subscribers — set MATCHDAY_EMAILS in Netlify env",
          gw: gwInfo.gw,
        }),
      };
    }

    const results = await sendAll(emails, subject, html, apiKey, from);
    const sent = results.filter((r) => r.ok).length;

    await tryMarkSent(gwInfo.gw, {
      sentAt: new Date().toISOString(),
      recipients: sent,
      subject,
    });

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        ok: true,
        gw: gwInfo.gw,
        deadline: gwInfo.deadline.toISOString(),
        sent,
        results,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: String(err), stack: String(err.stack || "") }),
    };
  }
};
