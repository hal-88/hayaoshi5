// キャラクターの絵（SVG）
// どの画面でも Avatar.render(キャラのデータ) で同じ絵が描ける。
// キャラのデータは「それぞれのパーツが何番目か」だけの小さな形：
//   { face, skin, eyes, brows, nose, mouth, hair, hairColor }
(function () {
  const INK = '#3a2a5e';
  const STORAGE_KEY = 'hayaoshi5.avatar';

  // ---------- パーツの一覧（名前は画面に出る） ----------
  const FACES = [
    { name: 'まる', svg: (f) => `<circle cx="100" cy="112" r="60" ${f}/>` },
    { name: 'たまご', svg: (f) => `<ellipse cx="100" cy="114" rx="54" ry="64" ${f}/>` },
    { name: 'しかく', svg: (f) => `<rect x="44" y="52" width="112" height="120" rx="36" ${f}/>` },
    { name: 'おにぎり', svg: (f) => `<path d="M100 50 C134 50 160 100 162 140 C164 170 140 178 100 178 C60 178 36 170 38 140 C40 100 66 50 100 50Z" ${f}/>` },
    { name: 'おもち', svg: (f) => `<ellipse cx="100" cy="118" rx="64" ry="56" ${f}/>` },
    { name: 'ほっそり', svg: (f) => `<path d="M100 50 C136 50 154 78 154 110 C154 150 128 180 100 180 C72 180 46 150 46 110 C46 78 64 50 100 50Z" ${f}/>` },
  ];

  const SKINS = [
    { name: 'はだ1', color: '#ffe3cf' },
    { name: 'はだ2', color: '#ffd1ad' },
    { name: 'はだ3', color: '#f2bd8c' },
    { name: 'はだ4', color: '#dca274' },
    { name: 'はだ5', color: '#b97e50' },
    { name: 'はだ6', color: '#8a5a3c' },
    { name: 'みずいろ', color: '#bfe8ff' },
    { name: 'わかば', color: '#cdf1b3' },
  ];

  // 目は左右で描く。side は 左=-1 / 右=1
  const EYES = [
    { name: 'まる', svg: (x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="${INK}"/><circle cx="${x + 3}" cy="${y - 3}" r="3" fill="#fff"/>` },
    { name: 'キラキラ', svg: (x, y) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="13" fill="${INK}"/><circle cx="${x + 4}" cy="${y - 5}" r="4.5" fill="#fff"/><circle cx="${x - 4}" cy="${y + 5}" r="2" fill="#fff"/>` },
    { name: 'にこにこ', svg: (x, y) => `<path d="M${x - 10} ${y + 3} Q${x} ${y - 10} ${x + 10} ${y + 3}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>` },
    { name: 'ねむねむ', svg: (x, y) => `<path d="M${x - 10} ${y - 2} Q${x} ${y + 9} ${x + 10} ${y - 2}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>` },
    { name: 'きりっ', svg: (x, y, side) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="7" transform="rotate(${-side * 14} ${x} ${y})" fill="${INK}"/><circle cx="${x + 3}" cy="${y - 2}" r="2.5" fill="#fff"/>` },
    { name: 'てん', svg: (x, y) => `<circle cx="${x}" cy="${y}" r="4.5" fill="${INK}"/>` },
    { name: 'ぱっちり', svg: (x, y, side) => `<circle cx="${x}" cy="${y}" r="10" fill="${INK}"/><circle cx="${x + 3}" cy="${y - 4}" r="3.5" fill="#fff"/><path d="M${x + side * 8} ${y - 7} l${side * 7} -5 M${x + side * 10} ${y - 1} l${side * 8} -1" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` },
    { name: 'ウインク', svg: (x, y, side) => side < 0
      ? `<circle cx="${x}" cy="${y}" r="9" fill="${INK}"/><circle cx="${x + 3}" cy="${y - 3}" r="3" fill="#fff"/>`
      : `<path d="M${x + 8} ${y - 7} L${x - 7} ${y} L${x + 8} ${y + 7}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` },
  ];

  // まゆ。inner は顔の真ん中がわ
  const BROWS = [
    { name: 'ふつう', svg: (x, y) => `<path d="M${x - 11} ${y + 2} Q${x} ${y - 5} ${x + 11} ${y + 2}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` },
    { name: 'まっすぐ', svg: (x, y) => `<path d="M${x - 11} ${y} L${x + 11} ${y}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` },
    { name: 'こまり', svg: (x, y, side) => `<path d="M${x - side * 11} ${y - 5} L${x + side * 11} ${y + 3}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` },
    { name: 'きりっ', svg: (x, y, side) => `<path d="M${x - side * 11} ${y + 4} L${x + side * 11} ${y - 4}" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>` },
    { name: 'ふとまゆ', svg: (x, y) => `<path d="M${x - 11} ${y + 2} Q${x} ${y - 5} ${x + 11} ${y + 2}" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>` },
    { name: 'まろ', svg: (x, y) => `<ellipse cx="${x}" cy="${y - 2}" rx="6" ry="4" fill="${INK}"/>` },
    { name: 'なし', svg: () => '' },
  ];

  const NOSES = [
    { name: 'てん', svg: () => `<ellipse cx="100" cy="130" rx="3.5" ry="3" fill="${INK}" opacity=".55"/>` },
    { name: 'ちょこん', svg: () => `<path d="M95 130 Q100 135 105 130" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity=".7"/>` },
    { name: 'くの字', svg: () => `<path d="M101 119 L95 132 L103 133" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>` },
    { name: 'まるっ', svg: () => `<circle cx="100" cy="129" r="7" fill="#000" opacity=".1"/><circle cx="102" cy="127" r="2" fill="#fff" opacity=".7"/>` },
    { name: 'さんかく', svg: () => `<path d="M100 121 L93 133 L107 133Z" fill="#000" opacity=".12" stroke-linejoin="round"/>` },
    { name: 'なし', svg: () => '' },
  ];

  const MOUTH_RED = '#8a2346';
  const TONGUE = '#ff7d96';
  const MOUTHS = [
    { name: 'にっこり', svg: () => `<path d="M86 145 Q100 159 114 145" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>` },
    { name: '大わらい', svg: () => `<path d="M83 142 L117 142 Q115 167 100 167 Q85 167 83 142Z" fill="${MOUTH_RED}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M91 160 Q100 151 109 160 Q105 166 100 166 Q95 166 91 160Z" fill="${TONGUE}"/>` },
    { name: 'にかっ', svg: () => `<path d="M83 142 L117 142 Q115 163 100 163 Q85 163 83 142Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M86 151 L114 151" stroke="${INK}" stroke-width="1.6" opacity=".5"/>` },
    { name: 'ねこぐち', svg: () => `<path d="M87 146 Q93.5 154 100 146 Q106.5 154 113 146" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` },
    { name: 'ぺろっ', svg: () => `<path d="M96 151 Q96 164 104 162 Q109 159 107 150Z" fill="${TONGUE}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M86 146 Q100 157 114 146" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>` },
    { name: 'ちょこっ', svg: () => `<path d="M95 148 Q100 153 105 148" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` },
    { name: 'びっくり', svg: () => `<ellipse cx="100" cy="151" rx="6.5" ry="8.5" fill="${MOUTH_RED}" stroke="${INK}" stroke-width="3"/>` },
    { name: 'むむっ', svg: () => `<path d="M88 151 Q100 143 112 151" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>` },
  ];

  const HAIR_COLORS = [
    { name: 'くろ', color: '#2e2436' },
    { name: 'こげちゃ', color: '#5b3a24' },
    { name: 'ちゃいろ', color: '#9a6334' },
    { name: 'きんいろ', color: '#f3c552' },
    { name: 'あか', color: '#e0503f' },
    { name: 'ピンク', color: '#ff8fbc' },
    { name: 'あお', color: '#4f7fe0' },
    { name: 'みどり', color: '#4bb56d' },
  ];

  // かみがた：back は顔のうしろ、front は顔の上（前がみ）
  const BANGS_SIDE = 'M44 102 C42 58 70 40 100 40 C130 40 158 58 156 102 C150 82 136 68 118 64 C100 76 72 82 48 98Z';
  const HAIRS = [
    { name: 'ショート',
      back: '<ellipse cx="100" cy="90" rx="64" ry="56"/>',
      front: 'M44 100 C44 58 70 40 100 40 C130 40 156 58 156 100 C147 85 132 75 118 72 C110 82 92 86 77 80 C67 87 55 93 44 100Z' },
    { name: 'ぼうず',
      back: '',
      front: 'M42 102 C42 58 70 44 100 44 C130 44 158 58 158 102 C150 80 128 66 100 66 C72 66 50 80 42 102Z', noShine: true },
    { name: 'ツンツン',
      back: '<ellipse cx="100" cy="92" rx="60" ry="50"/>',
      front: 'M42 102 L34 68 L56 72 L52 42 L76 56 L84 26 L100 48 L116 26 L124 56 L148 42 L144 72 L166 68 L158 102 C146 86 126 76 100 76 C74 76 54 86 42 102Z' },
    { name: 'おかっぱ',
      back: '<path d="M32 152 C26 70 56 34 100 34 C144 34 174 70 168 152Z"/>',
      front: 'M40 104 C38 54 66 36 100 36 C134 36 162 54 160 104 L152 104 L150 84 L50 84 L48 104Z' },
    { name: 'ロング',
      back: '<path d="M30 192 C20 90 50 34 100 34 C150 34 180 90 170 192Z"/>',
      front: 'M40 112 C36 56 66 36 100 36 C136 36 164 56 160 112 C153 88 141 75 125 69 C110 81 80 85 60 79 C50 89 44 99 40 112Z' },
    { name: 'ポニーテール',
      back: '<ellipse cx="100" cy="90" rx="62" ry="54"/><path d="M146 66 C192 62 202 130 180 166 C174 134 166 106 142 92Z"/>',
      front: BANGS_SIDE,
      extra: '<circle cx="150" cy="72" r="8" fill="#ff5c8a" stroke="' + INK + '" stroke-width="3"/>' },
    { name: 'おだんご',
      back: '<circle cx="100" cy="30" r="24"/><ellipse cx="100" cy="90" rx="62" ry="54"/>',
      front: BANGS_SIDE },
    { name: 'ツインテール',
      back: '<ellipse cx="100" cy="90" rx="62" ry="54"/><path d="M148 78 C186 80 196 140 174 174 C170 142 162 118 144 104Z"/><path d="M52 78 C14 80 4 140 26 174 C30 142 38 118 56 104Z"/>',
      front: 'M42 104 C40 56 68 38 100 38 C132 38 160 56 158 104 C150 80 132 66 103 64 L100 72 L97 64 C68 66 50 80 42 104Z',
      extra: '<circle cx="150" cy="82" r="7" fill="#ffd23f" stroke="' + INK + '" stroke-width="3"/><circle cx="50" cy="82" r="7" fill="#ffd23f" stroke="' + INK + '" stroke-width="3"/>' },
  ];

  // ---------- アクセサリー（ためた点でガチャを引いてゲット） ----------
  // slot: 'head'（頭）か 'face'（顔）。rarity: ガチャのレア度（n ふつう / r レア / sr スーパーレア）
  const SK = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"`;
  // 星の形（cx,cy が中心、R が外がわ、r が内がわ）
  function starPath(cx, cy, R, r) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 ? r : R;
      d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1) + ' ';
    }
    return d + 'Z';
  }
  const ACCESSORIES = [
    // ---- ふつう ----
    { id: 'hachimaki', icon: '30 50 160 70', name: 'はちまき', slot: 'head', rarity: 'n',
      svg: () => `<path d="M40 84 Q100 58 160 84 L161 99 Q100 73 39 99Z" fill="#fff" ${SK}/><circle cx="100" cy="79" r="7" fill="#ff4f4f"/><path d="M158 86 L184 74 L180 93Z M158 94 L182 106 L167 113Z" fill="#fff" ${SK}/>` },
    { id: 'megane', icon: '38 94 124 44', name: 'メガネ', slot: 'face', rarity: 'n',
      svg: () => `<g fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"><circle cx="78" cy="117" r="16" fill="#fff" fill-opacity=".3"/><circle cx="122" cy="117" r="16" fill="#fff" fill-opacity=".3"/><path d="M94 114 Q100 109 106 114 M62 113 L44 108 M138 113 L156 108"/></g>` },
    { id: 'ribbon', icon: '94 18 88 60', name: 'リボン', slot: 'head', rarity: 'n',
      svg: () => `<g fill="#ff5c8d" ${SK} transform="translate(138 55) scale(1.35) translate(-138 -55)"><path d="M136 50 C114 28 104 66 132 60Z"/><path d="M140 50 C162 28 172 66 144 60Z"/><circle cx="138" cy="55" r="7"/></g>` },
    { id: 'cap', icon: '30 16 165 86', name: '野球ぼう', slot: 'head', rarity: 'n',
      svg: () => `<path d="M40 88 C38 42 68 26 100 26 C132 26 162 42 160 88 C130 78 70 78 40 88Z" fill="#4d9dff" ${SK}/><path d="M100 30 L100 80" stroke="#2f74d8" stroke-width="3"/><path d="M96 84 C130 72 166 74 188 90 C160 97 126 97 96 92Z" fill="#2f74d8" ${SK}/><circle cx="100" cy="27" r="6" fill="#2f74d8" ${SK}/>` },
    { id: 'flower', icon: '28 30 56 56', name: '花かざり', slot: 'head', rarity: 'n',
      svg: () => `${[0, 72, 144, 216, 288].map((a) => `<circle cx="${(56 + 12 * Math.sin(a * Math.PI / 180)).toFixed(1)}" cy="${(58 - 12 * Math.cos(a * Math.PI / 180)).toFixed(1)}" r="10.5" fill="#ff8fbc" ${SK}/>`).join('')}<circle cx="56" cy="58" r="8" fill="#ffd23f" ${SK}/>` },
    { id: 'band', icon: '30 30 140 70', name: 'カチューシャ', slot: 'head', rarity: 'n',
      svg: () => `<path d="M44 92 C40 40 160 40 156 92" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M44 92 C40 40 160 40 156 92" fill="none" stroke="#2ec4a6" stroke-width="6.5" stroke-linecap="round"/><g fill="#fff" stroke="${INK}" stroke-width="2"><circle cx="70" cy="54" r="3"/><circle cx="100" cy="46" r="3"/><circle cx="130" cy="54" r="3"/></g>` },
    { id: 'starpin', icon: '118 34 48 48', name: '星のヘアピン', slot: 'head', rarity: 'n',
      svg: () => `<path d="${starPath(142, 58, 20, 8.5)}" fill="#ffc93c" ${SK}/><circle cx="138" cy="53" r="3" fill="#fff" opacity=".8"/>` },
    { id: 'mask', icon: '40 112 120 58', name: 'マスク', slot: 'face', rarity: 'n',
      svg: () => `<path d="M71 131 L46 119 M71 149 L48 127 M129 131 L154 119 M129 149 L152 127" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/><path d="M70 126 Q100 118 130 126 L128 154 Q100 166 72 154Z" fill="#fff" ${SK}/><path d="M76 136 Q100 131 124 136 M76 146 Q100 141 124 146" fill="none" stroke="#c9c4df" stroke-width="2.5" stroke-linecap="round"/>` },
    { id: 'bandaid', icon: '108 116 52 44', name: 'ばんそうこう', slot: 'face', rarity: 'n',
      svg: () => `<g transform="rotate(-25 132 138)"><rect x="112" y="131" width="40" height="15" rx="7.5" fill="#f6c89f" ${SK}/><rect x="126" y="133" width="12" height="11" rx="2" fill="#e9b07f"/><g fill="#c98f63"><circle cx="118" cy="136" r="1.2"/><circle cx="118" cy="141" r="1.2"/><circle cx="146" cy="136" r="1.2"/><circle cx="146" cy="141" r="1.2"/></g></g>` },
    { id: 'beret', icon: '28 6 140 70', name: 'ベレーぼう', slot: 'head', rarity: 'n',
      svg: () => `<path d="M94 32 l3 -12" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><ellipse cx="94" cy="50" rx="62" ry="21" transform="rotate(-8 94 50)" fill="#e0503f" ${SK}/><path d="M44 64 Q94 74 146 52" fill="none" stroke="#b83a2c" stroke-width="4" stroke-linecap="round"/>` },
    { id: 'leaf', icon: '86 -2 54 50', name: 'はっぱ', slot: 'head', rarity: 'n',
      svg: () => `<path d="M100 44 Q101 34 104 24" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M104 24 C96 6 122 -2 134 4 C130 18 118 28 104 24Z" fill="#4bb56d" ${SK}/><path d="M106 22 Q118 14 128 7" fill="none" stroke="#2f8a4d" stroke-width="2.5" stroke-linecap="round"/>` },
    { id: 'rednose', icon: '82 111 36 36', name: '赤いはな', slot: 'face', rarity: 'n',
      svg: () => `<circle cx="100" cy="129" r="11" fill="#ff4f4f" ${SK}/><circle cx="96" cy="125" r="3.5" fill="#fff" opacity=".85"/>` },
    // ---- レア ----
    { id: 'sunglasses', icon: '38 96 124 40', name: 'サングラス', slot: 'face', rarity: 'r',
      svg: () => `<g ${SK}><rect x="57" y="104" width="39" height="26" rx="10" fill="${INK}"/><rect x="104" y="104" width="39" height="26" rx="10" fill="${INK}"/><path d="M96 112 L104 112 M57 110 L43 105 M143 110 L157 105" fill="none" stroke-linecap="round"/></g><path d="M65 111 L77 111 M112 111 L124 111" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>` },
    { id: 'headphones', icon: '16 30 168 116', name: 'ヘッドホン', slot: 'head', rarity: 'r',
      svg: () => `<path d="M38 116 C32 32 168 32 162 116" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round"/><path d="M38 116 C32 32 168 32 162 116" fill="none" stroke="#8c6bff" stroke-width="7" stroke-linecap="round"/><rect x="22" y="98" width="27" height="42" rx="11" fill="#ff6b57" ${SK}/><rect x="151" y="98" width="27" height="42" rx="11" fill="#ff6b57" ${SK}/>` },
    { id: 'nekomimi', icon: '40 10 120 70', name: 'ねこみみ', slot: 'head', rarity: 'r',
      svg: (c) => `<path d="M48 74 L54 18 L92 46Z" fill="${c.hairC}" ${SK}/><path d="M152 74 L146 18 L108 46Z" fill="${c.hairC}" ${SK}/><path d="M58 60 L61 32 L82 47Z" fill="#ffb3c8"/><path d="M142 60 L139 32 L118 47Z" fill="#ffb3c8"/>` },
    { id: 'hige', icon: '56 120 88 30', name: 'ひげ', slot: 'face', rarity: 'r',
      svg: () => `<path d="M100 137 C92 127 74 127 63 142 C76 136 88 142 100 140 C112 142 124 136 137 142 C126 127 108 127 100 137Z" fill="#4a3426" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` },
    { id: 'usamimi', icon: '56 -2 88 56', name: 'うさみみ', slot: 'head', rarity: 'r',
      svg: () => `<path d="M72 50 C60 22 62 2 75 2 C88 2 92 22 90 50Z" fill="#fff" ${SK}/><path d="M76 42 C69 24 71 10 76 10 C81 10 84 24 83 42Z" fill="#ffb3c8"/><path d="M110 50 C108 22 112 2 125 2 C138 2 140 22 128 50Z" fill="#fff" ${SK}/><path d="M117 42 C116 24 119 10 124 10 C129 10 131 24 124 42Z" fill="#ffb3c8"/>` },
    { id: 'witch', icon: '26 -12 152 80', name: 'まほうのぼうし', slot: 'head', rarity: 'r',
      svg: () => `<g transform="rotate(8 100 46)"><ellipse cx="100" cy="52" rx="66" ry="12" fill="#5b45c9" ${SK}/><path d="M62 50 C74 30 84 6 112 -6 C110 14 128 32 138 50Z" fill="#8c6bff" ${SK}/><path d="M64 46 Q100 54 136 46 L138 50 Q100 60 62 50Z" fill="#ffc93c" ${SK}/><path d="${starPath(108, 24, 8, 3.5)}" fill="#ffe27a" stroke="${INK}" stroke-width="2"/></g>` },
    { id: 'goggles', icon: '34 94 132 46', name: 'ゴーグル', slot: 'face', rarity: 'r',
      svg: () => `<path d="M40 113 L60 115 M140 115 L160 113" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M40 113 L60 115 M140 115 L160 113" stroke="#ff8a3d" stroke-width="5" stroke-linecap="round"/><path d="M96 117 L104 117" stroke="${INK}" stroke-width="6"/><g stroke="${INK}" stroke-width="5"><circle cx="78" cy="117" r="18" fill="#bfe8ff" fill-opacity=".55"/><circle cx="122" cy="117" r="18" fill="#bfe8ff" fill-opacity=".55"/></g><path d="M68 110 Q72 104 79 103 M112 110 Q116 104 123 103" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>` },
    { id: 'tsuno', icon: '52 2 96 56', name: 'おにのつの', slot: 'head', rarity: 'r',
      svg: () => `<path d="M62 54 C60 36 64 22 74 10 C78 24 84 38 84 54Z" fill="#ffd23f" ${SK}/><path d="M138 54 C140 36 136 22 126 10 C122 24 116 38 116 54Z" fill="#ffd23f" ${SK}/><path d="M66 40 L82 42 M65 30 L78 32 M134 40 L118 42 M135 30 L122 32" stroke="#e8a90c" stroke-width="3" stroke-linecap="round"/>` },
    { id: 'chef', icon: '34 -2 132 72', name: 'コックぼう', slot: 'head', rarity: 'r',
      svg: () => `<path d="M60 56 C40 52 40 22 62 22 C64 4 92 0 100 14 C110 0 138 4 138 22 C160 22 160 52 140 56Z" fill="#fff" ${SK}/><rect x="60" y="48" width="80" height="18" rx="5" fill="#fff" ${SK}/><path d="M80 52 L80 62 M100 52 L100 62 M120 52 L120 62" stroke="#d6d2e8" stroke-width="2.5"/>` },
    { id: 'monocle', icon: '98 94 56 80', name: '片メガネ', slot: 'face', rarity: 'r',
      svg: () => `<path d="M136 129 Q148 150 140 172" fill="none" stroke="#e8a90c" stroke-width="3" stroke-dasharray="4 3" stroke-linecap="round"/><circle cx="122" cy="117" r="18" fill="#fff" fill-opacity=".3" stroke="${INK}" stroke-width="8"/><circle cx="122" cy="117" r="18" fill="none" stroke="#ffc93c" stroke-width="4"/>` },
    // ---- スーパーレア ----
    { id: 'silkhat', icon: '36 -8 128 72', name: 'シルクハット', slot: 'head', rarity: 'sr',
      svg: () => `<g transform="rotate(-8 100 44)" ${SK}><path d="M70 48 L74 4 L126 4 L130 48Z" fill="#3b3473"/><rect x="71" y="34" width="58" height="10" fill="#ff4f4f"/><ellipse cx="100" cy="50" rx="56" ry="10" fill="#3b3473"/></g>` },
    { id: 'heart', icon: '44 118 112 36', name: 'ハートのほっぺ', slot: 'face', rarity: 'sr',
      svg: () => `<path d="M68 136 C60 125 50 136 68 149 C86 136 76 125 68 136Z" fill="#ff5c8d" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M132 136 C124 125 114 136 132 149 C150 136 140 125 132 136Z" fill="#ff5c8d" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` },
    { id: 'halo', icon: '50 2 100 40', name: '天使のわっか', slot: 'head', rarity: 'sr',
      svg: () => `<ellipse cx="100" cy="22" rx="40" ry="11" fill="none" stroke="${INK}" stroke-width="12"/><ellipse cx="100" cy="22" rx="40" ry="11" fill="none" stroke="#ffe27a" stroke-width="6"/>` },
    { id: 'crown', icon: '46 -2 108 62', name: '王冠', slot: 'head', rarity: 'sr',
      svg: () => `<path d="M62 54 L56 14 L80 34 L100 6 L120 34 L144 14 L138 54Z" fill="#ffc93c" ${SK}/><rect x="62" y="44" width="76" height="10" fill="#e8a90c" ${SK}/><g stroke="${INK}" stroke-width="2.5"><circle cx="100" cy="30" r="5" fill="#ff4f4f"/><circle cx="56" cy="14" r="5" fill="#4d9dff"/><circle cx="144" cy="14" r="5" fill="#4d9dff"/><circle cx="100" cy="6" r="5" fill="#2ec4a6"/></g>` },
    { id: 'tiara', icon: '50 2 100 62', name: 'ティアラ', slot: 'head', rarity: 'sr',
      svg: () => `<path d="M58 60 Q100 42 142 60 L138 48 L124 40 L112 46 L100 20 L88 46 L76 40 L62 48Z" fill="#e6ecf7" ${SK}/><g stroke="${INK}" stroke-width="2.5"><circle cx="100" cy="38" r="6" fill="#ff5c8d"/><circle cx="78" cy="49" r="4" fill="#4d9dff"/><circle cx="122" cy="49" r="4" fill="#4d9dff"/></g><path d="M100 4 L102 12 L110 14 L102 16 L100 24 L98 16 L90 14 L98 12Z" fill="#ffe27a" stroke="${INK}" stroke-width="1.5"/>` },
    { id: 'kabuto', icon: '28 -6 144 104', name: 'かぶと', slot: 'head', rarity: 'sr',
      svg: () => `<path d="M38 96 C34 44 66 26 100 26 C134 26 166 44 162 96 L150 96 C148 66 128 52 100 52 C72 52 52 66 50 96Z" fill="#3b3473" ${SK}/><path d="M50 62 Q100 44 150 62" fill="none" stroke="#ffc93c" stroke-width="4"/><path d="M60 32 C68 8 86 -4 100 14 C114 -4 132 8 140 32 C126 20 112 20 100 32 C88 20 74 20 60 32Z" fill="#ffc93c" ${SK}/><circle cx="100" cy="34" r="7" fill="#ff4f4f" ${SK}/>` },
    { id: 'rainbow', icon: '20 -4 160 90', name: 'にじ', slot: 'head', rarity: 'sr',
      svg: () => `<path d="M46.5 72 A53.5 53.5 0 0 1 153.5 72" fill="none" stroke="${INK}" stroke-width="28"/><path d="M40 72 A60 60 0 0 1 160 72" fill="none" stroke="#ff4f4f" stroke-width="7"/><path d="M46.5 72 A53.5 53.5 0 0 1 153.5 72" fill="none" stroke="#ffc93c" stroke-width="7"/><path d="M53 72 A47 47 0 0 1 147 72" fill="none" stroke="#4d9dff" stroke-width="7"/><g fill="#fff" ${SK}><circle cx="36" cy="76" r="11"/><circle cx="50" cy="80" r="9"/><circle cx="164" cy="76" r="11"/><circle cx="150" cy="80" r="9"/></g>` },
    { id: 'starglasses', icon: '50 92 100 50', name: '星のメガネ', slot: 'face', rarity: 'sr',
      svg: () => `<path d="M96 116 Q100 112 104 116 M60 112 L46 106 M140 112 L154 106" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="${starPath(78, 118, 21, 10)}" fill="#ff5c8d" fill-opacity=".9" ${SK}/><path d="${starPath(122, 118, 21, 10)}" fill="#ff5c8d" fill-opacity=".9" ${SK}/><path d="M72 112 L78 110 M116 112 L122 110" stroke="#fff" stroke-width="3" stroke-linecap="round"/>` },
  ];

  function getAccessory(id) { return ACCESSORIES.find((x) => x.id === id) || null; }

  // ガチャのレア度と出やすさ（重み）。同じレア度の中では、どれも同じくらい出る
  const RARITY = {
    n: { label: 'ふつう', weight: 60 },
    r: { label: 'レア', weight: 30 },
    sr: { label: 'スーパーレア', weight: 10 },
  };

  // 持っているアクセサリー（owned は { id: true } の形）
  function ownedAccessories(owned) {
    const o = owned || {};
    return ACCESSORIES.filter((x) => o[x.id]);
  }

  // ガチャを1回引く。minRarity が 'r' ならレア以上だけから引く（10連の「レア以上1つ確定」用）
  function drawAccessory(minRarity) {
    const keys = minRarity === 'r' ? ['r', 'sr'] : ['n', 'r', 'sr'];
    const total = keys.reduce((sum, k) => sum + RARITY[k].weight, 0);
    let x = Math.random() * total;
    let rarity = keys[keys.length - 1];
    for (const k of keys) {
      if (x < RARITY[k].weight) { rarity = k; break; }
      x -= RARITY[k].weight;
    }
    const pool = ACCESSORIES.filter((a) => a.rarity === rarity);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // アクセサリー1つだけの小さな絵（コレクション表示用）
  function renderAccessoryIcon(id) {
    const x = getAccessory(id);
    if (!x) return '';
    const box = x.icon || '10 0 180 120';
    return `<svg viewBox="${box}" aria-hidden="true">${x.svg({ hairC: HAIR_COLORS[1].color })}</svg>`;
  }

  // 画面に出すパーツの順番（キャラづくりの画面はこの順に並ぶ）
  const PARTS = [
    { key: 'face', label: '顔の形', options: FACES },
    { key: 'skin', label: 'はだの色', options: SKINS, isColor: true },
    { key: 'eyes', label: '目', options: EYES },
    { key: 'brows', label: 'まゆ', options: BROWS },
    { key: 'nose', label: 'はな', options: NOSES },
    { key: 'mouth', label: '口', options: MOUTHS },
    { key: 'hair', label: 'かみがた', options: HAIRS },
    { key: 'hairColor', label: 'かみの色', options: HAIR_COLORS, isColor: true },
  ];

  const DEFAULT = { face: 0, skin: 1, eyes: 0, brows: 0, nose: 0, mouth: 0, hair: 0, hairColor: 1 };

  // 足りない・おかしい値があっても、こわれずに描けるように直す
  function normalize(a) {
    const out = {};
    PARTS.forEach((p) => {
      const v = a && Number.isInteger(a[p.key]) ? a[p.key] : DEFAULT[p.key];
      out[p.key] = ((v % p.options.length) + p.options.length) % p.options.length;
    });
    return out;
  }

  // 色を少しこくする（かげ用）
  function darken(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.round(c * (1 - amt)));
    const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // キャラの SVG を文字列で返す
  // opts.title: 読み上げ用の名前
  // opts.equipped（または avatar.equipped）: { head: 'アクセサリーid', face: 'アクセサリーid' }
  function render(avatar, opts) {
    const o = opts || {};
    // 偉人スキンをつけているときは、キャラの絵そのものがスキンの絵になる（js/skins.js）
    const skinId = o.skin !== undefined ? o.skin : (avatar && avatar.skin);
    if (skinId && window.Skins && window.Skins.get(skinId)) return window.Skins.render(skinId, o.title);
    const a = normalize(avatar);
    const skin = SKINS[a.skin].color;
    const hairC = HAIR_COLORS[a.hairColor].color;
    const hair = HAIRS[a.hair];
    const face = FACES[a.face];
    const stroke = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"`;
    const faceAttr = `fill="${skin}" ${stroke}`;

    let s = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"${o.title ? ' role="img" aria-label="' + escapeAttr(o.title) + '"' : ' aria-hidden="true"'}>`;
    // うしろがみ
    if (hair.back) s += `<g fill="${darken(hairC, 0.12)}" ${stroke}>${hair.back}</g>`;
    // 耳
    s += `<circle cx="42" cy="122" r="12" fill="${skin}" ${stroke}/><circle cx="158" cy="122" r="12" fill="${skin}" ${stroke}/>`;
    // 顔
    s += face.svg(faceAttr);
    // ほっぺ
    s += '<ellipse cx="68" cy="138" rx="10" ry="6.5" fill="#ff7fa0" opacity=".45"/><ellipse cx="132" cy="138" rx="10" ry="6.5" fill="#ff7fa0" opacity=".45"/>';
    // まゆ・目・はな・口
    s += BROWS[a.brows].svg(78, 98, -1) + BROWS[a.brows].svg(122, 98, 1);
    s += EYES[a.eyes].svg(78, 117, -1) + EYES[a.eyes].svg(122, 117, 1);
    s += NOSES[a.nose].svg();
    s += MOUTHS[a.mouth].svg();
    // 前がみ
    s += `<path d="${hair.front}" fill="${hairC}" ${stroke}/>`;
    if (!hair.noShine) s += '<path d="M70 54 Q86 45 106 47" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="6" stroke-linecap="round"/>';
    if (hair.extra) s += hair.extra;
    // アクセサリー（顔 → 頭 の順に重ねる）
    const eq = o.equipped || (avatar && avatar.equipped) || {};
    const ctx = { hairC };
    ['face', 'head'].forEach((slot) => {
      const x = getAccessory(eq[slot]);
      if (x && x.slot === slot) s += x.svg(ctx);
    });
    s += '</svg>';
    return s;
  }

  function escapeAttr(t) {
    return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function random() {
    const a = {};
    PARTS.forEach((p) => { a[p.key] = Math.floor(Math.random() * p.options.length); });
    return a;
  }

  // ---------- この iPad に保存 ----------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalize(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }
  function save(a) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(a))); } catch (e) { /* 保存できなくても続ける */ }
  }
  // いまのプレイヤーのキャラ（つけているアクセサリーこみ）
  function renderCurrent(opts) {
    const eq = window.Profile && window.Profile.equipped ? window.Profile.equipped() : {};
    const sk = window.Profile && window.Profile.skin ? window.Profile.skin() : '';
    return render(load() || DEFAULT, Object.assign({ equipped: eq, skin: sk }, opts || {}));
  }

  window.Avatar = {
    PARTS, DEFAULT, ACCESSORIES, normalize, render, random, load, save, renderCurrent,
    getAccessory, ownedAccessories, drawAccessory, RARITY, renderAccessoryIcon,
  };
})();
