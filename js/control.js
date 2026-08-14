/* BT42.195 km Race 2026 — Control Room logic */

(function () {
  // Committee PIN = shared planner. Chair PIN = shared planner + Chair notes.
  const COMMITTEE_PIN = 'bt42oc';
  const CHAIR_PIN = 'bt42chair';

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

  let unlocked = sessionStorage.getItem('bt42_control_unlocked') === '1';
  let isChair = sessionStorage.getItem('bt42_control_role') === 'chair';

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  // ---------- Auth gate ----------
  function showGate() {
    const gate = $('#control-gate');
    const room = $('#control-room');
    if (gate) gate.classList.remove('hidden');
    if (room) room.classList.add('hidden');
  }

  function applyRoleUI() {
    // Chair notes tab & panel: chair only
    $$('.ctrl-tab[data-panel="chair"], #panel-chair').forEach(el => {
      if (isChair) el.classList.remove('chair-only-hidden');
      else el.classList.add('chair-only-hidden');
    });
    // Chair-editable metrics block
    const dashEdit = $('#ctrl-dash-edit');
    if (dashEdit) {
      if (isChair) dashEdit.classList.remove('chair-only-hidden');
      else dashEdit.classList.add('chair-only-hidden');
    }
    const badge = $('#ctrl-role-badge');
    if (badge) {
      badge.textContent = isChair ? 'Signed in as Chair' : 'Signed in as Committee';
      badge.className = isChair ? 'role-badge chair' : 'role-badge committee';
    }
    // If non-chair is on chair panel, switch to dashboard
    if (!isChair) {
      const chairPanel = $('#panel-chair');
      if (chairPanel && chairPanel.classList.contains('active')) {
        $$('.ctrl-tab').forEach(t => t.classList.remove('active'));
        $$('.ctrl-panel').forEach(p => p.classList.remove('active'));
        const dashTab = $('.ctrl-tab[data-panel="dash"]');
        const dashPanel = $('#panel-dash');
        if (dashTab) dashTab.classList.add('active');
        if (dashPanel) dashPanel.classList.add('active');
      }
    }
  }

  function unlock(role) {
    unlocked = true;
    isChair = role === 'chair';
    sessionStorage.setItem('bt42_control_unlocked', '1');
    sessionStorage.setItem('bt42_control_role', isChair ? 'chair' : 'committee');
    const gate = $('#control-gate');
    const room = $('#control-room');
    if (gate) gate.classList.add('hidden');
    if (room) room.classList.remove('hidden');
    renderAll();
    applyRoleUI();
  }

  function tryUnlock(e) {
    e.preventDefault();
    const input = $('#control-pin');
    if (!input) return;
    const val = input.value.trim().toLowerCase();
    if (val === CHAIR_PIN) {
      unlock('chair');
    } else if (val === COMMITTEE_PIN) {
      unlock('committee');
    } else {
      alert('Incorrect password. Use the committee password, or the Chair password for Chair-only notes.');
      input.value = '';
    }
  }

  function logoutControl() {
    sessionStorage.removeItem('bt42_control_unlocked');
    sessionStorage.removeItem('bt42_control_role');
    unlocked = false;
    isChair = false;
    showGate();
    const input = $('#control-pin');
    if (input) input.value = '';
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

  function loadSigs() {
    try { return JSON.parse(localStorage.getItem(SIGS_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveSigs(map) {
    localStorage.setItem(SIGS_KEY, JSON.stringify(map));
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
    const used = Object.values(bibs).map(b => Number(b.number)).filter(n => !isNaN(n));
    let start = 1001;
    if (distance === '10') start = 2001;
    if (distance === '5') start = 3001;
    let n = start;
    while (used.includes(n)) n++;
    return n;
  }

  function participantKey(r, i) {
    const phone = (r.phone || '').replace(/\s+/g, '');
    const name = (r.fullName || '').trim().toLowerCase();
    return phone || name || ('idx-' + i);
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
    if (Array.isArray(s.registrations) && s.registrations.length) {
      // Merge with local
      try {
        const local = JSON.parse(localStorage.getItem('bt42_registrations') || '[]');
        const keyOf = (r) => String(r.phone || '').replace(/\s+/g, '').toLowerCase() + '|' + String(r.fullName || '').trim().toLowerCase();
        const map = new Map();
        local.forEach(r => map.set(keyOf(r), r));
        s.registrations.forEach(r => {
          const k = keyOf(r);
          map.set(k, Object.assign({}, map.get(k) || {}, r));
        });
        localStorage.setItem('bt42_registrations', JSON.stringify(Array.from(map.values())));
      } catch (e) {}
    }
    if (s.payments) localStorage.setItem(PAYMENT_KEY, JSON.stringify(s.payments));
    if (s.bibs) localStorage.setItem(BIB_KEY, JSON.stringify(s.bibs));
    if (s.finishes) localStorage.setItem(FINISH_KEY, JSON.stringify(s.finishes));
    if (s.attendance) localStorage.setItem(ATTEND_KEY, JSON.stringify(s.attendance));
    if (isChair && s.signatures && !s.signatures._presentOnly) {
      localStorage.setItem(SIGS_KEY, JSON.stringify(s.signatures));
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
    return { ok: true, state: data.state };
  }

  async function pushAllLocal() {
    const payload = {
      registrations: JSON.parse(localStorage.getItem('bt42_registrations') || '[]'),
      bibs: loadBibs(),
      finishes: loadFinishes(),
      attendance: loadAttendance()
    };
    if (isChair) {
      payload.payments = loadPayments();
      payload.signatures = loadSigs();
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
        <strong>Shared sync</strong>
        <span class="pay-status ${tokenSet ? 'pay-ok' : 'pay-wait'}">${tokenSet ? 'Token set' : 'No token'}</span>
        ${meta.updatedAt ? '<small>Server: ' + new Date(meta.updatedAt).toLocaleString() + (meta.updatedBy ? ' · ' + meta.updatedBy : '') + '</small>' : ''}
        <div class="sync-actions">
          <input type="password" id="sync-token-input" placeholder="OC_SYNC_TOKEN" value="" autocomplete="off" />
          <button type="button" class="btn-mini" id="sync-save-token">Save token</button>
          <button type="button" class="btn-mini" id="sync-pull">Pull</button>
          <button type="button" class="btn-mini" id="sync-push">Push</button>
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
      msg(v.trim() ? 'Token saved on this device.' : 'Token cleared.', !!v.trim());
    };
    const pullBtn = $('#sync-pull');
    if (pullBtn) pullBtn.onclick = async () => {
      msg('Pulling…', true);
      const r = await pullSharedState();
      if (r.ok) {
        renderAll();
        msg('Pulled shared data.', true);
      } else msg('Pull failed: ' + r.error, false);
    };
    const pushBtn = $('#sync-push');
    if (pushBtn) pushBtn.onclick = async () => {
      msg('Pushing…', true);
      const r = await pushAllLocal();
      if (r.ok) msg('Pushed to shared store.', true);
      else msg('Push failed: ' + r.error, false);
    };
  }


  function renderParticipants() {
    const container = $('#ctrl-participants');
    if (!container) return;
    let rows = [];
    try {
      rows = JSON.parse(localStorage.getItem('bt42_registrations') || '[]');
    } catch { rows = []; }
    const pays = loadPayments();
    const finishes = loadFinishes();
    const bibs = loadBibs();
    const sigs = loadSigs();
    const sigReady = !!(sigs.kalua && sigs.chinangwa && sigs.tenthani);

    let html = `<div class="notice" style="margin-bottom:1rem">
      <strong>Participant list</strong> — visible to all committee members.<br>
      <strong>Payment verification (Verify / Reject)</strong> — <em>Chair only</em>.
      ${isChair ? '' : '<br><span class="pay-status pay-wait">You are signed in as Committee: payment status is view-only.</span>'}
      <br>Mpamba: <code>*444#</code> → <strong>4</strong> → <code>500204</code> · NBM <code>1802283</code>.
      ${sigReady ? '<br><span class="pay-status pay-ok">E-signatures loaded</span>' : (isChair ? '<br><span class="pay-status pay-wait">Upload e-signatures below before issuing certificates</span>' : '')}
    </div>

    ${isChair ? `<div class="sig-upload-box">
      <h4 style="margin:0 0 0.5rem">Electronic signatures (Chair only)</h4>
      <p class="form-note" style="margin-bottom:0.5rem">Upload clear PNG/JPG signature images for each official. Stored on this device only until a server store is connected.</p>
      <div class="sig-upload-grid">
        <label>Jim Kalua (Chairman, MNCS)<input type="file" accept="image/*" data-sig="kalua" class="sig-file" /></label>
        <label>Ivy Chinangwa (Acting CEO, MNCS)<input type="file" accept="image/*" data-sig="chinangwa" class="sig-file" /></label>
        <label>Chifundo Tenthani (OC Chair)<input type="file" accept="image/*" data-sig="tenthani" class="sig-file" /></label>
      </div>
      <div class="sig-previews" id="sig-previews"></div>
    </div>` : ''}`;

    if (!rows.length) {
      html += `<p style="color:var(--text-muted);margin-top:1rem">No local registrations yet. Use Netlify Forms for the master list; test entries on this browser appear here.</p>`;
      container.innerHTML = html;
      wireSigUploads();
      renderSigPreviews();
      return;
    }

    const verified = rows.filter((r, i) => (pays[participantKey(r, i)] || {}).status === 'verified').length;
    const finished = rows.filter((r, i) => (finishes[participantKey(r, i)] || {}).status === 'finished').length;

    html += `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.75rem;margin:0.75rem 0">
        <p style="font-size:0.85rem;margin:0"><strong>${rows.length}</strong> entries · <strong>${verified}</strong> paid · <strong>${finished}</strong> finished</p>
        ${isChair ? '<button type="button" class="btn-mini" id="clear-all-entries" style="border-color:#C0392B;color:#C0392B">Clear all entries</button>' : ''}
      </div>
      <div class="sponsor-table-wrap"><table class="ctrl-table">
      <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Distance</th><th>Payment</th><th>Bib</th><th>Finish</th><th>Certificates</th>${isChair ? '<th></th>' : ''}</tr></thead><tbody>`;

    rows.forEach((r, i) => {
      const key = participantKey(r, i);
      const pay = pays[key] || { status: 'pending' };
      const fin = finishes[key] || { status: 'not_started' };
      const st = pay.status || 'pending';
      const fst = fin.status || 'not_started';
      const stLabel = st === 'verified' ? 'Verified' : (st === 'rejected' ? 'Rejected' : 'Pending');
      const stClass = st === 'verified' ? 'pay-ok' : (st === 'rejected' ? 'pay-no' : 'pay-wait');
      const fLabel = fst === 'finished' ? 'Finished' : (fst === 'dns' ? 'DNS' : (fst === 'dnf' ? 'DNF' : '—'));
      const fClass = fst === 'finished' ? 'pay-ok' : (fst === 'dnf' || fst === 'dns' ? 'pay-no' : 'pay-wait');
      html += `<tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(r.fullName || '')}</strong>${r.email ? '<br><small>' + escapeHtml(r.email) + '</small>' : ''}</td>
        <td>${escapeHtml(r.phone || '')}</td>
        <td>${escapeHtml(distanceLabel(r.distance))}</td>
        <td>
          <span class="pay-status ${stClass}">${stLabel}</span>
          <div class="actions-cell">
            ${isChair ? '<button type="button" class="btn-mini pay-verify" data-key="' + escapeHtml(key) + '">Verify</button><button type="button" class="btn-mini pay-reject" data-key="' + escapeHtml(key) + '">Reject</button>' : '<small class="form-note">Chair verifies</small>'}
          </div>
        </td>
        <td>
          ${bibs[key] && bibs[key].number ? '<strong>#' + bibs[key].number + '</strong>' : '<span class="pay-status pay-wait">No bib</span>'}
          <div class="actions-cell">
            <button type="button" class="btn-mini bib-assign" data-key="${escapeHtml(key)}" data-i="${i}" ${st !== 'verified' ? 'disabled title="Verify payment first"' : ''}>Assign bib</button>
          </div>
        </td>
        <td>
          <span class="pay-status ${fClass}">${fLabel}</span>
          <div class="actions-cell">
            <button type="button" class="btn-mini fin-ok" data-key="${escapeHtml(key)}" data-i="${i}">Finish</button>
            <button type="button" class="btn-mini fin-dnf" data-key="${escapeHtml(key)}">DNF</button>
          </div>
        </td>
        <td class="actions-cell">
          <button type="button" class="btn-mini pay-cert" data-i="${i}" data-type="participation" ${st !== 'verified' ? 'disabled title="Verify payment first"' : ''}>Entry cert</button>
          <button type="button" class="btn-mini fin-cert" data-i="${i}" data-type="completion" ${fst !== 'finished' ? 'disabled title="Mark finished first"' : ''}>Completion cert</button>
        </td>
        ${isChair ? '<td class="actions-cell"><button type="button" class="btn-mini entry-delete" data-i="' + i + '" style="border-color:#C0392B;color:#C0392B">Delete</button></td>' : ''}
      </tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
    wireSigUploads();
    renderSigPreviews();


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
          const r = await pushSharedState({
            registrations: [],
            replaceRegistrations: true,
            payments: {},
            replacePayments: true,
            bibs: {},
            replaceBibs: true,
            finishes: {},
            replaceFinishes: true
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

    container.querySelectorAll('.entry-delete').forEach(btn => {
      btn.onclick = async () => {
        if (!isChair) { alert('Only the Chair can delete entries.'); return; }
        const i = Number(btn.dataset.i);
        let list = [];
        try { list = JSON.parse(localStorage.getItem('bt42_registrations') || '[]'); } catch { list = []; }
        const r = list[i];
        if (!r) return;
        if (!confirm('Delete entry for ' + (r.fullName || 'this athlete') + '?')) return;
        const key = participantKey(r, i);
        const next = list.filter((_, idx) => idx !== i);
        localStorage.setItem('bt42_registrations', JSON.stringify(next));
        const pays = loadPayments(); delete pays[key]; savePayments(pays);
        const bibsMap = loadBibs(); delete bibsMap[key]; saveBibs(bibsMap);
        const fins = loadFinishes(); delete fins[key]; saveFinishes(fins);
        if (getSyncToken()) {
          await pushSharedState({
            registrations: next,
            replaceRegistrations: true,
            payments: pays,
            replacePayments: true,
            bibs: bibsMap,
            replaceBibs: true,
            finishes: fins,
            replaceFinishes: true
          }).catch(() => {});
        }
        renderParticipants();
        renderDashboard();
      };
    });

    container.querySelectorAll('.bib-assign').forEach(btn => {
      btn.onclick = () => {
        const i = Number(btn.dataset.i);
        const r = rows[i];
        if (!r) return;
        const map = loadBibs();
        const suggested = (map[btn.dataset.key] && map[btn.dataset.key].number) || nextBibForDistance(r.distance, map);
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
        if (getSyncToken()) pushSharedState({ bibs: map }).catch(() => {});
        try {
          fetch('/.netlify/functions/send-certificate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'bib_assigned',
              fullName: r.fullName,
              email: r.email || '',
              phone: r.phone || '',
              distance: distanceLabel(r.distance),
              raceDate: '2026-09-19',
              bib: String(num).trim()
            })
          }).catch(function () {});
        } catch (e) {}
        renderParticipants();
        alert('Bib #' + String(num).trim() + ' assigned. Email is sent only if Netlify email keys are configured and the athlete provided an email.');
      };
    });

    container.querySelectorAll('.pay-verify').forEach(btn => {
      btn.onclick = () => {
        if (!isChair) { alert('Only the Chair can verify payments.'); return; }
        const map = loadPayments();
        const note = prompt('Optional note (Mpamba/bank ref):', (map[btn.dataset.key] || {}).note || '') || '';
        map[btn.dataset.key] = { status: 'verified', note, verifiedAt: new Date().toISOString(), verifiedBy: 'Chair' };
        savePayments(map);
        if (getSyncToken()) pushSharedState({ payments: map }).catch(() => {});
        renderParticipants();
      };
    });
    container.querySelectorAll('.pay-reject').forEach(btn => {
      btn.onclick = () => {
        if (!isChair) { alert('Only the Chair can reject payments.'); return; }
        const map = loadPayments();
        map[btn.dataset.key] = { status: 'rejected', note: prompt('Reason (optional):', '') || '', verifiedAt: new Date().toISOString() };
        savePayments(map);
        if (getSyncToken()) pushSharedState({ payments: map }).catch(() => {});
        renderParticipants();
      };
    });
    container.querySelectorAll('.fin-ok').forEach(btn => {
      btn.onclick = () => {
        const map = loadFinishes();
        const time = prompt('Official finish time (optional, e.g. 3:42:15):', (map[btn.dataset.key] || {}).time || '') || '';
        map[btn.dataset.key] = { status: 'finished', time, finishedAt: new Date().toISOString() };
        saveFinishes(map);
        if (getSyncToken()) pushSharedState({ finishes: map }).catch(() => {});
        const r = rows[Number(btn.dataset.i)];
        // Auto-open completion certificate and queue outbound email hook
        if (r) {
          openCertificate(r, 'completion');
          queueCompletionEmail(r, time);
        }
        renderParticipants();
      };
    });
    container.querySelectorAll('.fin-dnf').forEach(btn => {
      btn.onclick = () => {
        const map = loadFinishes();
        map[btn.dataset.key] = { status: 'dnf', finishedAt: new Date().toISOString() };
        saveFinishes(map);
        renderParticipants();
      };
    });
    container.querySelectorAll('.pay-cert, .fin-cert').forEach(btn => {
      btn.onclick = () => {
        const r = rows[Number(btn.dataset.i)];
        if (r) openCertificate(r, btn.dataset.type || 'participation');
      };
    });
  }

  function wireSigUploads() {
    $$('.sig-file').forEach(input => {
      input.onchange = () => {
        if (!isChair) { alert('Only the Chair can upload e-signatures.'); return; }
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const map = loadSigs();
          map[input.dataset.sig] = reader.result;
          map[input.dataset.sig + '_updated'] = new Date().toISOString();
          saveSigs(map);
          renderSigPreviews();
        };
        reader.readAsDataURL(file);
      };
    });
  }

  function renderSigPreviews() {
    const box = $('#sig-previews');
    if (!box) return;
    const s = loadSigs();
    const labels = { kalua: 'Jim Kalua', chinangwa: 'Ivy Chinangwa', tenthani: 'Chifundo Tenthani' };
    box.innerHTML = Object.keys(labels).map(k => {
      if (!s[k]) return `<div class="sig-prev empty">${labels[k]}: not uploaded</div>`;
      return `<div class="sig-prev"><img src="${s[k]}" alt="${labels[k]}" /><span>${labels[k]}</span></div>`;
    }).join('');
  }

  function queueCompletionEmail(r, finishTime) {
    // Design-time auto-send: posts to Netlify function when deployed with email provider configured
    const payload = {
      type: 'completion_certificate',
      fullName: r.fullName,
      email: r.email || '',
      phone: r.phone || '',
      distance: distanceLabel(r.distance),
      finishTime: finishTime || '',
      raceDate: '2026-09-19'
    };
    try {
      fetch('/.netlify/functions/send-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(res => {
        if (!res.ok) console.warn('Certificate email function not active yet', res.status);
      }).catch(() => {
        console.info('Auto-email pending: deploy send-certificate function + email API key.');
      });
    } catch (e) {
      console.info('Auto-email hook skipped', e);
    }
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
    const certId = (isCompletion ? 'BT42-FIN-' : 'BT42-ENT-') + (phone.replace(/\D/g, '').slice(-8) || Date.now().toString(36).toUpperCase());
    const issued = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const sigs = loadSigs();
    const title = isCompletion ? 'CERTIFICATE OF COMPLETION' : 'CERTIFICATE OF PARTICIPATION';
    const bodyText = isCompletion
      ? `has successfully <strong>completed</strong> the <strong>${distance.replace(/</g, '')}</strong> of the BT42.195 km Race 2026${finishTime ? ' in a time of <strong>' + finishTime.replace(/</g, '') + '</strong>' : ''}, organised under the auspices of the <strong>Malawi National Council of Sports</strong>.`
      : `is a registered participant in the <strong>${distance.replace(/</g, '')}</strong> of the BT42.195 km Race 2026, organised under the auspices of the <strong>Malawi National Council of Sports</strong>.`;

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

    const logoUrl = (location.origin && location.origin !== 'null' ? location.origin : '') + '/assets/mncs-logo.png';

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
  .hdr { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 0.6rem; }
  .hdr img { width: 72px; height: 72px; }
  .hdr-text { text-align: left; }
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
  .sig-img-wrap img { max-height: 48px; max-width: 160px; object-fit: contain; }
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
      <img src="${logoUrl}" alt="MNCS" onerror="this.style.display='none'" />
      <div class="hdr-text">
        <div class="org">Malawi National Council of Sports</div>
        <div class="event">BT42.195 km Race 2026</div>
        <div class="sub">Blantyre · Saturday, 19 September 2026</div>
      </div>
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
      ${sigBlock(sigs.chinangwa, 'Ivy Chinangwa', 'Acting Chief Executive Officer<br>Malawi National Council of Sports')}
      ${sigBlock(sigs.tenthani, 'Chifundo Tenthani', 'Chair, Organising Committee<br>BT42.195 km Race 2026')}
    </div>
    <p class="foot">Official certificate · Malawi National Council of Sports · BT42.195 km Race 2026
      ${isCompletion ? ' · Completion certificate issued after verified finish' : ' · Entry certificate issued after verified payment'}</p>
  </div>
</body>
</html>`);
    w.document.close();
  }

  window.BT42OpenCertificate = openCertificate;

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
    renderAttendance();
    renderDeadlines();
    if (isChair) renderChairNotes();
    renderNotes();
    initControlTabs();
    applyRoleUI();
    // Auto-pull if token present
    if (getSyncToken()) {
      pullSharedState().then(r => {
        if (r.ok) {
          renderParticipants();
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
        unlock(isChair ? 'chair' : 'committee');
      } else {
        showGate();
      }
    },
    unlock,
    logout: logoutControl,
    renderAll
  };
})();
