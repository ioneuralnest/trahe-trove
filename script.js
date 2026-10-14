(async function () {

  // ============================================================
  // SUPABASE CONNECTION
  // ============================================================

  var SUPABASE_URL = 'https://kmxmxmcoibdqstdqaoql.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fAE0svxCvFJhxAChgKgRyw_WY29obiN';

  var supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

console.log(
  'Supabase key type:',
  SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')
    ? 'Modern publishable key'
    : SUPABASE_PUBLISHABLE_KEY.startsWith('eyJ')
    ? 'Legacy JWT-style key'
    : 'Unknown key format'
);

supabaseClient.auth.getSession().then(({ data, error }) => {
  console.log(
    'Supabase session:',
    error ? 'Error' : data.session ? 'Authenticated' : 'Anonymous'
  );
});

  // ============================================================
  // CUSTOMER FACEBOOK LOGIN
  // ============================================================

  async function signInWithFacebook() {
    var redirectTo =
      window.location.origin + window.location.pathname;

    var result = await supabaseClient.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: redirectTo
      }
    });

    if (result.error) {
      console.error('Facebook sign-in failed:', result.error);
      showToast('Facebook sign-in failed. Please try again.');
    }
  }

  function updateCustomerAuthUI(session) {
    var loginBtn = document.getElementById('facebookLoginBtn');
    var logoutBtn = document.getElementById('facebookLogoutBtn');
    var customerName = document.getElementById('customerName');

    if (!loginBtn || !logoutBtn || !customerName) return;

    if (session && session.user) {
      var user = session.user;

      var name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.user_name ||
        user.email ||
        'Facebook customer';

      customerName.textContent = 'Hi, ' + name;
      customerName.hidden = false;

      loginBtn.hidden = true;
      logoutBtn.hidden = false;
    } else {
      customerName.textContent = '';
      customerName.hidden = true;

      loginBtn.hidden = false;
      logoutBtn.hidden = true;
    }
  }

  var facebookLoginBtn =
    document.getElementById('facebookLoginBtn');

  var facebookLogoutBtn =
    document.getElementById('facebookLogoutBtn');

  if (facebookLoginBtn) {
    facebookLoginBtn.addEventListener('click', signInWithFacebook);
  }

  if (facebookLogoutBtn) {
    facebookLogoutBtn.addEventListener('click', async function () {
      var result = await supabaseClient.auth.signOut();

      if (result.error) {
        console.error('Facebook logout failed:', result.error);
        showToast('Could not log out. Please try again.');
        return;
      }

      updateCustomerAuthUI(null);
    });
  }

  supabaseClient.auth.onAuthStateChange(function (event, session) {
    updateCustomerAuthUI(session);
  });

  supabaseClient.auth.getSession().then(function (result) {
    if (result.error) {
      console.error('Could not load customer session:', result.error);
      return;
    }

    updateCustomerAuthUI(result.data.session);
  });

supabaseClient.auth.getSession().then(function (result) {
  if (result.error) {
    console.error('Supabase connection failed:', result.error);
  } else {
    console.log('✅ Supabase connection successful!');
  }
});

  var SITE_URL = 'https://trahetrove.com';

  var STORAGE_KEY = 'trahe_trove_state_v1';
  var DEFAULT_DURATION_MS = 24 * 3600000;
  var state = {
  items: [],
  adminOrders: [],
  dropName: 'September Hoodie Drop'
};
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

  function dbToItem(row) {
    return {
      id: row.id,
      name: row.name,
      size: row.size,
      condition: row.condition,
      description: row.description,
      color: row.color,
      image: row.image_url,
      startPrice: Number(row.start_price),
      increment: Number(row.increment),
      durationMs: Number(row.duration_ms),
      status: row.status,
      startsAt: row.starts_at ? new Date(row.starts_at).getTime() : null,
      endsAt: row.ends_at ? new Date(row.ends_at).getTime() : null,
      currentBid: row.current_bid == null
  ? Number(row.start_price)
  : Number(row.current_bid),
bidCount: Number(row.bid_count) || 0,
      bidderName: row.bidder_name,
      bidderPhone: row.bidder_phone,
      paid: !!row.paid
    };
  }

  function itemToDb(item) {
    return {
      id: item.id,
      name: item.name,
      size: item.size || '—',
      condition: item.condition || '—',
      description: item.description || 'No description yet',
      color: item.color || null,
      image_url: item.image || null,
      start_price: Number(item.startPrice) || 0,
      increment: Number(item.increment) || 50,
      duration_ms: Number(item.durationMs) || DEFAULT_DURATION_MS,
      status: item.status || 'not_started',
      starts_at: item.startsAt
        ? new Date(item.startsAt).toISOString()
        : null,
      ends_at: item.endsAt
        ? new Date(item.endsAt).toISOString()
        : null,
      current_bid: Number(item.currentBid) || Number(item.startPrice) || 0,
      bidder_name: item.bidderName || null,
      bidder_phone: item.bidderPhone || null,
      paid: !!item.paid,
      drop_name: state.dropName || 'September Hoodie Drop'
    };
  }

  function itemToProductEdit(item) {
  var row = {
    name: item.name,
    size: item.size || '—',
    condition: item.condition || '—',
    description: item.description || 'No description yet',
    color: item.color || null,
    image_url: item.image || null
  };

  // Only include auction settings before the auction starts.
  if (item.status === 'not_started') {
    row.start_price = item.startPrice;
    row.increment = item.increment;
    row.duration_ms = item.durationMs;
    row.current_bid = item.currentBid;
  }

  return row;
}

