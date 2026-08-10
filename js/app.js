/* FPL Assistant – pitch UI, AI Transfers, AI Teams, Netlify proxy */

const API = "/api/fpl?path=";
const DEFAULT_TEAM_ID = null; // public site: no default team
const BUDGET = 100.0;

// ============================================================
// PRICING (USD) + PAYPAL LINKS
// Annual = monthly × 12 × 0.80  (20% discount)
// ============================================================
const PRICING = {
  pro:   { monthly: 2.49, yearly: +(2.49 * 12 * 0.8).toFixed(2) },   // $2.49 / $23.90
  ultra: { monthly: 4.99, yearly: +(4.99 * 12 * 0.8).toFixed(2) },   // $4.99 / $47.90
};

const PAYPAL_PRO_MONTHLY   = "https://www.paypal.com/ncp/payment/J6DP32LZ7ZMZA";
const PAYPAL_ULTRA_MONTHLY = "https://www.paypal.com/ncp/payment/ZXB3XQA3BJG9A";
const PAYPAL_PRO_YEARLY    = "https://www.paypal.com/ncp/payment/6BS7Z7XPV4FFL";
const PAYPAL_ULTRA_YEARLY  = "https://www.paypal.com/ncp/payment/ELGD2S687MS7Q";

const CHECKOUT_PRO_LINK   = PAYPAL_PRO_MONTHLY;
const CHECKOUT_ULTRA_LINK = PAYPAL_ULTRA_MONTHLY;

// Mobile money – Merchant Till codes only (no personal numbers on site)
// Replace TILL_xxx with the codes Airtel / TNM give you after merchant registration.
const MERCHANT_TILLS = {
  airtel: "AIRTEL_TILL_XXXX",   // e.g. 123456
  tnm:    "TNM_TILL_YYYY",      // e.g. 654321
  // Optional National Bank merchant / account reference (not personal account)
  nbm:    "",                   // leave blank if not using NBM yet
};

// Owner sign-in: use this email (any Team ID)
const OWNER_EMAIL = "ctenthani@gmail.com";

// Paid subscribers — you add a row after each payment (email lowercased)
// plan: "pro" | "ultra"
const PAID_USERS = [
  // { email: "customer@example.com", teamId: 1234567, plan: "pro" },
];

function moneyUsd(n) { return "$" + Number(n).toFixed(2); }

function $(id) { return document.getElementById(id); }
function on(id, evt, fn) {
  const el = $(id);
  if (el) el.addEventListener(evt, fn);
}
function money(n) { return "£" + Number(n).toFixed(1) + "m"; }
function setStatus(m) { const el = $("statusBar"); if (el) el.textContent = m; }
function xpOf(p) { return horizon === 3 ? p.xp3 : p.xp; }




let authSession = null; // { teamId, plan, email }

function loadAuthSession() {
  try {
    const raw = localStorage.getItem("fpl_auth_v1");
    if (raw) authSession = JSON.parse(raw);
  } catch (_) { authSession = null; }
  // URL one-time login: ?login=TEAM&plan=pro&code=XXXX  or ?owner=CODE
  try {
    const params = new URLSearchParams(location.search);
    // Optional deep-link activate: ?email=x&team=123&plan=pro (must match PAID_USERS)
    const qEmail = (params.get("email") || "").toLowerCase();
    const qTeam = parseInt(params.get("team") || params.get("login") || "", 10);
    const qPlan = params.get("plan");
    if (qEmail && qTeam && (qPlan === "pro" || qPlan === "ultra")) {
      const hit = PAID_USERS.find(u => String(u.email).toLowerCase() === qEmail && Number(u.teamId) === qTeam && u.plan === qPlan);
      if (hit || qEmail === OWNER_EMAIL.toLowerCase()) {
        authSession = { teamId: qEmail === OWNER_EMAIL.toLowerCase() ? null : qTeam, plan: qEmail === OWNER_EMAIL.toLowerCase() ? "owner" : qPlan, email: qEmail };
        localStorage.setItem("fpl_auth_v1", JSON.stringify(authSession));
        history.replaceState({}, "", location.pathname);
        if ($("teamIdInput") && qTeam) $("teamIdInput").value = qTeam;
      }
    }
  } catch (_) {}
}

function saveAuthSession(sess) {
  authSession = sess;
  try {
    if (sess) localStorage.setItem("fpl_auth_v1", JSON.stringify(sess));
    else localStorage.removeItem("fpl_auth_v1");
  } catch (_) {}
  updatePlanUI();
}

function currentTeamId() {
  const v = parseInt($("teamIdInput") && $("teamIdInput").value, 10);
  return v || 0;
}

/** Pro only if session matches the Team ID currently loaded (owner always). */
function isPro() {
  if (!authSession) return false;
  if (authSession.plan === "owner") return true;
  if (authSession.plan !== "pro" && authSession.plan !== "ultra") return false;
  return Number(authSession.teamId) === Number(currentTeamId());
}
function isUltra() {
  if (!authSession) return false;
  if (authSession.plan === "owner") return true;
  if (authSession.plan !== "ultra") return false;
  return Number(authSession.teamId) === Number(currentTeamId());
}
function activePlanLabel() {
  if (!authSession) return "Starter";
  if (authSession.plan === "owner") return "Owner";
  if (isPro()) return authSession.plan === "ultra" ? "Ultra" : "Pro";
  return "Starter"; // logged in but viewing a different team
}

function setPlan() { /* legacy no-op – use login */ }

function attemptLogin(teamId, code, email) {
  // code arg kept for backward compat but ignored — login is email + teamId
  teamId = parseInt(teamId, 10);
  email = String(email || "").trim().toLowerCase();
  if (!email) return { ok: false, msg: "Enter your email" };
  if (!teamId) return { ok: false, msg: "Enter a valid Team ID" };

  // Owner
  if (email === OWNER_EMAIL.toLowerCase()) {
    saveAuthSession({ teamId: null, plan: "owner", email });
    if ($("teamIdInput")) $("teamIdInput").value = teamId;
    return { ok: true, msg: "Signed in as Owner (full access on any team)" };
  }

  // Paid allowlist
  const hit = PAID_USERS.find(u =>
    String(u.email || "").toLowerCase() === email && Number(u.teamId) === teamId
  );
  if (hit && (hit.plan === "pro" || hit.plan === "ultra")) {
    saveAuthSession({ teamId, plan: hit.plan, email });
    if ($("teamIdInput")) $("teamIdInput").value = teamId;
    return { ok: true, msg: `Signed in · ${hit.plan.toUpperCase()} · team ${teamId}` };
  }
  return { ok: false, msg: "No Pro/Ultra found for that email + Team ID. Pay first, then we activate your account." };
}

function logout() {
  saveAuthSession(null);
  setStatus("Signed out — Pro features locked");
}

function loadPlan() {
  loadAuthSession();
}

function updatePlanUI() {
  const badge = $("planBadge");
  if (badge) {
    const label = activePlanLabel();
    badge.textContent = label;
    badge.className = "plan-badge " + (label === "Owner" || label === "Ultra" ? "ultra" : label === "Pro" ? "pro" : "starter");
  }
  const authLabel = $("authStatus");
  if (authLabel) {
    if (!authSession) authLabel.textContent = "Not signed in";
    else if (authSession.plan === "owner") authLabel.textContent = "Owner · any team";
    else authLabel.textContent = `${authSession.plan.toUpperCase()} · team ${authSession.teamId}`;
  }
  document.querySelectorAll(".pro-only").forEach(el => {
    el.classList.toggle("locked", !isPro());
  });
  const proBtn = $("upgradeProBtn");
  const ultraBtn = $("upgradeUltraBtn");
  const proY = $("upgradeProYearlyBtn");
  const ultraY = $("upgradeUltraYearlyBtn");
  if (proBtn) proBtn.href = PAYPAL_PRO_MONTHLY;
  if (ultraBtn) ultraBtn.href = PAYPAL_ULTRA_MONTHLY;
  if (proY) proY.href = PAYPAL_PRO_YEARLY;
  if (ultraY) ultraY.href = PAYPAL_ULTRA_YEARLY;

  const man = $("manualPayDetails");
  if (man) {
    const nbm = MERCHANT_TILLS.nbm
      ? `<br>National Bank merchant ref: <strong>${MERCHANT_TILLS.nbm}</strong>`
      : "";
    man.innerHTML = `
      <strong>Airtel Money</strong> — dial <code>*247#</code> → Pay to Till <strong>${MERCHANT_TILLS.airtel}</strong><br>
      <strong>TNM Mpamba</strong> — dial <code>*444#</code> → Pay to Till <strong>${MERCHANT_TILLS.tnm}</strong>${nbm}<br>
      <span class="muted" style="font-size:0.85rem">
        After paying, send the SMS confirmation (or screenshot) on WhatsApp / X (@ctenthani).
        Include your email, Team ID, and plan (Pro/Ultra). We activate email + Team ID for Sign in.
      </span>`;
  }
}


