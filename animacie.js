/* Animácie na stránkach:
   1. plynulé objavovanie nadpisov a kariet pri posúvaní stránky,
   2. "napočítanie" skóre a bodov v tabuľke, keď sa objavia,
   3. odpočet do zápasu/akcie - prvok s atribútom data-odpocet="2026-10-17T18:00"
      (bez času: data-odpocet="2026-10-17", vtedy sa ukážu len dni).
   Ak má návštevník v systéme vypnuté animácie, obsah sa ukáže hneď bez pohybu. */
// Ak sa zápasy/výsledky nenačítajú na prvý raz (krátky výpadok spojenia alebo servera),
// skúsi sa to automaticky ešte dvakrát - návštevník tak neuvidí chybu hneď.
(function () {
  if (!window.fetch) return;
  var orig = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    if (!/^\/(vysledky|zapasy\.json)(\?|$)|\/\/skhrohoznik\.sk\/(vysledky|zapasy\.json)/.test(url)) return orig(input, init);
    var tries = 0;
    function attempt() {
      return orig(input, init).then(function (r) {
        if (!r.ok && tries++ < 2) return new Promise(function (res) { setTimeout(res, 1500 * tries); }).then(attempt);
        return r;
      }, function (e) {
        if (tries++ < 2) return new Promise(function (res) { setTimeout(res, 1500 * tries); }).then(attempt);
        throw e;
      });
    }
    return attempt();
  };
})();

