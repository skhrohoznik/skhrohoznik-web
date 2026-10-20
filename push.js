// Web Push (upozornenia do mobilu) bez externých knižníc - len WebCrypto.
//  - VAPID (RFC 8292): podpis JWT kľúčom ES256, ktorý si worker sám vygeneruje a uloží do KV
//  - šifrovanie správy (RFC 8291, "aes128gcm")
// Odberatelia aj stav (čo už bolo odoslané) sú v KV, každé v jednom kľúči, aby bolo čo najmenej zápisov.

const enc = new TextEncoder();

export function b64u(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64u(str) {
  const s = atob(String(str).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(str).length + 3) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function concat(...parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

// ---- VAPID kľúče (vygenerujú sa raz a uložia do KV) ----
const VAPID_KEY = "push-vapid";
export async function getVapid(env) {
  let v = await env.ARCHIV.get(VAPID_KEY, { type: "json" });
  if (v && v.publicKey && v.privateJwk) return v;
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  v = { publicKey: b64u(pub), privateJwk };
  await env.ARCHIV.put(VAPID_KEY, JSON.stringify(v));
  return v;
}

async function vapidHeader(endpoint, vapid, subject) {
  const aud = new URL(endpoint).origin;
  const header = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey("jwk", vapid.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(header + "." + claims)));
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${vapid.publicKey}`;
}

// ---- šifrovanie obsahu správy (RFC 8291) ----
export async function encryptPayload(payload, p256dh, auth) {
  const uaPublic = unb64u(p256dh);
  const authSecret = unb64u(auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));

  const prkKey = await hmac(authSecret, shared);
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1]));
  const ikm = (await hmac(prkKey, keyInfo)).slice(0, 32);
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const plain = concat(enc.encode(payload), new Uint8Array([2]));
  const key = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plain));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

// Odošle jednu správu. Vráti HTTP status (404/410 = odber už neplatí, treba ho zmazať).
// Odpoveď push služby (pri chybe) sa uloží do lastPushError pre diagnostiku.
export let lastPushError = "";
export async function sendPush(sub, message, vapid, subject = "mailto:info@skhrohoznik.sk") {
  const body = await encryptPayload(JSON.stringify(message), sub.keys.p256dh, sub.keys.auth);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidHeader(sub.endpoint, vapid, subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body,
  });
  lastPushError = res.ok ? "" : (await res.text().catch(() => "")).slice(0, 200);
  return res.status;
}

// ---- záznam posledných odoslaní (na /push/status, bez adries odberov) ----
const LOG_KEY = "push-log";
async function addLog(env, entries) {
  if (!entries.length) return;
  const log = await readJson(env, LOG_KEY, []);
  await env.ARCHIV.put(LOG_KEY, JSON.stringify(log.concat(entries).slice(-40)));
}
function logEntry(kind, endpoint, status, title) {
  let host = "";
  try { host = new URL(endpoint).host; } catch (e) {}
  return { t: new Date().toISOString(), kind, host, status, title: String(title || "").slice(0, 60), err: status >= 200 && status < 300 ? undefined : lastPushError || undefined };
}
async function safeSend(sub, message, vapid) {
  try { return await sendPush(sub, message, vapid); }
  catch (e) { lastPushError = String(e && e.message || e).slice(0, 200); return 0; }
}

// ======================= Odbery a rozosielanie =======================
const SUBS_KEY = "push-subs";
const STATE_KEY = "push-state";
const QUEUE_KEY = "push-queue";
const MAX_SUBS = 5000;
const SENDS_PER_TICK = 30; // bezplatný Cloudflare Worker má limit 50 pod-požiadaviek na jeden beh
const TZ = "Europe/Bratislava";

// tímy: názov, stránka, hala pri domácom zápase a logo do upozornenia
export const PUSH_TEAMS = {
  muzi_a:       { label: "Muži Extraliga",     href: "/muzi-extraliga.html",     venue: "Šport Aréna Malacky", icon: "/zahoraci.png", club: "Malacky" },
  muzi_b:       { label: "Muži 1. liga",       href: "/muzi-1-liga.html",        venue: "Šport Aréna Malacky", icon: "/zahoraci.png", club: "Malacky" },
  dorast_st_ch: { label: "Starší dorastenci",  href: "/starsi-dorastenci.html",  venue: "Šport Aréna Malacky", icon: "/zahoraci.png", club: "Malacky" },
  dorast_ml_ch: { label: "Mladší dorastenci",  href: "/mladsi-dorastenci.html",  venue: "Šport Aréna Malacky", icon: "/zahoraci.png", club: "Malacky" },
  ziaci_st:     { label: "Starší žiaci",       href: "/starsi-ziaci.html",       venue: "Šport Aréna Malacky", icon: "/strojar-malacky.jpg", club: "Malacky" },
  ziaci_ml:     { label: "Mladší žiaci",       href: "/mladsi-ziaci.html",       venue: "Šport Aréna Malacky", icon: "/strojar-malacky.jpg", club: "Malacky" },
  chlapci_mini: { label: "Chlapci mini",       href: "/chlapci-mini.html",       venue: "Šport Aréna Malacky", icon: "/strojar-malacky.jpg", club: "Malacky" },
  zeny:         { label: "Ženy",               href: "/zeny.html",               venue: "Šport Aréna Malacky", icon: "/skh.png", club: "Rohožník / Malacky" },
  dorast_st:    { label: "Staršie dorastenky", href: "/starsie-dorastenky.html", venue: "Šport Aréna Malacky", icon: "/skh.png", club: "Rohožník / Malacky" },
  dorast_ml:    { label: "Mladšie dorastenky", href: "/mladsie-dorastenky.html", venue: "Šport Aréna Malacky", icon: "/skh.png", club: "Rohožník / Malacky" },
  sz:           { label: "Staršie žiačky",     href: "/starsie-ziacky.html",     venue: "ŠH Rohožník", icon: "/skh.png", club: "Rohožník / Malacky" },
  mza:          { label: "Mladšie žiačky A",   href: "/mladsie-ziacky-a.html",   venue: "ŠH Rohožník", icon: "/skh.png", club: "Rohožník / Malacky" },
  mzb:          { label: "Mladšie žiačky B",   href: "/mladsie-ziacky-b.html",   venue: "ŠH Rohožník", icon: "/skh.png", club: "Rohožník / Malacky" },
  mzc:          { label: "Mladšie žiačky C",   href: "/mladsie-ziacky-c.html",   venue: "ŠH Rohožník", icon: "/skh.png", club: "Rohožník / Malacky" },
  dievcata_mini:{ label: "Dievčatá mini",      href: "/dievcata-mini.html",      venue: "ŠH Rohožník", icon: "/skh.png", club: "Rohožník / Malacky" },
};
const TYPES = ["zapas", "vysledok", "oznamy"];

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
async function readJson(env, key, fallback) {
  const v = await env.ARCHIV.get(key, { type: "json" }).catch(() => null);
  return v == null ? fallback : v;
}

// /push/key, /push/subscribe, /push/unsubscribe
export async function handlePush(request, env, url) {
  if (!env.ARCHIV) return json({ error: "no storage" }, 500);
  if (url.pathname === "/push/key") {
    const v = await getVapid(env);
    return json({ key: v.publicKey });
  }
  // prehľad pre správcu webu: počet odberov, front, posledné odoslania (bez adries odberov)
  if (url.pathname === "/push/status") {
    const subs = await readJson(env, SUBS_KEY, []);
    const hosts = {};
    for (const s of subs) { let h = "?"; try { h = new URL(s.endpoint).host; } catch (e) {} hosts[h] = (hosts[h] || 0) + 1; }
    const state = await readJson(env, STATE_KEY, null);
    const queue = await readJson(env, QUEUE_KEY, []);
    return json({
      subscribers: subs.length, services: hosts, queue: queue.length,
      seeded: !!state, known: state ? { results: state.results.length, reminders: state.reminders.length, oznamy: state.oznamy.length, oznamyErr: state.oznamyErr, resultsErr: state.resultsErr } : null,
      log: (await readJson(env, LOG_KEY, [])).slice().reverse(),
    });
  }
  if (request.method !== "POST") return json({ error: "method" }, 405);
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "bad json" }, 400); }
  const sub = body && body.sub;
  const endpoint = sub && typeof sub.endpoint === "string" ? sub.endpoint : (body && body.endpoint);
  if (typeof endpoint !== "string" || !/^https:\/\/[^\s]{10,900}$/.test(endpoint)) return json({ error: "endpoint" }, 400);
  const subs = await readJson(env, SUBS_KEY, []);
  const idx = subs.findIndex((s) => s.endpoint === endpoint);

  // skúšobná správa na jedno zariadenie (tlačidlo v okne upozornení)
  if (url.pathname === "/push/test") {
    if (idx < 0) return json({ ok: false, error: "unknown" }, 404);
    const status = await safeSend(subs[idx], {
      title: "Skúšobná správa ✓", body: "Upozornenia z webu Hádzaná Záhorie fungujú.", icon: "/icon-192.png", url: "/",
    }, await getVapid(env));
    await addLog(env, [logEntry("test", endpoint, status, "Skúšobná správa")]);
    if (status === 404 || status === 410) {
      subs.splice(idx, 1);
      await env.ARCHIV.put(SUBS_KEY, JSON.stringify(subs));
      return json({ ok: false, error: "expired", status });
    }
    return json({ ok: status >= 200 && status < 300, status, error: status >= 200 && status < 300 ? undefined : lastPushError });
  }
  if (url.pathname === "/push/unsubscribe") {
    if (idx >= 0) { subs.splice(idx, 1); await env.ARCHIV.put(SUBS_KEY, JSON.stringify(subs)); }
    return json({ ok: true });
  }
  if (url.pathname !== "/push/subscribe") return json({ error: "not found" }, 404);
  const keys = sub && sub.keys;
  if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string" || keys.p256dh.length > 120 || keys.auth.length > 40)
    return json({ error: "keys" }, 400);
  const types = (Array.isArray(body.types) ? body.types : []).filter((t) => TYPES.includes(t));
  const teams = (Array.isArray(body.teams) ? body.teams : []).filter((t) => PUSH_TEAMS[t]);
  const entry = { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, types, teams, t: Date.now() };
  const isNew = idx < 0;
  if (isNew) {
    if (subs.length >= MAX_SUBS) return json({ error: "full" }, 503);
    subs.push(entry);
  } else subs[idx] = entry;
  await env.ARCHIV.put(SUBS_KEY, JSON.stringify(subs));
  if (isNew) {
    const vapid = await getVapid(env);
    const status = await safeSend(entry, {
      title: "Upozornenia sú zapnuté ✓",
      body: "Odteraz vám budú chodiť správy o zápasoch a výsledkoch, ktoré ste si vybrali.",
      icon: "/icon-192.png", url: "/",
    }, vapid);
    await addLog(env, [logEntry("vitanie", endpoint, status, "Upozornenia sú zapnuté")]);
    return json({ ok: true, push: status });
  }
  return json({ ok: true });
}

// ---- pomocné funkcie pre dátumy (časové pásmo Bratislava) ----
function localParts(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute };
}
const pad = (n) => String(n).padStart(2, "0");
function skDate(y, m, d) { return `${pad(d)}.${pad(m)}.${y}`; }
function parseSk(s) { const p = String(s).split(".").map(Number); return Date.UTC(p[2], (p[1] || 1) - 1, p[0] || 1); }
const WD = ["ne", "po", "ut", "st", "št", "pi", "so"];

// slug oznamu - rovnako ako v news.js (adresa oznam.html?o=...)
function slugify(t) {
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "oznam";
}

// Zistí nové udalosti (pripomienky, výsledky, oznamy) a pridá správy do frontu.
async function detect(env, ctx, getResults) {
  const state = await readJson(env, STATE_KEY, null);
  const before = JSON.stringify(state);
  const first = !state;
  const st = state || { results: [], reminders: [], oznamy: [] };
  const msgs = [];
  const now = localParts();

  // nové oznamy (oznamy.json)
  try {
    const res = await env.ASSETS.fetch(new Request("https://assets.local/oznamy.json"));
    if (!res.ok) throw new Error("oznamy.json " + res.status);
    const list = await res.json();
    // prvé úspešné načítanie oznamov len zapamätá, čo už na webe je (nič neposiela)
    const seedOznamy = first || !st.oznamySeeded;
    st.oznamySeeded = true;
    delete st.oznamyErr;
    const used = {};
    for (const o of Array.isArray(list) ? list : []) {
      const base = slugify(o.id || o.nadpis || o.datum);
      let s = base, n = 2;
      while (used[s]) s = base + "-" + n++;
      used[s] = 1;
      if (st.oznamy.includes(s)) continue;
      st.oznamy.push(s);
      if (seedOznamy) continue;
      msgs.push({ type: "oznamy", title: `Nový oznam: ${o.nadpis || "Hádzaná Záhorie"}`,
        body: String(o.text || "").replace(/\s+/g, " ").slice(0, 140), icon: "/icon-192.png", url: "/oznam.html?o=" + encodeURIComponent(s) });
    }
  } catch (e) { st.oznamyErr = String(e && e.message || e).slice(0, 120); }

  let data = {};
  try { data = await getResults(); delete st.resultsErr; } catch (e) { data = {}; st.resultsErr = String(e && e.message || e).slice(0, 120); }
  const todayUtc = Date.UTC(now.y, now.m - 1, now.d);
  const tomorrow = new Date(todayUtc + 86400000);
  const tomorrowSk = skDate(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate());

  for (const [key, entry] of Object.entries(data)) {
    const meta = PUSH_TEAMS[key];
    if (!meta || !entry || entry.error) continue;
    // tím, ktorého výsledky sa načítali prvýkrát, sa len zapamätá (žiadne staré správy)
    st.teamsSeen = st.teamsSeen || [];
    const newTeam = !st.teamsSeen.includes(key);
    if (newTeam) st.teamsSeen.push(key);
    for (const r of entry.results || []) {
      const id = `${key}|${r.date}|${r.opponent}`;
      if (st.results.includes(id)) continue;
      st.results.push(id);
      // len čerstvé výsledky (posledné 4 dni), staršie sa len zapamätajú
      if (first || newTeam || todayUtc - parseSk(r.date) > 4 * 86400000) continue;
      const home = r.home ? meta.club : r.opponent, away = r.home ? r.opponent : meta.club;
      const verdict = r.result ? " · " + String(r.result).toLowerCase() : "";
      msgs.push({ type: "vysledok", team: key, title: `Výsledok: ${meta.label}`,
        body: `${home} – ${away} ${String(r.score || "").replace(/\s+/g, "")}${verdict}`, icon: meta.icon, url: meta.href });
    }
    if (now.h === 18) {
      for (const u of entry.upcoming || []) {
        if (u.date !== tomorrowSk) continue;
        const id = `${key}|${u.date}|${u.opponent}`;
        if (st.reminders.includes(id)) continue;
        st.reminders.push(id);
        const home = u.home ? meta.club : u.opponent, away = u.home ? u.opponent : meta.club;
        const place = u.home ? meta.venue : (u.awayCity || "");
        const wd = WD[new Date(parseSk(u.date)).getUTCDay()];
        msgs.push({ type: "zapas", team: key, title: `Zajtra hrajú ${meta.label} 🤾`,
          body: `${wd} ${u.date.slice(0, 6)}${u.time ? " o " + u.time : ""} · ${home} – ${away}${place ? " · " + place : ""}`,
          icon: meta.icon, url: meta.href });
      }
    }
  }

  for (const k of ["results", "reminders", "oznamy"]) st[k] = st[k].slice(-800);
  const after = JSON.stringify(st);
  if (after !== before) await env.ARCHIV.put(STATE_KEY, after);
  return msgs;
}

// Každých 10 minút: odošle čakajúce správy; raz za hodinu (o :30) zistí nové udalosti.
export async function pushTick(env, ctx, getResults) {
  if (!env.ARCHIV) return;
  let queue = await readJson(env, QUEUE_KEY, []);
  const now = localParts();
  if (!queue.length && now.min >= 30 && now.min < 40) {
    const msgs = await detect(env, ctx, getResults);
    await addLog(env, [{ t: new Date().toISOString(), kind: "kontrola", noveSpravy: msgs.length }]);
    if (msgs.length) {
      const subs = await readJson(env, SUBS_KEY, []);
      for (const s of subs) {
        const mine = msgs.filter((m) => s.types.includes(m.type) && (m.type === "oznamy" || s.teams.includes(m.team)));
        if (!mine.length) continue;
        // viac správ naraz -> jedno súhrnné upozornenie
        const msg = mine.length <= 2 ? mine : [{
          title: `${mine.length} novinky z Hádzanej Záhorie`,
          body: mine.map((m) => m.title.replace(/ 🤾$/, "")).join(" · ").slice(0, 180),
          icon: "/icon-192.png", url: "/",
        }];
        for (const m of msg) queue.push({ e: s.endpoint, m: { title: m.title, body: m.body, icon: m.icon, url: m.url } });
      }
      // posielať sa začne až v ďalšom behu (o 10 minút) - tento beh už minul pod-požiadavky na výsledky
      if (queue.length) await env.ARCHIV.put(QUEUE_KEY, JSON.stringify(queue));
    }
    return;
  }
  if (!queue.length) return;
  const batch = queue.slice(0, SENDS_PER_TICK);
  queue = queue.slice(SENDS_PER_TICK);
  const subs = await readJson(env, SUBS_KEY, []);
  const byEp = new Map(subs.map((s) => [s.endpoint, s]));
  const vapid = await getVapid(env);
  const dead = new Set();
  const log = [];
  await Promise.all(batch.map(async (item) => {
    const s = byEp.get(item.e);
    if (!s) return;
    const status = await safeSend(s, item.m, vapid);
    log.push(logEntry("auto", item.e, status, item.m.title));
    if (status === 404 || status === 410) dead.add(item.e);
  }));
  await addLog(env, log);
  if (dead.size) {
    await env.ARCHIV.put(SUBS_KEY, JSON.stringify(subs.filter((s) => !dead.has(s.endpoint))));
    queue = queue.filter((q) => !dead.has(q.e));
  }
  await env.ARCHIV.put(QUEUE_KEY, JSON.stringify(queue));
}
