/* Pás partnerov.
   1) Vyváženie log: všetky dlaždice majú rovnakú veľkosť, ale logo v nej dostane plochu podľa svojho tvaru
      (široké logo je nižšie, štvorcové menšie), aby žiadne nevyčnievalo.
   2) Plynulé posúvanie: pás ide stále rovnakou rýchlosťou, zastaví sa pod myšou
      a dá sa potiahnuť myšou aj prstom. Pri "obmedziť animácie" v systéme sa neposúva. */
(function () {
  var box = document.querySelector('.sponsors-logos');
  var track = document.querySelector('.sponsors-track');
  if (!box || !track) return;

  // --- 1) vyváženie veľkosti log ---
  var FILL = 0.5; // aký podiel vnútornej plochy dlaždice má logo zaberať
  function balance(img) {
    var nw = img.naturalWidth, nh = img.naturalHeight;
    if (!nw || !nh) return;
    var cs = getComputedStyle(img);
    var W = img.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var H = img.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (W <= 0 || H <= 0) return;
    var r = nw / nh;
    var h = Math.sqrt((W * H * FILL) / r);
    var w = h * r;
    if (w > W) { w = W; h = w / r; }
    if (h > H) { h = H; w = h * r; }
    // logo zmenšíme zväčšením vnútorného okraja - dlaždica ostáva rovnako veľká
    var px = Math.max(0, (W - w) / 2), py = Math.max(0, (H - h) / 2);
    img.style.padding =
      (parseFloat(cs.paddingTop) + py).toFixed(1) + 'px ' + (parseFloat(cs.paddingRight) + px).toFixed(1) + 'px';
  }
  function balanceAll() {
    var imgs = track.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].style.padding = '';
      if (imgs[i].complete) balance(imgs[i]);
      else imgs[i].addEventListener('load', balance.bind(null, imgs[i]), { once: true });
    }
  }
  balanceAll();
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(balanceAll, 150);
  });

  // --- 2) posúvanie ---
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var SPEED = 40;          // px za sekundu
  var offset = 0;          // aktuálny posun pásu (záporné číslo)
  var half = 0;            // šírka jednej sady log (pás obsahuje logá dvakrát)
  var hover = false, dragging = false, visible = true;
  var startX = 0, startOffset = 0, moved = 0, last = 0;

  function measure() {
    // pás obsahuje logá 2x (druhá sada je kópia) - posun sa opakuje po šírke jednej sady
    half = track.scrollWidth / 2;
  }
  function wrap() {
    if (half <= 0) return;
    while (offset <= -half) offset += half;
    while (offset > 0) offset -= half;
  }
  function apply() {
    track.style.transform = 'translate3d(' + offset.toFixed(2) + 'px,0,0)';
  }
  function frame(t) {
    if (!last) last = t;
    var dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (visible && !hover && !dragging && half > 0) {
      offset -= SPEED * dt;
      wrap();
      apply();
    }
    requestAnimationFrame(frame);
  }

  measure();
  window.addEventListener('load', measure);
  window.addEventListener('resize', function () { setTimeout(measure, 200); });

  box.addEventListener('mouseenter', function () { hover = true; });
  box.addEventListener('mouseleave', function () { hover = false; });

  // potiahnutie myšou / prstom
  box.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true; moved = 0;
    startX = e.clientX; startOffset = offset;
    box.classList.add('dragging');
    if (box.setPointerCapture) box.setPointerCapture(e.pointerId);
  });
  box.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    offset = startOffset + dx;
    wrap();
    apply();
  });
  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    box.classList.remove('dragging');
    if (e && e.pointerType !== 'mouse') hover = false; // na dotykovom zariadení sa po pustení pokračuje
    last = 0;
  }
  box.addEventListener('pointerup', endDrag);
  box.addEventListener('pointercancel', endDrag);
  // ak sa pás potiahol, nejde o kliknutie
  box.addEventListener('click', function (e) { if (moved > 5) { e.preventDefault(); e.stopPropagation(); } }, true);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; last = 0; }).observe(box);
  }
  document.addEventListener('visibilitychange', function () { last = 0; });
  requestAnimationFrame(frame);
})();
