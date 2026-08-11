/**
 * Matchday digest (no Blobs required).
 * Env: DIGEST_SECRET, RESEND_API_KEY, MATCHDAY_EMAILS, FROM_EMAIL, SITE_URL
 * POST JSON: { "force": true, "dryRun": true }
 */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-digest-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json",
};

const WINDOW_MS = 40 * 60 * 1000;
const TARGET_BEFORE_MS = 4 * 60 * 60 * 1000;

function ok(body, code) {
  return {
    statusCode: code || 200,
    headers: cors,
    body: JSON.stringify(body),
  };
}

function getEmails() {
  return String(process.env.MATCHDAY_EMAILS || "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: cors, body: "" };
    }

    const secret = process.env.DIGEST_SECRET || "";
    const provided =
      (event.headers &&
        (event.headers["x-digest-secret"] ||
          event.headers["X-Digest-Secret"])) ||
      (event.queryStringParameters && event.queryStringParameters.secret) ||
      "";

    // Allow schedule invocations without secret
    const isSched =
      (event.headers && event.headers["x-netlify-event"] === "schedule") ||
      event.isSchedule;

    if (!isSched && (!secret || provided !== secret)) {
      return ok({ error: "Unauthorized", hint: "x-digest-secret must match DIGEST_SECRET" }, 401);
    }

    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (_) {}
    const dryRun = !!body.dryRun;
    const force = !!body.force;

    const bootRes = await fetch(
      "https://fantasy.premierleague.com/api/bootstrap-static/",
      {
        headers: {
          "User-Agent": "FPL-Assistant-Digest/2.0",
          Accept: "application/json",
        },
      }
    );
    if (!bootRes.ok) {
      return ok({ error: "FPL API failed", status: bootRes.status }, 502);
    }
    const boot = await bootRes.json();
    const events = boot.events || [];
    const next =
      events.find((e) => e.is_next) ||
      events.find((e) => e.is_current && !e.finished) ||
      events.find(
        (e) => e.deadline_time && new Date(e.deadline_time) > new Date()
      );

    if (!next || !next.deadline_time) {
      return ok({ ok: true, skipped: true, reason: "no upcoming deadline" });
    }

    const deadline = new Date(next.deadline_time);
    const msToDeadline = deadline.getTime() - Date.now();
    const inWindow =
      msToDeadline > 0 &&
      msToDeadline <= TARGET_BEFORE_MS + WINDOW_MS &&
      msToDeadline >= TARGET_BEFORE_MS - WINDOW_MS;

    if (!force && !inWindow && !isSched) {
      return ok({
        ok: true,
        skipped: true,
        reason: "outside 4h window — use force:true to override",
        gw: next.id,
        deadline: deadline.toISOString(),
        hoursToDeadline: +(msToDeadline / 3600000).toFixed(2),
      });
    }

    // Scheduled run: only send inside window
    if (isSched && !inWindow) {
      return ok({
        ok: true,
        skipped: true,
        reason: "schedule tick outside 4h window",
        gw: next.id,
        hoursToDeadline: +(msToDeadline / 3600000).toFixed(2),
      });
    }

    const emails = getEmails();
    const site = process.env.SITE_URL || "https://myfpl.netlify.app";
    const subject = `GW${next.id} deadline in ~4 hours — open FPL Assistant`;
    const html = `<div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2>Matchday · GW${next.id}</h2>
      <p>${next.name || ""}</p>
      <p><strong>Deadline:</strong> ${deadline.toUTCString()}</p>
      <p><a href="${site}">Open FPL Assistant — Matchday tab</a></p>
      <p style="color:#64748b;font-size:12px">Captain poll, chips, fixtures, rival radar, price watchlist.</p>
    </div>`;

    const apiKey = process.env.RESEND_API_KEY;
    const from =
      process.env.FROM_EMAIL || "FPL Assistant <onboarding@resend.dev>";

    if (dryRun || !apiKey) {
      return ok({
        ok: true,
        dryRun: true,
        wouldSend: emails.length,
        recipients: emails,
        subject,
        gw: next.id,
        deadline: deadline.toISOString(),
        missingApiKey: !apiKey,
        note: emails.length
          ? "Ready to send"
          : "Set MATCHDAY_EMAILS=you@gmail.com in Netlify env",
      });
    }

    if (!emails.length) {
      return ok({
        ok: true,
        sent: 0,
        reason: "MATCHDAY_EMAILS is empty",
        gw: next.id,
      });
    }

    const results = [];
    for (const email of emails) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from, to: [email], subject, html }),
        });
        const text = await res.text();
        results.push({ email, status: res.status, ok: res.ok, body: text.slice(0, 200) });
      } catch (e) {
        results.push({ email, ok: false, error: String(e) });
      }
    }

    return ok({
      ok: true,
      gw: next.id,
      sent: results.filter((r) => r.ok).length,
      results,
    });
  } catch (err) {
    return ok({ error: String(err) }, 500);
  }
};
