import { handlePush, pushTick, PUSH_TEAMS } from "./push.js";

// Cloudflare Worker: obsluhuje statické súbory webu (cez ASSETS) a
// dynamickú cestu /vysledky, ktorá sťahuje zápasy zo Slovenského zväzu hádzanej.

const GIRLS_TEAM = /^(TJ\s+)?Strojár Malacky\s*\/\s*ŠKH Rohožník$/i;
const BOYS_TEAM = /^Strojár Malacky$/i;
const ZAHORACI_A = /^HC Záhoráci$/i;
const ZAHORACI_B = /^HC Záhoráci B$/i;

const COMPETITIONS = {
  sz: {
    url: "https://www.slovakhandball.sk/competition?id=158786&part=366691",
    teamMatch: GIRLS_TEAM,
  },
  mza: {
    url: "https://www.slovakhandball.sk/competition?id=158785&part=366361",
    teamMatch: /^Malacky\s*\/\s*Rohožník A$/i,
  },
  mzb: {
    url: "https://www.slovakhandball.sk/competition?id=158785&part=366256",
    teamMatch: /^Malacky\s*\/\s*Rohožník B$/i,
  },
  // mladšie žiačky C hrajú v tej istej súťaži ako B
  mzc: {
    url: "https://www.slovakhandball.sk/competition?id=158785&part=366256",
    teamMatch: /^Malacky\s*\/\s*Rohožník C$/i,
  },
  zeny: {
    url: "https://www.slovakhandball.sk/competition?id=154381",
    teamMatch: GIRLS_TEAM,
  },
  dorast_ml: {
    url: "https://www.slovakhandball.sk/competition?id=154400",
    teamMatch: GIRLS_TEAM,
  },
  dorast_st: {
    url: "https://www.slovakhandball.sk/competition?id=154399",
    teamMatch: GIRLS_TEAM,
  },
  ziaci_ml: {
    url: "https://www.slovakhandball.sk/competition?id=158788&part=366264",
    teamMatch: BOYS_TEAM,
  },
  ziaci_st: {
    url: "https://www.slovakhandball.sk/competition?id=158787&part=366588",
    teamMatch: BOYS_TEAM,
  },
  dorast_ml_ch: {
    url: "https://www.slovakhandball.sk/competition?id=154355",
    teamMatch: ZAHORACI_A,
  },
  dorast_st_ch: {
    url: "https://www.slovakhandball.sk/competition?id=154350",
    teamMatch: ZAHORACI_A,
  },
  muzi_a: {
    url: "https://www.slovakhandball.sk/competition?id=154264",
    teamMatch: ZAHORACI_A,
  },
  muzi_b: {
    url: "https://www.slovakhandball.sk/competition?id=154349",
    teamMatch: ZAHORACI_B,
  },
};

function htmlToMarkerText(html) {
  let text = html;
  text = text.replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, (m, alt) => ` ![${alt}] `);
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, inner) => {
    const clean = inner.replace(/<[^>]+>/g, "").trim();
    return ` [${clean}](${href}) `;
  });
  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (m, tag, inner) => {
    const clean = inner.replace(/<[^>]+>/g, "").trim();
    return ` **${clean}** `;
  });
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{2,}/g, "\n");
  return text;
}

function extractMatches(text) {
  const re =
    /(\d{2}\.\d{2}\.\d{4})[^*]{0,80}?\*\*([^*]+?)\*\*\s*!\[[^\]]*\]\s*(\d{1,2}:\d{1,2})\s*!\[[^\]]*\]\s*\*\*([^*]+?)\*\*(?:\s*\[Detail zápasu\]\(([^)]+)\))?/g;
  const matches = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(text)) !== null) {
    const date = m[1];
    const teamHome = m[2].trim();
    const score = m[3];
    const teamAway = m[4].trim();
    const detailHref = m[5] || null;
    const played = Boolean(detailHref);
    const key = date + "|" + teamHome + "|" + teamAway + "|" + score;
    if (seen.has(key)) continue;
    seen.add(key);
    // "Detail zápasu" odkaz na slovakhandball.sk je relatívna cesta (napr. "/match/2009249"),
    // na frontend ju posielame ako plnú URL.
    const detailUrl = detailHref
      ? new URL(detailHref, "https://www.slovakhandball.sk").toString()
      : null;
    matches.push({ date, teamHome, score, teamAway, played, detailUrl });
  }
  return matches;
}

