/**
 * Motion Kit — bridge.
 *
 * Talks to ExtendScript through the raw CEP API. CSInterface.js is not used:
 * the only things needed here are evalScript and getSystemPath, and shipping
 * Adobe's whole library for two calls is dead weight.
 *
 * Contract: MK.run() on the host side always returns a JSON string, so every
 * call resolves. Transport failures reject.
 */
window.Bridge = (function () {

  var cep = window.__adobe_cep__;

  function evalScript(code) {
    return new Promise(function (resolve, reject) {
      if (!cep) {
        reject(new Error("No CEP host. Open this panel inside After Effects."));
        return;
      }
      cep.evalScript(code, function (raw) {
        if (raw === "EvalScript error.") {
          reject(new Error("The host script failed to load. Rebuild and reinstall."));
          return;
        }
        resolve(raw);
      });
    });
  }

  /**
   * Call a tool. Resolves with {ok, message, data}.
   * Double JSON.stringify builds a correctly escaped JS string literal,
   * so quotes and newlines inside args survive the trip.
   */
  function run(toolId, args) {
    var payload = JSON.stringify(args || {});
    var code = "MK.run(" + JSON.stringify(toolId) + "," + JSON.stringify(payload) + ")";

    return evalScript(code).then(function (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return { ok: false, message: "Unreadable host response: " + raw, data: null };
      }
    });
  }

  function extensionPath() {
    return cep ? cep.getSystemPath("extension") : "";
  }

  return { run: run, evalScript: evalScript, extensionPath: extensionPath };
})();
