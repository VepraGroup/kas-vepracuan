/**
 * Konfigurasi dasar Buku Kas VepraCuan.
 * RAHASIA (GOOGLE_CLIENT_ID, GEMINI_API_KEY) TIDAK disimpan di sini,
 * tapi di Project Settings > Script Properties.
 */

const TZ = 'Asia/Jakarta';
const SESSION_DAYS = 30;

/** Kolom tiap tab Sheet. Urutan = urutan kolom di Sheet. */
const SHEETS = {
  Transaksi: ['id', 'tanggal', 'jenis', 'kategori', 'akun', 'jumlah', 'keterangan',
    'pembeli', 'produk', 'qty_kartu', 'harga_barang', 'ongkir', 'biaya_lynk',
    'bukti_url', 'sumber', 'ref_id', 'pasangan_id', 'perlu_cek',
    'dibuat_oleh', 'dibuat_pada', 'diubah_oleh', 'diubah_pada',
    'dihapus', 'dihapus_oleh', 'dihapus_pada', 'bahan', 'qty_bahan'],
  Stok: ['id', 'tanggal', 'jenis', 'jumlah', 'keterangan', 'ref_transaksi',
    'dibuat_oleh', 'dibuat_pada', 'dihapus', 'dihapus_oleh', 'dihapus_pada'],
  // Bahan baku: daftar jenis bahan + resep (berapa dipakai per 1 kartu)
  Bahan: ['kode', 'nama', 'satuan', 'per_kartu', 'batas', 'aktif'],
  // Mutasi stok bahan (+ beli, − pakai produksi, − reject, ± opname)
  StokBahan: ['id', 'tanggal', 'bahan', 'jenis', 'jumlah', 'keterangan', 'ref',
    'dibuat_oleh', 'dibuat_pada', 'dihapus', 'dihapus_oleh', 'dihapus_pada'],
  Pengguna: ['email', 'nama', 'peran', 'aktif'],
  Kategori: ['nama', 'jenis', 'hitung_laba', 'aktif'],
  Akun: ['nama', 'aktif'],
  Pengaturan: ['kunci', 'nilai', 'keterangan'],
  Log: ['waktu', 'email', 'aksi', 'tabel', 'id', 'detail'],
  LynkProses: ['message_id', 'thread_id', 'tanggal_email', 'subjek', 'jumlah_order',
    'status', 'catatan', 'diproses_pada'],
};

/** Kolom yang harus disimpan sebagai teks (supaya Sheets tidak mengubahnya jadi tanggal/angka). */
const TEXT_COLUMNS = ['id', 'tanggal', 'ref_id', 'pasangan_id', 'ref_transaksi', 'message_id',
  'thread_id', 'kunci', 'nilai', 'tanggal_email', 'kode', 'bahan', 'ref'];

const DEFAULT_BAHAN = [
  // [kode, nama, satuan, per_kartu, batas]
  ['akrilik', 'Akrilik', 'pcs', 1, 20],
  ['nfc', 'Chip NFC', 'pcs', 1, 20],
  ['stiker', 'Stiker', 'pcs', 1, 20],
  ['polymailer', 'Polymailer', 'pcs', 0, 10],
];
const SKEMA_VERSI = '3';

const DEFAULT_KATEGORI = [
  // [nama, jenis, hitung_laba]
  ['Penjualan Kartu', 'masuk', true],
  ['Akses Supplier', 'masuk', true],
  ['Paket Reseller 68rb', 'masuk', true],
  ['Pemasukan Lain', 'masuk', true],
  ['Modal Masuk', 'masuk', false],
  ['Pindah Dana (masuk)', 'masuk', false],
  ['Cetak Kartu & Bahan', 'keluar', true],
  ['Iklan & Promosi', 'keluar', true],
  ['Ongkir', 'keluar', true],
  ['Kemasan', 'keluar', true],
  ['Aplikasi & Langganan', 'keluar', true],
  ['Komisi Reseller/Affiliate', 'keluar', true],
  ['Gaji Karyawan', 'keluar', true],
  ['Biaya Admin', 'keluar', true],
  ['Pengeluaran Lain', 'keluar', true],
  ['Prive (ambil pribadi)', 'keluar', false],
  ['Pindah Dana (keluar)', 'keluar', false],
  ['Penyesuaian Saldo (masuk)', 'masuk', false],
  ['Penyesuaian Saldo (keluar)', 'keluar', false],
];

const DEFAULT_AKUN = ['Bank', 'E-wallet', 'Lynk', 'Marketplace', 'Tunai'];

const DEFAULT_PENGATURAN = [
  // [kunci, nilai, keterangan]
  ['batas_stok', '20', 'Peringatan kalau stok kartu di bawah angka ini'],
  ['lynk_hari_peringatan', '2', 'Peringatan kalau sekian hari tidak ada order Lynk tercatat'],
  ['lynk_query', 'from:lynk.id', 'Pencarian Gmail untuk email notifikasi Lynk'],
  ['lynk_mulai', '2026-11-07', 'Email Lynk sebelum tanggal ini tidak dicatat (sudah ada di data lama)'],
  ['lynk_tarik_mulai', '2026-11-16', 'Penarikan saldo Lynk sebelum tanggal ini tidak dicatat (sudah masuk penyesuaian 15 Nov)'],
  ['lynk_penyesuaian_id', 'adj-lynk-20261115', 'Baris penyesuaian saldo Lynk 15 Nov (dihitung ulang otomatis)'],
  ['lynk_penyesuaian_tanggal', '2026-11-15', 'Tanggal penyesuaian saldo Lynk'],
  ['gemini_model', 'gemini-2.5-flash', 'Model Gemini untuk membaca foto'],
];

const KATEGORI_PINDAH_MASUK = 'Pindah Dana (masuk)';
const KATEGORI_PINDAH_KELUAR = 'Pindah Dana (keluar)';
const KATEGORI_KARTU = 'Penjualan Kartu';

/** Izin per peran. */
const PERAN = {
  owner: ['lihat', 'tambah', 'ubah', 'ubah_semua', 'hapus', 'pengaturan', 'keuangan'],
  admin: ['lihat', 'tambah', 'ubah'],
};