// --- Tabuľka súťaže ---
// Na stránke súťaže je tabuľka so stĺpcami P (poradie), Tím, Z (zápasy), Skóre, B (body).
// Po prevode na text vyzerá riadok takto:  1. ![logo] **Názov tímu** 5 159:133 **8**
// Stránka obsahuje tú istú tabuľku viackrát a pri súťažiach so skupinami viac tabuliek -
// nová tabuľka začína tam, kde poradie znova klesne (napr. na 1.).
function extractStandings(text) {
  const re =
    /(?:^|\s)(\d{1,3})\.\s+(?:!\[[^\]]*\]\s*)*\*\*([^*]+?)\*\*\s+((?:\d{1,3}\s+){1,5})(\d{1,4}\s*:\s*\d{1,4})\s+(?:\*\*\s*)?(-?\d{1,3})(?:\s*\*\*)?/g;
  const tables = [];
  let current = null;
  let lastRank = Infinity;
  let m;
  while ((m = re.exec(text)) !== null) {
    const rank = Number(m[1]);
    if (!current || rank <= lastRank) {
      current = [];
      tables.push(current);
    }
    lastRank = rank;
    current.push({
      rank,
      team: m[2].trim(),
      played: Number(m[3].trim().split(/\s+/)[0]),
      score: m[4].replace(/\s+/g, ""),
      points: Number(m[5]),
    });
  }
  // rovnaké tabuľky (opakované na stránke) stačí mať raz
  const seen = new Set();
  return tables.filter((t) => {
    if (t.length < 2) return false;
    const key = JSON.stringify(t);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// --- Logá tímov ---
// Na stránke súťaže je pred názvom tímu (v tabuľke aj v rozpise) obrázok s logom klubu:
//   <img src="https://www.slovakhandball.sk/files/club-logos/....png"> <strong>Názov tímu</strong>
// Vráti mapu "názov tímu" -> adresa loga na našom webe (/logo/files/...), ktorú obsluhuje
// handleLogo - návštevník sa tak so zväzovým webom priamo nespája.
const LOGO_PATH_RE = /^\/files\/(?:club-logos|club)\/[A-Za-z0-9._-]+\.(?:png|jpe?g|webp|gif|svg)$/i;

function extractLogos(html) {
  const logos = {};
  const add = (rawTeam, rawSrc) => {
    const team = rawTeam.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    if (!team || logos[team]) return;
    let url;
    try {
      url = new URL(rawSrc.replace(/&amp;/g, "&"), "https://www.slovakhandball.sk");
    } catch (err) {
      return;
    }
    if (!/(^|\.)slovakhandball\.sk$/i.test(url.hostname) || !LOGO_PATH_RE.test(url.pathname)) return;
    logos[team] = "/logo" + url.pathname;
  };
  const between = "(?:\\s|<(?!\\/?strong\\b)[^>]*>)*";
  // logo pred názvom (tabuľka, hostia v rozpise)
  const before = new RegExp('<img\\b[^>]*\\bsrc="([^"]+)"[^>]*>' + between + "<strong[^>]*>((?:(?!<\\/?strong\\b)[^])*?)<\\/strong>", "gi");
  // logo za názvom domácich v rozpise:  <strong>Domáci</strong> <img src=...> 28:24
  const after = new RegExp("<strong[^>]*>((?:(?!<\\/?strong\\b)[^])*?)<\\/strong>" + between + '<img\\b[^>]*\\bsrc="([^"]+)"[^>]*>' + between + "\\d{1,2}:\\d{1,2}", "gi");
  let m;
  while ((m = before.exec(html)) !== null) add(m[2], m[1]);
  while ((m = after.exec(html)) !== null) add(m[1], m[2]);
  return logos;
}

// /logo/files/club-logos/xyz.png -> stiahne logo zo slovakhandball.sk a uloží ho do cache (30 dní)
const LOGO_CACHE_SEC = 30 * 24 * 60 * 60;
async function handleLogo(request, ctx) {
  const path = new URL(request.url).pathname.replace(/^\/logo/, "");
  // nový web zväzu: /logo/eh/<súbor> -> https://cdn.handball.eliterro.sk/<súbor>
  const eh = /^\/eh\/([A-Za-z0-9-]+\.(?:png|jpe?g|webp|gif))$/i.exec(path);
  if (!eh && !LOGO_PATH_RE.test(path)) return new Response("Not found", { status: 404 });
  const upstreamUrl = eh ? "https://cdn.handball.eliterro.sk/" + eh[1] : "https://www.slovakhandball.sk" + path;

  const cacheKey = new Request("https://cache.skhrohoznik.sk/logo" + path);
  try {
    const hit = await caches.default.match(cacheKey);
    if (hit) return hit;
  } catch (err) {
    // cache nie je dostupná
  }
  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SKHRohoznikBot/1.0)" },
    });
  } catch (err) {
    return new Response("Logo nie je dostupné", { status: 502 });
  }
  const type = upstream.headers.get("Content-Type") || "";
  if (!upstream.ok || !/^image\//i.test(type)) return new Response("Not found", { status: 404 });

  const res = new Response(upstream.body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=" + LOGO_CACHE_SEC,
      // SVG nesmie spúšťať skripty, aj keby ho niekto otvoril priamo
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
  try {
    const p = caches.default.put(cacheKey, res.clone()).catch(() => {});
    if (ctx) ctx.waitUntil(p);
  } catch (err) {
    // cache nie je dostupná
  }
  return res;
}

// Z tabuliek vyberie tú, v ktorej hrá náš tím, a označí jeho riadok.
function toClubStandings(tables, teamMatch) {
  const table = (tables || []).find((t) => t.some((r) => teamMatch.test(r.team)));
  if (!table) return null;
  return table.map((r) => (teamMatch.test(r.team) ? { ...r, ours: true } : r));
}

// "Voľno" je v rozpise zväzu kolo, v ktorom tím nehrá (nie je to skutočný zápas).
function isBye(match) {
  const bye = /^vo[ľl]no$/i;
  return bye.test(match.teamHome.trim()) || bye.test(match.teamAway.trim());
}

function dateToObj(d) {
  const [day, month, year] = d.split(".").map(Number);
  return new Date(year, month - 1, day);
}

// Slovenský zväz hádzanej v rozpise zápasov neuvádza halu/mesto zápasu priamo -
// len názov súperovho klubu. Mesto teda odvodzujeme z názvu klubu podľa tejto
// mapy (ručne udržiavaná, keďže to nie je nikde strojovo dostupné). Ak súper
// v mape chýba (napr. nový/neznámy klub), pole ostane prázdne - rovnako ako
// doteraz - namiesto uhádnutia zlého mesta.
const OPPONENT_CITY = {
  "HK Košice": "Košice",
  "HK Bojnice": "Bojnice",
  "MŠK Považská Bystrica": "Považská Bystrica",
  "HC Sporta Hlohovec": "Hlohovec",
  "MHC ŠTART Nové Zámky": "Nové Zámky",
  "Háo TJ Slovan Modra": "Modra",
  "HáO TJ Slovan Modra": "Modra",
  "HK AGRO Topoľčany": "Topoľčany",
  "ŠKP Bratislava": "Bratislava",
  "Tatran Prešov": "Prešov",
  "ŠK Zemplín Trebišov": "Trebišov",
  "HK Bojnice / MŠK Kysucké Nové Mesto": "Bojnice / Kysucké Nové Mesto",
  "SMF HK Žilina": "Žilina",
  "HC Sporta Hlohovec / HŠK Legends Šaľa": "Hlohovec / Šaľa",
  "MHáK Martin": "Martin",
  "HC Pezinok": "Pezinok",
  "HK Vajnory": "Vajnory (Bratislava)",
  "HKM Šaľa": "Šaľa",
  "HŠK - 74 Kolárovo": "Kolárovo",
  "MHK Piešťany": "Piešťany",
  "ŠK DAC Dunajská Streda": "Dunajská Streda",
  "HC DAC Dunajská Streda": "Dunajská Streda",
  "HK Slovan Duslo Šaľa": "Šaľa",
  "Handball Zlatná na Ostrove": "Zlatná na Ostrove",
  "ŠŠK Prešov": "Prešov",
  "ŠŠK Bernolákova Košice": "Košice",
  "HK Sokol Bánovce nad Bebravou": "Bánovce nad Bebravou",
  "DHK-71 Nesvady": "Nesvady",
  "HKM Šurany": "Šurany",
  "HK Laugaricio Trenčín": "Trenčín",
  "HK Junior Močenok": "Močenok",
  "HK Slávia Sereď / Slávia Partizánske": "Sereď / Partizánske",
  "ŠKP Topoľčany": "Topoľčany",
  "MHK Bytča": "Bytča",
  "MŠK IUVENTA Michalovce": "Michalovce",
  "HC Tatran Stupava": "Stupava",
  "ŠŠK Prešov / Štart Trebišov": "Prešov / Trebišov",
  "Slovan Modra": "Modra",
  "HK Senec": "Senec",
  "Handball Club Pezinok": "Pezinok",
  "Tatran Stupava": "Stupava",
};

function cityForOpponent(name) {
  if (!name) return null;
  // vzájomný zápas našich tímov (napr. mladšie žiačky B proti C) sa vždy hrá v Rohožníku
  if (/^(TJ\s+)?(Strojár\s+)?Malacky\s*\/\s*(ŠKH\s+)?Rohožník\b/i.test(name.trim())) return "ŠH Rohožník";
  // odstranime pripadne koncove oznacenie tímu (napr. "Slovan Modra A" -> "Slovan Modra")
  const normalized = name.trim().replace(/\s+[A-C]$/, "");
  return OPPONENT_CITY[normalized] || OPPONENT_CITY[name.trim()] || null;
}

function toClubResults(matches, teamMatch) {
  const results = [];
  for (const match of matches) {
    if (!match.played || isBye(match)) continue;
    const homeIsClub = teamMatch.test(match.teamHome);
    const awayIsClub = teamMatch.test(match.teamAway);
    if (!homeIsClub && !awayIsClub) continue;

    const [s1, s2] = match.score.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(s1) || Number.isNaN(s2)) continue;

    const clubScore = homeIsClub ? s1 : s2;
    const oppScore = homeIsClub ? s2 : s1;
    const opponent = homeIsClub ? match.teamAway : match.teamHome;

    let result = "Remíza";
    if (clubScore > oppScore) result = "Výhra";
    else if (clubScore < oppScore) result = "Prehra";

    results.push({
      date: match.date,
      opponent,
      home: homeIsClub,
      // skóre v poradí domáci:hostia (rovnako ako matchLabel), nie "naši:súper" -
      // inak by pri zápasoch vonku sedelo poradie tímov, ale nie poradie čísel skóre
      score: `${s1} : ${s2}`,
      result,
      awayCity: homeIsClub ? null : (match.place || cityForOpponent(opponent)),
      detailUrl: match.detailUrl || null,
    });
  }
  results.sort((a, b) => dateToObj(a.date) - dateToObj(b.date));
  return results;
}

