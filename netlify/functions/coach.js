const core = require('./lib/account-core');
const { plan } = require('./lib/decision-engine');
const { reconstruct } = require('./lib/selling-prices');
const cached = new Map();
async function official(path, ttl = 60000) {
  const prior = cached.get(path);
  if (prior && prior.until > Date.now()) return prior.data;
  const r = await fetch('https://fantasy.premierleague.com/api/' + path, { headers: { 'User-Agent': 'MyFPL/2.0', Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw Object.assign(new Error('Official FPL data is unavailable. Try again shortly.'), { status: 502 });
  const data = await r.json(); cached.set(path, { data, until: Date.now() + ttl });
  if (cached.size > 150) cached.delete(cached.keys().next().value);
  return data;
}
async function leagueContext(entry, teamId, leagueId, ignoredRivalId, gw, get = official) {
  const known = (entry.leagues?.classic || []).find(l => l.id === leagueId);
  if (!known) throw Object.assign(new Error('Choose a classic mini-league this team belongs to.'), { status:400 });
  const first = await get(`leagues-classic/${leagueId}/standings/?page_standings=1`);
  let data = first, page = 1;
  const rows = [...(data.standings?.results || [])];
  while(data.standings?.has_next && page < 20) {
    data = await get(`leagues-classic/${leagueId}/standings/?page_standings=${++page}`);
    rows.push(...(data.standings?.results || []));
  }
  const unique = [...new Map(rows.map(r=>[r.entry,r])).values()];
  const me = unique.find(r=>r.entry===teamId);
  const field = unique.filter(r=>r.entry!==teamId);
  // Small mini-leagues use everyone. Large fields use evenly spaced ranks, visibly labelled.
  const selected = field.length <= 200 ? field : Array.from({length:200},(_,i)=>field[Math.floor(i*(field.length-1)/199)]);
  const ownership = {}, captains = {};
  let analysed = 0;
  for(let offset=0;offset<selected.length;offset+=10) {
    const picks = await Promise.all(selected.slice(offset,offset+10).map(async r=>{
      try { return await get(`entry/${r.entry}/event/${gw}/picks/`); } catch { return null; }
    }));
    for(const record of picks) {
      if(!record?.picks?.length) continue;
      analysed++;
      for(const id of new Set(record.picks.map(p=>p.element))) ownership[id]=(ownership[id]||0)+1;
      for(const pick of record.picks) if(pick.is_captain) captains[pick.element]=(captains[pick.element]||0)+1;
    }
  }
  const complete = !data.standings?.has_next && analysed === field.length;
  return { id:leagueId, name:first.league?.name||known.name, rank:me?.rank||known.entry_rank, total:me?.total??null,
    leader:unique[0]?{total:unique[0].total,gap:me?unique[0].total-me.total:null}:null,
    managers:unique.length, analysed, complete,
    ownership:Object.fromEntries(Object.entries(ownership).map(([id,n])=>[id,n/analysed])),
    captainOwnership:Object.fromEntries(Object.entries(captains).map(([id,n])=>[id,n/analysed])),
    warning:complete ? null : `League-field coverage: ${analysed} other managers analysed from ${unique.length} loaded standings. This is a sample, not complete league ownership.` };
}
async function sellingPrices(boot, teamId, published, picks) {
  const [initial, transfers, history] = await Promise.all([
    official(`entry/${teamId}/event/1/picks/`).catch(error => { if(error.status===502) return { picks:[] }; throw error; }),
    official(`entry/${teamId}/transfers/`), official(`entry/${teamId}/history/`)
  ]);
  return reconstruct({ elements:boot.elements, initialPicks:initial.picks, currentPicks:picks.picks, transfers, chips:history.chips, publishedGameweek:published.id });
}
exports.handler = async event => {
  try {
    if (event.httpMethod !== 'POST') return core.response(405, { error: 'Method not allowed.' });
    if (!core.sameOrigin(event)) return core.response(403, { error: 'Open this report in MyFPL.' });
    const b = core.body(event), teamId = Number(b.teamId);
    if (!Number.isSafeInteger(teamId) || teamId <= 0 || teamId > 100000000) return core.response(400, { error: 'Load your FPL Team ID first.' });
    if (Date.now() >= core.LAUNCH && b.action !== 'selling-prices') {
      const account = core.session(event);
      if (!account) return core.response(401, { error: 'Verify your email to open your weekly report.' });
      const s = core.store(), user = await s.get('user:' + account.sub, { type: 'json' });
      const { entitlement } = require('./lib/paypal-core'); const access = await entitlement(account.sub, s);
      if (!(process.env.OWNER_EMAIL && user?.email === process.env.OWNER_EMAIL.trim().toLowerCase()) && (!['pro', 'ultra'].includes(access.plan) || access.until <= Date.now())) return core.response(402, { error: 'An active Pro or Ultra subscription is required for this report.' });
      const owner = !!process.env.OWNER_EMAIL && user?.email === process.env.OWNER_EMAIL.trim().toLowerCase();
      if (!owner && Number(user?.teamId) !== teamId) return core.response(403, { error: 'This subscription is linked to another Team ID. Sign in with the team you want to plan.' });
    }
    const [boot, fixtures, entry] = await Promise.all([official('bootstrap-static/', 300000), official('fixtures/', 300000), official(`entry/${teamId}/`)]);
    const next = boot.events.find(e => !e.finished && Date.parse(e.deadline_time) > Date.now());
    if (!next) return core.response(400, { error: 'No upcoming FPL deadline is available.' });
    const published = [...boot.events].filter(e => Date.parse(e.deadline_time) <= Date.now()).sort((a, b) => b.id - a.id)[0];
    if (!published) return core.response(400, { error: 'This team has no published gameweek squad yet.' });
    const picks = await official(`entry/${teamId}/event/${published.id}/picks/`);
    const automatic = await sellingPrices(boot, teamId, published, picks);
    if (b.action === 'selling-prices') return core.response(200, { ...automatic, teamId, fetchedAt:new Date().toISOString() });
    const squadIds = Array.isArray(b.squadIds) ? b.squadIds.map(Number) : picks.picks.map(p => p.element);
    const bank = b.bank == null ? (picks.entry_history?.bank || 0) / 10 : Number(b.bank);
    const freeTransfers = Number(b.freeTransfers ?? 0);
    if (!Number.isFinite(bank) || bank < 0 || bank > 100 || !Number.isInteger(freeTransfers) || freeTransfers < 0 || freeTransfers > 5) return core.response(400, { error: 'Confirm bank (0–100m) and free transfers (0–5).' });
    const league = b.leagueId ? await leagueContext(entry, teamId, Number(b.leagueId), null, published.id) : null;
    const prices = { ...Object.fromEntries(Object.entries(automatic.prices).map(([id,row])=>[id,row.price])), ...(b.sellingPrices || {}) };
    const report = plan({ elements: boot.elements, fixtures, squadIds, gw: next.id, bank, freeTransfers, sellingPrices: prices, fieldOwnership: league?.ownership || {}, fieldSize:league?.analysed || 0 });
    return core.response(200, { ...report, team: entry.name, teamId, gameweek: next.id, deadline: next.deadline_time, publishedGameweek: published.id, generatedAt: new Date().toISOString(), bank, freeTransfers, league, leagues: entry.leagues?.classic?.map(l => ({ id: l.id, name: l.name, rank: l.entry_rank })) || [], warnings: [...report.warnings, `Public picks are from GW ${published.id}; confirm any unpublished transfers and current selling prices on official FPL.`] });
  } catch (error) { return core.response(error.status || 503, { error: error.status ? error.message : 'The weekly report could not load. Retry shortly; your saved squad has not been changed.' }); }
};
exports.leagueContext = leagueContext;