let bootstrap = null;
let players = [];
let fixtures = [];
let teamsMap = {};
let posMap = {};
let currentGw = 1;
let horizon = 1;
let squad = [];
let startingIds = [];
let benchIds = [];
let captainId = null;
let editMode = false;
let bank = 0;
let entryBank = 0;
let chipModalKey = null;

const SQUAD_LIMITS = { GKP: 2, DEF: 5, MID: 5, FWD: 3 };

// XifundoFC GW1 draft — used only for DEFAULT_TEAM_ID when API picks not public
const DEFAULT_SQUAD_IDS = {
  starting: [1, 8, 4, 469, 418, 400, 427, 542, 398, 411, 106],
  bench: [497, 346, 259, 212],
  captain: 411
};

async function fetchJson(path) {
  const url = API + encodeURIComponent(path);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

async function loadBootstrap(force = false) {
  // Do not cache full bootstrap in localStorage — payload is ~1MB+ and
  // exceeds browser quota (QuotaExceededError), which previously aborted init.
  // Netlify function already sets short Cache-Control on the proxy response.
  bootstrap = await fetchJson("bootstrap-static/");
  if (!bootstrap || !bootstrap.elements) {
    throw new Error("Bootstrap data missing elements");
  }
}

async function loadFixtures() {
  try {
    fixtures = await fetchJson("fixtures/");
  } catch (_) {
    fixtures = [];
  }
}

function buildPlayers() {
  teamsMap = Object.fromEntries(bootstrap.teams.map(t => [t.id, t]));
  posMap = Object.fromEntries(bootstrap.element_types.map(p => [p.id, p.singular_name_short]));
  players = bootstrap.elements.map(p => {
    const team = teamsMap[p.team] || {};
    const status = p.status || "a";
    let availability = 1;
    if (status === "u" || status === "s") availability = 0;
    else if (status === "i") availability = 0.15;
    else if (status === "d") availability = 0.45;
    else if (p.chance_of_playing_next_round != null)
      availability = Number(p.chance_of_playing_next_round) / 100;
    const pl = {
      id: p.id, web_name: p.web_name, team_id: p.team,
      team: team.short_name || "?", team_name: team.name || "?", team_code: team.code || 0,
      position: posMap[p.element_type] || "?", element_type: p.element_type,
      price: p.now_cost / 10, form: parseFloat(p.form) || 0,
      points_per_game: parseFloat(p.points_per_game) || 0,
      total_points: p.total_points || 0,
      selected_by_percent: parseFloat(p.selected_by_percent) || 0,
      ep_next: parseFloat(p.ep_next) || 0, status, news: p.news || "",
      availability,
      xg90: parseFloat(p.expected_goals_per_90) || 0,
      xa90: parseFloat(p.expected_assists_per_90) || 0,
      xgi90: parseFloat(p.expected_goal_involvements_per_90) || 0,
      xgc90: parseFloat(p.expected_goals_conceded_per_90) || 0,
      minutes: p.minutes || 0,
      influence: parseFloat(p.influence) || 0,
      creativity: parseFloat(p.creativity) || 0,
      threat: parseFloat(p.threat) || 0,
      goals_scored: p.goals_scored || 0,
      assists: p.assists || 0,
      clean_sheets: p.clean_sheets || 0,
      saves: p.saves || 0,
      bonus: p.bonus || 0,
      xp: 0, xp3: 0,
    };
    return pl;
  });
  const ev = bootstrap.events.find(e => e.is_next || e.is_current);
  currentGw = ev ? ev.id : 1;
  recomputeAllXP();
}

/**
 * Predicted points model (Hub-style components, public data only).
 * Uses official ep_next + xG/xA rates + minutes likelihood + position scoring.
 * Hub is higher because they blend Opta + bookie CS odds + proprietary minutes.
 * We scale toward realistic GW totals using the components below.
 */
function expectedPoints(p, hz = 1) {
  const avail = p.availability ?? 1;
  const minsShare = Math.min(1, (p.minutes || 0) / (38 * 70)); // ~full season starter ~1
  const startProb = Math.max(0.25, Math.min(0.98, 0.35 * avail + 0.45 * Math.max(minsShare, 0.2) + 0.2 * Math.min((p.selected_by_percent || 0) / 40, 1)));

  // Appearance points (2 if 60+ mins) weighted by start prob
  const appearance = 2 * startProb;

  // Attacking: convert xG/xA rates to FPL points by position
  const goalPts = { GKP: 10, DEF: 6, MID: 5, FWD: 4 }[p.position] || 4;
  const assistPts = 3;
  // Prefer per-90 rates; if missing, back out from season totals
  let xg90 = p.xg90 || 0;
  let xa90 = p.xa90 || 0;
  if (xg90 < 0.01 && (p.goals_scored || 0) > 0 && (p.minutes || 0) > 200) {
    xg90 = (p.goals_scored * 90) / p.minutes;
  }
  if (xa90 < 0.01 && (p.assists || 0) > 0 && (p.minutes || 0) > 200) {
    xa90 = (p.assists * 90) / p.minutes;
  }
  // Soft floor for premiums who will start
  if (p.price >= 10 && xg90 + xa90 < 0.15) {
    xg90 = Math.max(xg90, 0.25);
    xa90 = Math.max(xa90, 0.12);
  } else if (p.price >= 7.5 && xg90 + xa90 < 0.08) {
    xg90 = Math.max(xg90, 0.12);
    xa90 = Math.max(xa90, 0.08);
  }

  const goalsXP = xg90 * goalPts * startProb;
  const assistsXP = xa90 * assistPts * startProb;

  // Clean sheets (DEF/GK heavy). Proxy from team strength via ownership+price and inverse xGC
  let csXP = 0;
  if (p.position === "GKP" || p.position === "DEF") {
    const xgc = p.xgc90 || 1.3;
    const csProb = Math.max(0.05, Math.min(0.55, 0.42 - 0.12 * xgc + (p.price >= 5 ? 0.05 : 0)));
    csXP = csProb * 4 * startProb;
  } else if (p.position === "MID") {
    csXP = 0.08 * startProb; // rare 1pt CS
  }

  // Bonus proxy from BPS-related ICT
  const ict = (p.influence || 0) + (p.creativity || 0) + (p.threat || 0);
  const bonusXP = Math.min(1.2, ict / 800) * startProb;

  // Saves for GK
  let savesXP = 0;
  if (p.position === "GKP") {
    savesXP = 0.6 * startProb; // ~2 save points typical
  }

  // Blend with official ep_next (FPL's own model) — important anchor
  const ep = p.ep_next || 0;
  const component = appearance + goalsXP + assistsXP + csXP + bonusXP + savesXP;
  // Pre-season ep_next is flat (~2–4). Weight components more early; ep more once form exists.
  const form = p.form || 0;
  let base;
  if (form > 0.5) {
    base = 0.5 * ep + 0.5 * component;
  } else {
    // Pre-season: lift toward Hub-like magnitudes with components + ownership prior
    const ownPrior = Math.min(2.0, (p.selected_by_percent || 0) / 35);
    base = 0.25 * ep + 0.60 * component + 0.15 * (ep + ownPrior);
  }

  base = Math.max(base, 1.0);

  // Fixture difficulty / home advantage adjustment for the next GW(s)
  const fixMul = fixtureFactor(p.team_id, currentGw);
  base *= fixMul;

  // Multi-GW: slight decay + per-GW fixture factor
  if (hz <= 1) return base * avail;
  const weights = [1, 0.92, 0.85, 0.8, 0.75];
  let total = base * (weights[0] || 1);
  for (let i = 1; i < hz; i++) {
    total += base * (weights[i] || 0.7) * fixtureFactor(p.team_id, currentGw + i);
  }
  return total * avail;
}

function fixtureFactor(teamId, gw) {
  if (!fixtures || !fixtures.length) return 1;
  const f = fixtures.find(x => x.event === gw && (x.team_h === teamId || x.team_a === teamId));
  if (!f) return 0.62; // likely blank / no fixture
  const isHome = f.team_h === teamId;
  const diff = isHome ? (f.team_h_difficulty || 3) : (f.team_a_difficulty || 3);
  // FDR 1–5 → multiplier ~1.22 … 0.87
  const diffMul = 1.22 - 0.07 * diff;
  const homeMul = isHome ? 1.07 : 0.96;
  return Math.max(0.55, Math.min(1.28, diffMul * homeMul));
}

function recomputeAllXP() {
  players.forEach(p => {
    p.xp = expectedPoints(p, 1);
    p.xp3 = expectedPoints(p, 3);
  });
}

// ---------- Squad optimise (15 then best XI) ----------

/** Rearrange the *current* 15-man squad into best XI + bench + captain. Does not buy/sell players. */
function optimiseLineup() {
  if (!squad || squad.length < 11) {
    return { error: "Need at least 11 players in your squad first. Load a Team ID or use Edit team." };
  }
  const byPos = { GKP: [], DEF: [], MID: [], FWD: [] };
  squad.forEach(p => {
    if (byPos[p.position]) byPos[p.position].push(p);
  });
  Object.keys(byPos).forEach(k => byPos[k].sort((a, b) => xpOf(b) - xpOf(a)));

  if (byPos.GKP.length < 1) return { error: "Need at least 1 goalkeeper in the squad." };

  const formations = [
    { DEF: 3, MID: 4, FWD: 3 }, { DEF: 3, MID: 5, FWD: 2 }, { DEF: 4, MID: 4, FWD: 2 },
    { DEF: 4, MID: 3, FWD: 3 }, { DEF: 5, MID: 3, FWD: 2 }, { DEF: 5, MID: 4, FWD: 1 }, { DEF: 4, MID: 5, FWD: 1 },
  ];
  let bestXI = null, bestScore = -1;
  for (const f of formations) {
    if (byPos.DEF.length < f.DEF || byPos.MID.length < f.MID || byPos.FWD.length < f.FWD) continue;
    const xi = [byPos.GKP[0], ...byPos.DEF.slice(0, f.DEF), ...byPos.MID.slice(0, f.MID), ...byPos.FWD.slice(0, f.FWD)];
    if (xi.length !== 11) continue;
    const score = xi.reduce((s, p) => s + xpOf(p) * (0.7 + 0.3 * (p.availability || 1)), 0);
    if (score > bestScore) { bestScore = score; bestXI = xi; }
  }
  if (!bestXI) {
    // fallback: top XP available under legal min formation
    bestXI = [byPos.GKP[0]];
    const rest = [...byPos.DEF, ...byPos.MID, ...byPos.FWD].sort((a, b) => xpOf(b) - xpOf(a));
    // ensure min 3 DEF, 2 MID, 1 FWD if possible
    const pick = { DEF: 0, MID: 0, FWD: 0 };
    const chosen = [];
    for (const p of rest) {
      if (chosen.length >= 10) break;
      if (p.position === "DEF" && pick.DEF >= 5) continue;
      if (p.position === "MID" && pick.MID >= 5) continue;
      if (p.position === "FWD" && pick.FWD >= 3) continue;
      chosen.push(p); pick[p.position]++;
    }
    bestXI = [byPos.GKP[0], ...chosen].slice(0, 11);
  }
  if (bestXI.length !== 11) {
    return { error: "Could not form a valid XI from this squad (check positions)." };
  }
  const xiIds = new Set(bestXI.map(p => p.id));
  const bench = squad.filter(p => !xiIds.has(p.id));
  bench.sort((a, b) => {
    if (a.position === "GKP" && b.position !== "GKP") return -1;
    if (b.position === "GKP" && a.position !== "GKP") return 1;
    return xpOf(b) - xpOf(a);
  });
  startingIds = bestXI.map(p => p.id);
  benchIds = bench.map(p => p.id);
  captainId = bestXI.slice().sort((a, b) => xpOf(b) - xpOf(a))[0]?.id || null;
  // keep squad membership unchanged — only order/XI/bench/captain
  squad = [...bestXI, ...bench];
  bank = Math.max(0, BUDGET - squad.reduce((s, p) => s + p.price, 0));
  return { ok: true, xiXp: bestXI.reduce((s, p) => s + xpOf(p), 0) };
}

function optimiseSquad(budget = BUDGET, opts = {}) {
  // opts.mode: "wildcard" | "freehit" | "balanced"
  // opts.excludeIds: number[]
  // opts.horizonOverride: 1 | 3
  const mode = opts.mode || "balanced";
  const exclude = new Set(opts.excludeIds || []);
  const savedH = horizon;
  if (opts.horizonOverride) horizon = opts.horizonOverride;

  const scoreOf = (p) => {
    let s = xpOf(p);
    if (mode === "freehit") {
      // single-GW: lean harder on next fixture + form
      s = (p.xp || s) * 1.15 + (p.form || 0) * 0.2;
    } else if (mode === "wildcard") {
      // multi-week structure: xp3 + ownership stability for premiums
      s = (p.xp3 || s) + (p.price >= 7 ? 0.3 : 0) - (p.selected_by_percent > 40 ? 0.1 : 0);
    }
    return s;
  };

  let pool = players.filter(p =>
    p.availability >= 0.25 &&
    !["u", "s"].includes(p.status) &&
    !exclude.has(p.id)
  );
  pool.sort((a, b) => scoreOf(b) - scoreOf(a));

  const need = { GKP: 2, DEF: 5, MID: 5, FWD: 3 };
  const counts = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  const club = {};
  const picked = [];
  let spent = 0;

  // Phase 1: fill each position quota by score within budget
  for (const pos of ["GKP", "DEF", "MID", "FWD"]) {
    const candidates = pool.filter(p => p.position === pos);
    for (const p of candidates) {
      if (counts[pos] >= need[pos]) break;
      if ((club[p.team_id] || 0) >= 3) continue;
      if (spent + p.price > budget + 0.05) continue;
      picked.push(p);
      counts[pos]++;
      club[p.team_id] = (club[p.team_id] || 0) + 1;
      spent += p.price;
    }
  }

  // Phase 2: fill remaining slots with cheapest valid players
  if (picked.length < 15) {
    const rest = pool
      .filter(p => !picked.includes(p))
      .sort((a, b) => a.price - b.price || scoreOf(b) - scoreOf(a));
    for (const p of rest) {
      if (picked.length >= 15) break;
      if (counts[p.position] >= need[p.position]) continue;
      if ((club[p.team_id] || 0) >= 3) continue;
      if (spent + p.price > budget + 0.05) continue;
      picked.push(p);
      counts[p.position]++;
      club[p.team_id] = (club[p.team_id] || 0) + 1;
      spent += p.price;
    }
  }

  // Phase 3: if still short, relax budget slightly (up to 100.5) then availability
  if (picked.length < 15) {
    const rest = pool.filter(p => !picked.includes(p)).sort((a, b) => a.price - b.price);
    for (const p of rest) {
      if (picked.length >= 15) break;
      if (counts[p.position] >= need[p.position]) continue;
      if ((club[p.team_id] || 0) >= 3) continue;
      picked.push(p);
      counts[p.position]++;
      club[p.team_id] = (club[p.team_id] || 0) + 1;
      spent += p.price;
    }
  }

  // Phase 4: upgrade weak picks while staying in budget
  for (let pass = 0; pass < 4; pass++) {
    picked.sort((a, b) => scoreOf(a) - scoreOf(b));
    for (let j = 0; j < picked.length; j++) {
      const weak = picked[j];
      for (const cand of pool) {
        if (picked.includes(cand) || cand.position !== weak.position) continue;
        if (scoreOf(cand) <= scoreOf(weak) + 0.05) continue;
        const newSpent = spent - weak.price + cand.price;
        if (newSpent > budget + 0.05) continue;
        const nc = (club[cand.team_id] || 0) - (cand.team_id === weak.team_id ? 1 : 0) + 1;
        if (cand.team_id !== weak.team_id && (club[cand.team_id] || 0) >= 3) continue;
        club[weak.team_id] = (club[weak.team_id] || 1) - 1;
        club[cand.team_id] = (club[cand.team_id] || 0) + 1;
        spent = newSpent;
        picked[j] = cand;
        break;
      }
    }
  }

  // Build best XI from the 15
  const byPos = { GKP: [], DEF: [], MID: [], FWD: [] };
  picked.forEach(p => byPos[p.position].push(p));
  Object.keys(byPos).forEach(k => byPos[k].sort((a, b) => scoreOf(b) - scoreOf(a)));
  const formations = [
    { DEF: 3, MID: 4, FWD: 3 }, { DEF: 3, MID: 5, FWD: 2 }, { DEF: 4, MID: 4, FWD: 2 },
    { DEF: 4, MID: 3, FWD: 3 }, { DEF: 5, MID: 3, FWD: 2 }, { DEF: 5, MID: 4, FWD: 1 }, { DEF: 4, MID: 5, FWD: 1 },
  ];
  let bestXI = null, bestScore = -1;
  for (const f of formations) {
    if (byPos.GKP.length < 1 || byPos.DEF.length < f.DEF || byPos.MID.length < f.MID || byPos.FWD.length < f.FWD) continue;
    const xi = [byPos.GKP[0], ...byPos.DEF.slice(0, f.DEF), ...byPos.MID.slice(0, f.MID), ...byPos.FWD.slice(0, f.FWD)];
    if (xi.length !== 11) continue;
    const score = xi.reduce((s, p) => s + scoreOf(p), 0);
    if (score > bestScore) { bestScore = score; bestXI = xi; }
  }
  if (!bestXI || bestXI.length !== 11) {
    bestXI = [];
    if (byPos.GKP[0]) bestXI.push(byPos.GKP[0]);
    bestXI.push(...byPos.DEF.slice(0, 3), ...byPos.MID.slice(0, 4), ...byPos.FWD.slice(0, 3));
    bestXI = bestXI.slice(0, 11);
  }

  const xiIds = new Set(bestXI.map(p => p.id));
  const bench = picked.filter(p => !xiIds.has(p.id));
  bench.sort((a, b) => {
    if (a.position === "GKP" && b.position !== "GKP") return -1;
    if (b.position === "GKP" && a.position !== "GKP") return 1;
    return scoreOf(b) - scoreOf(a);
  });

  const full = [...bestXI, ...bench].slice(0, 15);
  const xiFinal = full.filter(p => xiIds.has(p.id)).slice(0, 11);
  // if filter order wrong, rebuild
  const xiOrdered = bestXI.filter(p => full.some(x => x.id === p.id)).slice(0, 11);
  const benchOut = full.filter(p => !xiOrdered.some(x => x.id === p.id));
  const squadOut = [...xiOrdered, ...benchOut].slice(0, 15);
  const realSpent = squadOut.reduce((s, p) => s + p.price, 0);
  const cap = xiOrdered.slice().sort((a, b) => scoreOf(b) - scoreOf(a))[0]?.id || null;

  horizon = savedH;
  return {
    spent: realSpent,
    bank: Math.max(0, budget - realSpent),
    xiXp: xiOrdered.reduce((s, p) => s + xpOf(p), 0),
    squad: squadOut,
    startingIds: xiOrdered.map(p => p.id),
    benchIds: benchOut.map(p => p.id),
    captainId: cap,
    counts: {
      GKP: squadOut.filter(p => p.position === "GKP").length,
      DEF: squadOut.filter(p => p.position === "DEF").length,
      MID: squadOut.filter(p => p.position === "MID").length,
      FWD: squadOut.filter(p => p.position === "FWD").length,
      total: squadOut.length,
    },
  };
}

// ---------- AI Transfers ----------
function findTransfers(freeTransfers = 1, maxHits = 1) {
  if (!squad.length) return { error: "No squad loaded. Open Pick tab and load/optimise first." };
  const squadIds = new Set(squad.map(p => p.id));
  const currentXp = squad.reduce((s, p) => s + xpOf(p), 0);
  const availableBudget = bank;
  const candidates = [];

  // Single transfers
  const outs = [...squad].sort((a, b) => xpOf(a) - xpOf(b)).slice(0, 8);
  for (const out of outs) {
    const maxPrice = availableBudget + out.price;
    const ins = players
      .filter(p => p.position === out.position && !squadIds.has(p.id) && p.price <= maxPrice + 0.05
        && p.availability > 0.4 && xpOf(p) > xpOf(out) + 0.15)
      .sort((a, b) => xpOf(b) - xpOf(a))
      .slice(0, 5);
    for (const inn of ins) {
      const clubCount = squad.filter(x => x.team_id === inn.team_id && x.id !== out.id).length;
      if (clubCount >= 3) continue;
      const gain = xpOf(inn) - xpOf(out);
      const costDiff = inn.price - out.price;
      candidates.push({
        type: "1 FT",
        moves: [{ out, inn }],
        gain,
        costDiff,
        hits: 0,
        netGain: gain,
      });
    }
  }

  // Two transfers if FT+hits allow
  if (freeTransfers + maxHits >= 2) {
    const weak2 = outs.slice(0, 5);
    for (let i = 0; i < weak2.length; i++) {
      for (let j = i + 1; j < weak2.length; j++) {
        const o1 = weak2[i], o2 = weak2[j];
        if (o1.position === o2.position) continue; // keep simple different positions
        const budget2 = availableBudget + o1.price + o2.price;
        const ins1 = players.filter(p => p.position === o1.position && !squadIds.has(p.id) && xpOf(p) > xpOf(o1) + 0.1 && p.availability > 0.4)
          .sort((a, b) => xpOf(b) - xpOf(a)).slice(0, 4);
        const ins2 = players.filter(p => p.position === o2.position && !squadIds.has(p.id) && xpOf(p) > xpOf(o2) + 0.1 && p.availability > 0.4)
          .sort((a, b) => xpOf(b) - xpOf(a)).slice(0, 4);
        for (const a of ins1) {
          for (const b of ins2) {
            if (a.id === b.id) continue;
            if (a.price + b.price > budget2 + 0.05) continue;
            const hits = Math.max(0, 2 - freeTransfers);
            if (hits > maxHits) continue;
            const gain = (xpOf(a) - xpOf(o1)) + (xpOf(b) - xpOf(o2));
            const hitPenalty = hits * 4; // FPL -4 per hit; we subtract from "value" loosely
            candidates.push({
              type: hits ? `2 transfers (−${hitPenalty} hit)` : "2 FT",
              moves: [{ out: o1, inn: a }, { out: o2, inn: b }],
              gain,
              costDiff: a.price + b.price - o1.price - o2.price,
              hits,
              netGain: gain - hitPenalty * 0.15, // soft penalty in ranking
            });
          }
        }
      }
    }
  }

  candidates.sort((a, b) => b.netGain - a.netGain);
  // Deduplicate similar
  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    const key = c.moves.map(m => m.out.id + "-" + m.inn.id).sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
    if (unique.length >= 12) break;
  }
  return { currentXp, suggestions: unique, bank: availableBudget };
}

