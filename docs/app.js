/* Kas VepraCuan — frontend (tanpa build, tanpa library). */
'use strict';

const CFG = window.KAS_CONFIG || {};
const S = {
  token: null, user: null, kategori: [], akun: [], batas_stok: 20, punya_gemini: false,
  bulan: null, editTx: null, catatTab: 'manual', filter: {}, foto: null,
};

/* ---------- Utilitas ---------- */
const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NF = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const rp = (n) => (Number(n) < 0 ? '-Rp' : 'Rp') + NF.format(Math.abs(Number(n) || 0));
const angka = (s) => Number(String(s == null ? '' : s).replace(/[^\d]/g, '')) || 0;
const fmtInput = (n) => (n ? NF.format(Math.round(n)) : '');
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function hariIni() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const namaBulan = (ym) => BULAN[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4);
const tglIndo = (ymd) => (ymd ? Number(ymd.slice(8, 10)) + ' ' + BLN[Number(ymd.slice(5, 7)) - 1] + ' ' + ymd.slice(0, 4) : '');
function geserBulan(ym, n) {
  const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
const AKUN_DOT = { Bank: 'dot-blue', 'E-wallet': 'dot-green', Lynk: 'dot-yellow', Marketplace: 'dot-red', Tunai: 'dot-purple' };
const bub = (ikon, warna) => `<span class="bub ${warna}">${ic(ikon)}</span>`;
const judul = (ikon, warna, teks) => `<h2>${bub(ikon, warna)}${teks}</h2>`;
const bubTx = (t) => (String(t.kategori).indexOf('Pindah Dana') === 0 ? bub('tukar', 'c-blue') : t.jenis === 'masuk' ? bub('masuk', 'c-green') : bub('keluar', 'c-red'));
const isOwner = () => S.user && S.user.peran === 'owner';
const bisa = (izin) => S.user && S.user.izin.indexOf(izin) >= 0;

function loading(on, teks) {
  $('#loading').classList.toggle('hidden', !on);
  $('#loading-text').textContent = teks || 'Memuat…';
}
let toastTimer;
function toast(msg, bad) {
  const t = $('#toast');
  t.innerHTML = ic(bad ? 'gagal' : 'oke') + '<span>' + esc(String(msg).replace(/\s*✅\s*/g, '')) + '</span>';
  t.className = 'toast' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), bad ? 6000 : 3000);
}
function modal(html) {
  $('#modal-card').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function tutupModal() { $('#modal').classList.add('hidden'); }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') tutupModal(); });
function konfirmasi(judul, teks, labelYa, bahaya) {
  return new Promise((resolve) => {
    modal(`<h2>${esc(judul)}</h2><p>${esc(teks)}</p><div class="btnrow">
      <button class="btn ghost" id="k-tidak">Batal</button>
      <button class="btn ${bahaya ? 'danger' : ''}" id="k-ya">${esc(labelYa || 'Ya')}</button></div>`);
    $('#k-tidak').onclick = () => { tutupModal(); resolve(false); };
    $('#k-ya').onclick = () => { tutupModal(); resolve(true); };
  });
}

/* ---------- API ---------- */
async function api(action, data, teksLoading) {
  if (teksLoading !== false) loading(true, teksLoading);
  try {
    let res;
    try {
      res = await fetch(CFG.API_URL, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token: S.token, data: data || {} }),
      });
    } catch (e) {
      throw new Error('Tidak bisa terhubung ke server. Periksa koneksi internet lalu coba lagi.');
    }
    let j;
    try { j = await res.json(); } catch (e) { throw new Error('Server memberi jawaban yang tidak terbaca. Coba lagi sebentar lagi.'); }
    if (!j.ok) {
      if (j.code === 'AUTH') { keluarLokal(); }
      throw new Error(j.error || 'Terjadi kesalahan.');
    }
    if (j.user && S.user && j.user.peran !== S.user.peran) sesuaikanPeran(j.user);
    return j.data;
  } finally {
    if (teksLoading !== false) loading(false);
  }
}

/* ---------- Login ---------- */
function tampilLogin(pesan) {
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
  const err = $('#login-err');
  err.textContent = pesan || '';
  err.classList.toggle('hidden', !pesan);
  const pasang = () => {
    if (!window.google || !google.accounts || !google.accounts.id) return setTimeout(pasang, 200);
    google.accounts.id.initialize({ client_id: CFG.GOOGLE_CLIENT_ID, callback: onGoogle, auto_select: false });
    google.accounts.id.renderButton($('#gbtn'), { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'id' });
  };
  pasang();
}
async function onGoogle(resp) {
  try {
    const r = await api('login', { idToken: resp.credential }, 'Memeriksa izin…');
    S.token = r.token;
    try { localStorage.setItem('kas_token', r.token); } catch (e) { /* abaikan */ }
    await mulai();
  } catch (e) {
    tampilLogin(e.message);
  }
}
function keluarLokal() {
  S.token = null;
  try { localStorage.removeItem('kas_token'); } catch (e) { /* abaikan */ }
}
async function keluar() {
  try { await api('logout', {}, 'Keluar…'); } catch (e) { /* abaikan */ }
  keluarLokal();
  if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
  tampilLogin();
}

