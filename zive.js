/* Živý prenos z YouTube: ak na kanáli ŠKH Rohožník práve beží prenos (/live.json),
   na úvodnej stránke sa pod úvodnou fotkou zobrazí okno s videom a na ostatných stránkach
   červený pruh s odkazom. Ukážka vzhľadu: pridaj do adresy ?nahlad-live */
(function () {
  var demo = /[?&]nahlad-live\b/.test(location.search);
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var css = '' +
    '.lv-bar{margin-bottom:16px; display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap; background:#C21F26; color:#fff; padding:10px 16px; font-weight:700; font-size:14px; text-align:center;}' +
    '.lv-bar a{color:#fff; text-decoration:underline; text-underline-offset:3px; white-space:nowrap;}' +
    '.lv-dot{display:inline-block; width:10px; height:10px; border-radius:50%; background:#fff; margin-right:8px; animation:lvPulse 1.4s ease-in-out infinite; vertical-align:middle;}' +
    '@keyframes lvPulse{0%,100%{opacity:1; transform:scale(1);} 50%{opacity:.35; transform:scale(.75);}}' +
    '.lv-box{width:100%; box-sizing:border-box; max-width:1228px; margin:28px auto 0; padding:0 24px;}' +
    '.lv-card{background:#161A22; color:#fff; box-shadow:0 10px 30px rgba(22,26,34,.25); border-top:4px solid #C21F26;}' +
    '.lv-head{display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:14px 18px;}' +
    '.lv-badge{display:inline-flex; align-items:center; background:#C21F26; color:#fff; font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; padding:5px 10px;}' +
    '.lv-title{font-weight:700; font-size:16px; flex:1 1 260px;}' +
    '.lv-yt{color:#fff; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; text-decoration:underline; text-underline-offset:3px;}' +
    '.lv-video{position:relative; aspect-ratio:16/9; background:#000;}' +
    '.lv-video iframe{position:absolute; inset:0; width:100%; height:100%; border:0;}' +
    '.lv-consent{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; padding:20px; text-align:center; background:radial-gradient(circle at 50% 40%, #2a3140, #0d1016);}' +
    '.lv-consent p{max-width:460px; font-size:14px; color:#d6d9e0;}' +
    '.lv-consent .lv-btns{display:flex; gap:10px; flex-wrap:wrap; justify-content:center;}' +
    '.lv-consent button,.lv-consent a{font:inherit; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:11px 18px; border:2px solid #fff; cursor:pointer; text-decoration:none;}' +
    '.lv-consent button{background:#C21F26; border-color:#C21F26; color:#fff;}' +
    '.lv-consent a{background:transparent; color:#fff;}' +
    '@media (max-width:640px){ .lv-box{padding:0 12px; margin-top:18px;} .lv-title{font-size:14px;} }' +
    '@media (prefers-reduced-motion:reduce){ .lv-dot{animation:none;} }';

  function showBar(d) {
    var main = document.querySelector('main') || document.body;
    var bar = document.createElement('div');
    bar.className = 'lv-bar'; bar.setAttribute('role', 'status');
    bar.innerHTML = '<span><span class="lv-dot" aria-hidden="true"></span>Práve vysielame naživo: ' + esc(d.title) + '</span>' +
      '<a href="index.html#live">Sledovať na webe →</a>';
    main.insertBefore(bar, main.firstChild);
  }

  function showBox(d) {
    var hero = document.getElementById('hero');
    if (!hero) return false;
    var yt = 'https://www.youtube.com/watch?v=' + encodeURIComponent(d.id);
    var src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(d.id) + '?autoplay=1&mute=1&rel=0';
    var box = document.createElement('section');
    box.className = 'lv-box'; box.id = 'live'; box.setAttribute('aria-label', 'Živý prenos');
    box.innerHTML = '<div class="lv-card"><div class="lv-head"><span class="lv-badge"><span class="lv-dot" aria-hidden="true"></span>Naživo</span>' +
      '<span class="lv-title">' + esc(d.title) + '</span><a class="lv-yt" href="' + esc(yt) + '" target="_blank" rel="noopener">Otvoriť na YouTube ↗</a></div>' +
      '<div class="lv-video"></div></div>';
    hero.parentNode.insertBefore(box, hero.nextSibling);
    var v = box.querySelector('.lv-video');
    function play() { v.innerHTML = '<iframe src="' + esc(src) + '" title="' + esc(d.title) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>'; }
    var ok = window.skhConsent && window.skhConsent.allowed();
    if (ok) play();
    else {
      v.innerHTML = '<div class="lv-consent"><p>Prenos sa prehráva z YouTube. Ak ho chceš sledovať priamo tu, povoľ externý obsah. YouTube môže ukladať cookies.</p>' +
        '<div class="lv-btns"><button type="button">Povoliť a prehrať</button><a href="' + esc(yt) + '" target="_blank" rel="noopener">Pozrieť na YouTube ↗</a></div></div>';
      v.querySelector('button').addEventListener('click', function () { if (window.skhConsent) window.skhConsent.allow(); play(); });
      document.addEventListener('skh-consent', function () { if (window.skhConsent && window.skhConsent.allowed()) play(); });
    }
    return true;
  }

  function run() {
    fetch('/live.json' + (demo ? '?nahlad=1' : ''), { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.live || !d.id) return;
        var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
        if (!showBox(d)) showBar(d);
      }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
