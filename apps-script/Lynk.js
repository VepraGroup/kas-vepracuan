/**
 * Pencatatan otomatis pemasukan Lynk dari Gmail vepragroup0.
 *
 * Penting:
 * - SETIAP pesan dalam thread dibaca (Gmail sering menggabungkan beberapa notifikasi
 *   dengan subjek sama ke satu thread).
 * - Satu pesan bisa berisi lebih dari satu order; semua dicatat.
 * - Anti dobel: setiap pesan yang sudah diperiksa disimpan di tab LynkProses,
 *   dan ID transaksi dibuat dari ID pesan Gmail + urutan order.
 */

const PRODUK_LYNK = [
  { re: /Akses\s+Order\s+Kartu\s+Khusus\s+Reseller(?:\s*\d+\s*x)?/i, nama: 'Akses Order Kartu Khusus Reseller', kategori: 'Penjualan Kartu', kartu: true, hargaSatuan: 15000 },
  { re: /Panduan\s+Lengkap\s+A\s*-?\s*Z\s+Jadi\s+Reseller/i, nama: 'Panduan Lengkap A-Z Jadi Reseller', kategori: 'Paket Reseller 68rb' },
  { re: /Akses\s+Supplier\s+Eksklusif(?:\s+Jadi\s+Reseller)?/i, nama: 'Akses Supplier Eksklusif Jadi Reseller', kategori: 'Akses Supplier' },
  { re: /Kartu\s+(?:NFC\s+)?(?:Google\s+)?Review[^\n]{0,40}/i, nama: '', kategori: 'Penjualan Kartu', kartu: true, hargaSatuan: 50000 },
];

/**
 * Format email Lynk "Sales notification" (dicek dengan email asli, Nov 2026):
 *   Order from <Nama>, <email> <hp>
 *   ITEMS
 *   - <NAMA PRODUK> <N>x Rp <harga satuan>     (bisa lebih dari satu baris)
 *   Total Order Rp ...
 *   TRANSACTION DETAIL
 *   TRX ID: ...
 *   Total item (N items) Rp ... / Total Addon / Total shipping / Item Discount - Rp / Shipping Discount - Rp / Affiliate - Rp
 *   Total Rp ...
 */
function parseLynkStruktur_(text) {
  if (!/Order\s+from/i.test(text) || !/\bITEMS\b/.test(text)) return null;
  const mB = text.match(/Order\s+from\s+([^,\n]+?)\s*(?:,|\n)/i);
  const pembeli = mB ? mB[1].trim() : '';
  const mTrx = text.match(/TRX\s*ID\s*:\s*([A-Za-z0-9-]+)/i);
  const iItems = text.search(/\bITEMS\b/);
  let iEnd = text.search(/Total\s+Order/i);
  if (iEnd < iItems) iEnd = text.search(/TRANSACTION\s+DETAIL/i);
  const blok = text.slice(iItems + 5, iEnd > iItems ? iEnd : undefined);
  const items = [];
  const re = /([^\n]*?[A-Za-z][^\n]*?)\s+(\d+)\s*x\s+Rp\.?\s*([\d.,]+)/gi;
  let m;
  while ((m = re.exec(blok)) !== null) {
    items.push({ nama: m[1].replace(/^[\s\-•*]+/, '').trim(), qty: Number(m[2]), harga: parseRp_(m[3]) });
  }
  if (!items.length) return null;
  const det = function (label) {
    const x = text.match(new RegExp(label + '[^\\n]*?Rp\\.?\\s*([\\d.,]+)', 'i'));
    return x ? parseRp_(x[1]) : 0;
  };
  const shipping = det('Total\\s+shipping'), addon = det('Total\\s+Addon'), itemDisc = det('Item\\s+Discount'),
    shipDisc = det('Shipping\\s+Discount'), affiliate = det('Affiliate');
  const mTot = text.match(/(?:^|\n)\s*Total\s+Rp\.?\s*([\d.,]+)/i);
  const total = mTot ? parseRp_(mTot[1]) : det('Total\\s+Order');

  const orders = items.map(function (it) {
    const def = PRODUK_LYNK.filter(function (p) { return p.re.test(it.nama); })[0];
    const sub = it.qty * it.harga;
    return {
      produk: def ? ((def.nama || it.nama) + (def.kartu ? ' ' + it.qty + 'x' : '')) : it.nama,
      kategori: def ? def.kategori : 'Pemasukan Lain', kartu: !!(def && def.kartu),
      qty: def && def.kartu ? it.qty : 0, jumlah: sub, harga_barang: sub, ongkir: 0, biaya_lynk: 0, affiliate: 0,
      pembeli: pembeli, perlu_cek: !def,
    };
  });
  // Ongkir, addon & diskon ditempelkan ke order kartu pertama (atau order pertama).
  const target = orders.filter(function (o) { return o.kartu; })[0] || orders[0];
  target.ongkir = shipping;
  target.jumlah += shipping + addon - itemDisc - shipDisc;
  target.affiliate = affiliate;
  let catatan = mTrx ? 'TRX ' + mTrx[1] : '';
  const jumlahSemua = orders.reduce(function (a, o) { return a + o.jumlah; }, 0);
  if (total && Math.abs(jumlahSemua - total) > 1) {
    catatan += ' | Jumlah terbaca ' + jumlahSemua + ' ≠ total email ' + total;
    orders.forEach(function (o) { o.perlu_cek = true; });
  }
  orders.forEach(function (o) { if (!(o.jumlah > 0)) o.perlu_cek = true; });
  return { jenis: 'order', orders: orders, catatan: catatan.trim(), trx: mTrx ? mTrx[1] : '' };
}

