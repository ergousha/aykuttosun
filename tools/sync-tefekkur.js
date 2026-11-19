#!/usr/bin/env node
/*
  tefekkurdenizi.com -> assets/data.js eşitleyici
  ------------------------------------------------
  Kullanım:
    node tools/sync-tefekkur.js            # assets/data.js dosyasını günceller
    node tools/sync-tefekkur.js --dry      # yalnızca rapor yazar, dosyaya dokunmaz
    node tools/sync-tefekkur.js --daily    # yalnızca ana sayfadaki günün ayeti / hadisi / sözünü eşitler

  Ortam değişkenleri (isteğe bağlı):
    REPORT_FILE      Raporun yazılacağı dosya (varsayılan: işletim sisteminin geçici klasörü)

  Harici bir yapay zekâ servisi kullanılmaz; tüm biçimlendirme deterministiktir.

  Ne yapar?
   - Yeni makale / deneme / şiir  -> ilgili listenin sonuna ekler. Liste sayfasındaki bağlantı izlenir;
                                     bağlantı PDF ise metin PDF'ten çıkarılır (pdftotext / poppler-utils gerekir) ve
                                     sayfada "PDF olarak indir" bağlantısı gösterilir.
   - Yeni söz                     -> "sozler" listesinin sonuna ekler
   - Etkinlikler                  -> yaklaşan etkinlik listesini kaynakla eşitler
   - Biyografi / risale sayısı    -> değişmişse yalnızca RAPORLAR (elle inceleme gerekir)
  --daily kipi yalnızca ana sayfadaki "Günün Ayeti", "Günün Hadis-i Şerifi" ve "Aykut Tosun'dan"
  (günün sözü) alanlarını okuyup data.js içindeki ayet / hadis / gununSozu değerlerine yazar.
  Hiçbir şeyi silmez (yaklaşan etkinlikler hariç). Bir değişiklik yoksa dosyaya dokunmaz.
  Çıktı: stdout'un son satırı "CHANGED=true|false" (GitHub Actions bunu okur).
*/
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const os = require("os");
const { execFileSync } = require("child_process");

const BASE = "https://www.tefekkurdenizi.com";
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "assets/data.js");
const DRY = process.argv.includes("--dry");
const DAILY = process.argv.includes("--daily");
const REPORT_FILE = process.env.REPORT_FILE || path.join(os.tmpdir(), "tefekkur-sync-report.md");

// ---------- Yardımcılar ----------
const TR = { İ: "i", I: "i", ı: "i", Ö: "o", ö: "o", Ü: "u", ü: "u", Ş: "s", ş: "s", Ç: "c", ç: "c", Ğ: "g", ğ: "g", Â: "a", â: "a", Î: "i", î: "i", Û: "u", û: "u" };
const fold = (s) => String(s).replace(/[İIıÖöÜüŞşÇçĞğÂâÎîÛû]/g, (c) => TR[c]).toLowerCase().replace(/\u0307/g, "");
const norm = (s) => fold(s).replace(/[^a-z0-9]+/g, "");
// İmza ("Aykut Tosun / 16.11.2026") sırası değişebilir; karşılaştırmada yok sayılır.
const normBody = (s) => norm(s).split("aykuttosun").join("");
const slugify = (s) => fold(s).replace(/['’ʼ`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { added: [], review: [], notes: [] };

// Wix (özellikle GitHub Actions IP'lerinden) art arda isteklerde 429 verir: istekleri arala,
// 429'da Retry-After'a uy ve uzun bekle.
let lastReq = 0;
async function get(url, { allow404 = false, binary = false } = {}) {
  const TRIES = 7;
  for (let i = 0; i < TRIES; i++) {
    const wait = lastReq + 1200 - Date.now();
    if (wait > 0) await sleep(wait);
    lastReq = Date.now();
    let status = 0, retryAfter = 0;
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (aykuttosun-sync)" }, redirect: "follow" });
      status = r.status;
      if (r.status === 404 && allow404) return null;
      if (r.ok) return binary ? Buffer.from(await r.arrayBuffer()) : await r.text();
      retryAfter = parseInt(r.headers.get("retry-after") || "0", 10) || 0;
      if (i === TRIES - 1) throw new Error("HTTP " + r.status);
    } catch (e) {
      if (i === TRIES - 1) throw new Error(url + " alınamadı: " + e.message);
    }
    await sleep(status === 429 ? Math.max(retryAfter * 1000, 15000 * (i + 1)) : 2000 * (i + 1));
  }
}
const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", sbquo: "‚", bdquo: "„",
  hellip: "…", ndash: "–", mdash: "—", middot: "·", bull: "•", laquo: "«", raquo: "»", copy: "©", reg: "®", trade: "™"
};
// Latin harfleri (ör. uuml, Ccedil, acirc): temel harf + vurgu adından çöz
const ACC = { uml: "\u0308", acute: "\u0301", grave: "\u0300", circ: "\u0302", cedil: "\u0327", tilde: "\u0303", ring: "\u030a", caron: "\u030c", breve: "\u0306" };
function named(n) {
  if (NAMED[n] !== undefined) return NAMED[n];
  const m = n.match(/^([A-Za-z])(uml|acute|grave|circ|cedil|tilde|ring|caron|breve)$/);
  if (m) return (m[1] + ACC[m[2]]).normalize("NFC");
  if (n === "szlig") return "ß";
  return null;
}
const unent = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (m, g) => {
  if (g[0] === "#") { const n = g[1].toLowerCase() === "x" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10); return String.fromCodePoint(n); }
  const r = named(g);
  if (r === null) { report.notes.push("Çözülemeyen HTML varlığı: " + m); return m; }
  return r;
});
// Wix sayfasının görünen metni; satır = blok
// keepHead: "Giriş Yapınız" öncesini (menü + başlık alanı) atma — ana sayfada günün ayeti oraya taşındı.
function pageLines(html, keepHead = false) {
  html = html.replace(/<(script|style|svg|noscript)[\s\S]*?<\/\1>/gi, "").replace(/<\/?(br|p|h\d|div|li|span|a|section|article|header|footer)\b[^>]*>/gi, "\n");
  const t = unent(html.replace(/<[^>]+>/g, ""));
  const lines = t.split("\n").map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim());
  const i = lines.findIndex((l) => l === "Giriş Yapınız");
  let body = i >= 0 && !keepHead ? lines.slice(i + 1) : lines;
  // Başlıktaki logo metni de "Tefekkür Denizi İrfan Okulu"; alt bilgiyi "Giriş Yapınız"dan sonra ara.
  const from = keepHead ? Math.max(i, 0) : -1;
  const end = body.findIndex((l, k) => k > from && (l === "Tefekkür Denizi İrfan Okulu" || l.startsWith("© ")));
  if (end >= 0) body = body.slice(0, end);
  return body; // boş ve \u200b (Wix'in kıta ayırıcısı) satırları korunur
}
const cleanLine = (l) => l.replace(/[\u200b\u200c\u200d\ufeff]/g, "").trim();

