// 期間限定イベント（一般常識チャレンジ＋偉人ガチャ）
// 期間・名前を変えるときは、ここの EVENT だけを直す。
(function () {
  const EVENT = {
    name: '一般常識イベント',
    subject: 'joushiki',                   // js/questions.js の EXTRA にある「一般常識」
    start: '2026-11-25T00:00:00+09:00',    // 始まる日時（日本時間）
    end: '2026-12-01T23:59:59+09:00',      // 終わる日時（日本時間）
    label: '11/25（水）〜12/1（火）',
  };
  const START = Date.parse(EVENT.start);
  const END = Date.parse(EVENT.end);

  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const TITLE = { sr: 'スーパーレア！！', r: 'レア！', n: 'ゲット！' };
  const RANK = { n: 0, r: 1, sr: 2 };
  let busy = false;
  let single = null;

  // たしかめ用：この パソコンの中（localhost）だけ、?event=test でいつでもイベントを開ける
  function testMode() {
    return /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]event=test/.test(location.search);
  }
  function state() {
    const t = Date.now();
    if (testMode()) return 'open';
    if (t < START) return 'before';
    if (t > END) return 'after';
    return 'open';
  }
  const isOpen = () => state() === 'open';

  // ---------- メニューのカード ----------
  function updateMenuCard() {
    const card = $('btn-menu-event');
    const st = state();
    card.hidden = st === 'after';
    card.disabled = st !== 'open';
    $('menu-event-sub').textContent = st === 'before' ? EVENT.label.split('〜')[0] + 'から 始まるよ！' : EVENT.label.split('〜')[1] + 'まで！';
    // イベントがあるときは、ガチャとイベントを半分ずつにならべる
    $('btn-menu-gacha').classList.toggle('half', !card.hidden);
    card.classList.toggle('ready', st === 'open' && Profile.skinPulls() > 0);
  }

  // ---------- イベントの画面 ----------
  function open() {
    if (!isOpen()) { alert(EVENT.name + 'は ' + EVENT.label + ' だよ'); return; }
    $('skin-result').hidden = true;
    $('event-rank').hidden = true;
    window.App.show('screen-event');
    update();
  }

  function update() {
    const pts = Profile.eventPoints();
    const pulls = Profile.skinPulls();
    const cost = Store.GACHA_COST;
    $('event-period').textContent = EVENT.label;
    $('event-points').textContent = pts.toLocaleString();
    $('event-can').textContent = pulls
      ? '偉人ガチャが ' + pulls + '回 引けるよ！'
      : 'あと ' + (cost - (pts % cost)) + '点で 1回 引けるよ。一般常識チャレンジで 点を ためよう！';
    $('event-can').classList.toggle('ready', pulls > 0);
    $('btn-skin-1').disabled = busy || pulls < 1;
    $('btn-skin-10').disabled = busy || pulls < 10;
    const best = Profile.best(EVENT.subject);
    $('event-best').innerHTML = best ? 'あなたの ベスト記録 <b></b>点' : 'まだ 記録がないよ。ランキングを ねらおう！';
    if (best) $('event-best').querySelector('b').textContent = best;
    renderCollection();
  }

  // ---------- 一般常識チャレンジのランキング ----------
  let rankLoad = 0;
  async function openRanking() {
    const myId = ++rankLoad;
    const list = $('event-rank-list');
    list.innerHTML = '<li class="rank-loading">読みこみ中…</li>';
    $('event-rank-empty').hidden = true;
    $('event-rank-me').textContent = '';
    $('event-rank').hidden = false;
    const myBest = Profile.best(EVENT.subject);
    let rows, myRank;
    try {
      [rows, myRank] = await Promise.all([Store.getRanking(EVENT.subject), Store.getRank(EVENT.subject, myBest)]);
    } catch (e) {
      if (myId !== rankLoad) return;
      list.innerHTML = '<li class="rank-loading">読みこめませんでした。インターネットを たしかめてね</li>';
      return;
    }
    if (myId !== rankLoad) return;
    Ranking.renderRows(list, rows);
    $('event-rank-empty').hidden = rows.length > 0;
    $('event-rank-me').textContent = myBest
      ? 'あなたの ベスト記録：' + myBest + '点（' + myRank + '位）'
      : 'あなたは まだ 記録がないよ';
  }

  // 12人のコレクション（まだの人は「？」）
  function renderCollection() {
    const owned = Profile.skins();
    const grid = $('skin-grid');
    grid.innerHTML = '';
    Skins.SKINS.forEach((x) => {
      const d = document.createElement('div');
      const has = !!owned[x.id];
      d.className = 'skin-card rarity-' + x.rarity + (has ? '' : ' locked') + (Profile.skin() === x.id ? ' wearing' : '');
      d.innerHTML = '<span class="avatar-badge skin-face"></span><span class="skin-name"></span>';
      d.querySelector('.skin-face').innerHTML = has ? Skins.render(x.id) : '<span class="acc-q">？</span>';
      d.querySelector('.skin-name').textContent = has ? x.name : Skins.RARITY[x.rarity].label;
      grid.appendChild(d);
    });
    $('skin-owned').textContent = '集めた 偉人 ' + Skins.owned(owned).length + ' / ' + Skins.SKINS.length;
  }

  async function play() {
    if (!isOpen()) return;
    Sound.play('tap');
    window.App.startPractice(EVENT.subject);
  }

  // ---------- 偉人ガチャ ----------
  async function pull(count) {
    if (busy || !isOpen() || Profile.skinPulls() < count) return;
    busy = true;
    update();
    const m = $('event-machine');
    m.classList.remove('turning');
    void m.offsetWidth;
    m.classList.add('turning');
    Sound.play('tap');
    setTimeout(() => Sound.play('beep'), 350);
    setTimeout(() => Sound.play('beep'), 700);
    let r;
    try {
      [r] = await Promise.all([Profile.pullSkinGacha(count), wait(1100)]);
    } catch (e) {
      busy = false;
      m.classList.remove('turning');
      update();
      alert('ガチャを 引けませんでした。インターネットを たしかめてね。');
      return;
    }
    busy = false;
    m.classList.remove('turning');
    update();
    if (!r.results) {
      alert(r.reason === 'points' ? '点が たりないよ' : '記録が 見つかりませんでした');
      return;
    }
    showResult(r.results);
  }

  function showResult(results) {
    const list = $('skin-result-list');
    list.innerHTML = '';
    list.classList.toggle('one', results.length === 1);
    results.forEach((x, i) => {
      const d = document.createElement('div');
      d.className = 'gacha-item rarity-' + x.acc.rarity + (x.isNew ? ' is-new' : '');
      d.style.animationDelay = i * 0.2 + 's';
      d.innerHTML = '<span class="gi-rarity"></span><span class="gi-icon skin-icon"></span><span class="gi-name"></span><span class="gi-tag"></span>';
      d.querySelector('.gi-rarity').textContent = Skins.RARITY[x.acc.rarity].label;
      d.querySelector('.gi-icon').innerHTML = Skins.render(x.acc.id);
      d.querySelector('.gi-name').textContent = x.acc.name;
      d.querySelector('.gi-tag').textContent = x.isNew ? 'NEW!' : 'もう持っている';
      list.appendChild(d);
      setTimeout(() => Sound.play(x.acc.rarity === 'n' ? 'tap' : 'sparkle'), i * 200 + 150);
    });
    const best = results.reduce((a, x) => (RANK[x.acc.rarity] > RANK[a] ? x.acc.rarity : a), 'n');
    const news = results.filter((x) => x.isNew).length;
    if (results.length === 1) {
      single = results[0].acc;
      $('skin-result-title').textContent = TITLE[single.rarity];
      $('skin-result-sum').textContent = results[0].isNew
        ? '「' + single.name + '」の スキンを ゲットしたよ！'
        : '「' + single.name + '」は もう持っているよ。つぎは ちがう偉人を ねらおう！';
    } else {
      single = null;
      $('skin-result-title').textContent = '10連ガチャの けっか';
      $('skin-result-sum').textContent = news
        ? '新しい 偉人が ' + news + '人！' + (best === 'sr' ? ' スーパーレアも 出たよ！' : '')
        : 'ぜんぶ もう持っていたよ…。つぎは きっと 出る！';
    }
    $('skin-result').classList.toggle('is-sr', best === 'sr');
    $('btn-skin-wear').hidden = !single;
    $('skin-result').hidden = false;
    setTimeout(() => {
      if (best === 'sr') { Sound.play('fanfare'); Effects.confetti(120); }
      else if (news) { Sound.play('correct'); Effects.confetti(60); }
      Effects.sparkle($('skin-result').querySelector('.modal-card'));
    }, results.length * 200 + 300);
  }

  function close() {
    $('skin-result').hidden = true;
    update();
  }

  function setup() {
    $('btn-menu-event').addEventListener('click', () => { Sound.play('tap'); open(); });
    $('btn-event-play').addEventListener('click', play);
    $('btn-skin-1').addEventListener('click', () => pull(1));
    $('btn-skin-10').addEventListener('click', () => pull(10));
    $('btn-skin-close').addEventListener('click', () => { Sound.play('tap'); close(); });
    $('btn-skin-wear').addEventListener('click', async () => {
      const x = single;
      Sound.play('correct');
      if (x) { try { await Profile.wearSkin(x.id); } catch (e) { /* つけられなくても続ける */ } }
      close();
      $('event-can').textContent = x ? '「' + x.name + '」の スキンを つけたよ！' : '';
    });
    $('btn-event-rank').addEventListener('click', () => { Sound.play('tap'); openRanking(); });
    $('btn-event-rank-close').addEventListener('click', () => { Sound.play('tap'); rankLoad++; $('event-rank').hidden = true; });
    $('btn-event-maker').addEventListener('click', () => { Sound.play('tap'); window.App.openMaker('skin'); });
  }

  window.HistoryEvent = { EVENT, setup, open, update, updateMenuCard, isOpen, state };
})();