function applyTransferSuggestion(sug) {
  for (const m of sug.moves) {
    const idx = squad.findIndex(p => p.id === m.out.id);
    if (idx >= 0) {
      const old = squad[idx];
      squad[idx] = m.inn;
      bank = bank - m.inn.price + old.price;
      startingIds = startingIds.map(id => id === m.out.id ? m.inn.id : id);
      benchIds = benchIds.map(id => id === m.out.id ? m.inn.id : id);
      if (captainId === m.out.id) captainId = m.inn.id;
    }
  }
  // Rebuild XI preference by XP
  const all = [...squad];
  const byPos = { GKP: [], DEF: [], MID: [], FWD: [] };
  all.forEach(p => byPos[p.position].push(p));
  Object.keys(byPos).forEach(k => byPos[k].sort((a, b) => xpOf(b) - xpOf(a)));
  const xi = [];
  if (byPos.GKP[0]) xi.push(byPos.GKP[0]);
  xi.push(...byPos.DEF.slice(0, 4));
  xi.push(...byPos.MID.slice(0, 4));
  xi.push(...byPos.FWD.slice(0, 2));
  while (xi.length < 11) {
    const rest = all.filter(p => !xi.includes(p)).sort((a, b) => xpOf(b) - xpOf(a));
    if (!rest.length) break;
    xi.push(rest[0]);
  }
  startingIds = xi.slice(0, 11).map(p => p.id);
  benchIds = all.filter(p => !startingIds.includes(p.id)).map(p => p.id);
  captainId = xi.slice().sort((a, b) => xpOf(b) - xpOf(a))[0]?.id;
  renderPitch();
  renderPlayerList();
  setStatus("Transfer applied locally – copy to official FPL site before deadline");
}

