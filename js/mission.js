/* Weekly reports and paid access use server verification. Browser storage holds planning preferences only. */
(() => {
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const money = n => '£' + Number(n).toFixed(1) + 'm';
  let challenge = null, billingConfig = null, report = null, busy = false;
  const prefsKey = () => 'myfpl_mission_' + currentTeamId();
  document.addEventListener('myfpl-team-loaded',()=>{
    sellingFields();
    let prefs={};try{prefs=JSON.parse(localStorage.getItem(prefsKey())||'{}');}catch{}
    el('missionLeague').replaceChildren(new Option('Start with my team',''),...(window.myfplClassicLeagues||[]).map(l=>new Option(l.name,l.id)));
    el('missionLeague').value=String(prefs.leagueId||'');el('missionRival').value=prefs.rivalId||'';el('missionFt').value=prefs.freeTransfers??1;
  });
  async function api(path, data) {
    const response = await fetch('/api/' + path, { method: data ? 'POST' : 'GET', credentials:'same-origin', headers: { 'Content-Type':'application/json' }, ...(data ? { body:JSON.stringify(data) } : {}), signal:AbortSignal.timeout(45000) });
    const body = await response.json().catch(() => ({ error:'The service returned an unexpected response. Try again shortly.' }));
    if (!response.ok) throw new Error(body.error || 'Request failed. Please try again.');
    return body;
  }
  function openLogin() { el('loginModal').classList.remove('hidden'); el('loginTeamId').value = currentTeamId() || ''; el('loginEmail').focus(); }
  async function accountRefresh() {
    try {
      const account = await api('account'); window.myfplAccount = account;
      authSession = account.signedIn ? { email:account.email, teamId:account.teamId, plan:account.owner ? 'owner' : account.plan, paidUntil:account.paidUntil } : null;
      updatePlanUI();
      renderOwnerTeams();
      el('authBtn').textContent = account.signedIn ? 'Sign out' : 'Sign in';
      el('cancelSubscription').classList.toggle('hidden', !account.signedIn || !['pro','ultra'].includes(account.plan));
    } catch { window.myfplAccount = null; el('billingStatus').textContent = 'Verified account service is not available yet. Free preview remains available.'; }
  }
  function renderOwnerTeams() {
    const account = window.myfplAccount;
    el('ownerTeamsPanel').classList.toggle('hidden', !account?.owner);
    el('ownerTeamSwitchWrap').classList.toggle('hidden', !account?.owner);
    if (!account?.owner) return;
    const teams = [{ teamId:account.teamId, label:'Primary team' }, ...(account.teams || []).filter(t=>t.teamId!==account.teamId)];
    el('ownerTeamSwitch').replaceChildren(...teams.map(t=>new Option((t.label || 'Team')+' · '+t.teamId,t.teamId)));
    el('ownerTeamSwitch').value=String(currentTeamId());
    el('ownerTeamList').replaceChildren(...(account.teams || []).map(t=>{
      const row=document.createElement('p');row.textContent=(t.label||'Team')+' · '+t.teamId+' ';
      const remove=document.createElement('button');remove.type='button';remove.className='btn btn-outline';remove.textContent='Remove from list';
      remove.onclick=async()=>{try{await api('account',{action:'saveTeams',teams:account.teams.filter(x=>x.teamId!==t.teamId)});await accountRefresh();}catch(error){el('ownerTeamsStatus').textContent=error.message;}};
      row.append(remove);return row;
    }));
  }
  el('ownerTeamForm').addEventListener('submit',async event=>{
    event.preventDefault();const account=window.myfplAccount;if(!account?.owner)return;
    const teamId=Number(el('ownerNewTeamId').value),label=el('ownerNewTeamLabel').value.trim();
    try{await api('account',{action:'saveTeams',teams:[...(account.teams||[]).filter(t=>t.teamId!==teamId),{teamId,label}]});await accountRefresh();el('ownerTeamsStatus').textContent='Saved. Switch teams above without signing out.';}
    catch(error){el('ownerTeamsStatus').textContent=error.message;}
  });
  el('ownerTeamSwitch').addEventListener('change',async()=>{
    saveSquadLocal();el('teamIdInput').value=el('ownerTeamSwitch').value;
    el('teamIdInput').dispatchEvent(new Event('change'));rememberTeamId(Number(el('ownerTeamSwitch').value));await init(true);
  });
  el('authBtn').addEventListener('click', async () => {
    if (!window.myfplAccount?.signedIn) { openLogin(); return; }
    try { await api('account', { action:'logout' }); window.myfplAccount=null; authSession=null; updatePlanUI(); renderOwnerTeams(); el('authBtn').textContent='Sign in'; } catch(error) { setStatus(error.message); }
  });
  el('loginSubmitBtn').addEventListener('click', async () => {
    const btn=el('loginSubmitBtn'); btn.disabled=true;
    try {
      if (!challenge) {
        const sent=await api('account',{action:'request',email:el('loginEmail').value,teamId:Number(el('loginTeamId').value)});
        challenge=sent.challenge; el('loginCodeLabel').classList.remove('hidden'); btn.textContent='Verify code'; el('loginMsg').textContent=sent.message; el('loginCode').focus();
      } else {
        const verified=await api('account',{action:'verify',challenge,code:el('loginCode').value});
        el('teamIdInput').value=verified.teamId; rememberTeamId(verified.teamId); challenge=null; el('loginCode').value=''; el('loginCodeLabel').classList.add('hidden'); btn.textContent='Send sign-in code'; el('loginModal').classList.add('hidden');
        await accountRefresh(); await init(true);
        if(el('loginMatchdayEmail')?.checked) await setMatchdaySubscription(verified.email,verified.teamId,true);
      }
    } catch(error) { el('loginMsg').textContent=error.message; }
    finally { btn.disabled=false; }
  });
  ['loginEmail','loginTeamId'].forEach(id=>el(id).addEventListener('change',()=>{challenge=null;el('loginCodeLabel').classList.add('hidden');el('loginSubmitBtn').textContent='Send sign-in code';}));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')el('loginModal').classList.add('hidden');});
  function sellingFields() {
    if(!squad.length) return;
    const rows=sellingPriceRows();
    el('sellingPriceFields').innerHTML=squad.map(p=>`<label>${escape(p.web_name)}<input type="number" data-selling="${p.id}" min="0.1" max="${p.price}" step="0.1" placeholder="Market ${money(p.price)}" value="${confirmedSellingPrice(p)?rows[p.id].price:''}" aria-label="${escape(p.web_name)} selling price"></label>`).join('');
    if(!el('missionBank').value)el('missionBank').value=Number(bank).toFixed(1);
  }
  el('refreshSellingPrices').addEventListener('click',async()=>{const button=el('refreshSellingPrices');button.disabled=true;try{await syncOfficialSellingPrices();sellingFields();renderWeeklyStrip();}finally{button.disabled=false;}});
  el('saveSellingPrices').addEventListener('click',()=>{
    const inputs=[...el('sellingPriceFields').querySelectorAll('input')], values={};
    for(const input of inputs) {
      if(!input.value.trim())continue;
      if(!input.checkValidity()){input.reportValidity();return;}
      values[input.dataset.selling]={price:Number(input.value),confirmedAt:Date.now()};
    }
    try {localStorage.setItem('fpl_selling_'+currentTeamId(),JSON.stringify(values));el('missionStatus').textContent=`Saved ${Object.keys(values).length} confirmed selling prices for this Team ID.`;renderWeeklyStrip();}catch{el('missionStatus').textContent='Your browser could not save prices. Enable local storage and retry.';}
  });
  function render(data) {
    report=data;
    const league=data.league, rival=league?.rival;
    const stat=(label,value,note)=>`<div class="mission-stat"><small>${escape(label)}</small><strong>${escape(value)}</strong><small>${escape(note)}</small></div>`;
    const option=(name,move,kicker)=>`<article class="mission-option ${name==='Steady'&&move?'best':''}"><span class="mission-kicker">${escape(kicker)}</span><h3>${name}</h3><div class="option-gain">${move?'+'+move.gain.toFixed(1):'0.0'} <small style="font-size:.8rem">estimated points vs hold</small></div><p>${move?`${escape(move.out.name)} → <strong>${escape(move.in.name)}</strong>`:'Keep your squad and preserve flexibility.'}</p><p class="muted">${move?`${move.hit?'-'+move.hit+' hit included':'No points hit'} · ${money(move.bankAfter)} left · next 3 GWs: +${Number(move.gain3 ?? move.gain).toFixed(1)} estimated pts`:'No hit · no budget spent'}</p>${move?`<p class="muted">Selling price ${money(move.salePrice)}, from official history or your correction. ${rival?(move.differential?'Incoming player differs from the rival’s published squad.':'Incoming player matches the rival’s published squad.'):'Choose a rival to compare squad ownership.'}</p>`:''}</article>`;
    const players=list=>list.map(p=>`<li><strong>${escape(p.name)}</strong> · ${p.xp.toFixed(1)} estimated pts${p.fixtures.length>1?' · double gameweek':!p.fixtures.length?' · blank gameweek':''}${p.chance!=null&&p.chance<100?' · availability '+p.chance+'%':''}</li>`).join('');
    const deadline=new Date(data.deadline).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
    el('missionReport').innerHTML=`<div class="mission-report-head"><span class="mission-kicker">GW ${data.gameweek} · ${escape(data.team)}</span><h2>Your gameweek decision</h2><p class="muted">Deadline ${escape(deadline)} (your local time). Built ${escape(new Date(data.generatedAt).toLocaleTimeString())} · model ${escape(data.model)}.</p></div><div class="mission-stats">${stat('Mini-league rank',league?.rank?'#'+league.rank:'—',league?.name||'Choose a league')}${stat('Points gap',rival? (rival.gap>0? '+'+rival.gap:rival.gap):'—',rival?`To ${rival.name}`:'Choose a target rival')}${stat('Squad forecast',data.forecast.toFixed(1),'Estimated XI + captain points')}${stat('Captain shortlist',data.captains[0]?.name||'—',data.captains[1]?'Vice option: '+data.captains[1].name:'')}</div>${rival?`<div class="mission-note">Target: <strong>${escape(rival.name)}</strong>, rank #${rival.rank}. ${rival.gap>0?'You trail by '+rival.gap+' points.':rival.gap<0?'You lead this rival by '+Math.abs(rival.gap)+' points.':'You are level on points.'} These are published totals, not live ranks.${rival.captainId?' Their last published captain has player ID '+rival.captainId+'.':''}</div>`:''}<div class="mission-options">${option('Hold',null,'The baseline')}${option('Steady',data.steady,'Highest estimated net gain')}${option('Chase',data.chase,'A rival differential')}</div><div class="mission-lineup"><section class="card"><h3>Starting XI · ${escape(data.formation)}</h3><ul>${players(data.xi)}</ul></section><section class="card"><h3>Captain and vice options</h3><ul>${players(data.captains)}</ul><h3>Bench order</h3><ul>${players(data.bench)}</ul><p class="muted">The reserve goalkeeper is listed separately first; the remaining order applies to outfield substitutes.</p></section></div><div class="mission-note">${data.warnings.map(escape).join('<br>')}</div><p class="muted">This report is advice. Review late team news and submit changes yourself on official FPL.</p>`;
    const selected=el('missionLeague').value; el('missionLeague').replaceChildren(new Option('Start with my team',''),...data.leagues.map(l=>new Option(l.name,l.id))); el('missionLeague').value=selected;
    if(league) {
      const key='myfpl_progress_'+currentTeamId(); let history=[];try{history=JSON.parse(localStorage.getItem(key)||'[]');}catch{}
      const previous=history.filter(x=>x.leagueId===league.id&&x.gw<data.publishedGameweek).sort((a,b)=>b.gw-a.gw)[0];
      history=history.filter(x=>!(x.leagueId===league.id&&x.gw===data.publishedGameweek)); history.push({leagueId:league.id,gw:data.publishedGameweek,rank:league.rank,gap:rival?.gap,rivalId:rival?.teamId});
      try{localStorage.setItem(key,JSON.stringify(history.slice(-80)));}catch{}
      const progress=document.createElement('div');progress.className='mission-progress';progress.textContent=previous&&previous.rivalId===rival?.teamId&&Number.isFinite(previous.gap)&&Number.isFinite(rival?.gap)?`Published gap since GW ${previous.gw}: ${previous.gap} → ${rival.gap} points. This tracks results, not proof the app caused the change.`:'Progress baseline saved on this device. Return after the next scored gameweek to compare the published gap.';el('missionReport').append(progress);
    }
  }
  el('missionForm').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    if(!currentTeamId()){el('missionStatus').textContent='Enter your Team ID above and press Refresh first.';el('teamIdInput').focus();return;}
    busy=true;el('missionBuild').disabled=true;el('missionStatus').textContent='Loading official data and comparing legal options…';
    try{
      const sellingPrices={};for(const p of squad)if(confirmedSellingPrice(p))sellingPrices[p.id]=sellingPriceRows()[p.id].price;
      const preferences={leagueId:Number(el('missionLeague').value)||null,rivalId:Number(el('missionRival').value)||null,freeTransfers:Number(el('missionFt').value)};
      const data=await api('coach',{teamId:currentTeamId(),...preferences,bank:el('missionBank').value===''?null:Number(el('missionBank').value),sellingPrices,...(squad.length===15&&window.myfplLoadedTeam===currentTeamId()?{squadIds:squad.map(p=>p.id)}:{})});
      render(data);el('missionStatus').textContent='Plan ready. Review your bank, selling prices and late team news before deciding.';localStorage.setItem(prefsKey(),JSON.stringify(preferences));
    }catch(error){el('missionStatus').textContent=error.message;}
    finally{busy=false;el('missionBuild').disabled=false;sellingFields();}
  });
  el('missionSquad').addEventListener('click',()=>document.querySelector('[data-view="pick"]').click());
  el('missionPricing').addEventListener('click',()=>document.querySelector('[data-view="chips"]').click());
  document.querySelector('[data-view="mission"]').addEventListener('click',sellingFields);
  el('teamIdInput').addEventListener('change',()=>{report=null;el('missionBank').value='';el('missionLeague').replaceChildren(new Option('Start with my team',''));el('missionRival').value='';el('missionReport').innerHTML='<div class="mission-empty"><h2>Build a fresh plan for this team</h2><p>The previous team’s report has been cleared.</p></div>';});
  document.querySelectorAll('[data-subscribe]').forEach(btn=>btn.addEventListener('click',async()=>{
    if(!window.myfplAccount?.signedIn){openLogin();return;}
    btn.disabled=true;try{const result=await api('billing',{action:'create',plan:btn.dataset.subscribe});location.assign(result.approval);}catch(error){el('billingStatus').textContent=error.message;}finally{btn.disabled=false;}
  }));
  el('cancelSubscription').addEventListener('click',async()=>{if(!confirm('Cancel future monthly renewal? Current verified paid access lasts until the paid period ends.'))return;try{const result=await api('billing',{action:'cancel'});el('billingStatus').textContent=result.message;await accountRefresh();}catch(error){el('billingStatus').textContent=error.message;}});
  api('billing').then(config=>{billingConfig=config;el('billingStatus').textContent=config.open?'PayPal subscriptions are open. Monthly renewal; cancel through your account or PayPal.':`Free preview through November. Subscriptions open 1 December at Pro $2.49/month or Ultra $4.99/month after merchant verification.`;}).catch(()=>{el('billingStatus').textContent='Billing is being configured; no payment has been taken.';});
  document.addEventListener('click',event=>{if(event.target.closest('[data-open-pricing]'))document.querySelector('[data-view="chips"]').click();});
  accountRefresh();
  const returned=new URLSearchParams(location.search).get('billing');
  if(returned==='return')el('missionStatus').textContent='Returned from PayPal. Access is checked against verified payment; allow a short time for confirmation, then sign in again if needed.';
  if(returned==='cancel')el('missionStatus').textContent='Checkout cancelled. Your current plan has not been upgraded.';
})();
