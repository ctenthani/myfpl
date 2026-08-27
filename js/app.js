/* FPL Assistant – pitch UI, AI Transfers, AI Teams, Netlify proxy */

const API = "/api/fpl?path=";
const DEFAULT_TEAM_ID = null; // public site: no default team
const BUDGET = 100.0; // Starting budget only (£100.0m). Team *value* can rise above 100 as player prices rise.

// ============================================================
// PRICING (USD) + PAYPAL LINKS
// Annual = monthly × 12 × 0.80  (20% discount)
// ============================================================
/** All Pro/Ultra features free until end of 30 Nov 2026 (CAT). */
const FREE_UNTIL = new Date("2026-11-30T23:59:59+02:00");
function isFreePeriod() {
  return Date.now() <= FREE_UNTIL.getTime();
}

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

function voterKey() {
  try {
    let k = localStorage.getItem("fpl_voter_v1");
    if (!k) {
      k = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("fpl_voter_v1", k);
    }
    return k;
  } catch (_) {
    return "anon_" + Date.now();
  }
}

async function apiVotes(gw) {
  try {
    const r = await fetch("/api/votes?gw=" + encodeURIComponent(gw));
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; }
}

async function castVote(type, choice) {
  try {
    const r = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, gw: currentGw, choice: String(choice), voterKey: voterKey() }),
    });
    return await r.json();
  } catch (e) {
    return { error: String(e) };
  }
}

async function setMatchdaySubscription(email, teamId, matchday) {
  try {
    const r = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        teamId,
        matchday: !!matchday,
        plan: (authSession && authSession.plan) || "starter",
      }),
    });
    return await r.json();
  } catch (e) {
    return { error: String(e) };
  }
}


function $(id) { return document.getElementById(id); }
function on(id, evt, fn) {
  const el = $(id);
  if (el) el.addEventListener(evt, fn);
}
function money(n) { return "£" + Number(n).toFixed(1) + "m"; }

/** Current squad value at today's prices (can exceed £100.0m). */
function squadValue() {
  return squad.reduce((s, p) => s + (p.price || 0), 0);
}

/**
 * FPL money model:
 * - New / AI draft: total spend ≤ £100.0m, bank = 100 − spent
 * - Loaded entry: team value can be >100 after price rises; bank comes from API (or estimated)
 * Never force bank = 100 − value for a live team (that would go negative wrongly).
 */
function refreshBankAndValueDisplay() {
  const cost = squadValue();
  if (!squadLockedValue) {
    // Draft / editor starting from scratch
    bank = Math.max(0, BUDGET - cost);
  } else if (entryBank != null) {
    bank = entryBank;
  }
  // else keep existing bank (e.g. after local transfers)
  const ratingEl = $("mRating");
  // metrics updated by caller
  return { cost, bank };
}

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
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function rememberTeamId(id) {
  id = id || currentTeamId();
  try {
    if (id) localStorage.setItem("fpl_last_team_id", String(id));
  } catch (_) {}
}

function restoreTeamIdInput() {
  const input = $("teamIdInput");
  if (!input) return null;
  try {
    const u = new URL(location.href);
    const fromUrl = parseInt(u.searchParams.get("team"), 10);
    if (fromUrl > 0) {
      input.value = fromUrl;
      rememberTeamId(fromUrl);
      return fromUrl;
    }
  } catch (_) {}
  const typed = parseInt(input.value, 10);
  if (typed > 0) {
    rememberTeamId(typed);
    return typed;
  }
  try {
    const saved = parseInt(localStorage.getItem("fpl_last_team_id"), 10);
    if (saved > 0) {
      input.value = saved;
      return saved;
    }
  } catch (_) {}
  return null;
}

/** Pro only if session matches the Team ID currently loaded (owner always). */
function trialStillValid(sess) {
  if (!sess || !sess.trialEnds) return false;
  return Date.now() < Number(sess.trialEnds);
}

function isPro() {
  // Launch promo: everything unlocked until 30 Nov 2026
  if (isFreePeriod()) return true;
  if (!authSession) return false;
  if (authSession.plan === "owner") return true;
  if (authSession.paidUntil && Number(authSession.paidUntil) < Date.now()) return false;
  if (authSession.plan !== "pro" && authSession.plan !== "ultra" && authSession.plan !== "trial_pro" && authSession.plan !== "trial_ultra") return false;
  if (authSession.plan === "trial_pro" || authSession.plan === "trial_ultra") {
    if (!trialStillValid(authSession)) return false;
  }
  if (authSession.plan === "trial_pro" || authSession.plan === "trial_ultra") return true;
  return Number(authSession.teamId) === Number(currentTeamId());
}
function isUltra() {
  if (isFreePeriod()) return true;
  if (!authSession) return false;
  if (authSession.plan === "owner") return true;
  if (authSession.plan === "trial_ultra" && trialStillValid(authSession)) return true;
  if (authSession.plan !== "ultra") return false;
  return Number(authSession.teamId) === Number(currentTeamId());
}
function activePlanLabel() {
  if (isFreePeriod()) {
    const days = Math.max(0, Math.ceil((FREE_UNTIL.getTime() - Date.now()) / 86400000));
    return "Free access · until 30 Nov · " + days + "d left";
  }
  if (!authSession) return "Starter";
  if (authSession.plan === "owner") return "Owner";
  if (authSession.plan === "trial_pro" || authSession.plan === "trial_ultra") {
    if (!trialStillValid(authSession)) return "Starter";
    const days = Math.max(0, Math.ceil((Number(authSession.trialEnds) - Date.now()) / 86400000));
    return (authSession.plan === "trial_ultra" ? "Ultra trial" : "Pro trial") + " · " + days + "d left";
  }
  if (authSession && (authSession.plan === "pro" || authSession.plan === "ultra")) {
    if (Number(authSession.teamId) === Number(currentTeamId()) || authSession.plan === "owner") {
      return authSession.plan === "ultra" ? "Ultra" : "Pro";
    }
  }
  return "Starter";
}

function startTrial(level) {
  // level: "pro" | "ultra"
  const ends = Date.now() + 14 * 24 * 60 * 60 * 1000;
  saveAuthSession({
    teamId: currentTeamId() || null,
    plan: level === "ultra" ? "trial_ultra" : "trial_pro",
    email: (authSession && authSession.email) || "trial@local",
    trialEnds: ends,
    trialStarted: Date.now(),
  });
  setStatus((level === "ultra" ? "Ultra" : "Pro") + " trial started — 14 days, all features unlocked");
  updatePlanUI();
}

function setPlan() { /* legacy no-op – use login */ }

function localPaidHit(email, teamId) {
  const list = loadLocalMembers();
  const now = Date.now();
  return list.find(u => {
    if (Number(u.until || 0) && Number(u.until) < now) return false;
    const em = String(u.email || "").toLowerCase();
    const tid = Number(u.teamId) || 0;
    if (email && em && em === email) return true;
    if (teamId && tid && tid === Number(teamId)) return true;
    return false;
  });
}

async function lookupPaidMember(email, teamId) {
  const hit = PAID_USERS.find(u =>
    (email && String(u.email || "").toLowerCase() === email) ||
    (teamId && Number(u.teamId) === Number(teamId))
  );
  if (hit && (hit.plan === "pro" || hit.plan === "ultra")) return { ...hit, until: hit.until || 0 };
  const local = localPaidHit(email, teamId);
  if (local) return local;
  try {
    const q = new URLSearchParams();
    if (email) q.set("email", email);
    if (teamId) q.set("teamId", String(teamId));
    const r = await membersApi("?" + q.toString(), { method: "GET" });
    if (r.ok && r.json && r.json.found && r.json.active) return r.json;
  } catch (_) {}
  return null;
}

async function attemptLogin(teamId, code, email) {
  teamId = parseInt(teamId, 10);
  email = String(email || "").trim().toLowerCase();
  if (!email && !teamId) return { ok: false, msg: "Enter email or Team ID" };
  if (email === OWNER_EMAIL.toLowerCase()) {
    saveAuthSession({ teamId: teamId || null, plan: "owner", email });
    if (teamId && $("teamIdInput")) $("teamIdInput").value = teamId;
    return { ok: true, msg: "Signed in as Owner (full access on any team)" };
  }
  if (!email) return { ok: false, msg: "Enter your email" };
  if (!teamId) return { ok: false, msg: "Enter a valid Team ID" };

  const hit = await lookupPaidMember(email, teamId);
  if (hit && (hit.plan === "pro" || hit.plan === "ultra")) {
    saveAuthSession({
      teamId,
      plan: hit.plan,
      email,
      paidUntil: hit.until || null,
    });
    if ($("teamIdInput")) $("teamIdInput").value = teamId;
    const left = hit.until ? Math.max(0, Math.ceil((Number(hit.until) - Date.now()) / 86400000)) : null;
    return { ok: true, msg: `Signed in · ${hit.plan.toUpperCase()}` + (left != null ? ` · ${left}d left` : ` · team ${teamId}`) };
  }
  return { ok: false, msg: "No Pro/Ultra found for that email + Team ID. Pay first, then the owner activates your account." };
}

function loadLocalMembers() {
  try { return JSON.parse(localStorage.getItem("fpl_owner_members_v1") || "[]"); } catch (_) { return []; }
}
function saveLocalMembers(list) {
  try { localStorage.setItem("fpl_owner_members_v1", JSON.stringify(list)); } catch (_) {}
}

function logout() {
  saveAuthSession(null);
  setStatus("Signed out — Pro features locked");
}

function loadPlan() {
  loadAuthSession();
}

function updatePlanUI() {
  const ownNav = $("ownerNavBtn");
  if (ownNav) ownNav.classList.toggle("hidden", !(authSession && authSession.plan === "owner"));
  const badge = $("planBadge");
  if (badge) {
    const label = activePlanLabel();
    badge.textContent = label;
    badge.className = "plan-badge " + (label === "Owner" || label === "Ultra" ? "ultra" : label === "Pro" ? "pro" : "starter");
  }
  const authBtn = $("authBtn");
  if (authBtn) {
    const signed = authSession && (authSession.plan === "owner" || authSession.plan === "pro" || authSession.plan === "ultra" || ((authSession.plan === "trial_pro" || authSession.plan === "trial_ultra") && trialStillValid(authSession)));
    authBtn.textContent = signed ? "Sign out" : "Sign in";
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

/** Gameweek used for advice, fixtures, transfers: always the NEXT to play (is_next), not the last finished. */
function planningGw() {
  if (bootstrap && bootstrap.events) {
    const nx = bootstrap.events.find(e => e.is_next);
    if (nx) return nx.id;
    const cu = bootstrap.events.find(e => e.is_current && !e.finished);
    if (cu) return cu.id;
    // First event whose deadline is still in the future
    const now = Date.now();
    const upcoming = bootstrap.events
      .filter(e => e.deadline_time && new Date(e.deadline_time).getTime() > now - 2 * 3600 * 1000)
      .sort((a, b) => a.id - b.id);
    if (upcoming.length) return upcoming[0].id;
  }
  return currentGw || 1;
}

function syncPlanningGw() {
  const gw = planningGw();
  currentGw = gw;
  return gw;
}

let horizon = 1;
let squad = [];
let startingIds = [];
let benchIds = [];
let captainId = null;
let viceCaptainId = null;
let menuPlayerId = null;
let editMode = false;
let replaceSlot = null;

let bank = 0;
let entryBank = 0;
let chipModalKey = null;

const SQUAD_LIMITS = { GKP: 2, DEF: 5, MID: 5, FWD: 3 };

// Optional default draft IDs (unused when user has a Team ID / saved squad)
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
      expected_goals: parseFloat(p.expected_goals) || 0,
      expected_assists: parseFloat(p.expected_assists) || 0,
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
      transfers_in_event: p.transfers_in_event || 0,
      transfers_out_event: p.transfers_out_event || 0,
      starts: p.starts || 0,
      points_per_game: parseFloat(p.points_per_game) || 0,
      bps: p.bps || 0,
      ict_index: parseFloat(p.ict_index) || 0,
      value_season: parseFloat(p.value_season) || 0,
      value_form: parseFloat(p.value_form) || 0,
      ep_this: parseFloat(p.ep_this) || 0,
      // preseason / early season: market + FPL projection signals
      transfers_in: p.transfers_in || 0,
      transfers_out: p.transfers_out || 0,
      xp: 0, xp3: 0,
    };
    return pl;
  });
  syncPlanningGw();
  recomputeAllXP();
  updateGwBanner();
}

/**
 * Predicted points model ( components, public data only).
 * Uses official ep_next + xG/xA rates + minutes likelihood + position scoring.
 * is higher because they blend Opta + bookie CS odds + proprietary minutes.
 * We scale toward realistic GW totals using the components below.
 */
function expectedPoints(p, hz = 1) {
  /**
   * Hybrid model:
   * - Trust official ep_next heavily pre-season / low sample
   * - Do NOT invent attacking upside for fringe players (low mins, low EO, cheap)
   * - Premiums (price/ownership) get limited structural floors only
   */
  const avail = p.availability ?? 1;
  const mins = p.minutes || 0;
  const own = p.selected_by_percent || 0;
  const price = p.price || 4;
  const ep = parseFloat(p.ep_next) || 0;
  const form = parseFloat(p.form) || 0;

  // Meaningful playing time only — 1–2 token minutes must NOT count as "played"
  const realMins = mins >= 90 ? mins : 0;
  const minsShare = Math.min(1, realMins / (Math.max(currentGw, 1) * 70));

  // Start probability: fringe players stay low
  let startProb =
    0.45 * avail +
    0.30 * minsShare +
    0.15 * Math.min(own / 25, 1) +
    0.10 * Math.min(price / 11, 1);

  // FPL ep_next is the best public minutes proxy pre-season
  if (ep >= 4.5) startProb += 0.20;
  else if (ep >= 3.5) startProb += 0.12;
  else if (ep >= 2.5) startProb += 0.05;
  else if (ep > 0 && ep < 2.0) startProb -= 0.12;

  // Unknown / unused attackers — but trust ownership + FPL ep in preseason
  if (realMins < 90 && own < 5 && price < 7 && ep < 3) startProb *= 0.45;
  if (realMins < 90 && own < 2 && price <= 5.5 && ep < 2.5) startProb *= 0.55;
  // Previous season minutes may be 0 on bootstrap; starts / ppg still carry signal
  if (realMins < 90 && (p.starts || 0) >= 15) startProb = Math.max(startProb, 0.55 + Math.min(0.25, own / 40));
  if (realMins < 90 && (p.points_per_game || 0) >= 4) startProb = Math.max(startProb, 0.5);

  startProb = Math.max(0.05, Math.min(0.95, startProb));

  const appearance = 2 * startProb;
  const goalPts = { GKP: 10, DEF: 6, MID: 5, FWD: 4 }[p.position] || 4;

  let xg90 = p.xg90 || 0;
  let xa90 = p.xa90 || 0;
  if (realMins > 200) {
    if (xg90 < 0.02 && (p.expected_goals || 0) > 0) xg90 = (Number(p.expected_goals) * 90) / realMins;
    if (xa90 < 0.02 && (p.expected_assists || 0) > 0) xa90 = (Number(p.expected_assists) * 90) / realMins;
  }

  // Floors ONLY for clearly nailed premiums — never for £4.5–6.0 squad fillers
  if (realMins < 200) {
    if (price >= 12 && own >= 15) { xg90 = Math.max(xg90, 0.40); xa90 = Math.max(xa90, 0.12); }
    else if (price >= 10 && own >= 10) { xg90 = Math.max(xg90, 0.22); xa90 = Math.max(xa90, 0.10); }
    else if (price >= 8 && own >= 8 && (p.position === "MID" || p.position === "FWD")) {
      xg90 = Math.max(xg90, 0.12); xa90 = Math.max(xa90, 0.08);
    }
    // else: leave xg/xa at true rates (often 0) for fringe players
  }

  const goalsXP = xg90 * (75 / 90) * goalPts * startProb;
  const assistsXP = xa90 * (75 / 90) * 3 * startProb;

  let csXP = 0;
  const fixMulNext = fixtureFactor(p.team_id, currentGw);
  if (p.position === "GKP" || p.position === "DEF") {
    const xgc = p.xgc90 || 1.25;
    let csProb = Math.max(0.04, Math.min(0.55, 0.48 - 0.14 * xgc));
    csProb *= 0.85 + 0.3 * (fixMulNext - 0.9);
    if (price >= 5.5 && own >= 5) csProb += 0.03;
    csXP = csProb * 4 * startProb;
  } else if (p.position === "MID") {
    csXP = 0.04 * startProb;
  }

  const ict = (p.influence || 0) + (p.creativity || 0) + (p.threat || 0);
  const bonusXP = (realMins > 200 || price >= 9)
    ? Math.min(1.2, ict / 800 + (price >= 9 ? 0.2 : 0)) * startProb
    : Math.min(0.35, ict / 1200) * startProb;

  const savesXP = p.position === "GKP" ? 0.5 * startProb : 0;
  const formXP = Math.min(1.2, form * 0.12);

  const component = appearance + goalsXP + assistsXP + csXP + bonusXP + savesXP + formXP;

  let base;
  if (form >= 1 || realMins > 400) {
    // In-season with sample: blend FPL + components
    base = 0.55 * ep + 0.45 * component;
  } else if (ep >= 3.5) {
    // FPL thinks they start — lean on ep, mild components
    base = 0.65 * ep + 0.35 * component;
  } else {
    // Pre-season fringe / low ep: STAY CLOSE to official ep_next
    // (fixes Dasilva-style £5.0m with 2 mins + ep 1.5 being inflated to 6+)
    base = 0.75 * ep + 0.25 * Math.min(component, ep + 1.2);
  }

  // Soft floors only if FPL itself projects a real starter
  if (ep >= 4) base = Math.max(base, ep * 0.9);
  else if (ep >= 2.5) base = Math.max(base, ep * 0.85);
  else base = Math.max(0.2, Math.min(base, Math.max(ep, 0.5) + 0.8));

  base *= fixMulNext;
  base *= avail;

  if (hz <= 1) return +base.toFixed(3);

  const weights = [1, 0.93, 0.86, 0.8, 0.75];
  let total = base * weights[0];
  for (let i = 1; i < hz; i++) {
    total += base * (weights[i] || 0.7) * fixtureFactor(p.team_id, currentGw + i);
  }
  return +total.toFixed(3);
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

function formatDeadline(iso) {
  if (!iso) return "–";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    });
  } catch (_) { return iso; }
}

