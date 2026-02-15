import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTE_NAMES, CHROMATIC_SHARP, CHROMATIC_FLAT,
  toMidi, semiDist, genericInterval, intervalInfo, motionType,
  SCALE_PATTERNS, SHARP_ORDER, FLAT_ORDER,
  KEY_DEFS, MODES, SAMPLE_CF,
  buildDiatonicNames, buildModeNotes, getRaised7th, cfToNotes,
  checkMelodicLine, checkHarmony,
  migrateNoteName, getNoteAccidental, getKeySigWidth,
} from '../music.js';

// ── toMidi ──

describe('toMidi', () => {
  it('returns correct MIDI for C4', () => {
    assert.equal(toMidi('C', 4), 60);
  });
  it('returns correct MIDI for A4 (concert pitch)', () => {
    assert.equal(toMidi('A', 4), 69);
  });
  it('handles sharps', () => {
    assert.equal(toMidi('C#', 4), 61);
    assert.equal(toMidi('F#', 4), 66);
  });
  it('handles flats', () => {
    assert.equal(toMidi('Bb', 4), 70);
    assert.equal(toMidi('Eb', 4), 63);
    assert.equal(toMidi('Db', 4), 61);
  });
  it('handles unusual accidentals: E#, Fb, Cb, B#', () => {
    assert.equal(toMidi('E#', 4), toMidi('F', 4));
    assert.equal(toMidi('Fb', 4), toMidi('E', 4));
    assert.equal(toMidi('Cb', 4), toMidi('B', 3));
    assert.equal(toMidi('B#', 4), toMidi('C', 5));
  });
  it('handles octave boundaries', () => {
    assert.equal(toMidi('C', 0), 12);
    assert.equal(toMidi('B', 3), 59);
    assert.equal(toMidi('C', 4), 60);
  });
  it('returns -1 for invalid input', () => {
    assert.equal(toMidi('X', 4), -1);
  });
});

// ── intervalInfo ──

describe('intervalInfo', () => {
  it('identifies P1 (unison)', () => {
    const info = intervalInfo(60, 60);
    assert.equal(info.name, 'P1');
    assert.equal(info.isPerfect, true);
    assert.equal(info.isDissonant, false);
  });
  it('identifies P5', () => {
    const info = intervalInfo(60, 67);
    assert.equal(info.name, 'P5');
    assert.equal(info.isPerfect, true);
  });
  it('identifies P8 (octave)', () => {
    const info = intervalInfo(60, 72);
    assert.equal(info.name, 'P8');
    assert.equal(info.isPerfect, true);
  });
  it('identifies m3', () => {
    const info = intervalInfo(60, 63);
    assert.equal(info.name, 'm3');
    assert.equal(info.isImperfect, true);
  });
  it('identifies M3', () => {
    const info = intervalInfo(60, 64);
    assert.equal(info.name, 'M3');
    assert.equal(info.isImperfect, true);
  });
  it('identifies m6', () => {
    const info = intervalInfo(60, 68);
    assert.equal(info.name, 'm6');
    assert.equal(info.isImperfect, true);
  });
  it('identifies M6', () => {
    const info = intervalInfo(60, 69);
    assert.equal(info.name, 'M6');
    assert.equal(info.isImperfect, true);
  });
  it('identifies TT (tritone) as dissonant', () => {
    const info = intervalInfo(60, 66);
    assert.equal(info.name, 'TT');
    assert.equal(info.isDissonant, true);
  });
  it('identifies P4 as dissonant in counterpoint context', () => {
    const info = intervalInfo(60, 65);
    assert.equal(info.name, 'P4');
    assert.equal(info.isDissonant, true);
  });
  it('identifies compound intervals', () => {
    // 10th (octave + m3 = 15 semitones)
    const info10m = intervalInfo(60, 75);
    assert.equal(info10m.name, '10');
    // 10th (octave + M3 = 16 semitones)
    const info10M = intervalInfo(60, 76);
    assert.equal(info10M.name, '10');
    // P12 (octave + P5 = 19 semitones)
    const info12 = intervalInfo(60, 79);
    assert.equal(info12.name, 'P12');
    // P15 (two octaves)
    const info15 = intervalInfo(60, 84);
    assert.equal(info15.name, 'P15');
  });
  it('works with reversed note order', () => {
    const info = intervalInfo(67, 60);
    assert.equal(info.name, 'P5');
    assert.equal(info.semitones, 7);
  });
});

// ── motionType ──

