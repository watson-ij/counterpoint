# Recommended Improvements

Prioritized list of bugs, correctness issues, and improvements for the Counterpoint Checker.

---

## 1. Bugs

### 1.1 MusicXML key signature is wrong for most modes

`app.js:908-910` — The key signature calculation counts sharps in the mode's note array, then special-cases F major (`A#` as Bb). This produces incorrect MusicXML for every flat-based key except F major, and for modes whose accidentals don't correspond to their key signature on the circle of fifths (e.g. E phrygian exports as 0 fifths instead of -3).

**Fix:** Map each mode to its correct `fifths` value directly, or compute it from the tonic and quality using a circle-of-fifths lookup table.

```js
// Example: explicit mapping
const KEY_FIFTHS = {
  "C major": 0, "D dorian": 0, "D minor": -1,
  "E phrygian": 0, "F major": -1, "G major": 1,
  "G mixolydian": 0, "A minor": 0, "A aeolian": 0,
};
```

### 1.2 Voice crossing check false-positives at endpoints

`app.js:236-240` — Unisons are allowed at bar 0 and the final bar (line 236), but the voice-crossing check on lines 239-240 uses strict `<` / `>`, which means a unison at an endpoint is simultaneously flagged as "Voice crossing" and accepted as a valid interval. The crossing check should skip endpoints where unisons are legal.

```js
// Before the crossing check, skip if unison at endpoint is allowed:
const isEndpoint = (i === 0 || i === n - 1);
if (cpAbove && cpM[i] < cfM[i] && !(isEndpoint && cpM[i] === cfM[i]))
  issues.push({sev:"error", bar:i, msg:"Voice crossing"});
```

### 1.3 Cursor goes to -1 when CF is empty

`app.js:675` — `moveCursor` clamps to `state.cfNotes.length - 1`. If the CF is empty (length 0), cursor becomes -1, which causes downstream rendering to break. Guard with `Math.max(0, ...)`.

```js
function moveCursor(dir) {
  const maxIdx = Math.max(0, state.cfNotes.length - 1);
  state.cursor = Math.max(0, Math.min(state.cursor + dir, maxIdx));
  render();
}
```

### 1.4 Event listeners leak on every render

`app.js:494-504` — `renderStaff()` rebuilds the SVG innerHTML and then attaches new click listeners to `.bar-click` and `.note-click` elements. Since `render()` is called on every action (including during playback), old DOM nodes are discarded but any references to their listeners cannot be GC'd until the parent is collected. More importantly, during `playAll()` (line 746) `renderStaff()` is called in a tight loop without going through `render()`, so listeners are being attached to elements that are immediately replaced.

**Fix:** Use event delegation on `#staffWrap` instead of per-element listeners:

```js
document.getElementById('staffWrap').addEventListener('click', (e) => {
  const bar = e.target.closest('[data-bar]');
  if (!bar) return;
  state.cursor = parseInt(bar.dataset.bar);
  if (bar.dataset.voice) state.activeVoice = bar.dataset.voice;
  render();
});
```

### 1.5 Repeated notes inconsistently treated between voices

`app.js:186-187` — Repeated notes in CF are errors, but in CP they are only warnings. First-species counterpoint forbids repeated notes in both voices (every note must be a whole note moving to a different pitch). CP repeated notes should be errors.

---

## 2. Music Theory Correctness

### 2.1 Direct fifths/octaves detection is incomplete

`app.js:260-266` — The current check flags direct (hidden) 5ths/octaves when "one voice moves more than 2 semitones." The standard Fux rule is: similar motion into a perfect consonance is forbidden when the *upper voice* leaps (regardless of which voice is CF/CP). The current code checks the upper voice (`cpAbove ? CP : CF`), which is correct for the common case, but `uMoved > 2` (more than a whole step) should be `uMoved > 2` only if you consider M2 = 2 semitones acceptable. Some pedagogies flag any leap (generic interval > 1) in the upper voice. Consider tightening or making this configurable.

### 2.2 Approach final by step only checked for CF

