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

/** Baca semua baris jadi array objek. Setiap objek punya _row (nomor baris di Sheet). */
function readAll_(name) {
  if (ROWS_CACHE_[name]) return ROWS_CACHE_[name];
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
  ROWS_CACHE_[name] = out;
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
}

function appendMany_(name, objs) {
  if (!objs.length) return;
  const sh = sheet_(name);
  const rows = objs.map(function (o) { return toRow_(name, o); });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, SHEETS[name].length).setValues(rows);
  delete ROWS_CACHE_[name];
}

function updateRow_(name, rowNum, obj) {
  const sh = sheet_(name);
  sh.getRange(rowNum, 1, 1, SHEETS[name].length).setValues([toRow_(name, obj)]);
  delete ROWS_CACHE_[name];
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
