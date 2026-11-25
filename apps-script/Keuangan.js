/**
 * Laporan keuangan untuk owner: ARUS KAS dan NERACA (sederhana).
 *
 * Catatan metode (supaya mudah dipahami):
 * - Pembukuan ini berbasis kas: pembelian bahan langsung dicatat sebagai biaya.
 * - Di neraca, bahan & kartu yang BELUM terjual tetap punya nilai (persediaan),
 *   dihitung dari sisa stok × harga beli rata-rata. Nilai itu juga ditambahkan
 *   di sisi modal, sehingga Aset = Modal selalu seimbang.
 */

const KATEGORI_MODAL = 'Modal Masuk';
const KATEGORI_PRIVE = 'Prive (ambil pribadi)';
const KATEGORI_GAJI = 'Gaji Karyawan';
/** Harga cadangan per pcs kalau belum ada data pembelian yang mencatat jumlah pcs. */
const HARGA_DEFAULT_BAHAN = { akrilik: 3500, nfc: 2250, stiker: 1775, polymailer: 1500 };

function akhirBulan_(ym) {
  const p = addMonth_(ym, 1).split('-').map(Number);
  return Utilities.formatDate(new Date(Date.UTC(p[0], p[1] - 1, 1) - 86400000), 'UTC', 'yyyy-MM-dd');
}

function kelompokTx_(t, kat) {
  const k = String(t.kategori);
  if (k === KATEGORI_MODAL) return 'modal';
  if (k.indexOf('Prive') === 0) return 'prive';
  if (k.indexOf('Pindah Dana') === 0) return 'pindah';
  if (k.indexOf('Penyesuaian Saldo') === 0) return 'koreksi';
  return isUsaha_(kat, k) ? 'usaha' : 'lain';
}

function arusKas_(d) {
  const tx = activeTx_();
  const kat = kategoriMap_();
  const bulan = /^\d{4}-\d{2}$/.test(d.bulan || '') ? d.bulan : today_().slice(0, 7);
  const awalTgl = bulan + '-01', akhirTgl = akhirBulan_(bulan);
  const akun = {};
  readAll_('Akun').forEach(function (a) { akun[a.nama] = { akun: a.nama, awal: 0, masuk: 0, keluar: 0 }; });
  let awal = 0;
  const op = { masuk: {}, keluar: {} };
  const grup = { modal: 0, prive: 0, pindah: 0, koreksi: 0, lain: 0 };
  tx.forEach(function (t) {
    const j = num_(t.jumlah), tanda = t.jenis === 'masuk' ? 1 : -1;
    const a = akun[t.akun] || (akun[t.akun] = { akun: t.akun, awal: 0, masuk: 0, keluar: 0 });
    if (t.tanggal < awalTgl) { awal += tanda * j; a.awal += tanda * j; return; }
    if (t.tanggal > akhirTgl) return;
    if (t.jenis === 'masuk') a.masuk += j; else a.keluar += j;
    const g = kelompokTx_(t, kat);
    if (g === 'usaha') {
      const o = op[t.jenis];
      o[t.kategori] = (o[t.kategori] || 0) + j;
    } else {
      grup[g] += tanda * j;
    }
  });
  const daftar = function (o) {
    return Object.keys(o).map(function (k) { return { nama: k, jumlah: Math.round(o[k] * 100) / 100 }; })
      .sort(function (x, y) { return y.jumlah - x.jumlah; });
  };
  const opMasuk = daftar(op.masuk), opKeluar = daftar(op.keluar);
  const totMasuk = opMasuk.reduce(function (s, x) { return s + x.jumlah; }, 0);
  const totKeluar = opKeluar.reduce(function (s, x) { return s + x.jumlah; }, 0);
  const operasional = totMasuk - totKeluar;
  const pendanaan = grup.modal + grup.prive;
  const lainnya = grup.pindah + grup.koreksi + grup.lain;
  const bulat = function (n) { return Math.round(n * 100) / 100; };
  const perAkun = Object.keys(akun).map(function (k) {
    const a = akun[k];
    return { akun: a.akun, awal: bulat(a.awal), masuk: bulat(a.masuk), keluar: bulat(a.keluar), akhir: bulat(a.awal + a.masuk - a.keluar) };
  });
  return {
    bulan: bulan, sampai: akhirTgl, awal: bulat(awal),
    operasional: { masuk: opMasuk, keluar: opKeluar, total_masuk: bulat(totMasuk), total_keluar: bulat(totKeluar), bersih: bulat(operasional) },
    pendanaan: { modal: bulat(grup.modal), prive: bulat(grup.prive), bersih: bulat(pendanaan) },
    lainnya: { pindah: bulat(grup.pindah), koreksi: bulat(grup.koreksi), lain: bulat(grup.lain), bersih: bulat(lainnya) },
    perubahan: bulat(operasional + pendanaan + lainnya),
    akhir: bulat(awal + operasional + pendanaan + lainnya),
    per_akun: perAkun,
  };
}

