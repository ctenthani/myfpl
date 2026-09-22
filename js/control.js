/* BT42.195km Race 2026 — Control Room logic */

(function () {
  // Bootstrap accounts (always available). Chair can create more ops accounts.
  const COMMITTEE_PIN = 'bt42oc';
  const CHAIR_PIN = 'bt42chair';
  const STAFF_KEY = 'bt42_staff_users';
  const SITE_CONTENT_KEY = 'bt42_site_content';
  const SESSION_USER_KEY = 'bt42_control_user';

  const STORAGE_KEY = 'bt42_checklist_status';
  const SPONSOR_KEY = 'bt42_sponsor_status';
  const NOTES_KEY = 'bt42_control_notes';
  const DASH_KEY = 'bt42_dashboard_metrics';
  const DEADLINE_KEY = 'bt42_deadline_status';
  const CHAIR_NOTES_KEY = 'bt42_chair_meeting_notes_edits';
  const BUDGET_KEY = 'bt42_budget_edits';
  const ROLES_KEY = 'bt42_roles_edits';
  const ATTEND_KEY = 'bt42_meeting_attendance';
  const PAYMENT_KEY = 'bt42_payment_status';
  const SIGS_KEY = 'bt42_esignatures';
  const FINISH_KEY = 'bt42_finish_status';
  const BIB_KEY = 'bt42_bib_numbers';
  const SYNC_TOKEN_KEY = 'bt42_oc_sync_token';
  const SYNC_META_KEY = 'bt42_oc_sync_meta';
  const VOL_KEY = 'bt42_volunteers';
  const APPROVALS_KEY = 'bt42_chair_approvals';
  const APPROVALS_SEED = [
    {
      id: 'ap-tents-145',
      requested: '2026-09-18',
      approvedOn: '2026-09-19',
      requestedBy: 'Marketing Organizing Subcommittee (Makawa)',
      payee: 'KC Investments / clinic & tents',
      bank: '',
      account: '',
      items: 'Tent + 200 chairs; tent clinic (mobile toilet / transport / attendants as quoted)',
      amount: 145000,
      vat: 0,
      mode: 'Cash',
      status: 'approved',
      comment: 'Approved by Chair — Chifundo Tenthani',
      ref: 'As per quotations'
    },
    {
      id: 'ap-toilet-640',
      requested: '2026-09-18',
      approvedOn: '2026-09-19',
      requestedBy: 'Marketing Organizing Subcommittee (Makawa)',
      payee: 'Toilet hire (Paws Printing and Allied Works)',
      bank: 'National Bank of Malawi',
      account: '1000841494',
      items: 'Mobile toilet hire MK450,000; transport hire MK100,000; attendants allowance MK90,000',
      amount: 640000,
      vat: 0,
      mode: 'Cash',
      status: 'approved',
      comment: 'Approved by Chair — Chifundo Tenthani',
      ref: 'As per quotations'
    },
    {
      id: 'ap-omega-340750',
      requested: '2026-09-16',
      approvedOn: '2026-09-19',
      requestedBy: 'Marketing Organizing Subcommittee (Makawa)',
      payee: 'Omega Signs and Graphics',
      bank: 'National Bank of Malawi',
      account: '1006551347',
      items: 'Hanging banners — 5 m × 2 @ MK145,000',
      amount: 290000,
      vat: 50750,
      mode: 'Cash',
      status: 'approved',
      comment: 'Approved by Chair — Chifundo Tenthani',
      ref: 'As per quotations'
    },
    {
      id: 'ap-mphatso-590',
      requested: '2026-09-16',
      approvedOn: '2026-09-19',
      requestedBy: 'Marketing Organizing Subcommittee (Makawa)',
      payee: 'Mphatso Chakhadza',
      bank: 'National Bank of Malawi',
      account: '100035106',
      items: '20 promotion posters MK15,000; victory stand MK20,000; main poster MK30,000; 2 start/finish arches MK50,000; 3 dummy cheques MK60,000; direction arrow MK20,000; 3 T-shirt chest numbers MK60,000; backdrop banner MK50,000',
      amount: 590000,
      vat: 0,
      mode: 'Cash',
      status: 'approved',
      comment: 'Approved by Chair — Chifundo Tenthani',
      ref: 'As per quotations'
    },
    {
      id: 'ap-medals-456',
      requested: '2026-09-18',
      approvedOn: '2026-09-19',
      requestedBy: 'Marketing Organizing Subcommittee (Makawa)',
      payee: 'Phatafuli medals',
      bank: '',
      account: '',
      items: '18 winning medals (6 gold, 6 silver, 6 bronze) @ MK9,500 = MK171,000; 30 participation medals (42.195 km) MK285,000',
      amount: 456000,
      vat: 0,
      mode: 'Cash',
      status: 'approved',
      comment: 'Approved by Chair — Chifundo Tenthani',
      ref: 'As per quotations'
    },
    {
      id: 'ap-paws-810',
      requested: '2026-09-16',
      approvedOn: '2026-09-19',
      requestedBy: 'Marketing Organizing Subcommittee (Makawa)',
      payee: 'Paws Printing and Allied Works',
      bank: 'National Bank of Malawi',
      account: '1000841494',
      items: '600 vinyl chest numbers @ MK750 = MK450,000; 9 dummy cheques (3 races) @ MK40,000 = MK360,000',
      amount: 810000,
      vat: 0,
      mode: 'Cash',
      status: 'approved',
      comment: 'Approved by Chair — Chifundo Tenthani',
      ref: 'As per quotations'
    },
    {
      id: 'ap-gazette-5500',
      requested: '2026-09-16',
      approvedOn: '',
      requestedBy: 'Marketing Organizing Subcommittee (Makawa)',
      payee: 'Gazette Media',
      bank: 'National Bank of Malawi',
      account: '1687514',
      items: '250 branded pilot T-shirts @ MK22,000',
      amount: 5500000,
      vat: 0,
      mode: 'Cash',
      status: 'pending',
      comment: 'Requisition received — Chair signature line on the form was blank',
      ref: 'As per quotations'
    }
  ];

  let unlocked = sessionStorage.getItem('bt42_control_unlocked') === '1';
  let isChair = sessionStorage.getItem('bt42_control_role') === 'chair';
  let currentUser = sessionStorage.getItem(SESSION_USER_KEY) || '';
  let perms = {
    payment: sessionStorage.getItem('bt42_perm_payment') === '1',
    bibs: sessionStorage.getItem('bt42_perm_bibs') === '1',
    finish: sessionStorage.getItem('bt42_perm_finish') === '1',
    volunteers: sessionStorage.getItem('bt42_perm_volunteers') === '1',
    manageStaff: sessionStorage.getItem('bt42_perm_staff') === '1',
    requisitions: sessionStorage.getItem('bt42_perm_requisitions') === '1'
  };
  // Chair always has all perms
  if (isChair) {
    perms = { payment: true, bibs: true, finish: true, volunteers: true, manageStaff: true, requisitions: true };
  }

  async function sha256(text) {
    try {
      const data = new TextEncoder().encode(String(text));
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Fallback (weak) if subtle unavailable
      let h = 0;
      const s = String(text);
      for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
      return 'x' + Math.abs(h).toString(16);
    }
  }

  function loadStaffUsers() {
    try {
      const list = JSON.parse(localStorage.getItem(STAFF_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }
  function saveStaffUsers(list) {
    localStorage.setItem(STAFF_KEY, JSON.stringify(list || []));
  }
  function canPayment() { return isChair || !!perms.payment; }
  function canBibs() { return isChair || !!perms.bibs; }
  function canFinish() { return isChair || !!perms.finish; }
  function canManageStaff() { return isChair || !!perms.manageStaff; }
  function canVolunteers() { return isChair || !!perms.volunteers; }
  function canRequisitions() { return isChair || !!perms.requisitions; }

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  // ---------- Auth gate ----------
  function showGate() {
    const gate = $('#control-gate');
    const room = $('#control-room');
    if (gate) gate.classList.remove('hidden');
    if (room) room.classList.add('hidden');
  }

  function staffCanSee(panel) {
    if (isChair) return true;
    if (panel === 'staff' || panel === 'site' || panel === 'chair') return canManageStaff();
    if (panel === 'approvals') return canRequisitions();
    const openToOc = [
      'dash', 'deadlines', 'survey', 'results', 'participants', 'volunteers',
      'checklist', 'meetings', 'budget', 'runsheet', 'roles', 'notes'
    ];
    if (openToOc.indexOf(panel) >= 0) return true;
    return false;
  }

  function applyRoleUI() {
    const dashEdit = $('#ctrl-dash-edit');
    if (dashEdit) {
      if (isChair) dashEdit.classList.remove('chair-only-hidden');
      else dashEdit.classList.add('chair-only-hidden');
    }
    const badge = $('#ctrl-role-badge');
    if (badge) {
      let label = 'Committee (view)';
      let cls = 'role-badge committee';
      if (isChair) { label = 'Chair' + (currentUser ? ' · ' + currentUser : ''); cls = 'role-badge chair'; }
      else if (canPayment() || canBibs() || canFinish() || canVolunteers()) {
        const bits = [];
        if (canPayment()) bits.push('pay');
        if (canBibs()) bits.push('bibs');
        if (canFinish()) bits.push('finish');
        if (canVolunteers()) bits.push('volunteers');
        if (canRequisitions()) bits.push('requisitions');
        label = (currentUser || 'Ops') + ' · ' + bits.join('/');
        cls = 'role-badge chair';
      } else if (currentUser) {
        label = currentUser + ' · view';
      }
      badge.textContent = 'Signed in as ' + label;
      badge.className = cls;
    }
    $$('.ctrl-tab[data-panel], .ctrl-panel[id^="panel-"]').forEach((el) => {
      const panel = el.getAttribute('data-panel') || String(el.id || '').replace(/^panel-/, '');
      if (!panel) return;
      if (staffCanSee(panel)) el.classList.remove('chair-only-hidden');
      else el.classList.add('chair-only-hidden');
    });
    const activeTab = $('.ctrl-tab.active');
    const activePanel = activeTab && activeTab.getAttribute('data-panel');
    if (activePanel && !staffCanSee(activePanel)) {
      $$('.ctrl-tab').forEach((t) => t.classList.remove('active'));
      $$('.ctrl-panel').forEach((p) => p.classList.remove('active'));
      const first = ['dash', 'participants', 'volunteers', 'staff'].find(staffCanSee);
      const tab = first && $('.ctrl-tab[data-panel="' + first + '"]');
      const panel = first && $('#panel-' + first);
      if (tab) tab.classList.add('active');
      if (panel) panel.classList.add('active');
    }
  }

  function unlock(role, user, userPerms) {
    unlocked = true;
    isChair = role === 'chair';
    currentUser = user || (isChair ? 'chair' : 'committee');
    if (isChair) {
      perms = { payment: true, bibs: true, finish: true, volunteers: true, manageStaff: true, requisitions: true };
    } else if (userPerms) {
      perms = {
        payment: !!userPerms.payment,
        bibs: !!userPerms.bibs,
        finish: !!userPerms.finish,
        volunteers: !!userPerms.volunteers,
        manageStaff: !!userPerms.manageStaff,
        requisitions: !!userPerms.requisitions
      };
    } else {
      perms = { payment: false, bibs: false, finish: false, volunteers: false, manageStaff: false, requisitions: false };
    }
    sessionStorage.setItem('bt42_control_unlocked', '1');
    sessionStorage.setItem('bt42_control_role', isChair ? 'chair' : 'committee');
    sessionStorage.setItem(SESSION_USER_KEY, currentUser);
    sessionStorage.setItem('bt42_perm_payment', perms.payment ? '1' : '0');
    sessionStorage.setItem('bt42_perm_bibs', perms.bibs ? '1' : '0');
    sessionStorage.setItem('bt42_perm_finish', perms.finish ? '1' : '0');
    sessionStorage.setItem('bt42_perm_volunteers', perms.volunteers ? '1' : '0');
    sessionStorage.setItem('bt42_perm_staff', perms.manageStaff ? '1' : '0');
    sessionStorage.setItem('bt42_perm_requisitions', perms.requisitions ? '1' : '0');
    const gate = $('#control-gate');
    const room = $('#control-room');
    if (gate) gate.classList.add('hidden');
    if (room) room.classList.remove('hidden');

    // Auto-connect shared list on every machine (OC_SYNC_TOKEN matches committee PIN)
    if (!getSyncToken()) {
      setSyncToken(COMMITTEE_PIN);
    }

    renderAll();
    applyRoleUI();

    // Show Participants so entries are visible immediately
    try {
      $$('.ctrl-tab').forEach((t) => t.classList.remove('active'));
      $$('.ctrl-panel').forEach((p) => p.classList.remove('active'));
      const pt = $('.ctrl-tab[data-panel="participants"]');
      const pp = $('#panel-participants');
      if (pt) pt.classList.add('active');
      if (pp) pp.classList.add('active');
    } catch (e) {}

    // Immediately load shared + Forms-merged registrations
    pullSharedState().then((r) => {
      if (r && r.ok) {
        renderParticipants();
        renderAttendance();
        renderDashboard();
        renderSyncBar();
      }
      startLiveSync();
    }).catch(() => startLiveSync());
  }

  async function tryUnlock(e) {
    e.preventDefault();
    const userEl = $('#control-user');
    const passEl = $('#control-pin');
    if (!passEl) return;
    const username = ((userEl && userEl.value) || '').trim().toLowerCase();
    const password = (passEl.value || '').trim();
    if (!password) {
      alert('Enter password');
      return;
    }

    // Bootstrap: username optional if using legacy single-field PINs
    if ((!username || username === 'chair') && password.toLowerCase() === CHAIR_PIN) {
      unlock('chair', 'chair');
      return;
    }
    if ((!username || username === 'committee') && password.toLowerCase() === COMMITTEE_PIN) {
      unlock('committee', 'committee');
      return;
    }

    if (!username) {
      alert('Enter your username (from the Chair) and password.');
      return;
    }

    // Pull shared staff list BEFORE checking password (other phones start empty)
    if (!getSyncToken()) setSyncToken(COMMITTEE_PIN);
    try {
      const pulled = await pullSharedState();
      if (pulled && pulled.state && Array.isArray(pulled.state.staffUsers)) {
        saveStaffUsers(pulled.state.staffUsers);
      }
    } catch (e) {
      console.warn('Could not pull staff list before login', e);
    }

    const hash = await sha256(password);
    let staff = loadStaffUsers();
    let acc = staff.find((u) => String(u.username || '').toLowerCase() === username);
    if (!acc || acc.passwordHash !== hash) {
      // One more direct GET in case pullSharedState used a different shape
      try {
        const res = await fetch('/.netlify/functions/oc-sync', {
          headers: { 'x-oc-token': getSyncToken() || COMMITTEE_PIN, 'x-oc-role': 'committee' }
        });
        const data = await res.json().catch(() => ({}));
        const list = (data.state && data.state.staffUsers) || data.staffUsers || [];
        if (Array.isArray(list) && list.length) {
          saveStaffUsers(list);
          staff = list;
          acc = staff.find((u) => String(u.username || '').toLowerCase() === username);
        }
      } catch (e) {}
    }
    if (!acc) {
      alert('This username is not on the shared staff list yet. On the Chair phone: open Staff logins, confirm the user is there, then Push / wait for sync. Then try again here.');
      passEl.value = '';
      return;
    }
    if (acc.passwordHash !== hash) {
      alert('Incorrect password for "' + username + '". Use the exact password the Chair set (spaces and capitals count).');
      passEl.value = '';
      return;
    }
    if (acc.disabled) {
      alert('This account is disabled. Contact the Chair.');
      return;
    }
    if (acc.role === 'chair') {
      unlock('chair', acc.username);
    } else {
      unlock('committee', acc.username, {
        payment: !!acc.canPayment,
        bibs: !!acc.canBibs,
        finish: !!acc.canFinish,
        volunteers: !!acc.canVolunteers,
        requisitions: !!acc.canRequisitions,
        manageStaff: false
      });
    }
  }

  function logoutControl() {
    sessionStorage.removeItem('bt42_control_unlocked');
    sessionStorage.removeItem('bt42_control_role');
    sessionStorage.removeItem(SESSION_USER_KEY);
    sessionStorage.removeItem('bt42_perm_payment');
    sessionStorage.removeItem('bt42_perm_bibs');
    sessionStorage.removeItem('bt42_perm_finish');
    sessionStorage.removeItem('bt42_perm_volunteers');
    sessionStorage.removeItem('bt42_perm_staff');
    sessionStorage.removeItem('bt42_perm_requisitions');
    unlocked = false;
    isChair = false;
    currentUser = '';
    perms = { payment: false, bibs: false, finish: false, volunteers: false, manageStaff: false, requisitions: false };
    showGate();
    const input = $('#control-pin');
    if (input) input.value = '';
    const u = $('#control-user');
    if (u) u.value = '';
  }

  // ---------- Status persistence ----------
  function loadStatuses() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch { return {}; }
  }

  function saveStatuses(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }

  function loadSponsorStatuses() {
    try {
      return JSON.parse(localStorage.getItem(SPONSOR_KEY) || '{}');
    } catch { return {}; }
  }

  function saveSponsorStatuses(map) {
    localStorage.setItem(SPONSOR_KEY, JSON.stringify(map));
  }

  // ---------- Metrics ----------
  function loadDashboard() {
    const defaults = Object.assign({}, window.BT42_DATA.dashboardDefaults || {});
    try {
      const saved = JSON.parse(localStorage.getItem(DASH_KEY) || '{}');
      return Object.assign(defaults, saved);
    } catch { return defaults; }
  }

  function saveDashboard(obj) {
    localStorage.setItem(DASH_KEY, JSON.stringify(obj));
  }

  function loadDeadlineStatuses() {
    try { return JSON.parse(localStorage.getItem(DEADLINE_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveDeadlineStatuses(map) {
    localStorage.setItem(DEADLINE_KEY, JSON.stringify(map));
  }

  function computeMetrics() {
    const data = window.BT42_DATA;
    const statuses = loadStatuses();
    let done = 0, total = data.checklist.length;
    data.checklist.forEach(item => {
      const s = statuses[item.id] || item.status;
      if (s === 'done') done++;
    });
    const pct = total ? Math.round((done / total) * 100) : 0;

    const sponsorMap = loadSponsorStatuses();
    let contacted = 0, signed = 0;
    data.sponsors.forEach((s, i) => {
      const st = sponsorMap[i] || s.status;
      if (st !== 'To Contact') contacted++;
      if (st === 'Signed' || st === 'Confirmed') signed++;
    });

    const now = new Date();
    const race = new Date(data.raceDate);
    const daysLeft = Math.max(0, Math.ceil((race - now) / (1000 * 60 * 60 * 24)));

    const dash = loadDashboard();
    const dlMap = loadDeadlineStatuses();
    const deadlines = data.deadlines || [];
    let dlDone = 0;
    deadlines.forEach(d => { if ((dlMap[d.id] || 'todo') === 'done') dlDone++; });

    return {
      done, total, pct, contacted, signed,
      sponsorTotal: data.sponsors.length, daysLeft, dash, dlDone, dlTotal: deadlines.length
    };
  }

  function renderDashboard() {
    const m = computeMetrics();
    const d = m.dash;
    const el = $('#ctrl-metrics');
    if (!el) return;
    el.innerHTML = `
      <div class="metric-card">
        <div class="metric-value">${m.daysLeft}</div>
        <div class="metric-label">Days to Race</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${m.pct}%</div>
        <div class="metric-label">Checklist Done</div>
        <div class="metric-sub">${m.done} / ${m.total} tasks</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${m.contacted}</div>
        <div class="metric-label">Sponsors Contacted</div>
        <div class="metric-sub">${m.signed} signed · ${m.sponsorTotal} total</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${m.dlDone}/${m.dlTotal}</div>
        <div class="metric-label">Deadlines Done</div>
      </div>
    `;

    const bar = $('#ctrl-progress-bar');
    if (bar) bar.style.width = m.pct + '%';

    const next = window.BT42_DATA.meetings.find(mt => new Date(mt.date) >= new Date(new Date().toDateString()));
    const nextEl = $('#ctrl-next-meeting');
    if (nextEl && next) {
      nextEl.innerHTML = `<strong>Next OC Meeting:</strong> ${formatDate(next.date)} · ${next.time}<br><em>${next.focus}</em>`;
    }

    // Editable Chair metrics form
    const edit = $('#ctrl-dash-edit');
    if (edit) {
      edit.innerHTML = `
        <h3 class="ctrl-section-title">Chair-editable metrics</h3>
        <p class="form-note" style="margin-bottom:0.75rem">Only you (Chair) should edit these. Values save on this device.</p>
        <div class="dash-edit-grid">
          <label>Registrations actual <input type="number" id="dash-reg-actual" value="${d.registrationsActual}" min="0" /></label>
          <label>Registrations target <input type="number" id="dash-reg-target" value="${d.registrationsTarget}" min="0" /></label>
          <label>Marathon actual <input type="number" id="dash-mar-actual" value="${d.marathonActual}" min="0" /></label>
          <label>Marathon target <input type="number" id="dash-mar-target" value="${d.marathonTarget}" min="0" /></label>
          <label>Sponsorship actual (MK) <input type="number" id="dash-spon-actual" value="${d.sponsorshipActualMk}" min="0" /></label>
          <label>Sponsorship target (MK) <input type="number" id="dash-spon-target" value="${d.sponsorshipTargetMk}" min="0" /></label>
          <label class="full">Safety status <input type="text" id="dash-safety" value="${escapeHtml(d.safetyStatus)}" /></label>
          <label class="full">Media notes <input type="text" id="dash-media" value="${escapeHtml(d.mediaNotes)}" /></label>
        </div>
        <button type="button" class="btn btn-primary" id="dash-save-btn" style="margin-top:0.75rem">Save metrics</button>
        <p id="dash-save-msg" style="font-size:0.8rem;color:var(--accent);margin-top:0.5rem;display:none">Saved.</p>
        <div class="metric-card" style="margin-top:1rem;text-align:left">
          <div><strong>Regs:</strong> ${d.registrationsActual} / ${d.registrationsTarget}
            (Marathon ${d.marathonActual} / ${d.marathonTarget})</div>
          <div><strong>Sponsorship:</strong> ${formatMoney(d.sponsorshipActualMk)} / ${formatMoney(d.sponsorshipTargetMk)}</div>
          <div><strong>Safety:</strong> ${escapeHtml(d.safetyStatus)}</div>
        </div>`;
      const saveBtn = $('#dash-save-btn');
      if (saveBtn) {
        saveBtn.onclick = () => {
          const next = {
            registrationsActual: Number($('#dash-reg-actual').value) || 0,
            registrationsTarget: Number($('#dash-reg-target').value) || 0,
            marathonActual: Number($('#dash-mar-actual').value) || 0,
            marathonTarget: Number($('#dash-mar-target').value) || 0,
            sponsorshipActualMk: Number($('#dash-spon-actual').value) || 0,
            sponsorshipTargetMk: Number($('#dash-spon-target').value) || 0,
            safetyStatus: $('#dash-safety').value || '',
            mediaNotes: $('#dash-media').value || '',
            satisfactionTarget: d.satisfactionTarget
          };
          saveDashboard(next);
          const msg = $('#dash-save-msg');
          if (msg) { msg.style.display = 'block'; setTimeout(() => { msg.style.display = 'none'; }, 1500); }
          renderDashboard();
        };
      }
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatMoney(n) {
    return 'MK ' + Number(n).toLocaleString('en-MW');
  }

  // ---------- Checklist ----------
  function renderChecklist() {
    const container = $('#ctrl-checklist');
    if (!container) return;
    const statuses = loadStatuses();
    const cats = [...new Set(window.BT42_DATA.checklist.map(c => c.cat))];

    let html = '';
    cats.forEach(cat => {
      const items = window.BT42_DATA.checklist.filter(c => c.cat === cat);
      html += `<div class="ctrl-cat"><h4>${cat}</h4>`;
      items.forEach(item => {
        const st = statuses[item.id] || item.status;
        html += `
          <div class="ctrl-task ${st}" data-id="${item.id}">
            <button class="status-btn" data-id="${item.id}" title="Click to cycle status">${statusIcon(st)}</button>
            <div class="task-body">
              <div class="task-title">${item.task}</div>
              <div class="task-meta">${item.owner} · Due ${item.due}</div>
            </div>
          </div>`;
      });
      html += '</div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('.status-btn').forEach(btn => {
      btn.addEventListener('click', () => cycleStatus(btn.dataset.id));
    });
  }

  function statusIcon(st) {
    if (st === 'done') return '✅';
    if (st === 'doing') return '🔄';
    if (st === 'blocked') return '⛔';
    return '⬜';
  }

  function cycleStatus(id) {
    const map = loadStatuses();
    const order = ['todo', 'doing', 'done', 'blocked'];
    const current = map[id] || 'todo';
    const next = order[(order.indexOf(current) + 1) % order.length];
    map[id] = next;
    saveStatuses(map);
    renderChecklist();
    renderDashboard();
  }

  // ---------- Meetings ----------
  function renderMeetings() {
    const container = $('#ctrl-meetings');
    if (!container) return;
    const meetLink = window.BT42_DATA.meetLink || 'https://meet.google.com/ixu-kyfn-pvc';
    let html = `
      <div class="meet-link-banner">
        <strong>Google Meet (all OC meetings)</strong><br>
        <a href="${meetLink}" target="_blank" rel="noopener">${meetLink}</a>
      </div>`;
    window.BT42_DATA.meetings.forEach(m => {
      const past = new Date(m.date) < new Date(new Date().toDateString());
      html += `
        <details class="ctrl-meeting ${past ? 'past' : ''}">
          <summary>
            <span class="m-num">#${m.id}</span>
            <span class="m-date">${formatDate(m.date)}</span>
            <span class="m-focus">${m.focus}</span>
          </summary>
          <div class="m-body">
            <p><strong>Time:</strong> ${m.time} · <strong>Type:</strong> ${m.type}</p>
            <p><strong>Google Meet:</strong> <a href="${meetLink}" target="_blank" rel="noopener">${meetLink}</a></p>
            <p><strong>Attendees:</strong> ${m.attendees}</p>
            <p><strong>Agenda</strong></p>
            <ol>${m.agenda.map(a => `<li>${a}</li>`).join('')}</ol>
          </div>
        </details>`;
    });
    container.innerHTML = html;
  }

  // ---------- Sponsors ----------
  function renderSponsors() {
    const container = $('#ctrl-sponsors');
    if (!container) return;
    const map = loadSponsorStatuses();
    const statuses = ['To Contact', 'Contacted', 'In Discussion', 'Signed', 'Declined'];

    let html = `<div class="sponsor-table-wrap"><table class="ctrl-table">
      <thead><tr><th>#</th><th>Organisation</th><th>Tier</th><th>Status</th><th>Notes</th></tr></thead><tbody>`;

    window.BT42_DATA.sponsors.forEach((s, i) => {
      const st = map[i] || s.status;
      html += `<tr>
        <td>${s.priority}</td>
        <td><strong>${s.org}</strong><br><small>${s.category}</small></td>
        <td>${s.tier}</td>
        <td>
          <select data-idx="${i}" class="sponsor-status">
            ${statuses.map(opt => `<option value="${opt}" ${opt === st ? 'selected' : ''}>${opt}</option>`).join('')}
          </select>
        </td>
        <td><small>${s.notes}</small></td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;

    container.querySelectorAll('.sponsor-status').forEach(sel => {
      sel.addEventListener('change', () => {
        const map = loadSponsorStatuses();
        map[sel.dataset.idx] = sel.value;
        saveSponsorStatuses(map);
        renderDashboard();
      });
    });
  }

  // ---------- Budget (tentative; Chair-editable) ----------
  function loadBudget() {
    const base = JSON.parse(JSON.stringify(window.BT42_DATA.budget));
    try {
      const saved = JSON.parse(localStorage.getItem(BUDGET_KEY) || 'null');
      if (saved && saved.expenditure && saved.income) return saved;
    } catch {}
    return base;
  }

  function saveBudget(obj) {
    localStorage.setItem(BUDGET_KEY, JSON.stringify(obj));
  }

  function renderBudget() {
    const container = $('#ctrl-budget');
    if (!container) return;
    const budget = loadBudget();
    const exp = budget.expenditure;
    const inc = budget.income;
    const totalExp = exp.reduce((s, r) => s + (Number(r.est) || 0), 0);
    const totalInc = inc.reduce((s, r) => s + (Number(r.target) || 0), 0);
    const editable = isChair;

    let html = `<div class="budget-badge-row"><span class="tentative-badge">Tentative</span>${editable ? '<span class="edit-hint">Chair can edit amounts below</span>' : '<span class="edit-hint">View only — ask Chair to update figures</span>'}</div>
    <div class="budget-grid">
      <div>
        <h4>Estimated Expenditure</h4>
        <table class="ctrl-table">
          <thead><tr><th>Category</th><th>Item</th><th class="num">Estimate (MK)</th></tr></thead>
          <tbody>`;
    exp.forEach((r, i) => {
      if (editable) {
        html += `<tr>
          <td>${escapeHtml(r.cat)}</td>
          <td>${escapeHtml(r.item)}</td>
          <td class="num"><input type="number" class="budget-input exp-input" data-i="${i}" value="${Number(r.est) || 0}" min="0" step="10000" /></td>
        </tr>`;
      } else {
        html += `<tr><td>${escapeHtml(r.cat)}</td><td>${escapeHtml(r.item)}</td><td class="num">${formatMoney(r.est)}</td></tr>`;
      }
    });
    html += `<tr class="total-row"><td colspan="2"><strong>Total (tentative)</strong></td><td class="num"><strong id="budget-exp-total">${formatMoney(totalExp)}</strong></td></tr>
        </tbody></table>
      </div>
      <div>
        <h4>Income Targets</h4>
        <table class="ctrl-table">
          <thead><tr><th>Source</th><th class="num">Target (MK)</th></tr></thead>
          <tbody>`;
    inc.forEach((r, i) => {
      if (editable) {
        html += `<tr>
          <td>${escapeHtml(r.item)}</td>
          <td class="num"><input type="number" class="budget-input inc-input" data-i="${i}" value="${Number(r.target) || 0}" min="0" step="10000" /></td>
        </tr>`;
      } else {
        html += `<tr><td>${escapeHtml(r.item)}</td><td class="num">${formatMoney(r.target)}</td></tr>`;
      }
    });
    html += `<tr class="total-row"><td><strong>Total target (tentative)</strong></td><td class="num"><strong id="budget-inc-total">${formatMoney(totalInc)}</strong></td></tr>
        </tbody></table>
        <p class="budget-note">Surplus target: <strong id="budget-surplus">${formatMoney(totalInc - totalExp)}</strong>. Figures remain tentative until confirmed.</p>
      </div>
    </div>`;
    if (editable) {
      html += `<button type="button" class="btn btn-primary" id="budget-save-btn" style="margin-top:0.75rem">Save budget edits</button>
        <button type="button" class="btn btn-ghost" id="budget-reset-btn" style="margin-top:0.75rem;margin-left:0.5rem">Reset to defaults</button>
        <p id="budget-save-msg" style="font-size:0.8rem;color:var(--accent);margin-top:0.5rem;display:none">Budget saved on this device.</p>`;
    }
    container.innerHTML = html;

    if (editable) {
      const recalc = () => {
        const b = loadBudget();
        container.querySelectorAll('.exp-input').forEach(inp => {
          b.expenditure[Number(inp.dataset.i)].est = Number(inp.value) || 0;
        });
        container.querySelectorAll('.inc-input').forEach(inp => {
          b.income[Number(inp.dataset.i)].target = Number(inp.value) || 0;
        });
        const te = b.expenditure.reduce((s, r) => s + (Number(r.est) || 0), 0);
        const ti = b.income.reduce((s, r) => s + (Number(r.target) || 0), 0);
        const elE = $('#budget-exp-total'); if (elE) elE.textContent = formatMoney(te);
        const elI = $('#budget-inc-total'); if (elI) elI.textContent = formatMoney(ti);
        const elS = $('#budget-surplus'); if (elS) elS.textContent = formatMoney(ti - te);
        return b;
      };
      container.querySelectorAll('.budget-input').forEach(inp => {
        inp.addEventListener('input', recalc);
      });
      const saveBtn = $('#budget-save-btn');
      if (saveBtn) saveBtn.onclick = () => {
        saveBudget(recalc());
        const msg = $('#budget-save-msg');
        if (msg) { msg.style.display = 'block'; setTimeout(() => { msg.style.display = 'none'; }, 1800); }
      };
      const resetBtn = $('#budget-reset-btn');
      if (resetBtn) resetBtn.onclick = () => {
        localStorage.removeItem(BUDGET_KEY);
        renderBudget();
      };
    }
  }

  // ---------- Run sheet ----------
  function renderRunsheet() {
    const container = $('#ctrl-runsheet');
    if (!container) return;
    let html = `<table class="ctrl-table">
      <thead><tr><th>Time</th><th>Activity</th><th>Location</th><th>Lead</th></tr></thead><tbody>`;
    window.BT42_DATA.runsheet.forEach(r => {
      const highlight = r.activity.toLowerCase().includes('start') || r.activity.toLowerCase().includes('prize');
      html += `<tr class="${highlight ? 'highlight' : ''}">
        <td>${r.time}</td><td>${r.activity}</td><td>${r.location}</td><td>${r.lead}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ---------- Roles (Chair can assign names) ----------
  function loadRoles() {
    const base = window.BT42_DATA.roles.map(r => Object.assign({}, r));
    try {
      const saved = JSON.parse(localStorage.getItem(ROLES_KEY) || 'null');
      if (Array.isArray(saved) && saved.length) {
        return base.map((r, i) => Object.assign({}, r, saved[i] || {}));
      }
    } catch {}
    return base;
  }

  function saveRoles(arr) {
    localStorage.setItem(ROLES_KEY, JSON.stringify(arr));
  }

  function renderRoles() {
    const container = $('#ctrl-roles');
    if (!container) return;
    const roles = loadRoles();
    const editable = isChair;
    let html = `<p class="form-note" style="margin-bottom:0.75rem">${editable ? 'Chair can assign names to each role. Saved on this device.' : 'Role names are maintained by the Chair.'}</p>`;
    roles.forEach((r, i) => {
      html += `<div class="role-card">
        <div class="role-title">${escapeHtml(r.role)}</div>
        <div class="role-name">${editable
          ? `<input type="text" class="role-name-input" data-i="${i}" value="${escapeHtml(r.name || '')}" placeholder="Name TBD" />`
          : escapeHtml(r.name || 'TBD')}</div>
        <div class="role-resp">${escapeHtml(r.responsibilities)}</div>
      </div>`;
    });
    if (editable) {
      html += `<button type="button" class="btn btn-primary" id="roles-save-btn" style="margin-top:0.75rem">Save role assignments</button>
        <p id="roles-save-msg" style="font-size:0.8rem;color:var(--accent);margin-top:0.5rem;display:none">Saved.</p>`;
    }
    container.innerHTML = html;
    if (editable) {
      const btn = $('#roles-save-btn');
      if (btn) btn.onclick = () => {
        const next = loadRoles();
        container.querySelectorAll('.role-name-input').forEach(inp => {
          next[Number(inp.dataset.i)].name = inp.value.trim();
        });
        saveRoles(next);
        const msg = $('#roles-save-msg');
        if (msg) { msg.style.display = 'block'; setTimeout(() => { msg.style.display = 'none'; }, 1500); }
      };
    }
  }

  // ---------- Success metrics ----------
  function renderTargets() {
    const container = $('#ctrl-targets');
    if (!container) return;
    let html = '<ul class="target-list">';
    window.BT42_DATA.successMetrics.forEach(t => {
      html += `<li><strong>${t.metric}:</strong> ${t.target}</li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
  }

  // ---------- Notes ----------
  function renderNotes() {
    const ta = $('#ctrl-notes');
    if (!ta) return;
    ta.value = localStorage.getItem(NOTES_KEY) || '';
    ta.addEventListener('input', () => {
      localStorage.setItem(NOTES_KEY, ta.value);
    });
  }

  // ---------- Tab switching inside control ----------
  function initControlTabs() {
    $$('.ctrl-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.ctrl-tab').forEach(t => t.classList.remove('active'));
        $$('.ctrl-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = $('#panel-' + tab.dataset.panel);
        if (panel) panel.classList.add('active');
      });
    });
  }



  // ---------- Meeting attendance ----------
  function loadAttendance() {
    try { return JSON.parse(localStorage.getItem(ATTEND_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveAttendance(map) {
    localStorage.setItem(ATTEND_KEY, JSON.stringify(map));
  }

  function getRoleNames() {
    // Prefer saved role names; fall back to data defaults
    const roles = (typeof loadRoles === 'function') ? loadRoles() : (window.BT42_DATA.roles || []);
    return roles
      .map(r => ({ role: r.role, name: (r.name || '').trim() }))
      .filter(r => r.name);
  }

  function renderAttendance() {
    const container = $('#ctrl-attendance');
    if (!container) return;
    const attendance = loadAttendance();
    const people = getRoleNames();
    const meetings = window.BT42_DATA.meetings || [];

    if (!people.length) {
      container.innerHTML = `<p class="form-note">Assign names under <strong>Roles</strong> first, then return here to mark attendance.</p>`;
      return;
    }

    let html = `<div class="attendance-wrap">`;
    meetings.forEach(m => {
      const key = 'm' + m.id;
      const set = attendance[key] || {};
      const presentCount = people.filter(p => set[p.name]).length;
      html += `
        <details class="ctrl-meeting attendance-card" ${m.id <= 2 ? 'open' : ''}>
          <summary>
            <span class="m-num">#${m.id}</span>
            <span class="m-date">${formatDate(m.date)}</span>
            <span class="m-focus">${m.focus}</span>
            <span class="attend-count">${presentCount}/${people.length} present</span>
          </summary>
          <div class="m-body">
            <div class="attend-list">`;
      people.forEach(p => {
        const checked = set[p.name] ? 'checked' : '';
        const id = `att-${m.id}-${p.name.replace(/\\W+/g, '_')}`;
        html += `
              <label class="attend-item">
                <input type="checkbox" data-meeting="${key}" data-name="${escapeHtml(p.name)}" ${checked} />
                <span><strong>${escapeHtml(p.name)}</strong> <small>${escapeHtml(p.role)}</small></span>
              </label>`;
      });
      html += `
            </div>
            <label style="display:block;margin-top:0.75rem;font-size:0.85rem;font-weight:600">Notes for this meeting</label>
            <textarea class="attend-notes" data-meeting="${key}" rows="2" style="width:100%;margin-top:0.35rem;padding:0.6rem;border:1px solid var(--border);border-radius:8px;font-family:inherit">${escapeHtml((attendance[key + '_notes'] || ''))}</textarea>
          </div>
        </details>`;
    });
    html += `</div>
      <button type="button" class="btn btn-primary" id="attend-save-btn" style="margin-top:0.75rem">Save attendance</button>
      <p id="attend-save-msg" style="font-size:0.8rem;color:var(--accent);margin-top:0.5rem;display:none">Attendance saved on this device.</p>`;
    container.innerHTML = html;

    const saveBtn = $('#attend-save-btn');
    if (saveBtn) {
      saveBtn.onclick = () => {
        const map = loadAttendance();
        container.querySelectorAll('.attend-item input[type="checkbox"]').forEach(cb => {
          const mk = cb.dataset.meeting;
          if (!map[mk]) map[mk] = {};
          map[mk][cb.dataset.name] = cb.checked;
        });
        container.querySelectorAll('.attend-notes').forEach(ta => {
          map[ta.dataset.meeting + '_notes'] = ta.value;
        });
        saveAttendance(map);
        const msg = $('#attend-save-msg');
        if (msg) { msg.style.display = 'block'; setTimeout(() => { msg.style.display = 'none'; }, 1600); }
        renderAttendance();
      };
    }
  }

  function loadPayments() {
    try { return JSON.parse(localStorage.getItem(PAYMENT_KEY) || '{}'); }
    catch { return {}; }
  }

  function savePayments(map) {
    localStorage.setItem(PAYMENT_KEY, JSON.stringify(map));
  }

  function isSigDataUrl(v) {
    return typeof v === 'string' && v.indexOf('data:image') === 0 && v.length > 80;
  }

  function normalizeSigMap(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const out = {
      kalua: src.kalua || '',
      chamwala: src.chamwala || src.chinangwa || '',
      tenthani: src.tenthani || ''
    };
    ['kalua', 'chamwala', 'tenthani'].forEach((k) => {
      if (!isSigDataUrl(out[k])) out[k] = '';
    });
    return out;
  }

  function mergeSigMaps(local, incoming) {
    const a = normalizeSigMap(local);
    const b = normalizeSigMap(incoming);
    return {
      kalua: b.kalua || a.kalua,
      chamwala: b.chamwala || a.chamwala,
      tenthani: b.tenthani || a.tenthani
    };
  }

  function loadSigs() {
    try { return normalizeSigMap(JSON.parse(localStorage.getItem(SIGS_KEY) || '{}')); }
    catch { return normalizeSigMap({}); }
  }

  function saveSigs(map) {
    try {
      const merged = mergeSigMaps(loadSigs(), map);
      localStorage.setItem(SIGS_KEY, JSON.stringify(merged));
      return true;
    } catch (e) {
      console.warn('localStorage signature save failed', e);
      alert('Could not save signature on this device (storage full?). Try a smaller PNG/JPG.');
      return false;
    }
  }

  function certSignaturesPayload() {
    return normalizeSigMap(loadSigs());
  }

  async function signaturesForEmail() {
    const src = certSignaturesPayload();
    const out = { kalua: '', chamwala: '', tenthani: '' };
    for (const k of Object.keys(out)) {
      if (!src[k]) continue;
      try {
        out[k] = await compressSigImage(src[k], 220, 0.52);
      } catch (e) {
        out[k] = src[k];
      }
    }
    return out;
  }

  function buildClientCertificatePdf(opts) {
    const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDF) return '';
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(27, 79, 114);
    doc.setLineWidth(14);
    doc.rect(10, 10, W - 20, H - 20);
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(2);
    doc.rect(22, 22, W - 44, H - 44);
    doc.setTextColor(27, 79, 114);
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text('MALAWI NATIONAL COUNCIL OF SPORTS  ·  ATHLETICS MALAWI', W / 2, 58, { align: 'center' });
    doc.setFontSize(16);
    doc.text('BT42.195km Race 2026', W / 2, 78, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.text('Blantyre · Sunday, 27 September 2026', W / 2, 94, { align: 'center' });
    const title = opts.volunteer
      ? 'CERTIFICATE OF VOLUNTEER SERVICE'
      : (opts.isCompletion ? 'CERTIFICATE OF COMPLETION' : 'CERTIFICATE OF PARTICIPATION');
    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(184, 148, 31);
    doc.text(title, W / 2, 140, { align: 'center' });
    doc.setTextColor(30, 30, 30);
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.text(opts.volunteer ? 'This is to certify that' : 'This is to certify that', W / 2, 175, { align: 'center' });
    doc.setFont('times', 'bold');
    doc.setFontSize(26);
    doc.text(String(opts.fullName || 'Name'), W / 2, 210, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    const body = opts.volunteer
      ? ('served as a volunteer (' + (opts.distance || opts.role || 'Race volunteer') + ') at the BT42.195km Race 2026, organised under the auspices of the Malawi National Council of Sports.')
      : (opts.isCompletion
        ? ('has successfully completed the ' + (opts.distance || '') + ' of the BT42.195km Race 2026.')
        : ('was a registered participant in the ' + (opts.distance || '') + ' of the BT42.195km Race 2026.'));
    const lines = doc.splitTextToSize(body, 620);
    doc.text(lines, W / 2, 250, { align: 'center' });
    const sigs = opts.signatures || {};
    const people = [
      { k: 'kalua', n: 'Jim Kalua', t: 'Chairman of the Council' },
      { k: 'chamwala', n: 'Kondwani Chamwala', t: 'President of Athletics Malawi' },
      { k: 'tenthani', n: 'Chifundo Tenthani', t: 'Chair, Organising Committee' }
    ];
    const col = [90, 310, 530];
    people.forEach((p, i) => {
      const x = col[i];
      const data = sigs[p.k];
      if (data && data.indexOf('data:image') === 0) {
        try {
          const fmt = data.indexOf('png') >= 0 ? 'PNG' : 'JPEG';
          doc.addImage(data, fmt, x + 10, 360, 150, 42);
        } catch (e) { /* skip */ }
      }
      doc.setDrawColor(30, 30, 30);
      doc.setLineWidth(0.8);
      doc.line(x, 412, x + 170, 412);
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.text(p.n, x + 85, 428, { align: 'center' });
      doc.setFont('times', 'normal');
      doc.setFontSize(8);
      doc.text(p.t, x + 85, 440, { align: 'center' });
    });
    const raw = doc.output('datauristring');
    return raw.split(',')[1] || '';
  }

  function compressSigImage(dataUrl, maxW, quality) {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => {
          const w = img.width || maxW;
          const h = img.height || maxW;
          const scale = w > maxW ? maxW / w : 1;
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          const ctx = canvas.getContext('2d');
          // White background so transparent PNG signatures are not saved as a black box
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Prefer PNG to keep crisp ink; fall back to JPEG only if huge
          let out = canvas.toDataURL('image/jpeg', quality || 0.82);
          if (out.length > 220000) {
            out = canvas.toDataURL('image/jpeg', 0.68);
          }
          resolve(out);
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      } catch (e) {
        resolve(dataUrl);
      }
    });
  }

  async function pushSignaturesToServer(map) {
    if (!getSyncToken() || !isChair) return { ok: false, skipped: true };
    try {
      return await livePush({ signatures: mergeSigMaps(loadSigs(), map || {}) });
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  function loadFinishes() {
    try { return JSON.parse(localStorage.getItem(FINISH_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveFinishes(map) {
    localStorage.setItem(FINISH_KEY, JSON.stringify(map));
  }

  function loadBibs() {
    try { return JSON.parse(localStorage.getItem(BIB_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveBibs(map) {
    localStorage.setItem(BIB_KEY, JSON.stringify(map));
  }

  function nextBibForDistance(distance, bibs) {
    const used = Object.values(bibs).map(b => Number(b && b.number)).filter(n => !isNaN(n));
    const code = normalizeDistanceCode(distance);
    let start = 1001;
    if (code === '10') start = 2001;
    if (code === '5') start = 3001;
    let n = start;
    while (used.includes(n)) n++;
    return n;
  }

  function participantKey(r, i) {
    const phone = String(r.phone || r.teamContactPhone || '').replace(/\s+/g, '');
    const name = String(r.fullName || '').trim().toLowerCase();
    // Always combine name when present so team-mates sharing one contact phone stay distinct
    if (phone && name) return phone + '|' + name;
    return phone || name || ('idx-' + i);
  }

  function paymentKeysFor(r, i) {
    const keys = [];
    const main = participantKey(r, i);
    keys.push(main);
    const phone = String(r.phone || r.teamContactPhone || '').replace(/\s+/g, '');
    const name = String(r.fullName || '').trim().toLowerCase();
    if (phone && name) keys.push(phone + '|' + name);
    if (phone) keys.push(phone);
    if (name) keys.push(name);
    return Array.from(new Set(keys.filter(Boolean)));
  }

  function paymentRecordFor(r, i, pays) {
    const map = pays || loadPayments();
    let best = null;
    paymentKeysFor(r, i).forEach((k) => {
      const rec = map[k];
      if (!rec || !rec.status) return;
      if (!best) best = rec;
      if (rec.status === 'verified') best = rec;
      if (rec.status === 'rejected' && (!best || best.status === 'pending')) best = rec;
    });
    return best || { status: 'pending' };
  }

  function normalizeDistanceCode(d) {
    const s = String(d || '').toLowerCase().replace(/\s+/g, '');
    if (s.indexOf('42') >= 0 || s.indexOf('marathon') >= 0) return '42.195';
    if (s === '10' || s.indexOf('10km') >= 0 || s.indexOf('10k') >= 0) return '10';
    if (s === '5' || s.indexOf('5km') >= 0 || s.indexOf('5k') >= 0 || s.indexOf('fun') >= 0) return '5';
    return String(d || '');
  }

  function distanceLabel(d) {
    if (d === '42.195' || d === '42.195 km') return '42.195 km Marathon';
    if (d === '10') return '10 km Race';
    if (d === '5') return '5 km Fun Run';
    return d || '—';
  }


  // ---------- Shared backend sync (Netlify function + Blobs) ----------
  function getSyncToken() {
    try { return localStorage.getItem(SYNC_TOKEN_KEY) || ''; } catch { return ''; }
  }

  function setSyncToken(t) {
    localStorage.setItem(SYNC_TOKEN_KEY, (t || '').trim());
  }

  function syncEndpoint() {
    return '/.netlify/functions/oc-sync';
  }

  async function pullSharedState() {
    const token = getSyncToken();
    if (!token) return { ok: false, error: 'No sync token' };
    const res = await fetch(syncEndpoint(), {
      method: 'GET',
      headers: {
        'x-oc-token': token,
        'x-oc-role': isChair ? 'chair' : 'committee'
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: (data && (data.detail || data.error)) || ('HTTP ' + res.status) };
    }
    const s = data.state || {};
    // Shared store is source of truth — replace local (do not merge, or deletes never stick)
    if (Array.isArray(s.registrations)) {
      try {
        localStorage.setItem('bt42_registrations', JSON.stringify(s.registrations));
      } catch (e) {}
      try { ensureRestoredAthletes(); } catch (e) {}
    }
    if (s.payments && typeof s.payments === 'object') {
      const localPay = loadPayments();
      const mergedPay = Object.assign({}, s.payments);
      Object.keys(localPay).forEach((k) => {
        const L = localPay[k] || {};
        const R = mergedPay[k] || {};
        if (L.status === 'verified' && R.status !== 'verified' && R.status !== 'rejected') {
          mergedPay[k] = L;
        } else if (L.status === 'rejected' && R.status !== 'verified' && R.status !== 'rejected') {
          mergedPay[k] = L;
        }
      });
      localStorage.setItem(PAYMENT_KEY, JSON.stringify(mergedPay));
    }
    if (s.bibs && typeof s.bibs === 'object') {
      localStorage.setItem(BIB_KEY, JSON.stringify(s.bibs));
    }
    if (s.finishes && typeof s.finishes === 'object') {
      localStorage.setItem(FINISH_KEY, JSON.stringify(s.finishes));
    }
    if (s.attendance && typeof s.attendance === 'object') {
      localStorage.setItem(ATTEND_KEY, JSON.stringify(s.attendance));
    }
    if (Array.isArray(s.staffUsers)) {
      try { localStorage.setItem(STAFF_KEY, JSON.stringify(s.staffUsers)); } catch (e) {}
    }
    if (Array.isArray(s.volunteers)) {
      try { localStorage.setItem(VOL_KEY, JSON.stringify(s.volunteers)); } catch (e) {}
    }
    if ((isChair || canRequisitions()) && Array.isArray(s.approvals)) {
      try { localStorage.setItem(APPROVALS_KEY, JSON.stringify(s.approvals)); } catch (e) {}
    }
    if (Array.isArray(s.surveyResponses)) {
      try { localStorage.setItem('bt42_survey_responses', JSON.stringify(s.surveyResponses)); } catch (e) {}
    }
    if (s.siteContent && typeof s.siteContent === 'object') {
      try {
        localStorage.setItem(SITE_CONTENT_KEY, JSON.stringify(s.siteContent));
        applySiteContentToPublic(s.siteContent);
      } catch (e) {}
    }
    if (s.signatures && typeof s.signatures === 'object' && !s.signatures._presentOnly) {
      const merged = mergeSigMaps(loadSigs(), s.signatures);
      try {
        localStorage.setItem(SIGS_KEY, JSON.stringify(merged));
      } catch (e) {
        console.warn('Could not store signatures from server', e);
      }
    }
    localStorage.setItem(SYNC_META_KEY, JSON.stringify({
      lastPull: new Date().toISOString(),
      updatedAt: s.updatedAt || null,
      updatedBy: s.updatedBy || null
    }));
    return { ok: true, state: s };
  }

  async function pushSharedState(partial) {
    const token = getSyncToken();
    if (!token) return { ok: false, error: 'No sync token' };
    const res = await fetch(syncEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-oc-token': token,
        'x-oc-role': isChair ? 'chair' : 'committee'
      },
      body: JSON.stringify(partial || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: (data && (data.detail || data.error)) || ('HTTP ' + res.status) };
    }
    localStorage.setItem(SYNC_META_KEY, JSON.stringify({
      lastPush: new Date().toISOString(),
      updatedAt: data.state && data.state.updatedAt,
      updatedBy: data.state && data.state.updatedBy
    }));
    return { ok: true, state: data.state, signaturesStored: data.signaturesStored };
  }

  async function pushAllLocal() {
    const payload = {
      registrations: JSON.parse(localStorage.getItem('bt42_registrations') || '[]'),
      replaceRegistrations: true,
      bibs: loadBibs(),
      replaceBibs: true,
      finishes: loadFinishes(),
      replaceFinishes: true,
      attendance: loadAttendance()
    };
    if (canPayment()) {
      payload.payments = loadPayments();
    }
    if (canVolunteers()) {
      payload.volunteers = loadVolunteers();
    }
    if (isChair) {
      payload.replacePayments = true;
      payload.signatures = loadSigs();
      payload.staffUsers = loadStaffUsers();
      payload.siteContent = loadSiteContent();
      payload.approvals = loadApprovals();
    }
    return pushSharedState(payload);
  }

  function renderSyncBar() {
    const el = $('#ctrl-sync-bar');
    if (!el) return;
    let meta = {};
    try { meta = JSON.parse(localStorage.getItem(SYNC_META_KEY) || '{}'); } catch {}
    const tokenSet = !!getSyncToken();
    el.innerHTML = `
      <div class="sync-bar">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem">
          <strong>Live shared data</strong>
          <span class="pay-status ${tokenSet ? 'pay-ok' : 'pay-wait'}">${tokenSet ? 'Token set' : 'No token'}</span>
          <span id="live-sync-status" class="live-sync-status wait">…</span>
        </div>
        <p class="form-note" style="margin:0.35rem 0">Entries appear automatically from the shared list and Netlify Forms. This screen refreshes every few seconds — no manual Pull needed.</p>
        ${meta.updatedAt ? '<small>Server: ' + new Date(meta.updatedAt).toLocaleString() + (meta.updatedBy ? ' · ' + meta.updatedBy : '') + '</small>' : ''}
        <div class="sync-actions">
          <input type="password" id="sync-token-input" placeholder="OC_SYNC_TOKEN" value="" autocomplete="off" />
          <button type="button" class="btn-mini" id="sync-save-token">Save token</button>
          <button type="button" class="btn-mini" id="sync-pull">Refresh now</button>
          <button type="button" class="btn-mini" id="sync-push">Push local</button>
        </div>
        <p id="sync-msg" class="form-note" style="margin:0.35rem 0 0"></p>
      </div>`;
    const msg = (t, ok) => {
      const m = $('#sync-msg');
      if (m) { m.textContent = t; m.style.color = ok ? 'var(--accent, #1E8449)' : '#C0392B'; }
    };
    const saveBtn = $('#sync-save-token');
    if (saveBtn) saveBtn.onclick = () => {
      const v = ($('#sync-token-input') || {}).value || '';
      setSyncToken(v);
      renderSyncBar();
      msg(v.trim() ? 'Token saved — live sync on.' : 'Token cleared.', !!v.trim());
      if (v.trim()) startLiveSync();
      else stopLiveSync();
    };
    const pullBtn = $('#sync-pull');
    if (pullBtn) pullBtn.onclick = async () => {
      msg('Pulling…', true);
      const r = await pullSharedState();
      if (r.ok) {
        if (r.state && r.state.updatedAt) lastKnownUpdatedAt = r.state.updatedAt;
        renderAll();
        msg('Pulled shared data.', true);
        setLiveStatus('Live · in sync', true);
      } else msg('Pull failed: ' + r.error, false);
    };
    const pushBtn = $('#sync-push');
    if (pushBtn) pushBtn.onclick = async () => {
      msg('Pushing…', true);
      const r = await pushAllLocal();
      if (r.ok) {
        msg('Pushed to shared store.', true);
        if (r.state && r.state.updatedAt) lastKnownUpdatedAt = r.state.updatedAt;
        setLiveStatus('Live · saved', true);
      } else msg('Push failed: ' + r.error, false);
    };
    if (tokenSet) startLiveSync();
    else setLiveStatus('Set sync token for live mode', false);
  }



  // ---------- Live sync (dartsmw-style): auto pull + push so all machines stay aligned ----------
  let liveSyncTimer = null;
  let liveSyncBusy = false;
  let lastKnownUpdatedAt = null;
  let failStreak = 0;
  const LIVE_POLL_MS = 5000;
  const LIVE_POLL_SLOW_MS = 30000;

  function setLiveStatus(text, ok) {
    const el = $('#live-sync-status');
    if (!el) return;
    el.textContent = text;
    el.className = 'live-sync-status ' + (ok ? 'ok' : 'wait');
  }

  async function livePullSilent() {
    if (!getSyncToken() || liveSyncBusy) return;
    liveSyncBusy = true;
    try {
      const r = await pullSharedState();
      if (r.ok) {
        const at = r.state && r.state.updatedAt;
        failStreak = 0;
        if (at && at !== lastKnownUpdatedAt) {
          lastKnownUpdatedAt = at;
          renderParticipants();
          renderVolunteersAdmin();
          renderAttendance();
          renderDashboard();
          renderSyncBar();
          setLiveStatus('Live · updated ' + new Date(at).toLocaleTimeString(), true);
        } else {
          renderVolunteersAdmin();
          setLiveStatus('Live · in sync', true);
        }
        // Restore normal poll after recovery
        if (liveSyncTimer) {
          clearInterval(liveSyncTimer);
          liveSyncTimer = setInterval(livePullSilent, LIVE_POLL_MS);
        }
      } else {
        failStreak++;
        setLiveStatus('Offline · ' + (r.error || 'pull failed').toString().slice(0, 80), false);
        if (failStreak >= 2 && liveSyncTimer) {
          clearInterval(liveSyncTimer);
          liveSyncTimer = setInterval(livePullSilent, LIVE_POLL_SLOW_MS);
        }
      }
    } catch (e) {
      failStreak++;
      setLiveStatus('Offline · network', false);
    } finally {
      liveSyncBusy = false;
    }
  }

  function startLiveSync() {
    stopLiveSync();
    if (!getSyncToken()) {
      setLiveStatus('Set sync token for live mode', false);
      return;
    }
    setLiveStatus('Live · connecting…', true);
    livePullSilent();
    liveSyncTimer = setInterval(livePullSilent, LIVE_POLL_MS);
  }

  function stopLiveSync() {
    if (liveSyncTimer) {
      clearInterval(liveSyncTimer);
      liveSyncTimer = null;
    }
  }

  async function livePush(partial) {
    if (!getSyncToken()) return { ok: false, error: 'No token' };
    const r = await pushSharedState(partial);
    if (r.ok && r.state && r.state.updatedAt) {
      lastKnownUpdatedAt = r.state.updatedAt;
      setLiveStatus('Live · saved ' + new Date(r.state.updatedAt).toLocaleTimeString(), true);
    }
    return r;
  }


  const RESTORED_ATHLETES = [
    {
      fullName: 'Maggie Chitseko',
      aliases: ['maggei chitseko', 'maggie chitseko', 'maggie  chitseko'],
      distance: '10',
      email: '',
      phone: '',
      source: 'netlify-forms-restore'
    },
    {
      fullName: 'Mussa Maundala',
      aliases: ['mussa maundala', 'musa maundala'],
      distance: '42.195',
      email: '',
      phone: '',
      source: 'netlify-forms-restore'
    }
  ];

  function namesMatchAthlete(r, spec) {
    const n = String(r.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (n === spec.fullName.toLowerCase()) return true;
    return (spec.aliases || []).some((a) => a === n);
  }

  function ensureRestoredAthletes() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem('bt42_registrations') || '[]'); } catch { list = []; }
    const pays = loadPayments();
    let changed = false;
    RESTORED_ATHLETES.forEach((spec) => {
      let idx = list.findIndex((r) => namesMatchAthlete(r, spec));
      if (idx < 0) {
        list.push({
          fullName: spec.fullName,
          phone: spec.phone || '',
          email: spec.email || '',
          distance: spec.distance,
          submittedAt: new Date().toISOString(),
          source: spec.source,
          restored: true,
          paymentRef: 'Netlify Forms — restored by Chair'
        });
        idx = list.length - 1;
        changed = true;
      } else if (String(list[idx].fullName || '').trim() !== spec.fullName) {
        list[idx].previousFullName = list[idx].fullName;
        list[idx].fullName = spec.fullName;
        list[idx].distance = list[idx].distance || spec.distance;
        list[idx].restored = true;
        changed = true;
      }
      const r = list[idx];
      const rec = { status: 'verified', note: 'Restored from Netlify Forms — verified by Chair', verifiedAt: new Date().toISOString(), verifiedBy: 'chair-restore' };
      paymentKeysFor(r, idx).concat([participantKey(r, idx)]).forEach((k) => {
        if (!k) return;
        if (!pays[k] || pays[k].status !== 'verified') {
          pays[k] = Object.assign({}, rec);
          changed = true;
        }
      });
    });
    if (changed) {
      localStorage.setItem('bt42_registrations', JSON.stringify(list));
      savePayments(pays);
      if (getSyncToken()) {
        livePush({
          registrations: list,
          replaceRegistrations: false,
          payments: pays
        }).catch(() => {});
      }
    }
    return list;
  }

  function entryStamp(r) {
    const raw = r && (r.submittedAt || r.createdAt || r.registeredAt || '');
    if (!raw) return '—';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw).replace('T', ' ').slice(0, 16);
    return d.toLocaleString('en-GB', {
      timeZone: 'Africa/Blantyre',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function renderParticipants() {
    const container = $('#ctrl-participants');
    if (!container) return;
    let rows = [];
    try { ensureRestoredAthletes(); } catch (e) {}
    try {
      rows = JSON.parse(localStorage.getItem('bt42_registrations') || '[]');
    } catch { rows = []; }
    const pays = loadPayments();
    const finishes = loadFinishes();
    const bibs = loadBibs();
    const sigs = loadSigs();
    const sigReady = !!(sigs.kalua && sigs.chamwala && sigs.tenthani);

    let html = `<div class="notice" style="margin-bottom:1rem">
      <strong>Participant list</strong> — visible to all committee members.<br>
      <strong>Payment verification (Verify / Reject)</strong> — <em>Chair only</em>.
      ${canPayment() ? '' : '<br><span class="pay-status pay-wait">Payment verify requires an Ops or Chair login.</span>'}
      <br>Pay to National Bank of Malawi account <code>782637</code> (reference: name + mobile).
      ${sigReady ? '<br><span class="pay-status pay-ok">E-signatures loaded</span>' : (isChair ? '<br><span class="pay-status pay-wait">Upload e-signatures below before issuing certificates</span>' : '')}
    </div>

    ${isChair ? `<div class="sig-upload-box">
      <h4 style="margin:0 0 0.5rem">Electronic signatures (Chair only)</h4>
      <p class="form-note" style="margin-bottom:0.5rem">Upload PNG/JPG for Kalua, Chamwala and Tenthani. These are embedded on athlete <strong>and volunteer</strong> certificates. After upload you should see “Signature saved and synced.” Use <strong>Push signatures</strong> if a certificate went out unsigned.</p>
      <button type="button" class="btn-mini" id="sig-push-now">Push signatures to shared store</button>
      <div class="sig-upload-grid">
        <label>Jim Kalua (Chairman, MNCS)<input type="file" accept="image/*" data-sig="kalua" class="sig-file" /></label>
        <label>Kondwani Chamwala (President, Athletics Malawi)<input type="file" accept="image/*" data-sig="chamwala" class="sig-file" /></label>
        <label>Chifundo Tenthani (OC Chair)<input type="file" accept="image/*" data-sig="tenthani" class="sig-file" /></label>
      </div>
      <div class="sig-previews" id="sig-previews"></div>
    </div>` : ''}`;

    if (!rows.length) {
      html += `<p style="color:var(--text-muted);margin-top:1rem">No registrations in the shared list yet. After JSONBin is configured, entries from any phone appear here — click Pull. Local-only test entries also show until cleared.</p>`;
      container.innerHTML = html;
      wireSigUploads();
      renderSigPreviews();
      return;
    }

    const verified = rows.filter((r, i) => paymentRecordFor(r, i, pays).status === 'verified').length;
    const finished = rows.filter((r, i) => (finishes[participantKey(r, i)] || {}).status === 'finished').length;

    const raceFilter = sessionStorage.getItem('bt42_part_race') || 'all';
    const raceMatch = (r) => {
      const c = normalizeDistanceCode(r.distance);
      if (raceFilter === 'all') return true;
      if (raceFilter === '42') return c === '42.195';
      if (raceFilter === '10') return c === '10';
      if (raceFilter === '5') return c === '5';
      return true;
    };
    const visible = [];
    rows.forEach((r, i) => { if (raceMatch(r)) visible.push({ r, i }); });
    const n42 = rows.filter((r) => normalizeDistanceCode(r.distance) === '42.195').length;
    const n10 = rows.filter((r) => normalizeDistanceCode(r.distance) === '10').length;
    const n5 = rows.filter((r) => normalizeDistanceCode(r.distance) === '5').length;
    const chip = (id, label) =>
      '<button type="button" class="btn-mini race-filter' + (raceFilter === id ? ' active' : '') + '" data-race="' + id + '">' + label + '</button>';

    html += `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.75rem;margin:0.75rem 0">
        <p style="font-size:0.85rem;margin:0"><strong>${rows.length}</strong> shared entries · <strong>${verified}</strong> paid · <strong>${finished}</strong> finished</p>
        <button type="button" class="btn-mini" id="sync-local-shared">Upload this phone's local entries to shared list</button>
        ${isChair ? '<button type="button" class="btn-mini" id="clear-all-entries" style="border-color:#C0392B;color:#C0392B">Clear all entries</button>' : ''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin:0 0 0.75rem">
        ${chip('all', 'All (' + rows.length + ')')}
        ${chip('42', '42.195 km (' + n42 + ')')}
        ${chip('10', '10 km (' + n10 + ')')}
        ${chip('5', '5 km (' + n5 + ')')}
      </div>
      <div class="sponsor-table-wrap"><table class="ctrl-table">
      <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Race</th><th>Entered</th><th>Payment</th><th>Bib</th><th>Finish</th><th>Certificates</th><th></th></tr></thead><tbody>`;

    visible.forEach(({ r, i }) => {
      const key = participantKey(r, i);
      const pay = paymentRecordFor(r, i, pays);
      const fin = finishes[key] || { status: 'not_started' };
      const st = String(pay.status || 'pending').toLowerCase();
      const fst = fin.status || 'not_started';
      const stLabel = st === 'verified' ? 'Verified' : (st === 'rejected' ? 'Rejected' : 'Pending');
      const stClass = st === 'verified' ? 'pay-ok' : (st === 'rejected' ? 'pay-no' : 'pay-wait');
      const fLabel = fst === 'finished' ? 'Finished' : (fst === 'dns' ? 'DNS' : (fst === 'dnf' ? 'DNF' : '—'));
      const fClass = fst === 'finished' ? 'pay-ok' : (fst === 'dnf' || fst === 'dns' ? 'pay-no' : 'pay-wait');
      const hasBib = !!(bibs[key] && bibs[key].number) || Object.keys(bibs).some((bk) => {
        const b = bibs[bk];
        return b && b.number && String(b.name || '').trim().toLowerCase() === String(r.fullName || '').trim().toLowerCase();
      });
      const finDisabled = !canFinish() || !hasBib;
      const finTitle = !canFinish() ? 'Need Ops/Chair login' : (!hasBib ? 'Assign bib first' : '');
      html += `<tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(r.fullName || '')}</strong>${r.email ? '<br><small>' + escapeHtml(r.email) + '</small>' : '<br><small class="form-note">No email</small>'}<br><button type="button" class="btn-mini entry-edit" data-i="${i}">Correct name</button> <button type="button" class="btn-mini entry-email" data-i="${i}">Correct email</button>${isChair ? ' <label class="form-note">Edit one field <select class="entry-field" data-i="'+i+'"><option value="">Choose…</option><option value="fullName">Name</option><option value="phone">Phone</option><option value="email">Email</option><option value="distance">Race</option><option value="dob">Date of birth</option><option value="gender">Gender</option><option value="club">Club / team</option><option value="emergencyName">Emergency name</option><option value="emergencyPhone">Emergency phone</option><option value="paymentRef">Payment reference</option></select></label> <button type="button" class="btn-mini entry-one" data-i="'+i+'">Save field</button>' : ''}</td>
        <td>${escapeHtml(r.phone || '')}</td>
        <td>${escapeHtml(distanceLabel(r.distance))}</td>
        <td><small>${escapeHtml(entryStamp(r))}</small></td>
        <td>
          <span class="pay-status ${stClass}">${stLabel}</span>
          <div class="actions-cell">
            ${
              !canPayment()
                ? '<small class="form-note">Ops/Chair verifies</small>'
                : (st === 'verified' || st === 'rejected')
                  ? ''
                  : '<button type="button" class="btn-mini pay-verify" data-key="' + escapeHtml(key) + '">Verify</button><button type="button" class="btn-mini pay-reject" data-key="' + escapeHtml(key) + '">Reject</button>'
            }
          </div>
        </td>
        <td>
          ${bibs[key] && bibs[key].number ? '<strong>#' + bibs[key].number + '</strong>' : '<span class="pay-status pay-wait">No bib</span>'}
          <div class="actions-cell">
            <button type="button" class="btn-mini bib-assign" data-key="${escapeHtml(key)}" data-i="${i}" ${!canBibs() ? 'disabled title="Need Ops/Chair login"' : (st !== 'verified' ? 'disabled title="Verify payment first"' : '')}>Assign bib</button>
          </div>
        </td>
        <td>
          <span class="pay-status ${fClass}">${fLabel}</span>
          <div class="actions-cell">
            <button type="button" class="btn-mini fin-ok" data-key="${escapeHtml(key)}" data-i="${i}" ${finDisabled ? 'disabled title="' + finTitle + '"' : ''}>Finish</button>
            <button type="button" class="btn-mini fin-dnf" data-key="${escapeHtml(key)}" data-i="${i}" ${finDisabled ? 'disabled title="' + finTitle + '"' : ''}>DNF</button>
          </div>
        </td>
        <td class="actions-cell">
          <button type="button" class="btn-mini fin-cert" data-i="${i}" data-type="completion" ${fst !== 'finished' ? 'disabled title="Mark finished first"' : ''}>Completion cert</button>
          <button type="button" class="btn-mini part-cert" data-i="${i}" data-type="participation" ${fst !== 'dnf' ? 'disabled title="For DNF only"' : ''}>Participation cert</button>
        </td>
        <td class="actions-cell"><button type="button" class="btn-mini entry-delete" data-i="${i}" style="border-color:#C0392B;color:#C0392B">Delete</button></td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
    wireSigUploads();
    renderSigPreviews();
    container.querySelectorAll('.race-filter').forEach((btn) => {
      btn.onclick = () => {
        sessionStorage.setItem('bt42_part_race', btn.dataset.race || 'all');
        renderParticipants();
      };
    });



    const syncLocalBtn = $('#sync-local-shared');
    if (syncLocalBtn) {
      syncLocalBtn.onclick = async () => {
        if (!getSyncToken()) {
          alert('Save OC_SYNC_TOKEN first, then try again.');
          return;
        }
        let local = [];
        try { local = JSON.parse(localStorage.getItem('bt42_registrations') || '[]'); } catch { local = []; }
        if (!local.length) {
          alert('No local entries on this device.');
          return;
        }
        if (!confirm('Upload ' + local.length + ' entr(y/ies) from this device into the shared list for all OC members?')) return;
        // Merge with shared via push replace of union
        const rPull = await pullSharedState();
        let shared = [];
        try { shared = JSON.parse(localStorage.getItem('bt42_registrations') || '[]'); } catch { shared = []; }
        const keyOf = (x) => String(x.phone || '').replace(/\s+/g, '').toLowerCase() + '|' + String(x.fullName || '').trim().toLowerCase();
        const map = new Map();
        shared.forEach((x) => map.set(keyOf(x), x));
        local.forEach((x) => map.set(keyOf(x), Object.assign({}, map.get(keyOf(x)) || {}, x)));
        const merged = Array.from(map.values());
        localStorage.setItem('bt42_registrations', JSON.stringify(merged));
        const r = await livePush({
          registrations: merged,
          replaceRegistrations: true
        });
        if (r.ok) {
          alert('Uploaded. Shared list now has ' + merged.length + ' entries. Other devices will refresh automatically.');
          renderParticipants();
        } else {
          alert('Upload failed: ' + (r.error || 'unknown'));
        }
      };
    }

    const clearAllBtn = $('#clear-all-entries');
    if (clearAllBtn) {
      clearAllBtn.onclick = async () => {
        if (!isChair) { alert('Only the Chair can clear entries.'); return; }
        if (!confirm('Delete ALL race entries on this device and push empty list to shared sync? This cannot be undone.')) return;
        localStorage.setItem('bt42_registrations', '[]');
        savePayments({});
        saveBibs({});
        saveFinishes({});
        if (getSyncToken()) {
          const keyOf = (x) => String(x.phone || '').replace(/\s+/g, '').toLowerCase() + '|' + String(x.fullName || '').trim().toLowerCase();
          let prev = [];
          try { prev = JSON.parse(localStorage.getItem('bt42_registrations') || '[]'); } catch { prev = []; }
          const suppressed = prev.map(keyOf).filter(Boolean);
          const r = await livePush({
            registrations: [],
            replaceRegistrations: true,
            payments: {},
            replacePayments: true,
            bibs: {},
            replaceBibs: true,
            finishes: {},
            replaceFinishes: true,
            suppressedKeys: suppressed,
            replaceSuppressed: true
          });
          if (!r.ok) alert('Local entries cleared, but sync push failed: ' + r.error);
          else alert('All entries cleared and synced.');
        } else {
          alert('All local entries cleared. Set sync token and Push if other devices should clear too.');
        }
        renderParticipants();
        renderDashboard();
      };
    }

    container.querySelectorAll('.entry-one').forEach((btn) => {
      btn.onclick = async () => {
        if (!isChair) return;
        const i = Number(btn.dataset.i);
        const sel = container.querySelector('.entry-field[data-i="' + i + '"]');
        const field = sel && sel.value;
        const labels = {
          fullName: 'Name', phone: 'Phone', email: 'Email', distance: 'Race (42.195 / 10 / 5)',
          dob: 'Date of birth (YYYY-MM-DD)', gender: 'Gender', club: 'Club / team',
          emergencyName: 'Emergency contact name', emergencyPhone: 'Emergency phone', paymentRef: 'Payment reference'
        };
        if (!field || !labels[field]) {
          alert('Choose one field to edit.');
          return;
        }
        let list = [];
        try { list = JSON.parse(localStorage.getItem('bt42_registrations') || '[]'); } catch { list = []; }
        const r = list[i];
        if (!r) return;
        const current = field === 'club' ? (r.club || r.teamName || '') : (r[field] || '');
        const typed = prompt('New ' + labels[field] + ':', current);
        if (typed === null) return;
        const value = String(typed).trim();
        if (field === 'email' && value && !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/i.test(value)) {
          alert('That email is not valid.');
          return;
        }
        if (field === 'distance') {
          const c = normalizeDistanceCode(value);
          r.distance = c === '42.195' || c === '10' || c === '5' ? c : value;
        } else if (field === 'club') {
          r.club = value;
        } else {
          r[field] = value;
        }
        r.editedAt = new Date().toISOString();
        r.editedBy = currentUser || 'chair';
        r.editedField = field;
        list[i] = r;
        localStorage.setItem('bt42_registrations', JSON.stringify(list));
        if (getSyncToken()) await livePush({ registrations: list, replaceRegistrations: true }).catch(() => {});
        renderParticipants();
        alert(labels[field] + ' updated.');
      };
    });

    container.querySelectorAll('.entry-email').forEach((btn) => {
      btn.onclick = async () => {
        if (!(isChair || canPayment() || canBibs() || canFinish())) {
          alert('Sign in as staff to correct an email.');
          return;
        }
        const i = Number(btn.dataset.i);
        let list = [];
        try { list = JSON.parse(localStorage.getItem('bt42_registrations') || '[]'); } catch { list = []; }
        const r = list[i];
        if (!r) return;
        const nextEmail = window.prompt('Correct email for ' + (r.fullName || 'athlete') + ' (race emails go here):', r.email || r.teamContactEmail || '');
        if (nextEmail === null) return;
        const cleaned = String(nextEmail).trim().toLowerCase();
        if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/.test(cleaned) || /gamil\.com|gmial\.com|gnail\.com|gmail\.con|gmail\.cm$/.test(cleaned)) {
          alert('That is not a valid email. Use a real inbox such as name@gmail.com.');
          return;
        }
        r.email = cleaned;
        if (r.teamContactEmail) r.teamContactEmail = cleaned;
        r.emailCorrectedAt = new Date().toISOString();
        r.emailCorrectedBy = currentUser || (isChair ? 'chair' : 'staff');
        list[i] = r;
        localStorage.setItem('bt42_registrations', JSON.stringify(list));
        if (getSyncToken()) {
          await livePush({ registrations: list, replaceRegistrations: true }).catch(() => {});
        }
        renderParticipants();
        alert('Email updated to ' + cleaned + '.');
      };
    });

    container.querySelectorAll('.entry-edit').forEach((btn) => {
      btn.onclick = async () => {
        if (!(isChair || canPayment() || canBibs() || canFinish())) {
          alert('Sign in as staff to correct a name.');
          return;
        }
        const i = Number(btn.dataset.i);
        let list = [];
        try { list = JSON.parse(localStorage.getItem('bt42_registrations') || '[]'); } catch { list = []; }
        const r = list[i];
        if (!r) return;
        const nextName = window.prompt('Correct the name as it should appear on the bib and certificate:\n\nCurrent: ' + (r.fullName || ''), r.fullName || '');
        if (nextName === null) return;
        const cleaned = String(nextName).trim().replace(/\s+/g, ' ');
        if (cleaned.length < 3) {
          alert('Enter the full name (at least 3 characters).');
          return;
        }
        if (cleaned === String(r.fullName || '').trim()) return;
        const oldKeys = paymentKeysFor(r, i);
        const oldKey = participantKey(r, i);
        const previousFullName = String(r.fullName || '').trim();
        r.previousFullName = previousFullName;
        r.fullName = cleaned;
        r.nameCorrectedAt = new Date().toISOString();
        r.nameCorrectedBy = currentUser || (isChair ? 'chair' : 'staff');
        list[i] = r;
        localStorage.setItem('bt42_registrations', JSON.stringify(list));
        const newKeys = paymentKeysFor(r, i);
        const newKey = participantKey(r, i);
        function remap(map) {
          const out = Object.assign({}, map);
          oldKeys.concat([oldKey]).forEach((ok, idx) => {
            const nk = (newKeys[idx] != null ? newKeys[idx] : newKey);
            if (ok && nk && ok !== nk && out[ok] && !out[nk]) {
              out[nk] = Object.assign({}, out[ok], { name: cleaned });
            }
          });
          if (out[oldKey] && !out[newKey]) out[newKey] = Object.assign({}, out[oldKey], { name: cleaned });
          return out;
        }
        const pays = remap(loadPayments()); savePayments(pays);
        const bibsMap = remap(loadBibs()); saveBibs(bibsMap);
        const fins = remap(loadFinishes()); saveFinishes(fins);
        const oldIdentity = String(r.phone || '').replace(/\s+/g, '').toLowerCase() + '|' + String((oldKeys[0] || '').split('|').pop() || '');
        const suppressOld = String((r.phone || '')).replace(/\s+/g, '').toLowerCase() + '|' + String(oldKey.split('|').slice(1).join('|') || '');
        // oldKey is phone|oldname — rebuild from values before we overwrote name
        const oldNameKey = oldKey;
        if (getSyncToken()) {
          const pushed = await livePush({
            registrations: list,
            replaceRegistrations: true,
            payments: pays,
            bibs: bibsMap,
            finishes: fins
          }).catch((e) => ({ ok: false, error: String(e && e.message ? e.message : e) }));
          if (!pushed || pushed.ok === false) {
            alert('Name changed on this phone, but the shared list failed: ' + ((pushed && pushed.error) || 'sync') + '. Use Push/Upload this phone’s local entries.');
          }
        }
        renderParticipants();
        alert('Name updated to “' + cleaned + '”. The old spelling is removed.');
      };
    });

    container.querySelectorAll('.entry-delete').forEach(btn => {
      btn.onclick = async () => {
        if (!(isChair || canPayment() || canBibs())) { alert('Sign in as Chair or Ops to delete an entry.'); return; }
        const i = Number(btn.dataset.i);
        let list = [];
        try { list = JSON.parse(localStorage.getItem('bt42_registrations') || '[]'); } catch { list = []; }
        const r = list[i];
        if (!r) return;
        if (!confirm('Delete entry for ' + (r.fullName || 'this athlete') + '?')) return;
        const key = participantKey(r, i);
        const delKey = String(r.phone || '').replace(/\s+/g, '').toLowerCase() + '|' + String(r.fullName || '').trim().toLowerCase();
        const next = list.filter((_, idx) => idx !== i);
        localStorage.setItem('bt42_registrations', JSON.stringify(next));
        const pays = loadPayments(); delete pays[key]; savePayments(pays);
        const bibsMap = loadBibs(); delete bibsMap[key]; saveBibs(bibsMap);
        const fins = loadFinishes(); delete fins[key]; saveFinishes(fins);
        if (getSyncToken()) {
          try {
            const pushed = await livePush({
              registrations: next,
              replaceRegistrations: true,
              payments: pays,
              replacePayments: true,
              bibs: bibsMap,
              replaceBibs: true,
              finishes: fins,
              replaceFinishes: true,
              suppressedKeys: delKey ? [delKey] : []
            });
            if (pushed && pushed.ok === false) alert('Deleted here but shared list failed: ' + (pushed.error || ''));
          } catch (e) {
            alert('Deleted here but shared list failed: ' + (e.message || e));
          }
        }
        renderParticipants();
        renderDashboard();
      };
    });

    container.querySelectorAll('.bib-assign').forEach(btn => {
      btn.onclick = () => {
        if (!canBibs()) { alert('Your login cannot assign bibs. Ask the Chair for an Ops account.'); return; }
        const i = Number(btn.dataset.i);
        const r = rows[i];
        if (!r) return;
        const map = loadBibs();
        const mates = (r.teamId ? teamMates(r, rows) : [r]).slice();
        // Sort team by member index if present
        mates.sort((a, b) => (Number(a.teamMemberIndex) || 0) - (Number(b.teamMemberIndex) || 0));

        function keyFor(m) {
          // Always key by name+phone so team-mates with shared contact phone stay distinct
          const phone = String(m.phone || m.teamContactPhone || '').replace(/\s+/g, '');
          const name = String(m.fullName || '').trim().toLowerCase();
          return (phone + '|' + name) || participantKey(m, rows.indexOf(m));
        }
        function existingBib(m) {
          // Only accept a bib stored under this member's exact key or exact name match
          const k = keyFor(m);
          if (map[k] && map[k].number) return String(map[k].number);
          const wantName = String(m.fullName || '').trim().toLowerCase();
          let found = '';
          Object.keys(map).forEach((key) => {
            const b = map[key];
            if (!b || !b.number) return;
            if (String(b.name || '').trim().toLowerCase() === wantName) {
              // name match only (do NOT match on shared team phone alone)
              found = String(b.number);
            }
          });
          return found;
        }

        if (r.teamId && mates.length > 1) {
          // Preview next free bib per distance series for this team
          const used = new Set(
            Object.values(map).map((b) => Number(b && b.number)).filter((x) => !isNaN(x) && x > 0)
          );
          const seriesNote = {
            '42.195': 'Marathon series (1001+)',
            '10': '10 km series (2001+)',
            '5': '5 km series (3001+)'
          };
          const plan = mates.map((m) => {
            const sug = nextBibForDistance(m.distance, map);
            return (m.fullName || '') + ' — ' + distanceLabel(m.distance) + ' → ~' + sug;
          }).join('\n');
          if (!confirm(
            'Assign bibs to team "' + (r.teamName || 'Team') + '" by RACE:\n\n' +
            plan + '\n\n' +
            'Marathon: 1001+ · 10 km: 2001+ · 5 km: 3001+\n' +
            'Numbers already used are skipped. Continue?'
          )) return;

          const assigned = [];
          // Cursor per distance series so same-race team-mates get consecutive unique bibs
          const cursor = {};
          const assignedNums = new Set();
          mates.forEach((m) => {
            const k = keyFor(m);
            const dist = normalizeDistanceCode(m.distance) || '10';
            if (cursor[dist] == null) {
              cursor[dist] = nextBibForDistance(dist, map);
            }
            let n = Number(cursor[dist]);
            while (used.has(n) || assignedNums.has(n)) n += 1;
            const numStr = String(n);
            used.add(n);
            assignedNums.add(n);
            cursor[dist] = n + 1;
            // Remove any previous bib entry for this athlete (old colliding keys)
            Object.keys(map).forEach((oldKey) => {
              if (map[oldKey] && String(map[oldKey].name || '').toLowerCase() === String(m.fullName || '').toLowerCase()
                  && String(map[oldKey].teamId || '') === String(m.teamId || r.teamId || '')) {
                if (oldKey !== k) delete map[oldKey];
              }
            });
            map[k] = {
              number: numStr,
              assignedAt: new Date().toISOString(),
              distance: m.distance,
              name: m.fullName,
              phone: m.phone || m.teamContactPhone || '',
              email: m.email || m.teamContactEmail || '',
              teamId: m.teamId || r.teamId,
              teamName: m.teamName || r.teamName || ''
            };
            assigned.push({ m: m, number: numStr, key: k, distance: dist });
          });
          // Safety: never allow duplicate numbers in this batch
          const nums = assigned.map((a) => a.number);
          if (new Set(nums).size !== nums.length) {
            alert('Bib assignment error: duplicate numbers detected. Try again.');
            return;
          }
          saveBibs(map);
          if (getSyncToken()) livePush({ bibs: map, replaceBibs: true }).catch(() => {});

          const to = teamContactEmail(r, mates);
          const items = assigned.map((a) =>
            '<li>' + escapeHtml(a.m.fullName || '') + ' — ' + escapeHtml(distanceLabel(a.m.distance)) +
            ' — bib <strong>' + escapeHtml(a.number) + '</strong></li>'
          ).join('');
          if (to) {
            sendAthleteEmail({
              type: 'bib',
              to: to,
              fullName: r.teamName || 'Team',
              distance: 'team',
              bib: assigned.map((a) => a.number).join(', '),
              subject: 'Bib numbers — ' + (r.teamName || 'Team') + ' — BT42.195km Race 2026',
              html: '<p>Dear ' + escapeHtml(r.teamName || 'Team') + ' contact,</p>' +
                '<p>Bib numbers for your team:</p><ul>' + items + '</ul>' +
                '<p>Race day: <strong>27 September 2026</strong>.</p>' +
                '<p>— Organising Committee, BT42.195km Race</p>'
            }).then((j) => console.log('Team bib email', j));
          }
          renderParticipants();
          alert('Assigned ' + assigned.length + ' bib(s) for team "' + (r.teamName || '') + '":\n' + assigned.map(function(a){ return a.m.fullName + ' (' + distanceLabel(a.m.distance) + ') → #' + a.number; }).join('\n') + (to ? '\n\nOne email sent to ' + to : ''));
          return;
        }

        // Individual
        const suggested = existingBib(r) || nextBibForDistance(r.distance, map);
        const num = prompt('Bib number for ' + (r.fullName || 'athlete') + ':', String(suggested));
        if (!num) return;
        map[btn.dataset.key] = {
          number: String(num).trim(),
          assignedAt: new Date().toISOString(),
          distance: r.distance,
          name: r.fullName,
          phone: r.phone,
          email: r.email || ''
        };
        saveBibs(map);
        if (getSyncToken()) livePush({ bibs: map, replaceBibs: true }).catch(() => {});
        const to = (r.email || '').trim();
        if (to) {
          sendAthleteEmail({
            type: 'bib',
            to: to,
            fullName: r.fullName,
            distance: distanceLabel(r.distance),
            bib: String(num).trim(),
            raceDate: '27 September 2026'
          }).then((j) => console.log('Bib email', j));
        }
        renderParticipants();
        alert('Bib #' + String(num).trim() + ' assigned.');
      };
    });

    container.querySelectorAll('.pay-verify').forEach(btn => {
      btn.onclick = () => {
        if (!canPayment()) { alert('Your login cannot verify payments. Ask the Chair for an Ops account.'); return; }
        const map = loadPayments();
        const payKey = btn.dataset.key;
        const list = JSON.parse(localStorage.getItem('bt42_registrations') || '[]');
        let row = list.find((x, idx) => participantKey(x, idx) === payKey);
        if (!row) {
          row = list.find((x) => {
            const k = String(x.phone || '').replace(/\s+/g, '').toLowerCase() + '|' + String(x.fullName || '').trim().toLowerCase();
            return k === payKey;
          });
        }
        if (!row) {
          row = rows.find((x, idx) => participantKey(x, idx) === payKey);
        }
        const mates = teamMates(row, (list.length ? list : rows));
        const toVerify = (row && row.teamId && mates.length > 1) ? mates : (row ? [row] : []);
        const note = prompt(
          toVerify.length > 1
            ? ('Verify payment for ALL ' + toVerify.length + ' members of team "' + (row.teamName || 'Team') + '"?\nOptional note (Bank ref):')
            : 'Optional note (Bank ref):',
          (map[payKey] || {}).note || ''
        );
        if (note === null) return; // cancelled
        const verifiedAt = new Date().toISOString();
        const verifiedBy = currentUser || (isChair ? 'Chair' : 'Ops');
        const rec = { status: 'verified', note: note || '', verifiedAt: verifiedAt, verifiedBy: verifiedBy };
        toVerify.forEach((m, idx) => {
          const iM = rows.indexOf(m) >= 0 ? rows.indexOf(m) : idx;
          rec.teamId = m.teamId || (row && row.teamId) || '';
          paymentKeysFor(m, iM).forEach((k) => { map[k] = Object.assign({}, rec); });
        });
        map[payKey] = Object.assign({}, rec);
        savePayments(map);
        if (getSyncToken()) {
          livePush({ payments: map }).catch((e) => console.warn('payment sync', e));
        }
        renderParticipants();
        try {
          const to = teamContactEmail(row || {}, mates);
          if (to && row && row.teamId && toVerify.length > 1) {
            const roster = toVerify.map((m) =>
              '<li>' + escapeHtml(m.fullName || '') + ' — ' + escapeHtml(distanceLabel(m.distance)) + '</li>'
            ).join('');
            sendAthleteEmail({
              type: 'payment',
              to: to,
              email: to,
              fullName: row.teamName ? (row.teamName + ' team') : 'Team',
              distance: 'team entry',
              raceDate: '27 September 2026',
              html: '<p>Dear ' + escapeHtml(row.teamName || 'Team') + ' contact,</p>' +
                '<p>We have verified payment for your <strong>entire team</strong> entry to the <strong>BT42.195km Race</strong>.</p>' +
                '<p><strong>Team members verified:</strong></p><ul>' + roster + '</ul>' +
                '<p>Bib numbers will be assigned next; you will receive one email for the team when bibs are ready.</p>' +
                '<p>— Organising Committee, BT42.195km Race</p>',
              subject: 'Payment verified — ' + (row.teamName || 'Team') + ' — BT42.195km Race 2026'
            }).then((j) => {
              if (j && j.ok) alert('Payment verified for ' + toVerify.length + ' team members. One email sent to ' + to);
              else alert('Payment verified for ' + toVerify.length + ' members. Email may have failed: ' + ((j && j.error) || 'unknown'));
            });
          } else if (to) {
            sendAthleteEmail({
              type: 'payment',
              to: to,
              email: to,
              fullName: (row && row.fullName) || '',
              distance: distanceLabel((row && row.distance) || ''),
              raceDate: '27 September 2026'
            }).then((j) => {
              if (j && j.ok) alert('Payment verified. Confirmation email sent to ' + to);
              else alert('Payment verified. Email may have failed: ' + ((j && j.error) || 'unknown'));
            });
          } else {
            alert(toVerify.length > 1
              ? ('Payment verified for all ' + toVerify.length + ' team members. No email on file.')
              : 'Payment verified. No email on file — confirmation not sent.');
          }
        } catch (e) {
          console.warn('Payment email error', e);
          alert('Payment verified (email error: ' + (e.message || e) + ')');
        }
      };
    });
    container.querySelectorAll('.pay-reject').forEach(btn => {
      btn.onclick = () => {
        if (!canPayment()) { alert('Your login cannot reject payments.'); return; }
        const map = loadPayments();
        const payKey = btn.dataset.key;
        const list = JSON.parse(localStorage.getItem('bt42_registrations') || '[]');
        let row = list.find((x, idx) => participantKey(x, idx) === payKey) ||
          rows.find((x, idx) => participantKey(x, idx) === payKey);
        const mates = teamMates(row, list.length ? list : rows);
        const toReject = (row && row.teamId && mates.length > 1) ? mates : (row ? [row] : []);
        const reason = prompt(
          toReject.length > 1
            ? ('Reject payment for ALL ' + toReject.length + ' team members? Reason (optional):')
            : 'Reason (optional):',
          ''
        );
        if (reason === null) return;
        const verifiedAt = new Date().toISOString();
        toReject.forEach((m, idx) => {
          const k = participantKey(m, rows.indexOf(m) >= 0 ? rows.indexOf(m) : idx);
          map[k] = { status: 'rejected', note: reason || '', verifiedAt: verifiedAt };
        });
        map[payKey] = { status: 'rejected', note: reason || '', verifiedAt: verifiedAt };
        savePayments(map);
        if (getSyncToken()) livePush({ payments: map }).catch(() => {});
        renderParticipants();
        if (toReject.length > 1) alert('Payment rejected for ' + toReject.length + ' team members.');
      };
    });
    container.querySelectorAll('.fin-ok').forEach(btn => {
      btn.onclick = () => {
        if (!canFinish()) { alert('Your login cannot enter finish times.'); return; }
        const bibMap = loadBibs();
        if (!(bibMap[btn.dataset.key] && bibMap[btn.dataset.key].number)) {
          alert('Assign a bib before marking Finish. Certificates are only for athletes who raced.');
          return;
        }
        const map = loadFinishes();
        const time = prompt('Official finish time (optional, e.g. 3:42:15):', (map[btn.dataset.key] || {}).time || '') || '';
        map[btn.dataset.key] = { status: 'finished', time, finishedAt: new Date().toISOString() };
        saveFinishes(map);
        if (getSyncToken()) livePush({ finishes: map }).catch(() => {});
        const r = rows[Number(btn.dataset.i)];
        // Auto-open completion certificate and queue outbound email hook
        if (r) {
          openCertificate(r, 'completion');
          queueCompletionEmail(r, time);
          if (!(r.email || '').trim()) {
            alert('Marked finished. No email on file for this athlete — certificate was not emailed. Print/save from the certificate window.');
          }
        }
        renderParticipants();
        renderLiveResults();
      };
    });
    container.querySelectorAll('.fin-dnf').forEach(btn => {
      btn.onclick = () => {
        if (!canFinish()) { alert('Your login cannot enter DNF.'); return; }
        const bibMapD = loadBibs();
        if (!(bibMapD[btn.dataset.key] && bibMapD[btn.dataset.key].number)) {
          alert('Assign a bib before marking DNF.');
          return;
        }
        const map = loadFinishes();
        map[btn.dataset.key] = { status: 'dnf', finishedAt: new Date().toISOString() };
        saveFinishes(map);
        if (getSyncToken()) livePush({ finishes: map }).catch(() => {});
        const r = rows[Number(btn.dataset.i)];
        if (r) {
          openCertificate(r, 'participation');
          queueParticipationEmail(r, 'Did Not Finish (DNF)');
          if (!(r.email || '').trim()) {
            alert('Marked DNF. No email on file — participation certificate was not emailed.');
          }
        }
        renderParticipants();
      };
    });
    container.querySelectorAll('.fin-cert, .part-cert').forEach(btn => {
      btn.onclick = () => {
        const r = rows[Number(btn.dataset.i)];
        if (r) openCertificate(r, btn.dataset.type || 'participation');
      };
    });
  }

  function wireSigUploads() {
    $$('.sig-file').forEach(input => {
      input.setAttribute('accept', 'image/*,.heic,.heif');
      input.onchange = async () => {
        if (!isChair) { alert('Only the Chair can upload e-signatures.'); return; }
        const file = input.files && input.files[0];
        if (!file) return;
        if (file.size > 12 * 1024 * 1024) {
          alert('Photo is too large. Choose a smaller PNG/JPG (crop to the ink only).');
          return;
        }
        try {
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Could not read that photo'));
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
          });
          const compressed = await compressSigImage(dataUrl, 280, 0.55);
          if (!compressed || compressed.indexOf('data:image') !== 0) {
            alert('This phone could not convert that photo. Save it as JPG in Photos, then choose the JPG.');
            return;
          }
          const map = loadSigs();
          map[input.dataset.sig] = compressed;
          map[input.dataset.sig + '_updated'] = new Date().toISOString();
          const ok = saveSigs(map);
          renderSigPreviews();
          if (!ok) return;
          const push = await pushSignaturesToServer(map);
          if (push && push.ok) {
            alert('Signature saved from this phone and synced.');
          } else {
            alert('Saved on this phone only. Sync failed: ' + ((push && push.error) || 'network') + '. Try Wi‑Fi, then Push signatures.');
          }
        } catch (e) {
          alert('Signature upload failed on this phone: ' + (e.message || e));
        }
      };
    });
    const pushBtn = $('#sig-push-now');
    if (pushBtn) {
      pushBtn.onclick = async () => {
        if (!isChair) return;
        const map = loadSigs();
        if (!map.kalua && !map.chamwala && !map.tenthani) {
          alert('Upload the three signature images first.');
          return;
        }
        const push = await pushSignaturesToServer(map);
        alert((push && push.ok) ? 'Signatures synced. Volunteer and athlete certificates will include them.' : ('Sync failed: ' + ((push && push.error) || 'unknown')));
      };
    }
  }

  function renderSigPreviews() {
    const box = $('#sig-previews');
    if (!box) return;
    const s = loadSigs();
    const labels = { kalua: 'Jim Kalua', chamwala: 'Kondwani Chamwala', tenthani: 'Chifundo Tenthani' };
    box.innerHTML = Object.keys(labels).map(k => {
      if (!s[k]) return `<div class="sig-prev empty">${labels[k]}: not uploaded</div>`;
      return `<div class="sig-prev"><img src="${s[k]}" alt="${labels[k]}" /><span>${labels[k]}</span></div>`;
    }).join('');
  }


  function teamMates(row, allRows) {
    if (!row || !row.teamId) return row ? [row] : [];
    return (allRows || []).filter((r) => r.teamId && r.teamId === row.teamId);
  }

  function teamContactEmail(row, mates) {
    const list = mates && mates.length ? mates : (row ? [row] : []);
    for (const m of list) {
      const e = (m.teamContactEmail || m.email || '').trim();
      if (e && e.indexOf('@') > 0) return e;
    }
    return (row && (row.teamContactEmail || row.email) || '').trim();
  }

  function formatTeamRosterHtml(mates, extra) {
    const lines = (mates || []).map((m) => {
      const bib = extra && extra.bibs && extra.bibs[participantKey(m, 0)];
      // bib map uses keys — pass precomputed labels instead
      return m;
    });
    return mates.map((m, i) => {
      const fee = m.feeMwk != null ? ' — ' + m.feeMwk + ' MWK' : '';
      const bib = (extra && extra.bibLabel && extra.bibLabel[i]) ? ' — bib <strong>' + extra.bibLabel[i] + '</strong>' : '';
      const pay = (extra && extra.payLabel && extra.payLabel[i]) ? ' — ' + extra.payLabel[i] : '';
      return '<li>' + escapeHtml(m.fullName || '') + ' (' + escapeHtml(distanceLabel(m.distance)) + ')' + fee + bib + pay + '</li>';
    }).join('');
  }

  const recentEmail = {};
  function sendAthleteEmail(payload) {
    if (!payload) return Promise.resolve({ ok: false, skipped: true });
    const to = (payload.to || payload.email || '').trim();
    if (!to) return Promise.resolve({ ok: false, skipped: true, error: 'No recipient' });
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/i.test(to) || /gamil\.com|gmial\.com|gnail\.com|gmail\.con|gmail\.cm$/i.test(to)) {
      return Promise.resolve({ ok: false, skipped: true, error: 'Invalid email — not sent' });
    }
    const dedupeKey = [payload.type || '', to.toLowerCase(), payload.bib || '', payload.subject || '', payload.fullName || ''].join('|');
    const now = Date.now();
    if (recentEmail[dedupeKey] && now - recentEmail[dedupeKey] < 20000) {
      console.info('Skipped duplicate email', dedupeKey);
      return Promise.resolve({ ok: true, skipped: true, deduped: true });
    }
    recentEmail[dedupeKey] = now;
    const body = Object.assign({}, payload, { to: to, email: to });
    function once() {
      return fetch('/.netlify/functions/send-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (!j.ok) console.warn('Email send failed', j.error || j, body.type, to);
        return j;
      });
    }
    return once().catch(() => new Promise((r) => setTimeout(r, 900)).then(once))
      .catch((e) => ({ ok: false, error: String(e && e.message ? e.message : e) }));
  }


  function queueParticipationEmail(r, reason) {
    const to = (r.email || r.teamContactEmail || '').trim();
    if (!to) {
      console.info('No email on file — participation certificate not emailed for', r.fullName);
      return;
    }
    const dist = distanceLabel(r.distance);
    const name = r.fullName || 'Athlete';
    const reasonLine = reason
      ? '<p>Status: <strong>' + String(reason).replace(/</g, '') + '</strong></p>'
      : '';
    const html = [
      '<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1a1a1a">',
      '<h2 style="color:#1B4F72;border-bottom:3px solid #1B4F72;padding-bottom:8px">Certificate of Participation</h2>',
      '<p>This certifies that</p>',
      '<p style="font-size:1.35rem;font-weight:bold;margin:0.5rem 0">' + String(name).replace(/</g, '') + '</p>',
      '<p>was a registered participant in the <strong>' + String(dist).replace(/</g, '') + '</strong>',
      ' of the <strong>BT42.195km Race 2026</strong>, organised under the auspices of the',
      ' <strong>Malawi National Council of Sports</strong>.</p>',
      reasonLine,
      '<p>Race day: <strong>27 September 2026</strong> · Blantyre, Malawi</p>',
      '<p style="margin-top:1.5rem;font-size:0.9rem;color:#555">Signatories: Jim Kalua (Chairman, MNCS); Kondwani Chamwala (President, Athletics Malawi);',
      ' Chifundo Tenthani (Chair, Organising Committee).</p>',
      '<p>— Organising Committee, BT42.195km Race</p>',
      '</div>'
    ].join('');
    const sigsP = loadSigs();
    const phoneP = r.phone || '';
    const certIdP = 'BT42-PART-' + String(phoneP).replace(/\D/g, '').slice(-8);
    sendAthleteEmail({
      type: 'participation',
      to: to,
      fullName: name,
      distance: dist,
      reason: reason || '',
      phone: phoneP,
      email: to,
      certId: certIdP,
      issued: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      subject: 'Certificate of Participation — BT42.195km Race 2026',
      raceDate: '27 September 2026',
      signatures: certSignaturesPayload()
    }).then((j) => {
      if (j && j.ok) console.log('Participation certificate emailed to', to);
      else console.warn('Participation certificate email result', j);
    });
  }

  function queueCompletionEmail(r, finishTime) {
    const to = (r.email || r.teamContactEmail || '').trim();
    if (!to) {
      console.info('No email on file — completion certificate not emailed for', r.fullName);
      return;
    }
    const dist = distanceLabel(r.distance);
    const name = r.fullName || 'Athlete';
    const timeLine = finishTime
      ? '<p>Official finish time: <strong>' + String(finishTime).replace(/</g, '') + '</strong></p>'
      : '';
    const html = [
      '<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1a1a1a">',
      '<h2 style="color:#1B4F72;border-bottom:3px solid #27AE60;padding-bottom:8px">Certificate of Completion</h2>',
      '<p>This certifies that</p>',
      '<p style="font-size:1.35rem;font-weight:bold;margin:0.5rem 0">' + String(name).replace(/</g, '') + '</p>',
      '<p>has successfully <strong>completed</strong> the <strong>' + String(dist).replace(/</g, '') + '</strong>',
      ' of the <strong>BT42.195km Race 2026</strong>, organised under the auspices of the',
      ' <strong>Malawi National Council of Sports</strong>.</p>',
      timeLine,
      '<p>Race day: <strong>27 September 2026</strong> · Blantyre, Malawi</p>',
      '<p style="margin-top:1.5rem;font-size:0.9rem;color:#555">Signatories: Jim Kalua (Chairman, MNCS); Kondwani Chamwala (President, Athletics Malawi);',
      ' Chifundo Tenthani (Chair, Organising Committee).</p>',
      '<p style="font-size:0.85rem;color:#777">A printable certificate is also available from the Organising Committee on request.</p>',
      '<p>— Organising Committee, BT42.195km Race</p>',
      '</div>'
    ].join('');
    const sigsC = loadSigs();
    const phoneC = r.phone || '';
    const certIdC = 'BT42-FIN-' + String(phoneC).replace(/\D/g, '').slice(-8);
    sendAthleteEmail({
      type: 'completion',
      to: to,
      fullName: name,
      distance: dist,
      finishTime: finishTime || '',
      phone: phoneC,
      email: to,
      certId: certIdC,
      issued: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      subject: 'Certificate of Completion — BT42.195km Race 2026',
      raceDate: '27 September 2026',
      signatures: certSignaturesPayload()
    }).then((j) => {
      if (j && j.ok) console.log('Completion certificate emailed to', to);
      else console.warn('Completion certificate email result', j);
    });
  }

  function openCertificate(r, certType) {
    certType = certType || 'participation';
    const isCompletion = certType === 'completion';
    const distance = distanceLabel(r.distance);
    const name = r.fullName || 'Participant';
    const phone = r.phone || '';
    const email = r.email || '';
    const finishes = loadFinishes();
    const key = participantKey(r, 0);
    // Prefer match by phone/name across list
    let fin = {};
    try {
      const rows = JSON.parse(localStorage.getItem('bt42_registrations') || '[]');
      const idx = rows.findIndex(x => (x.fullName || '') === (r.fullName || '') && (x.phone || '') === (r.phone || ''));
      fin = loadFinishes()[participantKey(r, idx >= 0 ? idx : 0)] || {};
    } catch { fin = {}; }
    const finishTime = fin.time || '';
    const certId = (isCompletion ? 'BT42-FIN-' : 'BT42-PART-') + (phone.replace(/\D/g, '').slice(-8) || Date.now().toString(36).toUpperCase());
    const issued = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const sigs = loadSigs();
    const title = isCompletion ? 'CERTIFICATE OF COMPLETION' : 'CERTIFICATE OF PARTICIPATION';
    const bodyText = isCompletion
      ? `has successfully <strong>completed</strong> the <strong>${distance.replace(/</g, '')}</strong> of the BT42.195km Race 2026${finishTime ? ' in a time of <strong>' + finishTime.replace(/</g, '') + '</strong>' : ''}, organised under the auspices of the <strong>Malawi National Council of Sports</strong>.`
      : `is a registered participant in the <strong>${distance.replace(/</g, '')}</strong> of the BT42.195km Race 2026, organised under the auspices of the <strong>Malawi National Council of Sports</strong>.`;

    function sigBlock(dataUrl, personName, personTitle) {
      if (dataUrl) {
        return `<div class="sig">
          <div class="sig-img-wrap"><img src="${dataUrl}" alt="Signature of ${personName}" /></div>
          <div class="sig-line"></div>
          <div class="sig-name">${personName}</div>
          <div class="sig-title">${personTitle}</div>
        </div>`;
      }
      return `<div class="sig">
        <div class="sig-line" style="margin-top:3rem"></div>
        <div class="sig-name">${personName}</div>
        <div class="sig-title">${personTitle}<br><em style="font-size:10px;color:#999">(e-signature pending)</em></div>
      </div>`;
    }

    const origin = (location.origin && location.origin !== 'null' ? location.origin : '');
    const mncsLogo = origin + '/assets/mncs-logo.png';
    const amLogo = origin + '/assets/am-logo.png';

    const w = window.open('', '_blank', 'width=960,height=720');
    if (!w) {
      alert('Please allow pop-ups to view the certificate.');
      return;
    }
    w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title} — ${name.replace(/</g, '')}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; margin: 0; background: #e8e8e8; color: #1a1a1a; }
  .sheet {
    width: 297mm; min-height: 210mm; margin: 10px auto; background: #fff;
    border: 10px solid #1B4F72; padding: 12mm 14mm; position: relative;
  }
  .sheet::before { content: ''; position: absolute; inset: 5px; border: 2px solid #D4AC0D; pointer-events: none; }
  .hdr { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.6rem; }
  .hdr img { width: 72px; height: 72px; object-fit: contain; }
  .hdr-text { text-align: center; flex: 1; }
  .org { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #1B4F72; font-weight: 700; }
  .event { font-size: 20px; margin: 0.2rem 0 0; color: #154360; font-weight: 700; }
  .sub { font-size: 12px; color: #555; }
  h1 { text-align: center; font-size: 26px; letter-spacing: 0.08em; margin: 0.8rem 0 0.3rem; color: #7D6608; }
  .intro { text-align: center; font-size: 14px; margin: 0.35rem 0; }
  .pname-wrap { text-align: center; }
  .pname { text-align: center; font-size: 30px; font-weight: 700; margin: 0.4rem 0; border-bottom: 1px solid #ccc; display: inline-block; padding: 0 1.5rem 0.2rem; }
  .detail { text-align: center; font-size: 14px; margin: 0.6rem auto 0.8rem; max-width: 85%; line-height: 1.45; }
  .sigs { display: flex; justify-content: space-around; gap: 1rem; margin-top: 1rem; text-align: center; }
  .sig { flex: 1; max-width: 230px; }
  .sig-img-wrap { height: 48px; display: flex; align-items: flex-end; justify-content: center; }
  .sig-img-wrap img { max-height: 48px; max-width: 160px; object-fit: contain; background: #fff; }
  .sig-line { border-top: 1px solid #333; margin: 0.25rem 0.5rem 0.3rem; }
  .sig-name { font-weight: 700; font-size: 12px; }
  .sig-title { font-size: 10px; color: #444; line-height: 1.3; }
  .foot { text-align: center; margin-top: 0.8rem; font-size: 10px; color: #666; }
  .actions { text-align: center; margin: 10px; }
  .actions button { padding: 0.55rem 1.1rem; font-size: 14px; cursor: pointer; margin: 0 0.25rem; }
  @media print { body { background: #fff; } .actions { display: none; } .sheet { margin: 0; box-shadow: none; } }
</style>
</head>
<body>
  <div class="actions">
    <button onclick="window.print()">Print / Save PDF</button>
    <button onclick="window.close()">Close</button>
  </div>
  <div class="sheet">
    <div class="hdr">
      <img src="${amLogo}" alt="Athletics Malawi" onerror="this.style.display='none'" />
      <div class="hdr-text">
        <div class="org">Malawi National Council of Sports · Athletics Malawi</div>
        <div class="event">BT42.195km Race 2026</div>
        <div class="sub">Blantyre · Sunday, 27 September 2026</div>
      </div>
      <img src="${mncsLogo}" alt="MNCS" onerror="this.style.display='none'" />
    </div>
    <h1>${title}</h1>
    <p class="intro">This is to certify that</p>
    <div class="pname-wrap"><div class="pname">${name.replace(/</g, '')}</div></div>
    <p class="detail">${bodyText}</p>
    <p class="detail" style="font-size:12px;color:#555">
      Certificate ID: ${certId} · Issued: ${issued}
      ${phone ? ' · Tel: ' + phone.replace(/</g, '') : ''}
      ${email ? ' · ' + email.replace(/</g, '') : ''}
    </p>
    <div class="sigs">
      ${sigBlock(sigs.kalua, 'Jim Kalua', 'Chairman of the Council<br>Malawi National Council of Sports')}
      ${sigBlock(sigs.chamwala, 'Kondwani Chamwala', 'President of Athletics Malawi<br>Athletics Malawi')}
      ${sigBlock(sigs.tenthani, 'Chifundo Tenthani', 'Chair, Organising Committee<br>BT42.195km Race 2026')}
    </div>
    <p class="foot">Official certificate · MNCS · Athletics Malawi · BT42.195km Race 2026
      ${isCompletion ? ' · Completion certificate issued after verified finish' : ' · Participation certificate (DNF)'}</p>
  </div>
</body>
</html>`);
    w.document.close();
  }

  window.BT42OpenCertificate = openCertificate;



  function defaultSiteContent() {
    return {
      heroSub: 'Blantyre · Sunday, 27 September 2026',
      heroDate: '',
      announcement: '',
      feesMarathon: 15000,
      fees10: 10000,
      fees5: 5000,
      bankAccount: '782637',
      footerNote: 'BT42.195km Race · 27 September 2026',
      aboutBlurb: '',
      updatedAt: null,
      updatedBy: null
    };
  }
  function loadSiteContent() {
    try {
      const raw = JSON.parse(localStorage.getItem(SITE_CONTENT_KEY) || 'null');
      return Object.assign(defaultSiteContent(), raw && typeof raw === 'object' ? raw : {});
    } catch (e) {
      return defaultSiteContent();
    }
  }
  function saveSiteContent(obj) {
    localStorage.setItem(SITE_CONTENT_KEY, JSON.stringify(obj));
  }
  function feesLineFrom(c) {
    return 'Marathon ' + Number(c.feesMarathon).toLocaleString('en-MW') +
      ' · 10 km ' + Number(c.fees10).toLocaleString('en-MW') +
      ' · 5 km ' + Number(c.fees5).toLocaleString('en-MW');
  }
  function applySiteContentToPublic(c) {
    c = c || loadSiteContent();
    try {
      document.querySelectorAll('[data-site]').forEach((el) => {
        const key = el.getAttribute('data-site');
        if (key === 'feesLine') el.textContent = feesLineFrom(c);
        else if (key === 'bankAccount') el.textContent = c.bankAccount || '782637';
        else if (key === 'announcement') {
          el.textContent = c.announcement || '';
          el.style.display = c.announcement ? '' : 'none';
        } else if (c[key] != null) {
          el.textContent = c[key];
        }
      });
      // Update in-memory fees for registration form
      if (window.BT42_ENTRY_FEES) {
        window.BT42_ENTRY_FEES['42.195'] = Number(c.feesMarathon) || 15000;
        window.BT42_ENTRY_FEES['10'] = Number(c.fees10) || 10000;
        window.BT42_ENTRY_FEES['5'] = Number(c.fees5) || 5000;
      }
    } catch (e) {}
  }

  function renderSiteContentAdmin() {
    const box = $('#site-content-admin');
    if (!box) return;
    if (!isChair) {
      box.innerHTML = '<p class="form-note">Only the Chair can edit public site content.</p>';
      return;
    }
    const c = loadSiteContent();
    box.innerHTML = `
      <div class="card" style="padding:0.75rem">
        <div class="form-group"><label>Hero location &amp; date (one line)</label>
          <input type="text" id="sc-heroSub" value="${escapeHtml(c.heroSub)}" /></div>
        <div class="form-group"><label>Announcement (shown under hero; leave blank to hide)</label>
          <textarea id="sc-announcement" rows="2">${escapeHtml(c.announcement || '')}</textarea></div>
        <div class="form-row">
          <div class="form-group"><label>Marathon fee (MWK)</label>
            <input type="number" id="sc-feeM" value="${Number(c.feesMarathon) || 15000}" min="0" step="500" /></div>
          <div class="form-group"><label>10 km fee (MWK)</label>
            <input type="number" id="sc-fee10" value="${Number(c.fees10) || 10000}" min="0" step="500" /></div>
          <div class="form-group"><label>5 km fee (MWK)</label>
            <input type="number" id="sc-fee5" value="${Number(c.fees5) || 5000}" min="0" step="500" /></div>
        </div>
        <div class="form-group"><label>National Bank of Malawi account number</label>
          <input type="text" id="sc-bank" value="${escapeHtml(c.bankAccount || '782637')}" /></div>
        <div class="form-group"><label>Footer note</label>
          <input type="text" id="sc-footer" value="${escapeHtml(c.footerNote)}" /></div>
        <button type="button" class="btn btn-primary" id="sc-save">Save &amp; publish to site</button>
        <p class="form-note" id="sc-status" style="margin-top:0.5rem"></p>
      </div>`;
    const saveBtn = $('#sc-save');
    if (saveBtn) saveBtn.onclick = () => {
      const next = Object.assign(loadSiteContent(), {
        heroSub: (($('#sc-heroSub') || {}).value || '').trim(),
        heroDate: '',
        announcement: (($('#sc-announcement') || {}).value || '').trim(),
        feesMarathon: Number((($('#sc-feeM') || {}).value) || 15000),
        fees10: Number((($('#sc-fee10') || {}).value) || 10000),
        fees5: Number((($('#sc-fee5') || {}).value) || 5000),
        bankAccount: (($('#sc-bank') || {}).value || '782637').trim(),
        footerNote: (($('#sc-footer') || {}).value || '').trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser || 'chair'
      });
      saveSiteContent(next);
      applySiteContentToPublic(next);
      if (getSyncToken()) {
        livePush({ siteContent: next }).then(() => {
          const st = $('#sc-status');
          if (st) st.textContent = 'Saved and synced. Public pages will show the new content.';
        }).catch(() => {
          const st = $('#sc-status');
          if (st) st.textContent = 'Saved on this device. Sync failed — check connection.';
        });
      } else {
        const st = $('#sc-status');
        if (st) st.textContent = 'Saved on this device.';
      }
    };
  }


  function renderStaffAdmin() {
    const box = $('#staff-admin');
    if (!box) return;
    if (!canManageStaff()) {
      box.innerHTML = '<p class="form-note">Only the Chair can manage staff logins.</p>';
      return;
    }
    const list = loadStaffUsers();
    let rows = list.map((u, i) => {
      const flags = [
        u.canPayment ? 'Payment' : '',
        u.canBibs ? 'Bibs' : '',
        u.canFinish ? 'Finish' : '',
        u.canVolunteers ? 'Volunteers + certificates' : '',
        u.canRequisitions ? 'GS requisitions' : ''
      ].filter(Boolean).join(', ') || 'View only';
      const toggles = [
        ['canPayment', 'Pay', !!u.canPayment],
        ['canBibs', 'Bibs', !!u.canBibs],
        ['canFinish', 'Finish', !!u.canFinish],
        ['canVolunteers', 'Volunteers', !!u.canVolunteers],
        ['canRequisitions', 'GS / requisitions', !!u.canRequisitions]
      ].map((x) => '<label style="margin-right:8px;white-space:nowrap"><input type="checkbox" class="staff-perm" data-i="' + i + '" data-perm="' + x[0] + '"' + (x[2] ? ' checked' : '') + ' /> ' + x[1] + '</label>').join('');
      return '<tr><td>' + escapeHtml(u.username) + '</td><td>' + escapeHtml(u.displayName || '') + '</td><td>' +
        toggles + '<div class="form-note">' + escapeHtml(flags) + '</div></td><td>' + (u.disabled ? 'Disabled' : 'Active') +
        '</td><td><button type="button" class="btn-mini staff-disable" data-i="' + i + '">' +
        (u.disabled ? 'Enable' : 'Disable') + '</button> ' +
        '<button type="button" class="btn-mini staff-reset" data-i="' + i + '">Reset password</button> ' +
        '<button type="button" class="btn-mini staff-delete" data-i="' + i + '" style="color:#C0392B">Delete</button></td></tr>';
    }).join('');
    if (!rows) rows = '<tr><td colspan="5">No staff accounts yet — create one below and share username/password.</td></tr>';
    box.innerHTML = `
      <div class="card" style="margin-bottom:1rem;padding:0.75rem">
        <h4 style="margin-top:0">Create staff login</h4>
        <p class="form-note">Tick every task this person may do. Volunteers Coordinator must have <strong>Volunteers</strong> ticked so they can select crew and issue e-certificates. Chair always has every permission.</p>
        <div class="form-row">
          <div class="form-group"><label>Username *</label><input type="text" id="staff-new-user" placeholder="e.g. grace.pay" /></div>
          <div class="form-group"><label>Display name</label><input type="text" id="staff-new-name" placeholder="e.g. Grace" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Password *</label><input type="text" id="staff-new-pass" placeholder="Share once, then they can ask for reset" /></div>
        </div>
        <label style="display:block;margin:0.35rem 0"><input type="checkbox" id="staff-can-pay" checked /> Can verify / reject payments</label>
        <label style="display:block;margin:0.35rem 0"><input type="checkbox" id="staff-can-bibs" checked /> Can assign bibs</label>
        <label style="display:block;margin:0.35rem 0"><input type="checkbox" id="staff-can-finish" checked /> Can enter Finish / DNF</label>
        <label style="display:block;margin:0.35rem 0"><input type="checkbox" id="staff-can-volunteers" checked /> Volunteers: select crew and issue / email certificates</label>
        <label style="display:block;margin:0.35rem 0"><input type="checkbox" id="staff-can-req" /> GS: upload requisitions for Chair approval</label>
        <button type="button" class="btn btn-primary" id="staff-create-btn">Create login</button>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Username</th><th>Name</th><th>Permissions</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="form-note" style="margin-top:0.75rem">Built-in: username <code>chair</code> / password <code>bt42chair</code> (full access). View-only: <code>committee</code> / <code>bt42oc</code>.</p>`;
    const createBtn = $('#staff-create-btn');
    if (createBtn) createBtn.onclick = async () => {
      const username = (($('#staff-new-user') || {}).value || '').trim().toLowerCase();
      const displayName = (($('#staff-new-name') || {}).value || '').trim();
      const password = (($('#staff-new-pass') || {}).value || '').trim();
      if (!username || username.length < 2) { alert('Username required'); return; }
      if (!password || password.length < 4) { alert('Password at least 4 characters'); return; }
      if (username === 'chair' || username === 'committee') {
        alert('That username is reserved');
        return;
      }
      const list = loadStaffUsers();
      if (list.some((u) => u.username === username)) {
        alert('Username already exists');
        return;
      }
      const passwordHash = await sha256(password);
      list.push({
        username,
        displayName,
        passwordHash,
        role: 'ops',
        canPayment: !!($('#staff-can-pay') || {}).checked,
        canBibs: !!($('#staff-can-bibs') || {}).checked,
        canFinish: !!($('#staff-can-finish') || {}).checked,
        canVolunteers: !!($('#staff-can-volunteers') || {}).checked,
        canRequisitions: !!($('#staff-can-req') || {}).checked,
        disabled: false,
        createdAt: new Date().toISOString()
      });
      saveStaffUsers(list);
      if (getSyncToken()) livePush({ staffUsers: list }).catch(() => {});
      alert('Created login for "' + username + '". Share username and password with them securely.');
      renderStaffAdmin();
    };
    box.querySelectorAll('.staff-perm').forEach((cb) => {
      cb.onchange = () => {
        const list = loadStaffUsers();
        const i = Number(cb.dataset.i);
        const perm = cb.dataset.perm;
        if (!list[i] || !perm) return;
        list[i][perm] = !!cb.checked;
        saveStaffUsers(list);
        if (getSyncToken()) livePush({ staffUsers: list }).catch(() => {});
        renderStaffAdmin();
      };
    });
    box.querySelectorAll('.staff-disable').forEach((btn) => {
      btn.onclick = () => {
        const list = loadStaffUsers();
        const i = Number(btn.dataset.i);
        if (!list[i]) return;
        list[i].disabled = !list[i].disabled;
        saveStaffUsers(list);
        if (getSyncToken()) livePush({ staffUsers: list }).catch(() => {});
        renderStaffAdmin();
      };
    });
    box.querySelectorAll('.staff-delete').forEach((btn) => {
      btn.onclick = () => {
        if (!confirm('Delete this login?')) return;
        const list = loadStaffUsers();
        list.splice(Number(btn.dataset.i), 1);
        saveStaffUsers(list);
        if (getSyncToken()) livePush({ staffUsers: list }).catch(() => {});
        renderStaffAdmin();
      };
    });
    box.querySelectorAll('.staff-reset').forEach((btn) => {
      btn.onclick = async () => {
        const list = loadStaffUsers();
        const i = Number(btn.dataset.i);
        if (!list[i]) return;
        const p = prompt('New password for ' + list[i].username + ':', '');
        if (!p || p.length < 4) return;
        list[i].passwordHash = await sha256(p);
        saveStaffUsers(list);
        if (getSyncToken()) livePush({ staffUsers: list }).catch(() => {});
        alert('Password updated. Share the new password with them.');
        renderStaffAdmin();
      };
    });
  }

  function renderDeadlines() {
    const container = $('#ctrl-deadlines');
    if (!container) return;
    const map = loadDeadlineStatuses();
    const today = new Date(new Date().toDateString());
    let html = '';
    (window.BT42_DATA.deadlines || []).forEach(d => {
      const st = map[d.id] || 'todo';
      const when = new Date(d.when + 'T12:00:00');
      const overdue = st !== 'done' && when < today;
      html += `
        <div class="ctrl-task ${st}${overdue ? ' blocked' : ''}${d.critical ? ' critical-dl' : ''}" data-id="${d.id}">
          <button class="status-btn deadline-btn" data-id="${d.id}" title="Mark deadline status">${statusIcon(st)}</button>
          <div class="task-body">
            <div class="task-title">${d.critical ? '🔴 ' : ''}${d.title}</div>
            <div class="task-meta">${formatDate(d.when)}${overdue ? ' · OVERDUE' : ''} — ${d.detail}</div>
          </div>
        </div>`;
    });
    container.innerHTML = html;
    container.querySelectorAll('.deadline-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const map = loadDeadlineStatuses();
        const order = ['todo', 'doing', 'done', 'blocked'];
        const current = map[btn.dataset.id] || 'todo';
        map[btn.dataset.id] = order[(order.indexOf(current) + 1) % order.length];
        saveDeadlineStatuses(map);
        renderDeadlines();
        renderDashboard();
      });
    });
  }

  function renderChairNotes() {
    const container = $('#ctrl-chair-notes');
    if (!container) return;
    const edits = (() => { try { return JSON.parse(localStorage.getItem(CHAIR_NOTES_KEY) || '{}'); } catch { return {}; } })();
    let html = '<p class="form-note" style="margin-bottom:1rem">Prepared for you as Chair. Add your own notes per meeting — saved on this device only.</p>';
    (window.BT42_DATA.chairMeetingNotes || []).forEach(n => {
      const extra = edits[n.meetingId] || '';
      html += `
        <details class="ctrl-meeting">
          <summary>
            <span class="m-num">M${n.meetingId}</span>
            <span class="m-date">${formatDate(n.date)}</span>
            <span class="m-focus">${n.title}</span>
          </summary>
          <div class="m-body">
            <p><strong>Chair talking points</strong></p>
            <ul>${n.notes.map(x => `<li>${x}</li>`).join('')}</ul>
            <p><strong>Decisions needed</strong></p>
            <ul>${n.decisionsNeeded.map(x => `<li>${x}</li>`).join('')}</ul>
            <label style="display:block;margin-top:0.75rem;font-weight:600;font-size:0.85rem">Your notes for this meeting</label>
            <textarea class="chair-note-edit" data-mid="${n.meetingId}" rows="3" style="width:100%;margin-top:0.35rem;padding:0.6rem;border:1px solid var(--border);border-radius:8px;font-family:inherit">${escapeHtml(extra)}</textarea>
          </div>
        </details>`;
    });
    container.innerHTML = html;
    container.querySelectorAll('.chair-note-edit').forEach(ta => {
      ta.addEventListener('input', () => {
        const edits = (() => { try { return JSON.parse(localStorage.getItem(CHAIR_NOTES_KEY) || '{}'); } catch { return {}; } })();
        edits[ta.dataset.mid] = ta.value;
        localStorage.setItem(CHAIR_NOTES_KEY, JSON.stringify(edits));
      });
    });
  }

  function loadVolunteers() {
    try {
      const list = JSON.parse(localStorage.getItem(VOL_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }
  function saveVolunteers(list) {
    localStorage.setItem(VOL_KEY, JSON.stringify(list || []));
  }
  async function syncVolunteers(list) {
    saveVolunteers(list);
    if (!getSyncToken()) {
      console.warn('No sync token — volunteer list is only on this device');
      return { ok: false, error: 'No sync token' };
    }
    try {
      const r = await livePush({ volunteers: list, replaceVolunteers: true });
      if (!r || !r.ok) {
        console.warn('Volunteer sync failed', r && r.error);
        return r || { ok: false };
      }
      if (r.state && Array.isArray(r.state.volunteers)) {
        try { localStorage.setItem(VOL_KEY, JSON.stringify(r.state.volunteers)); } catch (e) {}
      }
      return r;
    } catch (e) {
      console.warn('Volunteer sync error', e);
      return { ok: false, error: String(e) };
    }
  }
  function volunteerId() {
    return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function parseVolunteerCsv(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const split = (line) => {
      const out = [];
      let cur = '';
      let q = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { q = !q; continue; }
        if ((c === ',' || c === ';' || c === '\t') && !q) { out.push(cur.trim()); cur = ''; continue; }
        cur += c;
      }
      out.push(cur.trim());
      return out;
    };
    const header = split(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''));
    const idx = (names) => {
      for (const n of names) {
        const i = header.indexOf(n);
        if (i >= 0) return i;
      }
      return -1;
    };
    const iName = idx(['fullname', 'name', 'volunteer', 'volunteername']);
    const iEmail = idx(['email', 'e-mail', 'mail']);
    const iPhone = idx(['phone', 'mobile', 'tel', 'cellphone']);
    const iRole = idx(['role', 'area', 'duty', 'station']);
    const iStatus = idx(['status', 'selected', 'state']);
    const start = (iName >= 0 || iEmail >= 0) ? 1 : 0;
    const rows = [];
    for (let r = start; r < lines.length; r++) {
      const cols = split(lines[r]);
      const fullName = (iName >= 0 ? cols[iName] : cols[0] || '').trim();
      const email = (iEmail >= 0 ? cols[iEmail] : cols[1] || '').trim();
      if (!fullName) continue;
      let status = (iStatus >= 0 ? cols[iStatus] : 'selected') || 'selected';
      status = String(status).toLowerCase();
      if (status === 'yes' || status === 'true' || status === '1') status = 'selected';
      if (!['applied', 'selected', 'served', 'declined'].includes(status)) status = 'selected';
      rows.push({
        id: volunteerId() + r,
        fullName,
        email,
        phone: (iPhone >= 0 ? cols[iPhone] : cols[2] || '').trim(),
        role: (iRole >= 0 ? cols[iRole] : cols[3] || '').trim() || 'Race volunteer',
        status,
        certIssued: false,
        createdAt: new Date().toISOString()
      });
    }
    return rows;
  }
  function openVolunteerCertificate(v) {
    const name = String(v.fullName || '').trim() || 'Volunteer';
    const role = String(v.role || 'Race volunteer').trim();
    const sigs = loadSigs();
    const sigCell = (src, label, sub) => {
      const img = (src && src.indexOf('data:image') === 0)
        ? '<img src="' + src + '" alt="" style="height:48px;max-width:180px;object-fit:contain;display:block;margin:0 auto 6px" />'
        : '<div style="height:48px"></div>';
      return '<div style="text-align:center;min-width:180px">' + img +
        '<div style="border-top:1px solid #1B4F72;padding-top:6px;font-size:12px"><strong>' + label + '</strong><br>' + sub + '</div></div>';
    };
    const w = window.open('', '_blank', 'width=900,height=650');
    if (!w) { alert('Allow pop-ups to view the certificate.'); return; }
    w.document.write(`<!DOCTYPE html><html><head><title>Volunteer certificate — ${name.replace(/[<>]/g,'')}</title>
<style>
@page { size: A4 landscape; margin: 12mm; }
body { font-family: Georgia, serif; margin:0; background:#f4f7fb; color:#1B4F72; }
.sheet { background:#fff; margin:12px auto; width:min(920px,96vw); min-height:540px; padding:32px 40px; box-sizing:border-box; border:8px solid #1B4F72; }
h1 { margin:0; font-size:26px; letter-spacing:.04em; }
h2 { margin:8px 0 0; font-size:15px; color:#2980b9; }
.who { font-size:30px; margin:22px 0 8px; }
.sig { display:flex; justify-content:space-between; gap:12px; margin-top:40px; }
</style></head><body>
<div class="sheet">
  <h1>CERTIFICATE OF VOLUNTEER SERVICE</h1>
  <h2>BT42.195km Race 2026 · Blantyre · 27 September 2026</h2>
  <p>This certifies that</p>
  <div class="who">${name.replace(/[<>]/g,'')}</div>
  <p>served as <strong>${role.replace(/[<>]/g,'')}</strong></p>
  <div class="sig">
    ${sigCell(sigs.kalua, 'Jim Kalua', 'Chairman, MNCS')}
    ${sigCell(sigs.chamwala, 'Kondwani Chamwala', 'President, Athletics Malawi')}
    ${sigCell(sigs.tenthani, 'Chifundo Tenthani', 'Chair, OC')}
  </div>
</div>
<script>setTimeout(function(){ window.print(); }, 400);<\/script>
</body></html>`);
w.document.close();
  }
  function renderVolunteersAdmin() {
    const box = $('#ctrl-volunteers');
    if (!box) return;
    const list = loadVolunteers();
    const canEdit = canVolunteers();
    const rows = list.map((v, i) => {
      const st = String(v.status || 'applied');
      const cert = v.certIssued
        ? ('Issued ' + String(v.issuedAt || '').slice(0, 10) + (v.issuedBy ? ' by ' + v.issuedBy : ''))
        : '—';
      const actions = canEdit ? (
        '<button type="button" class="btn-mini vol-select" data-i="' + i + '">' + (st === 'selected' || st === 'served' ? 'Selected' : 'Select') + '</button> ' +
        '<button type="button" class="btn-mini vol-decline" data-i="' + i + '">Decline</button> ' +
        '<button type="button" class="btn-mini vol-cert" data-i="' + i + '"' + (st === 'selected' || st === 'served' ? '' : ' disabled title="Select first"') + '>Issue certificate</button> ' +
        '<button type="button" class="btn-mini vol-del" data-i="' + i + '" style="color:#C0392B">Remove</button>'
      ) : (st + (v.certIssued ? ' · certificate issued' : ''));
      return '<tr><td>' + escapeHtml(v.fullName || '') + '</td><td>' + escapeHtml(v.email || '') +
        '</td><td>' + escapeHtml(v.phone || '') + '</td><td>' + escapeHtml(v.role || '') +
        '</td><td>' + escapeHtml(st) + '</td><td>' + escapeHtml(cert) +
        '</td><td>' + escapeHtml(String(v.createdAt || '').slice(0, 10)) + '</td><td>' + actions + '</td></tr>';
    }).join('') || '<tr><td colspan="7">No volunteers on this list yet. Add names from the Google Form.</td></tr>';
    box.innerHTML = (canEdit ? `
      <div class="card" style="padding:0.75rem;margin-bottom:1rem">
        <h4 style="margin-top:0">Add volunteer from the form</h4>
        <div class="form-row">
          <div class="form-group"><label>Full name *</label><input id="vol-name" type="text" /></div>
          <div class="form-group"><label>Email *</label><input id="vol-email" type="email" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Phone</label><input id="vol-phone" type="tel" /></div>
          <div class="form-group"><label>Role / area</label><input id="vol-role" type="text" placeholder="Water kiosk, marshal…" /></div>
        </div>
        <button type="button" class="btn btn-primary" id="vol-add">Add to list</button>
        <div style="margin-top:1rem;padding-top:0.75rem;border-top:1px solid #e6eef4">
          <h4 style="margin:0 0 0.35rem">Upload selected list</h4>
          <p class="form-note">CSV with headers: <code>fullName,email,phone,role,status</code>. Status may be applied, selected or served. One volunteer per row.</p>
          <input type="file" id="vol-csv" accept=".csv,text/csv,text/plain" />
          <button type="button" class="btn-mini" id="vol-mark-selected">Mark all listed as Selected</button>
        </div>
      </div>` : '<p class="form-note">View only. Chair or Volunteers Coordinator can select and issue certificates.</p>') +
      '<p class="form-note"><button type="button" class="btn-mini" id="vol-refresh">Refresh shared list</button> Volunteer records sync to every signed-in gadget.</p>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Certificate</th><th>Added</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div>';
    const refresh = $('#vol-refresh');
    if (refresh) refresh.onclick = async () => {
      refresh.disabled = true;
      await pullSharedState().catch(() => {});
      renderVolunteersAdmin();
    };
    const add = $('#vol-add');
    if (add) add.onclick = () => {
      if (!canVolunteers()) return;
      const fullName = (($('#vol-name') || {}).value || '').trim();
      const email = (($('#vol-email') || {}).value || '').trim();
      if (!fullName || !email) { alert('Name and email required (certificate + send).'); return; }
      const next = loadVolunteers();
      next.push({
        id: volunteerId(),
        fullName,
        email,
        phone: (($('#vol-phone') || {}).value || '').trim(),
        role: (($('#vol-role') || {}).value || '').trim() || 'Race volunteer',
        status: 'applied',
        certIssued: false,
        createdAt: new Date().toISOString()
      });
      saveVolunteers(next);
      syncVolunteers(next);
      renderVolunteersAdmin();
    };
    const csvInput = $('#vol-csv');
    if (csvInput) csvInput.onchange = () => {
      const file = csvInput.files && csvInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const incoming = parseVolunteerCsv(reader.result);
        if (!incoming.length) {
          alert('No rows found. Use headers fullName,email,phone,role,status');
          return;
        }
        const next = loadVolunteers();
        const keyOf = (v) => String(v.email || v.fullName || '').trim().toLowerCase();
        const map = new Map();
        next.forEach((v) => map.set(keyOf(v), v));
        incoming.forEach((v) => {
          const k = keyOf(v);
          const cur = map.get(k);
          map.set(k, Object.assign({}, cur || {}, v, { id: (cur && cur.id) || v.id }));
        });
        const merged = Array.from(map.values());
        saveVolunteers(merged);
        syncVolunteers(merged);
        alert('Loaded ' + incoming.length + ' volunteers from the file. They are on the shared list.');
        renderVolunteersAdmin();
      };
      reader.readAsText(file);
    };
    const markAll = $('#vol-mark-selected');
    if (markAll) markAll.onclick = () => {
      const next = loadVolunteers().map((v) => {
        if (v.status === 'declined') return v;
        return Object.assign({}, v, { status: v.status === 'served' ? 'served' : 'selected' });
      });
      saveVolunteers(next);
      syncVolunteers(next);
      renderVolunteersAdmin();
    };
    box.querySelectorAll('.vol-select').forEach((btn) => {
      btn.onclick = () => {
        if (!canVolunteers()) return;
        const next = loadVolunteers();
        const i = Number(btn.dataset.i);
        if (!next[i]) return;
        next[i].status = 'selected';
        saveVolunteers(next);
        syncVolunteers(next);
        renderVolunteersAdmin();
      };
    });
    box.querySelectorAll('.vol-decline').forEach((btn) => {
      btn.onclick = () => {
        if (!canVolunteers()) return;
        const next = loadVolunteers();
        const i = Number(btn.dataset.i);
        if (!next[i]) return;
        next[i].status = 'declined';
        saveVolunteers(next);
        syncVolunteers(next);
        renderVolunteersAdmin();
      };
    });
    box.querySelectorAll('.vol-cert').forEach((btn) => {
      btn.onclick = async () => {
        if (!canVolunteers()) return;
        const next = loadVolunteers();
        const i = Number(btn.dataset.i);
        const v = next[i];
        if (!v) return;
        if (v.status !== 'selected' && v.status !== 'served') {
          alert('Mark as Selected before issuing a certificate.');
          return;
        }
        const to = String(v.email || '').trim();
        if (!to || to.indexOf('@') < 0) {
          alert('Add a valid email before issuing. The certificate is emailed to the volunteer.');
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Sending…';
        let mailed = false;
        let mailErr = '';
        try {
          const sigs = await signaturesForEmail();
          const pdfBase64 = buildClientCertificatePdf({
            volunteer: true,
            fullName: v.fullName,
            distance: v.role || 'Race volunteer',
            role: v.role || 'Race volunteer',
            signatures: sigs
          });
          const j = await sendAthleteEmail({
            type: 'volunteer',
            to: to,
            email: to,
            fullName: v.fullName,
            role: v.role || 'Race volunteer',
            distance: v.role || 'Race volunteer',
            phone: v.phone || '',
            subject: 'Certificate of Volunteer Service — BT42.195km Race 2026',
            raceDate: '27 September 2026',
            certId: 'BT42-VOL-' + String(v.id || '').slice(-8),
            issued: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
            signatures: sigs,
            pdfBase64: pdfBase64
          });
          mailed = !!(j && j.ok);
          mailErr = (j && (j.error || j.detail && j.detail.message)) || '';
        } catch (e) {
          mailErr = String(e);
        }
        v.status = 'served';
        v.certIssued = mailed;
        v.issuedAt = new Date().toISOString();
        v.issuedBy = currentUser || 'coordinator';
        v.emailResult = mailed ? 'sent' : ('failed: ' + mailErr);
        saveVolunteers(next);
        await syncVolunteers(next);
        openVolunteerCertificate(v);
        if (mailed) alert('Certificate emailed to ' + to);
        else alert('Print window opened, but email failed: ' + (mailErr || 'unknown') + '. Check EMAIL_API_KEY / RESEND_API_KEY on Netlify.');
        renderVolunteersAdmin();
      };
    });
    box.querySelectorAll('.vol-del').forEach((btn) => {
      btn.onclick = async () => {
        if (!canVolunteers()) return;
        if (!confirm('Remove this volunteer from the shared list?')) return;
        const next = loadVolunteers();
        next.splice(Number(btn.dataset.i), 1);
        saveVolunteers(next);
        const r = await syncVolunteers(next);
        if (r && r.ok === false) alert('Removed on this phone, but shared list failed: ' + (r.error || 'sync'));
        renderVolunteersAdmin();
      };
    });
  }

  function mk(n) {
    const v = Number(n) || 0;
    return 'MK' + v.toLocaleString('en-MW');
  }
  function loadApprovals() {
    try {
      const raw = JSON.parse(localStorage.getItem(APPROVALS_KEY) || 'null');
      if (Array.isArray(raw) && raw.length) return raw;
    } catch (e) {}
    return APPROVALS_SEED.slice();
  }
  function saveApprovals(list, opts) {
    localStorage.setItem(APPROVALS_KEY, JSON.stringify(list || []));
    if (!getSyncToken()) return;
    if (isChair) livePush({ approvals: list }).catch(() => {});
    else if (opts && opts.added) livePush({ newApprovals: opts.added }).catch(() => {});
  }
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      if (file.size > 2.5 * 1024 * 1024) return reject(new Error('File must be under 2.5 MB'));
      const r = new FileReader();
      r.onerror = () => reject(new Error('Could not read file'));
      r.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', data: r.result });
      r.readAsDataURL(file);
    });
  }
  function renderApprovals() {
    const box = $('#ctrl-approvals');
    if (!box || !canRequisitions()) return;
    const rows = loadApprovals();
    const approved = rows.filter((r) => r.status === 'approved');
    const pending = rows.filter((r) => r.status !== 'approved');
    const sum = (list) => list.reduce((a, r) => a + Number(r.amount || 0) + Number(r.vat || 0), 0);
    const line = (r, i) => {
      const total = Number(r.amount || 0) + Number(r.vat || 0);
      const st = r.status === 'approved' ? 'pay-ok' : (r.status === 'rejected' ? 'pay-no' : 'pay-wait');
      const fileLink = (r.fileData && r.fileName)
        ? '<a href="' + r.fileData + '" download="' + escapeHtml(r.fileName) + '">' + escapeHtml(r.fileName) + '</a>'
        : '—';
      const actions = isChair
        ? ('<button type="button" class="btn-mini ap-toggle" data-i="' + i + '">' + (r.status === 'approved' ? 'Mark pending' : 'Approve') + '</button> ' +
           (r.status === 'pending' ? '<button type="button" class="btn-mini ap-reject" data-i="' + i + '">Reject</button> ' : '') +
           '<button type="button" class="btn-mini ap-del" data-i="' + i + '" style="color:#C0392B">Remove</button>')
        : '<span class="form-note">Waiting on Chair</span>';
      return '<tr>' +
        '<td>' + escapeHtml(r.approvedOn || r.requested || '') + '</td>' +
        '<td><strong>' + escapeHtml(r.payee || '') + '</strong><br><span class="form-note">' + escapeHtml(r.items || '') + '</span><br>' + fileLink + '</td>' +
        '<td>' + escapeHtml([r.bank, r.account].filter(Boolean).join(' · ') || '—') + '</td>' +
        '<td>' + mk(r.amount) + (r.vat ? '<br><span class="form-note">VAT ' + mk(r.vat) + '</span>' : '') + '</td>' +
        '<td><strong>' + mk(total) + '</strong></td>' +
        '<td><span class="pay-status ' + st + '">' + escapeHtml(r.status || '') + '</span></td>' +
        '<td>' + escapeHtml(r.comment || r.requestedBy || '') + '</td>' +
        '<td>' + actions + '</td></tr>';
    };
    box.innerHTML =
      '<div class="notice"><strong>' + approved.length + '</strong> approved · <strong>' + pending.length + '</strong> pending · ' +
      'Approved total <strong>' + mk(sum(approved)) + '</strong> · All listed <strong>' + mk(sum(rows)) + '</strong></div>' +
      '<div class="table-wrap"><table class="ctrl-table"><thead><tr>' +
      '<th>Date</th><th>Payee / file</th><th>Bank</th><th>Amount</th><th>Total</th><th>Status</th><th>Note</th><th></th>' +
      '</tr></thead><tbody>' + rows.map(line).join('') + '</tbody></table></div>' +
      '<h4 style="margin:1.2rem 0 0.4rem">' + (isChair ? 'Add or capture an approval' : 'Submit a requisition for Chair approval') + '</h4>' +
      '<div class="form-row"><div class="form-group"><label>Payee</label><input id="ap-payee" /></div>' +
      '<div class="form-group"><label>Amount MK</label><input id="ap-amount" type="number" min="0" step="1" /></div></div>' +
      '<div class="form-row"><div class="form-group"><label>Items</label><input id="ap-items" /></div>' +
      '<div class="form-group"><label>Bank / account</label><input id="ap-bank" placeholder="Bank · account number" /></div></div>' +
      '<div class="form-row"><div class="form-group"><label>VAT MK</label><input id="ap-vat" type="number" min="0" value="0" /></div>' +
      '<div class="form-group"><label>Requisition file (pdf/doc/jpg, under 2.5 MB)</label><input id="ap-file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx" /></div></div>' +
      (isChair ? '<div class="form-group"><label>Note</label><input id="ap-note" value="Approved by Chair — Chifundo Tenthani" /></div>' : '') +
      '<button type="button" class="btn btn-primary" id="ap-add">' + (isChair ? 'Save as approved' : 'Send to Chair') + '</button>';
    const add = $('#ap-add');
    if (add) add.onclick = async () => {
      const payee = (($('#ap-payee') || {}).value || '').trim();
      const amount = Number((($('#ap-amount') || {}).value) || 0);
      if (!payee || !amount) { alert('Payee and amount required.'); return; }
      let fileMeta = null;
      try {
        const inp = $('#ap-file');
        fileMeta = await fileToDataUrl(inp && inp.files && inp.files[0]);
      } catch (e) {
        alert(e.message || e);
        return;
      }
      const bankLine = (($('#ap-bank') || {}).value || '').trim();
      const parts = bankLine.split('·').map((s) => s.trim());
      const rec = {
        id: 'ap-' + Date.now().toString(36),
        requested: new Date().toISOString().slice(0, 10),
        approvedOn: isChair ? new Date().toISOString().slice(0, 10) : '',
        requestedBy: currentUser || (isChair ? 'Chair entry' : 'GS'),
        payee,
        bank: parts[0] || bankLine,
        account: parts[1] || '',
        items: (($('#ap-items') || {}).value || '').trim(),
        amount,
        vat: Number((($('#ap-vat') || {}).value) || 0),
        mode: 'Cash',
        status: isChair ? 'approved' : 'pending',
        comment: isChair ? ((($('#ap-note') || {}).value || '').trim()) : 'Submitted for Chair approval',
        ref: isChair ? 'Chair capture' : 'GS upload',
        fileName: fileMeta && fileMeta.name || '',
        fileType: fileMeta && fileMeta.type || '',
        fileData: fileMeta && fileMeta.data || ''
      };
      const next = loadApprovals();
      next.unshift(rec);
      saveApprovals(next, { added: [rec] });
      renderApprovals();
      alert(isChair ? 'Saved as approved.' : 'Sent to the Chair. Status: pending.');
    };
    box.querySelectorAll('.ap-toggle').forEach((btn) => {
      btn.onclick = () => {
        if (!isChair) return;
        const next = loadApprovals();
        const r = next[Number(btn.dataset.i)];
        if (!r) return;
        if (r.status === 'approved') {
          r.status = 'pending';
          r.approvedOn = '';
        } else {
          r.status = 'approved';
          r.approvedOn = new Date().toISOString().slice(0, 10);
          r.comment = 'Approved by Chair — Chifundo Tenthani';
        }
        saveApprovals(next);
        renderApprovals();
      };
    });
    box.querySelectorAll('.ap-reject').forEach((btn) => {
      btn.onclick = () => {
        if (!isChair) return;
        const next = loadApprovals();
        const r = next[Number(btn.dataset.i)];
        if (!r) return;
        r.status = 'rejected';
        r.comment = 'Rejected by Chair';
        saveApprovals(next);
        renderApprovals();
      };
    });
    box.querySelectorAll('.ap-del').forEach((btn) => {
      btn.onclick = () => {
        if (!isChair) return;
        if (!confirm('Remove this requisition from the Chair list?')) return;
        const next = loadApprovals();
        next.splice(Number(btn.dataset.i), 1);
        saveApprovals(next);
        renderApprovals();
      };
    });
  }

  const SURVEY_PREVIEW = {
    Participants: [
      'Which race did you take part in?',
      'How easy was online registration and payment?',
      'How clear was pre-race information?',
      'How was bib collection and the start area?',
      'How well was the course marked and marshalled?',
      'How adequate were water stations?',
      'Medical and safety support',
      'Finish, results and medals/certificates',
      'Would you enter again?',
      'What should we improve next year?'
    ],
    Volunteers: [
      'Main duty',
      'Briefing before race day',
      'Kit and supplies at post',
      'Morning coordination',
      'Safety at your post',
      'Length of shift',
      'Committee support',
      'Would you volunteer again?',
      'Overall volunteer experience',
      'What should change for volunteers?'
    ],
    Committee: [
      'Main OC role',
      'Planning meetings',
      'Website / Control Room',
      'Money and approvals',
      'Race-morning command',
      'Partners (MNCS / AM)',
      'Handling problems on the day',
      'Serve on the OC again?',
      'Overall committee experience',
      'Priority fix next edition'
    ],
    Media: [
      'Outlet type',
      'Accreditation / access',
      'Information pack',
      'Start / finish / course access',
      'OC spokespersons',
      'Facilities',
      'Results and name spellings',
      'Cover the race again?',
      'Overall media experience',
      'What would help coverage?'
    ],
    Public: [
      'How did you follow the race?',
      'How did you hear about it?',
      'Atmosphere on the route',
      'Road closures and diversions',
      'Welcome for spectators',
      'Where-to-watch information',
      'Impact on movement in Blantyre',
      'Recommend watching?',
      'Overall public impression',
      'One thing to do differently'
    ]
  };

  function parseRaceTime(t) {
    const s = String(t || '').trim();
    const p = s.split(':').map(Number);
    if (p.some((n) => isNaN(n))) return 9e15;
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    if (p.length === 2) return p[0] * 60 + p[1];
    return 9e15;
  }

  function buildResultRows() {
    let regs = [];
    try { regs = JSON.parse(localStorage.getItem('bt42_registrations') || '[]'); } catch { regs = []; }
    const fins = loadFinishes();
    const bibs = loadBibs();
    return regs.map((r, i) => {
      const k = participantKey(r, i);
      const fin = fins[k] || {};
      return {
        name: r.fullName || '',
        distance: normalizeDistanceCode(r.distance),
        bib: (bibs[k] && bibs[k].number) || '',
        status: fin.status || 'on_course',
        time: fin.time || '',
        sort: fin.status === 'finished' ? parseRaceTime(fin.time) : (fin.status === 'dnf' ? 8e15 : 9e15)
      };
    });
  }

  function renderLiveResults() {
    const box = $('#ctrl-live-results');
    if (!box) return;
    const rows = buildResultRows();
    const groups = [
      { id: '42.195', title: '42.195 km Marathon' },
      { id: '10', title: '10 km' },
      { id: '5', title: '5 km Fun Run' }
    ];
    let html = '<p class="form-note">Board refreshes when you mark Finish. Public view updates from the shared list.</p>';
    groups.forEach((g) => {
      const list = rows.filter((r) => r.distance === g.id).sort((a, b) => a.sort - b.sort);
      const fin = list.filter((r) => r.status === 'finished').length;
      html += '<h4>' + g.title + ' — ' + fin + ' finished / ' + list.length + ' entered</h4>';
      html += '<div class="table-wrap"><table class="ctrl-table"><thead><tr><th>Pos</th><th>Bib</th><th>Name</th><th>Time</th><th>Status</th></tr></thead><tbody>';
      let pos = 0;
      list.forEach((r) => {
        if (r.status === 'finished') pos += 1;
        html += '<tr><td>' + (r.status === 'finished' ? pos : '—') + '</td><td>' + escapeHtml(String(r.bib || '—')) + '</td><td>' + escapeHtml(r.name) + '</td><td>' + escapeHtml(r.time || '—') + '</td><td>' + escapeHtml(r.status) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    });
    box.innerHTML = html;
  }

  function renderSurveyPreview() {
    const box = $('#ctrl-survey-preview');
    if (!box) return;
    if (!isChair) {
      box.innerHTML = '<p class="form-note">Survey questions and live totals. Pretest form is Chair only.</p>';
      return;
    }
    box.innerHTML = '<p><a class="btn btn-primary" href="#survey">Open public survey page (respondent view)</a></p><div id="chair-survey-pretest"></div>';
    const mount = $('#chair-survey-pretest');
    if (window.BT42_renderSurvey && mount) {
      window.BT42_renderSurvey(mount, {
        pretest: true,
        formId: 'chairSurveyForm',
        thanksId: 'chairSurveyThanks',
        audId: 'chairSurveyAudience',
        fieldsId: 'chairSurveyFields'
      });
    }
  }

  function renderSurveyResults() {
    const box = $('#ctrl-survey-results');
    if (!box) return;
    let rows = [];
    try { rows = JSON.parse(localStorage.getItem('bt42_survey_responses') || '[]'); } catch { rows = []; }
    const labels = { participant: 'Participants', volunteer: 'Volunteers', committee: 'Committee', media: 'Media', public: 'Public' };
    const live = rows.filter((r) => !r.pretest);
    const pre = rows.filter((r) => r.pretest);
    const groups = {};
    Object.keys(labels).forEach((k) => { groups[k] = live.filter((r) => r.audience === k); });
    let html = '<p><strong>' + live.length + '</strong> race-day responses · <strong>' + pre.length + '</strong> chair pretests (not counted in averages below).</p>';
    Object.keys(labels).forEach((k) => {
      const list = groups[k];
      html += '<h4 style="margin:1rem 0 0.35rem">' + labels[k] + ' — ' + list.length + '</h4>';
      if (!list.length) {
        html += '<p class="form-note">No responses yet.</p>';
        return;
      }
      const keys = {};
      list.forEach((r) => {
        Object.keys(r.answers || {}).forEach((qid) => {
          const val = String((r.answers || {})[qid] || '').trim();
          if (!val) return;
          if (!keys[qid]) keys[qid] = {};
          keys[qid][val] = (keys[qid][val] || 0) + 1;
        });
      });
      html += '<div class="table-wrap"><table class="ctrl-table"><thead><tr><th>Question</th><th>Summary</th></tr></thead><tbody>';
      Object.keys(keys).forEach((qid) => {
        const counts = keys[qid];
        const nums = Object.keys(counts).filter((v) => /^\d+$/.test(v)).map(Number);
        let summary;
        if (nums.length) {
          let tot = 0, n = 0;
          nums.forEach((v) => { tot += v * counts[String(v)]; n += counts[String(v)]; });
          summary = 'Average ' + (n ? (tot / n).toFixed(1) : '—') + ' / 5 · ' + Object.keys(counts).map((v) => v + ': ' + counts[v]).join(', ');
        } else {
          summary = Object.keys(counts).map((v) => escapeHtml(v.slice(0, 80)) + ' (' + counts[v] + ')').join('<br>');
        }
        html += '<tr><td>' + escapeHtml(qid) + '</td><td>' + summary + '</td></tr>';
      });
      html += '</tbody></table></div>';
    });
    box.innerHTML = html;
  }

  function renderAll() {
    renderDashboard();
    renderChecklist();
    renderMeetings();
    renderSponsors();
    renderBudget();
    renderRunsheet();
    renderRoles();
    renderTargets();
    renderSyncBar();
    renderParticipants();
    renderVolunteersAdmin();
    renderAttendance();
    renderDeadlines();
    if (isChair) renderChairNotes();
    if (canRequisitions()) renderApprovals();
    renderSurveyPreview();
    renderSurveyResults();
    renderLiveResults();
    if (canManageStaff()) renderStaffAdmin();
    if (isChair) renderSiteContentAdmin();
    applySiteContentToPublic();
    renderNotes();
    initControlTabs();
    applyRoleUI();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && getSyncToken()) livePullSilent();
    });
    // Auto-pull if token present
    if (getSyncToken()) {
      pullSharedState().then(r => {
        if (r.ok) {
          renderParticipants();
          renderVolunteersAdmin();
          renderAttendance();
          renderDashboard();
        }
      }).catch(() => {});
    }
  }

  // ---------- Public API for main app ----------
  window.BT42Control = {
    init() {
      const form = $('#control-pin-form');
      if (form) {
        form.removeEventListener('submit', tryUnlock);
        form.addEventListener('submit', tryUnlock);
      }
      const logoutBtn = $('#ctrl-logout');
      if (logoutBtn) logoutBtn.onclick = logoutControl;

      if (unlocked) {
        unlock(isChair ? 'chair' : 'committee', currentUser || (isChair ? 'chair' : 'committee'), perms);
      } else {
        showGate();
      }
    },
    unlock,
    logout: logoutControl,
    renderAll
  };
})();