// ---------- data.js oku / yaz ----------
const src = fs.readFileSync(DATA, "utf8");
const sb = { window: {} };
vm.createContext(sb);
vm.runInContext(src, sb);
const D = sb.window.TD;
const HEAD = src.slice(0, src.indexOf("window.TD"));
const TAIL = src.slice(src.lastIndexOf("}") + 1);
let dirty = false;

// İmzayı "Aykut TOSUN\nGG.AA.YYYY" biçimine getir (kaynakta "Aykut Tosun / 16.11.2026" gibi gelir).
function fixSignature(body) {
  const m = body.match(/\s*(?:Aykut\s+Tosun\s*\/?\s*(\d{2}\.\d{2}\.\d{4})|(\d{2}\.\d{2}\.\d{4})\s*\/?\s*Aykut\s+Tosun)\s*$/i);
  if (!m) return body;
  return body.slice(0, m.index).replace(/\s+$/, "") + "\n\nAykut TOSUN\n" + (m[1] || m[2]);
}

// Deterministik biçimlendirme: Wix'te şiirde kıta ayırıcı yalnızca \u200b içeren satırdır;
// diğer boş satırlar yalnızca blok ayracıdır.
function plainFormat(kind, lines) {
  const first = lines.findIndex((l) => cleanLine(l));
  const out = [];
  let gap = false;
  for (const raw of lines.slice(first + 1)) {
    const l = cleanLine(raw);
    if (!l) { if (/\u200b/.test(raw)) gap = true; continue; }
    out.push({ l, gap });
    gap = false;
  }
  const body = kind === "siirler"
    ? out.map((x, i) => (i ? (x.gap ? "\n\n" : "\n") : "") + x.l).join("")
    : out.map((x) => x.l).join("\n\n");
  return fixSignature(body);
}

function format(kind, lines, listTitle) {
  return { title: listTitle, body: plainFormat(kind, lines), how: "deterministik" };
}

// ---------- PDF ----------
// Arap harfli satırlar (âyet/hadis asılları): PDF metin katmanında harf sırası bozuk çıkar, alınmaz.
// "ﷺ" gibi tek tük işaretler içeren Türkçe satırlar korunur.
const ARABIC_LETTER = /[؀-ۿݐ-ݿﭐ-ﷹﷻ-﷿ﹰ-﻿]/gu;
const isArabicLine = (l) => { const ar = (l.match(ARABIC_LETTER) || []).length, all = (l.match(/\p{L}/gu) || []).length; return ar > 0 && ar >= all * 0.5; };
const BIDI = /[‎‏‪-‮⁦-⁩]/g;

