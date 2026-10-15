// Ukážky HTML z hczahoraci.sk
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("import-zah", { recursive: true });
const UA = { headers: { "User-Agent": "Mozilla/5.0 (jednorazovy import skhrohoznik.sk)" } };
const r = await fetch("https://www.hczahoraci.sk/aktuality/", UA);
const h = await r.text();
writeFileSync("import-zah/list.html", h);
const m = [...h.matchAll(/href="([^"]+)"/g)].map((x) => x[1]).filter((u) => /aktual|\/l\/|clanok|novink|blog/i.test(u));
writeFileSync("import-zah/links.txt", [...new Set(m)].join("\n"));
console.log(r.status, h.length);
