// Fáza 1: stiahne ukážky HTML, aby sa dal napísať presný parser.
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("import-out", { recursive: true });
const UA = { headers: { "User-Agent": "Mozilla/5.0 (import skhrohoznik.sk)" } };
const get = async (u) => { const r = await fetch(u, UA); return [r.status, await r.text()]; };
const [s1, list] = await get("https://www.handballmalacky.sk/aktuality/");
writeFileSync("import-out/list.html", list);
const [s2, art] = await get("https://www.handballmalacky.sk/l/turnaj-generacii-2026/");
writeFileSync("import-out/article.html", art);
const [s3, rss] = await get("https://www.handballmalacky.sk/rss/all.xml");
writeFileSync("import-out/rss.txt", s3 + "\n" + rss.slice(0, 3000));
console.log(s1, list.length, s2, art.length, s3);