function pdftotext(buf, args) {
  const f = path.join(os.tmpdir(), "tefekkur-" + process.pid + ".pdf");
  fs.writeFileSync(f, buf);
  try { return execFileSync("pdftotext", ["-enc", "UTF-8", ...args, f, "-"], { encoding: "utf8", maxBuffer: 64 << 20 }); }
  catch (e) { throw new Error("pdftotext çalıştırılamadı (poppler-utils kurulu mu?): " + e.message); }
  finally { fs.rmSync(f, { force: true }); }
}

// Bağ harfleri (ff, fi, fl, ffi, ffl): bazı PDF'lerin metin katmanında bu glifler kelimeden kopar ve
// sayfa sonuna ayrı "kelime" olarak düşer ("Mağfiret" -> "Mağ ret" + "fi", "affetmek" -> "af etmek" + "ff").
// Kelime konumlarından (pdftotext -bbox) satırdaki normal boşluktan belirgin geniş boşlukları bulur;
// her boşluğa, sayfada kopmuş bağ harflerinden hangisinin geleceğini sitenin kendi metinlerinde
// (data.js, risaleler.js, PDF'in kendisi) geçen kelime başlarıyla seçer. Sayfadaki kopuk glif
// sayısından fazlası asla uygulanmaz; karar verilemeyen boşluklar "geri konamadı" olarak raporlanır.
const LIGS = ["ffi", "ffl", "ff", "fi", "fl"];
const LIG_RE = /^(ffi|ffl|ff|fi|fl)$/;
function buildVocab(...texts) {
  const pre = new Set();
  for (const t of texts) for (const w of fold(t).split(/[^a-z0-9]+/)) for (let i = 4; i <= w.length; i++) pre.add(w.slice(0, i));
  return pre;
}
function repairLigatures(buf, text, vocab) {
  const html = pdftotext(buf, ["-bbox"]);
  const fixes = [];
  let orphans = 0, unresolved = 0;
  // Birleşmiş kelimenin bağ harfinden sonraki ilk harfe kadar olan başı sözlükte var mı?
  const known = (left, lig, right) => { const w = fold(left + lig + right).replace(/[^a-z0-9]/g, ""); const n = Math.max(4, fold(left).replace(/[^a-z0-9]/g, "").length + lig.length + 1); return w.length >= n && vocab.has(w.slice(0, n)); };
  const lastWord = (t) => (t.match(/[\p{L}]+$/u) || [""])[0];
  const firstWord = (t) => (t.match(/^[\p{L}]+/u) || [""])[0];
  for (const pg of html.split("<page ").slice(1)) {
    const words = [...pg.matchAll(/xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</g)]
      .map((m) => ({ x0: +m[1], y: Math.round(+m[2] * 10) / 10, x1: +m[3], h: +m[4] - +m[2], t: unent(m[5]) }));
    const count = new Map();
    for (const w of words) if (LIG_RE.test(w.t)) count.set(w.t, (count.get(w.t) || 0) + 1);
    if (!count.size) continue;
    const pageOrphans = [...count.values()].reduce((x, y) => x + y, 0);
    orphans += pageOrphans;
    const lines = new Map();
    for (const w of words) {
      if (LIG_RE.test(w.t) || isArabicLine(w.t)) continue;
      if (!lines.has(w.y)) lines.set(w.y, []);
      lines.get(w.y).push(w);
    }
    const rows = [...lines.keys()].sort((a, b) => a - b).map((y) => lines.get(y).sort((a, b) => a.x0 - b.x0));
    const lowMedian = (xs, min = 0.5) => { const v = xs.filter((g) => g > min).sort((a, b) => a - b); return v[Math.floor((v.length - 1) / 2)]; };
    // Boşluğun yazı yüksekliğine oranı sayfada sabittir; kısa satırlarda (başlık, iki-üç kelime) bunu kullan
    const rowH = (ws) => Math.max(...ws.map((w) => w.h));
    const spaceRatio = lowMedian(rows.filter((ws) => ws.length >= 4 && rowH(ws) > 2).map((ws) => lowMedian(ws.slice(1).map((w, i) => w.x0 - ws[i].x1)) / rowH(ws)), 0);
    const cands = [];
    for (const ws of rows) {
      const gaps = ws.slice(1).map((w, i) => w.x0 - ws[i].x1);
      // Satırın normal boşluğu: alt medyan; 3'ten az boşluklu satırda yazı yüksekliğine göre beklenen boşluk
      const space = gaps.filter((g) => g > 0.5).length >= 3 ? lowMedian(gaps) : spaceRatio * rowH(ws);
      if (!space) continue;
      gaps.forEach((g, i) => {
        const a = ws[i], b = ws[i + 1], r = g / space;
        if (/^(\d{1,2}\.|\[\d+\])$/.test(a.t)) return; // liste numarası ardından gelen sekme boşluğu
        if (r >= 1.6 && r < 4.2) cands.push({ a: a.t, b: b.t, r });
      });
    }
    // Her aday için sözlüğün desteklediği seçenekler: kelime içi (a+lig+b) ya da sonraki kelimenin başı (a lig+b)
    for (const c of cands) {
      c.opts = [];
      for (const lig of LIGS) {
        if (!count.get(lig)) continue;
        if (known(lastWord(c.a), lig, firstWord(c.b))) c.opts.push({ lig, start: false });
        // Dar boşluk (~2,2 kat) kelime içidir; kelime başı seçeneği yalnızca geniş boşlukta düşünülür
        if (c.r >= 2.65 && known("", lig, firstWord(c.b))) c.opts.push({ lig, start: true });
      }
    }
    const take = (c, o) => { c.lig = o.lig; c.start = o.start; count.set(o.lig, count.get(o.lig) - 1); };
    // 1) Tek ve kesin seçeneği olanlar
    for (const c of cands) if (c.opts.length === 1 && count.get(c.opts[0].lig) > 0) take(c, c.opts[0]);
    // 2) Birden çok seçenekli olanlar: boşluk oranına uyan (kelime içi ~2,2; kelime başı ~3,2), kalan glif sayısına göre
    for (const c of cands) {
      if (c.lig) continue;
      const fit = c.opts.filter((o) => count.get(o.lig) > 0 && o.start === (c.r >= 2.65));
      if (fit.length === 1) take(c, fit[0]);
    }
    // 3) Sözlüğün tanımadığı adaylar: sayfada tek tür glif kaldıysa ve sayılar tutuyorsa o glif
    const left = [...count].filter(([, n]) => n > 0);
    const rest = cands.filter((c) => !c.lig && c.r < 3.8);
    if (left.length === 1 && rest.length === left[0][1]) for (const c of rest) take(c, { lig: left[0][0], start: c.r >= 2.65 });
    const applied = cands.filter((c) => c.lig);
    unresolved += pageOrphans - applied.length;
    fixes.push(...applied);
  }
  // Düz metinde sırayla uygula (tam kelime eşleşmesi: "ile il" "ile ilmin" içinde bulunmasın)
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let out = "", cur = 0;
  for (const c of fixes) {
    const re = new RegExp("(?<![\\p{L}\\p{N}])" + esc(c.a) + " " + esc(c.b) + "(?![\\p{L}\\p{N}])", "gu");
    re.lastIndex = cur;
    const m = re.exec(text);
    if (!m) { unresolved++; continue; }
    out += text.slice(cur, m.index) + c.a + (c.start ? " " + c.lig : c.lig) + c.b;
    cur = m.index + m[0].length;
  }
  out += text.slice(cur);
  // Kopmuş bağ harflerinin metindeki yalnız kopyalarını at
  out = out.replace(/^[ \t]*((ffi|ffl|ff|fi|fl)[ \t]*)+$/gm, "");
  return { text: out, orphans, fixed: fixes.length, unresolved: Math.max(0, unresolved) };
}