async function updateProductDetails(item) {
  if (!(await checkAdminSession())) {
    throw new Error('Admin MFA verification required.');
  }

  var query = supabaseClient
    .from('products')
    .update(itemToProductEdit(item))
    .eq('id', item.id);

  // Auction settings must never overwrite an auction
  // that has already started in another browser tab.
  if (item.status === 'not_started') {
    query = query.eq('status', 'not_started');
  }

  var result = await query.select('id');

  if (result.error) {
    throw result.error;
  }

  if (!result.data || result.data.length !== 1) {
    throw new Error(
      'Product update was not confirmed. The auction may have started in another tab. Refresh and try again.'
    );
  }

  return result.data[0];
}

async function createProduct(item) {

  if (!(await checkAdminSession())) {
  throw new Error('Admin MFA verification required.');
}
  var row = {
    id: item.id,
    name: item.name,
    size: item.size,
    condition: item.condition,
    description: item.description,
    color: item.color,
    image_url: item.image,
    start_price: item.startPrice,
    increment: item.increment,
    duration_ms: item.durationMs,
    status: 'not_started',
    starts_at: null,
    ends_at: null,
    current_bid: item.startPrice,
    bid_count: 0,
    drop_name: state.dropName || 'September Hoodie Drop'
  };

  var result = await supabaseClient
    .from('products')
    .insert(row)
    .select('id');

  if (result.error) {
    throw result.error;
  }

  if (!result.data || result.data.length !== 1) {
    throw new Error('Product creation was not confirmed.');
  }

  return result.data[0];
}

  async function load(requireFresh = false) {
    try {
      var result = await supabaseClient
        .from('products')
        .select(`
  id,
  name,
  size,
  condition,
  description,
  color,
  image_url,
  start_price,
  increment,
  duration_ms,
  status,
  starts_at,
  ends_at,
  current_bid,
  bid_count,
  drop_name,
  created_at
`)
        .order('created_at', { ascending: true });

      if (result.error) {
        console.error('Supabase product load failed:', result.error);
        if (requireFresh) {
  throw result.error;
}

        // Temporary fallback so the site does not become blank
        // if the database is unavailable.
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          state = JSON.parse(raw);
          return;
        }

        state = {
          items: defaultItems(),
          dropName: 'September Hoodie Drop'
        };
        return;
      }

      state.items = (result.data || []).map(dbToItem);

      if (result.data && result.data.length) {
        state.dropName =
          result.data[0].drop_name || 'September Hoodie Drop';
      } else {
        state.dropName = 'September Hoodie Drop';
      }

      console.log(
        '✅ Loaded ' + state.items.length + ' product(s) from Supabase.'
      );

    } catch (e) {
      console.error('Supabase load error:', e);
      if (requireFresh) {
  throw e;
}

      var fallback = localStorage.getItem(STORAGE_KEY);

      if (fallback) {
        state = JSON.parse(fallback);
      } else {
        state = {
          items: defaultItems(),
          dropName: 'September Hoodie Drop'
        };
      }
    }
  }

  function save() {
  // Local backup only.
  // Database changes must use dedicated, awaited Supabase operations.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Local backup failed:', error);
  }
}