describe('motionType', () => {
  it('detects parallel motion', () => {
    // Both voices move up by M3 (C→E and E→G#)
    assert.equal(motionType(60, 64, 64, 68), 'parallel');
  });
  it('detects similar motion', () => {
    // Both move up but by different intervals
    assert.equal(motionType(60, 62, 67, 72), 'similar');
  });
  it('detects contrary motion', () => {
    assert.equal(motionType(60, 64, 67, 62), 'contrary');
  });
  it('detects oblique motion', () => {
    assert.equal(motionType(60, 60, 67, 72), 'oblique');
    assert.equal(motionType(60, 64, 67, 67), 'oblique');
  });
  it('detects static motion', () => {
    assert.equal(motionType(60, 60, 67, 67), 'static');
  });
});

// ── MODES ──

describe('MODES', () => {
  it('has all 30 modes from KEY_DEFS', () => {
    assert.equal(Object.keys(MODES).length, KEY_DEFS.length);
    for (const [name] of KEY_DEFS) {
      assert.ok(MODES[name], `Missing mode: ${name}`);
    }
  });
  it('each mode has exactly 7 notes', () => {
    for (const [name, mode] of Object.entries(MODES)) {
      assert.equal(mode.notes.length, 7, `${name} should have 7 notes`);
    }
  });
  it('all notes in each mode resolve via toMidi', () => {
    for (const [name, mode] of Object.entries(MODES)) {
      for (const note of mode.notes) {
        const midi = toMidi(note, 4);
        assert.ok(midi >= 0, `${note} in ${name} failed toMidi`);
      }
    }
  });
  it('modes have correct fifths values', () => {
    assert.equal(MODES['C major'].fifths, 0);
    assert.equal(MODES['G major'].fifths, 1);
    assert.equal(MODES['F major'].fifths, -1);
    assert.equal(MODES['F# major'].fifths, 6);
    assert.equal(MODES['A minor'].fifths, 0);
  });
});

// ── buildDiatonicNames ──