function toClubUpcoming(matches, teamMatch, limit) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const upcoming = [];
  for (const match of matches) {
    if (match.played || isBye(match)) continue;
    const homeIsClub = teamMatch.test(match.teamHome);
    const awayIsClub = teamMatch.test(match.teamAway);
    if (!homeIsClub && !awayIsClub) continue;

    const matchDate = dateToObj(match.date);
    if (matchDate < todayStart) continue;

    const opponent = homeIsClub ? match.teamAway : match.teamHome;
    const isTbaTime = match.score === "00:00";

    upcoming.push({
      date: match.date,
      opponent,
      home: homeIsClub,
      time: isTbaTime ? null : match.score,
      awayCity: homeIsClub ? null : (match.place || cityForOpponent(opponent)),
    });
  }
  upcoming.sort((a, b) => dateToObj(a.date) - dateToObj(b.date));
  return upcoming.slice(0, limit);
}

const TEAM_PRESETS = {
  girls: GIRLS_TEAM,
  boys: BOYS_TEAM,
  zahoraci_a: ZAHORACI_A,
  zahoraci_b: ZAHORACI_B,
};

// Zálohová konfigurácia (ak by sa súbor sutaze.json nepodarilo načítať)
function defaultConfig() {
  const teams = {};
  for (const [key, conf] of Object.entries(COMPETITIONS)) {
    teams[key] = {
      teamMatch: conf.teamMatch,
      sezony: { "2026/2027": [{ nazov: "Základná časť", url: conf.url }] },
    };
  }
  return { aktualna_sezona: "2026/2027", timy: teams };
}

// Konfigurácia súťaží je v súbore sutaze.json (upravuje sa na GitHube, bez zásahu do kódu).
async function loadConfig(env, request) {
  try {
    const res = await env.ASSETS.fetch(new Request(new URL("/sutaze.json", request.url)));
    if (!res.ok) throw new Error("status " + res.status);
    const cfg = await res.json();
    if (!cfg || typeof cfg.timy !== "object") throw new Error("bad config");
    for (const t of Object.values(cfg.timy)) {
      t.teamMatch = t.tim_regex ? new RegExp(t.tim_regex, "i") : TEAM_PRESETS[t.tim] || GIRLS_TEAM;
      t.sezony = t.sezony || {};
      // vlastné logo tímu (súbor v repozitári), napr. "logo": "strojar-malacky.jpg"
      t.ownLogo = typeof t.logo === "string" && /^[A-Za-z0-9._\/-]+\.(png|jpe?g|webp|svg)$/i.test(t.logo) && !t.logo.includes("..")
        ? "/" + t.logo.replace(/^\/+/, "")
        : null;
    }
    return cfg;
  } catch (err) {
    return defaultConfig();
  }
}

function sortSeasonsDesc(seasons) {
  return seasons.slice().sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

// --- Medzipamäť (cache) zápasov zo slovakhandball.sk ---
// Zápasy jednej súťaže sa po stiahnutí uložia do cache Cloudflare:
//  - "čerstvá" kópia platí PHASE_FRESH_SEC - dovtedy sa zväzový web vôbec nevolá,
//  - "záložná" kópia platí PHASE_BACKUP_SEC - použije sa, keď je slovakhandball.sk nedostupný.
// Ukladajú sa surové zápasy a tabuľky (nie výsledky/najbližšie zápasy), tie sa počítajú pri každej
// požiadavke, aby sa odohraný zápas nezobrazoval ako "najbližší".
// Na adrese *.workers.dev cache nefunguje - vtedy sa jednoducho sťahuje zakaždým.
const PHASE_FRESH_SEC = 30 * 60;
const PHASE_BACKUP_SEC = 7 * 24 * 60 * 60;
const PHASE_CACHE_VERSION = "4"; // zvýš, ak sa zmení formát uložených dát

function phaseCacheKey(compUrl, kind) {
  return new Request(
    "https://cache.skhrohoznik.sk/zapasy/" + kind + "/" + PHASE_CACHE_VERSION + "?u=" + encodeURIComponent(compUrl)
  );
}

async function cacheGetJson(key) {
  try {
    const hit = await caches.default.match(key);
    return hit ? await hit.json() : null;
  } catch (err) {
    return null;
  }
}

function cachePutJson(key, data, maxAge, ctx) {
  try {
    const res = new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=" + maxAge },
    });
    const p = caches.default.put(key, res).catch(() => {});
    if (ctx) ctx.waitUntil(p);
  } catch (err) {
    // cache nie je dostupná - nevadí
  }
}


// --- NOVÝ WEB ZVÄZU (od októbra 2026, platforma Eliterro) ---
// Stránka tímu https://slovakhandball.sk/teams/<id> obsahuje všetky zápasy tímu v sezóne
// aj tabuľku jeho skupiny - ako JSON v dátach Next.js (self.__next_f.push(...)).
// Spracovanie je náročnejšie na procesor, preto ho robí samostatné volanie /_szh/tim/<id>
// (cez väzbu SELF na tento istý worker), aby hlavná požiadavka /vysledky nepresiahla limit.
const SZH_WEB = "https://slovakhandball.sk";
const SZH_UA = "Mozilla/5.0 (compatible; SKHRohoznikBot/1.0)";
let SELF_BINDING = null; // nastaví sa v fetch/scheduled (env.SELF)

