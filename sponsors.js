/* Sponzori: logo v strede pasu je vacsie, smerom k okrajom sa zmensuje. */
(function () {
  var box = document.querySelector('.sponsors-logos');
  var track = document.querySelector('.sponsors-track');
  if (!box || !track) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var st = document.createElement('style');
  st.textContent =
    '.sponsors-logos{padding:30px 0;}' +
    '.sponsors-track img{margin-right:64px; transform-origin:center center; will-change:transform,opacity; transition:none;}' +
    '@media (max-width:640px){.sponsors-logos{padding:20px 0;} .sponsors-track img{margin-right:44px;}}';
  document.head.appendChild(st);

  var MIN = 0.65, MAX = 1.5, visible = true;
  function frame() {
    if (visible) {
      var r = box.getBoundingClientRect();
      var cx = r.left + r.width / 2, half = r.width / 2;
      var max = window.innerWidth < 640 ? 1.3 : MAX;
      var imgs = track.children;
      for (var i = 0; i < imgs.length; i++) {
        var b = imgs[i].getBoundingClientRect();
        var d = Math.min(1, Math.abs(b.left + b.width / 2 - cx) / half);
        var k = Math.cos(d * Math.PI / 2);            // 1 v strede, 0 na okraji
        imgs[i].style.transform = 'scale(' + (MIN + (max - MIN) * k).toFixed(3) + ')';
        imgs[i].style.opacity = (0.55 + 0.45 * k).toFixed(2);
      }
    }
    requestAnimationFrame(frame);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(box);
  }
  requestAnimationFrame(frame);
})();
