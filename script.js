(function () {

  // ============================================================
  // SUPABASE CONNECTION
  // ============================================================

  var SUPABASE_URL = 'https://kmxmxmcoibdqstdqaoql.supabase.co/rest/v1/';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fAE0svxCvFJhxAChgKgRyw_WY29obiN';

  var supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );
  var SITE_URL = 'https://trahetrove.com';

  var STORAGE_KEY = 'trahe_trove_state_v1';
  var DEFAULT_DURATION_MS = 24 * 3600000;
  var state = { items: [], dropName: 'September Hoodie Drop' };
  var PROOF_STORAGE_KEY = 'trahe_trove_proof_v1';
  var WAYBILL_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
  var WAYBILL_DELETE_DATE_KEY = 'trahe_trove_waybill_delete_date_v1';
  var proofState = { waybills: [], legitimacy: [] };

  // PROTOTYPE DATA LAYER — everything below (defaultItems/load/save) is
  // browser localStorage. It is NOT the production data source and will
  // be replaced by real queries against Postgres (Supabase) in Phase 2:
  // see schema.sql for the intended products/auctions/bids tables, and
  // the place_bid()/auction-closing sketches for how start/end time
  // must eventually be decided server-side rather than by this file.
  //
  // Seed data below intentionally shows all three states at once —
  // two Not Started (to demo "Start All"), one Active with a short demo
  // countdown, one already Ended with a winner (to demo the Payments
  // tab immediately) — so you don't have to wait 24h to see everything.
  function defaultItems() {
    var now = Date.now();
    return [
      { id: 'a1', name: 'Faded Navy Zip Hoodie', size: 'L', condition: 'Good — subtle pilling on the cuffs', description: '90s ringspun cotton', color: '#33415a', image: null, startPrice: 250, increment: 50, durationMs: DEFAULT_DURATION_MS, status: 'not_started', startsAt: null, endsAt: null, currentBid: 250, bidderName: null, bidderPhone: null, paid: false },
      { id: 'a2', name: 'Olive Drab Pullover', size: 'M', condition: 'Very good — one small paint fleck near the hem', description: 'Boxy fit', color: '#4a5535', image: null, startPrice: 300, increment: 50, durationMs: 150 * 1000, status: 'active', startsAt: now, endsAt: now + 150 * 1000, currentBid: 300, bidderName: null, bidderPhone: null, paid: false },
      { id: 'a3', name: 'Cream Heavyweight Hoodie', size: 'XL', condition: 'Good — one loose thread near the pocket', description: 'Double-lined hood', color: '#d8cdb0', image: null, startPrice: 400, increment: 75, durationMs: DEFAULT_DURATION_MS, status: 'not_started', startsAt: null, endsAt: null, currentBid: 400, bidderName: null, bidderPhone: null, paid: false },
      { id: 'a4', name: 'Rust Crewneck, hood removed', size: 'S', condition: 'Fair — customized, raw-cut seam', description: 'Still soft, well broken-in', color: '#8c4a30', image: null, startPrice: 200, increment: 40, durationMs: 60 * 1000, status: 'ended', startsAt: now - 61000, endsAt: now - 1000, currentBid: 260, bidderName: 'Marga R.', bidderPhone: '0917 123 4567', paid: false }
    ];
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state = JSON.parse(raw);
        // Migration for state saved by an earlier version of this
        // prototype (before Not Started / Active / Ended existed):
        // old items only had a boolean `sold`, always started
        // immediately, and there was no drop name at all.
        if (!state.dropName) state.dropName = 'September Hoodie Drop';
        (state.items || []).forEach(function (item) {
          if (!item.status) item.status = item.sold ? 'ended' : 'active';
          if (item.durationMs == null) item.durationMs = DEFAULT_DURATION_MS;
          if (item.startsAt === undefined) item.startsAt = null;
          if (item.condition === undefined) item.condition = '—';
          if (item.description === undefined) item.description = item.note || 'No description yet';
          if (item.image === undefined) item.image = null;
        });
        return;
      }
    } catch (e) { /* ignore, fall through to defaults */ }
    state = { items: defaultItems(), dropName: 'September Hoodie Drop' };
    save();
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  function localDateTimeEnd(dateString) {
    if (!dateString) return null;
    var parts = dateString.split('-').map(Number);
    if (parts.length !== 3 || parts.some(function (n) { return !Number.isFinite(n); })) return null;
    // End of the selected local calendar day.
    return new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999).getTime();
  }

  function getWaybillDeleteDate() {
    var input = document.getElementById('waybillDeleteDate');
    if (input && input.value) return input.value;
    try { return localStorage.getItem(WAYBILL_DELETE_DATE_KEY) || ''; } catch (e) { return ''; }
  }

  function setDefaultWaybillDeleteDate() {
    var input = document.getElementById('waybillDeleteDate');
    if (!input) return;
    var saved = '';
    try { saved = localStorage.getItem(WAYBILL_DELETE_DATE_KEY) || ''; } catch (e) {}
    if (saved) input.value = saved;
    if (!input.value) {
      var d = new Date(Date.now() + WAYBILL_RETENTION_MS);
      input.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    input.min = new Date().toISOString().slice(0, 10);
  }

  function purgeExpiredWaybills() {
    var now = Date.now();
    var changed = false;
    proofState.waybills = (proofState.waybills || []).filter(function (item) {
      // Older uploads used a 3-day window. Keep that backward-compatible behavior.
      if (!item.expiresAt) {
        if (item.uploadedAt) item.expiresAt = Number(item.uploadedAt) + WAYBILL_RETENTION_MS;
        else item.expiresAt = now + WAYBILL_RETENTION_MS;
        changed = true;
      }
      if (now >= Number(item.expiresAt)) { changed = true; return false; }
      return true;
    });
    if (changed) saveProof();
    return changed;
  }

  function loadProof() {
    try {
      var raw = localStorage.getItem(PROOF_STORAGE_KEY);
      if (raw) {
        proofState = JSON.parse(raw);
        if (!Array.isArray(proofState.waybills)) proofState.waybills = [];
        if (!Array.isArray(proofState.legitimacy)) proofState.legitimacy = [];
        purgeExpiredWaybills();
        return;
      }
    } catch (e) { /* ignore */ }
    proofState = { waybills: [], legitimacy: [] };
  }
  function saveProof() {
    try { localStorage.setItem(PROOF_STORAGE_KEY, JSON.stringify(proofState)); } catch (e) { showToast('Storage is full. Remove some proof images and try again.'); }
  }
  function renderProofGallery(type, elId) {
    var el = document.getElementById(elId);
    if (!el) return;
    var list = proofState[type] || [];
    if (!list.length) {
      el.innerHTML = '<div class="proof-empty">NO IMAGES UPLOADED YET.</div>';
      return;
    }
    el.innerHTML = list.map(function (item) {
      return '<article class="proof-item"><img src="' + item.image + '" alt="' + escapeHtml(item.caption || 'Shipment proof') + '"><div class="proof-caption">' + escapeHtml(item.caption || 'Shipment proof') + '</div></article>';
    }).join('');
  }
  function renderProof() {
    renderProofGallery('waybills', 'waybillGallery');
    renderProofGallery('legitimacy', 'legitimacyGallery');
    renderProofAdmin();
  }
  function renderProofAdmin() {
    var el = document.getElementById('proofAdminList');
    if (!el) return;
    var rows = [];
    [['waybills','WAYBILL'],['legitimacy','PROOF OF LEGITIMACY']].forEach(function (group) {
      (proofState[group[0]] || []).forEach(function (item, index) {
        rows.push('<div class="admin-row"><div><b>' + group[1] + '</b><div class="field-note">' + escapeHtml(item.caption || 'Shipment proof') + '</div></div><button class="mini-btn danger" type="button" data-remove-proof="' + group[0] + ':' + index + '">Delete</button></div>');
      });
    });
    el.innerHTML = rows.length ? rows.join('') : '<div class="placeholder-note">No proof images uploaded yet.</div>';
    el.querySelectorAll('[data-remove-proof]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var parts = btn.dataset.removeProof.split(':');
        proofState[parts[0]].splice(Number(parts[1]), 1);
        saveProof(); renderProof();
      });
    });
  }

  function handleProofUpload(inputId, type, label) {
    var input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []);
      if (!files.length) return;
      var remaining = files.length;
      files.forEach(function (file) {
        if (!file.type.startsWith('image/')) { remaining--; return; }
        var reader = new FileReader();
        reader.onload = function (e) {
          var uploadedAt = Date.now();
          var expiresAt = null;
          if (type === 'waybills') {
            var deleteDate = getWaybillDeleteDate();
            expiresAt = localDateTimeEnd(deleteDate);
            if (!expiresAt || expiresAt <= uploadedAt) {
              showToast('Please choose a future Waybill auto-delete date.');
              remaining--;
              if (remaining === 0) input.value = '';
              return;
            }
            try { localStorage.setItem(WAYBILL_DELETE_DATE_KEY, deleteDate); } catch (err) {}
          }
          proofState[type].unshift({ image: e.target.result, caption: label + ' • ' + file.name, uploadedAt: uploadedAt, expiresAt: expiresAt });
          remaining--;
          if (remaining === 0) { saveProof(); renderProof(); input.value = ''; }
        };
        reader.onerror = function () { remaining--; if (remaining === 0) input.value = ''; };
        reader.readAsDataURL(file);
      });
    });
  }

  function peso(n) { return '₱' + Number(n || 0).toLocaleString('en-PH'); }

  function fmtTime(ms) {
    if (ms <= 0) return '00:00';
    var totalSec = Math.floor(ms / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    if (h > 0) return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function fmtDuration(ms) {
    var totalSec = Math.round(ms / 1000);
    if (totalSec % 3600 === 0) return (totalSec / 3600) + 'h';
    if (totalSec % 60 === 0) return (totalSec / 60) + 'm';
    return totalSec + 's';
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : str;
    return d.innerHTML;
  }

  // ============================================================
  // PUBLIC NAVIGATION — only HOME and AUCTIONS are public sections.
  // Existing auction rendering, bidding, admin and storage logic remain unchanged.
  // ============================================================
  var publicSections = {
    home: document.getElementById('homeSection'),
    auctions: document.getElementById('auctionsSection'),
    proof: document.getElementById('proofSection')
  };
  document.querySelectorAll('.main-nav-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.dataset.section;
      Object.keys(publicSections).forEach(function (key) {
        var section = publicSections[key];
        var isActive = key === target;
        section.hidden = !isActive;
        section.classList.toggle('active', isActive);
      });
      document.querySelectorAll('.main-nav-btn').forEach(function (b) { b.classList.toggle('active', b === btn); });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // ============================================================
  // STOREFRONT (public) — behavior now branches on item.status.
  // No admin controls anywhere in this section.
  // ============================================================
  var board = document.getElementById('board');
  var liveCountEl = document.getElementById('liveCount');
  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  function render() {
    var liveCount = 0;
    var now = Date.now();
    board.innerHTML = '';
    state.items.forEach(function (item) {
      if (item.status === 'active' && item.endsAt - now <= 0) {
        item.status = 'ended';
        save();
      }
      if (item.status === 'active') liveCount++;

      var tag = document.createElement('div');
      tag.className = 'tag';

      var swatch = document.createElement('div');
      swatch.className = 'swatch';
      if (item.image) { swatch.style.backgroundImage = 'url(' + item.image + ')'; }
      else { swatch.style.background = item.color; }
      var sizeBadge = document.createElement('span');
      sizeBadge.className = 'size-badge';
      sizeBadge.textContent = 'SIZE ' + item.size;
      swatch.appendChild(sizeBadge);
      if (item.status !== 'active') {
        var stamp = document.createElement('div');
        stamp.className = 'sold-stamp' + (item.status === 'not_started' ? ' upcoming' : '');
        stamp.innerHTML = '<span>' + (item.status === 'not_started' ? 'COMING SOON' : 'ENDED') + '</span>';
        swatch.appendChild(stamp);
      }
      tag.appendChild(swatch);

      var h3 = document.createElement('h3');
      h3.textContent = item.name;
      tag.appendChild(h3);

      var note = document.createElement('p');
      note.className = 'note';
      note.textContent = item.description + (item.condition && item.condition !== '—' ? ' — ' + item.condition : '');
      tag.appendChild(note);

      var bidRow = document.createElement('div');
      bidRow.className = 'bid-row';
      var left = document.createElement('div');
      left.innerHTML = '<div class="bid-label">' + (item.bidderName ? 'current top bid' : 'starting bid') + '</div><div class="bid-amount">' + peso(item.currentBid) + '</div>';
      var right = document.createElement('div');
      right.className = 'timer';
      if (item.status === 'active') { right.textContent = 'LIVE · ' + fmtTime(item.endsAt - now); }
      else if (item.status === 'not_started') { right.textContent = 'not started yet'; right.style.color = 'var(--ink-muted)'; }
      else { right.textContent = 'ended'; }
      bidRow.appendChild(left);
      bidRow.appendChild(right);
      tag.appendChild(bidRow);

      if (item.status === 'ended') {
        var wl = document.createElement('div');
        wl.className = 'winner-line';
        if (item.bidderName) {
          wl.innerHTML = 'Won by <b>' + escapeHtml(item.bidderName) + '</b> at ' + peso(item.currentBid) + '.<br>' +
            (item.paid
              ? '<span class="paid-flag">Payment received ✓</span>'
              : "We'll send a GCash/Maya payment request within 24h.");
        } else {
          wl.textContent = 'No bids came in before time ran out.';
        }
        tag.appendChild(wl);
      } else if (item.status === 'not_started') {
        var comingBtn = document.createElement('button');
        comingBtn.className = 'bid-btn';
        comingBtn.disabled = true;
        comingBtn.textContent = 'Coming soon';
        tag.appendChild(comingBtn);
      } else {
        var btn = document.createElement('button');
        btn.className = 'bid-btn';
        btn.textContent = 'Place bid';
        btn.addEventListener('click', function () { openBidModal(item.id); });
        tag.appendChild(btn);
      }

      board.appendChild(tag);
    });
    liveCountEl.textContent = liveCount;
  }

  // ---------- bid modal ----------
  var overlay = document.getElementById('bidOverlay');
  var activeItemId = null;

  function openBidModal(id) {
    var item = state.items.find(function (i) { return i.id === id; });
    if (!item || item.status !== 'active') return;
    activeItemId = id;
    document.getElementById('modalItemName').textContent = item.name;
    document.getElementById('modalItemSub').textContent = 'Size ' + item.size + ' — ' + item.description;
    document.getElementById('modalCurrentBid').textContent = peso(item.currentBid);
    var minNext = item.currentBid + item.increment;
    document.getElementById('modalMinBid').textContent = peso(minNext);
    document.getElementById('bidAmount').value = minNext;
    document.getElementById('bidAmount').min = minNext;
    document.getElementById('bidName').value = '';
    document.getElementById('bidPhone').value = '';
    document.getElementById('modalErr').textContent = '';
    overlay.classList.add('open');
    document.getElementById('bidName').focus();
  }
  function closeBidModal() { overlay.classList.remove('open'); activeItemId = null; }

  document.getElementById('closeModal').addEventListener('click', closeBidModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeBidModal(); });

  // CLIENT-SIDE VALIDATION ONLY — this increment/amount check is a
  // convenience for the visitor, not a security boundary. Anyone with
  // devtools open can currently call save() directly with any values.
  // Phase 2 moves the authoritative check into a server-side function
  // (place_bid RPC in schema.sql) that runs inside a database
  // transaction, so this exact race — two people bidding within the
  // same second — can't corrupt the auction.
  document.getElementById('submitBid').addEventListener('click', function () {
    var item = state.items.find(function (i) { return i.id === activeItemId; });
    if (!item) return;
    var name = document.getElementById('bidName').value.trim();
    var phone = document.getElementById('bidPhone').value.trim();
    var amount = Number(document.getElementById('bidAmount').value);
    var minNext = item.currentBid + item.increment;
    var errEl = document.getElementById('modalErr');

    if (!name) { errEl.textContent = 'Enter your name.'; return; }
    if (!phone) { errEl.textContent = 'Enter a GCash or Maya number to bid with.'; return; }
    if (!amount || amount < minNext) { errEl.textContent = 'Bid must be at least ' + peso(minNext) + '.'; return; }
    if (item.status !== 'active' || item.endsAt - Date.now() <= 0) {
      errEl.textContent = 'This auction is not open for bidding.';
      renderAll();
      closeBidModal();
      return;
    }

    item.currentBid = amount;
    item.bidderName = name;
    item.bidderPhone = phone;
    save();
    renderAll();
    closeBidModal();
    showToast("You're the top bid on \"" + item.name + '" at ' + peso(amount) + '.');
  });

  // ============================================================
  // ADMIN — login gate + dashboard.
  // Everything in this section is reachable ONLY through the small
  // "Admin Login" link in the footer. Nothing on the public storefront
  // links to it, and there is no "Add product" control anywhere outside
  // this gated area.
  // ============================================================

  // ------------------------------------------------------------
  // LOCAL DEVELOPMENT LOGIN ONLY — NOT REAL AUTHENTICATION.
  // This is a plain client-side string comparison. The "password"
  // below sits in this file's own source, so anyone who views source
  // or opens devtools can read it — or just call showAdminDashboard()
  // directly from the console and skip the login screen entirely.
  // There is no real security here. This exists purely so you can
  // click through the Admin Dashboard while testing on your own
  // machine. Phase 2 replaces this whole block with real server-side
  // auth (e.g. Supabase Auth) that a public visitor cannot bypass.
  // ------------------------------------------------------------
  var DEV_ADMIN_USERNAME = 'admin';
  var DEV_ADMIN_PASSWORD = 'admin';
  var ADMIN_SESSION_KEY = 'trahe_trove_admin_session_DEV_ONLY';

  var adminLoginScreen = document.getElementById('adminLoginScreen');
  var adminDashboard = document.getElementById('adminDashboard');
  var editingId = null;

  function showAdminLogin() {
    document.getElementById('adminUserInput').value = '';
    document.getElementById('adminPassInput').value = '';
    document.getElementById('adminLoginErr').textContent = '';
    adminDashboard.classList.remove('open');
    adminLoginScreen.classList.add('open');
    document.getElementById('adminUserInput').focus();
  }
  function showAdminDashboard() {
    adminLoginScreen.classList.remove('open');
    adminDashboard.classList.add('open');
    document.getElementById('dropNameInput').value = state.dropName || '';
    renderAll();
  }
  function closeAdminScreens() {
    adminLoginScreen.classList.remove('open');
    adminDashboard.classList.remove('open');
  }

  document.getElementById('openAdminLogin').addEventListener('click', function () {
    var alreadyIn = false;
    try { alreadyIn = sessionStorage.getItem(ADMIN_SESSION_KEY) === '1'; } catch (e) { /* storage unavailable */ }
    if (alreadyIn) { showAdminDashboard(); } else { showAdminLogin(); }
  });
  document.getElementById('adminLoginBack').addEventListener('click', closeAdminScreens);

  document.getElementById('adminLoginSubmit').addEventListener('click', function () {
    var user = document.getElementById('adminUserInput').value.trim();
    var pass = document.getElementById('adminPassInput').value;
    if (user === DEV_ADMIN_USERNAME && pass === DEV_ADMIN_PASSWORD) {
      try { sessionStorage.setItem(ADMIN_SESSION_KEY, '1'); } catch (e) { /* ignore */ }
      showAdminDashboard();
    } else {
      document.getElementById('adminLoginErr').textContent = 'Incorrect username or password.';
    }
  });

  document.getElementById('adminLogoutBtn').addEventListener('click', function () {
    try { sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch (e) { /* ignore */ }
    closeAdminScreens();
    showToast('Logged out.');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeBidModal();
    if (adminLoginScreen.classList.contains('open')) closeAdminScreens();
  });

  // ---------- dashboard tabs ----------
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    });
  });

  // ---------- proof & waybill uploads ----------
  loadProof();
  setDefaultWaybillDeleteDate();
  var waybillDeleteDateInput = document.getElementById('waybillDeleteDate');
  if (waybillDeleteDateInput) waybillDeleteDateInput.addEventListener('change', function () { try { localStorage.setItem(WAYBILL_DELETE_DATE_KEY, this.value); } catch (e) {} });
  // Keep the temporary waybill gallery clean even if the page stays open.
  setInterval(function () { if (purgeExpiredWaybills()) renderProof(); }, 60 * 60 * 1000);
  handleProofUpload('waybillUpload', 'waybills', 'Waybill');
  handleProofUpload('legitimacyUpload', 'legitimacy', 'Proof of shipment');
  renderProof();

  // ---------- drop name (lightweight stand-in for real multi-drop
  // management — see chat reply for the scoping note on this) ----------
  document.getElementById('dropNameInput').addEventListener('input', function () {
    state.dropName = this.value;
    save();
  });

  // ---------- product form (add + edit) ----------
  document.getElementById('pImage').addEventListener('change', function () {
    var f = this.files && this.files[0];
    var preview = document.getElementById('pImagePreview');
    if (!f) { preview.classList.remove('show'); return; }
    var reader = new FileReader();
    reader.onload = function (e) { preview.src = e.target.result; preview.classList.add('show'); };
    reader.readAsDataURL(f);
  });

  function setPriceFieldsLocked(locked) {
    ['pStartBid', 'pIncrement', 'pDurationValue', 'pDurationUnit'].forEach(function (id) {
      document.getElementById(id).disabled = locked;
    });
    document.getElementById('lockedFieldsNote').style.display = locked ? 'block' : 'none';
  }

  function resetProductForm() {
    editingId = null;
    document.getElementById('pName').value = '';
    document.getElementById('pSize').value = '';
    document.getElementById('pCondition').value = '';
    document.getElementById('pDescription').value = '';
    document.getElementById('pStartBid').value = '';
    document.getElementById('pIncrement').value = '50';
    document.getElementById('pDurationValue').value = '24';
    document.getElementById('pDurationUnit').value = 'hours';
    document.getElementById('pColor').value = '#4a5535';
    document.getElementById('pImage').value = '';
    document.getElementById('pImagePreview').classList.remove('show');
    document.getElementById('productFormErr').textContent = '';
    document.getElementById('productFormTitle').textContent = 'Add a hoodie';
    document.getElementById('productFormSubmit').textContent = 'Add to the bin';
    document.getElementById('productFormCancel').style.display = 'none';
    setPriceFieldsLocked(false);
  }
  document.getElementById('productFormCancel').addEventListener('click', resetProductForm);

  document.getElementById('productFormSubmit').addEventListener('click', function () {
    var name = document.getElementById('pName').value.trim();
    var size = document.getElementById('pSize').value.trim() || '—';
    var condition = document.getElementById('pCondition').value.trim() || '—';
    var description = document.getElementById('pDescription').value.trim() || 'No description yet';
    var startBid = Number(document.getElementById('pStartBid').value);
    var increment = Number(document.getElementById('pIncrement').value) || 50;
    var durationValue = Number(document.getElementById('pDurationValue').value) || 24;
    var durationUnit = document.getElementById('pDurationUnit').value;
    var color = document.getElementById('pColor').value;
    var fileInput = document.getElementById('pImage');
    var errEl = document.getElementById('productFormErr');

    if (!name || !startBid) { errEl.textContent = 'Give the piece a name and a starting bid.'; return; }
    errEl.textContent = '';

    var ms = durationUnit === 'hours' ? durationValue * 3600000 : durationValue * 60000;

    function finishSave(imageData) {
      if (editingId) {
        var item = state.items.find(function (i) { return i.id === editingId; });
        if (item) {
          item.name = name; item.size = size; item.condition = condition;
          item.description = description; item.increment = increment; item.color = color;
          if (imageData !== undefined) item.image = imageData;
          if (item.status === 'not_started') {
            item.startPrice = startBid;
            item.currentBid = startBid;
            item.durationMs = ms;
            showToast('"' + name + '" updated.');
          } else {
            showToast('"' + name + '" updated (starting bid & duration unchanged — already started).');
          }
        }
      } else {
        state.items.unshift({
          id: 'p' + Date.now(),
          name: name, size: size, condition: condition, description: description,
          color: color, image: imageData || null,
          startPrice: startBid, increment: increment, durationMs: ms,
          status: 'not_started', startsAt: null, endsAt: null,
          currentBid: startBid, bidderName: null, bidderPhone: null, paid: false
        });
        showToast('"' + name + '" added — Not Started. Launch it from the Auctions tab.');
      }
      save();
      renderAll();
      resetProductForm();
    }

    if (fileInput.files && fileInput.files[0]) {
      var reader = new FileReader();
      reader.onload = function (e) { finishSave(e.target.result); };
      reader.readAsDataURL(fileInput.files[0]);
    } else {
      finishSave(undefined);
    }
  });

  function editProduct(item) {
    editingId = item.id;
    document.getElementById('pName').value = item.name;
    document.getElementById('pSize').value = item.size;
    document.getElementById('pCondition').value = item.condition || '';
    document.getElementById('pDescription').value = item.description || '';
    document.getElementById('pStartBid').value = item.startPrice;
    document.getElementById('pIncrement').value = item.increment;
    document.getElementById('pColor').value = item.color || '#4a5535';
    if (item.durationMs % 3600000 === 0) {
      document.getElementById('pDurationValue').value = item.durationMs / 3600000;
      document.getElementById('pDurationUnit').value = 'hours';
    } else {
      document.getElementById('pDurationValue').value = Math.round(item.durationMs / 60000);
      document.getElementById('pDurationUnit').value = 'minutes';
    }
    var preview = document.getElementById('pImagePreview');
    if (item.image) { preview.src = item.image; preview.classList.add('show'); }
    else { preview.classList.remove('show'); }
    document.getElementById('productFormErr').textContent = '';
    document.getElementById('productFormTitle').textContent = 'Edit hoodie';
    document.getElementById('productFormSubmit').textContent = 'Save changes';
    document.getElementById('productFormCancel').style.display = 'inline-block';
    setPriceFieldsLocked(item.status !== 'not_started');
    document.getElementById('panel-products').scrollIntoView({ behavior: 'smooth' });
  }

  function deleteProduct(item) {
    var msg = 'Delete "' + item.name + '"? This cannot be undone.';
    if (item.status === 'active' && item.bidderName) {
      msg = 'Delete "' + item.name + '"? It currently has a live bid from ' + item.bidderName + ' — deleting removes it entirely. This cannot be undone.';
    }
    if (!confirm(msg)) return;
    state.items = state.items.filter(function (i) { return i.id !== item.id; });
    save();
    renderAll();
    showToast('"' + item.name + '" deleted.');
  }

  // ---------- start auction(s) ----------
  function startAuction(item) {
    if (item.status !== 'not_started') return;
    var now = Date.now();
    item.status = 'active';
    item.startsAt = now;
    item.endsAt = now + (item.durationMs || DEFAULT_DURATION_MS);
    save();
    renderAll();
    showToast('"' + item.name + '" is now live.');
  }

  function startAllAuctions() {
    var pending = state.items.filter(function (i) { return i.status === 'not_started'; });
    if (!pending.length) { showToast('No pending auctions to start.'); return; }
    var ok = confirm(
      'Start all pending auctions?\n\n' +
      'This will start ' + pending.length + ' auction(s) that are currently Not Started. ' +
      'Each will begin now and run for its own configured duration (24h by default).'
    );
    if (!ok) return;
    var now = Date.now();
    pending.forEach(function (item) {
      item.status = 'active';
      item.startsAt = now;
      item.endsAt = now + (item.durationMs || DEFAULT_DURATION_MS);
    });
    save();
    renderAll();
    showToast('Started ' + pending.length + ' auction(s).');
  }
  document.getElementById('startAllBtn').addEventListener('click', startAllAuctions);

  // ---------- admin: products list ----------
  function renderAdminProductList() {
    var wrap = document.getElementById('productList');
    wrap.innerHTML = '';
    if (!state.items.length) {
      wrap.innerHTML = '<p class="empty-note">No hoodies yet — add one above.</p>';
      return;
    }
    state.items.forEach(function (item) {
      var statusLabel = item.status === 'not_started' ? 'Not Started' : item.status === 'active' ? 'Active' : 'Ended';
      var row = document.createElement('div');
      row.className = 'admin-row';

      var info = document.createElement('div');
      info.className = 'info';
      info.innerHTML = '<b>' + escapeHtml(item.name) + '</b><br><span class="meta">Size ' +
        escapeHtml(item.size) + ' · ' + peso(item.currentBid) + ' · ' + statusLabel + '</span>';

      var actions = document.createElement('div');
      actions.className = 'actions';
      var editBtn = document.createElement('button');
      editBtn.className = 'mini-btn'; editBtn.type = 'button'; editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', function () { editProduct(item); });
      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'mini-btn danger'; deleteBtn.type = 'button'; deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', function () { deleteProduct(item); });
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      row.appendChild(info);
      row.appendChild(actions);
      wrap.appendChild(row);
    });
  }

  // ---------- admin: auctions (Not Started / Active / Ended) ----------
  function renderAdminAuctionLists() {
    var notStartedWrap = document.getElementById('notStartedList');
    var activeWrap = document.getElementById('activeAuctionList');
    var endedWrap = document.getElementById('endedAuctionList');
    notStartedWrap.innerHTML = '';
    activeWrap.innerHTML = '';
    endedWrap.innerHTML = '';

    var notStarted = state.items.filter(function (i) { return i.status === 'not_started'; });
    var active = state.items.filter(function (i) { return i.status === 'active'; });
    var ended = state.items.filter(function (i) { return i.status === 'ended'; });

    document.getElementById('notStartedCount').textContent = notStarted.length;
    document.getElementById('activeCount').textContent = active.length;
    document.getElementById('endedCount').textContent = ended.length;

    if (!notStarted.length) { notStartedWrap.innerHTML = '<p class="empty-note">Nothing waiting to launch.</p>'; }
    notStarted.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'admin-row';
      var info = document.createElement('div');
      info.className = 'info';
      info.innerHTML = '<b>' + escapeHtml(item.name) + '</b><br><span class="meta">' +
        peso(item.startPrice) + ' starting · runs ' + fmtDuration(item.durationMs) + ' once started</span>';
      var btn = document.createElement('button');
      btn.className = 'mini-btn good'; btn.type = 'button'; btn.textContent = 'Start Auction';
      btn.addEventListener('click', function () { startAuction(item); });
      row.appendChild(info);
      row.appendChild(btn);
      notStartedWrap.appendChild(row);
    });

    if (!active.length) { activeWrap.innerHTML = '<p class="empty-note">No live auctions right now.</p>'; }
    active.forEach(function (item) {
      var remaining = item.endsAt - Date.now();
      var row = document.createElement('div');
      row.className = 'admin-row';
      row.innerHTML = '<div class="info"><b>' + escapeHtml(item.name) + '</b><br><span class="meta">' +
        peso(item.currentBid) + ' · ends in ' + fmtTime(remaining) + '</span></div>';
      activeWrap.appendChild(row);
    });

    if (!ended.length) { endedWrap.innerHTML = '<p class="empty-note">No ended auctions yet.</p>'; }
    ended.forEach(function (item) {
      var status = item.bidderName
        ? ('won by ' + escapeHtml(item.bidderName) + ' at ' + peso(item.currentBid) + (item.paid ? ' · paid ✓' : ' · payment pending'))
        : 'no bids';
      var row = document.createElement('div');
      row.className = 'admin-row';
      row.innerHTML = '<div class="info"><b>' + escapeHtml(item.name) + '</b><br><span class="meta">' + status + '</span></div>';
      endedWrap.appendChild(row);
    });
  }

  // ---------- admin: payments (manual confirmation) ----------
  function renderAdminPaymentList() {
    var wrap = document.getElementById('paymentList');
    wrap.innerHTML = '';
    var awaiting = state.items.filter(function (i) { return i.status === 'ended' && i.bidderName; });
    if (!awaiting.length) {
      wrap.innerHTML = '<p class="empty-note">Nothing awaiting payment yet.</p>';
      return;
    }
    awaiting.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'admin-row';
      var info = document.createElement('div');
      info.className = 'info';
      info.innerHTML = '<b>' + escapeHtml(item.name) + '</b><br><span class="meta">' +
        escapeHtml(item.bidderName) + ' · ' + escapeHtml(item.bidderPhone || '') + ' · ' + peso(item.currentBid) + '</span>';
      var btn = document.createElement('button');
      btn.className = item.paid ? 'mini-btn good' : 'mini-btn';
      btn.type = 'button';
      btn.textContent = item.paid ? 'Payment received ✓' : 'Mark payment received';
      btn.disabled = item.paid;
      btn.addEventListener('click', function () {
        item.paid = true;
        save();
        renderAll();
        showToast('Marked "' + item.name + '" as paid.');
      });
      row.appendChild(info);
      row.appendChild(btn);
      wrap.appendChild(row);
    });
  }

  // ---------- one render loop drives storefront + all admin panels ----------
  function renderAll() {
    render();
    renderAdminProductList();
    renderAdminAuctionLists();
    renderAdminPaymentList();
  }

  // ---------- clock ----------
  load();
  renderAll();
  setInterval(renderAll, 1000);
})();
