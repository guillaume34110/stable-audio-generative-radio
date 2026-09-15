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

Write a free-text direction, choose a local model, generate and play. Missing setup focuses the model controls and displays an actionable message without losing the direction. Empty directions receive an inline error and focus. Valid generation requests autoplay; blocked playback remains resumable through Play.

Play, Pause, Stop, restart and next-track actions use separate physical keys. A native range with a physical fader cap seeks through the current track. An icon-only download key on the current track saves its original WAV. It remains disabled until audio is available and does not alter playback or the generation queue.

## Editing and persistence

Direction and Exclude are fixed-size LCD text areas. Neither field is split into tags, and neither has a rotary selector or an editing-button row. Direction has 25% more screen height than Exclude. Generation sits below Exclude; the current and next track readouts sit together. Structure pads select a phase; dedicated buttons move or remove it.

Composition settings affect upcoming audio. Monitoring DSP settings affect playback immediately and leave the generated WAV intact. Existing text and model selections retain their persistence behavior. Legacy pinned phrases are appended to the visible direction once, without duplicating phrases already present. Empty exclusions stay empty after a reload. No additional save action is needed.

## Async behavior and errors

Generation controls prevent duplicate starts. Import and reconnect failures appear on the facade; a failed retry retains the unavailable state. Changes to composition and diffusion settings wait for the next available generation slot. They do not cancel an in-flight request, discard a buffered track or interrupt playback. Each request snapshots the complete direction and exclusions; no words are sampled or reordered.

The local engine pairing token is captured from the redirect fragment, stored locally and removed from the URL. Paired requests go directly to the loopback engine with the token header.

## Prompt contract

The sound catalog supplies optional English vocabulary for the SA3 family. Descriptions and defaults must not refer to a personal training dataset or imply that musical suggestions are guaranteed control tokens. The [official SA3 guide](https://kb.stability.ai/knowledge-base/stable-audio-3-prompt-guide) is the reference for optional TrackType, Format and Genre fields.

The API receives the Direction text unchanged, followed only by a natural-language sentence when structure phases are selected. Exclusions stay in the separate negative_prompt field, and BPM stays in the numeric request field. Suggestions append editable text; they never toggle or remove part of an existing sentence.

## Verification limits

Component tests use jsdom and media stubs; they validate application state rather than decoded audio or complete native browser behavior. Browser checks cover the rendered facade, physical press/focus feedback, local editing and responsive geometry. API serialization tests use a simulated local engine. They verify full prompt and negative-prompt transmission, not audio quality or runtime support for every SA3 model. Full model-generation/playback E2E is separate from these checks.