// ---------- Render ----------
function shirtUrl(p) {
  const code = p.team_code || 0;
  if (!code) return "";
  // Official FPL kit art (home). GK uses _1 suffix.
  if (p.position === "GKP") {
    return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}_1-66.webp`;
  }
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-66.webp`;
}
function playerCard(p, isCaptain = false) {
  const pts = xpOf(p).toFixed(1);
  const shirt = shirtUrl(p);
  const shirtHtml = shirt
    ? `<img class="shirt-img" src="${shirt}" alt="${p.team}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
       <div class="shirt shirt-fallback" style="display:none;background:${shirtFor(p.team)}">${posEmoji(p.position)}</div>`
    : `<div class="shirt" style="background:${shirtFor(p.team)}">${posEmoji(p.position)}</div>`;
  return `
    <div class="pcard ${isCaptain ? "captain" : ""}" data-id="${p.id}" title="${p.news || p.web_name}">
      ${shirtHtml}
      <div class="pname">${p.web_name}</div>
      <div class="pprice">${money(p.price)}</div>
      <div class="ppts"><span>${pts}</span></div>
    </div>`;
}
function posEmoji(pos) { return { GKP: "🧤", DEF: "🛡️", MID: "⚙️", FWD: "⚽" }[pos] || "•"; }
function shirtFor(team) {
  const map = { ARS:"#ef0107",AVL:"#670e36",BOU:"#da291c",BRE:"#e30613",BHA:"#0057b8",CHE:"#034694",CRY:"#1b458f",EVE:"#003399",FUL:"#000000",LIV:"#c8102e",MCI:"#6cabdd",MUN:"#da291c",NEW:"#241f20",NFO:"#e53233",TOT:"#132257",WHU:"#7a263a",WOL:"#fdb913",LEE:"#1d428a",SUN:"#eb172b",IPS:"#0033a0",SOU:"#d71920",LEI:"#003090",HUL:"#f5a12d",BUR:"#6c1d45" };
  return map[team] || "#64748b";
}

