'use strict';
// Dünya haritası: açılış ekranı, bölüm düğümleri, açılan yollar ve alt menü.
// game.js'teki genel tanımları (LEVELS, save, G, showOverlay…) kullanır.

// 6 bölge; her bölgenin bir yer işareti ve adı var
const REGIONS = [
  { name: 'Sisli Orman', mark: '🌲', x: 130, y: 392 },
  { name: 'Çürük Bataklık', mark: '🌿', x: 458, y: 328 },
  { name: 'Unutulmuş Mabet', mark: '🏛️', x: 108, y: 140 },
  { name: 'Kül Diyarı', mark: '🌋', x: 420, y: 188 },
  { name: 'Cüce Dağları', mark: '⛰️', x: 712, y: 410 },
  { name: 'Engizisyon', mark: '🏰', x: 902, y: 196 },
];
// bölüm düğümleri, LEVELS ile aynı sırada (her bölgede 3 bölüm)
const WORLD_NODES = [
  [100, 470], [195, 488], [220, 405],
  [305, 360], [395, 405], [360, 300],
  [270, 240], [165, 215], [205, 130],
  [320, 140], [425, 105], [505, 190],
  [595, 275], [690, 318], [620, 420],
  [735, 215], [835, 150], [860, 272],
].map(([x, y], i) => ({ x, y, r: Math.floor(i / 3) }));
const HOME = { x: 70, y: 515 };
const BIOMES = [
  { a: [79, 122, 58], b: [100, 146, 72], deco: 'tree' },
  { a: [53, 80, 74], b: [40, 64, 58], deco: 'pool' },
  { a: [124, 118, 104], b: [146, 140, 124], deco: 'ruin' },
  { a: [76, 60, 56], b: [56, 42, 40], deco: 'ember' },
  { a: [108, 103, 96], b: [86, 82, 76], deco: 'mount' },
  { a: [64, 50, 60], b: [46, 36, 44], deco: 'spire' },
];
const LEVEL_LORE = [
  'Sisin hiç dağılmadığı koruda ilk hazine avcıları belirdi. Kulübene en yakın kristalleri koru.',
  'Upuzun, kıvrılan tek bir patika. Avcıların yolu uzun ama sabırları da öyle.',
  'Yaşlı meşenin kökleri arasından iki yol mahzene uzanıyor.',
  'Çürümüş söğütlerin arasındaki vadiye iki yoldan birden saldırıyorlar.',
  'Söğüt geçidinin sağ yakasından geliyorlar; mahzen bu kez batıda.',
  'Batık köprünün iki ucundan aynı anda yükleniyorlar.',
  'Unutulmuş mabedin taşları arasında üç yol kesişiyor. Kaya araziyi iyi kullan.',
  'Yıkık sütunlar arasında mahzen köşeye sıkıştı; üç yol aynı yere akıyor.',
  'Mabedin kalbi: üç yön, tek hedef.',
  'Eski bir ejderin yaktığı ova: Kül Kazanı ilk kez burada kurulabilir.',
  'Ejderin mezarı hâlâ sıcak. Uzun patika ova boyunca kıvrılıyor.',
  'Lav nehrinin kıyısında iki yol, köşedeki mahzende birleşiyor.',
  'Cüceler kristallerin kokusunu aldı. Toprağın altından gelenlere dikkat!',
  'Derin ocakta üç tünel açıldı; biri tam tepeden iniyor.',
  'Kristal damarının dibindeki mahzene üç yoldan iniyorlar.',
  'Engizisyonun öncü birlikleri kuşatma hattını kurdu.',
  'Kara kalenin dört kapısı birden açıldı.',
  'Engizisyon bütün gücüyle kapına dayandı. Son savaş.',
];

