// Public history establishes acquisition costs; private FPL sessions are never collected.
function reconstruct({ elements, initialPicks, currentPicks, transfers, chips = [], publishedGameweek }) {
  const players = new Map(elements.map(p => [p.id, p]));
  const holdings = new Map();
  const freeHits = new Set(chips.filter(c => c.name === 'freehit').map(c => c.event));
  for (const pick of initialPicks || []) {
    const p = players.get(pick.element);
    if (p && Number.isInteger(p.now_cost) && Number.isInteger(p.cost_change_start)) holdings.set(p.id, p.now_cost - p.cost_change_start);
  }
  for (const transfer of [...transfers].filter(t => t.event <= publishedGameweek && !freeHits.has(t.event)).sort((a,b) => Date.parse(a.time) - Date.parse(b.time))) {
    holdings.delete(transfer.element_out);
    if (Number.isInteger(transfer.element_in_cost) && transfer.element_in_cost > 0) holdings.set(transfer.element_in, transfer.element_in_cost);
  }
  const temporary = freeHits.has(publishedGameweek);
  const prices = {}, missing = [];
  for (const pick of currentPicks) {
    const p = players.get(pick.element), purchase = holdings.get(pick.element);
    if (temporary || !p || !Number.isInteger(purchase) || purchase <= 0 || !Number.isInteger(p.now_cost)) { missing.push(pick.element); continue; }
    const selling = p.now_cost <= purchase ? p.now_cost : purchase + Math.floor((p.now_cost - purchase) / 2);
    prices[p.id] = { price:selling / 10, purchasePrice:purchase / 10, marketPrice:p.now_cost / 10, source:'Official public history', publishedGameweek };
  }
  return { prices, missing, publishedGameweek, warning:temporary ? 'This published squad used Free Hit; its temporary purchase prices cannot be established from public records.' : 'Calculated from official published transfers and current market prices. Transfers made since the last deadline may not be public yet.' };
}
module.exports = { reconstruct };
