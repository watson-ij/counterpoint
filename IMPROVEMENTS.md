# Recommended Improvements

Prioritized list of correctness issues and improvements for the Counterpoint Checker.

---

## 1. Music Theory Correctness

### 1.1 Direct fifths/octaves uses semitone threshold instead of generic interval

`app.js:269-270` — The direct (hidden) fifths/octaves check flags when the upper voice moves more than 2 semitones (`uMoved > 2`). The standard Fux rule is: similar motion into a perfect consonance is forbidden when the **upper voice leaps** (generic interval > 1, i.e., anything larger than a step).

A minor 2nd (1 semitone) and major 2nd (2 semitones) are both steps and should be allowed. A minor 3rd (3 semitones) is a leap and should be flagged. The current `> 2` threshold happens to produce correct results, but it's checking the wrong property. An augmented 2nd (3 semitones, generic interval 1) would be incorrectly flagged as a leap.

**Fix:** Use `genericInterval()` to determine whether the upper voice leaps:

```js
const upperNow = cpAbove ? cp[i] : cf[i];
const upperPrev = cpAbove ? cp[i-1] : cf[i-1];
const gi = genericInterval(upperPrev.name, upperPrev.octave, upperNow.name, upperNow.octave);
if (gi > 1) { ... }
```

### 1.2 Compound perfect intervals not fully handled

`intervalInfo()` treats compound intervals inconsistently. P12 (19 semitones, simple = 7) is handled correctly — it has `isPerfect = true` and `simple = 7`. But P15 (24 semitones, simple = 0) gets `isPerfect = true` only via the `PERF.includes(0)` check, and its `simple = 0` makes it indistinguishable from P1 or P8 in downstream checks.

The parallel motion check at line 264 compares `intv.simple === prev.simple`, which means P1→P8, P8→P15, or P5→P12 transitions are classified as "similar" (not "parallel") because `motionType()` compares both `simple` and `semitones`. This is arguably correct — they're not *parallel* intervals — but the direct motion check (line 268) should still flag similar motion into P15, which it currently misses due to the `simple !== 0` guard.

### 1.3 Mode change has no explicit UX feedback for invalidated notes

Changing the mode re-renders and re-runs analysis, which flags out-of-scale notes as warnings. This is functionally correct. However, the user sees no explicit notification that their existing CP notes may now conflict with the new mode. A transient message like "3 notes are now out of scale" in the analysis panel would prevent confusion.

---

## 2. Accessibility

### 2.1 Tab panels missing `aria-controls` and `role="tabpanel"`

`index.html:182-184` — The tabs correctly use `role="tablist"`, `role="tab"`, and `aria-selected`. However, the controlled panel (`#inputPanel` content below the tabs) lacks `role="tabpanel"` and the tab elements lack `aria-controls` pointing to the panel. Arrow key navigation between tabs is also not implemented per the WAI-ARIA tabs pattern.

### 2.2 No octave control via keyboard

Letter keys (C-B) enter notes at a default octave, but there's no keyboard mechanism to change the octave. Arrow Up/Down keys are available (not currently bound) and could cycle through octaves for the letter-key input.

### 2.3 SVG `aria-label` is generic

The SVG has `aria-label="Musical staff with N CF notes and N CP notes"`, which provides note counts but not actual content. A more informative label listing the note names (e.g., "CF: C4 D4 F4 E4, CP: E5 F5 A4...") would give screen reader users access to the musical content without needing the visual representation.

---

## 3. UX Improvements

### 3.1 No tempo control for playback

Playback tempo is hardcoded at 600ms per beat for `playAll()` and 500ms for `playSingle()`. A tempo slider (e.g., 60-180 BPM, defaulting to 100) would let users listen at comfortable speeds.

### 3.2 Alert dialogs for import errors

Import errors use `alert()`, which blocks the UI thread and feels jarring. Replace with an inline notification (e.g., a temporary message in the analysis panel that auto-dismisses after a few seconds).

### 3.3 No help/keyboard shortcut reference

The header subtitle mentions a few shortcuts, but there is no discoverable help panel listing all available keyboard shortcuts and their functions. A "?" button that toggles a shortcuts reference (similar to the Rules panel toggle) would improve discoverability. Current shortcuts include:

- **← →** Navigate bars
- **Tab** Switch voice
- **C D E F G A B** Enter note at default octave
- **Delete/Backspace** Clear note
- **Ctrl+Z / Ctrl+Shift+Z** Undo/redo

### 3.4 No undo description

The undo/redo system works well, but users cannot see what action will be undone. Showing the last action description (e.g., "Undo: add C4 at bar 3") as a tooltip on the undo button would improve confidence in using undo.

---

## 4. Code Quality

### 4.1 Global scope pollution

All functions and state live in the global scope. Wrapping the application in an IIFE or using an ES module would prevent name collisions and make the code more testable.

```js
// Minimal change: wrap in IIFE
(function() {
  // ... all existing code ...
})();
```

The `onclick="..."` attributes in `index.html` reference global functions, so switching to an IIFE would require replacing inline handlers with event listeners in `init()`. An intermediate approach is to keep a single global entry point and attach everything else to it.

### 4.2 SVG built via string concatenation

`renderStaff()` builds the entire SVG as a string and sets `innerHTML`. This works but is fragile (no escaping of dynamic values), hard to maintain, and prevents partial DOM updates. Consider using `document.createElementNS` for SVG elements, or extracting helper functions for repeated SVG patterns (note ellipse, ledger line, bar rectangle).

### 4.3 Inconsistent note object shape

Notes from presets use `{n, o}` while internal state uses `{name, octave}`. The `cfToNotes()` bridge function converts between them, but the inconsistency is a source of confusion during maintenance. Standardizing on `{name, octave}` throughout (including presets) would eliminate the need for the bridge.

### 4.4 No input validation on JSON import

`importJSON()` checks that `data.cfNotes` is an array but doesn't validate individual note objects. A note like `{name: "Q", octave: 999}` or `{name: 5}` would be silently accepted and cause `toMidi()` to return -1, producing incorrect interval calculations and rendering. Validate note shape and ranges on import.

```js
function isValidNote(n) {
  return n === null || (
    typeof n === 'object' &&
    typeof n.name === 'string' &&
    CHROMATIC.includes(n.name) &&
    typeof n.octave === 'number' &&
    n.octave >= 0 && n.octave <= 9
  );
}
```

---

## Summary by Priority

| Priority | Item | Impact |
|----------|------|--------|
| **P1 — Theory** | 1.1 Direct 5ths/8ves uses semitone heuristic | Incorrect for augmented 2nd edge case |
| **P1 — Theory** | 1.2 Compound perfect intervals (P15) missed | Incomplete rule enforcement |
| **P2 — A11y** | 2.1 Tab panels missing ARIA attributes | Incomplete screen reader support |
| **P2 — A11y** | 2.2 No octave control via keyboard | Limited keyboard-only workflow |
| **P2 — UX** | 3.1 No tempo control | Rigid playback experience |
| **P3 — UX** | 3.2 Alert dialogs for import errors | Jarring UX |
| **P3 — UX** | 3.3 No help/shortcut reference | Low discoverability |
| **P3 — Code** | 4.1 Global scope pollution | Maintainability risk |
| **P3 — Code** | 4.2 SVG string concatenation | Fragile, hard to maintain |
| **P3 — Code** | 4.3 Inconsistent note object shape | Maintenance confusion |
| **P3 — Code** | 4.4 No import validation | Silent failures on malformed data |
