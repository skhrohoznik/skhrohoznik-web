/* Animované logo Hádzaná Záhorie v banneri úvodnej stránky.
   V hero.json sa pridá medzi fotky záznam { "animacia": "logo" }.
   Lopta trikrát odskočí, pri každom odskoku vyskočí logo klubu, potom sa vysunie nápis. */
(function () {
  var LOGOS = [
    { src: 'logo.png', alt: 'ŠKH Rohožník', cls: 'roh' },
    { src: 'zahoraci.png', alt: 'HC Záhoráci', cls: 'zah' },
    { src: 'strojar-malacky.jpg', alt: 'TJ Strojár Malacky', cls: 'str' }
  ];
  var BALL =
    '<svg viewBox="0 0 100 100" aria-hidden="true">' +
    '<circle cx="50" cy="50" r="46" fill="#F6F3EC" stroke="#11141B" stroke-width="4"/>' +
    '<path d="M50 4 C30 25 30 75 50 96" fill="none" stroke="#11141B" stroke-width="4"/>' +
    '<path d="M4 50 C25 30 75 30 96 50" fill="none" stroke="#11141B" stroke-width="4"/>' +
    '<path d="M14 22 C35 40 65 40 86 22" fill="#D6262C" stroke="#11141B" stroke-width="3"/>' +
    '<path d="M14 78 C35 60 65 60 86 78" fill="#1C63C2" stroke="#11141B" stroke-width="3"/>' +
    '<path d="M50 50 L64 36 C72 46 72 54 64 64 Z" fill="#2E9E3E" stroke="#11141B" stroke-width="3"/>' +
    '</svg>';

  function build(slide, title) {
    var words = String(title || 'Hádzaná Záhorie').split(/\s+/);
    slide.innerHTML =
      '<div class="ha-stage"><div class="ha-box">' +
        '<div class="ha-logos">' + LOGOS.map(function (l) {
          return '<div class="ha-logo ' + l.cls + '"><img src="' + l.src + '" alt="' + l.alt + '"></div>';
        }).join('') + '</div>' +
        '<div class="ha-floor"></div><div class="ha-shadow"></div>' +
        '<div class="ha-ball">' + BALL + '</div>' +
        '<div class="ha-title">' + words.map(function (w) {
          return '<span class="ha-w"><span>' + w.replace(/[<>&]/g, '') + '</span></span>';
        }).join(' ') + '</div>' +
        '<div class="ha-stripe"><i></i><i></i><i></i></div>' +
        '<div class="ha-tag">ŠKH Rohožník · HC Záhoráci · TJ Strojár Malacky</div>' +
      '</div></div>';
    slide._ha = { anims: [] };
  }

  // výška scény = priestor medzi menu a pásom so zápasmi
  function fit(slide) {
    var hero = slide.parentNode, stage = slide.querySelector('.ha-stage');
    if (!hero || !stage) return;
    var band = hero.querySelector('.matches-band'), dots = hero.querySelector('.intro-dots');
    var nav = document.querySelector('.navbar');
    var top = nav ? nav.offsetHeight + 8 : 70;
    var bottomEl = dots || band;
    var bottom = bottomEl ? hero.clientHeight - bottomEl.offsetTop + 4 : 40;
    stage.style.top = top + 'px';
    stage.style.height = Math.max(180, hero.clientHeight - top - bottom) + 'px';
  }

  function stop(slide) {
    if (!slide._ha) return;
    slide._ha.anims.forEach(function (a) { a.cancel(); });
    slide._ha.anims = [];
  }

  function play(slide) {
    if (!slide._ha) return;
    fit(slide);
    stop(slide);
    var q = function (s) { return slide.querySelector(s); };
    var qa = function (s) { return [].slice.call(slide.querySelectorAll(s)); };
    var stage = q('.ha-box'), ball = q('.ha-ball'), shadow = q('.ha-shadow');
    var logos = qa('.ha-logo'), words = qa('.ha-w > span'), stripes = qa('.ha-stripe i');
    var tag = q('.ha-tag'), floor = q('.ha-floor');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var A = function (el, kf, opt) {
      var a = el.animate(kf, Object.assign({ fill: 'both' }, opt));
      slide._ha.anims.push(a);
      return a;
    };
    if (reduce || !ball.animate) {
      logos.concat(words, stripes, [tag]).forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; });
      ball.style.display = shadow.style.display = 'none';
      return;
    }
    // stredy log a výška podlahy v % scény - podľa nich lopta dopadá
    var sr = stage.getBoundingClientRect();
    var X = logos.map(function (l) {
      var r = l.getBoundingClientRect();
      return ((r.left + r.width / 2 - sr.left) / sr.width) * 100;
    });
    var FLOOR = parseFloat(getComputedStyle(floor).top) / sr.height * 100;
    var D = 2600, down = 'cubic-bezier(.45,0,.9,.55)', up = 'cubic-bezier(.1,.45,.55,1)';
    var mid = function (a, b) { return (a + b) / 2 + '%'; };

    A(ball, [
      { left: '-8%', top: '10%', rotate: '0deg', easing: down },
      { left: X[0] + '%', top: FLOOR + '%', rotate: '220deg', offset: .2, easing: up },
      { left: mid(X[0], X[1]), top: (FLOOR - 26) + '%', rotate: '330deg', offset: .32, easing: down },
      { left: X[1] + '%', top: FLOOR + '%', rotate: '440deg', offset: .44, easing: up },
      { left: mid(X[1], X[2]), top: (FLOOR - 22) + '%', rotate: '540deg', offset: .55, easing: down },
      { left: X[2] + '%', top: FLOOR + '%', rotate: '640deg', opacity: 1, offset: .66, easing: up },
      { left: '112%', top: '-40%', rotate: '900deg', opacity: 0 }
    ], { duration: D });
    A(shadow, [
      { left: '-8%', opacity: 0 }, { left: X[0] + '%', opacity: .9, offset: .2 }, { left: mid(X[0], X[1]), opacity: .25, offset: .32 },
      { left: X[1] + '%', opacity: .9, offset: .44 }, { left: mid(X[1], X[2]), opacity: .25, offset: .55 },
      { left: X[2] + '%', opacity: .9, offset: .66 }, { left: '90%', opacity: 0, offset: .8 }, { left: '90%', opacity: 0 }
    ], { duration: D });
    A(floor, [{ opacity: 0 }, { opacity: 1, offset: .1 }, { opacity: 1, offset: .75 }, { opacity: 0 }], { duration: D });
    [.2, .44, .66].forEach(function (t, i) {
      A(logos[i], [
        { transform: 'scale(0) translateY(30%)', opacity: 0 },
        { transform: 'scale(1.18) translateY(-6%)', opacity: 1, offset: .55 },
        { transform: 'scale(.94)', opacity: 1, offset: .8 },
        { transform: 'scale(1)', opacity: 1 }
      ], { duration: 620, delay: D * t - 40, easing: 'cubic-bezier(.2,.8,.3,1)' });
    });
    words.forEach(function (w, i) {
      A(w, [{ transform: 'translateY(110%)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 650, delay: 2050 + i * 220, easing: 'cubic-bezier(.2,.9,.25,1)' });
    });
    stripes.forEach(function (s, i) {
      A(s, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
        { duration: 420, delay: 2650 + i * 160, easing: 'cubic-bezier(.6,0,.2,1)' });
    });
    A(tag, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 600, delay: 3250, easing: 'ease-out' });
  }

  window.HeroLogoAnim = { build: build, play: play, stop: stop, fit: fit, duration: 7500 };
})();
