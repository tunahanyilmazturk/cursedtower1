'use strict';
// Prosedürel müzik: dosya kullanmadan WebAudio ile çalınır.
// Üç ruh hâli var: harita (sakin), savaş (ritimli), patron (gergin). Mod değişince bir sonraki ölçüde geçer.

const Music = (() => {
  let ctx = null, out = null, timer = 0, mode = 'map', want = 'map', step = 0, nextT = 0, noiseBuf = null;
  const SCALE = [0, 3, 5, 7, 10, 12, 15];  // doğal minörden pentatonik + oktav
  const MODES = {
    map: { bpm: 72, root: 50, drums: 0, bass: false, arp: [0, 2, 4, 2, 5, 4, 2, 1], density: 0.55, prog: [0, -4, -2, -5] },
    battle: { bpm: 108, root: 45, drums: 1, bass: true, arp: [0, 2, 4, 5, 4, 2, 1, 2], density: 0.8, prog: [0, -2, -4, -5] },
    boss: { bpm: 126, root: 43, drums: 2, bass: true, arp: [0, 1, 0, 3, 0, 1, 4, 3], density: 0.95, prog: [0, 1, 0, -2] },
  };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function tone(m, t, dur, type, vol, cutoff, attack = 0.01) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = hz(m);
    f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, hp) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t); s.stop(t + dur + 0.02);
  }
  function kick(t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.3);
  }

  // i: sekizlik nota sayacı, bir ölçü = 8 adım
  function play(i, t) {
    if (i % 32 === 0) mode = want;  // mod değişimi 4 ölçüde bir, yumuşak geçiş
    const M = MODES[mode], beat = 60 / M.bpm / 2, bar = Math.floor(i / 8), k = i % 8;
    const chord = M.prog[bar % 4], root = M.root + chord;
    // pad: her ölçü başında yavaş açılan akor
    if (k === 0) for (const p of [0, 7, 15]) tone(root + p, t, beat * 8.5, 'sawtooth', 0.018, 700, beat * 2);
    // arpej
    if (Math.random() < M.density || k === 0) {
      const deg = M.arp[k], m = root + 12 + SCALE[deg % SCALE.length];
      tone(m, t, beat * 1.6, 'triangle', 0.045, 2600);
      if (mode === 'map' && k % 4 === 2) tone(m + 12, t + beat * 0.5, beat * 2, 'sine', 0.02, 4000);
    }
    // bas
    if (M.bass && k % 2 === 0) tone(root - 12, t, beat * 1.2, 'square', 0.04, 380);
    // davullar
    if (M.drums) {
      if (k === 0 || k === 5 || (M.drums > 1 && k === 3)) kick(t, 0.22);
      if (k === 4) noise(t, 0.16, 0.08, 1200);
      if (k % 2 === 1) noise(t, 0.04, M.drums > 1 ? 0.04 : 0.025, 6000);
    } else if (k === 0 && bar % 2 === 0) {
      noise(t, 1.2, 0.012, 3000);  // haritada uzak rüzgâr
    }
  }
  function schedule() {
    while (nextT < ctx.currentTime + 0.25) {
      play(step, nextT);
      nextT += 60 / MODES[mode].bpm / 2;
      step++;
    }
  }
  return {
    init(ac, dest) {
      if (ctx) return;
      ctx = ac; out = ac.createGain(); out.gain.value = 0; out.connect(dest);
    },
    start() {
      if (timer || !ctx) return;
      nextT = ctx.currentTime + 0.1; step = 0; mode = want;
      timer = setInterval(schedule, 60);
    },
    setMode(m) { want = m; },
    setVolume(v) { if (out) out.gain.setTargetAtTime(v, ctx.currentTime, 0.3); },
  };
})();