// nájde v surovom HTML objekt {"id":...} (v zápise JS reťazca, úvodzovky ako \") obsahujúci daný kľúč
function szhObjectsWith(html, key) {
  const k0 = key.replace(/"/g, '\\"'), idk = '{\\"id\\":';
  const out = [];
  let k = 0;
  while ((k = html.indexOf(k0, k)) >= 0) {
    const j = html.lastIndexOf(idk, k);
    const raw = j >= 0 ? szhObjAt(html, j) : null;
    if (raw && j + raw.length > k) {
      try { out.push(JSON.parse(JSON.parse('"' + raw + '"'))); } catch (e) { /* poškodený objekt - preskočiť */ }
      k = j + raw.length;
    } else k += k0.length;
  }
  return out;
}
function szhObjAt(h, start) {
  let depth = 0, inStr = false;
  for (let i = start; i < h.length; i++) {
    const c = h.charCodeAt(i);
    if (c === 92) {                     // spätná lomka
      const n = h.charCodeAt(i + 1);
      if (n === 34) { inStr = !inStr; i++; continue; }          // \"  = úvodzovka v JSON
      i++;
      if (n === 92 && h.charCodeAt(i + 1) === 92 && h.charCodeAt(i + 2) === 34) i += 2; // \\\" = úvodzovka v texte
      continue;
    }
    if (inStr) continue;
    if (c === 123) depth++;
    else if (c === 125) { if (--depth === 0) return h.slice(start, i + 1); }
    else if (c === 34) return null;     // koniec JS reťazca - objekt je rozdelený, preskočiť
  }
  return null;
}
const SZH_TZ_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Bratislava", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
});
function szhLocal(iso) {
  const p = Object.fromEntries(SZH_TZ_FMT.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.day}.${p.month}.${p.year}`, time: `${String(+p.hour % 24).padStart(2, "0")}:${p.minute}` };
}
// logo z CDN zväzu -> naša adresa /logo/eh/<súbor> (obsluhuje handleLogo)
function szhLogo(p) {
  const u = p && p.logoEntity && p.logoEntity.url;
  const m = u && /^https:\/\/cdn\.handball\.eliterro\.sk\/([A-Za-z0-9-]+\.(?:png|jpe?g|webp|gif))$/i.exec(u);
  return m ? "/logo/eh/" + m[1] : null;
}
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

// Stiahne a spracuje stránku tímu do rovnakého tvaru, aký dávalo staré spracovanie: { matches, tables, logos, ourName }
async function szhParseTeam(teamId) {
  const res = await fetch(`${SZH_WEB}/teams/${teamId}`, { headers: { "User-Agent": SZH_UA } });
  if (!res.ok) throw new Error("slovakhandball.sk vrátil chybu " + res.status);
  const html = await res.text();
  const logos = {};
  let ourName = null;
  const seen = new Set();
  const matches = [];
  for (const m of szhObjectsWith(html, '"homeParticipantResult"')) {
    if (!m || seen.has(m.id) || !m.homeParticipant || !m.visitingParticipant || !m.dateFrom) continue;
    seen.add(m.id);
    const h = m.homeParticipant, v = m.visitingParticipant;
    const teamHome = clean(h.name), teamAway = clean(v.name);
    if (h.id === teamId) ourName = teamHome;
    if (v.id === teamId) ourName = teamAway;
    for (const p of [h, v]) { const l = szhLogo(p); if (l && !logos[clean(p.name)]) logos[clean(p.name)] = l; }
    const when = szhLocal(m.dateFrom);
    const played = m.state === "Finished" && m.homeParticipantResult != null && m.visitingParticipantResult != null;
    if (m.state === "Cancelled" || m.state === "Canceled") continue;
    matches.push({
      date: when.date, teamHome, teamAway, played,
      score: played ? `${m.homeParticipantResult}:${m.visitingParticipantResult}` : (m.showTime ? when.time : "00:00"),
      detailUrl: played ? `${SZH_WEB}/matches/${m.id}` : null,
      place: m.place && m.place.name ? clean(m.place.name) : null,
    });
  }
  // tabuľka skupiny tímu
  const groups = new Map();
  for (const r of szhObjectsWith(html, '"finalPosition"')) {
    const p = r && r.participants && r.participants[0];
    if (!p) continue;
    const lvl = (r.levels && r.levels[0] && r.levels[0].id) || (p.levels && p.levels[0] && p.levels[0].id) || 0;
    const ad = Object.fromEntries((r.additionalData || []).map((a) => [a.name, a.value]));
    const l = szhLogo(p); if (l && !logos[clean(p.name)]) logos[clean(p.name)] = l;
    if (!groups.has(lvl)) groups.set(lvl, new Map());
    groups.get(lvl).set(p.id, {
      rank: Number(r.finalPosition) || 0, team: clean(p.name), teamId: p.id,
      played: Number(ad["matches-played"]) || 0,
      score: `${ad["goals-for"] || 0}:${ad["goals-against"] || 0}`,
      points: Number(ad.points) || 0,
    });
  }
  const ourTables = [...groups.values()].map((g) => [...g.values()].sort((a, b) => a.rank - b.rank))
    .filter((t) => t.length > 1 && t.some((r) => r.teamId === teamId));
  if (!ourName && ourTables[0]) ourName = ourTables[0].find((r) => r.teamId === teamId).team;
  const tables = ourTables.map((t) => t.map(({ teamId: _, ...r }) => r));
  return { matches, tables, logos, ourName };
}

// /_szh/tim/<id> - spracovanie jednej stránky tímu v samostatnom volaní (len cez väzbu SELF)
async function handleSzhTeam(request, url) {
  const id = Number((/^\/_szh\/tim\/(\d{1,7})$/.exec(url.pathname) || [])[1]);
  if (!id || request.headers.get("X-Internal") !== "1") return new Response("Not found", { status: 404 });
  try {
    const data = await szhParseTeam(id);
    return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err && err.message || err) }), { status: 502, headers: { "Content-Type": "application/json" } });
  }
}
async function szhLoadTeam(teamId) {
  if (SELF_BINDING) {
    const r = await SELF_BINDING.fetch(new Request(`https://skhrohoznik.sk/_szh/tim/${teamId}`, { headers: { "X-Internal": "1" } }));
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d.error || "chyba " + r.status);
    return d;
  }
  return szhParseTeam(teamId);
}

// Jedna položka v cache na súťaž: { at, data } drží 7 dní (záloha pri výpadku zväzu),
// za čerstvú sa považuje 30 minút. Jedno čítanie + jeden zápis na súťaž, aby sa worker
// zmestil do limitu 50 pod-požiadaviek na jeden beh (12 súťaží).
const phaseInflight = new Map();
function loadPhaseData(compUrl, ctx) {
  // rovnaká súťaž pre viac tímov (napr. mladšie žiačky B a C) sa v jednom behu sťahuje len raz
  if (!phaseInflight.has(compUrl)) {
    const p = loadPhaseDataOnce(compUrl, ctx).finally(() => setTimeout(() => phaseInflight.delete(compUrl), 0));
    phaseInflight.set(compUrl, p);
  }
  return phaseInflight.get(compUrl);
}
async function loadPhaseDataOnce(compUrl, ctx) {
  const key = phaseCacheKey(compUrl, "v");
  const cached = await cacheGetJson(key);
  if (cached && cached.data && Date.now() - cached.at < PHASE_FRESH_SEC * 1000) return cached.data;
  try {
    let data;
    const tim = /^tim:(\d+)$/.exec(compUrl);
    if (tim) {
      data = await szhLoadTeam(Number(tim[1]));
    } else {
      const res = await fetch(compUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SKHRohoznikBot/1.0)" },
      });
      if (!res.ok) throw new Error("slovakhandball.sk vrátil chybu " + res.status);
      const html = await res.text();
      const text = htmlToMarkerText(html);
      data = { matches: extractMatches(text), tables: extractStandings(text), logos: extractLogos(html) };
    }
    // prázdny rozpis (napr. výpadok alebo nová súťaž) neprepíše uložené zápasy
    if (data.matches.length || !(cached && cached.data && cached.data.matches.length)) {
      cachePutJson(key, { at: Date.now(), data }, PHASE_BACKUP_SEC, ctx);
      return data;
    }
    return cached.data;
  } catch (err) {
    if (cached && cached.data) return cached.data;
    throw err;
  }
}

