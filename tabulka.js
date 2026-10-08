// Tabuľka súťaže na stránkach kategórií.
// Dáta prichádzajú z /vysledky (worker ich berie zo stránky súťaže na slovakhandball.sk).
// Stránka musí mať <div id="standings-label-KLUC"> a <table id="standings-KLUC"> s <tbody>.
(function () {
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

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
        "<td>" + esc(r.team) + "</td>" +
        '<td class="st-num">' + esc(r.played) + "</td>" +
        '<td class="st-num st-score">' + esc(r.score) + "</td>" +
        '<td class="st-num st-pts">' + esc(r.points) + "</td>";
      tbody.appendChild(tr);
    });
  };
})();
