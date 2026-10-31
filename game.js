'use strict';
// Ruh Kristalleri — bataklık cadısı olarak ruh kristallerini hazine avcılarından koru.

const TILE = 40, COLS = 24, ROWS = 16, W = COLS * TILE, H = ROWS * TILE;
const GRASS = 0, SWAMP = 1, ROCK = 2, ASH = 3, PATH = 4, VAULT = 5;
const TERR_NAMES = ['Çimen', 'Bataklık', 'Kaya', 'Kül'];
const MANA_MAX = 100, MANA_REGEN = 1.2, WAVE_GAP = 14, DROP_TIME = 10;

const cv = document.getElementById('game');
// kule önizlemeleri çizilirken geçici olarak başka bir canvas'a yönlenir
let ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);

// ---------- kayıt ----------
const SAVE_KEY = 'ruhKristalleri_v1';
// stars[bölüm] = [Kolay, Normal, Zor] yıldızları (her biri 0-3)
// tree[düğüm id] = alınan kademe sayısı
let save = { stars: [], tree: {}, seen: {}, revealed: 1, ach: {}, stats: {}, best: 0 };
try {
  const s = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (s && Array.isArray(s.stars)) {
    // eski kayıt: bölüm başına tek yıldız sayısı -> Kolay aşamasına taşınır
    const stars = s.stars.map(v => Array.isArray(v) ? v : [Math.min(3, v || 0), 0, 0]);
    // eski tek seferlik güçler (perks) yeni ağaca taşınmaz; yıldızlar boşa çıkar ve yeniden harcanır
    save = { stars, tree: s.tree || {}, seen: s.seen || {}, revealed: s.revealed || 1, v: s.v,
      ach: s.ach || {}, stats: s.stats || {}, best: s.best || 0, settings: s.settings, tut: s.tut };
  }
} catch (e) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// ---------- Ruh Ağacı ----------
// Her dal yukarıdan aşağı sıralıdır: bir düğüm, üstündeki düğümden en az 1 kademe alınınca açılır.
// Kademe maliyeti dalın derinliğine göre artar.
const TREE_COST = [1, 1, 1, 2, 3];
const TREE = [
  { id: 't', name: 'Diken Totemi', icon: '🌿', color: '#7ad04a', nodes: [
    { icon: '🗡️', name: 'Sivri Dikenler', max: 3, fx: r => `Diken hasarı +%${8 * r}` },
    { icon: '🏹', name: 'Uzun Kökler', max: 2, fx: r => `Menzil +%${6 * r}` },
    { icon: '⚡', name: 'Hızlı Büyüme', max: 3, fx: r => `Atış hızı +%${7 * r}` },
    { icon: '🌱', name: 'Bereketli Tohum', max: 2, fx: r => `İnşa ve yükseltme %${10 * r} ucuz` },
    { icon: '🩸', name: 'Kanlı Diken', max: 1, fx: () => '%15 ihtimalle 2,5 kat kritik vuruş' },
  ] },
  { id: 's', name: 'Mantar Kulesi', icon: '🍄', color: '#b06ad0', nodes: [
    { icon: '☠️', name: 'Keskin Zehir', max: 3, fx: r => `Zehir hasarı +%${10 * r}` },
    { icon: '🌫️', name: 'Geniş Bulut', max: 2, fx: r => `Bulut alanı +%${8 * r}` },
    { icon: '⏳', name: 'Kalıcı Spor', max: 2, fx: r => `Bulut süresi +${(0.6 * r).toFixed(1)} sn` },
    { icon: '🌱', name: 'Bereketli Tohum', max: 2, fx: r => `İnşa ve yükseltme %${10 * r} ucuz` },
    { icon: '🦠', name: 'Salgın', max: 1, fx: () => 'Zehirliyken ölen düşman yeni bir zehir bulutu bırakır' },
  ] },
  { id: 'c', name: 'Kristal Dikeni', icon: '💠', color: '#5ac8f0', nodes: [
    { icon: '💎', name: 'Saf Kristal', max: 3, fx: r => `Işın hasarı +%${8 * r}` },
    { icon: '🔭', name: 'Odaklı Işın', max: 2, fx: r => `Menzil +%${6 * r}` },
    { icon: '🔔', name: 'Rezonans', max: 3, fx: r => `Atış hızı +%${7 * r}` },
    { icon: '🌱', name: 'Ucuz Kristal', max: 2, fx: r => `İnşa ve yükseltme %${10 * r} ucuz` },
    { icon: '💫', name: 'Parçalanma', max: 1, fx: () => 'Her ışın hedefini 0,3 sn sersemletir' },
  ] },
  { id: 'f', name: 'Kül Kazanı', icon: '🔥', color: '#ff7a2a', nodes: [
    { icon: '🔥', name: 'Kızgın Kömür', max: 3, fx: r => `Ateş hasarı +%${8 * r}` },
    { icon: '💥', name: 'Geniş Patlama', max: 2, fx: r => `Patlama alanı +%${8 * r}` },
    { icon: '🌬️', name: 'Körük', max: 3, fx: r => `Atış hızı +%${7 * r}` },
    { icon: '🌱', name: 'Ucuz Kazan', max: 2, fx: r => `İnşa ve yükseltme %${10 * r} ucuz` },
    { icon: '♨️', name: 'Ebedi Alev', max: 1, fx: () => 'Her seviyede yanan zemin bırakır, yanma +%50' },
  ] },
  { id: 'm', name: 'Büyüler', icon: '✨', color: '#8a9aff', nodes: [
    { icon: '🌙', name: 'Ay Pınarı', max: 3, fx: r => `Mana yenilenmesi +%${20 * r}` },
    { icon: '⚡', name: 'Gök Öfkesi', max: 3, fx: r => `Gök Gürültüsü hasarı +%${20 * r}` },
    { icon: '🌿', name: 'Sarılan Kökler', max: 2, fx: r => `Sarmaşık süresi +${(0.7 * r).toFixed(1)} sn` },
    { icon: '📖', name: 'Büyü Ustalığı', max: 2, fx: r => `Büyülerin mana maliyeti -%${10 * r}` },
    { icon: '🌩️', name: 'Fırtına Çağrısı', max: 1, fx: () => 'Gök Gürültüsü ikinci kez çakar (%50 hasar)' },
  ] },
  { id: 'g', name: 'Hazine', icon: '💰', color: '#ffd34d', nodes: [
    { icon: '🪙', name: 'Gizli Sandık', max: 3, fx: r => `Başlangıç altını +%${10 * r}` },
    { icon: '💰', name: 'Ganimet', max: 3, fx: r => `Düşmanlardan +%${8 * r} altın` },
    { icon: '💎', name: 'Derin Mahzen', max: 3, fx: r => `Her bölümde +${2 * r} kristal` },
    { icon: '🧲', name: 'Kristal Çağrısı', max: 2, fx: r => `Düşen kristal ${2 * r} sn daha hızlı döner` },
    { icon: '⚖️', name: 'Pazarlıkçı', max: 1, fx: () => 'Kule satışı %85 iade eder (%60 yerine)' },
  ] },
];
TREE.forEach(b => b.nodes.forEach((n, k) => { n.id = b.id + (k + 1); n.cost = TREE_COST[k]; n.branch = b; n.k = k; }));
const TREE_NODES = TREE.flatMap(b => b.nodes);
const sk = id => save.tree[id] || 0;
const nodeOpen = n => n.k === 0 || sk(n.branch.id + n.k) > 0;
// her başarım 1 bonus yıldız verir
save.settings = Object.assign({ music: 0.5, sfx: 0.8, shake: true }, save.settings);
const starsTotal = () => save.stars.reduce((a, t) => a + t[0] + t[1] + t[2], 0) + Object.keys(save.ach).length;
const starsSpent = () => TREE_NODES.reduce((a, n) => a + sk(n.id) * n.cost, 0);

// ---------- veri ----------
const TOWERS = {
  thorn: {
    name: 'Diken Totemi', terrain: GRASS, icon: '🌿',
    desc: 'Hızlı diken fırlatır. Fiziksel hasar — zırh azaltır.',
    levels: [
      { cost: 50, dmg: 9, rate: 0.55, range: 115 },
      { cost: 65, dmg: 16, rate: 0.5, range: 125 },
      { cost: 110, dmg: 26, rate: 0.42, range: 135, slow: 0.35 },
    ],
  },
  spore: {
    name: 'Mantar Kulesi', terrain: SWAMP, icon: '🍄',
    desc: 'Zehirli spor bulutu fırlatır. Zehir zırhı yok sayar.',
    levels: [
      { cost: 65, dps: 7, rate: 1.6, range: 105, radius: 42 },
      { cost: 80, dps: 12, rate: 1.5, range: 115, radius: 48 },
      { cost: 125, dps: 20, rate: 1.4, range: 125, radius: 58 },
    ],
  },
  crystal: {
    name: 'Kristal Dikeni', terrain: ROCK, icon: '💠',
    desc: 'Güçlü büyü ışını. Büyü hasarı zırhı yok sayar.',
    levels: [
      { cost: 85, dmg: 34, rate: 1.5, range: 150 },
      { cost: 100, dmg: 62, rate: 1.4, range: 160 },
      { cost: 150, dmg: 100, rate: 1.3, range: 170, chain: 2 },
    ],
  },
  fire: {
    name: 'Kül Kazanı', terrain: ASH, icon: '🔥',
    desc: 'Alev topu fırlatır, alana hasar verir. Ateş zırhın yarısını deler.',
    levels: [
      { cost: 80, dmg: 22, rate: 1.8, range: 120, radius: 45 },
      { cost: 95, dmg: 40, rate: 1.7, range: 130, radius: 50 },
      { cost: 140, dmg: 65, rate: 1.6, range: 140, radius: 60, burn: 14 },
    ],
  },
};

// 3. seviyeden sonra iki dal açılır; seçilen dal kendi içinde 2 kademe yükseltilir.
// Kule seviyeleri: 0-2 temel, 3 = dal kademe I, 4 = dal kademe II
const BRANCHES = {
  thorn: [
    { name: 'Böğürtlen Yağmuru', icon: '🌧️', color: '#b04ad0', desc: 'Kollarından aynı anda birden çok düşmana diken yağdırır.',
      ranks: [{ cost: 160, stats: { dmg: 28, rate: 0.4, range: 140, slow: 0.35, multi: 3 } },
        { cost: 190, stats: { dmg: 40, rate: 0.36, range: 150, slow: 0.4, multi: 4 } }] },
    { name: 'Zehirli Mızrak', icon: '🗡️', color: '#d06ae0', desc: 'Ağır mızrak fırlatır; vurduğu düşmanın zırhını kalıcı olarak eritir.',
      ranks: [{ cost: 170, stats: { dmg: 60, rate: 0.65, range: 155, slow: 0.35, shred: 0.3 } },
        { cost: 200, stats: { dmg: 95, rate: 0.6, range: 170, slow: 0.35, shred: 0.45 } }] },
  ],
  spore: [
    { name: 'Veba Bahçesi', icon: '☠️', color: '#7ad04a', desc: 'Mantar kümesi; çok daha güçlü ve geniş zehir bulutları.',
      ranks: [{ cost: 170, stats: { dps: 32, rate: 1.3, range: 135, radius: 72 } },
        { cost: 200, stats: { dps: 48, rate: 1.2, range: 145, radius: 85 } }] },
    { name: 'Yapışkan Sporlar', icon: '🕸️', color: '#d8b84a', desc: 'Ağ saçan mantar; bulut içindekileri ağır yavaşlatır.',
      ranks: [{ cost: 160, stats: { dps: 22, rate: 1.3, range: 130, radius: 62, slow: 0.45 } },
        { cost: 190, stats: { dps: 30, rate: 1.2, range: 140, radius: 70, slow: 0.6 } }] },
  ],
  crystal: [
    { name: 'Prizma Kulesi', icon: '🔷', color: '#7ae6ff', desc: 'Gökkuşağı prizması; ışın düşmandan düşmana seker.',
      ranks: [{ cost: 180, stats: { dmg: 90, rate: 1.1, range: 175, chain: 5 } },
        { cost: 210, stats: { dmg: 125, rate: 1.0, range: 185, chain: 7 } }] },
    { name: 'Kristal Mızrak', icon: '✴️', color: '#ffffff', desc: 'Dev kristal iğne; tek hedefe devasa hasar ve sersemletme.',
      ranks: [{ cost: 200, stats: { dmg: 280, rate: 2.2, range: 230, stun: 0.6 } },
        { cost: 240, stats: { dmg: 420, rate: 2.0, range: 260, stun: 0.9 } }] },
  ],
  fire: [
    { name: 'Volkan Ağzı', icon: '🌋', color: '#ff6a2a', desc: 'Lav krateri; dev patlama alanı ve güçlü yanan zemin.',
      ranks: [{ cost: 180, stats: { dmg: 95, rate: 1.8, range: 145, radius: 82, burn: 24 } },
        { cost: 210, stats: { dmg: 140, rate: 1.7, range: 155, radius: 95, burn: 34 } }] },
    { name: 'Ejder Nefesi', icon: '🐉', color: '#ffc04a', desc: 'Ejder başı heykeli; çok hızlı alev topları.',
      ranks: [{ cost: 170, stats: { dmg: 46, rate: 0.6, range: 125, radius: 46, burn: 10 } },
        { cost: 200, stats: { dmg: 65, rate: 0.5, range: 135, radius: 52, burn: 15 } }] },
  ],
};
const MAX_LEVEL = 4;
// bir kulenin herhangi bir seviyedeki ham istatistikleri (ağaç güçlendirmeleri hariç)
const baseStats = (type, level, branch) => level >= 3 ? BRANCHES[type][branch].ranks[level - 3].stats : TOWERS[type].levels[level];
// bir sonraki seviyenin maliyeti (dal seçimi hariç)
const nextCost = t => t.level < 2 ? TOWERS[t.type].levels[t.level + 1].cost : t.level === 3 ? BRANCHES[t.type][t.branch].ranks[1].cost : 0;

const TARGET_MODES = [
  { id: 'first', name: 'İlk' },
  { id: 'strong', name: 'Güçlü' },
  { id: 'near', name: 'Yakın' },
];

const ENEMY_INFO = {
  peasant: { icon: '👨‍🌾', tip: 'Zayıf ama kalabalık gelir.' },
  rogue: { icon: '🗡️', tip: 'Çok hızlı! Kristali kapıp hemen kaçar.' },
  knight: { icon: '🛡️', tip: 'Zırhlı: dikenler az işler. Büyü, zehir ve ateş kullan.' },
  priest: { icon: '✝️', tip: 'Büyüye dirençli ve yakındakileri iyileştirir. Önce onu indir.' },
  boss: { icon: '👑', tip: 'Çok güçlü patron. Büyülerini sakla!' },
  banner: { icon: '🚩', tip: 'Yanındakileri %30 hızlandırır.' },
  mage: { icon: '🔮', tip: 'Kalkanı hasarı emer; dostlarındaki zehir ve kökleri temizler.' },
  miner: { icon: '⛏️', tip: 'Toprağa gömülür; gömülüyken sadece büyüler işler.' },
  inquisitor: { icon: '⚖️', tip: 'Son patron: sürekli köylü çağırır.' },
};

// her bölüm üç aşamada oynanır; bir aşamada 3 yıldız almak sonrakini açar
const TIERS = [
  { id: 0, name: 'Kolay', hp: 0.75, gold: 1.15, color: '#6fbf4a', desc: 'Düşman canı -%25 · Altın +%15' },
  { id: 1, name: 'Normal', hp: 1, gold: 1, color: '#e2b852', desc: 'Standart savaş' },
  { id: 2, name: 'Zor', hp: 1.4, gold: 0.9, color: '#d0503a', desc: 'Düşman canı +%40 · Altın -%10' },
];
const tierOpen = (li, t) => t === 0 || save.stars[li][t - 1] === 3;

const ENEMIES = {
  peasant: { name: 'Köylü', hp: 32, speed: 48, armor: 0, mres: 0, gold: 4, mana: 2, color: '#c9a26b', r: 9 },
  rogue: { name: 'Hırsız', hp: 26, speed: 88, armor: 0, mres: 0.1, gold: 5, mana: 2, color: '#4f6b45', r: 8 },
  knight: { name: 'Şövalye', hp: 120, speed: 34, armor: 0.45, mres: 0, gold: 10, mana: 4, color: '#9aa4b0', r: 11 },
  priest: { name: 'Rahip', hp: 65, speed: 42, armor: 0, mres: 0.5, gold: 9, mana: 4, color: '#f0ead8', r: 9, heal: true },
  boss: { name: 'Kutsal Paladin', hp: 900, speed: 28, armor: 0.35, mres: 0.25, gold: 80, mana: 25, color: '#e6c34a', r: 16 },
  // yakındaki dostlarını %30 hızlandırır
  banner: { name: 'Bayraktar', hp: 80, speed: 44, armor: 0.2, mres: 0.1, gold: 10, mana: 4, color: '#b8423a', r: 10, aura: true },
  // büyü kalkanı taşır, yakındaki dostlarının zehir/yavaşlatma/köklerini temizler
  mage: { name: 'Savaş Büyücüsü', hp: 70, speed: 40, armor: 0, mres: 0.6, gold: 12, mana: 5, color: '#3a5fb8', r: 9, shield: 0.6, cleanse: true },
  // ara ara toprağa gömülür (kristal taşırken gömülemez); gömülüyken sadece büyüler işler
  miner: { name: 'Cüce Kazmacı', hp: 70, speed: 44, armor: 0.15, mres: 0, gold: 9, mana: 3, color: '#8a6a3a', r: 9, burrow: true },
  // köylü çağırır
  inquisitor: { name: 'Baş Engizisyoncu', hp: 1800, speed: 24, armor: 0.3, mres: 0.35, gold: 150, mana: 40, color: '#7a1f2a', r: 18, summon: true },
};

const SPELLS = [
  { id: 'bolt', icon: '⚡', name: 'Gök Gürültüsü', cost: 40, cd: 7, radius: 70, desc: 'Alandaki düşmanlara 110 büyü hasarı ve sersemletme.' },
  { id: 'root', icon: '🌱', name: 'Sarmaşık Kapanı', cost: 30, cd: 12, radius: 85, desc: 'Alandaki düşmanları 3 saniye köklere bağlar.' },
  { id: 'fear', icon: '👻', name: 'Dehşet Çığlığı', cost: 50, cd: 16, radius: 90, desc: 'Alandaki düşmanlar 2,5 sn geri kaçar; taşıdıkları kristali düşürürler.' },
  { id: 'shape', icon: '🪨', name: 'Toprak Dönüşümü', cost: 20, cd: 1, radius: 0, desc: 'Ağacı kaldırır ya da boş araziyi dönüştürür (Çimen→Bataklık→Kaya→Kül).' },
];

