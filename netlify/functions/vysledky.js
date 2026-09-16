// Netlify Function: vysledky
// Stiahne zápasy klubu ŠK Hádzanej Rohožník priamo zo stránky Slovenského zväzu hádzanej
// (www.slovakhandball.sk) pre 3 kategórie a vráti ich ako JSON.
//
// Volanie: /.netlify/functions/vysledky
// Vráti: { mza: {results:[...], upcoming:[...]}, mzb: {...}, sz: {...}, zeny: {...},
//          dorast_ml: {...}, dorast_st: {...}, ziaci_ml: {...}, ziaci_st: {...} }

// Dievčenský/ženský tím sa v systéme zväzu objavuje v mierne rôznych tvaroch
// ("Strojár Malacky/ŠKH Rohožník", "TJ Strojár Malacky / ŠKH Rohožník" ...),
// preto jeden spoločný regex pre všetky dievčenské/ženské kategórie.
const GIRLS_TEAM = /^(TJ\s+)?Strojár Malacky\s*\/\s*ŠKH Rohožník$/i;
// Chlapčenský tím (žiaci, dorast) hrá len pod menom Strojár Malacky (bez Rohožníka).
const BOYS_TEAM = /^Strojár Malacky$/i;

const COMPETITIONS = {
  // --- dievčatá / ženy ---
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
  // --- chlapci ---
  ziaci_ml: {
    url: "https://www.slovakhandball.sk/competition?id=158788&part=366264",
    teamMatch: BOYS_TEAM,
  },
  ziaci_st: {
    url: "https://www.slovakhandball.sk/competition?id=158787&part=366588",
    teamMatch: BOYS_TEAM,
  },
};

// Premení surové HTML na jednoduchý text, kde:
//  - obrázky sa zmenia na ![alt]
//  - odkazy sa zmenia na [text](href)
//  - tučný text ostáva orámovaný **text**
// Toto zjednodušenie robí parsovanie regulárnymi výrazmi spoľahlivejším.
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

// Nájde všetky zápasy v texte podľa vzoru:
// dátum ... **Tím A** ![..] skóre/čas ![..] **Tím B** ... [Detail zápasu](url) (voliteľné)
// Tá istá stránka niekedy zobrazuje jeden zápas dvakrát (raz v krátkom náhľade, raz v plnom
// rozpise kôl), preto sa duplicitné záznamy (rovnaký dátum + oba tímy + skóre/čas) odstránia.
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
    const played = Boolean(m[5]);
    const key = date + "|" + teamHome + "|" + teamAway + "|" + score;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({ date, teamHome, score, teamAway, played });
  }
  return matches;
}

function toClubResults(matches, teamMatch) {
  const results = [];
  for (const match of matches) {
    if (!match.played) continue; // len odohrané zápasy s potvrdeným výsledkom
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
      score: `${clubScore} : ${oppScore}`,
      result,
    });
  }
  // zoradiť podľa dátumu (najstarší najprv)
  results.sort((a, b) => dateToObj(a.date) - dateToObj(b.date));
  return results;
}

function dateToObj(d) {
  const [day, month, year] = d.split(".").map(Number);
  return new Date(year, month - 1, day);
}

// Vezme nadchádzajúce (ešte neodohrané) zápasy klubu, zoradené podľa dátumu,
// a vráti najbližších `limit` z nich (od dnešného dňa).
function toClubUpcoming(matches, teamMatch, limit) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const upcoming = [];
  for (const match of matches) {
    if (match.played) continue;
    const homeIsClub = teamMatch.test(match.teamHome);
    const awayIsClub = teamMatch.test(match.teamAway);
    if (!homeIsClub && !awayIsClub) continue;

    const matchDate = dateToObj(match.date);
    if (matchDate < todayStart) continue; // preskočiť staré neodohrané (napr. zrušené)

    const opponent = homeIsClub ? match.teamAway : match.teamHome;
    const isTbaTime = match.score === "00:00";

    upcoming.push({
      date: match.date,
      opponent,
      home: homeIsClub,
      time: isTbaTime ? null : match.score,
    });
  }
  upcoming.sort((a, b) => dateToObj(a.date) - dateToObj(b.date));
  return upcoming.slice(0, limit);
}

exports.handler = async function () {
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

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=1800", // 30 minút cache
    },
    body: JSON.stringify(output),
  };
};
