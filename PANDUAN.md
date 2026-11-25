# Panduan Buku Kas VepraCuan

Web kas ini dibuka di **https://kas.vepracuan.com**, dan bisa dipakai dari HP maupun laptop.
Semua data tersimpan di Google Sheet **"Buku Kas VepraCuan (DB)"** milik akun **vepragroup0@gmail.com**.

---

## 1. Cara masuk

1. Buka **kas.vepracuan.com**.
2. Klik **Masuk dengan Google**, lalu pilih akun Google kamu.
3. Kalau muncul tulisan *"Email ... belum diberi izin masuk"*, minta owner menambahkan emailmu (lihat bagian 4).

Setelah masuk, kamu tetap masuk selama 30 hari di HP/browser itu. Untuk keluar, buka **Lainnya → Keluar**.

**Peran:**

| Peran | Bisa apa |
|---|---|
| **Owner** (Ahmad, Ariq) | Semua: melihat kas, saldo, laba, dan laporan; mencatat, mengubah, menghapus; Mutasi, Pindah Dana, Modal, Prive; membuka Pengaturan dan Google Sheet |
| **Admin** (misal Irran) | Mencatat pengeluaran dan penjualan (Manual, Foto Nota), melihat dan mengubah **catatannya sendiri**, mengurus stok, dan melihat status Lynk |

**Yang dirahasiakan dari admin** (dikunci di server, jadi datanya memang tidak pernah dikirim ke akun admin):
- kas sekarang, saldo per akun, total pemasukan, pengeluaran, dan laba, grafik, serta laporan bulanan,
- transaksi yang dicatat orang lain, termasuk order Lynk,
- Mutasi rekening, Pindah Dana, Modal, dan Prive,
- Google Sheet dan folder foto bukti. Admin hanya bisa membuka foto yang dia unggah sendiri.

Kalau peran seseorang diubah, tampilannya ikut berubah saat dia membuka halaman atau menekan tombol berikutnya, tanpa perlu keluar.

---

## 2. Pemakaian sehari-hari

### Beranda
- **Kas sekarang** adalah total uang di semua akun (Bank, E-wallet, Lynk, Marketplace, Tunai).
- **Pemasukan, Pengeluaran, Laba bersih** dihitung untuk bulan yang dipilih. Tekan tombol ‹ › untuk pindah bulan.
- **Modal Masuk, Prive, dan Pindah Dana** tidak dihitung sebagai pemasukan atau pengeluaran usaha, tapi tetap mengubah saldo akun.
- Kotak kuning atau merah berisi peringatan. Contohnya: Lynk sudah lebih dari 2 hari tidak ada order, stok menipis, atau ada transaksi yang perlu dicek.

### Catat (tombol ＋)
| Tab | Untuk apa |
|---|---|
| **Manual** | Mengetik transaksi sendiri. Tombol **Isi cepat** (jual kartu tunai, beli chip NFC, dll.) mengisi form otomatis, jadi tinggal isi jumlahnya. |
| **Foto Nota** | Memfoto atau memilih screenshot nota/invoice. AI mengisi tanggal, toko, barang, dan total. **Cek dulu**, baru tekan Simpan. Fotonya disimpan otomatis di Drive sebagai bukti. |
| **Mutasi** | Screenshot mutasi BCA atau riwayat e-wallet. AI membaca semua baris, kamu centang yang mau dicatat, lalu simpan sekaligus. Baris yang sepertinya sudah tercatat tidak dicentang otomatis. |
| **Pindah Dana** | Memindahkan uang antar akun, misalnya **tarik saldo Lynk ke BCA** atau setor tunai ke bank. Otomatis jadi dua baris. |

> Kalau mencatat **Penjualan Kartu**, isi **Jumlah kartu**. Stok otomatis berkurang sebanyak itu.