// /kalendar.ics?tim=zeny,mza -> zápasy (a klubové akcie) ako odoberateľný kalendár (Google, iPhone, Outlook).
// Bez parametra tim = všetky tímy. akcie=0 vynechá klubové akcie.
function icsEsc(s) {
  return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function icsFold(line) {
  // riadky max. 75 bajtov (UTF-8), pokračovanie začína medzerou
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = "", len = 0;
  for (const ch of line) {
    const l = new TextEncoder().encode(ch).length;
    if (len + l > (out.length ? 74 : 75)) { out.push(cur); cur = ""; len = 0; }
    cur += ch; len += l;
  }
  out.push(cur);
  return out.join("\r\n ");
}
function icsDate(sk) {
  const p = String(sk).split(".");
  return p.length === 3 ? p[2] + p[1].padStart(2, "0") + p[0].padStart(2, "0") : null;
}
function icsAddMin(ymd, hm, add) {
  const d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8), +hm[0], +hm[1] + add));
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${z(d.getUTCMonth() + 1)}${z(d.getUTCDate())}T${z(d.getUTCHours())}${z(d.getUTCMinutes())}00`;
}
function icsNextDay(ymd) {
  const d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8) + 1));
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}
const ICS_TZ = [
  "BEGIN:VTIMEZONE", "TZID:Europe/Bratislava",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
  "END:VTIMEZONE",
];
async function handleIcs(request, env, ctx, url) {
  const wanted = (url.searchParams.get("tim") || "").split(",").map((s) => s.trim()).filter((k) => PUSH_TEAMS[k]);
  const withAkcie = url.searchParams.get("akcie") !== "0";
  const data = await (await handleKalendar(request, env, ctx)).json().catch(() => ({ zapasy: [] }));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const ev = [];
  for (const m of data.zapasy || []) {
    if (wanted.length && !wanted.includes(m.tim)) continue;
    const meta = PUSH_TEAMS[m.tim];
    const ymd = icsDate(m.date);
    if (!meta || !ymd) continue;
    const home = m.home ? meta.club : m.opponent, away = m.home ? m.opponent : meta.club;
    const score = m.played && m.score ? " " + String(m.score).replace(/\s+/g, "") : "";
    const place = m.home ? meta.venue : (m.awayCity || "");
    const hm = m.time && /^\d{1,2}:\d{2}$/.test(m.time) ? m.time.split(":") : null;
    const lines = [
      "BEGIN:VEVENT",
      `UID:${(m.tim + "-" + ymd + "-" + m.opponent).replace(/[^A-Za-z0-9-]+/g, "")}@skhrohoznik.sk`,
      `DTSTAMP:${stamp}`,
      ...(hm
        ? [`DTSTART;TZID=Europe/Bratislava:${icsAddMin(ymd, hm, 0)}`, `DTEND;TZID=Europe/Bratislava:${icsAddMin(ymd, hm, 90)}`]
        : [`DTSTART;VALUE=DATE:${ymd}`, `DTEND;VALUE=DATE:${icsNextDay(ymd)}`]),
      `SUMMARY:${icsEsc(`🤾 ${meta.label}: ${home} – ${away}${score}`)}`,
      ...(place ? [`LOCATION:${icsEsc(place)}`] : []),
      `DESCRIPTION:${icsEsc((m.played ? (m.result ? m.result + ". " : "") : (hm ? "" : "Čas zápasu ešte nie je známy. ")) + (m.home ? "Domáci zápas." : "Zápas vonku.") + " Viac na https://skhrohoznik.sk" + meta.href)}`,
      `URL:https://skhrohoznik.sk${meta.href}`,
      "END:VEVENT",
    ];
    ev.push(...lines);
  }
  if (withAkcie) {
    try {
      const r = await env.ASSETS.fetch(new Request("https://assets.local/akcie.json"));
      const list = r.ok ? await r.json() : [];
      for (const a of Array.isArray(list) ? list : []) {
        const from = icsDate(a.datum);
        if (!from || !a.nazov) continue;
        const to = a.do ? icsDate(a.do) : from;
        const hm = a.cas && /^\d{1,2}:\d{2}$/.test(a.cas) && !a.do ? a.cas.split(":") : null;
        ev.push(
          "BEGIN:VEVENT",
          `UID:akcia-${from}-${String(a.nazov).normalize("NFD").replace(/[^A-Za-z0-9]+/g, "").slice(0, 40)}@skhrohoznik.sk`,
          `DTSTAMP:${stamp}`,
          ...(hm
            ? [`DTSTART;TZID=Europe/Bratislava:${icsAddMin(from, hm, 0)}`, `DTEND;TZID=Europe/Bratislava:${icsAddMin(from, hm, 180)}`]
            : [`DTSTART;VALUE=DATE:${from}`, `DTEND;VALUE=DATE:${icsNextDay(to || from)}`]),
          `SUMMARY:${icsEsc("⭐ " + a.nazov)}`,
          ...(a.miesto ? [`LOCATION:${icsEsc(a.miesto)}`] : []),
          ...(a.popis ? [`DESCRIPTION:${icsEsc(a.popis)}`] : []),
          "END:VEVENT",
        );
      }
    } catch (e) { /* akcie sa nepodarilo načítať */ }
  }
  const name = wanted.length === 1 ? `Hádzaná Záhorie – ${PUSH_TEAMS[wanted[0]].label}` : "Hádzaná Záhorie – zápasy";
  const body = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//skhrohoznik.sk//Hadzana Zahorie//SK", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEsc(name)}`, "X-WR-TIMEZONE:Europe/Bratislava",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H",
    ...ICS_TZ, ...ev, "END:VCALENDAR",
  ].map(icsFold).join("\r\n") + "\r\n";
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="hadzana-zahorie.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}

