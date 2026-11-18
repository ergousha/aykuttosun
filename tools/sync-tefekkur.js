#!/usr/bin/env node
/*
  tefekkurdenizi.com -> assets/data.js eşitleyici
  ------------------------------------------------
  Kullanım:
    node tools/sync-tefekkur.js            # assets/data.js dosyasını günceller
    node tools/sync-tefekkur.js --dry      # yalnızca rapor yazar, dosyaya dokunmaz
    node tools/sync-tefekkur.js --daily    # yalnızca ana sayfadaki günün ayeti / hadisi / sözünü eşitler

  Ortam değişkenleri (hepsi isteğe bağlı):
    GEMINI_API_KEY   Yeni yazı/şiir/denemelerin biçimlendirilmesi için Gemini anahtarı.
                     Yoksa ya da Gemini metni bozarsa deterministik biçimlendirme kullanılır.
    GEMINI_MODEL     Varsayılan: gemini-flash-latest
    REPORT_FILE      Raporun yazılacağı dosya (varsayılan: sync-report.md)

  Ne yapar?
   - Yeni makale / deneme / şiir  -> ilgili listenin sonuna ekler. Liste sayfasındaki bağlantı izlenir;
                                     bağlantı PDF ise metin PDF'ten çıkarılır (pdftotext gerekir) ve
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
// Secret/değişken değerindeki boşluk, tırnak ve "models/" öneki temizlenir
const DEFAULT_MODEL = "gemini-flash-latest";
let MODEL = (process.env.GEMINI_MODEL || "").trim().replace(/^["']|["']$/g, "").replace(/^models\//, "") || DEFAULT_MODEL;
const GEMINI_BASE = process.env.GEMINI_BASE || "https://generativelanguage.googleapis.com";
const KEY = process.env.GEMINI_API_KEY || "";
const REPORT_FILE = process.env.REPORT_FILE || path.join(ROOT, "sync-report.md");

// ---------- Yardımcılar ----------
const TR = { İ: "i", I: "i", ı: "i", Ö: "o", ö: "o", Ü: "u", ü: "u", Ş: "s", ş: "s", Ç: "c", ç: "c", Ğ: "g", ğ: "g", Â: "a", â: "a", Î: "i", î: "i", Û: "u", û: "u" };
const fold = (s) => String(s).replace(/[İIıÖöÜüŞşÇçĞğÂâÎîÛû]/g, (c) => TR[c]).toLowerCase().replace(/\u0307/g, "");
const norm = (s) => fold(s).replace(/[^a-z0-9]+/g, "");
// İmza ("Aykut Tosun / 16.11.2026") sırası değişebilir; karşılaştırmada yok sayılır.
const normBody = (s) => norm(s).split("aykuttosun").join("");
const slugify = (s) => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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
function pageLines(html) {
  html = html.replace(/<(script|style|svg|noscript)[\s\S]*?<\/\1>/gi, "").replace(/<\/?(br|p|h\d|div|li|span|a|section|article|header|footer)\b[^>]*>/gi, "\n");
  const t = unent(html.replace(/<[^>]+>/g, ""));
  const lines = t.split("\n").map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim());
  const i = lines.findIndex((l) => l === "Giriş Yapınız");
  let body = i >= 0 ? lines.slice(i + 1) : lines;
  const end = body.findIndex((l) => l === "Tefekkür Denizi İrfan Okulu" || l.startsWith("© "));
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

// ---------- Gemini ----------
async function gemini(prompt, schema, extraParts = []) {
  const url = `${GEMINI_BASE}/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({
      contents: [{ parts: [...extraParts, { text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 65536, responseMimeType: "application/json", responseSchema: schema }
    })
  });
  if (!r.ok) {
    let msg = "Gemini HTTP " + r.status + " " + (await r.text()).slice(0, 300);
    if (r.status === 404 && MODEL !== DEFAULT_MODEL) {
      report.notes.push(`GEMINI_MODEL ile belirtilen model bulunamadı (HTTP 404); varsayılan "${DEFAULT_MODEL}" kullanıldı. ${await geminiModels()}`);
      MODEL = DEFAULT_MODEL;
      return gemini(prompt, schema, extraParts);
    }
    if (r.status === 404) msg += " — model bulunamadı (GEMINI_MODEL: " + MODEL.length + " karakter, \"gemini-\" ile " + (MODEL.startsWith("gemini-") ? "başlıyor" : "başlamıyor") + "). " + (await geminiModels());
    throw new Error(msg);
  }
  const j = await r.json();
  const c = j.candidates && j.candidates[0];
  const txt = c && c.content && (c.content.parts || []).map((p) => p.text || "").join("");
  if (!txt) throw new Error("Gemini boş yanıt döndürdü" + (c && c.finishReason ? " (" + c.finishReason + ")" : ""));
  return JSON.parse(txt);
}

// 404'te kullanılabilir modelleri raporla (yalnızca generateContent destekleyen flash/pro modelleri)
let modelsHint = null;
async function geminiModels() {
  if (modelsHint !== null) return modelsHint;
  try {
    const r = await fetch(`${GEMINI_BASE}/v1beta/models?pageSize=1000`, { headers: { "x-goog-api-key": KEY } });
    const j = await r.json();
    const names = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => m.name.replace(/^models\//, "")).filter((n) => /flash|pro/.test(n));
    modelsHint = names.length ? "Kullanılabilir modeller: " + names.slice(0, 15).join(", ") : "Model listesi alınamadı (HTTP " + r.status + ").";
  } catch (e) { modelsHint = "Model listesi alınamadı: " + e.message; }
  return modelsHint;
}

const KIND = {
  makaleler: "makale (dinî-tasavvufî yazı)",
  denemeler: "deneme (kısa edebî yazı)",
  siirler: "şiir"
};

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

async function format(kind, lines, listTitle) {
  const first = lines.find((l) => cleanLine(l));
  const rawBody = lines.slice(lines.indexOf(first) + 1).map(cleanLine).filter(Boolean).join("\n");
  const fallback = () => ({ title: listTitle, body: plainFormat(kind, lines), how: "deterministik" });
  if (!KEY) return fallback();
  const prompt =
    `Aşağıda bir Türkçe ${KIND[kind]} metni var. Sitenin veri biçimine göre düzenle.\n` +
    `KURALLAR:\n- Metni KELİMESİ KELİMESİNE koru; hiçbir kelime ekleme, silme, değiştirme, düzeltme. Noktalama ve özel harfleri (â, î, û, ’) aynen bırak.\n` +
    (kind === "siirler"
      ? `- Şiirde her dize bir satır (\\n), kıtalar arası boş satır (\\n\\n) olsun. Kıta sınırını kaynaktaki boş satırlardan ve uyaktan çıkar.\n`
      : `- Paragrafları boş satırla (\\n\\n) ayır. Kaynakta yapay olarak bölünmüş satırları aynı paragrafta birleştir; ayrı satırda duran kısa vurgu satırlarını, madde işaretlerini ve dua/“Âmin” satırlarını ayrı bırak.\n`) +
    `- Sondaki imza ve tarihi "Aykut TOSUN\\nGG.AA.YYYY" biçiminde son iki satır olarak bırak (tarih kaynakta varsa).\n` +
    `- "title": başlığı kaynaktaki yazımla, okunaklı büyük/küçük harfle yaz (örn. "Kalplerin Anahtarı: Şükür"). Liste başlığı: "${listTitle}".\n` +
    `- "body": yalnızca gövde; başlığı gövdeye koyma.\n\nKAYNAK BAŞLIK: ${first}\nKAYNAK METİN:\n${rawBody}`;
  const schema = { type: "OBJECT", properties: { title: { type: "STRING" }, body: { type: "STRING" } }, required: ["title", "body"] };
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const o = await gemini(prompt, schema);
      if (normBody(o.body) === normBody(rawBody)) {
        return { title: o.title.trim() || listTitle, body: fixSignature(o.body.trim()), how: "Gemini (" + MODEL + ")" };
      }
      report.notes.push(`Gemini çıktısı kaynakla birebir örtüşmedi (deneme ${attempt}): "${listTitle}"`);
    } catch (e) {
      report.notes.push(`Gemini hatası (deneme ${attempt}) "${listTitle}": ${e.message}`);
    }
  }
  return fallback();
}

// ---------- PDF ----------
const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
// PDF metin katmanında "fi"/"fl" bağ harfleri kopup başka yere düşer, Arapça satırlar bozuk çıkar;
// karşılaştırmada bunları yok say.
const normPdf = (s) => normBody(String(s).replace(new RegExp(ARABIC.source, "g"), " ")).replace(/f[il]/g, "").split("tefekkurdeniziirfanokulu").join("");
function pdfText(buf) {
  const f = path.join(os.tmpdir(), "tefekkur-" + process.pid + ".pdf");
  fs.writeFileSync(f, buf);
  try { return execFileSync("pdftotext", ["-enc", "UTF-8", f, "-"], { encoding: "utf8", maxBuffer: 64 << 20 }); }
  catch (e) { throw new Error("pdftotext çalıştırılamadı (poppler-utils kurulu mu?): " + e.message); }
  finally { fs.rmSync(f, { force: true }); }
}
// Kelime düzeyinde benzerlik: Gemini metni ile PDF metin katmanı arasındaki fark oranı
function wordDiff(a, b) {
  const w = (s) => fold(String(s).replace(new RegExp(ARABIC.source, "g"), " ")).replace(/f[il]/g, "").split(/[^a-z0-9]+/).filter((x) => x.length > 1);
  const A = w(a), B = w(b), m = new Map();
  for (const x of A) m.set(x, (m.get(x) || 0) + 1);
  let common = 0;
  for (const x of B) { const n = m.get(x) || 0; if (n) { common++; m.set(x, n - 1); } }
  return { diff: A.length + B.length - 2 * common, total: Math.max(A.length, B.length) };
}
// Deterministik: boş satırla ayrılmış blokları paragraf yap; Arapça satırları ve başlık/imza bloklarını at
function plainPdf(text, title) {
  const paras = text.replace(/\f/g, "\n\n").split(/\n\s*\n/).map((p) => p.split("\n").filter((l) => !ARABIC.test(l)).map((l) => l.trim()).filter(Boolean).join(" "))
    .filter((p) => p && !/^f[il]( f[il])*$/.test(p));
  const nt = norm(title);
  while (paras.length && (nt.includes(norm(paras[0])) || norm(paras[0]) === "aykuttosun")) paras.shift();
  return paras.join("\n\n");
}
async function formatPdf(kind, buf, listTitle, url) {
  const text = pdfText(buf);
  if (normPdf(text).length < 200) throw new Error("PDF'ten metin çıkmadı (taranmış görüntü olabilir): " + url);
  const fallback = () => ({ title: listTitle, body: plainPdf(text, listTitle), how: "deterministik (PDF)" });
  if (!KEY) return fallback();
  const prompt =
    `Ekteki PDF, Aykut Tosun'a ait bir Türkçe ${KIND[kind]}. Metni sitenin veri biçimine dönüştür.\n` +
    `KURALLAR:\n- Türkçe metni KELİMESİ KELİMESİNE koru; hiçbir kelime ekleme, silme, değiştirme, özetleme. Noktalama ve özel harfleri (â, î, û, ʿ, ’) aynen bırak.\n` +
    `- Arap harfli metinleri (âyet/hadis asılları) TAMAMEN ÇIKAR; yalnızca Türkçe meal/açıklama kalsın.\n` +
    `- Satır sonlarında bölünmüş cümleleri birleştir; paragrafları boş satırla (\\n\\n) ayır.\n` +
    `- Bölüm başlıklarını ("Giriş", "1. …", "Sonuç", "Kaynakça", "Kaynak Notları" gibi) ayrı paragraf olarak "## " ile başlat.\n` +
    `- Kaynakça ve kaynak notlarında her madde ayrı paragraf olsun.\n` +
    `- Belgenin başındaki başlığı ve yazar adını gövdeye koyma; alt başlık varsa gövdenin ilk paragrafı olsun.\n` +
    `- Sondaki imzayı "Aykut TOSUN\\nGG.AA.YYYY" biçiminde son iki satır yap.\n` +
    `- "title": başlığı okunaklı büyük/küçük harfle yaz (örn. "Allah'ın Rahmetinden Ümit Kesilir mi?"). Liste başlığı: "${listTitle}".`;
  const schema = { type: "OBJECT", properties: { title: { type: "STRING" }, body: { type: "STRING" } }, required: ["title", "body"] };
  const pdfPart = { inline_data: { mime_type: "application/pdf", data: buf.toString("base64") } };
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const o = await gemini(prompt, schema, [pdfPart]);
      const body = fixSignature(o.body.split(/\n{2,}/).filter((p) => !ARABIC.test(p)).join("\n\n").trim());
      // Kaynak = PDF metin katmanı (başlık ve "Tefekkür Denizi İrfan Okulu" hariç)
      const srcN = normPdf(text).replace(normPdf(listTitle), ""), outN = normPdf(body);
      const d = wordDiff(text, (o.title || "") + " " + body + " " + listTitle + " Tefekkür Denizi İrfan Okulu");
      if (srcN.includes(outN) && outN.length > srcN.length * 0.97 || d.diff <= Math.max(3, d.total * 0.003)) {
        return { title: (o.title || "").trim() || listTitle, body, how: "Gemini (" + MODEL + ", PDF)", diff: d };
      }
      report.notes.push(`Gemini PDF çıktısı kaynakla örtüşmedi (deneme ${attempt}, ${d.diff}/${d.total} kelime farkı): "${listTitle}"`);
    } catch (e) {
      report.notes.push(`Gemini hatası (deneme ${attempt}) "${listTitle}": ${e.message}`);
    }
  }
  return fallback();
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
        f = await formatPdf(key, buf, t, url);
        pdf = url;
        report.notes.push(`"${f.title}" kaynakta yalnızca PDF olarak yayımlanmış; metin PDF'ten alındı, sayfaya PDF indirme bağlantısı eklendi. Arap harfli âyet/hadis asılları sitede yer almıyor (PDF'te var).`);
      } else {
        const lines = pageLines(await get(encodeURI(decodeURI(url))));
        if (lines.filter((l) => cleanLine(l)).length < 3) { report.review.push(`"${t}" sayfası boş görünüyor: ${url}`); continue; }
        // Başlığı farklı yazılmış ama gövdesi zaten bizde olan içerik tekrar eklenmesin
        const pb = normBody(lines.slice(1).join(" "));
        if (have.some((x) => pb.includes(normBody(x.body).slice(0, 120)))) continue;
        f = await format(key, lines, t);
      }
      let slug = slugify(f.title), n = 2;
      while (have.some((x) => x.slug === slug)) slug = slugify(f.title) + "-" + n++;
      have.push(Object.assign({ slug, title: f.title, body: f.body }, pdf ? { pdf } : {}));
      dirty = true;
      report.added.push(`**${f.title}** → \`${key}\` (\`/${key.replace(/ler$|lar$/, "")}/${slug}/\`) — biçimlendirme: ${f.how}${f.diff ? ` (${f.diff.diff}/${f.diff.total} kelime farkı)` : ""} — kaynak: ${url}`);
      if (/^deterministik/.test(f.how) && key !== "siirler") report.review.push(`"${f.title}" paragrafları deterministik biçimlendirildi; okunuşunu kontrol edin.`);
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
  const lines = pageLines(await get(BASE + "/")).map(cleanLine).filter(Boolean);
  const iA = lines.findIndex((l) => /^Günün Ayeti:?$/i.test(l));
  const iH = lines.findIndex((l) => /^Günün Hadis/i.test(l));
  const iS = lines.findIndex((l) => /^Aykut Tosun'dan$/i.test(l));
  if (iA < 0 || iH < iA || iS < iH) throw new Error("Ana sayfada günün ayeti/hadisi/sözü bölümleri bulunamadı (site yapısı değişmiş olabilir)");
  const fail = (m) => { throw new Error("Günlük içerik doğrulanamadı: " + m); };

  const a = lines.slice(iA + 1, iH);
  if (a.length < 2) fail("ayet");
  const ayet = { kaynak: a[0], metin: a.slice(1).join(" ").replace(/\s+/g, " ") };
  if (!/\d/.test(ayet.kaynak) || ayet.kaynak.length > 80 || ayet.metin.length < 15 || ayet.metin.length > 1500) fail("ayet biçimi");

  let h = lines.slice(iH + 1, iS);
  let kaynak = "";
  const last = h[h.length - 1];
  if (last && /^\(.*\)$/.test(last)) { kaynak = last.slice(1, -1).trim(); h = h.slice(0, -1); }
  if (!kaynak || h.length < 2) fail("hadis kaynağı/metni");
  const giris = /:$/.test(h[0]) ? h[0] : "";
  const metin = (giris ? h.slice(1) : h).join("\n");
  const hadis = { kaynak, giris, metin };
  if (metin.length < 20 || metin.length > 3000 || kaynak.length > 200) fail("hadis biçimi");

  const sl = lines.slice(iS + 1);
  while (sl.length && /^[-–—]\s*Aykut\s+Tosun$/i.test(sl[sl.length - 1])) sl.pop();
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
