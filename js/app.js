// 画面の切りかえと、全体のしくみ
(function () {
  const $ = (id) => document.getElementById(id);
  let lastSubjectKey = null;
  let nameMode = 'first'; // 'first'（はじめて）| 'rename'（名前を変える）
  let found = null;       // 名前で見つかった記録

  function show(screenId) {
    if (screenId === 'screen-menu') updateMenu();
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === screenId));
    window.scrollTo(0, 0);
  }

  function updateMenu() {
    $('menu-avatar').innerHTML = Avatar.renderCurrent();
    $('menu-name').textContent = Profile.name();
    $('menu-points').textContent = Profile.totalPoints().toLocaleString();
    $('test-badge').hidden = Store.mode() !== 'test';
    // ガチャのカード
    const pulls = Profile.gachaPulls();
    const rest = Store.GACHA_COST - (Profile.totalPoints() % Store.GACHA_COST);
    $('menu-gacha-sub').textContent = pulls ? pulls + '回 引けるよ！' : 'あと ' + rest + '点で 引けるよ';
    $('btn-menu-gacha').classList.toggle('ready', pulls > 0);
    HistoryEvent.updateMenuCard(); // 期間限定イベントのカード
  }

  // ---- 音のオン・オフ ----
  function updateSoundButton() {
    const on = Sound.isEnabled();
    $('sound-toggle').textContent = on ? '🔊' : '🔇';
    $('sound-toggle').classList.toggle('off', !on);
  }

  // ---- はじめる ----
  async function onStart() {
    Sound.unlock(); // iPad で音を出せるようにする
    Sound.play('tap');
    const btn = $('btn-start');
    btn.disabled = true;
    btn.textContent = 'じゅんび中…';
    try {
      await Store.init();
    } catch (e) {
      alert('記録を保存するサーバーに つながりませんでした。\nインターネットを たしかめて、もう一度「はじめる」をおしてね。');
      btn.disabled = false;
      btn.textContent = 'はじめる';
      return;
    }
    btn.disabled = false;
    btn.textContent = 'はじめる';

    if (Profile.loadLocal()) {
      // この iPad で まだ あいことばを 入れていなければ、名前と あいことばを 入れてもらう
      let ok = true;
      try { ok = await Store.deviceOk(Profile.key()); } catch (e) { ok = true; }
      if (!ok) {
        openName('first');
        $('name-input').value = Profile.name();
        onNameOk();
        return;
      }
      show('screen-menu');
      // ほかの iPad で遊んだ分を読みなおす
      Profile.refresh().then((r) => {
        if (r === 'deleted') {
          // 先生がこの名前を消した → 名前を入れなおしてもらう
          openName('first');
          nameError('記録が 消されたので、名前を 入れなおしてね');
          return;
        }
        if ($('screen-menu').classList.contains('active')) updateMenu();
      }).catch(() => {});
    } else {
      openName('first');
    }
  }

  // ---- 名前 ----
  function openName(mode) {
    nameMode = mode;
    found = null;
    pass = null;
    $('name-form').hidden = false;
    $('name-found').hidden = true;
    $('name-pass').hidden = true;
    $('name-error').hidden = true;
    $('btn-name-back').hidden = mode === 'first';
    $('name-input').value = '';
    show('screen-name');
    setTimeout(() => { try { $('name-input').focus({ preventScroll: true }); } catch (e) { /* 何もしない */ } }, 350);
  }

  function nameError(msg) {
    $('name-error').textContent = msg;
    $('name-error').hidden = false;
    Effects.shake($('name-form'));
  }

  async function onNameOk() {
    // ローマ字入力の最後の「n」は「ん」にする
    const name = $('name-input').value.replace(/n$/i, 'ん');
    const clean = Store.normalizeName(name);
    if (!clean) { nameError('名前を 入れてね'); return; }
    if ([...clean].length > 10) { nameError('名前は 10文字までだよ'); return; }

    const btn = $('btn-name-ok');
    btn.disabled = true;
    btn.textContent = 'さがしています…';
    let res;
    try {
      res = await Profile.lookup(clean);
    } catch (e) {
      nameError('つながりませんでした。もう一度 おしてね');
      return;
    } finally {
      btn.disabled = false;
      btn.textContent = 'けってい';
    }
    if (!res.ok) { nameError('その名前は つかえないよ。べつの名前にしてね'); return; }
    Sound.play('tap');

    // この iPad で まだ あいことばを 入れていない名前なら、あいことばの画面へ
    let mine;
    let locked = false;
    try {
      mine = await Store.deviceOk(res.key);
      if (!mine) locked = await Store.hasPass(res.key);
    } catch (e) {
      nameError('つながりませんでした。もう一度 おしてね');
      return;
    }
    if (!mine) { openPass(res, locked); return; }
    afterName(res);
  }

  // 名前（と あいことば）が すんだあと
  function afterName(res) {
    if (res.data) {
      // 同じ名前の記録がある → 本人か確かめる
      found = res;
      const eq = res.data.equipped || {};
      $('found-avatar').innerHTML = Avatar.render(res.data.avatar || Avatar.DEFAULT, { equipped: eq });
      $('found-name').textContent = res.data.name || res.name;
      $('found-points').textContent = (Number(res.data.totalPoints) || 0).toLocaleString();
      $('name-form').hidden = true;
      $('name-found').hidden = false;
    } else {
      // はじめての名前 → キャラを作る
      Maker.open({
        canCancel: true,
        onDone: async (r) => {
          if (!r) { openName(nameMode); return; }
          try {
            await Profile.register(res.name, res.key, r.avatar);
          } catch (e) {
            alert('記録を保存できませんでした。インターネットを たしかめてね。');
            return;
          }
          show('screen-menu');
        },
      });
      show('screen-avatar');
    }
  }

  // ---- あいことば ----
  let pass = null; // { res, locked }
  let passFails = 0;
  let passWaitUntil = 0;

  function openPass(res, locked) {
    pass = { res, locked };
    const name = (res.data && res.data.name) || res.name;
    $('pass-name').textContent = name;
    $('pass-title').textContent = res.data ? 'さんの 記録が 見つかったよ！' : 'さん、はじめまして！';
    $('pass-avatar').hidden = !res.data;
    $('pass-points').hidden = !res.data;
    if (res.data) {
      $('pass-avatar').innerHTML = Avatar.render(res.data.avatar || Avatar.DEFAULT, { equipped: res.data.equipped || {} });
      $('pass-points-num').textContent = (Number(res.data.totalPoints) || 0).toLocaleString();
    }
    setPassLabel();
    $('pass-input').value = '';
    $('pass-error').hidden = true;
    $('name-form').hidden = true;
    $('name-found').hidden = true;
    $('name-pass').hidden = false;
    setTimeout(() => { try { $('pass-input').focus({ preventScroll: true }); } catch (e) { /* 何もしない */ } }, 200);
  }

  function setPassLabel() {
    if (pass.locked) {
      $('pass-label').textContent = 'あいことば（数字 4けた）を 入れてね';
      $('pass-hint').textContent = 'わすれたときは、先生に 言ってね';
    } else {
      $('pass-label').textContent = pass.res.data ? 'あいことば（数字 4けた）を 決めてね' : 'あいことば（数字 4けた）を 決めよう';
      $('pass-hint').textContent = 'ちがうiPadで あそぶときに つかうよ。わすれないでね！ 友だちには ないしょだよ';
    }
  }

  function passError(msg) {
    $('pass-error').textContent = msg;
    $('pass-error').hidden = false;
    Effects.shake($('name-pass'));
  }

  async function onPassOk() {
    if (!pass) return;
    if (Date.now() < passWaitUntil) { passError('たくさん まちがえたので、少し まってから 入れてね'); return; }
    const code = $('pass-input').value.normalize('NFKC').replace(/\s/g, '');
    if (!/^[0-9]{4}$/.test(code)) { passError('数字 4けたで 入れてね'); return; }
    const btn = $('btn-pass-ok');
    btn.disabled = true;
    btn.textContent = 'たしかめています…';
    let ok;
    try {
      ok = pass.locked ? await Store.checkPass(pass.res.key, code) : await Store.setPass(pass.res.key, code);
    } catch (e) {
      passError('つながりませんでした。もう一度 おしてね');
      return;
    } finally {
      btn.disabled = false;
      btn.textContent = 'けってい';
    }
    if (!ok) {
      if (!pass.locked) {
        // 少し前に、ほかの iPad で あいことばが 決まった
        pass.locked = true;
        setPassLabel();
        passError('もう あいことばが 決まっていたよ。その あいことばを 入れてね');
        return;
      }
      passFails += 1;
      $('pass-input').value = '';
      Sound.play('wrong');
      if (passFails >= 5) {
        passFails = 0;
        passWaitUntil = Date.now() + 30000;
        passError('5回 まちがえたので、30秒 まってね');
      } else {
        passError('あいことばが ちがうよ');
      }
      return;
    }
    passFails = 0;
    Sound.play('correct');
    const res = pass.res;
    pass = null;
    if (res.data) {
      // 記録がある子は、そのまま つづきから
      try {
        await Profile.loginExisting(res.data.name || res.name, res.key, res.data);
      } catch (e) {
        alert('読みこめませんでした。もう一度 おしてね。');
        return;
      }
      show('screen-menu');
      return;
    }
    afterName(res);
  }

  async function onFoundYes() {
    if (!found) return;
    Sound.play('correct');
    try {
      await Profile.loginExisting(found.name, found.key, found.data);
    } catch (e) {
      alert('読みこめませんでした。もう一度 おしてね。');
      return;
    }
    show('screen-menu');
  }

  // ---- 教科のボタン ----
  function buildSubjectList() {
    const wrap = $('subject-list');
    wrap.innerHTML = '';
    const list = Questions.SUBJECTS.filter((s) => !s.battleOnly);
    // 一般常識イベントの間は、オールジャンルの横に「一般常識チャレンジ」（イベントの点がたまる）
    if (HistoryEvent.isOpen()) {
      const ev = Questions.getSubject(HistoryEvent.EVENT.subject);
      list.push(Object.assign({}, ev, { label: '一般常識', isEvent: true }));
    }
    list.forEach((s) => {
      const b = document.createElement('button');
      b.className = 'subject-btn' + (s.key === 'all' ? ' subject-all' : '') + (s.isEvent ? ' subject-event' : '');
      b.style.setProperty('--c', s.color);
      const best = Profile.best(s.key);
      b.innerHTML = '<span class="subject-badge"></span><span class="subject-text"><span class="subject-name"></span><span class="subject-best"></span></span>';
      b.querySelector('.subject-badge').textContent = s.badge;
      b.querySelector('.subject-name').textContent = s.label;
      b.querySelector('.subject-best').textContent = best ? 'ベスト ' + best + '点' : 'まだ記録なし';
      if (s.isEvent) {
        const tag = document.createElement('span');
        tag.className = 'subject-ribbon';
        tag.textContent = '期間限定';
        b.appendChild(tag);
      }
      b.addEventListener('click', () => startPractice(s.key));
      wrap.appendChild(b);
    });
  }

  async function startPractice(key) {
    Sound.play('tap');
    lastSubjectKey = key;
    let list;
    try {
      list = await Questions.load(key);
    } catch (e) {
      alert('問題を読みこめませんでした。インターネットのつながりを たしかめてね。');
      return;
    }
    show('screen-play');
    Practice.start(key, list, showResult);
  }

  // ---- 結果 ----
  function showResult(r) {
    const key = r.subject.key;
    $('result-avatar').innerHTML = Avatar.renderCurrent();
    $('result-subject').textContent = r.subject.label;
    $('result-total').textContent = r.total;
    $('result-correct').textContent = r.correct;
    $('result-avgchar').textContent = r.avgChar == null ? '-' : r.avgChar;
    const isEvent = key === HistoryEvent.EVENT.subject; // 一般常識イベントは「イベントの点」がたまる（ランキングはイベントの中）
    $('rp-label').textContent = isEvent ? 'イベントの点' : 'ためた点';
    $('btn-result-gacha').textContent = isEvent ? '🎁 偉人ガチャを引く' : '🎁 ガチャを引く';
    $('result-best').textContent = Math.max(Profile.best(key), r.total);
    $('result-newbest').hidden = true;
    $('result-rank').hidden = true;
    $('rp-total').textContent = '-';
    $('rp-plus').textContent = '+' + r.total;
    $('rp-bar').style.width = '0%';
    $('rp-next').textContent = '記録しています…';
    $('btn-result-gacha').hidden = true;
    buildResultList(r.results);

    show('screen-result');
    Sound.play('fanfare');

    const apply = isEvent ? Profile.applyEvent(key, r.total) : Profile.applyPractice(key, r.total);
    apply.then((res) => {
      if (lastSubjectKey !== key || !$('screen-result').classList.contains('active')) return;
      $('result-best').textContent = res.best;
      if (res.isNewBest) {
        $('result-newbest').hidden = false;
        Effects.confetti(90);
        setTimeout(() => {
          Sound.play('sparkle');
          Effects.sparkle($('result-newbest'));
        }, 1200);
      }
      if (res.rank && res.rank <= 10) {
        $('result-rank').textContent = '🏆 ' + (isEvent ? '一般常識チャレンジ' : r.subject.label) + ' ランキング ' + res.rank + '位！';
        $('result-rank').hidden = false;
      }
      showPoints(res, isEvent ? '偉人ガチャ' : undefined);
    }).catch(() => {
      $('rp-next').textContent = '記録を 保存できませんでした（インターネットを たしかめてね）';
    });
  }

  // ためた点と、つぎのガチャまで
  function showPoints(res, gachaName) {
    const total = res.total;
    const cost = Store.GACHA_COST;
    const g = gachaName || 'ガチャ';
    $('rp-total').textContent = total.toLocaleString();
    if (res.pulls > 0) {
      $('rp-next').textContent = g + 'が ' + res.pulls + '回 引けるよ！';
      $('rp-bar').style.width = '100%';
      $('btn-result-gacha').hidden = false;
      setTimeout(() => Sound.play('sparkle'), 900);
    } else {
      $('rp-next').textContent = g + 'まで あと ' + (cost - total % cost) + '点';
      $('rp-bar').style.width = ((total % cost) / cost) * 100 + '%';
    }
  }

  function buildResultList(results) {
    const list = $('result-list');
    list.innerHTML = '';
    results.forEach((x) => {
      const li = document.createElement('li');
      li.className = 'result-item ' + (x.kind === 'correct' ? 'ok' : 'ng');
      li.innerHTML = '<span class="ri-mark"></span><span class="ri-body"><span class="ri-q"></span><span class="ri-a"></span></span><span class="ri-pts"></span>';
      li.querySelector('.ri-mark').textContent = x.kind === 'correct' ? '○' : '×';
      li.querySelector('.ri-q').textContent = x.question.question;
      li.querySelector('.ri-a').textContent = 'こたえ：' + x.question.answer;
      li.querySelector('.ri-pts').textContent = x.points + '点';
      list.appendChild(li);
    });
  }

  // キャラクターづくり（メニューから）
  function openMakerFromMenu(tab) {
    Maker.open({
      canCancel: true,
      tab,
      onDone: async (r) => {
        if (r) {
          try {
            await Profile.saveLook(r.avatar, r.equipped, r.skin);
          } catch (e) {
            alert('保存できませんでした。インターネットを たしかめてね。');
          }
        }
        show('screen-menu');
      },
    });
    show('screen-avatar');
  }

  window.App = { show, openMaker: openMakerFromMenu, startPractice };

  function init() {
    Practice.setup();
    Maker.setup();
    Battle.setup();
    Gacha.setup();
    HistoryEvent.setup();
    // 見えない入力欄で Enter・スペースを受けとったら早押し
    Keys.setup();
    Keys.onBuzz(() => {
      if (Practice.isPlaying()) Practice.buzzKey();
      else Battle.buzzKey();
    });
    updateSoundButton();

    $('btn-start').addEventListener('click', onStart);

    // 名前
    const nameInput = $('name-input');
    if (window.wanakana) {
      try { wanakana.bind(nameInput, { IMEMode: 'toHiragana' }); } catch (e) { /* なくても入力できる */ }
    }
    let lastComp = 0;
    nameInput.addEventListener('compositionend', () => { lastComp = performance.now(); });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (e.isComposing || e.keyCode === 229 || performance.now() - lastComp < 80) return;
      onNameOk();
    });
    $('btn-name-ok').addEventListener('click', onNameOk);
    $('btn-name-back').addEventListener('click', () => { Sound.play('tap'); show('screen-menu'); });
    $('btn-found-yes').addEventListener('click', onFoundYes);
    $('btn-pass-ok').addEventListener('click', onPassOk);
    $('btn-pass-no').addEventListener('click', () => { Sound.play('tap'); openName(nameMode); });
    $('pass-input').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      onPassOk();
    });
    $('btn-found-no').addEventListener('click', () => { Sound.play('tap'); openName(nameMode); });
    $('btn-rename').addEventListener('click', () => { Sound.play('tap'); openName('rename'); });

    $('btn-avatar').addEventListener('click', () => { Sound.play('tap'); openMakerFromMenu(); });
    $('btn-ranking').addEventListener('click', () => {
      Sound.play('tap');
      show('screen-ranking');
      Ranking.open();
    });

    $('btn-menu-gacha').addEventListener('click', () => { Sound.play('tap'); Gacha.open(); });
    $('btn-result-gacha').addEventListener('click', () => {
      Sound.play('tap');
      if (lastSubjectKey === HistoryEvent.EVENT.subject) HistoryEvent.open();
      else Gacha.open();
    });

    $('sound-toggle').addEventListener('click', () => {
      Sound.unlock();
      Sound.setEnabled(!Sound.isEnabled());
      updateSoundButton();
      Sound.play('tap');
    });

    $('btn-practice').addEventListener('click', () => {
      Sound.play('tap');
      buildSubjectList();
      show('screen-subject');
    });

    $('btn-battle').addEventListener('click', () => {
      Sound.play('tap');
      if (Store.mode() !== 'firebase') {
        alert('対戦は、Firebase の設定をしてから 使えるよ（いまは テストモードです）');
        return;
      }
      Battle.openLobby();
    });

    $('btn-quit').addEventListener('click', () => {
      if (!confirm('とちゅうで やめる？（記録は のこらないよ）')) return;
      Practice.stop();
      buildSubjectList();
      show('screen-subject');
    });

    $('btn-again').addEventListener('click', () => {
      if (lastSubjectKey === HistoryEvent.EVENT.subject && !HistoryEvent.isOpen()) {
        alert(HistoryEvent.EVENT.name + 'は 終わったよ');
        return;
      }
      if (lastSubjectKey) startPractice(lastSubjectKey);
    });

    document.querySelectorAll('[data-go]').forEach((b) => {
      b.addEventListener('click', () => {
        Sound.play('tap');
        if (b.dataset.go === 'screen-subject') buildSubjectList();
        show(b.dataset.go);
      });
    });

    // ダブルタップで画面が大きくならないようにする（iPad）
    let lastTouch = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouch < 350 && e.target.tagName !== 'INPUT') e.preventDefault();
      lastTouch = now;
    }, { passive: false });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
