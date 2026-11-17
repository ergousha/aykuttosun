# Aykut Tosun – Web Sitesi + Mobil Uygulama (PWA)

Yayın adresi: **https://aykuttosun.org**

Her içeriğin kendi gerçek adresi vardır (ör. `/makale/kalplerin-anahtari-sukur/`, `/risale/tevekkul/`). Sayfalar statik HTML olarak üretilir; metin sayfanın içinde hazır durur, bu sayede Google ve diğer arama motorları her yazıyı ayrı ayrı görebilir. Tarayıcıda ise site, sayfa yenilemeden geçiş yapan bir uygulama gibi çalışır.

## Dosyalar
| Dosya / klasör | Görevi |
|---|---|
| `assets/data.js` | **Tüm içerik** (sözler, makaleler, denemeler, şiirler, sohbetler, iletişim) |
| `assets/risaleler.js` | İrfan Risaleleri'nin tam metinleri |
| `assets/app.js` | Sayfaların oluşturulması, yönlendirme, paylaşım, kurulum düğmesi |
| `assets/style.css` | Tasarım (mobil öncelikli, açık/koyu tema) |
| `tools/template.html` | Tüm sayfaların ortak iskeleti (menü, alt bilgi, etiketler) |
| `tools/build.js` | **Sayfa üretici** – içerikten tüm HTML sayfalarını, `sitemap.xml` ve `robots.txt` dosyalarını üretir |
| `index.html`, `makale/…`, `risale/…` vb. | Üretilmiş sayfalar (elle düzenlemeyin, `build.js` üzerine yazar) |
| `sitemap.xml`, `robots.txt` | Google için sayfa listesi ve tarama kuralları |
| `404.html` | Bulunamayan adresler için sayfa |
| `manifest.webmanifest`, `sw.js` | Uygulama tanımı ve çevrimdışı çalışma |
| `_headers` | Netlify / Cloudflare Pages tarayıcı önbellek ayarları |
| `icons/`, `logo/` | Simgeler ve logo dosyaları |

## İçerik güncelleme (2 adım)
1. `assets/data.js` (veya `assets/risaleler.js`) dosyasını düzenleyin:
   - Yeni söz: `"sozler"` listesine `"…",` satırı ekleyin.
   - Yeni makale/deneme/şiir: ilgili listeye `{"slug":"kisa-ad","title":"Başlık","body":"Paragraf 1\n\nParagraf 2"}` ekleyin. Şiirde satır sonu `\n`, kıta arası `\n\n` olur. `slug` yalnızca küçük harf, rakam ve tire içermeli (adres olur).
   - YouTube oynatma listesi: ilgili sohbetin `"playlist"` alanına `list=` sonrasındaki kimliği yazın.
2. Sayfaları yeniden üretin: klasörde bir komut penceresi açıp şunu çalıştırın:
   ```
   node tools/build.js
   ```
   (Bilgisayarda [Node.js](https://nodejs.org) kurulu olmalı.) Ardından klasörün tamamını yayına yükleyin.

> Sayfaları yeniden üretmeden yalnızca `data.js`'i yüklerseniz site tarayıcıda yine güncel görünür, ancak Google'ın gördüğü HTML ve site haritası eski kalır.

## Otomatik eşitleme (tefekkurdenizi.com → bu site)
`.github/workflows/sync-tefekkurdenizi.yml` her gün 05:17 UTC'de (ve "Run workflow" ile elle) `tools/sync-tefekkur.js` çalıştırır. Yeni makale/deneme/şiir/söz ve yaklaşan etkinlikleri bulursa `assets/data.js` dosyasını günceller, `node tools/build.js` ile sayfaları üretir ve `auto/tefekkurdenizi-sync` dalından **tek bir PR** açar (açık PR varsa günceller). Değişiklik yoksa hiçbir şey yapmaz.

- Yeni yazıların biçimlendirilmesi **Gemini** ile yapılır; çıktı kaynak metinle kelime kelime karşılaştırılır, uyuşmazsa deterministik biçimlendirmeye geçilir ve PR'da "elle inceleme" notu düşülür.
- Biyografi ve risale sayısı değişirse otomatik **yazılmaz**, yalnızca PR açıklamasında bildirilir.
- Hiçbir içerik silinmez (yalnızca tarihi geçen/iptal edilen etkinlikler listeden çıkar).

Kurulum (bir kez):
1. GitHub → Settings → Secrets and variables → Actions → **Secrets**: `GEMINI_API_KEY` ekleyin (anahtar yoksa eşitleme yine çalışır, yalnızca deterministik biçimlendirme kullanır).
2. İsteğe bağlı **Variables**: `GEMINI_MODEL` (varsayılan `gemini-flash-latest`).
3. Settings → Actions → General → Workflow permissions: **Read and write** seçin ve **Allow GitHub Actions to create and approve pull requests** kutusunu işaretleyin.

Yerelde deneme: `node tools/sync-tefekkur.js --dry` (dosyaya yazmaz, rapor basar).

## Yayına alma
Klasörün **tamamını** sitenin kök dizinine yükleyin (Netlify, Cloudflare Pages veya benzeri). Sunucu `/makale/ad/` adresine gelen isteğe `makale/ad/index.html` dosyasını verir; bunu Netlify ve Cloudflare Pages kendiliğinden yapar.

Not: Sayfalar artık mutlak adres (`/assets/…`) kullandığı için `index.html`'i bilgisayarda çift tıklayarak açmak düzgün görünmez. Yerelde denemek için klasörde `npx serve` veya `python -m http.server` ile küçük bir sunucu açın.

## Google'a kaydetme (yayına aldıktan sonra, bir kez)
1. https://search.google.com/search-console adresine gidin → **Mülk ekle** → `aykuttosun.org` (Alan adı) → verilen TXT kaydını alan adının DNS ayarlarına ekleyip doğrulayın.
2. Sol menüden **Site haritaları** → `sitemap.xml` yazıp **Gönder**.
3. İsteğe bağlı: **URL denetimi** ile birkaç önemli sayfayı (ana sayfa, risaleler) "Dizine eklenmesini iste" ile hızlandırın.
4. İsteğe bağlı: https://www.bing.com/webmasters üzerinden Search Console'u içe aktararak Bing/Yandex için de ekleyin.

Yapılandırılmış veriyi kontrol etmek için: https://search.google.com/test/rich-results (herhangi bir sayfa adresini girin).

## Telefona uygulama olarak ekleme
Sitede **Menü → "Telefona uygulama olarak ekle"** (`/uygulama/`) adım adım anlatır.
- **iPhone (Safari):** Paylaş → Ana Ekrana Ekle → Ekle
- **Android (Chrome):** "Uygulamayı Yükle" düğmesi ya da ⋮ → Uygulamayı yükle

Site her açılışta güncel dosyaları sunucudan alır (önce ağ). `sw.js` dosyasının kendisini değiştirirseniz içindeki `VERSION` değerini artırın.

## Notlar
- Eski `aykuttosun.org/#/…` bağlantıları otomatik olarak yeni adreslere yönlendirilir.
- Görseller (portre, risale kapakları) ve risale PDF'leri `static.wixstatic.com` / `tefekkurdenizi.com` üzerinden yükleniyor. O sitelerde değişiklik olursa `data.js` içindeki adresleri güncelleyin.
- **Etkinlikler** sayfası Instagram/WhatsApp yönlendirmeli bir yer tutucudur.
