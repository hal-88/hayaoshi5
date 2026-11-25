// ランキングの画面（教科ごとに上位10人）
(function () {
  const $ = (id) => document.getElementById(id);
  let currentSubject = 'kokugo';
  let loadId = 0;

  function buildTabs() {
    const wrap = $('rank-tabs');
    wrap.innerHTML = '';
    const list = Questions.SUBJECTS.filter((s) => !s.battleOnly);
    // 期間限定イベントの間は、イベントのランキングのタブも出す
    const ev = window.HistoryEvent && HistoryEvent.isOpen() ? Questions.getSubject(HistoryEvent.EVENT.subject) : null;
    if (ev) list.push(Object.assign({}, ev, { isEvent: true }));
    if (!list.some((s) => s.key === currentSubject)) currentSubject = 'kokugo';
    list.forEach((s) => {
      const b = document.createElement('button');
      b.className = 'rank-tab' + (s.isEvent ? ' rank-tab-event' : '');
      b.style.setProperty('--c', s.color);
      b.textContent = s.label;
      if (s.isEvent) {
        const tag = document.createElement('span');
        tag.className = 'rank-tab-tag';
        tag.textContent = '期間限定';
        b.appendChild(tag);
      }
      b.dataset.key = s.key;
      b.addEventListener('click', () => {
        Sound.play('tap');
        show(s.key);
      });
      wrap.appendChild(b);
    });
  }

  async function show(subjectKey) {
    currentSubject = subjectKey || currentSubject;
    const myId = ++loadId;
    $('rank-tabs').querySelectorAll('.rank-tab').forEach((b) => b.classList.toggle('active', b.dataset.key === currentSubject));
    const list = $('rank-list');
    list.innerHTML = '<li class="rank-loading">読みこみ中…</li>';
    $('rank-empty').hidden = true;
    $('rank-me').textContent = '';

    let rows, myRank;
    const myBest = Profile.best(currentSubject);
    try {
      [rows, myRank] = await Promise.all([
        Store.getRanking(currentSubject),
        Store.getRank(currentSubject, myBest),
      ]);
    } catch (e) {
      if (myId !== loadId) return;
      list.innerHTML = '<li class="rank-loading">読みこめませんでした。インターネットを たしかめてね</li>';
      return;
    }
    if (myId !== loadId) return; // べつのタブをおした

    renderRows(list, rows);
    $('rank-empty').hidden = rows.length > 0;

    $('rank-me').textContent = myBest
      ? 'あなたの ベスト記録：' + myBest + '点（' + myRank + '位）'
      : 'あなたは まだ この教科の 記録がないよ';
  }

  // 上位10人を ならべる（歴史イベントのランキングでも使う）
  function renderRows(list, rows) {
    list.innerHTML = '';
    let rank = 0;
    let prevBest = null;
    rows.forEach((r, i) => {
      // 同じ点なら同じ順位
      if (r.best !== prevBest) rank = i + 1;
      prevBest = r.best;
      const li = document.createElement('li');
      li.className = 'rank-row' + (rank <= 3 ? ' top' + rank : '') + (r.key === Profile.key() ? ' me' : '');
      li.innerHTML = '<span class="rank-no"></span><span class="avatar-badge rank-avatar"></span><span class="rank-name"></span><span class="rank-score"></span>';
      li.querySelector('.rank-no').textContent = rank;
      li.querySelector('.rank-avatar').innerHTML = Avatar.render(r.avatar || Avatar.DEFAULT);
      li.querySelector('.rank-name').textContent = r.name || '？';
      li.querySelector('.rank-score').textContent = r.best + '点';
      list.appendChild(li);
    });
  }

  function open() {
    buildTabs(); // イベントが始まった・終わったときのために、毎回作りなおす
    show(currentSubject);
  }

  window.Ranking = { open, show, renderRows };
})();
