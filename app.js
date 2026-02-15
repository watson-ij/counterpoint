// ═══════════════════════════════════════════════════════════════════════════
// MUSIC THEORY
// ═══════════════════════════════════════════════════════════════════════════

const NOTE_NAMES = ["C","D","E","F","G","A","B"];
const CHROMATIC = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function toMidi(name, octave) {
  const b = CHROMATIC.indexOf(name);
  return b === -1 ? -1 : (octave + 1) * 12 + b;
}
function semiDist(m1, m2) { return Math.abs(m2 - m1); }
function genericInterval(n1, o1, n2, o2) {
  return Math.abs((NOTE_NAMES.indexOf(n2[0]) + o2*7) - (NOTE_NAMES.indexOf(n1[0]) + o1*7));
}

function intervalInfo(midi1, midi2) {
  const diff = Math.abs(midi2 - midi1), simple = diff % 12;
  const PERF = [0,7], IMP = [3,4,8,9];
  const isPerfect = PERF.includes(simple) || diff === 12;
  const isImperfect = IMP.includes(simple);
  const isDissonant = !isPerfect && !isImperfect;
  const nm = {0:"P1",1:"m2",2:"M2",3:"m3",4:"M3",5:"P4",6:"TT",7:"P5",8:"m6",9:"M6",10:"m7",11:"M7"};
  let name = nm[simple] || "?";
  if (diff === 12) name = "P8";
  else if (diff > 12) {
    if (simple===3||simple===4) name="10"; else if (simple===7) name="P12";
    else if (simple===8||simple===9) name="13"; else if (simple===0) name="P15";
    else name = nm[simple];
  }
  return { semitones:diff, simple, isPerfect, isImperfect, isDissonant, name };
}

function motionType(v1a,v1b,v2a,v2b) {
  const d1=v1b-v1a, d2=v2b-v2a;
  if (d1===0&&d2===0) return "static";
  if (d1===0||d2===0) return "oblique";
  if ((d1>0&&d2<0)||(d1<0&&d2>0)) return "contrary";
  if (Math.sign(d1)===Math.sign(d2)) {
    const i1=intervalInfo(Math.min(v1a,v2a),Math.max(v1a,v2a));
    const i2=intervalInfo(Math.min(v1b,v2b),Math.max(v1b,v2b));
    if (i1.simple===i2.simple && i1.semitones===i2.semitones) return "parallel";
  }
  return "similar";
}

// ═══════════════════════════════════════════════════════════════════════════
// MODES & PRESET CF
// ═══════════════════════════════════════════════════════════════════════════

const MODES = {
  "C major":     {tonic:"C",notes:["C","D","E","F","G","A","B"],minor:false},
  "D dorian":    {tonic:"D",notes:["C","D","E","F","G","A","B"],minor:true},
  "D minor":     {tonic:"D",notes:["C","D","E","F","G","A","A#"],minor:true},
  "E phrygian":  {tonic:"E",notes:["C","D","E","F","G","A","B"],minor:true},
  "F major":     {tonic:"F",notes:["C","D","E","F","G","A","A#"],minor:false},
  "G major":     {tonic:"G",notes:["C","D","E","F#","G","A","B"],minor:false},
  "G mixolydian":{tonic:"G",notes:["C","D","E","F","G","A","B"],minor:false},
  "A minor":     {tonic:"A",notes:["C","D","E","F","G","A","B"],minor:true},
  "A aeolian":   {tonic:"A",notes:["C","D","E","F","G","A","B"],minor:true},
};

const SAMPLE_CF = {
  "Fux C major":     {mode:"C major",notes:[{n:"C",o:4},{n:"D",o:4},{n:"F",o:4},{n:"E",o:4},{n:"D",o:4},{n:"E",o:4},{n:"F",o:4},{n:"E",o:4},{n:"D",o:4},{n:"C",o:4}]},
  "Fux D dorian":    {mode:"D dorian",notes:[{n:"D",o:4},{n:"F",o:4},{n:"E",o:4},{n:"D",o:4},{n:"G",o:4},{n:"F",o:4},{n:"A",o:4},{n:"G",o:4},{n:"F",o:4},{n:"E",o:4},{n:"D",o:4}]},
  "Fux F major":     {mode:"F major",notes:[{n:"F",o:4},{n:"G",o:4},{n:"A",o:4},{n:"F",o:4},{n:"D",o:4},{n:"E",o:4},{n:"F",o:4},{n:"C",o:5},{n:"A",o:4},{n:"F",o:4},{n:"G",o:4},{n:"F",o:4}]},
  "Schenker C major":{mode:"C major",notes:[{n:"C",o:4},{n:"D",o:4},{n:"E",o:4},{n:"C",o:4},{n:"A",o:3},{n:"B",o:3},{n:"C",o:4},{n:"E",o:4},{n:"D",o:4},{n:"C",o:4}]},
  "Custom (empty)":  {mode:"C major",notes:[]},
};

