/**
 * Foto bukti → disimpan di Drive "Bukti Transaksi VepraCuan" → dibaca Gemini.
 * Hasil bacaan TIDAK langsung disimpan; pengguna mengecek dulu di layar.
 */

const MAX_FOTO_B64 = 9 * 1024 * 1024; // ±6,7 MB gambar

function folderBukti_() {
  const id = prop_('FOLDER_ID');
  if (!id) throw userErr_('Folder bukti belum disiapkan. Jalankan setup dulu.');
  return DriveApp.getFolderById(id);
}

function simpanFoto_(b64, mime, label, u) {
  if (!b64) throw userErr_('Foto belum dipilih.');
  if (b64.length > MAX_FOTO_B64) throw userErr_('Foto terlalu besar. Coba foto ulang dengan ukuran lebih kecil.');
  mime = /^image\/(jpeg|png|webp|heic|heif)$/.test(mime || '') ? mime : 'image/jpeg';
  const ext = mime.split('/')[1].replace('jpeg', 'jpg');
  const nama = Utilities.formatDate(new Date(), TZ, 'yyyyMMdd-HHmmss') + '_' + label + '_' +
    String(u.email).split('@')[0] + '.' + ext;
  const file = folderBukti_().createFile(Utilities.newBlob(Utilities.base64Decode(b64), mime, nama));
  return { url: file.getUrl(), id: file.getId() };
}

function uploadBukti_(d, u) {
  const f = simpanFoto_(d.gambar, d.mime, 'bukti', u);
  log_(u.email, 'upload_bukti', '', f.id, null);
  return { bukti_url: f.url };
}

function daftarKategori_(jenis) {
  return readAll_('Kategori').filter(function (k) {
    return k.jenis === jenis && isTrue_(k.hitung_laba) && String(k.aktif).toUpperCase() !== 'FALSE';
  }).map(function (k) { return k.nama; });
}

function promptFoto_(mode) {
  const tahun = today_().slice(0, 4);
  const akun = readAll_('Akun').map(function (a) { return a.nama; }).join(', ');
  const umum = 'Kamu asisten pembukuan untuk usaha kecil VepraCuan (produksi & jual kartu NFC Google Review dari akrilik, stiker cetak, chip NFC). ' +
    'Semua angka dalam Rupiah sebagai bilangan bulat tanpa titik/koma (contoh 136530). ' +
    'Tanggal format YYYY-MM-DD; jika tahun tidak tertulis, pakai ' + tahun + '. Jika tidak terbaca, isi "" atau 0. ' +
    'Pilihan akun: ' + akun + ' (Bank = BCA/transfer bank, E-wallet = GoPay/OVO/DANA/ShopeePay, Marketplace = saldo Shopee/Tokopedia, Tunai = bayar cash). ' +
    'Balas HANYA JSON tanpa teks lain.';
  if (mode === 'mutasi') {
    return umum + '\nGambar ini screenshot mutasi rekening BCA atau riwayat transaksi e-wallet. Baca SEMUA baris transaksi (jangan baris saldo). ' +
      'CR/kredit/uang masuk/tanda + = "masuk"; DB/debit/uang keluar/tanda - = "keluar". ' +
      'Kategori masuk: ' + daftarKategori_('masuk').concat(['Modal Masuk', 'Pindah Dana (masuk)']).join(', ') + '. ' +
      'Kategori keluar: ' + daftarKategori_('keluar').concat(['Prive (ambil pribadi)', 'Pindah Dana (keluar)']).join(', ') + '. ' +
      'Format: {"akun_usulan":"","baris":[{"tanggal":"","keterangan":"","jenis":"masuk|keluar","jumlah":0,"kategori_usulan":""}]}';
  }
  return umum + '\nGambar ini foto/screenshot nota, invoice, struk, atau bukti pembelian. ' +
    'Baca setiap barang terpisah. Kategori keluar yang boleh: ' + daftarKategori_('keluar').join(', ') + '. ' +
    'Petunjuk: akrilik/stiker/chip NFC/tinta/cetak = "Cetak Kartu & Bahan"; polymailer/bubble wrap/lakban = "Kemasan"; ' +
    'langganan aplikasi/kuota/iCloud/CapCut/Claude = "Aplikasi & Langganan"; iklan Meta/TikTok = "Iklan & Promosi"; kirim paket = "Ongkir". ' +
    'Format: {"tanggal":"","toko":"","items":[{"nama":"","qty":1,"harga_satuan":0,"subtotal":0,"kategori_usulan":""}],' +
    '"ongkir":0,"diskon":0,"biaya_layanan":0,"total":0,"kategori_usulan":"","akun_usulan":"","catatan":""}';
}

function gemini_(mode, b64, mime) {
  const key = prop_('GEMINI_API_KEY');
  if (!key) throw userErr_('Fitur baca foto belum aktif (kunci Gemini belum diisi). Minta owner mengisinya, atau isi manual dulu.');
  const model = getSetting_('gemini_model') || 'gemini-2.5-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
  const body = {
    contents: [{ parts: [{ text: promptFoto_(mode) }, { inline_data: { mime_type: mime || 'image/jpeg', data: b64 } }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  };
  const res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(body),
    headers: { 'x-goog-api-key': key }, muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code === 429) throw userErr_('Kuota AI gratis sedang penuh. Tunggu 1–2 menit lalu coba lagi, atau isi manual.');
  if (code === 400 || code === 403) {
    console.error('Gemini ' + code + ': ' + res.getContentText().slice(0, 500));
    throw userErr_('Kunci Gemini tidak valid atau model tidak tersedia. Minta owner mengecek Pengaturan.');
  }
  if (code !== 200) {
    console.error('Gemini ' + code + ': ' + res.getContentText().slice(0, 500));
    throw userErr_('AI sedang tidak bisa membaca foto. Coba lagi sebentar lagi, atau isi manual.');
  }
  const j = JSON.parse(res.getContentText());
  const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
  const txt = parts.map(function (p) { return p.text || ''; }).join('').replace(/^```(?:json)?|```$/gm, '').trim();
  try {
    return JSON.parse(txt);
  } catch (e) {
    console.error('Gemini bukan JSON: ' + txt.slice(0, 500));
    throw userErr_('AI tidak berhasil membaca foto ini. Coba foto yang lebih jelas, atau isi manual.');
  }
}

function bacaFoto_(d, u) {
  const mode = d.mode === 'mutasi' ? 'mutasi' : 'invoice';
  const f = simpanFoto_(d.gambar, d.mime, mode, u);
  const hasil = gemini_(mode, d.gambar, d.mime);
  if (mode === 'mutasi' && Array.isArray(hasil.baris)) {
    // Tandai baris yang kemungkinan sudah tercatat (tanggal + jumlah + jenis sama).
    const ada = {};
    activeTx_().forEach(function (t) { ada[t.tanggal + '|' + Math.round(num_(t.jumlah)) + '|' + t.jenis] = true; });
    hasil.baris.forEach(function (b) {
      b.mungkin_dobel = !!ada[b.tanggal + '|' + Math.round(num_(b.jumlah)) + '|' + b.jenis];
    });
  }
  log_(u.email, 'baca_foto', '', f.id, { mode: mode });
  return { bukti_url: f.url, mode: mode, hasil: hasil };
}
