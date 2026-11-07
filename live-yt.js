// Živé prenosy z YouTube kanálov klubov (ŠKH Rohožník, HC Záhoráci, TJ Strojár Malacky).
// Cron (každých 10 min) cez samostatné volanie /_live/check načíta verejnú stránku
// https://www.youtube.com/@<kanál>/live každého kanála a zistí, či práve beží prenos ("isLiveNow":true).
// Stav sa ukladá do KV len pri zmene; web ho číta z /live.json.
//   KV "yt-live" = { streams: [{ ch, club, id, title, since }] }

export const YT_CHANNELS = [
  { ch: "@SKHRohoznik_StrojarMalacky", club: "ŠKH Rohožník" },
  { ch: "@hczahoraci9848", club: "HC Záhoráci" },
  { ch: "@handballmalacky1975", club: "TJ Strojár Malacky" },
];
const KV_KEY = "yt-live";
const MAX_AGE = 6 * 3600 * 1000;   // prenos starší ako 6 h bez potvrdenia považujeme za skončený

function htmlDecode(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

export function parseLivePage(html) {
  const liveNow = /"isLiveNow":true/.test(html);
  const st = (html.match(/"playabilityStatus":\{"status":"([A-Z_]+)"/) || [])[1] || "";
  const canon = (html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/) || [])[1] || "";
  const title = htmlDecode((html.match(/<meta name="title" content="([^"]*)"/) || [])[1] || "");
  return { live: liveNow && !!canon, id: canon, title, status: st };
}

async function checkChannel(ch) {
  try {
    const r = await fetch("https://www.youtube.com/" + ch + "/live", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
        "Accept-Language": "sk-SK,sk;q=0.9",
        "Cookie": "SOCS=CAI; CONSENT=YES+",
      },
      redirect: "follow",
    });
    if (!r.ok) return { error: true, status: "HTTP_" + r.status };
    return parseLivePage(await r.text());
  } catch (e) { return { error: true, status: "FETCH" }; }
}

// starší formát (len jeden kanál) -> nový zoznam prenosov
function normalize(s) {
  if (!s) return { streams: [] };
  if (Array.isArray(s.streams)) return s;
  return { streams: s.live && s.id ? [{ ch: YT_CHANNELS[0].ch, club: YT_CHANNELS[0].club, id: s.id, title: s.title, since: s.since }] : [] };
}

export async function checkLive(env) {
  const prev = normalize(await env.ARCHIV.get(KV_KEY, { type: "json" }).catch(() => null));
  const results = await Promise.all(YT_CHANNELS.map((c) => checkChannel(c.ch)));
  const streams = [], diag = {};
  YT_CHANNELS.forEach((c, i) => {
    const p = results[i];
    diag[c.ch] = { status: p.status, id: p.id || "", live: !!p.live };
    const old = prev.streams.find((x) => x.ch === c.ch);
    if (p.error) { if (old) streams.push(old); return; }      // pri chybe ponecháme posledný známy stav
    if (p.live) streams.push({ ch: c.ch, club: c.club, id: p.id, title: p.title, since: old && old.id === p.id ? old.since : Date.now() });
  });
  const next = { streams };
  if (JSON.stringify(next) !== JSON.stringify(prev)) await env.ARCHIV.put(KV_KEY, JSON.stringify(next));
  // diagnostika: zapíše sa len pri zmene stavu stránok (šetrí zápisy do KV)
  const prevDiag = (await env.ARCHIV.get(KV_KEY + "-diag", { type: "json" }).catch(() => null)) || {};
  if (JSON.stringify(prevDiag.channels || {}) !== JSON.stringify(diag)) {
    await env.ARCHIV.put(KV_KEY + "-diag", JSON.stringify({ channels: diag, checked: new Date().toISOString() }));
  }
  return { ...next, diag };
}

// aktuálne prebiehajúce prenosy (pre web aj upozornenia)
export async function currentStreams(env) {
  const s = normalize(await env.ARCHIV.get(KV_KEY, { type: "json" }).catch(() => null));
  return s.streams.filter((x) => x.id && x.since && Date.now() - x.since < MAX_AGE);
}

export async function handleLiveJson(env, url) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60" };
  if (url.searchParams.get("nahlad") === "1") {
    // len na ukážku vzhľadu (?nahlad-live v adrese stránky)
    const demo = [{ club: "ŠKH Rohožník", id: "625woUgj65U", title: "TJ Strojár Malacky/ŠKH Rohožník vs Bánovce nad Bebravou" }];
    return new Response(JSON.stringify({ live: true, demo: true, streams: demo, id: demo[0].id, title: demo[0].title }), { headers });
  }
  if (url.searchParams.get("diag") === "1") {
    const d = await env.ARCHIV.get(KV_KEY + "-diag", { type: "json" }).catch(() => null);
    return new Response(JSON.stringify(d || {}), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
  const streams = (await currentStreams(env)).map((x) => ({ club: x.club, id: x.id, title: x.title }));
  const out = streams.length ? { live: true, streams, id: streams[0].id, title: streams[0].title } : { live: false, streams: [] };
  return new Response(JSON.stringify(out), { headers });
}
