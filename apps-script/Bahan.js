/**
 * Stok BAHAN BAKU (akrilik, chip NFC, stiker, polymailer, ...).
 *  - Beli bahan (transaksi pengeluaran yang diisi "bahan" + "qty_bahan") → stok bahan bertambah otomatis.
 *  - Produksi N kartu → bahan terpakai otomatis sesuai resep (per_kartu), plus reject per bahan.
 *  - Reject / rusak / opname bisa dicatat manual.
 * Setiap baris StokBahan berisi perubahan bertanda (+/-). Sisa = jumlah semua baris aktif.
 */

const JENIS_BAHAN = {
  beli: { arah: 1, label: 'Beli' },
  tambah: { arah: 1, label: 'Masuk lain' },
  reject: { arah: -1, label: 'Reject / rusak' },
  pakai: { arah: -1, label: 'Pakai lain' },
};

/** Buat tab & kolom baru otomatis saat versi skema berubah (tanpa perlu menjalankan setup lagi). */
function pastikanSkema_() {
  if (prop_('SKEMA_VERSI') === SKEMA_VERSI) return;
  const ss = ss_();
  Object.keys(SHEETS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const cols = SHEETS[name];
    if (sh.getMaxColumns() < cols.length) sh.insertColumnsAfter(sh.getMaxColumns(), cols.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#14213d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    cols.forEach(function (c, i) {
      if (TEXT_COLUMNS.indexOf(c) >= 0) sh.getRange(2, i + 1, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@');
    });
  });
  Object.keys(ROWS_CACHE_).forEach(function (k) { delete ROWS_CACHE_[k]; });
  if (!readAll_('Bahan').length) {
    appendMany_('Bahan', DEFAULT_BAHAN.map(function (b) {
      return { kode: b[0], nama: b[1], satuan: b[2], per_kartu: b[3], batas: b[4], aktif: 'TRUE' };
    }));
  }
  props_().setProperty('SKEMA_VERSI', SKEMA_VERSI);
}

function bahanAktif_() {
  return readAll_('Bahan').filter(function (b) { return String(b.aktif).toUpperCase() !== 'FALSE'; });
}

function bahanMap_() {
  const m = {};
  readAll_('Bahan').forEach(function (b) { m[String(b.kode)] = b; });
  return m;
}

function activeStokBahan_() {
  return readAll_('StokBahan').filter(function (r) { return !isTrue_(r.dihapus); });
}

function sisaBahan_() {
  const s = {};
  bahanAktif_().forEach(function (b) { s[b.kode] = 0; });
  activeStokBahan_().forEach(function (r) { s[r.bahan] = (s[r.bahan] || 0) + num_(r.jumlah); });
  return s;
}

/** Ringkasan bahan untuk halaman Stok → Bahan baku. */
function getBahan_() {
  const sisa = sisaBahan_();
  const bulan = today_().slice(0, 7);
  const rows = activeStokBahan_();
  const peta = bahanMap_();
  const daftar = bahanAktif_().map(function (b) {
    const r = { beli: 0, pakai: 0, reject: 0 };
    rows.forEach(function (x) {
      if (x.bahan !== b.kode || String(x.tanggal).slice(0, 7) !== bulan) return;
      const j = num_(x.jumlah);
      if (x.jenis === 'reject') r.reject += -j;
      else if (x.jenis === 'produksi' || x.jenis === 'pakai') r.pakai += -j;
      else if (j > 0 && x.jenis !== 'opname') r.beli += j;
    });
    const s = sisa[b.kode] || 0;
    return {
      kode: b.kode, nama: b.nama, satuan: b.satuan || 'pcs', per_kartu: num_(b.per_kartu), batas: num_(b.batas),
      sisa: s, rendah: s < num_(b.batas), beli_bulan: r.beli, pakai_bulan: r.pakai, reject_bulan: r.reject,
    };
  });
  // Berapa kartu lagi bisa diproduksi dengan bahan yang ada
  let bisa = null, pembatas = '';
  daftar.forEach(function (b) {
    if (!(b.per_kartu > 0)) return;
    const n = Math.max(0, Math.floor(b.sisa / b.per_kartu));
    if (bisa === null || n < bisa) { bisa = n; pembatas = b.nama; }
  });
  const riwayat = rows.slice().sort(function (a, b) {
    if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1;
    return String(a.dibuat_pada) < String(b.dibuat_pada) ? 1 : -1;
  }).slice(0, 200).map(function (r) {
    const o = clean_(r);
    o.nama_bahan = peta[r.bahan] ? peta[r.bahan].nama : r.bahan;
    return o;
  });
  return { bahan: daftar, bisa_produksi: bisa === null ? 0 : bisa, pembatas: pembatas, riwayat: riwayat };
}

