/**
 * FitMe Studio — BODY picker.
 *
 * A search bar at the top of MOTION. Type part of a body's name, pick one
 * from the list, and it is downloaded, imported, dropped at the bottom of the
 * active comp and tagged [body].
 *
 * Drive access is the designer's own Google account — see body-auth.js. This
 * file holds no credentials of its own.
 *
 * Three things in that panel are not carried over:
 *
 *   - It never read nextPageToken, so a folder over 1000 items was silently
 *     truncated. Paged here.
 *   - It re-listed folders over the network on every search. Here the folder
 *     is crawled once into an index and searching is local, which is what
 *     makes typing feel instant and lets the list work offline.
 *   - It downloaded with fetch → arrayBuffer → Buffer → writeFileSync, which
 *     holds the whole file in memory twice. At ~78 MB a body that is a bad
 *     trade for no benefit; this streams to disk and reports real progress.
 *
 * Settings live in localStorage so the endpoint, the secret and the folder id
 * can be corrected without a new build — see BODY_SETTINGS_KEYS.
 */

(function () {
  "use strict";

  var DEFAULTS = {
    apiBase: "https://www.googleapis.com/drive/v3",

    // Airtable is the catalogue: the Body Type table already carries the
    // name, the per-resize locale list and a Drive folder link per body.
    // Reading it beats crawling Drive — one request instead of a tree walk,
    // and the locales come from a curated field instead of being guessed
    // out of filenames.
    airBase: "appfVKftcbLyLlsZK",
    airTable: "tblvdBC6zRGUAR2l2",
    // Baked in deliberately. Read-only, scoped to this one base, and the
    // whole team can already read it — an extra field to fill on every
    // machine buys nothing. localStorage still overrides, so a replacement
    // token needs no rebuild.
    airToken: ""  // REDACTED: paste a read-only Airtable PAT here or set localStorage fitme.body.airToken
  };

  var LS = {
    airBase: "fitme.body.airBase",
    airTable: "fitme.body.airTable",
    airToken: "fitme.body.airToken",
    cacheDir: "fitme.body.cacheDir",
    index: "fitme.body.index",
    indexAt: "fitme.body.indexAt"
  };

  var INDEX_TTL_MS = 24 * 60 * 60 * 1000;
  var MAX_RESULTS = 40;

  function setting(key, fallback) {
    try {
      var v = window.localStorage.getItem(LS[key]);
      if (v !== null && v !== "") { return v; }
    } catch (e) {}
    return fallback;
  }

  function config() {
    return {
      apiBase: DEFAULTS.apiBase,
      airBase: setting("airBase", DEFAULTS.airBase),
      airTable: setting("airTable", DEFAULTS.airTable),
      airToken: setting("airToken", DEFAULTS.airToken)
    };
  }

  /* ------------------------------------------------------------ node bits */

  function node(name) {
    try { return (typeof require === "function") ? require(name) : null; } catch (e) { return null; }
  }

  var fs = node("fs");
  var path = node("path");
  var os = node("os");
  var https = node("https");

  function cacheDir() {
    var dir = setting("cacheDir", "");
    if (!dir && os && path) { dir = path.join(os.tmpdir(), "FitMeStudio", "body-cache"); }
    try { if (fs && dir && !fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); } } catch (e) {}
    return dir;
  }

  /* ------------------------------------------------------------- the API */

  var lastFolderId = "";
  var lastSawFolders = false;

  /**
   * Drive credentials — the designer's own, and only those.
   *
   * There used to be a fallback through an n8n webhook that minted a token
   * for one shared service account. It is gone: whether a folder opened
   * depended on what that one account had been shared, which is why some
   * bodies listed and their neighbours came back empty with no error to
   * explain it. Signing in personally makes the rule simple — the picker
   * sees what you see in Drive.
   */
  async function accessToken() {
    if (!window.FitMeGoogle) { throw new Error("Sign-in module missing."); }
    if (!window.FitMeGoogle.connected()) {
      throw new Error("Not signed in. Open the BODY settings and press Connect Google.");
    }
    return await window.FitMeGoogle.token();
  }

  // Declared here rather than beside their uses: both are referenced from
  // two different functions, and the previous home for them was inside the
  // n8n block that got removed with it.
  var LIST_TIMEOUT_MS = 30000;
  var STALL_TIMEOUT_MS = 120000;

  async function driveGet(pathAndQuery) {
    var t = await accessToken();

    // Without this a listing that never answers leaves the panel showing
    // "Opening…" for good.
    var ctl = (typeof AbortController === "function") ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, LIST_TIMEOUT_MS) : null;

    try {
      var res = await fetch(config().apiBase + pathAndQuery, {
        headers: { Authorization: "Bearer " + t },
        signal: ctl ? ctl.signal : undefined
      });
      if (!res.ok) { throw new Error("Drive answered " + res.status + "."); }
      return await res.json();
    } catch (e) {
      if (e && e.name === "AbortError") { throw new Error("Drive did not answer in time."); }
      throw e;
    } finally {
      if (timer) { clearTimeout(timer); }
    }
  }

  /**
   * One page at a time, following nextPageToken to the end.
   * md5Checksum is in the field list on purpose: it is what lets a download
   * be skipped when the file is already in the cache.
   */
  async function listFolder(folderId) {
    var out = [];
    var pageToken = "";

    do {
      var q = encodeURIComponent("'" + folderId + "' in parents and trashed=false");
      var url = "/files?q=" + q +
                "&fields=nextPageToken,files(id,name,mimeType,size,md5Checksum,modifiedTime)" +
                "&orderBy=name&pageSize=1000" +
                (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");

      var page = await driveGet(url);
      out = out.concat(page.files || []);
      pageToken = page.nextPageToken || "";
    } while (pageToken);

    return out;
  }

  /* ---------------------------------------------------------- catalogue */

  var AIR_FIELDS = ["Name", "Template Name", "Folder Link New", "Folder Link",
                    "9x16 Available Locales", "16x9 Available Locales",
                    "Available Resizes", "Archive"];

  function folderIdFrom(url) {
    var m = /\/folders\/([A-Za-z0-9_-]+)/.exec(String(url || ""));
    return m ? m[1] : "";
  }

  function names(list) {
    var out = [];
    for (var i = 0; i < (list || []).length; i++) {
      var v = list[i];
      out.push(typeof v === "string" ? v : (v && v.name) || "");
    }
    return out.filter(Boolean);
  }

  /**
   * The whole Body Type table, paged.
   *
   * Only the fields the picker shows are requested; the table also holds
   * full scripts in Body Text and dozens of linked funnels per row, and
   * pulling those would make this many times heavier for nothing.
   */
  async function loadCatalogue(onProgress) {
    var cfg = config();
    if (!cfg.airToken) {
      throw new Error("No Airtable token set. Open the settings and paste a read-only PAT.");
    }

    var rows = [];
    var offset = "";

    do {
      var url = "https://api.airtable.com/v0/" + cfg.airBase + "/" + cfg.airTable +
                "?pageSize=100" +
                AIR_FIELDS.map(function (f) { return "&fields%5B%5D=" + encodeURIComponent(f); }).join("") +
                (offset ? "&offset=" + encodeURIComponent(offset) : "");

      var res = await fetch(url, { headers: { Authorization: "Bearer " + cfg.airToken } });
      if (!res.ok) { throw new Error("Airtable answered " + res.status + "."); }

      var page = await res.json();

      for (var i = 0; i < (page.records || []).length; i++) {
        var f = page.records[i].fields || {};
        if (f.Archive === true) { continue; }

        rows.push({
          id: page.records[i].id,
          name: f["Name"] || "",
          template: f["Template Name"] || "",
          folderId: folderIdFrom(f["Folder Link New"] || f["Folder Link"]),
          locales9x16: names(f["9x16 Available Locales"]),
          locales16x9: names(f["16x9 Available Locales"]),
          resizes: names(f["Available Resizes"])
        });
      }

      offset = page.offset || "";
      if (onProgress) { onProgress(rows.length); }
    } while (offset);

    try {
      window.localStorage.setItem(LS.index, JSON.stringify(rows));
      window.localStorage.setItem(LS.indexAt, String(Date.now()));
    } catch (e) { /* too big to cache — still fine for this session */ }

    return rows;
  }

  function cachedIndex() {
    try {
      var raw = window.localStorage.getItem(LS.index);
      var at = Number(window.localStorage.getItem(LS.indexAt) || 0);
      if (!raw) { return null; }
      return { rows: JSON.parse(raw), stale: (Date.now() - at) > INDEX_TTL_MS };
    } catch (e) { return null; }
  }

  /**
   * Every file under one body's Drive folder.
   *
   * Not a flat listing. A body folder usually holds subfolders — per resize,
   * per locale — with the renders one or two levels down, so a listing that
   * skipped folders and stopped there reported a full library as empty.
   *
   * Bounded on purpose: this is one body, not the whole drive. Depth and
   * request count are capped so a folder that loops or fans out cannot turn
   * a click into a crawl.
   */
  var SHORTCUT = "application/vnd.google-apps.shortcut";
  var WALK_MAX_DEPTH = 3;
  var WALK_MAX_CALLS = 40;

  async function listOne(folderId, withCorpora) {
    var out = [];
    var pageToken = "";

    do {
      var q = encodeURIComponent("'" + folderId + "' in parents and trashed=false");
      // supportsAllDrives / includeItemsFromAllDrives are not optional here.
      // Without them Drive v3 answers 200 with an EMPTY list for anything in
      // a Shared Drive — no error, no hint, just nothing. Harmless on My Drive.
      var url = "/files?q=" + q +
                "&fields=nextPageToken,files(id,name,mimeType,size,md5Checksum,shortcutDetails(targetId,targetMimeType))" +
                "&orderBy=name&pageSize=1000" +
                "&supportsAllDrives=true&includeItemsFromAllDrives=true" +
                (withCorpora ? "&corpora=allDrives" : "") +
                (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");

      var page = await driveGet(url);
      out = out.concat(page.files || []);
      pageToken = page.nextPageToken || "";
    } while (pageToken);

    return out;
  }

  async function filesIn(folderId, onProgress) {
    if (!folderId) { throw new Error("This body has no Drive folder link."); }
    lastFolderId = folderId;
    lastSawFolders = false;

    var files = [];
    var queue = [{ id: folderId, depth: 0, trail: "" }];
    var seen = {};
    var calls = 0;

    while (queue.length && calls < WALK_MAX_CALLS) {
      var node = queue.shift();
      if (seen[node.id]) { continue; }
      seen[node.id] = true;
      calls++;

      // corpora=allDrives widens the search to shared drives, but paired
      // with a parents query it has been seen to return nothing where the
      // plain call returns the folder's contents. Cheap to try both: one
      // extra request only on the folders that came back empty.
      var entries = await listOne(node.id, true);
      if (!entries.length) { entries = await listOne(node.id, false); }

      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];

        // A shortcut is neither a file nor a folder until it is followed.
        // Libraries organised with shortcuts would otherwise look like they
        // hold undownloadable junk, or like the subfolders are not there.
        if (e.mimeType === SHORTCUT) {
          var target = e.shortcutDetails || {};
          if (!target.targetId) { continue; }
          e = {
            id: target.targetId,
            name: e.name,
            mimeType: target.targetMimeType || "",
            size: 0,
            md5Checksum: ""
          };
        }

        // Docs, Sheets, Forms and friends have no bytes to fetch — alt=media
        // fails on them — and none of them belong in a comp.
        if (e.mimeType.indexOf("application/vnd.google-apps.") === 0 &&
            e.mimeType !== "application/vnd.google-apps.folder") {
          continue;
        }

        if (e.mimeType === "application/vnd.google-apps.folder") {
          lastSawFolders = true;
          if (node.depth < WALK_MAX_DEPTH) {
            queue.push({
              id: e.id,
              depth: node.depth + 1,
              trail: node.trail ? node.trail + "/" + e.name : e.name
            });
          }
          continue;
        }

        files.push({
          id: e.id,
          name: e.name,
          size: Number(e.size || 0),
          md5: e.md5Checksum || "",
          viaShortcut: !e.md5Checksum && !e.size,
          // Where it sits inside the body folder — two renders can share a
          // name across resize subfolders, and the row needs to say which.
          trail: node.trail
        });
      }

      if (onProgress) { onProgress(files.length); }
    }

    return files;
  }

  /* ------------------------------------------------------------- search */

  /**
   * Squash everything that varies between the three naming conventions in
   * play, so one query finds a body regardless of which one the person has
   * in their head:
   *
   *     Airtable Name       FCLSTNK5
   *     Template Name       BODY-FCLSTNK-5
   *     file on Drive       BODY_FCLSTNK_40_9x16-ES.mp4
   *
   * Separators and case go, digits stay. Typing FCLSTNK_40, fclstnk40 or
   * BODY-FCLSTNK-40 all reduce to the same string, so none of this depends
   * on knowing which field the person is quoting.
   */
  function norm(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function localesFor(row) {
    var all = row.locales9x16.concat(row.locales16x9);
    var seen = {};
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var up = String(all[i]).toUpperCase();
      if (!seen[up]) { seen[up] = true; out.push(up); }
    }
    // English first — it is the one people reach for.
    out.sort(function (a, b) {
      if (a === "EN") { return -1; }
      if (b === "EN") { return 1; }
      return a < b ? -1 : (a > b ? 1 : 0);
    });
    return out;
  }

  /** Bodies whose name or template contains the query. */
  function searchBodies(rows, termRaw) {
    var term = norm(termRaw);
    if (!term) { return []; }

    var hits = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var a = norm(row.name);
      var b = norm(row.template);

      var at = a.indexOf(term);
      if (at === -1) { at = b.indexOf(term); }
      if (at === -1) { continue; }

      hits.push({ row: row, rank: (at === 0 ? 0 : 1), locales: localesFor(row) });
    }

    hits.sort(function (x, y) {
      if (x.rank !== y.rank) { return x.rank - y.rank; }
      return x.row.name < y.row.name ? -1 : (x.row.name > y.row.name ? 1 : 0);
    });

    return hits.slice(0, MAX_RESULTS);
  }

  // BODY_FCLSTNK_40_9x16-ES.mp4 → ES. Forgiving on purpose: a name that does
  // not match still lists, it just gets no English priority.
  function languageOf(name) {
    var m = /-([A-Za-z]{2,3})(?:\.[A-Za-z0-9]+)?$/.exec(String(name || ""));
    return m ? m[1].toUpperCase() : "";
  }

  /**
   * Is this actually a body render?
   *
   * A body's Drive folder holds more than renders — fonts, project files,
   * working copies — and listing all of it turns the picker into a file
   * browser nobody asked for. A render is recognisable: BODY_, something,
   * a resize, a locale, and a video extension.
   *
   * Kept deliberately loose on the middle part, which is where names vary
   * most, and strict on the two things that are always there: the WxH and
   * the two-or-three letter locale at the end.
   */
  var BODY_NAME = /^BODY_.+_\d+x\d+-[A-Za-z]{2,3}\.(mp4|mov|m4v|webm|mkv)$/i;

  function isBodyFile(name) {
    return BODY_NAME.test(String(name || ""));
  }

  /** Files of one body, English first, then alphabetical. */
  function orderFiles(files) {
    return files.slice().sort(function (a, b) {
      var la = languageOf(a.name) === "EN" ? 0 : 1;
      var lb = languageOf(b.name) === "EN" ? 0 : 1;
      if (la !== lb) { return la - lb; }
      return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
    });
  }

  /* ----------------------------------------------------------- download */

  function md5Of(file) {
    try {
      var crypto = node("crypto");
      var buf = fs.readFileSync(file);
      return crypto.createHash("md5").update(buf).digest("hex");
    } catch (e) { return ""; }
  }

  /**
   * Download, in parallel where it helps.
   *
   * A single HTTPS connection to Drive tops out well below the available
   * bandwidth — the limit is the connection, not the link. Drive honours
   * Range on alt=media, so a body is fetched as several slices at once and
   * stitched together. On a 78 MB render that is the difference between a
   * coffee break and a few seconds.
   *
   * Falls back to one plain stream whenever slicing does not apply: an
   * unknown size, a small file, or a server that ignores Range and answers
   * 200 instead of 206 — in which case the first slice already holds the
   * whole file and is simply kept.
   */
  var PARALLEL = 4;
  var MIN_SPLIT_BYTES = 8 * 1024 * 1024;

  function md5Of(file) {
    try {
      var crypto = node("crypto");
      var buf = fs.readFileSync(file);
      return crypto.createHash("md5").update(buf).digest("hex");
    } catch (e) { return ""; }
  }

  function getSlice(entry, token, range, onChunk) {
    return new Promise(function (resolve, reject) {
      var headers = { Authorization: "Bearer " + token };
      if (range) { headers.Range = "bytes=" + range.from + "-" + range.to; }

      var req = https.get({
        host: "www.googleapis.com",
        path: "/drive/v3/files/" + entry.id + "?alt=media&supportsAllDrives=true",
        headers: headers
      }, function (res) {
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          res.resume();
          reject(new Error("Drive answered " + res.statusCode + " for the file."));
          return;
        }

        var parts = [];
        res.on("data", function (chunk) {
          parts.push(chunk);
          if (onChunk) { onChunk(chunk.length); }
        });
        res.on("error", reject);
        res.on("end", function () {
          resolve({ buffer: Buffer.concat(parts), whole: res.statusCode === 200 });
        });
      });

      req.setTimeout(STALL_TIMEOUT_MS, function () {
        req.destroy(new Error("The download stalled."));
      });
      req.on("error", reject);
    });
  }

  function download(entry, onProgress) {
    return new Promise(function (resolve, reject) {
      if (!fs || !https || !path) { reject(new Error("Node is not available in this frame.")); return; }

      var dir = cacheDir();
      if (!dir) { reject(new Error("No cache folder.")); return; }

      var dest = path.join(dir, entry.name);

      if (fs.existsSync(dest)) {
        var ok = entry.md5 ? (md5Of(dest) === entry.md5)
                           : (Number(fs.statSync(dest).size) === entry.size && entry.size > 0);
        if (ok) { resolve({ path: dest, cached: true }); return; }
      }

      accessToken().then(function (t) {
        var total = Number(entry.size || 0);
        var got = 0;

        function tick(n) {
          got += n;
          if (onProgress && total) { onProgress(Math.min(99, Math.round(got / total * 100))); }
        }

        var slices = [];
        if (total >= MIN_SPLIT_BYTES) {
          var span = Math.ceil(total / PARALLEL);
          for (var i = 0; i < PARALLEL; i++) {
            var from = i * span;
            if (from >= total) { break; }
            slices.push({ from: from, to: Math.min(total - 1, from + span - 1) });
          }
        }

        var work = slices.length
          ? Promise.all(slices.map(function (r) { return getSlice(entry, t, r, tick); }))
          : getSlice(entry, t, null, tick).then(function (one) { return [one]; });

        return work.then(function (results) {
          // A server that ignored Range sent the entire file in slice one;
          // stitching all four would produce a corrupt, oversized file.
          var buffer = (results.length > 1 && results[0].whole)
            ? results[0].buffer
            : Buffer.concat(results.map(function (r) { return r.buffer; }));

          // Write to .part and rename, so an interrupted download can never
          // be mistaken for a finished one on the next run.
          var part = dest + ".part";
          fs.writeFileSync(part, buffer);
          if (fs.existsSync(dest)) { fs.unlinkSync(dest); }
          fs.renameSync(part, dest);

          resolve({ path: dest, cached: false, parallel: slices.length || 1 });
        });
      }).catch(function (err) {
        try { if (fs.existsSync(dest + ".part")) { fs.unlinkSync(dest + ".part"); } } catch (e) {}
        reject(err);
      });
    });
  }

  /* -------------------------------------------------------------- export */

  function toHex(str) {
    var utf8 = unescape(encodeURIComponent(String(str)));
    var out = "";
    for (var i = 0; i < utf8.length; i++) {
      var h = utf8.charCodeAt(i).toString(16);
      out += (h.length < 2 ? "0" + h : h);
    }
    return out;
  }

  window.FitMeBody = {
    config: config,
    settingsKeys: LS,
    loadCatalogue: loadCatalogue,
    cachedIndex: cachedIndex,
    searchBodies: searchBodies,
    filesIn: filesIn,
    orderFiles: orderFiles,
    isBodyFile: isBodyFile,
    lastFolderId: function () { return lastFolderId; },
    sawFolders: function () { return lastSawFolders; },
    languageOf: languageOf,
    download: download,
    toHex: toHex,
    cacheDir: cacheDir,
    hasNode: function () { return !!(fs && https && path); }
  };
})();
