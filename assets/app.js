/* Aykut Tosun – site uygulaması (gerçek adresler + PWA). Sayfalar ayrıca tools/build.js ile statik HTML olarak üretilir. */
(function () {
  "use strict";
  var D = window.TD;
  var main = document.getElementById("main");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function paras(t, cls) { return t.split(/\n{2,}/).map(function (p, i) { return "<p" + (i === 0 && cls ? ' class="' + cls + '"' : "") + ">" + esc(p.trim()) + "</p>"; }).join(""); }
  function excerpt(t, n) { t = t.replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n).replace(/\s\S*$/, "") + "…" : t; }
  function readMin(t) { return Math.max(1, Math.round(t.split(/\s+/).length / 200)); }

  var I = {
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
    share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/></svg>',
    pen: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/></svg>',
    feather: '<svg viewBox="0 0 24 24"><path d="M20 4C10 4 6 10 5 19M20 4c0 8-5 12-12 12M9 12h6"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    quote: '<svg viewBox="0 0 24 24"><path d="M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6"/></svg>',
    dl: '<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4 10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
    iosShare: '<svg viewBox="0 0 24 24"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
    dots: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg>',
    plusSq: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    wa: '<svg viewBox="0 0 24 24"><path d="M4 20l1.3-3.8A8 8 0 1 1 8 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z"/></svg>',
    ig: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="16.8" cy="7.2" r=".6"/></svg>',
    fb: '<svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/></svg>',
    tt: '<svg viewBox="0 0 24 24"><path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5M14 4c.5 2.5 2.5 4 5 4"/></svg>',
    yt: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="4"/><path d="m10.5 9.5 4 2.5-4 2.5z"/></svg>'
  };
  var waves = '<svg class="waves" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0 50 C 240 10 480 90 720 50 S 1200 10 1440 50 V90 H0z" fill="var(--bg)" opacity=".35"/><path d="M0 62 C 260 30 520 96 780 60 S 1240 34 1440 64 V90 H0z" fill="var(--bg)"/></svg>';
  // Aykut Tosun logosu – Devran (dönen halkalar ve merkezde nokta)
  var moon = '<svg class="moon" viewBox="0 0 100 100" role="img" aria-label="Aykut Tosun logosu"><g fill="none" stroke="currentColor" stroke-linecap="round"><circle cx="50" cy="50" r="42" stroke-width="2.6" stroke-dasharray="200 64" transform="rotate(-60 50 50)"/><circle cx="50" cy="50" r="31" stroke-width="3.2" stroke-dasharray="140 55" transform="rotate(70 50 50)"/><circle cx="50" cy="50" r="20" stroke-width="3.8" stroke-dasharray="90 36" transform="rotate(200 50 50)"/></g><circle cx="50" cy="50" r="6" fill="currentColor"/></svg>';

  // ---------- Yardımcılar ----------
  function dayIndex(n) { var d = new Date(); var s = new Date(d.getFullYear(), 0, 0); return Math.floor((d - s) / 864e5) % n; }
  function toast(msg) { var t = document.createElement("div"); t.className = "toast-msg"; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200); }
  function share(title, text) {
    var url = location.href;
    // Telefonlarda cihazın kendi paylaşım menüsü; yoksa sitenin paylaşım menüsü
    if (navigator.share) {
      navigator.share({ title: title, text: text, url: url }).catch(function (e) {
        if (!e || e.name !== "AbortError") shareSheet(title, text, url); // kullanıcı iptal ettiyse bir şey yapma
      });
    } else shareSheet(title, text, url);
  }

  function shareSheet(title, text, url) {
    var msg = (text ? text + "\n\n" : "") + url;
    var e = encodeURIComponent;
    var items = [
      ["WhatsApp", "wa", "https://api.whatsapp.com/send?text=" + e(msg)],
      ["Telegram", "tg", "https://t.me/share/url?url=" + e(url) + "&text=" + e(text || title)],
      ["X (Twitter)", "x", "https://twitter.com/intent/tweet?text=" + e(text || title) + "&url=" + e(url)],
      ["Facebook", "fb", "https://www.facebook.com/sharer/sharer.php?u=" + e(url)],
      ["E-posta", "ml", "mailto:?subject=" + e(title) + "&body=" + e(msg)]
    ];
    var old = document.getElementById("shareSheet"); if (old) old.remove();
    var el = document.createElement("div");
    el.id = "shareSheet"; el.className = "sheet-bg";
    el.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="Paylaş">' +
      '<div class="sheet-head"><b>Paylaş</b><button class="icon-btn sm" data-close aria-label="Kapat"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
      (text ? '<p class="sheet-prev">' + esc(text) + "</p>" : "") +
      '<div class="sheet-grid">' + items.map(function (i) {
        return '<a class="sheet-btn" href="' + i[2] + '" target="_blank" rel="noopener"><span class="sh-ic sh-' + i[1] + '">' + i[0].charAt(0) + "</span>" + i[0] + "</a>";
      }).join("") +
      '<button class="sheet-btn" data-copy><span class="sh-ic sh-cp">' + I.copy + "</span>Kopyala</button></div></div>";
    document.body.appendChild(el);
    var close = function () { el.remove(); document.removeEventListener("keydown", onKey); };
    var onKey = function (ev) { if (ev.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    el.addEventListener("click", function (ev) {
      if (ev.target === el || ev.target.closest("[data-close]")) return close();
      if (ev.target.closest("[data-copy]")) { copy(msg); return close(); }
      if (ev.target.closest(".sheet-btn")) setTimeout(close, 300);
    });
  }
  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast("Panoya kopyalandı"); }, function () { toast("Kopyalanamadı"); });
    else toast("Kopyalama desteklenmiyor");
  }
  window.TDshare = share; window.TDcopy = copy;

  function pageHead(title, sub, crumbs) {
    return '<section class="page-head"><div class="wrap">' +
      (crumbs ? '<div class="crumbs">' + crumbs + "</div>" : "") +
      "<h1>" + title + "</h1>" + (sub ? "<p>" + sub + "</p>" : "") + "</div></section>";
  }
  function rows(list, base) {
    return '<div class="list">' + list.map(function (a, i) {
      return '<a class="row" href="/' + base + "/" + a.slug + '/"><span class="num">' + (i + 1) + '</span><span class="t"><b>' + esc(a.title) +
        "</b><span>" + esc(excerpt(a.body, 90)) + "</span></span>" + I.chev + "</a>";
    }).join("") + "</div>";
  }
  function videoBox(s) {
    if (!s.playlist) return "";
    return '<div class="video" data-pl="' + s.playlist + '"><button class="video-ph" aria-label="Oynatma listesini başlat"><div><div class="play">' + I.play +
      '</div><b>' + esc(s.title) + '</b><br><small>Oynatma listesini izlemek için dokunun</small></div></button></div>';
  }
  function listenBtns(s) {
    var b = "";
    if (s.playlist) b += '<a class="btn" target="_blank" rel="noopener" href="https://www.youtube.com/playlist?list=' + s.playlist + '">' + I.yt + "YouTube</a>";
    else if (s.youtube) b += '<a class="btn" target="_blank" rel="noopener" href="' + s.youtube + '">' + I.yt + "YouTube Kanalı</a>";
    if (s.spotify) b += '<a class="btn" target="_blank" rel="noopener" href="' + s.spotify + '">' + I.mic + "Spotify</a>";
    if (s.apple) b += '<a class="btn" target="_blank" rel="noopener" href="' + s.apple + '">' + I.mic + "Apple Podcasts</a>";
    return '<div class="listen">' + b + "</div>";
  }

  // ---------- Sayfalar ----------
  var P = {};

  P.home = function () {
    var soz = D.sozler[dayIndex(D.sozler.length)];
    var latest = [
      { t: D.makaleler[0], b: "makale", k: "Makale" }, { t: D.denemeler[0], b: "deneme", k: "Deneme" }, { t: D.siirler[0], b: "siir", k: "Şiir" }
    ];
    return '<section class="hero">' + '<div class="hero-in fade">' + moon +
      '<h1>Aykut Tosun</h1>' +
      '<p class="lead">“' + esc(D.site.motto) + '”<br><small style="font-style:normal;font-size:.75em;color:#d4af6a">— Aykut Tosun</small></p>' +
      '<div class="ctas"><a class="btn btn-gold" href="/sohbetler/">' + I.play + 'Sohbetleri İzle</a><a class="btn" href="/aykut-tosun/">Aykut Tosun</a></div></div>' + waves + "</section>" +

      '<section class="section"><div class="wrap"><div class="grid g2">' +
      '<div class="verse"><span class="eyebrow">Günün Âyeti</span><blockquote>' + esc(D.ayet.metin) + '</blockquote><span class="src">' + esc(D.ayet.kaynak) + "</span></div>" +
      '<div class="verse"><span class="eyebrow">Günün Hadîs-i Şerîfi</span><p class="intro">' + esc(excerpt(D.hadis.giris, 150)) + '</p><blockquote style="font-size:1.15rem">' + esc(D.hadis.metin) + '</blockquote><span class="src">' + esc(D.hadis.kaynak) + "</span></div>" +
      "</div></div></section>" +

      '<section class="section alt"><div class="wrap"><div class="sec-head"><div><span class="eyebrow">Sohbetler</span><h2>İrfan Meclisleri</h2></div><a href="/sohbetler/">Tümü →</a></div><div class="grid g4">' +
      D.sohbetler.map(function (s) { return '<a class="card" href="/sohbet/' + s.slug + '/"><div class="card-ico">' + I.play + "</div><h3>" + esc(s.title) + "</h3><p>" + esc(s.kisa) + '</p><span class="more">Dinle ' + I.arrow + "</span></a>"; }).join("") +
      "</div></div></section>" +

      '<section class="section"><div class="wrap"><div class="quote-big"><span class="eyebrow" style="color:#d4af6a">Günün Sözü</span><blockquote id="dailySoz">' + esc(soz) + "</blockquote><cite>Aykut Tosun</cite>" +
      '<div class="q-actions"><button class="btn sm" data-share-soz>' + I.share + 'Paylaş</button><a class="btn sm" href="/sozler/">Tüm Sözler</a></div></div></div></section>' +

      '<section class="section alt"><div class="wrap"><div class="sec-head"><div><span class="eyebrow">Yazılar</span><h2>Okuma Köşesi</h2></div><a href="/yazilar/">Tümü →</a></div><div class="grid g3">' +
      latest.map(function (x) { return '<a class="card" href="/' + x.b + "/" + x.t.slug + '/"><span class="eyebrow">' + x.k + "</span><h3>" + esc(x.t.title) + "</h3><p>" + esc(excerpt(x.t.body, 130)) + '</p><span class="more">Oku ' + I.arrow + "</span></a>"; }).join("") +
      "</div></div></section>" +

      '<section class="section"><div class="wrap"><div class="sec-head"><div><span class="eyebrow">Tefekkür Denizi İrfan Külliyatı</span><h2>İrfan Risaleleri</h2></div><a href="/kitaplar/">Tümü →</a></div>' + books() + "</div></section>" +

      '<section class="section alt hide-standalone"><div class="wrap"><div class="card" style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">' +
      '<img src="/icons/icon-192.png" width="72" height="72" style="border-radius:18px" alt="">' +
      '<div style="flex:1;min-width:220px"><h3 style="margin:0">Aykut Tosun cebinizde</h3><p>Siteyi telefonunuzun ana ekranına ekleyin; bir uygulama gibi tam ekran açılsın.</p></div>' +
      '<a class="btn btn-gold" href="/uygulama/">' + I.dl + "Ana Ekrana Ekle</a></div></div></section>" +

      // Tefekkür Denizi İrfan Okulu bağlantısı
      '<section class="section"><div class="wrap"><a class="td-link" href="https://www.tefekkurdenizi.com/" target="_blank" rel="noopener">' +
      '<img src="/icons/tefekkur-denizi-yatay.png" alt="Tefekkür Denizi İrfân Okulu" width="600" height="157" loading="lazy">' +
      '<div class="td-text"><span class="eyebrow">Kardeş Site</span><h3>Tefekkür Denizi İrfân Okulu</h3>' +
      "<p>Aykut Tosun’un kurucusu olduğu, Kur’ân-ı Kerîm ve sahih sünnet ekseninde tasavvuf, irfan ve ahlak eğitimleri sunan ilim ve tefekkür merkezi.</p>" +
      '<span class="btn btn-gold">' + I.ext + "tefekkurdenizi.com’u ziyaret et</span></div></a></div></section>";
  };

  P["aykut-tosun"] = function () {
    return pageHead("Aykut Tosun", "Eğitimci · Neyzen · Müzisyen · Araştırmacı · Mutasavvıf", '<a href="/">Ana Sayfa</a> / Aykut Tosun') +
      '<section class="section"><div class="wrap narrow"><div class="bio-top"><img src="' + D.site.portrait + '" alt="Aykut Tosun" loading="lazy">' +
      '<div><p class="prose" style="font-family:var(--serif);font-size:1.35rem;line-height:1.5">' + esc(D.bio[0]) + '</p><div class="tags"><span class="tag">Ney</span><span class="tag">Müzik Terapi</span><span class="tag">Tasavvuf</span><span class="tag">Mesnevî</span><span class="tag">Eğitim</span></div></div></div>' +
      '<div class="prose mt">' + D.bio.slice(1).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div>" +
      '<div class="verse mt"><blockquote>' + esc(D.bioAyet.metin) + '</blockquote><span class="src">' + esc(D.bioAyet.kaynak) + "</span></div>" +
      '<p class="mt prose">' + esc(D.bioAyet.son) + "</p>" +
      '<div class="listen"><a class="btn btn-gold" href="/sohbetler/">' + I.play + 'Sohbetler</a><a class="btn" href="' + D.iletisim.aykut.youtube + '" target="_blank" rel="noopener">' + I.yt + 'YouTube</a><a class="btn" href="' + D.iletisim.aykut.instagram + '" target="_blank" rel="noopener">' + I.ig + "Instagram</a></div>" +
      "</div></section>";
  };

  P.sohbetler = function () {
    return pageHead("Sohbetler", "Kur’ân-ı Kerîm ve sahih sünnet ekseninde, gönle dokunan irfan meclisleri.", '<a href="/">Ana Sayfa</a> / Sohbetler') +
      '<section class="section"><div class="wrap"><div class="grid g2">' +
      D.sohbetler.map(function (s) { return '<a class="card" href="/sohbet/' + s.slug + '/"><div class="card-ico">' + I.play + "</div><h3>" + esc(s.title) + "</h3><p>" + esc(excerpt(s.text.join(" "), 220)) + '</p><span class="more">Sohbet sayfasına git ' + I.arrow + "</span></a>"; }).join("") +
      '</div><div class="mt center"><a class="btn" href="/podcastler/">' + I.mic + "Podcast olarak dinle</a></div></div></section>";
  };

  P.sohbet = function (slug) {
    var s = D.sohbetler.filter(function (x) { return x.slug === slug; })[0];
    if (!s) return P.notfound();
    return pageHead(esc(s.title), esc(s.kisa), '<a href="/sohbetler/">Sohbetler</a> / ' + esc(s.title)) +
      '<section class="section"><div class="wrap narrow">' + videoBox(s) +
      (s.playlist ? "" : '<div class="card center"><div class="card-ico" style="margin:0 auto 10px">' + I.yt + "</div><p>Bu serinin en güncel bölümleri Aykut Tosun YouTube kanalında ve podcast platformlarında yayınlanmaktadır.</p></div>") +
      listenBtns(s) + '<div class="prose mt">' + s.text.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div></div></section>";
  };

  P.podcastler = function () {
    var list = D.sohbetler.filter(function (s) { return s.spotify; });
    return pageHead("Podcastler", "Sohbetleri yolda, evde, dilediğiniz yerde dinleyin.", '<a href="/">Ana Sayfa</a> / Podcastler') +
      '<section class="section"><div class="wrap"><div class="grid g3">' +
      list.map(function (s) {
        return '<div class="card"><div class="card-ico">' + I.mic + "</div><h3>" + esc(s.title) + "</h3><p>Aykut Tosun</p>" +
          '<div class="listen"><a class="btn btn-gold sm" target="_blank" rel="noopener" href="' + s.spotify + '">Spotify</a><a class="btn sm" target="_blank" rel="noopener" href="' + s.apple + '">Apple Podcasts</a></div></div>';
      }).join("") + "</div></div></section>";
  };

  P.etkinlikler = function () {
    return pageHead("Etkinlikler", "Seminerler, sohbet meclisleri ve eğitim programları.", '<a href="/">Ana Sayfa</a> / Etkinlikler') +
      '<section class="section"><div class="wrap narrow"><div class="card center"><div class="card-ico" style="margin:0 auto 12px">' + I.cal + '</div><h3>Yaklaşan etkinlikler</h3>' +
      "<p>Güncel etkinlik duyuruları sosyal medya hesaplarımızdan paylaşılmaktadır. Bilgi ve kayıt için bize ulaşabilirsiniz.</p>" +
      '<div class="listen" style="justify-content:center"><a class="btn btn-gold" target="_blank" rel="noopener" href="' + D.iletisim.okul.instagram + '">' + I.ig + 'Instagram</a><a class="btn" target="_blank" rel="noopener" href="' + D.iletisim.whatsapp + '">' + I.wa + "WhatsApp</a></div></div></div></section>";
  };

  // Risale tam metinleri (assets/risaleler.js) – numaraya göre eşleştir
  var RS = window.TD_RISALE || {};
  var RSLUG = ["insan", "hakiki-tevhid", "ihsan", "tevekkul"];
  D.risaleler.forEach(function (b) { b.slug = RSLUG[b.no - 1]; var r = RS[b.slug]; b.subtitle = r ? r.subtitle : ""; });

  function books() {
    return '<div class="grid books">' + D.risaleler.map(function (b) {
      var read = "/risale/" + b.slug + "/";
      return '<div class="book"><a class="cover" href="' + read + '"><img loading="lazy" src="' + b.img + '" alt="İrfan Risaleleri ' + b.no + ": " + esc(b.title) + '"></a>' +
        '<a class="book-t" href="' + read + '"><b>' + esc(b.title) + "</b></a><small>" + (b.subtitle ? esc(b.subtitle) : "İrfan Risaleleri – " + b.no) + "</small>" +
        '<div class="book-btns"><a class="btn btn-gold sm" href="' + read + '">' + I.book + 'Oku</a>' +
        '<a class="btn sm" href="' + b.pdf + '" target="_blank" rel="noopener" download>' + I.dl + "PDF</a></div></div>";
    }).join("") + "</div>";
  }

  P.risale = function (slug) {
    var idx = -1; D.risaleler.forEach(function (b, i) { if (b.slug === slug) idx = i; });
    var b = D.risaleler[idx], r = RS[slug];
    if (!b || !r) return P.notfound();
    var hi = 0, toc = [];
    var body = r.blocks.map(function (k, i) {
      if (k.t === "h") { var id = "bolum-" + (++hi); toc.push({ id: id, x: k.x }); return '<h2 class="r-h" id="' + id + '">' + esc(k.x) + "</h2>"; }
      if (k.t === "q") return '<blockquote class="r-q"><p>' + esc(k.x) + "</p>" + (k.s ? "<cite>" + esc(k.s) + "</cite>" : "") + "</blockquote>";
      if (k.t === "v") return '<p class="r-v">' + esc(k.x) + "</p>";
      if (i === r.blocks.length - 1 && k.x.length < 40) return '<p class="r-sign">' + esc(k.x) + "</p>";
      if (/^•\s/.test(k.x)) return '<p class="r-li">' + esc(k.x.replace(/^•\s*/, "")) + "</p>";
      return "<p>" + esc(k.x) + "</p>";
    }).join("");
    var prev = D.risaleler[idx - 1], next = D.risaleler[idx + 1];
    return pageHead(esc(r.title), esc(r.subtitle), '<a href="/kitaplar/">Kitaplar</a> / İrfan Risaleleri – ' + b.no) +
      '<article class="reader"><div class="wrap narrow">' +
      '<div class="r-intro"><img src="' + b.img + '" alt="' + esc(r.title) + ' kapak" loading="lazy"><div>' +
      '<span class="eyebrow">Tefekkür Denizi İrfan Külliyatı · İrfan Risaleleri ' + b.no + "</span>" +
      "<p class=\"muted\">Aykut Tosun · " + readMin(r.blocks.map(function (k) { return k.x; }).join(" ")) + " dk okuma</p>" +
      '<a class="btn" href="' + b.pdf + '" target="_blank" rel="noopener" download>' + I.dl + "PDF olarak indir</a></div></div>" +
      '<nav class="r-toc" aria-label="İçindekiler"><b>İçindekiler</b><ol>' +
      toc.map(function (t) { return '<li><button data-goto="' + t.id + '">' + esc(t.x) + "</button></li>"; }).join("") + "</ol></nav>" +
      '<div class="reader-tools"><button class="icon-btn sm" data-fs="-1" aria-label="Küçült">' + I.minus + '</button><button class="icon-btn sm" data-fs="1" aria-label="Büyüt">' + I.plus + "</button>" +
      '<button class="icon-btn sm" data-share aria-label="Paylaş">' + I.share + "</button></div>" +
      '<div class="prose risale">' + body + "</div>" +
      '<div class="r-end"><a class="btn btn-gold" href="' + b.pdf + '" target="_blank" rel="noopener" download>' + I.dl + "Bu risaleyi PDF olarak indir</a></div>" +
      '<div class="pager">' + (prev ? '<a href="/risale/' + prev.slug + '/"><small>← Önceki risale</small><b>' + esc(prev.title) + "</b></a>" : "") +
      (next ? '<a class="next" href="/risale/' + next.slug + '/"><small>Sonraki risale →</small><b>' + esc(next.title) + "</b></a>" : "") + "</div>" +
      "</div></article>";
  };
  P.kitaplar = function () {
    return pageHead("Kitaplar", "Tefekkür Denizi İrfan Külliyatı", '<a href="/">Ana Sayfa</a> / Kitaplar') +
      '<section class="section"><div class="wrap"><div class="sec-head"><h2>İrfan Risaleleri</h2></div>' + books() +
      '<div class="card mt"><div class="card-ico">' + I.book + '</div><h3>İlmî ve Tasavvufî Eserler</h3><p>Yakında…</p></div></div></section>';
  };

  P.yazilar = function () {
    return pageHead("Yazılar", "Makaleler ve denemeler: kalbe, ahlâka ve tefekküre dair.", '<a href="/">Ana Sayfa</a> / Yazılar') +
      '<section class="section"><div class="wrap"><div class="grid g3">' +
      '<a class="card" href="/makaleler/"><div class="card-ico">' + I.pen + "</div><h3>Makaleler</h3><p>" + D.makaleler.length + ' makale · İhlâs, affetmek, doğruluk, şükür, gaflet</p><span class="more">Oku ' + I.arrow + "</span></a>" +
      '<a class="card" href="/denemeler/"><div class="card-ico">' + I.feather + "</div><h3>Denemeler</h3><p>" + D.denemeler.length + ' deneme · Gönül yolculuğundan kısa tefekkürler</p><span class="more">Oku ' + I.arrow + "</span></a>" +
      '<a class="card" href="/siirler/"><div class="card-ico">' + I.quote + "</div><h3>Şiirler</h3><p>" + D.siirler.length + ' şiir · Aşk, hâl ve hakikat üzerine</p><span class="more">Oku ' + I.arrow + "</span></a>" +
      "</div></div></section>";
  };
  P.makaleler = function () { return pageHead("Makaleler", "", '<a href="/yazilar/">Yazılar</a> / Makaleler') + '<section class="section"><div class="wrap narrow">' + rows(D.makaleler, "makale") + "</div></section>"; };
  P.denemeler = function () { return pageHead("Denemeler", "", '<a href="/yazilar/">Yazılar</a> / Denemeler') + '<section class="section"><div class="wrap narrow">' + rows(D.denemeler, "deneme") + "</div></section>"; };
  P.siirler = function () { return pageHead("Şiirler", "Aykut Tosun", '<a href="/">Ana Sayfa</a> / Şiirler') + '<section class="section"><div class="wrap narrow">' + rows(D.siirler, "siir") + "</div></section>"; };

  function reader(list, slug, kind, listRoute, listName, poem) {
    var idx = -1; list.forEach(function (a, i) { if (a.slug === slug) idx = i; });
    if (idx < 0) return P.notfound();
    var a = list[idx], prev = list[idx - 1], next = list[idx + 1];
    var body = poem ? a.body.split(/\n{2,}/).map(function (s) { return "<p>" + esc(s) + "</p>"; }).join("") : paras(a.body, "dropcap");
    return pageHead(esc(a.title), kind + " · Aykut Tosun" + (poem ? "" : " · " + readMin(a.body) + " dk okuma"), '<a href="/' + listRoute + '/">' + listName + "</a>") +
      '<article class="reader"><div class="wrap narrow"><div class="reader-tools">' +
      '<button class="icon-btn sm" data-fs="-1" aria-label="Küçült">' + I.minus + '</button><button class="icon-btn sm" data-fs="1" aria-label="Büyüt">' + I.plus + "</button>" +
      '<button class="icon-btn sm" data-share aria-label="Paylaş">' + I.share + "</button></div>" +
      '<div class="prose' + (poem ? " poem" : "") + '">' + body + "</div>" +
      '<div class="pager">' + (prev ? '<a href="/' + listRoute.replace(/ler$|lar$/, "") + "/" + prev.slug + '/"><small>← Önceki</small><b>' + esc(prev.title) + "</b></a>" : "") +
      (next ? '<a class="next" href="/' + listRoute.replace(/ler$|lar$/, "") + "/" + next.slug + '/"><small>Sonraki →</small><b>' + esc(next.title) + "</b></a>" : "") +
      "</div></div></article>";
  }
  P.makale = function (s) { return reader(D.makaleler, s, "Makale", "makaleler", "Makaleler"); };
  P.deneme = function (s) { return reader(D.denemeler, s, "Deneme", "denemeler", "Denemeler"); };
  P.siir = function (s) { return reader(D.siirler, s, "Şiir", "siirler", "Şiirler", true); };

  P.sozler = function () {
    return pageHead("Sözler", "Aykut Tosun’dan hikmetli sözler", '<a href="/">Ana Sayfa</a> / Sözler') +
      '<section class="section"><div class="wrap"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:start"><input class="search" id="sozSearch" type="search" placeholder="Sözlerde ara… (ör. aşk, dert, gönül)" style="flex:1;min-width:220px">' +
      '<button class="btn" id="sozRandom">' + I.shuffle + 'Rastgele</button></div><div class="soz-grid" id="sozGrid">' +
      D.sozler.map(function (s, i) { return '<figure class="soz" data-i="' + i + '"><blockquote>' + esc(s) + '</blockquote><div class="act"><button class="icon-btn sm" data-copy-soz="' + i + '" aria-label="Kopyala">' + I.copy + '</button><button class="icon-btn sm" data-share-soz="' + i + '" aria-label="Paylaş">' + I.share + "</button></div></figure>"; }).join("") +
      '</div><p class="muted center" id="sozEmpty" hidden>Sonuç bulunamadı.</p></div></section>';
  };

  P.iletisim = function () {
    var c = D.iletisim;
    function li(href, cls, ico, label, sub) { return '<a href="' + href + '" target="_blank" rel="noopener"><span class="ci ' + cls + '">' + ico + "</span><span><b>" + label + "</b><small>" + sub + "</small></span></a>"; }
    return pageHead("İletişim", "Sorularınız, etkinlik ve kayıt bilgileri için bize ulaşın.", '<a href="/">Ana Sayfa</a> / İletişim') +
      '<section class="section"><div class="wrap"><div class="grid g2">' +
      '<div class="card"><h3>Tefekkür Denizi İrfan Okulu</h3><div class="contact-list">' +
      li(c.telHref, "ph", I.phone, "Telefon", c.tel) + li(c.whatsapp, "wa", I.wa, "WhatsApp", "Mesaj gönderin") +
      li("mailto:" + c.mail, "ml", I.mail, "E-posta", c.mail) + li(c.okul.instagram, "ig", I.ig, "Instagram", "@tefekkurdeniziirfanokulu") +
      li(c.okul.facebook, "fb", I.fb, "Facebook", "tefekkurdeniziirfanokulu") + li(c.okul.tiktok, "tt", I.tt, "TikTok", "@tefekkurdeniziirfanokulu") + "</div></div>" +
      '<div class="card"><h3>Aykut Tosun</h3><div class="contact-list">' +
      li(c.aykut.youtube, "yt", I.yt, "YouTube", "@aykuttosunofficial") + li(c.aykut.instagram, "ig", I.ig, "Instagram", "@aykuttosunofficial") +
      li(c.aykut.facebook, "fb", I.fb, "Facebook", "aykuttosunofficial") + li("mailto:" + c.aykut.mail, "ml", I.mail, "E-posta", c.aykut.mail) + "</div></div>" +
      "</div></div></section>";
  };

  // ---------- Uygulama (PWA) kurulum sayfası ----------
  P.uygulama = function () {
    var ua = navigator.userAgent;
    var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var isAndroid = /Android/i.test(ua);
    var standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    var def = isIOS ? "ios" : isAndroid ? "android" : "desktop";
    var status = standalone ? '<p class="note"><span class="ok">✓ Harika!</span> Aykut Tosun şu anda uygulama olarak açık.</p>' : "";
    return pageHead("Telefona Uygulama Olarak Ekleyin", "Mağazaya gerek yok: siteyi ana ekranınıza ekleyin, bir uygulama gibi tam ekran ve hızlı açılsın.", '<a href="/">Ana Sayfa</a> / Mobil Uygulama') +
      '<section class="section"><div class="wrap"><div class="app-hero">' +
      "<div>" + status +
      '<div id="installNative" hidden class="card" style="margin-bottom:16px"><h3>Tek dokunuşla yükle</h3><p>Tarayıcınız doğrudan kurulumu destekliyor.</p><button class="btn btn-gold mt" id="installBtn">' + I.dl + "Uygulamayı Yükle</button></div>" +
      '<div class="tabs" role="tablist"><button data-os="ios">iPhone / iPad</button><button data-os="android">Android</button><button data-os="desktop">Bilgisayar</button></div>' +
      '<div class="card" data-pane="ios"><h3>iPhone ve iPad (Safari)</h3><ol class="steps">' +
      "<li>Bu sayfayı <b>Safari</b> ile açın (Chrome’da da iOS 16.4+ ile aynı adımlar geçerlidir).</li>" +
      '<li>Alttaki <span class="kbd">' + I.iosShare + "Paylaş</span> düğmesine dokunun.</li>" +
      '<li>Listeyi aşağı kaydırıp <span class="kbd">' + I.plusSq + "Ana Ekrana Ekle</span> seçeneğine dokunun.</li>" +
      "<li>İsim olarak <b>Aykut Tosun</b> görünecek; sağ üstteki <b>Ekle</b>’ye dokunun.</li>" +
      "<li>Ana ekranınızdaki Aykut Tosun logosuna dokunarak uygulamayı açın.</li></ol></div>" +
      '<div class="card" data-pane="android"><h3>Android (Chrome)</h3><ol class="steps">' +
      "<li>Bu sayfayı <b>Chrome</b> ile açın.</li>" +
      "<li>Yukarıda <b>“Uygulamayı Yükle”</b> düğmesi görünüyorsa dokunun — işlem tamam.</li>" +
      '<li>Görünmüyorsa sağ üstteki <span class="kbd">' + I.dots + "</span> menüsüne dokunun.</li>" +
      '<li><span class="kbd">Uygulamayı yükle</span> ya da <span class="kbd">Ana ekrana ekle</span> seçeneğini seçin ve onaylayın.</li>' +
      "<li>Samsung Internet’te: menü → <b>Sayfayı ekle</b> → <b>Ana ekran</b>.</li></ol></div>" +
      '<div class="card" data-pane="desktop"><h3>Bilgisayar (Chrome / Edge)</h3><ol class="steps">' +
      '<li>Adres çubuğunun sağındaki <span class="kbd">' + I.dl + "Yükle</span> simgesine tıklayın.</li>" +
      "<li>Ya da menüden <b>Uygulamaları yönet → Bu siteyi uygulama olarak yükle</b>’yi seçin.</li>" +
      "<li>Telefonunuza eklemek için aşağıdaki QR kodu telefon kameranızla okutun.</li></ol>" +
      '<div id="qr" class="qr mt" aria-label="Site adresi QR kodu"></div><p class="center muted" style="font-size:.85rem;word-break:break-all;margin-top:8px">' + esc(location.origin + "/") + "</p></div>" +
      '<div class="note mt"><b>Neden ekleyeyim?</b> Tam ekran, adres çubuğu olmadan açılır; daha önce açtığınız yazı, şiir ve sözler internet olmadan da okunabilir; ana ekranda simgesiyle her an elinizin altında olur.</div>' +
      '<div class="listen"><button class="btn" id="shareSite">' + I.share + "Bu bağlantıyı paylaş</button></div>" +
      '</div><div><div class="phone"><div class="phone-screen"><i></i><i></i><i></i><i></i><i></i><i></i><em class="me"><img src="/icons/icon-192.png" alt="">A. Tosun</em><i></i><i></i><i></i><i></i><i></i></div></div></div>' +
      "</div></div></section>";
  };

  P.notfound = function () {
    return pageHead("Sayfa bulunamadı", "Aradığınız sayfa taşınmış olabilir.") + '<section class="section"><div class="wrap center"><a class="btn btn-gold" href="/">Ana Sayfaya Dön</a></div></section>';
  };

  // ---------- Sayfa sonrası bağlamalar ----------
  function after(route, param) {
    // video tıklayınca yükle
    $$(".video[data-pl]").forEach(function (v) {
      $(".video-ph", v).addEventListener("click", function () {
        v.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/videoseries?list=' + v.dataset.pl + '&autoplay=1&rel=0" title="YouTube oynatma listesi" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
      });
    });
    // yazı boyutu
    $$("[data-fs]").forEach(function (b) {
      b.addEventListener("click", function () {
        var v = Math.min(1.5, Math.max(0.85, (parseFloat(store.get("td-rs")) || 1.08) + 0.08 * +b.dataset.fs));
        store.set("td-rs", v); document.documentElement.style.setProperty("--rs", v);
      });
    });
    var sh = $("[data-share]"); if (sh) sh.addEventListener("click", function () { share(document.title, ""); });
    // risale içindekiler: bölüme kaydır (hash yönlendirmesini bozmadan)
    $$("[data-goto]").forEach(function (b) {
      b.addEventListener("click", function () { var el = document.getElementById(b.dataset.goto); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); });
    });
    // sözler
    $$("[data-share-soz]").forEach(function (b) {
      b.addEventListener("click", function () { var i = b.dataset.shareSoz; var s = i === "" ? $("#dailySoz").textContent : D.sozler[+i]; share("Aykut Tosun", "“" + s + "” — Aykut Tosun"); });
    });
    $$("[data-copy-soz]").forEach(function (b) { b.addEventListener("click", function () { copy("“" + D.sozler[+b.dataset.copySoz] + "” — Aykut Tosun"); }); });
    var q = $("#sozSearch");
    if (q) {
      var norm = function (s) { return s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, ""); };
      q.addEventListener("input", function () {
        var t = norm(q.value.trim()), n = 0;
        $$(".soz").forEach(function (f) { var ok = !t || norm(D.sozler[+f.dataset.i]).indexOf(t) > -1; f.hidden = !ok; if (ok) n++; });
        $("#sozEmpty").hidden = n > 0;
      });
      $("#sozRandom").addEventListener("click", function () {
        q.value = ""; q.dispatchEvent(new Event("input"));
        var all = $$(".soz"), f = all[Math.floor(Math.random() * all.length)];
        f.scrollIntoView({ behavior: "smooth", block: "center" });
        f.style.borderColor = "var(--gold)"; f.style.boxShadow = "0 0 0 3px rgba(212,175,106,.35)";
        setTimeout(function () { f.style.borderColor = ""; f.style.boxShadow = ""; }, 2000);
      });
    }
    // uygulama sayfası
    if (route === "uygulama") {
      var ua = navigator.userAgent, isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      var os = isIOS ? "ios" : /Android/i.test(ua) ? "android" : "desktop";
      var setOS = function (o) { $$(".tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.os === o); }); $$("[data-pane]").forEach(function (p) { p.hidden = p.dataset.pane !== o; }); };
      $$(".tabs button").forEach(function (b) { b.addEventListener("click", function () { setOS(b.dataset.os); }); });
      setOS(os);
      if (deferredPrompt) $("#installNative").hidden = false;
      $("#installBtn").addEventListener("click", doInstall);
      $("#shareSite").addEventListener("click", function () { share("Aykut Tosun", "Aykut Tosun sitesini telefonunuza uygulama olarak ekleyin:"); });
      loadQR();
    }
  }

  function loadQR() {
    var el = $("#qr"); if (!el) return;
    var draw = function () { try { el.innerHTML = ""; new window.QRCode(el, { text: location.origin + "/", width: 160, height: 160, colorDark: "#0b2338", colorLight: "#ffffff" }); } catch (e) { el.hidden = true; } };
    if (window.QRCode) return draw();
    var s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    s.onload = draw; s.onerror = function () { el.hidden = true; };
    document.head.appendChild(s);
  }

  // ---------- Sunucu tarafı sayfa üretimi (tools/build.js) için dışa aktarım ----------
  if (window.__PRERENDER) { window.TDP = { P: P, D: D, RS: RS, esc: esc, excerpt: excerpt }; return; }

  // ---------- Yönlendirici (gerçek adresler: /makale/slug/) ----------
  var titles = { home: "", "aykut-tosun": "Aykut Tosun", sohbetler: "Sohbetler", podcastler: "Podcastler", etkinlikler: "Etkinlikler", kitaplar: "Kitaplar", yazilar: "Yazılar", makaleler: "Makaleler", denemeler: "Denemeler", siirler: "Şiirler", sozler: "Sözler", iletisim: "İletişim", uygulama: "Mobil Uygulama" };
  var tabOf = { home: "home", sohbetler: "sohbetler", sohbet: "sohbetler", podcastler: "sohbetler", yazilar: "yazilar", makaleler: "yazilar", makale: "yazilar", denemeler: "yazilar", deneme: "yazilar", siirler: "yazilar", siir: "yazilar", sozler: "sozler" };
  function parts() {
    var p = decodeURIComponent(location.pathname).replace(/index\.html$/, "").replace(/^\/+|\/+$/g, "");
    return p ? p.split("/") : [];
  }
  var first = true;
  function route() {
    var h = parts();
    var r = h[0] || "home", param = h[1];
    var fn = P[r] || P.notfound;
    var key = "/" + (h.length ? h.join("/") + "/" : "");
    // Sayfa sunucudan hazır geldiyse (Google için üretilmiş HTML) tekrar çizme; ana sayfa günün sözü için her zaman yenilenir
    var pre = first && main.getAttribute("data-route") === key && r !== "home" && r !== "uygulama";
    if (!pre) main.innerHTML = '<div class="fade">' + fn(param) + "</div>";
    main.setAttribute("data-route", key);
    if (!first) {
      var t = titles[r];
      if (param) { var hd = $(".page-head h1"); t = hd ? hd.textContent : t; }
      document.title = (t ? t + " | " : "") + "Aykut Tosun";
    }
    $$("[data-nav]").forEach(function (a) { a.classList.toggle("on", a.dataset.nav === r || (r === "sohbet" && a.dataset.nav === "sohbetler") || (/^(makale|deneme|makaleler|denemeler)$/.test(r) && a.dataset.nav === "yazilar") || (r === "siir" && a.dataset.nav === "siirler") || (r === "risale" && a.dataset.nav === "kitaplar")); });
    $$("[data-tab]").forEach(function (a) { a.classList.toggle("on", a.dataset.tab === tabOf[r]); });
    $$(".drawer nav a").forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") === key); });
    document.body.classList.remove("menu-open");
    if (!first) window.scrollTo(0, 0);
    first = false;
    after(r, param);
  }
  function go(path) {
    if (path !== location.pathname) history.pushState(null, "", path);
    route();
  }
  // Site içi bağlantıları sayfayı yeniden yüklemeden aç
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target || a.hasAttribute("download")) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) !== "/" || href.charAt(1) === "/") return;
    if (/\.[a-z0-9]{2,5}$/i.test(href.split(/[?#]/)[0])) return; // dosyalar (pdf, png…) normal açılsın
    e.preventDefault(); go(href);
  });
  window.addEventListener("popstate", route);
  // Eski "#/..." bağlantıları yeni adreslere taşı
  if (/^#\/./.test(location.hash)) {
    var old = location.hash.replace(/^#\/?/, "").replace(/\/+$/, "");
    history.replaceState(null, "", "/" + old + "/");
  }

  // ---------- Menü, tema ----------
  function toggleMenu(open) { document.body.classList.toggle("menu-open", open); $("#menuBtn").setAttribute("aria-expanded", open); }
  $("#menuBtn").addEventListener("click", function () { toggleMenu(true); });
  $("#tabMenu").addEventListener("click", function () { toggleMenu(true); });
  $("#closeDrawer").addEventListener("click", function () { toggleMenu(false); });
  $("#drawerBg").addEventListener("click", function () { toggleMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") toggleMenu(false); });

  var th = store.get("td-theme"); if (th) document.documentElement.dataset.theme = th;
  $("#themeBtn").addEventListener("click", function () {
    var dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    var n = dark ? "light" : "dark"; document.documentElement.dataset.theme = n; store.set("td-theme", n);
  });
  var rs = store.get("td-rs"); if (rs) document.documentElement.style.setProperty("--rs", rs);
  $("#yr").textContent = new Date().getFullYear();

  // ---------- Okuma ilerleme çubuğu ----------
  var bar = document.createElement("div"); bar.className = "progress"; document.body.appendChild(bar);
  window.addEventListener("scroll", function () {
    if (!$(".reader")) { bar.style.width = 0; return; }
    var h = document.documentElement; bar.style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight) * 100) + "%";
  }, { passive: true });

  // ---------- PWA: kurulum ----------
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferredPrompt = e;
    var n = $("#installNative"); if (n) n.hidden = false;
    var go = $("#toastGo"); if (go) { go.textContent = "Yükle"; go.setAttribute("href", "/uygulama/"); go.onclick = function (ev) { ev.preventDefault(); doInstall(); }; }
  });
  function doInstall() {
    if (!deferredPrompt) { go("/uygulama/"); return; }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function (c) { if (c.outcome === "accepted") { toast("Uygulama yüklendi"); hideToast(true); } deferredPrompt = null; });
  }
  window.addEventListener("appinstalled", function () { hideToast(true); });

  var standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  function hideToast(forever) { $("#installToast").hidden = true; if (forever) store.set("td-toast", "x"); }
  $("#toastClose").addEventListener("click", function () { hideToast(true); });
  $("#toastGo").addEventListener("click", function () { hideToast(false); });
  var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!standalone && isMobile && !store.get("td-toast")) setTimeout(function () { if (location.pathname.indexOf("uygulama") < 0) $("#installToast").hidden = false; }, 4000);

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () {
      // updateViaCache:'none' → tarayıcı sw.js dosyasını kendi önbelleğinden almaz, her açılışta yenisini kontrol eder
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(function (reg) {
        reg.update();
        // uygulama arka plandan öne geldiğinde de güncelleme kontrolü
        document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") reg.update(); });
      }).catch(function () {});
    });
    // Not: Otomatik sayfa yenileme kaldırıldı (titremeye yol açıyordu).
    // Service worker "önce ağ" çalıştığı için sayfa zaten her açılışta güncel dosyaları alır.
  }

  route();
})();