function updateGwBanner() {
  if (!bootstrap) return;
  const gw = planningGw();
  currentGw = gw;
  const ev =
    bootstrap.events.find(e => e.id === gw) ||
    bootstrap.events.find(e => e.is_next) ||
    bootstrap.events.find(e => e.is_current);
  const name = ev ? (ev.name || ("Gameweek " + gw)) : ("Gameweek " + gw);
  const dl = ev ? formatDeadline(ev.deadline_time) : "–";
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set("mGw", String(gw));
  set("gwLabel", "Gameweek");
  set("mDeadline", dl);
  set("gwBannerTitle", name);
  set("gwBannerDeadline", "Deadline: " + dl);
}

function recomputeAllXP() {
  players.forEach(p => {
    p.xp = expectedPoints(p, 1);
    p.xp3 = expectedPoints(p, 3);
  });
}

// ---------- Squad optimise (15 then best XI) ----------

/** Rearrange the *current* 15-man squad into best XI + bench + captain. Does not buy/sell players. */
/** Exactly 1 GK in XI; rest legal mins where possible. */
function enforceValidXI() {
  if (!squad.length) return;
  const gk = squad.filter(p => p.position === "GKP");
  const outfield = squad.filter(p => p.position !== "GKP");
  let xi = [];
  let bench = [];
  // Prefer existing starting outfield, then fill
  const startOut = startingIds
    .map(id => squad.find(p => p.id === id))
    .filter(p => p && p.position !== "GKP");
  const restOut = outfield.filter(p => !startOut.some(x => x.id === p.id))
    .sort((a, b) => xpOf(b) - xpOf(a));
  const xiOut = [...startOut, ...restOut].slice(0, 10);
  const gkStart = gk.slice().sort((a, b) => xpOf(b) - xpOf(a));
  if (gkStart[0]) xi.push(gkStart[0]);
  xi.push(...xiOut);
  // pad if needed
  while (xi.length < 11 && restOut.length) {
    const p = restOut.find(x => !xi.some(y => y.id === x.id));
    if (!p) break;
    xi.push(p);
  }
  const xiIds = new Set(xi.map(p => p.id));
  bench = squad.filter(p => !xiIds.has(p.id));
  // second GK always on bench first
  bench.sort((a, b) => {
    if (a.position === "GKP" && b.position !== "GKP") return -1;
    if (b.position === "GKP" && a.position !== "GKP") return 1;
    return 0;
  });
  startingIds = xi.slice(0, 11).map(p => p.id);
  benchIds = bench.map(p => p.id);
  if (captainId && !startingIds.includes(captainId)) captainId = startingIds[0] || null;
  if (viceCaptainId && !startingIds.includes(viceCaptainId)) viceCaptainId = null;
  if (viceCaptainId === captainId) viceCaptainId = null;
}

function assignCaptainAndVice(fromIds) {
  const ids = (fromIds && fromIds.length ? fromIds : startingIds).filter(Boolean);
  const ranked = ids
    .map(id => players.find(p => p.id === id) || squad.find(p => p.id === id))
    .filter(Boolean)
    .sort((a, b) => xpOf(b) - xpOf(a));
  captainId = ranked[0]?.id || null;
  viceCaptainId = ranked[1]?.id || null;
  if (viceCaptainId === captainId) viceCaptainId = ranked[2]?.id || null;
}

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
  assignCaptainAndVice(bestXI.map(p => p.id));
  squad = [...bestXI, ...bench];
  enforceValidXI();
  bank = Math.max(0, BUDGET - squad.reduce((s, p) => s + p.price, 0));
  saveSquadLocal();
  return { ok: true, xiXp: bestXI.reduce((s, p) => s + xpOf(p), 0) };
}