/** Mini pitch HTML for AI Teams (Wildcard / Free Hit) */
function renderMiniPitch(data) {
  const byPos = { GKP: [], DEF: [], MID: [], FWD: [] };
  (data.startingIds || []).forEach(id => {
    const p = (data.squad || []).find(x => x.id === id);
    if (p) byPos[p.position].push(p);
  });
  let rows = "";
  for (const pos of ["GKP", "DEF", "MID", "FWD"]) {
    rows += `<div class="pitch-row">`;
    byPos[pos].forEach(p => { rows += playerCard(p, p.id === data.captainId); });
    rows += `</div>`;
  }
  const bench = (data.benchIds || []).map(id => (data.squad || []).find(x => x.id === id)).filter(Boolean);
  const benchHtml = bench.map(p => playerCard(p, false)).join("");
  return `<div class="ai-pitch pitch">${rows}</div>
    <div class="bench-label">Bench</div>
    <div class="bench ai-bench">${benchHtml}</div>`;
}

function renderPitch() {
  const byPos = { GKP: [], DEF: [], MID: [], FWD: [] };
  startingIds.forEach(id => {
    const p = squad.find(x => x.id === id);
    if (p) byPos[p.position].push(p);
  });
  let html = "";
  for (const pos of ["GKP", "DEF", "MID", "FWD"]) {
    html += `<div class="pitch-row">`;
    byPos[pos].forEach(p => { html += playerCard(p, p.id === captainId); });
    html += `</div>`;
  }
  $("pitch").innerHTML = html;
  const benchPlayers = benchIds.map(id => squad.find(x => x.id === id)).filter(Boolean);
  $("bench").innerHTML = benchPlayers.map(p => playerCard(p, false)).join("");

  const xi = squad.filter(p => startingIds.includes(p.id));
  const xiXp = xi.reduce((s, p) => s + xpOf(p), 0);
  const cap = squad.find(p => p.id === captainId);
  const pred = xiXp + (cap ? xpOf(cap) : 0);
  const cost = squad.reduce((s, p) => s + p.price, 0);
  bank = Math.max(0, BUDGET - cost);
  const rating = Math.min(100, Math.round((pred / (horizon === 3 ? 90 : 55)) * 100));
  $("mRating").textContent = rating + "/100";
  $("mPred").textContent = pred.toFixed(1);
  $("mBank").textContent = money(bank);
  $("mCost").textContent = money(cost);
  if (editMode) {
    document.querySelectorAll(".pcard").forEach(el => {
      el.classList.add("removable");
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removePlayer(+el.dataset.id);
      });
    });
  }
}

function renderPlayerList() {
  const pos = document.querySelector(".pos-tab.active")?.dataset.pos || "ALL";
  const sort = $("sortBy").value;
  const pMin = parseFloat($("priceMin").value);
  const pMax = parseFloat($("priceMax").value);
  const q = ($("searchInput").value || "").toLowerCase();
  const affordable = $("affordableOnly").checked;
  const inSquad = new Set(squad.map(p => p.id));
  let list = players.filter(p => {
    if (pos !== "ALL" && p.position !== pos) return false;
    if (p.price < pMin || p.price > pMax) return false;
    if (q && !p.web_name.toLowerCase().includes(q) && !p.team.toLowerCase().includes(q)) return false;
    if (affordable && p.price > bank + 0.1) return false;
    return true;
  });
  list.sort((a, b) => {
    if (sort === "xp") return xpOf(b) - xpOf(a);
    if (sort === "price") return b.price - a.price;
    if (sort === "own") return b.selected_by_percent - a.selected_by_percent;
    return a.web_name.localeCompare(b.web_name);
  });
  $("playerList").innerHTML = list.slice(0, 80).map(p => `
    <div class="prow ${inSquad.has(p.id) ? "in-squad" : ""}" data-id="${p.id}">
      <span class="dot"></span>
      <div><div class="pname-row">${p.web_name}</div><div class="pmeta">${p.team} · ${p.position}</div></div>
      <div class="pprice">${money(p.price)}</div>
      <div class="pxp">${xpOf(p).toFixed(1)}</div>
    </div>`).join("");
  if (editMode) {
    document.querySelectorAll(".prow").forEach(el => {
      el.addEventListener("click", () => addPlayer(+el.dataset.id));
    });
  }
}

function removePlayer(id) {
  if (!editMode) return;
  squad = squad.filter(p => p.id !== id);
  startingIds = startingIds.filter(x => x !== id);
  benchIds = benchIds.filter(x => x !== id);
  if (captainId === id) captainId = startingIds[0] || null;
  bank = BUDGET - squad.reduce((s, p) => s + p.price, 0);
  while (startingIds.length < 11 && benchIds.length) startingIds.push(benchIds.shift());
  renderPitch(); renderPlayerList();
  $("editStatusInline").textContent = `Squad: ${squad.length}/15 · Bank ${money(bank)}`;
}
function addPlayer(id) {
  if (!editMode) return;
  if (squad.find(p => p.id === id) || squad.length >= 15) return;
  const p = players.find(x => x.id === id);
  if (!p) return;
  if (squad.filter(x => x.position === p.position).length >= SQUAD_LIMITS[p.position]) {
    $("editStatusInline").textContent = `Max ${SQUAD_LIMITS[p.position]} ${p.position}`; return;
  }
  if (p.price > bank + 0.05) { $("editStatusInline").textContent = "Not enough budget"; return; }
  if (squad.filter(x => x.team_id === p.team_id).length >= 3) { $("editStatusInline").textContent = "Max 3 per club"; return; }
  squad.push(p);
  if (startingIds.length < 11) startingIds.push(p.id); else benchIds.push(p.id);
  bank -= p.price;
  renderPitch(); renderPlayerList();
  $("editStatusInline").textContent = `Added ${p.web_name}. ${squad.length}/15 · ${money(bank)}`;
}