// /zapasy.json -> všetky zápasy všetkých tímov v aktuálnej sezóne (odohrané aj budúce) pre stránku Kalendár
// fáza súťaže v sutaze.json: { "tim_id": 6553 } (nový web zväzu) alebo starší { "url": "..." }
function compKey(comp) {
  return comp && Number(comp.tim_id) > 0 ? "tim:" + Number(comp.tim_id) : comp.url;
}
// náš tím: na stránke tímu presne podľa názvu, ktorý tam zväz používa
function teamMatchFor(data, fallback) {
  return data && data.ourName ? new RegExp("^" + data.ourName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") : fallback;
}

async function handleKalendar(request, env, ctx) {
  const cfg = await loadConfig(env, request);
  const season = cfg.aktualna_sezona;
  const out = [];
  await Promise.all(
    Object.entries(cfg.timy).map(async ([key, team]) => {
      const comps = (team.sezony && team.sezony[season]) || [];
      await Promise.all(
        comps.map(async (comp) => {
          try {
            const data = await loadPhaseData(compKey(comp), ctx);
            const { matches, logos = {} } = data;
            const tm = teamMatchFor(data, team.teamMatch);
            const clubName = Object.keys(logos).find((t) => tm.test(t));
            const clubLogo = team.ownLogo || (clubName ? logos[clubName] : null);
            const base = { tim: key, nazov: team.nazov || key, faza: comp.nazov || "", clubLogo };
            for (const m of toClubResults(matches, tm)) {
              out.push({ ...base, ...m, played: true, opponentLogo: logos[m.opponent] || null });
            }
            for (const m of toClubUpcoming(matches, tm, Infinity)) {
              out.push({ ...base, ...m, played: false, opponentLogo: logos[m.opponent] || null });
            }
          } catch (err) {
            // súťaž sa nepodarilo načítať - v kalendári jednoducho chýba
          }
        })
      );
    })
  );
  out.sort((a, b) => dateToObj(a.date) - dateToObj(b.date) || String(a.time || "").localeCompare(String(b.time || "")));
  return new Response(JSON.stringify({ season, zapasy: out }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=1800" },
  });
}

async function loadPhase(comp, teamMatchCfg, ctx, ownLogo) {
  try {
    const data = await loadPhaseData(compKey(comp), ctx);
    const { matches, tables, logos = {} } = data;
    const teamMatch = teamMatchFor(data, teamMatchCfg);
    const logoOf = (team) => logos[team] || null;
    const clubName = Object.keys(logos).find((t) => teamMatch.test(t));
    const withLogo = (m) => ({ ...m, opponentLogo: logoOf(m.opponent) });
    const standings = toClubStandings(tables, teamMatch);
    return {
      nazov: comp.nazov || "Súťaž",
      // vlastné logo z sutaze.json ("logo") má prednosť pred logom zo zväzu
      clubLogo: ownLogo || (clubName ? logos[clubName] : null),
      results: toClubResults(matches, teamMatch).map(withLogo),
      upcoming: toClubUpcoming(matches, teamMatch, 4).map(withLogo),
      standings: standings ? standings.map((r) => ({ ...r, logo: (r.ours && ownLogo) || logoOf(r.team) })) : null,
    };
  } catch (err) {
    return { nazov: comp.nazov || "Súťaž", error: String(err) };
  }
}

// /vysledky                       -> všetky tímy, aktuálna sezóna
// /vysledky?tim=zeny,sz           -> len vybrané tímy
// /vysledky?sezona=2025/2026      -> iná sezóna
async function handleVysledky(request, env, ctx) {
  const url = new URL(request.url);
  const cfg = await loadConfig(env, request);
  const wantedTeams = (url.searchParams.get("tim") || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const season = url.searchParams.get("sezona") || cfg.aktualna_sezona;
  const output = {};

  await Promise.all(
    Object.entries(cfg.timy)
      .filter(([key]) => !wantedTeams.length || wantedTeams.includes(key))
      .map(async ([key, team]) => {
        const comps = (team.sezony && team.sezony[season]) || [];
        const phases = await Promise.all(comps.map((c) => loadPhase(c, team.teamMatch, ctx, team.ownLogo)));
        const ok = phases.filter((p) => !p.error);
        const entry = {
          season,
          seasons: sortSeasonsDesc(Object.keys(team.sezony || {})),
          phases,
        };
        if (comps.length && !ok.length) {
          entry.error = phases.map((p) => p.error).join("; ");
        } else {
          const results = ok.flatMap((p) => p.results);
          results.sort((a, b) => dateToObj(a.date) - dateToObj(b.date));
          const upcoming = ok.flatMap((p) => p.upcoming);
          upcoming.sort((a, b) => dateToObj(a.date) - dateToObj(b.date));
          entry.results = results;
          entry.upcoming = upcoming.slice(0, 2);
          const withLogo = ok.find((p) => p.clubLogo);
          entry.clubLogo = withLogo ? withLogo.clubLogo : null;
        }
        output[key] = entry;
      })
  );

  return new Response(JSON.stringify(output), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
    },
  });
}

// --- AKTUALITY: automatické stiahnutie príspevkov z Facebook stránok ---
// Tokeny sa NIKDY nedávajú do kódu/repozitára - nastavujú sa ako Cloudflare
// Worker "secrets" (wrangler secret put FB_TOKEN_ROHOZNIK / FB_TOKEN_ZAHORACI),
// odtiaľ sú dostupné cez `env`.
const FB_API_VERSION = "v21.0";

const FB_PAGES = [
  {
    key: "rohoznik",
    pageId: "292481291455655",
    tokenEnv: "FB_TOKEN_ROHOZNIK",
    club: "ŠKH Rohožník / TJ Strojár Malacky",
  },
  {
    key: "zahoraci",
    pageId: "104785271891529",
    tokenEnv: "FB_TOKEN_ZAHORACI",
    club: "HC Záhoráci",
  },
];

// Ručne pridávané oznamy sú v súbore oznamy.json (stránka Oznamy); aktuality sú len z Facebooku.

function fbDateToDatum(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

const BARE_URL_RE = /^https?:\/\/\S+$/i;

function fbPostToItem(post, club) {
  const message = String(post.message || post.story || "").trim();
  let text = message;
  let nadpis = null; // FB príspevky sami o sebe nemajú nadpis - nevymýšľame ho zo správy
  let foto = post.full_picture || null;

  const attachment = post.attachments && post.attachments.data && post.attachments.data[0];
  if (attachment) {
    // Zdieľaný odkaz (napr. článok) - ak správa je iba samotná URL adresa (alebo prázdna),
    // použijeme radšej skutočný názov/popis z náhľadu odkazu namiesto surovej URL.
    if (attachment.title && (!text || BARE_URL_RE.test(text))) {
      nadpis = attachment.title;
      text = attachment.description || "";
    }
    if (!foto && attachment.media && attachment.media.image && attachment.media.image.src) {
      foto = attachment.media.image.src;
    }
  }

  return {
    datum: fbDateToDatum(post.created_time),
    nadpis,
    text,
    foto,
    zdroj: post.permalink_url || null,
    klub: club,
    _sortTime: new Date(post.created_time).getTime() || 0,
  };
}

// ---------------------------------------------------------------------------
// ARCHÍV AKTUALÍT (Cloudflare KV, binding "ARCHIV")
//
// Facebook API vracia len aktuálnu "výpoveď" najnovších príspevkov a odkazy na
// fotky časom expirujú. Preto worker raz za hodinu (cron) príspevky aj fotky
// ukladá do KV:
//   "feed"        - pole všetkých príspevkov (najnovšie prvé)
//   "img:<id>"    - fotka príspevku (binárne, typ v metadátach)
//   "state"       - stav postupného dosťahovania starších príspevkov
// Staré príspevky tak ostanú dostupné aj po ich zmazaní na Facebooku.
// Bez KV bindingu (alebo kým je archív prázdny) sa používa živé sťahovanie.
// ---------------------------------------------------------------------------
const FB_PAGE_SIZE = 25;          // príspevkov na jedno volanie Graph API
const NEW_PAGES_PER_RUN = 3;      // koľko "strán" najnovších príspevkov sa kontroluje pri každom behu
const BACKFILL_PAGES_PER_RUN = 1; // koľko strán starších príspevkov sa dosťahuje pri každom behu
const MAX_ARCHIVE_PER_PAGE = 600; // horná hranica dosťahovania histórie pre jednu FB stránku
// Bezplatný Workers KV dovoľuje 1 000 zápisov za deň (pre celý účet). Cron beží 24x denne,
// takže jeden beh smie zapísať najviac ~12 položiek (10 fotiek + feed + state) = max. ~290 zápisov/deň.
const MAX_IMAGES_PER_RUN = 10;    // limit sťahovania (= zápisov) fotiek za jeden beh

function fbPostsUrl(page, env) {
  const fields =
    "message,story,created_time,full_picture,permalink_url," +
    "attachments{title,description,media}";
  return (
    `https://graph.facebook.com/${FB_API_VERSION}/${page.pageId}/posts` +
    `?fields=${fields}&limit=${FB_PAGE_SIZE}&access_token=${encodeURIComponent(env[page.tokenEnv])}`
  );
}

async function fetchFbPostsPage(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!data || !Array.isArray(data.data)) return { posts: [], next: null };
  return { posts: data.data, next: (data.paging && data.paging.next) || null };
}

