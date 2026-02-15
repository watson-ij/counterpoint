# Recommended Improvements

Prioritized list of bugs, correctness issues, and improvements for the Counterpoint Checker.

---

## 1. Bugs

### 1.1 Parallel octaves (P8) mislabeled as "parallel unisons"

`app.js:264-266` — `intervalInfo()` maps both P1 (0 semitones) and P8 (12 semitones) to `simple = 0`. The parallel motion check uses `intv.simple === 0 ? "unisons"` to label the issue, so parallel P8→P8 motion is reported as "Parallel unisons" instead of "Parallel octaves."

**Fix:** Use `intv.semitones === 0` instead of `intv.simple === 0` when choosing the label:

```js
const nm = intv.semitones === 0 ? "unisons" : intv.simple === 7 ? "5ths" : "octaves";
```

### 1.2 Direct motion into octaves (P8) not detected

`app.js:268` — The direct fifths/octaves check guards with `intv.simple !== 0`, intending to skip unisons. But since P8 also has `simple = 0`, this skips octaves entirely. Direct (hidden) octaves — similar motion into a P8 where the upper voice leaps — are never flagged.

**Fix:** Guard with `intv.semitones !== 0` instead:

```js
if (mot === "similar" && intv.isPerfect && intv.semitones !== 0) {
```

### 1.3 Event listeners re-created on every render (keyboard and analysis)

`app.js:630-636` — `renderKeyboard()` rebuilds the note button DOM and attaches new click listeners on every `render()` call. Similarly, `renderAnalysis()` (line 589-593) attaches `.iss-jump` click handlers to freshly-created elements each render. Unlike the staff (which uses event delegation attached once in `init()`), these two sections create and discard listeners on every action.

This isn't a memory leak in practice (old DOM nodes are replaced, so old listeners become eligible for GC), but it's wasteful and inconsistent with the staff's delegation pattern.

**Fix:** Use event delegation on `#noteKeyboard` and `#analysisPanel`, attached once during `init()`:

```js
// In init():
document.getElementById('noteKeyboard').addEventListener('click', (e) => {
  const btn = e.target.closest('.nbtn');
  if (!btn) return;
  addNote(btn.dataset.note, parseInt(btn.dataset.oct));
});

document.getElementById('analysisPanel').addEventListener('click', (e) => {
  const iss = e.target.closest('.iss-jump');
  if (!iss) return;
  const b = parseInt(iss.dataset.bar);
  if (b >= 0) { state.cursor = b; render(); }
});
```

### 1.4 Single-voice playback cannot be stopped

`app.js:770-777` — `playSingle()` schedules all notes via Web Audio timing (`playNote` with increasing `delay`) and returns immediately. There is no mechanism to cancel scheduled oscillators. If the user starts single-voice playback and then starts `playAll()`, both play simultaneously.

**Fix:** Track scheduled oscillator nodes and provide a `stopAll()` function, or gate single-voice playback through the same `state.playing` flag used by `playAll()`.

### 1.5 Blob URL revoked synchronously after programmatic click

`app.js:978-980` — `downloadFile()` calls `a.click()` then immediately `URL.revokeObjectURL(url)`. In most browsers the download starts asynchronously after `click()` returns, so the URL may be revoked before the browser reads from it. This works in practice on Chrome/Firefox but is technically a race condition.

**Fix:** Revoke the URL in a `setTimeout`:

```js
a.click();
document.body.removeChild(a);
setTimeout(() => URL.revokeObjectURL(url), 60000);
```

---

## 2. Music Theory Correctness

### 2.1 Direct fifths/octaves uses semitone threshold instead of generic interval

`app.js:269-270` — The direct (hidden) fifths/octaves check flags when the upper voice moves more than 2 semitones (`uMoved > 2`). The standard Fux rule is: similar motion into a perfect consonance is forbidden when the **upper voice leaps** (generic interval > 1, i.e., anything larger than a step).

A minor 2nd (1 semitone) and major 2nd (2 semitones) are both steps and should be allowed. A minor 3rd (3 semitones) is a leap and should be flagged. The current `> 2` threshold happens to produce correct results, but it's checking the wrong property. An augmented 2nd (3 semitones, generic interval 1) would be incorrectly flagged as a leap.

**Fix:** Use `genericInterval()` to determine whether the upper voice leaps:

