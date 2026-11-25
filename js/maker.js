// キャラクターづくりの画面（パーツ・アクセサリー）
(function () {
  const $ = (id) => document.getElementById(id);
  let current = null;   // パーツ
  let equipped = null;  // { head, face }
  let skin = '';        // 偉人スキン（'' はなし）
  let onDone = null;

  // options: { canCancel, start(はじめのパーツ), onDone({avatar, equipped} または null) }
  function open(options) {
    const o = options || {};
    onDone = o.onDone || null;
    current = Avatar.normalize(o.start || Avatar.load() || Avatar.random());
    equipped = Object.assign({ head: '', face: '' }, Profile.equipped());
    skin = Profile.skin ? Profile.skin() : '';
    $('btn-avatar-back').hidden = !o.canCancel;
    showTab(o.tab || 'parts');
    buildParts();
    buildAcc();
    buildSkins();
    update();
  }

  function showTab(name) {
    $('tab-parts').classList.toggle('active', name === 'parts');
    $('tab-acc').classList.toggle('active', name === 'acc');
    $('tab-skin').classList.toggle('active', name === 'skin');
    $('maker-parts').hidden = name !== 'parts';
    $('maker-acc').hidden = name !== 'acc';
    $('maker-skin').hidden = name !== 'skin';
  }

  function makeRow(label, key, onStep) {
    const row = document.createElement('div');
    row.className = 'part-row';
    row.dataset.key = key;
    row.innerHTML =
      '<span class="part-label"></span>' +
      '<button class="part-arrow" data-dir="-1" aria-label="まえ">◀</button>' +
      '<span class="part-value"><span class="part-swatch"></span><span class="part-name"></span><small class="part-num"></small></span>' +
      '<button class="part-arrow" data-dir="1" aria-label="つぎ">▶</button>';
    row.querySelector('.part-label').textContent = label;
    row.querySelectorAll('.part-arrow').forEach((b) => {
      b.addEventListener('click', () => onStep(Number(b.dataset.dir)));
    });
    return row;
  }

  function buildParts() {
    const wrap = $('maker-parts');
    wrap.innerHTML = '';
    Avatar.PARTS.forEach((p) => {
      wrap.appendChild(makeRow(p.label, p.key, (dir) => {
        const n = p.options.length;
        current[p.key] = (current[p.key] + dir + n) % n;
        Sound.play('tap');
        update(true);
      }));
    });
  }

  // つけられるもの：「なし」＋ゲットしたアクセサリー
  function choices(slot) {
    return [''].concat(Avatar.ownedAccessories(Profile.accessories()).filter((x) => x.slot === slot).map((x) => x.id));
  }

  function buildAcc() {
    const rows = $('acc-rows');
    rows.innerHTML = '';
    [['head', '頭'], ['face', '顔']].forEach(([slot, label]) => {
      rows.appendChild(makeRow(label, slot, (dir) => {
        const list = choices(slot);
        const i = Math.max(0, list.indexOf(equipped[slot]));
        equipped[slot] = list[(i + dir + list.length) % list.length];
        Sound.play('tap');
        update(true);
      }));
    });

    // 全部のアクセサリー（まだのものは「？」とレア度だけ）
    const ownedMap = Profile.accessories();
    const grid = $('acc-grid');
    grid.innerHTML = '';
    Avatar.ACCESSORIES.forEach((x) => {
      const owned = !!ownedMap[x.id];
      const b = document.createElement('button');
      b.className = 'acc-card rarity-' + x.rarity + (owned ? ' owned' : ' locked');
      b.disabled = !owned;
      b.innerHTML = '<span class="acc-icon"></span><span class="acc-name"></span>';
      b.querySelector('.acc-icon').innerHTML = owned ? Avatar.renderAccessoryIcon(x.id) : '<span class="acc-q">？</span>';
      b.querySelector('.acc-name').textContent = owned ? x.name : Avatar.RARITY[x.rarity].label;
      if (owned) {
        b.addEventListener('click', () => {
          // もう一度おすと外す
          equipped[x.slot] = equipped[x.slot] === x.id ? '' : x.id;
          Sound.play('tap');
          update(true);
        });
      }
      b.dataset.id = x.id;
      grid.appendChild(b);
    });

    const have = Avatar.ownedAccessories(ownedMap).length;
    const all = Avatar.ACCESSORIES.length;
    const pulls = Profile.gachaPulls();
    $('acc-progress-text').innerHTML = '';
    $('acc-progress-text').append('集めた アクセサリー ', strong(have + ' / ' + all), ' ／ ガチャ ',
      pulls ? strong(pulls + '回') : 'まだ', pulls ? ' 引けるよ' : '引けない（500点で1回）');
    $('acc-progress-bar').style.width = (have / all) * 100 + '%';
  }

  // 偉人スキン：持っているものだけ（えらぶと、キャラの絵そのものがスキンになる）
  function buildSkins() {
    const grid = $('maker-skin-grid');
    grid.innerHTML = '';
    const owned = window.Skins ? Skins.owned(Profile.skins ? Profile.skins() : {}) : [];
    const add = (id, label, html) => {
      const b = document.createElement('button');
      b.className = 'skin-pick' + (id ? ' rarity-' + Skins.get(id).rarity : '');
      b.dataset.id = id;
      b.innerHTML = '<span class="avatar-badge skin-face"></span><span class="skin-name"></span>';
      b.querySelector('.skin-face').innerHTML = html;
      b.querySelector('.skin-name').textContent = label;
      b.addEventListener('click', () => { skin = id; Sound.play('tap'); update(true); });
      grid.appendChild(b);
    };
    add('', 'スキンなし', Avatar.render(current, { equipped, skin: '' }));
    owned.forEach((x) => add(x.id, x.name, Skins.render(x.id)));
    $('maker-skin-help').textContent = owned.length
      ? 'スキンをつけると、キャラの絵が 偉人の絵に かわるよ（パーツやアクセサリーは 見えなくなる）'
      : '偉人スキンは、期間限定の「一般常識イベント」の 偉人ガチャで ゲットできるよ';
  }

  function strong(t) {
    const b = document.createElement('b');
    b.textContent = t;
    return b;
  }

  function update(changed) {
    const preview = $('maker-avatar');
    preview.innerHTML = Avatar.render(current, { equipped, skin, title: 'じぶんのキャラ' });
    preview.classList.remove('boing');
    void preview.offsetWidth;
    if (changed) preview.classList.add('boing');

    Avatar.PARTS.forEach((p) => {
      const row = $('maker-parts').querySelector('[data-key="' + p.key + '"]');
      const opt = p.options[current[p.key]];
      row.querySelector('.part-name').textContent = opt.name;
      row.querySelector('.part-num').textContent = (current[p.key] + 1) + '/' + p.options.length;
      const sw = row.querySelector('.part-swatch');
      sw.hidden = !p.isColor;
      if (p.isColor) sw.style.background = opt.color;
    });

    ['head', 'face'].forEach((slot) => {
      const row = $('acc-rows').querySelector('[data-key="' + slot + '"]');
      const list = choices(slot);
      const a = Avatar.getAccessory(equipped[slot]);
      row.querySelector('.part-name').textContent = a ? a.name : 'なし';
      row.querySelector('.part-num').textContent = list.length > 1 ? (Math.max(0, list.indexOf(equipped[slot])) + 1) + '/' + list.length : '';
      row.querySelector('.part-swatch').hidden = true;
      row.querySelectorAll('.part-arrow').forEach((b) => { b.disabled = list.length <= 1; });
    });
    $('maker-skin-grid').querySelectorAll('.skin-pick').forEach((c) => c.classList.toggle('wearing', c.dataset.id === skin));
    const none = $('maker-skin-grid').querySelector('.skin-pick[data-id=""] .skin-face');
    if (none && changed) none.innerHTML = Avatar.render(current, { equipped, skin: '' });
    $('acc-grid').querySelectorAll('.acc-card').forEach((c) => {
      c.classList.toggle('wearing', equipped.head === c.dataset.id || equipped.face === c.dataset.id);
    });
  }

  function setup() {
    $('tab-parts').addEventListener('click', () => { Sound.play('tap'); showTab('parts'); });
    $('tab-acc').addEventListener('click', () => { Sound.play('tap'); showTab('acc'); });
    $('tab-skin').addEventListener('click', () => { Sound.play('tap'); showTab('skin'); });
    $('btn-random').addEventListener('click', () => {
      current = Avatar.normalize(Avatar.random());
      Sound.play('sparkle');
      update(true);
    });
    $('btn-avatar-ok').addEventListener('click', () => {
      Sound.play('correct');
      Effects.confetti(50);
      if (onDone) onDone({ avatar: Avatar.normalize(current), equipped: Object.assign({}, equipped), skin });
    });
    $('btn-avatar-back').addEventListener('click', () => {
      Sound.play('tap');
      if (onDone) onDone(null);
    });
  }

  window.Maker = { setup, open };
})();