// bir bölüm, öncekinin Kolay aşaması kazanılınca açılır
const unlocked = i => i === 0 || save.stars[i - 1][0] > 0;
const levelStars = i => save.stars[i][0] + save.stars[i][1] + save.stars[i][2];
const currentLevel = () => {
  for (let i = 0; i < LEVELS.length; i++) if (unlocked(i) && !save.stars[i][0]) return i;
  return LEVELS.length - 1;
};
// o bölümde oynanabilecek en yüksek aşama
const topTier = i => (tierOpen(i, 2) ? 2 : tierOpen(i, 1) ? 1 : 0);

// ---------- harita resmi (bir kez çizilir) ----------
function makeNoise(seed, cell) {
  const r = mulberry32(seed), gw = Math.ceil(W / cell) + 3, gh = Math.ceil(H / cell) + 3, g = [];
  for (let i = 0; i < gw * gh; i++) g.push(r());
  return (x, y) => {
    const fx = clamp(x, 0, W) / cell, fy = clamp(y, 0, H) / cell, ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const v = (a, b) => g[(iy + b) * gw + ix + a];
    return (v(0, 0) * (1 - sx) + v(1, 0) * sx) * (1 - sy) + (v(0, 1) * (1 - sx) + v(1, 1) * sx) * sy;
  };
}
const nBig = makeNoise(7, 90), nMid = makeNoise(13, 30), nFine = makeNoise(29, 10);
const blobs = [...WORLD_NODES.map(n => ({ x: n.x, y: n.y, r: 112 })), { x: HOME.x, y: HOME.y, r: 110 }];
for (let i = 1; i < WORLD_NODES.length; i++) {
  const a = WORLD_NODES[i - 1], b = WORLD_NODES[i];
  blobs.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r: 95 });
}
// >0 kara, <0 deniz
function landF(x, y) {
  let f = -1e9;
  for (const b of blobs) f = Math.max(f, b.r - Math.hypot(x - b.x, y - b.y));
  return f + (nBig(x, y) - 0.5) * 120 + (nMid(x, y) - 0.5) * 40;
}
function biomeAt(x, y) {
  let bi = 0, bd = 1e9;
  const ox = (nMid(y, x) - 0.5) * 90, oy = (nMid(x, y) - 0.5) * 90;
  WORLD_NODES.forEach(n => { const d = Math.hypot(x + ox - n.x, y + oy - n.y); if (d < bd) { bd = d; bi = n.r; } });
  if (Math.hypot(x - HOME.x, y - HOME.y) < bd) bi = 0;
  return bi;
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

function paintWorld() {
  const cvs = $('worldBg'), CS = 4;
  cvs.width = W * RES; cvs.height = H * RES;
  const c = cvs.getContext('2d');
  c.setTransform(RES, 0, 0, RES, 0, 0);
  for (let y = 0; y < H; y += CS)
    for (let x = 0; x < W; x += CS) {
      const f = landF(x, y), v = nFine(x, y);
      let col;
      if (f < -14) col = mix([44, 98, 108], [14, 34, 44], clamp(-f / 170, 0, 1)).map(q => q + (v - 0.5) * 8);
      else if (f < 0) col = mix([72, 134, 130], [44, 98, 108], -f / 14);
      else if (f < 9) col = mix([214, 192, 138], [190, 166, 112], v);
      else {
        const B = BIOMES[biomeAt(x, y)];
        col = mix(B.a, B.b, v).map(q => q * (0.88 + nMid(x * 1.7, y * 1.7) * 0.2));
      }
      c.fillStyle = rgb(col);
      c.fillRect(x, y, CS, CS);
    }

  const r = mulberry32(2024);
  // dalgalar
  c.strokeStyle = 'rgba(220,240,240,.18)'; c.lineWidth = 1.5;
  for (let i = 0; i < 160; i++) {
    const x = r() * W, y = r() * H;
    if (landF(x, y) > -20) continue;
    c.beginPath(); c.arc(x, y, 6, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  }
  // biyom süslemeleri (y'ye göre sıralı çizilir)
  const decos = [];
  for (let i = 0; i < 2600; i++) {
    const x = r() * W, y = r() * H;
    if (landF(x, y) < 16) continue;
    if (WORLD_NODES.some(n => Math.hypot(x - n.x, y - n.y) < 40) || REGIONS.some(g => Math.hypot(x - g.x, y - g.y) < 30)
      || Math.hypot(x - HOME.x, y - HOME.y) < 40) continue;
    const kind = BIOMES[biomeAt(x, y)].deco;
    const keep = { tree: 0.75, pool: 0.3, ruin: 0.25, ember: 0.35, mount: 0.2, spire: 0.3 }[kind];
    if (r() < keep) decos.push({ x, y, kind, s: 0.7 + r() * 0.6, v: r() });
  }
  decos.sort((a, b) => a.y - b.y).forEach(d => drawDeco(c, d));

  // yer işaretleri
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const label = (text, x, y, size) => {
    c.font = `800 ${size}px Cinzel, Georgia, serif`; c.fillStyle = '#f3e6c8';
    c.lineWidth = 3; c.strokeStyle = 'rgba(30,18,8,.85)';
    c.strokeText(text, x, y); c.fillText(text, x, y);
  };
  REGIONS.forEach(g => {
    c.font = '32px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    c.fillText(g.mark, g.x, g.y - 6);
    label(g.name, g.x, g.y + 20, 11);
  });
  c.font = '40px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  c.fillText('🛖', HOME.x, HOME.y - 6);
  label('Cadının Kulübesi', HOME.x, HOME.y + 24, 12);

  drawCompass(c, 895, 500);
  c.drawImage(vignette, 0, 0);
}

function drawDeco(c, d) {
  const { x, y, s, v } = d;
  if (d.kind === 'tree') {
    c.fillStyle = 'rgba(0,0,0,.25)'; ellipse(c, x + 2, y + 6 * s, 7 * s, 3 * s);
    c.fillStyle = '#4a2f1c'; c.fillRect(x - 1.5 * s, y, 3 * s, 6 * s);
    const g = v < 0.5 ? ['#1f4a26', '#2b5e30', '#3a7438'] : ['#24502e', '#2f6034', '#43803e'];
    for (let i = 0; i < 3; i++) { c.fillStyle = g[i]; circle2(c, x + (i - 1) * 3.5 * s, y - 3 * s - i * 2 * s, (7 - i * 1.4) * s); }
  } else if (d.kind === 'pool') {
    c.fillStyle = '#1e3a36'; ellipse(c, x, y, 11 * s, 5 * s);
    c.fillStyle = 'rgba(150,200,190,.25)'; ellipse(c, x - 3 * s, y - 1.5 * s, 4 * s, 1.5 * s);
    c.strokeStyle = '#5f8a4a'; c.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x + 12 * s + i * 2, y + 2); c.lineTo(x + 12 * s + i * 3, y - 8 * s); c.stroke(); }
  } else if (d.kind === 'ruin') {
    const h = (8 + v * 10) * s;
    c.fillStyle = 'rgba(0,0,0,.25)'; ellipse(c, x + 2, y + 1, 6 * s, 2.5 * s);
    c.fillStyle = '#b8b2a0'; c.fillRect(x - 3 * s, y - h, 6 * s, h);
    c.fillStyle = '#8e8878'; c.fillRect(x - 3 * s, y - h, 2 * s, h);
    c.fillStyle = '#d4cebb'; c.fillRect(x - 4 * s, y - h - 2 * s, 8 * s, 2.5 * s);
  } else if (d.kind === 'ember') {
    c.strokeStyle = '#e0622a'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(x - 8 * s, y);
    for (let i = 0; i < 4; i++) c.lineTo(x - 8 * s + (i + 1) * 4 * s, y + (i % 2 ? -3 : 3) * s);
    c.stroke();
    c.fillStyle = 'rgba(255,140,50,.35)'; circle2(c, x, y, 5 * s);
    if (v > 0.6) {
      c.strokeStyle = '#1a1210'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(x + 6, y + 2); c.lineTo(x + 6, y - 12 * s); c.lineTo(x + 1, y - 17 * s); c.stroke();
    }
  } else if (d.kind === 'mount') {
    const w = 16 * s + v * 8, h = 16 * s + v * 12;
    c.fillStyle = 'rgba(0,0,0,.25)'; ellipse(c, x + 3, y + 2, w, 4);
    c.fillStyle = '#6e695f';
    c.beginPath(); c.moveTo(x - w, y); c.lineTo(x, y - h); c.lineTo(x + w, y); c.closePath(); c.fill();
    c.fillStyle = '#8e897d';
    c.beginPath(); c.moveTo(x - w, y); c.lineTo(x, y - h); c.lineTo(x - w * 0.15, y); c.closePath(); c.fill();
    c.fillStyle = '#eef2f4';
    c.beginPath(); c.moveTo(x - w * 0.3, y - h * 0.7); c.lineTo(x, y - h); c.lineTo(x + w * 0.3, y - h * 0.7); c.lineTo(x + w * 0.1, y - h * 0.62); c.lineTo(x - w * 0.1, y - h * 0.72); c.closePath(); c.fill();
  } else {
    const h = (12 + v * 14) * s;
    c.fillStyle = '#231a20';
    c.beginPath(); c.moveTo(x - 4 * s, y); c.lineTo(x, y - h); c.lineTo(x + 4 * s, y); c.closePath(); c.fill();
    if (v > 0.7) { c.fillStyle = '#ff5a3a'; circle2(c, x, y - h * 0.45, 1.3); }
  }
}

