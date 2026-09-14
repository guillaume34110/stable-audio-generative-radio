---
version: alpha
name: radio.studio
description: A local generative music workstation presented as one physical device.
colors:
  primary: "#e6eaf2"
  background: "#171c20"
  surface: "#20262b"
  muted: "#9ba6b2"
  border: "#4b555d"
  accent: "#ffba3b"
  selected: "#463219"
typography:
  sans:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
  display:
    fontFamily: "Rajdhani, Arial Narrow, monospace"
  brand:
    fontFamily: "Manrope, sans-serif"
spacing:
  page-max: "1550px"
omitted:
  - section: components
    reason: "Behavior and visual states are documented below and in UX-CONTRACT.md."
---

# radio.studio Design System

## Product

A single front-facing music workstation with physical controls, a continuous graphite metal chassis and mauve side cheeks. Direction, exclusions, structure, macros, EQ, generation, current and next tracks, and transport are accessible on the facade. The reference is `design/radio-studio-reference-v2.png`.

The interface is French. The intended audience includes developers, designers and music enthusiasts across countries and genders; this does not imply completed localization.

## Materials and typography

Runtime tokens belong to `src/app.css`. The chassis uses `public/assets/hardware/graphite-v1.png`; knobs, keys, screws, fader caps and LED lenses use the transparent `components-v1.png` atlas. Asset specifications are in `design/hardware-assets.md`.

All screens use the same amber monochrome display treatment. Variable text remains HTML and belongs inside those screens. Barlow Condensed labels read as silkscreen printing; Rajdhani supplies the display text, and Manrope the brand.

Vivid colors belong to illuminated hardware: coral keys, colored pads and rotary arcs, and green/amber/red meter segments. Static labels remain neutral and readable.

## Layout

One continuous machine fills the available desktop space. Above 820px, the facade scales to the available window height, including the status strip, without page scrolling. At narrower widths, panels form a readable vertical layout with no horizontal page overflow.

The left stack contains Direction, Exclude, the current track, and a compact Evolution panel. Recovered vertical space enlarges the two tag displays. Structure spans the upper right; macros, EQ and generation remain visible. The next-track display and transport have dedicated areas.

## Physical behavior

Button housings remain fixed while their centers and printed legends depress by 1.5px. The wide generation key retains its horizontal scale during a press to avoid black side gaps. Labels printed on the chassis remain stationary.

Knob lighting stays fixed while the pointer rotates. Drag vertically to adjust, hold Shift for fine control, use the keyboard, or double-click to restore the initial value. Focus brightens the existing colored arc; controls without an arc use a small green LED. There is no extra rotary focus outline.

Native buttons, ranges and selects preserve keyboard interaction and accessible names. Selected controls expose aria-pressed. Reduced-motion preferences remove transitions. The sound catalog uses a native dialog with its existing keyboard and focus behavior.

## Data and feedback

The EQ graph uses actual filter frequency response; it shows a waiting state before audio initialization. Stereo meters measure the two output channels independently and stay dark at silence.

Current and next tracks expose title, status, time, target BPM, known key, model, seed, energy, texture, evolution, mode, tags and structure. Unknown values remain empty indicators.

Engine pairing, installed models, model import and reconnect controls are on the facade. Errors and actual operation status appear in the shared status screen. Successful generation or playback must never be inferred from an illustrative display or mocked tests.