// Haritada 6 bölge, her bölgede 3 bölüm. Yollar yalnızca yatay/dikey parçalardan oluşur.
const LEVELS = [
  // --- Bölge 1: Sisli Orman ---
  { name: 'Sisli Koru', seed: 11, gold: 180, crystals: 15, vault: [19, 8], waves: 8,
    paths: [[[-1, 4], [6, 4], [6, 11], [13, 11], [13, 8], [19, 8]]] },
  { name: 'Sis Patikası', seed: 31, gold: 200, crystals: 15, vault: [17, 11], waves: 8,
    paths: [[[-1, 2], [20, 2], [20, 6], [3, 6], [3, 11], [17, 11]]] },
  { name: 'Yaşlı Meşe', seed: 37, gold: 220, crystals: 15, vault: [19, 8], waves: 9,
    paths: [[[-1, 8], [8, 8], [8, 4], [14, 4], [14, 8], [19, 8]], [[10, 16], [10, 12], [19, 12], [19, 8]]] },
  // --- Bölge 2: Çürük Bataklık ---
  { name: 'Çürük Vadi', seed: 27, gold: 220, crystals: 15, vault: [12, 8], waves: 10,
    paths: [[[-1, 3], [5, 3], [5, 8], [12, 8]], [[24, 12], [18, 12], [18, 5], [14, 5], [14, 8], [12, 8]]] },
  { name: 'Söğüt Geçidi', seed: 41, gold: 240, crystals: 15, vault: [4, 8], waves: 10,
    paths: [[[24, 3], [15, 3], [15, 8], [4, 8]], [[24, 13], [10, 13], [10, 8], [4, 8]]] },
  { name: 'Batık Köprü', seed: 43, gold: 260, crystals: 15, vault: [12, 3], waves: 11,
    paths: [[[-1, 12], [6, 12], [6, 7], [12, 7], [12, 3]], [[24, 12], [18, 12], [18, 7], [12, 7], [12, 3]]] },
  // --- Bölge 3: Unutulmuş Mabet ---
  { name: 'Kayıp Mabet', seed: 53, gold: 300, crystals: 15, vault: [12, 7], waves: 12,
    paths: [[[-1, 2], [4, 2], [4, 7], [12, 7]], [[24, 3], [19, 3], [19, 10], [12, 10], [12, 7]],
      [[3, 16], [3, 12], [9, 12], [9, 9], [12, 9], [12, 7]]] },
  { name: 'Yıkık Sütunlar', seed: 59, gold: 300, crystals: 15, vault: [3, 13], waves: 12,
    paths: [[[24, 2], [10, 2], [10, 9], [3, 9], [3, 13]], [[24, 10], [16, 10], [16, 13], [3, 13]],
      [[14, -1], [14, 6], [6, 6], [6, 9], [3, 9], [3, 13]]] },
  { name: 'Mabet Kalbi', seed: 61, gold: 320, crystals: 15, vault: [12, 8], waves: 13,
    paths: [[[-1, 4], [9, 4], [9, 8], [12, 8]], [[24, 4], [15, 4], [15, 8], [12, 8]], [[6, 16], [6, 12], [12, 12], [12, 8]]] },
  // --- Bölge 4: Kül Ovası (Kül arazisi ve Kül Kazanı burada açılır) ---
  { name: 'Kül Ovası', seed: 71, gold: 300, crystals: 15, vault: [20, 3], waves: 12,
    paths: [[[-1, 13], [6, 13], [6, 8], [11, 8], [11, 3], [20, 3]], [[10, 16], [10, 12], [16, 12], [16, 6], [20, 6], [20, 3]]] },
  { name: 'Ejder Mezarı', seed: 73, gold: 320, crystals: 15, vault: [21, 12], waves: 12,
    paths: [[[-1, 3], [18, 3], [18, 8], [8, 8], [8, 12], [21, 12]], [[4, 16], [4, 12], [21, 12]]] },
  { name: 'Lav Nehri', seed: 79, gold: 340, crystals: 15, vault: [3, 3], waves: 13,
    paths: [[[24, 3], [14, 3], [14, 9], [3, 9], [3, 3]], [[24, 13], [8, 13], [8, 6], [3, 6], [3, 3]]] },
  // --- Bölge 5: Cüce Dağları ---
  { name: 'Cüce Madenleri', seed: 89, gold: 420, crystals: 18, vault: [12, 8], waves: 13,
    paths: [[[-1, 8], [4, 8], [4, 3], [9, 3], [9, 8], [12, 8]], [[24, 8], [20, 8], [20, 13], [15, 13], [15, 8], [12, 8]],
      [[12, -1], [12, 1], [16, 1], [16, 5], [12, 5], [12, 8]]] },
  { name: 'Derin Ocak', seed: 101, gold: 400, crystals: 18, vault: [20, 8], waves: 13,
    paths: [[[-1, 2], [6, 2], [6, 13], [13, 13], [13, 8], [20, 8]], [[13, -1], [13, 4], [20, 4], [20, 8]], [[24, 15], [17, 15], [17, 11], [20, 11], [20, 8]]] },
  { name: 'Kristal Damarı', seed: 103, gold: 420, crystals: 18, vault: [12, 13], waves: 14,
    paths: [[[4, -1], [4, 6], [10, 6], [10, 13], [12, 13]], [[20, -1], [20, 6], [14, 6], [14, 13], [12, 13]],
      [[-1, 11], [7, 11], [7, 13], [12, 13]]] },
  // --- Bölge 6: Engizisyon Toprakları ---
  { name: 'Kuşatma Hattı', seed: 107, gold: 430, crystals: 18, vault: [12, 3], waves: 14,
    paths: [[[-1, 13], [5, 13], [5, 7], [12, 7], [12, 3]], [[24, 13], [19, 13], [19, 7], [12, 7], [12, 3]], [[12, 16], [12, 3]]] },
  { name: 'Kara Kale', seed: 109, gold: 440, crystals: 18, vault: [20, 12], waves: 14,
    paths: [[[-1, 2], [10, 2], [10, 12], [20, 12]], [[-1, 14], [6, 14], [6, 12], [20, 12]],
      [[24, 2], [16, 2], [16, 8], [20, 8], [20, 12]], [[15, 16], [15, 14], [23, 14], [23, 12], [20, 12]]] },
  { name: 'Engizisyon Kapısı', seed: 97, gold: 440, crystals: 18, vault: [12, 8], waves: 15,
    paths: [[[-1, 2], [7, 2], [7, 8], [12, 8]], [[24, 13], [17, 13], [17, 8], [12, 8]],
      [[24, 2], [16, 2], [16, 5], [12, 5], [12, 8]], [[2, 16], [2, 12], [9, 12], [9, 10], [12, 10], [12, 8]]] },
];
// Sonsuz mod: dalgalar bitmez, her dalga bir öncekinden güçlüdür
const ENDLESS = { name: 'Sonsuz Bataklık', seed: 131, gold: 400, crystals: 20, vault: [12, 8], waves: Infinity,
  endless: true, r: 5, d: 1, terrains: 4,
  paths: [[[-1, 2], [5, 2], [5, 8], [12, 8]], [[24, 13], [19, 13], [19, 8], [12, 8]], [[9, 16], [9, 12], [12, 12], [12, 8]]] };
const levelDef = li => (li === -1 ? ENDLESS : LEVELS[li]);

// r: bölge, d: zorluk derecesi (bölge içinde her bölüm biraz daha zor)
LEVELS.forEach((L, i) => {
  L.r = Math.floor(i / 3);
  L.d = L.r + (i % 3) * 0.4;
  if (L.r >= 3) L.terrains = 4;
});

while (save.stars.length < LEVELS.length) save.stars.push([0, 0, 0]);
// eski 6 bölümlük kayıt: her eski bölüm kendi bölgesinin ilk bölümüne, finali son bölüme taşınır
if (save.v !== 2) {
  if (save.stars.some((s, k) => k >= 1 && k <= 5 && s.some(Boolean))) {
    const old = save.stars.slice(0, 6);
    save.stars = LEVELS.map(() => [0, 0, 0]);
    old.forEach((s, k) => { save.stars[k === 5 ? LEVELS.length - 1 : k * 3] = s; });
  }
  save.revealed = 1;
  save.v = 2;
  persist();
}

// ---------- yardımcılar ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function ellipse(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }

function buildPath(wp) {
  const pts = wp.map(([x, y]) => ({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 }));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i], pts[i - 1]));
  return { wp, pts, cum, len: cum[cum.length - 1] };
}
function posAt(p, d) {
  d = clamp(d, 0, p.len);
  let i = 1;
  while (i < p.cum.length - 1 && p.cum[i] < d) i++;
  const a = p.pts[i - 1], b = p.pts[i], seg = p.cum[i] - p.cum[i - 1];
  const t = seg ? (d - p.cum[i - 1]) / seg : 0;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ang: Math.atan2(b.y - a.y, b.x - a.x) };
}

// ---------- ses ----------
let AC = null, sfxGain = null, muted = false;
const lastSfx = {};
// tarayıcılar sesi ancak bir kullanıcı etkileşiminden sonra açar
function audio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    sfxGain = AC.createGain();
    sfxGain.connect(AC.destination);
    Music.init(AC, AC.destination);
    applyAudio();
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function applyAudio() {
  if (!AC) return;
  sfxGain.gain.value = muted ? 0 : save.settings.sfx;
  Music.setVolume(muted ? 0 : save.settings.music * 0.6);
}
document.addEventListener('pointerdown', () => { try { audio(); Music.start(); } catch (e) {} });
function sfx(type) {
  if (muted || !save.settings.sfx) return;
  const now = performance.now();
  if (lastSfx[type] && now - lastSfx[type] < 60) return;
  lastSfx[type] = now;
  try {
    audio();
    const S = {
      thorn: [880, 600, 0.04, 'square', 0.03], spore: [220, 140, 0.15, 'sine', 0.08],
      beam: [1200, 400, 0.2, 'sawtooth', 0.05], die: [300, 80, 0.15, 'triangle', 0.08],
      steal: [520, 760, 0.3, 'square', 0.07], build: [300, 700, 0.18, 'triangle', 0.1],
      bolt: [140, 40, 0.4, 'sawtooth', 0.15], root: [180, 320, 0.3, 'sine', 0.12],
      coin: [990, 1320, 0.08, 'sine', 0.05], wave: [200, 400, 0.6, 'square', 0.06],
      bad: [160, 120, 0.15, 'square', 0.06], fire: [160, 60, 0.25, 'sawtooth', 0.06],
    }[type];
    if (!S) return;
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.type = S[3];
    o.frequency.setValueAtTime(S[0], t);
    o.frequency.exponentialRampToValueAtTime(S[1], t + S[2]);
    g.gain.setValueAtTime(S[4], t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + S[2]);
    o.connect(g).connect(sfxGain);
    o.start(t); o.stop(t + S[2] + 0.02);
  } catch (e) {}
}

// ---------- oyun kurulumu ----------
let G = null;
const terrCanvas = document.createElement('canvas');
terrCanvas.width = W; terrCanvas.height = H;
// canvas çözünürlüğü / oyun koordinatı oranı (fitUI ayarlar)
// Oyun alanı (960x640) pencereye en büyük hâliyle sığdırılır; artta kalan kenarlar
// bulanık arazi görüntüsüyle doldurulur. fitUI ayarlar:
//   VIEW: oyun biriminden CSS pikseline ölçek (sc), ortalama ofseti (ox, oy), canvas/CSS oranı (px)
//   RES: oyun birimi başına canvas pikseli (sc * px)
let RES = 1;
// oyun alanının dışında kalan pencere payı (oyun birimi): sol, sağ, üst, alt
let PAD = { l: 0, r: 0, t: 0, b: 0 };
const VIEW = { sc: 1, ox: 0, oy: 0, px: 1, rx: 0, ry: 0 };
// sağdaki kule paneli için ayrılan genişlik (CSS pikseli)
const SIDE_W = 150;
// arazinin küçük, bulanık kopyası: pencerenin tamamını arka plan olarak doldurur
const bgCanvas = document.createElement('canvas');
bgCanvas.width = 160; bgCanvas.height = 100;
function makeBg() {
  const c = bgCanvas.getContext('2d');
  c.imageSmoothingEnabled = true;
  c.drawImage(terrCanvas, 0, 0, bgCanvas.width, bgCanvas.height);
  c.fillStyle = 'rgba(8,5,3,.45)';
  c.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
}

function newGame(li, tier = 0) {
  const L = levelDef(li), rng = mulberry32(L.seed);
  const terr = [], tree = [];
  const seeds = [], nt = L.terrains || 3;
  for (let i = 0; i < (nt === 4 ? 18 : 15); i++) seeds.push({ x: rng() * COLS, y: rng() * ROWS, t: i % nt });
  for (let y = 0; y < ROWS; y++) {
    terr.push([]); tree.push([]);
    for (let x = 0; x < COLS; x++) {
      let best = 1e9, t = 0;
      for (const s of seeds) {
        const d = (s.x - x) ** 2 + (s.y - y) ** 2 + rng() * 2;
        if (d < best) { best = d; t = s.t; }
      }
      terr[y].push(t); tree[y].push(false);
    }
  }
  // yol/mahzen altındaki görsel zemin için arazinin ilk hâli
  const base = terr.map(r => r.slice());
  const paths = L.paths.map(buildPath);
  for (const p of paths) {
    for (let i = 1; i < p.wp.length; i++) {
      let [x0, y0] = p.wp[i - 1];
      const [x1, y1] = p.wp[i];
      const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
      while (true) {
        if (x0 >= 0 && x0 < COLS && y0 >= 0 && y0 < ROWS) terr[y0][x0] = PATH;
        if (x0 === x1 && y0 === y1) break;
        x0 += sx; y0 += sy;
      }
    }
  }
  const [vx, vy] = L.vault;
  for (let y = vy - 1; y <= vy + 1; y++)
    for (let x = vx - 1; x <= vx + 1; x++)
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) terr[y][x] = VAULT;
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (terr[y][x] < PATH && rng() < 0.22) tree[y][x] = true;

  const crystals = L.crystals + 2 * sk('g3');
  G = {
    li, L, terr, base, tree, paths, amb: [], byType: [[], [], [], []],
    vault: { x: vx * TILE + TILE / 2, y: vy * TILE + TILE / 2 },
    towers: [], enemies: [], proj: [], clouds: [], parts: [], texts: [], drops: [], beams: [], bolts: [],
    tier, diff: TIERS[tier],
    gold: Math.round(L.gold * (1 + 0.1 * sk('g1')) * TIERS[tier].gold), mana: 50, delayed: [],
    crystals, startCrystals: crystals, lost: 0,
    wave: 0, waves: makeWaves(li), spawnQ: [], waveTimer: -1,
    speed: 1, paused: false, over: false, demo: false,
    sel: null, spell: null, cds: SPELLS.map(() => 0), time: 0, hover: null, banner: null, nextId: 1, toasts: [],
    rings: [], souls: [], coins: [], flyGems: [], pillars: [], shake: 0, flashFx: null, bossWarn: 0,
  };
  renderTerrain();
  return G;
}

function makeWaves(li) {
  const L = levelDef(li);
  if (L.endless) return [waveFor(L, 0, li), waveFor(L, 1, li)];
  const out = [];
  for (let i = 0; i < L.waves; i++) out.push(waveFor(L, i, li));
  return out;
}

function waveFor(L, i, li) {
  const n = L.waves, np = L.paths.length;
  // sonsuz modda bölge ve zorluk dalga ilerledikçe artar
  const d = L.endless ? 0.5 + i * 0.3 : L.d, r = L.endless ? Math.min(5, 1 + Math.floor(i / 4)) : L.r;
  {
    // b: kalabalık ölçeği; can çarpanı ayrı ve daha yumuşak artar
    const b = i + d * 0.8;
    const g = [{ type: 'peasant', count: Math.min(14, 4 + Math.floor(b * 1.2)), gap: 0.9 }];
    if (b >= 2) g.push({ type: 'rogue', count: Math.min(10, 2 + Math.floor(b / 2)), gap: 0.6 });
    if (b >= 3) g.push({ type: 'knight', count: Math.min(7, 1 + Math.floor((b - 3) / 2)), gap: 1.6 });
    if (b >= 5) g.push({ type: 'priest', count: Math.min(4, 1 + Math.floor((b - 5) / 3)), gap: 2.2 });
    if (r >= 3 && i >= 1) g.push({ type: 'banner', count: Math.min(3, 1 + Math.floor(i / 5)), gap: 3 });
    if (r >= 3 && i >= 3) g.push({ type: 'mage', count: Math.min(4, 1 + Math.floor((i - 2) / 3)), gap: 2.5 });
    if (r >= 4 && i >= 2) g.push({ type: 'miner', count: Math.min(6, 1 + Math.floor(i / 2)), gap: 1.2 });
    if (L.endless) {
      if ((i + 1) % 15 === 0) g.push({ type: 'inquisitor', count: 1, gap: 1 });
      else if ((i + 1) % 5 === 0) g.push({ type: 'boss', count: 1 + Math.floor(i / 10), gap: 5 });
    } else {
      if (r >= 3 && i === Math.floor(n / 2)) g.push({ type: 'boss', count: 1, gap: 1 });
      if (i === n - 1) g.push(li === LEVELS.length - 1 ? { type: 'inquisitor', count: 1, gap: 1 } : { type: 'boss', count: 1 + Math.floor(d / 2), gap: 5 });
    }
    return { hpMul: 1 + i * 0.17 + d * 0.15, groups: g.map((x, k) => ({ ...x, path: (i + k) % np })) };
  }
}

function startWave() {
  if (G.L.endless) while (G.waves.length <= G.wave + 1) G.waves.push(waveFor(G.L, G.waves.length, G.li));
  if (G.wave >= G.waves.length) return;
  const w = G.waves[G.wave];
  w.groups.forEach((g, k) => {
    for (let j = 0; j < g.count; j++)
      G.spawnQ.push({ at: G.time + k * 2.5 + j * g.gap, type: g.type, path: g.path, hpMul: w.hpMul });
  });
  G.spawnQ.sort((a, b) => a.at - b.at);
  G.wave++;
  G.waveTimer = -1;
  if (G.L.endless && G.wave >= 20) ach('endless20');
  G.banner = { s: G.wave === G.waves.length ? 'Son Dalga!' : `Dalga ${G.wave}`, t: 2.4, max: 2.4 };
  sfx('wave');
}

function spawn(q, d = 0) {
  if (!G.demo && !save.seen[q.type]) { save.seen[q.type] = true; persist(); G.toasts.push({ type: q.type, t: 6 }); }
  const def = ENEMIES[q.type], p = G.paths[q.path], pos = posAt(p, d);
  if ((q.type === 'boss' || q.type === 'inquisitor') && !G.demo) {
    G.bossWarn = 3;
    G.banner = { s: '⚠ Patron Geliyor!', t: 2.4, max: 2.4, boss: true };
    flash('#ff2a1a', 0.22, 0.4); shake(5); sfx('steal');
  }
  const hp = def.hp * q.hpMul * (G.diff ? G.diff.hp : 1), shield = def.shield ? hp * def.shield : 0;
  G.enemies.push({
    id: G.nextId++, type: q.type, def, hp, maxHp: hp, path: p, d: Math.max(0, d), dir: 1, carry: false,
    x: pos.x, y: pos.y, ang: pos.ang, slow: 0, slowT: 0, poison: 0, poisonT: 0, root: 0, stun: 0,
    healCd: 1.5, flash: 0, dead: false, shield, maxShield: shield, haste: false,
    burrowT: 0, burrowCd: 2 + Math.random() * 3, cleanseCd: 3, summonCd: 6, hpMul: q.hpMul,
  });
}

// ---------- arazi çizimi ----------
const TERR_COLORS = ['#4f7a3a', '#35504a', '#77746c', '#4a3c38'];
// görsel zemin türü: yol ve mahzen karoları altlarındaki arazinin rengini kullanır
const looksLike = (x, y) => G.terr[y][x] < PATH ? G.terr[y][x] : G.base[y][x];

function renderTerrain() {
  PAD = { l: Math.max(0, VIEW.ox / VIEW.sc), r: Math.max(0, VIEW.rx / VIEW.sc), t: Math.max(0, VIEW.oy / VIEW.sc), b: Math.max(0, VIEW.ry / VIEW.sc) };
  terrCanvas.width = Math.round((W + PAD.l + PAD.r) * RES);
  terrCanvas.height = Math.round((H + PAD.t + PAD.b) * RES);
  const c = terrCanvas.getContext('2d');
  c.setTransform(RES, 0, 0, RES, PAD.l * RES, PAD.t * RES);
  // dış pay: ızgaranın kenar karolarının türü uzatılır (yol kenardan içeri uzanıyorsa dışarıda da devam eder)
  const ox0 = Math.ceil(PAD.l / TILE) + 1, oy0 = Math.ceil(PAD.t / TILE) + 1;
  const ox1 = Math.ceil(PAD.r / TILE) + 1, oy1 = Math.ceil(PAD.b / TILE) + 1;
  for (let y = -oy0; y < ROWS + oy1; y++)
    for (let x = -ox0; x < COLS + ox1; x++)
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS)
        drawTile(c, x, y, looksLike(clamp(x, 0, COLS - 1), clamp(y, 0, ROWS - 1)));
  G.byType = [[], [], [], []];
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      drawTile(c, x, y);
      if (G.terr[y][x] < PATH) G.byType[G.terr[y][x]].push({ x, y });
    }
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) blendEdges(c, x, y);
  // çok hafif ızgara, sadece inşa edilebilir karolarda
  c.strokeStyle = 'rgba(0,0,0,.06)';
  c.lineWidth = 1;
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (G.terr[y][x] < PATH && !G.tree[y][x]) c.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
  drawPaths(c);
  drawPlaza(c);
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) if (G.tree[y][x]) drawTree(c, x, y);
  makeBg();
}

// komşu arazi türüyle sınırı düzensiz lekelerle yumuşatır
function blendEdges(c, x, y) {
  const t = looksLike(x, y), r = mulberry32(x * 7919 + y * 104729 + 3);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
    const nt = looksLike(nx, ny);
    if (nt === t) continue;
    c.fillStyle = TERR_COLORS[nt];
    for (let i = 0; i < 6; i++) {
      const along = r() * TILE, depth = r() * 6, rad = 3 + r() * 4;
      const px = dx ? (dx > 0 ? (x + 1) * TILE - depth : x * TILE + depth) : x * TILE + along;
      const py = dy ? (dy > 0 ? (y + 1) * TILE - depth : y * TILE + depth) : y * TILE + along;
      circle2(c, px, py, rad);
    }
  }
}

