/* Zobrazenie aktualít (/aktuality.json) a oznamov (/oznamy.json).
   NewsFeed.render({url, grid, compact, linkTo, ...}) */
(function () {
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/[\u{1D400}-\u{1D7FF}\uFF01-\uFF5E]/gu, function (c) { return c.normalize('NFKC'); }).normalize('NFC')
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

  // adresa oznamu pre podstránku: pole "id" v oznamy.json, inak sa vytvorí z nadpisu
  function slugify(t) {
    return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'oznam';
  }
  function assignSlugs(items) {
    var used = {};
    items.forEach(function (it) {
      var base = slugify(it.id || it.nadpis || it.datum), s = base, n = 2;
      while (used[s]) s = base + '-' + (n++);
      used[s] = 1;
      it._slug = s;
    });
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
    var detailUrl = opts.detail ? opts.detail + '?o=' + encodeURIComponent(item._slug) : '';
    var linkHtml = detailUrl
      ? (opts.compact ? '' : '<span class="news-more">Čítať celé →</span>')
      : (!opts.compact && linkUrl)
      ? '<a class="news-more" href="' + esc(linkUrl) + '"' +
        (/^https?:/i.test(linkUrl) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(linkText) + '</a>'
      : '';
    var inner = photosHtml +
      '<div class="news-body">' +
      '<div class="news-date">' + esc(item.datum || '') + '</div>' +
      (item.klub ? '<div class="news-club">' + esc(item.klub) + '</div>' : '') +
      (item.nadpis ? '<h3>' + esc(item.nadpis) + '</h3>' : '') +
      (item.text ? '<p' + (opts.clamp && !opts.compact && !detailUrl ? ' class="clamp" style="-webkit-line-clamp:' + opts.clamp + '"' : '') + '>' + esc(item.text) + '</p>' +
        (opts.clamp && !opts.compact && !detailUrl ? '<button type="button" class="news-toggle" hidden>Zobraziť celý text ▾</button>' : '') : '') +
      linkHtml + '</div>';
    var card;
    if (detailUrl) {
      card = document.createElement('a');
      card.href = detailUrl;
    } else if (opts.compact && opts.linkTo) {
      card = document.createElement('a');
      card.href = opts.linkTo;
    } else {
      card = document.createElement('div');
    }
    card.className = 'news-card' + (detailUrl ? ' linked' : '');
    card.innerHTML = inner;
    if (!opts.compact && !detailUrl) {
      var imgs = Array.prototype.slice.call(card.querySelectorAll('.news-photo'));
      imgs.forEach(function (img, i) {
        img.addEventListener('click', function () {
          if (window.openLightbox) window.openLightbox(imgs.map(function (x) { return x.src; }), i, img.alt);
        });
      });
    }
    return card;
  }

  // dlhý text skrátený na pár riadkov; tlačidlo sa ukáže len vtedy, keď sa text naozaj nezmestí
  function setupClamp(card) {
    var p = card.querySelector('p.clamp'), btn = card.querySelector('.news-toggle');
    if (!p || !btn) return;
    requestAnimationFrame(function () {
      if (p.scrollHeight - p.clientHeight > 4) btn.hidden = false;
    });
    btn.addEventListener('click', function () {
      var open = p.classList.toggle('open');
      btn.textContent = open ? 'Skryť text ▴' : 'Zobraziť celý text ▾';
    });
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
        if (Array.isArray(items)) assignSlugs(items);
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
          items.slice(shown, shown + PAGE).forEach(function (it) { var c = buildCard(it, opts); grid.appendChild(c); setupClamp(c); });
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
  // Podstránka jedného oznamu: oznam.html?o=adresa-oznamu
  function renderDetail(opts) {
    var box = document.getElementById(opts.box);
    if (!box) return;
    var slug = new URLSearchParams(location.search).get('o') || '';
    var notFound = function (msg) {
      box.innerHTML = '<p class="news-empty">' + esc(msg) + '</p>' +
        '<p><a class="news-more" href="' + esc(opts.back) + '">← Všetky oznamy</a></p>';
    };
    fetch(opts.url, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (items) {
        if (!Array.isArray(items)) throw new Error('format');
        assignSlugs(items);
        var item = items.filter(function (it) { return it._slug === slug; })[0];
        if (!item) return notFound('Tento oznam sa nenašiel. Možno už bol odstránený.');
        var photos = photosOf(item);
        var linkUrl = safeUrl(item.zdroj || item.odkaz);
        var linkText = item.odkaz_text || (item.zdroj ? 'Zobraziť na Facebooku →' : 'Viac →');
        document.title = (item.nadpis || 'Oznam') + ' — Hádzaná Záhorie';
        box.innerHTML =
          '<a class="oznam-back" href="' + esc(opts.back) + '">← Všetky oznamy</a>' +
          '<div class="news-date">' + esc(item.datum || '') + '</div>' +
          '<h1 class="oznam-title">' + esc(item.nadpis || '') + '</h1>' +
          (item.text ? '<p class="oznam-text">' + esc(item.text) + '</p>' : '') +
          (linkUrl ? '<a class="btn oznam-link" href="' + esc(linkUrl) + '"' +
            (/^https?:/i.test(linkUrl) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(linkText) + '</a>' : '') +
          (photos.length ? '<div class="oznam-photos' + (photos.length === 1 ? ' one' : '') + '">' + photos.map(function (f) {
            return '<img src="' + esc(f) + '" alt="' + esc(item.nadpis || '') + '" loading="lazy">';
          }).join('') + '</div>' : '');
        var imgs = Array.prototype.slice.call(box.querySelectorAll('.oznam-photos img'));
        imgs.forEach(function (img, i) {
          img.addEventListener('click', function () {
            if (window.openLightbox) window.openLightbox(imgs.map(function (x) { return x.src; }), i, img.alt);
          });
        });
      })
      .catch(function () { notFound('Oznam sa nepodarilo načítať.'); });
  }
  window.NewsFeed = { render: render, renderDetail: renderDetail };
})();
