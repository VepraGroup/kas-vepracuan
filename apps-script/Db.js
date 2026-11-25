/** Pembantu baca/tulis Google Sheet. */

function props_() {
  return PropertiesService.getScriptProperties();
}

function prop_(key) {
  return props_().getProperty(key);
}

let SS_CACHE_ = null;
function ss_() {
  if (SS_CACHE_) return SS_CACHE_;
  const id = prop_('SHEET_ID');
  SS_CACHE_ = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  return SS_CACHE_;
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw userErr_('Tab "' + name + '" tidak ditemukan. Jalankan setup dulu.');
  return sh;
}

const ROWS_CACHE_ = {};

/* ---------- Cache cepat (CacheService) ----------
 * Membaca Sheet itu lambat (±0,2–1 detik per tab). Isi tiap tab disimpan di cache Google
 * dengan "versi". Setiap kali aplikasi menulis ke tab itu, versinya diganti sehingga cache lama
 * tidak dipakai lagi. Edit langsung di Google Sheet juga mengganti versi (lewat onEdit),
 * dan cache tetap kedaluwarsa sendiri setelah 5 menit sebagai pengaman.
 */
const CACHE_TTL_ = 300;
const TANPA_CACHE_ = { Log: true };
const KUNCI_TAB_ = { Transaksi: 'id', Stok: 'id', StokBahan: 'id', Pengguna: 'email', Kategori: 'nama',
  Bahan: 'kode', Pengaturan: 'kunci', Akun: 'nama', LynkProses: 'message_id' };

function versiTab_(name) { return prop_('VER_' + name) || '0'; }
function gantiVersi_(name) { props_().setProperty('VER_' + name, String(Date.now()) + Math.random().toString(36).slice(2, 5)); }

function cacheAmbil_(key) {
  try {
    const c = CacheService.getScriptCache();
    const n = Number(c.get(key));
    if (!(n > 0)) return null;
    const keys = [];
    for (let i = 0; i < n; i++) keys.push(key + ':' + i);
    const parts = c.getAll(keys);
    let s = '';
    for (let i = 0; i < keys.length; i++) {
      if (parts[keys[i]] == null) return null;
      s += parts[keys[i]];
    }
    return s;
  } catch (e) { return null; }
}

function cacheSimpan_(key, s) {
  try {
    const ukuran = 30000; // aman di bawah batas 100KB per nilai (huruf non-ASCII bisa 3 byte)
    const n = Math.max(1, Math.ceil(s.length / ukuran));
    if (n > 60) return; // terlalu besar untuk cache, baca langsung saja
    const obj = {};
    for (let i = 0; i < n; i++) obj[key + ':' + i] = s.substr(i * ukuran, ukuran);
    obj[key] = String(n);
    CacheService.getScriptCache().putAll(obj, CACHE_TTL_);
  } catch (e) { /* cache hanya untuk kecepatan; kalau gagal, abaikan */ }
}

/** Dijalankan otomatis oleh Google saat ada yang mengedit Sheet secara langsung. */
function onEdit(e) {
  try {
    const name = e && e.range ? e.range.getSheet().getName() : '';
    if (SHEETS[name]) gantiVersi_(name);
  } catch (err) { /* abaikan */ }
}

/** Baca semua baris jadi array objek. Setiap objek punya _row (nomor baris di Sheet). */
function readAll_(name) {
  if (ROWS_CACHE_[name]) return ROWS_CACHE_[name];
  const pakaiCache = !TANPA_CACHE_[name];
  const ckey = 'rows:' + name + ':' + versiTab_(name) + ':' + SHEETS[name].length;
  if (pakaiCache) {
    const s = cacheAmbil_(ckey);
    if (s) {
      try { ROWS_CACHE_[name] = JSON.parse(s); return ROWS_CACHE_[name]; } catch (e) { /* baca ulang */ }
    }
  }
  const out = bacaTab_(name);
  ROWS_CACHE_[name] = out;
  if (pakaiCache) cacheSimpan_(ckey, JSON.stringify(out));
  return out;
}