async function updateDropName(dropName) {
  if (!(await checkAdminSession())) {
    throw new Error('Admin MFA verification required.');
  }

  const { error } = await supabaseClient
    .from('products')
    .update({ drop_name: dropName })
    .not('id', 'is', null);

  if (error) throw error;
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

  async function handleProofUpload(inputId, type, label) {
  var input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener('change', async function () {
    var files = Array.prototype.slice.call(input.files || []);
    if (!files.length) return;

    for (var i = 0; i < files.length; i++) {
      var file = files[i];

      if (!file.type.startsWith('image/')) {
        continue;
      }

      var uploadedAt = Date.now();
      var expiresAt = null;

      if (type === 'waybills') {
        var deleteDate = getWaybillDeleteDate();
        expiresAt = localDateTimeEnd(deleteDate);

        if (!expiresAt || expiresAt <= uploadedAt) {
          showToast('Please choose a future Waybill auto-delete date.');
          continue;
        }

        try {
          localStorage.setItem(WAYBILL_DELETE_DATE_KEY, deleteDate);
        } catch (err) {}
      }

      try {
        var bucketName = type === 'waybills'
  ? 'waybills'
  : 'legitimacy proofs';

var folderName = type === 'waybills'
  ? 'waybills'
  : 'proofs';

var filePath =
  folderName +
  '/' +
  crypto.randomUUID() +
  '-' +
  file.name;

        var uploadResult = await supabaseClient
          .storage
          .from(bucketName)
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false
          });

        if (uploadResult.error) {
          console.error(
            'Proof image upload failed:',
            uploadResult.error
          );
          showToast(
            'Proof image upload failed: ' +
            uploadResult.error.message
          );
          continue;
        }

        var bucketName = type === 'waybills'
  ? 'waybills'
  : 'legitimacy proofs';

var publicUrlResult = supabaseClient
  .storage
  .from(bucketName)
  .getPublicUrl(filePath);

var publicUrl = publicUrlResult.data.publicUrl;

if (type === 'waybills') {
  var waybillResult = await supabaseClient
    .from('waybills')
    .insert({
      storage_path: filePath,
      uploaded_at: new Date(uploadedAt).toISOString(),
      expires_at: new Date(expiresAt).toISOString()
    });

  if (waybillResult.error) {
    console.error(
      'Waybill record save failed:',
      waybillResult.error
    );
    showToast(
      'Waybill record save failed: ' +
      waybillResult.error.message
    );
    continue;
  }
}

proofState[type].unshift({
  image: publicUrl,
  caption: label + ' • ' + file.name,
  uploadedAt: uploadedAt,
  expiresAt: expiresAt
});

      } catch (error) {
        console.error('Proof image upload error:', error);
        showToast(
          'Proof image upload failed: ' + error.message
        );
      }
    }

    saveProof();
    renderProof();
    input.value = '';
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
      left.innerHTML = '<div class="bid-label">' + (item.bidCount > 0 ? 'current top bid' : 'starting bid') + '</div><div class="bid-amount">' + peso(item.currentBid) + '</div>';
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

  if (item.bidCount > 0) {
    wl.textContent =
      'Auction ended · Winning bid: ' +
      peso(item.currentBid) + '.';
  } else {
    wl.textContent =
      'No bids came in before time ran out.';
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
btn.textContent = 'Place Bid';
btn.addEventListener('click', function () {
  openBidModal(item.id);
});
tag.appendChild(btn);
      }

      board.appendChild(tag);
    });
    liveCountEl.textContent = liveCount;
  }

  // ---------- bid modal ----------
  var overlay = document.getElementById('bidOverlay');
  var activeItemId = null;

  // Verify the current user against Supabase Auth, not just a cached session.
  async function getFacebookBidder() {
    var result = await supabaseClient.auth.getUser();
    if (result.error || !result.data || !result.data.user) return null;
    var user = result.data.user;
    if (!(user.identities || []).some(function (identity) {
      return identity.provider === 'facebook';
    })) return null;
    return user;
  }

  async function openBidModal(id) {
    var item = state.items.find(function (i) { return i.id === id; });
    if (!item || item.status !== 'active') return;

    var bidder = await getFacebookBidder();
    if (!bidder) {
      showToast('Log in with Facebook to place a bid.');
      if (facebookLoginBtn) facebookLoginBtn.focus();
      return;
    }

    activeItemId = id;
    document.getElementById('modalItemName').textContent = item.name;
    document.getElementById('modalItemSub').textContent = 'Size ' + item.size + ' — ' + item.description;
    document.getElementById('modalCurrentBid').textContent = peso(item.currentBid);
    var minNext = item.currentBid + item.increment;
    document.getElementById('modalMinBid').textContent = peso(minNext);
    document.getElementById('bidAmount').value = minNext;
    document.getElementById('bidAmount').min = minNext;
    document.getElementById('modalErr').textContent = '';
    overlay.classList.add('open');
    if (window.turnstile) window.turnstile.reset();
  }
  function closeBidModal() { overlay.classList.remove('open'); activeItemId = null; }

  document.getElementById('closeModal').addEventListener('click', closeBidModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeBidModal(); });

  document.getElementById('submitBid').addEventListener('click', async function () {
  var item = state.items.find(function (i) {
    return i.id === activeItemId;
  });

  if (!item) {
    console.error('No active auction item.');
    return;
  }

  // Check again immediately before submission; the session may have expired.
  if (!(await getFacebookBidder())) {
    document.getElementById('modalErr').textContent =
      'Your Facebook session has expired. Please log in again.';
    return;
  }

  var turnstileToken = window.turnstile?.getResponse();

  if (!turnstileToken) {
    document.getElementById('modalErr').textContent =
      'Please complete the security verification.';
    return;
  }

  var amount = Number(
    document.getElementById('bidAmount').value
  );

  var minNext = item.currentBid + item.increment;

  var errEl = document.getElementById('modalErr');
  var submitBtn = document.getElementById('submitBid');

  errEl.textContent = '';

  if (!Number.isSafeInteger(amount) || amount < minNext) {
    errEl.textContent =
      'Bid must be at least ' + peso(minNext) + '.';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    var result = await supabaseClient.functions.invoke(
      'submit-bid',
      {
        body: {
          turnstileToken: turnstileToken,
          productId: item.id,
          amount: amount
        }
      }
    );

    if (result.error) {
      var message =
        'Could not place your bid. Please try again.';

      if (result.error.context) {
        try {
          var errorBody =
            await result.error.context.json();

          if (typeof errorBody.error === 'string') {
            message = errorBody.error;
          }
        } catch (parseError) {
          console.warn(
            'Could not read bid error response.'
          );
        }
      }

      throw new Error(message);
    }

    if (
      !result.data ||
      result.data.message !== 'Bid placed successfully'
    ) {
      throw new Error(
        'Bid confirmation was invalid. Please refresh the auction.'
      );
    }

    console.log('Bid accepted:', result.data);

    await load(true);
    renderAll();

    closeBidModal();

    showToast(
      'Your bid of ' +
        peso(amount) +
        ' on "' +
        item.name +
        '" was accepted.'
    );

  } catch (error) {
    console.error('Bid failed:', error);

    errEl.textContent =
      error.message ||
      'Could not place your bid. Please try again.';

  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Bid';
  }
});

  var ADMIN_EMAIL = 'ioneuralnest@gmail.com';

