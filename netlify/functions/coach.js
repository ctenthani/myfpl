const core = require('./lib/account-core');
const { plan } = require('./lib/decision-engine');
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
async function leagueContext(entry, teamId, leagueId, rivalId, gw) {
  const known = (entry.leagues?.classic || []).find(l => l.id === leagueId);
  if (!known) throw Object.assign(new Error('Choose a classic mini-league this team belongs to.'), { status: 400 });
  const page = Math.max(1, Math.ceil((known.entry_rank || 1) / 50));
  const data = await official(`leagues-classic/${leagueId}/standings/?page_standings=${page}`);
  const rows = data.standings?.results || [];
  const me = rows.find(r => r.entry === teamId);
  if (!me) return { id: leagueId, name: known.name, rank: known.entry_rank || null, warning: 'Standings changed while loading. Refresh to locate your team.', rivalIds: [] };
  let rival = rivalId ? rows.find(r => r.entry === rivalId) : rows.filter(r => r.rank < me.rank).sort((a, b) => b.rank - a.rank)[0];
  if (!rival) {
    const first = await official(`leagues-classic/${leagueId}/standings/?page_standings=1`);
    rival = rivalId ? first.standings?.results?.find(r => r.entry === rivalId) : first.standings?.results?.find(r => r.entry !== teamId);
  }
  // A chosen rival can be on any page: use their public league rank to locate that page.
  if (!rival && rivalId && rivalId !== teamId) {
    const rivalEntry = await official(`entry/${rivalId}/`);
    const rivalLeague = rivalEntry.leagues?.classic?.find(l => l.id === leagueId);
    if (rivalLeague) { const found = await official(`leagues-classic/${leagueId}/standings/?page_standings=${Math.max(1, Math.ceil(rivalLeague.entry_rank / 50))}`); rival = found.standings?.results?.find(r => r.entry === rivalId); }
  }
  if (rivalId && !rival) throw Object.assign(new Error('The chosen rival was not found in this mini-league.'), { status: 400 });
  let rivalPicks = null;
  if (rival) { try { rivalPicks = await official(`entry/${rival.entry}/event/${gw}/picks/`); } catch {} }
  return { id: leagueId, name: data.league?.name || known.name, rank: me.rank, total: me.total, page, rival: rival ? { teamId: rival.entry, name: rival.entry_name, rank: rival.rank, total: rival.total, gap: rival.total - me.total, captainId: rivalPicks?.picks?.find(p => p.is_captain)?.element || null } : null, rivalIds: rivalPicks?.picks?.map(p => p.element) || [] };
}
exports.handler = async event => {
  try {
    if (event.httpMethod !== 'POST') return core.response(405, { error: 'Method not allowed.' });
    if (!core.sameOrigin(event)) return core.response(403, { error: 'Open this report in MyFPL.' });
    const b = core.body(event), teamId = Number(b.teamId);
    if (!Number.isSafeInteger(teamId) || teamId <= 0 || teamId > 100000000) return core.response(400, { error: 'Load your FPL Team ID first.' });
    if (Date.now() >= core.LAUNCH) {
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
    const squadIds = Array.isArray(b.squadIds) ? b.squadIds.map(Number) : picks.picks.map(p => p.element);
    const bank = b.bank == null ? (picks.entry_history?.bank || 0) / 10 : Number(b.bank);
    const freeTransfers = Number(b.freeTransfers ?? 1);
    if (!Number.isFinite(bank) || bank < 0 || bank > 100 || !Number.isInteger(freeTransfers) || freeTransfers < 0 || freeTransfers > 5) return core.response(400, { error: 'Confirm bank (0–100m) and free transfers (0–5).' });
    const league = b.leagueId ? await leagueContext(entry, teamId, Number(b.leagueId), Number(b.rivalId) || null, published.id) : null;
    const report = plan({ elements: boot.elements, fixtures, squadIds, gw: next.id, bank, freeTransfers, sellingPrices: b.sellingPrices || {}, rivalIds: league?.rivalIds || [] });
    return core.response(200, { ...report, team: entry.name, teamId, gameweek: next.id, deadline: next.deadline_time, publishedGameweek: published.id, generatedAt: new Date().toISOString(), bank, freeTransfers, league, leagues: entry.leagues?.classic?.map(l => ({ id: l.id, name: l.name, rank: l.entry_rank })) || [], warnings: [...report.warnings, `Public picks are from GW ${published.id}; confirm any unpublished transfers and current selling prices on official FPL.`] });
  } catch (error) { return core.response(error.status || 503, { error: error.status ? error.message : 'The weekly report could not load. Retry shortly; your saved squad has not been changed.' }); }
};
exports.leagueContext = leagueContext;
