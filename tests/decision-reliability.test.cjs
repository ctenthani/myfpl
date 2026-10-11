const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/app.js', 'utf8');
function functionSource(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next < 0 ? undefined : next);
}
const player = (id, xp, team = 1, availability = 1) => ({
  id, xp, price: 5, position: 'MID', team_id: team, availability,
  ep_next: 3, selected_by_percent: 10
});
function transfers(squad, players, ft = 1, hits = 0, filters = null) {
  const context = vm.createContext({ squad, players, bank: 0,
    getSellingPrice: p => p.price, isUnlimitedTransferMode: () => false, transferXp: p => p.xp,
    transferStyle: () => 'optimised', passInFilters: () => true,
    passOutFilters: () => true, $: () => null });
  vm.runInContext(functionSource('findTransfers'), context);
  return context.findTransfers(ft, hits, filters);
}
test('unavailable player cannot be recommended', () => {
  assert.equal(transfers([player(1, 1)], [player(2, 20, 2, 0)]).suggestions.length, 0);
});
test('same-club replacement allowed when already owning three', () => {
  const squad = [player(1, 1), player(2, 8), player(3, 8)];
  assert.equal(transfers(squad, [player(4, 5)]).suggestions[0].moves[0].inn.id, 4);
});
test('fourth player from a club is rejected', () => {
  const squad = [player(1, 1, 2), player(2, 8), player(3, 8), player(4, 8)];
  assert.equal(transfers(squad, [player(5, 5)]).suggestions.length, 0);
});
test('hold beats a transfer whose gain is smaller than the hit', () => {
  assert.equal(transfers([player(1, 1)], [player(2, 3, 2)], 0, 1).suggestions.length, 0);
});
test('profitable hit reports net gain', () => {
  assert.equal(transfers([player(1, 1)], [player(2, 7, 2)], 0, 1).suggestions[0].netGain, 2);
});
test('smaller package survives when larger package loses points after hits', () => {
  const result = transfers([player(1, 1, 1), player(2, 4, 2)], [player(3, 6, 3), player(4, 5, 4)], 1, 1, { numTransfers: 2 });
  assert.equal(result.suggestions[0].size, 1);
  assert.equal(result.suggestions[0].netGain, 5);
});
function members(secret = '') {
  const context = vm.createContext({ exports: {}, process: { env: { OWNER_SECRET: secret } },
    Buffer, require: name => { if (name === '@netlify/blobs') throw Error('not installed'); return require(name); } });
  vm.runInContext(fs.readFileSync('netlify/functions/members.js', 'utf8'), context);
  return context.exports.handler;
}
test('public owner email cannot administer members', async () => {
  const response = await members('test-secret')({ httpMethod: 'POST', headers: { 'x-owner-email': 'ctenthani@gmail.com' }, body: '{"ownerEmail":"ctenthani@gmail.com"}' });
  assert.equal(response.statusCode, 403);
});
test('unconfigured owner secret fails closed', async () => {
  assert.equal((await members()({ httpMethod: 'GET', headers: {}, queryStringParameters: { list: '1' } })).statusCode, 403);
});
test('correct secret without storage cannot claim activation succeeded', async () => {
  const response = await members('test-secret')({ httpMethod: 'POST', headers: { 'x-owner-secret': 'test-secret' }, body: '{}' });
  assert.equal(response.statusCode, 503);
  assert.equal(JSON.parse(response.body).ok, false);
});
test('expired Ultra membership does not unlock access after the promotion', () => {
  const context = vm.createContext({ isFreePeriod: () => false,
    window: { myfplAccount: { signedIn:true, plan:'ultra', teamId:123, paidUntil:Date.now()-1000 } },
    currentTeamId: () => 123 });
  vm.runInContext(functionSource('isUltra'), context);
  assert.equal(context.isUltra(), false);
});
test('league strategy weighting is identical for owner and customer', () => {
  function boost(owner) {
    const context = vm.createContext({ _leagueHunt: { sample: 10, ownMap: { 1: 2 }, myRank: 8 }, isOwnerSession: () => owner });
    vm.runInContext(functionSource('huntBoost'), context);
    return context.huntBoost({ id: 1 });
  }
  assert.equal(boost(true), boost(false));
});