```js
const upperNow = cpAbove ? cp[i] : cf[i];
const upperPrev = cpAbove ? cp[i-1] : cf[i-1];
const gi = genericInterval(upperPrev.name, upperPrev.octave, upperNow.name, upperNow.octave);
if (gi > 1) { ... }
```

### 2.2 Compound perfect intervals not fully handled

`intervalInfo()` treats compound intervals inconsistently. P12 (19 semitones, simple = 7) is handled correctly — it has `isPerfect = true` and `simple = 7`. But P15 (24 semitones, simple = 0) gets `isPerfect = true` only via the `PERF.includes(0)` check, and its `simple = 0` makes it indistinguishable from P1 or P8 in downstream checks.

The parallel motion check at line 264 compares `intv.simple === prev.simple`, which means P1→P8, P8→P15, or P5→P12 transitions are classified as "similar" (not "parallel") because `motionType()` compares both `simple` and `semitones`. This is arguably correct — they're not *parallel* intervals — but the direct motion check (line 268) should still flag similar motion into P15, which it currently misses due to the `simple !== 0` guard.

### 2.3 Mode change has no explicit UX feedback for invalidated notes

`app.js:1071` — Changing the mode re-renders and re-runs analysis, which flags out-of-scale notes as warnings. This is functionally correct. However, the user sees no explicit notification that their existing CP notes may now conflict with the new mode. A transient message like "3 notes are now out of scale" in the analysis panel would prevent confusion.

---

## 3. Performance

### 3.1 Full DOM rebuild on every state change

`render()` (`app.js:987-1033`) rebuilds the keyboard buttons, the entire SVG staff, and the analysis panel on every action — including simple cursor moves that only need to update bar highlighting. This causes unnecessary DOM churn.

**Fix:** Split rendering into targeted update functions:
- `updateCursorHighlight()` — only update bar fill/stroke attributes via direct DOM manipulation
- `updateAnalysis()` — only re-run when notes change, not on cursor moves
- `renderStaff()` — full rebuild only when note data changes

Track a dirty flag on the state to distinguish cursor-only changes from note changes.

### 3.2 Audio nodes not explicitly disconnected

`app.js:129-132` — Oscillators are created with `start`/`stop` but never explicitly disconnected. The Web Audio spec says stopped oscillators are eligible for GC, but calling `disconnect()` after `stop` ensures the audio graph is cleaned up promptly. In long sessions with many playbacks, orphaned nodes could accumulate.

**Fix:** Use `onended` to disconnect:

```js
osc1.onended = () => { osc1.disconnect(); osc2.disconnect(); filter.disconnect(); gainNode.disconnect(); };
```

---

## 4. Accessibility

### 4.1 Tab panels missing `aria-controls` and `role="tabpanel"`

`index.html:182-184` — The tabs correctly use `role="tablist"`, `role="tab"`, and `aria-selected`. However, the controlled panel (`#inputPanel` content below the tabs) lacks `role="tabpanel"` and the tab elements lack `aria-controls` pointing to the panel. Arrow key navigation between tabs is also not implemented per the WAI-ARIA tabs pattern.

### 4.2 No octave control via keyboard

Letter keys (C-B) enter notes at a default octave (line 1104-1106), but there's no keyboard mechanism to change the octave. Arrow Up/Down keys are available (not currently bound) and could cycle through octaves for the letter-key input.

### 4.3 SVG `aria-label` is generic

`app.js:436` — The SVG has `aria-label="Musical staff with N CF notes and N CP notes"`, which provides note counts but not actual content. A more informative label listing the note names (e.g., "CF: C4 D4 F4 E4, CP: E5 F5 A4...") would give screen reader users access to the musical content without needing the visual representation.

---

## 5. UX Improvements

### 5.1 No tempo control for playback

Playback tempo is hardcoded at 600ms per beat for `playAll()` (`app.js:751`) and 500ms for `playSingle()` (line 773). A tempo slider (e.g., 60-180 BPM, defaulting to 100) would let users listen at comfortable speeds.

### 5.2 No visual playback indicator for single-voice playback

`playSingle()` (`app.js:770-777`) schedules all notes via Web Audio timing but doesn't update the playhead indicator. The user hears notes but the staff doesn't highlight the current bar. Implementing a visual playhead (using `setTimeout` synchronized with audio timing) would provide feedback matching the `playAll()` behavior.