function drawPaths(c) {
  c.lineJoin = 'round'; c.lineCap = 'round';
  const layers = [[40, 'rgba(25,18,10,.35)'], [34, '#5e4528'], [29, '#8b6b45'], [18, '#977650']];
  for (const [w, col] of layers) {
    c.strokeStyle = col; c.lineWidth = w;
    for (const p of G.paths) {
      c.beginPath();
      const pts = PAD.l > 0 && p.pts[0].x < 0 ? [{ x: -PAD.l - 2, y: p.pts[0].y }, ...p.pts] : p.pts;
      pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y));
      c.stroke();
    }
  }
  // çakıllar ve tekerlek izleri
  for (const p of G.paths) {
    const r = mulberry32(p.pts.length * 131 + Math.round(p.len));
    for (let d = 0; d < p.len; d += 5) {
      const q = posAt(p, d), nx = -Math.sin(q.ang), ny = Math.cos(q.ang);
      c.fillStyle = 'rgba(70,50,28,.35)';
      circle2(c, q.x + nx * 7, q.y + ny * 7, 1.6);
      circle2(c, q.x - nx * 7, q.y - ny * 7, 1.6);
      if (r() < 0.45) {
        const o = (r() - 0.5) * 26;
        c.fillStyle = r() < 0.5 ? '#a8885e' : '#6f5333';
        circle2(c, q.x + nx * o, q.y + ny * o, 1 + r() * 2);
      }
    }
  }
}

function drawPlaza(c) {
  const { x, y } = G.vault;
  c.fillStyle = 'rgba(0,0,0,.35)'; circle2(c, x, y + 3, 60);
  c.fillStyle = '#4a4054'; circle2(c, x, y, 57);
  c.fillStyle = '#3a3245'; circle2(c, x, y, 47);
  // taş döşemeler
  c.strokeStyle = '#2a2333'; c.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2;
    c.beginPath(); c.moveTo(x + Math.cos(a) * 47, y + Math.sin(a) * 47); c.lineTo(x + Math.cos(a) * 57, y + Math.sin(a) * 57); c.stroke();
  }
  c.beginPath(); c.arc(x, y, 47, 0, Math.PI * 2); c.stroke();
  // rün halkası
  c.strokeStyle = 'rgba(190,140,255,.35)'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(x, y, 41, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, rx = x + Math.cos(a) * 41, ry = y + Math.sin(a) * 41;
    c.beginPath(); c.moveTo(rx - 3, ry - 3); c.lineTo(rx + 3, ry + 3); c.moveTo(rx + 3, ry - 3); c.lineTo(rx, ry + 4); c.stroke();
  }
}

function drawTile(c, x, y, tt) {
  const r = mulberry32(x * 92837 + y * 1237 + G.L.seed * 7), px = x * TILE, py = y * TILE, t = tt === undefined ? looksLike(x, y) : tt;
  const base = t === GRASS ? '#5f9c44' : TERR_COLORS[t];
  c.fillStyle = base;
  c.fillRect(px, py, TILE, TILE);
  if (t === GRASS) {
    // canlı çimen: açık ve koyu lekeler, konturlu çimen demetleri
    for (let i = 0; i < 4; i++) {
      c.fillStyle = r() < 0.5 ? '#74b050' : '#4f8a3a';
      c.globalAlpha = 0.4; circle2(c, px + r() * TILE, py + r() * TILE, 5 + r() * 6);
    }
    c.globalAlpha = 1;
    c.strokeStyle = '#2d5520'; c.lineWidth = 1.6; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const gx = px + 4 + r() * (TILE - 8), gy = py + 6 + r() * (TILE - 10);
      c.beginPath();
      c.moveTo(gx - 2, gy); c.quadraticCurveTo(gx - 2, gy - 4, gx - 4, gy - 6);
      c.moveTo(gx, gy); c.lineTo(gx, gy - 7);
      c.moveTo(gx + 2, gy); c.quadraticCurveTo(gx + 2, gy - 4, gx + 4, gy - 6);
      c.stroke();
    }
    c.lineCap = 'butt';
    if (r() < 0.25) { c.fillStyle = ['#ffe66a', '#ff8fd6', '#ffffff'][Math.floor(r() * 3)]; circle2(c, px + r() * TILE, py + r() * TILE, 2.2); }
  } else if (t === SWAMP) {
    c.fillStyle = '#284440';
    ellipse(c, px + 10 + r() * 20, py + 10 + r() * 20, 9 + r() * 6, 5 + r() * 4);
    c.fillStyle = '#4a6b5a';
    for (let i = 0; i < 3; i++) circle2(c, px + r() * TILE, py + r() * TILE, 1.5 + r() * 1.5);
    c.strokeStyle = '#5f8a4a'; c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const gx = px + r() * TILE, gy = py + r() * TILE;
      c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + 1, gy - 8); c.stroke();
    }
  } else if (t === ROCK) {
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i % 2 ? '#8a877e' : '#68655e';
      const sx = px + 4 + r() * 28, sy = py + 4 + r() * 28, s = 5 + r() * 7;
      c.beginPath(); c.moveTo(sx, sy - s); c.lineTo(sx + s, sy - s * 0.2); c.lineTo(sx + s * 0.6, sy + s * 0.7); c.lineTo(sx - s * 0.7, sy + s * 0.5); c.closePath(); c.fill();
    }
    c.strokeStyle = '#55524b'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(px + r() * TILE, py + r() * TILE); c.lineTo(px + r() * TILE, py + r() * TILE); c.stroke();
  } else if (t === ASH) {
    c.fillStyle = '#3a2d2a';
    for (let i = 0; i < 4; i++) circle2(c, px + r() * TILE, py + r() * TILE, 2 + r() * 3);
    c.strokeStyle = '#d9582a'; c.lineWidth = 1.2;
    c.beginPath();
    let lx = px + r() * TILE, ly = py + r() * 10;
    c.moveTo(lx, ly);
    for (let i = 0; i < 4; i++) { lx += r() * 12 - 6; ly += 6 + r() * 4; c.lineTo(lx, ly); }
    c.stroke();
    c.fillStyle = '#ffa04a';
    for (let i = 0; i < 3; i++) circle2(c, px + r() * TILE, py + r() * TILE, 1);
  }
}
function circle2(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function drawTree(c, x, y) {
  const r = mulberry32(x * 31 + y * 977 + 5), cx = x * TILE + TILE / 2 + r() * 6 - 3, cy = y * TILE + TILE / 2 + r() * 4;
  c.fillStyle = 'rgba(0,0,0,.3)'; ellipse(c, cx, cy + 12, 14, 5);
  const t = looksLike(x, y);
  if (t === ROCK) {
    // çam
    c.fillStyle = '#4a2f1c'; c.fillRect(cx - 2, cy + 2, 4, 10);
    for (let i = 0; i < 3; i++) {
      const w = 13 - i * 3, top = cy - 4 - i * 7;
      c.fillStyle = ['#1d3d2a', '#24493a', '#2c5642'][i];
      c.beginPath(); c.moveTo(cx - w, top + 9); c.lineTo(cx, top - 8); c.lineTo(cx + w, top + 9); c.closePath(); c.fill();
    }
    c.fillStyle = 'rgba(230,240,255,.5)';
    c.beginPath(); c.moveTo(cx - 3, cy - 21); c.lineTo(cx, cy - 26); c.lineTo(cx + 3, cy - 21); c.closePath(); c.fill();
  } else if (t === ASH) {
    // yanık ağaç
    c.strokeStyle = '#1a1210'; c.lineCap = 'round';
    c.lineWidth = 4; c.beginPath(); c.moveTo(cx, cy + 12); c.lineTo(cx, cy - 10); c.stroke();
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(cx, cy - 2); c.lineTo(cx - 9, cy - 12); c.moveTo(cx, cy - 6); c.lineTo(cx + 8, cy - 16); c.moveTo(cx - 5, cy - 7); c.lineTo(cx - 8, cy - 18); c.stroke();
    c.fillStyle = '#ff7a2a'; circle2(c, cx + 1, cy + 4, 1.2);
  } else if (t === SWAMP) {
    // söğüt
    c.fillStyle = '#3a2a1c'; c.fillRect(cx - 3, cy, 6, 12);
    c.fillStyle = '#2b4a32'; circle2(c, cx, cy - 8, 12);
    c.strokeStyle = '#3d6b40'; c.lineWidth = 2;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(cx + i * 5, cy - 10); c.quadraticCurveTo(cx + i * 6, cy - 2, cx + i * 6.5, cy + 6); c.stroke(); }
  } else {
    // yuvarlak, konturlu ağaç: gövde, üç katmanlı taç ve parlak yüzey
    c.fillStyle = '#5a3a20'; c.fillRect(cx - 3, cy, 6, 12);
    c.strokeStyle = '#2a1a0c'; c.lineWidth = 1.5; c.strokeRect(cx - 3, cy, 6, 12);
    const crown = ['#2e7a34', '#3d8e3e', '#4ea04a'];
    const ox = [-6, 6, 0], oy = [-4, -4, -11], rr = [9, 9, 10];
    for (let i = 0; i < 3; i++) {
      c.fillStyle = crown[i];
      circle2(c, cx + ox[i], cy + oy[i], rr[i]);
      c.strokeStyle = '#1c4220'; c.lineWidth = 2;
      c.beginPath(); c.arc(cx + ox[i], cy + oy[i], rr[i], 0, Math.PI * 2); c.stroke();
    }
    c.fillStyle = 'rgba(190,240,130,.55)'; circle2(c, cx + 3, cy - 14, 3.5);
    c.fillStyle = 'rgba(190,240,130,.35)'; circle2(c, cx - 5, cy - 6, 2.5);
  }
}

// ---------- güncelleme ----------
function update(dt) {
  G.time += dt;
  G.mana = Math.min(MANA_MAX, G.mana + dt * MANA_REGEN * (1 + 0.2 * sk('m1')));
  for (const d of G.delayed) if ((d.t -= dt) <= 0) d.fn();
  G.delayed = G.delayed.filter(d => d.t > 0);
  for (let i = 0; i < SPELLS.length; i++) G.cds[i] = Math.max(0, G.cds[i] - dt);

  while (G.spawnQ.length && G.spawnQ[0].at <= G.time) spawn(G.spawnQ.shift());
  if (G.wave > 0 && G.wave < G.waves.length && !G.spawnQ.length) {
    if (G.waveTimer < 0) G.waveTimer = WAVE_GAP;
    G.waveTimer -= dt;
    if (G.waveTimer <= 0) startWave();
  }

  updateEnemies(dt);
  updateTowers(dt);
  updateProjectiles(dt);

  for (const dr of G.drops) {
    dr.t -= dt;
    if (dr.lock) dr.lock -= dt;
    if (dr.t <= 0) {
      G.crystals++; addText(G.vault.x, G.vault.y - 20, '+1 💎', '#c79bff');
      G.flyGems.push({ sx: dr.x, sy: dr.y, tx: G.vault.x, ty: G.vault.y, t: 0, dur: 0.5 });
      ring(G.vault.x, G.vault.y, 10, 60, '190,140,255', 0.5);
    }
  }
  G.drops = G.drops.filter(d => d.t > 0);
  updateFx(dt);
  G.parts = G.parts.filter(p => (p.t -= dt) > 0);
  for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; }
  G.texts = G.texts.filter(t => (t.t -= dt) > 0);
  for (const t of G.texts) t.y -= 22 * dt;
  G.beams = G.beams.filter(b => (b.t -= dt) > 0);
  G.bolts = G.bolts.filter(b => (b.t -= dt) > 0);
  for (const t of G.towers) if (t.pop > 0) t.pop = Math.max(0, t.pop - dt * 1.5);
  if (G.banner && (G.banner.t -= dt) <= 0) G.banner = null;
  if (G.toasts.length && (G.toasts[0].t -= dt) <= 0) G.toasts.shift();

  checkEnd();
}

function updateEnemies(dt) {
  for (const e of G.enemies) e.haste = false;
  for (const b of G.enemies)
    if (b.def.aura && !b.dead) for (const o of G.enemies) if (dist(o, b) < 85) o.haste = true;
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (e.def.burrow) {
      e.burrowCd -= dt;
      if (e.burrowT > 0) { e.burrowT -= dt; if (e.burrowT <= 0) puff(e.x, e.y, '#8a6a3a', 8, 40); }
      else if (e.burrowCd <= 0 && !e.carry && e.root <= 0 && e.stun <= 0) { e.burrowT = 1.8; e.burrowCd = 7; puff(e.x, e.y, '#8a6a3a', 8, 40); }
    }
    if (e.def.cleanse && (e.cleanseCd -= dt) <= 0) {
      e.cleanseCd = 4;
      for (const o of G.enemies)
        if (!o.dead && dist(o, e) < 75 && (o.poisonT > 0 || o.slowT > 0 || o.root > 0)) {
          o.poison = 0; o.poisonT = 0; o.slowT = 0; o.root = 0;
          puff(o.x, o.y - 6, '#7ab0ff', 6, 30);
        }
    }
    if (e.def.summon && (e.summonCd -= dt) <= 0) {
      e.summonCd = 7;
      const pi = G.paths.indexOf(e.path);
      for (let k = 0; k < 2; k++) spawn({ type: 'peasant', path: pi, hpMul: e.hpMul }, e.d - 12 - k * 14);
      puff(e.x, e.y, '#d04a5a', 14, 60);
      addText(e.x, e.y - 30, 'Takviye!', '#ff8a8a');
    }
    e.flash = Math.max(0, e.flash - dt);
    e.slowT = Math.max(0, e.slowT - dt);
    e.root = Math.max(0, e.root - dt);
    e.stun = Math.max(0, e.stun - dt);
    if (e.poisonT > 0) {
      e.poisonT -= dt;
      hurt(e, e.poison * dt, 'poison');
      if (Math.random() < dt * 6) puff(e.x, e.y - 6, '#8fe05a', 1, 15);
      if (e.poisonT <= 0) e.poison = 0;
      if (e.dead) continue;
    }
    if (e.def.heal && (e.healCd -= dt) <= 0) {
      e.healCd = 1.5;
      for (const o of G.enemies)
        if (!o.dead && o.hp < o.maxHp && dist(o, e) < 80) {
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.06);
          puff(o.x, o.y - 8, '#fff6a8', 3, 25);
        }
    }
    let sp = e.def.speed * (e.slowT > 0 ? 1 - e.slow : 1) * (e.carry ? 0.85 : 1) * (e.haste ? 1.3 : 1) * (e.burrowT > 0 ? 1.4 : 1);
    if (e.root > 0 || e.stun > 0) sp = 0;
    // dehşete düşen düşman geldiği yöne kaçar
    if (e.fear > 0) { e.fear -= dt; e.d = Math.max(1, e.d - sp * 0.9 * dt); }
    else e.d += sp * dt * e.dir;
    if (e.dir === 1 && e.d >= e.path.len) {
      e.d = e.path.len;
      e.dir = -1;
      if (G.crystals > 0) {
        G.crystals--;
        e.carry = true;
        G.flyGems.push({ sx: G.vault.x, sy: G.vault.y, e, t: 0, dur: 0.45 });
        ring(G.vault.x, G.vault.y, 10, 70, '255,90,90', 0.5);
        shake(3);
        addText(e.x, e.y - 20, 'Kristal çalındı!', '#ff7a7a');
        sfx('steal');
      }
    }
    if (e.dir === -1 && e.d <= 0) {
      e.dead = true;
      if (e.carry) {
        G.lost++; addText(e.x + (e.x < 0 ? 40 : -40), clamp(e.y, 20, H - 20), '-1 💎', '#ff5a5a'); sfx('bad');
        flash('#ff2020', 0.25, 0.35); shake(6);
      }
      continue;
    }
    const p = posAt(e.path, e.d);
    e.x = p.x; e.y = p.y; e.ang = e.dir === 1 ? p.ang : p.ang + Math.PI;
    if (!e.carry && !(e.fear > 0)) {
      const dr = G.drops.find(d => dist(d, e) < 16 && !(d.lock > 0));
      if (dr) {
        G.drops.splice(G.drops.indexOf(dr), 1);
        e.carry = true; e.dir = -1;
        addText(e.x, e.y - 20, 'Kapıldı!', '#ff9a7a');
      }
    }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
}

// seviye 3 = seçilen uzmanlık
// Seçili boş karo için kurulum durumu: { ok, range } ya da null (yol, mahzen, kule üstü)
function placementAt(tx, ty) {
  if (G.terr[ty][tx] >= PATH || towerAt(tx, ty)) return null;
  if (G.tree[ty][tx]) return { ok: false, range: 0 };
  const key = G.buildType || Object.keys(TOWERS).find(k => TOWERS[k].terrain === G.terr[ty][tx]);
  if (!key || TOWERS[key].terrain !== G.terr[ty][tx]) return { ok: false, range: 0 };
  const cost = priceOf(key, TOWERS[key].levels[0].cost);
  return { ok: G.gold >= cost, range: modStats(key, TOWERS[key].levels[0]).range };
}

function towerStats(t) {
  return modStats(t.type, baseStats(t.type, t.level, t.branch));
}

// Ruh Ağacı güçlendirmelerini kule istatistiklerine uygular
const TPFX = { thorn: 't', spore: 's', crystal: 'c', fire: 'f' };
function modStats(type, base) {
  const p = TPFX[type], o = { ...base };
  if (o.dmg) o.dmg = Math.round(o.dmg * (1 + 0.08 * sk(p + '1')));
  if (o.dps) o.dps = Math.round(o.dps * (1 + 0.1 * sk(p + '1')));
  if (type === 'spore') {
    o.radius = Math.round(o.radius * (1 + 0.08 * sk('s2')));
    o.cloud = 2.2 + 0.6 * sk('s3');
  } else {
    if (type === 'fire') o.radius = Math.round(o.radius * (1 + 0.08 * sk('f2')));
    else o.range = Math.round(o.range * (1 + 0.06 * sk(p + '2')));
    o.rate = o.rate / (1 + 0.07 * sk(p + '3'));
  }
  if (type === 'thorn' && sk('t5')) o.crit = 0.15;
  if (type === 'crystal' && sk('c5')) o.stun = Math.max(o.stun || 0, 0.3);
  if (type === 'fire') {
    if (o.burn) o.burn = Math.round(o.burn * (1 + 0.08 * sk('f1')));
    if (sk('f5')) o.burn = o.burn ? Math.round(o.burn * 1.5) : 8;
  }
  return o;
}
const priceOf = (type, cost) => Math.round(cost * (1 - 0.1 * sk(TPFX[type] + '4')));
const spellCost = i => Math.round(SPELLS[i].cost * (1 - 0.1 * sk('m4')));

function targetScore(t, e) {
  const mode = t.mode || 'first';
  if (mode === 'strong') return e.hp + e.shield;
  if (mode === 'near') return -dist(e, t);
  // ilk: önce kristal taşıyıp kaçmaya en yakın olan, sonra mahzene en yakın olan
  return e.carry ? 2e5 - e.d : e.dir === 1 ? e.d : 1e3 - e.d;
}
function pickTargets(t, range, n) {
  const list = G.enemies.filter(e => !e.dead && e.burrowT <= 0 && dist(e, t) <= range);
  list.sort((a, b) => targetScore(t, b) - targetScore(t, a));
  return list.slice(0, n);
}
function pickTarget(t, range) { return pickTargets(t, range, 1)[0] || null; }

function updateTowers(dt) {
  for (const t of G.towers) {
    t.cd -= dt;
    if (t.cd > 0) continue;
    const s = towerStats(t), e = pickTarget(t, s.range);
    if (!e) continue;
    t.cd = s.rate;
    t.ang = Math.atan2(e.y - t.y, e.x - t.x);
    t.fire = 0.12;
    if (t.type === 'thorn') {
      for (const tg of s.multi ? pickTargets(t, s.range, s.multi) : [e])
        G.proj.push({ kind: 'thorn', x: t.x, y: t.y - 18, target: tg, tx: tg.x, ty: tg.y, speed: s.shred ? 520 : 430,
          dmg: s.dmg, slow: s.slow || 0, shred: s.shred || 0, big: !!s.shred, crit: s.crit || 0 });
      sfx('thorn');
    } else if (t.type === 'spore' || t.type === 'fire') {
      G.proj.push({ kind: t.type, sx: t.x, sy: t.y - 20, x: t.x, y: t.y - 20, tx: e.x, ty: e.y, t: 0, dur: 0.55,
        dps: s.dps, dmg: s.dmg, burn: s.burn || 0, radius: s.radius, slow: s.slow || 0, cloud: s.cloud });
      sfx(t.type);
    } else {
      const chain = [e];
      for (let k = 0; k < (s.chain || 0); k++) {
        const last = chain[chain.length - 1];
        let nb = null, nd = 95;
        for (const o of G.enemies) if (!o.dead && !o.burrowT && !chain.includes(o) && dist(o, last) < nd) { nd = dist(o, last); nb = o; }
        if (!nb) break;
        chain.push(nb);
      }
      const pts = [{ x: t.x, y: t.y - 26 }];
      chain.forEach((c, i) => { pts.push({ x: c.x, y: c.y - 6 }); hurt(c, s.dmg * (i ? 0.6 : 1), 'magic'); });
      if (s.stun) e.stun = Math.max(e.stun, s.stun);
      G.beams.push({ pts, t: s.stun ? 0.4 : 0.25, max: s.stun ? 0.4 : 0.25, wide: !!s.stun });
      chain.forEach(c => spark(c.x, c.y - 6, '#bff4ff', 5));
      if (s.stun) ring(e.x, e.y, 4, 34, '140,230,255', 0.3, 3);
      sfx('beam');
    }
  }
}

