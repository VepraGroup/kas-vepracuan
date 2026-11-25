/* Ikon garis buatan sendiri untuk Kas VepraCuan (grid 24×24, stroke = currentColor). */
'use strict';

const IKON = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  catat: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>',
  daftar: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="2.6"/>',
  kartu: '<rect x="3" y="8" width="14" height="12" rx="2"/><path d="M7 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2"/><path d="M6.5 16h4"/>',
  lainnya: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  tunai: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/>',
  bank: '<path d="M3 9.5 12 4l9 5.5"/><path d="M4.5 9.5h15M6 9.5v8M10 9.5v8M14 9.5v8M18 9.5v8M3.5 20.5h17"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2.5"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  akrilik: '<rect x="4.5" y="3" width="15" height="18" rx="3"/><path d="M8 10.5 12 6.5M8 14.5l7.5-7.5"/>',
  stiker: '<path d="M20 12V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6"/><path d="M20 12h-5a3 3 0 0 0-3 3v5"/><path d="m20 12-8 8"/>',
  kemasan: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9M7.8 5.3l8.4 4.5"/>',
  truk: '<path d="M2.5 6h11v10.5h-11z"/><path d="M13.5 9.5H18l3.5 3.5v3.5h-8"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  iklan: '<path d="M3 10v4a1 1 0 0 0 1 1h3l8 4.5v-15L7 9H4a1 1 0 0 0-1 1z"/><path d="M18.5 9a4 4 0 0 1 0 6"/>',
  modal: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1z"/><path d="M4 7l11-3v3"/><path d="M9 13.5h5M11.5 11v5"/>',
  prive: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 11h5"/>',
  kamera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  awas: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5"/><path d="M12 17.3h.01" stroke-width="2.4"/>',
  cari: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  klip: '<path d="m20 11.5-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>',
  laporan: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  atur: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  keluar: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="m10 8-4 4 4 4M6 12h10"/>',
  cetak: '<path d="M7 9V3.5h10V9"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>',
  tabel: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  oke: '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8L16.2 9.5"/>',
  gagal: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  kiri: '<path d="m15 6-6 6 6 6"/>',
  kanan: '<path d="m9 6 6 6-6 6"/>',
  segar: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  opname: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.5h6V4"/><path d="m9 13 2 2 4-4"/>',
  tanda: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
  tukar: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
};

function ic(nama, cls) {
  return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IKON[nama] || '') + '</svg>';
}

/* Logo: huruf V + gelombang NFC (kartu yang di-tap). terang = versi putih untuk latar navy. */
function logoSvg(ukuran, terang) {
  const bg = terang ? '#ffffff' : '#14213d';
  const v = terang ? '#14213d' : '#ffffff';
  const gel = terang ? '#3d6fd9' : '#8fb4ff';
  return '<svg width="' + ukuran + '" height="' + ukuran + '" viewBox="0 0 64 64" aria-label="VepraCuan" role="img">' +
    '<rect width="64" height="64" rx="16" fill="' + bg + '"/>' +
    '<path d="M13 19 25.5 46 38 19" fill="none" stroke="' + v + '" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M42.5 27.5a6.5 6.5 0 0 1 0 9" fill="none" stroke="' + gel + '" stroke-width="3.6" stroke-linecap="round"/>' +
    '<path d="M47.5 23a13 13 0 0 1 0 18" fill="none" stroke="' + gel + '" stroke-width="3.6" stroke-linecap="round"/>' +
    '</svg>';
}
