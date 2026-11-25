/**
 * Pintu masuk web app. Frontend (kas.vepracuan.com) mengirim POST berisi
 * {action, token, data}. Jawaban selalu {ok, data} atau {ok:false, error, code}.
 */

// Dibungkus fungsi supaya fungsi dari file lain sudah termuat saat dipanggil.
function routes_() { return {
  me:              { izin: 'lihat',      fn: function (d, u) { return bootstrap_(u); } },
  dashboard:       { izin: 'lihat',      fn: dashboard_ },
  listTransaksi:   { izin: 'lihat',      fn: listTransaksi_ },
  simpanTransaksi: { izin: 'tambah',     fn: simpanTransaksi_, tulis: true },
  simpanBanyak:    { izin: 'tambah',     fn: simpanBanyak_, tulis: true },
  pindahDana:      { izin: 'tambah',     fn: pindahDana_, tulis: true },
  hapusTransaksi:  { izin: 'hapus',      fn: hapusTransaksi_, tulis: true },
  getStok:         { izin: 'lihat',      fn: getStok_ },
  tambahStok:      { izin: 'tambah',     fn: tambahStok_, tulis: true },
  opname:          { izin: 'tambah',     fn: opname_, tulis: true },
  hapusStok:       { izin: 'hapus',      fn: hapusStok_, tulis: true },
  bacaFoto:        { izin: 'tambah',     fn: bacaFoto_ },
  uploadBukti:     { izin: 'tambah',     fn: uploadBukti_ },
  laporan:         { izin: 'lihat',      fn: laporan_ },
  syncLynk:        { izin: 'tambah',     fn: function () { return syncLynk_({}); } },
  getPengaturan:   { izin: 'pengaturan', fn: getPengaturan_ },
  simpanPengguna:  { izin: 'pengaturan', fn: simpanPengguna_, tulis: true },
  simpanKategori:  { izin: 'pengaturan', fn: simpanKategori_, tulis: true },
  simpanSetting:   { izin: 'pengaturan', fn: simpanSetting_, tulis: true },
  ujiLynk:         { izin: 'pengaturan', fn: ujiLynk_ },
  isiLynkSejak:    { izin: 'pengaturan', fn: function (d) { return syncLynk_({ dari: d.dari }); } },
  lihatLog:        { izin: 'pengaturan', fn: lihatLog_ },
}; }

function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    out = { ok: true, data: route_(req) };
    // Kirim peran terbaru di setiap jawaban, supaya tampilan langsung menyesuaikan kalau peran diubah.
    if (USER_SAAT_INI_) out.user = publicUser_(USER_SAAT_INI_);
  } catch (err) {
    if (!err.userMsg) console.error(err && err.stack ? err.stack : err);
    out = {
      ok: false,
      error: err.userMsg || 'Terjadi kesalahan di server. Coba lagi sebentar lagi. Kalau masih gagal, kabari owner.',
      code: err.code || '',
    };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, app: 'Kas VepraCuan' }))
    .setMimeType(ContentService.MimeType.JSON);
}

let USER_SAAT_INI_ = null;

function route_(req) {
  if (req.action === 'login') return login_(req.data || {});
  if (req.action === 'logout') return logout_(req.token);
  const user = requireUser_(req.token);
  USER_SAAT_INI_ = user;
  const all = routes_();
  const r = Object.prototype.hasOwnProperty.call(all, req.action) ? all[req.action] : null;
  if (!r) throw userErr_('Perintah tidak dikenal. Coba muat ulang halaman.');
  if (!can_(user, r.izin)) throw userErr_('Kamu tidak punya izin untuk melakukan ini.');
  if (!r.tulis) return r.fn(req.data || {}, user);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw userErr_('Server sedang sibuk menyimpan data lain. Coba lagi beberapa detik lagi.');
  try {
    return r.fn(req.data || {}, user);
  } finally {
    lock.releaseLock();
  }
}

function bootstrap_(u) {
  return {
    user: publicUser_(u),
    kategori: readAll_('Kategori').filter(function (k) { return String(k.aktif).toUpperCase() !== 'FALSE'; })
      .map(function (k) { return { nama: k.nama, jenis: k.jenis, hitung_laba: isTrue_(k.hitung_laba) }; }),
    akun: readAll_('Akun').filter(function (a) { return String(a.aktif).toUpperCase() !== 'FALSE'; })
      .map(function (a) { return a.nama; }),
    batas_stok: num_(getSetting_('batas_stok')),
    punya_gemini: !!prop_('GEMINI_API_KEY'),
  };
}
