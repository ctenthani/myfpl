/**
 * Sends matchday digest to subscribed emails.
 * POST with header x-digest-secret: process.env.DIGEST_SECRET
 * Optional body: { dryRun: true }
 *
 * Requires env:
 *   RESEND_API_KEY  – from resend.com (free tier works)
 *   DIGEST_SECRET   – shared secret so only you can trigger sends
 *   FROM_EMAIL      – e.g. Matchday <onboarding@resend.dev> for testing
 */
const { getStore } = require("@netlify/blobs");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-digest-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  }

  const secret = process.env.DIGEST_SECRET || "";
  const provided =
    event.headers["x-digest-secret"] || event.headers["X-Digest-Secret"] || "";
  if (!secret || provided !== secret) {
    return {
      statusCode: 401,
      headers: cors,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 503,
      headers: cors,
      body: JSON.stringify({
        error: "RESEND_API_KEY not configured on Netlify",
      }),
    };
  }

  const body = JSON.parse(event.body || "{}");
  const dryRun = !!body.dryRun;
  const from =
    process.env.FROM_EMAIL || "FPL Assistant <onboarding@resend.dev>";

  try {
    const subs = getStore("fpl-subs");
    const votes = getStore("fpl-votes");
    const idx = (await subs.get("index:matchday", { type: "json" })) || {
      emails: [],
    };
    const emails = idx.emails || [];

    // Live FPL context
    let gw = 1;
    let topCaptain = "TBD";
    let topChip = "Hold chips";
    try {
      const boot = await fetch(
        "https://fantasy.premierleague.com/api/bootstrap-static/"
      ).then((r) => r.json());
      const ev =
        boot.events.find((e) => e.is_next) ||
        boot.events.find((e) => e.is_current);
      gw = ev ? ev.id : 1;
      const voteData =
        (await votes.get(`gw-${gw}`, { type: "json" })) || { captain: {}, chip: {} };
      const cap = voteData.captain || {};
      const chip = voteData.chip || {};
      const topC = Object.entries(cap).sort((a, b) => b[1] - a[1])[0];
      const topCh = Object.entries(chip).sort((a, b) => b[1] - a[1])[0];
      if (topC) {
        const el = boot.elements.find((e) => String(e.id) === String(topC[0]));
        topCaptain = el ? el.web_name : `ID ${topC[0]}`;
      }
      if (topCh) topChip = topCh[0];
    } catch (_) {}

    const subject = `Matchday GW${gw}: Captain poll · ${topCaptain}`;
    const html = `
      <h2>FPL Matchday · GW${gw}</h2>
      <p><strong>Community captain leader:</strong> ${topCaptain}</p>
      <p><strong>Chip lean:</strong> ${topChip}</p>
      <p>Open the app → <strong>Matchday</strong> for fixtures, FDR, live scoring, rival radar and price watchlist.</p>
      <p style="color:#64748b;font-size:12px">You receive this because you opted in to Matchday emails. Sign in on the site to unsubscribe.</p>
    `;

    if (dryRun) {
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({
          ok: true,
          dryRun: true,
          recipients: emails.length,
          subject,
        }),
      };
    }

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
        results.push({ email, status: res.status, ok: res.ok });
      } catch (e) {
        results.push({ email, ok: false, error: String(e) });
      }
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        ok: true,
        sent: results.filter((r) => r.ok).length,
        results,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
