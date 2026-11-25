/** Transaksi: tambah, ubah, hapus (soft delete), pindah dana, daftar. */

function kategoriMap_() {
  const m = {};
  readAll_('Kategori').forEach(function (k) {
    m[k.nama] = { jenis: k.jenis, hitung_laba: isTrue_(k.hitung_laba), aktif: String(k.aktif).toUpperCase() !== 'FALSE' };
  });
  return m;
}

function akunSet_() {
  const s = {};
  readAll_('Akun').forEach(function (a) { s[a.nama] = true; });
  return s;
}

function activeTx_() {
  return readAll_('Transaksi').filter(function (t) { return !isTrue_(t.dihapus); });
}

/** Validasi & rapikan input transaksi dari form. */
function validTx_(d, u) {
  const jenis = String(d.jenis || '');
  if (jenis !== 'masuk' && jenis !== 'keluar') throw userErr_('Pilih jenis: pemasukan atau pengeluaran.');
  const tanggal = String(d.tanggal || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw userErr_('Tanggal belum diisi dengan benar.');
  const jumlah = Math.round(num_(d.jumlah) * 100) / 100;
  if (!(jumlah > 0)) throw userErr_('Jumlah harus lebih dari Rp0.');
  const kat = kategoriMap_()[d.kategori];
  if (!kat) throw userErr_('Kategori "' + (d.kategori || '') + '" tidak dikenal.');
  if (kat.jenis !== jenis) {
    throw userErr_('Kategori "' + d.kategori + '" tidak cocok untuk ' + (jenis === 'masuk' ? 'pemasukan.' : 'pengeluaran.'));
  }
  if (u && !can_(u, 'keuangan') && !kat.hitung_laba) {
    throw userErr_('Kategori "' + d.kategori + '" hanya bisa dicatat oleh owner.');
  }
  if (!akunSet_()[d.akun]) throw userErr_('Akun "' + (d.akun || '') + '" tidak dikenal.');
  const qty = Math.max(0, Math.round(num_(d.qty_kartu)));
  return {
    jenis: jenis, tanggal: tanggal, kategori: d.kategori, akun: d.akun, jumlah: jumlah,
    keterangan: String(d.keterangan || '').trim().slice(0, 500),
    pembeli: String(d.pembeli || '').trim().slice(0, 120),
    produk: String(d.produk || '').trim().slice(0, 200),
    qty_kartu: qty || '',
    harga_barang: num_(d.harga_barang) || '',
    ongkir: num_(d.ongkir) || '',
    biaya_lynk: num_(d.biaya_lynk) || '',
    bukti_url: String(d.bukti_url || '').trim(),
  };
}

function simpanTransaksi_(d, u) {
  if (d.id) return ubahTransaksi_(d, u);
  const v = validTx_(d, u);
  const tx = Object.assign({
    id: newId_('tx'), sumber: String(d.sumber || 'manual'), dibuat_oleh: u.email, dibuat_pada: nowIso_(),
  }, v);
  append_('Transaksi', tx);
  syncStokForTx_(tx, u);
  log_(u.email, 'tambah', 'Transaksi', tx.id, tx);
  return { id: tx.id };
}

function ubahTransaksi_(d, u) {
  const ex = findBy_('Transaksi', 'id', d.id);
  if (!ex || isTrue_(ex.dihapus)) throw userErr_('Transaksi tidak ditemukan. Mungkin sudah dihapus.');
  if (!can_(u, 'ubah_semua') && ex.dibuat_oleh !== u.email) {
    throw userErr_('Admin hanya bisa mengubah catatan yang dibuat sendiri. Minta owner untuk mengubahnya.');
  }
  if (ex.pasangan_id) {
    // Pindah dana: hanya tanggal, jumlah, keterangan yang boleh diubah (kedua baris ikut berubah).
    const jumlah = Math.round(num_(d.jumlah) * 100) / 100;
    if (!(jumlah > 0)) throw userErr_('Jumlah harus lebih dari Rp0.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.tanggal || ''))) throw userErr_('Tanggal belum diisi dengan benar.');
    const pair = findBy_('Transaksi', 'id', ex.pasangan_id);
    [ex, pair].forEach(function (r) {
      if (!r) return;
      const before = clean_(r);
      r.tanggal = d.tanggal;
      r.jumlah = jumlah;
      r.keterangan = String(d.keterangan || r.keterangan).slice(0, 500);
      r.diubah_oleh = u.email;
      r.diubah_pada = nowIso_();
      updateRow_('Transaksi', r._row, r);
      log_(u.email, 'ubah', 'Transaksi', r.id, { sebelum: before, sesudah: clean_(r) });
    });
    return { id: ex.id };
  }
  const v = validTx_(d, u);
  if (d.bukti_url === undefined || d.bukti_url === '') v.bukti_url = ex.bukti_url;
  const before = clean_(ex);
  Object.assign(ex, v, { perlu_cek: '', diubah_oleh: u.email, diubah_pada: nowIso_() });
  updateRow_('Transaksi', ex._row, ex);
  syncStokForTx_(ex, u);
  log_(u.email, 'ubah', 'Transaksi', ex.id, { sebelum: before, sesudah: clean_(ex) });
  return { id: ex.id };
}

function simpanBanyak_(d, u) {
  const items = d.items || [];
  if (!items.length) throw userErr_('Belum ada baris yang dipilih untuk disimpan.');
  if (items.length > 100) throw userErr_('Terlalu banyak baris sekaligus (maks 100).');
  const rows = items.map(function (it, i) {
    try {
      const v = validTx_(Object.assign({ bukti_url: d.bukti_url }, it), u);
      return Object.assign({
        id: newId_('tx') + '-' + (i + 1), sumber: String(d.sumber || 'foto'), dibuat_oleh: u.email, dibuat_pada: nowIso_(),
      }, v);
    } catch (e) {
      throw userErr_('Baris ' + (i + 1) + ': ' + (e.userMsg || e.message));
    }
  });
  appendMany_('Transaksi', rows);
  rows.forEach(function (tx) { syncStokForTx_(tx, u); });
  log_(u.email, 'tambah_banyak', 'Transaksi', rows.map(function (r) { return r.id; }).join(','), rows);
  return { jumlah: rows.length };
}

function pindahDana_(d, u) {
  const dari = d.dari, ke = d.ke;
  const akun = akunSet_();
  if (!akun[dari] || !akun[ke]) throw userErr_('Pilih akun asal dan akun tujuan.');
  if (dari === ke) throw userErr_('Akun asal dan tujuan tidak boleh sama.');
  const jumlah = Math.round(num_(d.jumlah) * 100) / 100;
  if (!(jumlah > 0)) throw userErr_('Jumlah harus lebih dari Rp0.');
  const tanggal = String(d.tanggal || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw userErr_('Tanggal belum diisi dengan benar.');
  const ket = String(d.keterangan || '').trim() || ('Pindah dana ' + dari + ' → ' + ke);
  const rows = buatPindahDana_(tanggal, dari, ke, jumlah, ket, 'manual', u.email, newId_('pd'), '');
  appendMany_('Transaksi', rows);
  log_(u.email, 'pindah_dana', 'Transaksi', rows[0].id + ',' + rows[1].id, rows);
  return { ids: [rows[0].id, rows[1].id] };
}

function buatPindahDana_(tanggal, dari, ke, jumlah, ket, sumber, oleh, baseId, refId) {
  const idK = baseId + '-k', idM = baseId + '-m';
  const base = { tanggal: tanggal, jumlah: jumlah, keterangan: ket, sumber: sumber, ref_id: refId || '',
    dibuat_oleh: oleh, dibuat_pada: nowIso_() };
  return [
    Object.assign({ id: idK, jenis: 'keluar', kategori: KATEGORI_PINDAH_KELUAR, akun: dari, pasangan_id: idM }, base),
    Object.assign({ id: idM, jenis: 'masuk', kategori: KATEGORI_PINDAH_MASUK, akun: ke, pasangan_id: idK }, base),
  ];
}

function hapusTransaksi_(d, u) {
  const ex = findBy_('Transaksi', 'id', d.id);
  if (!ex || isTrue_(ex.dihapus)) throw userErr_('Transaksi tidak ditemukan. Mungkin sudah dihapus.');
  const targets = [ex];
  if (ex.pasangan_id) {
    const pair = findBy_('Transaksi', 'id', ex.pasangan_id);
    if (pair && !isTrue_(pair.dihapus)) targets.push(pair);
  }
  targets.forEach(function (r) {
    r.dihapus = 'TRUE';
    r.dihapus_oleh = u.email;
    r.dihapus_pada = nowIso_();
    updateRow_('Transaksi', r._row, r);
    syncStokForTx_(r, u);
    log_(u.email, 'hapus', 'Transaksi', r.id, clean_(r));
  });
  return { jumlah: targets.length };
}

/**
 * Jaga stok tetap sesuai transaksi Penjualan Kartu (qty_kartu).
 * Data lama (sumber "lama:...") tidak disentuh, karena stoknya sudah dicatat terpisah.
 */
function syncStokForTx_(tx, u) {
  if (String(tx.sumber || '').indexOf('lama:') === 0) return;
  const want = (!isTrue_(tx.dihapus) && tx.kategori === KATEGORI_KARTU && tx.jenis === 'masuk')
    ? Math.round(num_(tx.qty_kartu)) : 0;
  const cur = readAll_('Stok').filter(function (r) {
    return r.ref_transaksi === tx.id && !isTrue_(r.dihapus);
  })[0];
  const oleh = u ? u.email : 'sistem';
  if (want > 0) {
    const ket = 'Terjual: ' + (tx.keterangan || tx.produk || tx.kategori);
    if (cur) {
      if (num_(cur.jumlah) !== -want || cur.tanggal !== tx.tanggal) {
        cur.jumlah = -want;
        cur.tanggal = tx.tanggal;
        cur.keterangan = ket;
        updateRow_('Stok', cur._row, cur);
      }
    } else {
      append_('Stok', {
        id: newId_('stok'), tanggal: tx.tanggal, jenis: 'terjual', jumlah: -want, keterangan: ket,
        ref_transaksi: tx.id, dibuat_oleh: oleh, dibuat_pada: nowIso_(),
      });
    }
  } else if (cur) {
    cur.dihapus = 'TRUE';
    cur.dihapus_oleh = oleh;
    cur.dihapus_pada = nowIso_();
    updateRow_('Stok', cur._row, cur);
  }
}

function listTransaksi_(d) {
  const q = String(d.q || '').toLowerCase().trim();
  let rows = activeTx_().filter(function (t) {
    if (d.oleh && t.dibuat_oleh !== d.oleh) return false;
    if (d.akun && t.akun !== d.akun) return false;
    if (d.kategori && t.kategori !== d.kategori) return false;
    if (d.jenis && t.jenis !== d.jenis) return false;
    if (d.bulan && String(t.tanggal).slice(0, 7) !== d.bulan) return false;
    if (d.perlu_cek && !isTrue_(t.perlu_cek)) return false;
    if (q) {
      const hay = [t.keterangan, t.pembeli, t.produk, t.kategori, t.akun, t.jumlah].join(' ').toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });
  rows.sort(function (a, b) {
    if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1;
    return String(a.dibuat_pada) < String(b.dibuat_pada) ? 1 : -1;
  });
  let masuk = 0, keluar = 0;
  rows.forEach(function (t) { if (t.jenis === 'masuk') masuk += num_(t.jumlah); else keluar += num_(t.jumlah); });
  const total = rows.length;
  const limit = Math.min(Number(d.limit) || 300, 1000);
  return { items: rows.slice(0, limit).map(clean_), total: total, masuk: masuk, keluar: keluar };
}
