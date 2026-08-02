# Code index

A map of every file in the repo, what it owns, and the functions worth knowing about.
Keep this current when you add or move code — it is the fastest way for anyone (human or
agent) to find the right file without reading all of them.

---

## Top level

| File | Purpose |
|---|---|
| `index.html` | Hub page. Hero, tool grid container, "how it works". Renders nothing itself — `hub.js` fills the grid. |
| `tools.json` | The tool registry. Single source for what appears on the hub. Adding a tool = one entry here. |
| `README.md` | Project overview, usage, gotchas, repo layout. |
| `CODE-INDEX.md` | This file. |
| `LICENSE` | MIT. |
| `.nojekyll` | Stops GitHub Pages running Jekyll, which would ignore `_`-prefixed paths and slow deploys. |

---

## `assets/` — shared across every tool page

### `assets/css/base.css`
The design system. Anything a second tool would also want lives here; anything specific to one
tool does not.

- **Tokens** — `:root` custom properties: `--bg`, `--bg-2`, `--bg-3`, `--line`, `--fg`, `--accent`,
  radii, shadows, `--mono` / `--sans` stacks.
- **Theming** — dark by default; light comes from `prefers-color-scheme` *and* from
  `:root[data-theme="light"]`, so the toggle wins over the OS in both directions.
- **Components** — `.site-head`, `.btn` (`.btn-primary`, `.btn-sm`, `.btn-ghost`, `.is-done`),
  `.card`, `.panel` (+ `> header`, `> .body`), `.tag`, form controls, `pre.code`, `#toast`,
  `.site-foot`.

### `assets/js/ui.js`
Loaded first on every page. Attaches three things to `window`:

| Symbol | Does |
|---|---|
| theme handling | Reads `localStorage['cch-theme']`, applies `data-theme`, and delegates clicks on `#theme`. |
| `window.toast(msg)` | Shows the `#toast` pill for ~1.9s. |
| `window.copyText(text)` | Promise&lt;bool&gt;. Uses `navigator.clipboard` in a secure context, otherwise a hidden-`textarea` + `execCommand` fallback so it still works over plain http. |
| `window.flashButton(btn, label)` | Temporarily swaps a button's label and adds `.is-done`. |

### `assets/js/hub.js`
Fetches `tools.json` and builds the tool grid. Live tools become `<a>` cards, planned ones become
dimmed `<div>`s. Builds nodes with `createElement` rather than `innerHTML` so registry text can
never inject markup. Never needs editing to add a tool.

---

## `tools/statusline/` — the status line builder

### `statusline.sh` — the runtime (**source of truth**)
The script that actually runs on the user's machine. Generic: the layout comes from the
`CONFIG='…'` JSON on line 10, everything below it is fixed. The builder ships this file with only
that line swapped, and `install.sh` does the same substitution server-side.

| Function | Does |
|---|---|
| *(top block)* | One `jq` call flattens the Status-hook payload into `p_*` shell vars, joined with `\x1f`. A second does the same for `CONFIG` → `cfg_*`. |
| `colour(name)` / `basecode(name)` | Colour name → ANSI SGR. Names here must match `COLOURS` in `app.js`. |
| `heat(pct)` | Green &lt;50%, yellow 50–79%, red 80%+. |
| `ico(glyph, ascii)` | Returns the ASCII fallback when `icons` is off. |
| `tok(n)` | `41500` → `41k`. |
| `countdown(v)` | Epoch seconds *or* ISO-8601 → `3h43m` / `2d4h`. Empty when the reset is in the past. |
| `tilde(dir)` | `$HOME` → `~`. |
| `render(field, text)` | **The field catalogue.** One `case` arm per field id. Adding a field means adding an arm here *and* an entry in `fields.js`. |
| `heatval(field)` | Which percentage a `heat`-coloured field grades against. |
| *(layout block)* | Builds the `TXT`/`FMT` maps, drops all-empty rows, trims trailing empty cells, computes per-column widths, prints, then draws the rule sized to the widest row. |

### `install.sh` — one-line installer
`curl … | bash -s -- <base64url-config>`. Decodes and validates the config, downloads
`statusline.sh` from Pages, substitutes the `CONFIG` line with `awk` (not `sed` — the config
contains `/`, `|` and `[`), writes `~/.claude/statusline-command.sh`, then patches `statusLine`
into `settings.json` with `jq` while preserving every other key. Backs up both files, follows a
symlinked `settings.json` to the real target, and prints a sample render at the end.
Honours `CCH_BASE` and `CLAUDE_CONFIG_DIR` for testing.

