#!/usr/bin/env node
/*
  Aykut Tosun – statik sayfa üretici (Google ve arama motorları için)
  ------------------------------------------------------------------
  Kullanım:  node tools/build.js
  assets/data.js veya assets/risaleler.js değiştiğinde çalıştırın.

  Ne yapar?
   - Her içerik için gerçek bir sayfa üretir: /makale/<ad>/index.html, /risale/<ad>/index.html …
   - Metin HTML'in içinde hazır durur (JavaScript beklemeden okunur).
   - Her sayfaya kendi başlığı, açıklaması, canonical adresi, paylaşım kartı (Open Graph / Twitter)
     ve yapılandırılmış verisi (JSON-LD: Kişi, Makale, Kitap, Sayfa yolu) eklenir.
   - sitemap.xml, robots.txt ve 404.html dosyalarını yazar.
  Sayfa içeriği, sitenin kendi kodu (assets/app.js) çalıştırılarak üretilir; görünüm birebir aynıdır.
*/
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SITE = "https://aykuttosun.org";              // yayın adresi (sonunda / yok)
const ROOT = path.resolve(__dirname, "..");
const TODAY = new Date().toISOString().slice(0, 10);

// ---------- Sitenin kodunu sunucu tarafında çalıştır ----------
const sandbox = {
  window: { __PRERENDER: true, matchMedia: () => ({ matches: false }) },
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
  navigator: { userAgent: "", platform: "", maxTouchPoints: 0 },
  location: { href: SITE + "/", origin: SITE, pathname: "/", hash: "" },
  localStorage: { getItem: () => null, setItem: () => {} },
  console
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
// data.js / risaleler.js "window.X = ..." yazar; app.js window.TD okur
for (const f of ["assets/data.js", "assets/risaleler.js", "assets/app.js"]) {
  const code = fs.readFileSync(path.join(ROOT, f), "utf8");
  vm.runInContext("(function(window, document, navigator, location){" + code + "\n})(window, document, navigator, location);", sandbox, { filename: f });
}
const { P, D, RS, excerpt } = sandbox.window.TDP;
// Önbellek kırıcı: CSS/JS adreslerine içeriğe göre değişen ?v= etiketi ekle.
// Dosya değişince adres de değişir; sunucu/CDN veya tarayıcı eski kopyayı veremez.
const crypto = require("crypto");
const ver = (f) => crypto.createHash("md5").update(fs.readFileSync(path.join(ROOT, f))).digest("hex").slice(0, 10);
let TEMPLATE = fs.readFileSync(path.join(__dirname, "template.html"), "utf8");
for (const f of ["assets/style.css", "assets/data.js", "assets/risaleler.js", "assets/app.js", "manifest.webmanifest"]) {
  const tag = "/" + f + '"';
  if (!TEMPLATE.includes(tag)) throw new Error("Şablonda bulunamadı: " + f);
  TEMPLATE = TEMPLATE.split(tag).join("/" + f + "?v=" + ver(f) + '"');
}

// ---------- Yardımcılar ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clip = (t, n = 158) => excerpt(String(t).replace(/\s+/g, " "), n);
const abs = (u) => (/^https?:/.test(u) ? u : SITE + u);
const OG_DEFAULT = SITE + "/icons/og-image.png";

const PERSON = {
  "@type": "Person",
  "@id": SITE + "/#aykut-tosun",
  name: "Aykut Tosun",
  url: SITE + "/aykut-tosun/",
  image: D.site.portrait,
  jobTitle: "Eğitimci, Neyzen, Müzisyen, Araştırmacı, Mutasavvıf",
  description: D.bio[0],
  knowsAbout: ["Tasavvuf", "İrfan", "Mesnevî-i Şerîf", "Ney", "Müzik Terapi", "İslam Ahlâkı"],
  sameAs: [D.iletisim.aykut.youtube, D.iletisim.aykut.instagram, D.iletisim.aykut.facebook, "https://www.tefekkurdenizi.com/"],
  affiliation: { "@type": "EducationalOrganization", name: "Tefekkür Denizi İrfan Okulu", url: "https://www.tefekkurdenizi.com/" }
};
const AUTHOR = { "@type": "Person", "@id": PERSON["@id"], name: "Aykut Tosun", url: PERSON.url };
function crumbs(list) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [["Ana Sayfa", "/"]].concat(list).map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c[0], item: SITE + c[1] }))
  };
}

