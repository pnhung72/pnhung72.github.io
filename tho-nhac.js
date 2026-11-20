/*!
 * Thơ → Nhạc  |  pnhung72
 * Nhập lời thơ, chọn điệu → tự tạo giai điệu + hòa âm phối khí → nghe thử → tải về
 * MusicXML (.musicxml / .xml) và MIDI (.mid) để mở trong Guitar Pro 8, kèm WAV và bảng hợp âm.
 * Không cần thư viện ngoài.
 * Bản tối ưu: tách chữ ở dấu …, giai điệu mượt hơn, UST có hơi thở + vibrato.
 */
(function (G) {
'use strict';

/* ================= 1. NHẠC LÝ CƠ BẢN ================= */
var SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
var FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
var MAJOR = [0,2,4,5,7,9,11], MINOR = [0,2,3,5,7,8,11];            // thứ: hòa thanh
var FIFTHS_BY_PC = {0:0,7:1,2:2,9:3,4:4,11:5,6:6,5:-1,10:-2,3:-3,8:-4,1:-5};
var QUAL = {M:[0,4,7], m:[0,3,7], '7':[0,4,7,10], m7:[0,3,7,10]};
var SUF  = {M:'', m:'m', '7':'7', m7:'m7'};
var XKIND = {M:'major', m:'minor', '7':'dominant', m7:'minor-seventh'};

function mod(n, m) { return ((n % m) + m) % m; }
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function keyInfo(pc, mode) {
  var rel = mode === 'minor' ? mod(pc + 3, 12) : pc;
  var f = FIFTHS_BY_PC[rel];
  return { pc: pc, mode: mode, fifths: f, scale: mode === 'minor' ? MINOR : MAJOR, names: f < 0 ? FLAT : SHARP };
}
function keyName(k) { return k.names[k.pc] + (k.mode === 'minor' ? 'm' : ''); }

/* ================= 2. PHÂN TÍCH LỜI THƠ ================= */
function toneOf(w) {
  var d = w.normalize('NFD');
  if (/\u0301/.test(d)) return 'sac';
  if (/\u0300/.test(d)) return 'huyen';
  if (/\u0309/.test(d)) return 'hoi';
  if (/\u0303/.test(d)) return 'nga';
  if (/\u0323/.test(d)) return 'nang';
  return 'ngang';
}
// Mỗi dòng = một câu hát, mỗi chữ = một nốt. Dòng trống = sang đoạn mới. [Tên đoạn] = đặt tên đoạn.
function parseLyrics(text) {
  var secs = [], cur = null, label = null;
  function push() { if (cur && cur.lines.length) secs.push(cur); cur = null; }
  String(text || '').split(/\r?\n/).forEach(function (raw) {
    var l = raw.trim();
    if (!l) { push(); return; }
    var m = l.match(/^\[(.+)\]$/);
    if (m) { push(); label = m[1].trim(); return; }
    var words = l.split(/[\s\-–—\/…]+|\.{2,}/).map(function (w) {
      return w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    }).filter(Boolean);
    if (!words.length) return;
    if (!cur) { cur = { label: label, lines: [] }; label = null; }
    cur.lines.push(words.map(function (w) { return { text: w, tone: toneOf(w) }; }));
  });
  push();
  secs.forEach(function (s, i) { if (!s.label) s.label = 'Đoạn ' + (i + 1); });
  return secs;
}

/* ================= 3. ĐIỆU (STYLE) ================= */
var ALL = [0,1,3,4];                     // chỉ số các nốt của thế bấm dùng khi quạt
function arp(steps, idx) { return steps.map(function (s, i) { return [s, [idx[i % idx.length]]]; }); }
var S8 = [0,2,4,6,8,10,12,14];
var STYLES = {
  ballad:   { name:'Ballad',     tempo:72,  beats:4, comp:'nylon', bass:33,
    drums:{36:[0,10],37:[4,12],42:S8}, dv:{36:80,37:52,42:46},
    bassP:[[0,8,'r'],[8,6,'5'],[14,2,'r']],
    compP:arp(S8,[0,1,2,3,4,3,2,1]) },
  slowrock: { name:'Slow rock',  tempo:76,  beats:4, comp:'clean', bass:33,
    drums:{36:[0,8,10],38:[4,12],42:S8}, dv:{36:88,38:80,42:56},
    bassP:S8.map(function (s, i) { return [s, 2, i === 6 ? '5' : 'r']; }),
    compP:[[0,ALL],[6,ALL],[8,ALL],[12,ALL]] },
  chachacha:{ name:'Chachacha',  tempo:116, beats:4, comp:'nylon', bass:33,
    drums:{36:[0,8],37:[4,12],42:S8,56:[8,12,14]}, dv:{36:84,37:70,42:50,56:60},
    bassP:[[0,6,'r'],[6,2,'r'],[8,6,'5'],[14,2,'r']],
    compP:[[2,ALL,2],[6,ALL,2],[10,ALL,2],[14,ALL,2]] },
  bolero:   { name:'Bolero',     tempo:92,  beats:4, comp:'nylon', bass:32,
    drums:{36:[0,8],37:[4,10,14],42:S8}, dv:{36:82,37:58,42:40},
    bassP:[[0,6,'r'],[6,2,'5'],[8,6,'r'],[14,2,'5']],
    compP:[[0,[0]],[4,[3]],[6,[4]],[8,[2]],[12,[3]],[14,[4]]] },
  rumba:    { name:'Rumba',      tempo:84,  beats:4, comp:'nylon', bass:32,
    drums:{36:[0,6,10],37:[4,12],42:S8}, dv:{36:80,37:56,42:42},
    bassP:[[0,6,'r'],[6,6,'5'],[12,4,'r']],
    compP:[[0,[0,3]],[2,[4]],[6,[1,3]],[8,[4]],[12,[2,4]],[14,[3]]] },
  disco:    { name:'Disco',      tempo:118, beats:4, comp:'clean', bass:33,
    drums:{36:[0,4,8,12],38:[4,12],42:[0,4,8,12],46:[2,6,10,14]}, dv:{36:92,38:84,42:60,46:62},
    bassP:S8.map(function (s, i) { return [s, 2, i % 2 ? '8' : 'r']; }),
    compP:[[2,ALL,2],[6,ALL,2],[10,ALL,2],[14,ALL,2]] },
  valse:    { name:'Valse',      tempo:96,  beats:3, comp:'nylon', bass:32,
    drums:{36:[0],37:[4,8],42:[0,4,8]}, dv:{36:78,37:50,42:42},
    bassP:[[0,4,'r']],
    compP:[[4,ALL],[8,ALL]] },
  bossa:    { name:'Bossa nova', tempo:100, beats:4, comp:'nylon', bass:32,
    drums:{36:[0,10],37:[0,6,12],42:S8}, dv:{36:70,37:62,42:40},
    bassP:[[0,6,'r'],[6,6,'5'],[12,4,'r']],
    compP:[[0,ALL],[6,ALL],[10,ALL],[12,ALL]] },
  pop:      { name:'Pop rock',   tempo:100, beats:4, comp:'steel', bass:33,
    drums:{36:[0,8,10],38:[4,12],42:S8}, dv:{36:90,38:86,42:60},
    bassP:S8.map(function (s) { return [s, 2, 'r']; }),
    compP:[[0,ALL],[4,ALL],[6,ALL],[10,ALL],[12,ALL],[14,ALL]] }
};
var STYLE_ORDER = ['ballad','slowrock','chachacha','bolero','rumba','disco','valse','bossa','pop'];

// Chuỗi hợp âm: [bậc (nửa cung từ chủ âm), loại]
var PROG_MAJOR = [
  [[0,'M'],[9,'m'],[5,'M'],[7,'7']],
  [[0,'M'],[7,'M'],[9,'m'],[5,'M']],
  [[0,'M'],[5,'M'],[7,'7'],[0,'M']],
  [[9,'m'],[5,'M'],[0,'M'],[7,'7']],
  [[0,'M'],[4,'m'],[5,'M'],[7,'7']]
];
var PROG_MINOR = [
  [[0,'m'],[5,'m'],[7,'7'],[0,'m']],
  [[0,'m'],[8,'M'],[5,'m'],[7,'7']],
  [[0,'m'],[5,'m'],[8,'M'],[7,'7']],
  [[0,'m'],[8,'M'],[7,'7'],[0,'m']]
];

var GM = { nylon:24, steel:25, clean:27, piano:0, epiano:4, voice:53, flute:73, sax:65, violin:40, strings:48 };
var SYNTH = { nylon:'guitar', steel:'steel', clean:'clean', piano:'piano', epiano:'epiano',
              voice:'voice', flute:'flute', sax:'sax', violin:'violin' };

var DEFAULTS = {
  title: 'Bài thơ', lyrics: '', style: 'ballad', tonic: 9, mode: 'minor', tempo: 0,
  range: 'low', intro: 2, harmony: true, strings: true, keep: true, seed: 1,
  lead: 'voice', comp: 'auto'
};
var TONE_OFF = { ngang:0, sac:1, huyen:-1, hoi:-1, nga:1, nang:-2 };
var DRUM_NAMES = { 36:'Kick', 37:'Side stick', 38:'Snare', 42:'Hi-hat đóng', 46:'Hi-hat mở', 49:'Crash', 51:'Ride', 56:'Cowbell' };
var DRUM_DISPLAY = { 36:['F',4,'normal'], 37:['C',5,'x'], 38:['C',5,'normal'], 42:['G',5,'x'],
                     46:['G',5,'circle-x'], 49:['A',5,'x'], 51:['F',5,'x'], 56:['A',4,'triangle'] };

/* ================= 4. SINH BÀI HÁT ================= */
function spread(total, m) {                // chia total phần cho m nốt, mỗi nốt >= 1
  var out = [];
  for (var i = 0; i < m; i++) out.push(Math.floor((i + 1) * total / m) - Math.floor(i * total / m));
  return out;
}
var BAR_TABLE = {
  8: { 1:[8], 2:[4,4], 3:[2,2,4], 4:[2,2,2,2], 5:[2,2,1,1,2], 6:[2,1,1,2,1,1] },
  6: { 1:[6], 2:[3,3], 3:[2,2,2], 4:[2,1,1,2], 5:[1,1,2,1,1] }
};
function barRhythm(k, E, isLast) {          // độ dài các nốt (đơn vị móc đơn) trong 1 ô nhịp
  if (isLast) {
    if (k === 1) return [E];
    var last = Math.max(2, Math.min(E / 2, E - (k - 1)));
    return spread(E - last, k - 1).concat([last]);
  }
  return (BAR_TABLE[E] && BAR_TABLE[E][k]) || spread(E, k);
}

function generate(opts) {
  var o = Object.assign({}, DEFAULTS, opts || {});
  var st = STYLES[o.style] || STYLES.ballad;
  var barLen = st.beats * 4, E = barLen / 2, maxPer = E - 2;
  var tempo = o.tempo > 0 ? o.tempo : st.tempo;
  var key = keyInfo(o.tonic, o.mode);
  var secs = parseLyrics(o.lyrics);
  var pool = o.mode === 'minor' ? PROG_MINOR : PROG_MAJOR;
  var bars = [], spans = [];

  function mk(r, q) {
    var pc = (key.pc + r) % 12, iv = QUAL[q];
    return { r: r, q: q, pc: pc, iv: iv, pcs: iv.map(function (i) { return (pc + i) % 12; }), name: key.names[pc] + SUF[q] };
  }
  var tonicChord = mk(0, o.mode === 'minor' ? 'm' : 'M');
  var dom = mk(7, '7');
  function addBar(kind, chord, extra) {
    var b = Object.assign({ idx: bars.length, kind: kind, chord: chord }, extra || {});
    b.t = b.idx * barLen; bars.push(b); return b;
  }
  function progOf(s) { return pool[(o.seed + (o.keep ? 0 : s)) % pool.length].map(function (c) { return mk(c[0], c[1]); }); }

  // --- thang âm + âm vực giọng hát
  var scale = [];
  for (var m = 36; m <= 96; m++) if (key.scale.indexOf(mod(m - key.pc, 12)) >= 0) scale.push(m);
  var centerMidi = o.range === 'high' ? 69 : 62, center = 0, bd = 99;
  scale.forEach(function (mm, i) { if (Math.abs(mm - centerMidi) < bd) { bd = Math.abs(mm - centerMidi); center = i; } });
  var prev = center, same = 0;
  var melody = [];                                   // sự kiện giai điệu

  function setLine(sIdx, li, words, startBarIdx, isFinal) {
    var n = words.length;
    var B = Math.max(2, Math.ceil(n / maxPer)); if (B % 2) B++;
    var sizes = [], base = Math.floor(n / B), rem = n % B, i;
    for (i = 0; i < B; i++) sizes.push(base + (i < rem ? 1 : 0));
    var evs = [], w = 0;
    for (i = 0; i < B; i++) {
      var bar = bars[startBarIdx + i], k = sizes[i], rh = barRhythm(k, E, i === B - 1), off = 0;
      for (var j = 0; j < k; j++, w++) {
        evs.push({ bar: bar, t: bar.t + off * 2, d: rh[j] * 2, syl: words[w],
                   strong: (st.beats === 4 ? off % 4 === 0 : off === 0) || rh[j] >= 3,
                   last: (i === B - 1 && j === k - 1) });
        off += rh[j];
      }
    }
    var rng = mulberry32(((o.seed * 2654435761) ^ ((o.keep ? 0 : sIdx) * 40503) ^ (li * 9973) ^ (n * 131)) >>> 0);
    var lvl = [0, 1, 2, 1][li % 4];
    evs.forEach(function (ev) {
      var tone = ev.syl.tone;
      var target = center + lvl + TONE_OFF[tone];
      if (tone === 'ngang' && rng() < 0.35) target += rng() < 0.5 ? 1 : -1;
      var delta = Math.max(-2, Math.min(2, target - prev));
      if (delta === 0) { if (++same >= 2) { delta = prev >= center ? -1 : 1; same = 0; } } else same = 0;
      var idx = prev + delta, pcs = ev.bar.chord.pcs, j, best;
      if (ev.strong) {
        best = null;
        [idx, idx - 1, idx + 1].forEach(function (c) {
          if (pcs.indexOf(scale[c] % 12) >= 0 && (best === null || Math.abs(c - target) < Math.abs(best - target))) best = c;
        });
        if (best !== null) idx = best;
      }
      if (ev.last) {
        best = null; var bs = 99;
        for (j = idx - (isFinal ? 3 : 2); j <= idx + (isFinal ? 3 : 2); j++) {
          var pc = scale[j] % 12, c = ev.bar.chord, sc;
          if (isFinal) { if (pc !== key.pc) continue; sc = Math.abs(j - idx); }
          else { var ci = c.pcs.slice(0, 3).indexOf(pc); if (ci < 0) continue; sc = Math.abs(j - idx) + (ci === 0 ? 0 : 0.4); }
          if (sc < bs) { bs = sc; best = j; }
        }
        if (best !== null) idx = best;
      }
      idx = Math.max(center - 4, Math.min(center + 6, idx));
      // tránh nốt dẫn (quãng 2 tăng) khi hợp âm không có nốt đó
      if (key.mode === 'minor' && !ev.last && mod(scale[idx] - key.pc, 12) === 11 && ev.bar.chord.pcs.indexOf(scale[idx] % 12) < 0) {
        idx = Math.abs(idx - 1 - target) <= Math.abs(idx + 1 - target) ? idx - 1 : idx + 1;
      }
      ev.idx = idx; ev.midi = scale[idx]; prev = idx;
      melody.push(ev);
    });
    return B;
  }

  // --- dựng cấu trúc ô nhịp
  var introN = Math.max(0, +o.intro | 0);
  var prog0 = progOf(0), i, s, li;
  for (i = 0; i < introN; i++) {
    var ib = addBar('intro', i === introN - 1 && introN > 1 ? prog0[(i) % 4] : prog0[i % 4], {});
    if (i === 0) ib.label = 'Nhạc dạo đầu';
  }
  if (introN) spans.push({ kind: 'inst', label: 'Nhạc dạo đầu', startBar: 0, endBar: introN - 1 });

  secs.forEach(function (sec, sIdx) {
    var prog = progOf(sIdx), bc = 0, isLastSec = sIdx === secs.length - 1;
    sec.lines.forEach(function (words, lIdx) {
      var n = words.length, B = Math.max(2, Math.ceil(n / maxPer)); if (B % 2) B++;
      var start = bars.length, finalLine = isLastSec && lIdx === sec.lines.length - 1;
      for (var b = 0; b < B; b++) {
        var ch = prog[bc % 4]; bc++;
        if (finalLine && b === B - 1) ch = tonicChord;
        var bar = addBar('line', ch, { sec: sIdx, line: lIdx });
        if (b === 0 && lIdx === 0) { bar.label = sec.label; if (sIdx > 0) bar.crash = true; }
      }
      setLine(sIdx, lIdx, words, start, finalLine);
      spans.push({ kind: 'line', sec: sIdx, line: lIdx, label: lIdx === 0 ? sec.label : '',
                   text: words.map(function (x) { return x.text; }).join(' '), startBar: start, endBar: bars.length - 1 });
    });
    if (!isLastSec) {
      if (st.beats === 4) bars[bars.length - 1].fill = true;
      var st0 = bars.length;
      for (i = 0; i < 2; i++) { var xb = addBar('inter', prog[i % 4], {}); if (i === 0) { xb.label = 'Nhạc dạo'; xb.crash = true; } }
      spans.push({ kind: 'inst', label: 'Nhạc dạo', startBar: st0, endBar: bars.length - 1 });
    }
  });
  var o0 = bars.length;
  addBar('outro', dom, { label: 'Kết', crash: false });
  addBar('outro', tonicChord, { final: true });
  spans.push({ kind: 'inst', label: 'Kết', startBar: o0, endBar: bars.length - 1 });
  var nBars = bars.length;

  /* ---------- các rãnh ---------- */
  var tracks = [];
  var leadProg = GM[o.lead] != null ? GM[o.lead] : 53;
  var tMel = { id: 'mel', name: 'Giọng hát (giai điệu)', program: leadProg, channel: 0, synth: SYNTH[o.lead] || 'voice', clef: 'G', vol: 100, voices: [[]] };
  melody.forEach(function (ev) {
    tMel.voices[0].push({ t: ev.t, d: ev.d, n: [ev.midi], v: ev.strong ? 92 : 82, lyric: ev.syl.text });
  });
  tracks.push(tMel);
  if (o.harmony) {
    var tH = { id: 'har', name: 'Bè quãng 3', program: GM.sax, channel: 1, synth: 'sax', clef: 'G', vol: 78, voices: [[]] };
    melody.forEach(function (ev) { tH.voices[0].push({ t: ev.t, d: ev.d, n: [scale[Math.max(0, ev.idx - 2)]], v: 62 }); });
    tracks.push(tH);
  }
  var compKey = o.comp === 'auto' ? st.comp : o.comp;
  var tG = { id: 'gtr', name: 'Đàn đệm', program: GM[compKey], channel: 2, synth: SYNTH[compKey] || 'guitar', clef: 'G', vol: 88, voices: [[]], harmony: true };
  var tP = { id: 'pad', name: 'Dàn dây', program: GM.strings, channel: 4, synth: 'pad', clef: 'G', vol: 62, voices: [[]] };
  var tB = { id: 'bas', name: 'Bass', program: st.bass, channel: 3, synth: 'bass', clef: 'F', vol: 100, voices: [[]] };
  var tD = { id: 'drm', name: 'Trống', program: 0, channel: 9, synth: 'drums', clef: 'perc', vol: 100, voices: [[], []], drum: true };
  tracks.push(tG);
  if (o.strings) tracks.push(tP);
  tracks.push(tB, tD);

  function voicing(ch) {
    var r = 43 + mod(ch.pc - 43, 12), iv = ch.iv, v = [r, r + 7, r + 12, r + 12 + iv[1], r + 12 + 7];
    if (iv[3]) v.push(r + 12 + iv[3]);
    return v;
  }
  function bassNote(ch, kind) {
    var r = 36 + mod(ch.pc - 36, 12);
    if (kind === '5') return r + 7 > 47 ? r - 5 : r + 7;
    if (kind === '3') return r + ch.iv[1];
    if (kind === '8') return r + 12;
    return r;
  }
  function padNotes(ch) {
    return ch.pcs.map(function (pc) { return 55 + mod(pc - 55, 12); }).sort(function (a, b) { return a - b; });
  }
  function durs(items, len) {
    return items.map(function (it, i) { var nx = i + 1 < items.length ? items[i + 1][0] : len; return nx - it[0]; });
  }

  bars.forEach(function (bar) {
    var rngH = mulberry32(bar.idx * 7717 + o.seed), hv = function (x) { return Math.max(30, Math.min(120, Math.round(x + (rngH() - 0.5) * 8))); };
    var ch = bar.chord, T = bar.t, v = voicing(ch), it;
    // đàn đệm
    if (bar.final) {
      tG.voices[0].push({ t: T, d: barLen, n: [v[0], v[1], v[3], v[4]], v: 84 });
      tB.voices[0].push({ t: T, d: barLen, n: [bassNote(ch, 'r')], v: 92 });
    } else {
      var cp = st.compP, cd = durs(cp, barLen);
      cp.forEach(function (c, i) {
        var dd = c[2] ? Math.min(c[2], cd[i]) : cd[i];
        tG.voices[0].push({ t: T + c[0], d: dd, n: c[1].map(function (x) { return v[Math.min(x, v.length - 1)]; }),
                            v: hv(c[0] === 0 ? 74 : 64) });
      });
      st.bassP.forEach(function (b) { tB.voices[0].push({ t: T + b[0], d: b[1], n: [bassNote(ch, b[2])], v: hv(b[0] === 0 ? 92 : 80) }); });
    }
    if (o.strings) tP.voices[0].push({ t: T, d: barLen, n: padNotes(ch), v: hv(56) });
    // trống
    var hands = {}, kick = [];
    Object.keys(st.drums).forEach(function (k) {
      var id = +k, steps = st.drums[k].slice();
      if (bar.fill && barLen === 16 && id !== 36) steps = steps.filter(function (x) { return x < 12; });
      steps.forEach(function (s0) { if (id === 36) kick.push(s0); else (hands[s0] = hands[s0] || []).push(id); });
    });
    if (bar.fill && barLen === 16) { [12, 13, 14, 15].forEach(function (s0) { (hands[s0] = hands[s0] || []).push(38); }); }
    if (bar.crash) { (hands[0] = hands[0] || []).push(49); if (kick.indexOf(0) < 0) kick.push(0); }
    if (bar.final) { hands = { 0: [49] }; kick = [0]; }
    if (bar.kind === 'intro' && bar.idx === 0 && introN > 1) { hands = { 0: [42], 4: [42], 8: [42], 12: [42] }; kick = []; }
    var hs = Object.keys(hands).map(Number).sort(function (a, b) { return a - b; });
    hs.forEach(function (s0, i) {
      var nx = i + 1 < hs.length ? hs[i + 1] : barLen, ids = hands[s0].slice().sort(function (a, b) { return a - b; });
      tD.voices[0].push({ t: T + s0, d: Math.min(4, nx - s0), n: ids, v: ids.map(function (id) { return hv(id === 49 ? 90 : id === 38 && bar.fill ? 70 + s0 : (st.dv[id] || 64)); }) });
    });
    kick.sort(function (a, b) { return a - b; }).forEach(function (s0, i, arr) {
      var nx = i + 1 < arr.length ? arr[i + 1] : barLen;
      tD.voices[1].push({ t: T + s0, d: Math.min(4, nx - s0), n: [36], v: [hv(st.dv[36] || 84)] });
    });
  });

  /* ---------- bảng hợp âm / lời ---------- */
  var chart = [];
  spans.forEach(function (sp) {
    var cs = []; for (var b = sp.startBar; b <= sp.endBar; b++) cs.push(bars[b].chord.name);
    sp.chords = cs;
    chart.push((sp.label ? '\n[' + sp.label + ']\n' : '') + '| ' + cs.join(' | ') + ' |' + (sp.text ? '\n' + sp.text : ''));
  });

  return {
    title: o.title || 'Bài thơ', options: o, style: o.style, styleName: st.name, key: key, keyName: keyName(key),
    beats: st.beats, barLen: barLen, tempo: tempo, nBars: nBars, bars: bars, spans: spans, tracks: tracks,
    sylCount: melody.length, empty: melody.length === 0,
    chart: o.title + '  —  ' + keyName(key) + ',  ' + st.name + ',  ' + tempo + ' bpm,  ' + st.beats + '/4\n' + chart.join('\n') + '\n',
    secs: secs
  };
}

/* ================= 5. XUẤT MUSICXML ================= */
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
var TYPES = { 16:['whole',0], 12:['half',1], 8:['half',0], 6:['quarter',1], 4:['quarter',0], 3:['eighth',1], 2:['eighth',0], 1:['16th',0] };
function splitDur(d) {
  var out = [], L = [16,12,8,6,4,3,2,1];
  while (d > 0) for (var i = 0; i < L.length; i++) if (L[i] <= d) { out.push(L[i]); d -= L[i]; break; }
  return out;
}
function pitchXml(m, names) {
  var nm = names[mod(m, 12)], alt = nm.length > 1 ? (nm[1] === '#' ? 1 : -1) : 0;
  return '<pitch><step>' + nm[0] + '</step>' + (alt ? '<alter>' + alt + '</alter>' : '') + '<octave>' + (Math.floor(m / 12) - 1) + '</octave></pitch>';
}
function noteXml(p) {
  var x = '<note>' + (p.chord ? '<chord/>' : '');
  if (p.rest) x += p.measure ? '<rest measure="yes"/>' : '<rest/>';
  else if (p.perc != null) { var dd = DRUM_DISPLAY[p.perc] || ['C', 5, 'normal']; x += '<unpitched><display-step>' + dd[0] + '</display-step><display-octave>' + dd[1] + '</display-octave></unpitched>'; }
  else x += pitchXml(p.midi, p.names);
  x += '<duration>' + p.dur + '</duration>';
  if (p.tieE) x += '<tie type="stop"/>';
  if (p.tieS) x += '<tie type="start"/>';
  if (p.perc != null) x += '<instrument id="' + p.pid + '-I' + p.perc + '"/>';
  x += '<voice>' + p.voice + '</voice>';
  if (!p.measure) { var ty = TYPES[p.dur]; x += '<type>' + ty[0] + '</type>' + (ty[1] ? '<dot/>' : ''); }
  if (p.perc != null) { var nh = (DRUM_DISPLAY[p.perc] || [0, 0, 'normal'])[2]; if (nh !== 'normal') x += '<notehead>' + nh + '</notehead>'; }
  if ((p.tieS || p.tieE) && !p.rest) x += '<notations>' + (p.tieE ? '<tied type="stop"/>' : '') + (p.tieS ? '<tied type="start"/>' : '') + '</notations>';
  if (p.lyric) x += '<lyric number="1"><syllabic>single</syllabic><text>' + esc(p.lyric) + '</text></lyric>';
  return x + '</note>';
}
function restsXml(d, voice) {
  return splitDur(d).map(function (c) { return noteXml({ rest: 1, dur: c, voice: voice }); }).join('');
}
function trackBars(song, tr, pid) {
  var barLen = song.barLen, n = song.nBars, names = song.key.names;
  var out = [];
  tr.voices.forEach(function (voice, vi) {
    var per = []; for (var b = 0; b < n; b++) per.push([]);
    voice.slice().sort(function (a, b) { return a.t - b.t; }).forEach(function (ev) {
      var t = ev.t, end = ev.t + ev.d, first = true;
      while (t < end) {
        var b = Math.floor(t / barLen), cut = Math.min(end, (b + 1) * barLen);
        if (b >= n) break;
        per[b].push({ off: t - b * barLen, d: cut - t, ev: ev, contFrom: !first, contTo: cut < end });
        t = cut; first = false;
      }
    });
    out.push(per);
  });
  return out.length ? { voices: out } : { voices: [] };
}
function toMusicXML(song) {
  var barLen = song.barLen, names = song.key.names, tracks = song.tracks;
  var x = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n' +
    '<score-partwise version="3.1">\n<work><work-title>' + esc(song.title) + '</work-title></work>\n' +
    '<identification><encoding><software>Tho-Nhac pnhung72</software><encoding-date>' + new Date().toISOString().slice(0, 10) + '</encoding-date></encoding></identification>\n' +
    '<credit page="1"><credit-words justify="center" valign="top" font-size="24">' + esc(song.title) + '</credit-words></credit>\n<part-list>\n';
  tracks.forEach(function (tr, i) {
    var pid = 'P' + (i + 1);
    x += '<score-part id="' + pid + '"><part-name>' + esc(tr.name) + '</part-name>';
    if (tr.drum) {
      Object.keys(DRUM_NAMES).forEach(function (k) { x += '<score-instrument id="' + pid + '-I' + k + '"><instrument-name>' + DRUM_NAMES[k] + '</instrument-name></score-instrument>'; });
      Object.keys(DRUM_NAMES).forEach(function (k) {
        x += '<midi-instrument id="' + pid + '-I' + k + '"><midi-channel>10</midi-channel><midi-program>1</midi-program><volume>80</volume><pan>0</pan><midi-unpitched>' + (+k + 1) + '</midi-unpitched></midi-instrument>';
      });
    } else {
      x += '<midi-instrument id="' + pid + '"><midi-channel>' + (tr.channel + 1) + '</midi-channel><midi-program>' + (tr.program + 1) + '</midi-program><volume>' + Math.round(tr.vol * 0.8) + '</volume><pan>0</pan></midi-instrument>';
    }
    x += '</score-part>\n';
  });
  x += '</part-list>\n';
  tracks.forEach(function (tr, ti) {
    var pid = 'P' + (ti + 1), tb = trackBars(song, tr, pid);
    x += '<part id="' + pid + '">\n';
    for (var b = 0; b < song.nBars; b++) {
      var bar = song.bars[b];
      x += '<measure number="' + (b + 1) + '">';
      if (b === 0) {
        x += '<attributes><divisions>4</divisions><key><fifths>' + song.key.fifths + '</fifths><mode>' + song.key.mode + '</mode></key>' +
          '<time><beats>' + song.beats + '</beats><beat-type>4</beat-type></time>' +
          (tr.clef === 'F' ? '<clef><sign>F</sign><line>4</line></clef>' : tr.clef === 'perc' ? '<clef><sign>percussion</sign><line>2</line></clef>' : '<clef><sign>G</sign><line>2</line></clef>') +
          '</attributes>';
        x += '<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>' + song.tempo + '</per-minute></metronome></direction-type><sound tempo="' + song.tempo + '"/></direction>';
      }
      if (ti === 0 && bar.label) x += '<direction placement="above"><direction-type><rehearsal>' + esc(bar.label) + '</rehearsal></direction-type></direction>';
      if (tr.harmony) {
        var pv = b > 0 ? song.bars[b - 1].chord.name : '';
        if (b === 0 || bar.chord.name !== pv || bar.label) {
          var c = bar.chord, rn = names[c.pc];
          x += '<harmony><root><root-step>' + rn[0] + '</root-step>' + (rn.length > 1 ? '<root-alter>' + (rn[1] === '#' ? 1 : -1) + '</root-alter>' : '') + '</root><kind>' + XKIND[c.q] + '</kind></harmony>';
        }
      }
      tb.voices.forEach(function (per, vi) {
        var vnum = vi + 1, pieces = per[b], cursor = 0, s = '';
        if (!pieces.length) { if (vi === 0) s = noteXml({ rest: 1, measure: 1, dur: barLen, voice: 1 }); }
        else {
          pieces.forEach(function (pc) {
            if (pc.off > cursor) s += restsXml(pc.off - cursor, vnum);
            var chunks = splitDur(pc.d), ev = pc.ev;
            chunks.forEach(function (cd, ci) {
              var tieE = (ci > 0) || pc.contFrom, tieS = (ci < chunks.length - 1) || pc.contTo;
              ev.n.forEach(function (nn, k) {
                s += noteXml({ chord: k > 0, midi: tr.drum ? null : nn, perc: tr.drum ? nn : null, names: names, pid: pid,
                               dur: cd, voice: vnum, tieS: tieS, tieE: tieE, lyric: (k === 0 && !tieE) ? ev.lyric : null });
              });
            });
            cursor = pc.off + pc.d;
          });
          if (cursor < barLen) s += restsXml(barLen - cursor, vnum);
        }
        if (s) { if (vi > 0) x += '<backup><duration>' + barLen + '</duration></backup>'; x += s; }
      });
      x += '</measure>\n';
    }
    x += '</part>\n';
  });
  return x + '</score-partwise>\n';
}

/* ================= 6. XUẤT MIDI ================= */
function vlq(n) { var b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; }
function strBytes(s) { return Array.prototype.slice.call(new TextEncoder().encode(s)); }
function trackChunk(events) {
  events.sort(function (a, b) { return a.tick - b.tick || a.ord - b.ord; });
  var data = [], last = 0;
  events.forEach(function (e) { Array.prototype.push.apply(data, vlq(e.tick - last)); Array.prototype.push.apply(data, e.bytes); last = e.tick; });
  data.push(0, 255, 47, 0);
  var n = data.length;
  return [77, 84, 114, 107, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].concat(data);
}
function toMIDI(song) {
  var T16 = 120, chunks = [], i;
  var us = Math.round(60000000 / song.tempo);
  var meta = [
    { tick: 0, ord: 0, bytes: [255, 3].concat([strBytes(song.title).length], strBytes(song.title)) },
    { tick: 0, ord: 0, bytes: [255, 81, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255] },
    { tick: 0, ord: 0, bytes: [255, 88, 4, song.beats, 2, 24, 8] },
    { tick: 0, ord: 0, bytes: [255, 89, 2, song.key.fifths & 255, song.key.mode === 'minor' ? 1 : 0] }
  ];
  chunks.push(trackChunk(meta));
  song.tracks.forEach(function (tr) {
    var ev = [], ch = tr.channel, nm = strBytes(tr.name);
    ev.push({ tick: 0, ord: 0, bytes: [255, 3, nm.length].concat(nm) });
    if (!tr.drum) ev.push({ tick: 0, ord: 1, bytes: [0xC0 | ch, tr.program] });
    ev.push({ tick: 0, ord: 1, bytes: [0xB0 | ch, 7, tr.vol] });
    tr.voices.forEach(function (voice) {
      voice.forEach(function (e) {
        var t0 = e.t * T16, len = tr.drum ? 60 : Math.max(30, e.d * T16 - (e.d > 1 ? 8 : 0));
        if (e.lyric) { var lb = strBytes(e.lyric + ' '); ev.push({ tick: t0, ord: 2, bytes: [255, 5, lb.length].concat(lb) }); }
        e.n.forEach(function (nn, k) {
          var vel = Math.max(1, Math.min(127, Array.isArray(e.v) ? e.v[k] : e.v));
          ev.push({ tick: t0, ord: 3, bytes: [0x90 | ch, nn, vel] });
          ev.push({ tick: t0 + len, ord: 1, bytes: [0x80 | ch, nn, 0] });
        });
      });
    });
    chunks.push(trackChunk(ev));
  });
  var n = chunks.length, head = [77, 84, 104, 100, 0, 0, 0, 6, 0, 1, (n >> 8) & 255, n & 255, 1, 224];
  var all = head; chunks.forEach(function (c) { Array.prototype.push.apply(all, c); });
  return new Uint8Array(all);
}

/* ================= 7. ÂM THANH THỬ (WebAudio) ================= */
function flatten(song) {
  var sec16 = 60 / song.tempo / 4, out = [];
  song.tracks.forEach(function (tr) {
    tr.voices.forEach(function (voice) {
      voice.forEach(function (e) {
        e.n.forEach(function (nn, k) {
          out.push({ t: e.t * sec16, d: e.d * sec16, m: nn, v: (Array.isArray(e.v) ? e.v[k] : e.v) / 127, s: tr.synth, g: tr.vol / 100, ch: tr.id });
        });
      });
    });
  });
  out.sort(function (a, b) { return a.t - b.t; });
  return out;
}
var noiseCache = new WeakMap();
function noiseBuf(ctx) {
  var b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = b.getChannelData(0), seed = 12345;
    for (var i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; }
    noiseCache.set(ctx, b);
  }
  return b;
}
function playDrum(ctx, out, id, t, vel) {
  var g = ctx.createGain(), src;
  function noise(ft, f, q, dec, gain) {
    var n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx);
    var fl = ctx.createBiquadFilter(); fl.type = ft; fl.frequency.value = f; fl.Q.value = q || 0.7;
    var e = ctx.createGain(); e.gain.setValueAtTime(gain * vel, t); e.gain.exponentialRampToValueAtTime(0.001, t + dec);
    n.connect(fl); fl.connect(e); e.connect(out); n.start(t, Math.random() * 0.5); n.stop(t + dec + 0.02);
  }
  function tone(type, f0, f1, dec, gain) {
    var o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dec * 0.6);
    var e = ctx.createGain(); e.gain.setValueAtTime(gain * vel, t); e.gain.exponentialRampToValueAtTime(0.001, t + dec);
    o.connect(e); e.connect(out); o.start(t); o.stop(t + dec + 0.02);
  }
  if (id === 36) { tone('sine', 150, 42, 0.32, 1.1); noise('lowpass', 400, 0.7, 0.04, 0.25); }
  else if (id === 38) { noise('bandpass', 1900, 0.8, 0.2, 0.7); tone('triangle', 190, 140, 0.11, 0.5); }
  else if (id === 37) { noise('highpass', 2400, 0.7, 0.04, 0.5); tone('sine', 820, 0, 0.04, 0.4); }
  else if (id === 42) noise('highpass', 7500, 0.7, 0.045, 0.32);
  else if (id === 46) noise('highpass', 7000, 0.7, 0.28, 0.3);
  else if (id === 49) noise('highpass', 5000, 0.5, 1.1, 0.4);
  else if (id === 51) noise('highpass', 6000, 0.5, 0.5, 0.25);
  else if (id === 56) { tone('square', 562, 0, 0.22, 0.18); tone('square', 845, 0, 0.18, 0.14); }
}
function playNote(ctx, out, n, t) {
  var f = 440 * Math.pow(2, (n.m - 69) / 12), vel = n.v * n.g, d = Math.max(0.06, n.d), s = n.s;
  var env = ctx.createGain(), nodes = [], lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  function osc(type, fr, det) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = fr; if (det) o.detune.value = det; nodes.push(o); return o; }
  function mix(o, gain) { var g = ctx.createGain(); g.gain.value = gain; o.connect(g); g.connect(lp); }
  var a, rel, end, peak = vel * 0.28;
  function sustain(att, relT, pk) {
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(pk, t + att);
    env.gain.setValueAtTime(pk, Math.max(t + att, t + d - 0.02)); env.gain.exponentialRampToValueAtTime(0.0008, t + d + relT);
    end = t + d + relT + 0.05;
  }
  function pluck(tau, pk) {
    env.gain.setValueAtTime(pk, t); env.gain.exponentialRampToValueAtTime(0.0008, t + tau);
    end = t + tau + 0.05;
  }
  function vib(o, depth, rate, delay) {
    var l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = rate; lg.gain.value = 0;
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(depth, t + delay + 0.25);
    l.connect(lg); lg.connect(o.detune); nodes.push(l);
  }
  if (s === 'voice') {
    lp.frequency.value = 1500; lp.Q.value = 1.2; var o1 = osc('sawtooth', f), o2 = osc('triangle', f * 2, 4); mix(o1, 0.5); mix(o2, 0.4); vib(o1, 14, 5.2, 0.1); vib(o2, 14, 5.2, 0.1);
    sustain(0.05, 0.14, peak * 1.2);
  } else if (s === 'flute') {
    lp.frequency.value = 3500; var o3 = osc('sine', f), o4 = osc('triangle', f * 2); mix(o3, 0.8); mix(o4, 0.12); vib(o3, 10, 5, 0.2); sustain(0.06, 0.12, peak * 1.3);
  } else if (s === 'sax') {
    lp.frequency.value = 1700; lp.Q.value = 2; var o5 = osc('sawtooth', f), o6 = osc('square', f, -3); mix(o5, 0.4); mix(o6, 0.25); vib(o5, 12, 5.5, 0.15); sustain(0.05, 0.1, peak * 0.9);
  } else if (s === 'violin') {
    lp.frequency.value = 2600; var o7 = osc('sawtooth', f), o8 = osc('sawtooth', f, 7); mix(o7, 0.35); mix(o8, 0.3); vib(o7, 16, 5.8, 0.15); vib(o8, 16, 5.8, 0.15); sustain(0.09, 0.15, peak);
  } else if (s === 'pad') {
    lp.frequency.value = 1100; var p1 = osc('sawtooth', f, -8), p2 = osc('sawtooth', f, 8); mix(p1, 0.3); mix(p2, 0.3); sustain(0.35, 0.5, peak * 0.55);
  } else if (s === 'bass') {
    lp.frequency.value = 650; var b1 = osc('sine', f), b2 = osc('triangle', f); mix(b1, 0.9); mix(b2, 0.4); pluck(Math.max(0.35, Math.min(d, 1.2)) + 0.1, peak * 1.6);
  } else if (s === 'piano') {
    lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.8);
    var q1 = osc('triangle', f), q2 = osc('sine', f * 2), q3 = osc('sine', f * 3); mix(q1, 0.7); mix(q2, 0.25); mix(q3, 0.1); pluck(1.3 + Math.min(d, 1.5), peak * 1.1);
  } else if (s === 'epiano') {
    lp.frequency.value = 3000; var e1 = osc('sine', f), e2 = osc('sine', f * 4, 3); mix(e1, 0.8); mix(e2, 0.12); pluck(1.0 + Math.min(d, 1.5), peak * 1.1);
  } else {   // guitar / steel / clean
    var bright = s === 'steel' ? 5000 : s === 'clean' ? 3200 : 3000;
    lp.frequency.setValueAtTime(bright, t); lp.frequency.exponentialRampToValueAtTime(s === 'clean' ? 1400 : 700, t + 0.45);
    var g1 = osc(s === 'clean' ? 'triangle' : 'sawtooth', f), g2 = osc('triangle', f * 2); mix(g1, s === 'clean' ? 0.6 : 0.35); mix(g2, 0.25);
    pluck(s === 'clean' ? 1.1 : 0.9 + Math.min(d, 1) * 0.5, peak);
  }
  lp.connect(env); env.connect(out);
  nodes.forEach(function (o) { o.start(t); o.stop(end || t + d + 0.5); });
}
function scheduleAll(ctx, out, notes, t0, from) {
  notes.forEach(function (n) {
    if (n.t < (from || 0)) return;
    if (n.s === 'drums') playDrum(ctx, out, n.m, t0 + n.t - (from || 0), n.v);
    else playNote(ctx, out, n, t0 + n.t - (from || 0));
  });
}
function makeBus(ctx) {
  var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  var m = ctx.createGain(); m.gain.value = 0.9; m.connect(comp); comp.connect(ctx.destination);
  return m;
}
function renderWav(song, cb) {
  var notes = flatten(song), secs = notes.reduce(function (a, n) { return Math.max(a, n.t + n.d); }, 0) + 2.5, sr = 44100;
  var Off = G.OfflineAudioContext || G.webkitOfflineAudioContext;
  var ctx = new Off(2, Math.ceil(secs * sr), sr);
  scheduleAll(ctx, makeBus(ctx), notes, 0.05, 0);
  var p = ctx.startRendering();
  var done = function (buf) { cb(null, encodeWav(buf)); };
  if (p && p.then) p.then(done, cb); else ctx.oncomplete = function (e) { done(e.renderedBuffer); };
}
function encodeWav(buf) {
  var ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate, out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  function str(o, s) { for (var i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); }
  str(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
  out.setUint16(22, ch, true); out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  str(36, 'data'); out.setUint32(40, len * ch * 2, true);
  var data = [], c, i, o = 44;
  for (c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  var peak = 0; for (c = 0; c < ch; c++) for (i = 0; i < len; i += 7) peak = Math.max(peak, Math.abs(data[c][i]));
  var k = peak > 0.95 ? 0.95 / peak : 1;
  for (i = 0; i < len; i++) for (c = 0; c < ch; c++) { var v = Math.max(-1, Math.min(1, data[c][i] * k)); out.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
  return new Uint8Array(out.buffer);
}

/* ================= 7b. GIỌNG HÁT AI: UST (UTAU/OpenUtau) và PROMPT SUNO/UDIO ================= */
function plain(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}
function melodyOf(song) {
  var tr = song.tracks.filter(function (t) { return t.id === 'mel'; })[0];
  return tr ? tr.voices[0].slice().sort(function (a, b) { return a.t - b.t; }) : [];
}
// UST: 480 tick = 1 phách (nốt đen); 1 móc đơn (1/16) = 120 tick. Quãng nghỉ ghi bằng Lyric=R.
function toUST(song, noTone) {
  var T16 = 120, nl = '\r\n', cur = 0, idx = 0, out = [];
  function note(len, lyric, num) {
    var id = ('0000' + idx++).slice(-4);
    out.push('[#' + id + ']', 'Length=' + len, 'Lyric=' + lyric, 'NoteNum=' + num, 'PreUtterance=');
  }
  out.push('[#VERSION]', 'UST Version1.2', '[#SETTING]', 'Tempo=' + Number(song.tempo).toFixed(2), 'Tracks=1',
    'ProjectName=' + (noTone ? plain(song.title) : song.title), 'VoiceDir=%VOICE%', 'OutFile=', 'CacheDir=',
    'Tool1=wavtool.exe', 'Tool2=resampler.exe', 'Mode2=True');
  var mel = melodyOf(song);
  mel.forEach(function (e, i) {
    var t0 = e.t * T16, len = e.d * T16, nx = mel[i + 1], vib = false;
    if (t0 > cur) note(t0 - cur, 'R', 60);
    else if (t0 < cur) { len -= (cur - t0); t0 = cur; }
    if (len <= 0) return;
    if (len >= 900) {                                   // nốt dài: lấy hơi cuối nốt + vibrato nhẹ
      vib = true;
      if (nx && nx.t * T16 <= t0 + len + 1) len -= 60;
    }
    note(len, noTone ? plain(e.lyric || 'a') : (e.lyric || 'a'), e.n[0]);
    if (vib) out.push('VBR=65,180,30,25,25,0,0,0');
    cur = t0 + len;
  });
  note(480, 'R', 60);
  out.push('[#TRACKEND]');
  return '\ufeff' + out.join(nl) + nl;
}
var STYLE_EN = { ballad:'Vietnamese ballad, gentle, emotional', slowrock:'slow rock ballad', chachacha:'cha cha cha, Latin, Vietnamese',
  bolero:'Vietnamese bolero, nostalgic', rumba:'rumba, Latin ballad, Vietnamese', disco:'disco, upbeat, Vietnamese',
  valse:'waltz 3/4, Vietnamese', bossa:'bossa nova, smooth, Vietnamese', pop:'Vietnamese pop rock' };
function sectionTag(label, i) {
  if (/^Đoạn\s*\d+$/i.test(label)) return 'Verse ' + (i + 1);
  if (/điệp/i.test(label)) return 'Chorus';
  if (/dạo|intro/i.test(label)) return 'Interlude';
  if (/kết|outro/i.test(label)) return 'Outro';
  return label;
}
function toSuno(song) {
  var k = song.key, keyTxt = k.names[k.pc] + (k.mode === 'minor' ? ' minor' : ' major');
  var style = (STYLE_EN[song.style] || 'Vietnamese ballad') + ', ' + song.tempo + ' bpm, ' + keyTxt + ', Vietnamese lyrics, clear vocal';
  var lyr = song.secs.map(function (sec, i) {
    return '[' + sectionTag(sec.label, i) + ']\n' + sec.lines.map(function (ws) { return ws.map(function (w) { return w.text; }).join(' '); }).join('\n');
  }).join('\n\n');
  return 'TIÊU ĐỀ\n' + song.title + '\n\nPHONG CÁCH (dán vào ô Style of Music)\n' + style + '\n\nLỜI (dán vào ô Lyrics)\n' + lyr + '\n';
}

function slug(s) {
  return String(s || 'bai_tho').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'bai_tho';
}

/* ================= 8. GIAO DIỆN ================= */
var CSS = `
:host{all:initial;display:block;font-family:'Be Vietnam Pro','Segoe UI',system-ui,sans-serif;color:#0c2b33}
*{box-sizing:border-box}
.app{--ink:#0c2b33;--sea:#0b6e74;--seaD:#084f55;--foam:#eaf2f0;--paper:#fbfdfc;--sun:#e8a317;--line:#c9dcd9;--mute:#587178;
  background:var(--foam);color:var(--ink);padding:18px;border-radius:14px;font-size:15px;line-height:1.5;max-width:1100px;margin:0 auto}
h2{font-size:22px;margin:0 0 2px;font-weight:700;letter-spacing:-.01em}
.sub{margin:0 0 16px;color:var(--mute);font-size:14px}
.grid{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:900px){.grid{grid-template-columns:minmax(0,5fr) minmax(0,6fr)}}
.card{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.card h3{font-size:15px;margin:0 0 10px;font-weight:700;color:var(--seaD)}
label.f{display:block;font-size:13px;color:var(--mute);margin:10px 0 4px}
input[type=text],select,textarea{width:100%;font:inherit;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:7px;padding:8px 10px}
textarea{font-family:'Noto Serif',Georgia,serif;font-size:17px;line-height:30px;min-height:300px;resize:vertical;
  background-image:repeating-linear-gradient(transparent 0 29px,#dbe9e6 29px 30px);background-attachment:local;padding-top:2px}
input:focus-visible,select:focus-visible,textarea:focus-visible,button:focus-visible{outline:3px solid var(--sun);outline-offset:1px}
.hint{font-size:13px;color:var(--mute);margin:8px 0 0}
.chips{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.chip{font:inherit;text-align:left;border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:8px;padding:8px 10px;cursor:pointer}
.chip b{display:block;font-size:14px}.chip span{font-size:12px;color:var(--mute)}
.chip[aria-pressed=true]{background:var(--sea);border-color:var(--sea);color:#fff}.chip[aria-pressed=true] span{color:#d6efee}
.row{display:flex;flex-wrap:wrap;gap:10px;align-items:end}.row>*{flex:1 1 120px}
.seg{display:flex;border:1px solid var(--line);border-radius:7px;overflow:hidden;background:#fff}
.seg button{flex:1;font:inherit;border:0;background:transparent;padding:8px 6px;cursor:pointer;color:var(--ink)}
.seg button[aria-pressed=true]{background:var(--seaD);color:#fff}
.chk{display:flex;gap:8px;align-items:center;margin:8px 0 0;font-size:14px}.chk input{width:18px;height:18px;accent-color:var(--sea)}
input[type=range]{width:100%;accent-color:var(--sea)}
.tempo{display:flex;align-items:center;gap:10px}.tempo output{min-width:84px;font-variant-numeric:tabular-nums}
.link{font:inherit;background:none;border:0;color:var(--sea);text-decoration:underline;cursor:pointer;padding:0}
.btn{font:inherit;font-weight:600;border:1px solid var(--seaD);background:var(--sea);color:#fff;border-radius:8px;padding:9px 16px;cursor:pointer}
.btn:hover{background:var(--seaD)}.btn.ghost{background:#fff;color:var(--seaD)}.btn.ghost:hover{background:#e3f0ee}
.btn[disabled]{opacity:.45;cursor:not-allowed}
.play{background:var(--sun);border-color:#b87f0b;color:#2a1c00;min-width:110px}.play:hover{background:#f2b52d}
.bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 10px}
.bar .meta{margin-left:auto;color:var(--mute);font-size:13px}
canvas{display:block;width:100%;height:150px;background:#0e3a43;border-radius:8px}
.chart{display:grid;gap:2px;margin-top:6px}
.sec{font-size:12px;font-weight:700;color:var(--sea);margin:12px 0 2px}
.ln{border-left:4px solid transparent;padding:4px 10px;border-radius:0 6px 6px 0}
.ln.on{border-left-color:var(--sun);background:#fff4d9}
.ch{display:flex;flex-wrap:wrap;gap:6px;font-weight:700;color:var(--seaD);font-size:14px}
.ch i{font-style:normal;background:#dceceb;border-radius:5px;padding:0 7px}.ch i.on{background:var(--sun);color:#2a1c00}
.tx{font-family:'Noto Serif',Georgia,serif;font-size:17px}.ln.inst .tx{color:var(--mute);font-family:inherit;font-size:13px}
.dl{display:flex;flex-wrap:wrap;gap:8px}
.note{font-size:13px;color:var(--mute);margin:10px 0 0}
.msg{color:#8a3b00;font-size:14px;margin:6px 0 0;min-height:1em}
details{margin-top:10px;font-size:14px}summary{cursor:pointer;color:var(--seaD);font-weight:600}
details p{margin:6px 0}
code{background:#e5efed;border-radius:4px;padding:0 5px}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;
var SAMPLE = 'Trăm năm trong cõi người ta\nChữ tài chữ mệnh khéo là ghét nhau\n\nTrải qua một cuộc bể dâu\nNhững điều trông thấy mà đau đớn lòng';
var TONICS = ['C','C♯ / D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
var INTRO_LABEL = { 0:'Không có', 2:'2 ô nhịp', 4:'4 ô nhịp' };

function escH(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }

function mount(host, cfg) {
  cfg = cfg || {};
  if (!host || host.__tnx) return; host.__tnx = 1;
  if (!document.getElementById('tnx-fonts')) {
    var lk = document.createElement('link'); lk.id = 'tnx-fonts'; lk.rel = 'stylesheet';
    lk.href = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Noto+Serif:wght@400;700&display=swap';
    document.head.appendChild(lk);
  }
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  root.innerHTML = '<style>' + CSS + '</style><div class="app">' +
  '<h2>Phổ nhạc từ lời thơ</h2><p class="sub">Nhập lời, chọn điệu. Máy tự soạn giai điệu và phối khí để nghe thử, rồi tải về mở trong Guitar Pro 8.</p>' +
  '<div class="grid"><section class="card"><h3>1. Lời thơ</h3>' +
    '<label class="f" for="ti">Tên bài</label><input type="text" id="ti" placeholder="Ví dụ: Nha Trang Ngọc Xanh">' +
    '<label class="f" for="ly">Lời (mỗi dòng là một câu hát)</label><textarea id="ly" spellcheck="false" placeholder="Gõ hoặc dán lời thơ vào đây"></textarea>' +
    '<p class="hint">Mỗi chữ là một nốt. Dòng trống để sang đoạn mới. Có thể đặt tên đoạn bằng một dòng như <code>[Điệp khúc]</code>. ' +
    '<button class="link" id="sm" type="button">Nạp bài mẫu</button></p></section>' +
  '<section class="card"><h3>2. Điệu và tuỳ chỉnh</h3><div class="chips" id="st" role="group" aria-label="Chọn điệu"></div>' +
    '<div class="row"><div><label class="f" for="tn">Chủ âm</label><select id="tn"></select></div>' +
    '<div><label class="f">Thang âm</label><div class="seg" id="md"><button type="button" data-v="minor">Thứ (buồn)</button><button type="button" data-v="major">Trưởng (vui)</button></div></div>' +
    '<div><label class="f">Giọng hát</label><div class="seg" id="rg"><button type="button" data-v="low">Trầm</button><button type="button" data-v="high">Cao</button></div></div></div>' +
    '<label class="f" for="tp">Tốc độ</label><div class="tempo"><input type="range" id="tp" min="50" max="160" step="1"><output id="tpo"></output><button class="link" id="tpa" type="button">Theo điệu</button></div>' +
    '<div class="row"><div><label class="f" for="ld">Nhạc cụ hát giai điệu</label><select id="ld"><option value="voice">Giọng hát (ooh)</option><option value="flute">Sáo</option><option value="sax">Saxophone</option><option value="violin">Violin</option><option value="piano">Piano</option><option value="nylon">Guitar nylon</option></select></div>' +
    '<div><label class="f" for="cp">Nhạc cụ đệm</label><select id="cp"><option value="auto">Theo điệu</option><option value="nylon">Guitar nylon</option><option value="steel">Guitar thép</option><option value="clean">Guitar điện (clean)</option><option value="piano">Piano</option><option value="epiano">Piano điện</option></select></div>' +
    '<div><label class="f" for="in">Nhạc dạo đầu</label><select id="in"></select></div></div>' +
    '<label class="chk"><input type="checkbox" id="hm">Thêm bè quãng 3 (saxophone)</label>' +
    '<label class="chk"><input type="checkbox" id="sg">Thêm dàn dây nền</label>' +
    '<label class="chk"><input type="checkbox" id="kp">Các đoạn có cùng số chữ dùng chung giai điệu</label></section></div>' +
  '<section class="card" style="margin-top:14px"><h3>3. Nghe thử</h3>' +
    '<div class="bar"><button class="btn play" id="pl" type="button">Nghe</button><button class="btn ghost" id="sp" type="button">Dừng</button>' +
    '<button class="btn ghost" id="pv" type="button" title="Quay lại phương án trước">‹ Trước</button><button class="btn ghost" id="rn" type="button">Phương án khác</button>' +
    '<span class="meta" id="mt"></span></div><canvas id="cv" role="img" aria-label="Biểu đồ giai điệu"></canvas><div class="msg" id="ms"></div>' +
    '<div class="chart" id="ct"></div></section>' +
  '<section class="card" style="margin-top:14px"><h3>4. Tải về</h3><div class="dl">' +
    '<button class="btn" id="d1" type="button">MusicXML (.musicxml)</button><button class="btn ghost" id="d2" type="button">XML (.xml)</button>' +
    '<button class="btn ghost" id="d3" type="button">MIDI (.mid)</button><button class="btn ghost" id="d4" type="button">Âm thanh (.wav)</button>' +
    '<button class="btn ghost" id="d5" type="button">Lời và hợp âm (.txt)</button><button class="btn ghost" id="da" type="button">Tải tất cả</button></div>' +
    '<h3 style="margin:14px 0 8px">Cho giọng hát AI</h3><div class="dl">' +
    '<button class="btn" id="d6" type="button">UTAU / OpenUtau (.ust)</button>' +
    '<button class="btn ghost" id="d7" type="button">Lời + prompt cho Suno / Udio</button></div>' +
    '<label class="chk"><input type="checkbox" id="ub"> Bỏ dấu lời trong tệp .ust (dùng khi giọng hát không nhận chữ có dấu)</label>' +
    '<details><summary>Cho AI hát lời thơ thế nào?</summary>' +
    '<p><b>OpenUtau / UTAU:</b> mở OpenUtau, chọn <b>File → Open</b> rồi chọn tệp <code>.ust</code>; chọn giọng hát (voicebank) tiếng Việt cho rãnh. Mỗi nốt đã có sẵn một chữ. Nếu giọng không nhận chữ có dấu, hãy tích ô bỏ dấu rồi tải lại. Tệp <code>.musicxml</code> cũng mở được trong Synthesizer V hoặc ACE Studio (qua nhập MusicXML/MIDI) và giữ lời ở từng nốt.</p>' +
    '<p><b>Suno / Udio:</b> bấm nút bên trên, dán phần phong cách và phần lời vào hai ô tương ứng. Các dịch vụ này tự sáng tác lại giai điệu nên sẽ không giống hệt bản ở đây. Nếu dịch vụ cho tải âm thanh lên làm mẫu thì dùng tệp <code>.wav</code>.</p></details>' +
    '<details><summary>Mở trong Guitar Pro 8 thế nào?</summary><p>Chọn <b>Tệp → Mở</b>, rồi chọn tệp <code>.musicxml</code> hoặc <code>.xml</code>. Tệp này giữ nguyên lời, hợp âm và từng rãnh nhạc cụ nên sửa được từng nốt. Tệp <code>.mid</code> mở được tương tự nhưng không có hợp âm hiển thị.</p>' +
    '<p>Âm thanh nghe thử ở trên là bản tổng hợp đơn giản. Khi mở trong Guitar Pro 8 bạn sẽ nghe bằng bộ âm thanh RSE chân thực hơn nhiều.</p></details></section></div>';

  var $ = function (id) { return root.getElementById ? root.getElementById(id) : root.querySelector('#' + id); };
  var state = { style: 'ballad', mode: 'minor', range: 'low', seed: 1, tempo: 0, hist: [] };
  var song = null, ctx = null, bus = null, timer = 0, raf = 0, t0 = 0, notes = [], ptr = 0, playing = false;

  // --- dựng điều khiển
  var stBox = $('st');
  STYLE_ORDER.forEach(function (k) {
    var s = STYLES[k], b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.v = k;
    b.innerHTML = '<b>' + s.name + '</b><span>' + s.tempo + ' bpm, ' + s.beats + '/4</span>'; stBox.appendChild(b);
  });
  TONICS.forEach(function (n, i) { var o = document.createElement('option'); o.value = i; o.textContent = n; $('tn').appendChild(o); });
  [0, 2, 4].forEach(function (n) { var o = document.createElement('option'); o.value = n; o.textContent = INTRO_LABEL[n]; $('in').appendChild(o); });
  $('tn').value = 9; $('in').value = 2; $('hm').checked = true; $('sg').checked = true; $('kp').checked = true;
  $('ly').value = SAMPLE; $('ti').value = 'Trăm năm trong cõi người ta';

  function setPressed(box, attr, val) {
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b.dataset.v === val ? 'true' : 'false'); });
  }
  function readOpts() {
    return { title: $('ti').value.trim() || 'Bài thơ', lyrics: $('ly').value, style: state.style, tonic: +$('tn').value, mode: state.mode,
             tempo: state.tempo, range: state.range, intro: +$('in').value, harmony: $('hm').checked, strings: $('sg').checked,
             keep: $('kp').checked, seed: state.seed, lead: $('ld').value, comp: $('cp').value };
  }
  function save() {
    try { localStorage.setItem('tnx_v1', JSON.stringify({ o: readOpts(), seed: state.seed })); } catch (e) {}
  }
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem('tnx_v1') || 'null'); if (!d) return; var o = d.o;
      if (o.lyrics) { $('ly').value = o.lyrics; $('ti').value = o.title; }
      if (STYLES[o.style]) state.style = o.style; state.mode = o.mode === 'major' ? 'major' : 'minor'; state.range = o.range === 'high' ? 'high' : 'low';
      state.tempo = o.tempo || 0; state.seed = d.seed || 1;
      $('tn').value = o.tonic; $('in').value = o.intro; $('hm').checked = !!o.harmony; $('sg').checked = !!o.strings; $('kp').checked = !!o.keep;
      $('ld').value = o.lead; $('cp').value = o.comp;
    } catch (e) {}
  }

  /* ---- phát nhạc ---- */
  function stop() {
    playing = false; clearInterval(timer); cancelAnimationFrame(raf);
    if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; }
    $('pl').textContent = 'Nghe'; mark(-1);
  }
  function play() {
    if (!song || song.empty) return; stop();
    var AC = G.AudioContext || G.webkitAudioContext; if (!AC) { $('ms').textContent = 'Trình duyệt này không hỗ trợ phát âm thanh.'; return; }
    ctx = new AC(); bus = makeBus(ctx); notes = flatten(song); ptr = 0; t0 = ctx.currentTime + 0.2; playing = true;
    var total = song.nBars * song.barLen * 60 / song.tempo / 4;
    function pump() {
      if (!ctx) return;
      var now = ctx.currentTime - t0;
      while (ptr < notes.length && notes[ptr].t < now + 1.2) {
        var n = notes[ptr++];
        if (n.s === 'drums') playDrum(ctx, bus, n.m, t0 + n.t, n.v); else playNote(ctx, bus, n, t0 + n.t);
      }
      if (now > total + 2) stop();
    }
    pump(); timer = setInterval(pump, 200);
    $('pl').textContent = 'Đang phát';
    (function tick() { if (!playing) return; var sec = ctx.currentTime - t0; mark(sec); draw(sec); raf = requestAnimationFrame(tick); })();
  }
  function mark(sec) {
    var bi = sec < 0 ? -1 : Math.floor(sec / (song.barLen * 60 / song.tempo / 4));
    Array.prototype.forEach.call(root.querySelectorAll('.ln'), function (el) {
      el.classList.toggle('on', bi >= +el.dataset.a && bi <= +el.dataset.b);
    });
    Array.prototype.forEach.call(root.querySelectorAll('.ch i'), function (el) { el.classList.toggle('on', +el.dataset.bar === bi); });
  }

  /* ---- vẽ biểu đồ giai điệu ---- */
  function draw(sec) {
    var cv = $('cv'), dpr = G.devicePixelRatio || 1, w = cv.clientWidth || 600, h = cv.clientHeight || 150;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    if (!song || song.empty) return;
    var total = song.nBars * song.barLen, mel = song.tracks[0].voices[0], lo = 127, hi = 0;
    mel.forEach(function (e) { lo = Math.min(lo, e.n[0]); hi = Math.max(hi, e.n[0]); });
    lo -= 4; hi += 2; var pad = 8, ny = function (m) { return h - pad - (m - lo) / (hi - lo) * (h - 2 * pad); };
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1;
    song.bars.forEach(function (b) { if (b.idx === 0) return; var x = Math.round(b.t / total * w) + 0.5; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); });
    song.tracks.forEach(function (tr, ti) {
      if (ti > 1 || (ti === 1 && tr.id !== 'har')) return;
      c.fillStyle = ti === 0 ? '#f2c14e' : 'rgba(120,214,205,.75)';
      tr.voices[0].forEach(function (e) { c.fillRect(e.t / total * w, ny(e.n[0]) - 3, Math.max(2, e.d / total * w - 1), 6); });
    });
    if (sec != null && sec >= 0) {
      var x = sec / (total * 60 / song.tempo / 4) * w; c.fillStyle = '#fff'; c.fillRect(x, 0, 2, h);
    }
  }

  /* ---- dựng lại bài ---- */
  function renderChart() {
    var h = '';
    song.spans.forEach(function (sp) {
      if (sp.label) h += '<div class="sec">' + escH(sp.label) + '</div>';
      var cs = sp.chords.map(function (c, i) { return '<i data-bar="' + (sp.startBar + i) + '">' + escH(c) + '</i>'; }).join('');
      h += '<div class="ln ' + (sp.kind === 'inst' ? 'inst' : '') + '" data-a="' + sp.startBar + '" data-b="' + sp.endBar + '"><div class="ch">' + cs + '</div>' +
           '<div class="tx">' + (sp.text ? escH(sp.text) : '') + '</div></div>';
    });
    $('ct').innerHTML = h;
  }
  function regen() {
    stop(); save();
    var opts = readOpts();
    song = generate(opts);
    var empty = song.empty;
    ['pl', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'da'].forEach(function (id) { $(id).disabled = empty; });
    $('ms').textContent = empty ? 'Chưa có lời. Hãy nhập lời thơ để tạo nhạc.' : '';
    $('mt').textContent = song.keyName + ' · ' + song.styleName + ' · ' + song.tempo + ' bpm · ' + song.beats + '/4 · ' + song.nBars + ' ô nhịp · phương án ' + state.seed;
    $('tpo').textContent = song.tempo + ' bpm'; $('tp').value = song.tempo;
    renderChart(); draw(null);
  }
  var deb = 0; function later() { clearTimeout(deb); deb = setTimeout(regen, 350); }

  /* ---- sự kiện ---- */
  stBox.addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    state.style = b.dataset.v; state.tempo = 0; setPressed(stBox, 0, state.style); regen(); play();
  });
  $('md').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.mode = b.dataset.v; setPressed($('md'), 0, state.mode); regen(); });
  $('rg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.range = b.dataset.v; setPressed($('rg'), 0, state.range); regen(); });
  $('tp').addEventListener('input', function () { state.tempo = +$('tp').value; $('tpo').textContent = state.tempo + ' bpm'; later(); });
  $('tpa').addEventListener('click', function () { state.tempo = 0; regen(); });
  ['tn', 'in', 'hm', 'sg', 'kp', 'ld', 'cp'].forEach(function (id) { $(id).addEventListener('change', regen); });
  $('ly').addEventListener('input', later); $('ti').addEventListener('input', later);
  $('sm').addEventListener('click', function () { $('ly').value = SAMPLE; $('ti').value = 'Trăm năm trong cõi người ta'; regen(); });
  $('pl').addEventListener('click', play); $('sp').addEventListener('click', stop);
  $('rn').addEventListener('click', function () { state.hist.push(state.seed); state.seed = 1 + Math.floor(Math.random() * 9999); regen(); play(); });
  $('pv').addEventListener('click', function () { if (state.hist.length) { state.seed = state.hist.pop(); regen(); play(); } });
  G.addEventListener('resize', function () { draw(null); });

  /* ---- tải về ---- */
  function save_(name, data, type) {
    var url = URL.createObjectURL(new Blob([data], { type: type })), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  var base = function () { return slug(song.title); };
  var jobs = {
    d1: function (cb) { save_(base() + '.musicxml', toMusicXML(song), 'application/vnd.recordare.musicxml+xml'); cb(); },
    d2: function (cb) { save_(base() + '.xml', toMusicXML(song), 'application/xml'); cb(); },
    d3: function (cb) { save_(base() + '.mid', toMIDI(song), 'audio/midi'); cb(); },
    d4: function (cb) {
      $('ms').textContent = 'Đang tạo tệp âm thanh, vui lòng chờ vài giây...';
      renderWav(song, function (err, wav) { $('ms').textContent = err ? 'Không tạo được tệp WAV trên trình duyệt này.' : ''; if (!err) save_(base() + '.wav', wav, 'audio/wav'); cb(); });
    },
    d5: function (cb) { save_(base() + '_loi_hop_am.txt', '\ufeff' + song.chart, 'text/plain;charset=utf-8'); cb(); },
    d6: function (cb) { save_(base() + '.ust', toUST(song, $('ub').checked), 'text/plain;charset=utf-8'); cb(); },
    d7: function (cb) {
      var txt = toSuno(song), ok = function () { $('ms').textContent = 'Đã chép lời và prompt vào bộ nhớ tạm. Hãy dán vào Suno hoặc Udio.'; cb(); },
          fb = function () { save_(base() + '_suno.txt', '\ufeff' + txt, 'text/plain;charset=utf-8'); $('ms').textContent = 'Không chép được vào bộ nhớ tạm, đã tải tệp .txt về.'; cb(); };
      try { navigator.clipboard.writeText(txt).then(ok, fb); } catch (e) { fb(); }
    }
  };
  ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'].forEach(function (id) { $(id).addEventListener('click', function () { jobs[id](function () {}); }); });
  $('da').addEventListener('click', function () {
    var ids = ['d1', 'd3', 'd5', 'd4'], i = 0;
    (function next() { if (i < ids.length) jobs[ids[i++]](function () { setTimeout(next, 400); }); })();
  });

  load();
  setPressed(stBox, 0, state.style); setPressed($('md'), 0, state.mode); setPressed($('rg'), 0, state.range);
  regen();
}

G.TNX = { generate: generate, toMusicXML: toMusicXML, toMIDI: toMIDI, toUST: toUST, toSuno: toSuno, parseLyrics: parseLyrics, flatten: flatten,
          renderWav: renderWav, slug: slug, STYLES: STYLES, STYLE_ORDER: STYLE_ORDER, DEFAULTS: DEFAULTS, mount: mount };
if (typeof module !== 'undefined') module.exports = G.TNX;
if (typeof document !== 'undefined') {
  var auto = function () { var el = document.getElementById('tnx-app'); if (el) mount(el); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
}
})(typeof window !== 'undefined' ? window : globalThis);
