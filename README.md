# herdr-brrr

A [herdr](https://herdr.dev) plugin: while a coding agent is working, a strip
opens under its pane and plays the "money printer go brrr" GIF. The strip
closes as soon as the agent is done, idle, or needs input.

```
┌──────────────────────────────────────┐
│ claude                               │
│ ...                                  │
├──────────────────────────────────────┤
│ [ Powell GIF ]  money printer go brrr│
│                 claude working · 1:23│
└──────────────────────────────────────┘
```

## Install

```sh
herdr plugin install jonathanbendov-luminAi/herdr-berr-plugin
```

Requires `node`. For the sharp renderer also install `chafa` and `ffmpeg`
(`brew install chafa ffmpeg`).

## How it renders

| Outer terminal | Renderer |
| --- | --- |
| Ghostty, kitty, WezTerm | Real image frames via the Kitty graphics protocol |
| Anything else, with `chafa` + `ffmpeg` | chafa block art, sized to the pane width (built once per size, cached) |
| Anything else, without them | Plain 56×12 half-block art |

Force a renderer by writing `kitty`, `chafa` or `blocks` to `<state dir>/mode`.

## Behaviour

- The strip takes up to 17 rows from the working agent's pane and fits the
  GIF to that pane's width (label moves under the GIF in narrow panes).
- Skipped for zoomed panes and panes too short to split.
- Toggle on/off: `herdr plugin action invoke herdr-brrr.toggle`

## Files

- `hook.mjs` – event hook: opens/closes strips on `pane.agent_status_changed`
- `strip.mjs` – runs inside the strip pane and animates the frames
- `build-frames.sh` – renders chafa frames: `./build-frames.sh <cols> <rows> <out>`
- `powell-brrr.gif`, `frames/`, `frames-56x24.rgb` – the GIF and pre-rendered frames