describe('buildDiatonicNames', () => {
  it('C major: all naturals', () => {
    const names = buildDiatonicNames('C', 0);
    assert.deepEqual(names, ['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  });
  it('G major: F#', () => {
    const names = buildDiatonicNames('G', 1);
    assert.ok(names.includes('F#'));
    assert.ok(!names.includes('F'));
  });
  it('F major: Bb', () => {
    const names = buildDiatonicNames('F', -1);
    assert.ok(names.includes('Bb'));
    assert.ok(!names.includes('B'));
  });
  it('Eb major: Bb, Eb, Ab', () => {
    const names = buildDiatonicNames('Eb', -3);
    assert.ok(names.includes('Bb'));
    assert.ok(names.includes('Eb'));
    assert.ok(names.includes('Ab'));
  });
  it('F# major: has E# (6 sharps)', () => {
    const names = buildDiatonicNames('F#', 6);
    assert.ok(names.includes('E#'), 'F# major should include E#');
    assert.ok(names.includes('F#'));
    assert.ok(names.includes('C#'));
  });
});

// ── getRaised7th ──

describe('getRaised7th', () => {
  it('returns G# for A minor', () => {
    assert.equal(getRaised7th('A minor'), 'G#');
  });
  it('returns C# for D minor', () => {
    assert.equal(getRaised7th('D minor'), 'C#');
  });
  it('returns F# for G minor', () => {
    assert.equal(getRaised7th('G minor'), 'F#');
  });
  it('returns B for C minor', () => {
    assert.equal(getRaised7th('C minor'), 'B');
  });
  it('returns D# for E minor', () => {
    assert.equal(getRaised7th('E minor'), 'D#');
  });
  it('returns E# for F# minor', () => {
    assert.equal(getRaised7th('F# minor'), 'E#');
  });
  it('returns A# for B minor', () => {
    assert.equal(getRaised7th('B minor'), 'A#');
  });
  it('returns B# for C# minor', () => {
    assert.equal(getRaised7th('C# minor'), 'B#');
  });
  it('returns E for F minor', () => {
    assert.equal(getRaised7th('F minor'), 'E');
  });
  it('returns A for Bb minor', () => {
    assert.equal(getRaised7th('Bb minor'), 'A');
  });
  it('returns D for Eb minor', () => {
    assert.equal(getRaised7th('Eb minor'), 'D');
  });
  it('returns G for Ab minor', () => {
    assert.equal(getRaised7th('Ab minor'), 'G');
  });
  it('returns null for major keys', () => {
    assert.equal(getRaised7th('C major'), null);
    assert.equal(getRaised7th('G major'), null);
    assert.equal(getRaised7th('F major'), null);
  });
});

// ── checkMelodicLine ──

describe('checkMelodicLine', () => {
  it('flags wrong starting note', () => {
    const notes = [
      { name: 'D', octave: 4 },
      { name: 'E', octave: 4 },
      { name: 'C', octave: 4 },
    ];
    const issues = checkMelodicLine(notes, 'C major', 'CF');
    assert.ok(issues.some(i => i.sev === 'error' && i.msg.includes('begin on C')));
  });
  it('flags wrong ending note', () => {
    const notes = [
      { name: 'C', octave: 4 },
      { name: 'D', octave: 4 },
      { name: 'E', octave: 4 },
    ];
    const issues = checkMelodicLine(notes, 'C major', 'CF');
    assert.ok(issues.some(i => i.sev === 'error' && i.msg.includes('end on C')));
  });
  it('accepts valid tonic start and end', () => {
    const notes = [
      { name: 'C', octave: 4 },
      { name: 'D', octave: 4 },
      { name: 'C', octave: 4 },
    ];
    const issues = checkMelodicLine(notes, 'C major', 'CF');
    assert.ok(!issues.some(i => i.msg.includes('begin on') || i.msg.includes('end on')));
  });
  it('warns on out-of-scale note', () => {
    const notes = [
      { name: 'C', octave: 4 },
      { name: 'F#', octave: 4 },
      { name: 'C', octave: 4 },
    ];
    const issues = checkMelodicLine(notes, 'C major', 'CF');
    assert.ok(issues.some(i => i.sev === 'warning' && i.msg.includes('F#') && i.msg.includes('C major')));
  });
  it('flags melodic tritone', () => {
    const notes = [
      { name: 'C', octave: 4 },
      { name: 'F#', octave: 4 },
      { name: 'C', octave: 4 },
    ];
    const issues = checkMelodicLine(notes, 'C major', 'CF');
    assert.ok(issues.some(i => i.sev === 'error' && i.msg.includes('tritone')));
  });
  it('flags range exceeding 10th', () => {
    const notes = [
      { name: 'C', octave: 3 },
      { name: 'G', octave: 4 },  // range = 19 semitones > 16
      { name: 'C', octave: 3 },
    ];
    const issues = checkMelodicLine(notes, 'C major', 'CF');
    assert.ok(issues.some(i => i.sev === 'error' && i.msg.includes('range exceeds 10th')));
  });
  it('flags melodic 7th', () => {
    const notes = [
      { name: 'C', octave: 4 },
      { name: 'B', octave: 4 },  // 11 semitones = M7
      { name: 'C', octave: 4 },
    ];
    const issues = checkMelodicLine(notes, 'C major', 'CF');
    assert.ok(issues.some(i => i.sev === 'error' && i.msg.includes('7th')));
  });
});

// ── checkHarmony ──

describe('checkHarmony', () => {
  it('flags parallel 5ths', () => {
    const cf = [
      { name: 'C', octave: 4 },
      { name: 'D', octave: 4 },
      { name: 'C', octave: 4 },
    ];
    const cp = [
      { name: 'G', octave: 4 },
      { name: 'A', octave: 4 },
      { name: 'C', octave: 5 },
    ];
    const issues = checkHarmony(cf, cp, 'C major', true);
    assert.ok(issues.some(i => i.sev === 'error' && i.msg.includes('Parallel 5ths')));
  });
  it('flags dissonant interval', () => {
    const cf = [
      { name: 'C', octave: 4 },
      { name: 'D', octave: 4 },
      { name: 'C', octave: 4 },
    ];
    const cp = [
      { name: 'C', octave: 4 },
      { name: 'G', octave: 4 },  // P4 above D = dissonant
      { name: 'C', octave: 5 },
    ];
    const issues = checkHarmony(cf, cp, 'C major', true);
    assert.ok(issues.some(i => i.sev === 'error' && i.msg.includes('Dissonant')));
  });
  it('flags wrong beginning interval when CP is above', () => {
    const cf = [
      { name: 'C', octave: 4 },
      { name: 'D', octave: 4 },
      { name: 'C', octave: 4 },
    ];
    const cp = [
      { name: 'E', octave: 4 },  // M3 — not allowed at start
      { name: 'F', octave: 4 },
      { name: 'C', octave: 5 },
    ];
    const issues = checkHarmony(cf, cp, 'C major', true);
    assert.ok(issues.some(i => i.sev === 'error' && i.msg.includes('Begin on P1/P5/P8')));
  });
  it('flags wrong ending interval', () => {
    const cf = [
      { name: 'C', octave: 4 },
      { name: 'D', octave: 4 },
      { name: 'C', octave: 4 },
    ];
    const cp = [
      { name: 'G', octave: 4 },
      { name: 'B', octave: 4 },
      { name: 'E', octave: 4 },  // M3 — must end on P1/P8
    ];
    const issues = checkHarmony(cf, cp, 'C major', true);
    assert.ok(issues.some(i => i.sev === 'error' && i.msg.includes('End on P1/P8')));
  });
  it('flags voice crossing when CP above but sounds below CF', () => {
    const cf = [
      { name: 'C', octave: 4 },
      { name: 'E', octave: 4 },
      { name: 'C', octave: 4 },
    ];
    const cp = [
      { name: 'C', octave: 4 },
      { name: 'D', octave: 4 },  // below CF E4
      { name: 'C', octave: 5 },
    ];
    const issues = checkHarmony(cf, cp, 'C major', true);
    assert.ok(issues.some(i => i.sev === 'error' && i.msg.includes('Voice crossing')));
  });
  it('accepts valid perfect consonances at start/end', () => {
    const cf = [
      { name: 'C', octave: 4 },
      { name: 'D', octave: 4 },
      { name: 'C', octave: 4 },
    ];
    const cp = [
      { name: 'G', octave: 4 },  // P5
      { name: 'B', octave: 4 },  // M6
      { name: 'C', octave: 5 },  // P8
    ];
    const issues = checkHarmony(cf, cp, 'C major', true);
    assert.ok(!issues.some(i => i.msg.includes('Begin on')));
    assert.ok(!issues.some(i => i.msg.includes('End on')));
  });
});

// ── migrateNoteName ──

describe('migrateNoteName', () => {
  it('converts A# to Bb in Bb major (flat key)', () => {
    assert.equal(migrateNoteName('A#', 'Bb major'), 'Bb');
  });
  it('keeps G# as G# in A minor (raised 7th)', () => {
    assert.equal(migrateNoteName('G#', 'A minor'), 'G#');
  });
  it('converts F# to Gb in Db major', () => {
    assert.equal(migrateNoteName('F#', 'Db major'), 'Gb');
  });
  it('keeps diatonic notes unchanged', () => {
    assert.equal(migrateNoteName('C', 'C major'), 'C');
    assert.equal(migrateNoteName('F#', 'G major'), 'F#');
    assert.equal(migrateNoteName('Bb', 'F major'), 'Bb');
  });
  it('converts Db to C# in A major (sharp key)', () => {
    assert.equal(migrateNoteName('Db', 'A major'), 'C#');
  });
});

// ── getNoteAccidental ──

describe('getNoteAccidental', () => {
  it('returns empty for diatonic notes matching key sig', () => {
    assert.equal(getNoteAccidental('F#', 'G major'), '');
    assert.equal(getNoteAccidental('C', 'C major'), '');
    assert.equal(getNoteAccidental('Bb', 'Bb major'), '');
  });
  it('returns natural when note contradicts key sig sharp', () => {
    // G major has F#; natural F needs a natural sign
    assert.equal(getNoteAccidental('F', 'G major'), '\u266E');
  });
  it('returns sharp for accidental not in key sig', () => {
    // A minor has no sharps; G# needs a sharp sign
    assert.equal(getNoteAccidental('G#', 'A minor'), '\u266F');
  });
  it('returns flat for accidental not in key sig', () => {
    // C major has no flats; Bb needs a flat sign
    assert.equal(getNoteAccidental('Bb', 'C major'), '\u266D');
  });
  it('returns empty for Bb in F major (matches key sig flat)', () => {
    assert.equal(getNoteAccidental('Bb', 'F major'), '');
  });
});

// ── getKeySigWidth ──

describe('getKeySigWidth', () => {
  it('returns 0 for C major (no accidentals)', () => {
    assert.equal(getKeySigWidth('C major'), 0);
  });
  it('returns nonzero for keys with accidentals', () => {
    assert.ok(getKeySigWidth('G major') > 0);
    assert.ok(getKeySigWidth('F major') > 0);
  });
  it('scales with number of accidentals', () => {
    assert.ok(getKeySigWidth('B major') > getKeySigWidth('G major'));
  });
});

// ── cfToNotes ──

describe('cfToNotes', () => {
  it('converts compact format to name/octave objects', () => {
    const input = [{ n: 'C', o: 4 }, { n: 'D', o: 4 }];
    const result = cfToNotes(input);
    assert.deepEqual(result, [{ name: 'C', octave: 4 }, { name: 'D', octave: 4 }]);
  });
});

// ── SAMPLE_CF ──

describe('SAMPLE_CF', () => {
  it('all presets have valid modes', () => {
    for (const [key, cf] of Object.entries(SAMPLE_CF)) {
      assert.ok(MODES[cf.mode], `${key} references unknown mode: ${cf.mode}`);
    }
  });
});