// ---------- Sayfa listesi ----------
const pages = [];
function add(url, route, param, meta) { pages.push(Object.assign({ url, route, param }, meta)); }

add("/", "home", null, {
  title: "Aykut Tosun | Tasavvuf, İrfan ve Mesnevî Sohbetleri",
  desc: "Aykut Tosun’un Mesnevî-i Şerîf ve İrfan sohbetleri, İrfan Risaleleri, makaleler, denemeler, şiirler ve hikmetli sözler. Kur’ân-ı Kerîm ve sahih sünnet ekseninde tasavvuf ve irfan.",
  ld: [
    { "@type": "WebSite", "@id": SITE + "/#website", name: "Aykut Tosun", url: SITE + "/", inLanguage: "tr-TR", publisher: { "@id": PERSON["@id"] } },
    PERSON
  ]
});
add("/aykut-tosun/", "aykut-tosun", null, {
  title: "Aykut Tosun Kimdir? Biyografi | Aykut Tosun",
  desc: clip(D.bio[0]), ogType: "profile", image: D.site.portrait,
  ld: [{ "@type": "ProfilePage", url: SITE + "/aykut-tosun/", inLanguage: "tr-TR", mainEntity: PERSON }, crumbs([["Aykut Tosun", "/aykut-tosun/"]])]
});
add("/sohbetler/", "sohbetler", null, {
  title: "Sohbetler: Mesnevî, İrfan, Nutuklar, Kelâm-ı Kadîm | Aykut Tosun",
  desc: "Aykut Tosun ile Mesnevî-i Şerîf Sohbetleri, İrfan Sohbetleri, Nutukların İrfân Dili ve Kelâm-ı Kadîm dersleri. Video ve podcast olarak izleyin, dinleyin.",
  ld: [crumbs([["Sohbetler", "/sohbetler/"]])]
});
D.sohbetler.forEach((s) => add("/sohbet/" + s.slug + "/", "sohbet", s.slug, {
  title: s.title + " | Aykut Tosun", desc: clip(s.text.join(" ")),
  ld: [
    Object.assign({ "@type": "CreativeWorkSeries", name: s.title, description: clip(s.text.join(" "), 300), url: SITE + "/sohbet/" + s.slug + "/", inLanguage: "tr-TR", author: AUTHOR },
      s.playlist ? { sameAs: ["https://www.youtube.com/playlist?list=" + s.playlist].concat(s.spotify ? [s.spotify] : []) } : {}),
    crumbs([["Sohbetler", "/sohbetler/"], [s.title, "/sohbet/" + s.slug + "/"]])
  ]
}));
add("/podcastler/", "podcastler", null, {
  title: "Podcastler | Aykut Tosun", desc: "Aykut Tosun sohbetlerini Spotify ve Apple Podcasts üzerinden dinleyin: İrfan Sohbetleri, Mesnevî-i Şerîf Sohbetleri, Kelâm-ı Kadîm Dersi.",
  ld: [crumbs([["Podcastler", "/podcastler/"]])]
});
add("/etkinlikler/", "etkinlikler", null, {
  title: "Etkinlikler | Aykut Tosun", desc: "Aykut Tosun seminerleri, sohbet meclisleri ve eğitim programları hakkında güncel duyurular.",
  ld: [crumbs([["Etkinlikler", "/etkinlikler/"]])]
});
add("/kitaplar/", "kitaplar", null, {
  title: "Kitaplar: İrfan Risaleleri | Aykut Tosun",
  desc: "Tefekkür Denizi İrfan Külliyatı – İrfan Risaleleri: İnsan, Hakiki Tevhid, İhsan, Tevekkül. Sitede okuyun veya PDF olarak indirin.",
  ld: [
    { "@type": "BookSeries", name: "İrfan Risaleleri", alternateName: "Tefekkür Denizi İrfan Külliyatı", author: AUTHOR, inLanguage: "tr-TR", url: SITE + "/kitaplar/",
      hasPart: D.risaleler.map((b) => ({ "@type": "Book", name: b.title, url: SITE + "/risale/" + b.slug + "/" })) },
    crumbs([["Kitaplar", "/kitaplar/"]])
  ]
});
D.risaleler.forEach((b) => {
  const r = RS[b.slug]; if (!r) return;
  const firstP = (r.blocks.find((k) => k.t === "p") || { x: "" }).x;
  const words = r.blocks.map((k) => k.x).join(" ").split(/\s+/).length;
  add("/risale/" + b.slug + "/", "risale", b.slug, {
    title: r.title + ": " + r.subtitle + " – İrfan Risaleleri " + b.no + " | Aykut Tosun",
    desc: clip(r.title + " risalesi: " + firstP), ogType: "book", image: b.img,
    ld: [
      { "@type": "Book", "@id": SITE + "/risale/" + b.slug + "/#book", name: r.title, alternativeHeadline: r.subtitle, author: AUTHOR, inLanguage: "tr-TR",
        bookFormat: "https://schema.org/EBook", image: b.img, url: SITE + "/risale/" + b.slug + "/", numberOfPages: undefined, wordCount: words,
        isPartOf: { "@type": "BookSeries", name: "İrfan Risaleleri", alternateName: "Tefekkür Denizi İrfan Külliyatı" }, position: b.no,
        publisher: { "@type": "EducationalOrganization", name: "Tefekkür Denizi İrfan Okulu", url: "https://www.tefekkurdenizi.com/" },
        workExample: { "@type": "Book", bookFormat: "https://schema.org/EBook", encodingFormat: "application/pdf", url: b.pdf } },
      crumbs([["Kitaplar", "/kitaplar/"], [r.title, "/risale/" + b.slug + "/"]])
    ]
  });
});
add("/yazilar/", "yazilar", null, {
  title: "Yazılar: Makaleler, Denemeler ve Şiirler | Aykut Tosun",
  desc: "Aykut Tosun’un kalbe, ahlâka ve tefekküre dair makaleleri, denemeleri ve şiirleri.",
  ld: [crumbs([["Yazılar", "/yazilar/"]])]
});
const lists = [
  ["makaleler", "makale", "Makaleler", "Makale", D.makaleler, "Aykut Tosun’un İhlâs, affetmek, doğruluk, şükür ve gaflet üzerine makaleleri."],
  ["denemeler", "deneme", "Denemeler", "Deneme", D.denemeler, "Aykut Tosun’un gönül yolculuğuna dair kısa tefekkür denemeleri."],
  ["siirler", "siir", "Şiirler", "Şiir", D.siirler, "Aykut Tosun’un aşk, hâl ve hakikat üzerine tasavvufî şiirleri."]
];
lists.forEach(([lr, ir, lname, kind, arr, ldesc]) => {
  add("/" + lr + "/", lr, null, {
    title: lname + " | Aykut Tosun", desc: ldesc + " " + arr.map((a) => a.title).slice(0, 5).join(", ") + "…",
    ld: [
      { "@type": "CollectionPage", name: lname, url: SITE + "/" + lr + "/", inLanguage: "tr-TR",
        mainEntity: { "@type": "ItemList", itemListElement: arr.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: SITE + "/" + ir + "/" + a.slug + "/", name: a.title })) } },
      crumbs([[lname, "/" + lr + "/"]])
    ]
  });
  arr.forEach((a) => {
    const poem = ir === "siir";
    const desc = poem ? clip(a.body.split("\n").filter(Boolean).slice(0, 3).join(" / ")) : clip(a.body);
    add("/" + ir + "/" + a.slug + "/", ir, a.slug, {
      title: a.title + " – " + kind + " | Aykut Tosun", desc, ogType: "article",
      ld: [
        poem
          ? { "@type": "CreativeWork", genre: "Şiir", name: a.title, author: AUTHOR, inLanguage: "tr-TR", url: SITE + "/" + ir + "/" + a.slug + "/", text: a.body.slice(0, 500) }
          : { "@type": "Article", headline: a.title, description: desc, author: AUTHOR, publisher: { "@id": PERSON["@id"], "@type": "Person", name: "Aykut Tosun" },
              inLanguage: "tr-TR", image: OG_DEFAULT, wordCount: a.body.split(/\s+/).length, articleSection: lname,
              mainEntityOfPage: SITE + "/" + ir + "/" + a.slug + "/" },
        crumbs([[lname, "/" + lr + "/"], [a.title, "/" + ir + "/" + a.slug + "/"]])
      ]
    });
  });
});
add("/sozler/", "sozler", null, {
  title: "Aykut Tosun Sözleri: Hikmetli ve Tasavvufî Sözler",
  desc: D.sozler.length + " hikmetli söz. “" + clip(D.sozler[1] || D.sozler[0], 120) + "” — Aykut Tosun",
  ld: [
    { "@type": "CollectionPage", name: "Aykut Tosun Sözleri", url: SITE + "/sozler/", inLanguage: "tr-TR",
      hasPart: D.sozler.map((s) => ({ "@type": "Quotation", text: s, creator: AUTHOR })) },
    crumbs([["Sözler", "/sozler/"]])
  ]
});
add("/iletisim/", "iletisim", null, {
  title: "İletişim | Aykut Tosun", desc: "Aykut Tosun ve Tefekkür Denizi İrfan Okulu iletişim bilgileri: telefon, WhatsApp, e-posta, YouTube, Instagram.",
  ld: [{ "@type": "ContactPage", url: SITE + "/iletisim/", about: { "@id": PERSON["@id"] } }, crumbs([["İletişim", "/iletisim/"]])]
});
add("/uygulama/", "uygulama", null, {
  title: "Telefona Uygulama Olarak Ekleyin | Aykut Tosun", desc: "Aykut Tosun sitesini iPhone, Android veya bilgisayarınıza uygulama olarak ekleyin.",
  ld: [crumbs([["Mobil Uygulama", "/uygulama/"]])]
});

