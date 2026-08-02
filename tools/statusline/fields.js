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
  function tok(n) { n = n || 0; return n >= 1000 ? Math.floor(n / 1000) + 'k' : String(n); }
  function pct(v) { return Math.floor(Number(v)) + '%'; }
  function home(dir) {
    var h = '/root';
    if (dir === h) return '~';
    return dir.indexOf(h + '/') === 0 ? '~' + dir.slice(h.length) : dir;
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
      preview: function (p, o) {
        var b = get(p, '_git_branch'); if (!b) return '';
        return ico(o, '⎇', 'git:') + ' ' + b + (get(p, '_git_dirty') ? '*' : '');
      } },
    { id: 'repo', group: 'Project', label: 'owner/repo', hint: 'From the origin remote',
      preview: function (p) {
        var r = get(p, 'workspace.repo'); return r ? r.owner + '/' + r.name : '';
      } },
    { id: 'pr', group: 'Project', label: 'open PR', hint: 'PR number and review state for this branch',
      preview: function (p) {
        var n = get(p, 'pr.number'); if (!n) return '';
        var s = get(p, 'pr.review_state');
        return 'PR #' + n + (s ? ' (' + s + ')' : '');
      } },
    { id: 'worktree', group: 'Project', label: 'worktree', hint: 'Only in a --worktree session',
      preview: function (p, o) {
        var w = get(p, 'worktree.name'); return w ? ico(o, '⑂', 'wt:') + ' ' + w : '';
      } },

    // ---- model & context ----
    { id: 'model', group: 'Model', label: 'model', hint: 'Display name, e.g. Opus 5',
      preview: function (p) { return get(p, 'model.display_name') || ''; } },
    { id: 'model_ctx', group: 'Model', label: 'model + context size', hint: 'Adds (1M context) for 1M-window models',
      preview: function (p) {
        var n = get(p, 'model.display_name'); if (!n) return '';
        var id = get(p, 'model.id') || '';
        if ((id.indexOf('[1m]') >= 0 || /-1m/.test(id)) && n.indexOf('1M') < 0) n += ' (1M context)';
        return '[' + n + ']';
      } },
    { id: 'tokens', group: 'Model', label: 'tokens used/max (%)', hint: '41k/1000k (4%)', heat: true,
      pct: function (p) { return get(p, 'context_window.used_percentage'); },
      preview: function (p) {
        var c = get(p, 'context_window'); if (!c || !c.context_window_size) return '';
        return tok(c.total_input_tokens) + '/' + tok(c.context_window_size) +
               ' (' + Math.floor(c.total_input_tokens * 100 / c.context_window_size) + '%)';
      } },
    { id: 'tokens_plain', group: 'Model', label: 'tokens used/max', hint: 'Without the percentage', heat: true,
      pct: function (p) { return get(p, 'context_window.used_percentage'); },
      preview: function (p) {
        var c = get(p, 'context_window'); if (!c || !c.context_window_size) return '';
        return tok(c.total_input_tokens) + '/' + tok(c.context_window_size);
      } },
    { id: 'ctx_pct', group: 'Model', label: 'context used %', hint: 'Pre-calculated by Claude Code', heat: true,
      pct: function (p) { return get(p, 'context_window.used_percentage'); },
      preview: function (p) {
        var v = get(p, 'context_window.used_percentage');
        return (v === undefined || v === null) ? '' : 'ctx ' + pct(v);
      } },
    { id: 'ctx_left', group: 'Model', label: 'context remaining %', hint: 'How much room is left', heat: true,
      pct: function (p) { return get(p, 'context_window.used_percentage'); },
      preview: function (p) {
        var v = get(p, 'context_window.remaining_percentage');
        return (v === undefined || v === null) ? '' : pct(v) + ' left';
      } },
    { id: 'ctx_bar', group: 'Model', label: 'context bar', hint: 'Ten-segment usage bar', heat: true,
      pct: function (p) { return get(p, 'context_window.used_percentage'); },
      preview: function (p, o) {
        var v = get(p, 'context_window.used_percentage');
        if (v === undefined || v === null) return '';
        var filled = Math.floor(Math.floor(v) * 10 / 100), s = '';
        for (var i = 0; i < 10; i++) s += (i < filled) ? ico(o, '▰', '#') : ico(o, '▱', '.');
        return s;
      } },
    { id: 'out_tokens', group: 'Model', label: 'output tokens', hint: 'From the most recent response',
      preview: function (p, o) {
        var v = get(p, 'context_window.total_output_tokens');
        return v ? ico(o, '↑', 'out') + ' ' + tok(v) : '';
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
      preview: function (p) { var a = get(p, 'agent.name'); return a ? '@' + a : ''; } },
    { id: 'session', group: 'Session', label: 'session name', hint: 'Set with /rename',
      preview: function (p) { return p.session_name || ''; } },
    { id: 'version', group: 'Session', label: 'Claude Code version', hint: 'e.g. v2.1.220',
      preview: function (p) { return p.version ? 'v' + p.version : ''; } },

    // ---- usage ----
    { id: 'rl5', group: 'Usage', label: '5h limit + reset', hint: 'Subscription only, after the first response', heat: true,
      pct: function (p) { return get(p, 'rate_limits.five_hour.used_percentage'); },
      preview: function (p, o) {
        var r = get(p, 'rate_limits.five_hour'); if (!r) return '';
        var cd = countdown(r.resets_at, p._now);
        return '5h ' + pct(r.used_percentage) + (cd ? ' ' + ico(o, '↻', 'in') + ' ' + cd : '');
      } },
    { id: 'rl7', group: 'Usage', label: '7d limit + reset', hint: 'The weekly window', heat: true,
      pct: function (p) { return get(p, 'rate_limits.seven_day.used_percentage'); },
      preview: function (p, o) {
        var r = get(p, 'rate_limits.seven_day'); if (!r) return '';
        var cd = countdown(r.resets_at, p._now);
        return '7d ' + pct(r.used_percentage) + (cd ? ' ' + ico(o, '↻', 'in') + ' ' + cd : '');
      } },
    { id: 'rl5_bare', group: 'Usage', label: '5h limit', hint: 'Percentage only, no countdown', heat: true,
      pct: function (p) { return get(p, 'rate_limits.five_hour.used_percentage'); },
      preview: function (p) {
        var r = get(p, 'rate_limits.five_hour'); return r ? '5h ' + pct(r.used_percentage) : '';
      } },
    { id: 'rl7_bare', group: 'Usage', label: '7d limit', hint: 'Percentage only, no countdown', heat: true,
      pct: function (p) { return get(p, 'rate_limits.seven_day.used_percentage'); },
      preview: function (p) {
        var r = get(p, 'rate_limits.seven_day'); return r ? '7d ' + pct(r.used_percentage) : '';
      } },
    { id: 'cost', group: 'Usage', label: 'session cost', hint: 'API list price of this session — not a subscription bill',
      preview: function (p) {
        var c = get(p, 'cost.total_cost_usd');
        return (c === undefined || c === null) ? '' : '$' + Number(c).toFixed(2);
      } },

    // ---- literal ----
    { id: 'text', group: 'Custom', label: 'custom text', hint: 'Any fixed string — a label, an emoji, a separator',
      custom: true,
      preview: function (p, o, cell) { return (cell && cell.t) || ''; } }
  ];

  var BY_ID = {};
  FIELDS.forEach(function (f) { BY_ID[f.id] = f; });

  global.CCH_FIELDS = FIELDS;
  global.CCH_FIELD = BY_ID;
  global.CCH_UTIL = { tok: tok, pct: pct, home: home, countdown: countdown, get: get };
})(window);