`app.js:203-208` — The penultimate-to-final step check is in `checkMelodicLine`, which runs for both voices, so this is actually correct. However, the CP's approach to the final note also has a harmonic constraint: the penultimate interval should form a proper cadential pattern (major 6th expanding to octave, or minor 3rd contracting to unison). This cadential pattern check is missing entirely.

### 2.3 No leading tone enforcement at cadence

In minor modes, the raised 7th (leading tone) is required in the penultimate bar of the counterpoint to form a proper cadence. The code offers the raised 7th as a keyboard option (`app.js:591-596`) but never validates that it is actually used at the cadence. A warning when the penultimate CP note is the natural 7th in a minor mode would catch this.

### 2.4 Mode change doesn't revalidate existing notes

`app.js:1041` — Changing the mode via the dropdown re-renders, which re-runs analysis. However, existing CP notes that were valid in the old mode may now be chromatic in the new mode. The analysis does flag out-of-scale notes as warnings, so this technically works — but a more explicit UX (e.g., highlighting affected notes or showing a confirmation dialog) would prevent confusion.

---

## 3. Performance

### 3.1 Full DOM rebuild on every state change

`render()` (`app.js:975-1019`) rebuilds the keyboard buttons, the entire SVG staff, and the analysis panel on every action — including simple cursor moves that only need to update highlighting. This causes unnecessary DOM churn.

**Fix:** Split rendering into targeted update functions:
- `updateCursorHighlight()` — only updates bar fill/stroke attributes
- `updateAnalysis()` — only re-runs when notes change, not on cursor moves
- `renderStaff()` — full rebuild only when note data changes

### 3.2 Analysis runs redundantly

`renderStaff()` calls `runAnalysis()` internally to determine error/warning bar highlighting, and then `render()` passes the returned issues to `renderAnalysis()`. The analysis itself is O(n) where n = number of bars, so this is not a performance crisis, but it means every render cycle runs the rule checker twice conceptually (once for bar colors, once for the panel). Caching the result until notes actually change would be cleaner.

### 3.3 Audio nodes not cleaned up

`app.js:88-131` — Oscillators are created with `start`/`stop` but never explicitly disconnected. The Web Audio spec says stopped oscillators are eligible for GC, but calling `disconnect()` after stop ensures the audio graph is cleaned up promptly. In long sessions with many playbacks, this could matter.

---

## 4. Accessibility

### 4.1 No keyboard note input

Users must click buttons to enter notes. Supporting letter keys (C, D, E, F, G, A, B) for note input and up/down arrows for octave changes would make the tool much faster to use and accessible to keyboard-only users.

### 4.2 Missing ARIA roles on tabs

`index.html:177-179` — The tab UI uses `<div>` elements with `onclick`. These should use `role="tablist"`, `role="tab"`, `aria-selected`, and `aria-controls` attributes, and respond to arrow key navigation per the WAI-ARIA tabs pattern.

### 4.3 SVG staff has no accessible alternative

The staff SVG is purely visual. Screen reader users get no information about what notes are placed. Adding `aria-label` to the SVG element with a text summary (e.g., "Staff showing 10 bars, CF: C4 D4 F4..., CP: G4 A4...") would provide basic access.

### 4.4 No visible focus indicators

The CSS defines no `:focus` or `:focus-visible` styles. Keyboard users cannot see which element is focused. Add outline styles for all interactive elements.

### 4.5 Icon-only buttons lack accessible names

Buttons like "✕ Clear", "← Prev", "▶ Both" use Unicode symbols. While these have adjacent text, some (like the "+" and "−" for bar management) could benefit from explicit `aria-label` attributes.

---

## 5. UX Improvements

### 5.1 No tempo control for playback

Playback tempo is hardcoded at 600ms per beat (`app.js:734`). A simple tempo slider (e.g., 300ms-1200ms) would let users listen at comfortable speeds.

### 5.2 No visual playback indicator for single-voice playback

