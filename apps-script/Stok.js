/** Stok kartu. Setiap baris berisi perubahan (+/-). Stok sekarang = jumlah semua baris aktif. */

const JENIS_STOK = {
  produksi: { arah: 1, label: 'Produksi' },
  titip_kembali: { arah: 1, label: 'Titipan kembali' },
  masuk_lain: { arah: 1, label: 'Masuk lain' },
  cacat: { arah: -1, label: 'Cacat' },
  tes: { arah: -1, label: 'Dipakai tes' },
  titip: { arah: -1, label: 'Dititip' },
  keluar_lain: { arah: -1, label: 'Keluar lain' },
};

function activeStok_() {
  return readAll_('Stok').filter(function (r) { return !isTrue_(r.dihapus); });
}

function stokSekarang_() {
  return activeStok_().reduce(function (s, r) { return s + num_(r.jumlah); }, 0);
}

function getStok_() {
  const rows = activeStok_().slice();
  rows.sort(function (a, b) {
    if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1;
    return String(a.dibuat_pada) < String(b.dibuat_pada) ? 1 : -1;
  });
  const sekarang = stokSekarang_();
  const batas = num_(getSetting_('batas_stok'));
  const opname = rows.filter(function (r) { return r.jenis === 'opname'; })[0];
  return {
    sekarang: sekarang, batas: batas, rendah: sekarang < batas,
    opname_terakhir: opname ? opname.tanggal : '',
    riwayat: rows.slice(0, 200).map(clean_),
  };
}

function tambahStok_(d, u) {
  const j = JENIS_STOK[d.jenis];
  if (!j) throw userErr_('Pilih jenis perubahan stok.');
  const n = Math.round(num_(d.jumlah));
  if (!(n > 0)) throw userErr_('Jumlah kartu harus lebih dari 0.');
  const tanggal = String(d.tanggal || today_());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw userErr_('Tanggal belum diisi dengan benar.');
  const row = {
    id: newId_('stok'), tanggal: tanggal, jenis: d.jenis, jumlah: j.arah * n,
    keterangan: String(d.keterangan || '').trim().slice(0, 300) || j.label + ' ' + n + ' kartu',
    dibuat_oleh: u.email, dibuat_pada: nowIso_(),
  };
  append_('Stok', row);
  if (d.jenis === 'produksi') pakaiBahanProduksi_(row, n, d.reject, u);
  log_(u.email, 'tambah', 'Stok', row.id, row);
  return getStok_();
}

function opname_(d, u) {
  const hitung = Math.round(num_(d.hitung));
  if (d.hitung === '' || d.hitung === undefined || hitung < 0) throw userErr_('Isi jumlah kartu hasil hitung fisik.');
  const cur = stokSekarang_();
  const selisih = hitung - cur;
  const row = {
    id: newId_('stok'), tanggal: String(d.tanggal || today_()), jenis: 'opname', jumlah: selisih,
    keterangan: 'Stok opname: hitung fisik ' + hitung + ' kartu (catatan sistem ' + cur + ', selisih ' +
      (selisih >= 0 ? '+' : '') + selisih + ')' + (d.keterangan ? '. ' + String(d.keterangan).slice(0, 200) : ''),
    dibuat_oleh: u.email, dibuat_pada: nowIso_(),
  };
  append_('Stok', row);
  log_(u.email, 'opname', 'Stok', row.id, row);
  return getStok_();
}

function hapusStok_(d, u) {
  const r = findBy_('Stok', 'id', d.id);
  if (!r || isTrue_(r.dihapus)) throw userErr_('Catatan stok tidak ditemukan.');
  if (r.ref_transaksi && findBy_('Transaksi', 'id', r.ref_transaksi) &&
      !isTrue_(findBy_('Transaksi', 'id', r.ref_transaksi).dihapus)) {
    throw userErr_('Catatan ini berasal dari transaksi penjualan. Ubah atau hapus transaksinya saja.');
  }
  r.dihapus = 'TRUE';
  r.dihapus_oleh = u.email;
  r.dihapus_pada = nowIso_();
  updateRow_('Stok', r._row, r);
  hapusBahanRef_(r.id, u);
  log_(u.email, 'hapus', 'Stok', r.id, clean_(r));
  return getStok_();
}
