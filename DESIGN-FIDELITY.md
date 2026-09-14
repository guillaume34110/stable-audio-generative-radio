# Reference fidelity audit

Current status: the facade has been integrated and visually checked, including the final press behavior and desktop viewport fit. Earlier passes below record intermediate gaps. Full audio-generation/playback E2E remains unverified while the engine is unpaired.

Target: user attachment `image-1.png`, corrected reference saved as `design/radio-studio-reference-v2.png`.

The corrected image preserves the reference layout, adds NOW PLAYING below EXCLUDE, expands UP NEXT and unifies all screens in amber. Implementation must supply next-track arrangement and a physical seek fader even where the generated image abbreviates them. Do not reproduce generated label typos or illustrative EQ values as real measurements.

## Required visual and functional evidence

- One straight-on continuous metal machine, pink side cheeks, no cosmetic I/O.
- All screens match the reference's left amber monochrome display technology.
- Vivid multicolor illumination belongs to physical buttons, knob rings and electronic meters.
- Positive and negative tags, arrangement and evolution are directly editable on the facade.
- Each macro has one physical control; changing values appear in dedicated screens.
- EQ has its own amber screen and functioning low/mid/high controls, preamp, volume, filter and limiter.
- Current and next track displays include title, status/progress, time, BPM, key where known, model, seed, energy, texture, tags and arrangement.
- Separate physical transport buttons and a physical seek fader.
- Generation essentials remain visible without opening settings submenus.
- Desktop capture compared against the corrected reference; narrow viewport remains usable.
- Real playback/DSP validation distinguished from mocked unit tests.

## Observed gaps before correction

The prior integration is a different composition: green displays, small knobs without illuminated rings, settings hidden in a dialog, and missing three-band EQ controls. The EQ curve is illustrative rather than a measured filter response. Its meter forces two segments on even at silence. Some macro IDs and controls are duplicated in the settings dialog. Passing unit tests does not establish visual fidelity or real audio operation.

Status at the start of integration: incomplete. The later sections record the corrections and their verification.

## Integration pass 1

Implemented amber common screen styling, reference grid placement, larger illuminated macro knobs, separate low/mid/high/preamp/volume facade controls, visible evolution and generation settings. Low/mid/high and volume now reach Web Audio settings; silence no longer forces meter segments on. Production build passes.

Screenshot comparison at 1062px revealed a breakpoint conflict which was corrected and rechecked. Current layout now follows reference panel placement. Remaining: real EQ response graph, independent stereo meters, separate play/pause, physical seek fader, tag selection/edit actions, model controls and errors without hidden dependencies, removal of duplicate settings controls/IDs, accurate track metadata display, narrower layout verification, updated behavioral tests and real audio validation. Current screenshot is evidence of progress, not full fidelity.

## Integration pass 2

Actual BiquadFilter frequency response replaces the illustrative curve; display explicitly waits before audio context initialization. Stereo meters independently measure channels after master volume. Play/pause are separate and the seek fader remains visible while unloaded. DSP tests cover explicit band gains, zero volume and unequal stereo channel levels and pass.

Positive/negative facade tags support selection, move and removal; positive tags support pinning. Browser interaction verified moving `minimal techno` left and right and restored original order. Screenshot at 1062px inspected the full facade with these controls. Adjusted metal backing beneath tag buttons and LED pad colors toward reference.

Still incomplete: settings duplication, model setup on facade, track data accuracy/readability, arrangement editing ergonomics, responsive layout and real audio validation. Two previously observed UI test failures remain to diagnose; subsequent UI additions require rerunning the suite. Do not claim complete from DSP tests or compilation.

## Responsive and data pass

Removed hardcoded F#m fallback and labelled tempo as target BPM. Arrangement pads now select rather than delete; dedicated move/remove controls and direct insertion pads cover the empty state. At a temporary 390px browser viewport, measured document scrollWidth=390 and all thirteen visible panels at 322px: no horizontal document overflow. Screenshot inspected; temporary viewport override reset. Mobile still needs lower-page interaction/legibility review. Desktop final comparison and all remaining requirements above remain unproven.

## Material assets and facade integration

The facade now uses a transparent 16-component sprite atlas and a continuous graphite material image, saved under `public/assets/hardware/`. Prompt specifications are recorded in `design/hardware-assets.md`. Knurled caps, recessed screw heads, transport keys, illuminated structure pads, LED lenses and the seek-fader cap use the atlas. The main illuminated key uses three image slices to preserve its bevels without stretching the corners.

Removed the obsolete settings surface and placed engine/model setup on the facade. Current and next track readouts share the same amber display styling. All variable text remains live HTML. Knobs support vertical dragging, keyboard adjustment and double-click reset; their cap lighting stays fixed while the pointer rotates.

Validation: production build passes; 39 tests pass across six files. Browser inspection at 1536 × 1024 confirmed document dimensions 1536 × 1024 and no panel overflow. At 390px, all twelve panels measured 326px wide with no horizontal or vertical panel overflow. The tempo keyboard control changed 124 → 125 BPM and was restored to 124. Final desktop screenshot was inspected against the reference. These checks cover rendering and frontend behavior; full audio-generation E2E remains unverified because the local engine requires pairing. Do not label those E2E checks as passed.

## Control mechanics and viewport fit

Button housings and caps use separate masks over the same sprite. During a real browser pointer press, the outer button and housing both measured `transform: none`; only the cap measured `matrix(0.975, 0, 0, 0.975, 0, 1.5)`. Its printed label moves by the same 1.5px, while labels printed on the chassis remain fixed. Structure pads, switches and the large generation key use this same separation.

The wide generation key preserves its width while pressed to remove black gaps at either side. A subsequent pointer check measured `matrix(1, 0, 0, 0.975, 0, 1.5)` for its center and `transform: none` for its housing.

Rotary focus brightens the existing colored arc without drawing an outline. Controls without an arc light a small physical green LED. Browser inspection confirmed both states, and tested parameter values were restored.

The left panels share a vertical stack: Evolution is 80px before scaling, and the recovered space enlarges Direction and Exclude. At 1062 × 969, their displayed heights are approximately 183px and 202px, with Evolution at 79px. A ResizeObserver fits the complete desktop machine to available window height, including its status line. Browser measurements show no page scrolling or panel overflow at 1062 × 969, 1280 × 720 and 1536 × 1024. The narrow layout remains vertically scrollable for readable controls; at 390px it has no horizontal page overflow or panel overflow.

Latest validation: 39 tests pass; production build and whitespace check pass. These corrections concern the facade; full generation/playback E2E is still unverified while the engine is unpaired.
