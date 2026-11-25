// アクセサリーガチャ（ためた点 500点で1回・10連はレア以上1つ確定）
(function () {
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const TITLE = { sr: 'スーパーレア！！', r: 'レア！', n: 'ゲット！' };
  const RANK = { n: 0, r: 1, sr: 2 };
  let busy = false;
  let single = null; // 1回引いたときのアクセサリー（つけてみる用）

  function update() {
    const total = Profile.totalPoints();
    const pulls = Profile.gachaPulls();
    const cost = Store.GACHA_COST;
    $('gacha-points').textContent = total.toLocaleString();
    $('gacha-can').textContent = pulls
      ? 'ガチャが ' + pulls + '回 引けるよ！'
      : 'あと ' + (cost - (total % cost)) + '点で 1回 引けるよ。ひとりでチャレンジで 点を ためよう！';
    $('gacha-can').classList.toggle('ready', pulls > 0);
    $('btn-gacha-1').disabled = busy || pulls < 1;
    $('btn-gacha-10').disabled = busy || pulls < 10;
    const have = Avatar.ownedAccessories(Profile.accessories()).length;
    $('gacha-owned').textContent = '集めた アクセサリー ' + have + ' / ' + Avatar.ACCESSORIES.length;
  }

  function open() {
    $('gacha-result').hidden = true;
    window.App.show('screen-gacha');
    update();
  }

  async function pull(count) {
    if (busy || Profile.gachaPulls() < count) return;
    busy = true;
    update();
    const m = $('gacha-machine');
    m.classList.remove('turning');
    void m.offsetWidth;
    m.classList.add('turning');
    Sound.play('tap');
    setTimeout(() => Sound.play('beep'), 350);
    setTimeout(() => Sound.play('beep'), 700);
    let r;
    try {
      [r] = await Promise.all([Profile.pullGacha(count), wait(1100)]);
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
    const list = $('gacha-result-list');
    list.innerHTML = '';
    list.classList.toggle('one', results.length === 1);
    results.forEach((x, i) => {
      const d = document.createElement('div');
      d.className = 'gacha-item rarity-' + x.acc.rarity + (x.isNew ? ' is-new' : '');
      d.style.animationDelay = i * 0.2 + 's';
      d.innerHTML = '<span class="gi-rarity"></span><span class="gi-icon"></span><span class="gi-name"></span><span class="gi-tag"></span>';
      d.querySelector('.gi-rarity').textContent = Avatar.RARITY[x.acc.rarity].label;
      d.querySelector('.gi-icon').innerHTML = results.length === 1
        ? Avatar.render(Avatar.load() || Avatar.DEFAULT, { equipped: Object.assign({}, Profile.equipped(), { [x.acc.slot]: x.acc.id }) })
        : Avatar.renderAccessoryIcon(x.acc.id);
      d.querySelector('.gi-name').textContent = x.acc.name;
      d.querySelector('.gi-tag').textContent = x.isNew ? 'NEW!' : 'もう持っている';
      list.appendChild(d);
      // 1つずつ出てくるときの音
      setTimeout(() => Sound.play(x.acc.rarity === 'n' ? 'tap' : 'sparkle'), i * 200 + 150);
    });

    const best = results.reduce((a, x) => (RANK[x.acc.rarity] > RANK[a] ? x.acc.rarity : a), 'n');
    const news = results.filter((x) => x.isNew).length;
    if (results.length === 1) {
      single = results[0].acc;
      $('gacha-result-title').textContent = TITLE[single.rarity];
      $('gacha-result-sum').textContent = results[0].isNew
        ? '「' + single.name + '」を ゲットしたよ！'
        : '「' + single.name + '」は もう持っているよ。つぎは ちがうのを ねらおう！';
    } else {
      single = null;
      $('gacha-result-title').textContent = '10連ガチャの けっか';
      $('gacha-result-sum').textContent = news
        ? '新しい アクセサリーが ' + news + 'こ！' + (best === 'sr' ? ' スーパーレアも 出たよ！' : '')
        : 'ぜんぶ もう持っていたよ…。つぎは きっと 出る！';
    }
    $('gacha-result').classList.toggle('is-sr', best === 'sr');
    $('btn-gacha-wear').hidden = !single;
    $('gacha-result').hidden = false;

    const end = results.length * 200 + 300;
    setTimeout(() => {
      if (best === 'sr') {
        Sound.play('fanfare');
        Effects.confetti(120);
      } else if (news) {
        Sound.play('correct');
        Effects.confetti(60);
      }
      Effects.sparkle($('gacha-result').querySelector('.modal-card'));
    }, end);
  }

  function close() {
    $('gacha-result').hidden = true;
    update();
  }

  function setup() {
    $('btn-gacha-1').addEventListener('click', () => pull(1));
    $('btn-gacha-10').addEventListener('click', () => pull(10));
    $('btn-gacha-close').addEventListener('click', () => { Sound.play('tap'); close(); });
    $('btn-gacha-wear').addEventListener('click', async () => {
      const x = single;
      Sound.play('correct');
      if (x) {
        try { await Profile.equipOne(x.id); } catch (e) { /* つけられなくても続ける */ }
      }
      close();
      $('gacha-can').textContent = x ? '「' + x.name + '」を つけたよ！' : '';
    });
    $('btn-gacha-maker').addEventListener('click', () => { Sound.play('tap'); window.App.openMaker(); });
  }

  window.Gacha = { setup, open, update };
})();
