// 答えの判定（仕様書 7 章）
// 入力と正解の両方を同じルールで直してから比べる。
(function () {
  function normalizeAnswer(text) {
    let s = String(text || '');
    // 1. NFKC（全角数字・全角英字 → 半角）
    s = s.normalize('NFKC').toLowerCase();
    // 2. カタカナ → ひらがな
    s = s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
    // ローマ字入力で「3.14」の「.」が「。」になっても数字の小数点としてあつかう
    s = s.replace(/(\d)[。.．](?=\d)/g, '$1.');
    // ローマ字で「itchi」「matchi」のように打つと「いtち」になるので、「っち」としてあつかう
    s = s.replace(/t(?=ち)/g, 'っ');
    // 3. 空白を消す
    s = s.replace(/[\s　]/g, '');
    // 4. 長音・中点・読点・句点を消す（小数点は残す）
    s = s.replace(/[ー\-－・、。,]/g, '');
    return s;
  }

  function isCorrect(input, question) {
    const got = normalizeAnswer(input);
    if (!got) return false;
    const answers = [question.answer].concat(question.alt || []);
    return answers.some((a) => normalizeAnswer(a) === got);
  }

  // 日本語入力で漢字に変換してしまったか（答えはひらがなか数字なので、漢字は送らずに知らせる）
  function hasKanji(text) {
    return /[々㐀-䶿一-鿿豈-﫿]/.test(String(text || ''));
  }

  window.Judge = { normalizeAnswer, isCorrect, hasKanji };
})();
