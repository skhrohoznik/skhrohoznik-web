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

async function handleVysledky() {
  const output = {};

  await Promise.all(
    Object.entries(COMPETITIONS).map(async ([key, conf]) => {
      try {
        const res = await fetch(conf.url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SKHRohoznikBot/1.0)" },
        });
        const html = await res.text();
        const text = htmlToMarkerText(html);
        const matches = extractMatches(text);
        output[key] = {
          results: toClubResults(matches, conf.teamMatch),
          upcoming: toClubUpcoming(matches, conf.teamMatch, 2),
        };
      } catch (err) {
        output[key] = { error: String(err) };
      }
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

// Ručne pridané, "vždyzelené" aktuality (napr. nábor), ktoré sa zobrazujú
// vždy navrchu, pred automaticky stiahnutými príspevkami z Facebooku.
const MANUAL_AKTUALITY = [
  {
    datum: "31.10.2026",
    nadpis: "Turnaj starších žiačok",
    text: "V sobotu, dňa 31.10.2026 sa v ŠH Rohožník uskutoční jednodňový turnaj starších žiačok, ktorého sa zúčastní celkom 5 tímov z Českej republiky a zo Slovenska. Budeme radi, ak prídete podporiť dievčatá v hre.",
    foto: "turnaj-ziacky.png",
  },
  {
    datum: "Nábor",
    nadpis: "Hľadáme nové hráčky a hráčov",
    text: "Príď sa pozrieť na tréning — viac informácií nájdeš na karte Nábor.",
    fotky: ["nabor-chlapci.jpg", "nabor-dievcata.jpg"],
  },
];

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

async function fetchFbPosts(page, env) {
  const token = env[page.tokenEnv];
  if (!token) return [];
  const fields =
    "message,story,created_time,full_picture,permalink_url," +
    "attachments{title,description,media}";
  const apiUrl =
    `https://graph.facebook.com/${FB_API_VERSION}/${page.pageId}/posts` +
    `?fields=${fields}&limit=15&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(apiUrl);
  const data = await res.json();
  if (!data || !Array.isArray(data.data)) return [];
  return data.data.map((post) => fbPostToItem(post, page.club));
}

async function handleAktuality(env) {
  const results = await Promise.all(
    FB_PAGES.map((page) => fetchFbPosts(page, env).catch(() => []))
  );

  const fbItems = results.flat();
  fbItems.sort((a, b) => b._sortTime - a._sortTime);
  fbItems.forEach((item) => delete item._sortTime);

  const output = [...MANUAL_AKTUALITY, ...fbItems];

  return new Response(JSON.stringify(output), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=900",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/vysledky") {
      return handleVysledky();
    }
    if (url.pathname === "/aktuality.json") {
      return handleAktuality(env);
    }
    // všetko ostatné (HTML, obrázky, ...) obslúži statický súborový systém
    return env.ASSETS.fetch(request);
  },
};