function drawCompass(c, x, y) {
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(240,225,190,.25)'; circle2(c, 0, 0, 34);
  c.strokeStyle = 'rgba(240,225,190,.6)'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(0, 0, 30, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 4; i++) {
    c.rotate(Math.PI / 2);
    c.fillStyle = i % 2 ? '#e8d5a8' : '#b8933a';
    c.beginPath(); c.moveTo(0, -28); c.lineTo(6, 0); c.lineTo(-6, 0); c.closePath(); c.fill();
  }
  c.fillStyle = '#3a2412'; c.font = '900 11px Cinzel, serif'; c.textAlign = 'center';
  c.fillText('K', 0, -38 + 4);
  c.restore();
}

// ---------- düğümler ve patikalar ----------
function trailD(i) {
  const a = WORLD_NODES[i - 1], b = WORLD_NODES[i];
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, len = Math.hypot(b.x - a.x, b.y - a.y);
  const side = i % 2 ? 1 : -1, bend = Math.min(30, len * 0.22) * side;
  const cx = mx - (b.y - a.y) / len * bend, cy = my + (b.x - a.x) / len * bend;
  return `M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`;
}

function buildWorld() {
  const revealed = save.revealed || 1;
  let svg = '';
  for (let i = 1; i < LEVELS.length; i++) {
    const d = trailD(i), open = unlocked(i), fresh = open && i >= revealed;
    svg += `<mask id="tm${i}" maskUnits="userSpaceOnUse" x="0" y="0" width="960" height="640">
        <path d="${d}" pathLength="1" class="tmask ${fresh ? 'pending' : ''}" data-i="${i}"/></mask>
      <path d="${d}" class="tline ${open ? '' : 'locked'}"/>
      ${open ? `<path d="${d}" class="tdots" mask="url(#tm${i})"/>` : ''}`;
  }
  $('trails').innerHTML = svg;

  const cur = currentLevel();
  $('nodes').innerHTML = LEVELS.map((L, i) => {
    const open = unlocked(i), st = save.stars[i], fresh = open && i >= revealed && i > 0;
    const cls = [open ? 'open' : 'locked', st[0] ? 'done' : '', levelStars(i) === 9 ? 'mastered' : '', i === cur && open ? 'current' : '', fresh ? 'fresh' : ''].join(' ');
    return `<button class="node ${cls}" data-i="${i}" style="left:${WORLD_NODES[i].x}px;top:${WORLD_NODES[i].y}px" onclick="openLevel(${i})">
      <span class="nm">${open ? `${L.r + 1}-${i % 3 + 1}` : '🔒'}</span>
      <span class="nstars">${open ? TIERS.map((T, t) => `<span class="nt ${tierOpen(i, t) ? '' : 'off'}" style="--tc:${T.color}">${'★'.repeat(st[t])}${'☆'.repeat(3 - st[t])}</span>`).join('') : ''}</span>
      <span class="nlabel">${L.name}</span></button>`;
  }).join('');

  $('wStars').textContent = starsTotal();
  $('wStarsMax').textContent = LEVELS.length * 9 + ACHS.length;
  const free = starsTotal() - starsSpent();
  $('wFree').textContent = free > 0 ? free : '';

  // yeni açılan bölümler: önce patika çizilir, sonra düğüm belirir
  const fresh = [];
  for (let i = Math.max(1, revealed); i < LEVELS.length; i++) if (unlocked(i)) fresh.push(i);
  fresh.forEach((i, k) => {
    setTimeout(() => {
      const m = document.querySelector(`.tmask[data-i="${i}"]`);
      if (m) m.classList.remove('pending');
      sfx('wave');
    }, 500 + k * 1400);
    setTimeout(() => {
      const n = document.querySelector(`.node[data-i="${i}"]`);
      if (n) { n.classList.remove('fresh'); n.classList.add('burst'); setTimeout(() => n.classList.remove('burst'), 900); }
      showUnlock(`Yeni bölüm açıldı: ${LEVELS[i].name}!`);
      sfx('build');
    }, 1500 + k * 1400);
  });
  if (fresh.length) { save.revealed = Math.max(...fresh) + 1; persist(); }
}

