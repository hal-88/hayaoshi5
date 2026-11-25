// 練習モード（10問チャレンジ）
(function () {
  const TOTAL = 10;          // 問題の数
  const MS_PER_CHAR = 150;   // 文字の速さ「ふつう」で固定（ランキングを公平にするため）
  const INTRO_MS = 1500;     // 「第○問」を見せる時間
  const AFTER_FULL_MS = 5000; // 全文が出てから時間切れまで
  const ANSWER_SEC = 15;     // 答える時間（15カウント）
  const INPUT_DELAY_MS = 300; // 早おししてから入力欄が出るまで
  const REVEAL_MS = 3000;    // 正かいを見せる時間

  const $ = (id) => document.getElementById(id);

  let reader = null;
  let state = null;
  let timers = [];
  let onFinish = null;
  let lastCompositionEnd = 0;

  // 1問の点 ＝ 50点 ＋ 100点 ×（まだ出ていない文字数 ÷ 全文字数）を四捨五入
  function calcPoints(charIndex, length) {
    return Math.round(50 + 100 * ((length - charIndex) / length));
  }

  function later(fn, ms) {
    const t = setTimeout(fn, ms);
    timers.push(t);
    return t;
  }

  function clearTimers() {
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    timers = [];
  }

  function showStage(name) {
    ['buzz', 'answer', 'reveal'].forEach((n) => { $('stage-' + n).hidden = n !== name; });
  }

  function setup() {
    reader = new QuestionReader($('q-text'));

    $('btn-buzz').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      buzz();
    });
    // 画面キーボードを使っている端末のために、クリックでも反応させる
    $('btn-buzz').addEventListener('click', (e) => {
      e.preventDefault();
      buzz();
      // タップのときは、ここでカーソルを入れると iPad の画面キーボードも出る
      if (state && state.phase === 'answering') focusInput();
    });

    // 早押しはスペースキー（Enter でもおせる）
    document.addEventListener('keydown', (e) => {
      if (!state) return;
      if (!Keys.isBuzzKey(e)) return;
      if (e.target === $('answer-input')) return; // 入力欄のキーは下で受ける
      e.preventDefault();
      if (e.repeat) return;
      buzz();
    });

    // 画面をさわったら、見えない入力欄にカーソルを入れなおす（キーボードで早押しできるように）
    $('screen-play').addEventListener('pointerdown', (e) => {
      if (state && state.phase !== 'answering' && !e.target.closest('input')) Keys.focus();
    });

    const input = $('answer-input');
    if (window.wanakana) {
      try { wanakana.bind(input, { IMEMode: 'toHiragana' }); } catch (e) { /* なくても入力はできる */ }
    }
    input.addEventListener('compositionend', () => { lastCompositionEnd = performance.now(); });
    // 漢字のお知らせは、漢字を消したら引っこめる
    input.addEventListener('input', () => { if (!Judge.hasKanji(input.value)) setWarn(false); });
    input.addEventListener('keydown', (e) => {
      // 早おししてから0.3秒は、どのキーも受けつけない
      if (!state || state.inputLocked) { e.preventDefault(); e.stopPropagation(); return; }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      // 日本語入力の「変換の確定」の Enter では送らない
      if (e.isComposing || e.keyCode === 229) return;
      if (performance.now() - lastCompositionEnd < 80) return;
      if (e.repeat) return;
      sendAnswer();
    });
    $('btn-send').addEventListener('click', (e) => { e.preventDefault(); sendAnswer(); });
  }

  function start(subjectKey, list, finishCallback) {
    stop();
    Keys.focus(); // ボタンをおしたこの場で、見えない入力欄にカーソルを入れておく（iPad のキーボード用）
    onFinish = finishCallback;
    const subject = Questions.getSubject(subjectKey);
    state = {
      subject,
      questions: Questions.pick(list, TOTAL),
      index: -1,
      results: [],
      total: 0,
      phase: 'idle',
      q: null,
      charIndex: null,
      inputLocked: false,
      deadline: 0,
      lastCount: null,
    };
    $('play-subject').textContent = subject.label;
    $('play-subject').style.background = subject.color;
    $('play-score').textContent = '0';
    document.getElementById('app').classList.add('is-playing');
    renderDots();
    Sound.play('fanfare');
    later(nextQuestion, 900);
  }

  function stop() {
    clearTimers();
    if (reader) reader.stop();
    state = null;
    $('answer-input').blur();
    Keys.blur();
    document.getElementById('app').classList.remove('is-playing');
  }

  // 上の「10この点」：正かいは緑、ざんねんは灰色、いまの問題は黄色
  function renderDots() {
    const wrap = $('play-dots');
    wrap.innerHTML = '';
    state.questions.forEach((q, i) => {
      const d = document.createElement('span');
      const r = state.results[i];
      d.className = 'dot' + (r ? (r.kind === 'correct' ? ' ok' : ' ng') : (i === state.index ? ' now' : ''));
      wrap.appendChild(d);
    });
  }

  function nextQuestion() {
    if (!state) return;
    state.index++;
    if (state.index >= state.questions.length) {
      finish();
      return;
    }
    const q = state.questions[state.index];
    state.q = q;
    state.charIndex = null;
    state.phase = 'intro';

    $('play-count').textContent = '第' + (state.index + 1) + '問 / ' + state.questions.length;
    renderDots();
    reader.setText(q.question, MS_PER_CHAR);
    $('full-timer').hidden = true;
    showStage('buzz');
    $('btn-buzz').disabled = true;
    Keys.focus(); // 問題の間は、見えない入力欄で Enter・スペースを受けとる

    $('intro-text').textContent = '第' + (state.index + 1) + '問';
    $('intro').hidden = false;
    Sound.play('intro');

    later(() => {
      if (!state) return;
      $('intro').hidden = true;
      state.phase = 'reading';
      $('btn-buzz').disabled = false;
      reader.start(0, onFullText);
    }, INTRO_MS);
  }

  // 全文が出たら、5秒たつと時間切れ
  function onFullText() {
    if (!state || state.phase !== 'reading') return;
    const bar = $('full-timer');
    bar.hidden = false;
    const inner = bar.firstElementChild;
    inner.style.transition = 'none';
    inner.style.transform = 'scaleX(1)';
    void inner.offsetWidth;
    inner.style.transition = 'transform ' + AFTER_FULL_MS + 'ms linear';
    inner.style.transform = 'scaleX(0)';
    state.fullTimer = later(() => {
      if (!state || state.phase !== 'reading') return;
      reveal({ kind: 'timeup' });
    }, AFTER_FULL_MS);
  }

  function buzz() {
    if (!state || state.phase !== 'reading') return;
    state.phase = 'answering';
    if (state.fullTimer) clearTimeout(state.fullTimer);
    $('full-timer').hidden = true;

    state.charIndex = reader.pause();
    Sound.play('buzz');
    Effects.flash();

    renderSpotAvatar();
    showStage('answer');
    const box = $('answer-box');
    const input = $('answer-input');
    input.value = '';
    setWarn(false);
    $('countdown').textContent = ANSWER_SEC;
    $('countdown').classList.remove('danger');
    $('countdown-wrap').classList.remove('danger');
    $('countdown-wrap').style.setProperty('--p', 1);

    // iPad では、ボタンやキーを押したその場でないと入力欄にカーソルを入れられないので、
    // ここで先にカーソルを入れておき、0.3秒は文字もEnterも受けつけないようにする
    box.classList.add('waiting');
    state.inputLocked = true;
    focusInput();

    later(() => {
      if (!state || state.phase !== 'answering') return;
      state.inputLocked = false;
      box.classList.remove('waiting');
      input.value = '';
      focusInput();
      startCountdown();
    }, INPUT_DELAY_MS);
  }

  function setWarn(on) {
    $('answer-warn').hidden = !on;
    $('answer-hint').hidden = on;
  }

  function focusInput() {
    const input = $('answer-input');
    if (document.activeElement === input) return;
    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
  }

  function startCountdown() {
    state.deadline = performance.now() + ANSWER_SEC * 1000;
    state.lastCount = ANSWER_SEC;
    const t = setInterval(() => {
      if (!state || state.phase !== 'answering') { clearInterval(t); return; }
      const left = state.deadline - performance.now();
      $('countdown-wrap').style.setProperty('--p', Math.max(0, left) / (ANSWER_SEC * 1000));
      const count = Math.max(0, Math.ceil(left / 1000));
      if (count !== state.lastCount) {
        state.lastCount = count;
        const el = $('countdown');
        el.textContent = count;
        el.classList.toggle('danger', count <= 3);
        $('countdown-wrap').classList.toggle('danger', count <= 3);
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
        if (count > 0 && count <= 3) Sound.play('beep');
      }
      if (left <= 0) {
        clearInterval(t);
        reveal({ kind: 'wrong', input: $('answer-input').value, late: true });
      }
    }, 50);
    timers.push(t);
  }

  function sendAnswer() {
    if (!state || state.phase !== 'answering' || state.inputLocked) return;
    const input = $('answer-input');
    let value = input.value;
    // ローマ字の最後の「n」なども、ひらがなに直してから判定する
    if (window.wanakana) {
      // カタカナの「ー」は母音にしない（「ペリー」が「ぺりい」にならないように）
      try { value = wanakana.toHiragana(value, { convertLongVowelMark: false }); } catch (e) { /* そのまま使う */ }
    }
    if (!Judge.normalizeAnswer(value)) return; // 空っぽのときは送らない
    const ok = Judge.isCorrect(value, state.q);
    // 漢字の答えも正解にしている。漢字が合っていないとき（変換で別の漢字になった など）は、
    // まちがいにせず「ひらがなで入れてね」と知らせる（15カウントはそのまま進む）
    if (!ok && Judge.hasKanji(value)) {
      setWarn(true);
      Effects.shake($('answer-box'));
      Sound.play('tap');
      focusInput();
      return;
    }
    reveal({ kind: ok ? 'correct' : 'wrong', input: value });
  }

  function reveal(r) {
    if (!state) return;
    state.phase = 'reveal';
    const q = state.q;
    Keys.focus(); // 答えの欄から、見えない入力欄にカーソルをもどす
    $('full-timer').hidden = true;
    reader.showAll();

    let points = 0;
    const markEl = $('reveal-mark');
    const titleEl = $('reveal-title');
    const stageEl = $('stage-reveal');
    stageEl.classList.remove('is-correct', 'is-wrong', 'is-timeup');

    if (r.kind === 'correct') {
      points = calcPoints(state.charIndex, q.question.length);
      markEl.textContent = '○';
      titleEl.textContent = '正かい！';
      stageEl.classList.add('is-correct');
      Sound.play('correct');
      Effects.confetti();
    } else if (r.kind === 'wrong') {
      markEl.textContent = '×';
      titleEl.textContent = r.late && !r.input ? '時間切れ…' : 'ざんねん…';
      stageEl.classList.add('is-wrong');
      Sound.play('wrong');
      Effects.shake();
    } else {
      markEl.textContent = '…';
      titleEl.textContent = '時間切れ';
      stageEl.classList.add('is-timeup');
      Sound.play('timeup');
    }

    $('reveal-answer').textContent = q.answer;
    const yours = $('reveal-yours');
    if (r.kind === 'wrong' && r.input) {
      yours.textContent = 'あなたの答え：' + r.input;
    } else if (state.charIndex != null) {
      yours.textContent = q.question.length + '文字中 ' + state.charIndex + '文字目で おした';
    } else {
      yours.textContent = 'だれも おさなかったよ';
    }
    $('reveal-points').textContent = points > 0 ? '+' + points + '点' : '0点';
    $('reveal-points').classList.toggle('plus', points > 0);

    state.total += points;
    $('play-score').textContent = state.total;
    if (points > 0) {
      const sc = $('play-score').parentElement;
      sc.classList.remove('bump');
      void sc.offsetWidth;
      sc.classList.add('bump');
    }
    state.results.push({
      question: q,
      kind: r.kind,
      input: r.input || '',
      charIndex: state.charIndex,
      points,
    });

    renderDots();
    showStage('reveal');
    later(nextQuestion, REVEAL_MS);
  }

  function finish() {
    const s = state;
    state = null;
    clearTimers();
    document.getElementById('app').classList.remove('is-playing');
    const correct = s.results.filter((r) => r.kind === 'correct').length;
    const buzzed = s.results.filter((r) => r.charIndex != null);
    const avgChar = buzzed.length
      ? Math.round((buzzed.reduce((sum, r) => sum + r.charIndex, 0) / buzzed.length) * 10) / 10
      : null;
    if (onFinish) {
      onFinish({ subject: s.subject, total: s.total, correct, avgChar, results: s.results, count: s.questions.length });
    }
  }

  // キャラクターはステップ2で作るので、いまは仮の顔を出す
  function renderSpotAvatar() {
    const el = $('spot-avatar');
    const who = window.Profile && Profile.name() ? Profile.name() + 'さんが' : 'あなたが';
    document.querySelector('.spot-name').textContent = who + ' おした！';
    if (window.Avatar && window.Avatar.renderCurrent) {
      el.innerHTML = window.Avatar.renderCurrent();
      return;
    }
    el.innerHTML =
      '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle cx="50" cy="52" r="40" fill="#ffd9b8" stroke="#3a2a5e" stroke-width="4"/>' +
      '<circle cx="36" cy="48" r="5" fill="#3a2a5e"/><circle cx="64" cy="48" r="5" fill="#3a2a5e"/>' +
      '<path d="M36 64 Q50 76 64 64" fill="none" stroke="#3a2a5e" stroke-width="5" stroke-linecap="round"/>' +
      '<circle cx="28" cy="62" r="6" fill="#ff9bb0" opacity=".7"/><circle cx="72" cy="62" r="6" fill="#ff9bb0" opacity=".7"/>' +
      '</svg>';
  }

  window.Practice = { setup, start, stop, calcPoints, isPlaying: () => !!state, buzzKey: () => buzz() };
})();
