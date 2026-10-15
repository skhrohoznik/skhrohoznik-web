// Jednorazový import fotiek z galérií vnútri článkov na https://www.handballmalacky.sk/aktuality/.
import { mkdirSync, writeFileSync } from "node:fs";
const BASE = "https://www.handballmalacky.sk";
const UA = { headers: { "User-Agent": "Mozilla/5.0 (jednorazovy import skhrohoznik.sk)" } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u) {
  for (let i = 0; i < 3; i++) { try { const r = await fetch(u, UA); if (r.ok) return await r.text(); } catch (e) {} await sleep(1500); }
  throw new Error("fetch " + u);
}
const dec = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const clean = (s) => dec(s.replace(/<[^>]+>/g, "")).normalize("NFKC").replace(/\s+/g, " ").trim();

const urls = [];
let page = BASE + "/aktuality/";
const seenPages = new Set();
while (page && !seenPages.has(page)) {
  seenPages.add(page);
  const h = await get(page);
  for (const m of h.matchAll(/<article class="item">[\s\S]*?href="(\/l\/[^"]+)"/g)) { const u = BASE + m[1]; if (!urls.includes(u)) urls.push(u); }
  const older = h.match(/href="(\/aktuality\/p-[^"]+)"[^>]*>(?:(?!<\/a>)[\s\S])*Staršie/);
  page = older ? BASE + older[1] : null;
}
console.log("článkov", urls.length);
mkdirSync("galeria-clanky", { recursive: true });
const out = [];
let total = 0;
for (const u of urls) {
  const h = await get(u);
  const title = clean((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "");
  const dShown = clean((h.match(/class="s-bdh-d">([\s\S]*?)<\/span>\s*<\/div>/) || [])[1] || "");
  const datum = (dShown.match(/\d{1,2}\.\d{1,2}\.\d{4}/) || [""])[0];
  const start = h.indexOf("</h1>"), end = h.indexOf("<footer", start);
  const body = h.slice(start, end > 0 ? end : undefined);
  const imgs = [];
  for (const m of body.matchAll(/class="gal-app[^"]*"[^>]*data-content="([^"]+)"/g)) {
    let j; try { j = JSON.parse(dec(m[1])); } catch (e) { continue; }
    for (const it of j.items || []) {
      const srcs = (it.sources || []).find((s) => /jpe?g|png/.test(s.mimeType)) || (it.sources || [])[0];
      let best = it.img && it.img.src;
      if (srcs && srcs.sizes) { const s = srcs.sizes.filter((x) => x.width <= 1200).pop() || srcs.sizes[0]; best = s.src; }
      if (best && !imgs.includes(best)) imgs.push(best);
    }
  }
  if (!imgs.length) { console.log(datum, title, "- bez galérie"); continue; }
  const slug = u.split("/l/")[1].replace(/\/$/, "");
  const dir = "galeria-clanky/" + (decodeURIComponent(slug).normalize("NFKD").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "clanok-" + out.length);
  mkdirSync(dir, { recursive: true });
  const files = [];
  let i = 1;
  for (const src of imgs) {
    try {
      const r = await fetch(src, UA);
      if (!r.ok) continue;
      const ext = (src.split("?")[0].match(/\.(jpe?g|png|webp)$/i) || [, "jpg"])[1].toLowerCase();
      const f = `${dir}/${String(i++).padStart(3, "0")}.${ext}`;
      writeFileSync(f, Buffer.from(await r.arrayBuffer()));
      files.push(f);
    } catch (e) {}
    await sleep(100);
  }
  total += files.length;
  console.log(datum, title, files.length);
  out.push({ nazov: title, datum, fotky: files });
}
writeFileSync("galeria-clanky/_vysledok.json", JSON.stringify(out, null, 1));
console.log("albumov", out.length, "fotiek", total);
