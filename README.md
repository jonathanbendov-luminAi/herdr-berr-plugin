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

To favour some GIFs, give them a percentage. Weighted entries get exactly that
share and plain entries split whatever is left:

```json
"gifs": [
  { "path": "https://media.tenor.com/XPk4hFUx1w4AAAAC/money-printer.gif", "weight": 70 },
  { "path": "https://media.tenor.com/6b-jiIe_684AAAAC/ai-datacenter-chug-water.gif", "weight": 20 },
  "https://media.tenor.com/fKIG2kiLVPgAAAAC/this-is-fine-its-fine.gif",
  "https://media.tenor.com/adoVIoM4eo4AAAAC/keyboard-cat.gif"
]
```

Odds for this bank:

| Money printer go brrr | AI datacenter chugging water | This is fine | Keyboard cat |
| :---: | :---: | :---: | :---: |
| <img src="https://media.tenor.com/XPk4hFUx1w4AAAAM/money-printer.gif" width="180"> | <img src="https://media.tenor.com/6b-jiIe_684AAAAM/ai-datacenter-chug-water.gif" width="180"> | <img src="https://media.tenor.com/fKIG2kiLVPgAAAAM/this-is-fine-its-fine.gif" width="180"> | <img src="https://media.tenor.com/adoVIoM4eo4AAAAM/keyboard-cat.gif" width="180"> |
| **70%** (weight 70) | **20%** (weight 20) | **5%** (shares the other 10%) | **5%** (shares the other 10%) |

From the bank manager, type `5=70` to give #5 a 70% share (`5=0` removes the
weight), or run `node set-gif.mjs weight 5 70`. `list` shows each GIF's odds.

GIFs shown here are hosted on [Tenor](https://tenor.com) and are not part of
this repo.

| Key | Default | Meaning |
| --- | --- | --- |
| `gifs` | `[]` | Paths or URLs, or `{path, weight}` objects. One is picked at random per strip. |
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
- `set-gif.mjs`: GIF bank manager (`list`, `add`, `remove`, `weight`, `clear`, or interactive)
- `lib.mjs`: config, GIF download and crop detection, strip sizing
- `build-frames.sh`: renders a GIF to chafa, raw RGB or PNG frames
