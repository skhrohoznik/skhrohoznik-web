// Jednorazový import článkov z https://www.handballmalacky.sk/aktuality/ (Webnode) do aktuality-web.json.
// Fotky sa stiahnu do priečinka archiv-web/, aby nezáviseli od starého webu.
import { mkdirSync, writeFileSync } from "node:fs";
const BASE = "https://www.handballmalacky.sk";
const UA = { headers: { "User-Agent": "Mozilla/5.0 (jednorazovy import skhrohoznik.sk)" } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(u, UA); if (r.ok) return await r.text(); } catch (e) {}
    await sleep(1500);
  }
  throw new Error("fetch " + u);
}
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const dec = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ENT[e.toLowerCase()] ?? m;
});
const clean = (s) => dec(s.replace(/<[^>]+>/g, "")).normalize("NFKC").replace(/[ \t\r\n]+/g, " ").trim();

function htmlToText(h) {
  h = h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  h = h.replace(/<br\s*\/?>/gi, "\n");
  h = h.replace(/<li[^>]*>/gi, "\n• ");
  h = h.replace(/<\/(p|h[1-6]|li|div|ul|ol|blockquote)>/gi, "\n\n");
  const lines = dec(h.replace(/<[^>]+>/g, "")).normalize("NFKC").split(/\n/).map((l) => l.replace(/[ \t\r]+/g, " ").trim());
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// 1) zoznam článkov zo všetkých strán
const urls = [];
let page = BASE + "/aktuality/";
const seenPages = new Set();
while (page && !seenPages.has(page)) {
  seenPages.add(page);
  const h = await get(page);
  for (const m of h.matchAll(/<article class="item">[\s\S]*?href="(\/l\/[^"]+)"/g)) {
    const u = BASE + m[1];
    if (!urls.includes(u)) urls.push(u);
  }
  const older = h.match(/href="(\/aktuality\/p-[^"]+)"[^>]*>(?:(?!<\/a>)[\s\S])*Staršie/);
  page = older ? BASE + older[1] : null;
  console.log("strana", [...seenPages].length, "článkov zatiaľ", urls.length);
}

// 2) jednotlivé články
mkdirSync("archiv-web", { recursive: true });
const out = [];
const usedNames = new Set();
for (const u of urls) {
  const h = await get(u);
  const title = clean((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "");
  const pub = (h.match(/og:article:published_time" content="(\d{4})-(\d{2})-(\d{2})/) || []);
  const dShown = clean((h.match(/class="s-bdh-d">([\s\S]*?)<\/span>\s*<\/div>/) || [])[1] || "");
  let datum = /\d{1,2}\.\d{1,2}\.\d{4}/.test(dShown) ? dShown.match(/\d{1,2}\.\d{1,2}\.\d{4}/)[0] : (pub[1] ? `${pub[3]}.${pub[2]}.${pub[1]}` : "");
  const [dd, mm, yy] = datum.split(".").map(Number);
  const t = yy ? Date.UTC(yy, mm - 1, dd, 12) : 0;
  const start = h.indexOf("</h1>");
  const end = h.indexOf("<footer", start);
  const body = h.slice(start, end > 0 ? end : undefined);
  const blocks = [...body.matchAll(/<div class="b-c b-text-c[^"]*">([\s\S]*?)<\/div>\s*<\/div>/g)].map((m) => htmlToText(m[1])).filter(Boolean);
  let text = blocks.join("\n\n").trim();
  // prvý riadok často opakuje nadpis/perex - nechávame ho, je to úvod článku
  let img = (h.match(/<meta property="og:image" content="(https:\/\/[^"]*cdnwnd[^"]*)"/) || [])[1] || "";
  if (!img) {
    const g = body.match(/&quot;src&quot;:&quot;(https:[^&]+?\/700\/[^&]+?)&quot;/);
    if (g) img = dec(g[1]);
  }
  let foto = "";
  if (img) {
    const slug = decodeURIComponent(u.replace(/\/$/, "").split("/").pop()).normalize("NFKD").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "clanok";
    const ext = (img.split("?")[0].match(/\.(jpe?g|png|webp|gif)$/i) || [, "jpg"])[1].toLowerCase().replace("jpeg", "jpg");
    let name = `${slug}.${ext}`, n = 2;
    while (usedNames.has(name)) name = `${slug}-${n++}.${ext}`;
    usedNames.add(name);
    try {
      const r = await fetch(img, UA);
      if (r.ok) { writeFileSync("archiv-web/" + name, Buffer.from(await r.arrayBuffer())); foto = "archiv-web/" + name; }
    } catch (e) {}
  }
  out.push({ id: "web-" + u.split("/l/")[1].replace(/\/$/, ""), t, datum, nadpis: title, text, foto, klub: "TJ Strojár Malacky" });
  console.log(datum, "|", title, "|", text.length, "znakov |", foto || "BEZ FOTKY");
  await sleep(300);
}
out.sort((a, b) => b.t - a.t);
writeFileSync("aktuality-web.json", JSON.stringify(out, null, 1) + "\n");
console.log("HOTOVO", out.length);
