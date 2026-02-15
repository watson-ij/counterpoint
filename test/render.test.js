import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STAFF_LINE_GAP, STAFF_TOP, CLEFS, BAR_WIDTH, LEFT_MARGIN, CLEF_WIDTH,
  noteToY, getLedgerLines, renderKeySignature, renderStaffSVG, renderClef,
} from '../render.js';

// ── noteToY ──

describe('noteToY', () => {
  it('returns middle-line Y for treble clef reference note B4', () => {
    const y = noteToY('B', 4, 'treble');
    assert.equal(y, STAFF_TOP + 2 * STAFF_LINE_GAP);
  });
  it('returns middle-line Y for alto clef reference note C4', () => {
    const y = noteToY('C', 4, 'alto');
    assert.equal(y, STAFF_TOP + 2 * STAFF_LINE_GAP);
  });
  it('returns middle-line Y for bass clef reference note D3', () => {
    const y = noteToY('D', 3, 'bass');
    assert.equal(y, STAFF_TOP + 2 * STAFF_LINE_GAP);
  });
  it('higher notes have lower Y (treble)', () => {
    const yC4 = noteToY('C', 4, 'treble');
    const yC5 = noteToY('C', 5, 'treble');
    assert.ok(yC5 < yC4, 'C5 should be above C4 on staff');
  });
  it('adjacent diatonic notes differ by half a STAFF_LINE_GAP', () => {
    const yC = noteToY('C', 4, 'treble');
    const yD = noteToY('D', 4, 'treble');
    assert.equal(yC - yD, STAFF_LINE_GAP / 2);
  });
  it('notes one octave apart differ by 3.5 STAFF_LINE_GAPs', () => {
    const yC4 = noteToY('C', 4, 'treble');
    const yC5 = noteToY('C', 5, 'treble');
    assert.equal(yC4 - yC5, 7 * (STAFF_LINE_GAP / 2));
  });
  it('sharps/flats use the base letter for Y position', () => {
    // F# should be at the same Y as F
    const yF = noteToY('F', 4, 'treble');
    const yFs = noteToY('F#', 4, 'treble');
    assert.equal(yF, yFs);
  });
  it('defaults to treble clef for unknown clef name', () => {
    const y = noteToY('B', 4, 'unknown');
    assert.equal(y, noteToY('B', 4, 'treble'));
  });
});

// ── getLedgerLines ──

describe('getLedgerLines', () => {
  it('returns no ledger lines for notes within the staff (treble)', () => {
    // B4 is the middle line in treble, well within staff
    assert.deepEqual(getLedgerLines('B', 4, 'treble'), []);
    // F5 is the top line
    assert.deepEqual(getLedgerLines('F', 5, 'treble'), []);
    // E4 is the bottom line
    assert.deepEqual(getLedgerLines('E', 4, 'treble'), []);
  });
  it('returns ledger lines for notes above the staff', () => {
    // A5 in treble clef is above the top staff line
    const lines = getLedgerLines('A', 5, 'treble');
    assert.ok(lines.length > 0, 'Should have ledger lines above staff');
    // All ledger lines should be above the staff (y < STAFF_TOP)
    for (const ly of lines) {
      assert.ok(ly < STAFF_TOP, `Ledger line at ${ly} should be above staff top ${STAFF_TOP}`);
    }
  });
  it('returns ledger lines for notes below the staff', () => {
    // C4 in treble clef is below the staff (middle C)
    const lines = getLedgerLines('C', 4, 'treble');
    assert.ok(lines.length > 0, 'Should have ledger lines below staff');
    const staffBottom = STAFF_TOP + 4 * STAFF_LINE_GAP;
    for (const ly of lines) {
      assert.ok(ly > staffBottom, `Ledger line at ${ly} should be below staff bottom ${staffBottom}`);
    }
  });
  it('returns more ledger lines for notes further from the staff', () => {
    const linesC4 = getLedgerLines('C', 4, 'treble');
    const linesC3 = getLedgerLines('C', 3, 'treble');
    assert.ok(linesC3.length > linesC4.length, 'C3 should need more ledger lines than C4');
  });
});

// ── renderKeySignature ──

describe('renderKeySignature', () => {
  it('returns empty string for C major (no accidentals)', () => {
    assert.equal(renderKeySignature('treble', 'C major'), '');
  });
  it('returns empty string for A minor (no accidentals)', () => {
    assert.equal(renderKeySignature('treble', 'A minor'), '');
  });
  it('returns 1 sharp symbol for G major', () => {
    const svg = renderKeySignature('treble', 'G major');
    const sharpCount = (svg.match(/♯/g) || []).length;
    assert.equal(sharpCount, 1);
  });
  it('returns 1 flat symbol for F major', () => {
    const svg = renderKeySignature('treble', 'F major');
    const flatCount = (svg.match(/♭/g) || []).length;
    assert.equal(flatCount, 1);
  });
  it('returns correct number of sharps for D major (2)', () => {
    const svg = renderKeySignature('treble', 'D major');
    const sharpCount = (svg.match(/♯/g) || []).length;
    assert.equal(sharpCount, 2);
  });
  it('returns correct number of flats for Eb major (3)', () => {
    const svg = renderKeySignature('treble', 'Eb major');
    const flatCount = (svg.match(/♭/g) || []).length;
    assert.equal(flatCount, 3);
  });
  it('works with different clefs', () => {
    // Should produce valid SVG text elements for all clefs
    for (const clef of ['treble', 'alto', 'bass']) {
      const svg = renderKeySignature(clef, 'G major');
      assert.ok(svg.includes('<text'), `${clef} clef should produce SVG text`);
      assert.ok(svg.includes('♯'), `${clef} clef should include sharp symbol`);
    }
  });
});

