/* Súpiska družstva na stránke tímu (údaje zo stránky tímu na slovakhandball.sk cez /vysledky).
   Na stránke stačí: <div class="supiska" data-supiska="muzi_a" data-foto="1"></div>
   data-foto="0" = bez fotiek (len číslo a meno). */
(function () {
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function goly(n) { return n === 1 ? "gól" : n >= 2 && n <= 4 ? "góly" : "gólov"; }
  function zapasy(n) { return n === 1 ? "zápas" : n >= 2 && n <= 4 ? "zápasy" : "zápasov"; }
  function card(p, foto, top) {
    var stat = p.goly != null && p.zapasy ? '<span class="sp-stat"><b>' + p.goly + "</b> " + goly(p.goly) + " · " + p.zapasy + " " + zapasy(p.zapasy) + "</span>" : "";
    var num = '<span class="sp-num">' + (p.cislo != null ? esc(p.cislo) : "–") + "</span>";
    var img = foto && p.foto && /^\/[A-Za-z0-9._\/-]+$/.test(p.foto)
      ? '<img src="' + esc(p.foto) + '" alt="' + esc(p.meno + " " + p.priezvisko) + '" loading="lazy" onerror="this.remove()">' : "";
    return '<div class="sp-card' + (foto ? "" : " sp-mini") + (top ? " sp-top" : "") + '">' +
      (foto ? '<div class="sp-photo">' + img + '<span class="sp-sil" aria-hidden="true"></span>' + num + (top ? '<span class="sp-badge">Najlepší strelec</span>' : "") + "</div>" : num) +
      '<div class="sp-info"><span class="sp-first">' + esc(p.meno) + '</span><span class="sp-last">' + esc(p.priezvisko) + "</span>" + stat + "</div></div>";
  }
  function render(box, players) {
    var foto = box.getAttribute("data-foto") !== "0";
    if (!players || !players.length) { box.closest("section") && (box.closest("section").hidden = true); return; }
    var max = Math.max.apply(null, players.map(function (p) { return p.goly || 0; }));
    box.innerHTML = '<div class="sp-grid' + (foto ? "" : " sp-grid-mini") + '">' +
      players.map(function (p) { return card(p, foto, max > 0 && p.goly === max); }).join("") + "</div>" +
      '<p class="sp-note">Súpiska, góly a zápasy v sezóne podľa <a href="https://slovakhandball.sk" target="_blank" rel="noopener">slovakhandball.sk</a>.</p>';
    box.closest("section") && (box.closest("section").hidden = false);
  }
  function init() {
    [].forEach.call(document.querySelectorAll("[data-supiska]"), function (box) {
      var key = box.getAttribute("data-supiska");
      fetch("/vysledky?tim=" + encodeURIComponent(key)).then(function (r) { return r.json(); })
        .then(function (d) { render(box, d[key] && d[key].players); })
        .catch(function () { box.closest("section") && (box.closest("section").hidden = true); });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