let unlockTimer = 0;
function showUnlock(text) {
  const m = $('unlockMsg');
  m.textContent = text;
  m.classList.add('show');
  clearTimeout(unlockTimer);
  unlockTimer = setTimeout(() => m.classList.remove('show'), 2800);
}

// ---------- bölüm kartı ----------
function openLevel(i) {
  if (!unlocked(i)) {
    const n = document.querySelector(`.node[data-i="${i}"]`);
    n.classList.remove('shake'); void n.offsetWidth; n.classList.add('shake');
    showUnlock(`Önce "${LEVELS[i - 1].name}" bölümünü kazan.`);
    sfx('bad');
    return;
  }
  const L = LEVELS[i], st = save.stars[i];
  const tiers = TIERS.map((T, t) => {
    const open = tierOpen(i, t), n = st[t];
    return `<div class="tier ${open ? '' : 'locked'}" style="--tc:${T.color}">
        <div class="tn"><b>${T.name}</b><small>${T.desc}</small></div>
        <div class="ts">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</div>
        ${open ? `<button class="go" onclick="startLevel(${i}, ${t})">${n ? 'Tekrar' : '⚔ Oyna'}</button>`
          : `<span class="tl">🔒 ${TIERS[t - 1].name} aşamasında 3★ al</span>`}
      </div>`;
  }).join('');
  const types = [...new Set(makeWaves(i).flatMap(w => w.groups.map(g => g.type)))];
  $('levelCard').innerHTML = `<div class="lc">
      <div class="lc-num">${L.r + 1}-${i % 3 + 1}</div>
      <div class="lc-region">${REGIONS[L.r].mark} ${REGIONS[L.r].name}</div>
      <h3>${L.name}</h3>
      <div class="lc-stars">★ ${levelStars(i)} / 9</div>
      <p>${LEVEL_LORE[i]}</p>
      <div class="lc-info"><span>🌊 ${L.waves} dalga</span><span>🛤️ ${L.paths.length} yol</span><span>💎 ${L.crystals + 2 * sk('g3')} kristal</span>${L.terrains === 4 ? '<span>🔥 Kül arazisi</span>' : ''}</div>
      <div class="lc-enemies">${types.map(t => `<span title="${ENEMIES[t].name}">${save.seen[t] ? ENEMY_INFO[t].icon : '❔'}</span>`).join('')}</div>
      <div class="tiers">${tiers}</div>
      <div class="lc-btns"><button class="close" onclick="closeLevelCard()">Kapat</button></div>
    </div>`;
  $('levelCard').classList.add('show');
}
function closeLevelCard() { $('levelCard').classList.remove('show'); }
$('levelCard').addEventListener('click', ev => { if (ev.target.id === 'levelCard') closeLevelCard(); });

