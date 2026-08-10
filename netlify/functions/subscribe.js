/**
 * Matchday email subscriptions.
 * POST { email, teamId, plan?, matchday: true/false }
 * GET  ?email=  → status (no full list exposed)
 */
const { getStore } = require("@netlify/blobs");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

function normEmail(e) {
  return String(e || "")
    .trim()
    .toLowerCase()
    .slice(0, 120);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  let store;
  try {
    store = getStore("fpl-subs");
  } catch (e) {
    return {
      statusCode: 503,
      headers: cors,
      body: JSON.stringify({ error: "Subscribe store unavailable", detail: String(e) }),
    };
  }

  try {
    if (event.httpMethod === "GET") {
      const email = normEmail(event.queryStringParameters?.email);
      if (!email) {
        return {
          statusCode: 400,
          headers: cors,
          body: JSON.stringify({ error: "email required" }),
        };
      }
      const row = (await store.get(`user:${email}`, { type: "json" })) || null;
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({
          email,
          subscribed: !!(row && row.matchday),
          teamId: row?.teamId || null,
        }),
      };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const email = normEmail(body.email);
      if (!email || !email.includes("@")) {
        return {
          statusCode: 400,
          headers: cors,
          body: JSON.stringify({ error: "valid email required" }),
        };
      }
      const matchday = !!body.matchday;
      const teamId = body.teamId ? parseInt(body.teamId, 10) : null;
      const plan = body.plan || "starter";
      const row = {
        email,
        teamId,
        plan,
        matchday,
        updatedAt: new Date().toISOString(),
      };
      await store.setJSON(`user:${email}`, row);

      // Maintain index of subscribed emails
      const idx = (await store.get("index:matchday", { type: "json" })) || {
        emails: [],
      };
      const set = new Set(idx.emails || []);
      if (matchday) set.add(email);
      else set.delete(email);
      await store.setJSON("index:matchday", { emails: [...set] });

      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({ ok: true, subscribed: matchday }),
      };
    }

    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  } catch (err) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
