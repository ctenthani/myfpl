/**
 * Netlify serverless proxy for the official FPL API.
 * Avoids browser CORS restrictions.
 *
 * Usage from frontend:
 *   /api/fpl?path=bootstrap-static/
 *   /api/fpl?path=entry/1932256/
 *   /api/fpl?path=entry/1932256/event/1/picks/
 *   /api/fpl?path=leagues-classic/123/standings/?page_standings=1
 */

exports.handler = async function (event) {
  // Only allow GET
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const path = event.queryStringParameters?.path;
  if (!path) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing path query parameter" }),
    };
  }

  // Basic safety: only allow known FPL API path prefixes
  const allowed = [
    "bootstrap-static",
    "entry/",
    "event/",
    "fixtures",
    "element-summary/",
    "leagues-classic/",
    "leagues-h2h/",
    "me",
    "my-team/",
  ];
  const ok = allowed.some((p) => path.startsWith(p));
  if (!ok) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: "Path not allowed" }),
    };
  }

  const url = `https://fantasy.premierleague.com/api/${path}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "FPL-Assistant-Netlify/1.0",
        Accept: "application/json",
      },
    });

    const text = await res.text();
    const contentType = res.headers.get("content-type") || "application/json";

    return {
      statusCode: res.status,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": res.status === 200 ? "public, max-age=120" : "no-cache",
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Upstream fetch failed", detail: String(err) }),
    };
  }
};