// ---------- Sayfaları yaz ----------
function headFor(p) {
  const url = SITE + p.url;
  const img = abs(p.image || OG_DEFAULT);
  const ld = { "@context": "https://schema.org", "@graph": p.ld || [] };
  return [
    "<title>" + esc(p.title) + "</title>",
    '<meta name="description" content="' + esc(p.desc) + '">',
    '<link rel="canonical" href="' + url + '">',
    '<meta name="robots" content="' + (p.noindex ? "noindex,follow" : "index,follow,max-image-preview:large") + '">',
    '<meta name="author" content="Aykut Tosun">',
    '<meta name="theme-color" content="#0b2338">',
    '<meta name="format-detection" content="telephone=no">',
    '<meta property="og:site_name" content="Aykut Tosun">',
    '<meta property="og:locale" content="tr_TR">',
    '<meta property="og:type" content="' + (p.ogType || "website") + '">',
    '<meta property="og:title" content="' + esc(p.title) + '">',
    '<meta property="og:description" content="' + esc(p.desc) + '">',
    '<meta property="og:url" content="' + url + '">',
    '<meta property="og:image" content="' + esc(img) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + esc(p.title) + '">',
    '<meta name="twitter:description" content="' + esc(p.desc) + '">',
    '<meta name="twitter:image" content="' + esc(img) + '">',
    p.ld ? '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, "\\u003c") + "</script>" : ""
  ].filter(Boolean).join("\n");
}
function render(p) {
  const fn = P[p.route] || P.notfound;
  sandbox.location.pathname = p.url; sandbox.location.href = SITE + p.url;
  const html = '<div class="fade">' + fn(p.param) + "</div>";
  return TEMPLATE.replace("<!--SEO-->", headFor(p)).replace("<!--ROUTE-->", p.url).replace("<!--MAIN-->", html);
}

let n = 0;
for (const p of pages) {
  const out = path.join(ROOT, p.url, "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render(p));
  n++;
}
// 404 sayfası (bilinmeyen adresler; tarayıcıda uygulama kodu doğru sayfayı yine çizer)
fs.writeFileSync(path.join(ROOT, "404.html"), render({
  url: "/404/", route: "notfound", param: null, noindex: true,
  title: "Sayfa bulunamadı | Aykut Tosun", desc: "Aradığınız sayfa bulunamadı."
}).replace('data-route="/404/"', 'data-route=""'));

// sitemap.xml
const prio = (u) => (u === "/" ? "1.0" : /^\/(risale|makale|deneme|siir|sohbet)\//.test(u) ? "0.8" : "0.6");
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  pages.map((p) => "  <url><loc>" + SITE + p.url + "</loc><lastmod>" + TODAY + "</lastmod><priority>" + prio(p.url) + "</priority></url>").join("\n") +
  "\n</urlset>\n";
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(ROOT, "robots.txt"), "User-agent: *\nAllow: /\nDisallow: /tools/\n\nSitemap: " + SITE + "/sitemap.xml\n");

console.log(n + " sayfa, 404.html, sitemap.xml ve robots.txt üretildi.");