/** Fungsi yang dijalankan trigger berwaktu (tiap 10 menit). */
function syncLynkOtomatis() {
  try {
    syncLynk_({});
  } catch (e) {
    console.error(e && e.stack ? e.stack : e);
  }
}

function setLynkStatus_(ok, pesan, extra) {
  props_().setProperty('LYNK_STATUS', JSON.stringify(Object.assign({
    ok: ok, pesan: pesan, waktu: nowIso_(), waktu_ms: Date.now(),
  }, extra || {})));
}

function tglGmail_(ymd) {
  return ymd.replace(/-/g, '/');
}

function minusHari_(ymd, n) {
  const p = ymd.split('-').map(Number);
  return Utilities.formatDate(new Date(Date.UTC(p[0], p[1] - 1, p[2]) - n * 86400000), 'UTC', 'yyyy-MM-dd');
}

/**
 * opt.dari: 'yyyy-MM-dd' untuk mengisi order yang terlewat sejak tanggal itu.
 * Tanpa opt.dari: periksa 3 hari terakhir.
 */
function syncLynk_(opt) {
  opt = opt || {};
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw userErr_('Pencatatan Lynk sedang berjalan. Coba lagi sebentar lagi.');
  try {
    pastikanSkema_();
    const mulai = getSetting_('lynk_mulai');
    const tarikMulai = getSetting_('lynk_tarik_mulai');
    let dari = opt.dari && /^\d{4}-\d{2}-\d{2}$/.test(opt.dari) ? opt.dari : minusHari_(today_(), 3);
    if (mulai && dari < mulai) dari = mulai;
    const query = getSetting_('lynk_query') + ' after:' + tglGmail_(minusHari_(dari, 1));

    const sudah = {};
    readAll_('LynkProses').forEach(function (r) { sudah[String(r.message_id)] = true; });
    const adaTx = {};
    readAll_('Transaksi').forEach(function (t) {
      adaTx[String(t.id)] = true;
      if (t.ref_id) adaTx['ref:' + t.ref_id] = true;
    });

    const txBaru = [], prosesBaru = [];
    const hasil = { pesan_diperiksa: 0, order_baru: 0, tarik_baru: 0, perlu_cek: 0, diabaikan: 0 };
    let start = 0, threads;
    do {
      threads = GmailApp.search(query, start, 50);
      threads.forEach(function (th) {
        th.getMessages().forEach(function (msg) {
          const mid = msg.getId();
          if (sudah[mid]) return;
          sudah[mid] = true;
          hasil.pesan_diperiksa++;
          const tgl = Utilities.formatDate(msg.getDate(), TZ, 'yyyy-MM-dd');
          const subjek = msg.getSubject() || '';
          const proses = { message_id: mid, thread_id: th.getId(), tanggal_email: tgl, subjek: subjek.slice(0, 200),
            jumlah_order: 0, status: '', catatan: '', diproses_pada: nowIso_() };
          if (adaTx['lynk-' + mid] || adaTx['ref:' + mid]) {
            proses.status = 'sudah_ada';
          } else if (mulai && tgl < mulai) {
            proses.status = 'sebelum_mulai';
          } else {
            const p = parseLynk_(subjek, msg.getPlainBody() || '');
            if (p.jenis === 'order') {
              p.orders.forEach(function (o, i) {
                const id = 'lynk-' + mid + (i ? '-' + (i + 1) : '');
                if (adaTx[id]) return;
                txBaru.push({
                  id: id, tanggal: tgl, jenis: 'masuk', kategori: o.kategori, akun: 'Lynk', jumlah: o.jumlah,
                  keterangan: (o.produk || 'Produk Lynk') + (o.pembeli ? ' – ' + o.pembeli : '') + ' (Lynk)',
                  pembeli: o.pembeli, produk: o.produk, qty_kartu: o.qty || '', harga_barang: o.harga_barang || '',
                  ongkir: o.ongkir || '', biaya_lynk: o.biaya_lynk || '', sumber: 'gmail-lynk',
                  ref_id: i ? mid + '#' + (i + 1) : mid, perlu_cek: o.perlu_cek ? 'TRUE' : '',
                  dibuat_oleh: 'sistem', dibuat_pada: nowIso_(),
                });
                if (o.biaya_lynk > 0) {
                  txBaru.push({
                    id: id + '-biaya', tanggal: tgl, jenis: 'keluar', kategori: 'Biaya Admin', akun: 'Lynk',
                    jumlah: o.biaya_lynk, keterangan: 'Biaya Lynk – ' + (o.produk || '') + (o.pembeli ? ' – ' + o.pembeli : ''),
                    sumber: 'gmail-lynk', ref_id: mid + '#biaya' + (i + 1), dibuat_oleh: 'sistem', dibuat_pada: nowIso_(),
                  });
                }
                if (o.affiliate > 0) {
                  txBaru.push({
                    id: id + '-affiliate', tanggal: tgl, jenis: 'keluar', kategori: 'Komisi Reseller/Affiliate', akun: 'Lynk',
                    jumlah: o.affiliate, keterangan: 'Komisi affiliate Lynk – ' + (o.produk || '') + (o.pembeli ? ' – ' + o.pembeli : ''),
                    sumber: 'gmail-lynk', ref_id: mid + '#affiliate' + (i + 1), dibuat_oleh: 'sistem', dibuat_pada: nowIso_(),
                  });
                }
                hasil.order_baru++;
                if (o.perlu_cek) hasil.perlu_cek++;
              });
              proses.jumlah_order = p.orders.length;
              proses.status = p.orders.some(function (o) { return o.perlu_cek; }) ? 'perlu_cek' : 'dicatat';
              proses.catatan = p.catatan || '';
            } else if (p.jenis === 'tarik') {
              if (tgl < tarikMulai) {
                proses.status = 'tarik_lama';
              } else if (!(p.jumlah > 0)) {
                proses.status = 'perlu_cek';
                proses.catatan = 'Email penarikan, tapi nominal tidak terbaca. Catat manual lewat Pindah Dana.';
              } else {
                buatPindahDana_(tgl, 'Lynk', 'Bank', p.jumlah, 'Tarik saldo Lynk ke BCA', 'gmail-lynk', 'sistem',
                  'lynk-tarik-' + mid, mid).forEach(function (r) { txBaru.push(r); });
                proses.status = 'tarik_dicatat';
                hasil.tarik_baru++;
              }
            } else {
              proses.status = 'abaikan';
              proses.catatan = p.catatan || '';
              hasil.diabaikan++;
            }
          }
          prosesBaru.push(proses);
        });
      });
      start += threads.length;
    } while (threads.length === 50 && start < 1000);

    if (txBaru.length) {
      appendMany_('Transaksi', txBaru);
      txBaru.forEach(function (tx) { syncStokForTx_(tx, null); });
      log_('sistem', 'lynk_otomatis', 'Transaksi', txBaru.map(function (t) { return t.id; }).join(','), null);
      hitungUlangPenyesuaianLynk_();
    }
    appendMany_('LynkProses', prosesBaru);
    const pesan = hasil.order_baru + ' order baru, ' + hasil.tarik_baru + ' penarikan, ' + hasil.perlu_cek + ' perlu dicek';
    setLynkStatus_(true, pesan, { hasil: hasil });
    return hasil;
  } catch (e) {
    setLynkStatus_(false, e.userMsg || String(e.message || e));
    throw e;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Saldo Lynk per 15 Nov 2026 sudah 0 (semua sudah ditarik ke BCA).
 * Kalau ada order bertanggal ≤ tanggal penyesuaian yang baru diisi belakangan,
 * baris penyesuaian dihitung ulang supaya saldo Lynk pada tanggal itu tetap 0.
 */
function hitungUlangPenyesuaianLynk_() {
  const adjId = getSetting_('lynk_penyesuaian_id');
  const tgl = getSetting_('lynk_penyesuaian_tanggal');
  if (!adjId || !tgl) return;
  const adj = findBy_('Transaksi', 'id', adjId);
  if (!adj || isTrue_(adj.dihapus)) return;
  let saldo = 0;
  activeTx_().forEach(function (t) {
    if (t.akun !== 'Lynk' || t.id === adjId || t.tanggal > tgl) return;
    saldo += (t.jenis === 'masuk' ? 1 : -1) * num_(t.jumlah);
  });
  saldo = Math.round(saldo * 100) / 100;
  const jenis = saldo >= 0 ? 'keluar' : 'masuk';
  const kategori = saldo >= 0 ? KATEGORI_PINDAH_KELUAR : KATEGORI_PINDAH_MASUK;
  const jumlah = Math.abs(saldo);
  if (adj.jenis === jenis && num_(adj.jumlah) === jumlah) return;
  const before = clean_(adj);
  adj.jenis = jenis;
  adj.kategori = kategori;
  adj.jumlah = jumlah;
  adj.diubah_oleh = 'sistem';
  adj.diubah_pada = nowIso_();
  updateRow_('Transaksi', adj._row, adj);
  log_('sistem', 'hitung_ulang_penyesuaian_lynk', 'Transaksi', adjId, { sebelum: before, sesudah: clean_(adj) });
}

/** Ubah "Rp 1.234.567" / "Rp1,234,567.00" jadi angka. */
function parseRp_(s) {
  if (!s) return 0;
  let t = String(s).trim().replace(/\s/g, '').replace(/[.,]+$/, '');
  t = t.replace(/[.,]\d{1,2}$/, ''); // buang sen (",00")
  const n = Number(t.replace(/[^\d]/g, ''));
  return isNaN(n) ? 0 : n;
}

const RP_RE_ = /Rp\.?\s*([\d][\d.,]*)/i;

function ambilRp_(text, labelRe) {
  const re = new RegExp('(?:' + labelRe + ')[^\\n\\dR]{0,25}\\n?\\s*-?\\s*Rp\\.?\\s*([\\d][\\d.,]*)', 'i');
  const m = text.match(re);
  return m ? parseRp_(m[1]) : 0;
}

function ambilPembeli_(text) {
  const pola = [
    /Nama\s+Pembeli\s*:?\s*\n?\s*([^\n]{2,80})/i,
    /Nama\s+Pelanggan\s*:?\s*\n?\s*([^\n]{2,80})/i,
    /Nama\s+Customer\s*:?\s*\n?\s*([^\n]{2,80})/i,
    /Customer\s+Name\s*:?\s*\n?\s*([^\n]{2,80})/i,
    /Pembeli\s*:\s*\n?\s*([^\n]{2,80})/i,
    /Buyer\s*:?\s*\n?\s*([^\n]{2,80})/i,
    /(?:^|\n)\s*Nama\s*:\s*\n?\s*([^\n]{2,80})/i,
  ];
  for (let i = 0; i < pola.length; i++) {
    const m = text.match(pola[i]);
    if (m && !/produk|product|toko/i.test(m[1])) return m[1].replace(/[*_|]/g, '').trim();
  }
  return '';
}

/**
 * Baca satu email Lynk. Hasil:
 *  {jenis:'order', orders:[{produk,kategori,qty,jumlah,harga_barang,ongkir,biaya_lynk,pembeli,perlu_cek}]}
 *  {jenis:'tarik', jumlah}
 *  {jenis:'abaikan', catatan}
 */
function parseLynk_(subject, body) {
  const text = String(body).replace(/\r/g, '').replace(/[ \t ]+/g, ' ').replace(/\n\s*\n+/g, '\n');
  const subj = String(subject || '');

  if (/(penarikan|withdraw|pencairan|tarik\s+saldo|disbursement)/i.test(subj)) {
    const j = ambilRp_(text, 'jumlah|nominal|total|sebesar|amount') || (text.match(RP_RE_) ? parseRp_(text.match(RP_RE_)[1]) : 0);
    return { jenis: 'tarik', jumlah: j };
  }

  // Format resmi email Lynk (paling bisa dipercaya).
  const struktur = parseLynkStruktur_(text);
  if (struktur) return struktur;

  // Cadangan untuk format lain: cari semua penyebutan produk di isi email.
  const temuan = [];
  PRODUK_LYNK.forEach(function (p) {
    const re = new RegExp(p.re.source, 'gi');
    let m;
    while ((m = re.exec(text)) !== null) temuan.push({ idx: m.index, teks: m[0].trim(), def: p });
  });
  temuan.sort(function (a, b) { return a.idx - b.idx; });

  const adaRp = RP_RE_.test(text);
  const sinyalJual = /(pesanan|penjualan|order|pembelian|terjual|transaksi|pembayaran|purchase|sale)/i.test(subj + ' ' + text.slice(0, 400));
  const pembeli = ambilPembeli_(text);
  const total = ambilRp_(text, 'total\\s+pembayaran|total\\s+bayar|total\\s+harga|grand\\s+total|total');
  const ongkirAll = ambilRp_(text, 'ongkos\\s+kirim|ongkir|biaya\\s+pengiriman|shipping');
  const biayaAll = ambilRp_(text, 'biaya\\s+(?:admin|layanan|platform|transaksi)|platform\\s+fee|service\\s+fee');

  if (!temuan.length) {
    if (sinyalJual && adaRp && total > 0) {
      return { jenis: 'order', catatan: 'Produk tidak dikenal', orders: [{
        produk: (subj || 'Produk Lynk').slice(0, 120), kategori: 'Pemasukan Lain', qty: 0, jumlah: total,
        harga_barang: '', ongkir: ongkirAll, biaya_lynk: 0, pembeli: pembeli, perlu_cek: true,
      }] };
    }
    return { jenis: 'abaikan', catatan: 'Bukan email penjualan' };
  }

  // Potong per penyebutan produk; buang penyebutan tanpa nominal (mis. judul) jika produk sama muncul lagi.
  const seg = temuan.map(function (t, i) {
    const end = i + 1 < temuan.length ? temuan[i + 1].idx : text.length;
    const s = text.slice(t.idx, end);
    const m = s.match(RP_RE_);
    return { t: t, teks: s, rp: m ? parseRp_(m[1]) : 0 };
  });
  let orders = [];
  seg.forEach(function (s, i) {
    const next = seg[i + 1];
    if (!s.rp && next && next.t.def === s.t.def) return; // judul/penyebutan ulang
    orders.push(s);
  });
  // Penyebutan ganda produk yang sama dengan nominal sama → satu order.
  const unik = {};
  orders = orders.filter(function (s) {
    const k = s.t.teks.toLowerCase().replace(/\s+/g, ' ') + '|' + s.rp;
    if (unik[k]) return false;
    unik[k] = true;
    return true;
  });

  const hasil = orders.map(function (s) {
    const def = s.t.def;
    const produk = s.t.teks.replace(/\s+/g, ' ');
    let qty = 0;
    const mx = produk.match(/(\d+)\s*x\b/i) || s.teks.match(/(?:Jumlah|Qty|Kuantitas|Quantity)\s*:?\s*(\d+)/i) ||
      s.teks.match(/\bx\s*(\d+)\b/i);
    if (mx) qty = Number(mx[1]);
    return { produk: produk, kategori: def.kategori, kartu: !!def.kartu, hargaSatuan: def.hargaSatuan || 0,
      qty: qty, jumlah: s.rp, pembeli: pembeli, ongkir: 0, biaya_lynk: 0, harga_barang: '', perlu_cek: false };
  });

  let catatan = '';
  if (hasil.length === 1) {
    const o = hasil[0];
    // Satu order: pakai total email bila ada (sudah termasuk ongkir).
    if (total > 0) o.jumlah = total;
    o.ongkir = ongkirAll;
    o.biaya_lynk = biayaAll;
    if (ongkirAll && o.jumlah > ongkirAll) o.harga_barang = o.jumlah - ongkirAll;
  } else if (total > 0) {
    const jumlahSemua = hasil.reduce(function (a, o) { return a + o.jumlah; }, 0);
    if (Math.abs(jumlahSemua - total) > 1 && Math.abs(jumlahSemua + ongkirAll - total) > 1) {
      catatan = 'Jumlah per order (' + jumlahSemua + ') tidak sama dengan total email (' + total + ')';
      hasil.forEach(function (o) { o.perlu_cek = true; });
    }
  }
  hasil.forEach(function (o) {
    if (!(o.jumlah > 0)) o.perlu_cek = true;
    if (o.kartu && !o.qty) {
      const barang = o.harga_barang || o.jumlah;
      if (o.hargaSatuan && barang % o.hargaSatuan === 0) o.qty = barang / o.hargaSatuan;
      else o.perlu_cek = true;
    }
    if (!o.kartu) o.qty = 0;
  });
  return { jenis: 'order', orders: hasil, catatan: catatan };
}

/** Uji pembaca tanpa menyimpan apa pun. Dipakai dari menu Pengaturan. */
function ujiLynk_(d) {
  const n = Math.min(Number(d.n) || 10, 30);
  const query = (d.query || getSetting_('lynk_query')) + ' newer_than:' + (Number(d.hari) || 30) + 'd';
  const threads = GmailApp.search(query, 0, 30);
  const out = [];
  threads.forEach(function (th) {
    th.getMessages().forEach(function (msg) {
      out.push({
        message_id: msg.getId(), thread_id: th.getId(), jumlah_pesan_thread: th.getMessageCount(),
        tanggal: Utilities.formatDate(msg.getDate(), TZ, 'yyyy-MM-dd HH:mm'),
        dari: msg.getFrom(), subjek: msg.getSubject(),
        isi: (msg.getPlainBody() || '').slice(0, d.panjang ? 8000 : 2500),
        hasil: parseLynk_(msg.getSubject(), msg.getPlainBody() || ''),
      });
    });
  });
  out.sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; });
  return { query: query, jumlah_thread: threads.length, pesan: out.slice(0, n) };
}

/** Jalankan dari editor Apps Script untuk melihat contoh email Lynk di log. */
function contohEmailLynk() {
  const r = ujiLynk_({ n: 5, hari: 60, panjang: true });
  Logger.log('Query: ' + r.query + ' | thread: ' + r.jumlah_thread);
  r.pesan.forEach(function (p) {
    Logger.log('==== ' + p.tanggal + ' | ' + p.dari + ' | ' + p.subjek + ' | pesan di thread: ' + p.jumlah_pesan_thread);
    Logger.log(p.isi);
    Logger.log('HASIL BACA: ' + JSON.stringify(p.hasil));
  });
}