function fbPostToFeedItem(post, page) {
  const item = fbPostToItem(post, page.club);
  item.id = String(post.id);
  item.t = item._sortTime;
  delete item._sortTime;
  return item;
}

function hasContent(item) {
  return Boolean(item.text || item.nadpis || item.foto);
}

async function readFeed(env) {
  const feed = await env.ARCHIV.get("feed", { type: "json" });
  return Array.isArray(feed) ? feed : [];
}

// Zlúči čerstvé príspevky do archívu: nové pridá, existujúcim aktualizuje text/nadpis/odkaz
// (fotku si ponechá tú archivovanú).
function mergeIntoFeed(feed, fresh) {
  const byId = new Map(feed.map((it) => [it.id, it]));
  let changed = false;
  for (const item of fresh) {
    if (!hasContent(item)) continue;
    const old = byId.get(item.id);
    if (!old) {
      byId.set(item.id, item);
      changed = true;
    } else {
      for (const k of ["nadpis", "text", "zdroj", "klub", "datum", "t"]) {
        if (old[k] !== item[k]) {
          old[k] = item[k];
          changed = true;
        }
      }
      // fotka sa ešte nedostala do archívu (stále je to FB odkaz) -> použi čerstvý odkaz
      if (old.foto && /^https?:/i.test(old.foto) && item.foto && old.foto !== item.foto) {
        old.foto = item.foto;
        changed = true;
      }
      if (!old.foto && item.foto) {
        old.foto = item.foto;
        changed = true;
      }
    }
  }
  const merged = Array.from(byId.values()).sort((a, b) => (b.t || 0) - (a.t || 0));
  return { merged, changed };
}

