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
    el('missionLeague').value=String(prefs.leagueId||'');el('missionFt').value=prefs.freeTransfersConfirmed && prefs.gameweek===planningGw() ? prefs.freeTransfers : 0;el('missionBank').value=prefs.bank==null||prefs.gameweek!==planningGw()?Number(bank).toFixed(1):prefs.bank;
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
      inspectCloud();
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
    if(data.forecasts){window.myfplEvidenceForecast={gameweek:data.gameweek,generatedAt:Date.now(),players:data.forecasts};recomputeAllXP();renderPitch();renderPlayerList();renderWeeklyStrip();}
    const league=data.league, move=data.recommendation;
    const stat=(label,value,note)=>`<div class="mission-stat"><small>${escape(label)}</small><strong>${escape(value)}</strong><small>${escape(note)}</small></div>`;
    const players=list=>list.map(p=>`<li><strong>${escape(p.name)}</strong> · ${p.xp.toFixed(1)} estimated pts · ${p.evidence?.minutes??'—'} expected minutes · ${escape(p.evidence?.confidence||'unknown')} confidence${p.evidence?.news?' · '+escape(p.evidence.news):''}</li>`).join('');
    const option=move ? `<article class="mission-option best"><span class="mission-kicker">Recommended transfer package</span><h3>${move.moves.map(m=>escape(m.out.name)+" → "+escape(m.in.name)).join("<br>")}</h3><div class="option-gain">+${move.gain.toFixed(1)} net estimated points</div><p>${(move.gain+move.hit).toFixed(1)} estimated gain before hit − ${move.hit} hit = ${move.gain.toFixed(1)} net.</p><p>${money(move.bankAfter)} left · ${move.size} transfers · ${Math.min(move.size,data.freeTransfers)} free + ${Math.max(0,move.size-data.freeTransfers)} paid (${move.hit} points)</p><p>${league?`${Math.round(move.fieldOwnership*100)}% of the ${league.analysed} analysed league opponents own the incoming players on average.`:'Choose a mini-league for field ownership.'}</p><button id="missionApplyBest" class="btn btn-blue" type="button">Apply this package</button></article>` : `<article class="mission-option best"><span class="mission-kicker">Recommendation</span><h3>Hold this gameweek</h3><p>No affordable transfer package improves the legal XI plus captain forecast enough to cover its points hit.</p></article>`;
    el('missionReport').innerHTML=`<div class="mission-report-head"><h2>Win the league · GW ${data.gameweek}</h2><p>${escape(data.team)} · deadline ${escape(new Date(data.deadline).toLocaleString())}</p></div><div class="mission-stats">${stat('League rank',league?.rank?'#'+league.rank:'—',league?.name||'Choose a mini-league')}${stat('Gap to first',league?.leader?.gap??'—','Published points; target is first place')}${stat('League coverage',league?league.analysed+' opponents':'—',league?.complete?'All other league managers':'Published field sample')}${stat('Remaining free transfers',data.freeTransfers,'Packages or hold; all hits deducted')}</div>${league?.warning?`<p class="mission-note">${escape(league.warning)}</p>`:''}<div class="mission-lineup"><article class="mission-option"><span class="mission-kicker">Baseline</span><h3>Hold</h3><p>0-point hit · keep your squad and preserve flexibility.</p></article>${option}</div><div class="mission-lineup"><section class="card"><h3>Current squad XI · ${escape(data.formation)}</h3><ul>${players(data.xi)}</ul></section><section class="card"><h3>Captain shortlist</h3><ul>${players(data.captains)}</ul><h3>Bench order</h3><ul>${players(data.bench)}</ul></section></div><div class="mission-note">${data.warnings.map(escape).join('<br>')}</div><p>This updates your MyFPL plan. Submit transfers yourself on official FPL.</p>`;
    if(move) el('missionApplyBest').onclick=async()=>{
      if(currentTeamId()!==data.teamId){setStatus('Load a fresh plan for this team.');return;}
      const moves=move.moves.map(m=>({out:squad.find(p=>p.id===m.out.id),inn:playersForTransfer(m.in.id)}));
      if(moves.some(m=>!m.out||!m.inn)){setStatus('Squad changed. Build a fresh plan.');return;}
      const previousBank=bank;bank=Number(el('missionBank').value);
      const applied=await applySuggestedTransfer({moves,gain:move.gain,netGain:move.gain,hits:move.hit/4});
      if(!applied)bank=previousBank;
    };
    const timeline=data.roadmap;
    if(timeline){const section=document.createElement('section');section.className='card mission-controls';section.innerHTML=`<h3>Your six-gameweek scenario</h3><div style="overflow:auto"><table><thead><tr><th>GW</th><th>Free before → after</th><th>Decision</th><th>Hit</th><th>Net gain</th><th>Bank</th><th>Blanks / doubles</th></tr></thead><tbody>${timeline.weeks.map(w=>`<tr><td>${w.gameweek}</td><td>${w.freeBefore} → ${w.freeAfter}</td><td>${escape(w.action)} (${w.moves.length})${w.moves.map(m=>`<br>${escape(m.out.name)} → ${escape(m.in.name)}`).join('')}</td><td>${w.hit}</td><td>${w.netGain.toFixed(1)}</td><td>${money(w.bankAfter)}</td><td>${w.blankPlayers} / ${w.doublePlayers}</td></tr>`).join('')}</tbody></table></div><h3>Chip alternatives · review on official FPL</h3>${timeline.chips.map(c=>`<p>${escape(c.chip)} · GW ${c.gameweek}: ${escape(c.reason)}</p>`).join('')}<p>${timeline.assumptions.map(escape).join('<br>')}</p>`;el('missionReport').append(section);}
    const journal=document.createElement('p');journal.className='mission-note';journal.textContent=data.journal?.saved?'Your first pre-deadline report is locked for later scoring. Building another report does not replace it.':data.journal?.reason||'Sign in to record this recommendation.';el('missionReport').append(journal);
    const selected=el('missionLeague').value;
    el('missionLeague').replaceChildren(new Option('Start with my team',''),...data.leagues.map(l=>new Option(l.name,l.id)));el('missionLeague').value=selected;
    if(league) {
      const key='myfpl_progress_'+currentTeamId();let history=[];try{history=JSON.parse(localStorage.getItem(key)||'[]');}catch{}
      history.push({leagueId:league.id,gw:data.publishedGameweek,rank:league.rank,gap:league.leader?.gap,target:'first-place'});
      try{localStorage.setItem(key,JSON.stringify(history.slice(-80)));}catch{}
    }
  }
  function playersForTransfer(id) { return players.find(p=>p.id===id); }
  ['missionFt','ftInput','ftInputCustom'].forEach(id=>el(id)?.addEventListener('input',()=>{const value=Number(el(id).value);['missionFt','ftInput','ftInputCustom'].forEach(other=>{if(el(other))el(other).value=value;});const prefs={freeTransfers:value,freeTransfersConfirmed:true,gameweek:planningGw()};try{localStorage.setItem(prefsKey(),JSON.stringify({...JSON.parse(localStorage.getItem(prefsKey())||'{}'),...prefs}));}catch{}renderWeeklyStrip();}));
  el('missionForm').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    if(!currentTeamId()){el('missionStatus').textContent='Enter your Team ID above and press Refresh first.';el('teamIdInput').focus();return;}
    busy=true;el('missionBuild').disabled=true;el('missionStatus').textContent='Loading official data and comparing legal options…';
    try{
      const sellingPrices={};for(const p of squad)if(confirmedSellingPrice(p))sellingPrices[p.id]=sellingPriceRows()[p.id].price;
      const preferences={bank:el('missionBank').value===''?null:Number(el('missionBank').value),leagueId:Number(el('missionLeague').value)||null,freeTransfers:Number(el('missionFt').value),freeTransfersConfirmed:true,gameweek:planningGw()};
      const data=await api('coach',{teamId:currentTeamId(),...preferences,bank:el('missionBank').value===''?null:Number(el('missionBank').value),sellingPrices,...(squad.length===15&&window.myfplLoadedTeam===currentTeamId()?{squadIds:squad.map(p=>p.id)}:{})});
      preferences.gameweek=data.gameweek;if(preferences.bank==null)preferences.bank=data.bank;render(data);el('missionStatus').textContent='Plan ready. Review your bank, selling prices and late team news before deciding.';localStorage.setItem(prefsKey(),JSON.stringify(preferences));saveCloud();
    }catch(error){el('missionStatus').textContent=error.message;}
    finally{busy=false;el('missionBuild').disabled=false;sellingFields();}
  });
  let cloudRevision=null,cloudTeam=null,cloudNewer=false;
  function snapshot() {
    const parse=k=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}};
    const savedSquad=parse(squadStorageKey(currentTeamId())),preferences=parse(prefsKey())||{};
    if(savedSquad&&preferences.bank!=null&&preferences.gameweek===planningGw())savedSquad.bank=preferences.bank;
    return {squad:savedSquad,preferences,sellingPrices:sellingPriceRows(),chips:getChipPlan(),draftGameweek:localStorage.getItem('fpl_draft_gw_'+currentTeamId())};
  }
  async function inspectCloud(){
    if(!window.myfplAccount?.signedIn||!currentTeamId())return;
    const teamId=currentTeamId();
    try{const row=await api('plans',{action:'load',teamId});if(teamId!==currentTeamId())return;cloudTeam=teamId;cloudRevision=row.revision;const local=snapshot();cloudNewer=!!(row.state&&Date.parse(row.savedAt)>Math.max(Number(local.squad?.savedAt||0)*(local.draftGameweek?1:0),Date.parse(localStorage.getItem('myfpl_cloud_ack_'+teamId)||'1970-01-01')));el('cloudStatus').textContent=row.state?(cloudNewer?'A newer cloud plan is available. Load it to restore this team.':'Cloud revision '+row.revision+' · '+row.savedAt):'No cloud plan yet. Save this device’s plan.';}
    catch(error){el('cloudStatus').textContent=error.message;}
  }
  async function saveCloud(explicit=false){
    if(!window.myfplAccount?.signedIn)return;
    if(cloudTeam!==currentTeamId()||cloudRevision==null)await inspectCloud();
    if(cloudNewer&&!explicit){el('cloudStatus').textContent='Newer cloud plan detected; automatic saving paused. Load it or explicitly save this device’s version.';return;}
    const teamId=currentTeamId();
    try{const result=await api('plans',{action:'save',teamId,revision:cloudRevision,state:snapshot()});if(teamId!==currentTeamId())return;cloudRevision=result.revision;cloudNewer=false;localStorage.setItem('myfpl_cloud_ack_'+teamId,result.savedAt);el('cloudStatus').textContent='Saved privately · revision '+result.revision+' · '+result.savedAt;}
    catch(error){el('cloudStatus').textContent=error.message;}
  }
  el('cloudSave').onclick=()=>saveCloud(true);
  el('cloudLoad').onclick=async()=>{
    const teamId=currentTeamId();
    try{const row=await api('plans',{action:'load',teamId});if(teamId!==currentTeamId())return;if(!row.state){el('cloudStatus').textContent='No cloud plan for this team.';return;}
      localStorage.setItem('myfpl_before_cloud_'+teamId,JSON.stringify(snapshot()));
      const s=row.state;if(s.squad)localStorage.setItem(squadStorageKey(teamId),JSON.stringify(s.squad));localStorage.setItem(prefsKey(),JSON.stringify(s.preferences));localStorage.setItem('fpl_selling_'+teamId,JSON.stringify(s.sellingPrices));localStorage.setItem('fpl_chip_plan_'+teamId,JSON.stringify(s.chips));
      if(s.draftGameweek)localStorage.setItem('fpl_draft_gw_'+teamId,String(s.draftGameweek));else localStorage.removeItem('fpl_draft_gw_'+teamId);
      cloudRevision=row.revision;cloudTeam=teamId;cloudNewer=false;localStorage.setItem('myfpl_cloud_ack_'+teamId,row.savedAt);if(s.squad&&s.preferences.gameweek===planningGw())localStorage.setItem('fpl_draft_gw_'+teamId,String(planningGw()));await init(true);el('cloudStatus').textContent='Loaded cloud revision '+row.revision+'. Previous local plan backed up on this device.';
    }catch(error){el('cloudStatus').textContent=error.message;}
  };
  document.addEventListener('myfpl-team-loaded',inspectCloud);
  document.addEventListener('myfpl-plan-changed',()=>saveCloud());
  el('loadDecisionHistory').onclick=async()=>{
    try{const data=await api('plans',{action:'history',teamId:currentTeamId()});el('decisionHistory').innerHTML=data.records.length?data.records.map(r=>`<article class="mission-note"><strong>GW ${r.gameweek} · ${escape(r.status)}</strong><p>Locked ${escape(r.createdAt)} · forecast ${Number(r.forecast).toFixed(1)}</p><p>Plan ${r.recommendedPoints??'—'} · Hold ${r.holdPoints??'—'} · difference ${r.difference??'—'} · ${r.chosen.hit} hit</p><p>Actual manager points after hits: ${r.managerPoints??'Awaiting final results'}</p><p>League rank ${r.league?.rank??'—'} · gap to first at recording ${r.league?.gap??'—'}</p></article>`).join('')+'<p>'+escape(data.note)+'</p>':'No pre-deadline reports recorded for this team yet.';}catch(error){el('decisionHistory').textContent=error.message;}
  };
  fetch('/assets/backtest-summary.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{const p=d.policies;el('backtestEvidence').innerHTML=`<p><strong>${escape(d.season)} restricted holdout · GW ${escape(d.holdout.gameweeks)}</strong></p><p>Model ${p.model.points} points (${p.model.hits} hit) · Hold ${p.hold.points} · Form ${p.form.points} (${p.form.hits} hit). All scores are net.</p><p>Prediction RMSE: model ${d.holdout.model.rmse.toFixed(3)} · form ${d.holdout.form.rmse.toFixed(3)}. The model ${p.model.points>p.form.points?'beat':'did not beat'} the form policy on points.</p><p>${d.limitations.map(escape).join('<br>')}</p><a href="/assets/backtest-summary.json" target="_blank" rel="noopener">Full methodology and results</a>`;}).catch(()=>el('backtestEvidence').textContent='Historical benchmark unavailable. No performance claim is made.');
  el('missionSquad').addEventListener('click',()=>document.querySelector('[data-view="pick"]').click());
  el('missionPricing').addEventListener('click',()=>document.querySelector('[data-view="chips"]').click());
  document.querySelector('[data-view="mission"]').addEventListener('click',sellingFields);
  el('teamIdInput').addEventListener('change',()=>{report=null;el('missionBank').value='';el('missionLeague').replaceChildren(new Option('Start with my team',''));el('missionReport').innerHTML='<div class="mission-empty"><h2>Build a fresh plan for this team</h2><p>The previous team’s report has been cleared.</p></div>';});
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
