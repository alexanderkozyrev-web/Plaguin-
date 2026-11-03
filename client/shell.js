/**
 * Spilio Studio 1.3.2 — shell.
 *
 * Responsibilities, in full:
 *   1. make sure the four host modules got evaluated;
 *   2. switch tabs, mounting each module's iframe the first time it is opened;
 *   3. remember which tab was open;
 *   4. say something useful if a frame comes up without its CEP host.
 *
 * It never touches the modules' own state. Each iframe is an ordinary
 * standalone panel that happens to be borrowing __adobe_cep__ from this
 * window (see client/cep-bridge.js).
 *
 * CSInterface.js is not loaded here on purpose: the two calls needed —
 * evalScript and getSystemPath — are one line each against the raw CEP API,
 * the same choice Motion Kit's bridge already makes.
 */

(function () {
  "use strict";

  var TABS = ["motion", "tags", "subs", "org"];
  var STORE_KEY = "fitme.studio.tab";

  var cep = window.__adobe_cep__ || null;

  var tabs  = {};
  var panes = {};
  var mounted = {};

  var fault      = document.getElementById("fault");
  var faultTitle = document.getElementById("faultTitle");
  var faultBody  = document.getElementById("faultBody");
  var faultRetry = document.getElementById("faultRetry");

  var diagBox   = document.getElementById("diag");
  var diagBody  = document.getElementById("diagBody");
  var diagCopy  = document.getElementById("diagCopy");
  var diagClose = document.getElementById("diagClose");
  var studioWord = document.getElementById("studioWord");

  var lastStatus = null;

  /* ---------------------------------------------------------------- host */

  function evalScript(code) {
    return new Promise(function (resolve, reject) {
      if (!cep) { reject(new Error("No CEP host. Open this panel inside After Effects.")); return; }
      cep.evalScript(code, function (raw) {
        if (raw === "EvalScript error.") { reject(new Error("The host script failed to load.")); return; }
        resolve(raw);
      });
    });
  }

  function readStatus(raw) {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  /**
   * The host is one generated file that AE evaluates at global scope, so by
   * the time the panel runs the four modules are either there or the script
   * threw. Nothing to load, nothing to resolve — this just asks which of the
   * four APIs actually answer.
   *
   * FitMeStudio.status() probes real symbols (organizeProject, MK.run, and so
   * on) rather than a "loaded" flag. 1.0.1 shipped with org.jsx evaluating
   * without error and still leaving nothing callable behind; a flag would have
   * reported that as healthy.
   */
  function bootHost() {
    if (!cep) { return Promise.resolve(null); }

    return evalScript("(typeof FitMeStudio === 'object' && FitMeStudio.status) ? FitMeStudio.status() : ''")
      .then(function (raw) { lastStatus = readStatus(raw); return lastStatus; })
      .catch(function () { lastStatus = null; return null; });
  }

  /* ----------------------------------------------------------- diagnostics */

  /**
   * Everything needed to tell why a module is dead, in one copyable block.
   *
   * A module that renders but does nothing is almost always a throw at the top
   * of its main.js — OrganizeMe calls require() there, and a miss aborts the
   * file before a single button is wired. The frame report below carries the
   * captured uncaught errors, so that case names itself instead of having to
   * be guessed at.
   */
  function buildDiagnostics() {
    var lines = [];
    var i, name, frame, d;

    lines.push("Spilio Studio 1.3.2");
    lines.push("shell __adobe_cep__ : " + (cep ? "yes" : "NO"));
    lines.push("shell require       : " + (typeof window.require === "function" ? "yes" : "no"));
    lines.push("shell cep.fs        : " + (window.cep && window.cep.fs ? "yes" : "no"));
    lines.push("");
    lines.push("host: " + (lastStatus ? JSON.stringify(lastStatus) : "no response"));
    lines.push("");

    for (i = 0; i < TABS.length; i++) {
      name = TABS[i];
      frame = mounted[name];

      if (!frame) {
        lines.push(name.toUpperCase() + ": tab not opened yet");
        lines.push("");
        continue;
      }

      d = null;
      try { d = frame.contentWindow.__FITME_STUDIO_DIAG__; } catch (e) {}

      if (!d) {
        lines.push(name.toUpperCase() + ": bridge did not run (cep-bridge.js missing or blocked)");
        lines.push("");
        continue;
      }

      lines.push(name.toUpperCase());
      lines.push("  __adobe_cep__ : " + (d.cep ? "yes (" + d.cepFrom + ")" : "NO"));
      lines.push("  cep.fs        : " + (d.fs ? "yes" : "no"));
      lines.push("  require       : " + (d.node ? "yes (" + d.requireFrom + ")" : "NO"));
      lines.push("  require works : " + (d.requireWorks ? "yes" : "NO"));
      lines.push("  mixed context : " + (d.mixedContext ? "yes" : "no"));
      lines.push("  errors        : " + (d.errors && d.errors.length ? "" : "none"));

      if (d.errors && d.errors.length) {
        for (var k = 0; k < d.errors.length; k++) { lines.push("    " + d.errors[k]); }
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  function openDiagnostics() {
    // Mount every tab first, otherwise the report only covers what was opened.
    for (var i = 0; i < TABS.length; i++) { mount(TABS[i]); }

    diagBody.textContent = "Collecting\u2026";
    diagBox.classList.remove("hidden");

    bootHost().then(function () {
      setTimeout(function () { diagBody.textContent = buildDiagnostics(); }, 400);
    });
  }

  /* --------------------------------------------------------------- faults */

  function showFault(title, body) {
    faultTitle.textContent = title;
    faultBody.textContent  = body;
    fault.classList.remove("hidden");
  }

  function hideFault() { fault.classList.add("hidden"); }

  function reportHost(st) {
    if (!cep) {
      showFault("Not running inside After Effects",
                "This panel needs the CEP host. Open it from Window \u2192 Extensions.");
      return;
    }
    if (!st) {
      showFault("Host script did not respond",
                "FitMeStudio.status() returned nothing, which means host/index.jsx never " +
                "finished evaluating. Reopen the panel; if it persists, rebuild the host " +
                "with tools/gen-host.py.");
      return;
    }
    if (st.ready) { hideFault(); return; }

    var missing = [];
    for (var k in st.modules) {
      if (Object.prototype.hasOwnProperty.call(st.modules, k) && !st.modules[k]) { missing.push(k); }
    }

    showFault("Host API missing: " + (missing.join(", ") || "unknown"),
              "The host script is one generated file, so a module that reports missing here\n" +
              "threw while AE was evaluating it — everything after the throw is gone too.\n" +
              "Rebuild with tools/gen-host.py and check the module listed first.");
  }

  /**
   * A frame that came up without CEP or without Node is not going to work,
   * and the module inside it will usually fail with something vague. Checking
   * the marker the shim leaves behind turns that into one clear line.
   * Node is only required by Org; the rest just need the transport.
   */
  function checkFrame(name, frame) {
    var needsNode = (name === "org");
    var probe;

    try { probe = frame.contentWindow.__FITME_STUDIO_BRIDGE__; }
    catch (e) { return; }

    if (!probe) { return; }

    var lacks = [];
    if (!probe.cep) { lacks.push("evalScript transport (__adobe_cep__)"); }
    if (needsNode && !probe.node) { lacks.push("Node.js (require)"); }
    if (name === "subs" && !probe.fs) { lacks.push("window.cep.fs"); }

    if (!lacks.length) { return; }

    showFault(name.toUpperCase() + " could not reach the CEP host",
              "Missing in this frame: " + lacks.join(", ") + ".\n" +
              "The module works standalone, so this is the iframe bridge, not the module. " +
              "Check that --enable-nodejs is in the manifest and that PlayerDebugMode is set.");
  }

  /* ----------------------------------------------------------------- tabs */

  function mount(name) {
    if (mounted[name]) { return; }

    var pane  = panes[name];
    var frame = document.createElement("iframe");

    frame.id    = "frame-" + name;
    frame.title = name;
    frame.setAttribute("role", "tabpanel");

    frame.addEventListener("load", function () {
      // one tick, so the shim's marker and the module's own boot have landed
      setTimeout(function () { checkFrame(name, frame); }, 0);
    });

    frame.src = pane.getAttribute("data-src");
    pane.appendChild(frame);
    mounted[name] = frame;
  }

  function select(name) {
    if (TABS.indexOf(name) === -1) { name = TABS[0]; }

    TABS.forEach(function (t) {
      var on = (t === name);
      tabs[t].setAttribute("aria-selected", on ? "true" : "false");
      panes[t].classList.toggle("active", on);
    });

    mount(name);

    try { window.localStorage.setItem(STORE_KEY, name); } catch (e) {}
  }

  function restore() {
    var saved = null;
    try { saved = window.localStorage.getItem(STORE_KEY); } catch (e) {}
    return TABS.indexOf(saved) === -1 ? TABS[0] : saved;
  }

  /* ----------------------------------------------------------------- init */

  TABS.forEach(function (name) {
    tabs[name]  = document.querySelector('.studio-tab[data-tab="' + name + '"]');
    panes[name] = document.getElementById("pane-" + name);

    tabs[name].addEventListener("click", function () { select(name); });
  });

  // Left/right arrows move between tabs, the way a tablist is expected to work.
  document.querySelector(".studio-tabs").addEventListener("keydown", function (ev) {
    var step = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
    if (!step) { return; }

    var current = TABS.filter(function (t) {
      return tabs[t].getAttribute("aria-selected") === "true";
    })[0] || TABS[0];

    var next = TABS[(TABS.indexOf(current) + step + TABS.length) % TABS.length];
    tabs[next].focus();
    select(next);
    ev.preventDefault();
  });

  studioWord.addEventListener("click", openDiagnostics);
  studioWord.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" || ev.key === " ") { openDiagnostics(); ev.preventDefault(); }
  });

  diagClose.addEventListener("click", function () { diagBox.classList.add("hidden"); });

  diagCopy.addEventListener("click", function () {
    var text = diagBody.textContent;
    try {
      window.navigator.clipboard.writeText(text);
      diagCopy.textContent = "Copied";
      setTimeout(function () { diagCopy.textContent = "Copy"; }, 1200);
    } catch (e) {
      // Older CEF: fall back to selecting the block so Cmd-C works.
      var range = document.createRange();
      range.selectNodeContents(diagBody);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });

  faultRetry.addEventListener("click", function () {
    hideFault();
    bootHost().then(reportHost);
  });

  bootHost().then(function (st) {
    reportHost(st);
    select(restore());
  });
})();