function playNext() { openLevel(currentLevel()); }

// Sonsuz mod: 2. bölgenin son bölümü (Batık Köprü) kazanılınca açılır
const ENDLESS_AFTER = 5;
function openEndless() {
  if (!save.stars[ENDLESS_AFTER][0]) {
    showUnlock(`Sonsuz Mod, "${LEVELS[ENDLESS_AFTER].name}" kazanılınca açılır.`);
    sfx('bad');
    return;
  }
  $('levelCard').innerHTML = `<div class="lc">
      <div class="lc-num">♾️</div>
      <div class="lc-region">Bitmeyen savaş</div>
      <h3>${ENDLESS.name}</h3>
      <div class="lc-stars">🏆 Rekor: ${save.best || 0}. dalga</div>
      <p>Dalgalar hiç bitmez; her dalga bir öncekinden güçlüdür. Her 5 dalgada bir patron, her 15 dalgada Baş Engizisyoncu gelir. Ne kadar dayanabilirsin?</p>
      <div class="lc-info"><span>🛤️ 3 yol</span><span>💎 ${ENDLESS.crystals + 2 * sk('g3')} kristal</span><span>🔥 Kül arazisi</span></div>
      <div class="lc-btns" style="margin-top:14px"><button class="go" onclick="startLevel(-1, 1)">⚔ Başla</button><button class="close" onclick="closeLevelCard()">Kapat</button></div>
    </div>`;
  $('levelCard').classList.add('show');
}