// PDF'ten deterministik biçimlendirme: pdftotext sürümleri boş satırları farklı üretir, bu yüzden
// paragraflar satır geometrisinden çıkarılır: tam genişlikte olmayan ve cümle sonu ile biten
// satır paragrafı bitirir. Başlıklar "## " ile işaretlenir; Arapça satırlar, kopmuş bağ harfleri
// ("fi"), belge başlığı ve yazar satırı atılır.
const HEADING = /^(Giriş|Sonuç|Kaynakça|Kaynak Notları|Kaynaklar|Hadis Kaynakları|Klasik Eserler.*|Kur'?[aâ]n[-ıi ]*(Kerîm)?|\d{1,2}\.\s+\p{Lu}[^.]*)$/u;
function plainPdf(text, title) {
  let lines = text.replace(/\f/g, "\n").replace(BIDI, "").split("\n").map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && !isArabicLine(l) && !/^((ffi|ffl|ff|fi|fl)\s*)+$/.test(l));
  // Belge başı: başlık satırları ve yazar adı
  const nt = norm(title);
  while (lines.length && nt.includes(norm(lines[0])) && norm(lines[0])) lines.shift();
  lines = lines.filter((l, i) => !(i < 4 && norm(l) === "aykuttosun"));
  const lens = lines.map((l) => l.length).sort((x, y) => x - y);
  const full = lens[Math.floor(lens.length * 0.9)] || 90; // tipik tam satır genişliği
  const paras = [];
  let cur = [], heading = false;
  const flush = () => { if (cur.length) paras.push((heading ? "## " : "") + cur.join(" ").replace(/(\p{L})- (\p{Ll})/gu, "$1$2")); cur = []; heading = false; };
  const NAMED_HEADING = /^(Giriş|Sonuç|Kaynakça|Kaynak Notları|Kaynaklar|Hadis Kaynakları)$/;
  const inRefs = () => /^## (Kaynak|Hadis Kaynakları|Klasik)/.test(paras.filter((p) => p.startsWith("## ")).pop() || "");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], next = lines[i + 1] || "";
    if (NAMED_HEADING.test(l)) flush();
    const numbered = /^\d{1,2}\.\s+\p{Lu}/u.test(l);
    // Başlık: numaralı bölüm başlığı ya da paragraf başında, kısa, noktalamasız ve büyük harfle başlayan satır
    const shortTitle = !numbered && norm(l) !== "aykuttosun" && !/^Tefekkür Denizi/.test(l) && l.length < full * 0.7 && /^\p{Lu}/u.test(l) && !/[.,;:!?”")\]»…]$/.test(l) && next && !/^\p{Ll}/u.test(next);
    if (!cur.length && !inRefs() && (NAMED_HEADING.test(l) || (numbered && HEADING.test(l)) || shortTitle) && l.length < full * 0.98) {
      cur.push(l); heading = true;
      // başlık sonraki satıra taşmışsa (ör. "… Rahmet, İlim ve" + "Değişim İradesi", "… Yeterli" + "midir?")
      if (numbered && next.length < 40 && !/[.:;]$/.test(next) && !HEADING.test(next)) cur.push(lines[++i]);
      flush(); continue;
    }
    if (!cur.length && inRefs() && (shortTitle || NAMED_HEADING.test(l))) { cur.push(l); heading = true; flush(); continue; }
    // kaynakça maddeleri: her "[n]" / "n." ayrı paragraf
    if (cur.length && inRefs() && /^(\[\d+\]|\d{1,2}\.)(\s|$)/.test(l) && !/^\d{1,2}\.$/.test(cur[cur.length - 1])) flush();
    // Küçük harfle başlayan "paragraf" bir öncekinin devamıdır (Arapça blok / sayfa sonu kesintisi)
    if (!cur.length && /^\p{Ll}/u.test(l) && paras.length && !paras[paras.length - 1].startsWith("## ")) { cur.push(paras.pop()); }
    cur.push(l);
    if (/^\d{1,2}\.$/.test(l)) continue; // "5." tek başına: madde numarası, devamı sonraki satır
    if (l.length < full * 0.85 && /[.!?:”")\]»…]$/.test(l)) flush();
  }
  flush();
  let body = paras.join("\n\n").replace(/\n\n(Tefekkür Denizi İrfan Okulu\s*\/\s*)/, " $1").replace(/Tefekkür Denizi İrfan Okulu\s*\/\s*(\d{2}\.\d{2}\.\d{4})/, "$1");
  return fixSignature(body);
}
function formatPdf(kind, buf, listTitle, url) {
  const raw = pdftotext(buf, []);
  if (norm(raw).length < 200) throw new Error("PDF'ten metin çıkmadı (taranmış görüntü olabilir): " + url);
  // Sözlük: sitenin mevcut metinleri + risaleler + PDF'in kendisi
  let ris = "";
  try { ris = fs.readFileSync(path.join(ROOT, "assets/risaleler.js"), "utf8"); } catch (e) { /* yoksa yalnızca data.js */ }
  const lg = repairLigatures(buf, raw, buildVocab(JSON.stringify(D), ris, raw, listTitle));
  return { title: listTitle, body: plainPdf(lg.text, listTitle), how: "PDF", lig: lg };
}

// ---------- 1) Makale / deneme / şiir ----------
// Liste sayfasındaki "- Başlık" bağlantılarını (başlık, adres) olarak çıkar
function listLinks(html) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const t = cleanLine(unent(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " "));
    if (t.startsWith("- ")) out.push({ title: t.slice(2).trim(), href: unent(m[1]) });
  }
  return out;
}
const sameTitle = (a, b) => { const x = norm(a), y = norm(b); return x === y || (Math.min(x.length, y.length) > 15 && (x.includes(y) || y.includes(x))); };