function optimiseSquad(budget = BUDGET, opts = {}) {
  budget = Math.min(Number(budget) || BUDGET, BUDGET); // hard cap £100.0m starting squads
  // opts.mode: "wildcard" | "freehit" | "balanced"
  // opts.excludeIds: number[]
  // opts.horizonOverride: 1 | 3
  const mode = opts.mode || "balanced";
  const exclude = new Set(opts.excludeIds || []);
  const savedH = horizon;
  if (opts.horizonOverride) horizon = opts.horizonOverride;

  const scoreOf = (p) => {
    let s = xpOf(p);
    // Preseason / early GW: blend FPL projection, ownership (nailedness proxy),
    // transfer market momentum, and last-season-style fields still on the bootstrap.
    if (currentGw <= 2 || (p.minutes || 0) < 90) {
      const ep = parseFloat(p.ep_next) || 0;
      const own = p.selected_by_percent || 0;
      const tin = Math.min(1.2, (p.transfers_in_event || p.transfers_in || 0) / 250000);
      const ppg = p.points_per_game || 0;
      const startsBoost = Math.min(0.8, (p.starts || 0) / 20);
      const form = parseFloat(p.form) || 0;
      // Preseason form / last-season PPG + starts used for GW1 drafts
      s = 0.40 * s + 0.28 * ep + 0.12 * Math.min(own / 20, 2.5) + 0.08 * tin
        + 0.06 * ppg + 0.04 * startsBoost + 0.04 * Math.min(form, 8);
    }
    if (mode === "freehit") {
      s = (p.xp || s) * 1.12 + (p.form || 0) * 0.15 + (parseFloat(p.ep_next) || 0) * 0.1;
    } else if (mode === "wildcard") {
      s = (p.xp3 || s) + (p.price >= 7 ? 0.25 : 0) + Math.min(0.4, (p.selected_by_percent || 0) / 80);
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
  let xiOrdered = bestXI.filter(p => full.some(x => x.id === p.id)).slice(0, 11);
  let benchOut = full.filter(p => !xiOrdered.some(x => x.id === p.id));
  let squadOut = [...xiOrdered, ...benchOut].slice(0, 15);
  // Hard enforce ≤ budget (default £100.0m): swap expensive for cheaper same-pos if needed
  let realSpent = squadOut.reduce((s, p) => s + p.price, 0);
  if (realSpent > budget + 0.001) {
    const byPosPool = { GKP: [], DEF: [], MID: [], FWD: [] };
    pool.forEach(p => byPosPool[p.position].push(p));
    Object.keys(byPosPool).forEach(k => byPosPool[k].sort((a, b) => a.price - b.price));
    for (let guard = 0; guard < 40 && realSpent > budget + 0.001; guard++) {
      const ordered = [...squadOut].sort((a, b) => b.price - a.price);
      let fixed = false;
      for (const expensive of ordered) {
        const cheaper = byPosPool[expensive.position].find(c =>
          c.price < expensive.price - 0.05 &&
          !squadOut.some(s => s.id === c.id) &&
          squadOut.filter(s => s.team_id === c.team_id && s.id !== expensive.id).length < 3 &&
          realSpent - expensive.price + c.price <= budget + 0.05
        );
        if (!cheaper) continue;
        squadOut = squadOut.map(s => s.id === expensive.id ? cheaper : s);
        realSpent = squadOut.reduce((s, p) => s + p.price, 0);
        fixed = true;
        break;
      }
      if (!fixed) break;
    }
    // rebuild XI from adjusted 15
    const bp = { GKP: [], DEF: [], MID: [], FWD: [] };
    squadOut.forEach(p => bp[p.position].push(p));
    Object.keys(bp).forEach(k => bp[k].sort((a, b) => scoreOf(b) - scoreOf(a)));
    xiOrdered = [bp.GKP[0], ...bp.DEF.slice(0, 3), ...bp.MID.slice(0, 4), ...bp.FWD.slice(0, 3)].filter(Boolean);
    if (xiOrdered.length < 11) {
      const rest = squadOut.filter(p => !xiOrdered.includes(p) && p.position !== "GKP").sort((a, b) => scoreOf(b) - scoreOf(a));
      while (xiOrdered.length < 11 && rest.length) xiOrdered.push(rest.shift());
    }
    xiOrdered = xiOrdered.slice(0, 11);
    const ids = new Set(xiOrdered.map(p => p.id));
    benchOut = squadOut.filter(p => !ids.has(p.id));
    squadOut = [...xiOrdered, ...benchOut].slice(0, 15);
    realSpent = squadOut.reduce((s, p) => s + p.price, 0);
  }
  const rankedCap = xiOrdered.slice().sort((a, b) => scoreOf(b) - scoreOf(a));
  const cap = rankedCap[0]?.id || null;
  const vice = rankedCap[1]?.id || null;

  horizon = savedH;
  return {
    spent: realSpent,
    bank: Math.max(0, +(budget - realSpent).toFixed(1)),
    xiXp: xiOrdered.reduce((s, p) => s + xpOf(p), 0),
    squad: squadOut,
    startingIds: xiOrdered.map(p => p.id),
    benchIds: benchOut.map(p => p.id),
    captainId: cap,
    viceCaptainId: vice,
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
function getTransferFilters() {
  const rawN = ($("cfNumTransfers") && $("cfNumTransfers").value) || "1";
  const unlimitedCustom = rawN === "unlimited";
  return {
    unlimitedCustom,
    numTransfers: unlimitedCustom ? 3 : (parseInt(rawN, 10) || 1),
    position: ($("cfPosition") && $("cfPosition").value) || "",
    teamId: parseInt(($("cfTeam") && $("cfTeam").value) || "", 10) || 0,
    maxEO: parseFloat(($("cfMaxEO") && $("cfMaxEO").value) || "100") || 100,
    maxPrice: parseFloat(($("cfMaxPrice") && $("cfMaxPrice").value) || "15") || 15,
    minPrice: parseFloat(($("cfMinPrice") && $("cfMinPrice").value) || "4") || 4,
    playerIn: (($("cfPlayerIn") && $("cfPlayerIn").value) || "").trim().toLowerCase(),
    playerOut: (($("cfPlayerOut") && $("cfPlayerOut").value) || "").trim().toLowerCase(),
  };
}

function passInFilters(p, f) {
  if (!f) return true;
  if (f.position && p.position !== f.position) return false;
  if (f.teamId && p.team_id !== f.teamId) return false;
  if ((p.selected_by_percent || 0) > f.maxEO + 0.01) return false;
  if (p.price > f.maxPrice + 0.05) return false;
  if (p.price < f.minPrice - 0.05) return false;
  if (f.playerIn && !p.web_name.toLowerCase().includes(f.playerIn)) return false;
  return true;
}

function passOutFilters(p, f) {
  if (!f) return true;
  if (f.position && p.position !== f.position) return false;
  if (f.playerOut && !p.web_name.toLowerCase().includes(f.playerOut)) return false;
  return true;
}

function isUnlimitedTransferMode() {
  const modeEl = $("trMode");
  if (modeEl && modeEl.value === "unlimited") return true;
  // Auto unlimited only before the first deadline of the season
  const gw = planningGw();
  if (gw <= 1 && bootstrap && bootstrap.events) {
    const e1 = bootstrap.events.find(e => e.id === 1);
    if (e1 && e1.deadline_time && Date.now() < new Date(e1.deadline_time).getTime()) return true;
  }
  return false;
}

function transferXp(p) {
  const hz = parseInt(($("trHorizon") && $("trHorizon").value) || "3", 10) || 3;
  if (hz <= 1) return expectedPoints(p, 1);
  if (hz >= 6) return expectedPoints(p, 3) * 2; // rough 6-GW scale from 3-GW model
  return expectedPoints(p, 3);
}

function findTransfers(freeTransfers = 1, maxHits = 1, filters = null) {
  if (!squad.length) {
    return { error: "No squad loaded. Enter Team ID and Refresh, or Edit a full 15." };
  }
  let unlimited = isUnlimitedTransferMode() || !!(filters && filters.unlimitedCustom);
  if (unlimited) {
    freeTransfers = Math.max(freeTransfers, 15);
    maxHits = 0;
  }

  // Target number of moves: custom filter wins; else free transfers; unlimited defaults to 3
  let targetN;
  if (filters && filters.numTransfers) targetN = filters.numTransfers;
  else if (unlimited) targetN = Math.min(3, Math.max(1, parseInt(($("ftInput") && $("ftInput").value) || "3", 10) || 3));
  else targetN = Math.max(1, freeTransfers || 1);

  // Cap search size
  targetN = Math.min(targetN, 5);

  const squadIds = new Set(squad.map(p => p.id));
  const currentXp = squad.reduce((s, p) => s + transferXp(p), 0);
  const availableBudget = bank;

  let outs = [...squad].sort((a, b) => transferXp(a) - transferXp(b));
  if (filters) outs = outs.filter(p => passOutFilters(p, filters));
  // Prefer selling weak starters / low XP; keep one GK only if both GKs are terrible
  outs = outs.slice(0, 14);

  function isValidIn(out, inn, usedOutIds, usedInIds, budgetLeft, currentSquadLike) {
    if (!inn || inn.position !== out.position) return false;
    if (squadIds.has(inn.id) && !usedOutIds.has(inn.id)) return false;
    if (usedInIds.has(inn.id)) return false;
    if (inn.price > budgetLeft + 0.05) return false;
    if ((inn.availability || 1) < 0.3) return false;
    if (transferXp(inn) <= transferXp(out) + 0.05) return false;
    if (!(parseFloat(inn.ep_next) >= 2.0 || (inn.selected_by_percent || 0) >= 5 || (inn.minutes || 0) >= 200 || (filters && filters.playerIn))) return false;
    if (!passInFilters(inn, filters)) return false;
    const clubCount = currentSquadLike.filter(x => x.team_id === inn.team_id && !usedOutIds.has(x.id)).length
      + [...usedInIds].filter(id => {
          const pl = players.find(pp => pp.id === id);
          return pl && pl.team_id === inn.team_id;
        }).length;
    if (clubCount >= 3) return false;
    return true;
  }

  function bestInsFor(out, usedOutIds, usedInIds, budgetLeft, currentSquadLike) {
    return players
      .filter(p => isValidIn(out, p, usedOutIds, usedInIds, budgetLeft, currentSquadLike))
      .sort((a, b) => (transferXp(b) - transferXp(out)) - (transferXp(a) - transferXp(out)))
      .slice(0, 10);
  }

  /** Greedy N-transfer package: repeatedly sell lowest XP, buy best upgrade under residual bank */
  function greedyPackage(n, outPool) {
    const usedOut = new Set();
    const usedIn = new Set();
    const moves = [];
    let budgetLeft = availableBudget;
    let workingOuts = outPool.filter(o => !usedOut.has(o.id));

    for (let step = 0; step < n; step++) {
      let best = null;
      for (const out of workingOuts) {
        if (usedOut.has(out.id)) continue;
        const ins = bestInsFor(out, usedOut, usedIn, budgetLeft + out.price, squad);
        for (const inn of ins.slice(0, 5)) {
          const gain = transferXp(inn) - transferXp(out);
          if (!best || gain > best.gain + 0.001 || (Math.abs(gain - best.gain) < 0.05 && inn.price < best.inn.price)) {
            best = { out, inn, gain };
          }
        }
      }
      if (!best || best.gain <= 0.05) break;
      moves.push(best);
      usedOut.add(best.out.id);
      usedIn.add(best.inn.id);
      budgetLeft = budgetLeft + best.out.price - best.inn.price;
      workingOuts = workingOuts.filter(o => o.id !== best.out.id);
    }
    if (!moves.length) return null;
    const hits = unlimited ? 0 : Math.max(0, moves.length - freeTransfers);
    if (hits > maxHits) return null;
    const gain = moves.reduce((s, m) => s + m.gain, 0);
    const costDiff = moves.reduce((s, m) => s + m.inn.price - m.out.price, 0);
    return {
      moves,
      gain,
      costDiff,
      hits,
      netGain: gain - hits * 4,
      size: moves.length,
    };
  }

  const candidates = [];

  // Primary: best package of exactly targetN
  const primary = greedyPackage(targetN, outs);
  if (primary) candidates.push(primary);

  // Alternates: same N but force different first sell (diversity)
  if (outs.length > 1) {
    for (let i = 0; i < Math.min(4, outs.length); i++) {
      const rotated = outs.slice(i).concat(outs.slice(0, i));
      const alt = greedyPackage(targetN, rotated);
      if (!alt) continue;
      const key = alt.moves.map(m => m.out.id + ">" + m.inn.id).sort().join("|");
      if (candidates.some(c => c.moves.map(m => m.out.id + ">" + m.inn.id).sort().join("|") === key)) continue;
      candidates.push(alt);
      if (candidates.length >= 3) break;
    }
  }

  // If no N-pack, try smaller N
  if (!candidates.length) {
    for (let n = targetN - 1; n >= 1; n--) {
      const pack = greedyPackage(n, outs);
      if (pack) { candidates.push(pack); break; }
    }
  }

  candidates.sort((a, b) => b.netGain - a.netGain);

  return {
    currentXp,
    suggestions: candidates.slice(0, 3),
    bank: availableBudget,
    unlimited,
    freeTransfers: unlimited ? "∞" : freeTransfers,
    targetN,
  };
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
      if (viceCaptainId === m.out.id) viceCaptainId = m.inn.id;
    }
  }
  // Rebuild XI preference by XP (legal-ish formation)
  const all = [...squad];
  const byPos = { GKP: [], DEF: [], MID: [], FWD: [] };
  all.forEach(p => byPos[p.position].push(p));
  Object.keys(byPos).forEach(k => byPos[k].sort((a, b) => xpOf(b) - xpOf(a)));
  const xi = [];
  if (byPos.GKP[0]) xi.push(byPos.GKP[0]);
  xi.push(...byPos.DEF.slice(0, 3));
  xi.push(...byPos.MID.slice(0, 4));
  xi.push(...byPos.FWD.slice(0, 3));
  while (xi.length < 11) {
    const rest = all.filter(p => !xi.includes(p) && p.position !== "GKP").sort((a, b) => xpOf(b) - xpOf(a));
    if (!rest.length) break;
    xi.push(rest.shift());
  }
  // ensure at least 3 DEF
  while (xi.filter(p => p.position === "DEF").length < 3) {
    const d = byPos.DEF.find(p => !xi.includes(p));
    if (!d) break;
    const drop = xi.filter(p => p.position !== "GKP" && p.position !== "DEF").sort((a, b) => xpOf(a) - xpOf(b))[0];
    if (!drop) break;
    xi[xi.indexOf(drop)] = d;
  }
  startingIds = xi.slice(0, 11).map(p => p.id);
  benchIds = all.filter(p => !startingIds.includes(p.id)).map(p => p.id);
  assignCaptainAndVice(startingIds);
  saveSquadLocal();
  renderPitch();
  renderPlayerList();
  setStatus("Transfers applied — viewing updated squad on Pick");
  // Return to Pick tab so user sees the changed squad
  const pickBtn = document.querySelector('.nav-btn[data-view="pick"]');
  if (pickBtn) pickBtn.click();
  else {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    const pick = document.getElementById("view-pick");
    if (pick) pick.classList.add("active");
  }
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
function playerCard(p, isCaptain = false, isVice = false, showPos = false) {
  const pts = xpOf(p).toFixed(1);
  const shirt = shirtUrl(p);
  const shirtHtml = shirt
    ? `<img class="shirt-img" src="${shirt}" alt="${p.team}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
       <div class="shirt shirt-fallback" style="display:none;background:${shirtFor(p.team)}">${posEmoji(p.position)}</div>`
    : `<div class="shirt" style="background:${shirtFor(p.team)}">${posEmoji(p.position)}</div>`;
  const cls = ["pcard"];
  if (isCaptain) cls.push("captain");
  else if (isVice) cls.push("vice");
  const posLab = showPos
    ? `<div class="ppos ${(p.position || "").toLowerCase()}">${p.position === "GKP" ? "GK" : p.position}</div>`
    : "";
  const fx = (typeof fixtureChipsHtml === "function") ? fixtureChipsHtml(p, horizon >= 3 ? 3 : 1) : "";
  return `
    <div class="${cls.join(" ")}" data-id="${p.id}" title="${p.news || p.web_name}">
      ${shirtHtml}
      ${posLab}
      <div class="pname">${p.web_name}</div>
      <div class="pprice">${money(p.price)}</div>
      <div class="ppts"><span>${pts}</span></div>
      ${fx}
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
  const benchHtml = bench.map(p => playerCard(p, false, false, true)).join("");
  return `<div class="ai-pitch pitch">${rows}</div>
    <div class="bench-label">Bench</div>
    <div class="bench ai-bench">${benchHtml}</div>`;
}

function hidePlayerMenu() {
  const m = $("playerMenu");
  if (m) m.classList.add("hidden");
  menuPlayerId = null;
}

function openPlayerMenu(playerId, evt) {
  const p = squad.find(x => x.id === playerId);
  if (!p) return;
  menuPlayerId = playerId;
  const menu = $("playerMenu");
  if (!menu) return;
  menu.classList.remove("hidden");
  const x = Math.min(window.innerWidth - 220, Math.max(8, (evt.clientX || 40) - 20));
  const y = Math.min(window.innerHeight - 280, Math.max(8, (evt.clientY || 80)));
  menu.style.left = x + "px";
  menu.style.top = y + "px";
}

function fixtureChipsHtml(p, n) {
  n = n || (horizon >= 3 ? 3 : 1);
  const fxt = nextFixturesFor(p.team_id, n);
  if (!fxt.length) {
    return `<div class="fix-chips"><span class="fix-chip blank">TBC</span></div>`;
  }
  const gw0 = planningGw();
  const base = expectedPoints(p, 1);
  const nextMul = fixtureFactor(p.team_id, gw0) || 1;
  return `<div class="fix-chips">` + fxt.map(f => {
    const home = f.team_h === p.team_id;
    const oppId = home ? f.team_a : f.team_h;
    const opp = (teamsMap[oppId] && (teamsMap[oppId].short_name || teamsMap[oppId].name)) || "?";
    const diff = home ? (f.team_h_difficulty || 3) : (f.team_a_difficulty || 3);
    const mul = fixtureFactor(p.team_id, f.event || gw0);
    const pts = (base / (nextMul || 1)) * mul;
    return `<span class="fix-chip fdr-${diff}" title="GW${f.event} ${opp} (${home ? "H" : "A"})">${pts.toFixed(1)}<small>${opp} (${home ? "H" : "A"})</small></span>`;
  }).join("") + `</div>`;
}

function nextFixturesFor(teamId, n = 5) {
  if (!fixtures.length) return [];
  const gw0 = planningGw();
  const now = Date.now();
  return fixtures
    .filter(f => {
      if (!(f.team_h === teamId || f.team_a === teamId)) return false;
      if (f.finished || f.finished_provisional) return false;
      const ev = f.event || 0;
      if (ev < gw0) return false;
      // Drop kickoffs more than 3h in the past even if not marked finished
      if (f.kickoff_time) {
        const ko = new Date(f.kickoff_time).getTime();
        if (Number.isFinite(ko) && ko < now - 3 * 3600 * 1000 && ev < gw0 + 1 && f.started) return false;
      }
      return true;
    })
    .sort((a, b) => (a.event || 0) - (b.event || 0) || (a.kickoff_time || "").localeCompare(b.kickoff_time || ""))
    .slice(0, n);
}

function showPlayerInfo(playerId) {
  const p = players.find(x => x.id === playerId) || squad.find(x => x.id === playerId);
  if (!p) return;
  const body = $("playerInfoBody");
  const modal = $("playerInfoModal");
  if (!body || !modal) return;
  const fxt = nextFixturesFor(p.team_id, 6);
  const base = expectedPoints(p, 1);
  const rows = fxt.map(f => {
    const home = f.team_h === p.team_id;
    const oppId = home ? f.team_a : f.team_h;
    const opp = (teamsMap[oppId] && (teamsMap[oppId].short_name || teamsMap[oppId].name)) || "?";
    // Scale next-GW base by relative fixture factor for that event
    const mul = fixtureFactor(p.team_id, f.event || currentGw);
    const nextMul = fixtureFactor(p.team_id, currentGw) || 1;
    const pts = (base / (nextMul || 1)) * mul;
    return `<div class="pi-fix-row"><span>GW${f.event} · ${opp} (${home ? "H" : "A"})</span><strong>${pts.toFixed(1)} pts</strong></div>`;
  }).join("") || `<p class="muted">No upcoming fixtures loaded.</p>`;
  const posLabel = p.position === "GKP" ? "Goalkeeper" : p.position === "DEF" ? "Defender" : p.position === "MID" ? "Midfielder" : "Forward";
  body.innerHTML = `
    <h2 class="pi-title">${p.web_name}</h2>
    <div class="pi-sub"><strong>${p.team}</strong> · ${posLabel}<br>${money(p.price)} · Own ${p.selected_by_percent}%</div>
    <div class="pi-stats">
      <div><strong>${p.total_points || 0}</strong><span>Total pts</span></div>
      <div><strong>${p.points_per_game || "–"}</strong><span>Pts / match</span></div>
      <div><strong>${p.selected_by_percent}%</strong><span>Selected by</span></div>
      <div><strong>${p.goals_scored || 0}</strong><span>Goals</span></div>
      <div><strong>${p.assists || 0}</strong><span>Assists</span></div>
      <div><strong>${p.bonus || 0}</strong><span>Bonus</span></div>
    </div>
    <div class="pi-stats">
      <div><strong>${base.toFixed(1)}</strong><span>XP next GW</span></div>
      <div><strong>${p.form || "–"}</strong><span>Form</span></div>
      <div><strong>${p.ep_next || "–"}</strong><span>FPL ep_next</span></div>
    </div>
    <div class="pi-section">Predicted points by fixture</div>
    ${rows}
    <div class="pi-news">${p.news ? ("News: " + p.news) : "No team news"} · Status: ${p.status || "a"}</div>
  `;
  modal.classList.remove("hidden");
}

function recommendTransferFor(playerId) {
  const out = squad.find(p => p.id === playerId);
  if (!out) return;
  const maxPrice = bank + out.price;
  const ins = players
    .filter(p => p.position === out.position && !squad.some(s => s.id === p.id) && p.price <= maxPrice + 0.05 && p.availability > 0.35)
    .sort((a, b) => xpOf(b) - xpOf(a))
    .slice(0, 5);
  if (!ins.length) {
    setStatus("No clear replacement under budget for " + out.web_name);
    return;
  }
  const box = $("transferResults");
  // Jump to transfers view
  document.querySelector('[data-view="transfers"]')?.click();
  const html = `<p class="muted">Recommended replacements for <strong>${out.web_name}</strong> (${money(out.price)} · ${xpOf(out).toFixed(1)} XP)</p>` +
    ins.map((inn, i) => {
      const gain = xpOf(inn) - xpOf(out);
      return `<div class="transfer-card">
        <h4>#${i + 1} · <span class="gain">${gain >= 0 ? "+" : ""}${gain.toFixed(2)} XP</span> · ${money(inn.price - out.price)}</h4>
        <div class="transfer-row">
          <span>OUT <strong>${out.web_name}</strong></span><span>→</span>
          <span>IN <strong>${inn.web_name}</strong> (${inn.team} · ${xpOf(inn).toFixed(1)})</span>
        </div>
        <button class="btn btn-cyan apply-one-tr" data-out="${out.id}" data-in="${inn.id}" style="margin-top:8px">Apply locally</button>
      </div>`;
    }).join("");
  if (box) {
    box.innerHTML = html;
    box.querySelectorAll(".apply-one-tr").forEach(btn => {
      btn.addEventListener("click", () => {
        const o = squad.find(p => p.id === +btn.dataset.out);
        const inn = players.find(p => p.id === +btn.dataset.in);
        if (!o || !inn) return;
        applyTransferSuggestion({ moves: [{ out: o, inn }] });
        saveSquadLocal();
        setStatus(`Transferred ${o.web_name} → ${inn.web_name}`);
      });
    });
  }
  setStatus("Recommend transfer open on AI Transfers");
}

function handlePlayerAction(act) {
  const id = menuPlayerId;
  hidePlayerMenu();
  if (!id) return;
  const p = squad.find(x => x.id === id);
  if (!p) return;
  if (act === "captain") {
    if (viceCaptainId === id) viceCaptainId = null;
    captainId = id;
    saveSquadLocal();
    renderPitch();
    setStatus("Captain: " + p.web_name);
  } else if (act === "vice") {
    if (captainId === id) {
      setStatus("Already captain — pick someone else as vice");
      return;
    }
    viceCaptainId = id;
    saveSquadLocal();
    renderPitch();
    setStatus("Vice captain: " + p.web_name);
  } else if (act === "sub") {
    const isStarter = startingIds.includes(id);
    if (isStarter) {
      // swap with best bench same eligibility loosely
      if (!benchIds.length) { setStatus("Bench is empty"); return; }
      const outIdx = startingIds.indexOf(id);
      // prefer same position on bench
      let inId = benchIds.find(bid => {
        const bp = squad.find(x => x.id === bid);
        return bp && bp.position === p.position;
      }) || benchIds[0];
      startingIds[outIdx] = inId;
      benchIds = benchIds.filter(x => x !== inId).concat([id]);
    } else {
      // promote to XI — demote lowest XP same or any
      const weak = [...startingIds]
        .map(sid => squad.find(x => x.id === sid))
        .filter(Boolean)
        .sort((a, b) => xpOf(a) - xpOf(b))[0];
      if (!weak) return;
      startingIds = startingIds.map(x => x === weak.id ? id : x);
      benchIds = benchIds.filter(x => x !== id).concat([weak.id]);
    }
    saveSquadLocal();
    renderPitch();
    setStatus("Line-up updated");
  } else if (act === "transfer") {
    // Soft transfer-out: enter edit mode and highlight
    editMode = true;
    const es = $("editStatusInline");
    if (es) es.textContent = "Transfer out: tap a replacement from the list (or remove " + p.web_name + ")";
    removePlayer(id);
    editMode = true;
    setStatus("Removed " + p.web_name + " — pick a replacement from the player list");
  } else if (act === "recommend") {
    recommendTransferFor(id);
  } else if (act === "info") {
    showPlayerInfo(id);
  }
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
    byPos[pos].forEach(p => { html += playerCard(p, p.id === captainId, p.id === viceCaptainId); });
    html += `</div>`;
  }
  $("pitch").innerHTML = html;
  const benchPlayers = benchIds.map(id => squad.find(x => x.id === id)).filter(Boolean);
  $("bench").innerHTML = benchPlayers.map(p => playerCard(p, false, p.id === viceCaptainId, true)).join("");

  const xi = squad.filter(p => startingIds.includes(p.id));
  const xiXp = xi.reduce((s, p) => s + xpOf(p), 0);
  const cap = squad.find(p => p.id === captainId);
  const pred = xiXp + (cap ? xpOf(cap) : 0);
  const cost = squadValue();
  if (!squadLockedValue) {
    bank = Math.max(0, BUDGET - cost);
  } else if (entryBank != null) {
    bank = entryBank;
  }
  const rating = Math.min(100, Math.round((pred / (horizon === 3 ? 90 : 55)) * 100));
  $("mRating").textContent = rating + "%";
  $("mPred").textContent = pred.toFixed(1);
  $("mBank").textContent = money(bank);
  $("mCost").textContent = money(cost);
  const r2 = $("mRating2"); if (r2) r2.textContent = rating + "%";
  const p2 = $("mPred2"); if (p2) p2.textContent = pred.toFixed(1);
  const b2 = $("mBank2"); if (b2) b2.textContent = money(bank);
  document.querySelectorAll(".pcard").forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (editMode) {
        removePlayer(+el.dataset.id);
        return;
      }
      openPlayerMenu(+el.dataset.id, e);
    });
  });
}

function populateTeamFilter() {
  const sel = $("teamFilter");
  if (!sel || sel.dataset.ready === "1") return;
  const clubs = Object.values(teamsMap || {}).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  clubs.forEach(c => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = (c.short_name || c.name) + " — " + (c.name || "");
    sel.appendChild(o);
  });
  sel.dataset.ready = "1";
}

function renderPlayerList() {
  populateTeamFilter();
  let pos = document.querySelector(".pos-tab.active")?.dataset.pos || "ALL";
  const sort = ($("sortBy") && $("sortBy").value) || "xp";
  const pMin = parseFloat($("priceMin") && $("priceMin").value) || 4;
  const pMax = parseFloat($("priceMax") && $("priceMax").value) || 15.5;
  const q = (($("searchInput") && $("searchInput").value) || "").toLowerCase();
  const affordable = $("affordableOnly") && $("affordableOnly").checked;
  const clubFilter = ($("teamFilter") && $("teamFilter").value) || "";
  const inSquad = new Set(squad.map(p => p.id));

  // Replacement mode: force position + recommend top upgrades
  if (replaceSlot && replaceSlot.position) {
    pos = replaceSlot.position;
    document.querySelectorAll(".pos-tab").forEach(b => {
      b.classList.toggle("active", b.dataset.pos === pos);
    });
  }

  let list = players.filter(p => {
    if (pos !== "ALL" && p.position !== pos) return false;
    if (clubFilter && String(p.team_id) !== String(clubFilter)) return false;
    if (p.price < pMin || p.price > pMax) return false;
    if (q && !p.web_name.toLowerCase().includes(q) && !(p.team || "").toLowerCase().includes(q)) return false;
    if (affordable && p.price > bank + 0.1) return false;
    return true;
  });

  list.sort((a, b) => {
    if (sort === "xp") return xpOf(b) - xpOf(a);
    if (sort === "price") return b.price - a.price;
    if (sort === "own") return b.selected_by_percent - a.selected_by_percent;
    return a.web_name.localeCompare(b.web_name);
  });

  function rowHtml(p, badge) {
    const fxt = nextFixturesFor(p.team_id, horizon >= 3 ? 3 : 1);
    const fxBits = fxt.map(f => {
      const home = f.team_h === p.team_id;
      const oppId = home ? f.team_a : f.team_h;
      const opp = (teamsMap[oppId] && (teamsMap[oppId].short_name || teamsMap[oppId].name)) || "?";
      const diff = home ? (f.team_h_difficulty || 3) : (f.team_a_difficulty || 3);
      return `<span class="fix-chip-mini fdr-${diff}">${opp}(${home ? "H" : "A"})</span>`;
    }).join(" ");
    return `<div class="prow ${inSquad.has(p.id) ? "in-squad" : ""}" data-id="${p.id}">
      <span class="dot"></span>
      <div>
        <div class="pname-row">${p.web_name}${badge || ""}${inSquad.has(p.id) ? ' <span class="in-team-tag">In team</span>' : ""}</div>
        <div class="pmeta">${p.team} · ${p.position === "GKP" ? "GK" : p.position} ${fxBits}</div>
      </div>
      <div class="pprice">${money(p.price)}</div>
      <div class="pxp">${xpOf(p).toFixed(1)}</div>
    </div>`;
  }

  let html = "";
  if (replaceSlot && replaceSlot.position) {
    const rec = list
      .filter(p => !inSquad.has(p.id) && p.position === replaceSlot.position && p.price <= bank + 0.05)
      .slice(0, 5);
    html += `<div class="rec-banner">Pick a replacement (${replaceSlot.position === "GKP" ? "GK" : replaceSlot.position}) for <strong>${replaceSlot.outName}</strong> · Bank ${money(bank)}</div>`;
    if (rec.length) {
      html += `<div class="rec-label">Recommended</div>`;
      html += rec.map(p => rowHtml(p, "")).join("");
      html += `<div class="rec-label">All ${replaceSlot.position === "GKP" ? "GK" : replaceSlot.position}</div>`;
    }
  }

  html += list.slice(0, 80).map(p => rowHtml(p, "")).join("");
  $("playerList").innerHTML = html || `<p class="muted">No players match filters.</p>`;

  if (editMode) {
    document.querySelectorAll(".prow").forEach(el => {
      el.addEventListener("click", () => addPlayer(+el.dataset.id));
    });
  }
}

function removePlayer(id) {
  if (!editMode) return;
  const out = squad.find(p => p.id === id);
  squad = squad.filter(p => p.id !== id);
  startingIds = startingIds.filter(x => x !== id);
  benchIds = benchIds.filter(x => x !== id);
  if (captainId === id) captainId = startingIds[0] || null;
  if (viceCaptainId === id) viceCaptainId = null;
  bank = Math.max(0, BUDGET - squad.reduce((s, p) => s + p.price, 0));
  while (startingIds.length < 11 && benchIds.length) startingIds.push(benchIds.shift());
  if (out) {
    replaceSlot = {
      position: out.position,
      maxPrice: bank + 20, // list ranked recommendations; affordability still enforced on add
      freed: out.price || 0,
      outName: out.web_name,
    };
    document.querySelectorAll(".pos-tab").forEach(b => {
      b.classList.toggle("active", b.dataset.pos === out.position || (out.position === "GKP" && b.dataset.pos === "GKP"));
    });
  }
  saveSquadLocal();
  renderPitch();
  renderPlayerList();
  const st = $("editStatusInline");
  if (st) st.textContent = out
    ? (`Pick replacement · ${out.web_name} out · Bank ${money(bank)}`)
    : (`Squad: ${squad.length}/15 · Bank ${money(bank)}`);
}

function addPlayer(id) {
  if (!editMode) return;
  if (squad.find(p => p.id === id) || squad.length >= 15) return;
  const p = players.find(x => x.id === id);
  if (!p) return;
  if (squad.filter(x => x.position === p.position).length >= SQUAD_LIMITS[p.position]) {
    const st = $("editStatusInline");
    if (st) st.textContent = `Max ${SQUAD_LIMITS[p.position]} ${p.position}`;
    return;
  }
  if (p.price > bank + 0.05) {
    const st = $("editStatusInline");
    if (st) st.textContent = "Not enough budget";
    return;
  }
  if (squad.filter(x => x.team_id === p.team_id).length >= 3) {
    const st = $("editStatusInline");
    if (st) st.textContent = "Max 3 per club";
    return;
  }
  squad.push(p);
  const gkInXi = startingIds.filter(sid => {
    const x = squad.find(s => s.id === sid);
    return x && x.position === "GKP";
  }).length;
  if (p.position === "GKP") {
    if (gkInXi >= 1 || startingIds.length >= 11) benchIds.push(p.id);
    else startingIds.push(p.id);
  } else if (startingIds.length < 11) {
    startingIds.push(p.id);
  } else {
    benchIds.push(p.id);
  }
  bank -= p.price;
  replaceSlot = null;
  enforceValidXI();
  assignCaptainAndVice(startingIds);
  saveSquadLocal();
  renderPitch();
  renderPlayerList();
  const st = $("editStatusInline");
  if (st) st.textContent = `Added ${p.web_name}. ${squad.length}/15 · ${money(bank)}`;
}

function showUpgradePrompt(feature) {
  const boxId = feature === "transfers" ? "transferResults" : "aiTeamsResults";
  const box = $(boxId);
  if (!box) return;
  if (isFreePeriod()) {
    box.innerHTML = `<div class="upgrade-card"><p><strong>Free access is on until 30 November 2026.</strong> All Pro/Ultra tools are unlocked — refresh if a tab still looks locked.</p></div>`;
    return;
  }
  box.innerHTML = `
    <div class="upgrade-card">
      <h3>🔒 Pro feature</h3>
      <p>${feature === "transfers"
        ? "AI Transfer suggestions are available on <strong>Pro</strong> and <strong>Ultra</strong>."
        : "AI Teams (Wildcard / Free Hit squads) are available on <strong>Pro</strong> and <strong>Ultra</strong>."}</p>

      <div style="margin-top:14px;padding:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px">
        <strong>14-day free trial</strong>
        <p class="muted" style="margin:6px 0 10px;font-size:0.85rem">Unlock all Pro/Ultra features free for 14 days. No payment now.</p>
        <div class="upgrade-actions" style="flex-wrap:wrap;gap:8px">
          <button type="button" class="btn btn-blue" id="trialProBtn">Start Pro trial</button>
          <button type="button" class="btn btn-outline" id="trialUltraBtn">Start Ultra trial</button>
        </div>
      </div>

      <div style="margin-top:14px">
        <strong style="font-size:0.9rem">Or pay monthly / yearly</strong>
        <div class="upgrade-actions" style="flex-wrap:wrap;gap:8px;margin-top:6px">
          <a class="btn btn-blue" href="${PAYPAL_PRO_MONTHLY}" target="_blank" rel="noopener">Pro $${PRICING.pro.monthly}/mo</a>
          <a class="btn btn-outline" href="${PAYPAL_ULTRA_MONTHLY}" target="_blank" rel="noopener">Ultra $${PRICING.ultra.monthly}/mo</a>
          <a class="btn btn-blue" href="${PAYPAL_PRO_YEARLY}" target="_blank" rel="noopener">Pro $${PRICING.pro.yearly}/yr</a>
          <a class="btn btn-outline" href="${PAYPAL_ULTRA_YEARLY}" target="_blank" rel="noopener">Ultra $${PRICING.ultra.yearly}/yr</a>
        </div>
      </div>

      <div class="manual-pay" style="margin-top:14px;padding:12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">
        <strong>Mobile money (Malawi)</strong>
        <p style="margin:8px 0 0;font-size:0.85rem">Airtel *247# Till <strong>${MERCHANT_TILLS.airtel}</strong> · TNM *444# Till <strong>${MERCHANT_TILLS.tnm}</strong></p>
      </div>

      <div style="margin-top:12px">
        <button type="button" class="btn btn-ghost" id="demoUnlockBtn">Demo unlock (this device only)</button>
      </div>
    </div>`;
  const afterUnlock = () => {
    updatePlanUI();
    if (feature === "transfers") renderTransfersUI();
    else renderAITeams();
  };
  const tp = $("trialProBtn");
  if (tp) tp.addEventListener("click", () => { startTrial("pro"); afterUnlock(); });
  const tu = $("trialUltraBtn");
  if (tu) tu.addEventListener("click", () => { startTrial("ultra"); afterUnlock(); });
  const demo = $("demoUnlockBtn");
  if (demo) demo.addEventListener("click", () => {
    saveAuthSession({ teamId: currentTeamId(), plan: "pro", email: "demo" });
    setStatus("Demo Pro unlocked on this device");
    afterUnlock();
  });
}

function populateClubFilter() {
  const sel = $("cfTeam");
  if (!sel || sel.options.length > 1) return;
  const clubs = Object.values(teamsMap || {}).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  clubs.forEach(t => {
    const o = document.createElement("option");
    o.value = t.id;
    o.textContent = t.short_name || t.name;
    sel.appendChild(o);
  });
}

function showTransferResults(res) {
  const box = $("transferResults");
  if (!box) return;
  if (res.error) { box.innerHTML = `<p class="muted">${res.error}</p>`; return; }
  if (!res.suggestions.length) {
    box.innerHTML = `<p class="muted">No upgrades found under budget (bank ${money(res.bank)}). Try unlimited mode, a longer horizon, or Custom transfers.</p>`;
    return;
  }

  const ftLabel = res.unlimited
    ? `<div class="tr-ft-banner"><div><strong>Free transfers</strong><div class="muted" style="font-size:0.8rem">Unlimited this gameweek</div></div><div style="font-size:1.4rem">∞</div></div>`
    : `<div class="tr-ft-banner"><div><strong>Free transfers</strong><div class="muted" style="font-size:0.8rem">${res.freeTransfers} available · recommending best ${res.targetN}</div></div><div style="font-size:1.4rem">${res.freeTransfers}</div></div>`;

  const hz = parseInt(($("trHorizon") && $("trHorizon").value) || "3", 10) || 3;
  const hzLabel = hz >= 6 ? "GW1–6" : hz === 1 ? "next GW" : "next " + hz + " GWs";

  box.innerHTML = `
    <div class="tr-hub">
      <div class="tr-hub-head">
        <div>
          <h3 style="margin:0 0 4px">AI recommendations</h3>
          <p class="muted" style="margin:0;font-size:0.8rem">Best ${res.targetN}-transfer package · ${hzLabel} horizon · squad XP ≈ ${res.currentXp.toFixed(1)}</p>
        </div>
      </div>
      ${ftLabel}
      ${res.suggestions.map((s, i) => {
        const n = s.moves.length;
        const rows = s.moves.map(m => {
          const g = m.gain != null ? m.gain : (transferXp(m.inn) - transferXp(m.out));
          const gCls = g >= 0 ? "tr-gain" : "tr-hit";
          const gTxt = (g >= 0 ? "+" : "") + g.toFixed(1) + " pts";
          const shirtOut = m.out.team_code ? `https://resources.premierleague.com/premierleague/badges/70/t${m.out.team_code}.png` : "";
          const shirtIn = m.inn.team_code ? `https://resources.premierleague.com/premierleague/badges/70/t${m.inn.team_code}.png` : "";
          return `<div class="tr-hub-row">
            <div class="tr-hub-player sell">
              <div class="tr-hub-name"><strong>${m.out.web_name}</strong></div>
              <div class="muted" style="font-size:0.75rem">${m.out.position} · ${money(m.out.price)}${shirtOut ? "" : " · " + (m.out.team || "")}</div>
            </div>
            <div class="tr-hub-gain ${gCls}">${gTxt}</div>
            <div class="tr-hub-player buy">
              <div class="tr-hub-name"><strong>${m.inn.web_name}</strong></div>
              <div class="muted" style="font-size:0.75rem">${m.inn.position} · ${money(m.inn.price)} · ${(transferXp(m.inn) * (hz >= 6 ? 1 : 1)).toFixed(1)} xp</div>
            </div>
          </div>`;
        }).join("");
        const bankTxt = s.costDiff >= 0
          ? `bank −${money(s.costDiff)}`
          : `bank +${money(Math.abs(s.costDiff))}`;
        return `<div class="tr-bundle ${i === 0 ? "top" : ""}">
          ${i === 0 ? `<div class="tr-hub-cols"><span>SELL</span><span>GAIN</span><span>BUY · predicted ${hzLabel}</span></div>` : `<p class="muted" style="font-size:0.8rem;margin:0 0 8px">Alternative #${i + 1}</p>`}
          ${rows}
          <div class="tr-footer">
            <span>Total gain <strong class="tr-gain">${s.gain >= 0 ? "+" : ""}${s.gain.toFixed(1)} pts</strong>
              ${s.hits ? ` <span class="tr-hit">(−${s.hits * 4} hits)</span>` : ""}
              · ${bankTxt}</span>
            <button class="btn btn-blue apply-tr" data-idx="${i}">Make ${n} transfer${n > 1 ? "s" : ""}</button>
          </div>
        </div>`;
      }).join("")}
    </div>`;

  box.querySelectorAll(".apply-tr").forEach(btn => {
    btn.addEventListener("click", () => {
      applyTransferSuggestion(res.suggestions[+btn.dataset.idx]);
      saveSquadLocal();
      setStatus("Applied best transfer package locally — mirror on official FPL");
    });
  });
}

function syncTransferModeUI() {
  const unlimited = isUnlimitedTransferMode();
  const hint = $("trModeHint");
  if (hint) {
    hint.textContent = unlimited
      ? "Unlimited mode (GW1 / WC / FH): recommends the best 3-transfer package (change Free transfers to 1 or 2 for fewer)."
      : "Recommended: best package matching your free transfers. Use Custom to force a different number.";
  }
  if (unlimited && $("hitsInput")) $("hitsInput").value = 0;
  if (unlimited && $("ftInput") && parseInt($("ftInput").value, 10) > 5) $("ftInput").value = 3;
}

function renderTransfersUI() {
  if (!isPro()) {
    showUpgradePrompt("transfers");
    return;
  }
  populateClubFilter();
  syncTransferModeUI();
  const unlimited = isUnlimitedTransferMode();
  const ft = unlimited ? 15 : (parseInt($("ftInput").value, 10) || 1);
  const hits = unlimited ? 0 : (parseInt($("hitsInput").value, 10) || 0);
  showTransferResults(findTransfers(ft, hits, null));
}

function renderCustomTransfersUI() {
  if (!isPro()) {
    showUpgradePrompt("transfers");
    return;
  }
  populateClubFilter();
  const filters = getTransferFilters();
  const ft = filters.unlimitedCustom ? 15 : (parseInt($("ftInputCustom") && $("ftInputCustom").value, 10) || 1);
  const hits = filters.unlimitedCustom ? 0 : (parseInt($("hitsInputCustom") && $("hitsInputCustom").value, 10) || 0);
  showTransferResults(findTransfers(ft, hits, filters));
}

function renderAITeams() {
  if (!isPro()) {
    showUpgradePrompt("teams");
    return;
  }
  const budget = Math.min(100, parseFloat($("aiBudget").value) || 100);
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
      viceCaptainId = t.viceCaptainId || null;
      if (!viceCaptainId || !captainId) assignCaptainAndVice(startingIds);
      else if (viceCaptainId === captainId) assignCaptainAndVice(startingIds);
      squadLockedValue = false; entryBank = null; // AI draft starts under £100.0m
      saveSquadLocal();
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


function squadStorageKey(teamId) {
  return "fpl_squad_v1_" + String(teamId || "anon");
}

function saveSquadLocal(teamId) {
  teamId = teamId || currentTeamId() || "anon";
  if (!squad.length) return false;
  enforceValidXI();
  const payload = {
    teamId: teamId === "anon" ? null : Number(teamId),
    squadIds: squad.map(p => p.id),
    startingIds: [...startingIds],
    benchIds: [...benchIds],
    captainId,
    viceCaptainId,
    bank,
    squadLockedValue,
    entryBank,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(squadStorageKey(teamId), JSON.stringify(payload));
    // also mirror to anon so refresh without id can recover last edit
    if (teamId !== "anon") localStorage.setItem(squadStorageKey("anon"), JSON.stringify(payload));
    return true;
  } catch (_) {
    return false;
  }
}

function loadSquadLocal(teamId) {
  teamId = teamId || currentTeamId() || "anon";
  if (!players.length) return false;
  try {
    const raw = localStorage.getItem(squadStorageKey(teamId));
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data.squadIds || data.squadIds.length < 11) return false;
    const mapped = data.squadIds.map(id => players.find(p => p.id === id)).filter(Boolean);
    if (mapped.length < 11) return false;
    squad = mapped;
    startingIds = (data.startingIds || []).filter(id => squad.some(p => p.id === id));
    benchIds = (data.benchIds || []).filter(id => squad.some(p => p.id === id));
    // recover missing from squad
    const placed = new Set([...startingIds, ...benchIds]);
    squad.forEach(p => {
      if (!placed.has(p.id)) {
        if (startingIds.length < 11) startingIds.push(p.id);
        else benchIds.push(p.id);
      }
    });
    captainId = data.captainId && squad.some(p => p.id === data.captainId) ? data.captainId : startingIds[0];
    viceCaptainId = data.viceCaptainId && squad.some(p => p.id === data.viceCaptainId) ? data.viceCaptainId : null;
    if (viceCaptainId === captainId) viceCaptainId = null;
    if (typeof data.bank === "number") bank = data.bank;
    squadLockedValue = !!data.squadLockedValue;
    if (data.entryBank != null) entryBank = data.entryBank;
    enforceValidXI();
    return true;
  } catch (_) {
    return false;
  }
}

async function tryLoadUserTeam(teamId) {
  teamId = parseInt(teamId, 10);
  let teamName = null;
  let playerName = null;
  entryBank = null;
  teamValueOverride = null;
  squadLockedValue = false;

  try {
    const entry = await fetchJson(`entry/${teamId}/`);
    if (entry) {
      if (entry.name) teamName = entry.name;
      playerName = [entry.player_first_name, entry.player_last_name].filter(Boolean).join(" ");
      if (entry.last_deadline_bank != null) entryBank = entry.last_deadline_bank / 10;
      if (entry.last_deadline_value != null) teamValueOverride = entry.last_deadline_value / 10;
      // Do NOT overwrite planning GW with entry.current_event (often the last *finished* GW)
    }
  } catch (e) {
    return { source: "error", teamName: null, error: "Team ID not found on FPL" };
  }

  syncPlanningGw();

  // Prefer latest picks: next event (if published), then current, then recent finished
  const tryEvents = [];
  if (bootstrap && bootstrap.events) {
    const nx = bootstrap.events.find(e => e.is_next);
    const cu = bootstrap.events.find(e => e.is_current);
    if (nx) tryEvents.push(nx.id);
    if (cu) tryEvents.push(cu.id);
    // Recent finished events for squad shape (after deadline picks may only exist on current)
    bootstrap.events
      .filter(e => e.finished || e.is_previous)
      .sort((a, b) => b.id - a.id)
      .slice(0, 3)
      .forEach(e => tryEvents.push(e.id));
  }
  for (let e = planningGw(); e >= 1 && e >= planningGw() - 3; e--) tryEvents.push(e);
  for (let e = 1; e <= 8; e++) tryEvents.push(e);
  const seenEv = new Set();

  for (const ev of tryEvents) {
    if (seenEv.has(ev)) continue;
    seenEv.add(ev);
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
      const vice = ordered.find(p => p.is_vice_captain);
      captainId = cap ? cap.element : startingIds[0];
      viceCaptainId = vice ? vice.element : null;
      if (!viceCaptainId || viceCaptainId === captainId) assignCaptainAndVice(startingIds);
      squadLockedValue = true;
      if (entryBank != null) bank = entryBank;
      else {
        const spent = squad.reduce((s, p) => s + p.price, 0);
        bank = Math.max(0, BUDGET - spent);
      }
      // entry_history bank on picks if present
      if (picks.entry_history && picks.entry_history.bank != null) {
        bank = picks.entry_history.bank / 10;
      }
      saveSquadLocal(teamId);
      return { source: "api", teamName, playerName, event: ev };
    } catch (err) {
      // 404 until FPL publishes that team's picks for the event
    }
  }

  // Prefer squad saved on this device for this Team ID
  if (loadSquadLocal(teamId)) {
    return {
      source: "local",
      teamName,
      playerName,
      note: "Loaded your saved squad for this Team ID (device storage).",
    };
  }

  squad = [];
  startingIds = [];
  benchIds = [];
  captainId = null;
  viceCaptainId = null;
  bank = BUDGET;
  squadLockedValue = false;
  return {
    source: "empty",
    teamName,
    playerName,
  };
}

async function init(force = false) {
  restoreTeamIdInput();
  const rawId = $("teamIdInput") && $("teamIdInput").value;
  const teamId = parseInt(rawId, 10);
  if (!teamId) {
    setStatus("Enter a Team ID above and press Refresh to load a squad.");
    loadPlan(); updatePlanUI();
    squad = []; startingIds = []; benchIds = []; captainId = null; bank = BUDGET; squadLockedValue = false; entryBank = null;
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
    rememberTeamId(teamId);
    let loaded = await tryLoadUserTeam(teamId);
    const tname = (loaded && loaded.teamName) ? loaded.teamName : ("Team " + teamId);
    if (loaded && loaded.source === "api") {
      const plan = planningGw();
      const picksGw = loaded.event || plan;
      setStatus(
        picksGw === plan
          ? `GW ${plan} · ${tname}: official picks (${squad.length} players)`
          : `Planning GW ${plan} · ${tname}: squad from GW ${picksGw} picks (${squad.length} players)`
      );
      syncPlanningGw();
      recomputeAllXP();
      updateGwBanner();
      renderPitch();
    } else if (loaded && loaded.source === "local") {
      setStatus(`${tname}: saved squad restored (${squad.length} players)`);
    } else if (loaded && loaded.source === "error") {
      setStatus(loaded.error || "Could not load team");
    } else if (loaded && loaded.source === "empty") {
      setStatus(`${tname}: no public FPL picks yet — Edit team; progress saves for this Team ID`);
    } else {
      setStatus(`${tname}: GW ${currentGw}`);
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


// ---------- Matchday: Captain poll, Chip poll, Fixtures, Live ----------
function fdrClass(d) {
  const n = Math.min(5, Math.max(1, d || 3));
  return "fdr fdr-" + n;
}

function teamName(id) {
  const t = teamsMap[id];
  return t ? (t.short_name || t.name) : "?";
}

function renderCaptainPoll() {
  const box = $("captainPoll");
  if (!box || !players.length) return;
  const top = [...players]
    .filter(p => p.availability >= 0.4 && !["u", "s"].includes(p.status))
    .sort((a, b) => xpOf(b) - xpOf(a))
    .slice(0, 10);
  box.innerHTML = "<p class='muted'>Loading community votes…</p>";

  apiVotes(currentGw).then(votes => {
    const counts = (votes && votes.captain) || {};
    const total = (votes && votes.captainTotal) || 0;
    const maxXp = top[0] ? xpOf(top[0]) : 1;
    box.innerHTML = top.map((p, i) => {
      const v = counts[String(p.id)] || 0;
      const pct = total ? (100 * v / total) : 0;
      const modelPct = 100 * Math.pow(Math.max(xpOf(p), 0.5) / maxXp, 1.25);
      return `<div class="poll-row" data-id="${p.id}">
        <span class="rank">${i + 1}</span>
        <div>
          <strong>${p.web_name}</strong> <span class="muted">${p.team} · ${xpOf(p).toFixed(1)} xp</span>
          <div class="bar"><i style="width:${(total ? pct : modelPct / 3).toFixed(1)}%"></i></div>
        </div>
        <span>${total ? v + " votes" : "no votes yet"}</span>
        <button type="button" class="btn btn-outline vote-cap" data-id="${p.id}" style="padding:4px 8px;font-size:0.75rem">Vote</button>
      </div>`;
    }).join("") + (total ? `<p class="muted" style="margin-top:8px;font-size:0.8rem">${total} community captain votes this GW</p>` : `<p class="muted" style="margin-top:8px;font-size:0.8rem">Be the first to vote this GW</p>`);

    box.querySelectorAll(".vote-cap").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        btn.disabled = true;
        btn.textContent = "…";
        const res = await castVote("captain", btn.dataset.id);
        if (res && res.error) setStatus("Vote failed: " + res.error);
        else setStatus("Captain vote recorded");
        renderCaptainPoll();
      });
    });
    box.querySelectorAll(".poll-row").forEach(row => {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".vote-cap")) return;
        const id = +row.dataset.id;
        if (!squad.some(p => p.id === id)) {
          setStatus("Add player to squad before setting captain");
          return;
        }
        captainId = id;
        renderPitch();
        setStatus("Captain set on Pick tab");
      });
    });
  });
}

