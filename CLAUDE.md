# Counterpoint Checker

First-species counterpoint composition tool with real-time rule checking. No build step — open `index.html` directly in a browser.

## Structure

- `index.html` — markup and CSS
- `app.js` — all application logic (music theory, audio engine, rule checker, UI, rendering)

## Architecture

The app is a single-page vanilla JS application using the Web Audio API for sound synthesis and inline SVG for staff notation. No frameworks or dependencies.

Key sections in `app.js`:
- **Music theory** — MIDI conversion, interval calculation, motion type detection
- **Audio engine** — dual-oscillator synth (triangle + sine) with lowpass filter and gain envelope
- **Rule checker** — melodic line validation (`checkMelodicLine`) and harmony validation (`checkHarmony`) per first-species rules
- **Staff rendering** — SVG generation for the musical staff, notes, and bar highlights
- **UI actions** — note input, cursor navigation, playback controls
- **Local storage** — auto-save/restore session state via `localStorage` (key: `counterpoint_session`)
- **Export** — JSON (reimportable), MusicXML, plain text; import from JSON file

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
