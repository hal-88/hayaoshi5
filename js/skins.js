// 偉人スキン（歴史イベントのガチャでゲット）
// スキンをつけると、キャラの絵そのものが偉人のイラストにかわる。どれもオリジナルの絵。
// Skins.render(id) で、キャラと同じ大きさ（200×200）の SVG を返す。
(function () {
  const INK = '#3a2a5e';
  const SK = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"`;
  const SK2 = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"`;
  const SKIN = '#ffe1c8';
  const BLACK = '#2e2436';

  // ---- 共通のパーツ ----
  const cloth = (fill, wide) => `<path d="M${wide ? 14 : 26} 204 C${wide ? 18 : 30} 168 ${wide ? 56 : 62} 154 100 154 C${wide ? 144 : 138} 154 ${wide ? 182 : 170} 168 ${wide ? 186 : 174} 204Z" fill="${fill}" ${SK}/>`;
  const head = (skin) => `<circle cx="46" cy="116" r="11" fill="${skin || SKIN}" ${SK}/><circle cx="154" cy="116" r="11" fill="${skin || SKIN}" ${SK}/><circle cx="100" cy="110" r="54" fill="${skin || SKIN}" ${SK}/>`;
  const cheeks = '<ellipse cx="70" cy="128" rx="9" ry="5.5" fill="#ff7fa0" opacity=".4"/><ellipse cx="130" cy="128" rx="9" ry="5.5" fill="#ff7fa0" opacity=".4"/>';
  const EYES = {
    dot: `<circle cx="80" cy="112" r="6.5" fill="${INK}"/><circle cx="120" cy="112" r="6.5" fill="${INK}"/><circle cx="82" cy="110" r="2.2" fill="#fff"/><circle cx="122" cy="110" r="2.2" fill="#fff"/><circle cx="78" cy="115" r="1.1" fill="#fff"/><circle cx="118" cy="115" r="1.1" fill="#fff"/>`,
    lady: `<circle cx="80" cy="112" r="6.5" fill="${INK}"/><circle cx="120" cy="112" r="6.5" fill="${INK}"/><circle cx="82" cy="110" r="2.2" fill="#fff"/><circle cx="122" cy="110" r="2.2" fill="#fff"/><path d="M73 108 L68 104 M127 108 L132 104" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`,
    up: `<circle cx="80" cy="110" r="6.5" fill="${INK}"/><circle cx="120" cy="110" r="6.5" fill="${INK}"/><circle cx="81" cy="107" r="2.4" fill="#fff"/><circle cx="121" cy="107" r="2.4" fill="#fff"/><circle cx="78" cy="113" r="1.1" fill="#fff"/><circle cx="118" cy="113" r="1.1" fill="#fff"/>`,
    smile: `<path d="M72 114 Q80 105 88 114 M112 114 Q120 105 128 114" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`,
    sharp: `<ellipse cx="80" cy="113" rx="7" ry="5" fill="${INK}" transform="rotate(10 80 113)"/><ellipse cx="120" cy="113" rx="7" ry="5" fill="${INK}" transform="rotate(-10 120 113)"/><circle cx="82" cy="111" r="1.8" fill="#fff"/><circle cx="122" cy="111" r="1.8" fill="#fff"/>`,
  };
  const BROWS = {
    soft: `<path d="M70 98 Q80 93 90 98 M110 98 Q120 93 130 98" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
    stern: `<path d="M68 94 L91 101 M132 94 L109 101" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
    gray: `<path d="M68 96 Q80 90 92 97 M108 97 Q120 90 132 96" fill="none" stroke="#8f8fa0" stroke-width="6" stroke-linecap="round"/>`,
  };
  const MOUTH = {
    smile: `<path d="M88 136 Q100 147 112 136" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    line: `<path d="M90 140 L110 140" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    open: `<path d="M86 134 L114 134 Q112 152 100 152 Q88 152 86 134Z" fill="#8a2346" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  };
  const nose = `<path d="M97 124 Q100 128 103 124" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" opacity=".6"/>`;
  const face = (o) => (o.cheeks === false ? '' : cheeks) + BROWS[o.brows || 'soft'] + EYES[o.eyes || 'dot'] + nose + MOUTH[o.mouth || 'smile'];
  // ちょんまげ（そった頭のてっぺん＋よこの髪＋まげ）
  const chonmage = (hair) => `<path d="M48 120 C40 90 50 70 68 62 C64 80 62 98 64 118Z" fill="${hair}" ${SK}/><path d="M152 120 C160 90 150 70 132 62 C136 80 138 98 136 118Z" fill="${hair}" ${SK}/><ellipse cx="100" cy="68" rx="32" ry="12" fill="#6a8fb5" opacity=".18"/><path d="M93 60 L93 38 Q100 30 107 38 L107 60Z" fill="${hair}" ${SK}/><path d="M91 50 L109 50" stroke="#fff" stroke-width="3" opacity=".6"/>`;
  // スーパーレアのうしろの光
  const glow = '<circle cx="100" cy="100" r="100" fill="url(#skglow)"/><g fill="#fff6c9" opacity=".9"><path d="M30 40 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z"/><path d="M168 54 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z"/><path d="M160 150 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z"/></g>';
  const glowDef = '<defs><radialGradient id="skglow"><stop offset="0" stop-color="#fff3b0"/><stop offset=".7" stop-color="#ffd65c"/><stop offset="1" stop-color="#f5b82e"/></radialGradient></defs>';
  // 平安時代の長いかみ（うしろ）と前がみ
  const heianBack = `<path d="M28 204 C16 122 34 50 100 46 C166 50 184 122 172 204Z" fill="${BLACK}" ${SK}/>`;
  const heianFront = `<path d="M46 110 C44 64 70 48 100 48 C130 48 156 64 154 110 C146 84 122 70 100 66 C78 70 54 84 46 110Z" fill="${BLACK}" ${SK}/>`;

  // ---- 作りこみ用のパーツ ----
  // かみや ぼうしの つや
  const shine = (d) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".35"/>`;
  // 着物のえり（外がわの色と、内がわの白）
  const eri = (outer, inner) => `<path d="M70 157 L100 198 L130 157 L121 155 L100 184 L79 155Z" fill="${outer}" ${SK2}/><path d="M79 155 L100 184 L121 155 L113 154 L100 172 L87 154Z" fill="${inner || '#fff'}" ${SK2}/>`;
  // そでの しわ
  const folds = `<path d="M46 188 Q54 180 58 194 M154 188 Q146 180 142 194" fill="none" stroke="${INK}" stroke-width="2" opacity=".3" stroke-linecap="round"/>`;
  // 光のすじ（うしろ）
  const rays = (color, op) => {
    let d = '';
    for (let i = 0; i < 12; i++) {
      const a1 = (i * 30 - 6) * Math.PI / 180;
      const a2 = (i * 30 + 6) * Math.PI / 180;
      d += `M100 110 L${(100 + 150 * Math.cos(a1)).toFixed(1)} ${(110 + 150 * Math.sin(a1)).toFixed(1)} L${(100 + 150 * Math.cos(a2)).toFixed(1)} ${(110 + 150 * Math.sin(a2)).toFixed(1)}Z `;
    }
    return `<path d="${d}" fill="${color}" opacity="${op}"/>`;
  };
  // 家紋
  const MON = {
    // 葵（とくがわ）
    aoi: (fill) => `<circle r="12" fill="#fff" ${SK2}/><g fill="${fill}"><path d="M0 0 C-6 -4 -6 -11 0 -12 C6 -11 6 -4 0 0Z"/><path d="M0 0 C-4 6 -11 6 -11 1 C-10 -4 -4 -4 0 0Z"/><path d="M0 0 C4 6 11 6 11 1 C10 -4 4 -4 0 0Z"/></g>`,
    // 木瓜（おだ）
    mokko: (fill) => `<g fill="${fill}" stroke="${INK}" stroke-width="1.8"><circle cx="0" cy="-6" r="6"/><circle cx="6" cy="0" r="6"/><circle cx="0" cy="6" r="6"/><circle cx="-6" cy="0" r="6"/></g><circle r="4" fill="${INK}"/><circle r="1.6" fill="${fill}"/>`,
    // 笹竜胆（みなもと）
    rindo: (fill) => `<g fill="${fill}" stroke="${INK}" stroke-width="1.5"><ellipse cx="0" cy="-7" rx="3" ry="6"/><ellipse cx="0" cy="-7" rx="3" ry="6" transform="rotate(-38)"/><ellipse cx="0" cy="-7" rx="3" ry="6" transform="rotate(38)"/><path d="M0 1 Q-11 2 -13 9 Q-4 9 0 1Z"/><path d="M0 1 Q11 2 13 9 Q4 9 0 1Z"/></g>`,
  };
  const mon = (kind, x, y, sc, fill) => `<g transform="translate(${x} ${y}) scale(${sc})">${MON[kind](fill)}</g>`;
  // ほのお
  const flame = (x, y, h, outer, inner) => {
    const f = (hh, w) => `M${x} ${y} C${x - w} ${y - 4} ${x - w * 0.8} ${y - hh * 0.55} ${x} ${y - hh} C${x + w * 0.15} ${y - hh * 0.6} ${x + w} ${y - hh * 0.45} ${x + w * 0.6} ${y - hh * 0.2} C${x + w * 0.9} ${y - 4} ${x + w * 0.4} ${y} ${x} ${y}Z`;
    return `<path d="${f(h, h * 0.28)}" fill="${outer}"/><path d="${f(h * 0.55, h * 0.16)}" fill="${inner}"/>`;
  };
  // ひょうたん
  const gourd = (x, y, sc) => `<g transform="translate(${x} ${y}) scale(${sc})" stroke="#b7811c" stroke-width="2"><circle cx="0" cy="0" r="8" fill="#f2c14e"/><circle cx="0" cy="-11" r="5.5" fill="#f2c14e"/><path d="M-3 -10 Q0 -7 3 -10" fill="none" stroke="#e0503f" stroke-width="2.5"/><path d="M0 -16 L0 -20" stroke="#9a6334" stroke-width="3" stroke-linecap="round"/></g>`;
  // 小さなキラキラ
  const twinkle = (x, y, r, fill) => `<path d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3}Z" fill="${fill}"/>`;

  // ---- うしろの けしき（キャラの円の中に見える） ----
  const SCENE = {
    // 太陽の光
    himiko: () => rays('#ffc95c', 0.45) + twinkle(28, 60, 6, '#fff') + twinkle(172, 62, 6, '#fff'),
    // 五重塔（法隆寺）
    shotoku: () => {
      let g = `<path d="M27 20 L27 44" stroke="#9fb4d8" stroke-width="3"/><g fill="#c9d8ef" stroke="#9fb4d8" stroke-width="2" stroke-linejoin="round"><rect x="20" y="44" width="14" height="110"/>`;
      for (let i = 0; i < 5; i++) {
        const hw = 11 + i * 3;
        const y = 50 + i * 22;
        g += `<path d="M${27 - hw} ${y} L${27 + hw} ${y} L${27 + hw - 6} ${y - 8} L${27 - hw + 6} ${y - 8}Z"/>`;
      }
      return g + `</g><path d="M150 30 Q170 24 186 34 M156 46 Q172 40 190 50" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".8"/>`;
    },
    // 藤の花
    murasaki: () => {
      const fuji = (x, y) => `<path d="M${x - 8} ${y - 6} Q${x} ${y - 12} ${x + 8} ${y - 6}" fill="none" stroke="#6bb36b" stroke-width="4" stroke-linecap="round"/>` +
        `<g stroke="#9c7ae0" stroke-width="1.5"><circle cx="${x - 5}" cy="${y}" r="5.5" fill="#c7a6ff"/><circle cx="${x + 5}" cy="${y}" r="5.5" fill="#b38cff"/><circle cx="${x}" cy="${y + 9}" r="5" fill="#c7a6ff"/><circle cx="${x - 3}" cy="${y + 17}" r="4.5" fill="#b38cff"/><circle cx="${x + 2}" cy="${y + 24}" r="3.8" fill="#c7a6ff"/><circle cx="${x}" cy="${y + 30}" r="3" fill="#b38cff"/></g>`;
      return fuji(32, 40) + fuji(56, 20) + fuji(144, 20) + fuji(168, 40);
    },
    // 春は あけぼの（山と むらさきの雲）
    seisho: () => `<path d="M0 0 H200 V120 H0Z" fill="#ffd9c4" opacity=".6"/><path d="M6 54 Q40 40 74 52 M128 42 Q162 30 196 46 M12 78 Q30 70 48 76" fill="none" stroke="#cdb4f0" stroke-width="10" stroke-linecap="round"/>` +
      `<path d="M0 150 L30 112 L52 130 L74 104 L100 140 L126 100 L150 128 L172 108 L200 146 L200 200 L0 200Z" fill="#d9c2e8" stroke="#bfa3d6" stroke-width="2"/>`,
    // 帆船と 海（ザビエル）
    ino: () => `<path d="M0 168 q12.5 -8 25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 V200 H0Z" fill="#b8d8f5"/>` +
      `<path d="M32 42 L32 86" stroke="${INK}" stroke-width="2.5"/><path d="M32 46 L52 54 L50 80 L32 82Z" fill="#fff" ${SK2}/><path d="M42 58 L42 76 M35 65 L49 65" stroke="#e0503f" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M12 86 L54 86 L47 98 L18 98Z" fill="#9a6334" ${SK2}/><path d="M6 102 q8 -5 16 0 t16 0 t16 0" fill="none" stroke="#7fb3e6" stroke-width="2.5" stroke-linecap="round"/>` +
      twinkle(166, 46, 7, '#fff') + twinkle(182, 76, 4.5, '#fff') + twinkle(150, 28, 4, '#fff'),
    // 鎌倉の山
    yoritomo: () => `<path d="M0 136 Q30 106 60 128 Q80 116 100 128 Q120 116 140 128 Q170 106 200 136 L200 200 L0 200Z" fill="#c7e0bb" stroke="#a8cc98" stroke-width="2"/>` +
      `<g opacity=".5">${mon('rindo', 30, 66, 1.3, '#a8cc98')}${mon('rindo', 170, 66, 1.3, '#a8cc98')}</g>`,
    // 金閣と 池
    yoshimitsu: () => {
      const x = 172;
      const tier = (y, rw, fw, fh) => `<path d="M${x - rw} ${y + 6} L${x + rw} ${y + 6} L${x + rw - 5} ${y} L${x - rw + 5} ${y}Z" fill="#e8b23a"/><rect x="${x - fw}" y="${y + 6}" width="${fw * 2}" height="${fh}" fill="#f8d66d"/>`;
      return `<g stroke="#b7811c" stroke-width="1.8" stroke-linejoin="round">` + tier(42, 12, 8, 12) + tier(60, 15, 11, 14) + tier(80, 17, 13, 16) + `</g>` +
        `<path d="M${x} 42 L${x} 34" stroke="#b7811c" stroke-width="2.5"/>${twinkle(x, 31, 4, '#f2c14e')}` +
        `<path d="M150 108 H196 M154 116 H190 M160 124 H186" stroke="#7fb3e6" stroke-width="3" stroke-linecap="round" opacity=".8"/>` +
        `<g fill="#6bb36b" opacity=".5"><circle cx="24" cy="80" r="14"/><circle cx="36" cy="64" r="12"/><circle cx="18" cy="104" r="10"/></g>`;
    },
    // 黒船
    perry: () => `<g fill="#9aa3b8" opacity=".75"><circle cx="30" cy="70" r="6"/><circle cx="37" cy="58" r="7.5"/><circle cx="31" cy="45" r="6.5"/></g>` +
      `<path d="M16 100 L16 60" stroke="${INK}" stroke-width="2"/><rect x="26" y="76" width="7" height="24" fill="${BLACK}"/>` +
      `<path d="M8 100 L48 100 L42 114 L14 114Z" fill="${BLACK}" ${SK2}/><path d="M22 100 A8 8 0 0 1 38 100Z" fill="#5b5770" ${SK2}/><path d="M14 106 H44" stroke="#ffc93c" stroke-width="2"/>` +
      `<path d="M4 120 q8 -5 16 0 t16 0 t16 0" fill="none" stroke="#7fb3e6" stroke-width="2.5" stroke-linecap="round"/>` +
      `<path d="M150 40 Q166 30 186 40 M156 58 Q170 52 190 60" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".8"/>`,
    // 本と 洋館のまど
    fukuzawa: () => `<g ${SK2}><rect x="10" y="66" width="34" height="10" rx="2" fill="#3f7d4f"/><rect x="14" y="76" width="28" height="10" rx="2" fill="#e0503f"/><rect x="11" y="86" width="33" height="10" rx="2" fill="#4d9dff"/></g><path d="M16 71 H38 M20 81 H36 M17 91 H38" stroke="#fff" stroke-width="1.5" opacity=".7"/>` +
      `<path d="M158 98 L158 64 A12 12 0 0 1 182 64 L182 98Z" fill="#cfe3f5" stroke="#b59a6a" stroke-width="3"/><path d="M170 54 V98 M158 76 H182" stroke="#b59a6a" stroke-width="2.5"/>`,
    // ほのお（スーパーレアは光のあとに重ねる）
    nobunaga: () => flame(22, 154, 64, '#ff6b3d', '#ffd23f') + flame(178, 154, 64, '#ff6b3d', '#ffd23f') + flame(36, 96, 34, '#ff8a3d', '#ffe27a') + flame(164, 96, 34, '#ff8a3d', '#ffe27a'),
    // 千成びょうたん
    hideyoshi: () => gourd(28, 80, 1) + gourd(20, 124, 0.9) + gourd(172, 80, 1) + gourd(180, 124, 0.9),
    // 葵の紋
    ieyasu: () => `<g opacity=".45">${mon('aoi', 28, 70, 1.1, '#3f7d4f')}${mon('aoi', 172, 70, 1.1, '#3f7d4f')}</g>`,
  };

  const SKINS = [
    // ---- ふつう ----
    { id: 'himiko', name: '卑弥呼', rarity: 'n', bg: '#fff0c9',
      svg: () => `<path d="M36 200 C24 120 40 52 100 48 C160 52 176 120 164 200Z" fill="${BLACK}" ${SK}/>` + cloth('#fffaf0') +
        `<path d="M54 196 l8 -8 8 8 8 -8 8 8 8 -8 8 8 8 -8 8 8 8 -8 8 8 8 -8 8 8" fill="none" stroke="#e0503f" stroke-width="3.5" stroke-linejoin="round"/>` +
        `<path d="M82 156 L100 180 L118 156" fill="none" stroke="#e0503f" stroke-width="6" stroke-linejoin="round"/>` + head() + face({ eyes: 'lady' }) +
        `<path d="M46 104 C44 62 70 48 100 48 C130 48 156 62 154 104 L150 86 L50 86Z" fill="${BLACK}" ${SK}/>` + shine('M66 64 Q80 56 94 56') +
        `<path d="M50 80 Q100 64 150 80" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M50 80 Q100 64 150 80" fill="none" stroke="#ffc93c" stroke-width="5" stroke-linecap="round"/><circle cx="100" cy="70" r="6" fill="#ff4f4f" ${SK2}/><circle cx="74" cy="76" r="3" fill="#2ec4a6"/><circle cx="126" cy="76" r="3" fill="#2ec4a6"/>` +
        `<g fill="#2ec4a6" ${SK2}><path d="M44 128 a5 5 0 1 1 5 5 q-3 3 -7 2z"/><path d="M152 128 a5 5 0 1 1 5 5 q-3 3 -7 2z"/></g>` +
        `<path d="M70 164 Q100 184 130 164" fill="none" stroke="${INK}" stroke-width="2"/><g fill="#2ec4a6" ${SK2}><path d="M78 168 a6 6 0 1 1 6 6 q-4 4 -8 2z"/><path d="M96 176 a6 6 0 1 1 6 6 q-4 4 -8 2z"/><path d="M114 168 a6 6 0 1 1 6 6 q-4 4 -8 2z"/></g>` +
        `<circle cx="152" cy="182" r="15" fill="#f2c14e" ${SK}/><circle cx="152" cy="182" r="9" fill="none" stroke="#c78f1e" stroke-width="2"/><circle cx="152" cy="182" r="3" fill="#c78f1e"/><path d="M144 174 Q148 171 152 172" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>` },
    { id: 'shotoku', name: '聖徳太子', rarity: 'n', bg: '#e4eefc',
      svg: () => cloth('#e9a64a') + folds + `<path d="M76 155 Q100 172 124 155 L118 153 Q100 164 82 153Z" fill="#fff" ${SK2}/><path d="M74 158 Q100 178 126 158" fill="none" stroke="${INK}" stroke-width="3"/>` +
        `<path d="M64 194 L136 194" stroke="#c97c22" stroke-width="5" opacity=".6"/>` + head() + face({ mouth: 'line' }) +
        `<path d="M86 131 Q93 126 100 130 Q107 126 114 131" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M96 152 Q100 160 104 152" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M48 118 C44 96 52 80 64 74 L64 112Z M152 118 C156 96 148 80 136 74 L136 112Z" fill="${BLACK}" ${SK}/>` +
        `<path d="M100 42 C104 24 118 16 130 22" fill="none" stroke="${BLACK}" stroke-width="8" stroke-linecap="round"/><path d="M64 76 C64 52 80 40 100 40 C120 40 136 52 136 76Z" fill="${BLACK}" ${SK}/><rect x="60" y="70" width="80" height="12" rx="5" fill="${BLACK}" ${SK}/>` + shine('M76 56 Q86 46 98 45') +
        `<rect x="140" y="138" width="13" height="58" rx="5" fill="#e8c98a" ${SK} transform="rotate(12 146 166)"/><circle cx="144" cy="180" r="8" fill="${SKIN}" ${SK2}/>` },
    { id: 'murasaki', name: '紫式部', rarity: 'n', bg: '#f3ecff',
      svg: () => heianBack + cloth('#8c6bff') + `<g fill="#b9a2ff" opacity=".7"><circle cx="50" cy="186" r="3"/><circle cx="62" cy="196" r="3"/><circle cx="150" cy="186" r="3"/><circle cx="138" cy="196" r="3"/></g>` +
        `<path d="M52 204 L100 152 L148 204Z" fill="#6bb36b" ${SK}/><path d="M58 204 L100 156 L142 204Z" fill="#ff8fbc" ${SK}/><path d="M72 204 L100 168 L128 204Z" fill="#fff" ${SK}/><path d="M84 204 L100 180 L116 204Z" fill="#8c6bff" ${SK}/>` +
        head() + face({ eyes: 'smile' }) + heianFront + shine('M62 66 Q78 54 96 52') +
        `<g transform="rotate(-10 46 182)"><rect x="26" y="170" width="40" height="26" rx="3" fill="#fffaf0" ${SK2}/><path d="M34 178 V190 M42 178 V190 M50 178 V188 M58 178 V186" stroke="${INK}" stroke-width="1.8" opacity=".45"/></g>` +
        `<path d="M148 176 L170 132" stroke="#9a6334" stroke-width="6" stroke-linecap="round"/><path d="M170 132 L175 122" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>` },
    { id: 'seisho', name: '清少納言', rarity: 'n', bg: '#ffeadd',
      svg: () => heianBack + cloth('#e0503f') + `<g fill="#ff9a8a" opacity=".7"><circle cx="50" cy="186" r="3"/><circle cx="62" cy="196" r="3"/><circle cx="150" cy="186" r="3"/><circle cx="138" cy="196" r="3"/></g>` +
        `<path d="M52 204 L100 152 L148 204Z" fill="#4d9dff" ${SK}/><path d="M58 204 L100 156 L142 204Z" fill="#ff8a3d" ${SK}/><path d="M72 204 L100 168 L128 204Z" fill="#ffd23f" ${SK}/><path d="M84 204 L100 180 L116 204Z" fill="#e0503f" ${SK}/>` +
        head() + face({ mouth: 'open', eyes: 'lady' }) + heianFront + shine('M62 66 Q78 54 96 52') +
        `<path d="M134 186 L160 140 Q184 156 180 188 Z" fill="#ffd23f" ${SK}/><path d="M134 186 L166 148 M134 186 L174 160 M134 186 L178 174" stroke="#e8a90c" stroke-width="2.5"/><path d="M160 140 Q184 156 180 188" fill="none" stroke="#e0503f" stroke-width="3"/><circle cx="134" cy="186" r="4" fill="${INK}"/><path d="M134 190 Q128 198 132 204" fill="none" stroke="#ff8fbc" stroke-width="3" stroke-linecap="round"/>` },
    // もとは伊能忠敬。すでに持っている子の記録をそのまま使えるように、id は ino のまま
    { id: 'ino', name: 'ザビエル', rarity: 'n', bg: '#e3f1ff',
      svg: () => cloth('#2b2436') + folds + `<path d="M80 154 Q100 166 120 154" fill="none" stroke="#4a4060" stroke-width="7" stroke-linecap="round"/>` +
        `<path d="M84 158 Q100 174 116 158" fill="none" stroke="#f2c14e" stroke-width="2.5"/><path d="M100 172 L100 196 M91 181 L109 181" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M100 172 L100 196 M91 181 L109 181" stroke="#f2c14e" stroke-width="4" stroke-linecap="round"/>` +
        head() +
        `<path d="M56 126 C58 158 80 174 100 174 C120 174 142 158 144 126 C136 148 120 158 100 158 C80 158 64 148 56 126Z" fill="#5a3a26" ${SK}/>` +
        face({ eyes: 'up', mouth: 'smile', cheeks: false }) + `<ellipse cx="70" cy="126" rx="8" ry="5" fill="#ff7fa0" opacity=".3"/><ellipse cx="130" cy="126" rx="8" ry="5" fill="#ff7fa0" opacity=".3"/>` +
        `<path d="M85 134 Q93 128 100 133 Q107 128 115 134" fill="none" stroke="#5a3a26" stroke-width="4.5" stroke-linecap="round"/>` +
        `<path d="M48 122 C42 100 46 84 60 76 L66 84 C62 96 62 108 64 120Z M152 122 C158 100 154 84 140 76 L134 84 C138 96 138 108 136 120Z" fill="#5a3a26" ${SK}/>` +
        `<path d="M58 84 Q100 64 142 84" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="M58 84 Q100 64 142 84" fill="none" stroke="#5a3a26" stroke-width="9" stroke-linecap="round"/>` +
        `<ellipse cx="92" cy="64" rx="14" ry="5" fill="#fff" opacity=".55"/>` },
    // ---- レア ----
    { id: 'yoritomo', name: '源頼朝', rarity: 'r', bg: '#e7f2e1',
      svg: () => cloth('#3b3473', true) + folds + eri('#2b2463') + mon('rindo', 50, 182, 0.9, '#ffc93c') + mon('rindo', 150, 182, 0.9, '#ffc93c') + head() + face({ brows: 'stern', eyes: 'sharp', mouth: 'line' }) +
        `<path d="M84 132 Q92 127 100 131 Q108 127 116 132" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/><path d="M95 150 Q100 162 105 150" fill="${INK}"/>` +
        `<path d="M50 116 C46 94 54 80 66 74 L66 112Z M150 116 C154 94 146 80 134 74 L134 112Z" fill="${BLACK}" ${SK}/>` +
        `<path d="M68 76 C62 44 72 12 100 6 C124 2 132 30 132 76Z" fill="${BLACK}" ${SK}/><path d="M66 70 Q100 62 134 70 L134 80 Q100 72 66 80Z" fill="${BLACK}" ${SK}/>` + shine('M80 50 Q84 26 98 16') +
        `<rect x="140" y="146" width="12" height="54" rx="4" fill="#e8c98a" ${SK} transform="rotate(10 146 172)"/>` },
    { id: 'yoshimitsu', name: '足利義満', rarity: 'r', bg: '#fff3d4',
      svg: () => cloth('#5b5770') + folds + `<path d="M84 154 L100 176 L116 154" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>` +
        `<path d="M52 176 L156 204 L132 204 L44 188Z" fill="#ffc93c" ${SK}/><path d="M60 182 L140 204" stroke="#e8a90c" stroke-width="2.5" stroke-dasharray="6 5"/><circle cx="62" cy="182" r="7" fill="#fff" stroke="#e8a90c" stroke-width="3"/>` +
        head() + face({ eyes: 'smile' }) +
        `<ellipse cx="100" cy="70" rx="34" ry="13" fill="#6a8fb5" opacity=".18"/><path d="M74 66 Q86 58 100 58" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/>` +
        `<g fill="#9a6334" ${SK2}><circle cx="140" cy="160" r="5"/><circle cx="148" cy="170" r="5"/><circle cx="152" cy="182" r="5"/><circle cx="150" cy="194" r="5"/></g><circle cx="146" cy="200" r="4" fill="#e0503f" ${SK2}/>` },
    { id: 'perry', name: 'ペリー', rarity: 'r', bg: '#dbe8f5',
      svg: () => cloth('#1f2a5c', true) + `<path d="M84 154 L100 172 L116 154Z" fill="#fff" ${SK}/><path d="M96 162 L104 162 L106 176 L94 176Z" fill="${BLACK}"/><path d="M76 156 L84 154 L100 172 L90 174Z M124 156 L116 154 L100 172 L110 174Z" fill="#ffc93c" opacity=".85"/>` +
        `<rect x="20" y="166" width="40" height="12" rx="5" fill="#ffc93c" ${SK} transform="rotate(-18 40 172)"/><rect x="140" y="166" width="40" height="12" rx="5" fill="#ffc93c" ${SK} transform="rotate(18 160 172)"/><g stroke="#e8a90c" stroke-width="2"><path d="M26 178 l-2 10 M34 176 l-1 10 M42 174 l0 10 M174 178 l2 10 M166 176 l1 10 M158 174 l0 10"/></g>` +
        `<g fill="#ffc93c" ${SK2}><circle cx="100" cy="186" r="4"/><circle cx="100" cy="198" r="4"/></g><g ${SK2}><rect x="60" y="182" width="14" height="6" rx="2" fill="#e0503f"/><rect x="60" y="190" width="14" height="6" rx="2" fill="#4d9dff"/></g>` +
        head('#ffe9d8') + face({ brows: 'gray', eyes: 'sharp', mouth: 'line', cheeks: false }) +
        `<path d="M46 98 C40 126 50 150 70 152 C66 134 64 118 64 100Z" fill="#e9e9ef" ${SK}/><path d="M154 98 C160 126 150 150 130 152 C134 134 136 118 136 100Z" fill="#e9e9ef" ${SK}/>` +
        `<path d="M52 90 C54 66 72 56 84 58 C78 66 76 74 76 82 C70 82 60 86 52 90Z M148 90 C146 66 128 56 116 58 C122 66 124 74 124 82 C130 82 140 86 148 90Z" fill="#e9e9ef" ${SK}/><path d="M84 60 Q100 54 116 60" fill="none" stroke="#c9c9d6" stroke-width="5" stroke-linecap="round"/>` },
    { id: 'fukuzawa', name: '福沢諭吉', rarity: 'r', bg: '#f4ecdb',
      svg: () => cloth('#2e2436') + folds + `<path d="M80 154 L100 182 L120 154" fill="#8f8fa0" ${SK}/><path d="M86 154 L100 174 L114 154" fill="none" stroke="#fff" stroke-width="4"/>` +
        `<circle cx="66" cy="176" r="6" fill="#fff" ${SK2}/><circle cx="66" cy="176" r="2.5" fill="#2e2436"/><path d="M94 186 Q100 180 106 186 Q100 192 94 186Z M100 186 L96 198 M100 186 L104 198" fill="#fff" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>` +
        head() + face({}) +
        `<path d="M46 108 C42 66 66 50 100 50 C134 50 158 66 154 108 C150 92 140 80 124 76 C108 80 80 82 60 74 C52 84 48 96 46 108Z" fill="${BLACK}" ${SK}/>` + shine('M68 62 Q86 52 104 54') +
        `<rect x="132" y="160" width="34" height="40" rx="3" fill="#4d9dff" ${SK} transform="rotate(-8 149 180)"/><path d="M140 170 L160 168 M140 178 L160 176" stroke="#fff" stroke-width="2.5" transform="rotate(-8 149 180)"/>` },
    // ---- スーパーレア（光の上に けしきを重ねる） ----
    { id: 'nobunaga', name: '織田信長', rarity: 'sr',
      svg: () => glowDef + glow + SCENE.nobunaga() + `<path d="M10 204 C14 160 52 146 100 146 C148 146 186 160 190 204Z" fill="#e0503f" ${SK}/><path d="M10 204 C14 160 52 146 100 146 C148 146 186 160 190 204" fill="none" stroke="#ffc93c" stroke-width="5"/>` +
        cloth(BLACK) + eri('#e0503f') + mon('mokko', 66, 184, 0.85, '#ffc93c') + mon('mokko', 134, 184, 0.85, '#ffc93c') +
        head() + face({ brows: 'stern', eyes: 'sharp', mouth: 'line', cheeks: false }) +
        `<path d="M80 133 Q90 126 100 131 Q110 126 120 133 Q126 128 128 122 M80 133 Q74 128 72 122" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>` + chonmage(BLACK) +
        `<g transform="rotate(-35 160 172)"><path d="M112 168 L152 166 L156 178 L118 182Z" fill="#9a6334" ${SK2}/><rect x="150" y="166" width="54" height="6" rx="2" fill="#3a3a44" ${SK2}/><rect x="160" y="164" width="5" height="10" fill="#c9962a"/></g>` },
    { id: 'hideyoshi', name: '豊臣秀吉', rarity: 'sr',
      svg: () => glowDef + glow + SCENE.hideyoshi() + cloth('#ffc93c', true) + `<g fill="none" stroke="#e8a90c" stroke-width="3"><circle cx="58" cy="186" r="7"/><circle cx="142" cy="186" r="7"/><circle cx="40" cy="198" r="5"/><circle cx="160" cy="198" r="5"/></g>` + eri('#e0503f') +
        head() + face({ eyes: 'smile', mouth: 'open' }) +
        `<path d="M84 127 Q92 123 100 126 Q108 123 116 127" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/><path d="M96 156 L100 166 L104 156" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>` +
        `<path d="M132 58 L178 44 L180 58 L134 70Z M68 58 L22 44 L20 58 L66 70Z" fill="${BLACK}" ${SK}/><path d="M64 78 C64 48 80 36 100 36 C120 36 136 48 136 78Z" fill="${BLACK}" ${SK}/><rect x="60" y="70" width="80" height="12" rx="5" fill="${BLACK}" ${SK}/>` + shine('M76 56 Q86 44 98 42') +
        `<path d="M140 52 L172 47 M60 52 L28 47" stroke="#ffc93c" stroke-width="2.5" stroke-linecap="round"/>` },
    { id: 'ieyasu', name: '徳川家康', rarity: 'sr',
      svg: () => glowDef + glow + SCENE.ieyasu() + cloth('#3f7d4f', true) + folds + eri('#2c5e3a') +
        `<path d="M14 204 C18 168 56 154 100 154" fill="none" stroke="#ffc93c" stroke-width="3" opacity=".8"/><path d="M186 204 C182 168 144 154 100 154" fill="none" stroke="#ffc93c" stroke-width="3" opacity=".8"/>` +
        mon('aoi', 56, 184, 0.9, '#3f7d4f') + mon('aoi', 144, 184, 0.9, '#3f7d4f') +
        `<circle cx="46" cy="116" r="11" fill="${SKIN}" ${SK}/><circle cx="154" cy="116" r="11" fill="${SKIN}" ${SK}/><ellipse cx="100" cy="112" rx="58" ry="54" fill="${SKIN}" ${SK}/>` + face({ eyes: 'smile' }) +
        `<path d="M92 152 Q100 160 108 152" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` + chonmage(BLACK) +
        `<path d="M150 196 L170 150 Q192 162 190 196Z" fill="#fff" ${SK}/><circle cx="174" cy="176" r="7" fill="#e0503f"/><path d="M150 196 L176 154 M150 196 L184 162 M150 196 L189 178" stroke="#d8d2c4" stroke-width="2"/><circle cx="150" cy="196" r="4" fill="${INK}"/>` },
  ];

  const RARITY = {
    n: { label: 'ふつう', weight: 60 },
    r: { label: 'レア', weight: 30 },
    sr: { label: 'スーパーレア', weight: 10 },
  };

  function get(id) { return SKINS.find((x) => x.id === id) || null; }

  function render(id, title) {
    const x = get(id);
    if (!x) return '';
    const label = title ? ' role="img" aria-label="' + String(title).replace(/[&<>"]/g, '') + '"' : ' aria-hidden="true"';
    // ふつう・レアは うしろに けしき。スーパーレアは svg() の中で光のあとに重ねる
    const scene = x.rarity !== 'sr' && SCENE[x.id] ? SCENE[x.id]() : '';
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"${label}><rect width="200" height="200" fill="${x.bg || '#fff6dd'}"/>${scene}${x.svg()}</svg>`;
  }

  // ガチャを1回引く（minRarity が 'r' ならレア以上だけ）
  function draw(minRarity) {
    const keys = minRarity === 'r' ? ['r', 'sr'] : ['n', 'r', 'sr'];
    const total = keys.reduce((s, k) => s + RARITY[k].weight, 0);
    let x = Math.random() * total;
    let rarity = keys[keys.length - 1];
    for (const k of keys) {
      if (x < RARITY[k].weight) { rarity = k; break; }
      x -= RARITY[k].weight;
    }
    const pool = SKINS.filter((s) => s.rarity === rarity);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function owned(map) {
    const o = map || {};
    return SKINS.filter((s) => o[s.id]);
  }

  window.Skins = { SKINS, RARITY, get, render, draw, owned };
})();
