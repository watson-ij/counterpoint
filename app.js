import {
  NOTE_NAMES, CHROMATIC_SHARP, CHROMATIC_FLAT, CHROMATIC,
  SCALE_PATTERNS, SHARP_ORDER, FLAT_ORDER,
  KEY_DEFS, MODES, SAMPLE_CF,
  toMidi, semiDist, genericInterval, intervalInfo, motionType,
  buildDiatonicNames, buildModeNotes, getRaised7th, cfToNotes,
  checkMelodicLine, checkHarmony,
  migrateNoteName, getNoteAccidental, getKeySigWidth,
} from './music.js';

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO ENGINE (Web Audio API)
// ═══════════════════════════════════════════════════════════════════════════

let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playNote(midiNote, duration, delay) {
  duration = duration || 0.5;
  delay = delay || 0;
  try {
    initAudio();
    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const t = audioCtx.currentTime + delay;

    // Two oscillators for richer tone
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc1.type = 'triangle';
    osc1.frequency.value = freq;
    osc2.type = 'sine';
    osc2.frequency.value = freq * 1.002;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2500, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 0.5), t + duration * 0.8);

    // Envelope: attack -> sustain -> release
    // Zero the gain immediately to prevent click from default value of 1.0
    gainNode.gain.value = 0;
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.22, t + 0.015);
    gainNode.gain.linearRampToValueAtTime(0.14, t + duration * 0.2);
    gainNode.gain.linearRampToValueAtTime(0.001, t + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + duration + 0.05);
    osc2.stop(t + duration + 0.05);
    osc1.onended = () => { osc1.disconnect(); osc2.disconnect(); filter.disconnect(); gainNode.disconnect(); };
  } catch (e) {
    console.warn('Audio error:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// APPLICATION STATE
// ═══════════════════════════════════════════════════════════════════════════

let state = {
  cfNotes: [],
  cpNotes: [],
  mode: "C major",
  clef: "treble",
  cpAbove: true,
  activeVoice: "cp",
  cursor: 0,
  playing: false,
  playHead: -1,
  playTimer: null,
};

// ── Undo / Redo ──

const undoStack = [], redoStack = [];
const MAX_UNDO = 80;

function stateSnapshot() {
  return {
    cfNotes: state.cfNotes.map(n => n ? {...n} : null),
    cpNotes: state.cpNotes.map(n => n ? {...n} : null),
    mode: state.mode, clef: state.clef, cpAbove: state.cpAbove,
    activeVoice: state.activeVoice, cursor: state.cursor,
  };
}

function restoreSnapshot(snap) {
  state.cfNotes = snap.cfNotes;
  state.cpNotes = snap.cpNotes;
  state.mode = snap.mode;
  state.clef = snap.clef;
  state.cpAbove = snap.cpAbove;
  state.activeVoice = snap.activeVoice;
  state.cursor = snap.cursor;
  // Sync selects
  document.getElementById('modeSelect').value = state.mode;
  document.getElementById('clefSelect').value = state.clef;
  document.getElementById('btnAbove').className = 'btn' + (state.cpAbove ? ' act' : '');
  document.getElementById('btnBelow').className = 'btn' + (!state.cpAbove ? ' act' : '');
}

function pushUndo() {
  undoStack.push(stateSnapshot());
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(stateSnapshot());
  restoreSnapshot(undoStack.pop());
  render();
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(stateSnapshot());
  restoreSnapshot(redoStack.pop());
  render();
}

function initState(cfKey) {
  const cf = SAMPLE_CF[cfKey];
  state.mode = cf.mode;
  state.cfNotes = cfToNotes(cf.notes);
  const len = Math.max(state.cfNotes.length, 6);
  state.cpNotes = new Array(len).fill(null);
  state.cursor = 0;
  state.activeVoice = state.cfNotes.length > 0 ? "cp" : "cf";
  state.playing = false;
  state.playHead = -1;
  if (state.playTimer) clearTimeout(state.playTimer);
}

// ═══════════════════════════════════════════════════════════════════════════
// STAFF RENDERING (SVG)
// ═══════════════════════════════════════════════════════════════════════════

const STAFF_LINE_GAP = 11, NOTE_RY = 5.5, BAR_WIDTH = 56, LEFT_MARGIN = 16, CLEF_WIDTH = 32, STAFF_TOP = 60;

// Clef definitions: reference note sitting on the middle staff line
// treble: B4, alto: C4, bass: D3
const CLEFS = {
  treble: { ref: "B", refOct: 4, symbol: "\uD834\uDD1E", fontSize: 56, dy: 3.77 },
  alto:   { ref: "C", refOct: 4, symbol: "\uD834\uDD21", fontSize: 59, dy: 4.1 },
  bass:   { ref: "D", refOct: 3, symbol: "\uD834\uDD22", fontSize: 60, dy: 3.5 },
};

function noteToY(name, octave) {
  const c = CLEFS[state.clef] || CLEFS.treble;
  const refIdx = NOTE_NAMES.indexOf(c.ref) + c.refOct * 7;
  const noteIdx = NOTE_NAMES.indexOf(name[0]) + octave*7;
  return STAFF_TOP + 2*STAFF_LINE_GAP - (noteIdx - refIdx) * (STAFF_LINE_GAP/2);
}

function getLedgerLines(name, octave) {
  const y = noteToY(name, octave);
  const bot = STAFF_TOP + 4*STAFF_LINE_GAP;
  const lines = [];
  if (y > bot + STAFF_LINE_GAP*0.4) for (let ly = bot+STAFF_LINE_GAP; ly <= y+2; ly += STAFF_LINE_GAP) lines.push(ly);
  if (y < STAFF_TOP - STAFF_LINE_GAP*0.4) for (let ly = STAFF_TOP-STAFF_LINE_GAP; ly >= y-2; ly -= STAFF_LINE_GAP) lines.push(ly);
  return lines;
}

// Key signature vertical positions (octave for each accidental in standard order)
// These define which octave each sharp/flat appears at in the key signature for each clef
const KS_SHARP_OCTAVES = {
  treble: [5,4,5,4,4,4,4],  // F5 C5 G5 D5 A4 E5 B4
  alto:   [4,4,4,3,4,3,3],  // F4 C4 G4 D4 A3 E4 B3 — adjusted for alto
  bass:   [4,3,4,3,3,3,3],  // F4 C3 G4 D3 A3 E3 B3 — adjusted for bass
};
const KS_FLAT_OCTAVES = {
  treble: [4,5,4,5,4,4,4],  // B4 E5 A4 D5 G4 C5 F4
  alto:   [3,4,3,4,3,4,3],  // B3 E4 A3 D4 G3 C4 F3
  bass:   [3,3,3,3,3,3,2],  // B3 E3 A3 D3 G3 C3 F2
};

function renderKeySignature(clef, mode) {
  const mi = MODES[mode];
  if (!mi || mi.fifths === 0) return '';
  const count = Math.abs(mi.fifths);
  let svg = '';
  const startX = LEFT_MARGIN + CLEF_WIDTH + 2;

  if (mi.fifths > 0) {
    // Sharps
    const octs = KS_SHARP_OCTAVES[clef] || KS_SHARP_OCTAVES.treble;
    for (let i = 0; i < count; i++) {
      const note = SHARP_ORDER[i];
      const y = noteToY(note, octs[i]);
      svg += `<text x="${startX + i * 10}" y="${y + 4}" font-size="14" fill="#666" font-family="serif">♯</text>`;
    }
  } else {
    // Flats
    const octs = KS_FLAT_OCTAVES[clef] || KS_FLAT_OCTAVES.treble;
    for (let i = 0; i < count; i++) {
      const note = FLAT_ORDER[i];
      const y = noteToY(note, octs[i]);
      svg += `<text x="${startX + i * 10}" y="${y + 4}" font-size="14" fill="#666" font-family="serif">♭</text>`;
    }
  }
  return svg;
}

function renderStaff() {
  const totalBars = Math.max(state.cfNotes.length, 6);
  const keySigW = getKeySigWidth(state.mode);
  const contentStart = LEFT_MARGIN + CLEF_WIDTH + keySigW;
  const svgW = contentStart + totalBars * BAR_WIDTH + 30;
  const svgH = STAFF_TOP + 4*STAFF_LINE_GAP + 100;

  const nk = getNotesKey();
  if (nk !== _notesKey || !_cachedIssues) {
    _cachedIssues = runAnalysis();
    _notesKey = nk;
  }
  const issues = _cachedIssues;
  const errBars = new Set(issues.filter(i => i.sev==="error" && i.bar>=0).map(i => i.bar));
  const warnBars = new Set(issues.filter(i => i.sev==="warning" && i.bar>=0).map(i => i.bar));

  let svg = `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="display:block" role="img" aria-label="Musical staff with ${state.cfNotes.filter(Boolean).length} CF notes and ${state.cpNotes.filter(Boolean).length} CP notes">`;

  // Staff lines
  for (let i=0; i<5; i++) {
    svg += `<line x1="${LEFT_MARGIN}" y1="${STAFF_TOP+i*STAFF_LINE_GAP}" x2="${svgW-16}" y2="${STAFF_TOP+i*STAFF_LINE_GAP}" stroke="#2a2a3a" stroke-width="1"/>`;
  }
  // Clef
  const clefInfo = CLEFS[state.clef] || CLEFS.treble;
  svg += `<text x="${LEFT_MARGIN+4}" y="${STAFF_TOP+clefInfo.dy*STAFF_LINE_GAP}" font-size="${clefInfo.fontSize}" fill="#444" font-family="serif">${clefInfo.symbol}</text>`;

  // Key signature
  svg += renderKeySignature(state.clef, state.mode);

  // Bars
  for (let i=0; i<totalBars; i++) {
    const x = contentStart+i*BAR_WIDTH;
    const isCur = i===state.cursor;
    const isErr = errBars.has(i);
    const isWarn = !isErr && warnBars.has(i);
    const isPlay = i===state.playHead;

    const fill = isPlay ? "rgba(106,158,238,.12)" : isCur ? "rgba(106,158,238,.06)" : isErr ? "rgba(200,60,60,.06)" : isWarn ? "rgba(200,170,60,.04)" : "transparent";
    const stroke = isCur ? "#3a4a6c" : "transparent";
    const dash = isCur ? "3,2" : "0";

    svg += `<g class="bar-click" data-bar="${i}" style="cursor:pointer">`;
    svg += `<rect x="${x}" y="${STAFF_TOP-24}" width="${BAR_WIDTH}" height="${4*STAFF_LINE_GAP+52}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-dasharray="${dash}"/>`;
    svg += `<text x="${x+BAR_WIDTH/2}" y="${STAFF_TOP-12}" text-anchor="middle" font-size="9" fill="${isCur?'#6a9eee':'#333'}" font-family="'JetBrains Mono',monospace">${i+1}</text>`;

    // Interval label
    if (state.cfNotes[i] && state.cpNotes[i]) {
      const intv = intervalInfo(toMidi(state.cfNotes[i].name,state.cfNotes[i].octave), toMidi(state.cpNotes[i].name,state.cpNotes[i].octave));
      const col = intv.isDissonant ? "#c44" : intv.isPerfect ? "#6a9eee" : "#7a9a6a";
      svg += `<text x="${x+BAR_WIDTH/2}" y="${svgH-10}" text-anchor="middle" font-size="9" font-family="'JetBrains Mono',monospace" font-weight="500" fill="${col}">${intv.name}</text>`;
    }

    // Empty slot indicator
    if (!state.cfNotes[i] && state.activeVoice==="cf" && isCur)
      svg += `<text x="${x+BAR_WIDTH/2}" y="${STAFF_TOP+2*STAFF_LINE_GAP+3}" text-anchor="middle" font-size="9" fill="#555">?</text>`;
    if (state.cfNotes[i] && !state.cpNotes[i] && state.activeVoice==="cp" && isCur)
      svg += `<text x="${x+BAR_WIDTH/2}" y="${STAFF_TOP+(state.cpAbove?-2:4*STAFF_LINE_GAP+12)}" text-anchor="middle" font-size="9" fill="#555">?</text>`;

    svg += `</g>`;
  }

  // CF notes
  state.cfNotes.forEach((n,i) => {
    if (!n) return;
    const x = contentStart+i*BAR_WIDTH+BAR_WIDTH/2, y = noteToY(n.name, n.octave);
    const ldg = getLedgerLines(n.name, n.octave);
    const isCur = i===state.cursor && state.activeVoice==="cf";
    ldg.forEach(ly => { svg += `<line x1="${x-10}" y1="${ly}" x2="${x+10}" y2="${ly}" stroke="#2a2a3a" stroke-width="1"/>`; });
    const fill = isCur ? "#d4a84a" : "#a08040";
    const str = errBars.has(i) ? "#c44" : isCur ? "#e8c060" : "#806830";
    svg += `<g class="note-click" data-bar="${i}" data-voice="cf" style="cursor:pointer">`;
    svg += `<ellipse cx="${x}" cy="${y}" rx="${NOTE_RY+1}" ry="${NOTE_RY-1}" fill="${fill}" stroke="${str}" stroke-width="${isCur?1.5:1}" transform="rotate(-12,${x},${y})"/>`;
    const cfAcc = getNoteAccidental(n.name, state.mode);
    if (cfAcc) svg += `<text x="${x-11}" y="${y+4}" font-size="12" fill="#998" font-family="serif">${cfAcc}</text>`;
    const ty = (state.cpAbove || !state.cpNotes[i]) ? y+16 : y-12;
    svg += `<text x="${x}" y="${ty}" text-anchor="middle" font-size="7.5" fill="#665" font-family="'JetBrains Mono',monospace">${n.name}${n.octave}</text>`;
    svg += `</g>`;
  });

  // CP notes
  state.cpNotes.forEach((n,i) => {
    if (!n) return;
    const x = contentStart+i*BAR_WIDTH+BAR_WIDTH/2, y = noteToY(n.name, n.octave);
    const ldg = getLedgerLines(n.name, n.octave);
    const isCur = i===state.cursor && state.activeVoice==="cp";
    ldg.forEach(ly => { svg += `<line x1="${x-10}" y1="${ly}" x2="${x+10}" y2="${ly}" stroke="#2a2a3a" stroke-width="1"/>`; });
    const fill = isCur ? "#5a9aee" : "#3a6aaa";
    const str = errBars.has(i) ? "#c44" : isCur ? "#7abaff" : "#2a5a8a";
    svg += `<g class="note-click" data-bar="${i}" data-voice="cp" style="cursor:pointer">`;
    svg += `<ellipse cx="${x}" cy="${y}" rx="${NOTE_RY+1}" ry="${NOTE_RY-1}" fill="${fill}" stroke="${str}" stroke-width="${isCur?1.5:1}" transform="rotate(-12,${x},${y})"/>`;
    const cpAcc = getNoteAccidental(n.name, state.mode);
    if (cpAcc) svg += `<text x="${x-11}" y="${y+4}" font-size="12" fill="#8aa" font-family="serif">${cpAcc}</text>`;
    const ty = state.cpAbove ? y-10 : y+16;
    svg += `<text x="${x}" y="${ty}" text-anchor="middle" font-size="7.5" fill="#568" font-family="'JetBrains Mono',monospace">${n.name}${n.octave}</text>`;
    svg += `</g>`;

  });

  // Legend
  svg += `<g transform="translate(${LEFT_MARGIN},${svgH-24})">`;
  svg += `<ellipse cx="0" cy="0" rx="4.5" ry="3.5" fill="#a08040"/><text x="8" y="3" font-size="8" fill="#555" font-family="'JetBrains Mono',monospace">CF</text>`;
  svg += `<ellipse cx="30" cy="0" rx="4.5" ry="3.5" fill="#3a6aaa"/><text x="38" y="3" font-size="8" fill="#555" font-family="'JetBrains Mono',monospace">CP</text>`;
  svg += `</g>`;

  svg += `</svg>`;

  document.getElementById('staffWrap').innerHTML = svg;

  // Click handlers use event delegation (attached once in init)

  return issues;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

function runAnalysis() {
  const cfI = checkMelodicLine(state.cfNotes, state.mode, "CF");
  const cpFilled = state.cpNotes.filter(Boolean);
  const cpI = cpFilled.length > 0 ? checkMelodicLine(state.cpNotes, state.mode, "CP") : [];
  const hI = cpFilled.length > 0 ? checkHarmony(state.cfNotes, state.cpNotes, state.mode, state.cpAbove) : [];
  return [...cfI, ...cpI, ...hI];
}

function renderAnalysis(issues) {
  const errs = issues.filter(i => i.sev==="error");
  const warns = issues.filter(i => i.sev==="warning");
  const cpFilled = state.cpNotes.filter(Boolean).length;
  const allFilled = cpFilled === state.cfNotes.length && state.cfNotes.every(Boolean) && state.cfNotes.length > 0;
  const curIssues = issues.filter(i => i.bar === state.cursor);

  let html = `<div class="analysis-header"><span>Analysis</span>`;
  if (errs.length > 0) html += `<span style="font-size:10px;color:#c44">${errs.length} err</span>`;
  if (warns.length > 0) html += `<span style="font-size:10px;color:#ba4">${warns.length} warn</span>`;
  if (issues.length===0 && allFilled) html += `<span style="font-size:10px;color:#4b6">✓ All clear</span>`;
  html += `</div>`;

  // Current bar
  if (curIssues.length > 0) {
    html += `<div style="margin-bottom:6px"><div style="font-size:9px;color:#555;margin-bottom:2px">Bar ${state.cursor+1}:</div>`;
    curIssues.forEach(iss => {
      const cls = iss.sev==="error" ? "iss-e" : "iss-w";
      const bg = iss.sev==="error" ? "#c44" : "#ba4";
      const fg = iss.sev==="error" ? "#fff" : "#111";
      const lbl = iss.sev==="error" ? "ERR" : "WARN";
      html += `<div class="iss ${cls}"><span class="badge" style="background:${bg};color:${fg}">${lbl}</span><span>${iss.msg}</span></div>`;
    });
    html += `</div>`;
  }

  // All issues
  if (issues.length > 0) {
    html += `<details style="margin-top:4px"><summary>All issues (${issues.length})</summary><div class="issue-scroll">`;
    issues.forEach((iss, idx) => {
      const cls = iss.sev==="error" ? "iss-e" : "iss-w";
      const bg = iss.sev==="error" ? "#c44" : "#ba4";
      const fg = iss.sev==="error" ? "#fff" : "#111";
      const lbl = iss.sev==="error" ? "ERR" : "WARN";
      const pre = iss.bar >= 0 ? `<span style="color:${iss.sev==='error'?'#a66':'#a86'}">Bar ${iss.bar+1}: </span>` : "";
      html += `<div class="iss ${cls} iss-jump" data-bar="${iss.bar}"><span class="badge" style="background:${bg};color:${fg}">${lbl}</span><span>${pre}${iss.msg}</span></div>`;
    });
    html += `</div></details>`;
  }

  if (issues.length===0 && allFilled) {
    html += `<div class="iss iss-ok"><span class="badge" style="background:#4b6;color:#111">PASS</span><span>Your counterpoint follows all first species rules!</span></div>`;
  }

  if (cpFilled > 0 && cpFilled < state.cfNotes.length) {
    html += `<div style="font-size:10px;color:#555;margin-top:4px">${state.cfNotes.length - cpFilled} bar${state.cfNotes.length-cpFilled!==1?'s':''} still need CP</div>`;
  }

  document.getElementById('analysisPanel').innerHTML = html;
  // Click handlers use event delegation (attached once in init)
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTE KEYBOARD
// ═══════════════════════════════════════════════════════════════════════════

function renderKeyboard() {
  const mi = MODES[state.mode];
  const octaves = state.activeVoice === "cp"
    ? (state.cpAbove ? [4,5] : [3,4])
    : [3,4,5];

  const r7raw = getRaised7th(state.mode);
  const r7 = (r7raw && !mi.notes.includes(r7raw)) ? r7raw : null;

  let html = '';
  octaves.forEach(oct => {
    html += `<div class="oct-row"><span class="oct-label">${oct}</span>`;
    mi.notes.forEach(nm => {
      const cls = nm.length > 1 ? 'nbtn sharp' : 'nbtn';
      html += `<button class="${cls}" data-note="${nm}" data-oct="${oct}">${nm}${oct}</button>`;
    });
    if (r7) {
      html += `<button class="nbtn sharp" data-note="${r7}" data-oct="${oct}" title="Leading tone">${r7}${oct}</button>`;
    }
    html += `</div>`;
  });

  document.getElementById('noteKeyboard').innerHTML = html;
  // Click handlers use event delegation (attached once in init)
}

// ═══════════════════════════════════════════════════════════════════════════
// UI ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

function addNote(name, octave) {
  pushUndo();
  initAudio();
  const midi = toMidi(name, octave);
  playNote(midi, 0.4);

  if (state.activeVoice === "cf") {
    if (state.cursor < state.cfNotes.length) {
      state.cfNotes[state.cursor] = {name, octave};
    } else {
      while (state.cfNotes.length <= state.cursor) state.cfNotes.push(null);
      state.cfNotes[state.cursor] = {name, octave};
    }
    // Ensure cpNotes matches length
    while (state.cpNotes.length < state.cfNotes.length) state.cpNotes.push(null);
    // Play other voice for context
    if (state.cpNotes[state.cursor]) playNote(toMidi(state.cpNotes[state.cursor].name, state.cpNotes[state.cursor].octave), 0.4);
  } else {
    if (state.cursor < state.cfNotes.length) {
      state.cpNotes[state.cursor] = {name, octave};
      if (state.cfNotes[state.cursor]) playNote(toMidi(state.cfNotes[state.cursor].name, state.cfNotes[state.cursor].octave), 0.4);
    }
  }

  state.cursor = Math.min(state.cursor + 1, state.cfNotes.length - 1);
  render();
}

function clearNote() {
  pushUndo();
  if (state.activeVoice === "cf" && state.cursor < state.cfNotes.length) {
    state.cfNotes[state.cursor] = null;
  } else if (state.cursor < state.cpNotes.length) {
    state.cpNotes[state.cursor] = null;
  }
  render();
}

function clearCP() {
  if (state.cpNotes.every(n => n === null)) return;
  pushUndo();
  state.cpNotes = new Array(state.cfNotes.length).fill(null);
  state.activeVoice = "cp";
  state.cursor = 0;
  render();
}

function moveCursor(dir) {
  const maxIdx = Math.max(0, state.cfNotes.length - 1);
  state.cursor = Math.max(0, Math.min(state.cursor + dir, maxIdx));
  render();
}

function addBar() {
  pushUndo();
  state.cfNotes.push(null);
  state.cpNotes.push(null);
  render();
}

function removeBar() {
  if (state.cfNotes.length <= 1) return;
  pushUndo();
  state.cfNotes.pop();
  state.cpNotes.pop();
  state.cursor = Math.min(state.cursor, state.cfNotes.length - 1);
  render();
}

function setActiveVoice(v) {
  state.activeVoice = v;
  render();
}

function setCpAbove(v) {
  pushUndo();
  state.cpAbove = v;
  document.getElementById('btnAbove').className = 'btn' + (v ? ' act' : '');
  document.getElementById('btnBelow').className = 'btn' + (!v ? ' act' : '');
  render();
}

function switchToCP() {
  state.activeVoice = "cp";
  state.cursor = 0;
  render();
}

function toggleRules() {
  const p = document.getElementById('rulesPanel');
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

// Playback
function stopPlayback() {
  if (state.playTimer) clearTimeout(state.playTimer);
  state.playing = false;
  state.playHead = -1;
  document.getElementById('btnPlayBoth').className = 'btn play';
  document.getElementById('btnPlayBoth').textContent = '▶ Both';
}

function playAll() {
  initAudio();
  if (state.playing) { stopPlayback(); render(); return; }
  state.playing = true;
  document.getElementById('btnPlayBoth').className = 'btn stop';
  document.getElementById('btnPlayBoth').textContent = '■ Stop';
  const tempo = 600;
  let i = 0;
  function step() {
    if (i >= state.cfNotes.length || !state.playing) {
      stopPlayback(); render(); return;
    }
    state.playHead = i;
    if (state.cfNotes[i]) playNote(toMidi(state.cfNotes[i].name, state.cfNotes[i].octave), tempo/1000*0.9);
    if (state.cpNotes[i]) playNote(toMidi(state.cpNotes[i].name, state.cpNotes[i].octave), tempo/1000*0.9);
    renderStaff(); // just update staff for playhead
    i++;
    state.playTimer = setTimeout(step, tempo);
  }
  step();
}

function playSingle(voice) {
  initAudio();
  if (state.playing) { stopPlayback(); render(); return; }
  state.playing = true;
  const notes = voice === 'cf' ? state.cfNotes : state.cpNotes;
  const tempo = 500;
  let i = 0;
  function step() {
    if (i >= notes.length || !state.playing) {
      stopPlayback(); render(); return;
    }
    state.playHead = i;
    if (notes[i]) playNote(toMidi(notes[i].name, notes[i].octave), tempo/1000*0.9);
    renderStaff();
    i++;
    state.playTimer = setTimeout(step, tempo);
  }
  step();
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTE RE-SPELLING (uses migrateNoteName from music.js)
// ═══════════════════════════════════════════════════════════════════════════

// Re-spell all notes in state when switching between modes
function respellNotes(oldMode, newMode) {
  function respell(notes) {
    for (let i = 0; i < notes.length; i++) {
      if (notes[i]) notes[i].name = migrateNoteName(notes[i].name, newMode);
    }
  }
  respell(state.cfNotes);
  respell(state.cpNotes);
}

// ═══════════════════════════════════════════════════════════════════════════
// LOCAL STORAGE
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "counterpoint_session";

function saveState() {
  try {
    const data = {
      cfNotes: state.cfNotes,
      cpNotes: state.cpNotes,
      mode: state.mode,
      clef: state.clef,
      cpAbove: state.cpAbove,
      activeVoice: state.activeVoice,
      cursor: state.cursor,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Could not save to localStorage:", e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.cfNotes)) return false;
    state.cfNotes = data.cfNotes;
    state.cpNotes = data.cpNotes || new Array(data.cfNotes.length).fill(null);
    state.mode = data.mode && MODES[data.mode] ? data.mode : "C major";
    state.clef = data.clef && CLEFS[data.clef] ? data.clef : "treble";
    state.cpAbove = data.cpAbove !== false;
    state.activeVoice = data.activeVoice === "cf" ? "cf" : "cp";
    state.cursor = typeof data.cursor === "number" ? Math.min(data.cursor, state.cfNotes.length - 1) : 0;
    // Re-spell saved notes to match current key convention
    respellNotes(null, state.mode);
    return true;
  } catch (e) {
    console.warn("Could not load from localStorage:", e);
    return false;
  }
}

function clearSaved() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

function exportJSON() {
  const data = {
    mode: state.mode,
    clef: state.clef,
    cpAbove: state.cpAbove,
    cfNotes: state.cfNotes,
    cpNotes: state.cpNotes,
  };
  downloadFile("counterpoint.json", JSON.stringify(data, null, 2), "application/json");
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || !Array.isArray(data.cfNotes)) { alert("Invalid file format."); return; }
      state.cfNotes = data.cfNotes;
      state.cpNotes = data.cpNotes || new Array(data.cfNotes.length).fill(null);
      state.mode = data.mode && MODES[data.mode] ? data.mode : "C major";
      state.clef = data.clef && CLEFS[data.clef] ? data.clef : "treble";
      state.cpAbove = data.cpAbove !== false;
      state.activeVoice = "cp";
      state.cursor = 0;
      // Re-spell imported notes to match key convention
      respellNotes(null, state.mode);
      // Sync select elements
      document.getElementById("cfSelect").value = "";
      document.getElementById("modeSelect").value = state.mode;
      document.getElementById("clefSelect").value = state.clef;
      render();
    } catch (err) {
      alert("Could not parse file: " + err.message);
    }
  };
  reader.readAsText(file);
}

function exportText() {
  const mi = MODES[state.mode];
  let txt = `First Species Counterpoint — ${state.mode}\n`;
  txt += `CP position: ${state.cpAbove ? "above" : "below"}\n`;
  txt += `${"—".repeat(40)}\n`;
  txt += `Bar  CF       CP       Interval\n`;
  txt += `${"—".repeat(40)}\n`;
  const n = state.cfNotes.length;
  for (let i = 0; i < n; i++) {
    const cf = state.cfNotes[i] ? `${state.cfNotes[i].name}${state.cfNotes[i].octave}` : "—";
    const cp = state.cpNotes[i] ? `${state.cpNotes[i].name}${state.cpNotes[i].octave}` : "—";
    let intv = "";
    if (state.cfNotes[i] && state.cpNotes[i]) {
      intv = intervalInfo(
        toMidi(state.cfNotes[i].name, state.cfNotes[i].octave),
        toMidi(state.cpNotes[i].name, state.cpNotes[i].octave)
      ).name;
    }
    txt += `${String(i + 1).padStart(3)}  ${cf.padEnd(8)} ${cp.padEnd(8)} ${intv}\n`;
  }
  const issues = runAnalysis();
  if (issues.length > 0) {
    txt += `\n${"—".repeat(40)}\nAnalysis (${issues.length} issue${issues.length !== 1 ? "s" : ""})\n`;
    issues.forEach(iss => {
      const loc = iss.bar >= 0 ? `Bar ${iss.bar + 1}` : "General";
      txt += `  [${iss.sev.toUpperCase()}] ${loc}: ${iss.msg}\n`;
    });
  } else if (state.cpNotes.filter(Boolean).length === n && state.cfNotes.every(Boolean)) {
    txt += `\nAll first species rules satisfied.\n`;
  }
  downloadFile("counterpoint.txt", txt, "text/plain");
}

function exportMusicXML() {
  const mi = MODES[state.mode];
  const n = state.cfNotes.length;
  const xmlClef = { treble: { sign: "G", line: 2 }, alto: { sign: "C", line: 3 }, bass: { sign: "F", line: 4 } };
  const cl = xmlClef[state.clef] || xmlClef.treble;

  function noteToXML(note, voice) {
    if (!note) return `        <note><rest/><duration>4</duration><type>whole</type><voice>${voice}</voice></note>\n`;
    const step = note.name[0];
    const alter = note.name.includes("#") ? 1 : note.name.includes("b") ? -1 : 0;
    let xml = `        <note>\n`;
    xml += `          <pitch>\n`;
    xml += `            <step>${step}</step>\n`;
    if (alter !== 0) xml += `            <alter>${alter}</alter>\n`;
    xml += `            <octave>${note.octave}</octave>\n`;
    xml += `          </pitch>\n`;
    xml += `          <duration>4</duration>\n`;
    xml += `          <type>whole</type>\n`;
    xml += `          <voice>${voice}</voice>\n`;
    xml += `        </note>\n`;
    return xml;
  }

  const fifths = (MODES[state.mode] && MODES[state.mode].fifths) || 0;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n`;
  xml += `<score-partwise version="4.0">\n`;
  xml += `  <work><work-title>First Species Counterpoint — ${state.mode}</work-title></work>\n`;
  xml += `  <part-list>\n`;
  xml += `    <score-part id="P1"><part-name>Counterpoint</part-name></score-part>\n`;
  xml += `    <score-part id="P2"><part-name>Cantus Firmus</part-name></score-part>\n`;
  xml += `  </part-list>\n`;

  // CP part
  xml += `  <part id="P1">\n`;
  for (let i = 0; i < n; i++) {
    xml += `    <measure number="${i + 1}">\n`;
    if (i === 0) {
      xml += `      <attributes>\n`;
      xml += `        <divisions>4</divisions>\n`;
      xml += `        <key><fifths>${fifths}</fifths></key>\n`;
      xml += `        <time><beats>4</beats><beat-type>4</beat-type></time>\n`;
      xml += `        <clef><sign>${cl.sign}</sign><line>${cl.line}</line></clef>\n`;
      xml += `      </attributes>\n`;
    }
    xml += noteToXML(state.cpNotes[i], 1);
    xml += `    </measure>\n`;
  }
  xml += `  </part>\n`;

  // CF part
  xml += `  <part id="P2">\n`;
  for (let i = 0; i < n; i++) {
    xml += `    <measure number="${i + 1}">\n`;
    if (i === 0) {
      xml += `      <attributes>\n`;
      xml += `        <divisions>4</divisions>\n`;
      xml += `        <key><fifths>${fifths}</fifths></key>\n`;
      xml += `        <time><beats>4</beats><beat-type>4</beat-type></time>\n`;
      xml += `        <clef><sign>${cl.sign}</sign><line>${cl.line}</line></clef>\n`;
      xml += `      </attributes>\n`;
    }
    xml += noteToXML(state.cfNotes[i], 1);
    xml += `    </measure>\n`;
  }
  xml += `  </part>\n`;
  xml += `</score-partwise>\n`;

  downloadFile("counterpoint.musicxml", xml, "application/vnd.recordare.musicxml+xml");
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════════════════

// Render caching: skip expensive work on cursor-only changes
let _cachedIssues = null;
let _notesKey = '';
let _kbKey = '';

function getNotesKey() {
  return JSON.stringify(state.cfNotes) + '|' + JSON.stringify(state.cpNotes) + '|' + state.mode + '|' + state.cpAbove;
}

function render() {
  // Tabs
  document.getElementById('tabCF').className = 'tab' + (state.activeVoice==='cf' ? ' act-cf' : '');
  document.getElementById('tabCF').setAttribute('aria-selected', state.activeVoice==='cf');
  const cpCount = state.cpNotes.filter(Boolean).length;
  document.getElementById('tabCP').className = 'tab' + (state.activeVoice==='cp' ? ' act-cp' : '');
  document.getElementById('tabCP').setAttribute('aria-selected', state.activeVoice==='cp');
  document.getElementById('tabCP').textContent = 'Counterpoint' + (cpCount > 0 ? ` (${cpCount}/${state.cfNotes.length})` : '');

  // Bar info
  let bi = `Bar ${state.cursor+1}/${Math.max(state.cfNotes.length,6)}`;
  if (state.activeVoice==='cf' && state.cfNotes[state.cursor])
    bi += ` · ${state.cfNotes[state.cursor].name}${state.cfNotes[state.cursor].octave}`;
  if (state.activeVoice==='cp' && state.cpNotes[state.cursor])
    bi += ` · ${state.cpNotes[state.cursor].name}${state.cpNotes[state.cursor].octave}`;
  document.getElementById('barInfo').textContent = bi;

  // Context info
  let ctx;
  if (state.activeVoice==='cf') {
    ctx = state.cfNotes[state.cursor]
      ? `CF bar ${state.cursor+1} = ${state.cfNotes[state.cursor].name}${state.cfNotes[state.cursor].octave} — click to replace`
      : `CF bar ${state.cursor+1} — click a note to place`;
  } else {
    if (state.cpNotes[state.cursor]) {
      ctx = `CP bar ${state.cursor+1} = ${state.cpNotes[state.cursor].name}${state.cpNotes[state.cursor].octave}`;
      if (state.cfNotes[state.cursor]) ctx += ` vs CF ${state.cfNotes[state.cursor].name}${state.cfNotes[state.cursor].octave}`;
    } else if (state.cfNotes[state.cursor]) {
      ctx = `CP bar ${state.cursor+1} — write against CF ${state.cfNotes[state.cursor].name}${state.cfNotes[state.cursor].octave}`;
    } else {
      ctx = `Bar ${state.cursor+1} — no CF note yet`;
    }
  }
  document.getElementById('ctxInfo').textContent = ctx;

  // Write CP button
  const showWriteCP = state.activeVoice === 'cf' && state.cfNotes.filter(Boolean).length >= 5;
  document.getElementById('btnWriteCP').style.display = showWriteCP ? 'inline-flex' : 'none';

  // Keyboard — only rebuild when mode/voice/position changes
  const kk = state.mode + '|' + state.activeVoice + '|' + state.cpAbove;
  if (kk !== _kbKey) {
    renderKeyboard();
    _kbKey = kk;
  }

  // Staff & Analysis
  const issues = renderStaff();
  renderAnalysis(issues);

  // Persist to localStorage
  saveState();
}

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════

function init() {
  // Event delegation for staff clicks
  document.getElementById('staffWrap').addEventListener('click', (e) => {
    const noteEl = e.target.closest('.note-click');
    if (noteEl) {
      state.cursor = parseInt(noteEl.dataset.bar);
      state.activeVoice = noteEl.dataset.voice;
      render();
      return;
    }
    const barEl = e.target.closest('.bar-click');
    if (barEl) {
      state.cursor = parseInt(barEl.dataset.bar);
      render();
    }
  });

  // Event delegation for keyboard note buttons
  document.getElementById('noteKeyboard').addEventListener('click', (e) => {
    const btn = e.target.closest('.nbtn');
    if (!btn) return;
    addNote(btn.dataset.note, parseInt(btn.dataset.oct));
  });

  // Event delegation for analysis issue jump-to-bar
  document.getElementById('analysisPanel').addEventListener('click', (e) => {
    const iss = e.target.closest('.iss-jump');
    if (!iss) return;
    const b = parseInt(iss.dataset.bar);
    if (b >= 0) { state.cursor = b; render(); }
  });

  // ── Button bindings (replacing inline onclick handlers) ──

  // Controls row: CP position
  document.getElementById('btnAbove').addEventListener('click', () => setCpAbove(true));
  document.getElementById('btnBelow').addEventListener('click', () => setCpAbove(false));

  // Controls row: add/remove bar
  document.getElementById('btnAddBar').addEventListener('click', () => addBar());
  document.getElementById('btnRemoveBar').addEventListener('click', () => removeBar());

  // Playback
  document.getElementById('btnPlayBoth').addEventListener('click', () => playAll());
  document.getElementById('btnPlayCF').addEventListener('click', () => playSingle('cf'));
  document.getElementById('btnPlayCP').addEventListener('click', () => playSingle('cp'));

  // Rules toggle
  document.getElementById('btnRules').addEventListener('click', () => toggleRules());

  // Export / import
  document.getElementById('btnExportJSON').addEventListener('click', () => exportJSON());
  document.getElementById('btnExportXML').addEventListener('click', () => exportMusicXML());
  document.getElementById('btnExportText').addEventListener('click', () => exportText());
  document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importFile').click());

  // Voice tabs
  document.getElementById('tabCF').addEventListener('click', () => setActiveVoice('cf'));
  document.getElementById('tabCP').addEventListener('click', () => setActiveVoice('cp'));

  // Nav row
  document.getElementById('btnClear').addEventListener('click', () => clearNote());
  document.getElementById('btnClearCP').addEventListener('click', () => clearCP());
  document.getElementById('btnPrev').addEventListener('click', () => moveCursor(-1));
  document.getElementById('btnNext').addEventListener('click', () => moveCursor(1));
  document.getElementById('btnUndo').addEventListener('click', () => undo());
  document.getElementById('btnRedo').addEventListener('click', () => redo());
  document.getElementById('btnWriteCP').addEventListener('click', () => switchToCP());

  // Populate selects
  const cfSel = document.getElementById('cfSelect');
  Object.keys(SAMPLE_CF).forEach(k => {
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = k;
    cfSel.appendChild(opt);
  });
  cfSel.addEventListener('change', () => { clearSaved(); initState(cfSel.value); render(); });

  const modeSel = document.getElementById('modeSelect');
  const modeGroups = [
    ["Major Keys", KEY_DEFS.filter(d => d[3] === "major").map(d => d[0])],
    ["Minor Keys", KEY_DEFS.filter(d => d[3] === "minor").map(d => d[0])],
    ["Modes", KEY_DEFS.filter(d => !["major","minor"].includes(d[3])).map(d => d[0])],
  ];
  modeGroups.forEach(([label, keys]) => {
    const grp = document.createElement('optgroup');
    grp.label = label;
    keys.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = k;
      grp.appendChild(opt);
    });
    modeSel.appendChild(grp);
  });
  modeSel.addEventListener('change', () => {
    const oldMode = state.mode;
    state.mode = modeSel.value;
    respellNotes(oldMode, state.mode);
    render();
  });

  const clefSel = document.getElementById('clefSelect');
  clefSel.addEventListener('change', () => { state.clef = clefSel.value; render(); });

  // Import file input (hidden)
  const fileInput = document.getElementById('importFile');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) importJSON(e.target.files[0]);
      e.target.value = "";
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) { e.preventDefault(); redo(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); moveCursor(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); moveCursor(-1); }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (document.activeElement.tagName !== 'SELECT') { e.preventDefault(); clearNote(); }
    }
    if (e.key === 'Tab') { e.preventDefault(); setActiveVoice(state.activeVoice==='cf'?'cp':'cf'); }
    // Note input via letter keys
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const noteMap = {'c':'C','d':'D','e':'E','f':'F','g':'G','a':'A','b':'B'};
      const k = noteMap[e.key.toLowerCase()];
      if (k) {
        e.preventDefault();
        const mi = MODES[state.mode];
        // Find the matching note name in the current mode (may be sharp variant)
        const noteName = mi.notes.find(n => n[0] === k) || k;
        const defaultOct = state.activeVoice === 'cp'
          ? (state.cpAbove ? 4 : 3)
          : 4;
        addNote(noteName, defaultOct);
        return;
      }
    }
  });

  // Restore saved session, or fall back to default preset
  if (!loadState()) {
    initState('Fux C major');
  }
  // Sync select elements to current state
  modeSel.value = state.mode;
  clefSel.value = state.clef;
  render();

  // Init audio on first interaction
  document.addEventListener('click', initAudio, { once: true });
}

document.addEventListener('DOMContentLoaded', init);