function updateProjectiles(dt) {
  for (const p of G.proj) {
    if (p.kind === 'thorn') {
      if (p.target && !p.target.dead) { p.tx = p.target.x; p.ty = p.target.y - 6; }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = p.speed * dt;
      p.ang = Math.atan2(dy, dx);
      if (d <= step + 4) {
        p.done = true;
        if (p.target && !p.target.dead) {
          if (p.shred) p.target.shred = Math.max(p.target.shred || 0, p.shred);
          let dmg = p.dmg;
          if (p.crit && Math.random() < p.crit) { dmg *= 2.5; addText(p.target.x, p.target.y - 24, 'Kritik!', '#ff5a5a'); }
          hurt(p.target, dmg, 'phys');
          spark(p.tx, p.ty, p.big ? '#e08aff' : '#e4ff9a', p.big ? 8 : 4);
          if (p.slow) { p.target.slow = p.slow; p.target.slowT = 1.5; }
        }
      } else { p.x += dx / d * step; p.y += dy / d * step; }
    } else {
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.x = p.sx + (p.tx - p.sx) * k;
      p.y = p.sy + (p.ty - p.sy) * k - Math.sin(k * Math.PI) * 40;
      if (k >= 1) {
        p.done = true;
        if (p.kind === 'spore') {
          G.clouds.push({ kind: 'poison', x: p.tx, y: p.ty, r: p.radius, dps: p.dps, slow: p.slow, t: p.cloud || 2.2, max: p.cloud || 2.2 });
          puff(p.tx, p.ty, '#9be05a', 10, 40);
          ring(p.tx, p.ty, 4, p.radius, '150,230,90', 0.4, 2);
        } else {
          const at = { x: p.tx, y: p.ty };
          for (const e of G.enemies) if (dist(e, at) < p.radius) hurt(e, p.dmg, 'fire');
          if (p.burn) G.clouds.push({ kind: 'fire', x: p.tx, y: p.ty, r: p.radius * 0.8, dps: p.burn, t: 2.5, max: 2.5 });
          puff(p.tx, p.ty, '#ff8a2a', 14, 80);
          ring(p.tx, p.ty, 6, p.radius, '255,150,50', 0.35, 4);
          shake(1.5);
          puff(p.tx, p.ty, '#ffd34d', 6, 50);
        }
      }
    }
  }
  G.proj = G.proj.filter(p => !p.done);
  for (const c of G.clouds) {
    c.t -= dt;
    for (const e of G.enemies) {
      if (e.dead || dist(e, c) >= c.r) continue;
      if (c.kind === 'fire') hurt(e, c.dps * dt, 'fire');
      else {
        e.poison = Math.max(e.poison, c.dps); e.poisonT = 3;
        if (c.slow) { e.slow = Math.max(e.slowT > 0 ? e.slow : 0, c.slow); e.slowT = 0.5; }
      }
    }
  }
  G.clouds = G.clouds.filter(c => c.t > 0);
}

function hurt(e, amt, kind) {
  if (e.dead || (e.burrowT > 0 && kind !== 'spell')) return;
  let m = 1;
  const armor = Math.max(0, e.def.armor - (e.shred || 0));
  if (kind === 'phys') m = 1 - armor;
  else if (kind === 'magic') m = 1 - e.def.mres;
  else if (kind === 'fire') m = 1 - armor * 0.5;
  else if (kind === 'spell') m = 1 - e.def.mres;
  let a = amt * m;
  if (e.shield > 0) { const s = Math.min(e.shield, a); e.shield -= s; a -= s; }
  e.hp -= a;
  if (kind !== 'poison' && amt >= 1) e.flash = 0.08;
  if (e.hp <= 0) kill(e);
}

function kill(e) {
  e.dead = true;
  const loot = Math.round(e.def.gold * (1 + 0.08 * sk('g2')));
  G.gold += loot;
  stat('kills', 1);
  ach('first');
  if (save.stats.kills >= 500) ach('k500');
  if (save.stats.kills >= 2000) ach('k2000');
  if (e.def.r > 14) ach('boss');
  if (G.gold >= 1000) ach('rich');
  G.mana = Math.min(MANA_MAX, G.mana + e.def.mana);
  addText(e.x, e.y - 14, `+${loot}`, '#ffd34d');
  if (sk('s5') && e.poisonT > 0 && e.poison > 0)
    G.clouds.push({ kind: 'poison', x: e.x, y: e.y, r: 40, dps: e.poison * 0.7, t: 2, max: 2 });
  puff(e.x, e.y, e.def.color, 10, 70);
  G.souls.push({ x: e.x, y: e.y - 6, t: 1.3, max: 1.3, ph: Math.random() * 6, big: e.def.r > 14 });
  flyCoins(e.x, e.y, Math.min(6, 1 + Math.floor(loot / 8)));
  if (e.def.r > 14) { shake(9); flash('#fff4d0', 0.4, 0.3); ring(e.x, e.y, 10, 120, '255,220,120', 0.7, 5); }
  if (e.carry) {
    G.drops.push({ x: e.x, y: e.y, t: DROP_TIME - 2 * sk('g4') });
    addText(e.x, e.y - 28, 'Kristal düştü!', '#c79bff');
  }
  sfx('die');
}

