/**
 * FitMe Studio — Google sign-in for the BODY picker.
 *
 * Replaces the shared n8n account with the designer's own. The panel opens a
 * normal Google consent page in the system browser; whatever that person can
 * see in Drive, the picker can see. "This folder opens but the next one is
 * empty" stops being a mystery about someone else's permissions.
 *
 * Installed-app flow, exactly as Google documents it for desktop clients:
 * a loopback HTTP server takes the redirect, PKCE protects the code in
 * transit, and the refresh token is kept so this happens once rather than
 * every session.
 *
 * The token exchange goes through Node's https rather than fetch. The panel
 * is a file:// page, and the token endpoint is not somewhere to discover CORS
 * problems; Node has no such notion.
 *
 * Client secret sits in the extension. For a desktop client Google states
 * plainly that it is not treated as confidential — the loopback redirect and
 * PKCE are what actually protect the flow.
 */

(function () {
  "use strict";

  var AUTH_URI = "https://accounts.google.com/o/oauth2/auth";
  var TOKEN_HOST = "oauth2.googleapis.com";
  var TOKEN_PATH = "/token";
  var SCOPE = "https://www.googleapis.com/auth/drive.readonly";

  var CLIENT_ID = "931012163036-r0rv2ku3uekcdcdf7kdu4qbr5lc0i9bp.apps.googleusercontent.com";
  var CLIENT_SECRET = "YOUR-GOOGLE-CLIENT-SECRET";

  // Google ignores the port when matching a loopback redirect, so any of
  // these is as good as the registered http://localhost. Four of them
  // because one may already be taken by something else on the machine.
  var PORTS = [47831, 47832, 47833, 47834];
  var CONSENT_TIMEOUT_MS = 180000;

  var LS_TOKEN = "fitme.body.google";

  function node(name) {
    try { return (typeof require === "function") ? require(name) : null; } catch (e) { return null; }
  }

  var http = node("http");
  var https = node("https");
  var crypto = node("crypto");

  /* ------------------------------------------------------------- storage */

  function load() {
    try {
      var raw = window.localStorage.getItem(LS_TOKEN);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function save(data) {
    try { window.localStorage.setItem(LS_TOKEN, JSON.stringify(data)); } catch (e) {}
  }

  function forget() {
    try { window.localStorage.removeItem(LS_TOKEN); } catch (e) {}
  }

  function connected() {
    var t = load();
    return !!(t && t.refresh_token);
  }

  /* ---------------------------------------------------------------- PKCE */

  function b64url(buf) {
    return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function verifier() {
    return b64url(crypto.randomBytes(48));
  }

  function challenge(v) {
    return b64url(crypto.createHash("sha256").update(v).digest());
  }

  /* ------------------------------------------------------- token endpoint */

  function postToken(form) {
    return new Promise(function (resolve, reject) {
      var body = Object.keys(form).map(function (k) {
        return encodeURIComponent(k) + "=" + encodeURIComponent(form[k]);
      }).join("&");

      var req = https.request({
        hostname: TOKEN_HOST,
        path: TOKEN_PATH,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body)
        }
      }, function (res) {
        var chunks = "";
        res.on("data", function (c) { chunks += c; });
        res.on("end", function () {
          var data;
          try { data = JSON.parse(chunks); } catch (e) {
            reject(new Error("Google returned something unreadable."));
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error("Google refused the token: " +
                             (data.error_description || data.error || res.statusCode)));
            return;
          }
          resolve(data);
        });
      });

      req.setTimeout(30000, function () { req.destroy(new Error("Google did not answer in time.")); });
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }

  function store(data, keepRefresh) {
    var saved = {
      access_token: data.access_token,
      // A refresh response omits the refresh token; losing it here would
      // silently turn a permanent connection into an hour-long one.
      refresh_token: data.refresh_token || keepRefresh || "",
      expiresAt: Date.now() + (Number(data.expires_in || 3600) * 1000)
    };
    save(saved);
    return saved;
  }

  /* ------------------------------------------------------------- consent */

  function listen(onCode) {
    return new Promise(function (resolve, reject) {
      var index = 0;

      function tryPort() {
        if (index >= PORTS.length) {
          reject(new Error("Ports " + PORTS.join(", ") + " are all busy."));
          return;
        }

        var port = PORTS[index++];
        var server = http.createServer(function (req, res) {
          var code = /[?&]code=([^&]+)/.exec(req.url);
          var err = /[?&]error=([^&]+)/.exec(req.url);

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<!doctype html><meta charset=utf-8>" +
                  "<body style='font:15px -apple-system,sans-serif;padding:40px;color:#222'>" +
                  (code ? "Connected. Close this tab and go back to After Effects."
                        : "Sign-in failed. Close this tab and try again in the panel.") +
                  "</body>");

          try { server.close(); } catch (e) {}

          if (code) { onCode.resolve(decodeURIComponent(code[1])); }
          else { onCode.reject(new Error(err ? decodeURIComponent(err[1]) : "No code came back.")); }
        });

        server.on("error", function () { tryPort(); });
        server.listen(port, "127.0.0.1", function () { resolve({ server: server, port: port }); });
      }

      tryPort();
    });
  }

  function openBrowser(url) {
    try {
      if (window.cep && window.cep.util && window.cep.util.openURLInDefaultBrowser) {
        window.cep.util.openURLInDefaultBrowser(url);
        return true;
      }
    } catch (e) {}
    return false;
  }

  async function connect() {
    if (!http || !https || !crypto) {
      throw new Error("Node is not available in this frame — sign-in cannot run.");
    }

    var v = verifier();
    var pending = {};
    var waited = new Promise(function (res, rej) { pending.resolve = res; pending.reject = rej; });

    var bound = await listen(pending);
    var redirect = "http://localhost:" + bound.port;

    var url = AUTH_URI +
      "?client_id=" + encodeURIComponent(CLIENT_ID) +
      "&redirect_uri=" + encodeURIComponent(redirect) +
      "&response_type=code" +
      "&scope=" + encodeURIComponent(SCOPE) +
      "&code_challenge=" + challenge(v) +
      "&code_challenge_method=S256" +
      // offline + consent so a refresh token actually comes back; without
      // both, Google returns one only on the very first authorisation ever
      // and never again, which is impossible to debug later.
      "&access_type=offline&prompt=consent";

    if (!openBrowser(url)) {
      try { bound.server.close(); } catch (e) {}
      throw new Error("Could not open the browser.");
    }

    var timer = setTimeout(function () {
      try { bound.server.close(); } catch (e) {}
      pending.reject(new Error("Timed out waiting for Google."));
    }, CONSENT_TIMEOUT_MS);

    var code;
    try { code = await waited; } finally { clearTimeout(timer); }

    var data = await postToken({
      code: code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirect,
      grant_type: "authorization_code",
      code_verifier: v
    });

    if (!data.refresh_token) {
      throw new Error("Google did not return a refresh token. Remove FitMe Studio at " +
                      "myaccount.google.com/permissions and connect again.");
    }

    return store(data, "");
  }

  /** Access token, refreshed when stale. Throws NOT_CONNECTED if there is none. */
  async function token() {
    var t = load();
    if (!t || !t.refresh_token) { throw new Error("NOT_CONNECTED"); }

    // A minute of slack: a token that expires mid-download is worse than one
    // fetched slightly early.
    if (t.access_token && Date.now() < t.expiresAt - 60000) { return t.access_token; }

    var data = await postToken({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: t.refresh_token,
      grant_type: "refresh_token"
    });

    return store(data, t.refresh_token).access_token;
  }

  window.FitMeGoogle = {
    connect: connect,
    disconnect: forget,
    connected: connected,
    token: token,
    hasNode: function () { return !!(http && https && crypto); }
  };
})();