function renderChipPoll() {
  const box = $("chipPoll");
  if (!box) return;
  const items = [
    { key: "tc", name: "Triple Captain", tip: "Premium in a good fixture / DGW" },
    { key: "bb", name: "Bench Boost", tip: "When all 15 likely play" },
    { key: "fh", name: "Free Hit", tip: "Blank-heavy one-week template" },
    { key: "wc", name: "Wildcard", tip: "Rebuild for a fixture run" },
    { key: "none", name: "Hold chips", tip: "No special edge this week" },
  ];
  box.innerHTML = "<p class='muted'>Loading chip votes…</p>";
  apiVotes(currentGw).then(votes => {
    const counts = (votes && votes.chip) || {};
    const total = (votes && votes.chipTotal) || 0;
    box.innerHTML = items.map(it => {
      const v = counts[it.key] || 0;
      const pct = total ? (100 * v / total) : 0;
      return `<div class="chip-poll-item ${total && pct === Math.max(...items.map(x => total ? 100 * (counts[x.key] || 0) / total : 0)) ? "top" : ""}">
        <div class="pct">${total ? pct.toFixed(0) + "%" : "—"}</div>
        <strong>${it.name}</strong>
        <div class="muted" style="font-size:0.8rem;margin-top:4px">${it.tip}</div>
        <div class="muted" style="font-size:0.75rem;margin-top:4px">${v} vote${v === 1 ? "" : "s"}</div>
        <button type="button" class="btn btn-outline vote-chip" data-key="${it.key}" style="margin-top:8px;padding:4px 8px;font-size:0.75rem">Vote</button>
      </div>`;
    }).join("");
    box.querySelectorAll(".vote-chip").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        const res = await castVote("chip", btn.dataset.key);
        if (res && res.error) setStatus("Vote failed: " + res.error);
        else setStatus("Chip vote recorded");
        renderChipPoll();
      });
    });
  });
}

