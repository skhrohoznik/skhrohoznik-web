/* Upozornenia do mobilu (Web Push).
   Pridá do menu tlačidlo "Upozornenia" a okno s výberom, čo a pre ktoré kategórie chce návštevník dostávať.
   Odber sa uloží na serveri (worker /push/subscribe), správy posiela worker podľa rozpisov a výsledkov zo zväzu.
   Netreba telefónne číslo ani e-mail. */
(function () {
  var TEAMS_F = [["zeny", "Ženy"], ["dorast_st", "Staršie dorastenky"], ["dorast_ml", "Mladšie dorastenky"], ["sz", "Staršie žiačky"],
    ["mza", "Mladšie žiačky A"], ["mzb", "Mladšie žiačky B"], ["mzc", "Mladšie žiačky C"], ["dievcata_mini", "Dievčatá mini"]];
  var TEAMS_M = [["muzi_a", "Muži Extraliga"], ["muzi_b", "Muži 1. liga"], ["dorast_st_ch", "Starší dorastenci"], ["dorast_ml_ch", "Mladší dorastenci"],
    ["ziaci_st", "Starší žiaci"], ["ziaci_ml", "Mladší žiaci"], ["chlapci_mini", "Chlapci mini"]];
  var KEY = "hz-push";
  // zvonček, ktorý sa každých 5 s rozhojdá (3 vrstvy: ozvena s "vlnkami", samotný zvonček, tieň)
  var SVG_A = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var BELL_P = '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>';
  var RING = '<span class="hz-bell" aria-hidden="true">' +
    SVG_A + BELL_P + '<path d="M2.5 8a9.5 9.5 0 0 1 2-5.5M21.5 8a9.5 9.5 0 0 0-2-5.5"/></svg>' +
    SVG_A + BELL_P + '</svg>' + SVG_A + BELL_P + '</svg></span>';
  var BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  function save(v) { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) {} }
  var supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;

  var css = '' +
    '.hzp-nav{display:inline-flex;align-items:center;gap:6px;background:none;border:none;font:inherit;color:inherit;cursor:pointer;padding:0;text-transform:inherit;letter-spacing:inherit;font-weight:inherit;font-size:inherit}' +
    '.hzp-nav svg{width:18px;height:18px}@media (min-width:901px){.hzp-nav .lbl{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}}.hzp-nav .on{width:7px;height:7px;border-radius:50%;background:#16a34a;display:none}.hzp-nav.active .on{display:inline-block}' +
    '.hz-bell{position:relative;display:inline-block;width:18px;height:18px;flex:none;line-height:0}' +
    '.hz-bell svg{position:absolute;top:0;left:0;width:100%!important;height:100%!important;transform-origin:50% 8%}' +
    '.hz-bell svg:nth-child(1){z-index:3;opacity:0;animation:hzb1 5s infinite}' +
    '.hz-bell svg:nth-child(2){z-index:2;animation:hzb2 5s infinite}' +
    '.hz-bell svg:nth-child(3){z-index:1;opacity:.45;animation:hzb3 5s infinite}' +
    '.matches-bell .hz-bell{width:16px;height:16px}' +
    '@keyframes hzb1{0%,8%{transform:rotate(0);opacity:0}12%{transform:rotate(42deg);opacity:.5}16%{transform:rotate(-35deg);opacity:.4}20%{transform:rotate(0);opacity:.1}23%{transform:rotate(28deg);opacity:.3}26%{transform:rotate(-20deg);opacity:.2}29%{transform:rotate(0);opacity:.1}31%{transform:rotate(16deg);opacity:0}33%{transform:rotate(-12deg)}35%{transform:rotate(0)}37%{transform:rotate(-6deg)}39%,100%{transform:rotate(0);opacity:0}}' +
    '@keyframes hzb2{0%,8%{transform:rotate(0)}12%{transform:rotate(42deg)}16%{transform:rotate(-35deg)}20%{transform:rotate(0)}23%{transform:rotate(28deg)}26%{transform:rotate(-20deg)}29%{transform:rotate(0)}31%{transform:rotate(16deg)}33%{transform:rotate(-12deg)}35%{transform:rotate(0)}37%{transform:rotate(-6deg)}39%{transform:rotate(0)}40%{transform:rotate(6deg)}44%{transform:rotate(-3deg)}49%{transform:rotate(2deg)}55%{transform:rotate(0)}62%{transform:rotate(1deg)}70%,100%{transform:rotate(0)}}' +
    '@keyframes hzb3{0%,8%{transform:rotate(0);opacity:0}12%{transform:rotate(52deg);opacity:.35}16%{transform:rotate(-48deg);opacity:.3}20%{transform:rotate(0);opacity:0}23%{transform:rotate(42deg);opacity:.25}26%{transform:rotate(-30deg);opacity:.15}29%{transform:rotate(0);opacity:0}31%{transform:rotate(26deg);opacity:.12}33%{transform:rotate(-18deg);opacity:.08}35%{transform:rotate(0);opacity:0}37%{transform:rotate(-12deg);opacity:.2}40%{transform:rotate(6deg);opacity:0}100%{transform:rotate(0);opacity:0}}' +
    '@media (prefers-reduced-motion:reduce){.hz-bell svg{animation:none!important}.hz-bell svg:nth-child(1),.hz-bell svg:nth-child(3){opacity:0}}' +
    '.hzp-ov{position:fixed;inset:0;z-index:3000;background:rgba(14,18,26,.55);display:none;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow-y:auto}' +
    '.hzp-ov.open{display:flex}' +
    '.hzp{background:#fff;color:#161A22;border:2px solid #161A22;box-shadow:0 18px 40px rgba(0,0,0,.3);width:100%;max-width:620px;font-family:"Space Grotesk",sans-serif;text-transform:none;letter-spacing:normal;text-align:left}' +
    '.hzp-head{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #E3DFD2}' +
    '.hzp-head h2{font-family:"Archivo Black",sans-serif;font-weight:400;text-transform:uppercase;font-size:18px;margin:0;display:flex;align-items:center;gap:10px}' +
    '.hzp-head h2 svg{width:22px;height:22px;color:#D6262C}.hzp-x{background:none;border:none;font-size:28px;line-height:1;cursor:pointer;color:#6b6455}' +
    '.hzp-body{padding:14px 20px 4px}.hzp-h{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#6b6455;margin:6px 0 9px}' +
    '.hzp-types{display:grid;gap:7px;margin-bottom:16px}.hzp-type{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid #E3DFD2;cursor:pointer;background:#fbfaf6}' +
    '.hzp-type input{width:18px;height:18px;accent-color:#161A22;flex:none}.hzp-type b{display:block;font-size:14px}.hzp-type span{font-size:12.5px;color:#6b6455}' +
    '.hzp-group{margin-bottom:12px}.hzp-gh{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}' +
    '.hzp-gh strong{font-size:13px;display:flex;align-items:center;gap:7px}.hzp-gh strong i{width:10px;height:10px;border-radius:50%;display:inline-block}' +
    '.hzp-all{background:none;border:none;font:inherit;font-size:12px;font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer;color:#161A22}' +
    '.hzp-chips{display:flex;flex-wrap:wrap;gap:7px}.hzp-chip{display:inline-flex;align-items:center;border:1.5px solid #E3DFD2;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer;user-select:none;background:#fff}' +
    '.hzp-chip input{position:absolute;opacity:0;pointer-events:none}.hzp-chip.on{color:#fff;border-color:var(--c);background:var(--c)}.hzp-chip:focus-within{outline:2px solid #161A22;outline-offset:2px}' +
    '.hzp .g-f{--c:#C21F26}.hzp .g-m{--c:#0B4F9C}' +
    '.hzp-foot{padding:14px 20px 18px;border-top:1px solid #E3DFD2;display:flex;flex-direction:column;gap:10px}' +
    '.hzp-go{background:#D6262C;color:#fff;border:none;font:inherit;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.05em;padding:14px;cursor:pointer}' +
    '.hzp-test{background:#fff;color:#161A22;border:2px solid #161A22;font:inherit;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.05em;padding:11px;cursor:pointer}.hzp-test:disabled{opacity:.6;cursor:wait}' +
    '.hzp-go:disabled{opacity:.6;cursor:wait}.hzp-off{align-self:center;background:none;border:none;font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;color:#6b6455}' +
    '.hzp-note{font-size:12px;color:#6b6455;margin:0}.hzp-msg{display:none;padding:10px 12px;font-size:13.5px;line-height:1.45}' +
    '.hzp-msg.ok{display:block;background:#e8f5ec;border-left:4px solid #16a34a}.hzp-msg.err{display:block;background:#fdecec;border-left:4px solid #D6262C}' +
    '.hzp-msg.info{display:block;background:#eef3fb;border-left:4px solid #0B4F9C}';

  function chips(list, g, sel) {
    return list.map(function (t) {
      var on = sel.indexOf(t[0]) >= 0;
      return '<label class="hzp-chip ' + g + (on ? " on" : "") + '"><input type="checkbox" value="' + t[0] + '"' + (on ? " checked" : "") + ">" + t[1] + "</label>";
    }).join("");
  }

  var ov, navBtns = [];
  function build() {
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    ov = document.createElement("div");
    ov.className = "hzp-ov";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-label", "Upozornenia do mobilu");
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ov.classList.contains("open")) close(); });

    // tlačidlo v hornom menu
    var ul = document.querySelector("#nav-menu > ul") || document.querySelector(".navbar nav ul");
    if (ul) {
      var li = document.createElement("li");
      li.innerHTML = '<button type="button" class="hzp-nav" title="Upozornenia do mobilu">' + RING + '<span class="lbl">Upozornenia</span><span class="on"></span></button>';
      ul.appendChild(li);
    }
    document.querySelectorAll(".hzp-nav, .js-push-open").forEach(function (b) {
      navBtns.push(b);
      var old = b.querySelector(":scope > svg");
      if (old) { var w = document.createElement("span"); w.innerHTML = RING; b.replaceChild(w.firstChild, old); }
      b.addEventListener("click", function (e) { e.preventDefault(); open(); });
    });
    markActive();
  }
  function markActive() {
    var on = !!(load() && load().endpoint && supported && Notification.permission === "granted");
    navBtns.forEach(function (b) { b.classList.toggle("active", on); });
  }

  function render() {
    var cur = load();
    var types = cur ? cur.types : ["zapas", "vysledok"];
    var teams = cur ? cur.teams : [];
    var active = !!(cur && cur.endpoint);
    ov.innerHTML =
      '<div class="hzp">' +
      '<div class="hzp-head"><h2>' + BELL + ' Upozornenia do mobilu</h2><button class="hzp-x" type="button" aria-label="Zavrieť">×</button></div>' +
      '<div class="hzp-body">' +
      '<div class="hzp-h">Čo chcem dostávať</div><div class="hzp-types">' +
      type("zapas", "Pripomienka zápasu", "deň vopred – kedy a kde sa hrá", types) +
      type("vysledok", "Výsledok zápasu", "keď je skóre na stránke zväzu", types) +
      type("oznamy", "Nové oznamy klubu", "turnaje, nábor, zmeny tréningov", types) +
      '</div><div class="hzp-h">Pre ktoré kategórie</div>' +
      '<div class="hzp-group"><div class="hzp-gh"><strong><i style="background:#C21F26"></i>Ženy a dievčatá</strong><button type="button" class="hzp-all" data-g="g-f">Vybrať všetky</button></div>' +
      '<div class="hzp-chips">' + chips(TEAMS_F, "g-f", teams) + "</div></div>" +
      '<div class="hzp-group"><div class="hzp-gh"><strong><i style="background:#0B4F9C"></i>Muži a chlapci</strong><button type="button" class="hzp-all" data-g="g-m">Vybrať všetky</button></div>' +
      '<div class="hzp-chips">' + chips(TEAMS_M, "g-m", teams) + "</div></div>" +
      "</div>" +
      '<div class="hzp-foot"><div class="hzp-msg" role="status"></div>' +
      '<button type="button" class="hzp-go">' + (active ? "Uložiť zmeny" : "🔔 Zapnúť upozornenia") + "</button>" +
      (active ? '<button type="button" class="hzp-test">Poslať skúšobnú správu</button>' : "") +
      (active ? '<button type="button" class="hzp-off">Vypnúť upozornenia v tomto zariadení</button>' : "") +
      '<p class="hzp-note">Netreba telefónne číslo ani e-mail. Upozornenia sa dajú kedykoľvek vypnúť tu alebo v nastaveniach prehliadača. ' +
      'Na iPhone si najprv pridajte web na plochu (Zdieľať → Pridať na plochu) a upozornenia zapnite tam. <a href="/ochrana-udajov.html#upozornenia">Viac o údajoch</a></p></div></div>';
    ov.querySelector(".hzp-x").addEventListener("click", close);
    ov.querySelectorAll(".hzp-chip input").forEach(function (i) {
      i.addEventListener("change", function () { i.parentNode.classList.toggle("on", i.checked); });
    });
    ov.querySelectorAll(".hzp-all").forEach(function (b) {
      b.addEventListener("click", function () {
        var box = ov.querySelectorAll(".hzp-chip." + b.dataset.g + " input");
        var all = [].every.call(box, function (i) { return i.checked; });
        box.forEach(function (i) { i.checked = !all; i.parentNode.classList.toggle("on", !all); });
        b.textContent = all ? "Vybrať všetky" : "Zrušiť všetky";
      });
    });
    ov.querySelector(".hzp-go").addEventListener("click", subscribe);
    var off = ov.querySelector(".hzp-off");
    if (off) off.addEventListener("click", unsubscribe);
    var tst = ov.querySelector(".hzp-test");
    if (tst) tst.addEventListener("click", sendTest);

    if (!supported) {
      msg(isIOS && !standalone
        ? "Na iPhone fungujú upozornenia len z webu pridaného na plochu: v Safari ťuknite na Zdieľať → Pridať na plochu, otvorte web z plochy a upozornenia zapnite tam."
        : "Tento prehliadač upozornenia nepodporuje. Skúste Chrome, Edge, Firefox alebo Safari.", "info");
      ov.querySelector(".hzp-go").disabled = true;
    } else if (Notification.permission === "denied") {
      msg("Upozornenia pre tento web máte v prehliadači zablokované. Povoľte ich v nastaveniach stránky (ikona zámky vedľa adresy) a skúste znova.", "info");
    }
  }
  function type(v, title, sub, sel) {
    return '<label class="hzp-type"><input type="checkbox" value="' + v + '"' + (sel.indexOf(v) >= 0 ? " checked" : "") +
      "><div><b>" + title + "</b><span>" + sub + "</span></div></label>";
  }
  function msg(text, kind) {
    var m = ov.querySelector(".hzp-msg");
    m.className = "hzp-msg " + (kind || "");
    m.textContent = text;
  }
  function selected(sel) { return [].map.call(ov.querySelectorAll(sel + ":checked"), function (i) { return i.value; }); }

  function keyToBytes(b64) {
    var s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4));
    var a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }

  async function subscribe() {
    var types = selected(".hzp-type input"), teams = selected(".hzp-chip input");
    if (!types.length) return msg("Vyberte, čo chcete dostávať.", "err");
    if (!teams.length && (types.indexOf("zapas") >= 0 || types.indexOf("vysledok") >= 0))
      return msg("Vyberte aspoň jednu kategóriu, pre ktorú chcete dostávať zápasy a výsledky.", "err");
    var btn = ov.querySelector(".hzp-go");
    btn.disabled = true;
    try {
      var perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("perm");
      var reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (!sub) {
        var key = (await (await fetch("/push/key")).json()).key;
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(key) });
      }
      var r = await fetch("/push/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sub: sub.toJSON(), types: types, teams: teams }),
      });
      if (!r.ok) throw new Error("server");
      var wasActive = !!(load() && load().endpoint);
      save({ endpoint: sub.endpoint, types: types, teams: teams });
      markActive();
      render();
      msg(wasActive ? "✓ Zmeny sú uložené." : "✓ Upozornenia sú zapnuté. O chvíľu by vám mala prísť skúšobná správa.", "ok");
    } catch (e) {
      btn.disabled = false;
      msg(e && e.message === "perm"
        ? "Upozornenia neboli povolené. Ak ste ich omylom zamietli, povoľte ich v nastaveniach stránky (ikona zámky vedľa adresy)."
        : "Upozornenia sa nepodarilo zapnúť. Skúste to prosím o chvíľu znova.", "err");
    }
  }

  async function sendTest() {
    var b = ov.querySelector(".hzp-test");
    b.disabled = true;
    msg("Posielam skúšobnú správu…", "info");
    try {
      var reg = await navigator.serviceWorker.getRegistration("/sw.js");
      var sub = reg && await reg.pushManager.getSubscription();
      if (!sub || Notification.permission !== "granted") {
        b.disabled = false;
        return msg("V tomto zariadení odber chýba alebo sú upozornenia v prehliadači vypnuté. Kliknite na „Uložiť zmeny“ – odber sa obnoví.", "err");
      }
      var r = await fetch("/push/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      var d = await r.json().catch(function () { return {}; });
      b.disabled = false;
      if (d.ok) return msg("✓ Odoslané. Správa by mala prísť do pár sekúnd. Ak nepríde, skontrolujte, či má prehliadač v nastaveniach telefónu povolené upozornenia.", "ok");
      if (d.error === "unknown" || d.error === "expired") return msg("Odber na serveri chýba alebo vypršal. Kliknite na „Uložiť zmeny“ – obnoví sa.", "err");
      msg("Správu sa nepodarilo odoslať (kód " + (d.status || r.status) + "). Skúste prosím vypnúť a znova zapnúť upozornenia.", "err");
    } catch (e) {
      b.disabled = false;
      msg("Správu sa nepodarilo odoslať. Skúste to o chvíľu znova.", "err");
    }
  }

  async function unsubscribe() {
    try {
      var reg = await navigator.serviceWorker.getRegistration("/sw.js");
      var sub = reg && await reg.pushManager.getSubscription();
      var ep = (sub && sub.endpoint) || (load() && load().endpoint);
      if (sub) await sub.unsubscribe();
      if (ep) await fetch("/push/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: ep }) });
    } catch (e) {}
    save(null);
    markActive();
    render();
    msg("Upozornenia sú v tomto zariadení vypnuté.", "info");
  }

  function open() { render(); ov.classList.add("open"); document.body.style.overflow = "hidden"; }
  function close() { ov.classList.remove("open"); document.body.style.overflow = ""; }

  window.Upozornenia = { open: open };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
