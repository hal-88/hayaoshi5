// 先生用画面：ランキング・プレイヤー・対戦の部屋を消す
(function () {
  const $ = (id) => document.getElementById(id);
  let db = null;
  let pane = 'ranking';
  let subject = 'kokugo';
  let players = {};
  let locks = {}; // あいことばが 決まっている名前

  function status(msg, isError) {
    const el = $('admin-status');
    el.textContent = msg || '';
    el.hidden = !msg;
    el.classList.toggle('error', !!isError);
  }

  function fmtDate(ms) {
    if (!ms) return '';
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, '0');
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function subjectLabel(key) {
    const s = Questions.getSubject(key);
    return s ? s.adminLabel || s.label : key;
  }

  // ---------- 先生のログイン ----------
  // 記録を消す・全員の名前を見る は、データベースのルールで「先生のアカウントだけ」にしてある。
  // この画面のログインは、その先生のアカウントでログインするためのもの。
  async function connect() {
    if (!Store.hasConfig()) throw new Error('Firebase の設定が まだです（js/firebase-config.js）');
    await Store.init({ anonymous: false }); // 先生用画面では、自動の匿名ログインをしない
    db = Store.db();
  }

  async function unlock() {
    const pw = $('pass-input').value;
    if (!pw) { showPassError('パスワードを 入れてください'); return; }
    $('btn-unlock').disabled = true;
    $('pass-error').hidden = true;
    status('ログインしています…');
    try {
      await connect();
      await Store.signInTeacher(pw);
    } catch (e) {
      $('btn-unlock').disabled = false;
      status('');
      const code = (e && e.code) || '';
      if (code === 'auth/operation-not-allowed') showPassError('Firebase で「メール/パスワード」のログインが まだ オンになっていません');
      else if (code === 'auth/too-many-requests') showPassError('何度も まちがえたので、しばらく ログインできません。時間をおいて ためしてください');
      else if (code.indexOf('auth/') === 0) showPassError('パスワードが ちがうか、先生のアカウントが まだ ありません');
      else showPassError('つながりませんでした：' + (e.message || e));
      return;
    }
    $('pass-input').value = '';
    openPanel();
  }

  function showPassError(msg) {
    $('pass-error').textContent = msg;
    $('pass-error').hidden = false;
  }

  function openPanel() {
    $('btn-unlock').disabled = false;
    status('');
    $('lock').hidden = true;
    $('panel').hidden = false;
    buildSubjects();
    showPane('ranking');
  }

  async function logout() {
    try { await Store.signOutTeacher(); } catch (e) { /* 何もしない */ }
    $('panel').hidden = true;
    $('lock').hidden = false;
    status('ログアウトしました');
  }

  // ---------- タブ ----------
  function showPane(name) {
    pane = name;
    document.querySelectorAll('.admin-tab').forEach((b) => b.classList.toggle('active', b.dataset.pane === name));
    ['ranking', 'players', 'rooms'].forEach((n) => { $('pane-' + n).hidden = n !== name; });
    reload();
  }

  function reload() {
    if (pane === 'ranking') loadRanking();
    else if (pane === 'players') loadPlayers();
    else loadRooms();
  }

  function rowHtml() {
    return '<span class="admin-no"></span><span class="avatar-badge admin-avatar"></span>' +
      '<span class="admin-main"><b class="admin-name"></b><small class="admin-meta"></small></span>' +
      '<span class="admin-value"></span><button class="btn btn-small btn-danger admin-del">消す</button>';
  }

  function makeRow(o) {
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = rowHtml();
    row.querySelector('.admin-no').textContent = o.no || '';
    if (!o.no) row.querySelector('.admin-no').remove();
    if (o.avatar) row.querySelector('.admin-avatar').innerHTML = Avatar.render(o.avatar);
    else row.querySelector('.admin-avatar').remove();
    row.querySelector('.admin-name').textContent = o.name;
    row.querySelector('.admin-meta').textContent = o.meta || '';
    row.querySelector('.admin-value').textContent = o.value || '';
    row.querySelector('.admin-del').addEventListener('click', o.onDelete);
    if (o.extra) {
      const b = document.createElement('button');
      b.className = 'btn btn-small admin-extra';
      b.textContent = o.extra.label;
      b.addEventListener('click', o.extra.onClick);
      row.querySelector('.admin-del').before(b);
    }
    return row;
  }

  function empty(el, msg) {
    el.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'admin-empty';
    p.textContent = msg;
    el.appendChild(p);
  }

  async function run(fn, doneMsg) {
    status('消しています…');
    try {
      await fn();
      status(doneMsg);
    } catch (e) {
      status('消せませんでした：' + (e.message || e), true);
    }
    reload();
  }

  // ---------- ランキング ----------
  function buildSubjects() {
    const wrap = $('rank-subjects');
    wrap.innerHTML = '';
    Questions.SUBJECTS.filter((s) => !s.battleOnly).concat(Questions.EXTRA).forEach((s) => { // 歴史イベントのランキングも消せるように
      const b = document.createElement('button');
      b.className = 'rank-tab';
      b.dataset.key = s.key;
      b.style.setProperty('--c', s.color);
      b.textContent = s.adminLabel || s.label;
      b.addEventListener('click', () => { subject = s.key; loadRanking(); });
      wrap.appendChild(b);
    });
  }

  async function loadRanking() {
    $('rank-subjects').querySelectorAll('.rank-tab').forEach((b) => b.classList.toggle('active', b.dataset.key === subject));
    const rows = $('rank-rows');
    empty(rows, '読みこみ中…');
    let list;
    try {
      const v = (await db.ref('rankings/' + subject).get()).val() || {};
      list = Object.keys(v).map((k) => Object.assign({ key: k }, v[k]))
        .sort((a, b) => (b.best || 0) - (a.best || 0) || (a.updatedAt || 0) - (b.updatedAt || 0));
    } catch (e) {
      empty(rows, '読みこめませんでした');
      return;
    }
    const label = subjectLabel(subject);
    $('rank-count').textContent = label + '：' + list.length + '人の 記録（画面に出るのは 上位10人）';
    $('btn-rank-clear').disabled = !list.length;
    if (!list.length) { empty(rows, 'まだ 記録が ありません'); return; }
    rows.innerHTML = '';
    let rank = 0;
    let prev = null;
    list.forEach((r, i) => {
      if (r.best !== prev) rank = i + 1;
      prev = r.best;
      rows.appendChild(makeRow({
        no: rank + '位',
        avatar: r.avatar || Avatar.DEFAULT,
        name: r.name || r.key,
        meta: fmtDate(r.updatedAt),
        value: (r.best || 0) + '点',
        onDelete: () => {
          if (!confirm('「' + (r.name || r.key) + '」さんの ' + label + ' の記録（' + r.best + '点）を 消しますか？')) return;
          run(() => db.ref('rankings/' + subject + '/' + r.key).remove(), (r.name || r.key) + 'さんの 記録を 消しました');
        },
      }));
    });
  }

  function clearRanking() {
    const label = subjectLabel(subject);
    if (!confirm(label + ' のランキングを ぜんぶ 消しますか？')) return;
    if (!confirm('本当に 消しますか？ もとに もどせません。')) return;
    const s = subject;
    // ルールで1人ずつしか消せないので、全員分をまとめて消す
    run(async () => {
      const v = (await db.ref('rankings/' + s).get()).val() || {};
      const up = {};
      Object.keys(v).forEach((k) => { up['rankings/' + s + '/' + k] = null; });
      if (Object.keys(up).length) await db.ref().update(up);
    }, label + ' のランキングを ぜんぶ 消しました');
  }

  // ---------- プレイヤー ----------
  async function loadPlayers() {
    const rows = $('player-rows');
    empty(rows, '読みこみ中…');
    try {
      [players, locks] = await Promise.all([
        db.ref('players').get().then((s) => s.val() || {}),
        db.ref('locks').get().then((s) => s.val() || {}),
      ]);
    } catch (e) {
      empty(rows, '読みこめませんでした');
      return;
    }
    renderPlayers();
  }

  function renderPlayers() {
    const rows = $('player-rows');
    const q = $('player-search').value.normalize('NFKC').trim();
    const all = Object.keys(players).map((k) => Object.assign({ key: k }, players[k]))
      .sort((a, b) => String(a.name || a.key).localeCompare(String(b.name || b.key), 'ja'));
    const list = q ? all.filter((p) => String(p.name || p.key).normalize('NFKC').includes(q)) : all;
    $('player-count').textContent = all.length + '人' + (q ? '（' + list.length + '人が 見つかりました）' : '');
    if (!list.length) { empty(rows, q ? '見つかりません' : 'まだ だれも 登録していません'); return; }
    rows.innerHTML = '';
    list.forEach((p) => {
      const avatar = Object.assign({}, p.avatar || Avatar.DEFAULT, { equipped: p.equipped || {} });
      rows.appendChild(makeRow({
        avatar,
        name: p.name || p.key,
        meta: '最後に 遊んだ日 ' + fmtDate(p.updatedAt) + '・' + (locks[p.key] ? 'あいことば あり' : 'あいことば まだ'),
        extra: locks[p.key] ? {
          label: 'あいことばを 消す',
          onClick: () => {
            if (!confirm('「' + (p.name || p.key) + '」の あいことばを 消しますか？\n記録は そのまま残ります。つぎに 名前を入れたときに、新しい あいことばを 決めなおせます。')) return;
            const up = { ['secrets/' + p.key]: null, ['locks/' + p.key]: null, ['devices/' + p.key]: null };
            run(() => db.ref().update(up), '「' + (p.name || p.key) + '」の あいことばを 消しました');
          },
        } : null,
        value: 'ためた点 ' + (Number(p.totalPoints) || 0).toLocaleString() + '点',
        onDelete: () => {
          if (!confirm('「' + (p.name || p.key) + '」を 消しますか？\nためた点・アクセサリー・ランキングの記録も 消えます。')) return;
          const up = { ['players/' + p.key]: null, ['secrets/' + p.key]: null, ['locks/' + p.key]: null, ['devices/' + p.key]: null };
          Store.SUBJECT_KEYS.forEach((s) => { up['rankings/' + s + '/' + p.key] = null; });
          run(() => db.ref().update(up), '「' + (p.name || p.key) + '」を 消しました');
        },
      }));
    });
  }

  // ---------- 部屋 ----------
  const STATUS = { waiting: '待っている', playing: '対戦中', finished: '終わった' };

  async function loadRooms() {
    const rows = $('room-rows');
    empty(rows, '読みこみ中…');
    let rooms;
    try {
      rooms = (await db.ref('rooms').get()).val() || {};
    } catch (e) {
      empty(rows, '読みこめませんでした');
      return;
    }
    const codes = Object.keys(rooms).sort();
    $('room-count').textContent = codes.length + 'こ の部屋';
    $('btn-rooms-clear').disabled = !codes.length;
    $('btn-rooms-clear').dataset.codes = codes.join(',');
    if (!codes.length) { empty(rows, 'いまは 部屋が ありません'); return; }
    rows.innerHTML = '';
    codes.forEach((c) => {
      const r = rooms[c] || {};
      const ps = Object.values(r.players || {});
      const online = ps.filter((p) => p && p.online).length;
      rows.appendChild(makeRow({
        name: '部屋 ' + c,
        meta: (STATUS[r.status] || '') + '・作った時刻 ' + fmtDate(r.createdAt) + '・' + ps.map((p) => p.name).join('、'),
        value: online + '人 いる',
        onDelete: () => {
          if (!confirm('部屋 ' + c + ' を 消しますか？')) return;
          run(() => db.ref('rooms/' + c).remove(), '部屋 ' + c + ' を 消しました');
        },
      }));
    });
  }

  function clearRooms() {
    const codes = ($('btn-rooms-clear').dataset.codes || '').split(',').filter(Boolean);
    if (!codes.length) return;
    if (!confirm('部屋を ぜんぶ（' + codes.length + 'こ）消しますか？\n遊んでいる とちゅうの部屋も 消えます。')) return;
    const up = {};
    codes.forEach((c) => { up['rooms/' + c] = null; });
    run(() => db.ref().update(up), '部屋を ぜんぶ 消しました');
  }

  // ---------- はじめ ----------
  async function init() {
    $('teacher-email').textContent = window.TEACHER_EMAIL || '（js/firebase-config.js に TEACHER_EMAIL がありません）';
    $('btn-unlock').addEventListener('click', unlock);
    $('pass-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); unlock(); }
    });
    $('btn-logout').addEventListener('click', logout);
    document.querySelectorAll('.admin-tab').forEach((b) => b.addEventListener('click', () => showPane(b.dataset.pane)));
    $('btn-reload').addEventListener('click', () => { status(''); reload(); });
    $('btn-rank-clear').addEventListener('click', clearRanking);
    $('btn-rooms-clear').addEventListener('click', clearRooms);
    $('player-search').addEventListener('input', renderPlayers);

    // もう先生のアカウントでログインしていれば、そのまま開く
    try {
      await connect();
      if (Store.isTeacher()) { openPanel(); return; }
    } catch (e) { /* ログインの画面を出す */ }
    setTimeout(() => { try { $('pass-input').focus(); } catch (e) { /* 何もしない */ } }, 200);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
