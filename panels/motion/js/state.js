/**
 * Motion Kit — state.
 *
 * All panel state lives here and is passed to the host as arguments. The
 * ExtendScript side stays stateless, which is what keeps a failed tool from
 * poisoning the next call.
 *
 * Persisted in localStorage, which CEP keeps per extension. Reads are
 * defensive: a corrupt or empty store falls back to defaults rather than
 * leaving the panel dead.
 */
window.State = (function () {

  var KEY = "motionkit.state.v1";

  var defaults = {
    loopType: "cycle"
  };

  var data = load();

  function load() {
    var out = {};
    for (var k in defaults) {
      if (defaults.hasOwnProperty(k)) { out[k] = defaults[k]; }
    }
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        for (var p in parsed) {
          if (parsed.hasOwnProperty(p)) { out[p] = parsed[p]; }
        }
      }
    } catch (e) { /* defaults stand */ }
    return out;
  }

  function save() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* not fatal: the session still works */ }
  }

  return {
    get: function (key) { return data[key]; },
    set: function (key, value) { data[key] = value; save(); },
    all: function () { return data; }
  };
})();
