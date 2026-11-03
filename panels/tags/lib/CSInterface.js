(function () {
  function parseMaybeJson(value) {
    if (!value || typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  function CSInterface() {}

  CSInterface.prototype.evalScript = function (script, callback) {
    if (window.__adobe_cep__ && typeof window.__adobe_cep__.evalScript === 'function') {
      window.__adobe_cep__.evalScript(script, callback || function () {});
      return;
    }

    if (callback) callback('');
  };

  CSInterface.prototype.getHostEnvironment = function () {
    if (window.__adobe_cep__ && typeof window.__adobe_cep__.getHostEnvironment === 'function') {
      return parseMaybeJson(window.__adobe_cep__.getHostEnvironment());
    }
    return {};
  };

  CSInterface.prototype.addEventListener = function (type, listener) {
    if (window.__adobe_cep__ && typeof window.__adobe_cep__.addEventListener === 'function') {
      window.__adobe_cep__.addEventListener(type, listener);
    }
  };

  CSInterface.prototype.removeEventListener = function (type, listener) {
    if (window.__adobe_cep__ && typeof window.__adobe_cep__.removeEventListener === 'function') {
      window.__adobe_cep__.removeEventListener(type, listener);
    }
  };

  window.CSInterface = window.CSInterface || CSInterface;
})();