### 5.3 Alert dialogs for import errors

`app.js:846, 860` — Import errors use `alert()`, which blocks the UI thread and feels jarring. Replace with an inline notification (e.g., a temporary message in the analysis panel that auto-dismisses after a few seconds).

### 5.4 No help/keyboard shortcut reference

The header subtitle mentions a few shortcuts, but there is no discoverable help panel listing all available keyboard shortcuts and their functions. A "?" button that toggles a shortcuts reference (similar to the Rules panel toggle) would improve discoverability. Current shortcuts include:

- **← →** Navigate bars
- **Tab** Switch voice
- **C D E F G A B** Enter note at default octave
- **Delete/Backspace** Clear note
- **Ctrl+Z / Ctrl+Shift+Z** Undo/redo

### 5.5 No undo description

The undo/redo system works well, but users cannot see what action will be undone. Showing the last action description (e.g., "Undo: add C4 at bar 3") as a tooltip on the undo button would improve confidence in using undo.

---

## 6. Code Quality

### 6.1 Global scope pollution

All functions and state live in the global scope. Wrapping the application in an IIFE or using an ES module would prevent name collisions and make the code more testable.

```js
// Minimal change: wrap in IIFE
(function() {
  // ... all existing code ...
})();
```

The `onclick="..."` attributes in `index.html` reference global functions, so switching to an IIFE would require replacing inline handlers with event listeners in `init()`. An intermediate approach is to keep a single global entry point and attach everything else to it.

### 6.2 SVG built via string concatenation

`renderStaff()` builds the entire SVG as a string and sets `innerHTML`. This works but is fragile (no escaping of dynamic values), hard to maintain, and prevents partial DOM updates. Consider using `document.createElementNS` for SVG elements, or extracting helper functions for repeated SVG patterns (note ellipse, ledger line, bar rectangle).

### 6.3 Inconsistent note object shape

Notes from presets use `{n, o}` (`app.js:69`) while internal state uses `{name, octave}`. The `cfToNotes()` bridge function (line 76) converts between them, but the inconsistency is a source of confusion during maintenance. Standardizing on `{name, octave}` throughout (including presets) would eliminate the need for the bridge.

### 6.4 No input validation on JSON import

`importJSON()` (`app.js:841-864`) checks that `data.cfNotes` is an array but doesn't validate individual note objects. A note like `{name: "Q", octave: 999}` or `{name: 5}` would be silently accepted and cause `toMidi()` to return -1, producing incorrect interval calculations and rendering. Validate note shape and ranges on import.

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
| **P0 — Bug** | 1.1 Parallel P8 mislabeled as "unisons" | Incorrect error message shown to students |
| **P0 — Bug** | 1.2 Direct octaves (P8) not detected | Missing rule enforcement |
| **P1 — Bug** | 1.3 Keyboard/analysis listeners re-created per render | Wasteful; inconsistent with staff pattern |
| **P1 — Bug** | 1.4 Single-voice playback unstoppable | Overlapping audio on rapid interactions |
| **P1 — Theory** | 2.1 Direct 5ths/8ves uses semitone heuristic | Incorrect for augmented 2nd edge case |
| **P1 — Theory** | 2.2 Compound perfect intervals (P15) missed | Incomplete rule enforcement |
| **P2 — Perf** | 3.1 Full DOM rebuild on cursor move | Unnecessary DOM churn |
| **P2 — A11y** | 4.1 Tab panels missing ARIA attributes | Incomplete screen reader support |
| **P2 — A11y** | 4.2 No octave control via keyboard | Limited keyboard-only workflow |
| **P2 — UX** | 5.1 No tempo control | Rigid playback experience |
| **P2 — UX** | 5.2 Single-voice playback has no visual indicator | No feedback for what's playing |
| **P3 — UX** | 5.3 Alert dialogs for import errors | Jarring UX |
| **P3 — UX** | 5.4 No help/shortcut reference | Low discoverability |
| **P3 — Code** | 6.1 Global scope pollution | Maintainability risk |
| **P3 — Code** | 6.2 SVG string concatenation | Fragile, hard to maintain |
| **P3 — Code** | 6.3 Inconsistent note object shape | Maintenance confusion |
| **P3 — Code** | 6.4 No import validation | Silent failures on malformed data |
