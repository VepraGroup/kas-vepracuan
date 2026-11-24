/**
 * SETUP — jalankan fungsi `setup` SEKALI dari editor Apps Script
 * (pilih "setup" di menu fungsi, lalu klik Run). Aman dijalankan ulang.
 *
 * Yang dilakukan:
 *  1. Membuat semua tab Sheet + judul kolom.
 *  2. Mengisi kategori, akun, pengaturan default, dan pengguna awal.
 *  3. Membuat folder Drive "Bukti Transaksi VepraCuan".
 *  4. Mengimpor data lama (hanya kalau tab Transaksi masih kosong) dan mengecek saldonya.
 *  5. Memasang trigger pencatatan Lynk tiap 10 menit.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  props_().setProperty('SHEET_ID', ss.getId());
  SS_CACHE_ = ss;

  // 1. Tab & kolom
  Object.keys(SHEETS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const cols = SHEETS[name];
    if (sh.getMaxColumns() < cols.length) sh.insertColumnsAfter(sh.getMaxColumns(), cols.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold')
      .setBackground('#14213d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    cols.forEach(function (c, i) {
      if (TEXT_COLUMNS.indexOf(c) >= 0) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  });
  // Hapus tab bawaan yang kosong (Sheet1 / Lembar1)
  ss.getSheets().forEach(function (sh) {
    if (!SHEETS[sh.getName()] && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
  Object.keys(ROWS_CACHE_).forEach(function (k) { delete ROWS_CACHE_[k]; });

  // 2. Data dasar
  const katAda = {};
  readAll_('Kategori').forEach(function (k) { katAda[k.nama] = true; });
  appendMany_('Kategori', DEFAULT_KATEGORI.filter(function (k) { return !katAda[k[0]]; }).map(function (k) {
    return { nama: k[0], jenis: k[1], hitung_laba: k[2] ? 'TRUE' : 'FALSE', aktif: 'TRUE' };
  }));
  const akunAda = {};
  readAll_('Akun').forEach(function (a) { akunAda[a.nama] = true; });
  appendMany_('Akun', DEFAULT_AKUN.filter(function (a) { return !akunAda[a]; }).map(function (a) {
    return { nama: a, aktif: 'TRUE' };
  }));
  const setAda = {};
  readAll_('Pengaturan').forEach(function (s) { setAda[s.kunci] = true; });
  appendMany_('Pengaturan', DEFAULT_PENGATURAN.filter(function (s) { return !setAda[s[0]]; }).map(function (s) {
    return { kunci: s[0], nilai: s[1], keterangan: s[2] };
  }));
  if (!readAll_('Pengguna').length && typeof MIGRASI_PENGGUNA !== 'undefined') {
    appendMany_('Pengguna', MIGRASI_PENGGUNA.map(function (p) {
      return { email: p.email.toLowerCase(), nama: p.nama, peran: p.peran, aktif: 'TRUE' };
    }));
  }

  // 3. Folder bukti
  let folderId = prop_('FOLDER_ID');
  if (!folderId) {
    const it = DriveApp.getFoldersByName('Bukti Transaksi VepraCuan');
    const folder = it.hasNext() ? it.next() : DriveApp.createFolder('Bukti Transaksi VepraCuan');
    folderId = folder.getId();
    props_().setProperty('FOLDER_ID', folderId);
  }
  readAll_('Pengguna').forEach(function (p) {
    if (String(p.aktif).toUpperCase() !== 'FALSE') bagikanAkses_(String(p.email).toLowerCase(), p.peran);
  });

  // 4. Migrasi data lama
  if (!readAll_('Transaksi').length && typeof MIGRASI_TRANSAKSI !== 'undefined') migrasiDataLama_();

  // 5. Trigger Lynk
  pasangTrigger();

  const tx = activeTx_();
  const saldo = saldoPerAkun_(tx);
  const total = Object.keys(saldo).reduce(function (s, k) { return s + saldo[k]; }, 0);
  Logger.log('SETUP SELESAI.');
  Logger.log('Transaksi: ' + tx.length + ' baris | Stok sekarang: ' + stokSekarang_() + ' kartu');
  Logger.log('Saldo per akun: ' + JSON.stringify(saldo));
  Logger.log('TOTAL KAS: Rp' + total.toLocaleString('id-ID') + (Math.abs(total - 1231317.56) < 0.01 ?
    '  ✔ COCOK dengan target Rp1.231.317,56' : '  (target awal impor: Rp1.231.317,56)'));
  Logger.log('Sheet: ' + ss.getUrl());
  Logger.log('Folder bukti: https://drive.google.com/drive/folders/' + folderId);
  Logger.log('Client ID terisi: ' + !!prop_('GOOGLE_CLIENT_ID') + ' | Kunci Gemini terisi: ' + !!prop_('GEMINI_API_KEY'));
}

function migrasiDataLama_() {
  const now = nowIso_();
  const tx = MIGRASI_TRANSAKSI.map(function (r) {
    const o = {
      id: r.id, tanggal: r.tanggal, jenis: r.jenis,
      kategori: r.kategori === 'Lain-lain' ? 'Pengeluaran Lain' : r.kategori,
      akun: r.akun, jumlah: Number(r.jumlah), keterangan: r.ket,
      sumber: 'lama:' + r.sumber, ref_id: r.gmail_id || '',
      dibuat_oleh: 'migrasi', dibuat_pada: now,
    };
    const m = String(r.ket).match(/^(.*?)\s+–\s+(.*?)\s+\(Lynk\)$/);
    if (m) {
      o.produk = m[1];
      o.pembeli = m[2];
      const q = m[1].match(/(\d+)\s*x\b/i);
      if (q && o.kategori === KATEGORI_KARTU) o.qty_kartu = Number(q[1]);
    }
    return o;
  });
  appendMany_('Transaksi', tx);
  const stok = MIGRASI_STOK.map(function (r) {
    const n = Number(r.jumlah);
    return {
      id: r.id, tanggal: r.tanggal, jenis: r.jenis,
      jumlah: r.jenis === 'masuk' ? Math.abs(n) : r.jenis === 'keluar' ? -Math.abs(n) : n,
      keterangan: r.ket, ref_transaksi: r.ref || '', dibuat_oleh: 'migrasi', dibuat_pada: now,
    };
  });
  appendMany_('Stok', stok);
  log_('migrasi', 'impor_data_lama', '', '', { transaksi: tx.length, stok: stok.length });
}

/** Pasang (ulang) trigger pencatatan Lynk tiap 10 menit. */
function pasangTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncLynkOtomatis') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncLynkOtomatis').timeBased().everyMinutes(10).create();
}

/** Jalankan dari editor untuk mengisi order Lynk yang terlewat sejak 7 Nov 2026. */
function isiLynkSejak7Nov() {
  const r = syncLynk_({ dari: '2026-11-07' });
  Logger.log(JSON.stringify(r));
}
