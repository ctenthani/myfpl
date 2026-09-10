/* BT42.195km Race 2026 — App logic (launch version) */

(function () {
  const RACE_DATE = new Date('2026-09-27T06:00:00+02:00'); // CAT

  // ---- Navigation ----
  function navigate(pageId, opts) {
    opts = opts || {};
    let distancePrefill = opts.distance || '';
    if (pageId && String(pageId).indexOf('?') >= 0) {
      const parts = String(pageId).split('?');
      pageId = parts[0];
      try {
        const q = new URLSearchParams(parts[1] || '');
        distancePrefill = distancePrefill || q.get('distance') || '';
      } catch (e) {}
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + pageId);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    document.querySelectorAll('.nav a, .tab').forEach(el => {
      el.classList.toggle('active', el.dataset.page === pageId);
    });
    document.getElementById('nav')?.classList.remove('open');

    if (pageId === 'control' && window.BT42Control) {
      window.BT42Control.init();
    }
    if (pageId === 'register' && distancePrefill && typeof window.applyRaceDistance === 'function') {
      setTimeout(function () { window.applyRaceDistance(distancePrefill); }, 30);
    }
  }

  window.navigate = navigate;

  function handleHash() {
    const hash = (location.hash || '#home').replace('#', '') || 'home';
    navigate(hash);
  }

  window.addEventListener('hashchange', handleHash);
  function applyStoredSiteContent() {
    try {
      const raw = JSON.parse(localStorage.getItem('bt42_site_content') || 'null');
      if (!raw || typeof raw !== 'object') return;
      if (raw.heroSub && raw.heroSub.indexOf('Sunday') < 0 && raw.heroSub.indexOf('27 September') >= 0) {
        raw.heroSub = 'Blantyre · Sunday, 27 September 2026';
      }
      if (window.BT42_ENTRY_FEES) {
        if (raw.feesMarathon != null) window.BT42_ENTRY_FEES['42.195'] = Number(raw.feesMarathon);
        if (raw.fees10 != null) window.BT42_ENTRY_FEES['10'] = Number(raw.fees10);
        if (raw.fees5 != null) window.BT42_ENTRY_FEES['5'] = Number(raw.fees5);
      }
      document.querySelectorAll('[data-site]').forEach((el) => {
        const key = el.getAttribute('data-site');
        if (key === 'feesLine' && raw.feesMarathon != null) {
          el.textContent = 'Marathon ' + Number(raw.feesMarathon).toLocaleString('en-MW') +
            ' · 10 km ' + Number(raw.fees10).toLocaleString('en-MW') +
            ' · 5 km ' + Number(raw.fees5).toLocaleString('en-MW');
        } else if (key === 'bankAccount' && raw.bankAccount) {
          el.textContent = raw.bankAccount;
        } else if (key === 'announcement') {
          el.textContent = raw.announcement || '';
          el.style.display = raw.announcement ? '' : 'none';
        } else if (key === 'heroDate') {
          /* removed duplicate date line */
        } else if (key === 'heroSub') {
          el.textContent = raw.heroSub || 'Blantyre · Sunday, 27 September 2026';
        } else if (raw[key] != null && raw[key] !== '') {
          el.textContent = raw[key];
        }
      });
    } catch (e) {}
  }
  document.addEventListener('DOMContentLoaded', function () {
    applyStoredSiteContent();
    handleHash();
  });
  // remove duplicate if any - handled below

  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
  }

  document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      const page = link.dataset.page;
      if (page) {
        e.preventDefault();
        location.hash = page;
      }
    });
  });

  // ---- Countdown ----
  function updateCountdown() {
    const now = new Date();
    const diff = RACE_DATE - now;
    if (diff <= 0) {
      ['cd-days', 'cd-hours', 'cd-mins', 'cd-secs'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '0';
      });
      return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val).padStart(2, '0');
    };
    set('cd-days', days);
    set('cd-hours', hours);
    set('cd-mins', mins);
    set('cd-secs', secs);
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  // ---- Registration form ----
  // Works with Netlify Forms. Shows success panel after submit.
  const RACE_DAY_ISO = '2026-09-27'; // age calculated on race day

  // Entry fees (MWK) — shown after race selection; bank account 782637
  const ENTRY_FEES = window.BT42_ENTRY_FEES = {
    '42.195': 15000,
    '10': 10000,
    '5': 5000
  };
  const FEE_LABELS = {
    '42.195': '42.195 km Marathon',
    '10': '10 km Race',
    '5': '5 km Fun Run'
  };

  function applyRaceDistance(code) {
    const allowed = { '42.195': 1, '10': 1, '5': 1 };
    if (!code || !allowed[String(code)]) return false;
    const sel = document.getElementById('distance');
    if (!sel) return false;
    sel.value = String(code);
    try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    if (typeof updateFeePreview === 'function') updateFeePreview();
    return true;
  }
  window.applyRaceDistance = applyRaceDistance;


  function ageOnRaceDay(dobStr) {
    if (!dobStr) return null;
    const dob = new Date(dobStr + 'T12:00:00');
    const race = new Date(RACE_DAY_ISO + 'T12:00:00');
    let age = race.getFullYear() - dob.getFullYear();
    const m = race.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && race.getDate() < dob.getDate())) age--;
    return age;
  }

  function isValidMwPhone(raw) {
    // Accept common Malawi mobiles in any usual writing:
    // 0888381177, 888381177, 265888381177, +265888381177, with spaces/dashes
    let d = String(raw || '').replace(/[\s\-()]/g, '');
    if (d.startsWith('+')) d = d.slice(1);
    if (d.startsWith('265')) d = d.slice(3);
    if (d.startsWith('0')) d = d.slice(1);
    // local mobile: 8 or 9 + 8 digits (9 digits total)
    return /^[89]\d{8}$/.test(d);
  }

  window.handleRegister = function (e) {
    const form = document.getElementById('regForm');
    const teamMode = isTeamMode();

    // Mobile browsers still validate hidden required fields — disable them in team mode
    function setIndividualFieldsForMode(team) {
      ['fullName', 'distance', 'dob', 'gender'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.required = !team;
        el.disabled = !!team;
      });
      document.querySelectorAll('.team-member-name, .team-member-distance, .team-member-dob').forEach((el) => {
        el.required = !!team;
        el.disabled = !team;
      });
    }
    setIndividualFieldsForMode(teamMode);

    if (!form.checkValidity()) {
      e.preventDefault();
      try { form.reportValidity(); } catch (err) {}
      alert('Please complete all required fields. On team entries each member needs name, race and date of birth.');
      return false;
    }

    e.preventDefault();

    // Re-enable so FormData / later logic can read values if needed
    ['fullName', 'distance', 'dob', 'gender'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = false;
    });

    const formData = new FormData(form);
    const distance = (formData.get('distance') || '').toString();
    const dob = (formData.get('dob') || '').toString();
    const age = ageOnRaceDay(dob);

    const phoneVal = (formData.get('phone') || '').toString();
    if (!isValidMwPhone(phoneVal)) {
      alert('Please enter a valid Malawi mobile number (e.g. 0888381177).');
      return false;
    }

        const nameVal = (formData.get('fullName') || '').toString().trim();
    const isTeam = (formData.get('regType') || document.querySelector('input[name="regType"]:checked') || {}).value === 'team'
      || (document.getElementById('regTypeTeam') && document.getElementById('regTypeTeam').checked);
    if (!isTeam && nameVal.length < 3) {
      alert('Full name is required. This is the name that will appear on the certificate.');
      return false;
    }
    const emailVal = (formData.get('email') || '').toString().trim();
    if (!emailVal || emailVal.indexOf('@') < 1) {
      alert('Email address is required so we can send entry confirmation, payment updates, bib numbers and certificates.');
      return false;
    }
    const emPhone = (formData.get('emergencyPhone') || '').toString();
    if (!emPhone || !isValidMwPhone(emPhone)) {
      alert('Please enter a valid Malawi mobile for the emergency contact.');
      return false;
    }

    const paymentRefVal = (formData.get('paymentRef') || '').toString().trim();
    const proofInput = document.getElementById('paymentProof');
    const proofFile = proofInput && proofInput.files && proofInput.files[0];
    if (!paymentRefVal && !proofFile) {
      alert('Proof of payment is required. Enter a bank/SMS transaction ID or reference, and/or upload a copy of the deposit or transfer slip.');
      return false;
    }
    if (!paymentRefVal) {
      alert('Please also type the transaction ID or bank reference number (even if you upload a slip).');
      return false;
    }

    let memberNames = [];
    let teamMembersDetailed = [];
    if (teamMode) {
      teamMembersDetailed = getTeamMembers();
      memberNames = teamMembersDetailed.map((m) => m.name).filter(Boolean);
      if (memberNames.length < 2) {
        alert('Team registration needs at least 2 members. Add each runner with name, distance and date of birth.');
        return false;
      }
      for (let i = 0; i < teamMembersDetailed.length; i++) {
        const m = teamMembersDetailed[i];
        if (!m.name || !m.distance || !m.dob) {
          alert('Each team member needs a full name (as it will appear on the certificate), distance and date of birth.');
          return false;
        }
        if (m.distance === '42.195' && (m.ageOnRaceDay === null || m.ageOnRaceDay < 20)) {
          alert(m.name + ' cannot enter the marathon: must be at least 20 years old on 27 September 2026.');
          return false;
        }
      }
      const teamNameEl = document.getElementById('teamName');
      const teamNameVal = (teamNameEl && teamNameEl.value || '').trim();
      if (!teamNameVal) {
        alert('Team / club name is required for team registration.');
        if (teamNameEl) teamNameEl.focus();
        return false;
      }
      const emailEl = document.getElementById('email');
      const emailVal = (emailEl && emailEl.value || '').trim();
      if (!emailVal || emailVal.indexOf('@') < 1) {
        alert('A valid email address is required for team registration (confirmation and updates are sent there).');
        if (emailEl) emailEl.focus();
        return false;
      }
    } else {
      // Individual marathon age check
      if (distance === '42.195') {
        if (age === null || age < 20) {
          alert('Marathon entries are only open to runners who will be at least 20 years old on race day (27 September 2026).');
          return false;
        }
      }
    }

    let data = Object.fromEntries(formData.entries());
    data.submittedAt = new Date().toISOString();
    data.ageOnRaceDay = age;
    data.regType = teamMode ? 'team' : 'individual';
    data.teamMembers = memberNames;
    data.teamName = (formData.get('teamName') || '').toString().trim();
    data.paymentRef = paymentRefVal;
    data.hasPop = true;
    const count = teamMode ? teamMembersDetailed.length : 1;
    data.feeMwk = teamMode
      ? teamMembersDetailed.reduce(function (s, m) { return s + (m.feeMwk || 0); }, 0)
      : (ENTRY_FEES[distance] || 0);
    data.memberCount = count;
    data.teamMembersDetailed = teamMode ? teamMembersDetailed : [];

    if (teamMode) {
      data.fullName = data.teamName
        ? (data.teamName + ' (team contact)')
        : ('Team contact: ' + (memberNames[0] || 'Team'));
      // Primary display name for contact emails
      data.contactName = memberNames[0] || 'Team contact';
    }

    try {
      const existing = JSON.parse(localStorage.getItem('bt42_registrations') || '[]');
      existing.push(data);
      localStorage.setItem('bt42_registrations', JSON.stringify(existing));
    } catch (err) {
      console.warn('localStorage save failed', err);
    }

    const primaryDistance = teamMode && teamMembersDetailed[0]
      ? teamMembersDetailed[0].distance
      : (data.distance || '');
    const payload = {
      fullName: teamMode ? (data.contactName || data.fullName) : (data.fullName || ''),
      phone: data.phone || '',
      email: data.email || '',
      distance: primaryDistance,
      dob: teamMode && teamMembersDetailed[0] ? teamMembersDetailed[0].dob : (data.dob || ''),
      gender: data.gender || '',
      emergencyName: data.emergencyName || '',
      emergencyPhone: data.emergencyPhone || '',
      submittedAt: data.submittedAt,
      ageOnRaceDay: data.ageOnRaceDay,
      feeMwk: data.feeMwk,
      regType: data.regType,
      teamName: data.teamName || '',
      teamMembers: memberNames,
      teamMembersDetailed: teamMode ? teamMembersDetailed : [],
      paymentRef: data.paymentRef || '',
      memberCount: count
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
    }

    function readProofAsDataUrl(file) {
      return new Promise((resolve) => {
        if (!file) return resolve('');
        if (file.size > 6 * 1024 * 1024) {
          alert('PoP file is too large. Use a smaller photo or enter the transaction ID only.');
          return resolve('');
        }
        const reader = new FileReader();
        reader.onerror = () => resolve('');
        reader.onload = () => {
          const dataUrl = reader.result || '';
          if (typeof dataUrl !== 'string' || dataUrl.indexOf('data:image') !== 0) {
            // PDF or other — skip embedding to avoid payload limits; ref ID is enough
            resolve('');
            return;
          }
          // Compress image for server size limits
          try {
            const img = new Image();
            img.onload = () => {
              const maxW = 1200;
              const scale = img.width > maxW ? maxW / img.width : 1;
              const c = document.createElement('canvas');
              c.width = Math.max(1, Math.round(img.width * scale));
              c.height = Math.max(1, Math.round(img.height * scale));
              const ctx = c.getContext('2d');
              ctx.fillStyle = '#fff';
              ctx.fillRect(0, 0, c.width, c.height);
              ctx.drawImage(img, 0, 0, c.width, c.height);
              resolve(c.toDataURL('image/jpeg', 0.72));
            };
            img.onerror = () => resolve('');
            img.src = dataUrl;
          } catch (e) {
            resolve('');
          }
        };
        reader.readAsDataURL(file);
      });
    }

    // Netlify Forms backup (do not block on this)
    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(formData).toString()
    }).catch(() => null);

    readProofAsDataUrl(proofFile).then((proofData) => {
      if (proofData) payload.paymentProof = proofData;
      payload.paymentRef = paymentRefVal;
      return fetch('/.netlify/functions/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.ok) {
          const bits = [j && j.error, j && j.detail, j && j.hint].filter(Boolean);
          throw new Error(bits.join(' — ') || ('HTTP ' + res.status));
        }
        showSuccess(data);
        form.reset();
        const fp = document.getElementById('fee-preview');
        if (fp) fp.style.display = 'none';
        // Confirmation email is sent only by register.js (avoids two emails).
      })
      .catch((err) => {
        console.error('Shared register failed', err);
        alert(
          'Registration could not be saved to the official list. ' +
          'Please check your internet connection and try again.\n\n' +
          'Details: ' + (err && err.message ? err.message : String(err))
        );
      })
      .finally(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit registration';
        }
      });
    }).catch((err) => {
      console.error(err);
      alert('Could not read PoP file. Try again or use transaction ID only.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit registration';
      }
    });

    return false;
  };

  let lastReg = null;

  function formatMwk(n) {
    return Number(n).toLocaleString('en-MW') + ' MWK';
  }

  function showSuccess(reg) {
    lastReg = reg || lastReg;
    const el = document.getElementById('regSuccess');
    if (!el) return;

    const name = (lastReg && lastReg.fullName) || 'Athlete';
    const distance = (lastReg && lastReg.distance) || '';
    const fee = ENTRY_FEES[distance] || null;
    const distLabel = FEE_LABELS[distance] || distance || 'your race';
    const phone = (lastReg && lastReg.phone) || '';

    const feeLine = fee
      ? formatMwk(fee) + ((lastReg && lastReg.memberCount > 1) ? ' total for the team' : '')
      : 'the amount shown for your race';

    const detail = document.getElementById('regSuccessDetail');
    if (detail) {
      detail.innerHTML = `
        <p>Thank you, <strong>${escapeHtml(name)}</strong>. Your registration for the <strong>${escapeHtml(distLabel)}</strong> has been received.</p>
        ${(lastReg && lastReg.regType === 'team' && lastReg.teamMembersDetailed && lastReg.teamMembersDetailed.length)
          ? '<p><strong>Team:</strong> ' + escapeHtml(lastReg.teamName || '') + '</p>'
            + '<p><strong>Team members:</strong></p><ul>' + lastReg.teamMembersDetailed.map(function(m){
                var lab = FEE_LABELS[m.distance] || m.distance || '';
                return '<li>' + escapeHtml(m.name) + ' — ' + escapeHtml(lab) + (m.feeMwk != null ? ' (' + formatMwk(m.feeMwk) + ')' : '') + '</li>';
              }).join('') + '</ul>'
            + '<p style="font-size:1.05rem"><strong>Total entry fee: ' + formatMwk(lastReg.feeMwk || 0) + '</strong></p>'
            + (lastReg.paymentRef ? '<p>PoP / payment ref noted: <strong>' + escapeHtml(lastReg.paymentRef) + '</strong></p>' : '')
          : (lastReg && lastReg.regType === 'team' && lastReg.teamMembers && lastReg.teamMembers.length)
          ? '<p><strong>Team members:</strong></p><ul>' + lastReg.teamMembers.map(function(n){ return '<li>' + escapeHtml(n) + '</li>'; }).join('') + '</ul>'
            + '<p><strong>Total entry fee: ' + formatMwk(lastReg.feeMwk || 0) + '</strong></p>'
          : ''}

        <div class="mpamba-confirm-card">
          <p class="mpamba-confirm-title">Pay by bank transfer</p>
          <ol class="mpamba-steps">
            <li>Transfer the entry fee to account <code>782637</code></li>
            <li>Use reference: <strong>your full name + mobile number</strong>${(lastReg && lastReg.regType === 'team') ? ' (one transfer for the whole team)' : ''}</li>
            <li>Keep your deposit slip or transfer confirmation (one PoP for the team)</li>
          </ol>
          <p class="form-note" style="margin-top:0.75rem">Account: <code>782637</code> — reference: your name + mobile${phone ? ' (' + escapeHtml(phone) + ')' : ''}.</p>
        </div>

        <div class="post-pay-info">
          <p><strong>How payment is shared with the organisers</strong></p>
          <ul>
            <li>You already submitted a <strong>PoP reference</strong> on this form (transaction ID). That is what the committee uses to match your payment.</li>
            <li>Pay to account <code>782637</code> using <strong>name + mobile</strong> as the bank reference (same as on the form).</li>
            <li>If you pay later or the reference changes, email or WhatsApp the OC with: your name, mobile, team name (if any), amount, and the new transaction ID.</li>
            <li>Organisers verify payment in Control, then assign <strong>bib numbers</strong> and email you if an address was provided.</li>
            <li>Certificates: participation (DNF) or completion (finishers) — emailed when results are marked.</li>
          </ul>
        </div>`;
    }

    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Live hint when marathon selected
  const distSel = document.getElementById('distance');
  const dobInput = document.getElementById('dob');
  function checkMarathonAgeHint() {
    const hint = document.getElementById('marathon-age-hint');
    if (!distSel || !dobInput) return;
    if (distSel.value === '42.195' && dobInput.value) {
      const age = ageOnRaceDay(dobInput.value);
      if (hint) {
        if (age !== null && age < 20) {
          hint.textContent = 'Not eligible for the marathon: must be 20+ on 19 Sep 2026 (you would be ' + age + ').';
          hint.style.display = 'block';
        } else if (age !== null) {
          hint.textContent = 'Age on race day: ' + age + ' — eligible for the marathon.';
          hint.style.display = 'block';
        } else {
          hint.style.display = 'none';
        }
      }
    } else if (hint) {
      hint.style.display = 'none';
    }
  }
  function updateFeePreview() {
    const el = document.getElementById('fee-preview');
    if (!el || !distSel) return;
    const d = distSel.value;
    if (d && ENTRY_FEES[d] != null) {
      el.innerHTML = 'Entry fee: <strong>' + formatMwk(ENTRY_FEES[d]) + '</strong> — pay to account <code>782637</code> (ref: name + mobile)';
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  }
  if (distSel) {
    distSel.addEventListener('change', () => { checkMarathonAgeHint(); updateFeePreview(); });
  }
  if (dobInput) dobInput.addEventListener('change', checkMarathonAgeHint);

  console.log('BT42.195 Race App — launch ready');

  function isTeamMode() {
    const t = document.getElementById('regTypeTeam');
    return !!(t && t.checked);
  }

  function syncRegTypeUI() {
    const team = isTeamMode();
    const ind = document.getElementById('individualNameGroup');
    const members = document.getElementById('teamMembersBlock');
    const teamName = document.getElementById('teamNameGroup');
    const hint = document.getElementById('teamHint');
    const fullName = document.getElementById('fullName');
    if (ind) ind.style.display = team ? 'none' : '';
    if (members) members.style.display = team ? '' : 'none';
    if (teamName) teamName.style.display = team ? '' : 'none';
    if (hint) hint.style.display = team ? '' : 'none';
    // Hide + disable shared distance / DOB / gender for team (fixes mobile validation)
    ['fullName', 'distance', 'dob', 'gender'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const wrap = el.closest('.form-row') || el.closest('.form-group');
      if (id === 'fullName') {
        const g = document.getElementById('individualNameGroup');
        if (g) g.style.display = team ? 'none' : '';
      } else if (wrap) {
        wrap.style.display = team ? 'none' : '';
      }
      el.required = !team;
      el.disabled = !!team;
    });
    const teamNameInput = document.getElementById('teamName');
    if (teamNameInput) teamNameInput.required = !!team;
    const emailInput = document.getElementById('email');
    if (emailInput) emailInput.required = true;
    if (team) ensureTeamMemberRows(2);
    updateFeePreview();
  }

  function ensureTeamMemberRows(min) {
    const list = document.getElementById('teamMembersList');
    if (!list) return;
    while (list.children.length < (min || 1)) addTeamMemberRow();
  }

  function addTeamMemberRow(preset) {
    const list = document.getElementById('teamMembersList');
    if (!list) return;
    const p = preset || {};
    const row = document.createElement('div');
    row.className = 'team-member-row';
    row.style.cssText = 'border:1px solid #e0e0e0;border-radius:8px;padding:0.65rem;margin-bottom:0.5rem;background:#fff';
    row.innerHTML = `
      <div class="team-member-grid">
        <input type="text" class="team-member-name" required placeholder="Full name *" value="${String(p.name || '').replace(/"/g, '&quot;')}" autocomplete="name" />
        <select class="team-member-distance" required aria-label="Distance">
          <option value="">Race *</option>
          <option value="42.195">42.195 km</option>
          <option value="10">10 km</option>
          <option value="5">5 km</option>
        </select>
        <input type="date" class="team-member-dob" required aria-label="Date of birth" />
        <button type="button" class="btn-mini team-member-remove" title="Remove member" aria-label="Remove">×</button>
      </div>
      <p class="form-note team-member-fee" style="margin:0.25rem 0 0"></p>`;
    list.appendChild(row);
    const distSel = row.querySelector('.team-member-distance');
    if (p.distance) distSel.value = p.distance;
    const dobEl = row.querySelector('.team-member-dob');
    if (p.dob) dobEl.value = p.dob;
    const rm = row.querySelector('.team-member-remove');
    if (rm) rm.onclick = () => {
      if (list.children.length <= 1) return;
      row.remove();
      updateFeePreview();
    };
    ['.team-member-name', '.team-member-distance', '.team-member-dob'].forEach((sel) => {
      row.querySelector(sel).addEventListener('change', updateFeePreview);
      row.querySelector(sel).addEventListener('input', updateFeePreview);
    });
    updateFeePreview();
  }

  function getTeamMembers() {
    return Array.from(document.querySelectorAll('.team-member-row')).map((row) => {
      const name = (row.querySelector('.team-member-name').value || '').trim();
      const distance = (row.querySelector('.team-member-distance').value || '').trim();
      const dob = (row.querySelector('.team-member-dob').value || '').trim();
      const age = ageOnRaceDay(dob);
      const fee = ENTRY_FEES[distance] != null ? ENTRY_FEES[distance] : 0;
      return { name: name, distance: distance, dob: dob, ageOnRaceDay: age, feeMwk: fee };
    });
  }

  function getTeamMemberNames() {
    return getTeamMembers().map((m) => m.name).filter(Boolean);
  }

  function updateFeePreview() {
    const el = document.getElementById('fee-preview');
    if (!el) return;
    if (isTeamMode()) {
      const members = getTeamMembers();
      let total = 0;
      let lines = [];
      members.forEach((m, i) => {
        const feeEl = document.querySelectorAll('.team-member-row')[i];
        const note = feeEl && feeEl.querySelector('.team-member-fee');
        if (m.distance && ENTRY_FEES[m.distance] != null) {
          total += ENTRY_FEES[m.distance];
          const label = FEE_LABELS[m.distance] || m.distance;
          if (note) {
            let warn = '';
            if (m.distance === '42.195' && (m.ageOnRaceDay === null || m.ageOnRaceDay < 20)) {
              warn = ' · <span style="color:#C0392B">Marathon needs age 20+ on 19 Sep 2026</span>';
            }
            note.innerHTML = formatMwk(ENTRY_FEES[m.distance]) + ' — ' + label + warn;
          }
          lines.push((m.name || 'Member ' + (i + 1)) + ': ' + formatMwk(ENTRY_FEES[m.distance]));
        } else if (note) {
          note.textContent = 'Select distance to see fee';
        }
      });
      el.style.display = '';
      el.innerHTML = total > 0
        ? 'Team total: <strong>' + formatMwk(total) + '</strong> (' + members.filter(function(m){return m.distance;}).length + ' runners) — one transfer to account <code>782637</code> (ref: team/contact name + mobile)'
        : 'Add each member’s distance to see the team total — pay to account <code>782637</code>';
    } else {
      const sel = document.getElementById('distance');
      const d = sel && sel.value;
      if (d && ENTRY_FEES[d] != null) {
        el.style.display = '';
        el.innerHTML = 'Entry fee: <strong>' + formatMwk(ENTRY_FEES[d]) + '</strong> — pay to account <code>782637</code> (ref: name + mobile)';
      } else {
        el.style.display = 'none';
      }
    }
  }

  function initTeamRegistrationUI() {
    const ind = document.getElementById('regTypeIndividual');
    const team = document.getElementById('regTypeTeam');
    if (ind) ind.addEventListener('change', syncRegTypeUI);
    if (team) team.addEventListener('change', syncRegTypeUI);
    const addBtn = document.getElementById('addTeamMemberBtn');
    if (addBtn) addBtn.onclick = () => { addTeamMemberRow(); updateFeePreview(); };
    const dist = document.getElementById('distance');
    if (dist) dist.addEventListener('change', updateFeePreview);
    syncRegTypeUI();
    // Prefill distance from URL e.g. #register?distance=10
    try {
      const raw = (location.hash || '').replace('#', '');
      if (raw.indexOf('register') === 0 && raw.indexOf('distance=') >= 0) {
        const q = new URLSearchParams(raw.split('?')[1] || '');
        applyRaceDistance(q.get('distance'));
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTeamRegistrationUI);
  } else {
    initTeamRegistrationUI();
  }

})();
(function(){ var _n = window.navigate; if (typeof _n === 'function') { window.navigate = function(name){ _n(name); if (name==='course' && window.BT42_initCourseMap) window.BT42_initCourseMap(); }; } })();