function cekBahan_(kode) {
  const b = bahanMap_()[kode];
  if (!b || String(b.aktif).toUpperCase() === 'FALSE') throw userErr_('Pilih bahan terlebih dahulu.');
  return b;
}

function catatBahan_(d, u) {
  const b = cekBahan_(d.bahan);
  const j = JENIS_BAHAN[d.jenis];
  if (!j) throw userErr_('Pilih jenis catatan bahan.');
  const n = Math.round(num_(d.jumlah) * 100) / 100;
  if (!(n > 0)) throw userErr_('Jumlah harus lebih dari 0.');
  const tanggal = String(d.tanggal || today_());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw userErr_('Tanggal belum diisi dengan benar.');
  const row = {
    id: newId_('bhn'), tanggal: tanggal, bahan: b.kode, jenis: d.jenis, jumlah: j.arah * n,
    keterangan: String(d.keterangan || '').trim().slice(0, 300) || (j.label + ' ' + b.nama + ' ' + n + ' ' + (b.satuan || 'pcs')),
    dibuat_oleh: u.email, dibuat_pada: nowIso_(),
  };
  append_('StokBahan', row);
  log_(u.email, 'tambah', 'StokBahan', row.id, row);
  return getBahan_();
}

function opnameBahan_(d, u) {
  const b = cekBahan_(d.bahan);
  if (d.hitung === '' || d.hitung === undefined || num_(d.hitung) < 0) throw userErr_('Isi jumlah hasil hitung fisik.');
  const hitung = Math.round(num_(d.hitung) * 100) / 100;
  const cur = sisaBahan_()[b.kode] || 0;
  const selisih = Math.round((hitung - cur) * 100) / 100;
  const row = {
    id: newId_('bhn'), tanggal: String(d.tanggal || today_()), bahan: b.kode, jenis: 'opname', jumlah: selisih,
    keterangan: 'Opname ' + b.nama + ': hitung fisik ' + hitung + ' (catatan sistem ' + cur + ', selisih ' + (selisih >= 0 ? '+' : '') + selisih + ')',
    dibuat_oleh: u.email, dibuat_pada: nowIso_(),
  };
  append_('StokBahan', row);
  log_(u.email, 'opname', 'StokBahan', row.id, row);
  return getBahan_();
}

function hapusStokBahan_(d, u) {
  const r = findBy_('StokBahan', 'id', d.id);
  if (!r || isTrue_(r.dihapus)) throw userErr_('Catatan bahan tidak ditemukan.');
  if (r.ref) throw userErr_('Catatan ini otomatis dari pembelian/produksi. Ubah atau hapus transaksi/produksinya saja.');
  r.dihapus = 'TRUE'; r.dihapus_oleh = u.email; r.dihapus_pada = nowIso_();
  updateRow_('StokBahan', r._row, r);
  log_(u.email, 'hapus', 'StokBahan', r.id, clean_(r));
  return getBahan_();
}

