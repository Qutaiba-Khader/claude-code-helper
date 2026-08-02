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
| settings.json explorer | planned | Every setting with its type, default and scope |
| Hook builder | planned | Pick an event, get a working hook block |
| Skill scaffolder | planned | `SKILL.md` with frontmatter that actually triggers |
| MCP connector helper | planned | Build the `claude mcp add` command, auth pitfalls handled |
| Subagent designer | planned | Agent definition files: tools, model, system prompt |

The live list is [`tools.json`](tools.json) — the hub renders itself from it.

---

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
         "rows":[[{"f":"userhost","c":"bold-green"},{"f":"cwd","c":"bold-blue"}], …]}'
```

Requirements: `jq` on `PATH`, plus `git` if you use the branch field.

### Gotchas it already handles

- **Multi-line status lines work.** The renderer splits on newlines and stacks them. A
  *single*-line status line is dimmed and truncated instead — so a grid has to stay multi-line.
- **Font size is not settable** from a status line. That belongs to the terminal emulator.
- **`workspace.repo` has no branch** — host, owner and name only. The branch has to come from `git`.
- **`resets_at` may be epoch seconds or ISO-8601.** Both are parsed.
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
