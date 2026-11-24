/**
 * Dashboard & laporan.
 * Aturan: kategori dengan hitung_laba = FALSE (Modal Masuk, Prive, Pindah Dana)
 * TIDAK dihitung sebagai pemasukan/pengeluaran usaha, tapi tetap mengubah saldo akun.
 */

function addMonth_(ym, n) {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n;
  const d = new Date(Date.UTC(y, m, 1));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2);
}

function hariAntara_(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}

function isUsaha_(kat, nama) {
  const k = kat[nama];
  return k ? k.hitung_laba : true;
}

function saldoPerAkun_(tx, sampai) {
  const saldo = {};
  readAll_('Akun').forEach(function (a) { saldo[a.nama] = 0; });
  tx.forEach(function (t) {
    if (sampai && t.tanggal > sampai) return;
    if (!(t.akun in saldo)) saldo[t.akun] = 0;
    saldo[t.akun] += (t.jenis === 'masuk' ? 1 : -1) * num_(t.jumlah);
  });
  Object.keys(saldo).forEach(function (k) { saldo[k] = Math.round(saldo[k] * 100) / 100; });
  return saldo;
}

function ringkasBulan_(tx, kat, bulan) {
  let masuk = 0, keluar = 0;
  const perMasuk = {}, perKeluar = {}, nonUsaha = {};
  tx.forEach(function (t) {
    if (String(t.tanggal).slice(0, 7) !== bulan) return;
    const j = num_(t.jumlah);
    if (!isUsaha_(kat, t.kategori)) {
      nonUsaha[t.kategori] = (nonUsaha[t.kategori] || 0) + j;
      return;
    }
    if (t.jenis === 'masuk') { masuk += j; perMasuk[t.kategori] = (perMasuk[t.kategori] || 0) + j; }
    else { keluar += j; perKeluar[t.kategori] = (perKeluar[t.kategori] || 0) + j; }
  });
  const toList = function (o) {
    return Object.keys(o).map(function (k) { return { nama: k, jumlah: o[k] }; })
      .sort(function (a, b) { return b.jumlah - a.jumlah; });
  };
  return { masuk: masuk, keluar: keluar, laba: masuk - keluar,
    per_masuk: toList(perMasuk), per_keluar: toList(perKeluar), non_usaha: toList(nonUsaha) };
}

function statusLynk_(tx) {
  let terakhir = '';
  tx.forEach(function (t) {
    if (t.akun === 'Lynk' && t.jenis === 'masuk' && /lynk/.test(String(t.sumber)) && t.tanggal > terakhir) {
      terakhir = t.tanggal;
    }
  });
  const batasHari = num_(getSetting_('lynk_hari_peringatan')) || 2;
  const hari = terakhir ? hariAntara_(terakhir, today_()) : null;
  let run = null;
  try { run = JSON.parse(prop_('LYNK_STATUS') || 'null'); } catch (e) { run = null; }
  const peringatan = [];
  if (hari === null || hari > batasHari) {
    peringatan.push('Sudah ' + (hari === null ? 'lama' : hari + ' hari') + ' tidak ada order Lynk tercatat. Cek apakah memang sepi, atau pencatatan otomatis bermasalah.');
  }
  if (run && run.ok === false) peringatan.push('Pencatatan Lynk otomatis terakhir gagal: ' + run.pesan);
  if (!run) peringatan.push('Pencatatan Lynk otomatis belum pernah berjalan.');
  else if (Date.now() - (run.waktu_ms || 0) > 3 * 3600000) {
    peringatan.push('Pencatatan Lynk otomatis tidak berjalan lebih dari 3 jam.');
  }
  return { order_terakhir: terakhir, hari_sejak: hari, run: run, peringatan: peringatan };
}

function dashboard_(d) {
  const tx = activeTx_();
  const kat = kategoriMap_();
  const bulan = /^\d{4}-\d{2}$/.test(d.bulan || '') ? d.bulan : today_().slice(0, 7);
  const saldo = saldoPerAkun_(tx);
  const total = Object.keys(saldo).reduce(function (s, k) { return s + saldo[k]; }, 0);
  const grafik = [];
  for (let i = 5; i >= 0; i--) {
    const b = addMonth_(bulan, -i);
    const r = ringkasBulan_(tx, kat, b);
    grafik.push({ bulan: b, masuk: r.masuk, keluar: r.keluar });
  }
  const stok = stokSekarang_();
  const batas = num_(getSetting_('batas_stok'));
  return {
    bulan: bulan,
    kas: Math.round(total * 100) / 100,
    saldo: Object.keys(saldo).map(function (k) { return { akun: k, saldo: saldo[k] }; }),
    ringkas: ringkasBulan_(tx, kat, bulan),
    grafik: grafik,
    lynk: statusLynk_(tx),
    stok: { sekarang: stok, batas: batas, rendah: stok < batas },
    perlu_cek: tx.filter(function (t) { return isTrue_(t.perlu_cek); }).length,
  };
}

/** Laporan bulanan (bisa dicetak / disimpan PDF dari browser). */
function laporan_(d) {
  const tx = activeTx_();
  const kat = kategoriMap_();
  const bulan = /^\d{4}-\d{2}$/.test(d.bulan || '') ? d.bulan : today_().slice(0, 7);
  const akhir = addMonth_(bulan, 1) + '-01';
  const akhirBulan = (function () {
    const p = akhir.split('-').map(Number);
    return Utilities.formatDate(new Date(Date.UTC(p[0], p[1] - 1, p[2]) - 86400000), 'UTC', 'yyyy-MM-dd');
  })();
  const saldo = saldoPerAkun_(tx, akhirBulan);
  // Penjualan per produk
  const produk = {};
  tx.forEach(function (t) {
    if (String(t.tanggal).slice(0, 7) !== bulan || t.jenis !== 'masuk' || !isUsaha_(kat, t.kategori)) return;
    const p = produk[t.kategori] || (produk[t.kategori] = { nama: t.kategori, transaksi: 0, kartu: 0, jumlah: 0 });
    p.transaksi += 1;
    p.kartu += Math.round(num_(t.qty_kartu));
    p.jumlah += num_(t.jumlah);
  });
  // Stok
  const st = activeStok_();
  let stokAwal = 0, stokMasuk = 0, stokKeluar = 0, stokAkhir = 0;
  st.forEach(function (r) {
    const j = num_(r.jumlah);
    if (r.tanggal < bulan + '-01') stokAwal += j;
    if (r.tanggal <= akhirBulan) stokAkhir += j;
    if (String(r.tanggal).slice(0, 7) === bulan) { if (j > 0) stokMasuk += j; else stokKeluar += -j; }
  });
  return {
    bulan: bulan, sampai: akhirBulan,
    ringkas: ringkasBulan_(tx, kat, bulan),
    saldo: Object.keys(saldo).map(function (k) { return { akun: k, saldo: saldo[k] }; }),
    kas: Object.keys(saldo).reduce(function (s, k) { return s + saldo[k]; }, 0),
    produk: Object.keys(produk).map(function (k) { return produk[k]; }),
    stok: { awal: stokAwal, masuk: stokMasuk, keluar: stokKeluar, akhir: stokAkhir },
  };
}
