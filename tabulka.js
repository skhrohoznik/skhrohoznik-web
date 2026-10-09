// Tabuľka súťaže a logá tímov na stránkach kategórií.
// Dáta prichádzajú z /vysledky (worker ich berie zo stránky súťaže na slovakhandball.sk).
// Stránka musí mať <div id="standings-label-KLUC"> a <table id="standings-KLUC"> s <tbody>.
(function () {
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Logo tímu ako <img>. Adresy /logo/... obsluhuje worker (logá sú zo slovakhandball.sk),
  // vlastné logá tímov (pole "logo" v sutaze.json) sú súbory priamo v repozitári.
  // Ak sa logo nenačíta, obrázok sa jednoducho skryje.
  window.teamLogoHtml = function (src) {
    // povolené sú len adresy na našom webe (/logo/... zo zväzu alebo vlastné logo, napr. /strojar-malacky.jpg)
    if (!src || !/^\/[A-Za-z0-9._\/-]+$/.test(src) || src.indexOf("..") !== -1) return "";
    return '<img class="team-logo" src="' + esc(src) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">';
  };

  // --- Karta "Najbližší zápas" v hlavičke stránky tímu ---
  // Ak tím nemá naplánovaný zápas, ukáže posledný odohraný. Ak nemá ani ten, karta sa skryje.
  var SKIP_WORDS = /^(HK|HC|TJ|ŠKH|SKH|MŠK|ŠŠK|DHK|HKM|KH|ŠK|MHK|HÁO|HADO|SK|AC|DHC|-?\d+)$/i;
  function initials(name) {
    var words = String(name).replace(/[\/,.]/g, " ").split(/\s+/).filter(function (w) {
      return w && !SKIP_WORDS.test(w.replace(/-\d+$/, ""));
    });
    if (!words.length) words = String(name).split(/\s+/);
    return words.slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("");
  }
  function bigLogo(src, name) {
    var fallback = '<span class="nm-initials" aria-hidden="true">' + esc(initials(name)) + "</span>";
    if (!src || !/^\/[A-Za-z0-9._\/-]+$/.test(src) || src.indexOf("..") !== -1) return fallback;
    // ak sa logo nenačíta, ukáže sa namiesto neho krúžok s iniciálami
    return '<img class="nm-logo" src="' + esc(src) + '" alt="" loading="lazy" ' +
      'onerror="this.nextElementSibling.hidden=false;this.remove()">' +
      fallback.replace("<span ", "<span hidden ");
  }
  var WEEKDAYS = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
  function weekday(d) {
    var p = String(d).split(".").map(Number);
    var dt = new Date(p[2], (p[1] || 1) - 1, p[0] || 1);
    return isNaN(dt) ? "" : WEEKDAYS[dt.getDay()] + " ";
  }

  window.renderNextMatch = function (key, phase, meta) {
    var box = document.getElementById("next-match-" + key);
    if (!box) return;
    var up = phase && phase.upcoming && phase.upcoming[0];
    var res = phase && phase.results && phase.results.length ? phase.results[phase.results.length - 1] : null;
    var m = up || res;
    if (!m || !meta) { box.hidden = true; return; }

    var ours = { name: meta.teamLabel, logo: phase.clubLogo, ours: true };
    var opp = { name: m.opponent, logo: m.opponentLogo };
    var home = m.home ? ours : opp;
    var away = m.home ? opp : ours;
    var team = function (t) {
      return '<div class="nm-team' + (t.ours ? " ours" : "") + '">' + bigLogo(t.logo, t.name) + "<span>" + esc(t.name) + "</span></div>";
    };
    var middle = up
      ? '<div class="nm-vs">vs</div>'
      : '<div class="nm-vs score ' + (m.result === "Výhra" ? "win" : m.result === "Prehra" ? "loss" : "") + '">' +
        esc(String(m.score).replace(/\s+/g, "")) + "</div>";
    var when = weekday(m.date) + m.date + (up ? (m.time ? " · " + m.time : " · čas bude upresnený") : "");
    var place = m.home ? meta.venue : (m.awayCity || "");

    box.innerHTML =
      '<div class="nm-top"><span class="nm-kicker">' + (up ? "Najbližší zápas" : "Posledný zápas") + "</span>" +
      '<span class="nm-when">' + esc(when) + "</span></div>" +
      '<div class="nm-teams">' + team(home) + middle + team(away) + "</div>" +
      (place ? '<div class="nm-where">' + (m.home ? "Domáci zápas · " : "Vonku · ") + "<strong>" + esc(place) + "</strong></div>" : "");
    box.hidden = false;
  };

  window.renderStandings = function (key, standings) {
    var label = document.getElementById("standings-label-" + key);
    var table = document.getElementById("standings-" + key);
    if (!label || !table) return;
    var tbody = table.querySelector("tbody");
    var show = Array.isArray(standings) && standings.length > 1;
    label.hidden = !show;
    table.hidden = !show;
    tbody.innerHTML = "";
    if (!show) return;
    standings.forEach(function (r) {
      var tr = document.createElement("tr");
      if (r.ours) tr.className = "ours";
      tr.innerHTML =
        '<td class="st-rank">' + esc(r.rank) + ".</td>" +
        '<td class="st-team">' + window.teamLogoHtml(r.logo) + esc(r.team) + "</td>" +
        '<td class="st-num">' + esc(r.played) + "</td>" +
        '<td class="st-num st-score">' + esc(r.score) + "</td>" +
        '<td class="st-num st-pts">' + esc(r.points) + "</td>";
      tbody.appendChild(tr);
    });
  };
})();
