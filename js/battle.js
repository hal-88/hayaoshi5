// 対戦モード（2〜5人・部屋コード）
// しくみ：
// ・部屋のようすは Firebase の rooms/{部屋コード} に全部のせて、全員が同じものを見る
// ・問題の進行（次の問題・時間切れ）は「ホスト」の端末が書きこむ
// ・早押しは「まだだれも押していなければ自分を書く」トランザクションで、1人だけが勝つ
// ・問題文は「表示を始めた時刻（サーバーの時刻）＋文字の速さ」から、全員の画面で同じ文字数を出す
// ・答えの正かい・ざんねんは、答えた人の端末で決めて書きこむ
(function () {
  const $ = (id) => document.getElementById(id);

  const MAX_PLAYERS = 5;
  const FIRST_INTRO_MS = 2400;  // 1問目の前（ファンファーレのぶん長め）
  const INTRO_MS = 1500;        // 「第○問」を見せる時間
  const AFTER_FULL_MS = 5000;   // 全文が出てから時間切れまで
  const ANSWER_SEC = 15;        // 答える時間（15カウント）
  const INPUT_DELAY_MS = 300;   // 早押ししてから入力欄が出るまで
  const REVEAL_MS = 3000;       // 正かいを見せる時間
  const MISS_MS = 1800;         // 「ざんねん」を見せてから続きを読む
  const ROOM_LIFE_MS = 3 * 60 * 60 * 1000; // 3時間たった部屋は消す
  const STAMP_SHOW_MS = 2000;
  const STAMP_COOLDOWN_MS = 2000;
  const BACKUP_GRACE_MS = 2500; // ホストがおくれたとき、ほかの人が代わりに進めるまで

  const SPEEDS = [
    { key: 'slow', label: 'ゆっくり', ms: 250 },
    { key: 'normal', label: 'ふつう', ms: 150 },
    { key: 'fast', label: 'はやい', ms: 80 },
  ];
  const STAMPS = ['よろしく！', 'すごい！', 'くやしい〜', 'ドンマイ！', 'つぎは負けない！', 'やったー！', 'えっ！？', '😆'];
  const DEFAULT_SETTINGS = { subject: 'all', target: 5, speed: 'normal' };
  const LAST_ROOM_KEY = 'hayaoshi5.lastRoom';

  let db = null;
  let uid = null;
  let offset = 0;        // サーバーの時刻とのずれ
  let started = false;   // Firebase の見はりを始めたか

  let code = null;       // いまいる部屋
  let roomRef = null;
  let room = null;       // 部屋の最新のようす
  let enteredAt = 0;
  let loop = null;
  let reader = null;

  const questionMap = {};
  const loadingSubjects = {};

  // 画面の小さな記録（音や演出を1回だけ鳴らすため など）
  let view = resetView();
  function resetView() {
    return {
      screen: null, index: null, stage: null, once: {}, lastCount: null,
      pending: null, inputLockedUntil: 0, sentFor: null, game: null, resultGame: null,
    };
  }
  let hostBusy = false;
  let lastCompositionEnd = 0;
  let stampCoolUntil = 0;
  const bubbles = {};    // uid → { text, until }
  const cards = {};      // 画面ごとのキャラカード

  // ---------- 時刻・小さな道具 ----------
  function now() { return Date.now() + offset; }
  function speedMs() {
    const s = SPEEDS.find((x) => x.key === (room && room.settings && room.settings.speed));
    return (s || SPEEDS[1]).ms;
  }
  function playersList(r) {
    const ps = (r || room || {}).players || {};
    return Object.keys(ps).map((k) => Object.assign({ uid: k }, ps[k])).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
  }
  function onlineList(r) { return playersList(r).filter((p) => p.online); }
  function playerName(id) {
    const p = room && room.players && room.players[id];
    return p ? p.name : '？';
  }
  function isHost() { return !!(room && room.hostUid === uid); }
  function activeScreen() {
    const s = document.querySelector('.screen.active');
    return s ? s.id : null;
  }
  function go(screenId) {
    if (activeScreen() !== screenId) window.App.show(screenId);
  }
  function once(key) {
    if (view.once[key]) return false;
    view.once[key] = true;
    return true;
  }
  function meProfile(t) {
    return {
      name: Profile.name(),
      avatar: Profile.rankingAvatar(),
      score: 0, correct: 0, buzzSum: 0, buzzCount: 0,
      joinedAt: t,
      online: true,
    };
  }
  function isDead(r, t) {
    if (!r) return true;
    if (t - (r.createdAt || 0) > ROOM_LIFE_MS) return true;
    const anyOnline = Object.values(r.players || {}).some((p) => p && p.online);
    return !anyOnline && t - (r.createdAt || 0) > 60 * 1000;
  }
  function inc(n) { return firebase.database.ServerValue.increment(n); }

  // ---------- はじめの準備 ----------
  function ensureStarted() {
    if (started) return;
    started = true;
    db = Store.db();
    uid = Store.uid();
    db.ref('.info/serverTimeOffset').on('value', (s) => { offset = Number(s.val()) || 0; });
    // 回線がもどったら「オンライン」に書きなおす
    db.ref('.info/connected').on('value', (s) => {
      if (s.val() === true && roomRef && room && room.players && room.players[uid]) setPresence();
    });
  }

  function setPresence() {
    if (!roomRef) return;
    const me = roomRef.child('players/' + uid);
    me.child('online').onDisconnect().set(false);
    me.child('online').set(true).catch(() => {});
  }

  function ensureQuestions(subject) {
    if (!subject || loadingSubjects[subject]) return loadingSubjects[subject];
    loadingSubjects[subject] = Questions.load(subject).then((list) => {
      list.forEach((q) => { questionMap[q.id] = q; });
      return list;
    }).catch((e) => {
      delete loadingSubjects[subject];
      throw e;
    });
    return loadingSubjects[subject];
  }

  // ---------- 部屋さがし ----------
  function openLobby() {
    ensureStarted();
    $('lobby-error').hidden = true;
    let last = '';
    try { last = localStorage.getItem(LAST_ROOM_KEY) || ''; } catch (e) { /* 何もしない */ }
    $('room-code-input').value = last;
    window.App.show('screen-lobby');
  }

  function lobbyError(msg) {
    $('lobby-error').textContent = msg;
    $('lobby-error').hidden = false;
    Effects.shake($('lobby-error'));
    Sound.play('wrong');
  }

  function setLobbyBusy(busy) {
    $('btn-room-create').disabled = busy;
    $('btn-room-join').disabled = busy;
  }

  // 古い部屋・だれもいない部屋をおそうじ
  // 作ってから3時間たった部屋をおそうじ
  // （ルールで、部屋の一覧は「3時間より前に作った部屋」しか読めないようにしてある。少しだけ余裕をもたせる）
  async function cleanupRooms() {
    try {
      const snap = await db.ref('rooms').orderByChild('createdAt').endAt(now() - ROOM_LIFE_MS - 120000).get();
      const del = {};
      Object.keys(snap.val() || {}).forEach((c) => { del[c] = null; });
      if (Object.keys(del).length) await db.ref('rooms').update(del);
    } catch (e) { /* そうじできなくても部屋は作れる */ }
  }

  async function createRoom() {
    Keys.focus(); // ボタンをおしたこの場で、見えない入力欄にカーソルを入れておく（iPad のキーボード用）
    Sound.play('tap');
    setLobbyBusy(true);
    $('lobby-error').hidden = true;
    try {
      await cleanupRooms();
      for (let i = 0; i < 20; i++) {
        const c = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        const ref = db.ref('rooms/' + c);
        const t = now();
        const res = await ref.transaction((cur) => {
          if (cur && !isDead(cur, t)) return; // 使われている
          return {
            hostUid: uid,
            createdAt: t,
            status: 'waiting',
            game: 0,
            settings: Object.assign({}, DEFAULT_SETTINGS),
            players: { [uid]: meProfile(t) },
          };
        });
        if (res.committed) {
          enter(c);
          return;
        }
      }
      lobbyError('部屋を 作れませんでした。もう一度 おしてね');
    } catch (e) {
      lobbyError('つながりませんでした。インターネットを たしかめてね');
    } finally {
      setLobbyBusy(false);
    }
  }

  async function joinRoom() {
    const c = $('room-code-input').value.normalize('NFKC').replace(/\D/g, '');
    if (c.length !== 4) { lobbyError('4けたの 数字を 入れてね'); return; }
    Keys.focus(); // ボタンをおしたこの場で、見えない入力欄にカーソルを入れておく（iPad のキーボード用）
    Sound.play('tap');
    setLobbyBusy(true);
    $('lobby-error').hidden = true;
    let reason = null;
    try {
      const ref = db.ref('rooms/' + c);
      const res = await ref.transaction((cur) => {
        reason = null;
        if (cur === null) return null; // サーバーで たしかめてもらう
        const t = now();
        if (isDead(cur, t)) { reason = 'none'; return; }
        const players = cur.players || {};
        const mine = players[uid];
        const online = Object.keys(players).filter((k) => players[k] && players[k].online && k !== uid).length;
        if (!mine) {
          if (cur.status !== 'waiting') { reason = 'playing'; return; }
          if (online >= MAX_PLAYERS) { reason = 'full'; return; }
          players[uid] = meProfile(t);
        } else {
          // 前に入っていた部屋に もどる（とちゅうで回線が切れたとき など）
          if (!mine.online && online >= MAX_PLAYERS) { reason = 'full'; return; }
          mine.online = true;
          mine.name = Profile.name();
          mine.avatar = Profile.rankingAvatar();
        }
        cur.players = players;
        return cur;
      });
      if (res.committed && res.snapshot.val()) {
        enter(c);
        return;
      }
      if (reason === 'full') lobbyError('その部屋は 満員です（5人まで）');
      else if (reason === 'playing') lobbyError('その部屋は もう 始まっているよ');
      else lobbyError('その部屋は 見つからないよ。数字を たしかめてね');
    } catch (e) {
      lobbyError('つながりませんでした。インターネットを たしかめてね');
    } finally {
      setLobbyBusy(false);
    }
  }

  // ---------- 部屋に入る・出る ----------
  function enter(c) {
    detach(true); // 見えない入力欄のカーソルはそのまま（このあと試合が始まっても、キーで早押しできるように）
    code = c;
    try { localStorage.setItem(LAST_ROOM_KEY, c); } catch (e) { /* 何もしない */ }
    roomRef = db.ref('rooms/' + c);
    room = null;
    view = resetView();
    enteredAt = now();
    Object.keys(bubbles).forEach((k) => delete bubbles[k]);
    setPresence();
    roomRef.on('value', onRoomValue);
    roomRef.child('stamps').on('child_added', onStamp);
    loop = setInterval(tick, 50);
    $('room-code').textContent = c;
    Sound.play('correct');
  }

  function detach(keepKeys) {
    if (roomRef) {
      roomRef.off();
      roomRef.child('stamps').off();
      roomRef.child('players/' + uid + '/online').onDisconnect().cancel();
    }
    if (loop) clearInterval(loop);
    loop = null;
    roomRef = null;
    room = null;
    code = null;
    $('b-answer-input').blur();
    if (!keepKeys) Keys.blur();
    document.getElementById('app').classList.remove('is-playing');
  }

  async function leave() {
    const ref = roomRef;
    detach();
    if (ref) {
      try {
        const res = await ref.transaction((cur) => {
          if (!cur) return cur;
          if (cur.players) delete cur.players[uid];
          const rest = Object.keys(cur.players || {}).map((k) => Object.assign({ uid: k }, cur.players[k]));
          const online = rest.filter((p) => p.online);
          if (!online.length) {
            // だれもいなくなった → まず中の人を全部外す（ルールで、人がいる部屋は消せないようにしてあるため）
            delete cur.players;
            return cur;
          }
          if (cur.hostUid === uid) {
            online.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
            cur.hostUid = online[0].uid;
          }
          return cur;
        });
        const v = res.snapshot.val();
        if (v && !v.players) await ref.remove(); // だれもいない部屋を消す
      } catch (e) { /* ぬけられなくても、回線が切れれば オフラインになる */ }
    }
    window.App.show('screen-menu');
  }

  function kicked(msg) {
    detach();
    window.App.show('screen-menu');
    setTimeout(() => alert(msg), 50);
  }

  // ---------- 部屋のようすが変わったとき ----------
  function onRoomValue(snap) {
    const v = snap.val();
    if (!v) {
      if (code) kicked('部屋が なくなりました');
      return;
    }
    if (!v.players || !v.players[uid]) {
      if (code) kicked('部屋から 出ました');
      return;
    }
    room = v;
    checkHost();

    if (room.settings) ensureQuestions(room.settings.subject);

    if (room.status === 'waiting') {
      go('screen-room');
      document.getElementById('app').classList.remove('is-playing');
      renderRoom();
    } else if (room.status === 'playing') {
      if (view.game !== room.game) {
        // 新しい試合
        view.game = room.game;
        view.index = null;
        view.once = {};
        view.pending = null;
        view.sentFor = null;
      }
      go('screen-battle');
      document.getElementById('app').classList.add('is-playing');
    } else if (room.status === 'finished') {
      go('screen-bresult');
      document.getElementById('app').classList.remove('is-playing');
      if (document.activeElement === $('b-answer-input')) Keys.focus();
      renderResult();
    }
    renderCards();
  }

  // ホストがいなくなったら、次に入った人がホストになる
  function checkHost() {
    const host = room.players && room.players[room.hostUid];
    if (host && host.online) return;
    const cands = onlineList();
    if (!cands.length || cands[0].uid !== uid) return;
    const old = room.hostUid;
    roomRef.child('hostUid').transaction((h) => (h === old ? uid : undefined)).catch(() => {});
  }

  // ---------- 待機室 ----------
  function buildSettings() {
    const subj = $('set-subject');
    subj.innerHTML = '';
    Questions.SUBJECTS.forEach((s) => {
      const b = document.createElement('button');
      b.className = 'set-opt';
      b.dataset.key = s.key;
      b.style.setProperty('--c', s.color);
      b.textContent = s.label;
      b.addEventListener('click', () => changeSetting({ subject: s.key }));
      subj.appendChild(b);
    });
    const sp = $('set-speed');
    sp.innerHTML = '';
    SPEEDS.forEach((s) => {
      const b = document.createElement('button');
      b.className = 'set-opt';
      b.dataset.key = s.key;
      b.style.setProperty('--c', '#8c6bff');
      b.innerHTML = '<span></span><small></small>';
      b.querySelector('span').textContent = s.label;
      b.querySelector('small').textContent = '1文字 ' + (s.ms / 1000) + '秒';
      b.addEventListener('click', () => changeSetting({ speed: s.key }));
      sp.appendChild(b);
    });
  }

  function changeSetting(values) {
    if (!isHost() || !room || room.status !== 'waiting') return;
    Sound.play('tap');
    roomRef.child('settings').update(values).catch(() => {});
  }

  function renderRoom() {
    const st = room.settings || DEFAULT_SETTINGS;
    const host = isHost();
    $('set-subject').querySelectorAll('.set-opt').forEach((b) => {
      b.classList.toggle('active', b.dataset.key === st.subject);
      b.disabled = !host;
    });
    $('set-speed').querySelectorAll('.set-opt').forEach((b) => {
      b.classList.toggle('active', b.dataset.key === st.speed);
      b.disabled = !host;
    });
    $('set-target').textContent = st.target;
    $('set-target-minus').disabled = !host || st.target <= 3;
    $('set-target-plus').disabled = !host || st.target >= 10;
    document.querySelector('.room-settings').classList.toggle('readonly', !host);

    const n = onlineList().length;
    const start = $('btn-room-start');
    start.hidden = !host;
    start.disabled = n < 2;
    let msg;
    if (!host) msg = '設定は ホストが きめるよ。スタートを まってね';
    else if (n < 2) msg = '部屋コードを みんなに 教えてね。2人 そろったら スタートできるよ';
    else msg = 'みんな そろったら「スタート！」を おしてね';
    $('room-wait').textContent = msg;
  }

  async function startGame() {
    if (!isHost() || !room) return;
    Keys.focus();
    Sound.play('tap');
    const btns = [$('btn-room-start'), $('btn-br-again')];
    btns.forEach((b) => { b.disabled = true; });
    try {
      const subject = (room.settings || DEFAULT_SETTINGS).subject;
      const list = await ensureQuestions(subject);
      const qids = Questions.pick(list, list.length).map((q) => q.id);
      const t = now();
      await roomRef.transaction((cur) => {
        if (!cur || cur.hostUid !== uid || cur.status === 'playing') return;
        const players = {};
        Object.keys(cur.players || {}).forEach((k) => {
          const p = cur.players[k];
          if (!p || !p.online) return; // いない人は外す
          players[k] = Object.assign({}, p, { score: 0, correct: 0, buzzSum: 0, buzzCount: 0 });
        });
        if (Object.keys(players).length < 2) return;
        cur.players = players;
        cur.status = 'playing';
        cur.game = (cur.game || 0) + 1;
        cur.qids = qids;
        cur.current = { index: 0, questionId: qids[0], phase: 'reading', startAt: t + FIRST_INTRO_MS, fromChar: 0 };
        delete cur.finishedAt;
        delete cur.stamps;
        return cur;
      });
    } catch (e) {
      alert('スタートできませんでした。もう一度 おしてね');
    } finally {
      btns.forEach((b) => { b.disabled = false; });
      if (room && room.status === 'waiting') renderRoom();
    }
  }

  // ---------- キャラカード（待機室・対戦・結果） ----------
  function cardHtml() {
    return '<div class="pc-bubble" hidden></div>' +
      '<div class="avatar-badge pc-avatar"></div>' +
      '<div class="pc-body"><div class="pc-name"></div><div class="pc-tag"></div></div>' +
      '<div class="pc-score"><b></b><small></small></div>';
  }

  function syncCards(containerId, list, decorate) {
    const wrap = $(containerId);
    const map = cards[containerId] || (cards[containerId] = {});
    const ids = list.map((p) => p.uid);
    Object.keys(map).forEach((id) => {
      if (!ids.includes(id)) { map[id].el.remove(); delete map[id]; }
    });
    list.forEach((p, i) => {
      let c = map[p.uid];
      if (!c) {
        const el = document.createElement('div');
        el.className = 'pcard';
        el.dataset.uid = p.uid;
        el.innerHTML = cardHtml();
        c = map[p.uid] = { el, avatarKey: null, score: null };
      }
      if (wrap.children[i] !== c.el) wrap.insertBefore(c.el, wrap.children[i] || null);
      const aKey = JSON.stringify(p.avatar || null);
      if (c.avatarKey !== aKey) {
        c.avatarKey = aKey;
        c.el.querySelector('.pc-avatar').innerHTML = Avatar.render(p.avatar || Avatar.DEFAULT);
      }
      c.el.querySelector('.pc-name').textContent = p.name || '？';
      c.el.classList.toggle('me', p.uid === uid);
      c.el.classList.toggle('offline', !p.online);
      decorate(c, p);
    });
  }

  function renderCards() {
    if (!room) return;
    const scr = activeScreen();
    if (scr === 'screen-room') {
      const list = onlineList();
      syncCards('room-players', list, (c, p) => {
        const tags = [];
        if (p.uid === room.hostUid) tags.push('👑 ホスト');
        if (p.uid === uid) tags.push('あなた');
        c.el.querySelector('.pc-tag').textContent = tags.join('・');
        c.el.querySelector('.pc-score').hidden = true;
      });
      // あいている席
      const wrap = $('room-players');
      wrap.querySelectorAll('.pcard-empty').forEach((e) => e.remove());
      for (let i = list.length; i < MAX_PLAYERS; i++) {
        const e = document.createElement('div');
        e.className = 'pcard pcard-empty';
        e.innerHTML = '<div class="avatar-badge pc-avatar"><span>？</span></div><div class="pc-body"><div class="pc-name">まってるよ…</div></div>';
        wrap.appendChild(e);
      }
    } else if (scr === 'screen-battle') {
      const cur = room.current || {};
      const target = (room.settings || DEFAULT_SETTINGS).target;
      syncCards('b-players', playersList(), (c, p) => {
        const locked = !!(cur.lockedOut && cur.lockedOut[p.uid]);
        const buzzing = cur.phase === 'answering' && cur.buzzer && cur.buzzer.uid === p.uid;
        c.el.classList.toggle('locked', locked && !buzzing);
        c.el.classList.toggle('buzzing', !!buzzing);
        c.el.querySelector('.pc-tag').textContent = !p.online ? 'お休み中' : locked ? 'この問題は おしまい' : '';
        const sc = c.el.querySelector('.pc-score');
        sc.hidden = false;
        sc.querySelector('b').textContent = p.score || 0;
        sc.querySelector('small').textContent = '/' + target;
        if (c.score != null && (p.score || 0) > c.score) {
          sc.classList.remove('bump');
          void sc.offsetWidth;
          sc.classList.add('bump');
        }
        c.score = p.score || 0;
      });
    }
  }

  // ---------- スタンプ ----------
  let stampBar = null;
  function buildStampBar() {
    stampBar = document.createElement('div');
    stampBar.className = 'stamp-bar';
    STAMPS.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'stamp-btn';
      b.textContent = t;
      b.addEventListener('click', () => sendStamp(i));
      stampBar.appendChild(b);
    });
  }

  function placeStampBar(screenId, enabled) {
    const slot = document.querySelector('#' + screenId + ' .stamp-slot');
    if (slot && stampBar.parentElement !== slot) slot.appendChild(stampBar);
    const cooling = performance.now() < stampCoolUntil;
    stampBar.classList.toggle('off', !enabled);
    stampBar.classList.toggle('cooling', cooling);
    stampBar.querySelectorAll('button').forEach((b) => { b.disabled = !enabled || cooling; });
  }

  function stampAllowed() {
    if (!room) return false;
    if (room.status !== 'playing') return true;
    const cur = room.current;
    if (!cur) return true;
    if (cur.phase === 'reveal') return true;
    // 「第○問」が出ているあいだ（問題と問題の間）
    return cur.phase === 'reading' && cur.fromChar === 0 && !cur.miss && now() < cur.startAt;
  }

  function sendStamp(i) {
    if (!roomRef || !stampAllowed() || performance.now() < stampCoolUntil) return;
    stampCoolUntil = performance.now() + STAMP_COOLDOWN_MS;
    roomRef.child('stamps').push({ uid, stampId: i, at: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
  }

  function onStamp(snap) {
    const v = snap.val();
    if (!v || typeof v.stampId !== 'number') return;
    if ((v.at || 0) < enteredAt - 3000) return; // 入る前のスタンプは出さない
    bubbles[v.uid] = { text: STAMPS[v.stampId] || '', until: performance.now() + STAMP_SHOW_MS };
    Sound.play('tap');
  }

  function renderBubbles() {
    const scr = document.querySelector('.screen.active');
    if (!scr) return;
    const t = performance.now();
    scr.querySelectorAll('.pcard[data-uid]').forEach((el) => {
      const b = bubbles[el.dataset.uid];
      const bubble = el.querySelector('.pc-bubble');
      if (!bubble) return;
      const on = b && b.until > t;
      if (on) {
        if (bubble.textContent !== b.text || bubble.hidden) {
          bubble.textContent = b.text;
          bubble.hidden = false;
          bubble.classList.remove('pop');
          void bubble.offsetWidth;
          bubble.classList.add('pop');
        }
      } else if (!bubble.hidden) {
        bubble.hidden = true;
        bubble.textContent = '';
      }
    });
  }

  // ---------- 毎フレーム（0.05秒ごと） ----------
  function tick() {
    if (!room) return;
    const scr = activeScreen();
    if (scr === 'screen-battle' && room.status === 'playing') {
      renderGame();
      placeStampBar('screen-battle', stampAllowed());
    } else if (scr === 'screen-room') {
      placeStampBar('screen-room', true);
    } else if (scr === 'screen-bresult') {
      placeStampBar('screen-bresult', true);
    }
    renderBubbles();
    // ホストの iPad が止まっていても（画面が消えた など）試合が止まらないように、
    // ほかの人も少しおくれて同じ仕事をする（同じことを2回しないしくみになっている）
    hostTick(isHost() ? 0 : BACKUP_GRACE_MS);
  }

  function shownChars(cur, q, t) {
    const len = q.question.length;
    if (cur.phase === 'answering' && cur.buzzer) return cur.buzzer.charIndex;
    if (cur.phase === 'reveal') return len;
    const e = t - cur.startAt;
    if (e < 0) return Math.min(len, cur.fromChar || 0);
    return Math.min(len, (cur.fromChar || 0) + Math.floor(e / speedMs()) + 1);
  }
  function fullAt(cur, q) {
    const left = q.question.length - (cur.fromChar || 0) - 1;
    return cur.startAt + Math.max(0, left) * speedMs();
  }

  function showStage(name) {
    if (view.stage === name) return;
    view.stage = name;
    ['buzz', 'answer', 'reveal'].forEach((n) => { $('b-stage-' + n).hidden = n !== name; });
  }

  function renderGame() {
    const cur = room.current;
    const t = now();
    const subj = Questions.getSubject((room.settings || DEFAULT_SETTINGS).subject);
    $('b-subject').textContent = subj.label;
    $('b-subject').style.background = subj.color;
    $('b-target').textContent = (room.settings || DEFAULT_SETTINGS).target + '問 先取';
    if (!cur) return;
    const q = questionMap[cur.questionId];
    $('b-count').textContent = '第' + (cur.index + 1) + '問';
    if (!q) {
      $('b-q-text').textContent = '問題を 読みこみ中…';
      return;
    }

    // 新しい問題
    if (view.index !== cur.index) {
      view.index = cur.index;
      view.lastCount = null;
      view.pending = null;
      view.sentFor = null;
      reader.setText(q.question, speedMs());
      Keys.focus();
      $('b-answer-input').value = '';
      if (cur.index === 0) Sound.play('fanfare');
    }

    const myLocked = !!(cur.lockedOut && cur.lockedOut[uid]);
    const key = cur.index + ':';
    if (view.pending === 'won' && !(cur.phase === 'answering' && cur.buzzer && cur.buzzer.uid === uid)) view.pending = null;

    if (cur.phase === 'reading') {
      reader.showChars(shownChars(cur, q, t));
      const before = t < cur.startAt;
      // 「第○問」
      const intro = before && !cur.fromChar && !cur.miss;
      $('b-intro').hidden = !intro;
      if (intro) {
        $('b-intro-text').textContent = '第' + (cur.index + 1) + '問';
        if (cur.index > 0 && once(key + 'intro')) Sound.play('intro');
      }

      if (before && cur.miss) {
        // 「ざんねん」を見せてから続きを読む
        showMiss(cur);
      } else if (view.pending && view.pending.index === cur.index) {
        // 早押しの返事を待っているあいだ（自分が押した画面のまま）
      } else {
        showStage('buzz');
        const can = !before && !myLocked;
        $('b-btn-buzz').disabled = !can;
        $('b-buzz-hint').innerHTML = myLocked
          ? 'この問題は もう おせないよ。ほかの人の 答えを まとう'
          : 'キーボードの <kbd>Enter</kbd> か <kbd>スペース</kbd> でも おせるよ';
        Keys.focus(); // 問題の間は、見えない入力欄で Enter・スペースを受けとる
      }

      // 全文が出たら 5秒の時計
      const fa = fullAt(cur, q);
      const bar = $('b-full-timer');
      if (!before && t >= fa) {
        bar.hidden = false;
        const p = Math.max(0, 1 - (t - fa) / AFTER_FULL_MS);
        bar.firstElementChild.style.transform = 'scaleX(' + p + ')';
      } else {
        bar.hidden = true;
      }
    } else if (cur.phase === 'answering' && cur.buzzer) {
      $('b-intro').hidden = true;
      $('b-full-timer').hidden = true;
      reader.showChars(cur.buzzer.charIndex);
      const mine = cur.buzzer.uid === uid;
      if (once(key + 'buzz:' + cur.buzzer.uid + ':' + cur.buzzer.at)) {
        if (!(mine && view.pending)) { // 自分が押したときは、押した瞬間に鳴らしている
          Sound.play('buzz');
          Effects.flash();
        }
      }
      showAnswerStage(cur.buzzer.uid);
      // 15カウント
      const left = cur.buzzer.deadline - t;
      const count = Math.max(0, Math.min(ANSWER_SEC, Math.ceil(left / 1000)));
      $('b-countdown-wrap').style.setProperty('--p', Math.max(0, Math.min(1, left / (ANSWER_SEC * 1000))));
      if (count !== view.lastCount) {
        view.lastCount = count;
        const el = $('b-countdown');
        el.textContent = count;
        el.classList.toggle('danger', count <= 3);
        $('b-countdown-wrap').classList.toggle('danger', count <= 3);
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
        if (count > 0 && count <= 3) Sound.play('beep');
      }
      // 自分の番で時間切れ
      if (mine && left <= 0 && view.sentFor !== cur.index + ':' + cur.buzzer.at) {
        view.sentFor = cur.index + ':' + cur.buzzer.at;
        judge(uid, cur, '', false);
      }
    } else if (cur.phase === 'reveal') {
      $('b-intro').hidden = true;
      $('b-full-timer').hidden = true;
      reader.showAll();
      showReveal(cur, q);
      view.lastCount = null;
      if (document.activeElement === $('b-answer-input')) Keys.focus();
    }
  }

  function showAnswerStage(buzzUid) {
    const mine = buzzUid === uid;
    showStage('answer');
    const p = room.players[buzzUid] || {};
    const aKey = buzzUid + JSON.stringify(p.avatar || null);
    if (view.spotKey !== aKey) {
      view.spotKey = aKey;
      $('b-spot-avatar').innerHTML = Avatar.render(p.avatar || Avatar.DEFAULT);
    }
    $('b-spot-name').textContent = (mine ? 'あなた' : (p.name || '？') + 'さん') + 'が おした！';
    $('b-answer-box').hidden = !mine;
    $('b-answer-hint').hidden = !mine || !!view.warn;
    $('b-answer-warn').hidden = !mine || !view.warn;
    $('b-watch-text').hidden = mine;
    if (!mine) $('b-watch-text').textContent = (p.name || '？') + 'さんが 答えているよ…';
    const locked = performance.now() < view.inputLockedUntil;
    $('b-answer-box').classList.toggle('waiting', mine && locked);
  }

  function setRevealKind(kind) {
    const el = $('b-stage-reveal');
    el.classList.remove('is-correct', 'is-wrong', 'is-timeup');
    el.classList.add(kind);
  }

  function showMiss(cur) {
    const m = cur.miss;
    showStage('reveal');
    setRevealKind('is-wrong');
    const mine = m.uid === uid;
    $('b-reveal-mark').textContent = '×';
    $('b-reveal-title').textContent = 'ざんねん…';
    $('b-reveal-answer-row').hidden = true;
    const who = mine ? 'あなた' : playerName(m.uid) + 'さん';
    $('b-reveal-who').textContent = m.input ? who + 'の答え：' + m.input : who + 'は 時間切れ';
    if (once(cur.index + ':miss:' + m.uid + ':' + m.charIndex)) {
      Sound.play('wrong');
      Effects.shake($('b-stage-reveal'));
    }
  }

  function showReveal(cur, q) {
    const r = cur.result || { kind: 'timeup' };
    showStage('reveal');
    $('b-reveal-answer-row').hidden = false;
    $('b-reveal-answer').textContent = q.answer;
    const first = once(cur.index + ':reveal');
    if (r.kind === 'correct') {
      const mine = r.uid === uid;
      setRevealKind('is-correct');
      $('b-reveal-mark').textContent = '○';
      $('b-reveal-title').textContent = mine ? '正かい！' : playerName(r.uid) + 'さん 正かい！';
      $('b-reveal-who').textContent = q.question.length + '文字中 ' + r.charIndex + '文字目で おして ＋1点';
      if (first) {
        Sound.play('correct');
        Effects.confetti(mine ? 90 : 40);
      }
    } else if (r.kind === 'allwrong') {
      setRevealKind('is-wrong');
      $('b-reveal-mark').textContent = '×';
      $('b-reveal-title').textContent = 'みんな ざんねん…';
      const who = r.uid === uid ? 'あなた' : playerName(r.uid) + 'さん';
      $('b-reveal-who').textContent = r.input ? who + 'の答え：' + r.input : '';
      if (first) {
        Sound.play('wrong');
        Effects.shake($('b-stage-reveal'));
      }
    } else {
      setRevealKind('is-timeup');
      $('b-reveal-mark').textContent = '…';
      $('b-reveal-title').textContent = '時間切れ';
      $('b-reveal-who').textContent = cur.lockedOut ? '' : 'だれも おさなかったよ';
      if (first) Sound.play('timeup');
    }
  }

  // ---------- 早押し ----------
  function tryBuzz() {
    if (!room || room.status !== 'playing' || activeScreen() !== 'screen-battle') return;
    const cur = room.current;
    if (!cur || cur.phase !== 'reading') return;
    const t = now();
    if (t < cur.startAt) return;
    if (cur.lockedOut && cur.lockedOut[uid]) return;
    if (view.pending) return;
    const q = questionMap[cur.questionId];
    if (!q) return;
    const charIndex = Math.max(1, shownChars(cur, q, t));
    const index = cur.index;
    view.pending = { index };

    // 押した人の画面は、すぐ「答える」にする（iPad はこの場でカーソルを入れないとキーボードが出ない）
    Sound.play('buzz');
    Effects.flash();
    view.inputLockedUntil = performance.now() + INPUT_DELAY_MS;
    showStage('answer');
    const p = room.players[uid] || {};
    view.spotKey = null;
    $('b-spot-avatar').innerHTML = Avatar.render(p.avatar || Avatar.DEFAULT);
    $('b-spot-name').textContent = 'あなたが おした！';
    $('b-answer-box').hidden = false;
    setWarn(false);
    $('b-watch-text').hidden = true;
    $('b-answer-box').classList.add('waiting');
    $('b-countdown').textContent = ANSWER_SEC;
    $('b-countdown').classList.remove('danger');
    $('b-countdown-wrap').classList.remove('danger');
    $('b-countdown-wrap').style.setProperty('--p', 1);
    $('b-answer-input').value = '';
    focusInput();

    roomRef.child('current').transaction((c) => {
      if (!c || c.index !== index || c.phase !== 'reading' || c.buzzer) return;
      if (c.lockedOut && c.lockedOut[uid]) return;
      const tt = now();
      if (tt < c.startAt) return;
      c.phase = 'answering';
      c.buzzer = {
        uid,
        charIndex: Math.max(c.fromChar || 0, charIndex),
        at: tt,
        deadline: tt + INPUT_DELAY_MS + ANSWER_SEC * 1000,
      };
      delete c.miss;
      return c;
    }).then((res) => {
      const v = res.snapshot.val();
      const won = res.committed && v && v.buzzer && v.buzzer.uid === uid;
      if (won) {
        view.pending = 'won';
        roomRef.child('players/' + uid).update({ buzzSum: inc(v.buzzer.charIndex), buzzCount: inc(1) }).catch(() => {});
        setTimeout(() => {
          $('b-answer-box').classList.remove('waiting');
          $('b-answer-input').value = '';
          focusInput();
        }, Math.max(0, view.inputLockedUntil - performance.now()));
      } else {
        // ほかの人が先だった
        view.pending = null;
        view.stage = null;
        Keys.focus();
      }
    }).catch(() => {
      view.pending = null;
      view.stage = null;
      Keys.focus();
    });
  }

  function setWarn(on) {
    view.warn = on;
    $('b-answer-warn').hidden = !on;
    $('b-answer-hint').hidden = on || $('b-answer-box').hidden;
  }

  function focusInput() {
    const input = $('b-answer-input');
    if (document.activeElement === input) return;
    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
  }

  function sendAnswer() {
    const cur = room && room.current;
    if (!cur || cur.phase !== 'answering' || !cur.buzzer || cur.buzzer.uid !== uid) return;
    if (performance.now() < view.inputLockedUntil) return;
    const k = cur.index + ':' + cur.buzzer.at;
    if (view.sentFor === k) return;
    let value = $('b-answer-input').value;
    if (window.wanakana) {
      // カタカナの「ー」は母音にしない（「ペリー」が「ぺりい」にならないように）
      try { value = wanakana.toHiragana(value, { convertLongVowelMark: false }); } catch (e) { /* そのまま使う */ }
    }
    if (!Judge.normalizeAnswer(value)) return; // 空っぽは送らない
    const q = questionMap[cur.questionId];
    if (!q) return;
    const ok = Judge.isCorrect(value, q);
    // 漢字の答えも正解にしている。漢字が合っていないとき（変換で別の漢字になった など）は、
    // まちがいにせず「ひらがなで入れてね」と知らせる（15カウントはそのまま進む）
    if (!ok && Judge.hasKanji(value)) {
      setWarn(true);
      Effects.shake($('b-answer-box'));
      Sound.play('tap');
      focusInput();
      return;
    }
    view.sentFor = k;
    Keys.focus();
    judge(uid, cur, value.slice(0, 40), ok);
  }

  // 答えの結果を書きこむ（答えた人の端末。答えた人がいなくなったときはホストが「ざんねん」にする）
  function judge(answerUid, curSeen, input, ok) {
    const index = curSeen.index;
    const at = curSeen.buzzer.at;
    const online = onlineList().map((p) => p.uid);
    return roomRef.child('current').transaction((c) => {
      if (!c || c.index !== index || c.phase !== 'answering' || !c.buzzer) return;
      if (c.buzzer.uid !== answerUid || c.buzzer.at !== at) return;
      const t = now();
      const charIndex = c.buzzer.charIndex;
      delete c.buzzer;
      delete c.miss;
      if (ok) {
        c.phase = 'reveal';
        c.revealAt = t;
        c.result = { kind: 'correct', uid: answerUid, input, charIndex };
        return c;
      }
      c.lockedOut = c.lockedOut || {};
      c.lockedOut[answerUid] = true;
      const left = online.filter((u) => !c.lockedOut[u]);
      if (!left.length) {
        c.phase = 'reveal';
        c.revealAt = t;
        c.result = { kind: 'allwrong', uid: answerUid, input, charIndex };
      } else {
        c.phase = 'reading';
        c.fromChar = charIndex;
        c.startAt = t + MISS_MS;
        c.miss = { uid: answerUid, input, charIndex };
      }
      return c;
    }).then((res) => {
      const v = res.snapshot.val();
      if (ok && res.committed && v && v.result && v.result.kind === 'correct' && v.result.uid === answerUid && answerUid === uid) {
        roomRef.child('players/' + uid).update({ score: inc(1), correct: inc(1) }).catch(() => {});
      }
    }).catch(() => {});
  }

  // ---------- ホストの仕事 ----------
  function hostTick(grace) {
    if (hostBusy || !room || room.status !== 'playing') return;
    const cur = room.current;
    const t = now() - grace;
    if (!cur) {
      if (!grace) hostRun(() => startQuestion(0, t + INTRO_MS));
      return;
    }
    const q = questionMap[cur.questionId];
    if (!q) return;

    if (cur.phase === 'reading') {
      if (t < cur.startAt) return;
      const online = onlineList().map((p) => p.uid);
      const allLocked = online.length > 0 && online.every((u) => cur.lockedOut && cur.lockedOut[u]);
      if (allLocked || t >= fullAt(cur, q) + AFTER_FULL_MS) {
        hostRun(() => roomRef.child('current').transaction((c) => {
          if (!c || c.index !== cur.index || c.phase !== 'reading' || c.buzzer) return;
          c.phase = 'reveal';
          c.revealAt = now();
          c.result = allLocked ? { kind: 'allwrong' } : { kind: 'timeup' };
          delete c.miss;
          return c;
        }));
      }
    } else if (cur.phase === 'answering' && cur.buzzer) {
      // 答える人の回線が切れて、15カウントが終わっても返事がないとき
      if (t > cur.buzzer.deadline + 2500) hostRun(() => judge(cur.buzzer.uid, cur, '', false));
    } else if (cur.phase === 'reveal') {
      if (t >= (cur.revealAt || 0) + REVEAL_MS) hostRun(() => nextOrFinish(cur.index));
    }
  }

  function hostRun(fn) {
    hostBusy = true;
    Promise.resolve().then(fn).catch(() => {}).then(() => { hostBusy = false; });
  }

  function startQuestion(index, startAt) {
    const qids = room.qids || [];
    if (index >= qids.length) return finishGame();
    // 古いスタンプをかたづける
    const del = {};
    const t = now();
    Object.keys(room.stamps || {}).forEach((k) => {
      if ((room.stamps[k].at || 0) < t - 10000) del[k] = null;
    });
    if (Object.keys(del).length) roomRef.child('stamps').update(del).catch(() => {});
    return roomRef.child('current').transaction((c) => {
      if (c && c.index >= index) return;
      return { index, questionId: qids[index], phase: 'reading', startAt, fromChar: 0 };
    });
  }

  function nextOrFinish(index) {
    const target = (room.settings || DEFAULT_SETTINGS).target;
    const done = playersList().some((p) => (p.score || 0) >= target);
    if (done || index + 1 >= (room.qids || []).length) return finishGame();
    return roomRef.child('current').transaction((c) => {
      if (!c || c.index !== index || c.phase !== 'reveal') return;
      return { index: index + 1, questionId: room.qids[index + 1], phase: 'reading', startAt: now() + INTRO_MS, fromChar: 0 };
    });
  }

  function finishGame() {
    return roomRef.transaction((r) => {
      if (!r || r.status !== 'playing') return;
      r.status = 'finished';
      r.finishedAt = now();
      return r;
    });
  }

  // ---------- 結果 ----------
  function renderResult() {
    const list = playersList().slice().sort((a, b) => (b.score || 0) - (a.score || 0) || (a.joinedAt || 0) - (b.joinedAt || 0));
    let rank = 0;
    let prev = null;
    list.forEach((p, i) => {
      if (p.score !== prev) rank = i + 1;
      prev = p.score;
      p.rank = rank;
    });

    syncCards('br-list', list, (c, p) => {
      c.el.classList.add('br-item');
      c.el.classList.toggle('top1', p.rank === 1);
      c.el.dataset.rank = p.rank;
      const avg = p.buzzCount ? Math.round((p.buzzSum / p.buzzCount) * 10) / 10 : null;
      c.el.querySelector('.pc-tag').textContent = (avg == null ? 'おしていないよ' : '平均 ' + avg + '文字目で おした') + (p.online ? '' : '（お休み中）');
      const sc = c.el.querySelector('.pc-score');
      sc.hidden = false;
      sc.querySelector('b').textContent = p.score || 0;
      sc.querySelector('small').textContent = '点';
    });
    $('br-list').querySelectorAll('.pcard').forEach((el) => {
      let no = el.querySelector('.br-rank');
      if (!no) {
        no = document.createElement('span');
        no.className = 'br-rank';
        el.insertBefore(no, el.firstChild);
      }
      no.textContent = el.dataset.rank + '位';
    });

    const top = list.filter((p) => p.rank === 1);
    const win = $('br-winner');
    const winKey = top.map((p) => p.uid).join(',') + ':' + room.game;
    if (win.dataset.key !== winKey) {
      win.dataset.key = winKey;
      win.innerHTML = '';
      const avatars = document.createElement('div');
      avatars.className = 'br-avatars';
      top.forEach((p) => {
        const a = document.createElement('div');
        a.className = 'avatar-badge br-avatar';
        a.innerHTML = Avatar.render(p.avatar || Avatar.DEFAULT);
        avatars.appendChild(a);
      });
      const title = document.createElement('div');
      title.className = 'br-title';
      const names = top.map((p) => (p.uid === uid ? 'あなた' : p.name + 'さん')).join('と ');
      title.textContent = !(top[0] && top[0].score)
        ? 'みんな 0点… 引き分け！'
        : top.length > 1 ? names + 'が 同点 優勝！' : names + 'の 優勝！';
      const crown = document.createElement('div');
      crown.className = 'br-crown';
      crown.textContent = '👑';
      win.appendChild(crown);
      win.appendChild(avatars);
      win.appendChild(title);
    }

    if (view.resultGame !== room.game) {
      view.resultGame = room.game;
      Sound.play('fanfare');
      const iWon = top.some((p) => p.uid === uid);
      Effects.confetti(iWon ? 120 : 60);
      if (iWon) setTimeout(() => { Sound.play('sparkle'); Effects.sparkle(win); }, 1200);
    }

    const host = isHost();
    $('btn-br-again').hidden = !host;
    const n = onlineList().length;
    $('btn-br-again').disabled = n < 2;
    $('br-wait').textContent = host
      ? (n < 2 ? 'ほかの人が いないので、もう一回は できないよ' : '「もう一回」で 同じメンバーで また 対戦！')
      : 'ホストが「もう一回」を おすと、また 始まるよ';
  }

  // ---------- 入力のしくみ ----------
  function setup() {
    reader = new QuestionReader($('b-q-text'));
    buildSettings();
    buildStampBar();

    $('btn-room-create').addEventListener('click', createRoom);
    $('btn-room-join').addEventListener('click', joinRoom);
    $('room-code-input').addEventListener('input', (e) => {
      const v = e.target.value.normalize('NFKC').replace(/\D/g, '').slice(0, 4);
      if (v !== e.target.value) e.target.value = v;
    });
    $('room-code-input').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      joinRoom();
    });
    $('btn-lobby-back').addEventListener('click', () => { Sound.play('tap'); window.App.show('screen-menu'); });

    $('set-target-minus').addEventListener('click', () => {
      if (room && room.settings) changeSetting({ target: Math.max(3, room.settings.target - 1) });
    });
    $('set-target-plus').addEventListener('click', () => {
      if (room && room.settings) changeSetting({ target: Math.min(10, room.settings.target + 1) });
    });
    $('btn-room-start').addEventListener('click', startGame);
    $('btn-br-again').addEventListener('click', startGame);
    $('btn-room-leave').addEventListener('click', () => { Sound.play('tap'); leave(); });
    $('btn-br-menu').addEventListener('click', () => { Sound.play('tap'); leave(); });
    $('btn-b-quit').addEventListener('click', () => {
      if (!confirm('対戦から ぬける？')) return;
      leave();
    });

    // 早押し（ボタン）
    const buzzBtn = $('b-btn-buzz');
    buzzBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); tryBuzz(); });
    buzzBtn.addEventListener('click', (e) => {
      e.preventDefault();
      tryBuzz();
      if (view.pending) focusInput();
    });

    // 画面をさわったら、見えない入力欄にカーソルを入れなおす（キーボードで早押しできるように）
    $('screen-battle').addEventListener('pointerdown', (e) => {
      const cur = room && room.current;
      const answering = cur && cur.phase === 'answering' && cur.buzzer && cur.buzzer.uid === uid;
      if (!answering && !view.pending && !e.target.closest('input')) Keys.focus();
    });

    // 早押しは Enter かスペースキー
    document.addEventListener('keydown', (e) => {
      if (!Keys.isBuzzKey(e)) return;
      if (activeScreen() !== 'screen-battle') return;
      if (e.target === $('b-answer-input')) return;
      e.preventDefault();
      if (e.repeat) return;
      tryBuzz();
    });

    // 答えの入力
    const input = $('b-answer-input');
    if (window.wanakana) {
      try { wanakana.bind(input, { IMEMode: 'toHiragana' }); } catch (e) { /* なくても入力できる */ }
    }
    input.addEventListener('compositionend', () => { lastCompositionEnd = performance.now(); });
    // 漢字のお知らせは、漢字を消したら引っこめる
    input.addEventListener('input', () => { if (view.warn && !Judge.hasKanji(input.value)) setWarn(false); });
    input.addEventListener('keydown', (e) => {
      // 早押ししてから0.3秒は、どのキーも受けつけない
      if (performance.now() < view.inputLockedUntil) { e.preventDefault(); e.stopPropagation(); return; }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      // 日本語入力の「変換の確定」の Enter では送らない
      if (e.isComposing || e.keyCode === 229) return;
      if (performance.now() - lastCompositionEnd < 80) return;
      if (e.repeat) return;
      sendAnswer();
    });
    $('b-btn-send').addEventListener('click', (e) => { e.preventDefault(); sendAnswer(); });
  }

  window.Battle = {
    setup, openLobby, leave, buzzKey: () => tryBuzz(),
    inRoom: () => !!code,
    // たしかめ用
    _debug: () => ({ code, uid, offset, room, view }),
  };
})();