function renderFixtureBoard() {
  const box = $("fixtureBoard");
  if (!box) return;
  const list = (fixtures || [])
    .filter(f => f.event === currentGw)
    .sort((a, b) => (a.kickoff_time || "").localeCompare(b.kickoff_time || ""));
  if (!list.length) {
    box.innerHTML = `<p class="muted">No fixtures listed for GW ${currentGw} yet.</p>`;
    return;
  }
  box.innerHTML = list.map(f => {
    const ko = f.kickoff_time ? new Date(f.kickoff_time).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "";
    const hs = f.team_h_score != null ? f.team_h_score : "–";
    const as_ = f.team_a_score != null ? f.team_a_score : "–";
    return `<div class="fix-card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span>${teamName(f.team_h)} <span class="${fdrClass(f.team_h_difficulty)}">${f.team_h_difficulty || "?"}</span></span>
        <strong>${hs} – ${as_}</strong>
        <span><span class="${fdrClass(f.team_a_difficulty)}">${f.team_a_difficulty || "?"}</span> ${teamName(f.team_a)}</span>
      </div>
      <div class="muted" style="margin-top:6px;font-size:0.75rem;color:#94a3b8">${ko}${f.started && !f.finished_provisional ? " · LIVE" : f.finished ? " · FT" : ""}</div>
    </div>`;
  }).join("");
}