async function syncArticles() {
  const lists = { makaleler: "makaleler", denemeler: "denemeler", siirler: "şiirler" };
  for (const [key, livePath] of Object.entries(lists)) {
    const html = await get(BASE + "/" + encodeURI(livePath));
    const liveTitles = pageLines(html).map(cleanLine).filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim());
    if (!liveTitles.length) throw new Error(`${livePath} sayfasında liste bulunamadı (site yapısı değişmiş olabilir)`);
    const links = listLinks(html);
    const have = D[key];
    for (const t of liveTitles) {
      if (have.some((x) => sameTitle(x.title, t))) continue;
      const link = links.find((l) => norm(l.title) === norm(t));
      if (!link) { report.review.push(`"${t}" (${key}) listede var ama bağlantısı bulunamadı; elle ekleyin.`); continue; }
      const url = new URL(link.href, BASE + "/").href;
      let f, pdf = "";
      if (/\.pdf($|\?)/i.test(url)) {
        const buf = await get(url, { binary: true });
        f = formatPdf(key, buf, t, url);
        pdf = url;
        report.notes.push(`"${f.title}" kaynakta yalnızca PDF olarak yayımlanmış; metin PDF'ten alındı, sayfaya PDF indirme bağlantısı eklendi. Arap harfli âyet/hadis asılları sitede yer almıyor (PDF'te var). Kopmuş bağ harfi (ff/fi/fl/ffi): ${f.lig.orphans}, geri konan: ${f.lig.fixed}.`);
        report.review.push(`"${f.title}" PDF'ten aktarıldı; paragraf ve başlık bölünmesini kaynakla karşılaştırın.` + (f.lig.unresolved ? ` ${f.lig.unresolved} bağ harfi (ff/fi/fl/ffi) geri konamadı; "Mağ ret", "af etmek" gibi bölünmüş kelimeleri düzeltin.` : ""));
      } else {
        const lines = pageLines(await get(encodeURI(decodeURI(url))));
        if (lines.filter((l) => cleanLine(l)).length < 3) { report.review.push(`"${t}" sayfası boş görünüyor: ${url}`); continue; }
        // Başlığı farklı yazılmış ama gövdesi zaten bizde olan içerik tekrar eklenmesin
        const pb = normBody(lines.slice(1).join(" "));
        if (have.some((x) => pb.includes(normBody(x.body).slice(0, 120)))) continue;
        f = format(key, lines, t);
      }
      let slug = slugify(f.title), n = 2;
      while (have.some((x) => x.slug === slug)) slug = slugify(f.title) + "-" + n++;
      // Tarih: metindeki son "GG.AA.YYYY" (imza tarihi). Listedeki tüm yazılar tarihliyse en yeni başta olacak şekilde yerleştir.
      const dm = [...f.body.matchAll(/(\d{2})\.(\d{2})\.(\d{4})/g)].pop();
      const tarih = dm ? `${dm[3]}-${dm[2]}-${dm[1]}` : "";
      const item = Object.assign({ slug, title: f.title }, tarih ? { tarih } : {}, { body: f.body }, pdf ? { pdf } : {});
      if (tarih && have.length && have.every((x) => x.tarih)) {
        const at = have.findIndex((x) => x.tarih < tarih);
        have.splice(at < 0 ? have.length : at, 0, item);
      } else have.push(item);
      dirty = true;
      report.added.push(`**${f.title}** → \`${key}\` (\`/${key.replace(/ler$|lar$/, "")}/${slug}/\`) — kaynak: ${url}`);
    }
  }
}