### `fields.js` — field catalogue + preview renderers
Defines `window.CCH_FIELDS` (array) and `window.CCH_FIELD` (id → field). Each entry:

```js
{ id, group, label, hint,
  heat?: true,          // can be auto-coloured by a percentage
  pct?(payload),        // which percentage grades it
  custom?: true,        // takes a user-supplied string (the `text` field)
  preview(payload, opts, cell) }   // must mirror render() in statusline.sh
```

Groups drive the palette headings: *Machine*, *Project*, *Model*, *Session*, *Usage*, *Custom*.
Also exports `CCH_UTIL` (`tok`, `pct`, `home`, `countdown`, `get`).

### `app.js` — the builder
Everything stateful. Sections in file order:

| Section | Key symbols |
|---|---|
| Colours | `COLOURS`, `HEX`, `HEX_BOLD`, `swatchHex()`, `heatColour()` — names kept in sync with `basecode()` in the shell script |
| Presets | `PRESETS` — grid / minimal / context watcher / ASCII safe / everything |
| Sample payloads | `SAMPLES` — `mid`, `fresh`, `limits`, `bare`. `_git_branch`, `_git_dirty` and `_now` are preview-only keys, never in a real payload |
| State | `state` (= the config object), `selected`, `template`, `tab` |
| Encoding | `b64encode` / `b64decode` (URL-safe, UTF-8 via `TextEncoder`), `configJSON()` — key order is fixed so the same layout always yields the same string |
| Persistence | `save()` writes `localStorage` **and** `#c=` in the URL; `load()` prefers the hash, falls back to storage, and drops unknown field ids |
| Palette | `renderPalette()` — grouped, filterable |
| Rows | `renderRows()`, `makeChip()`, `iconBtn()` |
| Inspector | `inspector()` — colour swatches for the selected chip, plus the text input for custom cells |
| Mutations | `addCell`, `removeCell`, `moveCell`, `moveRow`, `removeRow`, `defaultColour`, `commit` |
| Drag & drop | Pointer-event based, so mouse and touch use the same path. `drag` holds the gesture; `dropTarget(x, y)` resolves a pointer position to `{row, index}` by comparing against chip midpoints. Arrow keys move a focused chip; Backspace deletes it |
| Preview | `renderPreview()` reproduces the shell layout algorithm in the DOM — same column widths, same empty-row dropping, same rule width. `span()` applies the colour. `warn()` surfaces caveats |
| Output | `buildScript()` (template + config line), `buildPrompt()`, `buildInstall()`, `renderOutput()`, `baseURL()` |
| Wiring | `init()` — populates selects, loads state, binds every control, then fetches `statusline.sh` |

### `app.css`
Page-scoped only: terminal preview, palette, rows and chips, drag ghost, inspector, options grid,
output tabs.

### `index.html`
Markup and ids the JS binds to: `#preset`, `#share`, `#reset`, `#sample`, `#term`, `#warn`,
`#filter`, `#palette`, `#rows`, `#addRow`, `#sep`, `#sepColor`, `#optAlign`, `#optRule`,
`#optIcons`, `.tab[data-tab]`, `#out`, `#outHelp`, `#copyOut`, `#download`.

---

## `docs/`

| File | Contents |
|---|---|
| `docs/index.html` | Docs landing page. |
| `docs/statusline-payload.md` | The complete Status-hook JSON schema, field by field, and which of them are optional or conditional. |
| `docs/adding-a-tool.md` | How to add a tool page to the hub. |

---

## Invariants worth not breaking

1. **`fields.js` and `statusline.sh` must agree.** A field with a `preview()` but no `case` arm
   shows in the browser and vanishes in the terminal. The reverse is just as bad.
2. **Colour names are a shared vocabulary** between `COLOURS`/`HEX` in `app.js` and `basecode()`
   in `statusline.sh`. Add to both.
3. **`CONFIG` must stay one line** matching `/^CONFIG='.*'$/m` — the builder, the installer and
   any hand-edit all rely on that.
4. **The config is the whole layout.** No state lives anywhere else; that is what makes the share
   link and the short installer possible.
5. **jq's `//` swallows `false`.** Never write `.someBool // true`.
