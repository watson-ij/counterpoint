// ═══════════════════════════════════════════════════════════════════════════
// MUSIC THEORY
// ═══════════════════════════════════════════════════════════════════════════

export const NOTE_NAMES = ["C","D","E","F","G","A","B"];
export const CHROMATIC_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
export const CHROMATIC_FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
export const CHROMATIC = CHROMATIC_SHARP; // backward compat alias

export function toMidi(name, octave) {
  let b = CHROMATIC_SHARP.indexOf(name);
  if (b === -1) b = CHROMATIC_FLAT.indexOf(name);
  if (b !== -1) return (octave + 1) * 12 + b;
  // Handle unusual accidentals: E#, Fb, Cb, B#, etc.
  const letter = name[0];
  const base = CHROMATIC_SHARP.indexOf(letter);
  if (base === -1) return -1;
  const acc = name.slice(1);
  let midi = (octave + 1) * 12 + base;
  if (acc === "#") midi += 1;
  else if (acc === "b") midi -= 1;
  else return -1;
  return midi;
}
export function semiDist(m1, m2) { return Math.abs(m2 - m1); }
export function genericInterval(n1, o1, n2, o2) {
  return Math.abs((NOTE_NAMES.indexOf(n2[0]) + o2*7) - (NOTE_NAMES.indexOf(n1[0]) + o1*7));
}

