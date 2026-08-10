/* FPL Assistant – pitch UI, AI Transfers, AI Teams, Netlify proxy */

const API = "/api/fpl?path=";
const DEFAULT_TEAM_ID = 1932256;
const BUDGET = 100.0;

// Stripe Payment Links — replace with your own from https://dashboard.stripe.com/payment-links
// After payment Stripe can redirect to ?plan=pro (or use a success page). For demo we also
// support a local unlock so you can test gating before wiring live keys.
const STRIPE_PRO_LINK = "https://buy.stripe.com/test_REPLACE_PRO";   // £4.99/mo Pro
const STRIPE_ULTRA_LINK = "https://buy.stripe.com/test_REPLACE_ULTRA"; // £9.99/mo Ultra

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
let entryBank = 0; // from API if available
let userPlan = "starter"; // starter | pro | ultra

const SQUAD_LIMITS = { GKP: 2, DEF: 5, MID: 5, FWD: 3 };

// XifundoFC GW1 draft (from official FPL site) — used when API picks are not public yet
const DEFAULT_SQUAD_IDS = {
  starting: [1, 8, 4, 469, 418, 400, 427, 542, 398, 411, 106], // Raya, Calafiori, Gabriel, N.Williams, Maguire, Doku, Mbeumo, E.Le Fée, Foden, Haaland, Thiago
  bench: [497, 346, 259, 212], // Dubravka, Calvert-Lewin, Diop, Hughes
  captain: 411 // Haaland
};

