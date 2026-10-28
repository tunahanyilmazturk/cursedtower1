# Ruh Kristalleri — geliştirme notları

Tek sayfalık HTML5 canvas kule savunma oyunu. Derleme yok, bağımlılık yok: dosyalar doğrudan tarayıcıda çalışır.

## Çalıştırma

```bash
npx http-server -p 8765 -c-1
```

Sonra `http://localhost:8765` adresini aç. `-c-1` önbelleği kapatır; kod değişince sayfayı yenilemek için şart. Yazı tipleri için internet gerekir (yoksa sistem yazı tipi kullanılır).

## Dosyalar

| Dosya | İçerik |
|---|---|
| `index.html` | İskelet: sahne, HUD, harita katmanı, script/CSS bağlantıları |
| `game.js` | Oyun motoru: bölümler (`LEVELS`), sonsuz mod (`ENDLESS`), kuleler (`TOWERS`, `BRANCHES`), büyüler (`SPELLS`), düşmanlar (`ENEMIES`), Ruh Ağacı (`TREE`), başarımlar (`ACHS`), kayıt, çizim, efektler, menüler |
| `world.js` | Dünya haritası: bölgeler (`REGIONS`), bölüm noktaları (`WORLD_NODES`), kilit/açılma mantığı, bölüm kartı, sonsuz mod kartı, başarım ekranı |
| `music.js` | Prosedürel müzik (WebAudio, dosya yok). Modlar: harita / savaş / patron |
| `tutorial.js` | İlk bölümün (1-1, Kolay) 7 adımlı eğitimi |
| `style.css` | Oyun ekranı, HUD, paneller, Ruh Ağacı, kule paneli |
| `world.css` | Dünya haritası, düğümler, alt menü, bölüm kartı, başarımlar |
| `.claude/launch.json` | Önizleme sunucusu ayarı (port 8765) |

## Kayıt (localStorage, anahtar `ruhKristalleri_v1`)

Tarayıcıda saklanır; cihaz ya da tarayıcı değişince ilerleme gelmez.

- `stars`: her bölüm için `[Kolay, Normal, Zor]` yıldızları (0–3). Bölüm sayısı 18.
- `tree`: Ruh Ağacı düğümü → alınan kademe sayısı.
- `ach`, `stats`, `best`: başarımlar, toplam istatistik, sonsuz mod rekoru.
- `seen`: görülen düşman türleri. `revealed`: haritada son açılan bölüm.
- `settings`: müzik, efekt, sarsıntı. `tut`: eğitim görüldü mü.
- `v: 2`: 6 bölümden 18 bölüme geçiş göçü. Eski kayıtlar otomatik taşınır.

## Oyun kuralları (özet)

- **Bölümler:** 6 bölge × 3 bölüm. Bir bölümün Kolay aşaması kazanılınca sıradaki açılır. Normal ve Zor, bir önceki aşamada 3 yıldızla açılır.
- **Yıldız:** Kristal kaybetmeden kazanılırsa 3, az kaybedilirse 2 ya da 1. Başarım başına +1 yıldız da var (Ruh Ağacı harcaması için).
- **Kuleler:** 4 tür (Diken Totemi, Mantar Kulesi, Kristal Dikeni, Kül Kazanı). Seviye 1→3 temel. Seviye 3'ten sonra iki dal, her dal 2 kademe (en üst seviye 4). Dal yapısı `BRANCHES[tür][dal].ranks`.
- **Büyüler:** 4 adet (kısayollar 1–4): Gök Gürültüsü, Sarmaşık Kapanı, Dehşet Çığlığı, Toprak Dönüşümü.
- **Ruh Ağacı:** 6 dal, her dal yukarıdan aşağı sıralı. Kademe maliyetleri derinliğe göre artar.
- **Sonsuz mod:** Batık Köprü (5. bölüm) Kolay'da kazanılınca açılır. Dalgalar bitmez, rekor `save.best`.

## Kod notları

- Oyun koordinatları 960×640. Sahne boyutu değişince HUD `fitUI()` ile ölçeklenir; canvas çözünürlüğü de (`RES`) ekrana göre ayarlanır.
- Kule çizimleri `drawTower()` içinde, türe göre `drawThorn / drawSpore / drawCrystal / drawFire`.
- Kule istatistikleri: `baseStats()` (ham değer) → `modStats()` (Ruh Ağacı etkisi) → `statLine()` (yazı). Fiyatlar `priceOf()`.
- Efektler: `ring`, `shake`, `flash`, `spark`, `flyCoins`, `updateFx`, `drawScreenFx`.
- Test yaparken `localStorage` kaydını değiştirirsen işin bitince eski hâline döndür; aksi halde gerçek ilerleme kaybolur.

## Bilinen durumlar / açık işler

- **Denge henüz gerçek oyunla test edilmedi.** Otomatik botla Kolay aşamalar ve sonsuz modun ilk dalgaları denendi; Normal/Zor ve sonraki dallar insan oyunuyla ayarlanmalı.
- Tarayıcı konsolunda bazen `paintWorld` (world.js) hatası görüldü. Büyük olasılıkla eski önbellekten gelen dosya; sert yenileme (Ctrl+F5) ile yeniden kontrol et.
- Mobil/dar ekran düzeni test edilmedi; oyun pencereye sığacak şekilde ölçekleniyor ama düğmeler küçük kalabilir.
- Müzik kulağa nasıl geldiği insan tarafından dinlenmedi; ses seviyeleri ve ritim ayarlanabilir (`music.js`, `MODES`).

## Fikir listesi (yapılmadı)

- Yeni düşman/patron türleri ve sonsuz modda ek düşmanlar
- Ruh Ağacı'na yeni dallar (yıldızlar tam dolmuyor, dengeye bakılmalı)
- Ses efektleri için ayrı mikrofon/ayar seçenekleri, kontrol tuşları özelleştirme
