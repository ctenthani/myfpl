/**
 * Paid members store. Works with Netlify Blobs when available.
 * If Blobs is off, returns 200 + blobs:false so the owner UI can use
 * device list + activation links.
 */
let getStore;
try {
  ({ getStore } = require("@netlify/blobs"));
} catch (_) {
  getStore = null;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-owner-email, x-owner-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const OWNER_EMAIL = String(process.env.OWNER_EMAIL || "ctenthani@gmail.com").toLowerCase();
const OWNER_SECRET = process.env.OWNER_SECRET || process.env.DIGEST_SECRET || "";

function normEmail(e) {
  return String(e || "").trim().toLowerCase().slice(0, 120);
}

function isOwnerReq(event, body) {
  const hEmail = normEmail(event.headers["x-owner-email"] || event.headers["X-Owner-Email"]);
  const hSecret = event.headers["x-owner-secret"] || event.headers["X-Owner-Secret"] || "";
  const bEmail = normEmail(body && body.ownerEmail);
  if (OWNER_SECRET && hSecret && hSecret === OWNER_SECRET) return true;
  return hEmail === OWNER_EMAIL || bEmail === OWNER_EMAIL;
}

function openStore() {
  if (!getStore) return null;
  const tries = [
    () => getStore("fpl-members"),
    () => getStore({ name: "fpl-members" }),
  ];
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) {
    tries.unshift(() => getStore({ name: "fpl-members", siteID, token }));
  }
  for (const fn of tries) {
    try {
      return fn();
    } catch (_) {}
  }
  return null;
}

async function loadIndex(store) {
  return (await store.get("index:members", { type: "json" })) || { keys: [] };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  const store = openStore();

  try {
    if (event.httpMethod === "GET") {
      const q = event.queryStringParameters || {};
      if (q.list === "1") {
        if (!isOwnerReq(event, {})) {
          return { statusCode: 403, headers: cors, body: JSON.stringify({ error: "owner only" }) };
        }
        if (!store) {
          return { statusCode: 200, headers: cors, body: JSON.stringify({ members: [], blobs: false }) };
        }
        const idx = await loadIndex(store);
        const members = [];
        for (const k of idx.keys || []) {
          const row = await store.get(k, { type: "json" });
          if (row) members.push(row);
        }
        members.sort((a, b) => String(b.addedAt || "").localeCompare(String(a.addedAt || "")));
        return { statusCode: 200, headers: cors, body: JSON.stringify({ members, blobs: true }) };
      }

      const email = normEmail(q.email);
      const teamId = parseInt(q.teamId, 10) || 0;
      if (!store) {
        return { statusCode: 200, headers: cors, body: JSON.stringify({ found: false, blobs: false }) };
      }
      let row = null;
      if (email) row = await store.get("email:" + email, { type: "json" });
      if (!row && teamId) row = await store.get("team:" + teamId, { type: "json" });
      if (!row) return { statusCode: 200, headers: cors, body: JSON.stringify({ found: false, blobs: true }) };
      const until = Number(row.until) || 0;
      const active = until > Date.now() && (row.plan === "pro" || row.plan === "ultra");
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({
          found: true,
          active,
          blobs: true,
          plan: row.plan,
          email: row.email || null,
          teamId: row.teamId || null,
          until,
        }),
      };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      if (!isOwnerReq(event, body)) {
        return { statusCode: 403, headers: cors, body: JSON.stringify({ error: "owner only" }) };
      }
      if (!store) {
        return {
          statusCode: 200,
          headers: cors,
          body: JSON.stringify({ ok: true, blobs: false, stored: "local-only" }),
        };
      }
      const action = body.action || "add";
      const email = normEmail(body.email);
      const teamId = parseInt(body.teamId, 10) || 0;
      if (!email && !teamId) {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "email or teamId required" }) };
      }

      if (action === "remove") {
        const idx = await loadIndex(store);
        const keys = new Set(idx.keys || []);
        if (email) {
          await store.delete("email:" + email);
          keys.delete("email:" + email);
        }
        if (teamId) {
          await store.delete("team:" + teamId);
          keys.delete("team:" + teamId);
        }
        await store.setJSON("index:members", { keys: [...keys] });
        return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, removed: true, blobs: true }) };
      }

      const plan = body.plan === "ultra" ? "ultra" : "pro";
      const days = Math.max(1, parseInt(body.days, 10) || 30);
      const until = Date.now() + days * 86400000;
      const row = {
        email: email || null,
        teamId: teamId || null,
        plan,
        days,
        until,
        addedAt: new Date().toISOString(),
        note: String(body.note || "").slice(0, 200),
      };
      const idx = await loadIndex(store);
      const keys = new Set(idx.keys || []);
      if (email) {
        await store.setJSON("email:" + email, row);
        keys.add("email:" + email);
      }
      if (teamId) {
        await store.setJSON("team:" + teamId, row);
        keys.add("team:" + teamId);
      }
      await store.setJSON("index:members", { keys: [...keys] });
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, member: row, blobs: true }) };
    }

    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method Not Allowed" }) };
  } catch (err) {
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ ok: true, blobs: false, error: String(err) }),
    };
  }
};