### Transaksi
- Cari transaksi dengan kata kunci, atau saring per bulan, jenis, akun, dan kategori.
- Ketuk transaksi untuk melihat detail, foto bukti, **Ubah**, atau **Hapus** (khusus owner).
- Transaksi yang dihapus **tidak benar-benar hilang**. Di Sheet, kolom `dihapus` terisi TRUE, dan perubahannya tercatat di tab **Log**.

### Memperbaiki salah input atau salah hitung (owner)
| Masalah | Caranya |
|---|---|
| Ada transaksi yang salah jumlah, tanggal, kategori, atau akun | **Transaksi** → tombol **Ubah** di transaksinya → perbaiki → **Simpan perubahan** |
| Ada transaksi dobel atau tidak seharusnya ada | **Transaksi** → tombol **Hapus** |
| Salah hapus | **Transaksi** → centang **Lihat yang sudah dihapus** → **Pulihkan** |
| Ada pemasukan atau pengeluaran yang lupa dicatat | **Catat** → isi seperti biasa (tanggal boleh mundur). Laba ikut terhitung |
| Saldo akun di aplikasi beda dengan kenyataan (misalnya saldo BCA) | **Beranda** → ketuk saldo akunnya (Bank, Lynk, dll.) → isi **Saldo sebenarnya**, atau **Tambah/Kurangi** → **Simpan koreksi** |

Koreksi saldo dicatat sebagai **Penyesuaian Saldo**, jadi tidak mengubah laba usaha. Koreksi ini juga muncul di daftar transaksi dengan ikon timbangan biru, dan bisa diubah atau dihapus seperti transaksi lain.

Owner juga bisa mengedit langsung di Google Sheet (tab **Transaksi**, misalnya kolom `jumlah`, `tanggal`, `kategori`). Aplikasi langsung membaca perubahannya. Jangan mengubah kolom `id`, `ref_id`, dan `pasangan_id`.

### Stok
- **Stok opname**: hitung fisik kartu jadi yang ada, isi angkanya, lalu Simpan. Sistem mencatat selisihnya sendiri.
- **Catat perubahan stok**: produksi (+), cacat (−), dipakai tes (−), dititip (−), titipan kembali (+).
- Order kartu dari Lynk dan transaksi Penjualan Kartu mengurangi stok otomatis.

### Laporan
Pilih **Lainnya → Laporan bulanan**, lalu tekan **Cetak / Simpan PDF**. Di HP, pilih **Simpan sebagai PDF**.

---

## 3. Pemasukan Lynk otomatis

- Setiap **10 menit**, sistem membaca Gmail vepragroup0 dan mencari email notifikasi Lynk. Order baru langsung tercatat di akun **Lynk**.
- Semua pesan dalam satu thread dibaca, dan satu email yang berisi beberapa order dicatat semuanya.
- Sistem mencegah pencatatan ganda dengan memakai ID email Gmail.
- Pemetaan produk:
  - "Panduan Lengkap A-Z Jadi Reseller" → **Paket Reseller 68rb**
  - "Akses Supplier Eksklusif Jadi Reseller" → **Akses Supplier**
  - "Akses Order Kartu Khusus Reseller Nx" → **Penjualan Kartu**, dan stok berkurang N
  - Produk lain → **Pemasukan Lain**, ditandai *perlu dicek*
- Email **penarikan saldo Lynk** dicatat otomatis sebagai Pindah Dana (Lynk → Bank).
- Kalau ingin mengecek saat itu juga, tekan **Cek email Lynk sekarang** di Beranda.

---

## 4. Menambah atau mencabut pengguna (owner)

1. Buka **Lainnya → Pengaturan → Pengguna**.
2. Isi email Google orangnya, nama, dan peran (Admin/Owner), lalu centang **Aktif**.
3. Tekan **Simpan pengguna**. Orang itu langsung bisa masuk, dan otomatis diberi akses lihat folder foto bukti. Owner juga diberi akses edit Google Sheet.
4. Untuk mencabut akses: tekan **Ubah** pada orangnya, hilangkan centang **Aktif**, lalu Simpan. Orang itu langsung keluar dari semua perangkat.