// ---------- düşman ansiklopedisi ----------
function showBestiary() {
  const cards = Object.keys(ENEMIES).map(k => {
    const e = ENEMIES[k], seen = save.seen[k];
    if (!seen) return `<div class="beast unseen"><span class="bi">❔</span><b>???</b><small>Henüz karşılaşılmadı.</small></div>`;
    return `<div class="beast"><span class="bi">${ENEMY_INFO[k].icon}</span><b>${e.name}</b><small>${ENEMY_INFO[k].tip}</small>
      <div class="bstats"><span>❤ ${e.hp}</span><span>👟 ${e.speed}</span><span>🛡 %${Math.round(e.armor * 100)}</span><span>✨ %${Math.round(e.mres * 100)}</span></div></div>`;
  }).join('');
  showOverlay(`<div class="panel"><h2>Düşmanlar</h2><p>Karşılaştığın hazine avcıları. ❤ can · 👟 hız · 🛡 zırh · ✨ büyü direnci</p>
    <div class="beasts">${cards}</div><button onclick="showMenu()">Geri</button></div>`);
}

// ---------- aç / kapat ----------
function showWorld() {
  hideOverlay();
  if (G && !G.demo) newGame(0).demo = true;  // süren bölümü bırak
  $('stage').classList.add('in-world');
  closeLevelCard();
  buildWorld();
}
function hideWorld() { $('stage').classList.remove('in-world'); closeLevelCard(); }
function worldOpen() { return $('stage').classList.contains('in-world'); }

// haritada süzülen büyülü ışık zerreleri
$('nodes').insertAdjacentHTML('beforebegin', Array.from({ length: 16 }, (_, i) =>
  `<div class="mote" style="left:${40 + (i * 157) % 880}px;top:${90 + (i * 89) % 440}px;animation-delay:${-(i * 0.7) % 6}s;animation-duration:${5 + (i % 4)}s"></div>`).join(''));
paintWorld();
showWorld();
// yazı tipleri sonradan yüklenirse harita yazılarını yeniden çiz
if (document.fonts) document.fonts.ready.then(paintWorld);
