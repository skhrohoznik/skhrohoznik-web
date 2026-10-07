/* Lightbox s listovaním: šípky na bokoch, klávesy ←/→, Escape zatvorí, swipe na mobile.
   Použitie: openLightbox([url1, url2, ...], index, alt) */
(function () {
  var box, img, prevBtn, nextBtn, closeBtn, counter;
  var list = [], idx = 0, startX = null;

  function init() {
    box = document.getElementById('lightbox');
    img = document.getElementById('lightbox-img');
    if (!box || !img) return false;
    if (box.dataset.ready) return true;
    box.dataset.ready = '1';
    closeBtn = mk('button', 'lb-btn lb-close', '×', 'Zavrieť');
    prevBtn = mk('button', 'lb-btn lb-prev', '‹', 'Predchádzajúca fotka');
    nextBtn = mk('button', 'lb-btn lb-next', '›', 'Ďalšia fotka');
    counter = mk('div', 'lb-counter', '', '');
    box.appendChild(closeBtn); box.appendChild(prevBtn); box.appendChild(nextBtn); box.appendChild(counter);
    closeBtn.addEventListener('click', function (e) { e.stopPropagation(); close(); });
    prevBtn.addEventListener('click', function (e) { e.stopPropagation(); go(-1); });
    nextBtn.addEventListener('click', function (e) { e.stopPropagation(); go(1); });
    box.addEventListener('click', function (e) { if (e.target !== img) close(); });
    img.addEventListener('click', function (e) { e.stopPropagation(); go(1); });
    box.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX; startX = null;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    });
    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    });
    return true;
  }
  function mk(tag, cls, txt, label) {
    var el = document.createElement(tag);
    el.className = cls; el.textContent = txt;
    if (tag === 'button') el.type = 'button';
    if (label) el.setAttribute('aria-label', label);
    return el;
  }
  function render(alt) {
    img.src = list[idx];
    if (alt !== undefined) img.alt = alt;
    var multi = list.length > 1;
    prevBtn.style.display = nextBtn.style.display = counter.style.display = multi ? '' : 'none';
    counter.textContent = (idx + 1) + ' / ' + list.length;
  }
  function go(d) {
    if (list.length < 2) return;
    idx = (idx + d + list.length) % list.length;
    render();
  }
  function close() { box.classList.remove('open'); img.src = ''; }
  window.openLightbox = function (urls, index, alt) {
    if (!init()) return;
    list = urls.slice(); idx = index || 0;
    render(alt || '');
    box.classList.add('open');
  };
})();
