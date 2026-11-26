// 問題データの読みこみ
(function () {
  const SUBJECTS = [
    { key: 'kokugo', label: '国語', badge: '国', file: 'data/questions/kokugo.json', color: '#ff5c8d' },
    { key: 'sansu', label: '算数', badge: '算', file: 'data/questions/sansu.json', color: '#4d9dff' },
    { key: 'shakai', label: '社会', badge: '社', file: 'data/questions/shakai.json', color: '#ff8a3d' },
    { key: 'rika', label: '理科', badge: '理', file: 'data/questions/rika.json', color: '#2ec4a6' },
    { key: 'all', label: 'オールジャンル', badge: '全', file: null, color: '#8c6bff' },
  ];

  // イベントだけで使う教科（ふつうの教科えらび・ランキング・対戦には出さない）
  // イベントの点とイベントのランキングになる（オールジャンルにもまざらない）
  const EXTRA = [
    { key: 'joushiki', label: '一般常識', adminLabel: '一般常識イベント', badge: '常', file: 'data/questions/joushiki.json', color: '#c0702a' },
  ];

  const cache = {};

  async function loadOne(subject) {
    if (cache[subject.key]) return cache[subject.key];
    const res = await fetch(subject.file, { cache: 'no-cache' });
    if (!res.ok) throw new Error(subject.label + 'の問題を読みこめませんでした');
    const list = await res.json();
    cache[subject.key] = list;
    return list;
  }

  // key: 'shakai' | 'rika' | 'kokugo' | 'sansu' | 'all' | 'joushiki'（イベント）
  async function load(key) {
    const tagged = getSubject(key);
    if (tagged && tagged.tag) {
      const list = await loadOne(getSubject(tagged.from));
      return list.filter((q) => (q.tags || []).includes(tagged.tag));
    }
    if (key === 'all') {
      const lists = await Promise.all(SUBJECTS.filter((s) => s.file).map(loadOne));
      return [].concat(...lists);
    }
    return loadOne(getSubject(key));
  }

  function getSubject(key) {
    return SUBJECTS.find((s) => s.key === key) || EXTRA.find((s) => s.key === key);
  }

  // ---- いっしょに出さない組み合わせ ----
  // ・答えが同じ問題（聞き方を変えた「言いかえ」問題など）
  // ・問題文に、もう一方の問題の答えが書いてある組（例：「織田信長と徳川家康の軍が…」と、答えが「織田信長」の問題）
  // 答えの形は、漢字をふくむなら2文字以上、ひらがな・数字だけなら3文字以上のものを使う（短いと関係ない文にも入ってしまうため）
  const KANJI = /[々㐀-鿿]/;
  const prepCache = new WeakMap();
  function prep(q) {
    let p = prepCache.get(q);
    if (!p) {
      const norm = window.Judge ? Judge.normalizeAnswer : (s) => String(s || '');
      const forms = [];
      [q.answer].concat(q.alt || []).forEach((a) => {
        const f = norm(a);
        if ((KANJI.test(f) && f.length >= 2) || f.length >= 3) forms.push(f);
      });
      p = { key: norm(q.answer), forms, text: norm(q.question) };
      prepCache.set(q, p);
    }
    return p;
  }
  function clash(a, b) {
    const x = prep(a);
    const y = prep(b);
    return x.key === y.key || x.forms.some((f) => y.text.includes(f)) || y.forms.some((f) => x.text.includes(f));
  }

  // ---- 問題の「なかま」（似た問題ばかり出ないように、なかまをまんべんなく出す） ----
  function kindOf(q) {
    const t = q.question;
    if (q.subject === '国語') {
      if (/四字熟語/.test(t)) return '四字熟語';
      if (/尊敬語|けんじょう語|謙譲語|ていねい|敬語/.test(t)) return '敬語';
      if (/〇/.test(t)) return 'ことわざ・慣用句';
      if (/反対の意味/.test(t)) return '反対の言葉';
      if (/読み方は|訓読みは/.test(t)) return '漢字の読み';
      if (/物語|随筆|作家|俳人|俳句|短歌|百人一首|徒然草|芸能|歌舞伎|狂言|詩/.test(t)) return '古典・文学';
      return '言葉のきまり';
    }
    if (q.subject === '算数') {
      if (/グラフ|データ|平均|代表値|度数|階級|場合|組み合わせ|ならぶ|並べ|樹形図|ドット/.test(t)) return 'データ';
      if (/単位|メートル|リットル|グラム|アール|ヘクタール|秒|何分|時間は|何時間|何日|週|トン/.test(t)) return '単位';
      if (/形|角|辺|面|円|三角|四角|立体|柱|対称|図|直線|平行|垂直|頂点/.test(t)) return '図形';
      return '数と計算';
    }
    if (q.subject === '社会') {
      if ((q.tags || []).includes('history')) return /だれ？/.test(t) ? '歴史の人物' : '歴史のできごと';
      if (q.grade === 6) return '政治・国際';
      if (q.grade === 5) return /工業|工場|農|漁|貿易|輸|情報|メディア|林業|木材|公害|食料|酪農|畜産|栽培|生産|米/.test(t) ? '産業' : '国土';
      if (/福井/.test(t)) return '福井県';
      if (/都道府県|県はどこ|府はどこ|府がつく/.test(t)) return '都道府県';
      return 'くらし';
    }
    if (q.subject === '理科') {
      if (/電|磁石|コイル|てこ|ふりこ|支点|力点|作用点/.test(t)) return '電気・力';
      if (/体|臓|血|植物|花|種子|発芽|メダカ|たまご|卵|受精|精子|動物|虫|鳥|葉|根|くき|カエル|筋肉|ほね|骨|関節|消化|呼吸|子宮|へそ|羊水|胃|腸|生物|でんぷん|だ液|歯|食道|ヘチマ|アサガオ|イチョウ|さくら|冬眠|おしべ|めしべ|おばな|めばな|がく|花粉|胎盤/.test(t)) return '生き物・体';
      if (/星|月|太陽|天気|雲|気温|雨|台風|川|地層|火山|岩|化石|地震|土地|地面|断層|天体|気象|百葉箱|谷|洪水|扇状地|地いき/.test(t)) return '地球・宇宙';
      return 'ものの性質';
    }
    if (q.subject === '一般常識') return /〇|という意味|たとえ/.test(t) ? 'ことわざ・ことば' : 'いろいろ';
    return '';
  }

  // なかまの大きさに合わせて（小さいなかまが出すぎないよう √ の重みで）ならべる
  // 教科がまざっているとき（オールジャンル）は、まず教科を同じ重みでえらび、その中でなかまをえらぶ
  function spread(list) {
    const mixed = new Set(list.map((q) => q.subject)).size > 1;
    const groups = new Map();
    list.forEach((q) => {
      const k1 = mixed ? q.subject : kindOf(q);
      const k2 = mixed ? kindOf(q) : '';
      if (!groups.has(k1)) groups.set(k1, new Map());
      const g = groups.get(k1);
      if (!g.has(k2)) g.set(k2, []);
      g.get(k2).push(q);
    });
    const top = [...groups.values()].map((g) => ({ w: mixed ? 1 : Math.sqrt([...g.values()][0].length), subs: [...g.values()].map((items) => ({ w: Math.sqrt(items.length), items })) }));
    const draw = (arr) => {
      const sum = arr.reduce((s, x) => s + x.w, 0);
      let r = Math.random() * sum;
      for (const x of arr) { r -= x.w; if (r < 0) return x; }
      return arr[arr.length - 1];
    };
    const out = [];
    while (top.length) {
      const t = draw(top);
      const s = draw(t.subs);
      out.push(s.items.pop());
      if (!s.items.length) t.subs.splice(t.subs.indexOf(s), 1);
      if (!t.subs.length) top.splice(top.indexOf(t), 1);
    }
    return out;
  }

  // ---- 最近 この iPad で出た問題（答え）は、しばらく出にくくする ----
  const RECENT_KEY = 'hayaoshi5.recentAnswers';
  const RECENT_MAX = 60;
  function recentList() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { return []; }
  }
  function remember(qs) {
    try {
      const keys = recentList().concat(qs.map((q) => prep(q).key));
      localStorage.setItem(RECENT_KEY, JSON.stringify(keys.slice(-RECENT_MAX)));
    } catch (e) { /* 保存できなくても遊べる */ }
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 同じ問題が出ないように、まぜてから n 問とり出す
  // ・なかまをまんべんなく ・最近出た問題はあとまわし ・いっしょに出さない組み合わせは後ろへ回す
  const CHECK_MAX = 40; // 対戦ではぜんぶの問題をならべるので、調べるのは最初の40問まで
  function pick(list, n) {
    const recent = new Set(recentList());
    const a = shuffle(list);
    const fresh = a.filter((q) => !recent.has(prep(q).key));
    const stale = a.filter((q) => recent.has(prep(q).key));
    const order = spread(fresh).concat(spread(stale));
    const first = [];
    const rest = [];
    const later = [];
    order.forEach((q) => {
      if (first.length >= CHECK_MAX) rest.push(q);
      else if (first.some((p) => clash(p, q))) later.push(q);
      else first.push(q);
    });
    const out = first.concat(rest, later).slice(0, n);
    if (n < list.length) remember(out); // 10問チャレンジのときだけおぼえておく
    return out;
  }

  window.Questions = { SUBJECTS, EXTRA, load, pick, getSubject, kindOf };
})();
