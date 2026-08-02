# Adding a tool

The hub renders itself from `tools.json`, so a new tool is two steps and no changes to any
existing JavaScript.

## 1. Create the page

```
tools/<id>/index.html
tools/<id>/app.css      (optional, page-scoped styles)
tools/<id>/app.js       (optional)
```

Start from this skeleton — it inherits the theme toggle, the toast, the clipboard helper and the
whole design system:

```html
<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>My tool — Claude Code Helper</title>
<link rel="stylesheet" href="../../assets/css/base.css">
<link rel="stylesheet" href="app.css">
</head>
<body>
<header class="site-head">
  <div class="wrap">
    <a class="brand" href="../../"><span class="dot"></span> Claude Code Helper</a>
    <nav>
      <a href="../../">All tools</a>
      <a href="../../docs/">Docs</a>
      <a href="https://github.com/Qutaiba-Khader/claude-code-helper">GitHub</a>
      <button class="btn btn-ghost btn-sm" id="theme" aria-label="Toggle theme">◐</button>
    </nav>
  </div>
</header>

<main class="wrap">
  <section class="panel">
    <header>Panel title <span class="spacer"></span></header>
    <div class="body">…</div>
  </section>
</main>

<div id="toast" role="status" aria-live="polite"></div>
<script src="../../assets/js/ui.js"></script>
<script src="app.js"></script>
</body>
</html>
```

## 2. Register it

Append to `tools.json`:

```json
{
  "id": "my-tool",
  "name": "My tool",
  "tagline": "One sentence on what it produces.",
  "icon": "◆",
  "status": "live",
  "href": "tools/my-tool/",
  "tags": ["settings"]
}
```

`status` is `live` or `planned`. A planned entry renders dimmed and unclickable, so you can list
something before it exists — set `href` to `null` until it does.

## House rules

**Use the shared classes.** `.panel`, `.card`, `.btn`, `.tag`, `.check`, `pre.code`, `.note`.
If you need a component a second tool would also want, add it to `assets/css/base.css` rather
than to your page.

**Both themes.** Colours come from the custom properties in `base.css`. Never hard-code a hex
value that has to differ between light and dark — that is what the tokens are for.

**Build DOM with `createElement`.** Anything derived from user input or from a JSON file must not
go through `innerHTML`.

**Stay static.** No build step, no bundler, no external requests. GitHub Pages serves the repo
as-is, and the site is meant to keep working offline once loaded.

**Copy buttons go through `window.copyText()`**, which falls back to `execCommand` outside a
secure context. Pair it with `window.flashButton(btn, 'Copied')` for feedback.

**Keep generated artefacts single-source.** The status line builder fetches `statusline.sh` at
runtime instead of embedding a copy in JavaScript, so the script the user gets is byte-for-byte
the file in the repo. Do the same for anything you generate.

## Local development

```bash
python3 -m http.server 8000
```

`file://` will not work — the pages `fetch()` JSON and text assets, which CORS blocks on the file
protocol.