function tulisNama() {
  $('#who').innerHTML = esc(S.user.nama) + '<br>' + (isOwner() ? 'Owner' : 'Admin');
}
/* Peran diubah owner saat halaman masih terbuka → tampilan langsung ikut berubah. */
function sesuaikanPeran(u) {
  S.user = u;
  tulisNama();
  toast('Peran kamu sekarang: ' + (u.peran === 'owner' ? 'Owner' : 'Admin') + '. Tampilan disesuaikan.');
  tutupModal();
  const hal = location.hash.replace(/^#\/?/, '').split('?')[0];
  if (hal === 'pengaturan' && u.peran !== 'owner') location.hash = '#/beranda';
  else setTimeout(router, 0);
}

async function mulai() {
  const b = await api('me', {}, 'Membuka buku kas…');
  Object.assign(S, b);
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  tulisNama();
  if (!location.hash || location.hash === '#') location.hash = '#/beranda';
  else router();
}

/* ---------- Router ---------- */
const VIEWS = {
  beranda: ['Beranda', viewBeranda], catat: ['Catat', viewCatat], transaksi: ['Transaksi', viewTransaksi],
  stok: ['Stok Kartu', viewStok], lainnya: ['Lainnya', viewLainnya], laporan: ['Laporan', viewLaporan],
  pengaturan: ['Pengaturan', viewPengaturan],
};
async function router() {
  if (!S.token || !S.user) return;
  const name = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'beranda';
  const v = VIEWS[name] || VIEWS.beranda;
  $('#page-title').textContent = v[0];
  $$('.bottomnav a').forEach((a) => {
    const n = a.dataset.nav;
    a.classList.toggle('active', n === name || (n === 'lainnya' && (name === 'laporan' || name === 'pengaturan')));
  });
  window.scrollTo(0, 0);
  try {
    await v[1]($('#view'));
  } catch (e) {
    $('#view').innerHTML = `<div class="alert bad">${esc(e.message)}</div><button class="btn ghost" onclick="router()">Coba lagi</button>`;
  }
}
window.addEventListener('hashchange', router);

/* ---------- Beranda ---------- */
/* Angka singkat untuk sumbu grafik: Rp1,5jt / Rp250rb */
function rpSingkat(n) {
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6) return s + 'Rp' + (a / 1e6).toFixed(a >= 1e7 || a % 1e6 === 0 ? 0 : 1).replace('.', ',') + 'jt';
  if (a >= 1e3) return s + 'Rp' + Math.round(a / 1e3) + 'rb';
  return s + 'Rp' + Math.round(a);
}
function langkahRapi(kasar) {
  const p = Math.pow(10, Math.floor(Math.log10(kasar || 1))), n = kasar / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
/* Grafik 6 bulan: batang masuk/keluar + garis laba. Digambar seukuran layar supaya tajam. */
function renderGrafik(data, pilih, animasi) {
  const box = $('#grafik'), info = $('#grafik-info');
  if (!box) return;
  S.grafik = data;
  S.grafikPilih = pilih;
  const W = Math.max(280, box.clientWidth), H = 236, padL = 54, padR = 8, padT = 16, padB = 30;
  const laba = data.map((d) => d.masuk - d.keluar);
  let max = Math.max(1, ...data.map((d) => Math.max(d.masuk, d.keluar)), ...laba);
  let min = Math.min(0, ...laba);
  const step = langkahRapi((max - min) / 4);
  max = Math.ceil(max / step) * step; min = Math.floor(min / step) * step;
  const y = (v) => padT + ((max - v) / (max - min)) * (H - padT - padB);
  const gw = (W - padL - padR) / data.length, bw = Math.max(8, Math.min(24, gw * 0.26)), r = Math.min(6, bw / 2);
  // Batang dengan sudut atas membulat
  const batang = (x, v, isi, i) => {
    const t = y(v), b = y(0), h = b - t;
    if (h < 1) return '';
    const rr = Math.min(r, h);
    return `<path class="${animasi ? 'tumbuh' : ''}" style="animation-delay:${i * 70}ms" fill="${isi}"
      d="M${x},${b} V${t + rr} Q${x},${t} ${x + rr},${t} H${x + bw - rr} Q${x + bw},${t} ${x + bw},${t + rr} V${b} Z"/>`;
  };
  let svg = `<defs>
    <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5bd17a"/><stop offset="1" stop-color="#188038"/></linearGradient>
    <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a7a"/><stop offset="1" stop-color="#d93025"/></linearGradient>
    <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4285f4" stop-opacity=".22"/><stop offset="1" stop-color="#4285f4" stop-opacity="0"/></linearGradient></defs>`;
  if (pilih != null) {
    svg += `<rect x="${padL + gw * pilih + 3}" y="${padT - 8}" width="${gw - 6}" height="${H - padT - padB + 32}" rx="12" fill="#eaf1fe"/>`;
  }
  for (let v = min; v <= max + step / 2; v += step) {
    const yy = y(v);
    svg += `<line x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" stroke="${v === 0 ? '#c9d2e3' : '#edf0f6'}" stroke-width="${v === 0 ? 1.4 : 1}" ${v === 0 ? '' : 'stroke-dasharray="3 4"'}/>`;
    svg += `<text x="${padL - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#8a94ab">${rpSingkat(v)}</text>`;
  }
  const titik = [];
  data.forEach((d, i) => {
    const cx = padL + gw * i + gw / 2;
    svg += batang(cx - bw - 2, d.masuk, 'url(#gIn)', i) + batang(cx + 2, d.keluar, 'url(#gOut)', i);
    svg += `<text x="${cx}" y="${H - 9}" text-anchor="middle" font-size="12" font-weight="${i === pilih ? 800 : 500}" fill="${i === pilih ? '#1a73e8' : '#5f6b85'}">${BLN[Number(d.bulan.slice(5, 7)) - 1]}</text>`;
    titik.push([cx, y(laba[i])]);
  });
  // Garis laba + area
  const garis = titik.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' ');
  svg += `<path d="${garis} L${titik[titik.length - 1][0]},${y(0)} L${titik[0][0]},${y(0)} Z" fill="url(#gArea)" class="${animasi ? 'muncul' : ''}"/>`;
  svg += `<path d="${garis}" fill="none" stroke="#1a73e8" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" class="${animasi ? 'muncul' : ''}"/>`;
  titik.forEach((p, i) => {
    svg += `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pilih ? 6 : 4}" fill="${i === pilih ? '#1a73e8' : '#fff'}" stroke="#1a73e8" stroke-width="2.5" class="${animasi ? 'muncul' : ''}"/>`;
  });
  // Area ketuk per bulan
  data.forEach((d, i) => { svg += `<rect class="hit" data-i="${i}" x="${padL + gw * i}" y="0" width="${gw}" height="${H}" fill="transparent"/>`; });
  box.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik pemasukan dan pengeluaran 6 bulan">${svg}</svg>`;
  $$('.hit', box).forEach((h) => { h.onclick = () => renderGrafik(data, Number(h.dataset.i), false); });
  if (info && pilih != null) {
    const d = data[pilih], l = laba[pilih];
    info.innerHTML = `<div class="ginfo-judul">${namaBulan(d.bulan)}</div><div class="ginfo">
      <div class="c-green"><span>${ic('masuk')}Masuk</span><b class="num">${rp(d.masuk)}</b></div>
      <div class="c-red"><span>${ic('keluar')}Keluar</span><b class="num">${rp(d.keluar)}</b></div>
      <div class="${l >= 0 ? 'c-blue' : 'c-yellow'}"><span>${ic('laba')}${l >= 0 ? 'Laba' : 'Rugi'}</span><b class="num">${rp(l)}</b></div></div>`;
  }
}
window.addEventListener('resize', () => {
  clearTimeout(window.__rg);
  window.__rg = setTimeout(() => { if ($('#grafik') && S.grafik) renderGrafik(S.grafik, S.grafikPilih != null ? S.grafikPilih : S.grafik.length - 1, false); }, 200);
});
function daftarKategoriHtml(list, total, cls) {
  if (!list.length) return '<p class="muted small">Belum ada.</p>';
  return '<ul class="list">' + list.map((k) => `<li><div style="flex:1">${esc(k.nama)}
    <div class="bar ${cls || ''}"><span style="width:${total ? Math.round((k.jumlah / total) * 100) : 0}%"></span></div></div>
    <div class="num">${rp(k.jumlah)}</div></li>`).join('') + '</ul>';
}
async function viewBeranda(el) {
  S.bulan = S.bulan || hariIni().slice(0, 7);
  const d = await api('dashboard', { bulan: S.bulan });
  const r = d.ringkas;
  let alerts = '';
  d.lynk.peringatan.forEach((p) => { alerts += `<div class="alert warn">${ic('awas')}<span>${esc(p)}</span></div>`; });
  if (d.stok.rendah) alerts += `<div class="alert bad">${ic('kartu')}<span>Stok kartu tinggal <b>${d.stok.sekarang}</b> (batas ${d.stok.batas}). Segera produksi.</span></div>`;
  if (d.perlu_cek) alerts += `<a href="#/transaksi" onclick="S.filter={perlu_cek:true}" style="text-decoration:none"><div class="alert info">${ic('tanda')}<span>Ada <b>${d.perlu_cek}</b> transaksi yang perlu dicek. Ketuk untuk melihat.</span></div></a>`;
  const run = d.lynk.run;
  el.innerHTML = `
    <div class="card hero">
      <div class="label">Kas sekarang (semua akun)</div>
      <div class="big num">${rp(d.kas)}</div>
      <div class="chips">${d.saldo.map((s) => `<div class="chip ${AKUN_DOT[s.akun] || 'dot-blue'}"><span class="nm">${esc(s.akun)}</span><b class="num">${rp(s.saldo)}</b></div>`).join('')}</div>
    </div>
    ${alerts}
    <div class="card">
      <div class="monthnav">
        <button class="btn ghost sm" id="b-prev" aria-label="Bulan sebelumnya">${ic('kiri')}</button><b>${namaBulan(d.bulan)}</b><button class="btn ghost sm" id="b-next" aria-label="Bulan berikutnya">${ic('kanan')}</button>
      </div>
      <div class="grid3">
        <div class="stat st-in"><div class="l">${ic('masuk')}Pemasukan</div><div class="v num">${rp(r.masuk)}</div></div>
        <div class="stat st-out"><div class="l">${ic('keluar')}Pengeluaran</div><div class="v num">${rp(r.keluar)}</div></div>
        <div class="stat ${r.laba >= 0 ? 'st-laba' : 'st-rugi'}"><div class="l">${ic('laba')}Laba bersih</div><div class="v num">${rp(r.laba)}</div></div>
      </div>
      ${r.non_usaha.length ? `<p class="small muted">Tidak dihitung sebagai usaha: ${r.non_usaha.map((n) => esc(n.nama) + ' ' + rp(n.jumlah)).join(' · ')}</p>` : ''}
    </div>
    <div class="card chart">${judul('grafik', 'c-blue', '6 bulan terakhir')}
      <div id="grafik" class="grafik"></div>
      <div class="legend"><span><i style="background:#34a853"></i>Pemasukan</span><span><i style="background:#ea4335"></i>Pengeluaran</span><span><i class="garis"></i>Laba bersih</span></div>
      <div id="grafik-info"></div>
      <p class="small muted" style="margin:8px 0 0">Ketuk bulan di grafik untuk melihat rinciannya.</p></div>
    <div class="card">${judul('laporan', 'c-purple', 'Rincian ' + namaBulan(d.bulan))}
      <h3 class="in">Pemasukan</h3>${daftarKategoriHtml(r.per_masuk, r.masuk, 'in')}
      <h3 class="out">Pengeluaran</h3>${daftarKategoriHtml(r.per_keluar, r.keluar, 'out')}
    </div>
    <div class="card">${judul('segar', 'c-yellow', 'Lynk otomatis')}
      <p class="small">Order terakhir tercatat: <b>${d.lynk.order_terakhir ? tglIndo(d.lynk.order_terakhir) + ' (' + d.lynk.hari_sejak + ' hari lalu)' : '-'}</b><br>
      Pengecekan terakhir: ${run ? esc(run.waktu.replace('T', ' ')) + ' — ' + (run.ok ? ic('oke', 'in') : ic('gagal', 'out')) + esc(run.pesan) : 'belum pernah'}</p>
      <button class="btn ghost sm" id="b-lynk">Cek email Lynk sekarang</button>
    </div>
    <div class="card">${judul('kartu', 'c-red', 'Stok kartu')}<p>Sisa <b>${d.stok.sekarang}</b> kartu <span class="muted small">(batas peringatan ${d.stok.batas})</span></p>
      <a class="btn ghost sm" href="#/stok">Buka Stok</a></div>`;
  renderGrafik(d.grafik, d.grafik.length - 1, true);
  $('#b-prev').onclick = () => { S.bulan = geserBulan(S.bulan, -1); viewBeranda(el); };
  $('#b-next').onclick = () => { S.bulan = geserBulan(S.bulan, 1); viewBeranda(el); };
  $('#b-lynk').onclick = async () => {
    try {
      const h = await api('syncLynk', {}, 'Membaca email Lynk…');
      toast(`Selesai: ${h.order_baru} order baru, ${h.tarik_baru} penarikan, ${h.perlu_cek} perlu dicek.`);
      viewBeranda(el);
    } catch (e) { toast(e.message, true); }
  };
}

