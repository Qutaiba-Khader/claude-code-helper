/* Status line builder.
 *
 * State shape (this is exactly what gets embedded in statusline.sh as CONFIG,
 * and what gets base64'd into the share link and the one-line installer):
 *
 *   { v:1, sep:" | ", sepColor:"grey", rule:true, align:true, icons:true,
 *     rows: [ [ {f:"cwd", c:"bold-blue"}, ... ], ... ] }
 *
 * `t` is only present on custom-text cells.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var FIELDS = window.CCH_FIELDS, FIELD = window.CCH_FIELD;

  // ---------------------------------------------------------------- colours
  // Colour names must stay in sync with basecode() in statusline.sh.
  var COLOURS = ['default', 'dim', 'grey', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];

  // Terminal colour schemes. The script only ever emits standard ANSI codes —
  // what they look like is entirely up to the terminal, so the preview lets you
  // check your layout against the common schemes.
  //   n = normal ANSI 30-37, b = bright / bold ANSI 90-97
  var SCHEMES = {
    'vscode-dark': {
      name: 'VS Code Dark+', bg: '#1e1e1e', fg: '#cccccc',
      n: ['#000000', '#cd3131', '#0dbc79', '#e5e510', '#2472c8', '#bc3fbc', '#11a8cd', '#e5e5e5'],
      b: ['#666666', '#f14c4c', '#23d18b', '#f5f543', '#3b8eea', '#d670d6', '#29b8db', '#ffffff']
    },
    'campbell': {
      name: 'Windows Terminal (Campbell)', bg: '#0c0c0c', fg: '#cccccc',
      n: ['#0c0c0c', '#c50f1f', '#13a10e', '#c19c00', '#0037da', '#881798', '#3a96dd', '#cccccc'],
      b: ['#767676', '#e74856', '#16c60c', '#f9f1a5', '#3b78ff', '#b4009e', '#61d6d6', '#f2f2f2']
    },
    'one-dark': {
      name: 'One Dark', bg: '#282c34', fg: '#abb2bf',
      n: ['#3f4451', '#e05561', '#8cc265', '#d18f52', '#4aa5f0', '#c162de', '#42b3c2', '#e6e6e6'],
      b: ['#4f5666', '#ff616e', '#a5e075', '#f0a45d', '#4dc4ff', '#de73ff', '#4cd1e0', '#ffffff']
    },
    dracula: {
      name: 'Dracula', bg: '#282a36', fg: '#f8f8f2',
      n: ['#21222c', '#ff5555', '#50fa7b', '#f1fa8c', '#bd93f9', '#ff79c6', '#8be9fd', '#f8f8f2'],
      b: ['#6272a4', '#ff6e6e', '#69ff94', '#ffffa5', '#d6acff', '#ff92df', '#a4ffff', '#ffffff']
    },
    nord: {
      name: 'Nord', bg: '#2e3440', fg: '#d8dee9',
      n: ['#3b4252', '#bf616a', '#a3be8c', '#ebcb8b', '#81a1c1', '#b48ead', '#88c0d0', '#e5e9f0'],
      b: ['#4c566a', '#bf616a', '#a3be8c', '#ebcb8b', '#81a1c1', '#b48ead', '#8fbcbb', '#eceff4']
    },
    'gruvbox-dark': {
      name: 'Gruvbox Dark', bg: '#282828', fg: '#ebdbb2',
      n: ['#282828', '#cc241d', '#98971a', '#d79921', '#458588', '#b16286', '#689d6a', '#a89984'],
      b: ['#928374', '#fb4934', '#b8bb26', '#fabd2f', '#83a598', '#d3869b', '#8ec07c', '#ebdbb2']
    },
    'solarized-dark': {
      name: 'Solarized Dark', bg: '#002b36', fg: '#839496',
      n: ['#073642', '#dc322f', '#859900', '#b58900', '#268bd2', '#d33682', '#2aa198', '#eee8d5'],
      b: ['#586e75', '#cb4b16', '#586e75', '#657b83', '#839496', '#6c71c4', '#93a1a1', '#fdf6e3']
    },
    'solarized-light': {
      name: 'Solarized Light', bg: '#fdf6e3', fg: '#657b83',
      n: ['#073642', '#dc322f', '#859900', '#b58900', '#268bd2', '#d33682', '#2aa198', '#eee8d5'],
      b: ['#586e75', '#cb4b16', '#586e75', '#657b83', '#839496', '#6c71c4', '#93a1a1', '#fdf6e3']
    },
    'terminal-basic': {
      name: 'macOS Terminal (Basic)', bg: '#ffffff', fg: '#000000',
      n: ['#000000', '#c23621', '#25bc24', '#adad27', '#492ee1', '#d338d3', '#33bbc8', '#cbcccd'],
      b: ['#818383', '#fc391f', '#31e722', '#eaec23', '#5833ff', '#f935f8', '#14f0f0', '#e9ebeb']
    },
    'github-light': {
      name: 'GitHub Light', bg: '#ffffff', fg: '#24292f',
      n: ['#24292f', '#cf222e', '#116329', '#4d2d00', '#0969da', '#8250df', '#1b7c83', '#6e7781'],
      b: ['#57606a', '#a40e26', '#1a7f37', '#633c01', '#218bff', '#a475f9', '#3192aa', '#8c959f']
    }
  };

  // Monospace stacks that are available without downloading a webfont: each
  // lists the real font first and falls back to whatever the platform has.
  var FONTS = {
    system:    { name: 'System monospace', stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
    menlo:     { name: 'Menlo / SF Mono', stack: '"SF Mono", Menlo, Monaco, monospace' },
    consolas:  { name: 'Consolas', stack: 'Consolas, "Lucida Console", monospace' },
    cascadia:  { name: 'Cascadia Mono', stack: '"Cascadia Mono", "Cascadia Code", Consolas, monospace' },
    jetbrains: { name: 'JetBrains Mono', stack: '"JetBrains Mono", ui-monospace, monospace' },
    fira:      { name: 'Fira Code', stack: '"Fira Code", "Fira Mono", ui-monospace, monospace' },
    source:    { name: 'Source Code Pro', stack: '"Source Code Pro", ui-monospace, monospace' },
    ibm:       { name: 'IBM Plex Mono', stack: '"IBM Plex Mono", ui-monospace, monospace' },
    ubuntu:    { name: 'Ubuntu Mono', stack: '"Ubuntu Mono", "DejaVu Sans Mono", monospace' },
    dejavu:    { name: 'DejaVu Sans Mono', stack: '"DejaVu Sans Mono", "Liberation Mono", monospace' },
    courier:   { name: 'Courier New', stack: '"Courier New", Courier, monospace' }
  };

  // Preview-only look. Not part of the config: it changes nothing in the script.
  var look = { scheme: 'vscode-dark', font: 'system', size: 12 };

  var ANSI_INDEX = { black: 0, red: 1, green: 2, yellow: 3, blue: 4, magenta: 5, cyan: 6, white: 7 };

  // A ramp is ten colours, one per 10% of the value: 0-9, 10-19, … 90-100.
  var RAMP_BANDS = 10;
  var RAMP_PRESETS = {
    'green to red':   ['green', 'green', 'green', 'green', 'green', 'yellow', 'yellow', 'red', 'red', 'red'],
    'cool to warm':   ['blue', 'blue', 'cyan', 'cyan', 'green', 'green', 'yellow', 'yellow', 'red', 'red'],
    'quiet until 70': ['dim', 'dim', 'dim', 'dim', 'dim', 'dim', 'dim', 'yellow', 'red', 'bold-red'],
    'ten steps':      ['blue', 'bold-blue', 'cyan', 'bold-cyan', 'green', 'bold-green',
                       'yellow', 'bold-yellow', 'red', 'bold-red']
  };
  function defaultRamp() { return RAMP_PRESETS['green to red'].slice(); }
  function rampOf(cell) {
    if (!cell.r) return defaultRamp();
    var list = String(cell.r).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    while (list.length < RAMP_BANDS) list.push(list[list.length - 1] || 'default');
    return list.slice(0, RAMP_BANDS);
  }
  function bandFor(pctv) {
    var n = Math.floor(Number(pctv) || 0);
    if (n > 100) n = 100;
    if (n < 0) n = 0;
    return Math.min(RAMP_BANDS - 1, Math.floor(n * RAMP_BANDS / 100));
  }
  function rampColour(cell, pctv) { return swatchHex(rampOf(cell)[bandFor(pctv)]); }

  function scheme() { return SCHEMES[look.scheme] || SCHEMES['vscode-dark']; }

  function swatchHex(c) {
    if (c === 'heat') return null;
    var s = scheme();
    var bold = c.indexOf('bold-') === 0, base = bold ? c.slice(5) : c;
    if (base === 'default') return bold ? s.b[7] : s.fg;
    if (base === 'dim') return s.fg;          // ANSI 2 dims the current colour
    if (base === 'grey') return s.b[0];       // 256-colour 244, closest to bright black
    var i = ANSI_INDEX[base];
    if (i === undefined) return s.fg;
    return (bold ? s.b : s.n)[i];
  }
  function heatColour(p) {
    var n = Math.floor(Number(p) || 0), s = scheme();
    return n >= 80 ? s.n[1] : n >= 50 ? s.n[3] : s.n[2];
  }
  function applyLook() {
    var s = scheme(), t = document.querySelector('.termwin') || $('#term');
    t.style.setProperty('--term-bg', s.bg);
    t.style.setProperty('--term-fg', s.fg);
    t.style.setProperty('--term-caret', s.n[2]);
    t.style.setProperty('--term-accent', s.n[4]);
    t.style.setProperty('--term-dim', s.b[0]);
    t.style.setProperty('--term-font', (FONTS[look.font] || FONTS.system).stack);
    t.style.setProperty('--term-size', look.size + 'px');
    ['.termwin-body', '.termwin-bar'].forEach(function (sel) {
      var n = document.querySelector(sel);
      if (n && sel === '.termwin-body') n.style.background = s.bg;
    });
  }

  // ---------------------------------------------------------------- presets
  var PRESETS = {
    grid: {
      name: 'The grid (3 rows)',
      cfg: {
        v: 1, sep: ' | ', sepColor: 'grey', rule: true, align: true, icons: true,
        rows: [
          [{ f: 'userhost', c: 'bold-green' }, { f: 'cwd', c: 'bold-blue' }, { f: 'branch', c: 'bold-yellow' }],
          [{ f: 'tokens', c: 'bold-magenta' }, { f: 'model_ctx', c: 'bold-cyan' }, { f: 'effort', c: 'dim' }],
          [{ f: 'rl5', c: 'heat' }, { f: 'rl7', c: 'heat' }]
        ]
      }
    },
    minimal: {
      name: 'Minimal (one line)',
      cfg: {
        v: 1, sep: ' · ', sepColor: 'grey', rule: false, align: false, icons: true,
        rows: [[{ f: 'cwd', c: 'blue' }, { f: 'branch', c: 'yellow' }, { f: 'model', c: 'cyan' }, { f: 'ctx_pct', c: 'heat' }]]
      }
    },
    context: {
      name: 'Context watcher',
      cfg: {
        v: 1, sep: '  ', sepColor: 'grey', rule: false, align: true, icons: true,
        rows: [
          [{ f: 'ctx_bar', c: 'heat' }, { f: 'tokens', c: 'bold-magenta' }, { f: 'model', c: 'cyan' }],
          [{ f: 'rl5', c: 'heat' }, { f: 'rl7', c: 'heat' }, { f: 'cost', c: 'dim' }]
        ]
      }
    },
    ascii: {
      name: 'ASCII safe (Windows)',
      cfg: {
        v: 1, sep: ' | ', sepColor: 'grey', rule: true, align: true, icons: false,
        rows: [
          [{ f: 'userhost', c: 'bold-green' }, { f: 'cwd', c: 'bold-blue' }, { f: 'branch', c: 'bold-yellow' }],
          [{ f: 'tokens', c: 'bold-magenta' }, { f: 'model_ctx', c: 'bold-cyan' }],
          [{ f: 'rl5', c: 'heat' }, { f: 'rl7', c: 'heat' }]
        ]
      }
    },
    everything: {
      name: 'Everything',
      cfg: {
        v: 1, sep: ' | ', sepColor: 'grey', rule: true, align: true, icons: true,
        rows: [
          [{ f: 'userhost', c: 'bold-green' }, { f: 'cwd', c: 'bold-blue' }, { f: 'branch', c: 'bold-yellow' }, { f: 'repo', c: 'dim' }],
          [{ f: 'tokens', c: 'bold-magenta' }, { f: 'ctx_bar', c: 'heat' }, { f: 'model_ctx', c: 'bold-cyan' }, { f: 'effort', c: 'dim' }, { f: 'fast', c: 'yellow' }],
          [{ f: 'rl5', c: 'heat' }, { f: 'rl7', c: 'heat' }, { f: 'cost', c: 'dim' }, { f: 'style', c: 'dim' }, { f: 'version', c: 'dim' }]
        ]
      }
    }
  };

  // ---------------------------------------------------------- sample payloads
  var NOW = Math.floor(Date.now() / 1000);
  var SAMPLES = {
    mid: {
      label: 'mid-session',
      p: {
        session_id: 'x', version: '2.1.220', cwd: '/root/projects/claude-code-helper',
        session_name: 'helper-site',
        output_style: { name: 'Concise' },
        model: { id: 'claude-opus-5[1m]', display_name: 'Opus 5' },
        workspace: {
          current_dir: '/root/projects/claude-code-helper',
          project_dir: '/root/projects/claude-code-helper',
          repo: { host: 'github.com', owner: 'Qutaiba-Khader', name: 'claude-code-helper' }
        },
        context_window: {
          total_input_tokens: 41500, total_output_tokens: 1820,
          context_window_size: 1000000, used_percentage: 4.15, remaining_percentage: 95.85
        },
        rate_limits: {
          five_hour: { used_percentage: 11.2, resets_at: NOW + 13380 },
          seven_day: { used_percentage: 46.4, resets_at: NOW + 187200 }
        },
        cost: { total_cost_usd: 6.63 },
        effort: { level: 'high' }, thinking: { enabled: true }, fast_mode: true,
        _git_branch: 'main', _git_dirty: true, _now: NOW
      }
    },
    fresh: {
      label: 'fresh session',
      p: {
        session_id: 'x', version: '2.1.220', cwd: '/root',
        output_style: { name: 'default' },
        model: { id: 'claude-sonnet-5', display_name: 'Sonnet 5' },
        workspace: { current_dir: '/root', project_dir: '/root' },
        context_window: {
          total_input_tokens: 3200, total_output_tokens: 0,
          context_window_size: 200000, used_percentage: 1.6, remaining_percentage: 98.4
        },
        thinking: { enabled: true }, _now: NOW
      }
    },
    limits: {
      label: 'near the limits',
      p: {
        session_id: 'x', version: '2.1.220', cwd: '/root/work/big-migration',
        model: { id: 'claude-opus-5', display_name: 'Opus 5' },
        workspace: {
          current_dir: '/root/work/big-migration', project_dir: '/root/work/big-migration',
          repo: { host: 'github.com', owner: 'acme', name: 'platform' }
        },
        pr: { number: 812, url: '', review_state: 'changes_requested' },
        context_window: {
          total_input_tokens: 172000, total_output_tokens: 4100,
          context_window_size: 200000, used_percentage: 86, remaining_percentage: 14
        },
        rate_limits: {
          five_hour: { used_percentage: 92.5, resets_at: NOW + 2700 },
          seven_day: { used_percentage: 81.4, resets_at: NOW + 187200 }
        },
        cost: { total_cost_usd: 41.08 },
        effort: { level: 'max' }, thinking: { enabled: false }, fast_mode: false,
        _git_branch: 'feat/migrate-billing', _git_dirty: true, _now: NOW
      }
    },
    bare: {
      label: 'no subscription data',
      p: {
        session_id: 'x', version: '2.1.220', cwd: '/home/dev/app',
        model: { id: 'claude-sonnet-5', display_name: 'Sonnet 5' },
        workspace: { current_dir: '/home/dev/app', project_dir: '/home/dev/app' },
        context_window: {
          total_input_tokens: 88000, total_output_tokens: 900,
          context_window_size: 200000, used_percentage: 44, remaining_percentage: 56
        },
        thinking: { enabled: true }, _git_branch: 'develop', _git_dirty: false, _now: NOW
      }
    }
  };

  // ------------------------------------------------------------------- state
  var DEFAULTS = {
    v: 1, sep: ' | ', sepColor: 'grey', rule: true, align: true, icons: true,
    fit: false, links: false, divider: true,
    // set once you touch a divider control; presets stop overriding it after that
    dividerSet: false,
    // settings.json options — the script ignores these, the installer applies them
    st: { padding: 0, refresh: 0, hideVim: false }
  };
  var state = Object.assign(clone(DEFAULTS), clone(PRESETS.grid.cfg));
  var selected = null;      // {r, c}
  var template = null;      // statusline.sh source, fetched once
  var tab = 'prompt';

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---------------------------------------------------------------- encoding
  function b64encode(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64decode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function configJSON() {
    // Compact and key-ordered so the same layout always produces the same string.
    return JSON.stringify({
      v: 1, sep: state.sep, sepColor: state.sepColor,
      rule: !!state.rule, align: !!state.align, icons: !!state.icons,
      fit: !!state.fit, links: !!state.links, divider: !!state.divider,
      dividerSet: !!state.dividerSet,
      st: {
        padding: Number(state.st.padding) || 0,
        refresh: Number(state.st.refresh) || 0,
        hideVim: !!state.st.hideVim
      },
      rows: state.rows.map(function (row) {
        return row.map(function (cell) {
          var o = { f: cell.f, c: cell.c || 'default' };
          if (cell.f === 'text') o.t = cell.t || '';
          if (cell.i === false) o.i = false;
          if (cell.c === 'ramp') o.r = rampOf(cell).join(',');
          return o;
        });
      })
    });
  }

  // ------------------------------------------------------------ persistence
  var LS = 'cch-statusline';
  var LS_LOOK = 'cch-statusline-look';
  function save() {
    try { localStorage.setItem(LS, configJSON()); } catch (e) { /* ignore */ }
    history.replaceState(null, '', '#c=' + b64encode(configJSON()));
  }
  function saveLook() {
    try { localStorage.setItem(LS_LOOK, JSON.stringify(look)); } catch (e) { /* ignore */ }
  }
  function loadLook() {
    try {
      var raw = localStorage.getItem(LS_LOOK);
      if (raw) look = Object.assign(look, JSON.parse(raw));
    } catch (e) { /* keep the defaults */ }
    if (!SCHEMES[look.scheme]) look.scheme = 'vscode-dark';
    if (!FONTS[look.font]) look.font = 'system';
    look.size = Math.min(20, Math.max(9, Number(look.size) || 12));
  }
  function load() {
    var hash = location.hash.match(/[#&]c=([A-Za-z0-9_-]+)/);
    var raw = null;
    if (hash) { try { raw = b64decode(hash[1]); } catch (e) { raw = null; } }
    if (!raw) { try { raw = localStorage.getItem(LS); } catch (e) { raw = null; } }
    if (!raw) return;
    try {
      var cfg = JSON.parse(raw);
      if (cfg && Array.isArray(cfg.rows)) {
        cfg.rows = cfg.rows.map(function (r) {
          return (Array.isArray(r) ? r : []).filter(function (c) { return c && FIELD[c.f]; });
        });
        state = Object.assign(clone(DEFAULTS), cfg);
        state.st = Object.assign(clone(DEFAULTS.st), cfg.st || {});
      }
    } catch (e) { /* keep the default */ }
  }

  // -------------------------------------------------------------- palette UI
  // Glyphs worth having to hand. They go in as custom-text cells, so they can
  // be coloured and moved like any other field.
  var SYMBOLS = [
    { g: '↻', n: 'reset / refresh' }, { g: '⎇', n: 'branch' },
    { g: '⚡', n: 'fast' },           { g: '⏱', n: 'time' },
    { g: '●', n: 'dot filled' },      { g: '○', n: 'dot hollow' },
    { g: '◆', n: 'diamond' },         { g: '▸', n: 'arrow right' },
    { g: '→', n: 'to' },              { g: '↑', n: 'up' },
    { g: '↓', n: 'down' },            { g: '✓', n: 'ok' },
    { g: '✗', n: 'fail' },            { g: '★', n: 'star' },
    { g: '⚙', n: 'settings' },        { g: '⌁', n: 'power' },
    { g: '│', n: 'bar' },             { g: '·', n: 'middot' },
    { g: '/', n: 'slash' },           { g: '—', n: 'dash' },
    { g: '▰', n: 'bar full' },        { g: '▱', n: 'bar empty' }
  ];

  function renderPalette() {
    var host = $('#palette');
    var q = ($('#filter').value || '').trim().toLowerCase();
    var p = currentSample();
    var groups = {};

    FIELDS.forEach(function (f) {
      if (q && (f.label + ' ' + f.id + ' ' + (f.hint || '')).toLowerCase().indexOf(q) < 0) return;
      (groups[f.group] = groups[f.group] || []).push(f);
    });

    host.textContent = '';
    Object.keys(groups).forEach(function (g) {
      var box = document.createElement('div');
      box.className = 'pgroup';
      var h = document.createElement('h4');
      h.textContent = g;
      box.appendChild(h);

      groups[g].forEach(function (f) {
        var b = document.createElement('button');
        b.className = 'pfield';
        b.type = 'button';
        b.dataset.field = f.id;
        b.title = f.hint || '';

        var label = document.createElement('span');
        label.className = 'pl';
        label.textContent = f.label;
        b.appendChild(label);

        // what this field would print, with the sample data currently selected
        var sample = document.createElement('span');
        sample.className = 'ps';
        var text = '';
        try { text = f.preview(p, { icons: !!state.icons }, { t: 'text' }) || ''; }
        catch (e) { text = ''; }
        if (text) {
          sample.textContent = text;
        } else {
          sample.textContent = f.custom ? 'your own text' : 'nothing in this session';
          sample.classList.add('is-off');
        }
        b.appendChild(sample);
        box.appendChild(b);
      });
      host.appendChild(box);
    });

    // symbols, filtered by the same search box
    var syms = SYMBOLS.filter(function (s2) {
      return !q || s2.n.indexOf(q) >= 0 || s2.g === q || 'symbol glyph icon'.indexOf(q) >= 0;
    });
    if (syms.length) {
      var sbox = document.createElement('div');
      sbox.className = 'pgroup';
      var sh = document.createElement('h4');
      sh.textContent = 'Symbols';
      sbox.appendChild(sh);
      var grid = document.createElement('div');
      grid.className = 'symgrid';
      syms.forEach(function (s2) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sym';
        b.textContent = s2.g;
        b.title = s2.n + ' — adds it as text you can colour and move';
        b.dataset.symbol = s2.g;
        grid.appendChild(b);
      });
      sbox.appendChild(grid);
      host.appendChild(sbox);
    }

    if (!host.children.length) host.innerHTML = '<p class="hint">No field matches that.</p>';
  }

  // ---------------------------------------------------------------- rows UI
  function renderRows() {
    var host = $('#rows');
    host.textContent = '';

    state.rows.forEach(function (row, r) {
      var el = document.createElement('div');
      el.className = 'row';
      el.dataset.row = r;

      var lab = document.createElement('span');
      lab.className = 'rlabel';
      lab.textContent = r + 1;

      var chips = document.createElement('div');
      chips.className = 'chips';
      chips.dataset.row = r;

      if (!row.length) {
        var ph = document.createElement('span');
        ph.className = 'row-empty';
        ph.textContent = 'drop a field here';
        chips.appendChild(ph);
      }
      row.forEach(function (cell, c) { chips.appendChild(makeChip(cell, r, c)); });

      var tools = document.createElement('div');
      tools.className = 'rtools';
      tools.appendChild(iconBtn('↑', 'Move row up', function () { moveRow(r, -1); }));
      tools.appendChild(iconBtn('↓', 'Move row down', function () { moveRow(r, 1); }));
      tools.appendChild(iconBtn('✕', 'Delete row', function () { removeRow(r); }));

      el.append(lab, chips, tools);
      host.appendChild(el);
    });

    host.appendChild(inspector());
  }

  function iconBtn(glyph, title, fn) {
    var b = document.createElement('button');
    b.className = 'btn btn-ghost btn-sm';
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.textContent = glyph;
    b.addEventListener('click', fn);
    return b;
  }

  function makeChip(cell, r, c) {
    var f = FIELD[cell.f];
    var el = document.createElement('div');
    el.className = 'chip';
    el.dataset.row = r;
    el.dataset.col = c;
    el.tabIndex = 0;
    if (selected && selected.r === r && selected.c === c) el.classList.add('is-selected');

    var text = previewCell(cell, currentSample());
    if (!text) el.classList.add('is-empty');
    el.title = (f.hint || '') + (text ? '' : ' — nothing to show with this sample data');

    var grip = document.createElement('span');
    grip.className = 'grip';
    grip.textContent = '⠿';

    var sw = document.createElement('span');
    sw.className = 'swatch';
    if (cell.c === 'heat') {
      sw.style.background = 'linear-gradient(135deg,#6cc17f 0 33%,#d9b25a 33% 66%,#e0685f 66%)';
    } else if (cell.c === 'ramp') {
      sw.style.background = 'linear-gradient(90deg,' + rampOf(cell).map(function (c, i) {
        return swatchHex(c) + ' ' + (i * 10) + '% ' + ((i + 1) * 10) + '%';
      }).join(',') + ')';
    } else {
      sw.style.background = swatchHex(cell.c || 'default');
    }

    var name = document.createElement('span');
    name.className = 'name';
    name.textContent = cell.f === 'text' ? (cell.t ? '"' + cell.t + '"' : 'text') : f.label;
    if (cell.i === false) {
      var bare = document.createElement('span');
      bare.className = 'bare';
      bare.textContent = 'bare';
      bare.title = 'the ' + f.icon + ' label is turned off';
      el.appendChild(bare);
    }

    var x = document.createElement('button');
    x.className = 'x';
    x.type = 'button';
    x.title = 'Remove';
    x.setAttribute('aria-label', 'Remove ' + f.label);
    x.textContent = '×';
    x.addEventListener('click', function (e) { e.stopPropagation(); removeCell(r, c); });

    el.append(grip, sw, name, x);
    el.addEventListener('click', function () {
      selected = { r: r, c: c };
      renderRows();
      renderPreview();
      highlight(r, c);
    });
    el.addEventListener('mouseenter', function () { highlight(r, c); });
    el.addEventListener('mouseleave', clearHighlight);
    el.addEventListener('focus', function () { highlight(r, c); });
    el.addEventListener('blur', clearHighlight);
    return el;
  }

  function clearHighlight() {
    var prev = document.querySelector('.term .is-target');
    if (prev) prev.classList.remove('is-target');
  }
  function highlight(r, c) {
    clearHighlight();
    var node = document.querySelector('.term [data-r="' + r + '"][data-c="' + c + '"]');
    if (node) node.classList.add('is-target');
  }

  // ------------------------------------------------------------- inspector
  function inspector() {
    var box = document.createElement('div');
    box.className = 'inspector';
    if (!selected || !state.rows[selected.r] || !state.rows[selected.r][selected.c]) {
      box.hidden = true;
      return box;
    }
    var cell = state.rows[selected.r][selected.c];
    var f = FIELD[cell.f];

    var head = document.createElement('div');
    head.className = 'ihead';
    var strong = document.createElement('strong');
    strong.textContent = f.label;
    var hint = document.createElement('span');
    hint.className = 'note';
    hint.style.margin = '0';
    hint.textContent = f.hint || '';
    var spacer = document.createElement('span');
    spacer.className = 'spacer';
    var close = iconBtn('✕', 'Close', function () { selected = null; renderRows(); });
    head.append(strong, hint, spacer, close);

    var swWrap = document.createElement('div');
    var swLabel = document.createElement('label');
    swLabel.className = 'field';
    swLabel.textContent = 'Colour';
    var sws = document.createElement('div');
    sws.className = 'swatches';

    var choices = COLOURS.slice();
    COLOURS.forEach(function (c) { if (c !== 'default' && c !== 'dim') choices.push('bold-' + c); });
    if (f.heat) { choices.unshift('heat'); choices.unshift('ramp'); }

    choices.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sw' + (c === 'heat' ? ' heat' : '') + (c === 'ramp' ? ' ramp' : '') +
                    ((cell.c || 'default') === c ? ' is-on' : '');
      b.dataset.c = c;
      b.title = c === 'heat' ? 'auto: green / yellow / red by usage'
              : c === 'ramp' ? 'colour by value, in ten bands you choose'
              : c;
      if (c === 'ramp') {
        b.style.background = 'linear-gradient(90deg,' + rampOf(cell).map(function (rc, i) {
          return swatchHex(rc) + ' ' + (i * 10) + '% ' + ((i + 1) * 10) + '%';
        }).join(',') + ')';
      }
      if (c !== 'heat' && c !== 'ramp') {
        b.style.background = swatchHex(c);
        if (c.indexOf('bold-') === 0) b.textContent = 'B';
        b.style.color = '#10131a';
        b.style.fontSize = '.625rem';
        b.style.fontWeight = '700';
      }
      b.addEventListener('click', function () {
        cell.c = c;
        if (c === 'ramp' && !cell.r) cell.r = defaultRamp().join(',');
        if (c === 'ramp') activeBand = 0;
        commit();
      });
      sws.appendChild(b);
    });
    swWrap.append(swLabel, sws);

    box.append(head, swWrap);

    if (cell.c === 'ramp') box.appendChild(rampEditor(cell, f));

    if (f.icon) {
      var ir = document.createElement('div');
      ir.className = 'irow';
      var lab = document.createElement('label');
      lab.className = 'check';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = cell.i !== false;
      cb.addEventListener('change', function () {
        if (cb.checked) delete cell.i; else cell.i = false;
        commit();
      });
      lab.append(cb, document.createTextNode('Show the "' + f.icon + '" label'));
      var note = document.createElement('p');
      note.className = 'hint';
      note.style.margin = '0';
      note.textContent = 'Off gives you the bare value, so you can put your own symbol beside it.';
      var wrap = document.createElement('div');
      wrap.append(lab, note);
      ir.appendChild(wrap);
      box.appendChild(ir);
    }

    if (f.custom) {
      var row = document.createElement('div');
      row.className = 'irow';
      var d = document.createElement('div');
      var l = document.createElement('label');
      l.className = 'field';
      l.setAttribute('for', 'customText');
      l.textContent = 'Text';
      var i = document.createElement('input');
      i.type = 'text';
      i.id = 'customText';
      i.value = cell.t || '';
      i.spellcheck = false;
      i.addEventListener('input', function () { cell.t = i.value; save(); update(); });
      d.append(l, i);
      row.appendChild(d);
      box.appendChild(row);
    }
    return box;
  }

  var activeBand = 0;

  // Ten bands, each with its own colour. Pick a band, then pick its colour.
  function rampEditor(cell, f) {
    var list = rampOf(cell);
    var box = document.createElement('div');
    box.className = 'ramp-editor';

    var head = document.createElement('div');
    head.className = 'ramp-head';
    var t = document.createElement('span');
    t.className = 'ramp-title';
    t.textContent = 'Colour by value';
    var now = document.createElement('span');
    now.className = 'hint';
    now.style.margin = '0';
    var current = f.pct ? Math.floor(Number(f.pct(currentSample())) || 0) : 0;
    now.textContent = 'this session sits at ' + current + '%, in the ' +
                      (bandFor(current) * 10) + '–' + (bandFor(current) * 10 + 10) + '% band';
    head.append(t, now);

    var strip = document.createElement('div');
    strip.className = 'ramp-strip';
    list.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'band' + (i === activeBand ? ' is-active' : '') +
                    (i === bandFor(current) ? ' is-live' : '');
      b.style.background = swatchHex(c);
      b.title = (i * 10) + '–' + (i * 10 + 10) + '% · ' + c;
      var lab = document.createElement('span');
      lab.textContent = i * 10;
      b.appendChild(lab);
      b.addEventListener('click', function () { activeBand = i; renderRows(); });
      strip.appendChild(b);
    });

    var pick = document.createElement('div');
    pick.className = 'ramp-pick';
    var pl = document.createElement('label');
    pl.className = 'field';
    pl.textContent = 'Colour for ' + (activeBand * 10) + '–' + (activeBand * 10 + 10) + '%';
    var sws = document.createElement('div');
    sws.className = 'swatches';
    var opts = COLOURS.slice();
    COLOURS.forEach(function (c) { if (c !== 'default' && c !== 'dim') opts.push('bold-' + c); });
    opts.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sw' + (list[activeBand] === c ? ' is-on' : '');
      b.dataset.c = c;
      b.title = c;
      b.style.background = swatchHex(c);
      if (c.indexOf('bold-') === 0) { b.textContent = 'B'; b.style.color = '#10131a'; }
      b.addEventListener('click', function () {
        var next = rampOf(cell);
        next[activeBand] = c;
        cell.r = next.join(',');
        commit();
      });
      sws.appendChild(b);
    });
    pick.append(pl, sws);

    var pres = document.createElement('div');
    pres.className = 'ramp-presets';
    Object.keys(RAMP_PRESETS).forEach(function (name) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-sm';
      b.textContent = name;
      b.addEventListener('click', function () {
        cell.r = RAMP_PRESETS[name].slice().join(',');
        commit();
      });
      pres.appendChild(b);
    });

    var fill = document.createElement('button');
    fill.type = 'button';
    fill.className = 'btn btn-sm';
    fill.textContent = 'fill from here';
    fill.title = 'Copy this band\'s colour to every band above it';
    fill.addEventListener('click', function () {
      var next = rampOf(cell);
      for (var i = activeBand; i < RAMP_BANDS; i++) next[i] = next[activeBand];
      cell.r = next.join(',');
      commit();
    });
    pres.appendChild(fill);

    box.append(head, strip, pick, pres);
    return box;
  }

  // ------------------------------------------------------------ mutations
  function commit() { save(); renderRows(); update(); }
  function addCell(fieldId, r, at) {
    if (!state.rows.length) state.rows.push([]);
    if (r === undefined || r === null || !state.rows[r]) r = state.rows.length - 1;
    var cell = { f: fieldId, c: defaultColour(fieldId) };
    if (cell.c === 'ramp') cell.r = defaultRamp().join(',');
    if (fieldId === 'text') cell.t = 'label';
    var idx = (at === undefined || at === null) ? state.rows[r].length : at;
    state.rows[r].splice(idx, 0, cell);
    selected = { r: r, c: idx };
    commit();
  }
  function defaultColour(id) {
    if (FIELD[id] && FIELD[id].heat) return 'heat';
    return ({
      userhost: 'bold-green', user: 'bold-green', host: 'bold-green',
      cwd: 'bold-blue', cwd_base: 'bold-blue', project: 'bold-blue',
      branch: 'bold-yellow', repo: 'dim', pr: 'yellow', worktree: 'yellow',
      model: 'bold-cyan', model_ctx: 'bold-cyan'
    })[id] || 'dim';
  }
  function removeCell(r, c) {
    if (!state.rows[r]) return;
    state.rows[r].splice(c, 1);
    selected = null;
    commit();
  }
  function moveCell(from, to) {
    var cell = state.rows[from.r][from.c];
    state.rows[from.r].splice(from.c, 1);
    var idx = to.c;
    if (from.r === to.r && from.c < to.c) idx--;
    idx = Math.max(0, Math.min(idx, state.rows[to.r].length));
    state.rows[to.r].splice(idx, 0, cell);
    selected = { r: to.r, c: idx };
    commit();
  }
  function moveRow(r, dir) {
    var t = r + dir;
    if (t < 0 || t >= state.rows.length) return;
    var tmp = state.rows[r];
    state.rows[r] = state.rows[t];
    state.rows[t] = tmp;
    selected = null;
    commit();
  }
  function removeRow(r) {
    state.rows.splice(r, 1);
    if (!state.rows.length) state.rows.push([]);
    selected = null;
    commit();
  }

  // ------------------------------------------------------------------ drag
  // Pointer-based so it works with a mouse and with touch. A chip drag moves an
  // existing cell; a palette drag inserts a new one.
  var drag = null;

  document.addEventListener('pointerdown', function (e) {
    var chip = e.target.closest('.chip');
    var pf = e.target.closest('.pfield');
    if (e.target.closest('.x') || e.button === 1 || e.button === 2) return;
    if (!chip && !pf) return;

    drag = {
      startX: e.clientX, startY: e.clientY, active: false,
      source: chip ? { r: +chip.dataset.row, c: +chip.dataset.col } : null,
      field: pf ? pf.dataset.field : null,
      el: chip || pf, ghost: null, target: null
    };
  });

  document.addEventListener('pointermove', function (e) {
    if (!drag) return;
    if (!drag.active) {
      if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) < 5) return;
      drag.active = true;
      drag.ghost = drag.el.cloneNode(true);
      drag.ghost.className = 'chip chip-ghost';
      document.body.appendChild(drag.ghost);
      if (drag.source) drag.el.classList.add('is-dragging');
      document.body.style.userSelect = 'none';
    }
    drag.ghost.style.left = e.clientX + 'px';
    drag.ghost.style.top = e.clientY + 'px';

    document.querySelectorAll('.row.drop-target').forEach(function (n) { n.classList.remove('drop-target'); });
    var t = dropTarget(e.clientX, e.clientY);
    drag.target = t;
    if (t) {
      var rowEl = document.querySelector('.row[data-row="' + t.r + '"]');
      if (rowEl) rowEl.classList.add('drop-target');
    }
  });

  document.addEventListener('pointerup', function () {
    if (!drag) return;
    var d = drag;
    drag = null;
    document.body.style.userSelect = '';
    if (d.ghost) d.ghost.remove();
    document.querySelectorAll('.row.drop-target').forEach(function (n) { n.classList.remove('drop-target'); });
    if (d.el) d.el.classList.remove('is-dragging');

    if (!d.active) {                      // a click, not a drag
      if (d.field) addCell(d.field, null, null);
      return;
    }
    if (!d.target) { renderRows(); return; }
    if (d.field) addCell(d.field, d.target.r, d.target.c);
    else moveCell(d.source, d.target);
  });

  // Which row, and where in it, is the pointer over?
  function dropTarget(x, y) {
    var rows = Array.prototype.slice.call(document.querySelectorAll('.row'));
    if (!rows.length) return null;

    var hit = null;
    rows.forEach(function (row) {
      var b = row.getBoundingClientRect();
      if (y >= b.top && y <= b.bottom) hit = row;
    });
    if (!hit) {                            // above the first / below the last
      var first = rows[0].getBoundingClientRect();
      var last = rows[rows.length - 1].getBoundingClientRect();
      if (y < first.top) hit = rows[0];
      else if (y > last.bottom) hit = rows[rows.length - 1];
      else return null;
    }

    var r = +hit.dataset.row;
    var chips = Array.prototype.slice.call(hit.querySelectorAll('.chip'));
    var idx = chips.length;
    for (var i = 0; i < chips.length; i++) {
      var b = chips[i].getBoundingClientRect();
      if (x < b.left + b.width / 2) { idx = i; break; }
    }
    return { r: r, c: idx };
  }

  // Keyboard: move a focused chip with the arrow keys, delete with Backspace.
  document.addEventListener('keydown', function (e) {
    var chip = document.activeElement && document.activeElement.closest
      ? document.activeElement.closest('.chip') : null;
    if (!chip) return;
    var r = +chip.dataset.row, c = +chip.dataset.col, handled = true;
    if (e.key === 'ArrowLeft' && c > 0) moveCell({ r: r, c: c }, { r: r, c: c - 1 });
    else if (e.key === 'ArrowRight' && c < state.rows[r].length - 1) moveCell({ r: r, c: c }, { r: r, c: c + 2 });
    else if (e.key === 'ArrowUp' && r > 0) moveCell({ r: r, c: c }, { r: r - 1, c: state.rows[r - 1].length });
    else if (e.key === 'ArrowDown' && r < state.rows.length - 1) moveCell({ r: r, c: c }, { r: r + 1, c: state.rows[r + 1].length });
    else if (e.key === 'Backspace' || e.key === 'Delete') removeCell(r, c);
    else handled = false;
    if (handled) e.preventDefault();
  });

  // ---------------------------------------------------------------- preview
  function currentSample() { return SAMPLES[$('#sample').value].p; }

  function previewCell(cell, p) {
    var f = FIELD[cell.f];
    if (!f) return '';
    try { return f.preview(p, { icons: !!state.icons }, cell) || ''; }
    catch (e) { return ''; }
  }

  // Reproduce what Claude Code actually prints: the startup banner, the input
  // area framed by two rules, then the status line row, then the footer badges.
  function renderChrome() {
    var p = currentSample();
    var cols = termCols();

    var banner = $('#termBanner');
    if (banner) {
      var model = (p.model && p.model.display_name) || 'Opus 5';
      var id = (p.model && p.model.id) || '';
      if ((id.indexOf('[1m]') >= 0 || /-1m/.test(id)) && model.indexOf('1M') < 0) {
        model += ' (1M context)';
      }
      var effort = p.effort && p.effort.level;
      var dir = (p.workspace && p.workspace.current_dir) || p.cwd || '';

      banner.textContent = '';
      [['Claude Code v' + (p.version || '2.1.220'), 'v'],
       [model + (effort ? ' with ' + effort + ' effort' : ''), 'm'],
       [p.rate_limits ? 'Claude Max' : 'Claude Pro', 'p'],
       [dir, 'd']
      ].forEach(function (row) {
        banner.appendChild(el('span', 'tsl bi ' + row[1], row[0]));
      });
    }

    var rule = '\u2500'.repeat(Math.max(8, cols));
    var r1 = $('#termRule1'), r2 = $('#termRule2');
    if (r1) r1.textContent = rule;
    if (r2) r2.textContent = rule;

    // ⏵⏵ accept edits on (shift+tab to cycle) · ← for agents
    var badges = $('#termBadges');
    if (badges) {
      badges.textContent = '';
      var line = document.createElement('span');
      line.className = 'bline';
      line.append(
        el('b', 'mode', '\u23F5\u23F5 accept edits on'),
        el('span', 'muted', ' (shift+tab to cycle) \u00B7 \u2190 for agents')
      );
      var rc = document.createElement('span');
      rc.className = 'bline rc';
      rc.textContent = '/rc';
      badges.append(line, rc);
    }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function renderPreview() {
    var p = currentSample();
    var term = $('#term');
    var title = $('#termTitle');
    if (title) {
      var d = (p.workspace && p.workspace.current_dir) || p.cwd || '';
      title.textContent = 'claude — ' + (d.split('/').pop() || d);
    }
    term.textContent = '';

    // build the text grid exactly the way statusline.sh does
    var grid = state.rows.map(function (row) {
      return row.map(function (cell) { return { text: previewCell(cell, p), cell: cell }; });
    });
    var last = grid.map(function (row) {
      var l = -1;
      row.forEach(function (c, i) { if (c.text) l = i; });
      return l;
    });
    var ncols = grid.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var widths = [];
    for (var c = 0; c < ncols; c++) {
      var w = 0;
      grid.forEach(function (row, r) {
        if (last[r] < 0) return;
        if (row[c] && row[c].text.length > w) w = row[c].text.length;
      });
      widths.push(state.align ? w : 0);
    }

    var lines = [];
    grid.forEach(function (row, r) {
      if (last[r] < 0) return;
      var frag = document.createDocumentFragment();
      var width = 0;
      for (var c = 0; c <= last[r]; c++) {
        if (c > 0) {
          if (state.divider) {
            frag.appendChild(span(state.sep, state.sepColor, p));
            width += state.sep.length;
          } else {
            frag.appendChild(document.createTextNode(' '));
            width += 1;
          }
        }
        var item = row[c] || { text: '', cell: { c: 'default' } };
        if (item.text) {
          var node = span(item.text, item.cell.c, p, item.cell.f, item.cell);
          node.dataset.r = r;
          node.dataset.c = c;
          frag.appendChild(node);
        }
        width += item.text.length;
        if (c < last[r] && widths[c] > item.text.length) {
          frag.appendChild(document.createTextNode(' '.repeat(widths[c] - item.text.length)));
          width += widths[c] - item.text.length;
        }
      }
      lines.push({ frag: frag, width: width });
    });

    if (!lines.length) {
      var e = document.createElement('span');
      e.className = 'empty';
      e.textContent = 'Nothing to show — add a field, or pick different sample data.';
      term.appendChild(e);
      warn();
      renderChrome();
      return;
    }

    lines.forEach(function (l, i) {
      if (i) term.appendChild(document.createTextNode('\n'));
      term.appendChild(l.frag);
    });

    if (state.rule) {
      var wide = lines.reduce(function (m, l) { return Math.max(m, l.width); }, 0);
      if (state.fit) wide = Math.max(wide, termCols());
      term.appendChild(document.createTextNode('\n'));
      term.appendChild(span((state.icons ? '─' : '-').repeat(wide), state.sepColor, p));
    }
    warn();
    renderChrome();
  }

  // Roughly how many columns the preview box is showing, for the `fit` option.
  function termCols() {
    var t = $('#term');
    var probe = document.createElement('span');
    probe.textContent = '0'.repeat(100);
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
    t.appendChild(probe);
    var w = probe.getBoundingClientRect().width / 100;
    probe.remove();
    var inner = t.clientWidth - 32;
    return w > 0 ? Math.max(20, Math.floor(inner / w)) : 80;
  }

  function span(text, colour, p, fieldId, cell) {
    var s = document.createElement('span');
    s.textContent = text;
    if (state.links && (fieldId === 'pr')) {
      s.style.textDecoration = 'underline';
      s.title = 'rendered as a clickable OSC 8 link';
    }
    colour = colour || 'default';
    if (colour === 'heat') {
      var f = FIELD[fieldId];
      s.style.color = heatColour(f && f.pct ? f.pct(p) : 0);
    } else if (colour === 'ramp') {
      var f2 = FIELD[fieldId];
      s.style.color = rampColour(cell || {}, f2 && f2.pct ? f2.pct(p) : 0);
    } else {
      var bold = colour.indexOf('bold-') === 0;
      s.style.color = swatchHex(colour);
      if (bold) s.style.fontWeight = '700';
      if (colour === 'dim') s.style.opacity = '.75';
    }
    return s;
  }

  function warn() {
    var host = $('#warn');
    host.textContent = '';
    var msgs = [];

    if (!state.rows.some(function (r) { return r.length; })) {
      msgs.push(['The layout is empty.', true]);
    }
    if (usesField('rl5') || usesField('rl7') || usesField('rl5_bare') || usesField('rl7_bare')) {
      msgs.push(['Rate-limit fields need a Claude subscription and only appear after the first response of a session.', false]);
    }
    if (usesTimeField() && !state.st.refresh) {
      msgs.push(['This layout has time-based fields but no refresh interval — clocks and countdowns will sit still between messages. Set Refresh to 30–60s.', true]);
    }
    if (usesField('vim') && !state.st.hideVim) {
      msgs.push(['You are drawing vim.mode yourself — tick "Hide built-in vim indicator" so it is not shown twice.', true]);
    }
    if (state.links && !usesField('pr')) {
      msgs.push(['Clickable links only affect the PR field right now, and need a terminal with OSC 8 support (iTerm2, Kitty, WezTerm).', false]);
    }
    if (state.icons) {
      msgs.push(['Unicode icons are on. If your terminal draws them double-width, turn them off for ASCII.', false]);
    }
    if (state.rows.length > 3) {
      msgs.push(['More than three rows takes a lot of terminal height, and multi-line output with escape codes is more prone to render glitches.', false]);
    }
    if (usesField('branch')) {
      msgs.push(['The branch field shells out to git on every update. It uses --no-optional-locks, but on a very large repo consider caching it.', false]);
    }

    if (!msgs.length) return;
    var ul = document.createElement('ul');
    ul.className = 'warn-list';
    msgs.forEach(function (m) {
      var li = document.createElement('li');
      li.textContent = m[0];
      if (m[1]) li.className = 'hot';
      ul.appendChild(li);
    });
    host.appendChild(ul);
  }

  // ----------------------------------------------------------------- output
  function baseURL() {
    var u = location.origin + location.pathname;
    return u.replace(/tools\/statusline\/.*$/, '');
  }

  // The statusLine block exactly as it should appear in settings.json.
  function settingsBlock(cmd) {
    var o = { type: 'command', command: cmd };
    if (state.st.padding) o.padding = Number(state.st.padding);
    if (state.st.refresh) o.refreshInterval = Number(state.st.refresh);
    if (state.st.hideVim) o.hideVimModeIndicator = true;
    return JSON.stringify({ statusLine: o }, null, 2)
      .split('\n').map(function (l) { return '   ' + l; }).join('\n').trim();
  }

  // Fields whose value changes on the clock rather than on a session event.
  var TIME_FIELDS = ['time', 'date', 'duration', 'api_duration', 'rl5', 'rl7'];
  function usesTimeField() {
    return state.rows.some(function (r) {
      return r.some(function (c) { return TIME_FIELDS.indexOf(c.f) >= 0; });
    });
  }
  function usesField(id) {
    return state.rows.some(function (r) {
      return r.some(function (c) { return c.f === id; });
    });
  }

  function buildScript() {
    if (!template) return '# Could not load statusline.sh — reload the page, or grab it from GitHub.';
    return template.replace(/^CONFIG='.*'$/m, "CONFIG='" + configJSON() + "'");
  }

  function buildPrompt() {
    return [
      'Set up my Claude Code status line exactly as specified below. Do all of it yourself —',
      'do not delegate to the statusline-setup agent, and do not ask me questions first.',
      '',
      '1. Write the script at the end of this message verbatim to ~/.claude/statusline-command.sh',
      '   and chmod +x it. It needs `jq` on PATH (and `git`, for the branch field).',
      '',
      '2. Merge this into ~/.claude/settings.json, preserving every existing setting:',
      '',
      '   ' + settingsBlock('bash ~/.claude/statusline-command.sh'),
      '',
      '   If ~/.claude/settings.json is a symlink, edit the file it points at.',
      '   Use an absolute path if ~ is not expanded in your setup.',
      '',
      '3. Verify it by piping a sample payload through the script:',
      '',
      '   echo \'{"cwd":"/tmp","model":{"id":"claude-opus-5[1m]","display_name":"Opus 5"},' +
        '"context_window":{"total_input_tokens":41500,"context_window_size":1000000,"used_percentage":4.2}}\' \\',
      '     | bash ~/.claude/statusline-command.sh',
      '',
      'Notes, so you do not have to rediscover them:',
      ' - Multi-line output is supported — each line becomes its own row in the status area.',
      ' - Font size cannot be set from a status line; that belongs to the terminal emulator.',
      ' - `workspace.repo` has host/owner/name but no branch — the branch has to come from git.',
      ' - The script parses its jq output with IFS=$\'\\037\'. A whitespace IFS silently collapses',
      '   empty fields and shifts every later value into the wrong variable.',
      ' - Claude Code debounces status line updates at 300ms and cancels a script that is still',
      '   running when the next update fires, so keep it fast.',
      ' - `tput cols` cannot see the terminal from inside the script; read $COLUMNS instead.',
      ' - The status line needs the workspace trust dialog accepted, and is disabled entirely',
      '   if `disableAllHooks` is true.',
      ' - The layout lives in the CONFIG line at the top. Rebuild it any time at',
      '   ' + baseURL() + 'tools/statusline/',
      '',
      '--- ~/.claude/statusline-command.sh ---',
      '',
      buildScript()
    ].join('\n');
  }

  function buildInstall() {
    return 'curl -fsSL ' + baseURL() + 'tools/statusline/install.sh | bash -s -- ' + b64encode(configJSON());
  }

  var HELP = {
    prompt: 'Paste this into any Claude Code session. It writes the script and patches settings.json for you.',
    script: 'Save this as ~/.claude/statusline-command.sh, chmod +x it, and point statusLine at it in settings.json.',
    install: 'Runs on the machine you paste it into: writes ~/.claude/statusline-command.sh and updates settings.json. It needs curl, jq and bash.'
  };

  function renderOutput() {
    $('#outHelp').textContent = HELP[tab];
    $('#out').textContent = tab === 'prompt' ? buildPrompt()
                          : tab === 'script' ? buildScript()
                          : buildInstall();
  }

  // ------------------------------------------------------------------ wiring
  function update() { renderPreview(); renderOutput(); }

  function readOptions() {
    state.sep = $('#sep').value;
    state.sepColor = $('#sepColor').value;
    state.align = $('#optAlign').checked;
    state.rule = $('#optRule').checked;
    state.icons = $('#optIcons').checked;
    state.fit = $('#optFit').checked;
    state.links = $('#optLinks').checked;
    state.divider = $('#optDivider').checked;
    state.st.padding = Math.max(0, Math.min(40, Number($('#padding').value) || 0));
    state.st.refresh = Math.max(0, Math.min(3600, Number($('#refresh').value) || 0));
    state.st.hideVim = $('#optHideVim').checked;
    save();
    renderRows();
    update();
  }

  function markPresets() {
    document.querySelectorAll('#sepPresets [data-sep]').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.sep === state.sep &&
        (b.dataset.sep.trim().length > 0) === !!state.divider);
    });
  }

  function writeOptions() {
    $('#sep').value = state.sep;
    $('#sepColor').value = state.sepColor;
    $('#optAlign').checked = !!state.align;
    $('#optRule').checked = !!state.rule;
    $('#optIcons').checked = !!state.icons;
    $('#optFit').checked = !!state.fit;
    $('#optLinks').checked = !!state.links;
    $('#optDivider').checked = !!state.divider;
    markPresets();
    $('#padding').value = state.st.padding || 0;
    $('#refresh').value = state.st.refresh || 0;
    $('#optHideVim').checked = !!state.st.hideVim;
  }

  function init() {
    // separator colour choices
    var sc = $('#sepColor');
    COLOURS.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c;
      sc.appendChild(o);
    });

    // presets
    var ps = $('#preset');
    Object.keys(PRESETS).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = PRESETS[k].name;
      ps.appendChild(o);
    });
    ps.addEventListener('change', function () {
      if (!ps.value) return;
      var keep = state.dividerSet
        ? { divider: state.divider, sep: state.sep, sepColor: state.sepColor, dividerSet: true }
        : {};
      state = Object.assign(clone(DEFAULTS), clone(PRESETS[ps.value].cfg), keep);
      selected = null;
      ps.value = '';
      writeOptions(); save(); renderPalette(); renderRows(); update();
      window.toast(state.dividerSet
        ? 'Preset loaded — your divider setting was kept'
        : 'Preset loaded');
    });

    // terminal colour schemes and fonts (preview only)
    var scSel = $('#scheme');
    Object.keys(SCHEMES).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = SCHEMES[k].name;
      scSel.appendChild(o);
    });
    var fSel = $('#font');
    Object.keys(FONTS).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = FONTS[k].name;
      fSel.appendChild(o);
    });

    loadLook();
    scSel.value = look.scheme;
    fSel.value = look.font;
    $('#fontSize').value = look.size;
    applyLook();

    scSel.addEventListener('change', function () {
      look.scheme = scSel.value; saveLook(); applyLook(); renderRows(); renderPreview();
    });
    fSel.addEventListener('change', function () {
      look.font = fSel.value; saveLook(); applyLook();
    });
    $('#fontSize').addEventListener('input', function () {
      look.size = Number($('#fontSize').value); saveLook(); applyLook();
    });

    load();
    writeOptions();
    renderPalette();
    renderRows();

    $('#filter').addEventListener('input', renderPalette);
    $('#palette').addEventListener('click', function (e) {
      var b = e.target.closest('.sym');
      if (!b) return;
      if (!state.rows.length) state.rows.push([]);
      var r = state.rows.length - 1;
      state.rows[r].push({ f: 'text', c: 'dim', t: b.dataset.symbol });
      selected = { r: r, c: state.rows[r].length - 1 };
      commit();
    });
    $('#sample').addEventListener('change', function () { renderPalette(); renderRows(); update(); });
    ['#sep', '#sepColor', '#optAlign', '#optRule', '#optIcons', '#optFit',
     '#optLinks', '#optDivider', '#padding', '#refresh', '#optHideVim'].forEach(function (s) {
      $(s).addEventListener('change', readOptions);
    });
    $('#padding').addEventListener('input', readOptions);
    $('#refresh').addEventListener('input', readOptions);
    // Typing a mark is an unambiguous request for a divider, and clearing the
    // field is an unambiguous request for none — so the checkbox follows.
    $('#sep').addEventListener('input', function () {
      $('#optDivider').checked = $('#sep').value.trim().length > 0;
      state.dividerSet = true;
      readOptions();
      markPresets();
    });
    $('#optDivider').addEventListener('change', function () { state.dividerSet = true; });

    $('#sepPresets').addEventListener('click', function (e) {
      var b = e.target.closest('[data-sep]');
      if (!b) return;
      $('#sep').value = b.dataset.sep;
      $('#optDivider').checked = b.dataset.sep.trim().length > 0;
      state.dividerSet = true;
      readOptions();
      markPresets();
    });

    $('#addRow').addEventListener('click', function () {
      state.rows.push([]);
      commit();
    });

    $('#reset').addEventListener('click', function () {
      state = Object.assign(clone(DEFAULTS), clone(PRESETS.grid.cfg));
      selected = null;
      writeOptions(); save(); renderPalette(); renderRows(); update();
      window.toast('Reset to the default layout');
    });

    $('#share').addEventListener('click', function (e) {
      save();
      window.copyText(location.href).then(function (ok) {
        if (ok) { window.flashButton(e.target, 'Link copied'); window.toast('Share link copied'); }
        else window.toast('Copy failed — select the URL bar instead');
      });
    });

    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (o) { o.classList.remove('is-active'); });
        t.classList.add('is-active');
        tab = t.dataset.tab;
        renderOutput();
      });
    });

    $('#copyOut').addEventListener('click', function (e) {
      window.copyText($('#out').textContent).then(function (ok) {
        if (ok) { window.flashButton(e.target, 'Copied'); window.toast('Copied to clipboard'); }
        else window.toast('Copy failed — select the text and copy manually');
      });
    });

    $('#download').addEventListener('click', function () {
      var blob = new Blob([buildScript()], { type: 'text/x-shellscript' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'statusline-command.sh';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });

    update();

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { renderChrome(); });
      ro.observe(document.querySelector('.termwin-body'));
    }
    window.addEventListener('resize', renderChrome);

    // the runtime script is the single source of truth — fetch it, don't inline it
    fetch('statusline.sh', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (text) { template = text; renderOutput(); })
      .catch(function () {
        template = null;
        renderOutput();
        window.toast('Could not load statusline.sh — serve this page over http, not file://');
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