/** Owner: tambah / ubah jenis bahan dan resepnya. */
function simpanBahan_(d, u) {
  const nama = String(d.nama || '').trim().slice(0, 40);
  if (!nama) throw userErr_('Nama bahan belum diisi.');
  const kode = String(d.kode || nama).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
  const ex = findBy_('Bahan', 'kode', kode);
  const row = { kode: kode, nama: nama, satuan: String(d.satuan || 'pcs').slice(0, 15),
    per_kartu: Math.max(0, num_(d.per_kartu)), batas: Math.max(0, Math.round(num_(d.batas))),
    aktif: d.aktif === false ? 'FALSE' : 'TRUE' };
  if (ex) updateRow_('Bahan', ex._row, row); else append_('Bahan', row);
  log_(u.email, ex ? 'ubah' : 'tambah', 'Bahan', kode, row);
  return getBahan_();
}

/** Pembelian bahan lewat transaksi → baris "beli" di StokBahan (ikut berubah/terhapus bersama transaksinya). */
function syncBahanForTx_(tx, u) {
  const n = num_(tx.qty_bahan);
  const want = !isTrue_(tx.dihapus) && tx.jenis === 'keluar' && tx.bahan && n > 0 && bahanMap_()[tx.bahan];
  const cur = readAll_('StokBahan').filter(function (r) { return r.ref === tx.id && !isTrue_(r.dihapus); })[0];
  const oleh = u ? u.email : 'sistem';
  if (want) {
    const ket = 'Beli: ' + (tx.keterangan || tx.kategori);
    if (cur) {
      if (num_(cur.jumlah) !== n || cur.bahan !== tx.bahan || cur.tanggal !== tx.tanggal || cur.keterangan !== ket) {
        cur.jumlah = n; cur.bahan = tx.bahan; cur.tanggal = tx.tanggal; cur.keterangan = ket;
        updateRow_('StokBahan', cur._row, cur);
      }
    } else {
      append_('StokBahan', { id: newId_('bhn'), tanggal: tx.tanggal, bahan: tx.bahan, jenis: 'beli', jumlah: n,
        keterangan: ket, ref: tx.id, dibuat_oleh: oleh, dibuat_pada: nowIso_() });
    }
  } else if (cur) {
    cur.dihapus = 'TRUE'; cur.dihapus_oleh = oleh; cur.dihapus_pada = nowIso_();
    updateRow_('StokBahan', cur._row, cur);
  }
}

/** Produksi N kartu → bahan terpakai sesuai resep, ditambah reject per bahan ({kode: jumlah}). */
function pakaiBahanProduksi_(stokRow, n, reject, u) {
  const rows = [];
  bahanAktif_().forEach(function (b) {
    const per = num_(b.per_kartu);
    if (per > 0) {
      rows.push({ id: newId_('bhn') + '-' + b.kode, tanggal: stokRow.tanggal, bahan: b.kode, jenis: 'produksi',
        jumlah: -(per * n), keterangan: 'Produksi ' + n + ' kartu', ref: stokRow.id, dibuat_oleh: u.email, dibuat_pada: nowIso_() });
    }
    const rj = num_((reject || {})[b.kode]);
    if (rj > 0) {
      rows.push({ id: newId_('bhn') + '-rj-' + b.kode, tanggal: stokRow.tanggal, bahan: b.kode, jenis: 'reject',
        jumlah: -rj, keterangan: 'Reject saat produksi ' + n + ' kartu', ref: stokRow.id, dibuat_oleh: u.email, dibuat_pada: nowIso_() });
    }
  });
  appendMany_('StokBahan', rows);
}

/** Hapus (soft) semua pemakaian bahan dari satu produksi. */
function hapusBahanRef_(ref, u) {
  readAll_('StokBahan').filter(function (r) { return r.ref === ref && !isTrue_(r.dihapus); }).forEach(function (r) {
    r.dihapus = 'TRUE'; r.dihapus_oleh = u.email; r.dihapus_pada = nowIso_();
    updateRow_('StokBahan', r._row, r);
  });
}

/** Bahan yang menipis (untuk peringatan di Beranda). */
function bahanRendah_() {
  const sisa = sisaBahan_();
  return bahanAktif_().filter(function (b) { return (sisa[b.kode] || 0) < num_(b.batas); })
    .map(function (b) { return { nama: b.nama, sisa: sisa[b.kode] || 0, satuan: b.satuan || 'pcs' }; });
}
