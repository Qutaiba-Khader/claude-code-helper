/* Renders the tool grid on the hub from tools.json.
   Adding a tool = one entry in tools.json; this file never needs editing. */
(function () {
  'use strict';

  var grid = document.getElementById('tools');
  var count = document.getElementById('count');
  if (!grid) return;

  fetch('tools.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) { render(data.tools || []); })
    .catch(function (err) {
      grid.innerHTML = '<div class="card">Could not load the tool list (' +
        String(err.message || err).replace(/[<>&]/g, '') + ').</div>';
    });

  function render(tools) {
    var live = tools.filter(function (t) { return t.status === 'live'; }).length;
    if (count) {
      count.textContent = live + ' ready, ' + (tools.length - live) + ' planned';
    }

    grid.textContent = '';
    tools.forEach(function (t) {
      var isLive = t.status === 'live' && t.href;
      var el = document.createElement(isLive ? 'a' : 'div');
      el.className = 'tool' + (isLive ? '' : ' is-planned');
      if (isLive) el.href = t.href;

      var top = document.createElement('div');
      top.className = 'top';

      var ico = document.createElement('span');
      ico.className = 'ico';
      ico.textContent = t.icon || '◻';
      ico.setAttribute('aria-hidden', 'true');

      var h = document.createElement('h3');
      h.textContent = t.name;

      var badge = document.createElement('span');
      badge.className = 'tag ' + (isLive ? 'live' : 'soon');
      badge.style.marginLeft = 'auto';
      badge.textContent = isLive ? 'ready' : 'planned';

      top.append(ico, h, badge);

      var p = document.createElement('p');
      p.textContent = t.tagline || '';

      var tags = document.createElement('div');
      tags.className = 'tags';
      (t.tags || []).forEach(function (name) {
        var s = document.createElement('span');
        s.className = 'tag';
        s.textContent = name;
        tags.appendChild(s);
      });

      el.append(top, p, tags);
      grid.appendChild(el);
    });
  }
})();