(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 1. objavovanie pri posúvaní ----------
  var REVEAL = [
    '.section-head', '.news-card', '.mc', '.team-head-photo', '.team-head-info > *',
    '.category-card', 'table.results tbody tr', 'table.standings tbody tr', '.footer-col',
    '.nabor-card', '.coach-card', '.club-card', '.gallery-item', '.kal-item', '.doc-card'
  ].join(',');
  var COUNT = '.mc-score, .st-pts, .nm-vs.score, table.results:not(.standings) td.win, table.results:not(.standings) td.loss';

  var io = null, batch = [], batchTimer = null;
  if (!reduce && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('rv-on');
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        batch.push(e.target);
      });
      // prvky, ktoré sa objavia naraz, idú postupne za sebou
      if (batch.length && !batchTimer) batchTimer = requestAnimationFrame(flush);
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
  }
  function flush() {
    batchTimer = null;
    batch.sort(function (a, b) {
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return (ra.top - rb.top) || (ra.left - rb.left);
    });
    batch.forEach(function (el, i) {
      var delay = Math.min(i, 10) * 70;
      el.style.transitionDelay = delay + 'ms';
      el.classList.add('rv-in');
      setTimeout(function () { el.style.transitionDelay = ''; countIn(el); }, delay + 120);
    });
    batch = [];
  }
  function scan(root) {
    if (!io || !root.querySelectorAll) return;
    var list = [].slice.call(root.querySelectorAll(REVEAL));
    if (root.matches && root.matches(REVEAL)) list.push(root);
    list.forEach(function (el) {
      if (el._rv) return;
      el._rv = 1;
      el.classList.add('rv');
      io.observe(el);
    });
  }

  // ---------- 2. napočítanie čísel ----------
  function countIn(el) {
    var targets = el.matches && el.matches(COUNT) ? [el] : [].slice.call(el.querySelectorAll ? el.querySelectorAll(COUNT) : []);
    targets.forEach(function (t) {
      if (t._cnt) return;
      t._cnt = 1;
      // čísla len v samotnom texte (nie v odkaze "Detail")
      var nodes = [].filter.call(t.childNodes, function (n) { return n.nodeType === 3 && /\d/.test(n.nodeValue); });
      nodes.forEach(function (n) {
        var tpl = n.nodeValue, nums = [];
        tpl.replace(/\d+/g, function (d) { nums.push(+d); return d; });
        if (!nums.length || Math.max.apply(null, nums) < 2) return;
        var t0 = performance.now(), D = 900;
        (function step(now) {
          var p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3), i = 0;
          n.nodeValue = tpl.replace(/\d+/g, function () { return String(Math.round(nums[i++] * e)); });
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      });
    });
  }

  // ---------- 3. odpočet ----------
  var UNITS = [['d', 'dni'], ['h', 'hod'], ['m', 'min'], ['s', 'sek']];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parseTarget(v) {
    var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{1,2}):(\d{2}))?/);
    if (!m) return null;
    return { at: new Date(+m[1], m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0), timed: !!m[4] };
  }
  function tickOne(el) {
    var t = el._od || (el._od = parseTarget(el.getAttribute('data-odpocet')));
    if (!t) return;
    var diff = t.at - Date.now();
    if (!el._built) {
      el._built = 1;
      el.classList.add('odpocet');
      el.innerHTML = UNITS.map(function (u) {
        return '<span class="od-box od-' + u[0] + '"><b>00</b><small>' + u[1] + '</small></span>';
      }).join('') + '<span class="od-live" hidden>Práve sa hrá</span>';
    }
    var live = el.querySelector('.od-live');
    el.classList.toggle('od-done', diff <= 0);
    el.classList.toggle('od-past', diff <= (t.timed ? -2 * 3600e3 : -24 * 3600e3));
    if (diff <= 0) {
      var running = t.timed ? diff > -2 * 3600e3 : diff > -24 * 3600e3;
      [].forEach.call(el.querySelectorAll('.od-box'), function (b) { b.hidden = true; });
      live.hidden = false;
      live.textContent = running ? (t.timed ? 'Práve sa hrá' : 'Dnes') : 'Odohrané';
      return;
    }
    var s = Math.floor(diff / 1000);
    var vals = { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
    if (!t.timed) vals = { d: Math.ceil(diff / 86400e3), h: null, m: null, s: null };
    UNITS.forEach(function (u) {
      var box = el.querySelector('.od-' + u[0]), b = box.firstChild, v = vals[u[0]];
      box.hidden = v === null;
      if (v === null) return;
      var txt = u[0] === 'd' ? String(v) : pad(v);
      if (b.textContent !== txt) {
        b.textContent = txt;
        if (!reduce && el._ready) { box.classList.remove('od-flip'); void box.offsetWidth; box.classList.add('od-flip'); }
      }
    });
    el._ready = 1;
  }
  function tick() {
    [].forEach.call(document.querySelectorAll('[data-odpocet]'), tickOne);
  }
  setInterval(tick, 1000);
  // "17.10.2026" + "18:00" -> "2026-10-17T18:00" (hodnota pre data-odpocet)
  function fromSk(datum, cas) {
    var p = String(datum || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!p) return '';
    var t = String(cas || '').match(/^(\d{1,2}):(\d{2})/);
    return p[3] + '-' + pad(+p[2]) + '-' + pad(+p[1]) + (t ? 'T' + pad(+t[1]) + ':' + t[2] : '');
  }
  window.Odpocet = { refresh: tick, fromSk: fromSk };

  // ---------- 4. zápasy pre vyhľadávače (schema.org SportsEvent) ----------
  // MatchLd.set("id", [{date:"25.10.2026", time:"17:00", home:"…", away:"…", place:"…", city:"…", label:"Ženy", url:"/zeny.html"}])
  function skOffset(y, m, d) {
    // letný čas: od poslednej nedele v marci do poslednej nedele v októbri
    function lastSun(mon) { var x = new Date(Date.UTC(y, mon + 1, 0)); return x.getUTCDate() - x.getUTCDay(); }
    var t = m * 100 + d, a = 300 + lastSun(2), b = 1000 + lastSun(9);
    return t >= a && t < b ? "+02:00" : "+01:00";
  }
  window.MatchLd = {
    set: function (id, list) {
      var events = (list || []).map(function (e) {
        var p = String(e.date || "").match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        if (!p) return null;
        var y = +p[3], m = +p[2], d = +p[1];
        var date = p[3] + "-" + pad(m) + "-" + pad(d);
        var t = String(e.time || "").match(/^(\d{1,2}):(\d{2})/);
        var start = t ? date + "T" + pad(+t[1]) + ":" + t[2] + ":00" + skOffset(y, m, d) : date;
        var ev = {
          "@type": "SportsEvent",
          name: (e.label ? e.label + ": " : "") + e.home + " – " + e.away,
          sport: "Hádzaná",
          startDate: start,
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          homeTeam: { "@type": "SportsTeam", name: e.home },
          awayTeam: { "@type": "SportsTeam", name: e.away },
          competitor: [{ "@type": "SportsTeam", name: e.home }, { "@type": "SportsTeam", name: e.away }],
          organizer: { "@type": "SportsOrganization", name: "Hádzaná Záhorie", url: "https://skhrohoznik.sk/" },
          url: "https://skhrohoznik.sk" + (e.url || "/kalendar.html")
        };
        if (e.place || e.city) ev.location = { "@type": "Place", name: e.place || e.city,
          address: { "@type": "PostalAddress", addressLocality: e.city || e.place, addressCountry: "SK" } };
        return ev;
      }).filter(Boolean);
      var el = document.getElementById("ld-" + id);
      if (!events.length) { if (el) el.remove(); return; }
      if (!el) { el = document.createElement("script"); el.type = "application/ld+json"; el.id = "ld-" + id; document.head.appendChild(el); }
      el.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": events });
    },
    // mesto haly pre adresu
    city: function (venue) { return /Rohožník/i.test(venue || "") ? "Rohožník" : /Malacky|Malina/i.test(venue || "") ? "Malacky" : ""; }
  };

  // ---------- štart + sledovanie obsahu, ktorý sa dočíta neskôr ----------
  function init() {
    scan(document.body);
    tick();
    if ('MutationObserver' in window) {
      new MutationObserver(function (muts) {
        var needTick = false;
        muts.forEach(function (m) {
          [].forEach.call(m.addedNodes, function (n) {
            if (n.nodeType !== 1) return;
            scan(n);
            if (n.matches('[data-odpocet]') || n.querySelector('[data-odpocet]')) needTick = true;
          });
        });
        if (needTick) tick();
      }).observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