function cfToNotes(arr) { return arr.map(x => ({name:x.n, octave:x.o})); }

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
  } catch (e) {
    console.warn('Audio error:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RULE CHECKER
// ═══════════════════════════════════════════════════════════════════════════

function checkMelodicLine(notes, mode, label) {
  const issues = [];
  const filled = [], filledIdx = [];
  for (let i = 0; i < notes.length; i++) {
    if (notes[i]) { filled.push(notes[i]); filledIdx.push(i); }
  }
  if (filled.length === 0) return issues;
  const mi = MODES[mode];

  // Tonic start/end
  if (notes[0] && notes[0].name !== mi.tonic)
    issues.push({sev:"error",bar:0,msg:label+" should begin on "+mi.tonic});
  const li = filledIdx[filledIdx.length-1];
  if (li === notes.length-1 && filled[filled.length-1].name !== mi.tonic)
    issues.push({sev:"error",bar:li,msg:label+" should end on "+mi.tonic});

  // Range & climax
  const midis = filled.map(n => toMidi(n.name,n.octave));
  if (midis.length > 1) {
    const range = Math.max(...midis) - Math.min(...midis);
    if (range > 16) issues.push({sev:"error",bar:-1,msg:label+" range exceeds 10th"});
    else if (range > 12) issues.push({sev:"warning",bar:-1,msg:label+" range exceeds octave"});
    const mx = Math.max(...midis);
    const peaks = filledIdx.filter((_,j) => midis[j]===mx);
    if (peaks.length > 1) issues.push({sev:"warning",bar:peaks[1],msg:label+": multiple high points"});
  }

  // Scale check
  for (let i = 0; i < notes.length; i++) {
    if (!notes[i]) continue;
    if (!mi.notes.includes(notes[i].name)) {
      const idx = CHROMATIC.indexOf(mi.tonic);
      const r7 = CHROMATIC[(idx+11)%12];
      if (!(mi.minor && notes[i].name === r7))
        issues.push({sev:"warning",bar:i,msg:notes[i].name+" not in "+mode});
    }
  }

  // Consecutive melodic
  let cLeaps=0, lDir=0;
  for (let j=1; j<filled.length; j++) {
    if (filledIdx[j] !== filledIdx[j-1]+1) { cLeaps=0; continue; }
    const m1=toMidi(filled[j-1].name,filled[j-1].octave);
    const m2=toMidi(filled[j].name,filled[j].octave);
    const s=semiDist(m1,m2);
    const gi=genericInterval(filled[j-1].name,filled[j-1].octave,filled[j].name,filled[j].octave);
    const dir=m2>m1?1:m2<m1?-1:0;
    const bar=filledIdx[j];

    if (s===0 && label==="CF") issues.push({sev:"error",bar:bar,msg:"Repeated note in CF"});
    else if (s===0) issues.push({sev:"warning",bar:bar,msg:"Repeated note in CP"});
    if (s===6) issues.push({sev:"error",bar:bar,msg:"Melodic tritone in "+label});
    if (s>=10 && s<=11) issues.push({sev:"error",bar:bar,msg:"Melodic 7th in "+label});
    if (s===3 && gi===1) issues.push({sev:"error",bar:bar,msg:"Aug 2nd in "+label});
    if (s>12) issues.push({sev:"error",bar:bar,msg:"Leap > octave in "+label});

    if (gi>=2) {
      cLeaps++;
      if (cLeaps>=3) issues.push({sev:"warning",bar:bar,msg:"3+ consecutive leaps in "+label});
      if (cLeaps>=2 && dir===lDir && dir!==0)
        issues.push({sev:"warning",bar:bar,msg:"Consecutive leaps same direction in "+label});
      lDir=dir;
    } else { cLeaps=0; lDir=0; }
  }

  // Approach final by step
  if (filled.length>=2) {
    const a=filledIdx.length-1, b=filledIdx.length-2;
    if (filledIdx[a]===notes.length-1 && filledIdx[b]===notes.length-2) {
      const gi=genericInterval(filled[b].name,filled[b].octave,filled[a].name,filled[a].octave);
      if (gi>1) issues.push({sev:"error",bar:notes.length-1,msg:label+": approach final by step"});
    }
  }
  return issues;
}

function checkHarmony(cf, cp, mode, cpAbove) {
  const issues = [];
  const n = cf.length;
  const cfM = cf.map(x => x ? toMidi(x.name,x.octave) : null);
  const cpM = cp.map(x => x ? toMidi(x.name,x.octave) : null);
  let cImp = 0;

  for (let i = 0; i < n; i++) {
    if (cfM[i]===null || cpM[i]===null) { cImp=0; continue; }
    const intv = intervalInfo(cfM[i], cpM[i]);

    if (i===0) {
      if (cpAbove) {
        if (![0,7].includes(intv.simple) && intv.semitones!==12)
          issues.push({sev:"error",bar:0,msg:"Begin on P1/P5/P8 (got "+intv.name+")"});
      } else {
        if (intv.simple!==0 && intv.semitones!==12)
          issues.push({sev:"error",bar:0,msg:"CP below: begin on P1/P8 (got "+intv.name+")"});
      }
    }

    if (intv.isDissonant)
      issues.push({sev:"error",bar:i,msg:"Dissonant: "+intv.name});
    if (intv.semitones===0 && i>0 && i<n-1)
      issues.push({sev:"error",bar:i,msg:"Unison only at start/end"});

    if (cpAbove && cpM[i]<cfM[i]) issues.push({sev:"error",bar:i,msg:"Voice crossing"});
    if (!cpAbove && cpM[i]>cfM[i]) issues.push({sev:"error",bar:i,msg:"Voice crossing"});

    if (i>0 && cfM[i-1]!==null) {
      if (cpAbove && cpM[i]<cfM[i-1]) issues.push({sev:"warning",bar:i,msg:"Voice overlap"});
      if (!cpAbove && cpM[i]>cfM[i-1]) issues.push({sev:"warning",bar:i,msg:"Voice overlap"});
    }

    if (intv.semitones>19) issues.push({sev:"error",bar:i,msg:"Voices > P12 apart"});
    else if (intv.semitones>15) issues.push({sev:"warning",bar:i,msg:"Voices > 10th apart"});

    if (intv.isImperfect) { cImp++; if (cImp>3) issues.push({sev:"warning",bar:i,msg:cImp+" consecutive 3rds/6ths"}); }
    else cImp=0;

    if (i>0 && cfM[i-1]!==null && cpM[i-1]!==null) {
      const prev = intervalInfo(cfM[i-1],cpM[i-1]);
      const mot = motionType(cfM[i-1],cfM[i],cpM[i-1],cpM[i]);
      if (intv.isPerfect && prev.isPerfect && intv.simple===prev.simple && mot==="parallel") {
        const nm = intv.simple===0?"unisons":intv.simple===7?"5ths":"octaves";
        issues.push({sev:"error",bar:i,msg:"Parallel "+nm});
      }
      if (mot==="similar" && intv.isPerfect && intv.simple!==0) {
        const uMoved = cpAbove ? Math.abs(cpM[i]-cpM[i-1]) : Math.abs(cfM[i]-cfM[i-1]);
        if (uMoved > 2) {
          const nm = intv.simple===7?"5ths":"octaves";
          issues.push({sev:"error",bar:i,msg:"Direct "+nm});
        }
      }
    }
  }

  // Ending
  if (cf[n-1] && cp[n-1]) {
    const li = intervalInfo(cfM[n-1],cpM[n-1]);
    if (li.simple!==0 && li.semitones!==12)
      issues.push({sev:"error",bar:n-1,msg:"End on P1/P8 (got "+li.name+")"});
    if (n>=2 && cf[n-2] && cp[n-2]) {
      const mot = motionType(cfM[n-2],cfM[n-1],cpM[n-2],cpM[n-1]);
      if (mot!=="contrary") issues.push({sev:"warning",bar:n-1,msg:"End by contrary motion (clausula vera)"});
    }
  }

  // Climax coincidence
  const cfF = cfM.filter(m=>m!==null), cpF = cpM.filter(m=>m!==null);
  if (cfF.length>2 && cpF.length>2) {
    const cfPeak = cfM.indexOf(Math.max(...cfF));
    const cpPeak = cpM.indexOf(Math.max(...cpF));
    if (cfPeak===cpPeak && cfPeak>=0) issues.push({sev:"warning",bar:cfPeak,msg:"CF & CP climaxes coincide"});
  }
  return issues;
}

// ═══════════════════════════════════════════════════════════════════════════
// APPLICATION STATE
// ═══════════════════════════════════════════════════════════════════════════

let state = {
  cfNotes: [],
  cpNotes: [],
  mode: "C major",
  cpAbove: true,
  activeVoice: "cp",
  cursor: 0,
  playing: false,
  playHead: -1,
  playTimer: null,
};

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

const SLG = 11, NR = 5.5, BW = 56, LM = 16, CW = 32, ST = 60;

function noteToY(name, octave) {
  const refIdx = NOTE_NAMES.indexOf("B") + 4*7;
  const noteIdx = NOTE_NAMES.indexOf(name[0]) + octave*7;
  return ST + 2*SLG - (noteIdx - refIdx) * (SLG/2);
}

function getLedgerLines(name, octave) {
  const y = noteToY(name, octave);
  const bot = ST + 4*SLG;
  const lines = [];
  if (y > bot + SLG*0.4) for (let ly = bot+SLG; ly <= y+2; ly += SLG) lines.push(ly);
  if (y < ST - SLG*0.4) for (let ly = ST-SLG; ly >= y-2; ly -= SLG) lines.push(ly);
  return lines;
}

function renderStaff() {
  const totalBars = Math.max(state.cfNotes.length, 6);
  const svgW = LM + CW + totalBars * BW + 30;
  const svgH = ST + 4*SLG + 100;

  const issues = runAnalysis();
  const errBars = new Set(issues.filter(i => i.sev==="error" && i.bar>=0).map(i => i.bar));
  const warnBars = new Set(issues.filter(i => i.sev==="warning" && i.bar>=0).map(i => i.bar));

  let svg = `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="display:block">`;

  // Staff lines
  for (let i=0; i<5; i++) {
    svg += `<line x1="${LM}" y1="${ST+i*SLG}" x2="${svgW-16}" y2="${ST+i*SLG}" stroke="#2a2a3a" stroke-width="1"/>`;
  }
  // Clef
  svg += `<text x="${LM+4}" y="${ST+3.35*SLG}" font-size="42" fill="#444" font-family="serif">𝄞</text>`;

  // Bars
  for (let i=0; i<totalBars; i++) {
    const x = LM+CW+i*BW;
    const isCur = i===state.cursor;
    const isErr = errBars.has(i);
    const isWarn = !isErr && warnBars.has(i);
    const isPlay = i===state.playHead;

    const fill = isPlay ? "rgba(106,158,238,.12)" : isCur ? "rgba(106,158,238,.06)" : isErr ? "rgba(200,60,60,.06)" : isWarn ? "rgba(200,170,60,.04)" : "transparent";
    const stroke = isCur ? "#3a4a6c" : "transparent";
    const dash = isCur ? "3,2" : "0";

    svg += `<g class="bar-click" data-bar="${i}" style="cursor:pointer">`;
    svg += `<rect x="${x}" y="${ST-24}" width="${BW}" height="${4*SLG+52}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-dasharray="${dash}"/>`;
    svg += `<text x="${x+BW/2}" y="${ST-12}" text-anchor="middle" font-size="9" fill="${isCur?'#6a9eee':'#333'}" font-family="'JetBrains Mono',monospace">${i+1}</text>`;

    // Interval label
    if (state.cfNotes[i] && state.cpNotes[i]) {
      const intv = intervalInfo(toMidi(state.cfNotes[i].name,state.cfNotes[i].octave), toMidi(state.cpNotes[i].name,state.cpNotes[i].octave));
      const col = intv.isDissonant ? "#c44" : intv.isPerfect ? "#6a9eee" : "#7a9a6a";
      svg += `<text x="${x+BW/2}" y="${svgH-10}" text-anchor="middle" font-size="9" font-family="'JetBrains Mono',monospace" font-weight="500" fill="${col}">${intv.name}</text>`;
    }

    // Empty slot indicator
    if (!state.cfNotes[i] && state.activeVoice==="cf" && isCur)
      svg += `<text x="${x+BW/2}" y="${ST+2*SLG+3}" text-anchor="middle" font-size="9" fill="#555">?</text>`;
    if (state.cfNotes[i] && !state.cpNotes[i] && state.activeVoice==="cp" && isCur)
      svg += `<text x="${x+BW/2}" y="${ST+(state.cpAbove?-2:4*SLG+12)}" text-anchor="middle" font-size="9" fill="#555">?</text>`;

    svg += `</g>`;
  }

  // CF notes
  state.cfNotes.forEach((n,i) => {
    if (!n) return;
    const x = LM+CW+i*BW+BW/2, y = noteToY(n.name, n.octave);
    const ldg = getLedgerLines(n.name, n.octave);
    const isCur = i===state.cursor && state.activeVoice==="cf";
    ldg.forEach(ly => { svg += `<line x1="${x-10}" y1="${ly}" x2="${x+10}" y2="${ly}" stroke="#2a2a3a" stroke-width="1"/>`; });
    const fill = isCur ? "#d4a84a" : "#a08040";
    const str = errBars.has(i) ? "#c44" : isCur ? "#e8c060" : "#806830";
    svg += `<g class="note-click" data-bar="${i}" data-voice="cf" style="cursor:pointer">`;
    svg += `<ellipse cx="${x}" cy="${y}" rx="${NR+1}" ry="${NR-1}" fill="${fill}" stroke="${str}" stroke-width="${isCur?1.5:1}" transform="rotate(-12,${x},${y})"/>`;
    const ty = (state.cpAbove || !state.cpNotes[i]) ? y+16 : y-12;
    svg += `<text x="${x}" y="${ty}" text-anchor="middle" font-size="7.5" fill="#665" font-family="'JetBrains Mono',monospace">${n.name}${n.octave}</text>`;
    svg += `</g>`;
  });

  // CP notes
  state.cpNotes.forEach((n,i) => {
    if (!n) return;
    const x = LM+CW+i*BW+BW/2, y = noteToY(n.name, n.octave);
    const ldg = getLedgerLines(n.name, n.octave);
    const isCur = i===state.cursor && state.activeVoice==="cp";
    ldg.forEach(ly => { svg += `<line x1="${x-10}" y1="${ly}" x2="${x+10}" y2="${ly}" stroke="#2a2a3a" stroke-width="1"/>`; });
    const fill = isCur ? "#5a9aee" : "#3a6aaa";
    const str = errBars.has(i) ? "#c44" : isCur ? "#7abaff" : "#2a5a8a";
    svg += `<g class="note-click" data-bar="${i}" data-voice="cp" style="cursor:pointer">`;
    svg += `<ellipse cx="${x}" cy="${y}" rx="${NR+1}" ry="${NR-1}" fill="${fill}" stroke="${str}" stroke-width="${isCur?1.5:1}" transform="rotate(-12,${x},${y})"/>`;
    const ty = state.cpAbove ? y-10 : y+16;
    svg += `<text x="${x}" y="${ty}" text-anchor="middle" font-size="7.5" fill="#568" font-family="'JetBrains Mono',monospace">${n.name}${n.octave}</text>`;
    svg += `</g>`;

  });

  // Legend
  svg += `<g transform="translate(${LM},${svgH-24})">`;
  svg += `<ellipse cx="0" cy="0" rx="4.5" ry="3.5" fill="#a08040"/><text x="8" y="3" font-size="8" fill="#555" font-family="'JetBrains Mono',monospace">CF</text>`;
  svg += `<ellipse cx="30" cy="0" rx="4.5" ry="3.5" fill="#3a6aaa"/><text x="38" y="3" font-size="8" fill="#555" font-family="'JetBrains Mono',monospace">CP</text>`;
  svg += `</g>`;

  svg += `</svg>`;

  document.getElementById('staffWrap').innerHTML = svg;

  // Attach click handlers
  document.querySelectorAll('.bar-click').forEach(el => {
    el.addEventListener('click', () => { state.cursor = parseInt(el.dataset.bar); render(); });
  });
  document.querySelectorAll('.note-click').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      state.cursor = parseInt(el.dataset.bar);
      state.activeVoice = el.dataset.voice;
      render();
    });
  });

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

  // Jump-to-bar handlers
  document.querySelectorAll('.iss-jump').forEach(el => {
    el.addEventListener('click', () => {
      const b = parseInt(el.dataset.bar);
      if (b >= 0) { state.cursor = b; render(); }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTE KEYBOARD
// ═══════════════════════════════════════════════════════════════════════════

function renderKeyboard() {
  const mi = MODES[state.mode];
  const octaves = state.activeVoice === "cp"
    ? (state.cpAbove ? [4,5] : [3,4])
    : [3,4,5];

  let r7 = null;
  if (mi.minor) {
    const idx = CHROMATIC.indexOf(mi.tonic);
    const r = CHROMATIC[(idx+11)%12];
    if (!mi.notes.includes(r)) r7 = r;
  }

  let html = '';
  octaves.forEach(oct => {
    html += `<div class="oct-row"><span class="oct-label">${oct}</span>`;
    mi.notes.forEach(nm => {
      const cls = nm.includes('#') ? 'nbtn sharp' : 'nbtn';
      html += `<button class="${cls}" data-note="${nm}" data-oct="${oct}">${nm}${oct}</button>`;
    });
    if (r7) {
      html += `<button class="nbtn sharp" data-note="${r7}" data-oct="${oct}" title="Leading tone">${r7}${oct}</button>`;
    }
    html += `</div>`;
  });

  document.getElementById('noteKeyboard').innerHTML = html;

  // Attach handlers
  document.querySelectorAll('#noteKeyboard .nbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const nm = btn.dataset.note;
      const oct = parseInt(btn.dataset.oct);
      addNote(nm, oct);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// UI ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

function addNote(name, octave) {
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
  if (state.activeVoice === "cf" && state.cursor < state.cfNotes.length) {
    state.cfNotes[state.cursor] = null;
  } else if (state.cursor < state.cpNotes.length) {
    state.cpNotes[state.cursor] = null;
  }
  render();
}

function moveCursor(dir) {
  state.cursor = Math.max(0, Math.min(state.cursor + dir, state.cfNotes.length - 1));
  render();
}

function addBar() {
  state.cfNotes.push(null);
  state.cpNotes.push(null);
  render();
}

function removeBar() {
  if (state.cfNotes.length <= 1) return;
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
function playAll() {
  initAudio();
  if (state.playing) {
    if (state.playTimer) clearTimeout(state.playTimer);
    state.playing = false;
    state.playHead = -1;
    document.getElementById('btnPlayBoth').className = 'btn play';
    document.getElementById('btnPlayBoth').textContent = '▶ Both';
    render();
    return;
  }
  state.playing = true;
  document.getElementById('btnPlayBoth').className = 'btn stop';
  document.getElementById('btnPlayBoth').textContent = '■ Stop';
  const tempo = 600;
  let i = 0;
  function step() {
    if (i >= state.cfNotes.length || !state.playing) {
      state.playing = false; state.playHead = -1;
      document.getElementById('btnPlayBoth').className = 'btn play';
      document.getElementById('btnPlayBoth').textContent = '▶ Both';
      render(); return;
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
  const notes = voice === 'cf' ? state.cfNotes : state.cpNotes;
  const tempo = 500;
  notes.forEach((n, i) => {
    if (n) playNote(toMidi(n.name, n.octave), tempo/1000*0.9, i*tempo/1000);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════════════════

function render() {
  // Tabs
  document.getElementById('tabCF').className = 'tab' + (state.activeVoice==='cf' ? ' act-cf' : '');
  const cpCount = state.cpNotes.filter(Boolean).length;
  document.getElementById('tabCP').className = 'tab' + (state.activeVoice==='cp' ? ' act-cp' : '');
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

  // Keyboard, Staff, Analysis
  renderKeyboard();
  const issues = renderStaff();
  renderAnalysis(issues);
}

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════

function init() {
  // Populate selects
  const cfSel = document.getElementById('cfSelect');
  Object.keys(SAMPLE_CF).forEach(k => {
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = k;
    cfSel.appendChild(opt);
  });
  cfSel.addEventListener('change', () => { initState(cfSel.value); render(); });

  const modeSel = document.getElementById('modeSelect');
  Object.keys(MODES).forEach(k => {
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = k;
    modeSel.appendChild(opt);
  });
  modeSel.addEventListener('change', () => { state.mode = modeSel.value; render(); });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); moveCursor(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); moveCursor(-1); }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (document.activeElement.tagName !== 'SELECT') { e.preventDefault(); clearNote(); }
    }
    if (e.key === 'Tab') { e.preventDefault(); setActiveVoice(state.activeVoice==='cf'?'cp':'cf'); }
  });

  // Init with first CF
  initState('Fux C major');
  render();

  // Init audio on first interaction
  document.addEventListener('click', initAudio, { once: true });
}

document.addEventListener('DOMContentLoaded', init);
