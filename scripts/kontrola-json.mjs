// Kontrola JSON súborov webu pred nasadením.
// Spúšťa sa automaticky pri každom pushi (GitHub Actions aj build na Cloudflare).
// Ak nájde chybu, vypíše, v ktorom súbore a na ktorom riadku je, a nasadenie sa zastaví,
// aby sa na web nedostala rozbitá verzia.
//
// Ručné spustenie:  node scripts/kontrola-json.mjs

import { readFileSync, existsSync } from "node:fs";

const chyby = [];
const chyba = (subor, sprava) => chyby.push(`${subor}: ${sprava}`);

// Riadok a stĺpec z pozície v texte
function riadokStlpec(text, pozicia) {
  const pred = text.slice(0, pozicia);
  const riadky = pred.split("\n");
  return { riadok: riadky.length, stlpec: riadky[riadky.length - 1].length + 1 };
}

// Prejde text podľa pravidiel JSON a vráti pozíciu prvého znaku, ktorý tam nepatrí.
// (JSON.parse v novších verziách Node pri niektorých chybách riadok neuvádza.)
function najdiChybu(text) {
  let i = 0;
  const ws = () => { while (i < text.length && " \t\n\r".includes(text[i])) i++; };
  const fail = () => { throw i; };
  const value = () => {
    ws();
    const c = text[i];
    if (c === "{") {
      i++; ws();
      if (text[i] === "}") { i++; return; }
      for (;;) {
        ws(); if (text[i] !== '"') fail(); string(); ws();
        if (text[i] !== ":") fail(); i++; value(); ws();
        if (text[i] === ",") { i++; continue; }
        if (text[i] === "}") { i++; return; }
        fail();
      }
    }
    if (c === "[") {
      i++; ws();
      if (text[i] === "]") { i++; return; }
      for (;;) {
        value(); ws();
        if (text[i] === ",") { i++; continue; }
        if (text[i] === "]") { i++; return; }
        fail();
      }
    }
    if (c === '"') return string();
    const m = /^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i));
    if (!m) fail();
    i += m[0].length;
  };
  const string = () => {
    i++;
    while (i < text.length && text[i] !== '"') {
      if (text[i] === "\\") i++;
      else if (text[i] === "\n") fail();
      i++;
    }
    if (i >= text.length) fail();
    i++;
  };
  try {
    value(); ws();
    return i < text.length ? i : null;
  } catch (pos) {
    return pos;
  }
}

// Pozícia chyby z hlásenia JSON.parse (rôzne verzie Node ju píšu rôzne)
function poziciaChyby(text, err) {
  const vlastna = najdiChybu(text);
  if (vlastna !== null) return riadokStlpec(text, Math.min(vlastna, text.length));
  const msg = String(err.message);
  let m = msg.match(/line (\d+) column (\d+)/);
  if (m) return { riadok: Number(m[1]), stlpec: Number(m[2]) };
  m = msg.match(/position (\d+)/);
  if (m) return riadokStlpec(text, Number(m[1]));
  if (/end of (JSON|data) input/i.test(msg)) return riadokStlpec(text, text.length);
  return null;
}

// Typické chyby pri ručnej úprave - pridá zrozumiteľnú radu
function rada(text, pos) {
  const riadky = text.split("\n");
  const aktualny = (riadky[pos.riadok - 1] || "").trim();
  // predchádzajúci neprázdny riadok
  let i = pos.riadok - 2;
  while (i >= 0 && !riadky[i].trim()) i--;
  const predosly = i >= 0 ? riadky[i].trim() : "";

  if (/[“”„]/.test(aktualny)) {
    return "V riadku sú typografické úvodzovky („ “). Text musí byť v obyčajných úvodzovkách \"...\".";
  }
  if (/^[{"\[]/.test(aktualny) && /[}\]"\d]$|true$|false$|null$/.test(predosly)) {
    return `Na konci riadku ${i + 1} pravdepodobne chýba čiarka.`;
  }
  if (/^[}\]]/.test(aktualny) && /,$/.test(predosly)) {
    return `Na konci riadku ${i + 1} je čiarka navyše (za posledným záznamom čiarka nebýva).`;
  }
  return "Skontroluj čiarky, úvodzovky a zátvorky okolo tohto miesta.";
}

