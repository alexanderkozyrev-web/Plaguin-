/**
 * Motion Kit — panel.
 *
 * Builds the UI from Registry, collects modifier keys on click, calls the
 * host, reports the result. There is deliberately no tool logic here.
 *
 * The whole panel is a single grid: no sections, no headings. Class names
 * below are the contract with panel.css — `grid`, `tool`, `tool-label`,
 * `anchor-grid`, `anchor-cell`, and `data-tone` on the status bar.
 */
(function () {

  var panel = document.getElementById("panel");
  var status = document.getElementById("status");
  var statusText = document.getElementById("status-text");

  /**
   * Glyph for one anchor cell, derived from its own multipliers.
   *
   * A corner gets an L bracket, an edge gets a single bar, the centre gets a
   * cross. Nothing is hardcoded per cell, so the pad cannot drift out of sync
   * with what the cell actually does.
   */
  function anchorGlyph(fx, fy) {
    var A = 5;              // inset from the cell edge
    var B = 25;             // far edge
    var L = 9;              // arm length
    var body;

    if (fx === 0.5 && fy === 0.5) {
      body = '<path d="M15 9.5v11M9.5 15h11"/>';
    } else if (fx === 0.5) {
      body = '<path d="M11 ' + ((fy === 0) ? A : B) + 'h8"/>';
    } else if (fy === 0.5) {
      body = '<path d="M' + ((fx === 0) ? A : B) + ' 11v8"/>';
    } else {
      var x = (fx === 0) ? A : B;
      var y = (fy === 0) ? A : B;
      var dx = (fx === 0) ? L : -L;
      var dy = (fy === 0) ? L : -L;
      body = '<path d="M' + x + ' ' + (y + dy) + 'V' + y + 'H' + (x + dx) + '"/>';
    }

    return '<svg viewBox="0 0 30 30" fill="none" stroke="currentColor" ' +
           'stroke-width="4" stroke-linecap="square" stroke-linejoin="miter" ' +
           'aria-hidden="true">' + body + '</svg>';
  }

  // id, label, fx, fy. The multipliers are what the host actually uses;
  // the id survives only so an older host still resolves something.
  var ANCHOR_CELLS = [
    ["tl", "Top left",      0,   0  ],
    ["tc", "Top centre",    0.5, 0  ],
    ["tr", "Top right",     1,   0  ],
    ["ml", "Middle left",   0,   0.5],
    ["mc", "Centre",        0.5, 0.5],
    ["mr", "Middle right",  1,   0.5],
    ["bl", "Bottom left",   0,   1  ],
    ["bc", "Bottom centre", 0.5, 1  ],
    ["br", "Bottom right",  1,   1  ]
  ];

  /* ---------- status ---------- */

  function report(tone, message) {
    status.setAttribute("data-tone", tone);
    statusText.textContent = message;
  }

  /* ---------- calling the host ---------- */

  /**
   * Values written as "@stateKey" in a registry entry resolve at call time.
   * A dotted path ("@easeBuffer.ease") reaches inside the stored object.
   */
  function readPath(path) {
    var parts = path.split(".");
    var value = State.get(parts[0]);
    for (var i = 1; i < parts.length && value != null; i++) {
      value = value[parts[i]];
    }
    return value;
  }

  function resolveArgs(args) {
    var out = {};
    for (var k in args) {
      if (!args.hasOwnProperty(k)) { continue; }
      var v = args[k];
      out[k] = (typeof v === "string" && v.charAt(0) === "@")
        ? readPath(v.slice(1))
        : v;
    }
    return out;
  }

  function call(toolId, item, event) {
    var payload = resolveArgs((item && item.args) || {});
    payload.mod = {
      alt: !!(event && event.altKey),
      shift: !!(event && event.shiftKey),
      ctrl: !!(event && (event.ctrlKey || event.metaKey))
    };

    report("", "Working\u2026");

    Bridge.run(toolId, payload).then(function (res) {
      if (res.ok && item && item.store) {
        State.set(item.store, res.data);
      }
      report(res.ok ? "ok" : "warn", res.message || (res.ok ? "Done" : "Nothing happened"));
    }).catch(function (err) {
      report("error", err.message);
    });
  }

  /* ---------- rendering ---------- */

  /** Span hints are applied in one place, whatever the item type. */
  function place(el, item) {
    if (item.cols > 1) { el.style.gridColumn = "span " + item.cols; }
    if (item.rows > 1) { el.style.gridRow = "span " + item.rows; }
    return el;
  }

  function toolButton(item) {
    var btn = document.createElement("button");
    btn.className = "tool" +
      (item.primary ? " is-primary" : "") +
      (item.pill ? " is-pill" : "");
    btn.type = "button";
    btn.title = item.tip || "";

    // A pill tool needs no icon: the slab is the picture of what it makes.
    btn.innerHTML = (item.pill ? "" : (Icons[item.icon] || "")) +
      '<span class="tool-label">' + item.label + "</span>";

    btn.addEventListener("click", function (e) { call(item.tool, item, e); });

    return btn;
  }

  function anchorGrid(item) {
    var wrap = document.createElement("div");
    wrap.className = "anchor-grid";
    wrap.title = item.tip || "";

    ANCHOR_CELLS.forEach(function (cell) {
      var b = document.createElement("button");
      b.className = "anchor-cell";
      b.type = "button";
      b.setAttribute("aria-label", cell[1]);
      b.title = cell[1];
      b.setAttribute("data-fx", String(cell[2]));
      b.setAttribute("data-fy", String(cell[3]));
      b.innerHTML = anchorGlyph(cell[2], cell[3]);
      b.addEventListener("click", function (e) {
        call(item.tool, {
          args: { preset: cell[0], fx: cell[2], fy: cell[3] }
        }, e);
      });
      wrap.appendChild(b);
    });

    return wrap;
  }

  function selectControl(item) {
    var wrap = document.createElement("label");
    wrap.className = "select";

    var sel = document.createElement("select");
    sel.setAttribute("aria-label", item.label);

    item.options.forEach(function (opt) {
      var o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (State.get(item.key) === opt.value) { o.selected = true; }
      sel.appendChild(o);
    });

    sel.addEventListener("change", function () {
      State.set(item.key, sel.value);
    });

    wrap.appendChild(sel);
    return wrap;
  }

  function render() {
    var grid = document.createElement("div");
    grid.className = "grid";

    Registry.forEach(function (item) {
      var el;
      if (item.type === "anchorGrid") { el = anchorGrid(item); }
      else if (item.type === "select") { el = selectControl(item); }
      else { el = toolButton(item); }
      grid.appendChild(place(el, item));
    });

    panel.appendChild(grid);
  }

  /* ---------- boot ---------- */

  render();

  // Verifies the bridge on load, so a broken install is visible immediately
  // rather than on the first real click.
  Bridge.run("sys.ping", {}).then(function (res) {
    report(res.ok ? "ok" : "warn", res.message);
  }).catch(function (err) {
    report("error", err.message);
  });
})();