/* ---------- Form bersama ---------- */
function opsiKategori(jenis, pilih, semua) {
  return S.kategori.filter((k) => semua || k.jenis === jenis)
    .map((k) => `<option ${k.nama === pilih ? 'selected' : ''}>${esc(k.nama)}</option>`).join('');
}
function opsiAkun(pilih) { return S.akun.map((a) => `<option ${a === pilih ? 'selected' : ''}>${esc(a)}</option>`).join(''); }
function pasangRupiah(root) {
  $$('input.rupiah', root).forEach((inp) => {
    inp.addEventListener('input', () => {
      const n = angka(inp.value);
      inp.value = fmtInput(n);
    });
  });
}
function kategoriCocok(jenis, nama) { const k = S.kategori.find((x) => x.nama === nama); return k && k.jenis === jenis; }

/* Kompres foto di HP sebelum dikirim (maks 1600px, JPEG). */
function bacaGambar(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Foto tidak bisa dibaca.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format foto tidak didukung. Coba screenshot atau foto JPG.'));
      img.onload = () => {
        const max = 1600, sc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', 0.85);
        resolve({ dataUrl: url, b64: url.split(',')[1], mime: 'image/jpeg' });
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ---------- Catat ---------- */
const ISI_CEPAT = [
  { ikon: 'tunai', label: 'Jual kartu tunai', jenis: 'masuk', kategori: 'Penjualan Kartu', akun: 'Tunai', ket: 'Jual kartu langsung' },
  { ikon: 'bank', label: 'Jual kartu transfer', jenis: 'masuk', kategori: 'Penjualan Kartu', akun: 'Bank', ket: 'Jual kartu langsung (transfer)' },
  { ikon: 'chip', label: 'Beli chip NFC', jenis: 'keluar', kategori: 'Cetak Kartu & Bahan', akun: 'Bank', ket: 'Beli chip NFC' },
  { ikon: 'akrilik', label: 'Beli akrilik', jenis: 'keluar', kategori: 'Cetak Kartu & Bahan', akun: 'Bank', ket: 'Beli akrilik' },
  { ikon: 'stiker', label: 'Beli stiker', jenis: 'keluar', kategori: 'Cetak Kartu & Bahan', akun: 'Bank', ket: 'Beli stiker' },
  { ikon: 'kemasan', label: 'Kemasan', jenis: 'keluar', kategori: 'Kemasan', akun: 'Bank', ket: 'Polymailer / bubble wrap' },
  { ikon: 'truk', label: 'Ongkir', jenis: 'keluar', kategori: 'Ongkir', akun: 'Bank', ket: 'Ongkir Biteship' },
  { ikon: 'iklan', label: 'Iklan', jenis: 'keluar', kategori: 'Iklan & Promosi', akun: 'Bank', ket: 'Iklan' },
  { ikon: 'modal', label: 'Modal masuk', jenis: 'masuk', kategori: 'Modal Masuk', akun: 'Bank', ket: 'Setor modal' },
  { ikon: 'prive', label: 'Prive', jenis: 'keluar', kategori: 'Prive (ambil pribadi)', akun: 'Bank', ket: 'Ambil pribadi' },
];

async function viewCatat(el) {
  const tabs = [['manual', 'Manual'], ['nota', 'Foto Nota'], ['mutasi', 'Mutasi'], ['pindah', 'Pindah Dana']];
  if (S.editTx) S.catatTab = 'manual';
  el.innerHTML = `<div class="seg" id="c-tabs">${tabs.map((t) => `<button data-t="${t[0]}" class="${S.catatTab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div><div id="c-body"></div>`;
  $$('#c-tabs button').forEach((b) => { b.onclick = () => { S.catatTab = b.dataset.t; S.editTx = null; S.foto = null; viewCatat(el); }; });
  const body = $('#c-body');
  if (S.catatTab === 'manual') formManual(body);
  else if (S.catatTab === 'nota') formNota(body);
  else if (S.catatTab === 'mutasi') formMutasi(body);
  else formPindah(body);
}

function formManual(el) {
  const t = S.editTx || { jenis: 'keluar', tanggal: hariIni(), akun: 'Bank' };
  const edit = !!S.editTx;
  const pindah = edit && t.pasangan_id;
  el.innerHTML = `
    ${edit ? `<div class="alert info">Mengubah transaksi ${esc(tglIndo(t.tanggal))} — ${esc(t.keterangan)}
      <button class="btn ghost sm" id="m-batal" style="margin-left:8px">Batal ubah</button></div>` : `
    <div class="card">${judul('petir', 'c-yellow', 'Isi cepat')}<div class="quick">${ISI_CEPAT.map((q, i) => `<button data-q="${i}">${bub(q.ikon, q.kategori === 'Modal Masuk' ? 'c-yellow' : q.kategori.indexOf('Prive') === 0 ? 'c-purple' : q.jenis === 'masuk' ? 'c-green' : 'c-red')}${q.label}</button>`).join('')}</div></div>`}
    <div class="card">
      ${pindah ? '<p class="small muted">Ini transaksi pindah dana: hanya tanggal, jumlah, dan keterangan yang bisa diubah.</p>' : `
      <div class="seg" id="m-jenis"><button data-j="masuk">Pemasukan</button><button data-j="keluar">Pengeluaran</button></div>`}
      <div class="row2">
        <div><label class="f">Tanggal</label><input type="date" id="m-tgl" value="${esc(t.tanggal)}"></div>
        <div><label class="f">Jumlah (Rp)</label><input class="rupiah num" id="m-jml" inputmode="numeric" placeholder="0" value="${fmtInput(t.jumlah)}"></div>
      </div>
      ${pindah ? '' : `
      <div class="row2">
        <div><label class="f">Kategori</label><select id="m-kat"></select></div>
        <div><label class="f">Akun</label><select id="m-akun">${opsiAkun(t.akun)}</select></div>
      </div>
      <div id="m-kartu" class="row2">
        <div><label class="f">Jumlah kartu</label><input id="m-qty" inputmode="numeric" placeholder="0" value="${esc(t.qty_kartu || '')}"></div>
        <div><label class="f">Pembeli</label><input id="m-pembeli" placeholder="Nama usaha/pembeli" value="${esc(t.pembeli || '')}"></div>
      </div>`}
      <label class="f">Keterangan</label><textarea id="m-ket" placeholder="Contoh: Beli chip NFC 100 pcs di Shopee">${esc(t.keterangan || '')}</textarea>
      ${pindah ? '' : `<label class="f">Foto bukti (opsional)</label>
      <input type="file" id="m-foto" accept="image/*">
      ${t.bukti_url ? `<p class="small"><a href="${esc(t.bukti_url)}" target="_blank" rel="noopener">Lihat bukti sekarang</a></p>` : ''}`}
      <button class="btn block" id="m-simpan">${edit ? 'Simpan perubahan' : 'Simpan'}</button>
    </div>`;
  pasangRupiah(el);
  let jenis = t.jenis;
  const setJenis = (j, kat) => {
    jenis = j;
    $$('#m-jenis button').forEach((b) => b.classList.toggle('on', b.dataset.j === j));
    const sb = $('#m-simpan'); if (sb) { sb.classList.toggle('go-in', j === 'masuk'); sb.classList.toggle('go-out', j === 'keluar'); }
    const sel = $('#m-kat');
    if (sel) {
      sel.innerHTML = opsiKategori(j, kat);
      if (kat && !kategoriCocok(j, kat)) sel.selectedIndex = 0;
      cekKartu();
    }
  };
  const cekKartu = () => { const k = $('#m-kat'); if (k) $('#m-kartu').classList.toggle('hidden', k.value !== 'Penjualan Kartu'); };
  if (!pindah) {
    $$('#m-jenis button').forEach((b) => { b.onclick = () => setJenis(b.dataset.j); });
    $('#m-kat').onchange = cekKartu;
    setJenis(t.jenis, t.kategori);
  }
  if (edit) $('#m-batal').onclick = () => { S.editTx = null; location.hash = '#/transaksi'; };
  $$('.quick button', el).forEach((b) => {
    b.onclick = () => {
      const q = ISI_CEPAT[Number(b.dataset.q)];
      setJenis(q.jenis, q.kategori);
      $('#m-kat').value = q.kategori; cekKartu();
      $('#m-akun').value = q.akun;
      $('#m-ket').value = q.ket;
      $('#m-jml').focus();
    };
  });
  $('#m-simpan').onclick = async () => {
    try {
      const data = { id: edit ? t.id : undefined, jenis, tanggal: $('#m-tgl').value, jumlah: angka($('#m-jml').value), keterangan: $('#m-ket').value };
      if (!pindah) {
        Object.assign(data, { kategori: $('#m-kat').value, akun: $('#m-akun').value });
        if (data.kategori === 'Penjualan Kartu') { data.qty_kartu = angka($('#m-qty').value); data.pembeli = $('#m-pembeli').value; }
        if (edit) { data.produk = t.produk; data.harga_barang = t.harga_barang; data.ongkir = t.ongkir; data.biaya_lynk = t.biaya_lynk; if (data.kategori !== 'Penjualan Kartu') data.pembeli = t.pembeli; }
        const f = $('#m-foto').files[0];
        if (f) {
          const g = await bacaGambar(f);
          const up = await api('uploadBukti', { gambar: g.b64, mime: g.mime }, 'Mengunggah foto bukti…');
          data.bukti_url = up.bukti_url;
        }
      }
      await api('simpanTransaksi', data, 'Menyimpan…');
      toast(edit ? 'Perubahan tersimpan' : 'Transaksi tersimpan');
      if (edit) { S.editTx = null; location.hash = '#/transaksi'; } else formManual(el);
    } catch (e) { toast(e.message, true); }
  };
}

function inputFotoHtml(id, teks) {
  return `<label class="btn ghost block" style="margin-top:0">${ic('kamera')}${teks}<input type="file" id="${id}" accept="image/*" class="hidden"></label>`;
}

function formNota(el) {
  if (!S.punya_gemini) {
    el.innerHTML = '<div class="alert warn">Fitur baca foto belum aktif karena kunci Gemini belum diisi. Minta owner mengisinya (lihat PANDUAN). Sementara itu pakai tab Manual.</div>';
    return;
  }
  el.innerHTML = `<div class="card"><h2>Foto nota / invoice</h2>
    <p class="small muted">Ambil foto atau pilih screenshot nota. AI akan mengisi formnya, lalu kamu cek dulu sebelum disimpan.</p>
    ${inputFotoHtml('n-file', 'Pilih / ambil foto')}<div id="n-prev"></div></div><div id="n-form"></div>`;
  $('#n-file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const g = await bacaGambar(f);
      $('#n-prev').innerHTML = `<img class="photo-preview" src="${g.dataUrl}" alt="">`;
      const r = await api('bacaFoto', { gambar: g.b64, mime: g.mime, mode: 'invoice' }, 'AI sedang membaca nota…');
      isiFormNota($('#n-form'), r.hasil || {}, r.bukti_url);
    } catch (err) { toast(err.message, true); }
  };
}

function isiFormNota(el, h, buktiUrl) {
  const items = (Array.isArray(h.items) && h.items.length ? h.items : [{ nama: h.toko || 'Pembelian', qty: 1, harga_satuan: h.total, subtotal: h.total }])
    .map((it) => ({ nama: it.nama || '', qty: Number(it.qty) || 1, subtotal: Number(it.subtotal) || (Number(it.qty) || 1) * (Number(it.harga_satuan) || 0),
      kategori: kategoriCocok('keluar', it.kategori_usulan) ? it.kategori_usulan : (kategoriCocok('keluar', h.kategori_usulan) ? h.kategori_usulan : 'Cetak Kartu & Bahan') }));
  const akun = S.akun.indexOf(h.akun_usulan) >= 0 ? h.akun_usulan : 'Bank';
  el.innerHTML = `<div class="card"><h2>Cek hasil bacaan AI</h2>
    <div class="alert info small">Periksa angka & kategori. Belum ada yang tersimpan sampai kamu menekan Simpan.</div>
    <div class="row2"><div><label class="f">Tanggal</label><input type="date" id="n-tgl" value="${esc(h.tanggal || hariIni())}"></div>
      <div><label class="f">Dibayar dari akun</label><select id="n-akun">${opsiAkun(akun)}</select></div></div>
    <label class="f">Toko / penjual</label><input id="n-toko" value="${esc(h.toko || '')}">
    <h3>Barang</h3><div id="n-items"></div>
    <div class="row2"><div><label class="f">Ongkir + biaya lain</label><input class="rupiah num" id="n-ongkir" inputmode="numeric" value="${fmtInput((Number(h.ongkir) || 0) + (Number(h.biaya_layanan) || 0))}"></div>
      <div><label class="f">Diskon</label><input class="rupiah num" id="n-diskon" inputmode="numeric" value="${fmtInput(h.diskon)}"></div></div>
    <label class="f">Total di nota</label><input class="rupiah num" id="n-total" inputmode="numeric" value="${fmtInput(h.total)}">
    <p class="small" id="n-cek"></p>
    <label class="check" style="margin-top:12px"><input type="checkbox" id="n-per" ${items.length > 1 ? 'checked' : ''}> Simpan per barang (satu baris per barang)</label>
    ${h.catatan ? `<p class="small muted">Catatan AI: ${esc(h.catatan)}</p>` : ''}
    <p class="small"><a href="${esc(buktiUrl)}" target="_blank" rel="noopener">Foto bukti tersimpan di Drive</a></p>
    <button class="btn block" id="n-simpan">Simpan</button></div>`;
  const wrap = $('#n-items');
  wrap.innerHTML = items.map((it, i) => `<div class="item-row" data-i="${i}">
    <input class="it-nama" value="${esc(it.nama)}" placeholder="Nama barang">
    <div class="row2"><div><label class="f">Jumlah</label><input class="it-qty" inputmode="numeric" value="${it.qty}"></div>
      <div><label class="f">Subtotal (Rp)</label><input class="it-sub rupiah num" inputmode="numeric" value="${fmtInput(it.subtotal)}"></div></div>
    <label class="f">Kategori</label><select class="it-kat">${opsiKategori('keluar', it.kategori)}</select></div>`).join('');
  pasangRupiah(el);
  const hitung = () => {
    const sub = $$('.it-sub', wrap).reduce((a, x) => a + angka(x.value), 0);
    const hasil = sub + angka($('#n-ongkir').value) - angka($('#n-diskon').value);
    const total = angka($('#n-total').value);
    $('#n-cek').innerHTML = total && hasil !== total
      ? `<span class="err">${ic('awas')} Barang + ongkir − diskon = ${rp(hasil)}, beda dengan total nota ${rp(total)}. Yang disimpan mengikuti total nota.</span>`
      : `<span class="in">${ic('oke')} Jumlah cocok: ${rp(total || hasil)}</span>`;
  };
  $$('input', el).forEach((x) => x.addEventListener('input', hitung));
  hitung();
  $('#n-simpan').onclick = async () => {
    try {
      const tgl = $('#n-tgl').value, akunV = $('#n-akun').value, toko = $('#n-toko').value.trim();
      const rows = $$('.item-row', wrap).map((r) => ({ nama: $('.it-nama', r).value.trim(), qty: angka($('.it-qty', r).value),
        sub: angka($('.it-sub', r).value), kat: $('.it-kat', r).value })).filter((r) => r.sub > 0);
      const sumSub = rows.reduce((a, r) => a + r.sub, 0);
      const ongkir = angka($('#n-ongkir').value), diskon = angka($('#n-diskon').value);
      const total = angka($('#n-total').value) || (sumSub + ongkir - diskon);
      if (!(total > 0)) throw new Error('Total masih Rp0. Isi jumlahnya dulu.');
      const label = (r) => r.nama + (r.qty > 1 ? ' (' + r.qty + ' pcs)' : '') + (toko ? ' – ' + toko : '');
      let out = [];
      if ($('#n-per').checked && rows.length) {
        // Diskon dibagi rata sesuai proporsi; ongkir jadi baris sendiri.
        const faktor = sumSub ? Math.max(0, (total - ongkir) / sumSub) : 1;
        let sisa = total;
        rows.forEach((r, i) => {
          const j = i === rows.length - 1 && !ongkir ? sisa : Math.round(r.sub * faktor);
          sisa -= j;
          out.push({ jenis: 'keluar', tanggal: tgl, akun: akunV, kategori: r.kat, jumlah: j, keterangan: label(r) });
        });
        if (ongkir) out.push({ jenis: 'keluar', tanggal: tgl, akun: akunV, kategori: 'Ongkir', jumlah: sisa, keterangan: 'Ongkir/biaya' + (toko ? ' – ' + toko : '') });
      } else {
        const kat = rows[0] ? rows[0].kat : 'Pengeluaran Lain';
        out = [{ jenis: 'keluar', tanggal: tgl, akun: akunV, kategori: kat, jumlah: total,
          keterangan: (rows.map(label).join(', ') || toko || 'Pembelian').slice(0, 480) }];
      }
      out = out.filter((o) => o.jumlah > 0);
      await api('simpanBanyak', { items: out, bukti_url: buktiUrl, sumber: 'foto-nota' }, 'Menyimpan…');
      toast(out.length + ' transaksi tersimpan');
      S.foto = null; viewCatat($('#view'));
    } catch (e) { toast(e.message, true); }
  };
}

function formMutasi(el) {
  if (!S.punya_gemini) {
    el.innerHTML = '<div class="alert warn">Fitur baca foto belum aktif karena kunci Gemini belum diisi. Minta owner mengisinya.</div>';
    return;
  }
  el.innerHTML = `<div class="card"><h2>Screenshot mutasi BCA / e-wallet</h2>
    <p class="small muted">AI membaca semua baris. Centang yang mau dicatat, lalu simpan sekaligus.</p>
    ${inputFotoHtml('u-file', 'Pilih screenshot')}<div id="u-prev"></div></div><div id="u-form"></div>`;
  $('#u-file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const g = await bacaGambar(f);
      $('#u-prev').innerHTML = `<img class="photo-preview" src="${g.dataUrl}" alt="">`;
      const r = await api('bacaFoto', { gambar: g.b64, mime: g.mime, mode: 'mutasi' }, 'AI sedang membaca mutasi…');
      isiFormMutasi($('#u-form'), r.hasil || {}, r.bukti_url);
    } catch (err) { toast(err.message, true); }
  };
}

