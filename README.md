# Claude Code Helper

Browser tools that generate real [Claude Code](https://claude.com/claude-code) configuration and
hand you something you can paste straight into Claude.

**→ [qutaiba-khader.github.io/claude-code-helper](https://qutaiba-khader.github.io/claude-code-helper/)**

Static site, no build step, no dependencies, no account. Everything runs in the page — your
layout is kept in your browser and encoded into the URL, and nothing is ever uploaded.

---

## Tools

| Tool | State | What it does |
|---|---|---|
| [Status line builder](https://qutaiba-khader.github.io/claude-code-helper/tools/statusline/) | ready | Drag fields into rows, watch a live terminal preview, then copy a prompt for Claude / the raw script / a one-line installer |
| [settings.json explorer](https://qutaiba-khader.github.io/claude-code-helper/tools/settings/) | ready | Every documented setting with its type, default, version and scope — pick some and get a file you can merge |
| Hook builder | planned | Pick an event, get a working hook block |
| Skill scaffolder | planned | `SKILL.md` with frontmatter that actually triggers |
| MCP connector helper | planned | Build the `claude mcp add` command, auth pitfalls handled |
| Subagent designer | planned | Agent definition files: tools, model, system prompt |

The live list is [`tools.json`](tools.json) — the hub renders itself from it.

---

## settings.json explorer

Eighty documented `settings.json` keys, grouped and searchable, each with its type, default,
minimum version and whether it only works from a managed file. Pick the ones you want and the
tool assembles the file.

Every setting gets a control matched to its type — a pair of buttons for a boolean, a select for
an enum, one-per-line for a string array — rather than making you hand-write JSON. Dotted keys
like `permissions.allow` and `permissions.deny` merge into a single nested object.

Three ways out:

- **Prompt for Claude** — merges the keys into your settings file and explains what each one does,
  then shows you `/status` to confirm.
- **Raw JSON** — the keys on their own, to merge by hand.
- **jq merge** — a shell snippet that merges in place and backs the file up first.

It also warns when you put a managed-only key in a user or project file, where it would be
silently ignored, and carries the reference material: which file wins, what reloads live versus
what needs a restart, and the environment variables.

## Status line builder

Claude Code can draw a custom line under your prompt. It runs a shell command, feeds it a JSON
payload describing the session, and renders whatever the command prints. The builder is a visual
editor for that: pick the fields, arrange them into rows, choose colours, get a working script.

### Three ways to apply what you built

**1 — Prompt for Claude Code.** Copy it, paste it into any Claude Code session. Claude writes the
script and patches `settings.json` itself. Best if you want Claude to explain or adjust it after.

**2 — Raw script.** Save it as `~/.claude/statusline-command.sh`, `chmod +x`, and point
`statusLine` at it:

```json
{
  "statusLine": { "type": "command", "command": "bash ~/.claude/statusline-command.sh" }
}
```

**3 — One-line installer.** Writes the script and patches `settings.json` for you, backing both
up first:

```bash
curl -fsSL https://qutaiba-khader.github.io/claude-code-helper/tools/statusline/install.sh \
  | bash -s -- <base64-config>
```

The builder generates the exact command with your layout already encoded. Needs `curl`, `jq`
and `bash`.

### How the generated script works

There is **one** runtime, [`tools/statusline/statusline.sh`](tools/statusline/statusline.sh). Your
layout lives in a single `CONFIG='…'` JSON line at the top; the rest of the script is generic. So
you can hand-edit the layout later without regenerating anything, and the installer only has to
ship ~300 bytes of config instead of the whole script.

```
CONFIG='{"v":1,"sep":" | ","sepColor":"grey","rule":true,"align":true,"icons":true,
         "divider":true,"fit":false,"links":false,
         "st":{"padding":0,"refresh":0,"hideVim":false},
         "rows":[[{"f":"userhost","c":"bold-green"},{"f":"cwd","c":"bold-blue"}], …]}'
```

Requirements: `jq` on `PATH`, plus `git` if you use the branch field.

Any field that carries a percentage can be coloured **by value** instead of a fixed colour: set
`"c": "ramp"` and `"r"` to ten comma-separated colour names, one per 10% band (0–9, 10–19, …
90–100). The band is `floor(value * 10 / 100)`, clamped, so the colour changes as the value
climbs. Fewer than ten names is fine — the list is stretched over the range.

```
{"f":"ctx_pct","c":"ramp","r":"blue,cyan,cyan,green,green,yellow,yellow,magenta,red,red"}
```

A cell can carry `"i": false` to drop its built-in label — `out_tokens` normally renders
`↑ 1k`, and with the label off it is just `1k`, so you can pair it with a symbol of your own.

The `st` block is the only part the script ignores — `padding`, `refreshInterval` and
`hideVimModeIndicator` belong to `settings.json`, and the installer writes them there.

### What a status line cannot do

Font, font size and position belong to the terminal emulator and to Claude Code's own layout —
nothing you print can change them. The builder's font and colour-scheme pickers are preview only:
they exist so you can check how your ANSI colours land in *your* terminal, not because the script
sets them.

### Gotchas it already handles

- **Multi-line status lines work.** The renderer splits on newlines and stacks them. A
  *single*-line status line is dimmed and truncated instead — so a grid has to stay multi-line.
- **Font size is not settable** from a status line. That belongs to the terminal emulator.
- **`workspace.repo` has no branch** — host, owner and name only. The branch has to come from `git`.
- **`resets_at` is epoch seconds.** ISO-8601 is accepted too, defensively.
- **Escape sequences take no columns.** A cell containing an OSC 8 hyperlink measures ~50
  characters wider than it looks; widths are computed on an escape-stripped copy.
- **`tput cols` cannot see the terminal.** Claude Code captures stdout rather than attaching a
  tty; it exports `$COLUMNS` and `$LINES` instead (v2.1.153+).
- **Updates are debounced at 300ms and a slow script gets cancelled** when the next update fires,
  so a heavy `git status` means a stale line.
- **Set `refreshInterval` for anything time-based.** Event triggers are: a new assistant message,
  `/compact` finishing, a permission-mode change and a vim toggle — a clock will otherwise sit
  still between messages.
- **`disableAllHooks: true` disables the status line**, and the workspace trust dialog has to have
  been accepted or it stays blank.
- **jq's `//` treats `false` as empty.** `.rule // true` can never return `false`, which silently
  breaks boolean options; the script uses an explicit null check instead.
- **Field parsing uses `IFS=$'\037'`.** A whitespace `IFS` collapses runs of empty fields and
  shifts every later value into the wrong variable.
- **Ambiguous-width glyphs.** `⎇`, `↻` and the bar characters render double-width in some
  terminals (Windows Terminal especially), which breaks column alignment and makes glyphs collide
  with the next character. Turn **Unicode icons** off for plain ASCII, and note the script always
  puts a space after `↻`.
- **Rate-limit fields need a subscription** and only appear after the first API response of a
  session. The layout degrades cleanly when they are absent — empty cells collapse and all-empty
  rows are dropped.

---

## Repository layout

```
index.html              hub page
tools.json              tool registry — the hub renders itself from this
assets/
  css/base.css          shared design system (both themes)
  js/ui.js              theme toggle, toast, clipboard
  js/hub.js             renders the tool grid from tools.json
tools/statusline/
  index.html            builder UI
  app.css               page-scoped styles
  fields.js             field catalogue + browser-side preview renderers
  app.js                state, drag & drop, preview, output generation
  statusline.sh         the runtime — single source of truth for the script
  install.sh            one-line installer
tools/settings/
  index.html            explorer UI
  app.css               page-scoped styles
  settings-data.js      the settings catalogue, scopes, precedence, env vars
  app.js                selection state, typed value editors, output generation
docs/                   payload reference and contributor notes
```

[`CODE-INDEX.md`](CODE-INDEX.md) has a per-file map with the important functions.

## Adding a tool

1. Create `tools/<id>/index.html`, loading `../../assets/css/base.css` and
   `../../assets/js/ui.js` so it inherits the theme, toast and clipboard helpers.
2. Append an entry to `tools.json`.

Nothing on the hub needs editing — see [`docs/adding-a-tool.md`](docs/adding-a-tool.md).

## Local development

It is a static site, so any file server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

`file://` will not work: the builder fetches `statusline.sh` and `tools.json`, which CORS blocks
on the file protocol.

## Contributing

Issues and PRs welcome. If you add a field to the status line builder you must add it in **two**
places — a `preview()` entry in `fields.js` and the matching `case` in `render()` inside
`statusline.sh` — or the preview and the real output will disagree.

## Licence

MIT. Not affiliated with Anthropic.
