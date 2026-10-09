/* Kalendár zápasov a klubových akcií.
   Zápasy: /zapasy.json (worker ich berie zo slovakhandball.sk), akcie: akcie.json (upravuje sa na GitHube). */
(function () {
  // ku ktorému klubu patrí tím (farba) a kam vedie odkaz
  var TEAMS = {
    muzi_a:       { label: "Muži Extraliga",     club: "zahoraci", name: "Malacky",            href: "muzi-extraliga.html",     venue: "Šport Aréna Malacky" },
    muzi_b:       { label: "Muži 1. liga",       club: "zahoraci", name: "Malacky",            href: "muzi-1-liga.html",        venue: "Šport Aréna Malacky" },
    dorast_st_ch: { label: "Starší dorastenci",  club: "zahoraci", name: "Malacky",            href: "starsi-dorastenci.html",  venue: "Šport Aréna Malacky" },
    dorast_ml_ch: { label: "Mladší dorastenci",  club: "zahoraci", name: "Malacky",            href: "mladsi-dorastenci.html",  venue: "Šport Aréna Malacky" },
    ziaci_st:     { label: "Starší žiaci",       club: "strojar",  name: "Malacky",            href: "starsi-ziaci.html",       venue: "Šport Aréna Malacky" },
    ziaci_ml:     { label: "Mladší žiaci",       club: "strojar",  name: "Malacky",            href: "mladsi-ziaci.html",       venue: "Šport Aréna Malacky" },
    chlapci_mini: { label: "Chlapci mini",       club: "strojar",  name: "Malacky",            href: "chlapci-mini.html",       venue: "Šport Aréna Malacky" },
    zeny:         { label: "Ženy",               club: "rohoznik", name: "Rohožník / Malacky", href: "zeny.html",               venue: "Šport Aréna Malacky" },
    dorast_st:    { label: "Staršie dorastenky", club: "rohoznik", name: "Rohožník / Malacky", href: "starsie-dorastenky.html", venue: "Šport Aréna Malacky" },
    dorast_ml:    { label: "Mladšie dorastenky", club: "rohoznik", name: "Rohožník / Malacky", href: "mladsie-dorastenky.html", venue: "Šport Aréna Malacky" },
    sz:           { label: "Staršie žiačky",     club: "rohoznik", name: "Rohožník / Malacky", href: "starsie-ziacky.html",     venue: "ŠH Rohožník" },
    mza:          { label: "Mladšie žiačky A",   club: "rohoznik", name: "Rohožník / Malacky", href: "mladsie-ziacky-a.html",   venue: "ŠH Rohožník" },
    mzb:          { label: "Mladšie žiačky B",   club: "rohoznik", name: "Rohožník / Malacky", href: "mladsie-ziacky-b.html",   venue: "ŠH Rohožník" },
    mzc:          { label: "Mladšie žiačky C",   club: "rohoznik", name: "Rohožník / Malacky", href: "mladsie-ziacky-c.html",   venue: "ŠH Rohožník" },
    dievcata_mini:{ label: "Dievčatá mini",      club: "rohoznik", name: "Rohožník / Malacky", href: "dievcata-mini.html",      venue: "ŠH Rohožník" }
  };
  var MONTHS = ["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];
  var MONTHS_GEN = ["januára", "februára", "marca", "apríla", "mája", "júna", "júla", "augusta", "septembra", "októbra", "novembra", "decembra"];
  var WD = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
  var WD_LONG = ["Nedeľa", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"];
  var MAX_IN_CELL = 3;

  var grid = document.getElementById("kal-grid");
  var dayBox = document.getElementById("kal-day");
  var listBox = document.getElementById("kal-list");
  var note = document.getElementById("kal-note");
  var title = document.getElementById("kal-title");
  if (!grid) return;

  var events = [];          // všetky položky {d: Date, key: "2026-10-11", ...}
  var filter = "vsetko";
  var view = window.matchMedia && window.matchMedia("(max-width:760px)").matches ? "zoznam" : "mesiac";
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var cur = new Date(today.getFullYear(), today.getMonth(), 1);
  var selected = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function parseDate(s) {
    var p = String(s).split(".").map(Number);
    var d = new Date(p[2], (p[1] || 1) - 1, p[0] || 1);
    return isNaN(d) ? null : d;
  }
  function dkey(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function logo(src) {
    return src && /^\/[A-Za-z0-9._\/-]+$/.test(src) ? '<img src="' + esc(src) + '" alt="" loading="lazy" onerror="this.remove()">' : "";
  }
  function visible(e) {
    if (filter === "vsetko") return true;
    if (filter === "akcie") return e.type === "akcia";
    return e.club === filter;
  }

  // ---- načítanie dát ----
  function loadMatches() {
    return fetch("/zapasy.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        (data.zapasy || []).forEach(function (m) {
          var t = TEAMS[m.tim]; var d = parseDate(m.date);
          if (!t || !d) return;
          events.push({
            type: "zapas", d: d, key: dkey(d), time: m.played ? "" : (m.time || ""), club: t.club, team: t,
            home: m.home, opponent: m.opponent, opponentLogo: m.opponentLogo, clubLogo: m.clubLogo,
            played: m.played, score: m.score, result: m.result,
            place: m.home ? t.venue : (m.awayCity || ""), detailUrl: m.detailUrl
          });
        });
      });
  }
  function loadAkcie() {
    return fetch("/akcie.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) return []; return r.json(); })
      .then(function (list) {
        (Array.isArray(list) ? list : []).forEach(function (a) {
          var from = parseDate(a.datum); if (!from) return;
          var to = a.do ? parseDate(a.do) : from; if (!to || to < from) to = from;
          for (var d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
            var day = new Date(d);
            events.push({
              type: "akcia", d: day, key: dkey(day), time: a.cas || "", club: a.klub || "", title: a.nazov,
              place: a.miesto || "", desc: a.popis || "", link: a.odkaz || "", multi: a.do ? (a.datum + " – " + a.do) : ""
            });
          }
        });
      }).catch(function () {});
  }

  // ---- jedna položka v zozname ----
  function itemHtml(e) {
    if (e.type === "akcia") {
      var tag = e.link ? "a" : "div";
      return "<" + tag + ' class="kal-item akcia"' + (e.link ? ' href="' + esc(e.link) + '"' : "") + ">" +
        '<div class="kal-time">' + esc(e.time || "–") + "</div>" +
        '<div><div class="kal-cat">Klubová akcia' + (e.multi ? " · " + esc(e.multi) : "") + "</div>" +
        '<div class="kal-teams">' + esc(e.title) + "</div>" +
        (e.place ? '<div class="kal-place">' + esc(e.place) + "</div>" : "") +
        (e.desc ? '<div class="kal-desc">' + esc(e.desc) + "</div>" : "") + "</div>" +
        '<div class="kal-right">' + (e.link ? '<span class="kal-badge">Viac →</span>' : "") + "</div></" + tag + ">";
    }
    var ours = '<span class="ours">' + logo(e.clubLogo) + " " + esc(e.team.name) + "</span>";
    var opp = "<span>" + logo(e.opponentLogo) + " " + esc(e.opponent) + "</span>";
    var right = e.played
      ? '<span class="kal-score ' + (e.result === "Výhra" ? "win" : e.result === "Prehra" ? "loss" : "") + '">' + esc(String(e.score).replace(/\s+/g, "")) + "</span>"
      : '<span class="kal-badge">' + (e.home ? "Doma" : "Vonku") + "</span>";
    return '<a class="kal-item ' + e.club + '" href="' + e.team.href + '">' +
      '<div class="kal-time">' + esc(e.played ? "✓" : (e.time || "–")) + "</div>" +
      '<div><div class="kal-cat">' + esc(e.team.label) + "</div>" +
      '<div class="kal-teams">' + (e.home ? ours + " – " + opp : opp + " – " + ours) + "</div>" +
      (e.place ? '<div class="kal-place">' + esc(e.place) + "</div>" : "") + "</div>" +
      '<div class="kal-right">' + right + "</div></a>";
  }
  function sortDay(a, b) {
    if (a.type !== b.type) return a.type === "akcia" ? -1 : 1;
    return String(a.time).localeCompare(String(b.time));
  }
  function dayTitle(d) { return WD_LONG[d.getDay()] + " " + d.getDate() + ". " + MONTHS_GEN[d.getMonth()]; }

  // ---- mesačný pohľad ----
  function renderMonth() {
    title.textContent = MONTHS[cur.getMonth()].charAt(0).toUpperCase() + MONTHS[cur.getMonth()].slice(1) + " " + cur.getFullYear();
    var html = "";
    ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"].forEach(function (w) { html += '<div class="kal-wd">' + w + "</div>"; });
    var first = new Date(cur);
    var start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    var byDay = {};
    events.forEach(function (e) { if (visible(e)) (byDay[e.key] = byDay[e.key] || []).push(e); });
    for (var i = 0; i < 42; i++) {
      var d = new Date(start); d.setDate(start.getDate() + i);
      if (i >= 35 && d.getMonth() !== cur.getMonth()) break;
      var k = dkey(d), list = (byDay[k] || []).sort(sortDay);
      var cls = "kal-cell" + (d.getMonth() !== cur.getMonth() ? " out" : "") + (+d === +today ? " today" : "") + (selected === k ? " sel" : "");
      var inner = '<span class="kal-num">' + d.getDate() + "</span>";
      list.slice(0, MAX_IN_CELL).forEach(function (e) {
        if (e.type === "akcia") inner += '<span class="kal-ev akcia">★ ' + esc(e.title) + "</span>";
        else inner += '<span class="kal-ev ' + e.club + (e.home ? " home" : "") + '">' +
          (e.played ? "" : "<b>" + esc(e.time) + "</b> ") + esc(e.team.label) + "</span>";
      });
      if (list.length > MAX_IN_CELL) inner += '<span class="kal-more">+ ďalšie ' + (list.length - MAX_IN_CELL) + "</span>";
      if (list.length) inner += '<span class="kal-dots">' + list.slice(0, 5).map(function (e) {
        return '<i class="dot ' + (e.type === "akcia" ? "akcie" : e.club) + '"></i>';
      }).join("") + "</span>";
      html += '<button type="button" class="' + cls + '" data-k="' + k + '" aria-label="' + esc(dayTitle(d)) + ", " + list.length + ' udalostí">' + inner + "</button>";
    }
    grid.innerHTML = html;
    renderDay();
  }
  function renderDay() {
    if (!selected) { dayBox.hidden = true; return; }
    var list = events.filter(function (e) { return e.key === selected && visible(e); }).sort(sortDay);
    var p = selected.split("-").map(Number), d = new Date(p[0], p[1] - 1, p[2]);
    dayBox.innerHTML = "<h3>" + esc(dayTitle(d)) + "</h3>" +
      (list.length ? list.map(itemHtml).join("") : '<div class="kal-empty">V tento deň nie je žiadny zápas ani akcia.</div>');
    dayBox.hidden = false;
  }

  // ---- zoznam (od dnešného dňa) ----
  function renderList() {
    title.textContent = "Najbližšie udalosti";
    var list = events.filter(function (e) { return visible(e) && e.d >= today; })
      .sort(function (a, b) { return a.d - b.d || sortDay(a, b); });
    if (!list.length) { listBox.innerHTML = '<div class="kal-empty">Žiadne naplánované zápasy ani akcie.</div>'; return; }
    var html = "", last = "";
    list.slice(0, 80).forEach(function (e) {
      if (e.key !== last) { html += "<h3>" + esc(dayTitle(e.d)) + "</h3>"; last = e.key; }
      html += itemHtml(e);
    });
    listBox.innerHTML = html;
  }

  function render() {
    document.querySelectorAll(".kal-views button").forEach(function (b) { b.classList.toggle("active", b.dataset.view === view); });
    var month = view === "mesiac";
    grid.hidden = !month;
    listBox.hidden = month;
    document.getElementById("kal-prev").hidden = !month;
    document.getElementById("kal-next").hidden = !month;
    document.getElementById("kal-today").hidden = !month;
    if (month) renderMonth(); else { dayBox.hidden = true; renderList(); }
  }

  // ---- ovládanie ----
  document.getElementById("kal-prev").addEventListener("click", function () { cur.setMonth(cur.getMonth() - 1); selected = null; render(); });
  document.getElementById("kal-next").addEventListener("click", function () { cur.setMonth(cur.getMonth() + 1); selected = null; render(); });
  document.getElementById("kal-today").addEventListener("click", function () { cur = new Date(today.getFullYear(), today.getMonth(), 1); selected = dkey(today); render(); });
  document.querySelectorAll(".kal-views button").forEach(function (b) {
    b.addEventListener("click", function () { view = b.dataset.view; render(); });
  });
  document.querySelectorAll("#kal-filters button").forEach(function (b) {
    b.addEventListener("click", function () {
      filter = b.dataset.f;
      document.querySelectorAll("#kal-filters button").forEach(function (x) { x.classList.toggle("active", x === b); });
      render();
    });
  });
  grid.addEventListener("click", function (ev) {
    var cell = ev.target.closest(".kal-cell"); if (!cell) return;
    selected = selected === cell.dataset.k ? null : cell.dataset.k;
    renderMonth();
    if (selected) dayBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  Promise.all([loadMatches().catch(function () { note.textContent = "Zápasy sa nepodarilo načítať, zobrazujú sa len klubové akcie."; }), loadAkcie()])
    .then(function () {
      if (note.textContent.indexOf("nepodarilo") === -1)
        note.innerHTML = '<span class="kal-legend"><span><i style="background:#1E7B2E"></i>plná farba = domáci zápas</span>' +
          '<span><i style="background:#e6efe8;border-left:4px solid #1E7B2E"></i>svetlá = zápas vonku</span>' +
          '<span><i style="background:#fff6d6;border-left:4px solid #F2B705"></i>★ klubová akcia</span></span>';
      // ak tento mesiac nič nie je, skoč na mesiac s najbližšou udalosťou
      var next = events.filter(function (e) { return e.d >= today; }).sort(function (a, b) { return a.d - b.d; })[0];
      if (next && !events.some(function (e) { return e.d.getMonth() === cur.getMonth() && e.d.getFullYear() === cur.getFullYear(); }))
        cur = new Date(next.d.getFullYear(), next.d.getMonth(), 1);
      render();
    });
  render();
})();