// ---------- 2) Sözler ----------
async function syncSozler() {
  const known = new Set(D.sozler.map((s) => norm(s)));
  const live = [];
  for (let i = 1; i < 40; i++) {
    const h = await get(BASE + "/" + encodeURI(i === 1 ? "sozler" : "sözler-" + i), { allow404: true });
    if (!h) break;
    for (const l of pageLines(h).map(cleanLine)) {
      const m = l.match(/^["“](.+)["”]$/);
      if (m) live.push(m[1].trim());
    }
  }
  if (live.length < D.sozler.length - 5) { report.review.push(`Kaynakta yalnızca ${live.length} söz bulundu (bizde ${D.sozler.length}); söz sayfaları taranamadı, sözler atlandı.`); return; }
  for (const s of live) {
    if (known.has(norm(s))) continue;
    D.sozler.push(s); known.add(norm(s)); dirty = true;
    report.added.push(`Söz: “${s.slice(0, 90)}${s.length > 90 ? "…" : ""}”`);
  }
}

// ---------- 3) Etkinlikler ----------
function eventSlug(title) {
  const t = fold(title);
  if (t.includes("mesnevi")) return "mesnevi";
  if (t.includes("irfan sohbet")) return "irfan";
  if (t.includes("kelam")) return "kelam-i-kadim";
  if (t.includes("nutuk")) return "nutuklar";
  return null;
}
async function syncEtkinlikler() {
  const today = new Date().toISOString().slice(0, 10);
  const sm = await get(BASE + "/event-pages-sitemap.xml");
  const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const live = [];
  for (const u of urls) {
    const dm = u.match(/-(\d{4}-\d{2}-\d{2})-\d{2}-\d{2}$/); // ör. irfan-sohbetleri-2026-11-25-22-00
    if (dm && dm[1] < today) continue; // geçmiş etkinliğin sayfasını hiç indirme
    const h = await get(u, { allow404: true });
    if (!h) continue;
    const sd = h.match(/"startDate"\s*:\s*"(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (!sd || sd[1] < today) continue;
    const lines = pageLines(h).map(cleanLine).filter(Boolean);
    const title = lines[0] || "";
    const slug = eventSlug(title);
    if (!slug) { report.review.push(`Bilinmeyen etkinlik türü atlandı: "${title}" (${u})`); continue; }
    const loc = (h.match(/"VirtualLocation"[^}]*?"name"\s*:\s*"([^"]+)"/) || [])[1] || "";
    const yer = /youtube/i.test(loc) ? "YouTube" : /zoom/i.test(loc) ? "Zoom" : loc;
    // "20 Kas 2026 22:00 – 23:30"
    const rng = lines.join(" ").match(/\d{1,2} \p{L}{3} \d{4} (\d{2}:\d{2}) [–-] (\d{2}:\d{2})/u);
    live.push({ tarih: sd[1], saat: sd[2], bitis: rng ? rng[2] : "", slug, title: D.sohbetler.find((s) => s.slug === slug).title, yer });
  }
  live.sort((a, b) => (a.tarih + a.saat + a.slug).localeCompare(b.tarih + b.saat + b.slug));
  const mine = (D.etkinlikler || []).filter((e) => e.tarih >= today);
  const sig = (l) => JSON.stringify(l);
  if (sig(live) === sig(mine)) return;
  const key = (e) => e.tarih + e.slug;
  const added = live.filter((e) => !mine.some((m) => key(m) === key(e)));
  const removed = mine.filter((m) => !live.some((e) => key(e) === key(m)));
  D.etkinlikler = live;
  dirty = true;
  report.added.push(`Etkinlikler eşitlendi: ${live.length} yaklaşan etkinlik` + (added.length ? `, yeni: ${added.map((e) => e.tarih + " " + e.title).join("; ")}` : "") + (removed.length ? `, kaldırılan: ${removed.map((e) => e.tarih + " " + e.title).join("; ")}` : ""));
}