function puff(x, y, c, n, sp) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * sp;
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, t: 0.5 + Math.random() * 0.4, max: 0.9, c, s: 2 + Math.random() * 2 });
  }
}
// ---------- ortam canlılığı: ateş böcekleri, közler, bataklık kabarcıkları ----------
function randTile(t) {
  const list = G.byType[t];
  return list.length ? list[Math.floor(Math.random() * list.length)] : null;
}
function updateAmbient(dt) {
  const count = k => G.amb.reduce((n, a) => n + (a.k === k), 0);
  if (count('fly') < 16 && Math.random() < dt * 4) {
    const tl = randTile(Math.random() < 0.5 ? GRASS : SWAMP);
    if (tl) G.amb.push({ k: 'fly', x: tl.x * TILE + Math.random() * TILE, y: tl.y * TILE + Math.random() * TILE, vx: 0, vy: 0, t: 5 + Math.random() * 4, max: 9, ph: Math.random() * 6 });
  }
  if (count('ember') < 30 && Math.random() < dt * 10) {
    const tl = randTile(ASH);
    if (tl) G.amb.push({ k: 'ember', x: tl.x * TILE + Math.random() * TILE, y: tl.y * TILE + Math.random() * TILE, vx: (Math.random() - 0.5) * 8, vy: -15 - Math.random() * 20, t: 1.6, max: 1.6 });
  }
  if (count('bub') < 10 && Math.random() < dt * 5) {
    const tl = randTile(SWAMP);
    if (tl && !G.tree[tl.y][tl.x]) G.amb.push({ k: 'bub', x: tl.x * TILE + 8 + Math.random() * 24, y: tl.y * TILE + 8 + Math.random() * 24, vx: 0, vy: 0, t: 1.2, max: 1.2 });
  }
  for (const a of G.amb) {
    a.t -= dt;
    if (a.k === 'fly') {
      a.vx += (Math.random() - 0.5) * 40 * dt; a.vy += (Math.random() - 0.5) * 40 * dt;
      a.vx *= 0.98; a.vy *= 0.98;
    }
    a.x += a.vx * dt; a.y += a.vy * dt;
  }
  G.amb = G.amb.filter(a => a.t > 0);
}
function drawAmbient() {
  for (const a of G.amb) {
    const life = a.t / a.max;
    if (a.k === 'fly') {
      const fl = (0.5 + 0.5 * Math.sin(G.time * 4 + a.ph)) * Math.min(1, a.t, (a.max - a.t) * 2);
      ctx.fillStyle = `rgba(220,255,120,${0.18 * fl})`; circle(a.x, a.y, 7);
      ctx.fillStyle = `rgba(240,255,170,${0.9 * fl})`; circle(a.x, a.y, 1.8);
    } else if (a.k === 'ember') {
      ctx.fillStyle = `rgba(255,${120 + life * 100},40,${life})`; circle(a.x, a.y, 1.4);
    } else {
      ctx.strokeStyle = `rgba(160,210,180,${life * 0.7})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(a.x, a.y, 1 + (1 - life) * 4, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

// kenar karartması ve sürüklenen sis, bir kez hazırlanır
const vignette = document.createElement('canvas');
vignette.width = W; vignette.height = H;
{
  const v = vignette.getContext('2d'), g = v.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.72);
  g.addColorStop(0, 'rgba(10,5,20,0)'); g.addColorStop(1, 'rgba(10,5,20,.6)');
  v.fillStyle = g; v.fillRect(0, 0, W, H);
}
const fogSprite = document.createElement('canvas');
fogSprite.width = 256; fogSprite.height = 128;
{
  const f = fogSprite.getContext('2d');
  for (let i = 0; i < 5; i++) {
    const x = 50 + i * 40, y = 64 + Math.sin(i * 2) * 14, g = f.createRadialGradient(x, y, 0, x, y, 60);
    g.addColorStop(0, 'rgba(220,210,240,.16)'); g.addColorStop(1, 'rgba(220,210,240,0)');
    f.fillStyle = g; f.fillRect(0, 0, 256, 128);
  }
}
function drawFog() {
  for (let i = 0; i < 4; i++) {
    const x = ((G.time * (6 + i * 3) + i * 300) % (W + 400)) - 300, y = 60 + i * 150 + Math.sin(G.time * 0.2 + i) * 20;
    ctx.drawImage(fogSprite, x, y, 400, 200);
  }
}

function addText(x, y, s, c) { G.texts.push({ x, y, s, c, t: 1.2 }); }

// ---------- efektler ----------
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');
// genişleyen (ya da daralan) şok halkası; col "r,g,b"
function ring(x, y, r0, r1, col, dur = 0.5, w = 3) { G.rings.push({ x, y, r0, r1, col, t: dur, max: dur, w }); }
function shake(p) { if (save.settings.shake) G.shake = Math.max(G.shake, p); }
function flash(color, a, dur) { G.flashFx = { color, a, t: dur, max: dur }; }
function spark(x, y, c, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 80;
    G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0.25, max: 0.25, c, s: 1.5 });
  }
}
// altın para HUD'daki altın sayacına uçar
const GOLD_HUD = { x: 29, y: 27 };
function flyCoins(x, y, n) {
  for (let i = 0; i < n; i++)
    G.coins.push({ sx: x, sy: y, cx: x + (Math.random() - 0.5) * 90, cy: y - 50 - Math.random() * 50, t: -i * 0.06, dur: 0.65 + Math.random() * 0.15 });
}
let lastBump = 0;
function bumpGold() {
  const now = performance.now();
  if (now - lastBump < 90) return;
  lastBump = now;
  const el = $('gold').parentElement;
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  sfx('coin');
}
function updateFx(dt) {
  G.shake = Math.max(0, G.shake - dt * 30);
  if (G.flashFx && (G.flashFx.t -= dt) <= 0) G.flashFx = null;
  G.bossWarn = Math.max(0, G.bossWarn - dt);
  G.rings = G.rings.filter(r => (r.t -= dt) > 0);
  G.pillars = G.pillars.filter(p => (p.t -= dt) > 0);
  for (const s of G.souls) { s.t -= dt; s.y -= 34 * dt; }
  G.souls = G.souls.filter(s => s.t > 0);
  for (const c of G.coins) { c.t += dt; if (c.t >= c.dur && !c.done) { c.done = true; bumpGold(); } }
  G.coins = G.coins.filter(c => !c.done);
  for (const f of G.flyGems) f.t += dt;
  G.flyGems = G.flyGems.filter(f => f.t < f.dur);
  for (const t of G.towers) if (t.rise > 0) t.rise = Math.max(0, t.rise - dt * 2.5);
  // kristal taşıyanların ardında mor iz, mahzende ışıltı
  for (const e of G.enemies)
    if (e.carry && Math.random() < dt * 14)
      G.parts.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y - 18, vx: 0, vy: -12, t: 0.6, max: 0.6, c: '#c79bff', s: 1.8 });
  if (G.crystals > 0 && Math.random() < dt * 4) {
    const a = Math.random() * Math.PI * 2;
    G.parts.push({ x: G.vault.x + Math.cos(a) * 22, y: G.vault.y + Math.sin(a) * 12, vx: 0, vy: -20, t: 0.9, max: 0.9, c: '#efe0ff', s: 1.4 });
  }
}

function drawRings() {
  for (const r of G.rings) {
    const k = 1 - r.t / r.max, rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k));
    ctx.strokeStyle = `rgba(${r.col},${(1 - k) * 0.85})`;
    ctx.lineWidth = r.w * (1 - k * 0.6);
    ctx.beginPath(); ctx.ellipse(r.x, r.y, rad, rad * 0.7, 0, 0, Math.PI * 2); ctx.stroke();
  }
}
function drawPillars() {
  for (const p of G.pillars) {
    const k = p.t / p.max, w = 18 * Math.sin(k * Math.PI);
    const g = ctx.createLinearGradient(0, p.y - 140, 0, p.y + 10);
    g.addColorStop(0, `rgba(${p.c},0)`); g.addColorStop(1, `rgba(${p.c},${0.55 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(p.x - w / 2, p.y - 140, w, 150);
    ctx.fillStyle = `rgba(255,255,255,${0.5 * k})`;
    ctx.fillRect(p.x - w / 6, p.y - 140, w / 3, 150);
  }
}
function drawSouls() {
  for (const s of G.souls) {
    const k = s.t / s.max, sz = s.big ? 1.8 : 1, x = s.x + Math.sin(G.time * 5 + s.ph) * 4;
    ctx.globalAlpha = Math.min(1, k * 1.5) * 0.7;
    ctx.fillStyle = '#e8f4ff';
    ctx.beginPath();
    ctx.arc(x, s.y, 5 * sz, Math.PI, 0);
    ctx.lineTo(x + 5 * sz, s.y + 6 * sz);
    for (let i = 0; i < 3; i++) ctx.lineTo(x + (3 - i * 3.3) * sz, s.y + (i % 2 ? 6 : 9) * sz);
    ctx.lineTo(x - 5 * sz, s.y + 6 * sz);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a5a7a';
    circle(x - 1.8 * sz, s.y - 0.5 * sz, 0.9 * sz); circle(x + 1.8 * sz, s.y - 0.5 * sz, 0.9 * sz);
  }
  ctx.globalAlpha = 1;
}
function drawCoinsAndGems() {
  for (const c of G.coins) {
    if (c.t < 0) continue;
    const k = Math.min(1, c.t / c.dur), e = k * k, u = 1 - e;
    const x = u * u * c.sx + 2 * u * e * c.cx + e * e * GOLD_HUD.x, y = u * u * c.sy + 2 * u * e * c.cy + e * e * GOLD_HUD.y;
    const w = Math.abs(Math.cos(G.time * 12 + c.sx)) * 5 + 1;
    ctx.fillStyle = '#8a5e1a'; ctx.beginPath(); ctx.ellipse(x, y + 0.8, w, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(x, y, w, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6c0'; circle(x - w * 0.3, y - 1.5, 1.2);
  }
  for (const f of G.flyGems) {
    const k = f.t / f.dur, tx = f.e ? f.e.x : f.tx, ty = f.e ? f.e.y - 24 : f.ty;
    const x = f.sx + (tx - f.sx) * k, y = f.sy + (ty - f.sy) * k - Math.sin(k * Math.PI) * 50;
    drawGem(x, y, 7, false);
  }
}
function drawScreenFx() {
  if (G.bossWarn > 0) {
    const a = Math.min(1, G.bossWarn) * (0.28 + 0.16 * Math.sin(G.time * 10));
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, W * 0.65);
    g.addColorStop(0, 'rgba(200,20,10,0)'); g.addColorStop(1, `rgba(200,20,10,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (G.flashFx) {
    ctx.globalAlpha = G.flashFx.a * (G.flashFx.t / G.flashFx.max);
    ctx.fillStyle = G.flashFx.color; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

function checkEnd() {
  if (G.over) return;
  const carried = G.enemies.filter(e => e.carry).length;
  if (G.crystals + G.drops.length + carried === 0) { G.over = true; const g = G; setTimeout(() => G === g && showResult(false), 600); return; }
  if (G.wave >= G.waves.length && !G.spawnQ.length && !G.enemies.length) {
    G.crystals += G.drops.length; G.drops = [];
    G.over = true;
    const g = G; setTimeout(() => G === g && showResult(true), 600);
  }
}

// ---------- oyuncu eylemleri ----------
function towerAt(tx, ty) { return G.towers.find(t => t.tx === tx && t.ty === ty); }

function build(type, tx, ty) {
  const T = TOWERS[type], c = priceOf(type, T.levels[0].cost);
  if (G.gold < c || G.tree[ty][tx] || G.terr[ty][tx] !== T.terrain || towerAt(tx, ty)) return;
  G.gold -= c;
  const t = { type, level: 0, branch: null, mode: 'first', spent: c, tx, ty, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 + 4, cd: 0, ang: 0, pop: 0.4, fire: 0 };
  t.rise = 1;
  G.towers.push(t);
  if (G.towers.length >= 15) ach('builder');
  G.sel = { kind: 'tower', t };
  puff(t.x, t.y + 8, '#a88a5a', 16, 60);
  ring(t.x, t.y + 8, 6, 34, '200,170,120', 0.45, 3);
  sfx('build');
}
// temel seviyeler (1→2→3) ve dalın 2. kademesi; 3. seviyeden dala geçiş specialize ile olur
function upgrade(t) {
  if (t.level === 2 || t.level >= MAX_LEVEL) return;
  const c = priceOf(t.type, nextCost(t));
  if (G.gold < c) return;
  G.gold -= c; t.spent += c; t.level++; t.pop = 0.5;
  const col = t.level >= 3 ? hexRgb(BRANCHES[t.type][t.branch].color) : '255,226,122';
  puff(t.x, t.y - 10, t.level >= 3 ? BRANCHES[t.type][t.branch].color : '#ffe27a', 18, 70);
  G.pillars.push({ x: t.x, y: t.y, t: 0.9, max: 0.9, c: col });
  ring(t.x, t.y + 6, 6, t.level >= 3 ? 70 : 44, col, 0.6, 4);
  if (t.level === MAX_LEVEL) { flash(BRANCHES[t.type][t.branch].color, 0.15, 0.3); addText(t.x, t.y - 44, 'En güçlü hâl!', BRANCHES[t.type][t.branch].color); }
  sfx('build');
}
function specialize(t, b) {
  const B = BRANCHES[t.type][b];
  const c = priceOf(t.type, B.ranks[0].cost);
  if (t.level !== 2 || G.gold < c) return;
  G.gold -= c; t.spent += c; t.level = 3; t.branch = b; t.pop = 0.5;
  ach('spec');
  puff(t.x, t.y - 10, B.color, 24, 90);
  G.pillars.push({ x: t.x, y: t.y, t: 1.1, max: 1.1, c: hexRgb(B.color) });
  ring(t.x, t.y + 6, 6, 70, hexRgb(B.color), 0.7, 4);
  flash(B.color, 0.12, 0.3);
  addText(t.x, t.y - 40, B.name + '!', B.color);
  sfx('wave');
}
function cycleMode(t) {
  const i = TARGET_MODES.findIndex(m => m.id === (t.mode || 'first'));
  t.mode = TARGET_MODES[(i + 1) % TARGET_MODES.length].id;
}
function sellValue(t) {
  return Math.floor(t.spent * (sk('g5') ? 0.85 : 0.6));
}
function sell(t) {
  G.gold += sellValue(t);
  G.towers.splice(G.towers.indexOf(t), 1);
  G.sel = { kind: 'tile', tx: t.tx, ty: t.ty };
  puff(t.x, t.y, '#ffd34d', 10, 50);
  sfx('coin');
}

function castSpell(i, x, y) {
  const S = SPELLS[i];
  const cost = spellCost(i);
  if (G.mana < cost || G.cds[i] > 0) { sfx('bad'); return false; }
  if (S.id === 'shape') {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
    if (G.tree[ty][tx]) G.tree[ty][tx] = false;
    else if (G.terr[ty][tx] < PATH && !towerAt(tx, ty)) G.terr[ty][tx] = (G.terr[ty][tx] + 1) % (G.L.terrains || 3);
    else { addText(x, y, 'Burada olmaz', '#ff9a9a'); sfx('bad'); return false; }
    renderTerrain();
    puff(tx * TILE + 20, ty * TILE + 20, '#b8a07a', 14, 50);
    G.sel = { kind: 'tile', tx, ty };
    sfx('build');
  } else if (S.id === 'bolt') {
    const strike = k => {
      let slain = 0;
      for (const e of G.enemies) if (!e.dead && dist(e, { x, y }) < S.radius) { hurt(e, 110 * k * (1 + 0.2 * sk('m2')), 'spell'); e.stun = 0.8; if (e.dead) slain++; }
      if (slain >= 5) ach('storm');
      G.bolts.push({ x, y, r: S.radius, t: 0.4, max: 0.4, seed: Math.random() * 1000 });
      puff(x, y, '#bfe2ff', 20, 120);
      ring(x, y, 8, S.radius + 20, '200,230,255', 0.45, 5);
      shake(7 * k); flash('#dcefff', 0.3 * k, 0.2);
      sfx('bolt');
    };
    strike(1);
    if (sk('m5')) G.delayed.push({ t: 0.45, fn: () => strike(0.5) });
  } else if (S.id === 'fear') {
    let dropped = 0;
    for (const e of G.enemies) {
      if (dist(e, { x, y }) >= S.radius || e.def.r > 14) continue;  // patronlar korkmaz
      e.fear = 2.5;
      if (e.carry) {
        e.carry = false; dropped++;
        G.drops.push({ x: e.x, y: e.y, t: DROP_TIME - 2 * sk('g4'), lock: 1.5 });
        addText(e.x, e.y - 28, 'Düşürdü!', '#c79bff');
      }
    }
    if (dropped) { stat('scared', dropped); if (save.stats.scared >= 5) ach('scare'); }
    ring(x, y, 6, S.radius + 20, '200,150,255', 0.6, 5);
    ring(x, y, 6, S.radius, '120,60,200', 0.45, 3);
    puff(x, y, '#c9a0ff', 26, 110);
    shake(4);
    sfx('steal');
  } else {
    for (const e of G.enemies) if (dist(e, { x, y }) < S.radius) e.root = 3 + 0.7 * sk('m3');
    puff(x, y, '#6fdc5a', 24, 80);
    ring(x, y, S.radius + 10, 6, '110,220,90', 0.6, 4);
    ring(x, y, 6, S.radius, '110,220,90', 0.5, 2);
    sfx('root');
  }
  G.mana -= cost;
  G.cds[i] = S.cd;
  return true;
}

function callWave() {
  if (G.over) return;
  if (G.wave === 0) { startWave(); return; }
  if (G.waveTimer > 0) {
    const bonus = Math.ceil(G.waveTimer) * 2;
    G.gold += bonus;
    stat('early', 1);
    if (save.stats.early >= 10) ach('early');
    addText(W / 2, 60, `Erken çağrı +${bonus} 💰`, '#ffd34d');
    sfx('coin');
    startWave();
  }
}

// ---------- girdi ----------
function evPos(ev) {
  const r = cv.getBoundingClientRect();
  return { x: (ev.clientX - r.left - VIEW.ox) / VIEW.sc, y: (ev.clientY - r.top - VIEW.oy) / VIEW.sc };
}
cv.addEventListener('mousemove', ev => { if (G) G.hover = evPos(ev); });
cv.addEventListener('mouseleave', () => { if (G) G.hover = null; });
cv.addEventListener('contextmenu', ev => { ev.preventDefault(); if (G) { G.spell = null; G.sel = null; } });
cv.addEventListener('click', ev => {
  if (!G || G.demo || G.over) return;
  const p = evPos(ev);
  if (G.buildType && G.spell === null) {
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;
    const n = G.towers.length;
    build(G.buildType, tx, ty);
    if (G.towers.length > n) G.buildType = null;
    else sfx('bad');
    return;
  }
  if (G.spell !== null) {
    if (castSpell(G.spell, p.x, p.y) && !ev.shiftKey) G.spell = null;
    return;
  }
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;
  const t = towerAt(tx, ty);
  if (t) G.sel = { kind: 'tower', t };
  else if (G.terr[ty][tx] < PATH) G.sel = { kind: 'tile', tx, ty };
  else G.sel = null;
});

document.addEventListener('keydown', ev => {
  if (!G || G.demo) return;
  const k = ev.key.toLowerCase();
  if (k >= '1' && k <= String(SPELLS.length)) selectSpell(+k - 1);
  else if (k === 'escape') { G.spell = null; G.sel = null; }
  else if (k === ' ') { ev.preventDefault(); togglePause(); }
  else if (k === 'f') toggleSpeed();
  else if (k === 'n') callWave();
  else if (k === 'u' && G.sel && G.sel.kind === 'tower') upgrade(G.sel.t);
  else if (k === 't' && G.sel && G.sel.kind === 'tower') cycleMode(G.sel.t);
});

function selectSpell(i) {
  if (G.over) return;
  G.spell = G.spell === i ? null : i;
  if (G.spell !== null) G.sel = null;
}
function togglePause() {
  if (!G || G.demo || G.over) return;
  if (overlayOpen()) { if (G.paused) { G.paused = false; hideOverlay(); } return; }
  G.paused = true;
  showPauseMenu();
}
function showPauseMenu() {
  showOverlay(`<div class="panel"><h2>Duraklatıldı</h2><div class="divider">✦ ${G.L.name} · ${G.diff.name} ✦</div><div class="col">
    <button onclick="togglePause()">Devam Et</button>
    <button onclick="startLevel(G.li, G.tier)">Yeniden Başla</button>
    <button onclick="showHelp()">Nasıl Oynanır</button>
    <button onclick="showSettings()">Ayarlar</button>
    <button onclick="showWorld()">Haritaya Dön</button></div></div>`);
}
function toggleSpeed() { if (G && !G.demo) G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 3 : 1; }

$('nextWave').onclick = () => G && !G.demo && callWave();
$('speedBtn').onclick = toggleSpeed;
$('pauseBtn').onclick = togglePause;
$('menuBtn').onclick = togglePause;
function toggleMute() {
  muted = !muted;
  applyAudio();
  $('muteBtn').textContent = muted ? '🔇' : '🔊';
}
$('muteBtn').onclick = toggleMute;

// büyü butonları
$('spells').innerHTML = SPELLS.map((s, i) =>
  `<button class="spell" data-i="${i}" title="${s.name} (${s.cost} mana) — ${s.desc}">${s.icon}<span class="key">${i + 1}</span><span class="cost">${s.cost}</span><span class="cd"></span></button>`).join('');
const spellBtns = [...document.querySelectorAll('.spell')];
spellBtns.forEach(b => b.onclick = () => G && !G.demo && selectSpell(+b.dataset.i));

// bilgi paneli (sadece içerik değiştiğinde yeniden çizilir, tıklama kaybolmasın)
let lastPanel = '', lastPreview = '', lastToast = '';
$('info').addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (!b || !G || !G.sel) return;
  const a = b.dataset.act;
  if (a === 'build') build(b.dataset.type, G.sel.tx, G.sel.ty);
  else if (a === 'up') upgrade(G.sel.t);
  else if (a === 'sell') sell(G.sel.t);
  else if (a === 'branch') specialize(G.sel.t, +b.dataset.b);
  else if (a === 'mode') cycleMode(G.sel.t);
});
function statLine(type, s) {
  if (type === 'spore') return `Zehir ${s.dps}/sn · Alan ${s.radius} · Menzil ${s.range}${s.slow ? ` · Yavaşlatma %${s.slow * 100}` : ''}`;
  if (type === 'fire') return `Alan hasarı ${s.dmg} · Alan ${s.radius} · Atış ${(1 / s.rate).toFixed(1)}/sn · Menzil ${s.range}${s.burn ? ` · Yanan zemin ${s.burn}/sn` : ''}`;
  let r = `Hasar ${s.dmg} · Atış ${(1 / s.rate).toFixed(1)}/sn · Menzil ${s.range}`;
  if (s.slow) r += ` · Yavaşlatma %${s.slow * 100}`;
  if (s.chain) r += ` · Işın ${s.chain} kez seker`;
  if (s.multi) r += ` · ${s.multi} hedef`;
  if (s.shred) r += ` · Zırh eritme %${s.shred * 100}`;
  if (s.stun) r += ` · Sersemletme ${s.stun} sn`;
  return r;
}
// istatistik değişimlerini "Hasar 16 → 26" biçiminde yazar
const STAT_LABELS = [['dmg', 'Hasar'], ['dps', 'Zehir/sn'], ['rate', 'Atış/sn'], ['range', 'Menzil'], ['radius', 'Alan'],
  ['multi', 'Hedef'], ['chain', 'Seken'], ['slow', 'Yavaşlatma %'], ['shred', 'Zırh eritme %'], ['stun', 'Sersemletme sn'], ['burn', 'Yanma/sn']];
function statDiff(a, b) {
  const v = (o, k) => o[k] === undefined ? 0 : k === 'rate' ? +(1 / o[k]).toFixed(1) : k === 'slow' || k === 'shred' ? Math.round(o[k] * 100) : +(+o[k]).toFixed(1);
  return STAT_LABELS.filter(([k]) => v(a, k) !== v(b, k))
    .map(([k, l]) => `<span class="sd">${l} <i>${v(a, k)}</i> → <b>${v(b, k)}</b></span>`).join('');
}
function towerPanel(t) {
  const T = TOWERS[t.type], B = t.level >= 3 ? BRANCHES[t.type][t.branch] : null;
  const mode = TARGET_MODES.find(m => m.id === (t.mode || 'first')).name;
  const cur = towerStats(t), canUp = t.level !== 2 && t.level < MAX_LEVEL;
  const tierName = B ? `Kademe ${t.level === 3 ? 'I' : 'II'}` : `Seviye ${t.level + 1}`;
  let body = `<div class="ps">${statLine(t.type, cur)}</div>`;
  if (canUp) {
    const nl = t.level + 1, nxt = modStats(t.type, baseStats(t.type, nl, t.branch));
    body += `<div class="nextrow"><img src="${towerImg(t.type, nl, t.branch)}" alt=""><div class="diffs">${statDiff(cur, nxt)}</div></div>`;
  } else if (t.level === 2) {
    body += `<div class="branches">${BRANCHES[t.type].map((b, i) => {
      const c = priceOf(t.type, b.ranks[0].cost);
      return `<button class="branch" data-act="branch" data-b="${i}" ${G.gold < c ? 'disabled' : ''} style="--bc:${b.color}">
        <img src="${towerImg(t.type, 3, i)}" alt=""><span><b>${b.icon} ${b.name}</b> · ${c}💰<small>${b.desc}</small></span></button>`;
    }).join('')}</div>`;
  } else body += '<div class="ps maxed">✦ En güçlü hâline ulaştı ✦</div>';
  const title = B ? `${B.icon} ${B.name}` : T.name;
  const pips = Array.from({ length: 5 }, (_, i) => `<span class="pip ${i <= t.level ? 'on' : ''} ${i >= 3 ? 'br' : ''}"></span>`).join('');
  return `<div class="tprev"><img src="${towerImg(t.type, t.level, t.branch)}" alt=""></div>
    <div class="pinfo"><div class="pt">${title} <small>${tierName}</small> <span class="pips" style="--bc:${B ? B.color : '#ffd34d'}">${pips}</span></div>${body}</div>
    <div class="pbtns">${canUp ? `<button data-act="up" ${G.gold < priceOf(t.type, nextCost(t)) ? 'disabled' : ''}>⬆ Yükselt (${priceOf(t.type, nextCost(t))}💰)</button>` : ''}
    <button data-act="mode" class="mode" title="Hedef seçimi (T)">🎯 ${mode}</button>
    <button data-act="sell">Sat (+${sellValue(t)}💰)</button></div>`;
}

// kule görünümünün küçük resmi (panelde önizleme için); her tür/seviye/dal için bir kez çizilir
const towerImgCache = {};
function towerImg(type, level, branch) {
  const key = type + level + (level >= 3 ? branch : '');
  if (towerImgCache[key]) return towerImgCache[key];
  const c = document.createElement('canvas');
  c.width = 96; c.height = 96;
  const saved = ctx;
  ctx = c.getContext('2d');
  ctx.scale(1.05, 1.05);
  drawTower({ type, level, branch, x: 43, y: 72, pop: 0, fire: 0, tx: 0, rise: 0 });
  ctx = saved;
  return (towerImgCache[key] = c.toDataURL());
}
function panelHTML() {
  if (G.demo) return '';
  if (G.spell !== null) {
    const S = SPELLS[G.spell];
    return `<div class="pico">${S.icon}</div><div class="pinfo"><div class="pt">${S.name} <small>${spellCost(G.spell)} mana</small></div><div class="ps">${S.desc} Sağ tık / Esc: iptal · Shift+tık: tekrar kullan</div></div>`;
  }
  const s = G.sel;
  if (!s) return G.wave > 0 || G.towers.length || tut ? "" : `<div class="pico">🧙</div><div class="hint">Araziye tıkla ve kule kur: <b>Çimen</b> → Diken Totemi · <b>Bataklık</b> → Mantar Kulesi · <b>Kaya</b> → Kristal Dikeni${(G.L.terrains || 3) > 3 ? ' · <b>Kül</b> → Kül Kazanı' : ''}. Ağaçları ve arazi türünü <b>Toprak Dönüşümü (4)</b> ile değiştir.</div>`;
  if (s.kind === 'tower') return towerPanel(s.t);
  const { tx, ty } = s;
  if (G.tree[ty][tx]) return `<div class="hint">🌳 Ağaç — buraya inşa etmek için <b>Toprak Dönüşümü (4)</b> ile temizle.</div>`;
  const tt = G.terr[ty][tx], key = Object.keys(TOWERS).find(k => TOWERS[k].terrain === tt), T = TOWERS[key], c = priceOf(key, T.levels[0].cost);
  return `<div class="pico">${T.icon}</div><div class="pinfo"><div class="pt">${T.name} <small>${TERR_NAMES[tt]} arazisi</small></div>
    <div class="ps">${T.desc}</div><div class="ps">${statLine(key, modStats(key, T.levels[0]))}</div></div>
    <div class="pbtns"><button data-act="build" data-type="${key}" ${G.gold < c ? 'disabled' : ''}>İnşa Et (${c}💰)</button></div>`;
}

// ---------- HUD ----------
// sağdaki kule paneli: seçmek için tıkla, sonra karoya tıkla
let lastSide = '';
function pickTower(k) {
  if (!G || G.demo || G.over) return;
  G.buildType = G.buildType === k ? null : k;
  G.sel = null; G.spell = null;
  lastSide = '';
}
function renderSide() {
  const L = G.L, cards = Object.keys(TOWERS).map(k => {
    const T = TOWERS[k], avail = T.terrain !== ASH || (L.terrains || 3) > 3;
    const cost = priceOf(k, T.levels[0].cost), sel = G.buildType === k, poor = G.gold < cost;
    return { k, T, avail, cost, sel, poor };
  });
  const sig = cards.map(c => [c.k, c.avail, c.sel, c.poor].join(':')).join('|');
  if (sig === lastSide) return;
  lastSide = sig;
  $('sideCards').innerHTML = cards.map(c => `<div class="scard ${c.sel ? 'sel' : ''} ${c.poor ? 'poor' : ''} ${c.avail ? '' : 'na'}"
      onclick="pickTower('${c.k}')" title="${c.T.desc}">
      <span class="si">${c.T.icon}</span>
      <span class="sinfo"><b>${c.T.name}</b><small>${c.avail ? c.T.desc.split('.')[0] : 'Bu bölgede yok'}</small></span>
      <span class="sp">${c.cost}💰</span></div>`).join('');
}
// yeni görülen düşman: sol tarafta kart; tıklanınca özellikleri açılır
function showEnemyCard(type) {
  const e = ENEMIES[type], inf = ENEMY_INFO[type];
  $('enemyCard').innerHTML = `<button class="ec-x" onclick="hideEnemyCard()">✕</button>
    <div class="ec-head"><span class="ec-ico">${inf.icon}</span><div><small>Düşman</small><b>${e.name}</b></div></div>
    <div class="ec-stats">
      <span>❤ Can <b>${e.hp}</b></span><span>👟 Hız <b>${e.speed}</b></span>
      <span>🛡 Zırh <b>%${Math.round(e.armor * 100)}</b></span><span>✨ Büyü dir. <b>%${Math.round(e.mres * 100)}</b></span>
      <span>💰 Altın <b>${e.gold}</b></span><span>🔮 Mana <b>${e.mana}</b></span>
    </div>
    <p>${inf.tip}</p>`;
  $('enemyCard').classList.remove('hidden');
}
function hideEnemyCard() { $('enemyCard').classList.add('hidden'); }

function updateHUD() {
  if (!G) return;
  $('gold').textContent = G.gold;
  $('mana').textContent = Math.floor(G.mana);
  $('manaFill').style.width = (G.mana / MANA_MAX * 100) + '%';
  $('crystals').textContent = G.crystals;
  $('wave').textContent = G.L.endless ? `${G.wave} / ∞` : `${G.wave}/${G.waves.length}`;
  $('wprogFill').style.width = (G.L.endless ? 100 : (G.wave / G.waves.length) * 100) + '%';
  $('speedBtn').textContent = 'x' + G.speed;
  const nw = $('nextWave');
  if (G.wave === 0) { nw.textContent = 'Dalgayı Başlat ▶'; nw.disabled = G.demo; }
  else if (G.waveTimer > 0) { nw.textContent = `Sonraki dalga ${Math.ceil(G.waveTimer)}s (+${Math.ceil(G.waveTimer) * 2}💰)`; nw.disabled = false; }
  else { nw.textContent = G.wave >= G.waves.length ? 'Son dalga' : 'Dalga sürüyor'; nw.disabled = true; }
  spellBtns.forEach((b, i) => {
    b.classList.toggle('active', G.spell === i);
    b.disabled = G.demo || G.mana < spellCost(i);
    b.querySelector('.cost').textContent = spellCost(i);
    const pct = G.cds[i] / SPELLS[i].cd * 100;
    b.querySelector('.cd').style.background = pct > 0 ? `conic-gradient(rgba(0,0,0,.7) ${pct}%, transparent 0)` : 'none';
  });
  // sıradaki dalga önizlemesi
  let pv = '';
  if (!G.demo && G.wave < G.waves.length && !G.spawnQ.length) {
    const cnt = {};
    for (const g of G.waves[G.wave].groups) cnt[g.type] = (cnt[g.type] || 0) + g.count;
    pv = '<small>Sıradaki:</small>' + Object.entries(cnt).map(([k, n]) => `<span title="${ENEMIES[k].name}">${ENEMY_INFO[k].icon}<b>x${n}</b></span>`).join('');
  }
  if (pv !== lastPreview) { $('preview').innerHTML = pv; lastPreview = pv; }
  // yeni düşman kartı
  const tq = G.toasts[0], tk = tq ? (tq.ach ? 'a:' + tq.ach : tq.type) : '';
  if (tk !== lastToast) {
    if (tq && tq.ach) {
      const a = ACHS.find(x => x.id === tq.ach);
      $('toast').innerHTML = `<span class="ti">${a.icon}</span><div><small>🏆 Başarım · +1⭐</small><b>${a.name}</b><p>${a.desc}</p></div>`;
    } else if (tk) $('toast').innerHTML = `<span class="ti">${ENEMY_INFO[tk].icon}</span><div><small>Yeni düşman · tıkla</small><b>${ENEMIES[tk].name}</b><p>${ENEMY_INFO[tk].tip}</p></div>`;
    $('toast').onclick = tk && tk.indexOf('a:') !== 0 ? () => showEnemyCard(tk) : null;
    $('toast').classList.toggle('hidden', !tk);
    lastToast = tk;
  }
  renderSide();
  const html = panelHTML();
  if (html !== lastPanel) { $('info').innerHTML = html; $('info').classList.toggle('hidden', !html); lastPanel = html; }
}

// ---------- çizim ----------
function render() {
  // 1) tüm pencereyi bulanık arazi ile doldur
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bgCanvas, 0, 0, cv.width, cv.height);
  if (!G) return;
  // 2) oyun alanını ortalanmış, ölçeklenmiş olarak çiz
  ctx.setTransform(RES, 0, 0, RES, VIEW.ox * VIEW.px, VIEW.oy * VIEW.px);
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  ctx.drawImage(terrCanvas, -PAD.l, -PAD.t, W + PAD.l + PAD.r, H + PAD.t + PAD.b);
  if (!G) return;
  drawVault();
  for (const d of G.drops) drawGem(d.x, d.y - 4 + Math.sin(G.time * 5) * 2, 7, d.t < 3 && Math.floor(d.t * 6) % 2);

  // seçim ve menzil
  if (G.sel) {
    const s = G.sel;
    if (s.kind === 'tower') rangeCircle(s.t.x, s.t.y, towerStats(s.t).range);
    else {
      ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2;
      ctx.strokeRect(s.tx * TILE + 2, s.ty * TILE + 2, TILE - 4, TILE - 4);
      if (!G.tree[s.ty][s.tx]) {
        const key = Object.keys(TOWERS).find(k => TOWERS[k].terrain === G.terr[s.ty][s.tx]);
        if (key) rangeCircle(s.tx * TILE + 20, s.ty * TILE + 20, TOWERS[key].levels[0].range);
      }
    }
  }
  for (const c of G.clouds) {
    const a = Math.min(1, c.t / 0.5) * 0.35, fire = c.kind === 'fire';
    ctx.fillStyle = fire ? `rgba(230,90,30,${a})` : `rgba(130,210,80,${a})`;
    circle(c.x, c.y, c.r);
    ctx.fillStyle = fire ? `rgba(255,190,60,${a})` : `rgba(170,240,110,${a})`;
    for (let i = 0; i < 4; i++) circle(c.x + Math.cos(G.time * 2 + i * 1.6) * c.r * 0.45, c.y + Math.sin(G.time * 2 + i * 1.6) * c.r * 0.35, c.r * 0.35);
  }
  const drawables = [...G.towers.map(t => ({ y: t.y, f: () => drawTower(t) })), ...G.enemies.filter(e => !e.dead).map(e => ({ y: e.y, f: () => drawEnemy(e) }))];
  // seçili boş karoda kurulacak kulenin hayalet önizlemesi
  if (G.sel && G.sel.kind === 'tile' && !G.tree[G.sel.ty][G.sel.tx] && !towerAt(G.sel.tx, G.sel.ty)) {
    const key = Object.keys(TOWERS).find(k => TOWERS[k].terrain === G.terr[G.sel.ty][G.sel.tx]);
    if (key) {
      const ghost = { type: key, level: 0, tx: G.sel.tx, x: G.sel.tx * TILE + TILE / 2, y: G.sel.ty * TILE + TILE / 2 + 4, pop: 0, fire: 0 };
      drawables.push({ y: ghost.y, f: () => { ctx.globalAlpha = 0.5 + Math.sin(G.time * 5) * 0.12; drawTower(ghost); ctx.globalAlpha = 1; } });
    }
  }
  drawables.sort((a, b) => a.y - b.y).forEach(d => d.f());

  for (const p of G.proj) {
    if (p.kind === 'thorn') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang);
      ctx.fillStyle = p.big ? '#e08aff' : '#c9f08a'; if (p.big) ctx.scale(1.7, 1.4);
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -2.5); ctx.lineTo(-5, 2.5); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (p.kind === 'fire') {
      ctx.shadowColor = '#ff7a2a'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#ff7a2a'; circle(p.x, p.y, 7);
      ctx.fillStyle = '#ffe08a'; circle(p.x - 1, p.y - 1, 3.5);
      ctx.shadowBlur = 0;
      if (Math.random() < 0.5) G.parts.push({ x: p.x, y: p.y, vx: 0, vy: -20, t: 0.3, max: 0.3, c: '#ffa04a', s: 2 });
    } else {
      ctx.fillStyle = '#7ad04a'; circle(p.x, p.y, 6);
      ctx.fillStyle = '#c4f590'; circle(p.x - 2, p.y - 2, 2.5);
    }
  }
  for (const b of G.beams) {
    const a = b.t / b.max;
    ctx.lineCap = 'round';
    for (const [w, c] of [[b.wide ? 16 : 8, `rgba(90,220,255,${a * 0.35})`], [b.wide ? 6 : 3, `rgba(220,250,255,${a})`]]) {
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); b.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    }
  }
  for (const b of G.bolts) drawBolt(b);
  for (const p of G.parts) { ctx.globalAlpha = clamp(p.t / p.max, 0, 1); ctx.fillStyle = p.c; circle(p.x, p.y, p.s); }
  ctx.globalAlpha = 1;
  drawAmbient();
  drawRings();
  drawPillars();
  drawSouls();
  drawFog();
  // kenar karartması kaldırıldı: oyun alanının kenarında çerçeve gibi görünüyordu
  ctx.textAlign = 'center';
  for (const t of G.texts) {
    // yazılar büyük doğar, hızla normal boyuta oturur
    const pop = clamp((1.2 - t.t) / 0.15, 0, 1);
    ctx.font = `800 ${Math.round(14 * (1.5 - 0.5 * pop))}px Nunito, Segoe UI, sans-serif`;
    ctx.globalAlpha = clamp(t.t, 0, 1);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(t.s, t.x, t.y);
    ctx.fillStyle = t.c; ctx.fillText(t.s, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  if (typeof tutDraw === 'function') tutDraw();
  drawCoinsAndGems();
  drawScreenFx();

  // imleç
  if (G.hover && !G.demo && !G.over) {
    const h = G.hover;
    if (G.spell !== null) {
      const S = SPELLS[G.spell];
      if (S.radius) {
        ctx.fillStyle = S.id === 'bolt' ? 'rgba(150,200,255,.18)' : 'rgba(110,220,90,.18)';
        circle(h.x, h.y, S.radius);
        ctx.strokeStyle = S.id === 'bolt' ? '#bfe2ff' : '#8fe05a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(h.x, h.y, S.radius, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.strokeStyle = '#d9b77a'; ctx.lineWidth = 2;
        ctx.strokeRect(Math.floor(h.x / TILE) * TILE + 1, Math.floor(h.y / TILE) * TILE + 1, TILE - 2, TILE - 2);
      }
    } else {
      const tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE);
      if (tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS) {
        const pv = placementAt(tx, ty);
        if (pv) {
          ctx.fillStyle = pv.ok ? 'rgba(120,230,110,.22)' : 'rgba(230,70,60,.22)';
          ctx.fillRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);
          if (pv.ok) rangeCircle(tx * TILE + TILE / 2, ty * TILE + TILE / 2, pv.range);
        }
        ctx.strokeStyle = pv ? (pv.ok ? 'rgba(170,255,150,.8)' : 'rgba(255,140,120,.8)') : 'rgba(255,255,255,.35)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);
      }
    }
  }
  if (G.banner) {
    // yukarıdan düşüp yerine oturan, sonra sönen başlık; arkasında ışık şeridi
    const b = G.banner, age = (b.max || 2) - b.t, inK = clamp(age / 0.35, 0, 1);
    const ease = 1 - Math.pow(1 - inK, 3), y = H / 2 - 120 - (1 - ease) * 70, a = Math.min(1, b.t, inK * 1.5);
    ctx.globalAlpha = a * 0.55;
    const g = ctx.createLinearGradient(0, 0, W, 0);
    const col = b.boss ? '160,20,10' : '20,10,4';
    g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},.9)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, y - 42, W, 60);
    ctx.globalAlpha = a;
    ctx.save(); ctx.translate(W / 2, y); ctx.scale(1.25 - 0.25 * ease, 1.25 - 0.25 * ease);
    ctx.font = '900 50px Cinzel, Georgia, serif';
    ctx.lineWidth = 6; ctx.strokeStyle = '#1a0f06'; ctx.strokeText(b.s, 0, 0);
    ctx.fillStyle = b.boss ? '#ff8a6a' : '#ffe08a'; ctx.fillText(b.s, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function rangeCircle(x, y, r) {
  ctx.fillStyle = 'rgba(255,240,200,.1)'; circle(x, y, r);
  ctx.strokeStyle = 'rgba(255,236,180,.75)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
}

function drawGem(x, y, s, dim) {
  ctx.save(); ctx.translate(x, y);
  ctx.shadowColor = '#b06bff'; ctx.shadowBlur = dim ? 0 : 12;
  ctx.fillStyle = dim ? '#6a4a90' : '#b47cff';
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.75, -s * 0.2); ctx.lineTo(0, s); ctx.lineTo(-s * 0.75, -s * 0.2); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.3, -s * 0.2); ctx.lineTo(0, s * 0.2); ctx.lineTo(-s * 0.35, -s * 0.2); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawVault() {
  const { x, y } = G.vault;
  const g = ctx.createRadialGradient(x, y, 5, x, y, 60);
  g.addColorStop(0, 'rgba(150,80,255,.45)'); g.addColorStop(1, 'rgba(150,80,255,0)');
  ctx.fillStyle = g; circle(x, y, 60);
  ctx.fillStyle = '#1d1428'; ellipse(ctx, x, y + 4, 34, 22);
  ctx.strokeStyle = '#7a55a8'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(x, y + 4, 34, 22, 0, 0, Math.PI * 2); ctx.stroke();
  // rünler
  ctx.fillStyle = `rgba(200,150,255,${0.5 + Math.sin(G.time * 2) * 0.3})`;
  for (let i = 0; i < 6; i++) {
    const a = G.time * 0.4 + i * Math.PI / 3;
    circle(x + Math.cos(a) * 46, y + 4 + Math.sin(a) * 30, 2.5);
  }
  const n = Math.min(G.crystals, 12);
  for (let i = 0; i < n; i++) {
    const a = i * 2.4, r = 6 + (i % 4) * 5;
    drawGem(x + Math.cos(a) * r * 1.3, y + 4 + Math.sin(a) * r * 0.7 - 4, 8, false);
  }
  ctx.font = '800 15px Nunito, Segoe UI, sans-serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = '#1a0f26'; ctx.strokeText(`💎 ${G.crystals}`, x, y + 44);
  ctx.fillStyle = '#e3c8ff'; ctx.fillText(`💎 ${G.crystals}`, x, y + 44);
}

function star(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}

// ---------- kule çizimleri: her seviye ve her dal kendine özgü görünür ----------
function fpoly(pts, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath(); ctx.fill();
}
const glow = (col, b) => { ctx.shadowColor = col; ctx.shadowBlur = b; };
const noGlow = () => { ctx.shadowBlur = 0; };

function drawTower(t) {
  const s = 1 + Math.sin(t.pop * 10) * t.pop * 0.5, rise = t.rise || 0;
  const l = Math.min(t.level, 2), br = t.level >= 3 ? t.branch : -1, rk = t.level - 3;
  ctx.save(); ctx.translate(t.x, t.y + rise * 14); ctx.scale(s * (1 - rise * 0.3), s * (1 - rise * 0.8));
  // kaide: her kule türünün kendi zemini
  const [side, top, rim] = {
    thorn: ['#4a3420', '#6b4c2e', '#8a6a42'], spore: ['#26402e', '#35583c', '#4d7a4a'],
    crystal: ['#4d4a45', '#6e6a62', '#8e8a80'], fire: ['#2a1e1a', '#3e2c26', '#5a3e30'],
  }[t.type];
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ellipse(ctx, 2, 12, 19, 8);
  ctx.fillStyle = side; ellipse(ctx, 0, 9, 17, 8);
  ctx.fillRect(-17, 5, 34, 4);
  ctx.fillStyle = top; ellipse(ctx, 0, 5, 17, 8);
  ctx.strokeStyle = rim; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 5, 17, 8, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  if (br >= 0) {
    // dal: kaidenin etrafında dönen rün halkası (2. kademede çift)
    const col = BRANCHES[t.type][br].color;
    ctx.save();
    glow(col, 10);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    for (let k = 0; k <= rk; k++) {
      ctx.lineDashOffset = (k ? 1 : -1) * G.time * 12;
      ctx.beginPath(); ctx.ellipse(0, 6, 20 + k * 4, 9.5 + k * 2, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  ({ thorn: drawThorn, spore: drawSpore, crystal: drawCrystal, fire: drawFire })[t.type](t, l, br, rk);
  noGlow();
  // seviye yıldızları; dal kademeleri dalın renginde elmas
  const n = Math.min(t.level, 2) + 1 + (br >= 0 ? rk + 1 : 0);
  for (let i = 0; i < n; i++) {
    const sx = (i - (n - 1) / 2) * 7, sy = 15;
    ctx.fillStyle = '#2a1a08'; star(sx, sy + 0.8, 3.6);
    if (i < 3) { ctx.fillStyle = '#ffd34d'; star(sx, sy, 3.2); }
    else fpoly([[sx, sy - 3.6], [sx + 3, sy], [sx, sy + 3.6], [sx - 3, sy]], BRANCHES[t.type][br].color);
  }
  ctx.restore();
  if (t.fire > 0) t.fire = Math.max(0, t.fire - 1 / 60);
}

// --- Diken Totemi: kazık → oyma totem → kollu ulu totem → böğürtlen ağacı / zehirli mızrak
function thornSpikes(x, yTop, h, n, col, len = 8) {
  for (let i = 0; i < n; i++) {
    const yy = yTop + ((i + 0.5) * h) / n, sd = i % 2 ? 1 : -1;
    fpoly([[x + sd * 4, yy], [x + sd * (4 + len), yy - 4], [x + sd * 4, yy - 6]], col);
  }
}
function drawThorn(t, l, br, rk) {
  const T = G.time;
  ctx.fillStyle = '#5b3b22'; ellipse(ctx, 0, 6, 13, 7);
  if (br === 1) {
    // Zehirli Mızrak: kara ağaçtan dikilitaş, tepesinde mor mızrak uçları
    const h = 40 + rk * 8;
    fpoly([[-7, 6], [7, 6], [4, 6 - h], [-4, 6 - h]], '#3a2418');
    fpoly([[-7, 6], [-2, 6], [-1, 6 - h], [-4, 6 - h]], '#4e3020');
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-10, -8, 20, 3); ctx.fillRect(-9, -22, 18, 3);
    glow('#d06ae0', 8 + t.fire * 60);
    const tips = rk ? [[-6, -0.35], [6, 0.35]] : [[0, 0]];
    for (const [ox, a] of tips) {
      ctx.save(); ctx.translate(ox * 0.6, 6 - h); ctx.rotate(a);
      fpoly([[0, -18], [5, -2], [0, 2], [-5, -2]], '#c070e0');
      fpoly([[0, -18], [1.5, -2], [0, 1]], '#f0c8ff');
      ctx.restore();
    }
    noGlow();
    ctx.fillStyle = '#b050d0';
    for (let i = 0; i < 2 + rk * 2; i++) {
      const dy = ((T * 30 + i * 13) % 26);
      circle(-3 + (i % 3) * 3, 8 - h + dy, 1.4);
    }
    if (rk) { ctx.fillStyle = 'rgba(220,140,255,.8)'; for (const y of [-14, -28]) circle(0, y, 1.8); }
    return;
  }
  const h = [26, 32, 38][l] + (br === 0 ? 4 + rk * 4 : 0), w = [4, 6, 7][l];
  fpoly([[-w, 6], [w, 6], [w - 1, 6 - h], [-w + 1, 6 - h]], '#7a5230');
  fpoly([[-w, 6], [-w + 3, 6], [-w + 3.5, 6 - h], [-w + 1, 6 - h]], '#8f6440');
  thornSpikes(0, 6 - h + 4, h - 6, 4 + l * 2, '#9fd16a', 7 + l);
  if (l >= 1) {
    // oyma yüz
    const fy = 6 - h * 0.62;
    ctx.fillStyle = '#3a2416'; ctx.fillRect(-4, fy, 3, 2); ctx.fillRect(1, fy, 3, 2); ctx.fillRect(-2.5, fy + 5, 5, 2);
    if (l === 2) { glow('#9fff6a', 6); ctx.fillStyle = '#c8ff8a'; ctx.fillRect(-4, fy, 3, 2); ctx.fillRect(1, fy, 3, 2); noGlow(); }
  }
  const topY = 4 - h;
  if (l === 2) {
    // yan kollar
    const arm = br === 0 ? 15 + rk * 4 : 12;
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sd * 4, topY + 18); ctx.quadraticCurveTo(sd * arm, topY + 16, sd * arm, topY + 4); ctx.stroke();
    }
    ctx.lineCap = 'butt';
    // sarmaşık
    ctx.strokeStyle = '#4fa83a'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let y = 4; y > topY + 6; y -= 2) ctx.lineTo(Math.sin(y * 0.45) * (w + 1), y);
    ctx.stroke();
  }
  if (br === 0) {
    // Böğürtlen Yağmuru: kolların ucunda ve tepede mor böğürtlen salkımları
    const arm = 15 + rk * 4;
    const spots = [[0, topY - 2], [-arm, topY + 2], [arm, topY + 2]];
    if (rk) spots.push([-arm + 6, topY - 10], [arm - 6, topY - 10]);
    glow('#d070ff', 6 + t.fire * 50);
    for (const [bx, by] of spots)
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 ? '#7a2a9a' : '#a040c0';
        circle(bx + Math.cos(i * 1.3) * 3.2, by + Math.sin(i * 1.3) * 3.2, 2.8);
      }
    noGlow();
    for (const [bx, by] of spots) { ctx.fillStyle = '#6fbf4a'; fpoly([[bx, by - 4], [bx + 4, by - 9], [bx + 1, by - 3]], '#6fbf4a'); }
    if (rk) {
      // dönen diken halkası
      ctx.fillStyle = '#d9ff8a';
      for (let i = 0; i < 6; i++) {
        const a = T * 2 + (i * Math.PI) / 3;
        circle(Math.cos(a) * 20, topY + 10 + Math.sin(a) * 6, 1.6);
      }
    }
    return;
  }
  // yaprak tacı ve küre
  if (l >= 1) for (const sd of [-1, 0, 1]) fpoly([[0, topY + 2], [sd * 9, topY - 6 - (sd ? 0 : 4)], [sd * 3, topY - 1]], '#5fae3a');
  glow('#9fff6a', 8 + t.fire * 60);
  ctx.fillStyle = l === 2 ? '#d9ff8a' : '#7ee05a'; circle(0, topY, 5 + l);
  if (l === 2) {
    ctx.fillStyle = 'rgba(200,255,140,.6)';
    for (let i = 0; i < 3; i++) circle(Math.cos(T * 2 + i * 2.1) * 12, topY + Math.sin(T * 2 + i * 2.1) * 4, 1.5);
  }
}

// --- Mantar Kulesi: tek mantar → ikiz → ulu mantar → veba bahçesi / yapışkan sporlar
function mushroom(x, y, h, r, cap, spot, gl) {
  fpoly([[x - r * 0.28, y], [x + r * 0.28, y], [x + r * 0.2, y - h], [x - r * 0.2, y - h]], '#e9dcc0');
  ctx.fillStyle = '#c9b89a'; ctx.fillRect(x - r * 0.28, y - 3, r * 0.56, 3);
  if (gl) glow(gl, 10);
  ctx.fillStyle = cap;
  ctx.beginPath(); ctx.ellipse(x, y - h, r, r * 0.75, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(x - r, y - h - 1, r * 2, 3);
  noGlow();
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x - r, y - h + 1, r * 2, 2);
  ctx.fillStyle = spot;
  for (let i = 0; i < 4; i++) circle(x + Math.cos(i * 2.1 + 0.5) * r * 0.55, y - h - r * 0.32 - Math.abs(Math.sin(i * 2.1)) * r * 0.18, 1.6 + (i % 2) * 0.8);
}
function drawSpore(t, l, br, rk) {
  const T = G.time;
  if (br === 0) {
    // Veba Bahçesi: zehirli yeşil parlayan mantar kümesi ve yükselen dumanlar
    const g = '#9be05a';
    if (rk) mushroom(-12, 6, 14, 8, '#4a7a2a', '#d9ff9a', g);
    mushroom(-9, 6, 18, 10, '#5a8a2a', '#d9ff9a', g);
    mushroom(10, 6, 16, 9, '#5a8a2a', '#d9ff9a', g);
    mushroom(0, 6, 26 + rk * 4, 15 + rk * 2, '#6aa82a', '#e8ffb0', g);
    if (rk) {
      // kafatası deseni
      const y = 6 - 30 - 7;
      ctx.fillStyle = '#f4f0e0'; circle(0, y, 4.5); ctx.fillRect(-2.5, y + 2, 5, 3);
      ctx.fillStyle = '#2a3a1a'; circle(-1.6, y, 1.2); circle(1.6, y, 1.2);
    }
    for (let i = 0; i < 3 + rk * 2; i++) {
      const k = (T * 0.6 + i / (3 + rk * 2)) % 1;
      ctx.fillStyle = `rgba(150,230,90,${0.35 * (1 - k)})`;
      circle(Math.sin(i * 2 + T) * 8, -26 - k * 26, 4 + k * 6);
    }
    return;
  }
  if (br === 1) {
    // Yapışkan Sporlar: aşı sarısı şapka, sarkan ağ telleri ve damlalar
    const r = 17 + rk * 3, h = 24 + rk * 2;
    if (rk) {
      ctx.strokeStyle = 'rgba(240,235,210,.6)'; ctx.lineWidth = 1;
      for (const sd of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(sd * r, 6 - h); ctx.lineTo(sd * (r + 6), 8); ctx.stroke();
        for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(sd * (r + k * 1.5), 6 - h + k * 7); ctx.lineTo(sd * 4, 6 - h + k * 7 + 2); ctx.stroke(); }
      }
    }
    mushroom(0, 6, h, r, '#c89a2a', '#fff0b0', '#ffd34d');
    ctx.strokeStyle = 'rgba(245,240,215,.75)'; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const x = -r + 3 + i * ((r * 2 - 6) / 5), len = 6 + ((i * 7) % 5) + Math.sin(T * 3 + i) * 2;
      ctx.beginPath(); ctx.moveTo(x, 6 - h + 1); ctx.lineTo(x + Math.sin(T * 2 + i) * 1.5, 6 - h + len); ctx.stroke();
      ctx.fillStyle = '#f0d070'; circle(x, 6 - h + len + 1, 1.3);
    }
    return;
  }
  if (l >= 1) mushroom(-11, 6, 11, 7, '#7a2a6a', '#f6e9ff');
  if (l === 2) mushroom(11, 6, 13, 8, '#6a2a8a', '#f6e9ff');
  const cap = ['#a03a6a', '#8a2fa0', '#5e2a9a'][l];
  mushroom(0, 6, 18 + l * 5, 13 + l * 3, cap, '#f6e9ff', l === 2 ? '#c070ff' : null);
  if (l === 2) {
    ctx.fillStyle = `rgba(220,170,255,${0.5 + Math.sin(T * 3) * 0.3})`;
    for (let i = 0; i < 4; i++) circle(Math.cos(i * 1.6 + 0.4) * 10, 6 - 28 - 8 - Math.abs(Math.sin(i * 1.6)) * 3, 1.6);
  }
  if (t.fire > 0) { ctx.fillStyle = 'rgba(160,240,90,.6)'; circle(0, -20 - l * 5, 6); }
}

// --- Kristal Dikeni: tek kıymık → ikiz + rün halkası → üçlü + uçan kristal → prizma / kristal mızrak
function shard(x, h, w, col, hi = 'rgba(255,255,255,.6)') {
  fpoly([[x, 4 - h], [x + w, 0], [x, 6], [x - w, 0]], col);
  fpoly([[x, 4 - h], [x + w * 0.3, 0], [x, 2]], hi);
}
function drawCrystal(t, l, br, rk) {
  const T = G.time, pulse = 0.5 + Math.sin(T * 3 + (t.tx || 0)) * 0.3;
  ctx.fillStyle = '#5d5a53'; ellipse(ctx, 0, 6, 14, 7);
  ctx.fillStyle = '#77746c'; ellipse(ctx, 0, 3, 12, 6);
  if (br === 0) {
    // Prizma: altıgen gökkuşağı prizması, etrafında dönen renkli kıymıklar
    const h = 44 + rk * 6, w = 10;
    glow('#ffffff', 10 + pulse * 10 + t.fire * 80);
    const cols = ['#ff7a9a', '#ffd34d', '#7ae6ff', '#9a7aff'];
    for (let i = 0; i < 4; i++) {
      const x0 = -w + i * (w / 2), x1 = x0 + w / 2;
      fpoly([[x0, 2], [x1, 2], [x1 * 0.4, 2 - h], [x0 * 0.4, 2 - h]], cols[i]);
    }
    fpoly([[-w * 0.4, 2 - h], [w * 0.4, 2 - h], [0, -h - 8]], '#ffffff');
    noGlow();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-w * 0.15, 2 - h, 2, h);
    const n = rk ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const a = T * 1.6 + (i * Math.PI * 2) / n, x = Math.cos(a) * 18, y = -h * 0.55 + Math.sin(a) * 6;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      fpoly([[0, -5], [2.5, 0], [0, 5], [-2.5, 0]], cols[i % 4]);
      ctx.restore();
    }
    if (rk) { ctx.strokeStyle = `rgba(255,255,255,${0.3 + pulse * 0.3})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, -h - 10, 9, 3, 0, 0, Math.PI * 2); ctx.stroke(); }
    return;
  }
  if (br === 1) {
    // Kristal Mızrak: çok uzun beyaz-mavi iğne ve etrafında yüzen halkalar
    const h = 56 + rk * 10;
    glow('#bff4ff', 14 + pulse * 12 + t.fire * 90);
    shard(0, h, 5, '#e8fbff', 'rgba(140,220,255,.7)');
    noGlow();
    shard(-7, 14, 3.5, '#9ae8ff'); shard(7, 16, 3.5, '#9ae8ff');
    ctx.strokeStyle = `rgba(190,245,255,${0.5 + pulse * 0.4})`; ctx.lineWidth = 1.8;
    for (let k = 0; k < 2 + rk; k++) {
      const y = -h * (0.3 + k * 0.22) + Math.sin(T * 2 + k) * 2, rx = 9 - k * 1.5;
      ctx.beginPath(); ctx.ellipse(0, y, rx, rx * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
    }
    return;
  }
  glow('#5ae0ff', 10 + pulse * 10 + t.fire * 80);
  const shards = [[0, 30 + l * 6, 7], [-8, 18 + l * 2, 5], [8, 20 + l * 2, 5]].slice(0, l + 1);
  for (const [ox, h, w] of shards) shard(ox, h, w, l === 2 && ox === 0 ? '#9af0ff' : '#7ae6ff');
  noGlow();
  if (l >= 1) {
    // yüzen rün halkası
    ctx.strokeStyle = `rgba(140,230,255,${0.4 + pulse * 0.4})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, -12, 13, 4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#c8f6ff';
    for (let i = 0; i < 4; i++) { const a = T + i * Math.PI / 2; circle(Math.cos(a) * 13, -12 + Math.sin(a) * 4, 1.4); }
  }
  if (l === 2) {
    // tepede dönen küçük kristal
    const y = -50 + Math.sin(T * 2.5) * 3;
    ctx.save(); ctx.translate(0, y); ctx.rotate(T);
    glow('#bff4ff', 10);
    fpoly([[0, -5], [4, 0], [0, 5], [-4, 0]], '#e0fbff');
    ctx.restore();
  }
}

// --- Kül Kazanı: küçük kazan → kafatası işlemeli kazan → zincirli mangal → volkan ağzı / ejder nefesi
function flames(cx, y, w, n, h) {
  const T = G.time;
  for (let i = 0; i < n; i++) {
    const fx = cx + (i - (n - 1) / 2) * (w / n), fh = h + Math.sin(T * 12 + i * 1.7) * 3;
    ctx.fillStyle = i % 2 ? '#ffb347' : '#ff6a2a';
    ctx.beginPath(); ctx.moveTo(fx - 4, y); ctx.quadraticCurveTo(fx, y - fh * 1.3, fx + 4, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath(); ctx.moveTo(fx - 1.8, y); ctx.quadraticCurveTo(fx, y - fh * 0.7, fx + 1.8, y); ctx.closePath(); ctx.fill();
  }
}
function drawFire(t, l, br, rk) {
  const T = G.time;
  if (br === 0) {
    // Volkan Ağzı: lav kraterli kaya tepecik, yanlarından akan lav
    const h = 30 + rk * 6, w = 18 + rk * 2;
    fpoly([[-w, 6], [w, 6], [w * 0.45, 6 - h], [-w * 0.45, 6 - h]], '#3a2a24');
    fpoly([[-w, 6], [-w * 0.3, 6], [-w * 0.2, 6 - h], [-w * 0.45, 6 - h]], '#4e3a30');
    glow('#ff6a1a', 14 + t.fire * 80);
    ctx.fillStyle = '#ff6a1a'; ellipse(ctx, 0, 6 - h, w * 0.45, 4);
    ctx.fillStyle = '#ffd34d'; ellipse(ctx, 0, 6 - h, w * 0.25, 2);
    ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 2;
    for (const sd of rk ? [-1, 0.4, 1] : [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sd * w * 0.35, 7 - h);
      ctx.quadraticCurveTo(sd * w * 0.5, 6 - h * 0.5, sd * w * 0.75, 4); ctx.stroke();
    }
    flames(0, 6 - h, w * 0.7, 3 + rk, 6 + rk * 3);
    noGlow();
    for (let i = 0; i < 2 + rk * 2; i++) {
      const k = (T * 0.5 + i / (2 + rk * 2)) % 1;
      ctx.fillStyle = `rgba(80,70,70,${0.4 * (1 - k)})`;
      circle(Math.sin(i + T) * 5, 2 - h - k * 24, 3 + k * 5);
    }
    return;
  }
  if (br === 1) {
    // Ejder Nefesi: taş ejder başı heykeli, ağzından alev
    const sc = 1 + rk * 0.15;
    ctx.save(); ctx.scale(sc, sc);
    fpoly([[-6, 6], [6, 6], [5, -14], [-5, -14]], '#4a4440');
    fpoly([[-12, -12], [6, -16], [16, -24], [18, -18], [8, -10], [-4, -6], [-12, -6]], '#6a625a');  // çene/kafa
    fpoly([[-12, -12], [-2, -26], [10, -28], [16, -24], [6, -16]], '#7e766c');
    fpoly([[-2, -26], [-10, -40 - rk * 4], [2, -28]], rk ? '#d9b84a' : '#5a524a');  // boynuz
    fpoly([[6, -28], [2, -42 - rk * 4], [10, -29]], rk ? '#d9b84a' : '#5a524a');
    glow('#ffb347', 8);
    ctx.fillStyle = '#ffd34d'; circle(6, -22, 1.8);
    noGlow();
    glow('#ff7a2a', 12 + t.fire * 90);
    const fl = 8 + Math.sin(T * 18) * 2 + t.fire * 40;
    ctx.fillStyle = '#ff6a2a'; ctx.beginPath(); ctx.moveTo(16, -21); ctx.quadraticCurveTo(22 + fl, -24, 18 + fl * 1.4, -18); ctx.quadraticCurveTo(22 + fl, -14, 16, -17); ctx.fill();
    ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.moveTo(16, -20); ctx.quadraticCurveTo(20 + fl * 0.6, -21, 17 + fl * 0.9, -18); ctx.quadraticCurveTo(20 + fl * 0.6, -16, 16, -18); ctx.fill();
    noGlow();
    ctx.restore();
    return;
  }
  if (l === 2) {
    // zincirli mangal: üç ayak üstünde yüksek demir çanak
    ctx.strokeStyle = '#2a2220'; ctx.lineWidth = 3;
    for (const sd of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(sd * 10, 8); ctx.lineTo(sd * 4, -12); ctx.stroke(); }
    ctx.fillStyle = '#1e1a1a'; ctx.beginPath(); ctx.ellipse(0, -16, 16, 10, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#5a4a40'; ctx.fillRect(-18, -18, 36, 4);
    ctx.strokeStyle = '#8a7a6a'; ctx.lineWidth = 1.2;
    for (const sd of [-1, 1]) { ctx.beginPath(); for (let k = 0; k < 4; k++) ctx.arc(sd * 18, -12 + k * 4, 1.6, 0, Math.PI * 2); ctx.stroke(); }
    glow('#ff7a2a', 14 + t.fire * 80);
    ctx.fillStyle = '#ff8a2a'; ellipse(ctx, 0, -18, 14, 3);
    flames(0, -18, 24, 5, 13);
    noGlow();
    ctx.fillStyle = '#ffb347';
    for (let i = 0; i < 3; i++) { const k = (T + i * 0.33) % 1; circle(Math.sin(i * 3 + T * 2) * 8, -26 - k * 20, 1.2); }
    return;
  }
  const cr = 12 + l * 3;
  ctx.fillStyle = '#2a2220';
  ctx.fillRect(-cr + 1, -2, 3, 12); ctx.fillRect(cr - 4, -2, 3, 12); ctx.fillRect(-1.5, 0, 3, 11);
  ctx.fillStyle = '#1e1a1a';
  ctx.beginPath(); ctx.ellipse(0, -6, cr, cr * 0.8, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#4a3c36'; ctx.fillRect(-cr - 2, -8, cr * 2 + 4, 4);
  if (l === 1) {
    // kafatası işlemesi ve halka kulplar
    ctx.fillStyle = '#d8d0c0'; circle(0, -1, 3.5); ctx.fillRect(-2, 1, 4, 2.5);
    ctx.fillStyle = '#1e1a1a'; circle(-1.3, -1.3, 0.9); circle(1.3, -1.3, 0.9);
    ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = 1.5;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * (cr + 3), -4, 3, 0, Math.PI * 2); ctx.stroke(); }
  }
  glow('#ff7a2a', 12 + t.fire * 80);
  ctx.fillStyle = '#ff8a2a'; ellipse(ctx, 0, -8, cr * 0.85, 3);
  flames(0, -8, cr * 1.4, 3 + l, 8 + l * 3);
}

function drawEnemy(e) {
  const d = e.def, r = d.r, moving = e.root <= 0 && e.stun <= 0;
  const bob = moving ? Math.abs(Math.sin(G.time * 10 + e.id)) * 2 : 0;
  if (e.burrowT > 0) {
    // toprak altındaki kazmacı: sadece kıpırdayan bir toprak tümseği
    ctx.fillStyle = '#5e4326'; ellipse(ctx, e.x, e.y + 2, r * 1.2, r * 0.6);
    ctx.fillStyle = '#7a5a34';
    for (let i = 0; i < 4; i++) circle(e.x + Math.cos(G.time * 9 + i * 1.6) * r * 0.8, e.y + Math.sin(G.time * 9 + i * 1.6) * r * 0.3, 2.5);
    if (e.carry) drawGem(e.x, e.y - r * 1.4, 7, false);
    return;
  }
  ctx.save(); ctx.translate(e.x, e.y);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ellipse(ctx, 0, r * 0.8, r, r * 0.4);
  const face = Math.cos(e.ang) >= 0 ? 1 : -1;
  // yürüyen bacaklar
  const step = moving ? Math.sin(G.time * 12 + e.id) * r * 0.35 : 0;
  ctx.fillStyle = '#2a2028';
  ellipse(ctx, -r * 0.35 + step, r * 0.75, r * 0.28, r * 0.2);
  ellipse(ctx, r * 0.35 - step, r * 0.75, r * 0.28, r * 0.2);
  ctx.translate(0, -bob);
  // gövde
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : d.color;
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // kafa
  ctx.fillStyle = { knight: '#b8c0c8', boss: '#d9b84a', rogue: '#2f4029', miner: '#c9b07a', inquisitor: '#e8dcc8' }[e.type] || '#f0c9a0';
  ctx.beginPath(); ctx.arc(face * r * 0.25, -r * 0.9, r * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (e.type === 'knight') { ctx.fillStyle = '#333'; ctx.fillRect(face * r * 0.1, -r * 0.95, face * r * 0.55, 2); }
  if (e.type === 'rogue') { ctx.fillStyle = '#f0c9a0'; ctx.fillRect(face * r * 0.3 - 2, -r * 0.95, 4, 3); }
  if (e.type === 'priest') { ctx.fillStyle = '#e0b030'; ctx.fillRect(-1.5, -r * 0.5, 3, r); ctx.fillRect(-r * 0.4, -r * 0.2, r * 0.8, 3); }
  if (e.type === 'peasant') { ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(face * r, r * 0.6); ctx.lineTo(face * r * 1.3, -r * 1.4); ctx.stroke(); }
  if (e.type === 'boss') {
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath(); ctx.moveTo(-8, -r * 1.3); ctx.lineTo(-8, -r * 1.75); ctx.lineTo(-3, -r * 1.5); ctx.lineTo(0, -r * 1.85); ctx.lineTo(3, -r * 1.5); ctx.lineTo(8, -r * 1.75); ctx.lineTo(8, -r * 1.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8e8f0'; ctx.fillRect(-face * r * 1.2 - 3, -r * 0.4, 6, r * 1.1);
  }
  if (e.type === 'banner') {
    ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-face * r * 0.9, r * 0.6); ctx.lineTo(-face * r * 0.9, -r * 2.6); ctx.stroke();
    const wave = Math.sin(G.time * 8 + e.id) * 2;
    ctx.fillStyle = '#d8403a';
    ctx.beginPath(); ctx.moveTo(-face * r * 0.9, -r * 2.6); ctx.lineTo(-face * (r * 0.9 + 14), -r * 2.2 + wave); ctx.lineTo(-face * r * 0.9, -r * 1.7); ctx.closePath(); ctx.fill();
  }
  if (e.type === 'mage') {
    ctx.fillStyle = '#2a4590';
    ctx.beginPath(); ctx.moveTo(face * r * 0.25 - r * 0.7, -r * 1.2); ctx.lineTo(face * r * 0.25 + r * 0.7, -r * 1.2); ctx.lineTo(face * r * 0.5, -r * 2.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(face * r * 1.1, r * 0.8); ctx.lineTo(face * r * 1.1, -r * 1.6); ctx.stroke();
    ctx.fillStyle = '#9ad0ff'; circle(face * r * 1.1, -r * 1.7, 3);
  }
  if (e.type === 'miner') {
    ctx.fillStyle = '#e0c040'; ctx.beginPath(); ctx.arc(face * r * 0.25, -r * 1.05, r * 0.6, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#fff6b0'; circle(face * r * 0.7, -r * 1.2, 2);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(face * r * 0.6, r * 0.5); ctx.lineTo(face * r * 1.3, -r * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(face * r * 0.9, -r * 1.1); ctx.lineTo(face * r * 1.7, -r * 0.5); ctx.stroke();
  }
  if (e.type === 'inquisitor') {
    ctx.fillStyle = '#f0e8d8';
    ctx.beginPath(); ctx.moveTo(face * r * 0.25 - r * 0.45, -r * 1.3); ctx.lineTo(face * r * 0.25 + r * 0.45, -r * 1.3); ctx.lineTo(face * r * 0.25, -r * 2.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c03040'; ctx.fillRect(face * r * 0.25 - 1.5, -r * 2, 3, r * 0.6);
    ctx.fillStyle = '#ffd34d'; ctx.fillRect(-2, -r * 0.6, 4, r * 1.2); ctx.fillRect(-r * 0.45, -r * 0.2, r * 0.9, 4);
  }
  if (e.shield > 0) {
    ctx.strokeStyle = `rgba(120,180,255,${0.35 + 0.5 * e.shield / e.maxShield})`; ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(120,180,255,.12)';
    ctx.beginPath(); ctx.arc(0, -r * 0.4, r * 1.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  if (e.haste) { ctx.strokeStyle = 'rgba(255,120,90,.7)'; ctx.lineWidth = 1.5; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(-face * (r + 3), -3 + i * 6); ctx.lineTo(-face * (r + 9), -3 + i * 6); ctx.stroke(); } }
  if (e.poisonT > 0) { ctx.fillStyle = 'rgba(120,220,60,.35)'; circle(0, 0, r); }
  if (e.slowT > 0) { ctx.strokeStyle = 'rgba(140,200,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, Math.PI * 2); ctx.stroke(); }
  if (e.root > 0) {
    ctx.strokeStyle = '#4fa83a'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, r * 0.5, r + 1, Math.PI * (0.1 + i * 0.25), Math.PI * (0.3 + i * 0.25)); ctx.stroke(); }
  }
  if (e.fear > 0) {
    ctx.fillStyle = '#e0c2ff'; ctx.font = '900 13px Nunito, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('!!', Math.sin(G.time * 30) * 1.5, -r * 1.9);
    ctx.fillStyle = 'rgba(160,100,230,.3)'; circle(0, 0, r);
  }
  if (e.stun > 0) { ctx.fillStyle = '#fff6a0'; for (let i = 0; i < 3; i++) circle(Math.cos(G.time * 8 + i * 2.1) * r, -r * 1.6 + Math.sin(G.time * 8 + i * 2.1) * 3, 2); }
  ctx.restore();
  if (e.carry) drawGem(e.x, e.y - r * 2.4 - bob, 7, false);
  if (e.hp < e.maxHp) {
    const w = r * 2.4, y = e.y - r * 2 - bob - (e.carry ? 12 : 0);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(e.x - w / 2 - 1, y - 1, w + 2, 5);
    ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#6fdc5a' : e.hp / e.maxHp > 0.25 ? '#ffd34d' : '#ff5a5a';
    ctx.fillRect(e.x - w / 2, y, w * e.hp / e.maxHp, 3);
  }
}

function drawBolt(b) {
  const a = b.t / b.max, r = mulberry32(Math.floor(b.seed + b.t * 30));
  ctx.fillStyle = `rgba(180,220,255,${a * 0.3})`; circle(b.x, b.y, b.r);
  ctx.strokeStyle = `rgba(230,245,255,${a})`; ctx.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    let x = b.x + (r() - 0.5) * 60, y = 0;
    ctx.moveTo(x, y);
    while (y < b.y) { y += 25 + r() * 25; x += (r() - 0.5) * 30; if (y > b.y) { y = b.y; x = b.x + (r() - 0.5) * b.r; } ctx.lineTo(x, y); }
    ctx.stroke();
  }
}

// ---------- menüler ----------
const overlay = $('overlay');

// HUD 960x640 düzleminde tasarlandı; sahne boyutuna göre ölçekle.
// Canvas'lar da ekrandaki gerçek boyutta çizilir ki büyük ekranda bulanık görünmesin.
let worldRepaint = 0;
function fitUI() {
  const st = $('stage'), cw = st.clientWidth, ch = st.clientHeight;
  // en büyük 3:2 alan; kalan kenarlar boş bırakılmaz, render() bulanık arazi ile doldurur
  // oyun alanı, sağdaki kule paneli dışında kalan alanın ortasına yerleşir
  const av = cw - SIDE_W, sc = Math.min(av / W, ch / H), ox = (av - W * sc) / 2, oy = (ch - H * sc) / 2;
  const px = clamp(window.devicePixelRatio || 1, 1, 2);
  Object.assign(VIEW, { sc, ox, oy, px, rx: cw - ox - W * sc, ry: ch - oy - H * sc });
  // canvas pencerenin tamamı kadar; arazi ise oyun alanının gerçek çözünürlüğünde
  cv.width = Math.round(cw * px);
  cv.height = Math.round(ch * px);
  RES = sc * px;
  const tr = `translate(${ox}px, ${oy}px) scale(${sc})`;
  $('ui').style.transform = tr;
  $('world').style.transform = tr;
  // menü panelleri de sahneyle birlikte büyür/küçülür
  overlay.style.setProperty('--ui', clamp(sc, 0.7, 2).toFixed(3));
  if (G) renderTerrain(); else makeBg();
  // dünya haritasını çizmek pahalı; boyutlandırma bitince bir kez yeniden çiz
  clearTimeout(worldRepaint);
  if (typeof paintWorld === 'function') worldRepaint = setTimeout(paintWorld, 200);
}
new ResizeObserver(fitUI).observe($('stage'));
fitUI();
function showOverlay(html) { overlay.innerHTML = html; overlay.classList.add('show'); }
function hideOverlay() { overlay.classList.remove('show'); }
function overlayOpen() { return overlay.classList.contains('show'); }

// alt menülerden (Ruh Ağacı, yardım…) geri dönüş: haritaya, ya da oyundaysak duraklatma menüsüne
function showMenu() {
  if (worldOpen()) hideOverlay();
  else if (G && !G.demo && !G.over) showPauseMenu();
  else showWorld();
}

// ---------- ayarlar ----------
function showSettings() {
  const st = save.settings;
  showOverlay(`<div class="panel settings"><h2>Ayarlar</h2>
    <label class="srow"><span>🎵 Müzik</span><input type="range" min="0" max="100" value="${Math.round(st.music * 100)}" oninput="setSetting('music', this.value / 100)"><b id="sv-music">${Math.round(st.music * 100)}</b></label>
    <label class="srow"><span>🔊 Efekt sesleri</span><input type="range" min="0" max="100" value="${Math.round(st.sfx * 100)}" oninput="setSetting('sfx', this.value / 100)"><b id="sv-sfx">${Math.round(st.sfx * 100)}</b></label>
    <label class="srow"><span>📳 Ekran sarsıntısı</span><input type="checkbox" ${st.shake ? 'checked' : ''} onchange="setSetting('shake', this.checked)"><b></b></label>
    <div class="col"><button onclick="replayTutorial()">Eğitimi Yeniden Oyna</button><button onclick="showMenu()">Geri</button></div></div>`);
}
function setSetting(k, v) {
  save.settings[k] = v;
  persist();
  const lbl = $('sv-' + k);
  if (lbl) lbl.textContent = Math.round(v * 100);
  if (muted && (k === 'music' || k === 'sfx') && v > 0) toggleMute();
  applyAudio();
  if (k === 'sfx') sfx('coin');
}
function replayTutorial() { save.tut = false; persist(); startLevel(0, 0); }

// ---------- başarımlar ----------
const ACHS = [
  { id: 'first', icon: '🗡️', name: 'İlk Kan', desc: 'İlk düşmanını alt et.' },
  { id: 'k500', icon: '💀', name: 'Avcıların Kâbusu', desc: 'Toplam 500 düşman alt et.' },
  { id: 'k2000', icon: '☠️', name: 'Bataklığın Laneti', desc: 'Toplam 2000 düşman alt et.' },
  { id: 'boss', icon: '👑', name: 'Taç Düşürücü', desc: 'Bir patronu alt et.' },
  { id: 'storm', icon: '⚡', name: 'Fırtına Efendisi', desc: 'Tek Gök Gürültüsü ile 5 düşman alt et.' },
  { id: 'scare', icon: '👻', name: 'Dehşet Saçan', desc: 'Dehşet Çığlığı ile 5 kristal düşürt.' },
  { id: 'builder', icon: '🏗️', name: 'Usta Mimar', desc: 'Bir bölümde 15 kule kur.' },
  { id: 'spec', icon: '✴️', name: 'Uzmanlık', desc: 'Bir kuleyi uzmanlaştır.' },
  { id: 'rich', icon: '💰', name: 'Zengin Cadı', desc: 'Bir bölümde 1000 altın biriktir.' },
  { id: 'early', icon: '⏩', name: 'Sabırsız', desc: '10 dalgayı erken çağır.' },
  { id: 'flawless', icon: '💎', name: 'Kusursuz', desc: 'Bir bölümü hiç kristal kaybetmeden bitir.' },
  { id: 'region', icon: '🗺️', name: 'Bölge Koruyucusu', desc: 'Bir bölgenin 3 bölümünü de kazan.' },
  { id: 'hard', icon: '🔥', name: 'Ateşten Sınav', desc: 'Bir bölümü Zor aşamada kazan.' },
  { id: 'tree10', icon: '🌳', name: 'Kökler Derinde', desc: 'Ruh Ağacı\'nda 10 kademe aç.' },
  { id: 'finale', icon: '🏰', name: 'Laneti Kır', desc: 'Engizisyon Kapısı\'nı kazan.' },
  { id: 'endless20', icon: '♾️', name: 'Sonsuz Direniş', desc: 'Sonsuz modda 20. dalgaya ulaş.' },
];
function stat(k, n) { save.stats[k] = (save.stats[k] || 0) + n; persist(); }
function ach(id) {
  if (save.ach[id]) return;
  save.ach[id] = true;
  persist();
  const a = ACHS.find(x => x.id === id);
  if (G && !G.demo) G.toasts.push({ ach: id, t: 4 });
  else if (typeof showUnlock === 'function') showUnlock(`🏆 ${a.name} (+1⭐)`);
  sfx('wave');
}
function showAchievements() {
  const done = ACHS.filter(a => save.ach[a.id]).length;
  const cards = ACHS.map(a => `<div class="achc ${save.ach[a.id] ? 'done' : ''}">
      <span class="ai">${save.ach[a.id] ? a.icon : '🔒'}</span>
      <div><b>${a.name}</b><small>${a.desc}</small></div><em>${save.ach[a.id] ? '✔ +1⭐' : '+1⭐'}</em></div>`).join('');
  showOverlay(`<div class="panel"><h2>Başarımlar</h2>
    <p>Kazanılan: <b>${done} / ${ACHS.length}</b> · Her başarım Ruh Ağacı için <b>1 bonus yıldız</b> verir.
    <br><small>Toplam alt edilen düşman: ${save.stats.kills || 0} · Sonsuz mod rekoru: ${save.best || 0}. dalga</small></p>
    <div class="achs">${cards}</div><button onclick="showMenu()">Geri</button></div>`);
}
function showEndlessResult() {
  const reached = G.wave, rec = reached > (save.best || 0);
  if (rec) { save.best = reached; persist(); }
  showOverlay(`<div class="panel"><h2>Bataklık Düştü</h2>
    <div class="tier-tag" style="--tc:#8a5ad0">♾️ Sonsuz Bataklık</div>
    <div class="rstars" style="letter-spacing:2px;font-family:Cinzel,serif">${reached}. dalga</div>
    <p>${rec ? '✦ Yeni rekor! ✦' : `En iyi: ${save.best}. dalga`}</p>
    <div class="col"><button onclick="startLevel(-1, 1)">Tekrar Dene</button><button onclick="showWorld()">Haritaya Dön</button></div></div>`);
}

// ---------- Ruh Ağacı ekranı ----------
// Dallar üç bölgede toplanır; her dal yatay bir sıradır ve güçler soldan sağa açılır.
const TREE_BANDS = [
  { name: 'Doğa', icon: '🌿', ids: ['t', 's'] },
  { name: 'Ateş & Kristal', icon: '🔥', ids: ['c', 'f'] },
  { name: 'Sihir & Servet', icon: '✨', ids: ['m', 'g'] },
];
let treeSel = 't1';
function showPerks() {
  showOverlay(treeContent());
}
// Panel açıkken yalnızca içerik yenilenir; böylece her tıklamada panel baştan açılmaz
function refreshPerks() {
  const p = $('rtPanel');
  if (!p || !overlayOpen()) return showPerks();
  p.outerHTML = treeContent();
}
function treeContent() {
  const free = starsTotal() - starsSpent();
  const branchRow = b => `<div class="rt-row" style="--bc:${b.color}">
      <div class="rt-bname"><i>${b.icon}</i><span>${b.name}</span></div>
      <div class="rt-nodes">${b.nodes.map(n => {
        const r = sk(n.id), open = nodeOpen(n);
        const cls = [r >= n.max ? 'max' : r ? 'some' : '', open ? '' : 'locked',
          treeSel === n.id ? 'sel' : '', open && r < n.max && free >= n.cost ? 'can' : ''].join(' ');
        return `<button class="rt-nd ${cls}" onclick="selectNode('${n.id}')" title="${n.name}">
            <span class="ti">${open ? n.icon : '🔒'}</span><span class="tr">${r}/${n.max}</span></button>`;
      }).join('')}</div></div>`;
  const bands = TREE_BANDS.map(bd => `<div class="rt-band">
      <div class="rt-port"><span>${bd.icon}</span><b>${bd.name}</b></div>
      <div class="rt-rows">${bd.ids.map(id => branchRow(TREE.find(b => b.id === id))).join('')}</div></div>`).join('');

  const n = TREE_NODES.find(x => x.id === treeSel), r = sk(n.id), open = nodeOpen(n);
  const prev = n.k ? n.branch.nodes[n.k - 1] : null;
  const canUp = open && r < n.max && free >= n.cost;
  // geri alınabilmesi için bu dalda sonraki güçlerden hiçbiri alınmamış olmalı
  const canDown = r > 0 && !n.branch.nodes.slice(n.k + 1).some(x => sk(x.id) > 0);
  const lockMsg = !open ? `<div class="rt-lock">🔒 Önce "${prev.name}" gücünü al</div>` : '';
  const det = `<div class="rt-det" style="--bc:${n.branch.color}">
      <div class="rt-dh"><span class="rt-di">${n.icon}</span>
        <div><small>${n.branch.name}</small><b>${n.name}</b></div></div>
      <div class="rt-rank">Rütbe <b>${r}</b> / ${n.max}</div>
      <div class="rt-fx">${r ? `Şu an: ${n.fx(r)}` : 'Henüz alınmadı.'}</div>
      ${r < n.max ? `<div class="rt-next">Sonraki: ${n.fx(r + 1)}</div>` : '<div class="rt-max">✦ En üst rütbe ✦</div>'}
      ${lockMsg}
      <div class="rt-btns">
        <button class="rt-up" onclick="buyNode('${n.id}')" ${canUp ? '' : 'disabled'}>YÜKSELT · ${n.cost}⭐</button>
        <button class="rt-down" onclick="degradeNode('${n.id}')" ${canDown ? '' : 'disabled'}>GERİ AL · +${n.cost}⭐</button>
      </div></div>`;

  return `<div class="panel rt-panel" id="rtPanel">
    <div class="rt-top"><button class="rt-back" onclick="showMenu()">← Geri</button><h2>Ruh Ağacı</h2>
      <span class="rt-stars">⭐ <b>${free}</b> <small>boş · ${starsTotal()} toplam</small></span>
      <button class="treset" onclick="resetTree()" ${starsSpent() ? '' : 'disabled'}>↺ Sıfırla</button></div>
    <div class="rt-body"><div class="rt-bands">${bands}</div>${det}</div>`;
}
function selectNode(id) { treeSel = id; refreshPerks(); }
function buyNode(id) {
  const n = TREE_NODES.find(x => x.id === id);
  if (!nodeOpen(n) || sk(id) >= n.max || starsTotal() - starsSpent() < n.cost) { sfx('bad'); return; }
  save.tree[id] = sk(id) + 1;
  if (TREE_NODES.reduce((a, n) => a + sk(n.id), 0) >= 10) ach('tree10');
  persist();
  sfx('build');
  refreshPerks();
}
// bir kademe geri alır ve yıldızını iade eder; sonraki güçler alınmışsa engellenir
function degradeNode(id) {
  const n = TREE_NODES.find(x => x.id === id), r = sk(id);
  if (r <= 0 || n.branch.nodes.slice(n.k + 1).some(x => sk(x.id) > 0)) { sfx('bad'); return; }
  if (r === 1) delete save.tree[id]; else save.tree[id] = r - 1;
  persist();
  sfx('coin');
  refreshPerks();
}
// tüm yıldızları geri verir; farklı bir yapı denemek ücretsiz
function resetTree() { save.tree = {}; persist(); sfx('coin'); refreshPerks(); }

function showHelp() {
  showOverlay(`<div class="panel help"><h2 style="text-align:center">Nasıl Oynanır</h2><ul>
    <li>Hazine avcıları yoldan gelip <b>mahzenden kristal çalar</b> ve geldikleri yere geri kaçar. Kaçan her hırsız 1 kristal götürür.</li>
    <li>Kristal taşıyan düşmanı öldürürsen kristal yere düşer; 10 saniye içinde başka biri kapmazsa mahzene geri döner.</li>
    <li>Her kule yalnızca kendi arazisine kurulur: <b>🌿 Diken Totemi → Çimen</b>, <b>🍄 Mantar Kulesi → Bataklık</b>, <b>💠 Kristal Dikeni → Kaya</b>, <b>🔥 Kül Kazanı → Kül</b> (4. bölge Kül Ovası’ndan itibaren).</li>
    <li><b>Şövalyeler</b> zırhlıdır (dikenler zayıf kalır), <b>Rahipler</b> büyüye dirençlidir ve dostlarını iyileştirir, <b>Hırsızlar</b> çok hızlıdır.</li>
    <li><b>Bayraktar</b> yanındakileri hızlandırır, <b>Savaş Büyücüsü</b> büyü kalkanı taşır ve dostlarındaki zehir/kökleri temizler, <b>Cüce Kazmacı</b> toprağa gömülür (gömülüyken sadece büyüler işler), <b>Baş Engizisyoncu</b> köylü çağırır.</li>
    <li>Düşman öldürmek altın ve mana verir. Büyüler: <b>1</b> Gök Gürültüsü, <b>2</b> Sarmaşık Kapanı, <b>3</b> Dehşet Çığlığı (düşmanları kaçırır, kristali düşürtür), <b>4</b> Toprak Dönüşümü (ağacı sil / arazi türünü değiştir).</li>
    <li>3. seviyedeki kuleyi <b>iki uzmanlıktan biriyle</b> 4. seviyeye çıkarabilirsin (ör. Prizma Kulesi ya da Kristal Mızrak). Kulenin <b>hedef seçimini</b> İlk / Güçlü / Yakın arasında değiştir (<b>T</b>).</li>
    <li>Dalgaları erken çağırırsan bonus altın kazanırsın (<b>N</b>). <b>Boşluk</b>: duraklat, <b>F</b>: hız, <b>U</b>: seçili kuleyi yükselt.</li>
    <li>Her bölüm üç aşamada oynanır: <b>Kolay → Normal → Zor</b>. Bir aşamada <b>3 yıldız</b> (hiç kristal kaybetmeden) alırsan sonraki aşama açılır. Kolay aşamayı kazanmak haritada yeni bölümü açar.</li>
    <li>Her aşama 3 yıldız, bölüm başına toplam 9 yıldız! Yıldızlarla <b>Ruh Ağacı</b>'nda kalıcı güçler aç.</li>
  </ul><div style="text-align:center"><button onclick="showMenu()">Geri</button></div></div>`);
}

function startLevel(i, tier = 0) {
  newGame(i, tier);
  lastPanel = null;
  hideOverlay();
  hideWorld();
  if (typeof tutStart === 'function') tutStart();
}

function showResult(win) {
  if (G.L.endless) return showEndlessResult();
  if (win) {
    if (G.lost === 0) ach('flawless');
    if (G.tier === 2) ach('hard');
    if (G.li === LEVELS.length - 1) ach('finale');
  }
  const li = G.li, tier = G.tier, T = TIERS[tier], before = save.stars[li].slice();
  let stars = 0;
  if (win) {
    stars = G.lost === 0 ? 3 : G.lost <= G.startCrystals * 0.35 ? 2 : 1;
    if (stars > save.stars[li][tier]) { save.stars[li][tier] = stars; persist(); }
  }
  const r0 = Math.floor(li / 3) * 3;
  if (win && [0, 1, 2].every(k => save.stars[r0 + k][0] > 0)) ach('region');
  // bu zaferle ilk kez açılanlar
  const newLevel = win && tier === 0 && !before[0] && li + 1 < LEVELS.length;
  const newTier = win && tier < 2 && stars === 3 && before[tier] < 3;
  const finale = win && li === LEVELS.length - 1 && tier === 0 && !before[0];
  const notes = [
    newLevel ? `Yeni bölüm açıldı: ${LEVELS[li + 1].name}` : '',
    newTier ? `${TIERS[tier + 1].name} aşaması açıldı!` : '',
  ].filter(Boolean).map(n => `<div class="divider">✦ ${n} ✦</div>`).join('');
  const hint = win && stars < 3 && tier < 2 && save.stars[li][tier] < 3
    ? `<p><small>${TIERS[tier + 1].name} aşamasını açmak için bu aşamada <b>3 yıldız</b> almalısın (hiç kristal kaybetme).</small></p>` : '';
  showOverlay(`<div class="panel"><h2>${finale ? 'Lanet Kırıldı!' : win ? 'Zafer!' : 'Kristaller Kayboldu…'}</h2>
    <div class="tier-tag" style="--tc:${T.color}">${LEVELS[li].name} · ${T.name}</div>
    ${finale ? '<p>Engizisyon geri püskürtüldü. Bataklık artık güvende — şimdi Normal ve Zor aşamalarda yıldızlarını tamamla!</p>' : ''}
    ${win ? `<div class="rstars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
      <p>Kaybedilen kristal: ${G.lost} / ${G.startCrystals}</p>${notes}${hint}`
      : '<p>Hazine avcıları bütün ruh kristallerini kaçırdı. Kulelerini farklı arazilere kurmayı ve büyülerini kullanmayı dene.</p>'}
    <div class="col">
      ${newTier ? `<button onclick="startLevel(${li}, ${tier + 1})">${TIERS[tier + 1].name} Aşamasını Oyna</button>` : ''}
      ${newLevel ? `<button onclick="startLevel(${li + 1}, 0)">Sonraki Bölüm</button>` : ''}
      <button onclick="startLevel(${li}, ${tier})">Tekrar Oyna</button>
      <button onclick="showWorld()">Haritaya Dön</button>
    </div></div>`);
}

// ---------- döngü ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G && !G.demo && !G.paused && !G.over && !overlayOpen() && !worldOpen()) {
    const steps = G.speed;
    for (let i = 0; i < steps; i++) update(dt);
  } else if (G && G.demo) {
    G.time += dt;
  }
  if (G && !G.paused) updateAmbient(dt);
  Music.setMode(!G || G.demo || worldOpen() ? 'map' : G.enemies.some(e => e.def.r > 14) || G.bossWarn > 0 ? 'boss' : 'battle');
  render();
  updateHUD();
  requestAnimationFrame(loop);
}

newGame(0).demo = true;
requestAnimationFrame(loop);
// açılış ekranı (dünya haritası) world.js içinde başlatılır
