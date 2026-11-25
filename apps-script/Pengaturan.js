/** Halaman Pengaturan (hanya owner). */

const SETTING_BOLEH_UBAH = ['batas_stok', 'lynk_hari_peringatan', 'lynk_query', 'gemini_model'];

function getPengaturan_() {
  let lynk = null;
  try { lynk = JSON.parse(prop_('LYNK_STATUS') || 'null'); } catch (e) { lynk = null; }
  const trigger = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'syncLynkOtomatis'; });
  return {
    pengguna: readAll_('Pengguna').map(clean_),
    kategori: readAll_('Kategori').map(clean_),
    akun: readAll_('Akun').map(clean_),
    setting: readAll_('Pengaturan').filter(function (r) { return SETTING_BOLEH_UBAH.indexOf(r.kunci) >= 0; }).map(clean_),
    status: {
      client_id: !!prop_('GOOGLE_CLIENT_ID'),
      gemini: !!prop_('GEMINI_API_KEY'),
      trigger_lynk: trigger,
      lynk: lynk,
      sheet_url: ss_().getUrl(),
      folder_url: prop_('FOLDER_ID') ? 'https://drive.google.com/drive/folders/' + prop_('FOLDER_ID') : '',
    },
  };
}

function simpanPengguna_(d, u) {
  const email = String(d.email || '').toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw userErr_('Alamat email tidak valid.');
  const peran = String(d.peran || '').toLowerCase();
  if (!PERAN[peran]) throw userErr_('Pilih peran: owner atau admin.');
  const aktif = d.aktif === false || String(d.aktif).toUpperCase() === 'FALSE' ? 'FALSE' : 'TRUE';
  const rows = readAll_('Pengguna');
  const ex = rows.filter(function (r) { return String(r.email).toLowerCase() === email; })[0];
  const ownerAktifLain = rows.filter(function (r) {
    return String(r.email).toLowerCase() !== email && r.peran === 'owner' && String(r.aktif).toUpperCase() !== 'FALSE';
  }).length;
  if ((peran !== 'owner' || aktif === 'FALSE') && ex && ex.peran === 'owner' && ownerAktifLain === 0) {
    throw userErr_('Harus ada minimal satu owner aktif.');
  }
  const row = { email: email, nama: String(d.nama || '').trim().slice(0, 60) || email, peran: peran, aktif: aktif };
  if (ex) {
    updateRow_('Pengguna', ex._row, row);
    log_(u.email, 'ubah', 'Pengguna', email, { sebelum: clean_(ex), sesudah: row });
  } else {
    append_('Pengguna', row);
    log_(u.email, 'tambah', 'Pengguna', email, row);
  }
  if (aktif === 'FALSE') cabutSesiEmail_(email);
  bagikanAkses_(email, aktif === 'FALSE' ? '' : peran);
  return getPengaturan_();
}

/**
 * Hanya owner yang boleh membuka Google Sheet & seluruh folder foto bukti.
 * Admin / pengguna nonaktif dicabut aksesnya (admin tetap bisa melihat foto yang dia unggah sendiri).
 */
function bagikanAkses_(email, peran) {
  if (email === String(Session.getEffectiveUser().getEmail()).toLowerCase()) return;
  if (peran === 'owner') {
    try { folderBukti_().addViewer(email); } catch (e) { console.warn('Gagal berbagi folder ke ' + email + ': ' + e); }
    try { ss_().addEditor(email); } catch (e) { console.warn('Gagal berbagi Sheet ke ' + email + ': ' + e); }
    return;
  }
  try { folderBukti_().removeViewer(email); } catch (e) { /* memang belum punya akses */ }
  try { ss_().removeEditor(email); } catch (e) { /* memang belum punya akses */ }
  try { ss_().removeViewer(email); } catch (e) { /* memang belum punya akses */ }
}

function simpanKategori_(d, u) {
  const nama = String(d.nama || '').trim().slice(0, 60);
  if (!nama) throw userErr_('Nama kategori belum diisi.');
  const jenis = d.jenis === 'masuk' ? 'masuk' : d.jenis === 'keluar' ? 'keluar' : '';
  if (!jenis) throw userErr_('Pilih jenis kategori: pemasukan atau pengeluaran.');
  const ex = findBy_('Kategori', 'nama', nama);
  const row = { nama: nama, jenis: jenis, hitung_laba: d.hitung_laba === false ? 'FALSE' : 'TRUE',
    aktif: d.aktif === false ? 'FALSE' : 'TRUE' };
  if (ex) {
    if (ex.jenis !== jenis) throw userErr_('Kategori "' + nama + '" sudah ada dengan jenis lain.');
    updateRow_('Kategori', ex._row, row);
    log_(u.email, 'ubah', 'Kategori', nama, { sebelum: clean_(ex), sesudah: row });
  } else {
    append_('Kategori', row);
    log_(u.email, 'tambah', 'Kategori', nama, row);
  }
  return getPengaturan_();
}

function simpanSetting_(d, u) {
  if (SETTING_BOLEH_UBAH.indexOf(d.kunci) < 0) throw userErr_('Pengaturan ini tidak bisa diubah.');
  let nilai = String(d.nilai || '').trim();
  if (d.kunci === 'batas_stok' || d.kunci === 'lynk_hari_peringatan') {
    const n = Math.round(num_(nilai));
    if (!(n >= 0)) throw userErr_('Isi dengan angka.');
    nilai = String(n);
  }
  if (!nilai) throw userErr_('Nilai tidak boleh kosong.');
  const before = getSetting_(d.kunci);
  setSetting_(d.kunci, nilai);
  log_(u.email, 'ubah', 'Pengaturan', d.kunci, { sebelum: before, sesudah: nilai });
  return getPengaturan_();
}

function lihatLog_(d) {
  const rows = readAll_('Log').slice(-Math.min(Number(d.n) || 200, 1000)).reverse();
  return rows.map(clean_);
}
