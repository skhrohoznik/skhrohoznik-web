// Jednorazový import článkov z https://www.hczahoraci.sk (WordPress) cez /wp-json/wp/v2/posts.
import { mkdirSync, writeFileSync } from "node:fs";
const BASE = "https://www.hczahoraci.sk";
const UA = { headers: { "User-Agent": "Mozilla/5.0 (jednorazovy import skhrohoznik.sk)" } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", bdquo: "„", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’" };
const dec = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ENT[e.toLowerCase()] ?? m;
});
function htmlToText(h) {
  h = h.replace(/<(script|style|figure)[\s\S]*?<\/\1>/gi, "").replace(/[\r\n]+/g, " ");
  h = h.replace(/<br\s*\/?>/gi, "\n").replace(/<li[^>]*>/gi, "\n• ").replace(/<\/(p|h[1-6]|li|div|ul|ol|blockquote)>/gi, "\n\n");
  return dec(h.replace(/<[^>]+>/g, "")).normalize("NFKC").split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
async function getJson(u) {
  for (let i = 0; i < 3; i++) { try { const r = await fetch(u, UA); if (r.ok) return { data: await r.json(), total: +r.headers.get("x-wp-totalpages") || 1 }; if (r.status === 400) return { data: [], total: 0 }; } catch (e) {} await sleep(1500); }
  throw new Error(u);
}
async function download(src, file) {
  try { const r = await fetch(src, UA); if (!r.ok) return false; writeFileSync(file, Buffer.from(await r.arrayBuffer())); return true; } catch (e) { return false; }
}
const posts = [];
for (let p = 1; ; p++) {
  const { data, total } = await getJson(`${BASE}/wp-json/wp/v2/posts?per_page=100&page=${p}&_embed=1`);
  posts.push(...data);
  if (p >= total || !data.length) break;
}
console.log("článkov", posts.length);
mkdirSync("archiv-zah", { recursive: true });
mkdirSync("galeria-zah", { recursive: true });
const items = [], albums = [];
for (const po of posts) {
  const title = htmlToText(po.title.rendered);
  const d = new Date(po.date);
  const datum = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  const text = htmlToText(po.content.rendered);
  const fm = po._embedded && po._embedded["wp:featuredmedia"] && po._embedded["wp:featuredmedia"][0];
  let img = "";
  if (fm && fm.media_details && fm.media_details.sizes) {
    const s = fm.media_details.sizes;
    img = (s.large || s.medium_large || s.full || {}).source_url || fm.source_url || "";
  } else if (fm) img = fm.source_url || "";
  const contentImgs = [...po.content.rendered.matchAll(/<img[^>]+>/gi)].map((m) => {
    const tag = m[0];
    const ss = tag.match(/srcset="([^"]+)"/);
    if (ss) { const c = ss[1].split(",").map((x) => x.trim().split(/\s+/)).filter((x) => x[0]).map((x) => [x[0], parseInt(x[1]) || 0]).filter((x) => x[1] <= 1300).sort((a, b) => b[1] - a[1]); if (c.length) return dec(c[0][0]); }
    const s = tag.match(/src="([^"]+)"/); return s ? dec(s[1]) : "";
  }).filter((u) => /^https?:/.test(u));
  if (!img && contentImgs.length) img = contentImgs[0];
  let foto = "";
  if (img) {
    const ext = (img.split("?")[0].match(/\.(jpe?g|png|webp|gif)$/i) || [, "jpg"])[1].toLowerCase();
    const f = `archiv-zah/${po.slug.slice(0, 60)}.${ext}`;
    if (await download(img, f)) foto = f;
  }
  items.push({ id: "zah-" + po.id, t: d.getTime(), datum, nadpis: title, text, foto, klub: "HC Záhoráci" });
  const gal = contentImgs.filter((u) => u !== img);
  if (gal.length >= 3) {
    const dir = `galeria-zah/${po.slug.slice(0, 50)}`;
    mkdirSync(dir, { recursive: true });
    const files = [];
    let i = 1;
    for (const u of gal) {
      const ext = (u.split("?")[0].match(/\.(jpe?g|png|webp)$/i) || [, "jpg"])[1].toLowerCase();
      const f = `${dir}/${String(i++).padStart(3, "0")}.${ext}`;
      if (await download(u, f)) files.push(f);
      await sleep(80);
    }
    albums.push({ nazov: title, datum, fotky: files });
  }
  console.log(datum, "|", title, "|", text.length, "|", foto ? "foto" : "BEZ", "| galéria", gal.length);
}
items.sort((a, b) => b.t - a.t);
writeFileSync("aktuality-zah.json", JSON.stringify(items, null, 1));
writeFileSync("galeria-zah/_vysledok.json", JSON.stringify(albums, null, 1));
console.log("HOTOVO", items.length, "albumov", albums.length);
