// 早押しのキー（Enter・スペース）を受けとる、見えない入力欄
// iPad の Safari は、文字を打てる場所にカーソルがないと、キーボードのキーをページに知らせないことがある。
// そこで問題が出ている間は、見えない入力欄にカーソルを入れておき、そこで Enter・スペースを受けとる。
(function () {
  let handler = null;

  function el() { return document.getElementById('key-catcher'); }

  function isBuzzKey(e) {
    return e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar' ||
      e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space' ||
      e.keyCode === 13 || e.keyCode === 32;
  }

  // 見えない入力欄にカーソルを入れる（すでに入っていれば何もしない）
  function focus() {
    const c = el();
    if (!c || document.activeElement === c) return;
    try { c.focus({ preventScroll: true }); } catch (e) { c.focus(); }
  }

  function blur() {
    const c = el();
    if (c && document.activeElement === c) c.blur();
  }

  function setup() {
    const c = el();
    if (!c) return;
    c.addEventListener('keydown', (e) => {
      if (!isBuzzKey(e) || e.isComposing) return;
      e.preventDefault();
      e.stopPropagation(); // ページ全体の Enter の受け取りと二重にならないように
      if (!e.repeat && handler) handler();
    });
    // 日本語入力のときなど、キーの知らせが来ずに空白だけが入ることがある → それでも早押しにする
    c.addEventListener('input', () => {
      const v = c.value;
      c.value = '';
      if (/[\s　]/.test(v) && handler) handler();
    });
    c.addEventListener('compositionend', () => { c.value = ''; });
  }

  window.Keys = { setup, focus, blur, isBuzzKey, onBuzz: (fn) => { handler = fn; } };
})();
