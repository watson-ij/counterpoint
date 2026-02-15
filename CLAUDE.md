# Counterpoint Checker

First-species counterpoint composition tool with real-time rule checking. No build step — open `index.html` directly in a browser.

## Structure

- `index.html` — markup and CSS
- `music.js` — pure music theory module (ES module, no DOM dependencies)
- `app.js` — UI, audio engine, rendering, state management (imports from `music.js`)
- `test/music.test.js` — test suite for `music.js` (`node:test`, zero dependencies)

## Architecture

The app is a single-page vanilla JS application using ES modules, the Web Audio API for sound synthesis, and inline SVG for staff notation. No frameworks or build step.

`music.js` (pure logic, testable in Node):
- **Constants** — `NOTE_NAMES`, `CHROMATIC_SHARP/FLAT`, `SCALE_PATTERNS`, `KEY_DEFS`, `MODES`, `SAMPLE_CF`
- **Music theory** — `toMidi`, `semiDist`, `genericInterval`, `intervalInfo`, `motionType`
- **Key/mode helpers** — `buildDiatonicNames`, `buildModeNotes`, `getRaised7th`, `getKeySigWidth`, `getNoteAccidental`
- **Rule checker** — `checkMelodicLine`, `checkHarmony`
- **Note spelling** — `migrateNoteName`

`app.js` (DOM/browser, imports from `music.js`):
- **Audio engine** — dual-oscillator synth (triangle + sine) with lowpass filter and gain envelope
- **Staff rendering** — SVG generation for the musical staff, notes, and bar highlights
- **UI actions** — note input, cursor navigation, playback controls (all via `addEventListener` in `init()`)
- **Local storage** — auto-save/restore session state via `localStorage` (key: `counterpoint_session`)
- **Export** — JSON (reimportable), MusicXML, plain text; import from JSON file

## Testing

Run tests with: `node --test test/music.test.js`

## Audio notes

The synth uses a 15ms linear attack ramp starting from gain 0 to avoid clicks. The gain node's `.value` is set to 0 at creation time (before scheduling) to prevent the default value of 1.0 from leaking through.

## Rules implemented

**Cantus firmus:** tonic start/end, single climax, range ≤ 10th, stepwise motion, no 7ths/tritones/aug 2nds, max 2 consecutive leaps, approach final by step.

**First species counterpoint:** begin/end on perfect consonance, all intervals consonant, no parallel/direct 5ths or octaves, ≤ 3 consecutive imperfect consonances, unisons only at endpoints, max P12 between voices, contrary motion to final, independent climaxes.

## Persistence & export

Session state (CF/CP notes, mode, CP position, active voice, cursor) is saved to `localStorage` on every render and restored on page load. Selecting a new preset from the dropdown clears the saved session.

Export formats:
- **JSON** — full note data, can be reimported via the Import button
- **MusicXML** — two-part score for notation software (MuseScore, Finale, etc.)
- **Plain text** — tabular bar/note/interval layout with analysis summary
