/**
 * Login: Google Identity Services di browser → ID token dikirim ke sini →
 * diverifikasi ke Google → email dicocokkan dengan tab Pengguna →
 * dibuatkan token sesi (disimpan sebagai hash di Script Properties).
 * Semua pengecekan izin terjadi di server.
 */

function verifyIdToken_(idToken) {
  const clientId = prop_('GOOGLE_CLIENT_ID');
  if (!clientId) throw userErr_('Login belum disiapkan (Client ID belum diisi). Hubungi owner.');
  if (!idToken) throw userErr_('Login Google gagal. Coba lagi.');
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' +
    encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw userErr_('Login Google tidak valid atau sudah kedaluwarsa. Coba masuk lagi.');
  const p = JSON.parse(res.getContentText());
  if (p.aud !== clientId) throw userErr_('Login Google tidak valid untuk aplikasi ini.');
  if (p.iss !== 'accounts.google.com' && p.iss !== 'https://accounts.google.com') {
    throw userErr_('Login Google tidak valid.');
  }
  if (String(p.email_verified) !== 'true') throw userErr_('Email Google kamu belum terverifikasi.');
  if (Number(p.exp) * 1000 < Date.now()) throw userErr_('Login kedaluwarsa. Coba masuk lagi.');
  return { email: String(p.email).toLowerCase(), nama: p.name || '' };
}

function hashToken_(token) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
  return 'sess_' + Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function getUser_(email) {
  email = String(email || '').toLowerCase().trim();
  const rows = readAll_('Pengguna');
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (String(r.email).toLowerCase().trim() === email && String(r.aktif).toUpperCase() !== 'FALSE') {
      const peran = String(r.peran).toLowerCase().trim();
      if (!PERAN[peran]) return null;
      return { email: email, nama: r.nama || email, peran: peran, izin: PERAN[peran] };
    }
  }
  return null;
}

function can_(user, izin) {
  return user && user.izin.indexOf(izin) >= 0;
}

function login_(data) {
  const g = verifyIdToken_(data.idToken);
  const user = getUser_(g.email);
  if (!user) {
    log_(g.email, 'login_ditolak', '', '', null);
    throw userErr_('Email ' + g.email + ' belum diberi izin masuk. Minta owner menambahkannya di menu Pengaturan.');
  }
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const exp = Date.now() + SESSION_DAYS * 86400000;
  props_().setProperty(hashToken_(token), JSON.stringify({ email: user.email, exp: exp }));
  bersihkanSesi_();
  log_(user.email, 'login', '', '', null);
  return { token: token, user: publicUser_(user) };
}

function logout_(token) {
  if (token) props_().deleteProperty(hashToken_(token));
  return true;
}

function requireUser_(token) {
  const authErr = userErr_('Sesi kamu sudah habis. Silakan masuk lagi.', 'AUTH');
  if (!token) throw authErr;
  const key = hashToken_(token);
  const raw = prop_(key);
  if (!raw) throw authErr;
  const s = JSON.parse(raw);
  if (!s.exp || s.exp < Date.now()) {
    props_().deleteProperty(key);
    throw authErr;
  }
  const user = getUser_(s.email);
  if (!user) {
    props_().deleteProperty(key);
    throw userErr_('Akses kamu sudah dicabut. Hubungi owner.', 'AUTH');
  }
  return user;
}

function publicUser_(u) {
  return { email: u.email, nama: u.nama, peran: u.peran, izin: u.izin };
}

/** Hapus sesi yang sudah kedaluwarsa. */
function bersihkanSesi_() {
  const all = props_().getProperties();
  const now = Date.now();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('sess_') !== 0) return;
    try {
      const s = JSON.parse(all[k]);
      if (!s.exp || s.exp < now) props_().deleteProperty(k);
    } catch (e) {
      props_().deleteProperty(k);
    }
  });
}

/** Cabut semua sesi milik satu email (dipakai saat pengguna dinonaktifkan). */
function cabutSesiEmail_(email) {
  const all = props_().getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('sess_') !== 0) return;
    try {
      if (JSON.parse(all[k]).email === email) props_().deleteProperty(k);
    } catch (e) { /* abaikan */ }
  });
}