async function archiveImages(env, feed) {
  let downloaded = 0;
  let changed = false;
  for (const item of feed) {
    if (downloaded >= MAX_IMAGES_PER_RUN) break;
    if (!item.foto || !/^https?:/i.test(item.foto)) continue; // žiadna fotka alebo už archivovaná
    try {
      const res = await fetch(item.foto);
      downloaded++;
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "image/jpeg";
      if (!/^image\//i.test(ct)) continue;
      const buf = await res.arrayBuffer();
      await env.ARCHIV.put("img:" + item.id, buf, { metadata: { ct } });
      item.foto = "/archiv/img/" + encodeURIComponent(item.id);
      changed = true;
    } catch (err) {
      // nepodarilo sa - skúsime pri ďalšom behu (kým FB odkaz platí)
    }
  }
  return changed;
}

async function syncArchive(env) {
  if (!env.ARCHIV) return { skipped: "no ARCHIV binding" };
  const state = (await env.ARCHIV.get("state", { type: "json" })) || { backfill: {} };
  let feed = await readFeed(env);
  let anyChange = false;
  let stateChanged = false;

  for (const page of FB_PAGES) {
    if (!env[page.tokenEnv]) continue;
    try {
      // 1) najnovšie príspevky (zachytí nové aj úpravy)
      let url = fbPostsUrl(page, env);
      let nextAfterNew = null;
      for (let i = 0; i < NEW_PAGES_PER_RUN && url; i++) {
        const { posts, next } = await fetchFbPostsPage(url);
        const r = mergeIntoFeed(feed, posts.map((p) => fbPostToFeedItem(p, page)));
        feed = r.merged;
        anyChange = anyChange || r.changed;
        url = next;
        nextAfterNew = next;
      }
      // 2) postupné dosťahovanie histórie (od miesta, kde sa skončilo naposledy)
      const bf = state.backfill[page.key];
      if (bf === undefined) {
        // prvý beh: história začína tam, kde sme skončili pri kontrole najnovších
        state.backfill[page.key] = { next: nextAfterNew, count: NEW_PAGES_PER_RUN * FB_PAGE_SIZE };
        stateChanged = true;
      } else if (bf.next && bf.count < MAX_ARCHIVE_PER_PAGE) {
        let next = bf.next;
        let count = bf.count;
        for (let i = 0; i < BACKFILL_PAGES_PER_RUN && next; i++) {
          const { posts, next: n2 } = await fetchFbPostsPage(next);
          const r = mergeIntoFeed(feed, posts.map((p) => fbPostToFeedItem(p, page)));
          feed = r.merged;
          anyChange = anyChange || r.changed;
          count += posts.length;
          next = posts.length ? n2 : null;
        }
        state.backfill[page.key] = { next, count };
        stateChanged = true;
      }
    } catch (err) {
      // chyba jednej stránky nesmie zhodiť synchronizáciu druhej
    }
  }

  if (await archiveImages(env, feed)) anyChange = true;
  if (anyChange) await env.ARCHIV.put("feed", JSON.stringify(feed));
  if (stateChanged) await env.ARCHIV.put("state", JSON.stringify(state));
  return { items: feed.length, changed: anyChange };
}

async function handleArchivImg(env, pathname, ctx) {
  if (!env.ARCHIV) return new Response("Not found", { status: 404 });
  const id = decodeURIComponent(pathname.slice("/archiv/img/".length));
  if (!/^[\w.\-]+$/.test(id)) return new Response("Not found", { status: 404 });
  // fotka sa nemení - po prvom načítaní ju vydáva cache Cloudflare a KV sa už nečíta
  const cacheKey = new Request("https://cache.skhrohoznik.sk/archiv/img/" + encodeURIComponent(id));
  try {
    const hit = await caches.default.match(cacheKey);
    if (hit) return hit;
  } catch (err) {
    // cache nie je dostupná
  }
  const { value, metadata } = await env.ARCHIV.getWithMetadata("img:" + id, { type: "arrayBuffer" });
  if (!value) return new Response("Not found", { status: 404 });
  const res = new Response(value, {
    headers: {
      "Content-Type": (metadata && metadata.ct) || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
  try {
    const p = caches.default.put(cacheKey, res.clone()).catch(() => {});
    if (ctx) ctx.waitUntil(p);
  } catch (err) {
    // cache nie je dostupná
  }
  return res;
}

// Aktuality sa menia najviac raz za hodinu (cron) - odpoveď sa drží v cache Cloudflare,
// aby každá návšteva úvodnej stránky nečítala KV.
const AKTUALITY_CACHE_SEC = 10 * 60;

async function handleAktuality(env, ctx) {
  const cacheKey = new Request("https://cache.skhrohoznik.sk/aktuality.json");
  try {
    const hit = await caches.default.match(cacheKey);
    if (hit) return hit;
  } catch (err) {
    // cache nie je dostupná
  }
  let output = null;
  let fromArchive = false;

  if (env.ARCHIV) {
    try {
      const feed = await readFeed(env);
      if (feed.length) {
        output = feed.slice();
        fromArchive = true;
      } else if (ctx) {
        // archív je prázdny (prvé spustenie) - naplň ho na pozadí, ale najviac raz za 30 minút,
        // inak by každá návšteva spustila synchronizáciu so zápismi do KV
        const lockKey = new Request("https://cache.skhrohoznik.sk/aktuality-sync-lock");
        const locked = await caches.default.match(lockKey).catch(() => null);
        if (!locked) {
          ctx.waitUntil(
            caches.default
              .put(lockKey, new Response("1", { headers: { "Cache-Control": "public, max-age=1800" } }))
              .catch(() => {})
              .then(() => syncArchive(env))
              .catch(() => {})
          );
        }
      }
    } catch (err) {
      output = null;
    }
  }

  if (!output) {
    // záloha: živé sťahovanie z Facebooku (bez archívu)
    const results = await Promise.all(
      FB_PAGES.map((page) =>
        env[page.tokenEnv]
          ? fetchFbPostsPage(fbPostsUrl(page, env)).then((r) => r.posts.map((p) => fbPostToItem(p, page.club))).catch(() => [])
          : []
      )
    );
    const fbItems = results.flat();
    fbItems.forEach((item) => { item.t = item._sortTime; delete item._sortTime; });
    output = fbItems;
  }

  // + články prevzaté zo starého webu handballmalacky.sk (statický súbor aktuality-web.json)
  try {
    const r = await env.ASSETS.fetch(new Request("https://assets.local/aktuality-web.json"));
    if (r.ok) {
      const web = await r.json();
      if (Array.isArray(web)) output = output.concat(web);
    }
  } catch (err) {
    // súbor chýba alebo je poškodený - zobrazia sa len príspevky z Facebooku
  }
  output.sort((a, b) => (b.t || 0) - (a.t || 0));
  // Facebook príspevky často používajú "ozdobné" Unicode písmo (𝐁𝐨𝐥𝐝, 𝘐𝘵𝘢𝘭𝘪𝘤, ｆｕｌｌｗｉｄｔｈ).
  // Webové písmo tieto znaky nemá, preto ich prevedieme na obyčajné písmená (aj s diakritikou).
  // Niektoré texty prídu aj s HTML entitami (&aacute; &amp; &#39;) - prevedieme ich na znaky.
  const ENT = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
    bdquo: "„", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", laquo: "«", raquo: "»" };
  const ACC = { acute: "\u0301", caron: "\u030C", uml: "\u0308", circ: "\u0302" };
  const decodeEnt = (v) => v.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    if (ENT[e]) return ENT[e];
    const acc = e.match(/^([a-zA-Z])(acute|caron|uml|circ)$/);
    return acc ? (acc[1] + ACC[acc[2]]).normalize("NFC") : m;
  });
  const plain = (v) => typeof v === "string"
    ? decodeEnt(decodeEnt(v))
        .replace(/&[a-zA-Z#0-9]{1,8}(?=…|\.\.\.|$)/g, "") // useknutá entita na konci skráteného textu ("dom&aac…")
        .replace(/[\u{1D400}-\u{1D7FF}\uFF01-\uFF5E]/gu, (c) => c.normalize("NFKC"))
        .normalize("NFD").replace(/\u0304/g, "\u0301") // dĺžeň namiesto čiarky (Ā -> Á) - v slovenčine sa nepoužíva
        .normalize("NFC")
    : v;
  output = output.map(({ id, t, ...rest }) => ({ ...rest, text: plain(rest.text), nadpis: plain(rest.nadpis) }));

  const res = new Response(JSON.stringify(output), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=" + AKTUALITY_CACHE_SEC,
    },
  });
  // do cache len odpoveď z archívu (záložné živé sťahovanie z FB sa skúsi znova pri ďalšej návšteve)
  if (fromArchive) {
    try {
      const p = caches.default.put(cacheKey, res.clone()).catch(() => {});
      if (ctx) ctx.waitUntil(p);
    } catch (err) {
      // cache nie je dostupná
    }
  }
  return res;
}

// Statické súbory. Stránky sa obsluhujú priamo pod adresou s ".html" (html_handling: "none"
// vo wrangler.jsonc) - presne tak, ako sú v odkazoch, v sitemap.xml aj v kanonických adresách,
// aby Google nenarážal na presmerovania.
//  - "/" zobrazí úvodnú stránku (index.html),
//  - adresa bez koncovky ("/zeny" alebo "/zeny/") sa trvalo (301) presmeruje na "/zeny.html".
async function serveStatic(request, env, url) {
  const res = await env.ASSETS.fetch(request);
  if (res.status !== 404) return res;
  const path = url.pathname;
  if (path === "/") {
    return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
  }
  if ((request.method === "GET" || request.method === "HEAD") && !/\.[a-z0-9]+$/i.test(path)) {
    const target = path.replace(/\/+$/, "") + ".html";
    if (target !== ".html" && target !== "/.html") {
      const probe = await env.ASSETS.fetch(new Request(new URL(target, url), { method: "HEAD" }));
      if (probe.ok) return Response.redirect(new URL(target + url.search, url).toString(), 301);
    }
  }
  return res;
}

export default {
  async fetch(request, env, ctx) {
    if (env.SELF) SELF_BINDING = env.SELF;
    const url = new URL(request.url);
    // stránka Klub bola zlúčená so stránkou Kontakty (haly sú v sekcii #haly)
    if (url.pathname === "/klub.html" || url.pathname === "/klub") {
      return Response.redirect(new URL("/kontakty.html#haly", url).toString(), 301);
    }
    if (url.pathname.startsWith("/_szh/")) {
      return handleSzhTeam(request, url);
    }
    if (url.pathname.startsWith("/push/")) {
      return handlePush(request, env, url);
    }
    if (url.pathname === "/vysledky") {
      return handleVysledky(request, env, ctx);
    }
    if (url.pathname === "/zapasy.json") {
      return handleKalendar(request, env, ctx);
    }
    if (url.pathname === "/kalendar.ics") {
      return handleIcs(request, env, ctx, url);
    }
    if (url.pathname === "/aktuality.json") {
      return handleAktuality(env, ctx);
    }
    if (url.pathname.startsWith("/logo/")) {
      return handleLogo(request, ctx);
    }
    if (url.pathname.startsWith("/archiv/img/")) {
      return handleArchivImg(env, url.pathname, ctx);
    }
    // všetko ostatné (HTML, obrázky, ...) obslúži statický súborový systém
    return serveStatic(request, env, url);
  },
  async scheduled(event, env, ctx) {
    if (env.SELF) SELF_BINDING = env.SELF;
    if (event.cron === "*/10 * * * *") {
      // upozornenia do mobilu (push.js) - výsledky a zápasy berie z tej istej funkcie ako /vysledky
      const getResults = async () =>
        (await handleVysledky(new Request("https://skhrohoznik.sk/vysledky"), env, ctx)).json();
      ctx.waitUntil(pushTick(env, ctx, getResults));
      return;
    }
    ctx.waitUntil(syncArchive(env));
  },
};