function isiFormMutasi(el, h, buktiUrl) {
  const baris = Array.isArray(h.baris) ? h.baris : [];
  if (!baris.length) { el.innerHTML = '<div class="alert warn">AI tidak menemukan baris transaksi. Coba screenshot yang lebih jelas.</div>'; return; }
  const akun = S.akun.indexOf(h.akun_usulan) >= 0 ? h.akun_usulan : 'Bank';
  el.innerHTML = `<div class="card"><h2>${baris.length} baris terbaca</h2>
    <label class="f">Akun</label><select id="u-akun">${opsiAkun(akun)}</select>
    <div id="u-rows">${baris.map((b, i) => {
      const jenis = b.jenis === 'masuk' ? 'masuk' : 'keluar';
      const kat = kategoriCocok(jenis, b.kategori_usulan) ? b.kategori_usulan : (jenis === 'masuk' ? 'Pemasukan Lain' : 'Pengeluaran Lain');
      return `<div class="item-row ${b.mungkin_dobel ? 'off' : ''}" data-i="${i}" data-j="${jenis}">
        <label class="check"><input type="checkbox" class="r-on" ${b.mungkin_dobel ? '' : 'checked'}>
          <b class="${jenis === 'masuk' ? 'in' : 'out'}">${jenis === 'masuk' ? '+ Masuk' : '− Keluar'}</b>
          ${b.mungkin_dobel ? '<span class="badge">mungkin sudah tercatat</span>' : ''}</label>
        <div class="row2"><div><label class="f">Tanggal</label><input type="date" class="r-tgl" value="${esc(b.tanggal || hariIni())}"></div>
          <div><label class="f">Jumlah</label><input class="r-jml rupiah num" inputmode="numeric" value="${fmtInput(b.jumlah)}"></div></div>
        <label class="f">Keterangan</label><input class="r-ket" value="${esc(b.keterangan || '')}">
        <label class="f">Kategori</label><select class="r-kat">${opsiKategori(jenis, kat)}</select></div>`;
    }).join('')}</div>
    <button class="btn block" id="u-simpan">Simpan yang dicentang</button></div>`;
  pasangRupiah(el);
  $$('.r-on', el).forEach((c) => { c.onchange = () => c.closest('.item-row').classList.toggle('off', !c.checked); });
  $('#u-simpan').onclick = async () => {
    try {
      const akunV = $('#u-akun').value;
      const items = $$('.item-row', el).filter((r) => $('.r-on', r).checked).map((r) => ({
        jenis: r.dataset.j, tanggal: $('.r-tgl', r).value, jumlah: angka($('.r-jml', r).value), akun: akunV,
        keterangan: $('.r-ket', r).value, kategori: $('.r-kat', r).value }));
      if (!items.length) throw new Error('Belum ada baris yang dicentang.');
      await api('simpanBanyak', { items, bukti_url: buktiUrl, sumber: 'foto-mutasi' }, 'Menyimpan…');
      toast(items.length + ' transaksi tersimpan');
      viewCatat($('#view'));
    } catch (e) { toast(e.message, true); }
  };
}