function showUpgradePrompt(feature) {
  const boxId = feature === "transfers" ? "transferResults" : "aiTeamsResults";
  const box = $(boxId);
  if (!box) return;
  box.innerHTML = `
    <div class="upgrade-card">
      <h3>🔒 Pro feature</h3>
      <p>${feature === "transfers"
        ? "AI Transfer suggestions (hits, bank, bench coverage) are available on <strong>Pro</strong> and <strong>Ultra</strong>."
        : "AI Teams generation (multiple optimised squads for WC / FH) is available on <strong>Pro</strong> and <strong>Ultra</strong>."}</p>
      <p class="muted">Starter keeps the pitch view, predicted points, optimise lineup and chip planner free.</p>

      <div style="margin-top:12px">
        <strong style="font-size:0.9rem">Monthly</strong>
        <div class="upgrade-actions" style="flex-wrap:wrap;gap:8px;margin-top:6px">
          <a class="btn btn-blue" href="${PAYPAL_PRO_MONTHLY}" target="_blank" rel="noopener">Pro $${PRICING.pro.monthly}/mo</a>
          <a class="btn btn-outline" href="${PAYPAL_ULTRA_MONTHLY}" target="_blank" rel="noopener">Ultra $${PRICING.ultra.monthly}/mo</a>
        </div>
      </div>

      <div style="margin-top:14px">
        <strong style="font-size:0.9rem">Yearly · save 20%</strong>
        <div class="upgrade-actions" style="flex-wrap:wrap;gap:8px;margin-top:6px">
          <a class="btn btn-blue" href="${PAYPAL_PRO_YEARLY}" target="_blank" rel="noopener">Pro $${PRICING.pro.yearly}/yr</a>
          <a class="btn btn-outline" href="${PAYPAL_ULTRA_YEARLY}" target="_blank" rel="noopener">Ultra $${PRICING.ultra.yearly}/yr</a>
        </div>
        <p class="muted" style="font-size:0.75rem;margin-top:4px">Save 20% with yearly billing (USD).</p>
      </div>

      <div class="manual-pay" style="margin-top:18px;padding:14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">
        <strong>Or pay via mobile money (Malawi)</strong>
        <p style="margin:8px 0 4px;font-size:0.9rem">
          <strong>Airtel Money</strong> — *247# → Till <strong>${MERCHANT_TILLS.airtel}</strong><br>
          <strong>TNM Mpamba</strong> — *444# → Till <strong>${MERCHANT_TILLS.tnm}</strong>
        </p>
        <p class="muted" style="font-size:0.8rem;margin:0">
          Send SMS proof to @ctenthani. State Pro or Ultra (monthly/yearly). You get an unlock link.
        </p>
      </div>

      <div style="margin-top:14px">
        <button type="button" class="btn btn-ghost" id="demoUnlockBtn">Demo unlock (local only – for testing)</button>
      </div>
    </div>`;
  const demo = $("demoUnlockBtn");
  if (demo) demo.addEventListener("click", () => {
    const tid = currentTeamId();
    saveAuthSession({ teamId: tid, plan: "pro", email: "demo" });
    setStatus("Demo Pro unlocked for team " + tid + " on this device only");
    if (feature === "transfers") renderTransfersUI();
    else renderAITeams();
  });
}

function renderTransfersUI() {
  if (!isPro()) {
    showUpgradePrompt("transfers");
    return;
  }
  const ft = parseInt($("ftInput").value, 10) || 1;
  const hits = parseInt($("hitsInput").value, 10) || 0;
  const res = findTransfers(ft, hits);
  const box = $("transferResults");
  if (res.error) { box.innerHTML = `<p class="muted">${res.error}</p>`; return; }
  if (!res.suggestions.length) {
    box.innerHTML = `<p class="muted">No strong upgrades found — squad looks solid on current metrics (bank ${money(res.bank)}).</p>`;
    return;
  }
  box.innerHTML = `<p class="muted">Current squad XP ≈ <strong>${res.currentXp.toFixed(1)}</strong> · Bank ${money(res.bank)}</p>` +
    res.suggestions.map((s, i) => `
      <div class="transfer-card">
        <h4>#${i + 1} · ${s.type} · <span class="gain">+${s.gain.toFixed(2)} XP</span>
          ${s.hits ? `<span class="hit-cost"> · ${s.hits} hit(s)</span>` : ""}
          · cost ${s.costDiff >= 0 ? "+" : ""}${money(s.costDiff)}</h4>
        ${s.moves.map(m => `
          <div class="transfer-row">
            <span>OUT <strong>${m.out.web_name}</strong> (${m.out.team} ${money(m.out.price)} · ${xpOf(m.out).toFixed(1)})</span>
            <span>→</span>
            <span>IN <strong>${m.inn.web_name}</strong> (${m.inn.team} ${money(m.inn.price)} · ${xpOf(m.inn).toFixed(1)})</span>
          </div>`).join("")}
        <button class="btn btn-cyan apply-tr" data-idx="${i}" style="margin-top:8px">Apply locally</button>
      </div>`).join("");
  box.querySelectorAll(".apply-tr").forEach(btn => {
    btn.addEventListener("click", () => applyTransferSuggestion(res.suggestions[+btn.dataset.idx]));
  });
}

function renderAITeams() {
  if (!isPro()) {
    showUpgradePrompt("teams");
    return;
  }
  const budget = parseFloat($("aiBudget").value) || 100;
  const box = $("aiTeamsResults");
  box.innerHTML = "<p class='muted'>Generating Wildcard & Free Hit squads…</p>";

  const savedHorizon = horizon;

  // Wildcard: multi-GW structure (horizon 3)
  horizon = 3;
  const wc = optimiseSquad(budget, { mode: "wildcard", horizonOverride: 3 });

  // Free Hit: next GW maximisation; exclude a few WC template players for diversity
  const templateIds = (wc.squad || [])
    .filter(p => p.selected_by_percent > 25)
    .slice(0, 4)
    .map(p => p.id);
  horizon = 1;
  const fh = optimiseSquad(budget, { mode: "freehit", horizonOverride: 1, excludeIds: templateIds });

  horizon = savedHorizon;

  const teams = [
    {
      label: "Wildcard Team",
      blurb: "Built for the next 3 GWs — structure, fixtures and longer-term value. Permanent changes.",
      data: wc,
    },
    {
      label: "Free Hit Team",
      blurb: "Built for the next GW only — maximise single-week points. Squad reverts after the GW.",
      data: fh,
    },
  ];

  box.innerHTML = teams.map((t, i) => {
    const c = t.data.counts || {};
    const ok15 = (c.total === 15) && c.GKP === 2 && c.DEF === 5 && c.MID === 5 && c.FWD === 3;
    return `
      <div class="team-card ai-team-card">
        <h4>${t.label}</h4>
        <p class="muted" style="font-size:0.85rem;margin:4px 0 10px">${t.blurb}</p>
        <div class="ai-meta">
          <span>XI XP ≈ <strong>${(t.data.xiXp || 0).toFixed(1)}</strong></span>
          <span>Cost <strong>${money(t.data.spent)}</strong></span>
          <span>Bank <strong>${money(t.data.bank)}</strong></span>
          <span>${ok15 ? "15/15 · 2-5-5-3" : `⚠ ${c.total || 0}/15 (${c.GKP}GK ${c.DEF}DF ${c.MID}MD ${c.FWD}FW)`}</span>
        </div>
        ${renderMiniPitch(t.data)}
        <button class="btn btn-blue use-team" data-idx="${i}" style="margin-top:12px">Use this team on Pick tab</button>
      </div>`;
  }).join("");

  window.__aiTeams = teams;
  box.querySelectorAll(".use-team").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = window.__aiTeams[+btn.dataset.idx].data;
      squad = t.squad; startingIds = t.startingIds; benchIds = t.benchIds;
      captainId = t.captainId; bank = t.bank;
      renderPitch(); renderPlayerList();
      document.querySelector('[data-view="pick"]').click();
      setStatus("AI team applied — review on Pick tab (" + (squad.length) + " players)");
    });
  });
}

