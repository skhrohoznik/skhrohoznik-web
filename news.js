/* Zobrazenie aktualít (/aktuality.json) a oznamov (/oznamy.json).
   NewsFeed.render({url, grid, compact, linkTo, ...}) */
(function () {
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function photosOf(item) {
    if (Array.isArray(item.fotky)) return item.fotky.filter(Boolean);
    if (item.foto) return String(item.foto).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    return [];
  }
  function safeUrl(u) {
    u = String(u || '').trim();
    return /^(https?:\/\/|[\w\-./#?=&%]+$)/i.test(u) ? u : '';
  }

  function buildCard(item, opts) {
    var photos = photosOf(item);
    if (opts.compact) photos = photos.slice(0, 1);
    var alt = esc(item.nadpis || '');
    var photosHtml = photos.length
      ? '<div class="news-photos">' + photos.map(function (f) {
          return '<img class="news-photo" loading="lazy" src="' + esc(f) + '" alt="' + alt + '">';
        }).join('') + '</div>'
      : '';
    var linkUrl = safeUrl(item.zdroj || item.odkaz);
    var linkText = item.odkaz_text || (item.zdroj ? 'Zobraziť na Facebooku →' : 'Viac →');
    var linkHtml = (!opts.compact && linkUrl)
      ? '<a class="news-more" href="' + esc(linkUrl) + '"' +
        (/^https?:/i.test(linkUrl) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(linkText) + '</a>'
      : '';
    var inner = photosHtml +
      '<div class="news-body">' +
      '<div class="news-date">' + esc(item.datum || '') + '</div>' +
      (item.klub ? '<div class="news-club">' + esc(item.klub) + '</div>' : '') +
      (item.nadpis ? '<h3>' + esc(item.nadpis) + '</h3>' : '') +
      (item.text ? '<p>' + esc(item.text) + '</p>' : '') +
      linkHtml + '</div>';
    var card;
    if (opts.compact && opts.linkTo) {
      card = document.createElement('a');
      card.href = opts.linkTo;
    } else {
      card = document.createElement('div');
    }
    card.className = 'news-card';
    card.innerHTML = inner;
    if (!opts.compact) {
      var imgs = Array.prototype.slice.call(card.querySelectorAll('.news-photo'));
      imgs.forEach(function (img, i) {
        img.addEventListener('click', function () {
          if (window.openLightbox) window.openLightbox(imgs.map(function (x) { return x.src; }), i, img.alt);
        });
      });
    }
    return card;
  }

  function render(opts) {
    var grid = typeof opts.grid === 'string' ? document.getElementById(opts.grid) : opts.grid;
    var section = opts.section ? document.getElementById(opts.section) : null;
    var moreWrap = opts.moreWrap ? document.getElementById(opts.moreWrap) : null;
    var moreBtn = opts.moreBtn ? document.getElementById(opts.moreBtn) : null;
    if (!grid) return;
    if (opts.compact) grid.classList.add('compact');

    fetch(opts.url, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (items) {
        grid.innerHTML = '';
        if (!Array.isArray(items) || !items.length) {
          if (opts.hideWhenEmpty && section) { section.style.display = 'none'; return; }
          grid.innerHTML = '<p class="news-empty">' + esc(opts.empty || 'Zatiaľ nič nového.') + '</p>';
          return;
        }
        if (opts.compact) {
          var MAX = 5, MIN_W = 220, GAP = 18;
          var cards = items.slice(0, MAX).map(function (it) {
            var c = buildCard(it, opts); grid.appendChild(c); return c;
          });
          var fit = function () {
            var w = grid.clientWidth || 1000;
            var n = Math.max(1, Math.min(MAX, Math.floor((w + GAP) / (MIN_W + GAP))));
            grid.style.gridTemplateColumns = 'repeat(' + n + ',minmax(0,1fr))';
            cards.forEach(function (c, i) { c.hidden = i >= n; });
          };
          fit();
          window.addEventListener('resize', fit);
          return;
        }
        var PAGE = opts.pageSize || 9, shown = 0;
        function more() {
          items.slice(shown, shown + PAGE).forEach(function (it) { grid.appendChild(buildCard(it, opts)); });
          shown = Math.min(items.length, shown + PAGE);
          if (moreWrap) moreWrap.style.display = shown < items.length ? 'block' : 'none';
        }
        more();
        if (moreBtn) moreBtn.addEventListener('click', more);
      })
      .catch(function () {
        if (opts.hideWhenEmpty && section) { section.style.display = 'none'; return; }
        grid.innerHTML = '<p class="news-empty">' + esc(opts.error || 'Nepodarilo sa načítať.') + '</p>';
      });
  }
  window.NewsFeed = { render: render };
})();
