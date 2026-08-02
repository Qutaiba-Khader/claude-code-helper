/* settings.json explorer.
 *
 * State is just { scope, chosen: { "<dotted.key>": <value> } }. Everything else
 * is derived: the JSON preview, the three outputs, and the share link.
 */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var SETTINGS = window.CCH_SETTINGS, SCOPES = window.CCH_SCOPES;

  var BY_KEY = {};
  SETTINGS.forEach(function (s) { BY_KEY[s.key] = s; });

  var state = { scope: 'user', chosen: {} };
  var selected = null;
  var tab = 'prompt';

  // ------------------------------------------------------------- encoding
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

  var LS = 'cch-settings';
  function save() {
    var raw = JSON.stringify(state);
    try { localStorage.setItem(LS, raw); } catch (e) { /* ignore */ }
    history.replaceState(null, '', '#c=' + b64encode(raw));
  }
  function load() {
    var hash = location.hash.match(/[#&]c=([A-Za-z0-9_-]+)/), raw = null;
    if (hash) { try { raw = b64decode(hash[1]); } catch (e) { raw = null; } }
    if (!raw) { try { raw = localStorage.getItem(LS); } catch (e) { raw = null; } }
    if (!raw) return;
    try {
      var s = JSON.parse(raw);
      if (s && s.chosen) {
        state.scope = s.scope || 'user';
        Object.keys(s.chosen).forEach(function (k) {
          if (BY_KEY[k]) state.chosen[k] = s.chosen[k];
        });
      }
    } catch (e) { /* keep the defaults */ }
  }

  // --------------------------------------------------- dotted key -> object
  // "permissions.allow" and "permissions.deny" merge into one permissions object.
  function buildObject() {
    var out = {};
    Object.keys(state.chosen).sort().forEach(function (key) {
      var parts = key.split('.'), node = out;
      for (var i = 0; i < parts.length - 1; i++) {
        if (typeof node[parts[i]] !== 'object' || node[parts[i]] === null) node[parts[i]] = {};
        node = node[parts[i]];
      }
      node[parts[parts.length - 1]] = state.chosen[key];
    });
    return out;
  }
  function json() { return JSON.stringify(buildObject(), null, 2); }

  // ---------------------------------------------------------------- list
  function renderList() {
    var host = $('#list');
    var q = ($('#filter').value || '').trim().toLowerCase();
    var hideManaged = $('#hideManaged').checked;

    var groups = {}, shown = 0;
    SETTINGS.forEach(function (s) {
      if (hideManaged && s.managed) return;
      if (q && (s.key + ' ' + s.desc + ' ' + (s.values || []).join(' ')).toLowerCase().indexOf(q) < 0) return;
      (groups[s.group] = groups[s.group] || []).push(s);
      shown++;
    });

    host.textContent = '';
    Object.keys(groups).forEach(function (g) {
      var box = document.createElement('div');
      box.className = 'sgroup';
      var h = document.createElement('h4');
      h.textContent = g;
      box.appendChild(h);
      groups[g].forEach(function (s) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'skey' +
          (selected === s.key ? ' is-selected' : '') +
          (state.chosen.hasOwnProperty(s.key) ? ' is-added' : '');
        b.dataset.key = s.key;
        b.title = s.desc;

        var name = document.createElement('span');
        name.className = 'k';
        name.textContent = s.key;
        b.appendChild(name);

        if (s.managed) {
          var m = document.createElement('span');
          m.className = 'badge managed';
          m.textContent = 'managed';
          b.appendChild(m);
        }
        box.appendChild(b);
      });
      host.appendChild(box);
    });

    $('#count').textContent = shown + ' of ' + SETTINGS.length + ' settings' +
      (hideManaged ? ' · managed-only hidden' : '');

    if (!shown) host.innerHTML = '<p class="hint">Nothing matches that.</p>';
  }

  // -------------------------------------------------------------- detail
  function renderDetail() {
    var host = $('#detail');
    host.textContent = '';
    if (!selected) {
      host.className = 'detail-empty';
      host.innerHTML = '<p>Pick a setting on the left to read what it does and add it to your file.</p>';
      return;
    }
    host.className = 'detail';
    var s = BY_KEY[selected];
    var added = state.chosen.hasOwnProperty(s.key);

    var head = document.createElement('div');
    head.className = 'dhead';
    var k = document.createElement('code');
    k.className = 'dkey';
    k.textContent = s.key;
    head.appendChild(k);

    [['type', s.type],
     ['default', s.def === null || s.def === undefined ? 'none' : JSON.stringify(s.def)],
     s.since ? ['since', 'v' + s.since] : null,
     s.managed ? ['scope', 'managed only'] : null,
     s.live === 'reload' ? ['applies', 'live'] : null,
     s.live === 'restart' ? ['applies', 'on restart'] : null
    ].forEach(function (pair) {
      if (!pair) return;
      var t = document.createElement('span');
      t.className = 'badge' + (pair[0] === 'scope' ? ' managed' : '');
      t.textContent = pair[0] + ' ' + pair[1];
      head.appendChild(t);
    });

    var desc = document.createElement('p');
    desc.className = 'ddesc';
    desc.textContent = s.desc;

    host.append(head, desc);

    if (s.values) {
      var vals = document.createElement('p');
      vals.className = 'hint';
      vals.style.margin = '0 0 12px';
      vals.textContent = 'Accepts: ' + s.values.join(', ');
      host.appendChild(vals);
    }
    if (s.link) {
      var lnk = document.createElement('p');
      lnk.className = 'hint';
      lnk.style.margin = '0 0 12px';
      var a = document.createElement('a');
      a.href = s.link;
      a.textContent = 'Build this one visually →';
      lnk.appendChild(a);
      host.appendChild(lnk);
    }

    // value editor
    var editor = document.createElement('div');
    editor.className = 'deditor';
    var current = added ? state.chosen[s.key] : defaultFor(s);
    editor.appendChild(valueControl(s, current, function (v) {
      state.chosen[s.key] = v;
      commit();
    }));
    host.appendChild(editor);

    var actions = document.createElement('div');
    actions.className = 'dactions';
    var addBtn = document.createElement('button');
    addBtn.className = 'btn ' + (added ? '' : 'btn-primary');
    addBtn.type = 'button';
    addBtn.textContent = added ? 'Remove from file' : 'Add to file';
    addBtn.addEventListener('click', function () {
      if (added) delete state.chosen[s.key];
      else state.chosen[s.key] = current;
      commit();
    });
    actions.appendChild(addBtn);
    host.appendChild(actions);
  }

  function defaultFor(s) {
    if (s.example !== undefined) return s.example;
    if (s.type === 'boolean') return s.def === true ? false : true;
    if (s.type === 'number') return s.def === null ? 0 : s.def;
    if (s.type === 'string') return s.values ? s.values[0] : '';
    if (s.type === 'string[]') return [];
    return {};
  }

  // A control matched to the setting's type — never a raw JSON box when a
  // checkbox or a select would say it more plainly.
  function valueControl(s, value, onChange) {
    var wrap = document.createElement('div');
    var label = document.createElement('label');
    label.className = 'field';
    label.textContent = 'Value';
    wrap.appendChild(label);

    if (s.type === 'boolean') {
      var row = document.createElement('div');
      row.className = 'bool-row';
      [true, false].forEach(function (v) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-sm' + (value === v ? ' is-on' : '');
        b.textContent = String(v);
        b.addEventListener('click', function () { onChange(v); });
        row.appendChild(b);
      });
      wrap.appendChild(row);
      return wrap;
    }

    if (s.values) {
      var sel = document.createElement('select');
      s.values.forEach(function (v) {
        var o = document.createElement('option');
        o.value = v; o.textContent = v;
        if (v === value) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () { onChange(sel.value); });
      wrap.appendChild(sel);
      return wrap;
    }

    if (s.type === 'number') {
      var num = document.createElement('input');
      num.type = 'number';
      num.value = value;
      num.addEventListener('input', function () { onChange(Number(num.value)); });
      wrap.appendChild(num);
      return wrap;
    }

    if (s.type === 'string') {
      var txt = document.createElement('input');
      txt.type = 'text';
      txt.value = value || '';
      txt.spellcheck = false;
      txt.addEventListener('input', function () { onChange(txt.value); });
      wrap.appendChild(txt);
      return wrap;
    }

    if (s.type === 'string[]') {
      label.textContent = 'Value — one per line';
      var ta = document.createElement('textarea');
      ta.rows = 4;
      ta.spellcheck = false;
      ta.value = (value || []).join('\n');
      ta.addEventListener('input', function () {
        onChange(ta.value.split('\n').map(function (l) { return l.trim(); })
                         .filter(function (l) { return l.length; }));
      });
      wrap.appendChild(ta);
      return wrap;
    }

    // object / object[] — a JSON box, with a live parse check
    label.textContent = 'Value — JSON';
    var box = document.createElement('textarea');
    box.rows = 6;
    box.spellcheck = false;
    box.value = JSON.stringify(value, null, 2);
    var err = document.createElement('p');
    err.className = 'hint json-err';
    box.addEventListener('input', function () {
      try {
        onChange(JSON.parse(box.value));
        err.textContent = '';
        box.classList.remove('is-bad');
      } catch (e) {
        err.textContent = 'Not valid JSON yet — ' + e.message;
        box.classList.add('is-bad');
      }
    });
    wrap.append(box, err);
    return wrap;
  }

  // -------------------------------------------------------------- chosen
  function renderChosen() {
    var host = $('#chosen');
    host.textContent = '';
    var keys = Object.keys(state.chosen).sort();
    $('#chosenCount').textContent = keys.length
      ? keys.length + (keys.length === 1 ? ' setting' : ' settings')
      : 'nothing yet';

    if (!keys.length) {
      host.innerHTML = '<p class="hint" style="margin:0">Settings you add appear here.</p>';
      return;
    }
    keys.forEach(function (key) {
      var s = BY_KEY[key];
      var row = document.createElement('div');
      row.className = 'crow' + (s.managed ? ' is-managed' : '');

      var k = document.createElement('button');
      k.type = 'button';
      k.className = 'ckey';
      k.textContent = key;
      k.addEventListener('click', function () { selected = key; render(); });

      var v = document.createElement('code');
      v.className = 'cval';
      v.textContent = JSON.stringify(state.chosen[key]);

      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'cx';
      x.title = 'Remove';
      x.setAttribute('aria-label', 'Remove ' + key);
      x.textContent = '×';
      x.addEventListener('click', function () { delete state.chosen[key]; commit(); });

      row.append(k, v, x);
      host.appendChild(row);
    });
  }

  // -------------------------------------------------------------- outputs
  function scopeInfo() {
    return SCOPES.filter(function (s) { return s.id === state.scope; })[0] || SCOPES[0];
  }

  function renderScopeCard() {
    var s = scopeInfo();
    var host = $('#scopeCard');
    host.textContent = '';
    var h = document.createElement('h3');
    h.textContent = s.name + ' settings';
    var path = document.createElement('code');
    path.className = 'spath';
    path.textContent = s.path;
    var applies = document.createElement('p');
    applies.className = 'hint';
    applies.textContent = s.applies + (s.shared ? ' · shared' : ' · private to you');
    var note = document.createElement('p');
    note.className = 'hint';
    note.textContent = s.note;
    host.append(h, path, applies, note);

    var managedChosen = Object.keys(state.chosen).filter(function (k) { return BY_KEY[k].managed; });
    if (managedChosen.length && state.scope !== 'managed') {
      var warn = document.createElement('p');
      warn.className = 'hint hot';
      warn.textContent = managedChosen.length === 1
        ? managedChosen[0] + ' only works in a managed file — it will be ignored here.'
        : managedChosen.length + ' of these only work in a managed file and will be ignored here.';
      host.appendChild(warn);
    }
    $('#fileTitle').textContent = s.path.split('/').pop();
  }

  var HELP = {
    prompt: 'Paste this into Claude Code. It merges the keys into your settings file without touching anything else.',
    json: 'The keys on their own. Merge them by hand — do not replace your whole file with this.',
    jq: 'Merges the keys in place from a shell, keeping every other setting. Needs jq.'
  };

  function buildPrompt() {
    var s = scopeInfo();
    var keys = Object.keys(state.chosen).sort();
    if (!keys.length) return 'Add a setting first.';
    var lines = [
      'Merge the following into ' + s.path + ', preserving every setting already in the file.',
      'Do not replace the file — merge key by key. If it is a symlink, edit the file it points at.',
      '',
      json(),
      '',
      'What each key does:'
    ];
    keys.forEach(function (k) { lines.push(' - ' + k + ': ' + BY_KEY[k].desc); });
    var live = keys.filter(function (k) { return BY_KEY[k].live === 'reload' || k.indexOf('permissions.') === 0 || k === 'hooks' || k === 'apiKeyHelper'; });
    var restart = keys.filter(function (k) { return BY_KEY[k].live === 'restart'; });
    lines.push('');
    if (live.length) lines.push('These apply as soon as the file is saved: ' + live.join(', ') + '.');
    if (restart.length) lines.push('These are read once at startup, so restart afterwards: ' + restart.join(', ') + '.');
    lines.push('Afterwards, show me the result of /status so I can confirm it took effect.');
    return lines.join('\n');
  }

  function buildJq() {
    var keys = Object.keys(state.chosen);
    if (!keys.length) return '# Add a setting first.';
    var s = scopeInfo();
    var path = s.path.replace(/^~/, '$HOME');
    return [
      '# merges into ' + s.path + ', keeping everything already there',
      'f=' + path,
      '[ -f "$f" ] || echo \'{}\' > "$f"',
      'cp "$f" "$f.bak"',
      'jq \'. * ' + JSON.stringify(buildObject()) + '\' "$f.bak" > "$f"'
    ].join('\n');
  }

  function renderOutput() {
    $('#outHelp').textContent = HELP[tab];
    $('#out').textContent = tab === 'prompt' ? buildPrompt()
                          : tab === 'json' ? json()
                          : buildJq();
  }

  function renderJSON() {
    var keys = Object.keys(state.chosen);
    $('#json').textContent = keys.length ? json() : '{\n\n}';
  }

  // ------------------------------------------------------------- reference
  function renderReference() {
    var ol = $('#precedence');
    window.CCH_PRECEDENCE.forEach(function (name) {
      var li = document.createElement('li');
      li.textContent = name;
      ol.appendChild(li);
    });
    var env = $('#envlist');
    window.CCH_ENV_VARS.forEach(function (v) {
      var row = document.createElement('div');
      row.className = 'envrow';
      var n = document.createElement('code');
      n.textContent = v.name;
      var d = document.createElement('span');
      d.textContent = v.desc;
      row.append(n, d);
      env.appendChild(row);
    });
  }

  // ---------------------------------------------------------------- wiring
  function render() { renderList(); renderDetail(); renderChosen(); renderJSON(); renderScopeCard(); renderOutput(); }
  function commit() { save(); render(); }

  function init() {
    load();
    $('#scope').value = state.scope;
    renderReference();
    render();

    $('#filter').addEventListener('input', renderList);
    $('#hideManaged').addEventListener('change', renderList);
    $('#scope').addEventListener('change', function () {
      state.scope = $('#scope').value;
      commit();
    });
    $('#list').addEventListener('click', function (e) {
      var b = e.target.closest('.skey');
      if (!b) return;
      selected = b.dataset.key;
      render();
    });
    // Export the file itself, so it can be dropped straight into place.
    $('#export').addEventListener('click', function () {
      var keys = Object.keys(state.chosen);
      if (!keys.length) { window.toast('Nothing to export yet'); return; }
      window.downloadFile(scopeInfo().path.split('/').pop(), json() + '\n');
      window.toast('Saved ' + scopeInfo().path.split('/').pop());
    });

    // Import accepts a real settings.json: anything it recognises is picked up,
    // and anything it does not is reported rather than silently dropped.
    $('#import').addEventListener('click', function () {
      window.pickJSON($('#importFile'), function (data, name) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          window.toast('That file is not a settings object');
          return;
        }
        var existing = Object.keys(state.chosen).length;
        var found = 0, unknown = [];
        function walk(obj, prefix) {
          Object.keys(obj).forEach(function (k) {
            var key = prefix ? prefix + '.' + k : k;
            var v = obj[k];
            if (BY_KEY[key]) { state.chosen[key] = v; found++; return; }
            if (v && typeof v === 'object' && !Array.isArray(v) && !prefix) {
              walk(v, key);
              return;
            }
            unknown.push(key);
          });
        }
        walk(data, '');
        commit();
        if (existing) window.toast('Merged into your ' + existing + ' existing setting' + (existing === 1 ? '' : 's'));
        window.toast(found
          ? 'Loaded ' + found + ' setting' + (found === 1 ? '' : 's') + ' from ' + name +
            (unknown.length ? ' · ' + unknown.length + ' not recognised' : '')
          : 'Nothing in ' + name + ' matched a known setting');
      });
    });

    $('#clear').addEventListener('click', function () {
      var n = Object.keys(state.chosen).length;
      if (!n) { window.toast('Nothing to clear'); return; }
      window.confirmAction({
        title: 'Clear all ' + n + ' setting' + (n === 1 ? '' : 's') + '?',
        body: 'Your file goes back to empty. Export first if you want to keep it.',
        confirmLabel: 'Clear it', cancelLabel: 'Keep them', destructive: true
      }).then(function (ok) {
        if (!ok) return;
        state.chosen = {};
        selected = null;
        commit();
        window.toast('Cleared');
      });
    });
    $('#share').addEventListener('click', function (e) {
      save();
      window.copyText(location.href).then(function (ok) {
        if (ok) { window.flashButton(e.target, 'Link copied'); window.toast('Share link copied'); }
        else window.toast('Copy failed — use the URL bar instead');
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