async function renderLiveBoard() {
  const box = $("liveBoard");
  const st = $("liveStatus");
  if (!box) return;
  box.innerHTML = `<p class="muted">Loading live data…</p>`;
  try {
    const live = await fetchJson(`event/${currentGw}/live/`);
    const elements = (live && live.elements) || [];
    if (!elements.length) {
      box.innerHTML = `<p class="muted">Live breakdown not available yet for GW ${currentGw} (usual before matches start).</p>`;
      if (st) st.textContent = "Waiting for match data";
      return;
    }
    // Map stats
    const rows = elements.map(el => {
      const p = players.find(x => x.id === el.id);
      if (!p) return null;
      const stats = {};
      (el.stats && typeof el.stats === "object" && !Array.isArray(el.stats)
        ? Object.entries(el.stats)
        : []).forEach(([k, v]) => { stats[k] = v; });
      // older shape: el.stats as flat fields
      const pts = el.stats?.total_points ?? el.stats?.points ?? stats.total_points ?? 0;
      const minutes = el.stats?.minutes ?? stats.minutes ?? 0;
      const goals = el.stats?.goals_scored ?? stats.goals_scored ?? 0;
      const assists = el.stats?.assists ?? stats.assists ?? 0;
      const cs = el.stats?.clean_sheets ?? stats.clean_sheets ?? 0;
      const bonus = el.stats?.bonus ?? stats.bonus ?? 0;
      const xg = el.stats?.expected_goals ?? stats.expected_goals ?? null;
      const xa = el.stats?.expected_assists ?? stats.expected_assists ?? null;
      return { p, pts, minutes, goals, assists, cs, bonus, xg, xa };
    }).filter(Boolean)
      .filter(r => r.minutes > 0 || r.pts > 0)
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 40);

    if (!rows.length) {
      box.innerHTML = `<p class="muted">No player minutes yet this GW.</p>`;
      if (st) st.textContent = "GW not started or no minutes";
      return;
    }
    box.innerHTML = `<table class="live-table">
      <thead><tr>
        <th>Player</th><th>Pts</th><th>Min</th><th>G</th><th>A</th><th>CS</th><th>B</th><th>xG</th><th>xA</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td><strong>${r.p.web_name}</strong> <span class="muted">${r.p.team}</span></td>
          <td><strong>${r.pts}</strong></td>
          <td>${r.minutes}</td>
          <td>${r.goals}</td>
          <td>${r.assists}</td>
          <td>${r.cs}</td>
          <td>${r.bonus}</td>
          <td>${r.xg != null ? Number(r.xg).toFixed(2) : "–"}</td>
          <td>${r.xa != null ? Number(r.xa).toFixed(2) : "–"}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;
    if (st) st.textContent = `GW ${currentGw} · top ${rows.length} by live points · ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    box.innerHTML = `<p class="muted">Live feed unavailable: ${e.message}</p>`;
    if (st) st.textContent = "Error loading live";
  }
}

function renderMetricsBoard() {
  const box = $("metricsBoard");
  if (!box || !players.length) return;
  const attackers = [...players]
    .filter(p => (p.position === "MID" || p.position === "FWD") && p.availability >= 0.4)
    .sort((a, b) => (b.xg90 + b.xa90) - (a.xg90 + a.xa90))
    .slice(0, 8);
  const defenders = [...players]
    .filter(p => (p.position === "DEF" || p.position === "GKP") && p.availability >= 0.4)
    .sort((a, b) => {
      const csA = Math.max(0.05, Math.min(0.55, 0.42 - 0.12 * (a.xgc90 || 1.3)));
      const csB = Math.max(0.05, Math.min(0.55, 0.42 - 0.12 * (b.xgc90 || 1.3)));
      return csB - csA;
    })
    .slice(0, 8);

  const row = (p, extra) => `<tr>
    <td><strong>${p.web_name}</strong> <span class="muted">${p.team}</span></td>
    <td>${p.position}</td>
    <td>${xpOf(p).toFixed(1)}</td>
    <td>${extra}</td>
  </tr>`;

  box.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <h3 style="margin:0 0 8px;font-size:0.95rem">Attack · xG + xA / 90</h3>
        <table class="live-table"><thead><tr><th>Player</th><th>Pos</th><th>XP</th><th>xG90 · xA90</th></tr></thead>
        <tbody>${attackers.map(p => row(p, `${p.xg90.toFixed(2)} · ${p.xa90.toFixed(2)}`)).join("")}</tbody></table>
      </div>
      <div>
        <h3 style="margin:0 0 8px;font-size:0.95rem">Defence · CS lean (via xGC)</h3>
        <table class="live-table"><thead><tr><th>Player</th><th>Pos</th><th>XP</th><th>xGC90 · CS%</th></tr></thead>
        <tbody>${defenders.map(p => {
          const cs = Math.max(0.05, Math.min(0.55, 0.42 - 0.12 * (p.xgc90 || 1.3)));
          return row(p, `${(p.xgc90 || 0).toFixed(2)} · ${(cs * 100).toFixed(0)}%`);
        }).join("")}</tbody></table>
      </div>
    </div>`;
}

function renderPriceBoard() {
  const box = $("priceBoard");
  if (!box || !players.length) return;
  // Net transfers this event as rise/fall pressure proxy
  const withTx = players.map(p => {
    const tin = p.transfers_in_event || 0;
    const tout = p.transfers_out_event || 0;
    return { p, net: tin - tout, tin, tout };
  });
  const rises = [...withTx].sort((a, b) => b.net - a.net).slice(0, 10);
  const falls = [...withTx].sort((a, b) => a.net - b.net).slice(0, 10);
  const row = (x, label) => `<tr>
    <td><strong>${x.p.web_name}</strong> <span class="muted">${x.p.team}</span></td>
    <td>${money(x.p.price)}</td>
    <td>${x.tin}</td>
    <td>${x.tout}</td>
    <td style="color:${x.net >= 0 ? "#16a34a" : "#dc2626"}"><strong>${x.net >= 0 ? "+" : ""}${x.net}</strong></td>
  </tr>`;
  box.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div>
      <h3 style="margin:0 0 8px;font-size:0.95rem">Likely to rise</h3>
      <table class="live-table"><thead><tr><th>Player</th><th>£</th><th>In</th><th>Out</th><th>Net</th></tr></thead>
      <tbody>${rises.map(x => row(x)).join("")}</tbody></table>
    </div>
    <div>
      <h3 style="margin:0 0 8px;font-size:0.95rem">Likely to fall</h3>
      <table class="live-table"><thead><tr><th>Player</th><th>£</th><th>In</th><th>Out</th><th>Net</th></tr></thead>
      <tbody>${falls.map(x => row(x)).join("")}</tbody></table>
    </div>
  </div>
  <p class="muted" style="font-size:0.8rem;margin-top:8px">Not official FPL predictions — based on transfers_in/out this GW.</p>`;
}

async function renderRivalRadar() {
  const box = $("rivalBoard");
  if (!box) return;
  const leagueId = parseInt($("rivalLeagueId") && $("rivalLeagueId").value, 10);
  const myId = currentTeamId();
  if (!leagueId) {
    box.innerHTML = `<p class="muted">Enter a classic league ID to scan.</p>`;
    return;
  }
  if (!myId) {
    box.innerHTML = `<p class="muted">Set your Team ID in the header first.</p>`;
    return;
  }
  box.innerHTML = `<p class="muted">Scanning league ${leagueId}…</p>`;
  try {
    const data = await fetchJson(`leagues-classic/${leagueId}/standings/?page_standings=1`);
    const results = (data.standings && data.standings.results) || [];
    const rivals = results.filter(r => r.entry !== myId).slice(0, 8);
    if (!rivals.length) {
      box.innerHTML = `<p class="muted">No rivals found (check league ID).</p>`;
      return;
    }
    const myIds = new Set(squad.map(p => p.id));
    const rows = [];
    for (const r of rivals) {
      let their = [];
      try {
        const picks = await fetchJson(`entry/${r.entry}/event/${currentGw}/picks/`);
        their = (picks.picks || []).map(x => x.element);
      } catch (_) {
        try {
          const picks = await fetchJson(`entry/${r.entry}/event/${Math.max(1, currentGw - 1)}/picks/`);
          their = (picks.picks || []).map(x => x.element);
        } catch (__) {}
      }
      if (!their.length) {
        rows.push({ r, note: "Picks not public yet" });
        continue;
      }
      const theirSet = new Set(their);
      const theyHaveIDont = their.filter(id => !myIds.has(id))
        .map(id => players.find(p => p.id === id))
        .filter(Boolean)
        .sort((a, b) => xpOf(b) - xpOf(a))
        .slice(0, 4);
      const iHaveTheyDont = [...myIds].filter(id => !theirSet.has(id))
        .map(id => players.find(p => p.id === id))
        .filter(Boolean)
        .sort((a, b) => xpOf(b) - xpOf(a))
        .slice(0, 4);
      rows.push({ r, theyHaveIDont, iHaveTheyDont });
    }
    box.innerHTML = `<table class="live-table">
      <thead><tr><th>Rival</th><th>Rank</th><th>They have · you don’t</th><th>You have · they don’t</th></tr></thead>
      <tbody>
        ${rows.map(row => {
          if (row.note) return `<tr><td>${row.r.entry_name}</td><td>${row.r.rank}</td><td colspan="2" class="muted">${row.note}</td></tr>`;
          return `<tr>
            <td><strong>${row.r.entry_name}</strong><div class="muted" style="font-size:0.75rem">${row.r.player_name || ""}</div></td>
            <td>${row.r.rank}</td>
            <td>${(row.theyHaveIDont || []).map(p => p.web_name).join(", ") || "—"}</td>
            <td>${(row.iHaveTheyDont || []).map(p => p.web_name).join(", ") || "—"}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
    <p class="muted" style="font-size:0.8rem;margin-top:8px">Pre-deadline picks of other managers are often hidden by FPL — scan works best once picks are published.</p>`;
  } catch (e) {
    box.innerHTML = `<p class="muted">League scan failed: ${e.message}</p>`;
  }
}

async function membersApi(pathQuery, opts) {
  const headers = Object.assign({}, ownerHeaders(), (opts && opts.headers) || {});
  const init = Object.assign({}, opts || {}, { headers });
  const urls = [
    "/.netlify/functions/members" + (pathQuery || ""),
    "/api/members" + (pathQuery || ""),
  ];
  let last = { ok: false, status: 0, json: { error: "unreachable" } };
  for (const url of urls) {
    try {
      const r = await fetch(url, init);
      const json = await r.json().catch(() => ({}));
      last = { ok: r.ok, status: r.status, json };
      if (r.status !== 404) return last;
    } catch (e) {
      last = { ok: false, status: 0, json: { error: String(e) } };
    }
  }
  return last;
}

function ownerHeaders() {
  return {
    "Content-Type": "application/json",
    "x-owner-email": OWNER_EMAIL,
  };
}

function ownerDaysSelected() {
  const v = ($("ownerMemDays") && $("ownerMemDays").value) || "365";
  if (v === "custom") return Math.max(1, parseInt($("ownerMemCustomDays") && $("ownerMemCustomDays").value, 10) || 30);
  return parseInt(v, 10) || 365;
}

function formatUntil(ts) {
  if (!ts) return "—";
  const d = new Date(Number(ts));
  if (!Number.isFinite(d.getTime())) return "—";
  const left = Math.ceil((d.getTime() - Date.now()) / 86400000);
  const when = d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return left < 0 ? ("expired " + when) : (when + " · " + left + "d left");
}

async function renderOwnerPage() {
  const box = $("ownerMemList");
  const msg = $("ownerMemMsg");
  if (!(authSession && authSession.plan === "owner")) {
    if (box) box.innerHTML = `<p class="muted">Sign in with the owner email to manage paid members.</p>`;
    return;
  }
  if (box) box.innerHTML = `<p class="muted">Loading members…</p>`;
  let members = loadLocalMembers();
  try {
    const r = await membersApi("?list=1", { method: "GET" });
    if (r.ok && r.json && r.json.members) {
      members = r.json.members;
      saveLocalMembers(members);
    } else if (msg) {
      msg.textContent = r.status === 404
        ? "Function not on this deploy yet — list is saved on this device. Redeploy including netlify/functions/members.js."
        : ("Server list unavailable (" + (r.status || "offline") + ") — showing this device.");
    }
  } catch (_) {
    if (msg && !msg.textContent) msg.textContent = "Using device list (API offline).";
  }
  if (!box) return;
  if (!members.length) {
    box.innerHTML = `<p class="muted">No paid members yet.</p>`;
    return;
  }
  box.innerHTML = `<table class="ml-table"><thead><tr>
    <th>Email</th><th>Team ID</th><th>Plan</th><th>Paid until</th><th></th>
  </tr></thead><tbody>` + members.map((m) => `<tr>
    <td>${m.email || "—"}</td>
    <td>${m.teamId || "—"}</td>
    <td>${(m.plan || "").toUpperCase()}</td>
    <td>${formatUntil(m.until)}</td>
    <td style="white-space:nowrap">
      <button type="button" class="btn btn-outline owner-mem-link" data-email="${m.email || ""}" data-team="${m.teamId || ""}" data-plan="${m.plan || "pro"}" data-until="${m.until || ""}">Copy login link</button>
      <button type="button" class="btn btn-ghost owner-mem-del" data-email="${m.email || ""}" data-team="${m.teamId || ""}">Remove</button>
    </td>
  </tr>`).join("") + `</tbody></table>
  <p class="muted" style="margin-top:10px;font-size:0.82rem">If the server has no Blobs store, members are kept on this device. Send them the <strong>login link</strong> so they can activate on their phone.</p>`;
  box.querySelectorAll(".owner-mem-del").forEach(btn => {
    btn.addEventListener("click", () => ownerRemoveMember(btn.dataset.email, btn.dataset.team));
  });
  box.querySelectorAll(".owner-mem-link").forEach(btn => {
    btn.addEventListener("click", async () => {
      const url = activationLink(btn.dataset.email, btn.dataset.team, btn.dataset.plan, btn.dataset.until);
      try {
        await navigator.clipboard.writeText(url);
        const msg = $("ownerMemMsg");
        if (msg) msg.textContent = "Login link copied.";
      } catch (_) {
        prompt("Copy this login link", url);
      }
    });
  });
}

function activationLink(email, teamId, plan, until) {
  const u = new URL(location.origin + location.pathname);
  u.searchParams.set("activate", "1");
  if (email) u.searchParams.set("email", email);
  if (teamId) u.searchParams.set("team", String(teamId));
  u.searchParams.set("plan", plan || "pro");
  u.searchParams.set("until", String(until || ""));
  return u.toString();
}

async function ownerAddMember() {
  if (!(authSession && authSession.plan === "owner")) {
    setStatus("Sign in as owner first");
    return;
  }
  const email = (($("ownerMemEmail") && $("ownerMemEmail").value) || "").trim().toLowerCase();
  const teamId = parseInt($("ownerMemTeam") && $("ownerMemTeam").value, 10) || 0;
  const plan = ($("ownerMemPlan") && $("ownerMemPlan").value) || "pro";
  const days = ownerDaysSelected();
  const note = ($("ownerMemNote") && $("ownerMemNote").value) || "";
  const msg = $("ownerMemMsg");
  if (!email && !teamId) {
    if (msg) msg.textContent = "Enter an email or a Team ID (or both).";
    return;
  }
  const row = {
    email: email || null,
    teamId: teamId || null,
    plan,
    days,
    until: Date.now() + days * 86400000,
    addedAt: new Date().toISOString(),
    note,
  };
  const local = loadLocalMembers().filter(m =>
    !((email && m.email === email) || (teamId && Number(m.teamId) === teamId))
  );
  local.unshift(row);
  saveLocalMembers(local);

  try {
    const r = await membersApi("", {
      method: "POST",
      body: JSON.stringify({
        action: "add",
        email,
        teamId,
        plan,
        days,
        note,
        ownerEmail: OWNER_EMAIL,
      }),
    });
    if (msg) {
      const link = activationLink(email, teamId, plan, row.until);
      const blobOff = r.json && r.json.blobs === false;
      msg.textContent = (r.ok
        ? `Added ${plan.toUpperCase()} for ${email || "Team " + teamId} · ${days} days.`
        : "Saved on this device.") +
        (blobOff || !r.ok ? " Server store off — copy the login link for the member." : "") +
        " Link: " + link;
    }
  } catch (e) {
    if (msg) msg.textContent = "Saved on this device only (server offline).";
  }
  renderOwnerPage();
}

async function ownerRemoveMember(email, teamId) {
  const list = loadLocalMembers().filter(m =>
    !(String(m.email || "") === String(email || "") && String(m.teamId || "") === String(teamId || ""))
  );
  saveLocalMembers(list);
  try {
    await membersApi("", {
      method: "POST",
      body: JSON.stringify({ action: "remove", email, teamId, ownerEmail: OWNER_EMAIL }),
    });
  } catch (_) {}
  renderOwnerPage();
}

function renderSettings() {
  const setTxt = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  const signed = !!(authSession && (authSession.plan === "owner" || authSession.plan === "pro" || authSession.plan === "ultra" ||
    ((authSession.plan === "trial_pro" || authSession.plan === "trial_ultra") && trialStillValid(authSession))));
  setTxt("settingsAuthStatus", signed ? "Signed in" : "Not signed in");
  setTxt("settingsPlan", activePlanLabel());
  setTxt("settingsEmail", (authSession && authSession.email) || "—");
  setTxt("settingsBoundTeam", (authSession && authSession.teamId) ? String(authSession.teamId) : "—");
  const st = $("settingsTeamId");
  if (st) st.value = currentTeamId() || localStorage.getItem("fpl_last_team_id") || "";
  try {
    const ui = JSON.parse(localStorage.getItem("fpl_ui_prefs_v1") || "{}");
    if ($("settingsCompactPitch")) $("settingsCompactPitch").checked = !!ui.compactPitch;
    if ($("settingsHideMetrics")) $("settingsHideMetrics").checked = !!ui.hideMetrics;
    if ($("settingsHideGwBanner")) $("settingsHideGwBanner").checked = !!ui.hideGwBanner;
    if ($("settingsDefaultHorizon")) $("settingsDefaultHorizon").value = String(ui.defaultHorizon || horizon || 1);
    if ($("settingsTheme")) $("settingsTheme").value = ui.theme || "light";
    if ($("settingsMatchdayEmail")) $("settingsMatchdayEmail").checked = !!ui.matchdayEmail;
  } catch (_) {}
}

function applyUiPrefs() {
  try {
    const ui = JSON.parse(localStorage.getItem("fpl_ui_prefs_v1") || "{}");
    document.body.classList.toggle("compact-pitch", !!ui.compactPitch);
    document.body.classList.toggle("hide-top-metrics", !!ui.hideMetrics);
    document.body.classList.toggle("hide-gw-banner", !!ui.hideGwBanner);
    const theme = ui.theme || "light";
    document.body.classList.remove("theme-dark");
    if (theme === "dark") document.body.classList.add("theme-dark");
    else if (theme === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.body.classList.add("theme-dark");
    }
    if (ui.defaultHorizon === 1 || ui.defaultHorizon === 3) {
      horizon = ui.defaultHorizon;
      document.querySelectorAll(".hz").forEach(b => {
        b.classList.toggle("active", +b.dataset.hz === horizon);
      });
    }
  } catch (_) {}
}
applyUiPrefs();

function renderTerms() {
  const box = $("termsContent");
  if (!box) return;
  box.innerHTML = `
    <h1>Terms of Use</h1>
    <p><em>Last updated: 11 August 2026</em></p>
    <p>Welcome to <strong>FPL Assistant</strong> (“the App”), operated from Malawi. By accessing or using the App you agree to these Terms of Use.</p>

    <h2>1. Nature of the service</h2>
    <p>The App is an independent Fantasy Premier League decision-support tool. It is <strong>not affiliated with, endorsed by, or connected to</strong> the Premier League, the FA, or Fantasy Premier League. Official FPL remains the only place to enter teams, make transfers, and play chips.</p>

    <h2>2. Data sources</h2>
    <p>Player data, fixtures, prices, and live scores are derived from publicly available Fantasy Premier League API responses and related public information. We do not guarantee accuracy, completeness, or uninterrupted availability of any data or prediction.</p>

    <h2>3. Predictions and advice</h2>
    <p>Expected points, captain polls, transfer suggestions, AI teams, and chip guidance are <strong>estimates only</strong>. They are not financial advice and do not guarantee FPL points or ranking outcomes. You remain solely responsible for decisions on the official FPL site.</p>

    <h2>4. Accounts, trials, and paid plans</h2>
    <ul>
      <li><strong>Starter</strong> features are free.</li>
      <li><strong>Pro</strong> and <strong>Ultra</strong> may be started with a <strong>14-day free trial</strong>. During the trial, paid features are unlocked on this device/browser.</li>
      <li>After the trial, continued access to Pro/Ultra requires payment (PayPal or approved local methods) and activation of your email + Team ID.</li>
      <li>Paid Pro/Ultra access is bound to the Team ID registered at activation.</li>
      <li>Owner access is reserved for the operator of the App.</li>
    </ul>

    <h2>5. Payments</h2>
    <p>Card and PayPal payments are processed by third parties (e.g. PayPal). Mobile-money payments use merchant till instructions you provide. We do not store full card numbers. Refunds are handled case-by-case for failed activation after confirmed payment.</p>

    <h2>6. Acceptable use</h2>
    <p>You must not misuse the App, attempt to break security, scrape aggressively, resell access without permission, or use the App for unlawful purposes. Votes and community features must not be manipulated with automated bots.</p>

    <h2>7. Intellectual property</h2>
    <p>App design, copy, and original code are owned by the operator. Club kits and marks belong to their respective owners and are shown for identification only.</p>

    <h2>8. Limitation of liability</h2>
    <p>To the fullest extent permitted by law, the operator is not liable for lost FPL points, ranking changes, payment provider outages, or damages arising from reliance on App content. The App is provided “as is”.</p>

    <h2>9. Privacy</h2>
    <p>We may store email, Team ID, plan, and trial status locally in your browser and, where configured, on hosting infrastructure for activation and Matchday emails. Do not submit passwords for your official FPL account.</p>

    <h2>10. Changes</h2>
    <p>We may update these Terms and the App features at any time. Continued use after changes constitutes acceptance.</p>

    <h2>11. Contact</h2>
    <p>Questions about these Terms or paid access: contact the operator via the channels published on the App (e.g. X/WhatsApp associated with the project).</p>
  `;
}

async function renderMatchday() {
  if (!players.length) {
    try {
      if (!bootstrap) { await loadBootstrap(); await loadFixtures(); buildPlayers(); }
    } catch (e) {
      setStatus("Error loading matchday: " + e.message);
      return;
    }
  }
  renderCaptainPoll();
  renderChipPoll();
  renderFixtureBoard();
  renderMetricsBoard();
  renderPriceBoard();
  await renderLiveBoard();
  if ($("rivalLeagueId") && $("rivalLeagueId").value) await renderRivalRadar();
}

let _rankLiveMap = null; // element id -> live stats
let _rankEntryCache = null;
let _rankLeaguesCache = []; // { id, name }
let _rankExpanded = null; // entry id expanded

async function getLivePointsMap(gw) {
  try {
    const live = await fetchJson(`event/${gw}/live/`);
    const map = {};
    (live.elements || []).forEach(el => {
      map[el.id] = el.stats || {};
    });
    return map;
  } catch (_) {
    return {};
  }
}

function livePlayerPts(elementId, multiplier, liveMap) {
  const st = liveMap[elementId] || {};
  const base = st.total_points != null ? Number(st.total_points) : 0;
  const m = multiplier != null ? Number(multiplier) : 1;
  return base * (m || 1);
}

function mlShirt(p) {
  if (!p) return "";
  const code = p.team_code || 0;
  if (!code) return "";
  if (p.position === "GKP") {
    return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}_1-66.webp`;
  }
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-66.webp`;
}

function renderLivePitchFromPicks(picks, liveMap, entryName) {
  if (!picks || !picks.picks) return `<p class="muted" style="color:#cbd5e1">Picks not available for this GW yet.</p>`;
  const ordered = [...picks.picks].sort((a, b) => a.position - b.position);
  const byPos = { GKP: [], DEF: [], MID: [], FWD: [] };
  const bench = [];
  let xiPts = 0;
  let totalPts = 0;

  ordered.forEach(pk => {
    const pl = players.find(x => x.id === pk.element);
    const pts = livePlayerPts(pk.element, pk.multiplier, liveMap);
    const st = liveMap[pk.element] || {};
    const mins = st.minutes || 0;
    const card = {
      pl, pts, mins, isC: !!pk.is_captain, isV: !!pk.is_vice_captain,
      mult: pk.multiplier, pos: pk.position,
    };
    if (pk.position <= 11) {
      const pos = pl ? pl.position : "MID";
      if (byPos[pos]) byPos[pos].push(card);
      else byPos.MID.push(card);
      if (pk.multiplier > 0) xiPts += pts;
    } else {
      bench.push(card);
    }
    if (pk.multiplier > 0) totalPts += pts;
  });

  // Prefer entry history points if present
  const histPts = picks.entry_history && picks.entry_history.points;
  const scoreShow = histPts != null ? histPts : Math.round(xiPts);

  function cardHtml(c) {
    if (!c.pl) return `<div class="ml-pcard"><div class="nm">?</div><div class="pts">${c.pts}</div></div>`;
    const sh = mlShirt(c.pl);
    const badge = c.isC ? `<span class="badge">C</span>` : (c.isV ? `<span class="badge vc">V</span>` : "");
    const dim = c.mult === 0 ? "opacity:0.55" : "";
    return `<div class="ml-pcard" style="${dim}">
      ${badge}
      ${sh ? `<img src="${sh}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ""}
      <div class="nm">${c.pl.web_name}</div>
      <div class="pts">${c.pts}</div>
    </div>`;
  }

  let rows = "";
  for (const pos of ["GKP", "DEF", "MID", "FWD"]) {
    if (!byPos[pos].length) continue;
    rows += `<div class="ml-pitch-row">${byPos[pos].map(cardHtml).join("")}</div>`;
  }
  const benchHtml = bench.length
    ? `<div class="ml-bench-row">${bench.map(cardHtml).join("")}</div>`
    : "";

  return `<div class="ml-pitch-wrap">
    <div class="ml-header-pts"><span>Score <strong>${scoreShow}</strong></span><span>${entryName || ""}</span></div>
    <div class="ml-pitch">${rows}${benchHtml}</div>
  </div>`;
}