function nacitaj(subor) {
  if (!existsSync(subor)) {
    chyba(subor, "súbor chýba");
    return undefined;
  }
  let text = readFileSync(subor, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  try {
    return JSON.parse(text);
  } catch (err) {
    const pos = poziciaChyby(text, err);
    if (pos) {
      const ukazka = (text.split("\n")[pos.riadok - 1] || "").trim().slice(0, 80);
      chyba(subor, `chyba v zápise na riadku ${pos.riadok}, stĺpec ${pos.stlpec}: ${ukazka}\n    → ${rada(text, pos)}`);
    } else {
      chyba(subor, `chyba v zápise: ${err.message}`);
    }
    return undefined;
  }
}

const jeText = (v) => typeof v === "string" && v.trim() !== "";

function skontrolujFotky(subor, kde, fotky) {
  if (!Array.isArray(fotky)) {
    chyba(subor, `${kde}: "fotky" má byť zoznam v hranatých zátvorkách, napr. ["fotka.jpg"]`);
    return;
  }
  for (const f of fotky) {
    const cesta = typeof f === "string" ? f : f && f.foto;
    if (!jeText(cesta)) {
      chyba(subor, `${kde}: prázdny názov fotky`);
    } else if (!/^https?:\/\//.test(cesta) && !existsSync(cesta.replace(/^\//, ""))) {
      chyba(subor, `${kde}: fotka "${cesta}" v repozitári neexistuje (skontroluj názov, priečinok a veľké/malé písmená)`);
    }
  }
}

// --- oznamy.json ---
{
  const s = "oznamy.json";
  const d = nacitaj(s);
  if (d !== undefined) {
    if (!Array.isArray(d)) chyba(s, "obsah má byť zoznam oznamov v hranatých zátvorkách [ ... ]");
    else
      d.forEach((o, i) => {
        const kde = `oznam č. ${i + 1}${o && o.nadpis ? ` („${o.nadpis}“)` : ""}`;
        if (!o || typeof o !== "object") return chyba(s, `${kde}: záznam má byť v zložených zátvorkách { ... }`);
        if (!jeText(o.nadpis)) chyba(s, `${kde}: chýba "nadpis"`);
        if (o.fotky !== undefined) skontrolujFotky(s, kde, o.fotky);
        if (o.odkaz !== undefined && !jeText(o.odkaz)) chyba(s, `${kde}: "odkaz" je prázdny`);
      });
  }
}

// --- akcie.json (klubové akcie v kalendári) ---
if (existsSync("akcie.json")) {
  const s = "akcie.json";
  const d = nacitaj(s);
  const DATUM = /^\d{1,2}\.\d{1,2}\.\d{4}$/;
  if (d !== undefined) {
    if (!Array.isArray(d)) chyba(s, "obsah má byť zoznam akcií v hranatých zátvorkách [ ... ]");
    else
      d.forEach((a, i) => {
        const kde = `akcia č. ${i + 1}${a && a.nazov ? ` („${a.nazov}“)` : ""}`;
        if (!a || typeof a !== "object") return chyba(s, `${kde}: záznam má byť v zložených zátvorkách { ... }`);
        if (!jeText(a.nazov)) chyba(s, `${kde}: chýba "nazov"`);
        if (!DATUM.test(a.datum || "")) chyba(s, `${kde}: "datum" má byť v tvare "31.10.2026"`);
        if (a.do !== undefined && !DATUM.test(a.do)) chyba(s, `${kde}: "do" má byť v tvare "01.11.2026"`);
        if (a.cas !== undefined && !/^\d{1,2}:\d{2}$/.test(a.cas)) chyba(s, `${kde}: "cas" má byť v tvare "09:00"`);
        if (a.klub !== undefined && !["rohoznik", "zahoraci", "strojar"].includes(a.klub))
          chyba(s, `${kde}: "klub" musí byť rohoznik, zahoraci alebo strojar (alebo ho vynechaj)`);
      });
  }
}

// --- galeria.json ---
{
  const s = "galeria.json";
  const d = nacitaj(s);
  if (d !== undefined) {
    if (!Array.isArray(d)) chyba(s, "obsah má byť zoznam albumov v hranatých zátvorkách [ ... ]");
    else
      d.forEach((a, i) => {
        const kde = `album č. ${i + 1}${a && a.nazov ? ` („${a.nazov}“)` : ""}`;
        if (!a || typeof a !== "object") return chyba(s, `${kde}: záznam má byť v zložených zátvorkách { ... }`);
        if (!jeText(a.nazov)) chyba(s, `${kde}: chýba "nazov"`);
        skontrolujFotky(s, kde, a.fotky);
      });
  }
}

// --- hero.json ---
{
  const s = "hero.json";
  const d = nacitaj(s);
  if (d !== undefined) {
    if (!d || typeof d !== "object" || Array.isArray(d)) chyba(s, "obsah má byť v zložených zátvorkách { ... }");
    else {
      if (d.interval_sekundy !== undefined && !(Number(d.interval_sekundy) > 0))
        chyba(s, '"interval_sekundy" má byť kladné číslo');
      skontrolujFotky(s, "banner", d.fotky);
    }
  }
}

// --- sutaze.json ---
{
  const s = "sutaze.json";
  const d = nacitaj(s);
  const PRESETY = ["girls", "boys", "zahoraci_a", "zahoraci_b"];
  if (d !== undefined) {
    if (!d || typeof d.timy !== "object" || Array.isArray(d.timy)) chyba(s, 'chýba časť "timy"');
    else {
      if (!/^\d{4}\/\d{4}$/.test(d.aktualna_sezona || ""))
        chyba(s, '"aktualna_sezona" má byť v tvare "2026/2027"');
      for (const [kluc, t] of Object.entries(d.timy)) {
        const kde = `tím "${kluc}"`;
        if (t.tim_regex !== undefined) {
          try {
            new RegExp(t.tim_regex, "i");
          } catch (err) {
            chyba(s, `${kde}: "tim_regex" nie je platný vzor (${err.message})`);
          }
        } else if (t.tim !== undefined && !PRESETY.includes(t.tim)) {
          chyba(s, `${kde}: "tim" musí byť jedno z: ${PRESETY.join(", ")}`);
        }
        if (t.logo !== undefined) {
          if (!jeText(t.logo) || !/^[A-Za-z0-9._\/-]+\.(png|jpe?g|webp|svg)$/i.test(t.logo) || t.logo.includes(".."))
            chyba(s, `${kde}: "logo" má byť názov obrázka bez medzier a diakritiky, napr. "strojar-malacky.jpg"`);
          else if (!existsSync(t.logo.replace(/^\/+/, "")))
            chyba(s, `${kde}: logo "${t.logo}" v repozitári neexistuje`);
        }
        for (const [sezona, fazy] of Object.entries(t.sezony || {})) {
          if (!/^\d{4}\/\d{4}$/.test(sezona)) chyba(s, `${kde}: sezóna "${sezona}" má byť v tvare "2026/2027"`);
          if (!Array.isArray(fazy)) {
            chyba(s, `${kde}, sezóna ${sezona}: fázy majú byť zoznam [ ... ]`);
            continue;
          }
          fazy.forEach((f, i) => {
            if (!f || !/^https:\/\/(www\.)?slovakhandball\.sk\/competition\?id=\d+/.test(f.url || ""))
              chyba(s, `${kde}, sezóna ${sezona}, fáza č. ${i + 1}: "url" má byť odkaz na súťaž na slovakhandball.sk (https://www.slovakhandball.sk/competition?id=...)`);
          });
        }
      }
    }
  }
}

if (chyby.length) {
  console.error(`\n✗ Našli sa chyby v súboroch (${chyby.length}). Web sa nenasadí, kým ich neopravíš:\n`);
  for (const c of chyby) console.error("  • " + c + "\n");
  process.exit(1);
}
console.log("✓ JSON súbory sú v poriadku (oznamy, galéria, banner, súťaže).");