function getChipPlan() {
  try { return JSON.parse(localStorage.getItem("fpl_chip_plan_v1") || "{}"); } catch { return {}; }
}
function saveChipPlan(plan) {
  try { localStorage.setItem("fpl_chip_plan_v1", JSON.stringify(plan)); } catch (_) {}
}

const CHIP_META = {
  bb: { name: "Bench boost", desc: "Includes points scored by your benched players in your total for a gameweek. Best in a double gameweek when all 15 play." },
  fh: { name: "Free hit", desc: "Make unlimited transfers for one gameweek only; squad reverts after. Use on a blank gameweek." },
  wc: { name: "Wildcard", desc: "Unlimited transfers for the week you activate it; changes are permanent. WC1 early season, WC2 for blank/double clusters." },
  tc: { name: "Triple captain", desc: "Captain scores 3× points. Best on a premium in a double gameweek." },
};

function renderChips() {
  const plan = getChipPlan();
  const grid = $("chipGrid");
  if (!grid) return;
  const keys = ["bb", "fh", "wc", "tc"];
  grid.innerHTML = keys.map(k => {
    const gw = plan[k];
    const meta = CHIP_META[k];
    return `<div class="chip-item ${gw ? "planned" : ""}" data-chip="${k}" style="cursor:pointer">
      <div class="chip-name">${meta.name}</div>
      <div class="chip-state ${gw ? "set" : ""}">${gw ? "GW " + gw : "Not set"}</div>
    </div>`;
  }).join("");
  grid.querySelectorAll(".chip-item").forEach(el => {
    el.addEventListener("click", () => openChipModal(el.dataset.chip));
  });
  $("chipAdviceShort").innerHTML = `<p><strong>Tap a chip</strong> to choose the gameweek you plan to play it.</p>
    <p class="muted">This is a planner only — you still activate chips on the official FPL site before the deadline.</p>`;
}

function openChipModal(key) {
  chipModalKey = key;
  const meta = CHIP_META[key];
  const plan = getChipPlan();
  $("chipModalTitle").textContent = meta.name;
  $("chipModalDesc").textContent = meta.desc;
  const sel = $("chipGwSelect");
  sel.innerHTML = "";
  const maxGw = 38;
  for (let g = currentGw; g <= maxGw; g++) {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = "Gameweek " + g;
    if (plan[key] == g) opt.selected = true;
    sel.appendChild(opt);
  }
  $("chipModal").classList.remove("hidden");
}

function closeChipModal() {
  $("chipModal").classList.add("hidden");
  chipModalKey = null;
}

// chip modal buttons bound once
document.addEventListener("DOMContentLoaded", () => {});
on("chipSaveBtn", "click", () => {
  if (!chipModalKey) return;
  const plan = getChipPlan();
  plan[chipModalKey] = parseInt($("chipGwSelect").value, 10);
  saveChipPlan(plan);
  closeChipModal();
  renderChips();
});
on("chipCancelBtn", "click", closeChipModal);
on("chipClearBtn", "click", () => {
  if (!chipModalKey) return;
  const plan = getChipPlan();
  delete plan[chipModalKey];
  saveChipPlan(plan);
  closeChipModal();
  renderChips();
});


function loadDefaultSquad() {
  const ids = [...DEFAULT_SQUAD_IDS.starting, ...DEFAULT_SQUAD_IDS.bench];
  squad = ids.map(id => players.find(p => p.id === id)).filter(Boolean);
  startingIds = DEFAULT_SQUAD_IDS.starting.filter(id => squad.some(p => p.id === id));
  benchIds = DEFAULT_SQUAD_IDS.bench.filter(id => squad.some(p => p.id === id));
  captainId = DEFAULT_SQUAD_IDS.captain;
  const cost = squad.reduce((s, p) => s + p.price, 0);
  bank = Math.max(0, BUDGET - cost);
  return squad.length >= 11;
}

async function tryLoadUserTeam(teamId) {
  teamId = parseInt(teamId, 10);
  let teamName = null;
  try {
    const entry = await fetchJson(`entry/${teamId}/`);
    if (entry && entry.name) teamName = entry.name;
  } catch (_) {}

  // 1) Official picks for recent events
  for (const ev of [currentGw, 1, 2, 3, 4, 5]) {
    try {
      const picks = await fetchJson(`entry/${teamId}/event/${ev}/picks/`);
      if (!picks || !picks.picks || !picks.picks.length) continue;
      const ordered = [...picks.picks].sort((a, b) => a.position - b.position);
      const mapped = ordered.map(p => players.find(x => x.id === p.element)).filter(Boolean);
      if (mapped.length < 11) continue;
      squad = mapped;
      startingIds = ordered.filter(p => p.position <= 11).map(p => p.element);
      benchIds = ordered.filter(p => p.position > 11).map(p => p.element);
      const cap = ordered.find(p => p.is_captain);
      captainId = cap ? cap.element : startingIds[0];
      bank = Math.max(0, BUDGET - squad.reduce((s, p) => s + p.price, 0));
      return { source: "api", teamName };
    } catch (err) {
      // 404 pre-deadline is normal
    }
  }

  // No public picks yet — empty squad (user edits or uses AI Teams)
  squad = [];
  startingIds = [];
  benchIds = [];
  captainId = null;
  bank = BUDGET;
  return { source: "empty", teamName };
}

async function init(force = false) {
  const rawId = $("teamIdInput") && $("teamIdInput").value;
  const teamId = parseInt(rawId, 10);
  if (!teamId) {
    setStatus("Enter a Team ID above and press Refresh to load a squad.");
    loadPlan(); updatePlanUI();
    squad = []; startingIds = []; benchIds = []; captainId = null; bank = BUDGET;
    try {
      if (!bootstrap) { await loadBootstrap(force); await loadFixtures(); buildPlayers(); }
      renderPitch(); renderPlayerList(); renderChips(); updatePlanUI();
    } catch (e) { setStatus("Error: " + e.message); }
    return;
  }
  setStatus("Loading official FPL data…");
  loadPlan();
  updatePlanUI();
  try {
    try { ["fpl_boot_v1","fpl_boot_v2","fpl_boot_v3","fpl_boot_v4"].forEach(k => localStorage.removeItem(k)); } catch (_) {}
    await loadBootstrap(force);
    await loadFixtures();
    buildPlayers();
    const loaded = await tryLoadUserTeam(teamId);
    const tname = (loaded && loaded.teamName) ? loaded.teamName : ("Team " + teamId);
    if (loaded && loaded.source === "api") {
      setStatus(`GW ${currentGw} · ${tname} · official picks (${squad.length} players)`);
    } else if (loaded && loaded.source === "default") {
      setStatus(`GW ${currentGw} · ${tname} · draft fallback`);
    } else if (loaded && loaded.source === "empty") {
      setStatus(`GW ${currentGw} · ${tname} · no public picks yet — Optimise or Edit to build a squad`);
    } else {
      optimiseSquad();
      setStatus(`GW ${currentGw} · AI draft generated`);
    }
    updatePlanUI(); // re-check Pro lock if team ID differs from session
    renderPitch();
    renderPlayerList();
    renderChips();
    updatePlanUI();
    const lu = $("lastUpdated"); if (lu) lu.textContent = "Updated " + new Date().toLocaleString();
  } catch (e) {
    setStatus("Error: " + e.message);
    console.error(e);
  }
}


// ---------- Live Rank ----------
async function loadEntrySummary(teamId) {
  return fetchJson(`entry/${teamId}/`);
}

async function loadEntryHistory(teamId) {
  try {
    return await fetchJson(`entry/${teamId}/history/`);
  } catch {
    return null;
  }
}

function formatRank(n) {
  if (n == null || n === 0) return "–";
  return Number(n).toLocaleString();
}

