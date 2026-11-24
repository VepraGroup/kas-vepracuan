# Kas VepraCuan

Web buku kas VepraCuan.

- **Backend:** Google Apps Script (`apps-script/`), dengan data di Google Sheet "Buku Kas VepraCuan (DB)".
- **Frontend:** halaman statis di GitHub Pages (`docs/`), alamatnya `kas.vepracuan.com`.
- **Login:** Google Identity Services. ID token diverifikasi di server, lalu email dicocokkan dengan tab Pengguna.

Cara pakai dan cara mengurusnya ada di [PANDUAN.md](PANDUAN.md).

Tidak ada rahasia maupun data bisnis di repo ini. Kunci API disimpan di Script Properties, dan data migrasi diabaikan oleh git.