// ---------- 4) Yalnızca rapor: biyografi, risaleler ----------
async function checkReadOnly() {
  // Biyografi: bizdeki her paragraf kaynakta olmalı, kaynaktaki her satır bizde (bio + bioAyet) olmalı.
  // (İlk harf süslü baş harf olarak ayrı satırda gelir; ilk paragraf bu yüzden atlanır.)
  const bio = pageLines(await get(BASE + "/aykuttosun")).map(cleanLine).filter(Boolean).slice(1);
  const liveAll = norm(bio.join(" "));
  // "Nitekim Yüce Allah…" ara cümlesi assets/app.js içinde sabittir.
  const ours = norm("Nitekim Yüce Allah şöyle buyurmaktadır: " + D.bio.join(" ") + " " + Object.values(D.bioAyet || {}).join(" "));
  const missing = D.bio.slice(1).filter((p) => !liveAll.includes(norm(p)));
  const extra = bio.filter((l) => norm(l).length > 3 && !ours.includes(norm(l)));
  if (missing.length || extra.length) {
    report.review.push("Biyografi (/aykuttosun) kaynakla farklı; `bio`/`bioAyet` alanlarını elle karşılaştırın." +
      (extra.length ? " Kaynakta bizde olmayan satır: “" + extra[0].slice(0, 80) + "…”" : "") + (missing.length ? " Kaynakta artık olmayan paragraf sayısı: " + missing.length : ""));
  }
  const books = pageLines(await get(BASE + "/tasavvufi-eserler")).map(cleanLine).filter((l) => /^İrfan Risaleleri - \d+/.test(l));
  if (books.length !== D.risaleler.length) report.review.push(`Kaynakta ${books.length} İrfan Risalesi var, bizde ${D.risaleler.length}; yeni risale için kapak/PDF/metin elle eklenmeli.`);
}

