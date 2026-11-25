// 画面の演出（紙ふぶき・ゆれ・フラッシュ）
(function () {
  const COLORS = ['#ffd23f', '#ff5c8a', '#3dd6ff', '#7cff6b', '#ff9f1c', '#b388ff', '#ffffff'];

  function confetti(count) {
    const layer = document.getElementById('fx-layer');
    if (!layer) return;
    const n = count || 70;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'confetti';
      const size = 8 + Math.random() * 10;
      p.style.left = Math.random() * 100 + 'vw';
      p.style.width = size + 'px';
      p.style.height = size * (0.4 + Math.random() * 0.6) + 'px';
      p.style.background = COLORS[i % COLORS.length];
      p.style.setProperty('--drift', (Math.random() * 30 - 15) + 'vw');
      p.style.setProperty('--spin', (Math.random() * 1080 - 540) + 'deg');
      p.style.animationDuration = 1.8 + Math.random() * 1.4 + 's';
      p.style.animationDelay = Math.random() * 0.3 + 's';
      layer.appendChild(p);
      setTimeout(() => p.remove(), 3800);
    }
  }

  function shake(el) {
    const t = el || document.getElementById('app');
    t.classList.remove('shake');
    void t.offsetWidth; // アニメーションをもう一度動かすため
    t.classList.add('shake');
    setTimeout(() => t.classList.remove('shake'), 600);
  }

  function flash() {
    const layer = document.getElementById('fx-layer');
    if (!layer) return;
    const f = document.createElement('div');
    f.className = 'flash';
    layer.appendChild(f);
    setTimeout(() => f.remove(), 500);
  }

  function sparkle(el) {
    if (!el) return;
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.className = 'sparkle';
      s.textContent = '★';
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 100 + '%';
      s.style.animationDelay = Math.random() * 0.6 + 's';
      el.appendChild(s);
      setTimeout(() => s.remove(), 1800);
    }
  }

  window.Effects = { confetti, shake, flash, sparkle };
})();
