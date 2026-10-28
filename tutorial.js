'use strict';
// İlk bölümün Kolay aşamasında, ilk kez oynayana adım adım yol gösteren eğitim.
// Adımlar ya "Devam" ile ya da oyuncu istenen şeyi yapınca ilerler.

let tut = null;  // { i: adım, tile: vurgulanan karo }

// yola en çok bakan, boş çimen karesi
function tutPickTile() {
  let best = null, bs = -1;
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      if (G.terr[y][x] !== GRASS || G.tree[y][x] || towerAt(x, y)) continue;
      let c = 0;
      for (let yy = y - 3; yy <= y + 3; yy++)
        for (let xx = x - 3; xx <= x + 3; xx++)
          if (G.terr[yy] && G.terr[yy][xx] === PATH) c++;
      if (c > bs) { bs = c; best = { x, y }; }
    }
  return best;
}
const tileCenter = t => t && { x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE / 2 };

const TUT_STEPS = [
  { text: 'Hoş geldin, cadı! Mahzendeki <b>ruh kristallerini</b> hazine avcılarından korumalısın.',
    at: () => ({ x: G.vault.x, y: G.vault.y - 40 }), next: true },
  { text: 'Parlayan <b>çimen</b> karesine tıkla, sonra alttaki panelden <b>İnşa Et</b>\'e bas.',
    enter: () => { tut.tile = tutPickTile(); }, at: () => tileCenter(tut.tile), done: () => G.towers.length >= 1 },
  { text: 'Harika! Bir tane daha kur. Kuleler yola yakın olunca daha çok düşmana yetişir.',
    enter: () => { tut.tile = tutPickTile(); }, at: () => tileCenter(tut.tile), done: () => G.towers.length >= 2 },
  { text: 'Hazırsan üstteki <b>tabelaya</b> basıp ilk dalgayı başlat.',
    enter: () => { tut.tile = null; }, at: () => ({ x: 480, y: 52 }), done: () => G.wave > 0 },
  { text: 'Hırsızlar mahzenden kristal kapıp kaçar. <b>Taşıyanı öldürürsen</b> kristal yere düşer ve mahzene geri döner.',
    at: () => null, next: true },
  { text: 'Mana dolunca <b>büyü</b> kullan: sol alttaki küreye (ya da <b>1</b> tuşuna) bas, sonra düşmanların üstüne tıkla.',
    at: () => ({ x: 45, y: 560 }), done: () => G.cds.some(c => c > 0) },
  { text: 'Kulelerine tıklayarak onları <b>yükseltebilirsin</b>. Bol şans, cadı!', at: () => null, next: true, last: true },
];

function tutStart() {
  tut = null;
  if (save.tut || G.li !== 0 || G.tier !== 0) { tutHide(); return; }
  tut = { i: -1, tile: null };
  tutGo(0);
}
function tutGo(i) {
  if (i >= TUT_STEPS.length) return tutEnd();
  tut.i = i;
  const st = TUT_STEPS[i];
  if (st.enter) st.enter();
  const box = $('tut');
  box.innerHTML = `<div class="tstep">${i + 1} / ${TUT_STEPS.length}</div><p>${st.text}</p>
    <div class="tbtns">${st.next ? `<button onclick="tutGo(${i + 1})">${st.last ? 'Bitir ✔' : 'Devam ▶'}</button>` : ''}
    <button class="tskip" onclick="tutEnd()">Eğitimi geç</button></div>`;
  box.classList.remove('hidden');
  box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
  tutPlace();
}
function tutEnd() {
  save.tut = true;
  persist();
  tut = null;
  tutHide();
}
function tutHide() {
  $('tut').classList.add('hidden');
  $('tutArrow').classList.add('hidden');
}
// kutuyu ve oku hedefin yanına yerleştirir (960x640 HUD düzleminde)
function tutPlace() {
  const p = TUT_STEPS[tut.i].at(), box = $('tut'), arrow = $('tutArrow');
  if (!p) {
    box.style.left = '330px'; box.style.top = '110px';
    arrow.classList.add('hidden');
    return;
  }
  const bx = clamp(p.x - 150, 10, W - 310), below = p.y < 200;
  box.style.left = bx + 'px';
  box.style.top = (below ? p.y + 60 : Math.max(70, p.y - 170)) + 'px';
  arrow.classList.remove('hidden');
  arrow.classList.toggle('up', below);
  arrow.style.left = (p.x - 14) + 'px';
  arrow.style.top = (below ? p.y + 18 : p.y - 50) + 'px';
}

// her karede: adım tamamlandı mı, bölüm hâlâ eğitim bölümü mü
function tutTick() {
  if (!tut) return;
  if (!G || G.demo || G.li !== 0 || worldOpen()) { tut = null; tutHide(); return; }
  const st = TUT_STEPS[tut.i];
  if (st.done && st.done()) tutGo(tut.i + 1);
  else if (st.at && tut.tile && G.towers.some(t => t.tx === tut.tile.x && t.ty === tut.tile.y)) tutPlace();
}
setInterval(tutTick, 150);

// render içinden çağrılır: vurgulanan karonun etrafında parlayan çerçeve
function tutDraw() {
  if (!tut || !tut.tile) return;
  const a = 0.55 + Math.sin(G.time * 6) * 0.35, x = tut.tile.x * TILE, y = tut.tile.y * TILE;
  ctx.strokeStyle = `rgba(255,226,122,${a})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
  ctx.fillStyle = `rgba(255,226,122,${a * 0.18})`;
  ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
}