function formPindah(el) {
  el.innerHTML = `<div class="card"><h2>Pindah dana antar akun</h2>
    <p class="small muted">Contoh: tarik saldo Lynk ke BCA, atau setor tunai ke bank. Tidak dihitung sebagai pemasukan/pengeluaran usaha.</p>
    <div class="row2"><div><label class="f">Dari akun</label><select id="p-dari">${opsiAkun('Lynk')}</select></div>
      <div><label class="f">Ke akun</label><select id="p-ke">${opsiAkun('Bank')}</select></div></div>
    <div class="row2"><div><label class="f">Tanggal</label><input type="date" id="p-tgl" value="${hariIni()}"></div>
      <div><label class="f">Jumlah (Rp)</label><input class="rupiah num" id="p-jml" inputmode="numeric" placeholder="0"></div></div>
    <label class="f">Keterangan (opsional)</label><input id="p-ket">
    <button class="btn block" id="p-simpan">Simpan</button></div>`;
  pasangRupiah(el);
  $('#p-simpan').onclick = async () => {
    try {
      await api('pindahDana', { dari: $('#p-dari').value, ke: $('#p-ke').value, tanggal: $('#p-tgl').value,
        jumlah: angka($('#p-jml').value), keterangan: $('#p-ket').value }, 'Menyimpan…');
      toast('Pindah dana tersimpan');
      formPindah(el);
    } catch (e) { toast(e.message, true); }
  };
}