/** Harga beli rata-rata per bahan dari transaksi pembelian yang mencatat jumlah pcs. */
function hargaBahan_() {
  const total = {}, qty = {};
  activeTx_().forEach(function (t) {
    const q = num_(t.qty_bahan);
    if (t.jenis !== 'keluar' || !t.bahan || !(q > 0)) return;
    total[t.bahan] = (total[t.bahan] || 0) + num_(t.jumlah);
    qty[t.bahan] = (qty[t.bahan] || 0) + q;
  });
  const h = {};
  bahanAktif_().forEach(function (b) {
    if (qty[b.kode] > 0) h[b.kode] = { harga: total[b.kode] / qty[b.kode], sumber: 'rata-rata pembelian' };
    else h[b.kode] = { harga: HARGA_DEFAULT_BAHAN[b.kode] || 0, sumber: HARGA_DEFAULT_BAHAN[b.kode] ? 'perkiraan' : 'belum ada harga' };
  });
  return h;
}

function neraca_(d) {
  const tgl = /^\d{4}-\d{2}-\d{2}$/.test(d.tanggal || '') ? d.tanggal
    : (/^\d{4}-\d{2}$/.test(d.bulan || '') ? akhirBulan_(d.bulan) : today_());
  const tanggal = tgl > today_() ? today_() : tgl;
  const tx = activeTx_().filter(function (t) { return t.tanggal <= tanggal; });
  const kat = kategoriMap_();
  // Kas per akun
  const saldo = saldoPerAkun_(tx);
  const kasList = Object.keys(saldo).map(function (k) { return { nama: k, jumlah: saldo[k] }; });
  const totalKas = kasList.reduce(function (s, x) { return s + x.jumlah; }, 0);
  // Persediaan bahan (sisa per tanggal × harga)
  const harga = hargaBahan_();
  const sisaB = {};
  activeStokBahan_().forEach(function (r) { if (r.tanggal <= tanggal) sisaB[r.bahan] = (sisaB[r.bahan] || 0) + num_(r.jumlah); });
  const bahanList = bahanAktif_().map(function (b) {
    const s = Math.max(0, sisaB[b.kode] || 0), h = harga[b.kode];
    return { nama: b.nama + ' (' + s + ' ' + (b.satuan || 'pcs') + ')', jumlah: Math.round(s * h.harga), harga: Math.round(h.harga), sumber: h.sumber };
  }).filter(function (x) { return x.jumlah > 0; });
  // Persediaan kartu jadi (sisa × biaya bahan per kartu)
  let sisaKartu = 0;
  activeStok_().forEach(function (r) { if (r.tanggal <= tanggal) sisaKartu += num_(r.jumlah); });
  sisaKartu = Math.max(0, sisaKartu);
  const biayaKartu = bahanAktif_().reduce(function (s, b) { return s + num_(b.per_kartu) * harga[b.kode].harga; }, 0);
  const nilaiKartu = Math.round(sisaKartu * biayaKartu);
  const totalPersediaan = bahanList.reduce(function (s, x) { return s + x.jumlah; }, 0) + nilaiKartu;
  const totalAset = totalKas + totalPersediaan;
  // Modal / ekuitas
  let modal = 0, prive = 0, laba = 0;
  tx.forEach(function (t) {
    const j = num_(t.jumlah), g = kelompokTx_(t, kat);
    if (g === 'modal') modal += t.jenis === 'masuk' ? j : -j;
    else if (g === 'prive') prive += t.jenis === 'keluar' ? j : -j;
    else if (g === 'usaha') laba += t.jenis === 'masuk' ? j : -j;
  });
  const penyesuaian = totalKas - (modal - prive + laba);
  const bulat = function (n) { return Math.round(n * 100) / 100; };
  return {
    tanggal: tanggal,
    aset: {
      kas: kasList.map(function (x) { return { nama: x.nama, jumlah: bulat(x.jumlah) }; }), total_kas: bulat(totalKas),
      persediaan: bahanList.concat(sisaKartu ? [{ nama: 'Kartu jadi (' + sisaKartu + ' kartu × ' + Math.round(biayaKartu) + ')', jumlah: nilaiKartu }] : []),
      total_persediaan: bulat(totalPersediaan),
      total: bulat(totalAset),
    },
    kewajiban: { total: 0 },
    ekuitas: {
      modal: bulat(modal), prive: bulat(prive), laba_ditahan: bulat(laba),
      nilai_persediaan: bulat(totalPersediaan), penyesuaian: bulat(penyesuaian),
      total: bulat(modal - prive + laba + totalPersediaan + penyesuaian),
    },
    harga_bahan: bahanAktif_().map(function (b) { return { nama: b.nama, harga: Math.round(harga[b.kode].harga), sumber: harga[b.kode].sumber }; }),
  };
}

/** Kategori tambahan yang dibutuhkan fitur baru (dibuat otomatis kalau belum ada). */
function pastikanKategoriTambahan_() {
  [[KATEGORI_GAJI, 'keluar', 'TRUE'], ['Penyesuaian Saldo (masuk)', 'masuk', 'FALSE'], ['Penyesuaian Saldo (keluar)', 'keluar', 'FALSE']]
    .forEach(function (k) {
      if (!findBy_('Kategori', 'nama', k[0])) append_('Kategori', { nama: k[0], jenis: k[1], hitung_laba: k[2], aktif: 'TRUE' });
    });
}
