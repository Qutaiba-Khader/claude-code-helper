/* Field catalogue for the status line builder.
 *
 * Each entry describes one thing that can go in a cell. `preview(p, o)` mirrors
 * what statusline.sh renders for that field so the on-page terminal matches the
 * real thing — if you add a field here you must add the matching case to the
 * `render()` function in statusline.sh, and vice versa.
 *
 *   p = the Status-hook payload (see docs/statusline-payload.md)
 *   o = { icons: bool }  global options
 *
 * `heat: true` marks fields that can be auto-coloured by a percentage; `pct(p)`
 * returns the percentage that grading uses.
 */
(function (global) {
  'use strict';

  function ico(o, glyph, ascii) { return o.icons ? glyph : ascii; }
  // an affix (glyph or word) is dropped when the cell has its icon turned off
  function af(cell, text) { return (cell && cell.i === false) ? '' : text; }
  function tok(n) { n = n || 0; return n >= 1000 ? Math.floor(n / 1000) + 'k' : String(n); }
  // \u0002 … \u0003 wraps the part that carries the value, so a ramp colours
  // only that and the rest of the cell keeps its own colour.
  var VS = '\u0002', VE = '\u0003';
  function val(t) { return VS + t + VE; }
  function pct(v) { return val(Math.floor(Number(v)) + '%'); }
  function ctxsize(n) {
    if (!n) return '';
    if (n >= 1000000 && n % 1000000 === 0) return (n / 1000000) + 'M';
    if (n >= 1000) return Math.floor(n / 1000) + 'k';
    return String(n);
  }
  function home(dir) {
    var h = '/root';
    if (dir === h) return '~';
    return dir.indexOf(h + '/') === 0 ? '~' + dir.slice(h.length) : dir;
  }
  // filled/empty glyph pair + width -> a bar at the payload's percentage
  function ctxPct(p) {
    var c = get(p, 'context_window');
    if (!c) return null;
    var n = c.used_percentage;
    if (n === undefined || n === null) {
      if (!c.context_window_size) return null;
      n = c.total_input_tokens * 100 / c.context_window_size;
    }
    return Math.min(100, Math.floor(n));
  }
  function barOf(p, o, glyph, ascii, width) {
    var n = ctxPct(p);
    if (n === null) return '';
    var filled = Math.floor(n * width / 100), out = '';
    for (var i = 0; i < width; i++) {
      out += (i < filled) ? ico(o, glyph[0], ascii[0]) : ico(o, glyph[1], ascii[1]);
    }
    return val(out);
  }
  function meterOf(p, o) {
    var n = ctxPct(p);
    if (n === null) return '';
    var scale = o.icons ? ['▁','▂','▃','▄','▅','▆','▇','█'] : ['.',':','-','=','+','*','#','@'];
    return val(scale[Math.min(scale.length - 1, Math.floor(n * scale.length / 100))]);
  }

  function dur(ms) {
    if (ms === undefined || ms === null) return '';
    var sec = Math.floor(ms / 1000);
    if (sec >= 3600) {
      var m = Math.floor((sec % 3600) / 60);
      return Math.floor(sec / 3600) + 'h' + (m < 10 ? '0' : '') + m + 'm';
    }
    if (sec >= 60) return Math.floor(sec / 60) + 'm';
    return sec + 's';
  }
  function countdown(epoch, now) {
    if (!epoch) return '';
    var left = epoch - (now || Math.floor(Date.now() / 1000));
    if (left <= 0) return '';
    if (left >= 86400) return Math.floor(left / 86400) + 'd' + Math.floor((left % 86400) / 3600) + 'h';
    if (left >= 3600) {
      var m = Math.floor((left % 3600) / 60);
      return Math.floor(left / 3600) + 'h' + (m < 10 ? '0' : '') + m + 'm';
    }
    return Math.floor(left / 60) + 'm';
  }
  function get(p, path) {
    return path.split('.').reduce(function (a, k) {
      return (a === null || a === undefined) ? undefined : a[k];
    }, p);
  }

  var FIELDS = [
    // ---- machine & location ----
    { id: 'userhost', group: 'Machine', label: 'user@host', hint: 'Your shell prompt identity',
      preview: function () { return 'root@proxmox'; } },
    { id: 'user', group: 'Machine', label: 'user', hint: 'Username only',
      preview: function () { return 'root'; } },
    { id: 'host', group: 'Machine', label: 'hostname', hint: 'Short hostname',
      preview: function () { return 'proxmox'; } },
    { id: 'time', group: 'Machine', label: 'clock', hint: 'HH:MM, refreshed when the line redraws',
      preview: function () { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); } },
    { id: 'date', group: 'Machine', label: 'date', hint: 'YYYY-MM-DD',
      preview: function () { return new Date().toISOString().slice(0, 10); } },

    // ---- project ----
    { id: 'cwd', group: 'Project', label: 'current dir', hint: 'Full path, home shown as ~',
      preview: function (p) { return home(get(p, 'workspace.current_dir') || p.cwd || ''); } },
    { id: 'cwd_base', group: 'Project', label: 'dir name', hint: 'Just the last path segment',
      preview: function (p) { var d = get(p, 'workspace.current_dir') || p.cwd || ''; return d.split('/').pop(); } },
    { id: 'project', group: 'Project', label: 'project name', hint: 'Name of the project root directory',
      preview: function (p) { var d = get(p, 'workspace.project_dir'); return d ? d.split('/').pop() : ''; } },
    { id: 'branch', group: 'Project', label: 'git branch', hint: 'Branch, with * when the tree is dirty',
      icon: '⎇',
      preview: function (p, o, cell) {
        var b = get(p, '_git_branch'); if (!b) return '';
        return af(cell, ico(o, '⎇', 'git:') + ' ') + b + (get(p, '_git_dirty') ? '*' : '');
      } },
    { id: 'repo', group: 'Project', label: 'owner/repo', hint: 'From the origin remote',
      preview: function (p) {
        var r = get(p, 'workspace.repo'); return r ? r.owner + '/' + r.name : '';
      } },
    { id: 'pr', group: 'Project', label: 'open PR', hint: 'Number and review state; becomes a clickable OSC 8 link when links are on',
      preview: function (p) {
        var n = get(p, 'pr.number'); if (!n) return '';
        var s = get(p, 'pr.review_state');
        return 'PR #' + n + (s ? ' (' + s + ')' : '');
      } },
    { id: 'worktree', group: 'Project', label: 'worktree', hint: 'Only in a --worktree session',
      icon: '⑂',
      preview: function (p, o, cell) {
        var w = get(p, 'worktree.name'); return w ? af(cell, ico(o, '⑂', 'wt:') + ' ') + w : '';
      } },
    { id: 'git_worktree', group: 'Project', label: 'git worktree', hint: 'Any linked git worktree, not just --worktree sessions',
      icon: '⑂',
      preview: function (p, o, cell) {
        var w = get(p, 'workspace.git_worktree'); return w ? af(cell, ico(o, '⑂', 'wt:') + ' ') + w : '';
      } },
    { id: 'added_dirs', group: 'Project', label: 'added dirs', hint: 'How many directories were added with /add-dir',
      preview: function (p) {
        var a = get(p, 'workspace.added_dirs');
        return (a && a.length) ? '+' + a.length + ' dir' : '';
      } },

    // ---- model & context ----
    { id: 'model', group: 'Model', label: 'model', hint: 'Display name, e.g. Opus 5',
      preview: function (p) { return get(p, 'model.display_name') || ''; } },
    { id: 'model_ctx', group: 'Model', label: 'model + context size', hint: 'e.g. Opus 5 1M — no brackets',
      preview: function (p) {
        var n = get(p, 'model.display_name'); if (!n) return '';
        var id = get(p, 'model.id') || '';
        var size = get(p, 'context_window.context_window_size');
        if ((id.indexOf('[1m]') >= 0 || /-1m/.test(id)) && n.indexOf('1M') < 0) return n + ' 1M';
        return size ? n + ' ' + ctxsize(size) : n;
      } },
    { id: 'ctx_size', group: 'Model', label: 'context size', hint: 'The window on its own, e.g. 1M or 200k',
      preview: function (p) {
        var v = get(p, 'context_window.context_window_size');
        return v ? ctxsize(v) : '';
      } },
    { id: 'tokens', group: 'Model', label: 'tokens used/max (%)', hint: '41k/1000k (4%)', heat: true,
      pct: function (p) { return get(p, 'context_window.used_percentage'); },
      preview: function (p) {
        var c = get(p, 'context_window'); if (!c || !c.context_window_size) return '';
        return tok(c.total_input_tokens) + '/' + tok(c.context_window_size) +
               ' (' + val(Math.floor(c.total_input_tokens * 100 / c.context_window_size) + '%') + ')';
      } },
    { id: 'tokens_plain', group: 'Model', label: 'tokens used/max', hint: 'Without the percentage', heat: true,
      pct: function (p) { return get(p, 'context_window.used_percentage'); },
      preview: function (p) {
        var c = get(p, 'context_window'); if (!c || !c.context_window_size) return '';
        return tok(c.total_input_tokens) + '/' + tok(c.context_window_size);
      } },
    { id: 'tokens_pct', group: 'Model', label: 'used % (on its own)',
      hint: 'Just the number, e.g. 4% — nothing else', heat: true,
      pct: function (p) { return get(p, 'context_window.used_percentage'); },
      preview: function (p) {
        var v = get(p, 'context_window.used_percentage');
        if (v !== undefined && v !== null) return pct(v);
        var c = get(p, 'context_window');
        if (c && c.context_window_size) {
          return val(Math.floor(c.total_input_tokens * 100 / c.context_window_size) + '%');
        }
        return '';
      } },
    { id: 'ctx_pct', group: 'Model', label: 'context used %', hint: 'Pre-calculated by Claude Code', heat: true,
      pct: function (p) { return get(p, 'context_window.used_percentage'); },
      icon: 'ctx',
      preview: function (p, o, cell) {
        var v = get(p, 'context_window.used_percentage');
        return (v === undefined || v === null) ? '' : af(cell, 'ctx ') + pct(v);
      } },
    { id: 'ctx_left', group: 'Model', label: 'context remaining %', hint: 'How much room is left', heat: true,
      pct: function (p) { return get(p, 'context_window.used_percentage'); },
      icon: 'left',
      preview: function (p, o, cell) {
        var v = get(p, 'context_window.remaining_percentage');
        return (v === undefined || v === null) ? '' : pct(v) + af(cell, ' left');
      } },
    { id: 'ctx_bar', group: 'Model', label: 'context bar', hint: 'Ten-segment usage bar', heat: true,
      pct: function (p) { return get(p, 'context_window.used_percentage'); },
      preview: function (p, o) {
        var v = get(p, 'context_window.used_percentage');
        if (v === undefined || v === null) return '';
        var filled = Math.floor(Math.floor(v) * 10 / 100), s = '';
        for (var i = 0; i < 10; i++) s += (i < filled) ? ico(o, '▰', '#') : ico(o, '▱', '.');
        return val(s);
      } },
    { id: 'ctx_bar_slim', group: 'Model', label: 'bar — slim lines', heat: true,
      hint: 'Thin rule style: ━━━───────',
      pct: function (p) { return ctxPct(p); },
      preview: function (p, o) { return barOf(p, o, ['━', '─'], ['=', '-'], 10); } },
    { id: 'ctx_bar_dots', group: 'Model', label: 'bar — dots', heat: true,
      hint: 'Round beads: ●●●○○○○○○○',
      pct: function (p) { return ctxPct(p); },
      preview: function (p, o) { return barOf(p, o, ['●', '○'], ['o', '.'], 10); } },
    { id: 'ctx_bar_shade', group: 'Model', label: 'bar — solid + shade', heat: true,
      hint: 'Full blocks against a light shade: █████░░░░░',
      pct: function (p) { return ctxPct(p); },
      preview: function (p, o) { return barOf(p, o, ['█', '░'], ['#', '.'], 10); } },
    { id: 'ctx_bar_pipe', group: 'Model', label: 'bar — upright bars', heat: true,
      hint: 'Vertical cells: ▮▮▮▯▯▯▯▯▯▯',
      pct: function (p) { return ctxPct(p); },
      preview: function (p, o) { return barOf(p, o, ['▮', '▯'], ['#', '.'], 10); } },
    { id: 'ctx_bar_mini', group: 'Model', label: 'bar — five wide', heat: true,
      hint: 'Half the width, for a tight line: ▰▰▱▱▱',
      pct: function (p) { return ctxPct(p); },
      preview: function (p, o) { return barOf(p, o, ['▰', '▱'], ['#', '.'], 5); } },
    { id: 'ctx_bar_meter', group: 'Model', label: 'bar — one character', heat: true,
      hint: 'The whole level in a single glyph, ▁ through █',
      pct: function (p) { return ctxPct(p); },
      preview: function (p, o) { return meterOf(p, o); } },
    { id: 'bar_tokens', group: 'Model', label: 'bar + tokens used', heat: true,
      hint: 'The context bar with the count on the end, e.g. ▰▰▰▱▱▱▱▱▱▱ 41k/1000k (4%)',
      pct: function (p) { return get(p, 'context_window.used_percentage'); },
      preview: function (p, o) {
        var c = get(p, 'context_window');
        if (!c || !c.context_window_size) return '';
        var n = c.used_percentage;
        if (n === undefined || n === null) n = c.total_input_tokens * 100 / c.context_window_size;
        n = Math.floor(n);
        var filled = Math.floor(n * 10 / 100), bar = '';
        for (var i = 0; i < 10; i++) bar += (i < filled) ? ico(o, '▰', '#') : ico(o, '▱', '.');
        return val(bar) + ' ' + tok(c.total_input_tokens) + '/' + tok(c.context_window_size) +
               ' (' + val(n + '%') + ')';
      } },
    { id: 'out_tokens', group: 'Model', label: 'output tokens', hint: 'From the most recent response',
      icon: '↑',
      preview: function (p, o, cell) {
        var v = get(p, 'context_window.total_output_tokens');
        return v ? af(cell, ico(o, '↑', 'out') + ' ') + tok(v) : '';
      } },
    { id: 'cache_read', group: 'Model', label: 'cache read', hint: 'Tokens read from the prompt cache on the last call',
      icon: 'cache',
      preview: function (p, o, cell) {
        var v = get(p, 'context_window.current_usage.cache_read_input_tokens');
        return v ? af(cell, 'cache ') + tok(v) : '';
      } },
    { id: 'cache_write', group: 'Model', label: 'cache write', hint: 'Tokens written to the prompt cache on the last call',
      icon: 'cw',
      preview: function (p, o, cell) {
        var v = get(p, 'context_window.current_usage.cache_creation_input_tokens');
        return v ? af(cell, 'cw ') + tok(v) : '';
      } },
    { id: 'over200k', group: 'Model', label: 'over 200k', hint: 'Flag: last response exceeded 200k tokens (fixed threshold)',
      icon: '⚠',
      preview: function (p, o, cell) {
        return p.exceeds_200k_tokens ? af(cell, ico(o, '⚠ ', '!')) + '200k+' : '';
      } },

    // ---- session ----
    { id: 'effort', group: 'Session', label: 'effort', hint: 'low / medium / high / xhigh / max',
      preview: function (p) { return get(p, 'effort.level') || ''; } },
    { id: 'thinking', group: 'Session', label: 'thinking off', hint: 'Shows no-think only when thinking is disabled',
      preview: function (p) { return get(p, 'thinking.enabled') === false ? 'no-think' : ''; } },
    { id: 'fast', group: 'Session', label: 'fast mode', hint: 'Shown only while fast mode is on',
      preview: function (p, o) { return p.fast_mode ? ico(o, '⚡', 'fast') : ''; } },
    { id: 'style', group: 'Session', label: 'output style', hint: 'Hidden while the style is "default"',
      preview: function (p) {
        var s = get(p, 'output_style.name');
        return (s && s !== 'default') ? s : '';
      } },
    { id: 'vim', group: 'Session', label: 'vim mode', hint: 'Only when vim mode is enabled',
      preview: function (p) { return get(p, 'vim.mode') || ''; } },
    { id: 'agent', group: 'Session', label: 'agent', hint: 'Only when started with --agent',
      icon: '@',
      preview: function (p, o, cell) { var a = get(p, 'agent.name'); return a ? af(cell, '@') + a : ''; } },
    { id: 'session', group: 'Session', label: 'session name', hint: 'Set with /rename',
      preview: function (p) { return p.session_name || ''; } },
    { id: 'version', group: 'Session', label: 'Claude Code version', hint: 'e.g. v2.1.220',
      icon: 'v',
      preview: function (p, o, cell) { return p.version ? af(cell, 'v') + p.version : ''; } },
    { id: 'session_id', group: 'Session', label: 'session id', hint: 'First 8 characters — handy to tell sessions apart',
      preview: function (p) { return p.session_id ? String(p.session_id).slice(0, 8) : ''; } },

    // ---- usage ----
    { id: 'rl5', group: 'Usage', label: '5h limit + reset', hint: 'Subscription only, after the first response', heat: true,
      pct: function (p) { return get(p, 'rate_limits.five_hour.used_percentage'); },
      icon: '5h ↻',
      preview: function (p, o, cell) {
        var r = get(p, 'rate_limits.five_hour'); if (!r) return '';
        var cd = countdown(r.resets_at, p._now);
        return af(cell, '5h ') + pct(r.used_percentage) +
               (cd ? ' ' + af(cell, ico(o, '↻', 'in') + ' ') + cd : '');
      } },
    { id: 'rl7', group: 'Usage', label: '7d limit + reset', hint: 'The weekly window', heat: true,
      pct: function (p) { return get(p, 'rate_limits.seven_day.used_percentage'); },
      icon: '7d ↻',
      preview: function (p, o, cell) {
        var r = get(p, 'rate_limits.seven_day'); if (!r) return '';
        var cd = countdown(r.resets_at, p._now);
        return af(cell, '7d ') + pct(r.used_percentage) +
               (cd ? ' ' + af(cell, ico(o, '↻', 'in') + ' ') + cd : '');
      } },
    { id: 'rl5_bare', group: 'Usage', label: '5h limit', hint: 'Percentage only, no countdown', heat: true,
      pct: function (p) { return get(p, 'rate_limits.five_hour.used_percentage'); },
      icon: '5h',
      preview: function (p, o, cell) {
        var r = get(p, 'rate_limits.five_hour'); return r ? af(cell, '5h ') + pct(r.used_percentage) : '';
      } },
    { id: 'rl7_bare', group: 'Usage', label: '7d limit', hint: 'Percentage only, no countdown', heat: true,
      pct: function (p) { return get(p, 'rate_limits.seven_day.used_percentage'); },
      icon: '7d',
      preview: function (p, o, cell) {
        var r = get(p, 'rate_limits.seven_day'); return r ? af(cell, '7d ') + pct(r.used_percentage) : '';
      } },
    { id: 'cost', group: 'Usage', label: 'session cost', hint: 'Estimated, computed client-side; resets to $0 on /clear',
      preview: function (p) {
        var c = get(p, 'cost.total_cost_usd');
        return (c === undefined || c === null) ? '' : '$' + Number(c).toFixed(2);
      } },
    { id: 'duration', group: 'Usage', label: 'session duration', hint: 'Wall-clock time since the session started',
      preview: function (p) { return dur(get(p, 'cost.total_duration_ms')); } },
    { id: 'api_duration', group: 'Usage', label: 'API time', hint: 'Time spent waiting on API responses',
      icon: 'api',
      preview: function (p, o, cell) { var v = dur(get(p, 'cost.total_api_duration_ms')); return v ? af(cell, 'api ') + v : ''; } },
    { id: 'lines', group: 'Usage', label: 'lines changed', hint: '+added/-removed this session',
      preview: function (p) {
        var a = get(p, 'cost.total_lines_added'), r = get(p, 'cost.total_lines_removed');
        if (a === undefined && r === undefined) return '';
        return '+' + (a || 0) + '/-' + (r || 0);
      } },
    { id: 'lines_added', group: 'Usage', label: 'lines added', hint: 'Added only',
      preview: function (p) {
        var a = get(p, 'cost.total_lines_added');
        return (a === undefined || a === null) ? '' : '+' + a;
      } },
    { id: 'lines_removed', group: 'Usage', label: 'lines removed', hint: 'Removed only',
      preview: function (p) {
        var r = get(p, 'cost.total_lines_removed');
        return (r === undefined || r === null) ? '' : '-' + r;
      } },

    // ---- structural ----
    { id: 'rule', group: 'Custom', label: 'horizontal line', isRule: true,
      hint: 'A divider across the status line. It gets a row to itself.',
      preview: function () { return ''; } },

    // ---- literal ----
    { id: 'text', group: 'Custom', label: 'custom text', hint: 'Any fixed string — a label, an emoji, a separator',
      custom: true,
      preview: function (p, o, cell) { return (cell && cell.t) || ''; } }
  ];

  var BY_ID = {};
  FIELDS.forEach(function (f) { BY_ID[f.id] = f; });

  global.CCH_FIELDS = FIELDS;
  global.CCH_FIELD = BY_ID;
  global.CCH_MARK = { VS: VS, VE: VE };
  global.CCH_UTIL = { tok: tok, pct: pct, ctxsize: ctxsize, home: home,
                      countdown: countdown, dur: dur, get: get };
})(window);
