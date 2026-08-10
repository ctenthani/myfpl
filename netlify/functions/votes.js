/**
 * Captain + chip voting (Netlify Blobs).
 * GET  /api/votes?gw=1
 * POST /api/votes  body: { type:"captain"|"chip", gw, choice, voterKey }
 */
const { getStore } = require("@netlify/blobs");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  let store;
  try {
    store = getStore("fpl-votes");
  } catch (e) {
    return {
      statusCode: 503,
      headers: cors,
      body: JSON.stringify({
        error: "Votes store unavailable",
        detail: String(e),
        fallback: true,
      }),
    };
  }

  try {
    if (event.httpMethod === "GET") {
      const gw = String(event.queryStringParameters?.gw || "1");
      const raw = (await store.get(`gw-${gw}`, { type: "json" })) || {
        captain: {},
        chip: {},
        voters: { captain: {}, chip: {} },
      };
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify(summarize(raw)),
      };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const type = body.type === "chip" ? "chip" : "captain";
      const gw = String(body.gw || "1");
      const choice = String(body.choice || "").slice(0, 64);
      const voterKey = String(body.voterKey || "").slice(0, 128);
      if (!choice || !voterKey) {
        return {
          statusCode: 400,
          headers: cors,
          body: JSON.stringify({ error: "choice and voterKey required" }),
        };
      }

      const key = `gw-${gw}`;
      const raw = (await store.get(key, { type: "json" })) || {
        captain: {},
        chip: {},
        voters: { captain: {}, chip: {} },
      };
      if (!raw.voters) raw.voters = { captain: {}, chip: {} };
      if (!raw.voters[type]) raw.voters[type] = {};
      if (!raw[type]) raw[type] = {};

      // One vote per voterKey per type per GW (change allowed)
      const prev = raw.voters[type][voterKey];
      if (prev && raw[type][prev]) {
        raw[type][prev] = Math.max(0, (raw[type][prev] || 1) - 1);
        if (raw[type][prev] === 0) delete raw[type][prev];
      }
      raw.voters[type][voterKey] = choice;
      raw[type][choice] = (raw[type][choice] || 0) + 1;

      await store.setJSON(key, raw);
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({ ok: true, ...summarize(raw) }),
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

function summarize(raw) {
  const cap = raw.captain || {};
  const chip = raw.chip || {};
  const capTotal = Object.values(cap).reduce((a, b) => a + b, 0);
  const chipTotal = Object.values(chip).reduce((a, b) => a + b, 0);
  return {
    captain: cap,
    chip: chip,
    captainTotal: capTotal,
    chipTotal: chipTotal,
    captainPct: Object.fromEntries(
      Object.entries(cap).map(([k, v]) => [
        k,
        capTotal ? Math.round((1000 * v) / capTotal) / 10 : 0,
      ])
    ),
    chipPct: Object.fromEntries(
      Object.entries(chip).map(([k, v]) => [
        k,
        chipTotal ? Math.round((1000 * v) / chipTotal) / 10 : 0,
      ])
    ),
  };
}