var adminLoginScreen = document.getElementById('adminLoginScreen');
var adminDashboard = document.getElementById('adminDashboard');
var adminLoginBack = document.getElementById('adminLoginBack');
var adminLoginSubmit = document.getElementById('adminLoginSubmit');
var adminLogoutBtn = document.getElementById('adminLogoutBtn');
var adminLoginErr = document.getElementById('adminLoginErr');
var adminUserInput = document.getElementById('adminUserInput');
var adminPassInput = document.getElementById('adminPassInput');

  // MFA verification screen
var adminMfaScreen =
  document.getElementById('adminMfaScreen');

var adminMfaCode =
  document.getElementById('adminMfaCode');

var adminMfaErr =
  document.getElementById('adminMfaErr');

var adminMfaSubmit =
  document.getElementById('adminMfaSubmit');

// MFA enrollment screen
var adminMfaEnrollScreen =
  document.getElementById('adminMfaEnrollScreen');

var adminMfaQr =
  document.getElementById('adminMfaQr');

var adminMfaEnrollCode =
  document.getElementById('adminMfaEnrollCode');

var adminMfaEnrollErr =
  document.getElementById('adminMfaEnrollErr');

var adminMfaEnrollSubmit =
  document.getElementById('adminMfaEnrollSubmit');

// Stores the current MFA factor during verification
var currentMfaFactorId = null;

function showAdminLogin() {
  adminLoginScreen.classList.add('open');
  adminDashboard.classList.remove('open');
  adminMfaScreen.classList.remove('open');
  adminMfaEnrollScreen.classList.remove('open');

  adminLoginErr.textContent = '';
  adminPassInput.value = '';
}

function showAdminDashboard() {
  adminLoginScreen.classList.remove('open');
  adminDashboard.classList.add('open');

  adminLoginErr.textContent = '';

  loadAdminProducts().catch(function (error) {
    console.error('Failed to load admin products:', error);
    alert(
      'Could not load admin products. Please check your session and try again.'
    );
  });

  loadAdminOrders().catch(function (error) {
    console.error('Failed to load admin orders:', error);

    var errEl = document.getElementById('ordersErr');

    if (errEl) {
      errEl.textContent =
        'Could not load orders. Please refresh and try again.';
    }
  });
}

async function checkAdminSession() {
  var result = await supabaseClient.auth.getUser();

  if (result.error || !result.data.user) {
    return false;
  }

  var user = result.data.user;

  var email = (user.email || '').toLowerCase().trim();
  var allowedEmail = ADMIN_EMAIL.toLowerCase().trim();

  if (email !== allowedEmail) {
    await supabaseClient.auth.signOut({ scope: 'local' });
    return false;
  }

  // Require completed MFA verification.
  var aalResult =
    await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aalResult.error) {
    console.error('MFA check failed:', aalResult.error);
    return false;
  }

  return aalResult.data.currentLevel === 'aal2';
}

async function loadAdminProducts() {
  if (!(await checkAdminSession())) {
    throw new Error('Admin MFA verification required.');
  }

  const { data, error } = await supabaseClient
  .rpc('get_admin_products');

  if (error) {
    throw error;
  }

  state.items = (data || []).map(dbToItem);
  renderAll();
}

async function loadAdminOrders() {
  if (!(await checkAdminSession())) {
    throw new Error('Admin MFA verification required.');
  }

  var result = await supabaseClient
    .rpc('get_admin_orders');

  if (result.error) {
    throw result.error;
  }

  renderAdminOrders(result.data || []);
}

function renderAdminOrders(orders) {
  var el = document.getElementById('adminOrdersList');
  var errEl = document.getElementById('ordersErr');

  if (!el) return;

  if (errEl) {
    errEl.textContent = '';
  }

  if (!orders || !orders.length) {
    el.innerHTML =
      '<div class="placeholder-note">' +
      'No orders yet. When an auction ends with a valid Facebook customer, ' +
      'the winning order will appear here.' +
      '</div>';
    return;
  }

  el.innerHTML = orders.map(function (order) {
    var created = order.created_at
      ? new Date(order.created_at).toLocaleString()
      : '—';

    var status = order.status || 'pending';

    return (
      '<article class="admin-order-card">' +

        '<div class="admin-order-main">' +
          '<h3>' +
            escapeHtml(order.product_name || 'Unnamed product') +
          '</h3>' +

          '<div class="admin-order-meta">' +
            '<span>Size: <b>' +
              escapeHtml(order.product_size || '—') +
            '</b></span>' +

            '<span>Winning bid: <b>' +
              peso(Number(order.winning_bid || 0)) +
            '</b></span>' +

            '<span>Status: <b>' +
              escapeHtml(status) +
            '</b></span>' +
          '</div>' +
        '</div>' +

        '<div class="admin-order-buyer">' +
          '<strong>Customer</strong>' +

          '<div>' +
            escapeHtml(order.buyer_name || 'Facebook customer') +
          '</div>' +

          '<div class="field-note">' +
            escapeHtml(order.buyer_email || 'Facebook account') +
          '</div>' +
        '</div>' +

        '<div class="admin-order-date">' +
          escapeHtml(created) +
        '</div>' +

      '</article>'
    );
  }).join('');
}