async function loadManagerPicks(entryId, gw) {
  try {
    return await fetchJson(`entry/${entryId}/event/${gw}/picks/`);
  } catch (_) {
    try {
      return await fetchJson(`entry/${entryId}/event/${Math.max(1, gw - 1)}/picks/`);
    } catch (e2) {
      return null;
    }
  }
}

async function renderLiveRank() {
  const teamId = parseInt(($("rankTeamId") && $("rankTeamId").value) || ($("teamIdInput") && $("teamIdInput").value), 10);
  if ($("rankTeamId") && teamId) $("rankTeamId").value = teamId;
  const sumBox = $("rankSummary");
  const histBox = $("rankHistory");
  const tableBox = $("rankLeagueTable");
  const metaBox = $("rankLeagueMeta");
  if (!sumBox || !tableBox) return;

  if (!teamId) {
    sumBox.innerHTML = `<p class="muted">Enter your Team ID and press Update.</p>`;
    return;
  }

  sumBox.innerHTML = `<p class="muted">Loading…</p>`;
  tableBox.innerHTML = `<p class="muted">Loading mini-league…</p>`;
  if (histBox) histBox.innerHTML = "";
  if (metaBox) metaBox.textContent = "";

  const gw = planningGw();
  try {
    const entry = await loadEntrySummary(teamId);
    _rankEntryCache = entry;
    const history = await loadEntryHistory(teamId);
    _rankLiveMap = await getLivePointsMap(gw);

    // Populate league dropdown
    const sel = $("rankLeagueSelect");
    const classic = (entry.leagues && entry.leagues.classic) ? entry.leagues.classic : [];
    _rankLeaguesCache = classic.map(l => ({ id: l.id, name: l.name, entry_rank: l.entry_rank }));
    if (sel) {
      const prev = sel.value;
      sel.innerHTML = `<option value="my">My team</option>` +
        classic.map(l => `<option value="${l.id}">${l.name}</option>`).join("");
      if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
      else if (classic.length) sel.value = String(classic[0].id);
    }

    const overallPts = entry.summary_overall_points;
    const overallRank = entry.summary_overall_rank;
    const gwPts = entry.summary_event_points;
    const gwRank = entry.summary_event_rank;
    const name = entry.name || "Your team";
    const currentEvent = entry.current_event || gw;

    sumBox.innerHTML = `
      <div class="rank-metric"><span class="rm-label">Team</span><span class="rm-val" style="font-size:1rem">${name}</span></div>
      <div class="rank-metric"><span class="rm-label">Overall rank</span><span class="rm-val">${formatRank(overallRank)}</span></div>
      <div class="rank-metric"><span class="rm-label">Overall points</span><span class="rm-val">${overallPts ?? "–"}</span></div>
      <div class="rank-metric"><span class="rm-label">GW ${currentEvent} pts</span><span class="rm-val">${gwPts ?? "–"}</span>
        <div class="rm-sub">GW rank ${formatRank(gwRank)}</div></div>
    `;

    if (histBox && history && history.current && history.current.length) {
      const rows = [...history.current].reverse().slice(0, 15).map(h => `<tr>
        <td>GW ${h.event}</td>
        <td>${h.points}</td>
        <td>${h.total_points}</td>
        <td>${formatRank(h.rank)}</td>
        <td>${formatRank(h.overall_rank)}</td>
      </tr>`).join("");
      histBox.innerHTML = `<table><thead><tr><th>GW</th><th>Pts</th><th>Total</th><th>GW rank</th><th>OR</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    await renderRankLeagueTable(teamId, entry);
  } catch (e) {
    sumBox.innerHTML = `<p class="muted">Could not load rank: ${e.message || e}</p>`;
    tableBox.innerHTML = "";
  }
}

async function renderRankLeagueTable(myTeamId, entry) {
  const tableBox = $("rankLeagueTable");
  const metaBox = $("rankLeagueMeta");
  const sel = $("rankLeagueSelect");
  if (!tableBox) return;

  const choice = sel ? sel.value : "my";
  const gw = planningGw();
  const liveMap = _rankLiveMap || await getLivePointsMap(gw);
  _rankLiveMap = liveMap;
  const orderBy = ($("rankOrderBy") && $("rankOrderBy").value) || "score";

  // ---- My team only ----
  if (!choice || choice === "my") {
    if (metaBox) metaBox.textContent = `My team · GW ${gw}`;
    tableBox.innerHTML = `<p class="muted">Loading your live pitch…</p>`;
    const picks = await loadManagerPicks(myTeamId, gw);
    const pitch = renderLivePitchFromPicks(picks, liveMap, entry && entry.name);
    tableBox.innerHTML = `<div class="ml-expand" style="display:block">${pitch}</div>
      <p class="muted" style="margin-top:8px;font-size:0.8rem">Choose a classic league above to see the full table with expandable teams.</p>`;
    return;
  }

  const leagueId = parseInt(choice, 10);
  if (!leagueId) return;

  tableBox.innerHTML = `<p class="muted">Loading league standings…</p>`;
  let standings;
  try {
    const data = await fetchJson(`leagues-classic/${leagueId}/standings/?page_standings=1`);
    standings = (data.standings && data.standings.results) ? data.standings.results : [];
    const leagueName = (data.league && data.league.name) || ("League " + leagueId);
    if (metaBox) metaBox.textContent = `${leagueName} · GW ${gw} · ${standings.length} managers (page 1) · tap a row to expand`;
  } catch (e) {
    tableBox.innerHTML = `<p class="muted">Could not load league: ${e.message || e}</p>`;
    return;
  }

  // Enrich with live GW score from picks (limited concurrency)
  const rows = standings.slice(0, 50);
  const enriched = [];
  for (const r of rows) {
    let liveScore = r.event_total;
    let capName = "";
    let chips = { wc: false, tc: false, bb: false, fh: false };
    let picks = null;
    try {
      picks = await loadManagerPicks(r.entry, gw);
      if (picks) {
        if (picks.entry_history && picks.entry_history.points != null) {
          liveScore = picks.entry_history.points;
        } else {
          liveScore = (picks.picks || []).reduce((s, pk) => s + livePlayerPts(pk.element, pk.multiplier, liveMap), 0);
        }
        const cap = (picks.picks || []).find(pk => pk.is_captain);
        if (cap) {
          const pl = players.find(x => x.id === cap.element);
          capName = pl ? pl.web_name : "";
        }
        const active = picks.active_chip;
        if (active === "wildcard") chips.wc = true;
        if (active === "3xc") chips.tc = true;
        if (active === "bboost") chips.bb = true;
        if (active === "freehit") chips.fh = true;
      }
    } catch (_) {}
    enriched.push({
      ...r,
      liveScore: liveScore != null ? liveScore : r.event_total,
      totalPts: r.total,
      capName,
      chips,
      picks,
    });
  }

  enriched.sort((a, b) => {
    if (orderBy === "total") return (b.totalPts || 0) - (a.totalPts || 0);
    if (orderBy === "rank") return (a.rank || 0) - (b.rank || 0);
    return (b.liveScore || 0) - (a.liveScore || 0);
  });

  let html = `<table class="ml-table"><thead><tr>
    <th>Rank</th><th>Team &amp; Manager</th><th style="text-align:right">Score</th><th style="text-align:right">Total</th>
  </tr></thead><tbody>`;

  enriched.forEach((r, idx) => {
    const rank = r.rank || (idx + 1);
    const delta = (r.last_rank != null && r.rank != null) ? (r.last_rank - r.rank) : null;
    const deltaHtml = delta == null ? "" :
      (delta > 0 ? `<div class="ml-delta up">↑ ${delta}</div>` :
       delta < 0 ? `<div class="ml-delta">↓ ${Math.abs(delta)}</div>` : "");
    const chipHtml = ["wc", "tc", "bb", "fh"].map(k => {
      const labels = { wc: "WC", tc: "TC", bb: "BB", fh: "FH" };
      return `<span class="ml-chip ${r.chips[k] ? "on" : ""}">${labels[k]}</span>`;
    }).join("");
    const isMe = Number(r.entry) === Number(myTeamId);
    html += `<tr class="ml-row" data-entry="${r.entry}" data-idx="${idx}">
      <td><strong>${rank}</strong></td>
      <td>
        <div class="ml-team-name">${isMe ? "★ " : ""}${r.entry_name || "Team"}</div>
        <div class="ml-manager"><span class="ml-live">LIVE</span>${r.player_name || ""}</div>
        <div>${chipHtml}</div>
        ${r.capName ? `<div class="ml-cap">© ${r.capName}</div>` : ""}
      </td>
      <td class="ml-score">${r.liveScore ?? "–"}${deltaHtml}</td>
      <td class="ml-total">${r.totalPts ?? "–"}</td>
    </tr>
    <tr class="ml-detail hidden" id="ml-detail-${r.entry}"><td colspan="4"></td></tr>`;
  });
  html += `</tbody></table>`;
  tableBox.innerHTML = html;

  tableBox.querySelectorAll(".ml-row").forEach(row => {
    row.addEventListener("click", async () => {
      const entryId = row.dataset.entry;
      const detail = document.getElementById("ml-detail-" + entryId);
      if (!detail) return;
      const open = !detail.classList.contains("hidden");
      // close others
      tableBox.querySelectorAll(".ml-detail").forEach(d => {
        d.classList.add("hidden");
        d.querySelector("td").innerHTML = "";
      });
      tableBox.querySelectorAll(".ml-row").forEach(r => r.classList.remove("expanded"));
      if (open) return;
      row.classList.add("expanded");
      detail.classList.remove("hidden");
      detail.querySelector("td").innerHTML = `<p class="muted">Loading pitch…</p>`;
      const idx = +row.dataset.idx;
      let picks = enriched[idx] && enriched[idx].picks;
      if (!picks) picks = await loadManagerPicks(entryId, gw);
      const teamName = enriched[idx] ? enriched[idx].entry_name : "";
      detail.querySelector("td").innerHTML = `<div class="ml-expand">${renderLivePitchFromPicks(picks, liveMap, teamName)}</div>`;
    });
  });
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
    if (btn.dataset.view === "matchday") renderMatchday();
    if (btn.dataset.view === "terms") renderTerms();
    if (btn.dataset.view === "settings") renderSettings();
    if (btn.dataset.view === "owner") renderOwnerPage();
    if (btn.dataset.view === "rank") renderLiveRank();
    if (btn.dataset.view === "chips") renderChips();
  });
});

on("refreshBtn", "click", () => init(true));
document.addEventListener("click", (e) => {
  const menu = $("playerMenu");
  if (menu && !menu.classList.contains("hidden") && !menu.contains(e.target) && !e.target.closest(".pcard")) {
    hidePlayerMenu();
  }
});
const pMenu = $("playerMenu");
if (pMenu) {
  pMenu.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      handlePlayerAction(btn.dataset.act);
    });
  });
}
on("playerInfoClose", "click", () => {
  const m = $("playerInfoModal");
  if (m) m.classList.add("hidden");
});

on("settingsSignInBtn", "click", () => {
  document.querySelector('[data-view="settings"]')?.classList; // noop
  $("authBtn") && $("authBtn").click();
});
on("settingsSignOutBtn", "click", () => {
  logout();
  updatePlanUI();
  renderSettings();
  setStatus("Signed out");
});
on("settingsSaveTeamBtn", "click", () => {
  const v = parseInt($("settingsTeamId") && $("settingsTeamId").value, 10);
  if (!v) { setStatus("Enter a valid Team ID"); return; }
  if ($("teamIdInput")) $("teamIdInput").value = v;
  rememberTeamId(v);
  init(true);
  setStatus("Team ID saved: " + v);
});
on("settingsSaveUiBtn", "click", () => {
  let prev = {};
  try { prev = JSON.parse(localStorage.getItem("fpl_ui_prefs_v1") || "{}"); } catch (_) {}
  const ui = {
    ...prev,
    compactPitch: !!( $("settingsCompactPitch") && $("settingsCompactPitch").checked),
    hideMetrics: !!( $("settingsHideMetrics") && $("settingsHideMetrics").checked),
    hideGwBanner: !!( $("settingsHideGwBanner") && $("settingsHideGwBanner").checked),
    defaultHorizon: parseInt($("settingsDefaultHorizon") && $("settingsDefaultHorizon").value, 10) || 1,
    theme: ($("settingsTheme") && $("settingsTheme").value) || "light",
  };
  try { localStorage.setItem("fpl_ui_prefs_v1", JSON.stringify(ui)); } catch (_) {}
  applyUiPrefs();
  renderPitch();
  setStatus("Display settings saved");
});
on("settingsStartTrialBtn", "click", () => {
  startTrial("pro");
  renderSettings();
  updatePlanUI();
});
on("settingsClearSquadBtn", "click", () => {
  const id = currentTeamId() || localStorage.getItem("fpl_last_team_id") || "anon";
  try {
    localStorage.removeItem(squadStorageKey(id));
    localStorage.removeItem(squadStorageKey("anon"));
  } catch (_) {}
  squad = []; startingIds = []; benchIds = []; captainId = null; viceCaptainId = null;
  bank = BUDGET; squadLockedValue = false;
  renderPitch(); renderPlayerList();
  setStatus("Saved squad cleared on this device");
});
on("settingsSaveNotifyBtn", "click", async () => {
  let prev = {};
  try { prev = JSON.parse(localStorage.getItem("fpl_ui_prefs_v1") || "{}"); } catch (_) {}
  const want = !!( $("settingsMatchdayEmail") && $("settingsMatchdayEmail").checked);
  prev.matchdayEmail = want;
  try { localStorage.setItem("fpl_ui_prefs_v1", JSON.stringify(prev)); } catch (_) {}
  const email = authSession && authSession.email;
  const tid = currentTeamId();
  if (email && typeof setMatchdaySubscription === "function") {
    const sub = await setMatchdaySubscription(email, tid, want);
    if (sub && sub.ok) setStatus(want ? "Matchday emails enabled" : "Matchday emails disabled");
    else setStatus("Saved locally" + (sub && sub.error ? " · server: " + sub.error : ""));
  } else {
    setStatus(want ? "Preference saved — sign in with email to receive digests" : "Matchday emails preference saved");
  }
});
on("settingsClearLocalBtn", "click", () => {
  if (!confirm("Clear all FPL Assistant data on this device?")) return;
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("fpl_")) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch (_) {}
  authSession = null;
  squad = []; startingIds = []; benchIds = []; captainId = null;
  updatePlanUI();
  applyUiPrefs();
  renderSettings();
  setStatus("Local data cleared");
});
on("settingsOpenTermsBtn", "click", () => {
  document.querySelector('[data-view="terms"]')?.click();
});
on("settingsInstallBtn", "click", openInstallGuide);
on("ownerMemAddBtn", "click", ownerAddMember);
on("ownerMemRefreshBtn", "click", renderOwnerPage);
on("ownerMemDays", "change", () => {
  const wrap = $("ownerMemCustomWrap");
  if (wrap) wrap.style.display = (($("ownerMemDays") && $("ownerMemDays").value) === "custom") ? "block" : "none";
});
on("footerTermsLink", "click", (e) => {
  e.preventDefault();
  document.querySelector('[data-view="terms"]')?.click();
});
on("authBtn", "click", () => {
  if (authSession && (authSession.plan === "owner" || authSession.plan === "pro" || authSession.plan === "ultra" || authSession.plan === "trial_pro" || authSession.plan === "trial_ultra")) {
    logout();
    const btn = $("authBtn");
    if (btn) btn.textContent = "Sign in";
    updatePlanUI();
    return;
  }
  const modal = $("loginModal");
  if (modal) modal.classList.remove("hidden");
  if ($("loginTeamId")) $("loginTeamId").value = currentTeamId() || "";
});
on("startTrialPro", "click", () => startTrial("pro"));
on("startTrialUltra", "click", () => startTrial("ultra"));

on("loginSubmitBtn", "click", async () => {
  const tid = $("loginTeamId") && $("loginTeamId").value;
  const email = $("loginEmail") && $("loginEmail").value;
  const res = await attemptLogin(tid, "", email);
  const msg = $("loginMsg");
  if (msg) { msg.textContent = res.msg; msg.style.color = res.ok ? "#16a34a" : "#dc2626"; }
  if (res.ok) {
    const wantMail = $("loginMatchdayEmail") && $("loginMatchdayEmail").checked;
    if (email) {
      const sub = await setMatchdaySubscription(email, tid, wantMail);
      if (wantMail && sub && sub.ok) setStatus("Signed in · Matchday emails on");
      else if (wantMail && sub && sub.error) setStatus("Signed in · email opt-in failed (deploy functions + Blobs)");
    }
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
  tidInput.addEventListener("change", () => {
    rememberTeamId();
    init(true);
  });
  tidInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      rememberTeamId();
      init(true);
    }
  });
  tidInput.addEventListener("blur", () => rememberTeamId());
}

on("refreshRankBtn", "click", () => renderLiveRank());
on("rankLeagueSelect", "change", async () => {
  if (_rankEntryCache) await renderRankLeagueTable(
    parseInt(($("rankTeamId") && $("rankTeamId").value) || ($("teamIdInput") && $("teamIdInput").value), 10),
    _rankEntryCache
  );
});
on("rankOrderBy", "change", async () => {
  if (_rankEntryCache) await renderRankLeagueTable(
    parseInt(($("rankTeamId") && $("rankTeamId").value) || ($("teamIdInput") && $("teamIdInput").value), 10),
    _rankEntryCache
  );
});
on("refreshLiveBtn", "click", () => renderLiveBoard());
on("rivalScanBtn", "click", () => renderRivalRadar());
on("optimiseBtn", "click", () => {
  const r = optimiseLineup();
  if (r && r.error) setStatus(r.error);
  else {
    enforceValidXI();
    assignCaptainAndVice(startingIds);
    saveSquadLocal();
    renderPitch();
    renderPlayerList();
    setStatus("Lineup optimised · C/VC set by predicted points · saved");
  }
});
on("resetBtn", "click", () => { squad = []; startingIds = []; benchIds = []; captainId = null; viceCaptainId = null; bank = BUDGET; squadLockedValue = false; entryBank = null; renderPitch(); renderPlayerList(); });
on("teamFilter", "change", () => renderPlayerList());
function setEditMode(on) {
  if (!on) {
    // Finishing edit — require full legal squad
    if (squad.length !== 15) {
      setStatus("Complete your squad first: " + squad.length + "/15 players selected");
      const st = $("editStatusInline");
      if (st) {
        st.textContent = "Need 15 players before Done (" + squad.length + "/15)";
        st.style.color = "#dc2626";
      }
      return false;
    }
    const gk = squad.filter(p => p.position === "GKP").length;
    const def = squad.filter(p => p.position === "DEF").length;
    const mid = squad.filter(p => p.position === "MID").length;
    const fwd = squad.filter(p => p.position === "FWD").length;
    if (gk !== 2 || def !== 5 || mid !== 5 || fwd !== 3) {
      setStatus("Invalid squad: need 2 GKP, 5 DEF, 5 MID, 3 FWD (now " + gk + "/" + def + "/" + mid + "/" + fwd + ")");
      const st = $("editStatusInline");
      if (st) {
        st.textContent = "Invalid positions — need 2/5/5/3";
        st.style.color = "#dc2626";
      }
      return false;
    }
    if (!currentTeamId()) {
      setStatus("Enter your Team ID in the header so this squad is saved for you");
      const st = $("editStatusInline");
      if (st) {
        st.textContent = "Enter Team ID above, then Done again";
        st.style.color = "#dc2626";
      }
      return false;
    }
    enforceValidXI();
    assignCaptainAndVice(startingIds);
    const saved = saveSquadLocal();
    if (!saved) {
      setStatus("Could not save squad (browser storage full or blocked)");
      return false;
    }
    setStatus("Squad saved for Team ID " + currentTeamId() + " (" + squad.length + " players) · C/VC set");
  }
  editMode = on;
  if (!on) replaceSlot = null;
  document.body.classList.toggle("editing", on);
  const banner = $("editBanner");
  if (banner) banner.classList.toggle("hidden", !on);
  const st = $("editStatusInline");
  if (st) {
    st.style.color = "";
    st.textContent = on ? ("Squad " + squad.length + "/15 · Bank " + money(bank)) : "";
  }
  renderPitch();
  renderPlayerList();
  return true;
}
on("editBtn", "click", () => setEditMode(true));
const doneBtn = $("doneEditBtn");
if (doneBtn) doneBtn.addEventListener("click", () => setEditMode(false));
on("runTransfersBtn", "click", renderTransfersUI);
on("trMode", "change", () => { syncTransferModeUI(); renderTransfersUI(); });
on("trHorizon", "change", () => renderTransfersUI());
on("runCustomTransfersBtn", "click", renderCustomTransfersUI);
document.querySelectorAll(".tr-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tr-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const which = tab.dataset.trTab;
    const rec = $("trPaneRecommended");
    const cus = $("trPaneCustom");
    if (rec) rec.classList.toggle("hidden", which !== "recommended");
    if (cus) cus.classList.toggle("hidden", which !== "custom");
    if (which === "custom") populateClubFilter();
  });
});
on("genTeamsBtn", "click", renderAITeams);

document.querySelectorAll(".hz").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".hz").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    horizon = +btn.dataset.hz;
    syncPlanningGw();
    recomputeAllXP();
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

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function isInStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
}

function installGuideHtml() {
  if (isIos()) {
    return `
      <p><strong>iPhone / iPad (Safari)</strong></p>
      <ol class="install-steps">
        <li>Open <strong>https://myfpl.netlify.app</strong> in <strong>Safari</strong>.</li>
        <li>Tap the <strong>Share</strong> button (square with an arrow) at the bottom.</li>
        <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
        <li>Tap <strong>Add</strong>. Launch from the new icon anytime.</li>
      </ol>
      <p class="muted" style="font-size:0.85rem">Chrome on iPhone cannot fully install PWAs — use Safari.</p>`;
  }
  return `
    <p><strong>Android (Chrome)</strong></p>
    <ol class="install-steps">
      <li>Open the site in Chrome.</li>
      <li>Tap menu <strong>⋮</strong> → <strong>Install app</strong> / <strong>Add to Home screen</strong>.</li>
      <li>Or tap <strong>Install App</strong> when the browser prompt appears.</li>
    </ol>`;
}

function openInstallGuide() {
  const body = $("installGuideBody");
  const modal = $("installModal");
  if (body) body.innerHTML = installGuideHtml();
  if (modal) modal.classList.remove("hidden");
}

let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = $("installBtn");
  if (btn) btn.hidden = false;
});

function wireInstallBtn() {
  const btn = $("installBtn");
  if (!btn) return;
  // Always show on iOS (no beforeinstallprompt); hide if already installed
  if (isInStandalone()) {
    btn.hidden = true;
    return;
  }
  if (isIos()) btn.hidden = false;
  btn.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (_) {}
      deferredPrompt = null;
      return;
    }
    openInstallGuide();
  });
}
wireInstallBtn();
on("installModalClose", "click", () => {
  const m = $("installModal");
  if (m) m.classList.add("hidden");
});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

window.addEventListener("error", (ev) => {
  try { setStatus("JS error: " + (ev.message || ev.error)); } catch(_) {}
});
init();
