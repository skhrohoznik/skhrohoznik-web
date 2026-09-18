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
    const played = Boolean(m[5]);
    const key = date + "|" + teamHome + "|" + teamAway + "|" + score;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({ date, teamHome, score, teamAway, played });
  }
  return matches;
}

function dateToObj(d) {
  const [day, month, year] = d.split(".").map(Number);
  return new Date(year, month - 1, day);
}

function toClubResults(matches, teamMatch) {
  const results = [];
  for (const match of matches) {
    if (!match.played) continue;
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
  results.sort((a, b) => dateToObj(a.date) - dateToObj(b.date));
  return results;
}

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
    if (matchDate < todayStart) continue;

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/vysledky") {
      return handleVysledky();
    }
    // všetko ostatné (HTML, obrázky, ...) obslúži statický súborový systém
    return env.ASSETS.fetch(request);
  },
};