/* Open Admin Login */

document.getElementById('openAdminLogin').addEventListener('click', async function () {
  var isAdmin = await checkAdminSession();

  if (isAdmin) {
    showAdminDashboard();
  } else {
    showAdminLogin();
  }
});


/* Back to store */

adminLoginBack.addEventListener('click', function () {
  adminLoginScreen.classList.remove('open');
  adminLoginErr.textContent = '';
});


/* Login */

adminLoginSubmit.addEventListener('click', async function () {
  var email = adminUserInput.value.trim().toLowerCase();
  var password = adminPassInput.value;

  adminLoginErr.textContent = '';

  if (!email || !password) {
    adminLoginErr.textContent = 'Please enter your email and password.';
    return;
  }

  if (email !== ADMIN_EMAIL.toLowerCase().trim()) {
    adminLoginErr.textContent = 'This account is not authorized for admin access.';
    return;
  }

  adminLoginSubmit.disabled = true;
  adminLoginSubmit.textContent = 'Logging in...';

  try {
    var result = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (result.error) {
      console.error('Supabase login failed:', result.error);
      adminLoginErr.textContent = 'Incorrect email or password.';
      return;
    }

    var aalResult =
  await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();

if (aalResult.error) {
  adminLoginErr.textContent =
    'Unable to verify account security.';
  await supabaseClient.auth.signOut();
  return;
}

if (aalResult.data.currentLevel === 'aal2') {
  showAdminDashboard();

} else if (aalResult.data.nextLevel === 'aal2') {
  // MFA is enrolled but verification is required.
  var factorsResult =
    await supabaseClient.auth.mfa.listFactors();

  if (factorsResult.error) {
    throw factorsResult.error;
  }

  var totpFactor = factorsResult.data.totp[0];

  if (!totpFactor) {
    throw new Error('No verified authenticator found.');
  }

  currentMfaFactorId = totpFactor.id;
  showAdminMfaScreen();

} else {
  // No MFA enrolled yet.
  await startAdminMfaEnrollment();
}

  } catch (error) {
    console.error('Unexpected login error:', error);
    adminLoginErr.textContent = 'Login failed. Please try again.';
  } finally {
    adminLoginSubmit.disabled = false;
    adminLoginSubmit.textContent = 'Log In';
  }
}); // End login handler; MFA listeners must be registered at startup.

function showAdminMfaScreen() {
  adminLoginScreen.classList.remove('open');
  adminDashboard.classList.remove('open');
  adminMfaEnrollScreen.classList.remove('open');

  adminMfaScreen.classList.add('open');

  adminMfaErr.textContent = '';
  adminMfaCode.value = '';
}

function showAdminMfaEnrollScreen() {
  adminLoginScreen.classList.remove('open');
  adminDashboard.classList.remove('open');
  adminMfaScreen.classList.remove('open');

  adminMfaEnrollScreen.classList.add('open');

  adminMfaEnrollErr.textContent = '';
  adminMfaEnrollCode.value = '';
}
  async function startAdminMfaEnrollment() {
  try {
    var result = await supabaseClient.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Trahe Trove Admin'
    });

    if (result.error) {
      throw result.error;
    }

    currentMfaFactorId = result.data.id;

    // Display the QR code supplied by Supabase.
    var qrImage = document.createElement('img');
    qrImage.src = result.data.totp.qr_code;
    qrImage.alt = 'Authenticator setup QR code';
    qrImage.style.maxWidth = '220px';
    qrImage.style.width = '100%';

    adminMfaQr.replaceChildren(qrImage);

    showAdminMfaEnrollScreen();

  } catch (error) {
    console.error('MFA enrollment failed:', error);

    adminLoginErr.textContent =
      'Could not start two-factor authentication setup.';
  }
}
  adminMfaSubmit.addEventListener('click', async function () {
  var code = adminMfaCode.value.trim();

  adminMfaErr.textContent = '';

  if (!/^\d{6}$/.test(code)) {
    adminMfaErr.textContent =
      'Please enter a valid 6-digit code.';
    return;
  }

  if (!currentMfaFactorId) {
    adminMfaErr.textContent =
      'Please sign in again.';
    return;
  }

  adminMfaSubmit.disabled = true;
  adminMfaSubmit.textContent = 'Verifying...';

  try {
    var result =
      await supabaseClient.auth.mfa.challengeAndVerify({
        factorId: currentMfaFactorId,
        code: code
      });

    if (result.error) {
      throw result.error;
    }

    var aalResult =
      await supabaseClient.auth.mfa
        .getAuthenticatorAssuranceLevel();

    if (
      aalResult.error ||
      aalResult.data.currentLevel !== 'aal2'
    ) {
      throw new Error('MFA verification failed.');
    }

    currentMfaFactorId = null;
    adminMfaCode.value = '';

    adminMfaScreen.classList.remove('open');
    showAdminDashboard();

  } catch (error) {
    console.error('MFA verification failed:', error);

    adminMfaErr.textContent =
      'Invalid or expired code. Please try again.';

  } finally {
    adminMfaSubmit.disabled = false;
    adminMfaSubmit.textContent = 'Verify Code';
  }
});
  adminMfaEnrollSubmit.addEventListener('click', async function () {
  var code = adminMfaEnrollCode.value.trim();

  adminMfaEnrollErr.textContent = '';

  if (!/^\d{6}$/.test(code)) {
    adminMfaEnrollErr.textContent =
      'Please enter a valid 6-digit code.';
    return;
  }

  if (!currentMfaFactorId) {
    adminMfaEnrollErr.textContent =
      'Please restart MFA setup.';
    return;
  }

  adminMfaEnrollSubmit.disabled = true;

  try {
    var result = await supabaseClient.auth.mfa.challengeAndVerify({
      factorId: currentMfaFactorId,
      code: code
    });

    if (result.error) {
      throw result.error;
    }

    var aalResult =
      await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalResult.error ||
        aalResult.data.currentLevel !== 'aal2') {
      throw new Error('MFA verification was not completed.');
    }

    currentMfaFactorId = null;
    adminMfaQr.replaceChildren();
    adminMfaEnrollCode.value = '';

    adminMfaEnrollScreen.classList.remove('open');
    showAdminDashboard();

  } catch (error) {
    console.error('MFA activation failed:', error);
    adminMfaEnrollErr.textContent =
      'Invalid code or verification failed. Please try again.';
  } finally {
    adminMfaEnrollSubmit.disabled = false;
  }
});