Di halaman Pengaturan, owner juga bisa:
- menambah kategori,
- mengubah batas stok menipis (default 20) dan batas hari peringatan Lynk (default 2),
- melihat riwayat perubahan (siapa mengubah apa dan kapan).

---

## 5. Kalau ada masalah

| Masalah | Yang dilakukan |
|---|---|
| "Email ... belum diberi izin masuk" | Minta owner menambahkan emailmu di Pengaturan → Pengguna. |
| "Sesi kamu sudah habis" | Masuk lagi dengan Google. |
| "Tidak bisa terhubung ke server" | Cek koneksi internet, lalu muat ulang halaman. |
| Peringatan "tidak ada order Lynk tercatat" | Cek dulu di dashboard Lynk apakah memang tidak ada order. Kalau ternyata ada, buka Pengaturan → Lynk → **Uji pembaca** dan kirim hasilnya ke yang mengurus sistem. |
| "Pencatatan Lynk otomatis terakhir gagal" | Buka Pengaturan dan lihat status. Biasanya penyebabnya izin Google kedaluwarsa. Buka editor Apps Script (bagian 6), jalankan `setup` sekali lagi, lalu klik **Izinkan**. |
| "Kuota AI gratis sedang penuh" | Tunggu 1–2 menit, lalu coba lagi. Atau isi lewat tab Manual. |
| "Kunci Gemini tidak valid" | Buat kunci baru di aistudio.google.com/apikey, lalu ganti `GEMINI_API_KEY` di Script Properties (bagian 6). |
| Saldo terasa tidak cocok | Buka Transaksi, saring per akun, lalu cocokkan dengan mutasi bank. Selisih kecil bisa dicatat lewat Pindah Dana atau transaksi penyesuaian. |
| Stok tidak cocok | Lakukan **Stok opname**. |

---

## 6. Untuk pengurus teknis

- **Kode:** repo GitHub `VepraGroup/kas-vepracuan`.
  - `apps-script/` berisi backend Google Apps Script, diunggah dengan `clasp push`.
  - `docs/` berisi tampilan web di GitHub Pages (kas.vepracuan.com).
- **Editor Apps Script:** buka Google Sheet → menu **Ekstensi → Apps Script**.
- **Rahasia** (tidak pernah ditaruh di kode): di editor Apps Script → ⚙️ **Project Settings** → **Script Properties**:
  - `GOOGLE_CLIENT_ID`: Client ID OAuth untuk login.
  - `GEMINI_API_KEY`: kunci Gemini untuk membaca foto.
  - `SHEET_ID`, `FOLDER_ID`, `LYNK_STATUS`, `sess_...`: diisi otomatis oleh sistem. Jangan diubah.
- **Fungsi yang bisa dijalankan dari editor:**
  - `setup`: menyiapkan atau memperbaiki tab, folder, dan trigger. Aman dijalankan ulang.
  - `pasangTrigger`: memasang ulang pencatatan Lynk tiap 10 menit.
  - `isiLynkSejak7Nov`: mengisi order Lynk yang terlewat sejak 7 Nov 2026.
  - `contohEmailLynk`: menampilkan 5 email Lynk terakhir beserta hasil bacaannya di log.
- **Setelah mengubah kode backend:** jalankan `clasp push`, lalu `clasp redeploy <ID deployment>` supaya alamat web app tetap sama.
- **Penyesuaian saldo Lynk 15 Nov:** saldo Lynk per 15 Nov 2026 dianggap Rp0 (semua sudah ditarik ke BCA). Kalau ada order bertanggal ≤ 15 Nov yang baru terisi belakangan, baris `adj-lynk-20261115` dihitung ulang otomatis supaya saldo Lynk di tanggal itu tetap 0. Penarikan Lynk sebelum 16 Nov juga tidak dicatat ulang.