function bacaTab_(name) {
  const sh = sheet_(name);
  const cols = SHEETS[name];
  const last = sh.getLastRow();
  const out = [];
  if (last >= 2) {
    const vals = sh.getRange(2, 1, last - 1, cols.length).getValues();
    for (let i = 0; i < vals.length; i++) {
      const r = vals[i];
      if (r.every(function (v) { return v === '' || v === null; })) continue;
      const o = { _row: i + 2 };
      cols.forEach(function (c, j) { o[c] = normCell_(r[j]); });
      out.push(o);
    }
  }
  return out;
}

function normCell_(v) {
  if (v instanceof Date) {
    // Tanggal dari Sheet → teks
    const hasTime = v.getHours() || v.getMinutes() || v.getSeconds();
    return Utilities.formatDate(v, TZ, hasTime ? "yyyy-MM-dd'T'HH:mm:ss" : 'yyyy-MM-dd');
  }
  return v;
}

function toRow_(name, obj) {
  return SHEETS[name].map(function (c) {
    const v = obj[c];
    if (v === undefined || v === null) return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : '';
    return v;
  });
}

function append_(name, obj) {
  const sh = sheet_(name);
  sh.appendRow(toRow_(name, obj));
  delete ROWS_CACHE_[name];
  gantiVersi_(name);
}

function appendMany_(name, objs) {
  if (!objs.length) return;
  const sh = sheet_(name);
  const rows = objs.map(function (o) { return toRow_(name, o); });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, SHEETS[name].length).setValues(rows);
  delete ROWS_CACHE_[name];
  gantiVersi_(name);
}

function updateRow_(name, rowNum, obj) {
  const sh = sheet_(name);
  // Pengaman: pastikan baris yang ditimpa memang milik data ini (nomor baris bisa bergeser
  // kalau ada baris yang dihapus/disisipkan langsung di Sheet).
  const kunci = KUNCI_TAB_[name];
  if (kunci && obj[kunci] !== undefined && obj[kunci] !== '') {
    const kol = SHEETS[name].indexOf(kunci) + 1;
    const isi = normCell_(sh.getRange(rowNum, kol).getValue());
    if (String(isi) !== String(obj[kunci])) {
      const segar = bacaTab_(name).filter(function (r) { return String(r[kunci]) === String(obj[kunci]); })[0];
      if (!segar) throw userErr_('Data berubah di Google Sheet saat sedang disimpan. Muat ulang halaman lalu coba lagi.');
      rowNum = segar._row;
      obj._row = rowNum;
    }
  }
  sh.getRange(rowNum, 1, 1, SHEETS[name].length).setValues([toRow_(name, obj)]);
  delete ROWS_CACHE_[name];
  gantiVersi_(name);
}

function findBy_(name, key, value) {
  const rows = readAll_(name);
  for (let i = 0; i < rows.length; i++) if (String(rows[i][key]) === String(value)) return rows[i];
  return null;
}

function isTrue_(v) {
  return v === true || String(v).toUpperCase() === 'TRUE';
}

function nowIso_() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

function today_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function newId_(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), TZ, 'yyyyMMddHHmmss') + '-' +
    Math.random().toString(36).slice(2, 7);
}

function num_(v) {
  if (typeof v === 'number') return v;
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

/** Error yang pesannya aman ditampilkan ke pengguna. */
function userErr_(msg, code) {
  const e = new Error(msg);
  e.userMsg = msg;
  e.code = code || '';
  return e;
}

function getSetting_(key) {
  const r = findBy_('Pengaturan', 'kunci', key);
  if (r) return String(r.nilai);
  const d = DEFAULT_PENGATURAN.filter(function (x) { return x[0] === key; })[0];
  return d ? d[1] : '';
}

function setSetting_(key, value) {
  const r = findBy_('Pengaturan', 'kunci', key);
  if (r) {
    r.nilai = String(value);
    updateRow_('Pengaturan', r._row, r);
  } else {
    append_('Pengaturan', { kunci: key, nilai: String(value), keterangan: '' });
  }
}

function log_(email, aksi, tabel, id, detail) {
  try {
    append_('Log', {
      waktu: nowIso_(), email: email || 'sistem', aksi: aksi, tabel: tabel || '', id: id || '',
      detail: detail ? JSON.stringify(detail).slice(0, 45000) : '',
    });
  } catch (e) {
    console.error('Gagal menulis log: ' + e);
  }
}

function clean_(obj) {
  const o = {};
  Object.keys(obj).forEach(function (k) { if (k !== '_row') o[k] = obj[k]; });
  return o;
}