adminMfaCode.addEventListener('keydown', function (event) {
  if (event.key === 'Enter') adminMfaSubmit.click();
});
adminMfaEnrollCode.addEventListener('keydown', function (event) {
  if (event.key === 'Enter') adminMfaEnrollSubmit.click();
});

/* Allow Enter key to submit login */

adminPassInput.addEventListener('keydown', function (event) {
  if (event.key === 'Enter') {
    adminLoginSubmit.click();
  }
});


/* Logout */

adminLogoutBtn.addEventListener('click', async function () {
  var result = await supabaseClient.auth.signOut({
    scope: 'local'
  });

  if (result.error) {
    console.error('Supabase logout failed:', result.error);
  }

  adminDashboard.classList.remove('open');
  adminLoginScreen.classList.remove('open');
  adminMfaScreen.classList.remove('open');
  adminMfaEnrollScreen.classList.remove('open');
  currentMfaFactorId = null;
  adminMfaQr.replaceChildren();

  adminUserInput.value = '';
  adminPassInput.value = '';
  adminLoginErr.textContent = '';
});
  // ---------- dashboard tabs ----------
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');

var panel = document.getElementById(
  'panel-' + btn.dataset.tab
);

panel.classList.add('active');

if (btn.dataset.tab === 'orders') {
  loadAdminOrders().catch(function (error) {
    console.error('Order load failed:', error);

    var errEl = document.getElementById('ordersErr');

    if (errEl) {
      errEl.textContent =
        'Could not load orders. Please try again.';
    }
  });
}
    });
  });

  var refreshOrdersBtn =
  document.getElementById('refreshOrdersBtn');

