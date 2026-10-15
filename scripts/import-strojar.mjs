// Jednorazový import fotogalérií z https://www.handballmalacky.sk/foto/ do priečinka galeria-web/.
import { mkdirSync, writeFileSync } from "node:fs";
const BASE = "https://www.handballmalacky.sk";
const UA = { headers: { "User-Agent": "Mozilla/5.0 (jednorazovy import skhrohoznik.sk)" } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u) {
  for (let i = 0; i < 3; i++) { try { const r = await fetch(u, UA); if (r.ok) return await r.text(); } catch (e) {} await sleep(1500); }
  throw new Error("fetch " + u);
}
const dec = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
mkdirSync("galeria-web", { recursive: true });
const foto = await get(BASE + "/foto/");
writeFileSync("galeria-web/_foto.html", foto);
const albums = [...new Set([...foto.matchAll(/href="(\/a\d{4}-\d{4}\/)"/g)].map((m) => m[1]))];
console.log("albumy", albums);
const out = [];
for (const a of albums) {
  let pageUrl = BASE + a, n = 0;
  const imgs = [];
  const seen = new Set();
  while (pageUrl && !seen.has(pageUrl)) {
    seen.add(pageUrl);
    const h = await get(pageUrl);
    if (!n) writeFileSync("galeria-web/_" + a.replace(/\//g, "") + ".html", h);
    // galéria Webnode: data-content JSON s položkami a veľkosťami
    for (const m of h.matchAll(/data-content="([^"]+)"/g)) {
      let j; try { j = JSON.parse(dec(m[1])); } catch (e) { continue; }
      for (const it of j.items || []) {
        const srcs = (it.sources || []).find((s) => /jpe?g|png/.test(s.mimeType)) || (it.sources || [])[0];
        let best = it.img && it.img.src;
        if (srcs && srcs.sizes) { const s = srcs.sizes.filter((x) => x.width <= 1200).pop() || srcs.sizes[0]; best = s.src; }
        if (best && !imgs.includes(best)) imgs.push(best);
      }
    }
    // obyčajné <a href> na obrázky (lightbox)
    for (const m of h.matchAll(/href="(https:\/\/[^"]*cdnwnd\.com[^"]+\.(?:jpe?g|png)[^"]*)"/gi)) { const u = dec(m[1]); if (!imgs.includes(u)) imgs.push(u); }
    const next = h.match(/href="([^"]+)"[^>]*>(?:(?!<\/a>)[\s\S])*(?:Ďalšie|Staršie|Nasledujúca|›|»)/);
    pageUrl = next && next[1].startsWith("/a") ? BASE + next[1] : null;
    n++;
  }
  const name = a.replace(/\//g, "");
  mkdirSync("galeria-web/" + name, { recursive: true });
  const files = [];
  let i = 1;
  for (const u of imgs) {
    try {
      const r = await fetch(u, UA);
      if (!r.ok) continue;
      const ext = (u.split("?")[0].match(/\.(jpe?g|png)$/i) || [, "jpg"])[1].toLowerCase();
      const f = `galeria-web/${name}/${String(i++).padStart(3, "0")}.${ext}`;
      writeFileSync(f, Buffer.from(await r.arrayBuffer()));
      files.push(f);
    } catch (e) {}
    await sleep(150);
  }
  console.log(a, "fotiek", imgs.length, "stiahnutých", files.length);
  out.push({ album: name, fotky: files });
}
writeFileSync("galeria-web/_vysledok.json", JSON.stringify(out, null, 1));