`playSingle()` (`app.js:753-760`) schedules all notes via Web Audio timing but doesn't update the playhead indicator. The user hears notes but the staff doesn't highlight the current bar. Implementing a visual playhead for single-voice playback (using `setTimeout` to sync with audio timing) would provide better feedback.

### 5.3 Alert dialogs for errors

`app.js:829, 843` — Import errors use `alert()`, which blocks the UI thread. Replace with an inline notification (e.g., a temporary message in the analysis panel).

### 5.4 No help/keyboard shortcut reference

The header mentions a few shortcuts, but there is no discoverable help modal listing all available keyboard shortcuts and their functions. A "?" button that opens a shortcuts reference would improve discoverability.

### 5.5 No undo description

The undo/redo system works well, but users cannot see what action will be undone. Showing the last action description (e.g., "Undo: add C4 at bar 3") in a tooltip on the undo button would improve confidence in using undo.

---

## 6. Code Quality

### 6.1 Global scope pollution

All functions and state live in the global scope. Wrapping the application in an IIFE or using ES modules would prevent name collisions and make the code more maintainable.

```js
// Minimal change: wrap in IIFE
(function() {
  // ... all existing code ...
})();
```

### 6.2 Magic numbers throughout rendering code

`app.js:374` — `SLG = 11, NR = 5.5, BW = 56, LM = 16, CW = 32, ST = 60` are defined as constants but their names are cryptic. Renaming to descriptive names improves readability:

```js
const STAFF_LINE_GAP = 11;
const NOTE_RADIUS = 5.5;
const BAR_WIDTH = 56;
const LEFT_MARGIN = 16;
const CLEF_WIDTH = 32;
const STAFF_TOP = 60;
```

### 6.3 SVG built via string concatenation

`renderStaff()` builds SVG as a string and sets `innerHTML`. This works but is fragile (no escaping), hard to test, and makes it impossible to do partial updates. Consider using `document.createElementNS` for SVG elements, or at minimum, extracting helper functions for common SVG patterns (note ellipse, ledger line, bar rectangle).

### 6.4 Inconsistent note object shape

Notes from presets use `{n, o}` (`app.js:64`) while internal state uses `{name, octave}`. The `cfToNotes()` function bridges this, but it's a source of confusion. Standardizing on one shape throughout would reduce bugs.

### 6.5 No input validation layer

Import (`app.js:824-847`) does minimal validation (checks `Array.isArray(data.cfNotes)`), but doesn't validate individual note objects. Malformed notes (missing `name`, non-numeric `octave`, notes outside valid MIDI range) could cause silent failures in rendering or analysis.

---

## Summary by Priority

| Priority | Item | Impact |
|----------|------|--------|
| **P0 — Bug** | 1.1 MusicXML key signature wrong | Exported files unusable in notation software for most modes |
| **P0 — Bug** | 1.2 Voice crossing false positive at endpoints | Incorrect error shown to students |
| **P0 — Bug** | 1.5 CP repeated notes should be errors | Pedagogically incorrect leniency |
| **P1 — Bug** | 1.3 Cursor -1 on empty CF | Crash on edge case |
| **P1 — Bug** | 1.4 Event listener leak | Memory growth in long sessions |
| **P1 — Theory** | 2.2 Missing cadential pattern check | Incomplete rule coverage |
| **P1 — Theory** | 2.3 No leading tone enforcement | Cadences not validated |
| **P2 — Perf** | 3.1 Full rebuild on cursor move | Unnecessary DOM churn |
| **P2 — A11y** | 4.1 No keyboard note input | Major usability gap |
| **P2 — A11y** | 4.2 Missing ARIA on tabs | Screen reader inaccessible |
| **P2 — A11y** | 4.4 No focus indicators | Keyboard navigation invisible |
| **P2 — UX** | 5.1 No tempo control | Rigid playback experience |
| **P3 — Code** | 6.1 Global scope | Maintainability |
| **P3 — Code** | 6.2 Magic number names | Readability |
| **P3 — Code** | 6.3 SVG string concat | Testability, partial updates |
