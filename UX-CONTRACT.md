# Radio interaction contract

Product evidence: README.md, the Stable Audio API client and the DSP/generation tests. This repository supplies a React player; inference runs in a separate local service.

| Capability | Canonical owner | Source of truth | Surface | Verification |
| --- | --- | --- | --- | --- |
| Form | GenerativeRadio | Component state and recipe validation | Direction, exclusions and generation controls | Component validation and generation tests |
| Select/Listbox | Native select in GenerativeRadio | API model catalog and phase definitions | Installed models, precision variants and phase insertion | Component selection tests |
| Viewport fit | GenerativeRadio and src/app.css | Available window size | Complete desktop facade; vertical narrow layout | Browser dimensions and panel overflow checks |
| Dialog | RadioDialog | Native HTML dialog | Sound catalog | Existing keyboard/focus behavior and catalog tests |
| Feedback | Inline alert/status in GenerativeRadio | Actual operation state | Status screen and model display | Loading, reconnect and import tests |
| Search | Local sound filter in GenerativeRadio | Stable Audio tag catalog | Category and free text in the sound catalog | Component search tests |
| Monitoring | radio-dsp | Web Audio filter response and stereo samples | EQ screen and physical meters | DSP tests and browser waiting/silence states |

## Main flow

Write a comma-separated direction, choose a local model, generate and play. Missing setup focuses the model controls and displays an actionable message without losing the direction. Empty directions receive an inline error and focus. Valid generation requests autoplay; blocked playback remains resumable through Play.

Play, Pause, Stop, restart and next-track actions use separate physical keys. A native range with a physical fader cap seeks through the current track.

## Editing and persistence

Direction and Exclude support tag selection, addition, removal and ordering. Positive tags can be pinned. Structure pads select a phase; dedicated buttons move or remove it. Evolution and the generation essentials remain visible.

Composition settings affect upcoming audio. Monitoring DSP settings affect playback immediately and leave the generated WAV intact. Existing stored tags and model selection retain their persistence behavior. No additional save action is needed.

## Async behavior and errors

Generation controls prevent duplicate starts. Import and reconnect failures appear on the facade; a failed retry retains the unavailable state. Changes to generation settings invalidate stale queued audio, including fixed tags and diffusion parameters.

The local engine pairing token is captured from the redirect fragment, stored locally and removed from the URL. Paired requests go directly to the loopback engine with the token header.

## Verification limits

Component tests use jsdom and media stubs; they validate application state rather than decoded audio or complete native browser behavior. Browser checks cover the rendered facade, physical press/focus feedback, local editing and responsive geometry. Full generation/playback E2E has not been verified while the local engine is unpaired.
