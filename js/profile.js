// いま遊んでいる人の記録（名前・キャラ・アクセサリー・累計点数・ベスト記録）
// この iPad にも写しを保存しておき、次からは名前の入力を省略できるようにする。
(function () {
  const LOCAL_KEY = 'hayaoshi5.profile';
  let state = null; // { name, key, equipped:{head,face}, totalPoints, accessories:{id:true}, best:{教科:点}, eventPoints, skins:{id:true}, skin }

  function emptyEquip() { return { head: '', face: '' }; }

  function saveLocal() {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch (e) { /* 何もしない */ }
  }

  function loadLocal() {
    try {
      const v = JSON.parse(localStorage.getItem(LOCAL_KEY));
      if (v && v.name && v.key) {
        state = Object.assign({ equipped: emptyEquip(), totalPoints: 0, accessories: {}, best: {}, eventPoints: 0, skins: {}, skin: '' }, v);
        return true;
      }
    } catch (e) { /* 何もしない */ }
    return false;
  }

  function clear() {
    state = null;
    try { localStorage.removeItem(LOCAL_KEY); } catch (e) { /* 何もしない */ }
  }

  // 持っていないアクセサリーはつけられない（owned は { id: true }）
  function cleanEquip(eq, ownedMap) {
    const owned = Avatar.ownedAccessories(ownedMap).map((x) => x.id);
    const out = emptyEquip();
    ['head', 'face'].forEach((slot) => {
      const id = eq && eq[slot];
      const a = Avatar.getAccessory(id);
      if (a && a.slot === slot && owned.includes(id)) out[slot] = id;
    });
    return out;
  }

  // 持っていない偉人スキンはつけられない
  function cleanSkin(id, skins) {
    return id && skins && skins[id] && window.Skins && Skins.get(id) ? id : '';
  }

  function fromData(name, key, data) {
    const total = Number(data && data.totalPoints) || 0;
    const accessories = (data && data.accessories) || {};
    const skins = (data && data.skins) || {};
    state = {
      name,
      key,
      equipped: cleanEquip(data && data.equipped, accessories),
      totalPoints: total,
      accessories,
      best: (state && state.key === key && state.best) || {},
      eventPoints: Number(data && data.eventPoints) || 0,
      skins,
      skin: cleanSkin(data && data.skin, skins),
    };
    if (data && data.avatar) Avatar.save(data.avatar);
    saveLocal();
  }

  // ランキングにのせるキャラ（アクセサリーこみ）
  function rankingAvatar() {
    const a = Object.assign({}, Avatar.load() || Avatar.DEFAULT, { equipped: state ? state.equipped : emptyEquip() });
    if (state && state.skin) a.skin = state.skin; // 偉人スキン（ランキングや対戦でもスキンの絵で出る）
    return a;
  }

  // ---------- 名前で記録をさがす ----------
  async function lookup(name) {
    const clean = Store.normalizeName(name);
    const key = Store.nameKey(clean);
    if (!key) return { ok: false };
    const data = await Store.getPlayer(key);
    return { ok: true, name: clean, key, data };
  }

  // 記録が見つかった人：つづきから
  async function loginExisting(name, key, data) {
    fromData(data.name || name, key, data);
    await refreshBest();
  }

  // はじめての人：キャラを作ったら登録
  async function register(name, key, avatar) {
    Avatar.save(avatar);
    state = { name, key, equipped: emptyEquip(), totalPoints: 0, accessories: {}, best: {}, eventPoints: 0, skins: {}, skin: '' };
    // 同じ名前の人が先に登録していたら、その記録を引きつぐ
    const existing = await Store.getPlayer(key);
    if (existing) {
      state.totalPoints = Number(existing.totalPoints) || 0;
      state.accessories = existing.accessories || {};
      state.equipped = cleanEquip(existing.equipped, state.accessories);
      state.eventPoints = Number(existing.eventPoints) || 0;
      state.skins = existing.skins || {};
      state.skin = cleanSkin(existing.skin, state.skins);
    }
    await Store.savePlayer(key, {
      name,
      avatar: Avatar.normalize(avatar),
      equipped: state.equipped,
      totalPoints: state.totalPoints,
    });
    saveLocal();
    await refreshBest();
  }

  // ほかの iPad で遊んだ分も読みなおす
  // 先生がその名前を消していたら、この iPad の記録も消して 'deleted' を返す（名前の入れなおし）
  async function refresh() {
    if (!state) return;
    const data = await Store.getPlayer(state.key);
    if (!data) {
      clear();
      return 'deleted';
    }
    fromData(data.name || state.name, state.key, data);
    await refreshBest();
  }

  async function refreshBest() {
    if (!state) return;
    state.best = await Store.getAllBest(state.key);
    saveLocal();
  }

  // キャラやアクセサリーを変えたとき
  // skin を省くと、いまのスキンのまま
  async function saveLook(avatar, equipped, skin) {
    Avatar.save(avatar);
    state.equipped = cleanEquip(equipped, state.accessories);
    if (skin !== undefined) state.skin = cleanSkin(skin, state.skins);
    saveLocal();
    await Store.savePlayer(state.key, { name: state.name, avatar: Avatar.normalize(avatar), equipped: state.equipped, skin: state.skin });
    await Store.updateRankingProfile(state.key, state.name, rankingAvatar());
  }

  // 練習モードの結果を記録する
  async function applyPractice(subject, score) {
    let total = state.totalPoints;
    if (score > 0) total = await Store.addPoints(state.key, state.name, score);
    const before = total - score;
    state.totalPoints = total;

    let best = state.best[subject] || 0;
    let isNewBest = false;
    if (score > 0) {
      const r = await Store.submitScore(subject, state.key, state.name, rankingAvatar(), score);
      best = r.best;
      isNewBest = r.isNewBest;
    }
    state.best[subject] = best;
    saveLocal();
    const rank = best ? await Store.getRank(subject, best) : null;

    return { before, total, best, isNewBest, rank, pulls: gachaPulls() };
  }

  // ガチャが何回引けるか（500点で1回）
  function gachaPulls() {
    return Math.floor((state ? state.totalPoints : 0) / Store.GACHA_COST);
  }

  // ガチャを引く（count は 1 か 10）。結果：{ results:[{acc,isNew}], reason }
  async function pullGacha(count) {
    const r = await Store.pullGacha(state.key, count);
    if (r.results || r.reason === 'points') {
      state.totalPoints = r.points;
      state.accessories = r.owned;
      state.equipped = cleanEquip(state.equipped, state.accessories);
      saveLocal();
    }
    return r;
  }

  async function equipOne(id) {
    const a = Avatar.getAccessory(id);
    if (!a) return;
    const eq = Object.assign({}, state.equipped, { [a.slot]: id });
    await saveLook(Avatar.load() || Avatar.DEFAULT, eq);
  }

  // ---------- 歴史イベント ----------
  // イベントの点をためて、歴史チャレンジのランキング（1回の点のベスト）にものせる
  async function applyEvent(subject, score) {
    let total = state.eventPoints || 0;
    if (score > 0) total = await Store.addEventPoints(state.key, state.name, score);
    const before = total - score;
    state.eventPoints = total;

    saveLocal();

    // ランキングに のせられなくても、イベントの点は ためたままにする
    let best = state.best[subject] || 0;
    let isNewBest = false;
    let rank = null;
    try {
      if (score > 0) {
        const r = await Store.submitScore(subject, state.key, state.name, rankingAvatar(), score);
        best = r.best;
        isNewBest = r.isNewBest;
      }
      state.best[subject] = best;
      saveLocal();
      rank = best ? await Store.getRank(subject, best) : null;
    } catch (e) { /* 何もしない */ }
    return { before, total, best, isNewBest, rank, pulls: skinPulls() };
  }

  function skinPulls() {
    return Math.floor((state ? state.eventPoints || 0 : 0) / Store.GACHA_COST);
  }

  async function pullSkinGacha(count) {
    const r = await Store.pullSkinGacha(state.key, count);
    if (r.results || r.reason === 'points') {
      state.eventPoints = r.points;
      state.skins = r.owned;
      saveLocal();
    }
    return r;
  }

  async function wearSkin(id) {
    await saveLook(Avatar.load() || Avatar.DEFAULT, state.equipped, id || '');
  }

  window.Profile = {
    loadLocal, clear, lookup, loginExisting, register, refresh, saveLook, applyPractice, equipOne, pullGacha, gachaPulls,
    applyEvent, skinPulls, pullSkinGacha, wearSkin,
    eventPoints: () => (state ? state.eventPoints || 0 : 0),
    skins: () => (state && state.skins) || {},
    skin: () => (state ? state.skin || '' : ''),
    has: () => !!state,
    name: () => (state ? state.name : ''),
    key: () => (state ? state.key : ''),
    equipped: () => (state ? state.equipped : emptyEquip()),
    totalPoints: () => (state ? state.totalPoints : 0),
    accessories: () => (state && state.accessories) || {},
    best: (subject) => (state && state.best ? state.best[subject] || 0 : 0),
    rankingAvatar,
  };
})();
