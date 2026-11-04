// Živé prenosy z YouTube kanála ŠKH Rohožník.
// Cron (každých 10 min) cez samostatné volanie /_live/check načíta verejnú stránku
// https://www.youtube.com/@<kanál>/live a zistí, či práve beží prenos ("isLiveNow":true).
// Stav sa ukladá do KV len pri zmene; web ho číta z /live.json.

export const YT_CHANNEL = "@SKHRohoznik_StrojarMalacky";
const KV_KEY = "yt-live";

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

export async function checkLive(env) {
  let r;
  try {
    r = await fetch("https://www.youtube.com/" + YT_CHANNEL + "/live", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
        "Accept-Language": "sk-SK,sk;q=0.9",
        "Cookie": "SOCS=CAI; CONSENT=YES+",
      },
      redirect: "follow",
    });
  } catch (e) { return { error: "fetch" }; }
  if (!r.ok) {
    await env.ARCHIV.put(KV_KEY + "-diag", JSON.stringify({ status: "HTTP_" + r.status, checked: new Date().toISOString() })).catch(() => {});
    return { error: "http " + r.status };
  }
  const p = parseLivePage(await r.text());
  const prev = (await env.ARCHIV.get(KV_KEY, { type: "json" }).catch(() => null)) || {};
  const next = p.live
    ? { live: true, id: p.id, title: p.title, since: prev.live && prev.id === p.id ? prev.since : Date.now() }
    : { live: false };
  // diagnostika: stav stránky YouTube sa zapíše len keď sa zmení (šetrí zápisy do KV)
  const diag = { status: p.status, id: p.id, live: p.live, checked: new Date().toISOString() };
  const prevDiag = (await env.ARCHIV.get(KV_KEY + "-diag", { type: "json" }).catch(() => null)) || {};
  if (prevDiag.status !== diag.status || prevDiag.id !== diag.id) await env.ARCHIV.put(KV_KEY + "-diag", JSON.stringify(diag));
  if (prev.live !== next.live || prev.id !== next.id || prev.title !== next.title) {
    await env.ARCHIV.put(KV_KEY, JSON.stringify(next));
  }
  return { ...next, diag };
}

export async function handleLiveJson(env, url) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60" };
  if (url.searchParams.get("nahlad") === "1") {
    // len na ukážku vzhľadu (?nahlad-live v adrese stránky)
    return new Response(JSON.stringify({ live: true, demo: true, id: "625woUgj65U", title: "TJ Strojár Malacky/ŠKH Rohožník vs Bánovce nad Bebravou" }), { headers });
  }
  if (url.searchParams.get("diag") === "1") {
    const d = await env.ARCHIV.get(KV_KEY + "-diag", { type: "json" }).catch(() => null);
    return new Response(JSON.stringify(d || {}), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
  const s = (await env.ARCHIV.get(KV_KEY, { type: "json" }).catch(() => null)) || { live: false };
  // prenos starší ako 6 hodín bez potvrdenia považujeme za skončený (ak by cron vypadol)
  const fresh = s.live && s.since && Date.now() - s.since < 6 * 3600 * 1000;
  return new Response(JSON.stringify(fresh ? { live: true, id: s.id, title: s.title } : { live: false }), { headers });
}
