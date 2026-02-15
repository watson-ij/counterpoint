# First Species Counterpoint Checker

A browser-based tool for composing and checking first-species counterpoint against a cantus firmus. Enter notes, hear them played back, and get real-time feedback on rule violations.

**Try it live:** [watson-ij.github.io/counterpoint](https://watson-ij.github.io/counterpoint/)

## Features

- Edit a cantus firmus or choose from presets, then write a counterpoint line above or below
- Real-time rule checking for both the melodic line and the harmony between voices
- Playback with a dual-oscillator synth (Web Audio API)
- Staff notation rendered as inline SVG
- Export to JSON, MusicXML, or plain text
- Session auto-saved to localStorage

## Usage

No build step required. Open `index.html` in a browser, or visit the GitHub Pages link above.

## References

The rules implemented here are drawn from these sources:

- Johann Joseph Fux, *Gradus ad Parnassum* (1725) — the foundational species counterpoint treatise
- Felix Salzer & Carl Schachter, *Counterpoint in Composition* (Columbia University Press, 1969)
- [Open Music Theory — First-Species Counterpoint](https://openmusictheory.github.io/firstSpecies.html)
- [Open Music Theory (Pressbooks) — First-Species Counterpoint](https://viva.pressbooks.pub/openmusictheory/chapter/first-species-counterpoint/)
- [University of Puget Sound — First Species Counterpoint](https://musictheory.pugetsound.edu/mt21c/FirstSpecies.html)
- [RWU Composing Music — First Species Counterpoint](https://rwu.pressbooks.pub/musictheory/chapter/first-species-counterpoint/)