/* ---------- Transaksi ---------- */
async function viewTransaksi(el) {
  const f = S.filter;
  el.innerHTML = `<div class="card">
    <div class="search">${ic('cari')}<input id="t-q" placeholder="Cari keterangan, pembeli, nominal…" value="${esc(f.q || '')}"></div>
    <div class="filters">
      <input type="month" id="t-bulan" value="${esc(f.bulan || '')}">
      <select id="t-jenis"><option value="">Semua jenis</option><option value="masuk" ${f.jenis === 'masuk' ? 'selected' : ''}>Pemasukan</option><option value="keluar" ${f.jenis === 'keluar' ? 'selected' : ''}>Pengeluaran</option></select>
      <select id="t-akun"><option value="">Semua akun</option>${opsiAkun(f.akun)}</select>
      <select id="t-kat"><option value="">Semua kategori</option>${opsiKategori(null, f.kategori, true)}</select>
    </div>
    <label class="check" style="margin-top:10px"><input type="checkbox" id="t-cek" ${f.perlu_cek ? 'checked' : ''}> Hanya yang perlu dicek</label>
    </div><div id="t-list"></div>`;
  if (!f.akun) $('#t-akun').value = '';
  if (!f.kategori) $('#t-kat').value = '';
  const muat = async () => {
    S.filter = { q: $('#t-q').value.trim(), bulan: $('#t-bulan').value, jenis: $('#t-jenis').value, akun: $('#t-akun').value,
      kategori: $('#t-kat').value, perlu_cek: $('#t-cek').checked };
    const box = $('#t-list');
    box.innerHTML = '<p class="muted">Memuat…</p>';
    try {
      const r = await api('listTransaksi', S.filter, false);
      box.innerHTML = `<div class="card"><div class="sumrow"><span class="pill c-blue">${r.total} transaksi</span><span class="pill c-green">${ic('masuk')}${rp(r.masuk)}</span><span class="pill c-red">${ic('keluar')}${rp(r.keluar)}</span></div>${r.total > r.items.length ? '<p class="small muted">Menampilkan ' + r.items.length + ' terbaru</p>' : ''}
        ${r.items.length ? r.items.map((t, i) => `<div class="tx" data-i="${i}">${bubTx(t)}<div class="mid"><div class="t1">${esc(t.keterangan || t.kategori)}${String(t.perlu_cek).toUpperCase() === 'TRUE' ? '<span class="badge">perlu dicek</span>' : ''}</div>
          <div class="t2">${tglIndo(t.tanggal)} · ${esc(t.kategori)} · ${esc(t.akun)}${t.qty_kartu ? ' · ' + t.qty_kartu + ' kartu' : ''}</div></div>
          <div class="amt num ${String(t.kategori).indexOf('Pindah Dana') === 0 ? 'pd' : t.jenis === 'masuk' ? 'in' : 'out'}">${t.jenis === 'masuk' ? '+' : '−'}${rp(t.jumlah)}</div></div>`).join('') : '<p class="muted">Tidak ada transaksi.</p>'}</div>`;
      $$('.tx', box).forEach((row) => { row.onclick = () => detailTx(r.items[Number(row.dataset.i)], muat); });
    } catch (e) { box.innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
  };
  let timer;
  $('#t-q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(muat, 400); });
  ['#t-bulan', '#t-jenis', '#t-akun', '#t-kat', '#t-cek'].forEach((s) => $(s).addEventListener('change', muat));
  muat();
}

function detailTx(t, muatUlang) {
  const kv = [['Tanggal', tglIndo(t.tanggal)], ['Jenis', t.jenis === 'masuk' ? 'Pemasukan' : 'Pengeluaran'], ['Jumlah', rp(t.jumlah)],
    ['Kategori', t.kategori], ['Akun', t.akun], ['Keterangan', t.keterangan], ['Pembeli', t.pembeli], ['Produk', t.produk],
    ['Jumlah kartu', t.qty_kartu], ['Harga barang', t.harga_barang ? rp(t.harga_barang) : ''], ['Ongkir', t.ongkir ? rp(t.ongkir) : ''],
    ['Biaya Lynk', t.biaya_lynk ? rp(t.biaya_lynk) : ''], ['Sumber', t.sumber], ['Dicatat oleh', t.dibuat_oleh + ' · ' + String(t.dibuat_pada).replace('T', ' ')],
    ['Diubah', t.diubah_oleh ? t.diubah_oleh + ' · ' + String(t.diubah_pada).replace('T', ' ') : '']].filter((x) => x[1] !== '' && x[1] != null);
  const bolehUbah = bisa('ubah_semua') || (bisa('ubah') && t.dibuat_oleh === S.user.email);
  modal(`<h2>Detail transaksi</h2>
    ${String(t.perlu_cek).toUpperCase() === 'TRUE' ? '<div class="alert warn small">Transaksi ini perlu dicek. Periksa jumlah & kategori, lalu simpan ulang lewat tombol Ubah.</div>' : ''}
    <div class="kv">${kv.map((x) => `<div>${esc(x[0])}</div><div>${esc(x[1])}</div>`).join('')}</div>
    ${t.bukti_url ? `<p><a href="${esc(t.bukti_url)}" target="_blank" rel="noopener" class="ilink">${ic('klip')}Lihat foto bukti</a></p>` : ''}
    <div class="btnrow">
      ${bolehUbah ? '<button class="btn ghost" id="d-ubah">Ubah</button>' : ''}
      ${bisa('hapus') ? '<button class="btn danger" id="d-hapus">Hapus</button>' : ''}
      <button class="btn ghost" id="d-tutup">Tutup</button></div>`);
  $('#d-tutup').onclick = tutupModal;
  if ($('#d-ubah')) $('#d-ubah').onclick = () => { tutupModal(); S.editTx = t; S.catatTab = 'manual'; location.hash = '#/catat'; };
  if ($('#d-hapus')) $('#d-hapus').onclick = async () => {
    tutupModal();
    const ok = await konfirmasi('Hapus transaksi?', `${t.keterangan || t.kategori} — ${rp(t.jumlah)}. Data tidak benar-benar hilang (masih bisa dicek di Sheet & riwayat).`, 'Ya, hapus', true);
    if (!ok) return;
    try { await api('hapusTransaksi', { id: t.id }, 'Menghapus…'); toast('Transaksi dihapus'); muatUlang(); } catch (e) { toast(e.message, true); }
  };
}

/* ---------- Stok ---------- */
const JENIS_STOK = { produksi: 'Produksi (+)', titip_kembali: 'Titipan kembali (+)', masuk_lain: 'Masuk lain (+)',
  cacat: 'Cacat (−)', tes: 'Dipakai tes (−)', titip: 'Dititip ke orang (−)', keluar_lain: 'Keluar lain (−)' };
async function viewStok(el, data) {
  const s = data || await api('getStok', {});
  const perluOpname = !s.opname_terakhir;
  el.innerHTML = `
    <div class="card hero"><div class="label">Stok kartu sekarang</div><div class="big num">${s.sekarang} kartu</div>
      <div class="small">Batas peringatan: ${s.batas}${s.opname_terakhir ? ' · Opname terakhir ' + tglIndo(s.opname_terakhir) : ''}</div></div>
    ${s.rendah ? `<div class="alert bad">${ic('kartu')}<span>Stok menipis (di bawah ${s.batas}). Segera produksi.</span></div>` : ''}
    ${perluOpname ? `<div class="alert warn">${ic('opname')}<span>Data stok lama terakhir diperbarui 28 Okt 2026. Tolong hitung fisik kartu yang ada sekarang, lalu isi di <b>Stok opname</b> di bawah supaya angkanya benar.</span></div>` : ''}
    <div class="card"><h2>Stok opname (hitung fisik)</h2>
      <p class="small muted">Isi jumlah kartu jadi yang benar-benar ada. Sistem mencatat selisihnya otomatis.</p>
      <div class="row2"><div><label class="f">Jumlah kartu di tangan</label><input id="o-hitung" inputmode="numeric" placeholder="0"></div>
        <div><label class="f">Tanggal</label><input type="date" id="o-tgl" value="${hariIni()}"></div></div>
      <button class="btn block" id="o-simpan">Simpan hasil hitung</button></div>
    <div class="card"><h2>Catat perubahan stok</h2>
      <label class="f">Jenis</label><select id="s-jenis">${Object.keys(JENIS_STOK).map((k) => `<option value="${k}">${JENIS_STOK[k]}</option>`).join('')}</select>
      <div class="row2"><div><label class="f">Jumlah kartu</label><input id="s-jml" inputmode="numeric" placeholder="0"></div>
        <div><label class="f">Tanggal</label><input type="date" id="s-tgl" value="${hariIni()}"></div></div>
      <label class="f">Keterangan (opsional)</label><input id="s-ket">
      <p class="small muted">Penjualan dari Lynk & transaksi "Penjualan Kartu" mengurangi stok otomatis.</p>
      <button class="btn block" id="s-simpan">Simpan</button></div>
    <div class="card">${judul('daftar', 'c-blue', 'Riwayat stok')}${s.riwayat.map((r) => `<div class="tx" data-id="${esc(r.id)}" data-ref="${esc(r.ref_transaksi || '')}">
      ${r.jenis === 'opname' ? bub('opname', 'c-yellow') : Number(r.jumlah) >= 0 ? bub('masuk', 'c-green') : bub('keluar', 'c-red')}<div class="mid"><div class="t1">${esc(r.keterangan)}</div><div class="t2">${tglIndo(r.tanggal)} · ${esc(r.jenis)}</div></div>
      <div class="amt num ${Number(r.jumlah) >= 0 ? 'in' : 'out'}">${Number(r.jumlah) >= 0 ? '+' : ''}${r.jumlah}</div></div>`).join('') || '<p class="muted">Belum ada.</p>'}</div>`;
  $('#o-simpan').onclick = async () => {
    const v = $('#o-hitung').value.trim();
    if (v === '') return toast('Isi jumlah kartu hasil hitung.', true);
    const ok = await konfirmasi('Simpan stok opname?', `Stok akan diset menjadi ${angka(v)} kartu (sekarang tercatat ${s.sekarang}).`, 'Simpan');
    if (!ok) return;
    try { const r = await api('opname', { hitung: angka(v), tanggal: $('#o-tgl').value }, 'Menyimpan…'); toast('Stok opname tersimpan'); viewStok(el, r); } catch (e) { toast(e.message, true); }
  };
  $('#s-simpan').onclick = async () => {
    try {
      const r = await api('tambahStok', { jenis: $('#s-jenis').value, jumlah: angka($('#s-jml').value), tanggal: $('#s-tgl').value, keterangan: $('#s-ket').value }, 'Menyimpan…');
      toast('Stok tersimpan'); viewStok(el, r);
    } catch (e) { toast(e.message, true); }
  };
  if (bisa('hapus')) {
    $$('.tx[data-id]', el).forEach((row) => {
      row.onclick = async () => {
        if (row.dataset.ref) return toast('Catatan ini dari transaksi penjualan. Ubah lewat menu Transaksi.');
        const ok = await konfirmasi('Hapus catatan stok?', $('.t1', row).textContent, 'Ya, hapus', true);
        if (!ok) return;
        try { const r = await api('hapusStok', { id: row.dataset.id }, 'Menghapus…'); toast('Dihapus'); viewStok(el, r); } catch (e) { toast(e.message, true); }
      };
    });
  }
}

/* ---------- Lainnya & Laporan ---------- */
function viewLainnya(el) {
  el.innerHTML = `<div class="card"><ul class="list">
    <li><a href="#/laporan" class="menu">${bub('laporan', 'c-blue')}<span>Laporan bulanan</span>${ic('kanan', 'chev')}</a></li>
    ${isOwner() ? `<li><a href="#/pengaturan" class="menu">${bub('atur', 'c-yellow')}<span>Pengaturan</span>${ic('kanan', 'chev')}</a></li>` : ''}
    <li><a href="#" id="l-keluar" class="menu out">${bub('logout', 'c-red')}<span>Keluar</span></a></li></ul></div>
    <p class="small muted">Masuk sebagai ${esc(S.user.email)} (${isOwner() ? 'owner' : 'admin'}).</p>`;
  $('#l-keluar').onclick = (e) => { e.preventDefault(); keluar(); };
}

async function viewLaporan(el) {
  S.bulan = S.bulan || hariIni().slice(0, 7);
  const d = await api('laporan', { bulan: S.bulan });
  const r = d.ringkas;
  const baris = (list) => list.map((k) => `<li><span>${esc(k.nama)}</span><span class="num">${rp(k.jumlah)}</span></li>`).join('') || '<li class="muted">-</li>';
  el.innerHTML = `
    <div class="monthnav no-print"><button class="btn ghost sm" id="r-prev" aria-label="Bulan sebelumnya">${ic('kiri')}</button><b>${namaBulan(d.bulan)}</b><button class="btn ghost sm" id="r-next" aria-label="Bulan berikutnya">${ic('kanan')}</button></div>
    <div class="card"><h2>Laporan ${namaBulan(d.bulan)} — VepraCuan</h2>
      <h3>Pemasukan usaha</h3><ul class="list">${baris(r.per_masuk)}<li><b>Total pemasukan</b><b class="num">${rp(r.masuk)}</b></li></ul>
      <h3>Pengeluaran usaha</h3><ul class="list">${baris(r.per_keluar)}<li><b>Total pengeluaran</b><b class="num">${rp(r.keluar)}</b></li></ul>
      <ul class="list"><li><b>LABA BERSIH</b><b class="num ${r.laba >= 0 ? 'in' : 'out'}">${rp(r.laba)}</b></li></ul>
      ${r.non_usaha.length ? `<h3>Di luar usaha (modal, prive, pindah dana)</h3><ul class="list">${baris(r.non_usaha)}</ul>` : ''}</div>
    <div class="card"><h2>Penjualan per produk</h2><ul class="list">${d.produk.map((p) => `<li><span>${esc(p.nama)}<br><span class="small muted">${p.transaksi} transaksi${p.kartu ? ' · ' + p.kartu + ' kartu' : ''}</span></span><span class="num">${rp(p.jumlah)}</span></li>`).join('') || '<li class="muted">-</li>'}</ul></div>
    <div class="card"><h2>Saldo per akun (per ${tglIndo(d.sampai)})</h2><ul class="list">${d.saldo.map((s) => `<li><span>${esc(s.akun)}</span><span class="num">${rp(s.saldo)}</span></li>`).join('')}
      <li><b>Total kas</b><b class="num">${rp(d.kas)}</b></li></ul></div>
    <div class="card"><h2>Stok kartu</h2><ul class="list"><li><span>Awal bulan</span><span>${d.stok.awal}</span></li><li><span>Masuk</span><span class="in">+${d.stok.masuk}</span></li>
      <li><span>Keluar</span><span class="out">−${d.stok.keluar}</span></li><li><b>Akhir bulan</b><b>${d.stok.akhir}</b></li></ul></div>
    <button class="btn block no-print" onclick="window.print()">${ic('cetak')}Cetak / Simpan PDF</button>
    <p class="small muted no-print">Di HP: ketuk tombol di atas, lalu pilih "Simpan sebagai PDF".</p>`;
  $('#r-prev').onclick = () => { S.bulan = geserBulan(S.bulan, -1); viewLaporan(el); };
  $('#r-next').onclick = () => { S.bulan = geserBulan(S.bulan, 1); viewLaporan(el); };
}

/* ---------- Pengaturan (owner) ---------- */
async function viewPengaturan(el, data) {
  if (!isOwner()) { el.innerHTML = '<div class="alert bad">Halaman ini hanya untuk owner.</div>'; return; }
  const p = data || await api('getPengaturan', {});
  const st = p.status;
  const ok = (b) => (b ? ic('oke', 'in') : ic('gagal', 'out'));
  const setLabel = { batas_stok: 'Batas stok menipis (kartu)', lynk_hari_peringatan: 'Peringatan Lynk sepi (hari)', lynk_query: 'Pencarian Gmail Lynk', gemini_model: 'Model Gemini' };
  el.innerHTML = `
    <div class="card"><h2>Status sistem</h2><ul class="list">
      <li><span>Login Google (Client ID)</span><span>${ok(st.client_id)}</span></li>
      <li><span>Baca foto (kunci Gemini)</span><span>${ok(st.gemini)}</span></li>
      <li><span>Pencatatan Lynk otomatis tiap 10 menit</span><span>${ok(st.trigger_lynk)}</span></li>
      <li><span>Cek Lynk terakhir</span><span class="small right">${st.lynk ? esc(st.lynk.waktu.replace('T', ' ')) + '<br>' + (st.lynk.ok ? ic('oke', 'in') : ic('gagal', 'out')) + esc(st.lynk.pesan) : '-'}</span></li></ul>
      <p class="small"><a href="${esc(st.sheet_url)}" target="_blank" rel="noopener" class="ilink">${ic('tabel')}Buka Google Sheet</a> · <a href="${esc(st.folder_url)}" target="_blank" rel="noopener" class="ilink">${ic('folder')}Folder bukti</a></p></div>

    <div class="card"><h2>Pengguna</h2><ul class="list">${p.pengguna.map((u) => `<li><span>${esc(u.nama)}<br><span class="small muted">${esc(u.email)}</span></span>
      <span class="right">${esc(u.peran)}${String(u.aktif).toUpperCase() === 'FALSE' ? '<br><span class="badge">nonaktif</span>' : ''}<br>
      <button class="btn ghost sm" data-u="${esc(u.email)}">Ubah</button></span></li>`).join('')}</ul>
      <h3>Tambah / ubah pengguna</h3>
      <input id="u-email" placeholder="email@gmail.com" type="email">
      <div class="row2"><div><label class="f">Nama</label><input id="u-nama"></div>
        <div><label class="f">Peran</label><select id="u-peran"><option value="admin">Admin</option><option value="owner">Owner</option></select></div></div>
      <label class="check" style="margin-top:10px"><input type="checkbox" id="u-aktif" checked> Aktif (boleh masuk)</label>
      <button class="btn block" id="u-simpan">Simpan pengguna</button>
      <p class="small muted">Admin bisa melihat & menambah catatan, tapi tidak bisa menghapus atau membuka Pengaturan.</p></div>

    <div class="card"><h2>Kategori</h2>
      <h3>Pemasukan</h3><p class="small">${p.kategori.filter((k) => k.jenis === 'masuk').map((k) => esc(k.nama) + (String(k.hitung_laba).toUpperCase() === 'FALSE' ? ' <span class="badge blue">bukan usaha</span>' : '')).join(' · ')}</p>
      <h3>Pengeluaran</h3><p class="small">${p.kategori.filter((k) => k.jenis === 'keluar').map((k) => esc(k.nama) + (String(k.hitung_laba).toUpperCase() === 'FALSE' ? ' <span class="badge blue">bukan usaha</span>' : '')).join(' · ')}</p>
      <h3>Tambah kategori</h3>
      <div class="row2"><div><input id="k-nama" placeholder="Nama kategori"></div>
        <div><select id="k-jenis"><option value="keluar">Pengeluaran</option><option value="masuk">Pemasukan</option></select></div></div>
      <label class="check" style="margin-top:10px"><input type="checkbox" id="k-laba" checked> Dihitung sebagai pemasukan/pengeluaran usaha</label>
      <button class="btn block" id="k-simpan">Tambah kategori</button></div>

    <div class="card"><h2>Pengaturan lain</h2>${p.setting.map((s) => `<label class="f">${esc(setLabel[s.kunci] || s.kunci)}</label>
      <div style="display:flex;gap:8px"><input data-set="${esc(s.kunci)}" value="${esc(s.nilai)}"><button class="btn sm" data-simpan="${esc(s.kunci)}">Simpan</button></div>`).join('')}</div>

    <div class="card"><h2>Lynk</h2>
      <button class="btn ghost block" id="ly-sync" style="margin-top:0">Cek email Lynk sekarang</button>
      <label class="f">Isi order yang terlewat sejak tanggal</label>
      <div style="display:flex;gap:8px"><input type="date" id="ly-dari" value="2026-11-07"><button class="btn sm" id="ly-isi">Isi</button></div>
      <button class="btn ghost block" id="ly-uji">Uji pembaca (lihat hasil tanpa menyimpan)</button>
      <div id="ly-hasil"></div></div>

    <div class="card"><h2>Riwayat perubahan</h2><button class="btn ghost block" id="log-lihat" style="margin-top:0">Lihat 100 perubahan terakhir</button><div id="log-hasil"></div></div>`;

  $$('button[data-u]', el).forEach((b) => {
    b.onclick = () => {
      const u = p.pengguna.find((x) => x.email === b.dataset.u);
      $('#u-email').value = u.email; $('#u-nama').value = u.nama; $('#u-peran').value = u.peran;
      $('#u-aktif').checked = String(u.aktif).toUpperCase() !== 'FALSE';
      $('#u-email').scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  });
  $('#u-simpan').onclick = async () => {
    try {
      const r = await api('simpanPengguna', { email: $('#u-email').value, nama: $('#u-nama').value, peran: $('#u-peran').value, aktif: $('#u-aktif').checked }, 'Menyimpan…');
      toast('Pengguna tersimpan'); viewPengaturan(el, r);
    } catch (e) { toast(e.message, true); }
  };
  $('#k-simpan').onclick = async () => {
    try {
      const r = await api('simpanKategori', { nama: $('#k-nama').value, jenis: $('#k-jenis').value, hitung_laba: $('#k-laba').checked }, 'Menyimpan…');
      const b = await api('me', {}, false); Object.assign(S, b);
      toast('Kategori ditambahkan'); viewPengaturan(el, r);
    } catch (e) { toast(e.message, true); }
  };
  $$('button[data-simpan]', el).forEach((b) => {
    b.onclick = async () => {
      try {
        const k = b.dataset.simpan;
        const r = await api('simpanSetting', { kunci: k, nilai: $(`input[data-set="${k}"]`).value }, 'Menyimpan…');
        if (k === 'batas_stok') S.batas_stok = angka($(`input[data-set="${k}"]`).value);
        toast('Tersimpan'); viewPengaturan(el, r);
      } catch (e) { toast(e.message, true); }
    };
  });
  const tampilHasilLynk = (h) => `<div class="alert ok small">Diperiksa ${h.pesan_diperiksa} email · ${h.order_baru} order baru · ${h.tarik_baru} penarikan · ${h.perlu_cek} perlu dicek · ${h.diabaikan} diabaikan</div>`;
  $('#ly-sync').onclick = async () => {
    try { const h = await api('syncLynk', {}, 'Membaca email Lynk…'); $('#ly-hasil').innerHTML = tampilHasilLynk(h); } catch (e) { toast(e.message, true); }
  };
  $('#ly-isi').onclick = async () => {
    try { const h = await api('isiLynkSejak', { dari: $('#ly-dari').value }, 'Mengisi order Lynk yang terlewat… (bisa 1–2 menit)'); $('#ly-hasil').innerHTML = tampilHasilLynk(h); } catch (e) { toast(e.message, true); }
  };
  $('#ly-uji').onclick = async () => {
    try {
      const r = await api('ujiLynk', { n: 15, hari: 30 }, 'Membaca contoh email…');
      $('#ly-hasil').innerHTML = `<p class="small muted">Query: ${esc(r.query)} · ${r.jumlah_thread} thread</p>` + r.pesan.map((m) => `<div class="item-row">
        <b class="small">${esc(m.tanggal)} · ${esc(m.subjek)}</b><div class="small muted">${esc(m.dari)} · ${m.jumlah_pesan_thread} pesan di thread</div>
        <div class="small">Hasil: ${m.hasil.jenis === 'order' ? m.hasil.orders.map((o) => `${esc(o.kategori)} ${rp(o.jumlah)}${o.qty ? ' · ' + o.qty + ' kartu' : ''}${o.pembeli ? ' · ' + esc(o.pembeli) : ''}${o.perlu_cek ? ' <span class="badge">perlu cek</span>' : ''}`).join('<br>') : esc(m.hasil.jenis) + (m.hasil.jumlah ? ' ' + rp(m.hasil.jumlah) : '')}</div>
        <details><summary class="small">Isi email</summary><pre class="raw">${esc(m.isi)}</pre></details></div>`).join('');
    } catch (e) { toast(e.message, true); }
  };
  $('#log-lihat').onclick = async () => {
    try {
      const r = await api('lihatLog', { n: 100 }, 'Memuat riwayat…');
      $('#log-hasil').innerHTML = '<ul class="list">' + r.map((l) => `<li><span class="small">${esc(String(l.waktu).replace('T', ' '))}<br><b>${esc(l.aksi)}</b> ${esc(l.tabel)} ${esc(String(l.id).slice(0, 40))}</span><span class="small muted right">${esc(l.email)}</span></li>`).join('') + '</ul>';
    } catch (e) { toast(e.message, true); }
  };
}

/* ---------- Mulai ---------- */
(async function init() {
  $$('[data-logo]').forEach((el) => { el.innerHTML = logoSvg(Number(el.dataset.logo), !!el.dataset.terang); });
  $$('[data-ic]').forEach((el) => { el.innerHTML = ic(el.dataset.ic); });
  if (!CFG.API_URL || CFG.API_URL.indexOf('ISI_') === 0) {
    tampilLogin('Aplikasi belum disambungkan ke server (config.js belum diisi).');
    return;
  }
  try { S.token = localStorage.getItem('kas_token'); } catch (e) { S.token = null; }
  if (!S.token) return tampilLogin();
  try { await mulai(); } catch (e) { tampilLogin(S.token ? e.message : ''); }
})();
