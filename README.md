# herdr-brrr

A [herdr](https://herdr.dev) plugin for the important things. While a coding
agent is working, a strip opens under its pane and plays a GIF of your choice
next to a running tally of how much money is being spent on AI. The strip closes
as soon as the agent is done, idle, or needs input.

```
┌──────────────────────────────────────────────────────────────┐
│ claude                                                       │
│ ● Refactoring the auth module…                               │
├──────────────────────────────────────────────────────────────┤
│ ▗▄▖▝▀▙▗▄▄▖▗▄▖▝▀▙▗▄▄▖▗▄▖▝    money printer go brrr            │
│ ▐█▙▄▟▛▀▀▜▙▄▟█▛▀▜▙▄▟▛▀▀▜▙    claude working · 1:23            │
│ ▝▀▜█▛▀▘▗▟█▙▖▝▀▜█▛▀▘▗▟█▙▖    spent on AI  $4,127,400,000      │
│ ▗▄▟█▙▄▖▝▜█▛▘▗▄▟█▙▄▖▝▜█▛▘    made from AI $107.03             │
│ ▝▀▀▀▀▀▘ ▝▀▘ ▝▀▀▀▀▀▘ ▝▀▘     ROI: soon™                       │
└──────────────────────────────────────────────────────────────┘
```

The counter accumulates across every agent run, at a conservative
$2.7M spent per second against $0.07 earned.

## Install

```sh
herdr plugin install jonathanbendov-luminAi/herdr-berr-plugin
brew install ffmpeg chafa   # ffmpeg is needed for any GIF; chafa makes it sharp
```

Requires `node`. No GIFs ship with the plugin: you bring your own.

## Example: money printer go brrr

Open the GIF bank manager inside herdr and paste the URL (any file path or
direct `http(s)` GIF URL works):

```sh
herdr plugin pane open --plugin herdr-brrr --entrypoint set-gif
> https://media.tenor.com/XPk4hFUx1w4AAAAC/money-printer.gif
```

Or write the config yourself, at `$(herdr plugin config-dir herdr-brrr)/config.json`:

```json
{
  "gifs": [
    "https://media.tenor.com/XPk4hFUx1w4AAAAC/money-printer.gif"
  ],
  "title": "money printer go brrr",
  "fps": 12,
  "max_rows": 17
}
```

URLs are downloaded once and cached. Black bars are trimmed automatically.

## GIF bank

Put several GIFs in `gifs` and each working agent gets one at random. Some
ideas: Matrix falling code, a Skynet boot screen, Nyan cat, a hacking montage,
John Cena's "you can't see me", AI drinking a lake. Leave `gifs` empty for the
counter on its own.

| Key | Default | Meaning |
| --- | --- | --- |
| `gifs` | `[]` | Paths or URLs. One is picked at random per strip. |
| `title` | `money printer go brrr` | First line of the label. |
| `fps` | `12` | Playback rate. |
| `max_rows` | `17` | Tallest strip, including herdr's pane border. |

## How it renders

| Outer terminal | Renderer |
| --- | --- |
| Ghostty, kitty, WezTerm | Real image frames via the Kitty graphics protocol |
| Anything else, with `chafa` | chafa block art |
| Anything else, without `chafa` | Plain half-block art |

Frames are built once per GIF and pane size, then cached in the plugin state
directory (`~/.local/state/herdr/plugins/herdr-brrr/cache`). Force a renderer by
writing `kitty`, `chafa`, `blocks` or `none` to
`~/.local/state/herdr/plugins/herdr-brrr/mode`.

## Behaviour

- The GIF is scaled to the width of the agent's pane; the label moves under it
  in narrow panes.
- Skipped for zoomed panes and panes too short to split.
- Toggle on/off: `herdr plugin action invoke herdr-brrr.toggle`

## Files

- `hook.mjs`: event hook that opens and closes strips on `pane.agent_status_changed`
- `strip.mjs`: runs inside the strip pane, animates the GIF and the counter
- `set-gif.mjs`: GIF bank manager (`list`, `add`, `remove`, `clear`, or interactive)
- `lib.mjs`: config, GIF download and crop detection, strip sizing
- `build-frames.sh`: renders a GIF to chafa, raw RGB or PNG frames
