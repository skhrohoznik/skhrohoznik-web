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
  if (!LOGO_PATH_RE.test(path)) return new Response("Not found", { status: 404 });

  const cacheKey = new Request("https://cache.skhrohoznik.sk/logo" + path);
  try {
    const hit = await caches.default.match(cacheKey);
    if (hit) return hit;
  } catch (err) {
    // cache nie je dostupná
  }
  let upstream;
  try {
    upstream = await fetch("https://www.slovakhandball.sk" + path, {
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
      awayCity: homeIsClub ? null : cityForOpponent(opponent),
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
      awayCity: homeIsClub ? null : cityForOpponent(opponent),
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
const PHASE_CACHE_VERSION = "3"; // zvýš, ak sa zmení formát uložených dát

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

async function loadPhaseData(compUrl, ctx) {
  const freshKey = phaseCacheKey(compUrl, "fresh");
  const fresh = await cacheGetJson(freshKey);
  if (fresh) return fresh;

  const backupKey = phaseCacheKey(compUrl, "backup");
  try {
    const res = await fetch(compUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SKHRohoznikBot/1.0)" },
    });
    if (!res.ok) throw new Error("slovakhandball.sk vrátil chybu " + res.status);
    const html = await res.text();
    const text = htmlToMarkerText(html);
    const data = { matches: extractMatches(text), tables: extractStandings(text), logos: extractLogos(html) };
    cachePutJson(freshKey, data, PHASE_FRESH_SEC, ctx);
    // prázdny rozpis (napr. nová súťaž) neprepisuje zálohu so zápasmi
    if (data.matches.length) cachePutJson(backupKey, data, PHASE_BACKUP_SEC, ctx);
    return data;
  } catch (err) {
    const backup = await cacheGetJson(backupKey);
    if (backup) return backup;
    throw err;
  }
}

async function loadPhase(comp, teamMatch, ctx, ownLogo) {
  try {
    const { matches, tables, logos = {} } = await loadPhaseData(comp.url, ctx);
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
        output = feed.map(({ id, t, ...rest }) => rest);
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
    fbItems.sort((a, b) => b._sortTime - a._sortTime);
    fbItems.forEach((item) => delete item._sortTime);
    output = fbItems;
  }

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/vysledky") {
      return handleVysledky(request, env, ctx);
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
    return env.ASSETS.fetch(request);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncArchive(env));
  },
};
