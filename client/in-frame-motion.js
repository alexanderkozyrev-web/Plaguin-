/**
 * FitMe Studio — Motion panel, in-frame additions.
 *
 * Adds the Disclaimer and CTA buttons and enlarges the Text to Box icon,
 * without touching a single one of Motion Kit's own client files.
 *
 * It appends real DOM rather than pushing entries into window.Registry,
 * because Registry is consumed by main.js at load and this file runs first
 * (it sits in <head>, main.js at the end of <body>). By DOMContentLoaded the
 * grid is already rendered, so the buttons are built to match what
 * toolButton() produces — same classes, same markup shape — and go through
 * window.Bridge exactly as every other tool does. The host side is
 * host/modules/studio-inserts.jsx.
 *
 * The extension path is passed down with each call because the host tools
 * need to find assets/fitme-studio-templates.aep, and $.fileName comes back
 * empty when AE evaluates a ScriptPath. Note the decodeURI: the raw CEP API
 * returns that path URI-encoded, and on macOS it runs through "Application
 * Support" — forgetting the decode is what broke 1.0.0.
 *
 * Defensive throughout. If the grid, the Bridge or the status line are not
 * where this expects, it adds nothing and the panel is untouched.
 */

(function () {
  "use strict";

  var INSERTS = [
    {
      tool: "studio.disclaimer",
      label: "Disclaimer",
      icon: '<path d="M4 7h16M4 12h16M4 17h16" stroke-width="2.6"/>',
      tip: "Insert the standard Generative-AI disclaimer as box text, tagged " +
           "[text], across the full length of the comp and above every other layer."
    },
    {
      tool: "studio.cta",
      label: "CTA",
      icon: '<path d="M6 6.5l6 6 6-6" stroke-width="2.6"/>' +
            '<path d="M6 13l6 6 6-6" stroke-width="2.6"/>',
      tip: "Insert the CTA block — \"Tap the screen!\" box text tagged [text], " +
           "the animated chevrons and the blackout — starting at the playhead " +
           "and running to the end of the comp, capped at 15s.\n" +
           "Sits above everything except a disclaimer layer."
    }
  ];

  function svg(body) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
           'aria-hidden="true">' + body + "</svg>";
  }

  function extensionPath() {
    var cep = window.__adobe_cep__;
    if (!cep) { return ""; }
    try { return decodeURI(cep.getSystemPath("extension")); } catch (e) { return ""; }
  }

  function report(tone, message) {
    var box = document.getElementById("status");
    var text = document.getElementById("status-text");
    if (box) { box.setAttribute("data-tone", tone); }
    if (text) { text.textContent = message; }
  }

  /** The tool button whose label reads exactly `label`, or null. */
  function toolByLabel(label) {
    var labels = document.querySelectorAll(".tool .tool-label");
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].textContent.toLowerCase() === label) { return labels[i].parentNode; }
    }
    return null;
  }

  function build(spec) {
    var button = document.createElement("button");

    button.className = "tool is-inline";
    button.type = "button";
    button.title = spec.tip;
    button.style.gridColumn = "span 2";
    button.innerHTML = svg(spec.icon) +
                       '<span class="tool-label">' + spec.label + "</span>";

    button.addEventListener("click", function () {
      if (!window.Bridge) { report("error", "Bridge not loaded."); return; }

      report("", "Working\u2026");

      window.Bridge.run(spec.tool, { extensionPath: extensionPath() })
        .then(function (res) {
          report(res.ok ? "ok" : "warn", res.message || (res.ok ? "Done" : "Nothing happened"));
        })
        .catch(function (err) {
          report("error", err.message);
        });
    });

    return button;
  }


  /* ------------------------------------------------------------ BODY bar */

  /**
   * A search bar at the top of MOTION, above the anchor grid.
   *
   * Deliberately a combo box and not a file browser. The Drive Explorer
   * panel it borrows its plumbing from is a folder tree with modals and a
   * debug pane — 1500 lines that would swallow this tab. Here the folder is
   * fixed and every result is a BODY, so the whole interaction is: type,
   * pick, done, and the bar collapses back to a bar.
   */
  function buildBodyBar() {
    var wrap = document.createElement("div");
    wrap.className = "fms-body";

    wrap.innerHTML =
      '<div class="fms-body-row">' +
        '<input class="fms-body-input" type="text" spellcheck="false" ' +
               'placeholder="Search body renders\u2026" aria-label="Search body renders">' +
        '<button class="fms-body-btn" type="button" data-act="refresh" title="Rebuild the index from Drive">\u21bb</button>' +
        '<button class="fms-body-btn" type="button" data-act="settings" title="Drive settings">\u2699</button>' +
      '</div>' +
      '<ul class="fms-body-list" hidden></ul>' +
      '<div class="fms-body-settings" hidden>' +
        '<div class="fms-body-auth">' +
          '<span class="fms-body-authstate" data-authstate>\u2014</span>' +
          '<button class="fms-body-btn" type="button" data-act="google">Connect Google</button>' +
        '</div>' +


      '</div>';

    return wrap;
  }

  function installBody() {
    var panel = document.getElementById("panel");
    var grid = panel && panel.querySelector(".grid");
    if (!panel || !grid || !window.FitMeBody) { return; }

    var B = window.FitMeBody;
    var bar = buildBodyBar();
    panel.insertBefore(bar, grid);

    var input = bar.querySelector(".fms-body-input");
    var list = bar.querySelector(".fms-body-list");
    var cfgBox = bar.querySelector(".fms-body-settings");

    var rows = null;
    var busy = false;

    function close() { list.hidden = true; list.innerHTML = ""; }

    function showAuth() {
      var G = window.FitMeGoogle;
      var state = cfgBox.querySelector("[data-authstate]");
      var button = cfgBox.querySelector('[data-act="google"]');
      if (!state || !button) { return; }

      var on = !!(G && G.connected());
      state.textContent = on ? "Signed in to Google" : "Not signed in";
      state.className = "fms-body-authstate" + (on ? " is-on" : "");
      button.textContent = on ? "Disconnect" : "Connect Google";
    }

    function li(cls, html) {
      var el = document.createElement("li");
      el.className = cls;
      el.innerHTML = html;
      return el;
    }

    function note(text) {
      list.innerHTML = "";
      list.appendChild(li("fms-body-empty", text));
      list.hidden = false;
    }

    /* -------- step one: the bodies themselves -------- */

    function showBodies(hits) {
      list.innerHTML = "";

      if (!hits.length) { note("Nothing matches."); return; }

      for (var i = 0; i < hits.length; i++) {
        (function (hit) {
          // Some bodies carry fifteen locales. Shown in full they wrap onto
          // three lines and squeeze the name out of the row, so the row keeps
          // the first few and counts the rest; the full list is in the title.
          var CHIP_LIMIT = 5;
          var shown = hit.locales.slice(0, CHIP_LIMIT);
          var rest = hit.locales.length - shown.length;

          var chips = shown.map(function (l) {
            return '<span class="fms-chip' + (l === "EN" ? " is-en" : "") + '">' + l + "</span>";
          }).join("") + (rest > 0 ? '<span class="fms-chip is-more">+' + rest + "</span>" : "");

          var el = li("fms-body-item is-body",
            '<span class="fms-body-name">' + hit.row.name + "</span>" +
            '<span class="fms-body-chips">' + chips + "</span>");

          el.title = (hit.row.template || hit.row.name) +
                     (hit.locales.length ? "\n" + hit.locales.join(" ") : "");
          el.addEventListener("click", function () { openBody(hit.row); });
          list.appendChild(el);
        })(hits[i]);
      }

      list.hidden = false;
    }

    /* -------- step two: the files in that body's folder -------- */

    function openBody(row) {
      note("Opening " + row.name + "\u2026");

      B.filesIn(row.folderId, function (n) {
        if (n) { note("Opening " + row.name + "\u2026 " + n + " files"); }
      })
        .then(function (files) {
          if (!files.length) {
            // Distinguish the two cases that look identical from outside:
            // subfolders were found but held nothing, versus nothing came
            // back at all — which on Drive usually means no access rather
            // than an empty folder, since it answers 200 either way.
            note(B.sawFolders()
              ? "Found subfolders under " + row.name + " but no files in them. Folder: " + row.folderId
              : "Nothing came back for " + row.name + ". Either the folder is empty, or the " +
                "Google account you signed in with cannot see it. Folder: " + row.folderId);
            return;
          }

          list.innerHTML = "";

          var back = li("fms-body-back", "\u2190 " + row.name);
          back.addEventListener("click", function () { runSearch(input.value); });
          list.appendChild(back);

          // Renders only. If nothing matches the naming, show everything
          // rather than an empty list — a folder named differently should
          // look unusual, not broken.
          var renders = [];
          for (var f = 0; f < files.length; f++) {
            if (B.isBodyFile(files[f].name)) { renders.push(files[f]); }
          }
          var looseNames = (renders.length === 0);
          if (looseNames) { renders = files; }

          var ordered = B.orderFiles(renders);

          if (looseNames) {
            list.appendChild(li("fms-body-empty",
              "No file here matches BODY_…_9x16-EN — showing everything."));
          }
          for (var i = 0; i < ordered.length; i++) {
            (function (file) {
              var el = li("fms-body-item",
                '<span class="fms-body-name">' + file.name.replace(/\.[^.]+$/, "") + "</span>" +
                (file.trail ? '<span class="fms-body-trail">' + file.trail + "</span>" : ""));
              el.title = (file.trail ? file.trail + "/" : "") + file.name;
              el.addEventListener("click", function () { choose(file); });
              list.appendChild(el);
            })(ordered[i]);
          }

          list.hidden = false;
        })
        .catch(function (err) { note(err.message); });
    }

    /* -------- catalogue -------- */

    async function catalogue(force) {
      if (rows && !force) { return rows; }

      var cached = B.cachedIndex();
      if (cached && cached.rows && !force) {
        rows = cached.rows;
        if (cached.stale) { reload(true); }   // serve now, refresh behind
        return rows;
      }

      report("", "Reading the body catalogue\u2026");
      rows = await B.loadCatalogue(function (n) {
        report("", "Reading the body catalogue\u2026 " + n);
      });
      report("ok", "Body catalogue: " + rows.length + " bodies");
      return rows;
    }

    function reload(quiet) {
      B.loadCatalogue(function () {})
        .then(function (r) {
          rows = r;
          if (!quiet) { report("ok", "Catalogue refreshed: " + r.length + " bodies"); }
        })
        .catch(function (err) { if (!quiet) { report("error", err.message); } });
    }

    function runSearch(term) {
      if (!String(term || "").trim()) { close(); return; }

      catalogue(false)
        .then(function (r) { showBodies(B.searchBodies(r, term)); })
        .catch(function (err) { note(err.message); });
    }

    /* -------- download and import -------- */

    /**
     * Progress goes in the dropdown, not only the footer status line.
     *
     * The footer sits at the bottom of the tab and is easily off-screen in a
     * docked panel, so a 78 MB download reported only there looks exactly
     * like a click that did nothing. Under the search bar it is unmissable.
     */
    function progress(text, tone) {
      list.innerHTML = "";
      var el = li("fms-body-progress" + (tone ? " is-" + tone : ""), text);
      list.appendChild(el);
      list.hidden = false;
    }

    /**
     * Did the layer actually land?
     *
     * Two attempts at reading the host's own reply failed for the same
     * underlying reason: CEP hands back an empty string while the import is
     * still running, and every follow-up question queues behind that same
     * busy script. Chasing the reply was the wrong idea — the reply is not
     * the fact. The fact is whether the comp now contains the layer.
     *
     * So ask AE that instead. One cheap loop over the active comp's layer
     * names, which costs nothing and cannot be ambiguous.
     */
    async function landed(fileName) {
      var probe =
        "(function(){" +
        "var c = app.project.activeItem;" +
        "if (!(c instanceof CompItem)) { return '0'; }" +
        "for (var i = 1; i <= c.numLayers; i++) {" +
        "  if (c.layer(i).name.indexOf(" + JSON.stringify(fileName) + ") === 0) { return '1'; }" +
        "}" +
        "return '0';" +
        "})()";

      try {
        var raw = await window.Bridge.evalScript(probe);
        return String(raw).charAt(0) === "1";
      } catch (e) {
        return false;
      }
    }

    /**
     * Wait for the import to show up in the timeline, however long AE takes.
     * Reports seconds so a slow import reads as work in progress rather than
     * a frozen panel.
     */
    async function confirm(file) {
      for (var i = 0; i < 60; i++) {           // 60 x 500ms = 30s
        if (await landed(file.name)) { return true; }
        await new Promise(function (r) { setTimeout(r, 500); });
        progress("Importing\u2026 " + Math.round((i + 1) * 0.5) + "s");
      }
      return false;
    }

    async function choose(file) {
      if (busy) { return; }
      busy = true;

      var label = file.name.replace(/\.[^.]+$/, "");
      input.value = label;

      try {
        progress("Starting\u2026");
        report("", "Downloading " + file.name + "\u2026");

        var got = await B.download(file, function (pct) {
          progress("Downloading " + pct + "%");
          report("", "Downloading " + file.name + "\u2026 " + pct + "%");
        });

        progress(got.cached ? "Already downloaded, importing\u2026" : "Importing\u2026");
        report("", got.cached ? "Already cached, importing\u2026" : "Importing\u2026");

        var res = await window.Bridge.run("studio.importBody", {
          pathHex: B.toHex(got.path)
        });

        // An empty reply is not a failure here — CEP simply gave up waiting
        // on a script that is still working. Only the comp can settle it.
        if (!res || !res.ok) {
          if (await confirm(file)) {
            res = { ok: true, message: "Added " + file.name + "." };
          } else if (!res || !res.message || res.message.indexOf("Unreadable") === 0) {
            res = { ok: false, message: "After Effects did not add the layer. Open a comp and try again." };
          }
        }

        report(res.ok ? "ok" : "warn", res.message || "Done");

        if (res.ok) {
          progress("Added \u2014 " + label, "ok");
          setTimeout(function () { if (!busy) { close(); } }, 1600);
        } else {
          progress(res.message || "Nothing happened", "error");
        }
      } catch (err) {
        progress(err.message, "error");
        report("error", err.message);
      } finally {
        busy = false;
      }
    }

    /* -------- wiring -------- */

    var timer = null;
    input.addEventListener("input", function () {
      if (timer) { clearTimeout(timer); }
      var term = input.value;
      if (!term.trim()) { close(); return; }
      timer = setTimeout(function () { runSearch(term); }, 90);
    });

    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") { close(); input.blur(); }
    });

    document.addEventListener("click", function (ev) {
      // A click on a result rewrites the list, which detaches the very node
      // that was clicked. By the time the event reaches document, that node
      // is no longer inside bar — or inside anything — so a plain contains()
      // check reads it as an outside click and closes the list that was just
      // drawn. Nothing appears to happen at all. Ignore detached targets.
      if (!ev.target || !ev.target.isConnected) { return; }
      if (!bar.contains(ev.target)) { close(); }
    });

    bar.addEventListener("click", function (ev) {
      var act = ev.target.getAttribute && ev.target.getAttribute("data-act");
      if (!act) { return; }

      if (act === "refresh") { report("", "Refreshing\u2026"); reload(false); }

      if (act === "google") {
        var G = window.FitMeGoogle;
        if (!G) { report("error", "Sign-in module missing."); return; }

        if (G.connected()) {
          G.disconnect();
          rows = null;
          try { window.localStorage.removeItem(B.settingsKeys.index); } catch (e) {}
          showAuth();
          report("ok", "Disconnected from Google.");
          return;
        }

        report("", "Waiting for Google in your browser\u2026");
        G.connect()
          .then(function () {
            rows = null;
            try { window.localStorage.removeItem(B.settingsKeys.index); } catch (e) {}
            showAuth();
            report("ok", "Connected. The catalogue will be re-read on the next search.");
          })
          .catch(function (err) {
            showAuth();
            report("error", err.message === "NOT_CONNECTED" ? "Sign-in cancelled." : err.message);
          });
      }

      if (act === "settings") {
        showAuth();
        cfgBox.hidden = !cfgBox.hidden;
      }

    });

    if (!B.hasNode()) {
      input.disabled = true;
      input.placeholder = "Body search needs Node \u2014 see diagnostics";
    }
  }

  function install() {
    var grid = document.querySelector("#panel .grid");
    if (!grid) { return; }

    for (var i = 0; i < INSERTS.length; i++) { grid.appendChild(build(INSERTS[i])); }

    // Square tools must stay square at every panel width, and wide ones must
    // stay wide. The grid only knows how many columns a tool spans, so the
    // span is read back off each button and turned into a class the CSS can
    // hold an aspect ratio against.
    var tools = document.querySelectorAll("#panel .grid .tool");
    for (var t = 0; t < tools.length; t++) {
      var span = "";
      try { span = window.getComputedStyle(tools[t]).gridColumnEnd || ""; } catch (e) {}
      var wide = (span.indexOf("span 2") === 0) || (tools[t].style.gridColumn.indexOf("span 2") === 0);
      tools[t].className += wide ? " fms-wide" : " fms-square";
    }

    // "Pre-render any layers" breaks where the meaning breaks, not wherever
    // the box happens to run out. CSS cannot choose the point, so the break
    // is written into the label.
    // Break where the meaning breaks, not wherever the box runs out. CSS
    // cannot choose the point, so the break is written into the label.
    // Ease Copy matches Ease Paste, which wraps on its own at most widths —
    // left to chance the two sat on different numbers of lines.
    var twoLine = [
      ["pre-render any layers", "Pre-render<br>any layers"],
      ["ease copy", "Ease<br>Copy"],
      ["ease paste", "Ease<br>Paste"]
    ];
    for (var n = 0; n < twoLine.length; n++) {
      var btn = toolByLabel(twoLine[n][0]);
      if (!btn) { continue; }
      var lbl = btn.querySelector(".tool-label");
      if (lbl) { lbl.innerHTML = twoLine[n][1]; }
    }

    // TEXT WRAP is drawn as its own label inside a selection frame — the
    // button shows what the tool produces rather than a picture of it.
    var wrap = toolByLabel("text wrap");
    if (wrap) {
      wrap.className += " fms-framed";
      var svgEl = wrap.querySelector("svg");
      if (svgEl) { svgEl.parentNode.removeChild(svgEl); }
    }

    try { installBody(); } catch (e) { report("error", "Body bar: " + e.message); }

    document.documentElement.className += " fms-motion-ready";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();
