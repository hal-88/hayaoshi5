// 効果音（Web Audio API でその場で作る。音声ファイルは使わない）
(function () {
  let ctx = null;
  let master = null;
  let enabled = true;
  try { enabled = localStorage.getItem('hayaoshi5.sound') !== 'off'; } catch (e) { /* 保存できなくても動く */ }

  // iPad の Safari は、画面をタップしたときにしか音を出せないので、
  // 「はじめる」ボタンを押したときにこれを呼ぶ。
  function unlock() {
    try {
      // iPad のマナーモードでも音が出るようにする（対応している Safari のみ）
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch (e) { /* 対応していなければ何もしない */ }
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    // 無音を1回鳴らして、確実に音を出せる状態にする
    const b = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(master);
    src.start(0);
  }

  function ready() { return enabled && ctx && ctx.state === 'running'; }

  // 1つの音を鳴らす小さな道具
  function tone(freq, start, dur, opt) {
    const o = Object.assign({ type: 'sine', vol: 0.6, attack: 0.005, endFreq: null, filter: null }, opt || {});
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type;
    osc.frequency.setValueAtTime(freq, t0);
    if (o.endFreq) osc.frequency.exponentialRampToValueAtTime(o.endFreq, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol, t0 + o.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.filter;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  const sounds = {
    // 早押し「ピコーン！」
    buzz() {
      tone(1400, 0, 0.09, { type: 'square', vol: 0.25 });
      tone(2100, 0.08, 0.55, { type: 'square', vol: 0.22, filter: 5000 });
      tone(4200, 0.08, 0.4, { type: 'sine', vol: 0.12 });
    },
    // 正解「ピンポーン」
    correct() {
      tone(1319, 0, 0.5, { type: 'triangle', vol: 0.7 });
      tone(2638, 0, 0.3, { type: 'sine', vol: 0.12 });
      tone(1047, 0.32, 1.1, { type: 'triangle', vol: 0.7 });
      tone(2094, 0.32, 0.8, { type: 'sine', vol: 0.12 });
    },
    // 不正解「ブブー」
    wrong() {
      tone(140, 0, 0.22, { type: 'sawtooth', vol: 0.35, filter: 1200 });
      tone(146, 0, 0.22, { type: 'square', vol: 0.15, filter: 900 });
      tone(140, 0.28, 0.6, { type: 'sawtooth', vol: 0.35, filter: 1200 });
      tone(146, 0.28, 0.6, { type: 'square', vol: 0.15, filter: 900 });
    },
    // カウント「ピッ」
    beep() { tone(1760, 0, 0.12, { type: 'square', vol: 0.18, filter: 4000 }); },
    // 時間切れ
    timeup() {
      tone(880, 0, 0.25, { type: 'square', vol: 0.15, filter: 3000 });
      tone(660, 0.25, 0.25, { type: 'square', vol: 0.15, filter: 3000 });
      tone(440, 0.5, 0.6, { type: 'square', vol: 0.15, filter: 3000 });
    },
    // 「第○問」
    intro() {
      tone(784, 0, 0.12, { type: 'triangle', vol: 0.35 });
      tone(1175, 0.12, 0.3, { type: 'triangle', vol: 0.35 });
    },
    // ファンファーレ風（スタート・結果）
    fanfare() {
      const notes = [[523, 0, 0.14], [523, 0.15, 0.14], [523, 0.3, 0.14], [659, 0.45, 0.5], [523, 0.95, 0.2], [659, 1.15, 0.2], [784, 1.35, 0.9]];
      notes.forEach(([f, s, d]) => {
        tone(f, s, d, { type: 'sawtooth', vol: 0.22, filter: 2200, attack: 0.02 });
        tone(f * 2, s, d, { type: 'triangle', vol: 0.1, attack: 0.02 });
      });
      tone(262, 1.35, 0.9, { type: 'triangle', vol: 0.3 });
    },
    // ボタンを押したときの小さな音
    tap() { tone(1200, 0, 0.05, { type: 'sine', vol: 0.15 }); },
    // ベスト記録こうしん（キラキラ）
    sparkle() {
      [1568, 1976, 2349, 3136, 2637, 3520].forEach((f, i) => tone(f, i * 0.07, 0.35, { type: 'sine', vol: 0.18 }));
    },
  };

  function play(name) {
    if (!ready() || !sounds[name]) return;
    try { sounds[name](); } catch (e) { /* 音が出なくてもゲームは止めない */ }
  }

  function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem('hayaoshi5.sound', on ? 'on' : 'off'); } catch (e) { /* なにもしない */ }
  }

  window.Sound = { unlock, play, setEnabled, isEnabled: () => enabled };
})();