if (refreshOrdersBtn) {
  refreshOrdersBtn.addEventListener('click', function () {
    refreshOrdersBtn.disabled = true;
    refreshOrdersBtn.textContent = 'Refreshing...';

    loadAdminOrders()
      .catch(function (error) {
        console.error('Order refresh failed:', error);

        var errEl = document.getElementById('ordersErr');

        if (errEl) {
          errEl.textContent =
            'Could not refresh orders. Please try again.';
        }
      })
      .finally(function () {
        refreshOrdersBtn.disabled = false;
        refreshOrdersBtn.textContent = 'Refresh orders';
      });
  });
}

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
  document.getElementById('dropNameInput').addEventListener('change', async function () {
  var input = this;
  var newDropName = input.value.trim();
  var previousDropName = state.dropName;

  input.disabled = true;

  try {
    await updateDropName(newDropName);
    state.dropName = newDropName;
    save();
    showToast('Drop name saved to Supabase.');
  } catch (error) {
    console.error('Drop name update failed:', error);
    input.value = previousDropName;
    showToast('Could not save drop name. Please try again.');
  } finally {
    input.disabled = false;
  }
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

  var editingId = null;
  
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

  var productSaveInProgress = false;
  document.getElementById('productFormSubmit').addEventListener('click', async function () {
    var name = document.getElementById('pName').value.trim();
    var size = document.getElementById('pSize').value.trim() || '—';
    var condition = document.getElementById('pCondition').value.trim() || '—';
    var description = document.getElementById('pDescription').value.trim() || 'No description yet';
    var startBid = Number(document.getElementById('pStartBid').value);
    var increment = Number(document.getElementById('pIncrement').value);
    var durationValue = Number(document.getElementById('pDurationValue').value);
    var durationUnit = document.getElementById('pDurationUnit').value;
    var color = document.getElementById('pColor').value;
    var fileInput = document.getElementById('pImage');
    var errEl = document.getElementById('productFormErr');
    if (productSaveInProgress) {
  return;
}

productSaveInProgress = true;

var productSubmitBtn = document.getElementById('productFormSubmit');
productSubmitBtn.disabled = true;

    if (!name || !Number.isFinite(startBid) || startBid <= 0) {
  errEl.textContent = 'Give the piece a name and a positive starting bid.';
  productSaveInProgress = false;
  productSubmitBtn.disabled = false;
  return;
}

if (
  !Number.isFinite(increment) ||
  increment <= 0 ||
  !Number.isFinite(durationValue) ||
  durationValue <= 0
) {
  errEl.textContent = 'Increment and duration must be positive.';
  productSaveInProgress = false;
  productSubmitBtn.disabled = false;
  return;
}
    errEl.textContent = '';

    var ms = durationUnit === 'hours' ? durationValue * 3600000 : durationValue * 60000;

    
async function finishSave(imageData) {
  if (editingId) {
    var item = state.items.find(function (i) {
      return i.id === editingId;
    });

    if (!item) {
      showToast('Product not found. Please refresh and try again.');
      return;
    }

    // Preserve the original product until Supabase confirms the edit.
    var originalDetails = {
  name: item.name,
  size: item.size,
  condition: item.condition,
  description: item.description,
  color: item.color,
  image: item.image,
  startPrice: item.startPrice,
  increment: item.increment,
  durationMs: item.durationMs,
  currentBid: item.currentBid
};

    // Update only the editable product details.
    item.name = name;
    item.size = size;
    item.condition = condition;
    item.description = description;
    item.color = color;

    // Auction settings can only be edited before an auction starts.
if (item.status === 'not_started') {
  item.startPrice = startBid;
  item.increment = increment;
  item.durationMs = ms;
  item.currentBid = startBid;
}

    try {
      await updateProductDetails(item);
    } catch (error) {
      // Restore the previous details if Supabase rejects the update.
      Object.assign(item, originalDetails);

      console.error('Product update failed:', error);
      showToast('Product details could not be saved. Please try again.');
      return;
    }

    showToast('Product details saved to Supabase.');

  } else {
    
    // Create the product locally, but don't display it yet.
    var newItem = {
      id: crypto.randomUUID(),
      name: name,
      size: size,
      condition: condition,
      description: description,
      color: color,
      image: imageData || null,
      startPrice: startBid,
      increment: increment,
      durationMs: ms,
      status: 'not_started',
      startsAt: null,
      endsAt: null,
      currentBid: startBid,
      bidderName: null,
      bidderPhone: null,
      paid: false
    };

    try {
      // Wait for Supabase to confirm the new product.
      await createProduct(newItem);
    } catch (error) {
      console.error('Product creation failed:', error);
      showToast('Product could not be created. Please try again.');
      return;
    }

    // Only display the product after successful database creation.
    state.items.unshift(newItem);

    showToast('"' + name + '" added successfully.');
  }


  // Temporary local backup.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Local backup failed:', error);
  }

  renderAll();
  resetProductForm();
}

try {
   if (fileInput.files && fileInput.files[0]) {
  var file = fileInput.files[0];
  var filePath = 'products/' + crypto.randomUUID() + '-' + file.name;

  try {
    var uploadResult = await supabaseClient
      .storage
      .from('product images')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadResult.error) {
  console.error('Product image upload failed:', uploadResult.error);
  errEl.textContent = 'Image upload failed. Please try again.';

  productSaveInProgress = false;
  productSubmitBtn.disabled = false;
  return;
}

    var publicUrlResult = supabaseClient
      .storage
      .from('product images')
      .getPublicUrl(filePath);

    await finishSave(publicUrlResult.data.publicUrl);

  } catch (error) {
    console.error('Product image upload error:', error);
    errEl.textContent = 'Image upload failed: ' + (error.message || 'Please try again.');

    productSaveInProgress = false;
productSubmitBtn.disabled = false;
  }

} else {
  await finishSave(undefined);
}

} catch (error) {
  console.error('Unexpected product save error:', error);
  errEl.textContent =
    'Something went wrong while saving. Please try again.';
} finally {
  productSaveInProgress = false;
  productSubmitBtn.disabled = false;
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

var productDeletionInProgress = new Set();

  async function deleteProduct(item) {
  if (productDeletionInProgress.has(item.id)) return;

  var msg = 'Delete "' + item.name + '"? This cannot be undone.';

  if (item.status === 'active' && item.bidCount > 0) {
    msg = 'Delete "' + item.name +
      '"? This auction has bids. Deleting it cannot be undone.';
  }

  if (!confirm(msg)) return;

  // Acquire the lock before any asynchronous operation.
  productDeletionInProgress.add(item.id);

  try {
    if (!(await checkAdminSession())) {
      showToast('Admin MFA verification required.');
      return;
    }

    var result = await supabaseClient
      .from('products')
      .delete()
      .eq('id', item.id)
      .select('id');

    if (result.error) {
  if (result.error.code === '23503') {
    showToast('This product cannot be deleted because it has bids.');
    return;
  }

  throw result.error;
}

    if (!result.data || result.data.length !== 1) {
      throw new Error('Product deletion was not confirmed.');
    }

    state.items = state.items.filter(function (i) {
      return i.id !== item.id;
    });

    save();
    renderAll();
    showToast('"' + item.name + '" deleted.');

  } catch (error) {
    console.error('Product deletion failed:', error);
    showToast('Could not delete the product. Refresh and try again.');

  } finally {
    // Always release the lock, including after MFA failure.
    productDeletionInProgress.delete(item.id);
  }
}

  // ---------- start auction(s) ----------
  async function startAuction(item) {
  if (item.status !== 'not_started') return;

  var now = Date.now();
  var endsAt = now + (item.durationMs || DEFAULT_DURATION_MS);

  try {
    var result = await supabaseClient
      .from('products')
      .update({
        status: 'active',
        starts_at: new Date(now).toISOString(),
        ends_at: new Date(endsAt).toISOString()
      })
      .eq('id', item.id)
      .eq('status', 'not_started')
      .select('id');

    if (result.error) throw result.error;

    if (!result.data || result.data.length !== 1) {
      throw new Error('Auction was not started. Refresh and try again.');
    }

    item.status = 'active';
    item.startsAt = now;
    item.endsAt = endsAt;

    save();
    renderAll();
    showToast('"' + item.name + '" is now live.');
  } catch (error) {
    console.error('Auction start failed:', error);
    showToast('Could not start the auction. Please try again.');
  }
}

  async function startAllAuctions() {
  var pending = state.items.filter(function (i) {
    return i.status === 'not_started';
  });

  if (!pending.length) {
    showToast('No pending auctions to start.');
    return;
  }

  var ok = confirm(
    'Start all pending auctions?\n\n' +
    'This will start ' + pending.length + ' auction(s). ' +
    'Each will run for its configured duration.'
  );

  if (!ok) return;

  var started = 0;
  var failed = 0;

  for (var item of pending) {
    var now = Date.now();
    var endsAt = now + (item.durationMs || DEFAULT_DURATION_MS);

    try {
      var result = await supabaseClient
        .from('products')
        .update({
          status: 'active',
          starts_at: new Date(now).toISOString(),
          ends_at: new Date(endsAt).toISOString()
        })
        .eq('id', item.id)
        .eq('status', 'not_started')
        .select('id');

      if (result.error) throw result.error;

      if (!result.data || result.data.length !== 1) {
        throw new Error('Auction could not be started.');
      }

      item.status = 'active';
      item.startsAt = now;
      item.endsAt = endsAt;
      started++;
    } catch (error) {
      console.error('Failed to start auction:', item.name, error);
      failed++;
    }
  }

  save();
  renderAll();

  if (failed) {
    showToast(
      'Started ' + started + ' auction(s). ' +
      failed + ' failed. Refresh before trying again.'
    );
  } else {
    showToast('Started ' + started + ' auction(s).');
  }
}
  var startAllBtn = document.getElementById('startAllBtn');

startAllBtn.addEventListener('click', async function () {
  if (startAllBtn.disabled) return;

  startAllBtn.disabled = true;

  try {
    await startAllAuctions();
  } finally {
    startAllBtn.disabled = false;
  }
});

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
      btn.addEventListener('click', async function () {
  if (btn.disabled) return;

  btn.disabled = true;
  btn.textContent = 'Starting...';

  try {
    await startAuction(item);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Start Auction';
  }
});
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
btn.textContent = item.paid
  ? 'Mark as unpaid'
  : 'Mark payment received';
btn.disabled = false;

      btn.addEventListener('click', async function () {
  btn.disabled = true;

  try {

    if (!(await checkAdminSession())) {
  throw new Error('Admin MFA verification required.');
}
    var result = await supabaseClient
      .from('products')
      
.update({ paid: !item.paid })

      .eq('id', item.id)
      .eq('status', 'ended')
      
.eq('paid', item.paid)

      .select('id');

    if (result.error) throw result.error;

    if (!result.data || result.data.length !== 1) {
      throw new Error('Payment update was not confirmed.');
    }

    
item.paid = !item.paid;

    save();
    renderAll();
    
showToast(
  'Marked "' + item.name + '" as ' +
  (item.paid ? 'paid.' : 'unpaid.')
);

  } catch (error) {
    console.error('Payment update failed:', error);
    btn.disabled = false;
    showToast('Could not save payment confirmation. Refresh and try again.');
  }
});
      row.appendChild(info);
      row.appendChild(btn);
      wrap.appendChild(row);
    });
  }

  var auctionExpiryCheckRunning = false;