async function fetchJson(path) {
  const url = API + encodeURIComponent(path);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

function $(id) { return document.getElementById(id); }
function on(id, evt, fn) { const el = $(id); if (el) el.addEventListener(evt, fn); }
function money(n) { return "£" + Number(n).toFixed(1) + "m"; }
function setStatus(m) { $("statusBar").textContent = m; }
function xpOf(p) { return horizon === 3 ? p.xp3 : p.xp; }

function loadPlan() {
  try {
    const p = localStorage.getItem("fpl_plan_v1");
    if (p === "pro" || p === "ultra") userPlan = p;
  } catch (_) {}
  // Success redirect from Stripe Payment Link (?plan=pro or #plan=pro)
  try {
    const params = new URLSearchParams(location.search);
    const hash = (location.hash || "").replace(/^#/, "");
    const fromUrl = params.get("plan") || (hash.startsWith("plan=") ? hash.slice(5) : null);
    if (fromUrl === "pro" || fromUrl === "ultra") {
      userPlan = fromUrl;
      localStorage.setItem("fpl_plan_v1", fromUrl);
      // Clean URL without reload
      history.replaceState({}, "", location.pathname);
    }
  } catch (_) {}
}
function isPro() { return userPlan === "pro" || userPlan === "ultra"; }
function setPlan(plan) {
  userPlan = plan;
  try { localStorage.setItem("fpl_plan_v1", plan); } catch (_) {}
  updatePlanUI();
}
function updatePlanUI() {
  const badge = $("planBadge");
  if (badge) {
    badge.textContent = userPlan === "ultra" ? "Ultra" : userPlan === "pro" ? "Pro" : "Starter";
    badge.className = "plan-badge " + userPlan;
  }
  document.querySelectorAll(".pro-only").forEach(el => {
    el.classList.toggle("locked", !isPro());
  });
  const proBtn = $("upgradeProBtn");
  const ultraBtn = $("upgradeUltraBtn");
  if (proBtn) proBtn.href = STRIPE_PRO_LINK;
  if (ultraBtn) ultraBtn.href = STRIPE_ULTRA_LINK;
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
      team: team.short_name || "?", team_name: team.name || "?",
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
function optimiseSquad(budget = BUDGET) {
  let pool = players.filter(p => p.availability >= 0.35 && !["u", "s"].includes(p.status));
  pool.sort((a, b) => xpOf(b) - xpOf(a));
  const counts = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  const club = {};
  const picked = [];
  let spent = 0;
  for (const p of pool) {
    if (picked.length >= 15) break;
    if (counts[p.position] >= SQUAD_LIMITS[p.position]) continue;
    if ((club[p.team_id] || 0) >= 3) continue;
    if (spent + p.price > budget) continue;
    picked.push(p); counts[p.position]++; club[p.team_id] = (club[p.team_id] || 0) + 1; spent += p.price;
  }
  if (picked.length < 15) {
    const rest = pool.filter(p => !picked.includes(p)).sort((a, b) => a.price - b.price);
    for (const p of rest) {
      if (picked.length >= 15) break;
      if (counts[p.position] >= SQUAD_LIMITS[p.position]) continue;
      if ((club[p.team_id] || 0) >= 3) continue;
      if (spent + p.price > budget) continue;
      picked.push(p); counts[p.position]++; club[p.team_id] = (club[p.team_id] || 0) + 1; spent += p.price;
    }
  }
  for (let i = 0; i < 3; i++) {
    picked.sort((a, b) => xpOf(a) - xpOf(b));
    for (let j = 0; j < picked.length; j++) {
      const weak = picked[j];
      for (const cand of pool) {
        if (picked.includes(cand) || cand.position !== weak.position) continue;
        if (xpOf(cand) <= xpOf(weak) + 0.05) continue;
        const newSpent = spent - weak.price + cand.price;
        if (newSpent > budget) continue;
        const nc = { ...club };
        nc[weak.team_id] = (nc[weak.team_id] || 1) - 1;
        nc[cand.team_id] = (nc[cand.team_id] || 0) + 1;
        if (nc[cand.team_id] > 3) continue;
        picked[j] = cand; spent = newSpent;
        club[weak.team_id]--; club[cand.team_id] = (club[cand.team_id] || 0) + 1;
        break;
      }
    }
  }
  const byPos = { GKP: [], DEF: [], MID: [], FWD: [] };
  picked.forEach(p => byPos[p.position].push(p));
  Object.keys(byPos).forEach(k => byPos[k].sort((a, b) => xpOf(b) - xpOf(a)));
  const formations = [
    { DEF: 3, MID: 4, FWD: 3 }, { DEF: 3, MID: 5, FWD: 2 }, { DEF: 4, MID: 4, FWD: 2 },
    { DEF: 4, MID: 3, FWD: 3 }, { DEF: 5, MID: 3, FWD: 2 }, { DEF: 5, MID: 4, FWD: 1 }, { DEF: 4, MID: 5, FWD: 1 },
  ];
  let bestXI = null, bestScore = -1;
  for (const f of formations) {
    if (byPos.DEF.length < f.DEF || byPos.MID.length < f.MID || byPos.FWD.length < f.FWD || byPos.GKP.length < 1) continue;
    const xi = [byPos.GKP[0], ...byPos.DEF.slice(0, f.DEF), ...byPos.MID.slice(0, f.MID), ...byPos.FWD.slice(0, f.FWD)];
    const score = xi.reduce((s, p) => s + xpOf(p) * (0.7 + 0.3 * (p.availability || 1)), 0);
    if (score > bestScore) { bestScore = score; bestXI = xi; }
  }
  if (!bestXI) {
    bestXI = [];
    for (const pos of ["GKP", "DEF", "MID", "FWD"]) {
      const need = pos === "GKP" ? 1 : pos === "DEF" ? 3 : pos === "MID" ? 4 : 2;
      bestXI.push(...byPos[pos].slice(0, need));
    }
  }
  const xiIds = new Set(bestXI.map(p => p.id));
  const bench = picked.filter(p => !xiIds.has(p.id));
  bench.sort((a, b) => {
    if (a.position === "GKP" && b.position !== "GKP") return -1;
    if (b.position === "GKP" && a.position !== "GKP") return 1;
    return xpOf(b) - xpOf(a);
  });
  squad = [...bestXI, ...bench];
  startingIds = bestXI.map(p => p.id);
  benchIds = bench.map(p => p.id);
  captainId = bestXI.slice().sort((a, b) => xpOf(b) - xpOf(a))[0]?.id || null;
  bank = budget - spent;
  return { spent, bank, xiXp: bestXI.reduce((s, p) => s + xpOf(p), 0), squad: [...squad], startingIds: [...startingIds], benchIds: [...benchIds], captainId };
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
function playerCard(p, isCaptain = false) {
  const pts = xpOf(p).toFixed(1);
  return `
    <div class="pcard ${isCaptain ? "captain" : ""}" data-id="${p.id}" title="${p.news || p.web_name}">
      <div class="shirt" style="background:${shirtFor(p.team)}">${posEmoji(p.position)}</div>
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
      <div class="upgrade-actions">
        <a class="btn btn-blue" href="${STRIPE_PRO_LINK}" target="_blank" rel="noopener">Upgrade to Pro · £4.99/mo</a>
        <a class="btn btn-outline" href="${STRIPE_ULTRA_LINK}" target="_blank" rel="noopener">Ultra · £9.99/mo</a>
        <button type="button" class="btn btn-ghost" id="demoUnlockBtn">Demo unlock (local only)</button>
      </div>
      <p class="muted" style="margin-top:10px;font-size:0.8rem">After you create real Stripe Payment Links, set success URL to this site with <code>?plan=pro</code>.</p>
    </div>`;
  const demo = $("demoUnlockBtn");
  if (demo) demo.addEventListener("click", () => {
    setPlan("pro");
    setStatus("Pro unlocked locally (demo) — run the button again");
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
  box.innerHTML = "<p class='muted'>Generating…</p>";
  // Generate 3 variants by slightly different sort bias
  const variants = [];
  const savedHorizon = horizon;
  for (let v = 0; v < 3; v++) {
    // temporarily nudge sort by mixing ownership
    const result = optimiseSquad(budget);
    variants.push({
      label: v === 0 ? "Balanced (recommended)" : v === 1 ? "Premium-heavy" : "Value / differentials",
      ...result,
    });
    // perturb: exclude top owned mid for variant diversity
    if (v === 0) {
      // next loop will re-run; force different by excluding highest owned from previous
    }
  }
  // Better diversity: run once, then exclude 2-3 template players and re-run
  const r1 = optimiseSquad(budget);
  const excludeIds = r1.squad.filter(p => p.selected_by_percent > 30).slice(0, 3).map(p => p.id);
  const pool2 = players.filter(p => !excludeIds.includes(p.id));
  // quick second optimise on reduced pool
  const origPlayers = players;
  players = pool2;
  const r2 = optimiseSquad(budget);
  players = origPlayers;
  // third: force Haaland if available
  const haaland = origPlayers.find(p => p.web_name === "Haaland");
  let r3 = r1;
  if (haaland) {
    players = origPlayers.filter(p => p.id === haaland.id || p.web_name !== "Haaland");
    r3 = optimiseSquad(budget);
    players = origPlayers;
  }

  const teams = [
    { label: "Balanced (recommended)", data: r1 },
    { label: "Lower ownership / differentials", data: r2 },
    { label: "Template-leaning", data: r3 },
  ];

  box.innerHTML = teams.map((t, i) => {
    const xi = t.data.squad.filter(p => t.data.startingIds.includes(p.id));
    const bench = t.data.squad.filter(p => t.data.benchIds.includes(p.id));
    return `
      <div class="team-card">
        <h4>${t.label} · XI XP ≈ ${t.data.xiXp.toFixed(1)} · ${money(t.data.spent)} · Bank ${money(t.data.bank)}</h4>
        <div class="mini-squad">
          ${xi.map(p => `<span class="mini-chip"><span class="pos">${p.position}</span> ${p.web_name} ${money(p.price)}</span>`).join("")}
        </div>
        <p class="muted" style="margin-top:6px;font-size:0.8rem">Bench: ${bench.map(p => p.web_name).join(", ")}</p>
        <button class="btn btn-blue use-team" data-idx="${i}" style="margin-top:8px">Use this team</button>
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
      setStatus("AI team applied — review on Pick tab");
    });
  });
  horizon = savedHorizon;
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

let chipModalKey = null;

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
  // 1) Try official API picks for a few events
  for (const ev of [currentGw, 1, 2, 3]) {
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
      return "api";
    } catch (err) {
      // 404 is normal pre-deadline
    }
  }
  // 2) Always fall back to known XifundoFC draft (by ID, then by name)
  if (loadDefaultSquad()) return "default";
  // 3) Name-based fallback if IDs drifted
  const namesXI = ["Raya","Calafiori","Gabriel","N.Williams","Maguire","Doku","Mbeumo","E.Le Fée","Foden","Haaland","Thiago"];
  const namesBench = ["Dubravka","Calvert-Lewin","Diop","Hughes"];
  const findByName = (n) => players.find(p => p.web_name === n || p.web_name.replace(" ","") === n.replace(" ",""));
  const xi = namesXI.map(findByName).filter(Boolean);
  const bench = namesBench.map(findByName).filter(Boolean);
  if (xi.length >= 11) {
    squad = [...xi, ...bench];
    startingIds = xi.map(p => p.id);
    benchIds = bench.map(p => p.id);
    const h = players.find(p => p.web_name === "Haaland");
    captainId = h ? h.id : startingIds[0];
    bank = Math.max(0, BUDGET - squad.reduce((s, p) => s + p.price, 0));
    return "default";
  }
  return false;
}

async function init(force = false) {
  const teamId = parseInt($("teamIdInput").value, 10) || DEFAULT_TEAM_ID;
  setStatus("Loading official FPL data…");
  loadPlan();
  updatePlanUI();
  try {
    try { ["fpl_boot_v1","fpl_boot_v2","fpl_boot_v3","fpl_boot_v4"].forEach(k => localStorage.removeItem(k)); } catch (_) {}
    await loadBootstrap(force);
    await loadFixtures();
    buildPlayers();
    const loaded = await tryLoadUserTeam(teamId);
    if (loaded === "api") {
      setStatus(`GW ${currentGw} · Loaded your official FPL picks (${squad.length} players)`);
    } else if (loaded === "default") {
      setStatus(`GW ${currentGw} · Loaded XifundoFC draft (API picks not public yet — edit freely)`);
    } else {
      optimiseSquad();
      setStatus(`GW ${currentGw} · AI draft generated`);
    }
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

// Nav
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    btn.classList.add("active");
    $("view-" + btn.dataset.view).classList.add("active");
    if (btn.dataset.view === "transfers") renderTransfersUI();
    if (btn.dataset.view === "teams") { /* wait for button */ }
    if (btn.dataset.view === "chips") renderChips();
  });
});

on("refreshBtn", "click", () => init(true));
on("optimiseBtn", "click", () => { optimiseSquad(); renderPitch(); renderPlayerList(); setStatus("Optimised for best XI under £100m"); });
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