async function renderLiveRank() {
  const teamId = parseInt(($("rankTeamId") && $("rankTeamId").value) || $("teamIdInput").value, 10) || DEFAULT_TEAM_ID;
  if ($("rankTeamId")) $("rankTeamId").value = teamId;
  const sumBox = $("rankSummary");
  const histBox = $("rankHistory");
  const leaguesBox = $("rankLeagues");
  if (!sumBox) return;
  sumBox.innerHTML = `<p class="muted">Loading rank data…</p>`;
  if (histBox) histBox.innerHTML = "";
  if (leaguesBox) leaguesBox.innerHTML = "";

  try {
    const entry = await loadEntrySummary(teamId);
    const history = await loadEntryHistory(teamId);

    const overallPts = entry.summary_overall_points;
    const overallRank = entry.summary_overall_rank;
    const gwPts = entry.summary_event_points;
    const gwRank = entry.summary_event_rank;
    const name = entry.name || "Your team";
    const currentEvent = entry.current_event;
    const seasonStarted = overallPts != null || (history && history.current && history.current.length);

    if (!seasonStarted) {
      sumBox.innerHTML = `
        <div class="rank-empty" style="grid-column:1/-1">
          <strong>${name}</strong> · Team ID ${teamId}<br>
          Gameweek 1 has not been scored yet.<br>
          Overall rank, GW points and history will appear here once the first matches are complete.
        </div>`;
      if (histBox) histBox.innerHTML = `<div class="rank-empty">No gameweek history yet.</div>`;
    } else {
      sumBox.innerHTML = `
        <div class="rank-metric"><span class="rm-label">Team</span><span class="rm-val" style="font-size:1rem">${name}</span></div>
        <div class="rank-metric"><span class="rm-label">Overall rank</span><span class="rm-val">${formatRank(overallRank)}</span></div>
        <div class="rank-metric"><span class="rm-label">Overall points</span><span class="rm-val">${overallPts ?? "–"}</span></div>
        <div class="rank-metric"><span class="rm-label">GW ${currentEvent || "–"} pts</span><span class="rm-val">${gwPts ?? "–"}</span>
          <div class="rm-sub">GW rank ${formatRank(gwRank)}</div></div>
      `;

      if (histBox && history && history.current && history.current.length) {
        const rows = [...history.current].reverse().slice(0, 15).map(h => {
          const delta = h.rank_sort ? "" : "";
          return `<tr>
            <td>GW ${h.event}</td>
            <td>${h.points}</td>
            <td>${h.total_points}</td>
            <td>${formatRank(h.rank)}</td>
            <td>${formatRank(h.overall_rank)}</td>
            <td>${h.event_transfers || 0}${h.event_transfers_cost ? ` (−${h.event_transfers_cost})` : ""}</td>
            <td>£${((h.value || 0) / 10).toFixed(1)}m</td>
          </tr>`;
        }).join("");
        histBox.innerHTML = `
          <table>
            <thead><tr>
              <th>GW</th><th>Pts</th><th>Total</th><th>GW rank</th><th>Overall</th><th>Transfers</th><th>Value</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
      } else if (histBox) {
        histBox.innerHTML = `<div class="rank-empty">No scored gameweeks yet.</div>`;
      }
    }

    // Classic leagues
    if (leaguesBox) {
      const classic = (entry.leagues && entry.leagues.classic) || [];
      if (!classic.length) {
        leaguesBox.innerHTML = `<div class="rank-empty">No classic leagues found.</div>`;
      } else {
        const rows = classic.map(l => `
          <tr>
            <td>${l.name}</td>
            <td>${formatRank(l.entry_rank)}</td>
            <td>${formatRank(l.entry_last_rank)}</td>
            <td>${l.entry_rank && l.entry_last_rank
              ? (l.entry_rank < l.entry_last_rank
                  ? `<span class="rank-delta-up">↑ ${l.entry_last_rank - l.entry_rank}</span>`
                  : l.entry_rank > l.entry_last_rank
                    ? `<span class="rank-delta-down">↓ ${l.entry_rank - l.entry_last_rank}</span>`
                    : "–")
              : "–"}</td>
            <td>${l.rank_count ? formatRank(l.rank_count) : "–"}</td>
          </tr>`).join("");
        leaguesBox.innerHTML = `
          <table>
            <thead><tr>
              <th>League</th><th>Rank</th><th>Last</th><th>Δ</th><th>Size</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
      }
    }
  } catch (e) {
    sumBox.innerHTML = `<p class="muted">Could not load rank: ${e.message}. Rank data is only available after GW1 is live.</p>`;
  }
}


// Nav
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    btn.classList.add("active");
    $("view-" + btn.dataset.view).classList.add("active");
    if (btn.dataset.view === "transfers") renderTransfersUI();
    if (btn.dataset.view === "teams") { /* wait for button */ }
    if (btn.dataset.view === "rank") renderLiveRank();
    if (btn.dataset.view === "chips") renderChips();
  });
});

on("refreshBtn", "click", () => init(true));
on("loginBtn", "click", () => {
  const modal = $("loginModal");
  if (modal) modal.classList.remove("hidden");
  if ($("loginTeamId")) $("loginTeamId").value = currentTeamId();
});
on("logoutBtn", "click", () => { logout(); updatePlanUI(); });
on("loginSubmitBtn", "click", async () => {
  const tid = $("loginTeamId") && $("loginTeamId").value;
  const email = $("loginEmail") && $("loginEmail").value;
  const res = attemptLogin(tid, "", email);
  const msg = $("loginMsg");
  if (msg) { msg.textContent = res.msg; msg.style.color = res.ok ? "#16a34a" : "#dc2626"; }
  if (res.ok) {
    const modal = $("loginModal");
    if (modal) modal.classList.add("hidden");
    await init(true);
  }
});
on("loginCancelBtn", "click", () => {
  const modal = $("loginModal");
  if (modal) modal.classList.add("hidden");
});
// Reload squad when Team ID changes + Enter / blur
const tidInput = $("teamIdInput");
if (tidInput) {
  tidInput.addEventListener("change", () => init(true));
  tidInput.addEventListener("keydown", (e) => { if (e.key === "Enter") init(true); });
}

on("refreshRankBtn", "click", () => renderLiveRank());
on("optimiseBtn", "click", () => { const r = optimiseLineup(); if (r && r.error) setStatus(r.error); else { renderPitch(); renderPlayerList(); setStatus("Lineup optimised from your current squad (best XI + captain)"); } });
on("resetBtn", "click", () => { squad = []; startingIds = []; benchIds = []; captainId = null; bank = BUDGET; renderPitch(); renderPlayerList(); });
function setEditMode(on) {
  editMode = on;
  document.body.classList.toggle("editing", on);
  const banner = $("editBanner");
  if (banner) banner.classList.toggle("hidden", !on);
  const st = $("editStatusInline");
  if (st) st.textContent = `Squad ${squad.length}/15 · Bank ${money(bank)}`;
  renderPitch();
  renderPlayerList();
}
on("editBtn", "click", () => setEditMode(true));
const doneBtn = $("doneEditBtn");
if (doneBtn) doneBtn.addEventListener("click", () => setEditMode(false));
on("runTransfersBtn", "click", renderTransfersUI);
on("genTeamsBtn", "click", renderAITeams);

document.querySelectorAll(".hz").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".hz").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    horizon = +btn.dataset.hz;
    renderPitch(); renderPlayerList();
  });
});
document.querySelectorAll(".pos-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".pos-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderPlayerList();
  });
});
["sortBy", "priceMin", "priceMax", "searchInput", "affordableOnly"].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener("input", () => {
    const a = parseFloat($("priceMin").value), b = parseFloat($("priceMax").value);
    $("priceRangeLabel").textContent = `£${a.toFixed(1)} – £${b.toFixed(1)}m`;
    renderPlayerList();
  });
});

let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); deferredPrompt = e; $("installBtn").hidden = false;
});
$("installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice;
  deferredPrompt = null; $("installBtn").hidden = true;
});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

window.addEventListener("error", (ev) => {
  try { setStatus("JS error: " + (ev.message || ev.error)); } catch(_) {}
});
init();