// ── renderClef ──

describe('renderClef', () => {
  it('returns SVG with a path element for each clef', () => {
    for (const clef of ['treble', 'alto', 'bass']) {
      const svg = renderClef(clef);
      assert.ok(svg.includes('<path'), `${clef} should contain <path`);
      assert.ok(svg.includes('fill-rule="evenodd"'), `${clef} should have fill-rule="evenodd"`);
    }
  });
  it('returns SVG with a group transform for each clef', () => {
    for (const clef of ['treble', 'alto', 'bass']) {
      const svg = renderClef(clef);
      assert.ok(svg.includes('<g transform='), `${clef} should have a group transform`);
    }
  });
  it('defaults to treble for unknown clef name', () => {
    const unknown = renderClef('unknown');
    const treble = renderClef('treble');
    assert.equal(unknown, treble);
  });
});

// ── renderStaffSVG ──

describe('renderStaffSVG', () => {
  const baseCfNotes = [
    { name: 'C', octave: 4 },
    { name: 'D', octave: 4 },
    { name: 'F', octave: 4 },
    { name: 'E', octave: 4 },
    { name: 'C', octave: 4 },
  ];
  const baseCpNotes = [
    { name: 'C', octave: 5 },
    { name: 'B', octave: 4 },
    { name: 'A', octave: 4 },
    { name: 'G', octave: 4 },
    { name: 'C', octave: 5 },
  ];
  const baseParams = {
    cfNotes: baseCfNotes,
    cpNotes: baseCpNotes,
    mode: 'C major',
    clef: 'treble',
    cpAbove: true,
    cursor: 0,
    playHead: -1,
    activeVoice: 'cp',
    issues: [],
  };

  it('returns an object with svg, width, height', () => {
    const result = renderStaffSVG(baseParams);
    assert.equal(typeof result.svg, 'string');
    assert.equal(typeof result.width, 'number');
    assert.equal(typeof result.height, 'number');
  });

  it('returns a valid SVG string', () => {
    const { svg } = renderStaffSVG(baseParams);
    assert.ok(svg.startsWith('<svg '), 'Should start with <svg');
    assert.ok(svg.endsWith('</svg>'), 'Should end with </svg>');
  });

  it('contains 5 staff lines', () => {
    const { svg } = renderStaffSVG(baseParams);
    const lineCount = (svg.match(/<line /g) || []).length;
    // At least 5 staff lines (could have more from ledger lines)
    assert.ok(lineCount >= 5, `Expected at least 5 lines, got ${lineCount}`);
  });

  it('contains a clef path', () => {
    const { svg } = renderStaffSVG(baseParams);
    assert.ok(svg.includes('<path'), 'Should contain SVG path for clef');
    assert.ok(svg.includes('fill-rule="evenodd"'), 'Should have fill-rule on clef path');
  });

  it('contains note ellipses for CF and CP notes', () => {
    const { svg } = renderStaffSVG(baseParams);
    const ellipseCount = (svg.match(/<ellipse /g) || []).length;
    // 5 CF + 5 CP notes + 2 legend ellipses = 12
    assert.equal(ellipseCount, 12);
  });

  it('contains bar numbers', () => {
    const { svg } = renderStaffSVG(baseParams);
    // Should contain bar numbers 1..6 (min 6 bars)
    for (let i = 1; i <= 6; i++) {
      assert.ok(svg.includes(`>${i}<`), `Should contain bar number ${i}`);
    }
  });

  it('contains interval labels when both voices have notes', () => {
    const { svg } = renderStaffSVG(baseParams);
    // C4 vs C5 = P8
    assert.ok(svg.includes('P8'), 'Should contain P8 interval label');
  });

  it('handles empty notes arrays', () => {
    const result = renderStaffSVG({
      ...baseParams,
      cfNotes: [null, null, null, null, null, null],
      cpNotes: [null, null, null, null, null, null],
    });
    assert.ok(result.svg.startsWith('<svg '));
    assert.ok(result.svg.endsWith('</svg>'));
  });

  it('renders with different clefs', () => {
    for (const clef of ['treble', 'alto', 'bass']) {
      const { svg } = renderStaffSVG({ ...baseParams, clef });
      assert.ok(svg.includes('<path'), `Should contain SVG path for ${clef} clef`);
    }
  });

  it('highlights error bars', () => {
    const issues = [{ sev: 'error', bar: 1, msg: 'test error' }];
    const { svg } = renderStaffSVG({ ...baseParams, issues });
    // The error bar should have a reddish fill
    assert.ok(svg.includes('rgba(200,60,60,.06)'), 'Should highlight error bar');
  });

  it('shows ledger lines for notes far from staff', () => {
    const params = {
      ...baseParams,
      cfNotes: [{ name: 'C', octave: 4 }],  // middle C in treble = below staff
      cpNotes: [null],
    };
    const { svg } = renderStaffSVG(params);
    // Middle C in treble needs a ledger line
    // Count lines: 5 staff + at least 1 ledger
    const lineCount = (svg.match(/<line /g) || []).length;
    assert.ok(lineCount > 5, 'Should have ledger lines for middle C in treble clef');
  });

  it('contains CF and CP legend', () => {
    const { svg } = renderStaffSVG(baseParams);
    assert.ok(svg.includes('>CF<'), 'Should contain CF legend');
    assert.ok(svg.includes('>CP<'), 'Should contain CP legend');
  });
});
