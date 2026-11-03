/**
 * FitMe Studio — Tags panel, in-frame layout tweak.
 *
 * Under the Studio shell the Tags module shows a second title bar
 * ("ROBERT_VITALIK V1.0.0 — AE Localization Prep") directly beneath the FitMe
 * logo, and its only live control, Refresh, is stranded up there. The "managed
 * suffixes" pill next to TAG LAYERS is a static label rather than state, so it
 * is the natural place for Refresh to go.
 *
 * CSS can hide both of those, but moving a button between containers needs the
 * DOM, which is why this file exists instead of another rule in in-frame.css.
 *
 * Deliberately conservative. If the module's markup changes and the ids or the
 * header are not where this expects, nothing is moved and nothing is hidden —
 * the panel keeps its original layout, with the Refresh button still reachable.
 * That is what the fms-tags-moved class gates: in-frame.css only hides the
 * title bar once the button has actually been relocated out of it.
 *
 * Runs only inside the shell. Opened standalone, the module is untouched.
 */

(function () {
  "use strict";

  if (window === window.parent) { return; }

  function relocate() {
    var button = document.getElementById("refreshSelection");
    var title = document.getElementById("actionsTitle");

    if (!button || !title) { return; }

    var header = title.parentNode;
    if (!header || header.className.indexOf("card-header") === -1) { return; }

    // .card-header is justify-content: space-between, so appending puts the
    // button hard right — exactly where the pill sat.
    header.appendChild(button);

    document.documentElement.className += " fms-tags-moved";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", relocate);
  } else {
    relocate();
  }
})();