export function intervalInfo(midi1, midi2) {
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

export function motionType(v1a,v1b,v2a,v2b) {
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

// Scale patterns as semitone intervals from root
export const SCALE_PATTERNS = {
  major:      [0,2,4,5,7,9,11],
  minor:      [0,2,3,5,7,8,10],
  dorian:     [0,2,3,5,7,9,10],
  phrygian:   [0,1,3,5,7,8,10],
  mixolydian:  [0,2,4,5,7,9,10],
  aeolian:    [0,2,3,5,7,8,10],
};

// Sharp/flat order for key signatures
export const SHARP_ORDER = ["F","C","G","D","A","E","B"];
export const FLAT_ORDER  = ["B","E","A","D","G","C","F"];

// Build diatonic note names for a key using circle-of-fifths spelling
export function buildDiatonicNames(tonic, fifths) {
  // Determine which note letters get sharps or flats
  const altered = {};
  if (fifths > 0) {
    for (let i = 0; i < fifths; i++) altered[SHARP_ORDER[i]] = "#";
  } else if (fifths < 0) {
    for (let i = 0; i < -fifths; i++) altered[FLAT_ORDER[i]] = "b";
  }
  // Build the 7 note names C through B with correct accidentals
  return NOTE_NAMES.map(letter => letter + (altered[letter] || ""));
}

// Build a mode's diatonic notes from tonic + pattern, sorted C-B
export function buildModeNotes(tonic, fifths, pattern) {
  const allNames = buildDiatonicNames(tonic, fifths);
  // allNames is already sorted C-B, just return it
  return allNames;
}

// Key definitions: [display name, tonic, fifths, scaleType, minor flag]
export const KEY_DEFS = [
  // Major keys (circle of fifths order)
  ["C major",  "C",  0, "major",  false],
  ["G major",  "G",  1, "major",  false],
  ["D major",  "D",  2, "major",  false],
  ["A major",  "A",  3, "major",  false],
  ["E major",  "E",  4, "major",  false],
  ["B major",  "B",  5, "major",  false],
  ["F# major", "F#", 6, "major",  false],
  ["Gb major", "Gb",-6, "major",  false],
  ["F major",  "F", -1, "major",  false],
  ["Bb major", "Bb",-2, "major",  false],
  ["Eb major", "Eb",-3, "major",  false],
  ["Ab major", "Ab",-4, "major",  false],
  ["Db major", "Db",-5, "major",  false],
  // Minor keys (circle of fifths order)
  ["A minor",  "A",  0, "minor",  true],
  ["E minor",  "E",  1, "minor",  true],
  ["B minor",  "B",  2, "minor",  true],
  ["F# minor", "F#", 3, "minor",  true],
  ["C# minor", "C#", 4, "minor",  true],
  ["D minor",  "D", -1, "minor",  true],
  ["G minor",  "G", -2, "minor",  true],
  ["C minor",  "C", -3, "minor",  true],
  ["F minor",  "F", -4, "minor",  true],
  ["Bb minor", "Bb",-5, "minor",  true],
  ["Eb minor", "Eb",-6, "minor",  true],
  ["Ab minor", "Ab",-7, "minor",  true],
  // Church modes
  ["D dorian",    "D",  0, "dorian",    true],
  ["E phrygian",  "E",  0, "phrygian",  true],
  ["G mixolydian","G",  0, "mixolydian", false],
  ["A aeolian",   "A",  0, "aeolian",   true],
];

// Generate MODES object from KEY_DEFS
export const MODES = {};
KEY_DEFS.forEach(([name, tonic, fifths, scaleType, minor]) => {
  MODES[name] = {
    tonic,
    notes: buildModeNotes(tonic, fifths, SCALE_PATTERNS[scaleType]),
    minor,
    fifths,
  };
});

// Compute the correctly-spelled raised 7th (leading tone) for a minor mode
export function getRaised7th(mode) {
  const mi = MODES[mode];
  if (!mi || !mi.minor) return null;
  const tonicSemi = toMidi(mi.tonic, 0) % 12;
  const r7semi = (tonicSemi + 11) % 12;
  // Use the 7th scale degree letter + sharp, matching the key's spelling
  const deg7 = mi.notes[6]; // 7th diatonic note (B-sorted position depends on key)
  // Actually find the 7th degree: count up from tonic in note names
  const tonicLetterIdx = NOTE_NAMES.indexOf(mi.tonic[0]);
  const deg7letter = NOTE_NAMES[(tonicLetterIdx + 6) % 7];
  // Find what the raised 7th should be called using this letter
  const deg7letterSemi = CHROMATIC_SHARP.indexOf(deg7letter);
  const diff = ((r7semi - deg7letterSemi) % 12 + 12) % 12;
  if (diff === 0) return deg7letter;
  if (diff === 1) return deg7letter + "#";
  if (diff === 11) return deg7letter + "b";
  // fallback to chromatic sharp name
  return CHROMATIC_SHARP[r7semi];
}

export const SAMPLE_CF = {
  "Fux C major":     {mode:"C major",notes:[{n:"C",o:4},{n:"D",o:4},{n:"F",o:4},{n:"E",o:4},{n:"D",o:4},{n:"E",o:4},{n:"F",o:4},{n:"E",o:4},{n:"D",o:4},{n:"C",o:4}]},
  "Fux D dorian":    {mode:"D dorian",notes:[{n:"D",o:4},{n:"F",o:4},{n:"E",o:4},{n:"D",o:4},{n:"G",o:4},{n:"F",o:4},{n:"A",o:4},{n:"G",o:4},{n:"F",o:4},{n:"E",o:4},{n:"D",o:4}]},
  "Fux F major":     {mode:"F major",notes:[{n:"F",o:4},{n:"G",o:4},{n:"A",o:4},{n:"F",o:4},{n:"D",o:4},{n:"E",o:4},{n:"F",o:4},{n:"C",o:5},{n:"A",o:4},{n:"F",o:4},{n:"G",o:4},{n:"F",o:4}]},
  "Schenker C major":{mode:"C major",notes:[{n:"C",o:4},{n:"D",o:4},{n:"E",o:4},{n:"C",o:4},{n:"A",o:3},{n:"B",o:3},{n:"C",o:4},{n:"E",o:4},{n:"D",o:4},{n:"C",o:4}]},
  "Custom (empty)":  {mode:"C major",notes:[]},
};

export function cfToNotes(arr) { return arr.map(x => ({name:x.n, octave:x.o})); }

// ═══════════════════════════════════════════════════════════════════════════
// RULE CHECKER
// ═══════════════════════════════════════════════════════════════════════════

export function checkMelodicLine(notes, mode, label) {
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
      const r7 = getRaised7th(mode);
      if (!(r7 && notes[i].name === r7))
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
    else if (s===0) issues.push({sev:"error",bar:bar,msg:"Repeated note in CP"});
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

export function checkHarmony(cf, cp, mode, cpAbove) {
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

    const isEndpoint = (i === 0 || i === n - 1);
    if (cpAbove && cpM[i] < cfM[i] && !(isEndpoint && cpM[i] === cfM[i]))
      issues.push({sev:"error",bar:i,msg:"Voice crossing"});
    if (!cpAbove && cpM[i] > cfM[i] && !(isEndpoint && cpM[i] === cfM[i]))
      issues.push({sev:"error",bar:i,msg:"Voice crossing"});

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
        const nm = intv.semitones===0?"unisons":intv.simple===7?"5ths":"octaves";
        issues.push({sev:"error",bar:i,msg:"Parallel "+nm});
      }
      if (mot==="similar" && intv.isPerfect && intv.semitones!==0) {
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
    // Cadential interval check: penultimate should be M6→P8 or m3→P1
    if (n >= 2 && cf[n-2] && cp[n-2]) {
      const penIntv = intervalInfo(cfM[n-2], cpM[n-2]);
      const finIntv = intervalInfo(cfM[n-1], cpM[n-1]);
      const penSimple = penIntv.simple;
      const finSimple = finIntv.simple;
      if (finSimple === 0 && penSimple !== 3 && penSimple !== 4)
        issues.push({sev:"warning",bar:n-2,msg:"Penultimate should be m3/M3 before unison"});
      if ((finIntv.semitones === 12 || finSimple === 7) && penSimple !== 8 && penSimple !== 9)
        issues.push({sev:"warning",bar:n-2,msg:"Penultimate should be m6/M6 before octave"});
    }
    // Leading tone check in minor modes
    const leadingTone = getRaised7th(mode);
    if (leadingTone && n >= 2 && cp[n-2]) {
      if (cp[n-2].name !== leadingTone && (!cf[n-2] || cf[n-2].name !== leadingTone))
        issues.push({sev:"warning",bar:n-2,msg:"Consider raised 7th ("+leadingTone+") at cadence"});
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
// NOTE RE-SPELLING
// ═══════════════════════════════════════════════════════════════════════════

// Re-spell a note name to match the target mode's enharmonic convention.
// E.g., "A#" → "Bb" when switching to a flat key.
export function migrateNoteName(name, mode) {
  const mi = MODES[mode];
  if (!mi) return name;
  // Find the pitch class
  const midi = toMidi(name, 0);
  if (midi < 0) return name;
  const pc = midi % 12;
  // Check if this note is already correctly spelled for the key
  const letter = name[0];
  const diatonic = mi.notes.find(n => n[0] === letter);
  if (diatonic && toMidi(diatonic, 0) % 12 === pc) return diatonic;
  // Check if any diatonic note matches this pitch class
  const match = mi.notes.find(n => toMidi(n, 0) % 12 === pc);
  if (match) return match;
  // Check raised 7th for minor modes
  const r7 = getRaised7th(mode);
  if (r7 && toMidi(r7, 0) % 12 === pc) return r7;
  // Chromatic note not in key — spell using the key's convention (sharp or flat)
  if (mi.fifths >= 0) return CHROMATIC_SHARP[pc];
  return CHROMATIC_FLAT[pc];
}

// ═══════════════════════════════════════════════════════════════════════════
// KEY SIGNATURE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function getNoteAccidental(noteName, mode) {
  const mi = MODES[mode];
  if (!mi) return "";
  const letter = noteName[0];
  const noteAcc = noteName.length > 1 ? noteName.slice(1) : "";
  // What does the key signature imply for this letter?
  const diatonic = mi.notes.find(n => n[0] === letter);
  const ksSuffix = diatonic ? (diatonic.length > 1 ? diatonic.slice(1) : "") : "";
  if (noteAcc === ksSuffix) return ""; // matches key signature, no accidental needed
  if (noteAcc === "#") return "♯";
  if (noteAcc === "b") return "♭";
  // noteAcc is "" but ksSuffix is "#" or "b" — need a natural
  return "♮";
}

export function getKeySigWidth(mode) {
  const mi = MODES[mode];
  if (!mi) return 0;
  const count = Math.abs(mi.fifths);
  if (count === 0) return 0;
  return count * 10 + 6; // 10px per accidental + 6px padding
}
