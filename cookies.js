/*
 * Súhlas s cookies a externým obsahom (Hádzaná Záhorie).
 *
 * Čo to robí:
 *  - Mapy Google (iframe s atribútom data-consent-src) a Facebook stránky
 *    (div.fb-page) sa načítajú až po súhlase s "Externým obsahom".
 *    Do súhlasu sa namiesto nich zobrazí zástupný blok s tlačidlom.
 *  - Voľba sa ukladá do localStorage prehliadača (kľúč nižšie), nie do cookies.
 *  - Do pätičky bočného panela pridá odkazy "Ochrana údajov" a "Nastavenia cookies".
 *
 * Cloudflare Web Analytics je bez cookies a bez osobných údajov, preto nie je
 * viazaná na súhlas (je len uvedená v nastaveniach ako informácia).
 */
(function () {
  var KEY = 'skh_cookie_consent_v1';
  var FB_SDK = 'https://connect.facebook.net/sk_SK/sdk.js#xfbml=1&version=v19.0';

  function readConsent() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return (parsed && typeof parsed.external === 'boolean') ? parsed : null;
    } catch (e) { return null; }
  }
  function saveConsent(external) {
    try { localStorage.setItem(KEY, JSON.stringify({ external: !!external, ts: Date.now() })); } catch (e) {}
  }

  var consent = readConsent();
  var externalAllowed = !!(consent && consent.external);

  /* ---------- štýly ---------- */
  var css = '' +
    '.ck-banner{position:fixed; left:16px; right:16px; bottom:16px; z-index:2000; max-width:760px; margin:0 auto;' +
    ' background:#fff; color:#161A22; border:2px solid #161A22; box-shadow:0 10px 40px rgba(0,0,0,.25);' +
    ' padding:20px 22px; font-family:"Space Grotesk",sans-serif; font-size:14px; line-height:1.55; display:none;}' +
    '.ck-banner.ck-open{display:block;}' +
    '.ck-banner h2{font-family:"Archivo Black",sans-serif; font-weight:400; font-size:16px; text-transform:uppercase; letter-spacing:.03em; margin:0 0 8px; color:#173B73;}' +
    '.ck-banner p{margin:0 0 12px; color:#3b3f48;}' +
    '.ck-banner a{color:#173B73; text-decoration:underline;}' +
    '.ck-actions{display:flex; flex-wrap:wrap; gap:10px; margin-top:6px;}' +
    '.ck-btn{font-family:inherit; font-size:14px; font-weight:700; padding:10px 16px; cursor:pointer; border:2px solid #173B73; background:#fff; color:#173B73;}' +
    '.ck-btn:hover{background:#EEF2F9;}' +
    '.ck-btn-primary{background:#D6262C; border-color:#D6262C; color:#fff;}' +
    '.ck-btn-primary:hover{background:#b81f25;}' +
    '.ck-btn-link{border-color:transparent; text-decoration:underline; background:transparent;}' +
    '.ck-settings{display:none; margin:12px 0 4px; border-top:1px solid #E3DFD2;}' +
    '.ck-banner.ck-show-settings .ck-settings{display:block;}' +
    '.ck-banner.ck-show-settings .ck-intro-only{display:none;}' +
    '.ck-row{display:flex; gap:14px; align-items:flex-start; justify-content:space-between; padding:12px 0; border-bottom:1px solid #E3DFD2;}' +
    '.ck-row strong{display:block; margin-bottom:2px;}' +
    '.ck-row span.ck-desc{color:#5c5648; font-size:13px;}' +
    '.ck-always{white-space:nowrap; font-size:12px; font-weight:700; color:#2a7a3b; padding-top:2px;}' +
    '.ck-switch{position:relative; flex:0 0 auto; width:46px; height:26px; margin-top:2px;}' +
    '.ck-switch input{position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; margin:0; z-index:2;}' +
    '.ck-slider{position:absolute; inset:0; background:#b9b4a6; border-radius:26px; transition:background .15s;}' +
    '.ck-slider::before{content:""; position:absolute; width:20px; height:20px; left:3px; top:3px; background:#fff; border-radius:50%; transition:transform .15s;}' +
    '.ck-switch input:checked + .ck-slider{background:#2a7a3b;}' +
    '.ck-switch input:checked + .ck-slider::before{transform:translateX(20px);}' +
    '.ck-switch input:focus-visible + .ck-slider{outline:3px solid #F2B705; outline-offset:2px;}' +
    '.ck-placeholder{width:100%; min-height:160px; aspect-ratio:4/3; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;' +
    ' text-align:center; padding:16px; background:#EEF2F9; border:2px dashed #173B73; color:#3b3f48; font-size:13px; line-height:1.5; box-sizing:border-box;}' +
    '.ck-placeholder.ck-placeholder-fb{aspect-ratio:auto; width:360px; max-width:100%; min-height:200px;}' +
    '.ck-footer-links{margin-top:8px; font-size:11px; color:rgba(255,255,255,.85);}' +
    '.ck-footer-links a{color:rgba(255,255,255,.9); text-decoration:underline; cursor:pointer;}' +
    '@media (max-width:560px){.ck-banner{left:8px; right:8px; bottom:8px; padding:16px;} .ck-actions .ck-btn{flex:1 1 100%;}}';
  var styleEl = document.createElement('style');
  styleEl.appendChild(document.createTextNode(css));
  document.head.appendChild(styleEl);

  /* ---------- externý obsah ---------- */
  var fbSdkRequested = false;
  function loadFacebookSdk() {
    if (fbSdkRequested) return;
    fbSdkRequested = true;
    var s = document.createElement('script');
    s.async = true; s.defer = true; s.crossOrigin = 'anonymous';
    s.src = FB_SDK;
    document.body.appendChild(s);
  }

  var placeholders = [];
  function describe(el) {
    var label = el.getAttribute('data-consent-label');
    if (label) return label;
    return el.classList && el.classList.contains('fb-page') ? 'Facebook' : 'Externý obsah';
  }
  function makePlaceholder(el) {
    var ph = document.createElement('div');
    ph.className = 'ck-placeholder' + (el.classList.contains('fb-page') ? ' ck-placeholder-fb' : '');
    var p = document.createElement('div');
    p.textContent = describe(el) + ' sa načíta až po tvojom súhlase s externým obsahom, pretože tretia strana môže ukladať cookies a spracúvať tvoje údaje.';
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'ck-btn ck-btn-primary';
    b.textContent = 'Povoliť externý obsah';
    b.addEventListener('click', function () { applyChoice(true); });
    ph.appendChild(p); ph.appendChild(b);
    el.parentNode.insertBefore(ph, el);
    placeholders.push(ph);
    return ph;
  }

  var gated = [];
  function collectGated() {
    document.querySelectorAll('iframe[data-consent-src]').forEach(function (el) { gated.push(el); });
    document.querySelectorAll('.fb-page').forEach(function (el) { gated.push(el); });
  }

  function renderExternal() {
    placeholders.forEach(function (ph) { if (ph.parentNode) ph.parentNode.removeChild(ph); });
    placeholders = [];
    var anyFb = false;
    gated.forEach(function (el) {
      if (externalAllowed) {
        el.style.display = '';
        if (el.tagName === 'IFRAME') {
          if (!el.getAttribute('src')) el.setAttribute('src', el.getAttribute('data-consent-src'));
        } else if (el.classList.contains('fb-page')) {
          anyFb = true;
        }
      } else {
        el.style.display = 'none';
        makePlaceholder(el);
      }
    });
    if (externalAllowed && anyFb) {
      if (window.FB && window.FB.XFBML) { window.FB.XFBML.parse(); } else { loadFacebookSdk(); }
    }
  }

  /* ---------- banner ---------- */
  var banner, cbExternal;
  function buildBanner() {
    banner = document.createElement('div');
    banner.className = 'ck-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'ck-title');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML =
      '<h2 id="ck-title">Cookies a externý obsah</h2>' +
      '<p class="ck-intro-only">Tento web si pamätá len tvoju voľbu a meria návštevnosť anonymne bez cookies. ' +
      'Mapy Google a Facebook stránky načítame až s tvojím súhlasom, pretože tieto služby môžu ukladať cookies ' +
      'a spracúvať tvoje údaje. Viac v <a href="/ochrana-udajov.html">Ochrane údajov</a>.</p>' +
      '<div class="ck-settings">' +
        '<div class="ck-row"><div><strong>Nevyhnutné</strong><span class="ck-desc">Zapamätanie tvojej voľby v úložisku prehliadača, aby sa banner nezobrazoval opakovane.</span></div><span class="ck-always">Vždy zapnuté</span></div>' +
        '<div class="ck-row"><div><strong>Štatistika návštevnosti</strong><span class="ck-desc">Cloudflare Web Analytics: bez cookies a bez osobných údajov, slúži na anonymné počty návštev.</span></div><span class="ck-always">Bez cookies</span></div>' +
        '<div class="ck-row"><div><strong>Externý obsah</strong><span class="ck-desc">Mapy Google (stránka Klub) a Facebook stránky (stránka Sledujte nás). Tieto služby môžu ukladať cookies a spracúvať tvoju IP adresu.</span></div>' +
        '<label class="ck-switch"><input type="checkbox" id="ck-external" aria-label="Externý obsah"><span class="ck-slider"></span></label></div>' +
      '</div>' +
      '<div class="ck-actions">' +
        '<button type="button" class="ck-btn ck-btn-primary" data-ck="accept">Prijať všetko</button>' +
        '<button type="button" class="ck-btn" data-ck="reject">Iba nevyhnutné</button>' +
        '<button type="button" class="ck-btn ck-btn-link" data-ck="settings">Nastavenia</button>' +
        '<button type="button" class="ck-btn" data-ck="save" style="display:none">Uložiť výber</button>' +
      '</div>';
    document.body.appendChild(banner);
    cbExternal = banner.querySelector('#ck-external');
    var saveBtn = banner.querySelector('[data-ck="save"]');
    var settingsBtn = banner.querySelector('[data-ck="settings"]');

    banner.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-ck]') : null;
      if (!t) return;
      var action = t.getAttribute('data-ck');
      if (action === 'accept') applyChoice(true);
      else if (action === 'reject') applyChoice(false);
      else if (action === 'settings') showSettings(true);
      else if (action === 'save') applyChoice(cbExternal.checked);
    });
    function showSettings(on) {
      banner.classList.toggle('ck-show-settings', on);
      saveBtn.style.display = on ? '' : 'none';
      settingsBtn.style.display = on ? 'none' : '';
    }
    banner._showSettings = showSettings;
  }

  function openBanner(withSettings) {
    if (!banner) buildBanner();
    cbExternal.checked = externalAllowed;
    banner._showSettings(!!withSettings);
    banner.classList.add('ck-open');
  }
  function closeBanner() { if (banner) banner.classList.remove('ck-open'); }

  function applyChoice(external) {
    var changedToOff = externalAllowed && !external;
    externalAllowed = !!external;
    saveConsent(externalAllowed);
    closeBanner();
    if (changedToOff) { window.location.reload(); return; } // odstráni už načítaný externý obsah
    renderExternal();
  }

  /* ---------- odkazy v pätičke ---------- */
  function addFooterLinks() {
    var fb = document.querySelector('.site-footer') || document.querySelector('.footer-bottom');
    if (!fb) return;
    var wrap = document.createElement('div');
    wrap.className = 'ck-footer-links';
    var a1 = document.createElement('a');
    a1.href = '/ochrana-udajov.html'; a1.textContent = 'Ochrana údajov';
    var sep = document.createTextNode(' · ');
    var a2 = document.createElement('a');
    a2.href = '#'; a2.textContent = 'Nastavenia cookies';
    a2.addEventListener('click', function (e) { e.preventDefault(); openBanner(true); });
    wrap.appendChild(a1); wrap.appendChild(sep); wrap.appendChild(a2);
    fb.appendChild(wrap);
  }

  function init() {
    collectGated();
    renderExternal();
    addFooterLinks();
    document.querySelectorAll('[data-cookie-settings]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); openBanner(true); });
    });
    if (!consent) openBanner(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