// ---------- 5) Günlük: ana sayfadaki ayet / hadis / söz ----------
async function syncGunluk() {
  // Bölümlerin sırası değişebilir; iki düzen de desteklenir:
  //  eski: Günün Ayeti → Günün Hadisi → "Aykut Tosun'dan" başlıklı söz
  //  yeni (2026-11): Günün Ayeti (başlık alanında, "Giriş Yapınız" öncesi) → başlıksız söz + "- Aykut TOSUN" → Günün Hadisi
  const lines = pageLines(await get(BASE + "/"), true).map(cleanLine).filter(Boolean);
  const isSig = (l) => /^[-–—]\s*Aykut\s+Tosun$/i.test(l);
  // Bir bölümü bitiren satırlar: diğer bölüm başlıkları, logo metni ("Aykut Tosun"), giriş düğmesi, sohbet listesi, imza
  const STOP = /^(Günün Ayeti:?|Günün Hadis.*|Aykut Tosun'dan|Aykut Tosun|Giriş Yapınız|En Güncel Sohbetimiz)$/i;
  const block = (k) => { const out = []; for (; k < lines.length && !STOP.test(lines[k]) && !isSig(lines[k]); k++) out.push(lines[k]); return out; };
  const iA = lines.findIndex((l) => /^Günün Ayeti:?$/i.test(l));
  const iH = lines.findIndex((l) => /^Günün Hadis/i.test(l));
  const iS = lines.findIndex((l) => /^Aykut Tosun'dan$/i.test(l));
  const iSig = lines.findIndex(isSig);
  if (iA < 0 || iH < 0 || (iS < 0 && iSig < 0)) throw new Error("Ana sayfada günün ayeti/hadisi/sözü bölümleri bulunamadı (site yapısı değişmiş olabilir)");
  const fail = (m) => { throw new Error("Günlük içerik doğrulanamadı: " + m); };

  const a = block(iA + 1);
  if (a.length < 2) fail("ayet");
  const ayet = { kaynak: a[0], metin: a.slice(1).join(" ").replace(/\s+/g, " ") };
  // Site metnin başına ayet numarasını ekler ("106-) Biz …"); kaynakta zaten var, önekini at.
  const no = (ayet.kaynak.match(/(\d+)\s*$/) || [])[1];
  if (no) ayet.metin = ayet.metin.replace(new RegExp("^" + no + "\\s*-?\\)\\s*"), "");
  if (!/\d/.test(ayet.kaynak) || ayet.kaynak.length > 80 || ayet.metin.length < 15 || ayet.metin.length > 1500) fail("ayet biçimi");

  let h = block(iH + 1);
  let kaynak = "";
  const last = h[h.length - 1];
  if (last && /^\(.*\)$/.test(last)) { kaynak = last.slice(1, -1).trim(); h = h.slice(0, -1); }
  if (!kaynak || h.length < 2) fail("hadis kaynağı/metni");
  const giris = /:$/.test(h[0]) ? h[0] : "";
  const metin = (giris ? h.slice(1) : h).join("\n");
  const hadis = { kaynak, giris, metin };
  if (metin.length < 20 || metin.length > 3000 || kaynak.length > 200) fail("hadis biçimi");

  let sl;
  if (iS >= 0) sl = block(iS + 1);
  else {
    // Başlıksız söz: imzanın üstündeki satırlar, bir bölüm sınırına ya da hadis kaynağına "(…)" kadar
    sl = [];
    for (let k = iSig - 1; k >= 0 && !STOP.test(lines[k]) && !isSig(lines[k]) && !/^\(.*\)$/.test(lines[k]); k--) sl.unshift(lines[k]);
  }
  const soz = sl.join(" ").replace(/^["“”]+|["“”]+$/g, "").replace(/\s+/g, " ").trim();
  if (soz.length < 10 || soz.length > 600) fail("söz biçimi");

  const changes = [];
  if (JSON.stringify(D.ayet) !== JSON.stringify(ayet)) { D.ayet = ayet; changes.push(`Günün ayeti: ${ayet.kaynak}`); }
  if (JSON.stringify(D.hadis) !== JSON.stringify(hadis)) { D.hadis = hadis; changes.push(`Günün hadisi: ${hadis.kaynak}`); }
  if (D.gununSozu !== soz) { D.gununSozu = soz; changes.push(`Günün sözü: “${soz.slice(0, 70)}${soz.length > 70 ? "…" : ""}”`); }
  if (changes.length) { dirty = true; report.added.push(...changes); }
}

// ---------- Çalıştır ----------
(async () => {
  if (DAILY) await syncGunluk();
  else {
    await syncArticles();
    await syncSozler();
    await syncEtkinlikler();
    await checkReadOnly();
  }

  const md = [
    DAILY ? "## Günlük içerik (ayet / hadis / söz)" : "## tefekkurdenizi.com eşitlemesi",
    "",
    report.added.length ? "### Eklenen / güncellenen\n" + report.added.map((x) => "- " + x).join("\n") : "Yeni içerik yok.",
    report.review.length ? "\n### Elle inceleme gerekir\n" + report.review.map((x) => "- " + x).join("\n") : "",
    report.notes.length ? "\n### Notlar\n" + report.notes.map((x) => "- " + x).join("\n") : "",
    ""
  ].join("\n");
  console.log(md);
  if (!DRY) {
    fs.writeFileSync(REPORT_FILE, md);
    if (dirty) fs.writeFileSync(DATA, HEAD + "window.TD = " + JSON.stringify(D, null, 1) + TAIL);
  }
  console.log("CHANGED=" + (dirty ? "true" : "false"));
})().catch((e) => { console.error("HATA:", e.message); process.exit(1); });