async function endExpiredAuctions() {
  if (auctionExpiryCheckRunning) return;
  auctionExpiryCheckRunning = true;

  try {
    // Auction finalization is handled securely by Supabase Cron.
    // The browser only refreshes the auction data.

    
if (!(await checkAdminSession())) return;

if (adminDashboard.classList.contains('open')) {
  await loadAdminProducts();
} else {
  await load(true);
  renderAll();
}


  } catch (error) {
    console.error('Auction refresh failed:', error);
  } finally {
    auctionExpiryCheckRunning = false;
  }
}
  // ---------- one render loop drives storefront + all admin panels ----------
  function renderAll() {
    render();
    renderAdminProductList();
    renderAdminAuctionLists();
    renderAdminPaymentList();
  }

  // ---------- clock ----------
   
await load();
renderAll();

// Automatically refresh auction data when a product changes.
supabaseClient
  .channel('trahe-auction-live')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'products'
    },
    async (payload) => {
      console.log('Live auction update:', payload.new.id);

      
try {
  if (
    adminDashboard.classList.contains('open') &&
    await checkAdminSession()
  ) {
    // Refresh admin data without losing payment details.
    await loadAdminProducts();
  } else {
    // Refresh public auction information.
    await load(true);
    renderAll();
  }
} catch (error) {
  console.error('Auction live refresh failed:', error);
}

    }
  )
  .subscribe((status) => {
    console.log('Auction Realtime status:', status);
  });

setInterval(renderAll, 1000);
setInterval(endExpiredAuctions, 30000);
})();


