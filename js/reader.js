// 問題文を1文字ずつ出す道具
// 「表示を始めた時刻＋1文字の速さ」から、いま何文字出すかを計算する。
// （対戦モードで全員の画面をそろえるときも、同じ考え方を使う）
(function () {
  function QuestionReader(el) {
    this.el = el;
    this.text = '';
    this.msPerChar = 150;
    this.shown = 0;
    this.timer = null;
    this.startAt = 0;
    this.fromChar = 0;
    this.onComplete = null;
  }

  QuestionReader.prototype.setText = function (text, msPerChar) {
    this.stop();
    this.text = text;
    this.msPerChar = msPerChar;
    this.shown = 0;
    this.render();
  };

  // 文字の場所がずれないように、まだ出ていない文字は透明にして置いておく
  QuestionReader.prototype.render = function () {
    const shown = this.text.slice(0, this.shown);
    const rest = this.text.slice(this.shown);
    this.el.innerHTML = '';
    const a = document.createElement('span');
    a.className = 'q-shown';
    a.textContent = shown;
    const b = document.createElement('span');
    b.className = 'q-rest';
    b.textContent = rest;
    this.el.appendChild(a);
    this.el.appendChild(b);
  };

  QuestionReader.prototype.start = function (fromChar, onComplete) {
    this.stop();
    this.fromChar = fromChar || 0;
    this.startAt = performance.now();
    this.onComplete = onComplete || null;
    this.tick();
    this.timer = setInterval(() => this.tick(), 25);
  };

  QuestionReader.prototype.tick = function () {
    const elapsed = performance.now() - this.startAt;
    const n = Math.min(this.text.length, this.fromChar + Math.floor(elapsed / this.msPerChar) + 1);
    if (n !== this.shown) {
      this.shown = n;
      this.render();
    }
    if (n >= this.text.length) {
      this.stop();
      const cb = this.onComplete;
      this.onComplete = null;
      if (cb) cb();
    }
  };

  // 止めて、何文字目まで出ていたかを返す
  QuestionReader.prototype.pause = function () {
    if (this.timer) this.tick();
    this.stop();
    this.onComplete = null;
    return this.shown;
  };

  QuestionReader.prototype.stop = function () {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  };

  // 対戦モード用：何文字出すかを外から決める（サーバーの時刻から計算した数）
  QuestionReader.prototype.showChars = function (n) {
    this.stop();
    this.onComplete = null;
    const v = Math.max(0, Math.min(this.text.length, n));
    if (v === this.shown) return;
    this.shown = v;
    this.render();
  };

  QuestionReader.prototype.showAll = function () {
    this.stop();
    this.onComplete = null;
    this.shown = this.text.length;
    this.render();
  };

  window.QuestionReader = QuestionReader;
})();
