/**
 * FitMe Studio — CEP bridge shim.
 *
 * Every sub-panel runs inside an <iframe>. CEP injects its host objects —
 * __adobe_cep__, window.cep, and the Node require — into the TOP frame only,
 * unless the manifest asks for --mixed-context, which merges the Node and
 * browser contexts so every frame gets them. The manifest does ask for it, so
 * in a healthy install the borrowing below finds everything already present
 * and does nothing at all. It stays as a fallback for hosts where mixed
 * context is unavailable or ignored.
 *
 * All frames are same-origin (file://), so a child can borrow from its parent.
 *
 * This is one of two lines added to any sub-panel's HTML (the other is
 * in-frame.css). Remove them and the panel is byte-identical to its standalone
 * build again — that is the rollback path.
 *
 * Must load BEFORE CSInterface.js and before any panel script: Motion Kit's
 * bridge.js caches window.__adobe_cep__ at evaluation time, and OrganizeMe
 * calls require() at the top level of main.js, where a miss aborts the whole
 * file and leaves every button unwired.
 */

(function (w) {
  "use strict";

  var diag = {
    frame: "unknown",
    mixedContext: false,
    cep: false,
    fs: false,
    node: false,
    requireWorks: false,
    requireFrom: "none",
    cepFrom: "none",
    errors: []
  };

  try { diag.frame = String((w.location && w.location.pathname) || "unknown"); } catch (e) {}

  // Uncaught errors are the whole story when a panel renders but does nothing:
  // a throw at the top of main.js stops the file before it wires any handler.
  try {
    w.addEventListener("error", function (ev) {
      if (diag.errors.length > 12) { return; }
      diag.errors.push(
        String(ev.message || "error") +
        (ev.filename ? "  @ " + String(ev.filename).split("/").pop() : "") +
        (ev.lineno ? ":" + ev.lineno : "")
      );
    });
  } catch (e) {}

  /* ---------------------------------------------------------- candidates */

  // Where to look, nearest first. In mixed context the frame itself already
  // has everything and the rest are never reached.
  function frames() {
    var out = [{ name: "self", win: w }];
    try { if (w.parent && w.parent !== w) { out.push({ name: "parent", win: w.parent }); } } catch (e) {}
    try { if (w.top && w.top !== w && w.top !== w.parent) { out.push({ name: "top", win: w.top }); } } catch (e) {}
    return out;
  }

  var list = frames();
  var i, f;

  /* ------------------------------------------------- __adobe_cep__ / cep */

  for (i = 0; i < list.length; i++) {
    f = list[i];
    try {
      if (!w.__adobe_cep__ && f.win.__adobe_cep__) { w.__adobe_cep__ = f.win.__adobe_cep__; }
      if (w.__adobe_cep__) { diag.cepFrom = f.name; break; }
    } catch (e) {}
  }

  for (i = 0; i < list.length; i++) {
    try {
      if (!w.cep && list[i].win.cep) { w.cep = list[i].win.cep; }
      if (w.cep) { break; }
    } catch (e) {}
  }

  /* ---------------------------------------------------------------- Node */

  // require() sits in one of three places depending on how CEP was set up:
  // a plain global (mixed context, or the top frame), or behind cep_node.
  for (i = 0; i < list.length && typeof w.require !== "function"; i++) {
    f = list[i];

    try {
      if (typeof f.win.require === "function") {
        w.require = f.win.require;
        diag.requireFrom = f.name + ".require";
      }
    } catch (e) {}

    if (typeof w.require === "function") { break; }

    try {
      if (f.win.cep_node && typeof f.win.cep_node.require === "function") {
        if (!w.cep_node) { w.cep_node = f.win.cep_node; }
        w.require = f.win.cep_node.require;
        diag.requireFrom = f.name + ".cep_node.require";
      }
    } catch (e) {}
  }

  /* -------------------------------------------------------------- report */

  try {
    diag.cep = !!w.__adobe_cep__;
    diag.fs = !!(w.cep && w.cep.fs);
    diag.node = typeof w.require === "function";
    diag.mixedContext = (diag.requireFrom.indexOf("self") === 0);

    // Prove require actually works rather than merely existing — a function
    // borrowed across frames can still throw when it runs.
    if (diag.node) {
      try {
        w.require("path");
        diag.requireWorks = true;
      } catch (e) {
        diag.requireWorks = false;
        diag.errors.push("require('path') threw: " + String((e && e.message) ? e.message : e));
      }
    }
  } catch (e) {}

  try { w.__FITME_STUDIO_DIAG__ = diag; } catch (e) {}

  // Kept for the shell's frame check.
  try {
    w.__FITME_STUDIO_BRIDGE__ = { cep: diag.cep, fs: diag.fs, node: diag.node && diag.requireWorks };
  } catch (e) {}

  // Lets in-frame.css trim the module's own title row. Set on <html> rather
  // than <body>, which does not exist yet at this point in <head>.
  try {
    if (w !== w.parent) { w.document.documentElement.setAttribute("data-fitme-studio", "1"); }
  } catch (e) {}
})(window);
