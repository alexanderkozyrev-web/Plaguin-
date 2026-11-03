// host/index.jsx — ExtendScript for OrganizeMe v3.0
// Called via csInterface.evalScript() from the CEP panel

// ─────────────────────────────────────────────────────────────
// JSON polyfill guard (v2.8). Native JSON is NOT guaranteed in ExtendScript —
// it only appears when certain Adobe panels are open. Every return path here
// depends on JSON.stringify, so a minimal ES3 serializer backstops it.
// ─────────────────────────────────────────────────────────────
if (typeof JSON === "undefined") { JSON = {}; }
if (typeof JSON.stringify !== "function") {
    JSON.stringify = function (v) {
        function esc(s) {
            s = String(s);
            var r = "", i, c, cc;
            for (i = 0; i < s.length; i++) {
                c = s.charAt(i); cc = s.charCodeAt(i);
                if (c === '"')       r += '\\"';
                else if (c === "\\") r += "\\\\";
                else if (c === "\n") r += "\\n";
                else if (c === "\r") r += "\\r";
                else if (c === "\t") r += "\\t";
                else if (cc < 32)    r += "\\u" + ("0000" + cc.toString(16)).slice(-4);
                else                 r += c;
            }
            return r;
        }
        function go(x) {
            var i, k, parts;
            if (x === null || x === undefined) return "null";
            if (typeof x === "number")  return isFinite(x) ? String(x) : "null";
            if (typeof x === "boolean") return x ? "true" : "false";
            if (typeof x === "string")  return '"' + esc(x) + '"';
            if (x instanceof Array) {
                parts = [];
                for (i = 0; i < x.length; i++) parts.push(go(x[i]));
                return "[" + parts.join(",") + "]";
            }
            if (typeof x === "object") {
                parts = [];
                for (k in x) {
                    if (x.hasOwnProperty(k) && typeof x[k] !== "function") {
                        parts.push('"' + esc(k) + '":' + go(x[k]));
                    }
                }
                return "{" + parts.join(",") + "}";
            }
            return "null";
        }
        return go(v);
    };
}

// ─────────────────────────────────────────────────────────────
// ORGANIZE
// ─────────────────────────────────────────────────────────────
function organizeProject() {
    try {
        app.beginUndoGroup("Organize Project");
        _doOrganize();
        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch (e) {
        try { app.endUndoGroup(); } catch (x) {}
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

// ─────────────────────────────────────────────────────────────
// ORGANIZE & CLEAN
// ─────────────────────────────────────────────────────────────
function organizeAndClean() {
    try {
        var proj = app.project;
        if (!proj) return JSON.stringify({ success: false, error: "No project open" });

        var selectedComps = [];
        for (var i = 0; i < proj.selection.length; i++) {
            if (proj.selection[i] instanceof CompItem) selectedComps.push(proj.selection[i]);
        }
        if (selectedComps.length === 0)
            return JSON.stringify({ success: false, error: "Please select at least one composition first" });

        app.beginUndoGroup("Organize and Clean Project");
        app.executeCommand(app.findMenuCommandId("Reduce Project"));
        app.project.save();
        _doOrganize();
        app.endUndoGroup();
        return JSON.stringify({ success: true });
    } catch (e) {
        try { app.endUndoGroup(); } catch (x) {}
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

// ─────────────────────────────────────────────────────────────
// GET PROJECT INFO (for Collect & ZIP)
// Returns .aep path + all footage file paths + used fonts
// ─────────────────────────────────────────────────────────────
function getProjectInfo() {
    try {
        var proj = app.project;
        if (!proj) return JSON.stringify({ success: false, error: "No project open" });

        var projFile = proj.file;
        if (!projFile) return JSON.stringify({ success: false, error: "Please save the project first" });

        function getFolderPath(item) {
            var parts = [];
            var parent = item.parentFolder;
            while (parent && parent !== proj.rootFolder) {
                parts.unshift(parent.name);
                parent = parent.parentFolder;
            }
            return parts.join("/");
        }

        // Build layerName lookup: for each FootageItem, find the FIRST occurrence
        // in any composition's timeline and capture layer.name.
        // Indexed by footage item's internal id (item.id) so we don't rely on
        // possibly-duplicate names.
        var layerNameById = {};
        for (var ci = 1; ci <= proj.numItems; ci++) {
            var compItem = proj.item(ci);
            if (!(compItem instanceof CompItem)) continue;
            for (var li = 1; li <= compItem.numLayers; li++) {
                var lyr = compItem.layer(li);
                var src = null;
                try { src = lyr.source; } catch (eSrc) { continue; }
                if (!src) continue;
                if (!(src instanceof FootageItem)) continue;
                if (src.mainSource instanceof SolidSource) continue;
                // Only capture the FIRST encounter
                if (layerNameById[src.id]) continue;
                try {
                    var lName = lyr.name;
                    if (lName) layerNameById[src.id] = lName;
                } catch (eL) {}
            }
        }

        var files   = [];
        var missing = [];

        // v2.8: An image-EXTENSION FootageItem that is NOT a still is an image
        // SEQUENCE — item.file points only at the FIRST frame. Copying that one
        // file (the v2.7 behaviour) produced a collected project whose sequence
        // went "missing"/became a still the moment the folder was delivered.
        // Tagged here so the panel copies every frame and the relink step uses
        // replaceWithSequence().
        function _isImageSequence(it, sf) {
            try {
                if (!it.mainSource || it.mainSource.isStill) return false;
                if (it.mainSource instanceof SolidSource) return false;
                var n = sf.displayName || sf.name || "";
                return /\.(png|jpg|jpeg|tif|tiff|tga|exr|dpx|bmp|gif|sgi|iff|psd)$/i.test(n);
            } catch (eSeq) { return false; }
        }

        for (var i = 1; i <= proj.numItems; i++) {
            var item = proj.item(i);
            if (!(item instanceof FootageItem)) continue;
            if (item.mainSource instanceof SolidSource) continue;

            var srcFile = item.file
                ? item.file
                : (item.mainSource && item.mainSource.file ? item.mainSource.file : null);
            if (!srcFile) continue;

            var fsPath   = srcFile.fsName;
            var lyrName  = layerNameById[item.id] || "";
            // v2.7: NO dedup here anymore. Previously items sharing the same
            // disk path were skipped after the first one — their itemIds never
            // entered the relink map, so they silently stayed pointing at the
            // ORIGINAL path (→ missing files after the collect was moved).
            // The panel now groups duplicates itself (by path AND by content)
            // and relinks EVERY itemId to the single collected copy.

            if (!srcFile.exists) {
                missing.push(srcFile.displayName || fsPath);
            } else {
                files.push({
                    path:       fsPath,
                    folderPath: getFolderPath(item),
                    itemName:   item.name || "",
                    layerName:  lyrName,
                    itemId:     item.id,
                    isSequence: _isImageSequence(item, srcFile)
                });
            }
        }

        // Collect font names from text layers
        var fontMap = {};
        for (var i = 1; i <= proj.numItems; i++) {
            var item = proj.item(i);
            if (!(item instanceof CompItem)) continue;
            for (var l = 1; l <= item.numLayers; l++) {
                var layer = item.layer(l);
                if (!(layer instanceof TextLayer)) continue;
                try {
                    var td = layer.property("Source Text").value;
                    if (td && td.font) fontMap[td.font] = true;
                } catch (e2) {}
            }
        }
        var fonts = [];
        for (var f in fontMap) fonts.push(f);

        // v2.6: File.name is URI-ENCODED in ExtendScript (space→%20, +→%2B,
        // non-ASCII→%D0%…). Passing it to the CEP panel made Node create
        // collect folders with literal "%20" in their names, while File()
        // constructors back in ExtendScript DECODED those escapes → the
        // Save-As target pointed at a non-existent decoded path ("File
        // couldn't be opened for writing") and relink verification failed.
        // displayName is the decoded, human-readable name — always use it.
        var aepDisplayName = projFile.displayName || decodeURI(projFile.name);

        return JSON.stringify({
            success:  true,
            aepPath:  projFile.fsName,
            aepName:  aepDisplayName,
            projName: aepDisplayName.replace(/\.aep$/i, ""),
            footage:  files,
            missing:  missing,
            fonts:    fonts
        });
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

// ─────────────────────────────────────────────────────────────
// DISCLAIMER VALIDATION  (v2.5)
//
// Gate that runs before Collect / Black Magic. A delivered video creative
// must carry the legal disclaimer as a TEXT layer sitting ABOVE every video
// layer. The ONLY layer allowed above the disclaimer is a video whose name
// contains "cta" (optional — a cta video may also sit below it).
//
// Detection is language-aware:
//   1) exact / fuzzy match against DISCLAIMER_VARIANTS (long default + short
//      A/B variant, seeded with English) — EITHER variant passes the gate
//   2) structural fallback — a long block of text (>= DISCLAIMER_MIN_WORDS
//      words OR >= DISCLAIMER_MIN_CHARS chars). This auto-covers localized
//      versions of the LONG disclaimer. NOTE: localized versions of the
//      SHORT variant are below the structural thresholds — register them
//      explicitly in DISCLAIMER_VARIANTS as they enter production.
//
// Comps checked: selected comps if any are selected in the Project panel,
// otherwise every top-level (non-nested) comp. Only comps that actually
// contain at least one video layer are gated.
// ─────────────────────────────────────────────────────────────
var DISCLAIMER_VARIANTS = [
    // Long (default)
    "Generative AI used. Following exercise and diet plans is the key in your fitness journey and greatly impacts results. In 4 weeks users can typically expect to lose not more than 1-2 lbs per week. Individual results may vary.",
    // Short (A/B test variant, v2.6)
    "Generative AI used. Actor portrayal. Fictional story. Results may vary.",
    // Current wording inserted by Motion > Disclaimer (FitMe Studio 1.3.1+)
    "This video contains AI-generated content"
];
var DISCLAIMER_MIN_WORDS = 20;   // structural fallback (space-separated scripts)
var DISCLAIMER_MIN_CHARS = 80;   // structural fallback (CJK / no-space scripts)
var CTA_KEYWORD          = "cta";

function _discNorm(s) {
    if (s === null || s === undefined) return "";
    s = String(s);
    var out = "";
    for (var i = 0; i < s.length; i++) {
        var c  = s.charAt(i);
        var cc = s.charCodeAt(i);
        if (cc <= 32) { out += " "; continue; }               // whitespace/control
        if (cc === 160) { out += " "; continue; }              // nbsp
        if ((cc >= 0x2010 && cc <= 0x2027)) { out += " "; continue; } // dashes/quotes range
        if (".,;:!?\"'`()[]{}/\\|*_-".indexOf(c) >= 0) { out += " "; continue; }
        out += c;
    }
    out = out.toLowerCase();
    out = out.replace(/\s+/g, " ");
    out = out.replace(/^\s+/, "").replace(/\s+$/, "");
    return out;
}

function _wordOverlap(a, b) {
    // fraction of b's words that appear anywhere in a (0..1)
    if (!a.length || !b.length) return 0;
    var aw = a.split(" "), bw = b.split(" ");
    var set = {}, i;
    for (i = 0; i < aw.length; i++) set["w_" + aw[i]] = true;
    var hit = 0;
    for (i = 0; i < bw.length; i++) if (set["w_" + bw[i]]) hit++;
    return hit / bw.length;
}

function _looksLikeDisclaimer(rawText) {
    var nt = _discNorm(rawText);
    if (!nt.length) return false;
    // 1) Known variants — substring either direction, or strong word overlap
    for (var v = 0; v < DISCLAIMER_VARIANTS.length; v++) {
        var nv = _discNorm(DISCLAIMER_VARIANTS[v]);
        if (!nv.length) continue;
        if (nt.indexOf(nv) >= 0 || nv.indexOf(nt) >= 0) return true;
        if (_wordOverlap(nt, nv) >= 0.6) return true;
    }
    // 2) Structural fallback for unregistered languages
    if (nt.split(" ").length >= DISCLAIMER_MIN_WORDS) return true;
    if (nt.length >= DISCLAIMER_MIN_CHARS) return true;
    return false;
}

function _discLayerText(layer) {
    try {
        if (!(layer instanceof TextLayer)) return null;
        var st = layer.property("Source Text");
        if (!st) return null;
        var doc = st.value;
        if (!doc) return null;
        return doc.text;
    } catch (e) { return null; }
}

function _isVideoLayer(layer) {
    if (!(layer instanceof AVLayer)) return false;        // TextLayer is AVLayer → caught by null source below
    var src = layer.source;
    if (!src || !(src instanceof FootageItem)) return false;
    if (src.mainSource instanceof SolidSource) return false;
    if (src.mainSource && src.mainSource.isStill) return false;   // still image, not video
    var hasFile = src.file || (src.mainSource && src.mainSource.file);
    if (!hasFile) return false;
    if (src.hasVideo === false) return false;
    return true;
}

function _isCtaLayer(layer) {
    if ((layer.name || "").toLowerCase().indexOf(CTA_KEYWORD) >= 0) return true;
    var src = layer.source;
    if (src) {
        if ((src.name || "").toLowerCase().indexOf(CTA_KEYWORD) >= 0) return true;
        var f = src.file || (src.mainSource && src.mainSource.file);
        if (f && (f.name || "").toLowerCase().indexOf(CTA_KEYWORD) >= 0) return true;
    }
    return false;
}

function _getTargetComps() {
    var proj = app.project, i;
    var sel = [];
    for (i = 0; i < proj.selection.length; i++) {
        if (proj.selection[i] instanceof CompItem) sel.push(proj.selection[i]);
    }
    if (sel.length) return sel;

    var allComps = [];
    for (i = 1; i <= proj.numItems; i++) {
        if (proj.item(i) instanceof CompItem) allComps.push(proj.item(i));
    }
    var used = {};
    for (var c = 0; c < allComps.length; c++) {
        var comp = allComps[c];
        for (var L = 1; L <= comp.numLayers; L++) {
            var s = comp.layer(L).source;
            if (s && (s instanceof CompItem)) used[s.id] = true;
        }
    }
    var tops = [];
    for (c = 0; c < allComps.length; c++) {
        if (!used[allComps[c].id]) tops.push(allComps[c]);
    }
    return tops.length ? tops : allComps;
}

function validateDisclaimer() {
    try {
        var comps = _getTargetComps();
        var problems = [];
        var checked = 0;

        for (var c = 0; c < comps.length; c++) {
            var comp = comps[c];
            if (!(comp instanceof CompItem)) continue;

            var topNonCtaVideoIdx  = null;   // smallest index (= highest) non-cta video
            var topNonCtaVideoName = "";
            var hasAnyVideo  = false;
            var disclaimerIdx = null;        // smallest index disclaimer text layer

            for (var L = 1; L <= comp.numLayers; L++) {
                var layer = comp.layer(L);
                if (!layer.enabled) continue;             // ignore hidden layers

                if (_isVideoLayer(layer)) {
                    hasAnyVideo = true;
                    if (!_isCtaLayer(layer)) {
                        if (topNonCtaVideoIdx === null || layer.index < topNonCtaVideoIdx) {
                            topNonCtaVideoIdx  = layer.index;
                            topNonCtaVideoName = layer.name;
                        }
                    }
                    continue;
                }

                var txt = _discLayerText(layer);
                if (txt !== null && _looksLikeDisclaimer(txt)) {
                    if (disclaimerIdx === null || layer.index < disclaimerIdx) {
                        disclaimerIdx = layer.index;
                    }
                }
            }

            if (!hasAnyVideo) continue;   // not a video creative — skip gate
            checked++;

            if (disclaimerIdx === null) {
                problems.push('Комп "' + comp.name + '": немає дисклеймеру');
            } else if (topNonCtaVideoIdx !== null && disclaimerIdx > topNonCtaVideoIdx) {
                problems.push('Комп "' + comp.name + '": дисклеймер не над усіма відео (вище нього: "' + topNonCtaVideoName + '")');
            }
        }

        return JSON.stringify({
            success: true,
            pass: (problems.length === 0),
            checked: checked,
            problems: problems
        });
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

// ─────────────────────────────────────────────────────────────
// RELINK AND SAVE
//
// Strategy: avoid the fragile save+replace+undo+save sequence.
// Instead:
//   1. Save original first (safety net — locks current state to disk)
//   2. Save As → collected .aep (now AE is editing the COPY, not original)
//   3. item.replace() for each footage on the COPY — VERIFIED per item
//   4. Save the copy with relinked paths
//   5. Open the original .aep back → user is left on their original project,
//      which is bit-for-bit identical to step 1 (we never modified it)
//
// v2.5: every replace is now verified. We confirm the target file exists on
// disk BEFORE replacing, and confirm item.file resolves to it AFTER replacing.
// Any item that does not end up online is reported back as a failure instead
// of being silently swallowed (the old empty catch produced "Media Offline"
// collected projects with no warning).
//
// Footage lives in (Footage)/ *inside* the collected .aep's own folder, so AE
// stores a relative path alongside the absolute one — the collected folder
// stays linked even after it is moved/delivered.
//
// relinkDataHex format: "itemId|hexNew;;itemId|hexNew;;..."
// (itemId is a plain numeric string, not hex-encoded)
// ─────────────────────────────────────────────────────────────

// v2.6: The File/Folder constructors treat "%XX" sequences in the path as
// URI escapes and DECODE them. A filesystem path that contains a literal
// "%" (e.g. folders produced by the v2.5 encoding bug, or user-named files)
// would therefore be silently mangled. Escaping "%" → "%25" makes the
// constructor decode back to the exact literal path we were given.
function _fsFile(p)   { return new File(String(p).replace(/%/g, "%25")); }
function _fsFolder(p) { return new Folder(String(p).replace(/%/g, "%25")); }

function relinkAndSave(relinkDataHex, collectAepHex, origAepHex) {
    // Hex decode helper (defined outside try so the catch can reuse it)
    function fromHex(h) {
        var s = "";
        for (var i = 0; i < h.length; i += 4) {
            s += String.fromCharCode(parseInt(h.substr(i, 4), 16));
        }
        return s;
    }

    try {
        // Parse entries: itemId -> { path, isSeq }
        // v2.8 format: "itemId|hexNew[|S];;…" — trailing "S" marks an image
        // SEQUENCE (relinked via replaceWithSequence, not replace).
        var entries = relinkDataHex.split(";;");
        var relinkMap = {};
        for (var e = 0; e < entries.length; e++) {
            if (!entries[e]) continue;
            var parts = entries[e].split("|");
            relinkMap[parts[0]] = {
                path:  fromHex(parts[1]),
                isSeq: (parts.length > 2 && parts[2] === "S")
            };
        }

        var collectAepPath = fromHex(collectAepHex);
        var origAepPath    = fromHex(origAepHex);
        var proj = app.project;

        // Step 1: Save original — locks current state to disk
        proj.save();

        // Step 2: Save As → collected .aep
        // After this, AE is editing the COPY. The original on disk
        // is the safe-state from step 1 and will not be modified.
        // v2.6: verify the collect folder actually exists before Save As —
        // a missing parent produces AE's cryptic "File couldn't be opened
        // for writing"; we surface a clear error instead.
        var collectFile = _fsFile(collectAepPath);
        if (!collectFile.parent || !collectFile.parent.exists) {
            return JSON.stringify({
                success: false,
                error: "Collect folder does not exist on disk: " +
                       (collectFile.parent ? collectFile.parent.fsName : "(none)")
            });
        }
        proj.save(collectFile);

        // Step 3: Relink each footage item on the copy — verified
        // v2.8: fsName comparison is CASE-INSENSITIVE. macOS APFS and Windows
        // NTFS are case-insensitive by default, and AE may normalize path case
        // on replace — the old strict === produced false "relinked to wrong
        // path" failures for footage that was in fact linked correctly.
        function _samePath(a, b) {
            if (a === b) return true;
            return String(a).toLowerCase() === String(b).toLowerCase();
        }
        function _parentPath(f) {
            try { return f.parent ? f.parent.fsName : ""; } catch (ep) { return ""; }
        }

        var relinked = 0;
        var failed   = [];
        for (var i = 1; i <= proj.numItems; i++) {
            var item = proj.item(i);
            if (!(item instanceof FootageItem)) continue;
            if (item.mainSource instanceof SolidSource) continue;

            var entry = relinkMap[String(item.id)];
            if (!entry) continue;   // not part of this collect (placeholder etc.)

            var f = _fsFile(entry.path);
            if (!f.exists) {
                // The collected copy is not where we expect it — do NOT replace,
                // or we would point the item at a non-existent file (offline).
                failed.push(item.name + " — collected file not found on disk");
                continue;
            }

            try {
                if (entry.isSeq) {
                    // Image sequence: plain replace() would turn it into a
                    // single still. forceAlphabetical=false → numeric order.
                    item.replaceWithSequence(f, false);
                } else {
                    item.replace(f);
                }
            } catch (re) {
                failed.push(item.name + " — replace error: " + re.toString());
                continue;
            }

            // Verify the relink actually took and resolves to the collected
            // copy on disk. "exists" alone can pass while the item still
            // points at the ORIGINAL file.
            if (item.file && item.file.exists) {
                if (entry.isSeq) {
                    // After replaceWithSequence item.file is the sequence's
                    // first frame — verifying the FOLDER is what matters.
                    if (_samePath(_parentPath(item.file), _parentPath(f))) {
                        relinked++;
                    } else {
                        failed.push(item.name + " — sequence relinked to wrong folder: " + _parentPath(item.file));
                    }
                } else if (_samePath(item.file.fsName, f.fsName)) {
                    relinked++;
                } else {
                    failed.push(item.name + " — relinked to wrong path: " + item.file.fsName);
                }
            } else {
                failed.push(item.name + " — still offline after relink");
            }
        }

        // Step 4: Save the copy with relinked paths
        proj.save();

        // Step 5: Re-open the original .aep so the user is back on their
        // working project (with original footage paths intact)
        app.open(_fsFile(origAepPath));

        return JSON.stringify({ success: true, relinked: relinked, failed: failed });
    } catch (e) {
        // Best-effort recovery: try to reopen the original project
        try { app.open(_fsFile(fromHex(origAepHex))); } catch (x) {}
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

// ─────────────────────────────────────────────────────────────
// FONT HELPERS  (v2.8 — rewritten after auditing the open-source
// Plainly plugin, plainly-videos/after-effects-plugin)
//
// Key facts this rewrite is built on:
//   • AE's NATIVE Collect Files does not collect fonts at all — it only
//     lists them in Report.txt. Copying into Fonts/ is on us.
//   • TextDocument.fontLocation / fontFamily / fontStyle are available far
//     earlier than AE 24 — the old ">= 24.0" gate needlessly discarded the
//     reliable absolute path and fell back to fuzzy filename search. Now we
//     ALWAYS try fontLocation (guarded by try/catch).
//   • When a used font is NOT installed, AE silently substitutes it —
//     td.font still reports the original PostScript name, but the rendered
//     glyphs (and td.fontLocation) belong to the SUBSTITUTE. Copying that
//     location would ship the WRONG font file. The only trustworthy
//     installed-check is app.fonts (AE 24.0+):
//         app.fonts.getFontsByPostScriptName(ps)  → Font[]
//         font.isSubstitute === true              → font is MISSING
//     (exactly how the Plainly plugin validates fonts before export).
//
// Per-font payload:
//   psName    PostScript name from the text layer
//   family    fontFamily   (fallback lookup key)
//   style     fontStyle    (fallback lookup key)
//   location  absolute file path — ONLY trusted when installed !== 0
//   installed 1 = installed, 0 = NOT installed (substituted),
//             -1 = cannot verify (app.fonts unavailable, AE < 24)
// ─────────────────────────────────────────────────────────────
function _fontInstalledState(psName, family, style) {
    // → { installed: 1|0|-1, location: string }
    var out = { installed: -1, location: "" };
    try {
        if (typeof app.fonts === "undefined" || !app.fonts) return out;

        var arr = null;
        try { arr = app.fonts.getFontsByPostScriptName(psName); } catch (e1) { arr = null; }
        if ((!arr || arr.length === 0) && family) {
            try { arr = app.fonts.getFontsByFamilyNameAndStyleName(family, style || ""); }
            catch (e2) { arr = null; }
        }
        if (!arr || arr.length === 0) { out.installed = 0; return out; }

        // Prefer a non-substitute entry if any exists
        var best = null;
        for (var i = 0; i < arr.length; i++) {
            var f = arr[i];
            var isSub = false;
            try { isSub = (f.isSubstitute === true); } catch (e3) {}
            if (!isSub) { best = f; break; }
        }
        if (!best) { out.installed = 0; return out; }   // only substitutes → missing

        out.installed = 1;
        try { if (best.location) out.location = String(best.location); } catch (e4) {}
        return out;
    } catch (e) {
        return out;
    }
}

function getFontInfo() {
    try {
        var proj = app.project;
        if (!proj) return JSON.stringify({ success: false, error: "No project open" });

        var byPs  = {};
        var order = [];

        for (var i = 1; i <= proj.numItems; i++) {
            var item = proj.item(i);
            if (!(item instanceof CompItem)) continue;
            for (var l = 1; l <= item.numLayers; l++) {
                var layer = item.layer(l);
                if (!(layer instanceof TextLayer)) continue;
                var td = null;
                try { td = layer.property("Source Text").value; } catch (eTd) { continue; }
                if (!td) continue;

                var ps = "";
                try { ps = td.font || ""; } catch (ePs) {}
                if (!ps || byPs[ps]) continue;

                var rec = { psName: ps, family: "", style: "", location: "", installed: -1 };
                try { rec.family = td.fontFamily || ""; } catch (eF) {}
                try { rec.style  = td.fontStyle  || ""; } catch (eS) {}
                try { rec.location = td.fontLocation || ""; } catch (eL) {}

                byPs[ps] = rec;
                order.push(ps);
            }
        }

        // Verify installed state via app.fonts (AE 24+). For NOT installed
        // fonts the layer-level fontLocation belongs to the substitute —
        // blank it so the panel can never copy the wrong file. For installed
        // fonts prefer the canonical app.fonts location when the layer gave
        // none.
        for (var o = 0; o < order.length; o++) {
            var r  = byPs[order[o]];
            var st = _fontInstalledState(r.psName, r.family, r.style);
            r.installed = st.installed;
            if (st.installed === 0) {
                r.location = "";
            } else if (!r.location && st.location) {
                r.location = st.location;
            }
        }

        var fonts = [];
        for (var k = 0; k < order.length; k++) fonts.push(byPs[order[k]]);

        return JSON.stringify({ success: true, fonts: fonts });
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

// ═════════════════════════════════════════════════════════════
// FONT ENGINE "plainly"  (v2.9 — EXPERIMENT)
//
// A faithful port of plainly-videos/after-effects-plugin:
//   plainly-aescripts/src/collect.ts        -> collectFontsPlainly()
//   plainly-aescripts/src/utils.ts          -> getInstalledFontsBy*()
//   plainly-plugin/src/node/bridge/…        -> decision tree lives in main.js
//
// Deliberate differences from the legacy getFontInfo() in this file:
//   • reads layer.sourceText (typed shortcut) instead of
//     layer.property("Source Text") — no dependency on the UI language
//   • does NOT decide installed/substitute state here; it only reports raw
//     app.fonts data and lets the panel apply Plainly's decision tree
//   • does NOT blank fontLocation for substituted fonts (legacy did)
//
// Known consequences of that decision tree — watch these in testing:
//   • a font AE cannot resolve at all ends up classified as INSTALLED, and
//     the location harvested from the text layer belongs to the SUBSTITUTE
//   • the only route to "not installed" is fonts[0].isSubstitute === true
//
// Rollback: set FONT_ENGINE = 'legacy' in client/main.js. Nothing here is
// called in that mode, and getFontInfo() below is untouched.
// ═════════════════════════════════════════════════════════════

function _pl_getAllComps() {
    var comps = [];
    for (var i = 1; i <= app.project.numItems; i++) {
        var item = app.project.item(i);
        if (item instanceof CompItem) comps.push(item);
    }
    return comps;
}

function _pl_getTextLayersByComp(comp) {
    var layers = [];
    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);
        if (layer instanceof TextLayer) layers.push(layer);
    }
    return layers;
}

// Port of collectFonts() from collect.ts.
// One font per text layer (the first character run) — exactly as upstream.
// Guarded with try/catch so a single unreadable layer cannot abort the whole
// collect; upstream has no guard and would throw.
function collectFontsPlainly() {
    try {
        var comps = _pl_getAllComps();
        var byPs  = {};
        var order = [];

        for (var i = 0; i < comps.length; i++) {
            var layers = _pl_getTextLayersByComp(comps[i]);
            for (var j = 0; j < layers.length; j++) {
                var td = null;
                try { td = layers[j].sourceText.value; } catch (eTd) { continue; }
                if (!td) continue;

                var ps = "";
                try { ps = td.font || ""; } catch (ePs) {}
                if (!ps) continue;
                if (byPs[ps]) continue;          // already recorded

                var rec = {
                    postScriptName: ps,
                    fontLocation:   "",
                    fontFamily:     "",
                    fontStyle:      ""
                };
                try { rec.fontLocation = td.fontLocation || ""; } catch (eL) {}
                try { rec.fontFamily   = td.fontFamily   || ""; } catch (eF) {}
                try { rec.fontStyle    = td.fontStyle    || ""; } catch (eS) {}

                byPs[ps] = rec;
                order.push(ps);
            }
        }

        var fonts = [];
        for (var k = 0; k < order.length; k++) fonts.push(byPs[order[k]]);

        return JSON.stringify({ success: true, fonts: fonts });
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

// Ports of getInstalledFontsByPostScriptName / …ByFamilyNameAndStyleName.
// Upstream returns `undefined` both when app.fonts throws AND when the
// result set is empty; the string "undefined" is what evalScript hands back
// in that case, and main.js maps it to undefined. Preserved verbatim,
// because Plainly's decision tree depends on that conflation.
function getInstalledFontsByPostScriptName(postScriptName) {
    try {
        var fontObjects = app.fonts.getFontsByPostScriptName(postScriptName);
        if (!fontObjects || fontObjects.length === 0) return "undefined";

        var fontData = [];
        for (var i = 0; i < fontObjects.length; i++) {
            var font = fontObjects[i];
            var rec = { isSubstitute: false, fontLocation: "" };
            try { rec.isSubstitute = (font.isSubstitute === true); } catch (e1) {}
            try { rec.fontLocation = font.location ? String(font.location) : ""; } catch (e2) {}
            fontData.push(rec);
        }
        return JSON.stringify(fontData);
    } catch (e) {
        return "undefined";
    }
}

function getInstalledFontsByFamilyNameAndStyleName(familyName, styleName) {
    try {
        var fontObjects = app.fonts.getFontsByFamilyNameAndStyleName(familyName, styleName);
        if (!fontObjects || fontObjects.length === 0) return "undefined";

        var fontData = [];
        for (var i = 0; i < fontObjects.length; i++) {
            var font = fontObjects[i];
            var rec = { isSubstitute: false, fontLocation: "" };
            try { rec.isSubstitute = (font.isSubstitute === true); } catch (e1) {}
            try { rec.fontLocation = font.location ? String(font.location) : ""; } catch (e2) {}
            fontData.push(rec);
        }
        return JSON.stringify(fontData);
    } catch (e) {
        return "undefined";
    }
}

// Diagnostic only — never gates the collect. AE's own list of fonts used in
// the project; anything here that the walk above missed is a bug in the
// collector, and this is how we see it in production.
function getUsedFontsSnapshot() {
    try {
        var names = [];
        if (typeof app.project.usedFonts !== "undefined" && app.project.usedFonts) {
            var uf = app.project.usedFonts;
            for (var i = 0; i < uf.length; i++) {
                var n = "";
                try { n = uf[i].font ? String(uf[i].font.postScriptName) : ""; } catch (e1) {}
                if (!n) { try { n = String(uf[i].postScriptName || ""); } catch (e2) {} }
                if (n) names.push(n);
            }
        }
        return JSON.stringify({ success: true, used: names });
    } catch (e) {
        return JSON.stringify({ success: true, used: [] });
    }
}

// ─────────────────────────────────────────────────────────────
// INTERNAL: shared organize logic (safe iteration + expanded file types)
// ─────────────────────────────────────────────────────────────
// v3.0: folder names come from a config object so a future Settings screen
// can let each team name their own. Passing nothing keeps the Gismart
// defaults, so every existing call site is unaffected.
var ORG_FOLDER_DEFAULTS = {
    finalComps: "#1_finalComps",
    preComps:   "#2_preComps",
    sound:      "#3_sound",
    footages:   "#4_footages",
    solids:     "#5_solids",
    motion:     "motion",
    graphics:   "static"
};

function _doOrganize(cfg) {
    var F = {};
    for (var dk in ORG_FOLDER_DEFAULTS) {
        if (!ORG_FOLDER_DEFAULTS.hasOwnProperty(dk)) continue;
        F[dk] = (cfg && cfg[dk]) ? String(cfg[dk]) : ORG_FOLDER_DEFAULTS[dk];
    }

    var proj       = app.project;
    var rootFolder = proj.rootFolder;

    // Flatten — collect first, then move (avoids index shifting)
    var itemsToMove = [];
    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (!(item instanceof FolderItem) && item.parentFolder !== rootFolder) {
            itemsToMove.push(item);
        }
    }
    for (var m = 0; m < itemsToMove.length; m++) {
        itemsToMove[m].parentFolder = rootFolder;
    }

    // Delete folders (reverse order)
    for (var i = rootFolder.numItems; i >= 1; i--) {
        var item = rootFolder.item(i);
        if (item instanceof FolderItem) item.remove();
    }

    // Create folder structure
    var finalsFolder    = rootFolder.items.addFolder(F.finalComps);
    var preCompsFolder  = rootFolder.items.addFolder(F.preComps);
    var soundFolder     = rootFolder.items.addFolder(F.sound);
    var footagesFolder  = rootFolder.items.addFolder(F.footages);
    var solidsFolder    = rootFolder.items.addFolder(F.solids);
    var videosSubfolder   = footagesFolder.items.addFolder(F.motion);
    var graphicsSubfolder = footagesFolder.items.addFolder(F.graphics);

    // Distribute — collect all first, then sort
    var allItems = [];
    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (!(item instanceof FolderItem)) allItems.push(item);
    }

    for (var idx = 0; idx < allItems.length; idx++) {
        var item = allItems[idx];

        if (item instanceof CompItem) {
            item.parentFolder = (item.usedIn.length > 0) ? preCompsFolder : finalsFolder;
            continue;
        }

        if (!(item instanceof FootageItem)) continue;

        // Sound FIRST (priority)
        var srcFile = item.mainSource && item.mainSource.file
            ? item.mainSource.file
            : (item.file || null);
        if (srcFile && /\.(wav|mp3|aac|aif|aiff|m4a|ogg|flac)$/i.test(srcFile.displayName || srcFile.name)) {
            item.parentFolder = soundFolder;
            continue;
        }

        if (item.mainSource instanceof SolidSource) {
            item.parentFolder = solidsFolder;
            continue;
        }

        if (srcFile && /\.(mov|mp4|avi|flv|mts|mkv|webm|m4v|wmv|mxf)$/i.test(srcFile.displayName || srcFile.name)) {
            item.parentFolder = videosSubfolder;
            continue;
        }

        if (srcFile && /\.(png|psd|ai|jpeg|jpg|eps|heic|tiff|tif|svg|gif|bmp|webp|exr|hdr)$/i.test(srcFile.displayName || srcFile.name)) {
            item.parentFolder = graphicsSubfolder;
            continue;
        }

        if (item.mainSource && item.mainSource.isStill && srcFile) {
            item.parentFolder = graphicsSubfolder;
            continue;
        }

        item.parentFolder = footagesFolder;
    }
}

// ═════════════════════════════════════════════════════════════
// COLLECT ENGINE v3
//
// Replaces getProjectInfo() + relinkAndSave(). Both v2 functions above are
// left untouched — set COLLECT_ENGINE = 'v2' in client/main.js to roll back.
//
// What changed and why:
//   • Transport is a temp JSON FILE, not a hex string inside evalScript.
//     The v2 relink payload was 4 hex chars per character of every path;
//     ~300 items pushed it past 150 KB in a single evalScript argument,
//     where it could truncate or fail outright.
//   • item.footageMissing decides online/offline, not File.exists — the
//     latter lies on network volumes and on paths with non-ASCII names.
//   • NOTHING is skipped silently. Every item that does not become a copy
//     candidate lands in skipped[] with a reason.
//   • Footage interpretation (frame rate conform, alpha, loop, fields,
//     pulldown) is snapshotted before replace() and restored after —
//     replace() resets it to the file's defaults.
//   • Sequences are detected from item.name ("frame_[0000-0100].png"),
//     which AE itself generates, instead of guessing from the extension.
//     The old heuristic classed animated GIF / APNG / multi-page TIFF as
//     sequences and fed them to replaceWithSequence().
//   • Layered PSD/AI are flagged; replace() on them is unsafe.
//   • beginSuppressDialogs() wraps the whole relink loop.
//   • A post-flight audit walks EVERY footage item after save and proves
//     it is online and inside the collect folder.
// ═════════════════════════════════════════════════════════════

function _v3_readFile(p) {
    var f = _fsFile(p);
    if (!f.exists) return null;
    f.encoding = "UTF-8";
    f.open("r");
    var s = f.read();
    f.close();
    return s;
}

function _v3_writeFile(p, s) {
    var f = _fsFile(p);
    if (f.parent && !f.parent.exists) f.parent.create();
    f.encoding = "UTF-8";
    f.open("w");
    f.write(s);
    f.close();
    return f.fsName;
}

// ExtendScript has no JSON.parse (the polyfill above only covers stringify).
// The job file is written by our own panel, so eval is safe here.
function _v3_parse(s) { return eval("(" + s + ")"); }

function _v3_folderPath(item, proj) {
    var parts = [];
    var parent = item.parentFolder;
    while (parent && parent !== proj.rootFolder) {
        parts.unshift(parent.name);
        parent = parent.parentFolder;
    }
    return parts.join("/");
}

// AE names a sequence item "prefix_[00000-00120].ext". That bracketed frame
// range is generated by AE itself and is the only trustworthy signal.
function _v3_isSequence(item) {
    try {
        if (!item.mainSource || !(item.mainSource instanceof FileSource)) return false;
        if (item.mainSource.isStill) return false;
        if (/\[\d+[-–]\d+\]/.test(String(item.name))) return true;
        return false;
    } catch (e) { return false; }
}

function _v3_isLayered(item) {
    try {
        var f = item.mainSource && item.mainSource.file ? item.mainSource.file : item.file;
        if (!f) return false;
        return /\.(psd|ai|psb|eps)$/i.test(String(f.displayName || f.name));
    } catch (e) { return false; }
}

// Snapshot of everything item.replace() is known to reset.
function _v3_readInterpret(item) {
    var s = {};
    var ms = item.mainSource;
    if (!ms) return s;
    var keys = ["alphaMode", "premulColor", "invertAlpha", "conformFrameRate",
                "fieldSeparationType", "highQualityFieldSeparation", "loop",
                "removePulldown", "displayFrameRate"];
    for (var i = 0; i < keys.length; i++) {
        try { if (typeof ms[keys[i]] !== "undefined") s[keys[i]] = ms[keys[i]]; } catch (e) {}
    }
    return s;
}

function _v3_applyInterpret(item, s) {
    var ms = item.mainSource;
    if (!ms || !s) return;
    for (var k in s) {
        if (!s.hasOwnProperty(k)) continue;
        try { ms[k] = s[k]; } catch (e) {}
    }
}

// ─────────────────────────────────────────────────────────────
// getProjectInfoToFile — writes the full inventory to outPath, returns a
// small acknowledgement. Keeps the evalScript return value tiny regardless
// of project size.
// ─────────────────────────────────────────────────────────────
function getProjectInfoToFile(outPathHex) {
    function fromHex(h) {
        var s = "";
        for (var i = 0; i < h.length; i += 4) s += String.fromCharCode(parseInt(h.substr(i, 4), 16));
        return s;
    }
    try {
        var outPath = fromHex(outPathHex);
        var proj = app.project;
        if (!proj) return JSON.stringify({ success: false, error: "No project open" });
        var projFile = proj.file;
        if (!projFile) return JSON.stringify({ success: false, error: "Please save the project first" });

        // First layer occurrence per footage item (for optional renaming)
        var layerNameById = {};
        for (var ci = 1; ci <= proj.numItems; ci++) {
            var compItem = proj.item(ci);
            if (!(compItem instanceof CompItem)) continue;
            for (var li = 1; li <= compItem.numLayers; li++) {
                var lyr = compItem.layer(li);
                var src = null;
                try { src = lyr.source; } catch (eSrc) { continue; }
                if (!src || !(src instanceof FootageItem)) continue;
                if (src.mainSource instanceof SolidSource) continue;
                if (layerNameById[src.id]) continue;
                try { if (lyr.name) layerNameById[src.id] = lyr.name; } catch (eL) {}
            }
        }

        var files   = [];
        var missing = [];
        var skipped = [];   // every non-collected item, with a reason

        for (var i = 1; i <= proj.numItems; i++) {
            var item = proj.item(i);
            if (!(item instanceof FootageItem)) continue;

            var ms = item.mainSource;

            if (ms instanceof SolidSource) continue;             // regenerated by AE
            if (ms instanceof PlaceholderSource) {
                skipped.push({ name: item.name, reason: "placeholder (не має файлу на диску)" });
                continue;
            }

            // AE's own verdict beats File.exists.
            var isMissing = false;
            try { isMissing = (item.footageMissing === true); } catch (eFM) {}

            var srcFile = null;
            try { srcFile = item.file ? item.file : (ms && ms.file ? ms.file : null); } catch (eF) {}

            if (!srcFile) {
                skipped.push({ name: item.name, reason: "AE не повідомив шлях до файлу" });
                continue;
            }
            if (isMissing) {
                missing.push({ name: item.name, path: srcFile.fsName, itemId: item.id });
                continue;
            }

            // Proxy: collect it too, otherwise the delivered project has an
            // offline proxy (or an offline master, depending on useProxy).
            var proxyPath = "";
            try {
                if (item.useProxy && item.proxySource && item.proxySource.file) {
                    proxyPath = item.proxySource.file.fsName;
                }
            } catch (eP) {}

            files.push({
                path:       srcFile.fsName,
                folderPath: _v3_folderPath(item, proj),
                itemName:   item.name || "",
                layerName:  layerNameById[item.id] || "",
                itemId:     item.id,
                isSequence: _v3_isSequence(item),
                isLayered:  _v3_isLayered(item),
                useProxy:   (item.useProxy === true),
                proxyPath:  proxyPath
            });
        }

        var aepDisplayName = projFile.displayName || decodeURI(projFile.name);

        var payload = JSON.stringify({
            success:  true,
            aepPath:  projFile.fsName,
            aepName:  aepDisplayName,
            projName: aepDisplayName.replace(/\.aep$/i, ""),
            footage:  files,
            missing:  missing,
            skipped:  skipped
        });

        _v3_writeFile(outPath, payload);
        return JSON.stringify({ success: true, bytes: payload.length, items: files.length });
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

// ─────────────────────────────────────────────────────────────
// relinkAndSaveFromFile — job file shape:
// { collectAep, origAep, footageRoot,
//   relink: [ { id, path, isSeq, interpretKeep } ],
//   skipRelinkIds: [ id, … ] }        // layered PSD/AI the user chose to skip
// ─────────────────────────────────────────────────────────────
function relinkAndSaveFromFile(jobPathHex) {
    function fromHex(h) {
        var s = "";
        for (var i = 0; i < h.length; i += 4) s += String.fromCharCode(parseInt(h.substr(i, 4), 16));
        return s;
    }
    var origAepPath = "";
    var suppressed  = false;
    try {
        var jobPath = fromHex(jobPathHex);
        var raw = _v3_readFile(jobPath);
        if (!raw) return JSON.stringify({ success: false, error: "Job file not found: " + jobPath });
        var job = _v3_parse(raw);

        origAepPath = job.origAep;
        var proj = app.project;

        var relinkMap = {};
        for (var r = 0; r < job.relink.length; r++) {
            relinkMap[String(job.relink[r].id)] = job.relink[r];
        }
        var skipIds = {};
        for (var s2 = 0; s2 < (job.skipRelinkIds || []).length; s2++) {
            skipIds[String(job.skipRelinkIds[s2])] = true;
        }

        proj.save();                                  // safety net on the original

        var collectFile = _fsFile(job.collectAep);
        if (!collectFile.parent || !collectFile.parent.exists) {
            return JSON.stringify({ success: false,
                error: "Collect folder does not exist: " +
                       (collectFile.parent ? collectFile.parent.fsName : "(none)") });
        }
        proj.save(collectFile);                       // AE now edits the COPY

        function _same(a, b) {
            return String(a) === String(b) || String(a).toLowerCase() === String(b).toLowerCase();
        }
        function _parent(f) { try { return f.parent ? f.parent.fsName : ""; } catch (e) { return ""; } }
        function _inside(p, root) {
            return String(p).toLowerCase().indexOf(String(root).toLowerCase()) === 0;
        }

        // Modal dialogs (Interpret Footage, codec prompts) mid-loop would
        // block or abort the script and leave a half-relinked project.
        app.beginSuppressDialogs();
        suppressed = true;

        var relinked = 0;
        var failed   = [];

        for (var i = 1; i <= proj.numItems; i++) {
            var item = proj.item(i);
            if (!(item instanceof FootageItem)) continue;
            if (item.mainSource instanceof SolidSource) continue;

            var entry = relinkMap[String(item.id)];
            if (!entry) continue;

            var f = _fsFile(entry.path);
            if (!f.exists) {
                failed.push(item.name + " — скопійованого файлу немає на диску: " + entry.path);
                continue;
            }

            var snapshot = entry.interpretKeep === false ? null : _v3_readInterpret(item);

            try {
                if (entry.isSeq) item.replaceWithSequence(f, false);
                else             item.replace(f);
            } catch (re) {
                failed.push(item.name + " — replace error: " + re.toString());
                continue;
            }

            if (snapshot) _v3_applyInterpret(item, snapshot);

            var ok = false;
            try {
                if (item.file && item.footageMissing !== true) {
                    ok = entry.isSeq
                        ? _same(_parent(item.file), _parent(f))
                        : _same(item.file.fsName, f.fsName);
                }
            } catch (eV) {}

            if (ok) relinked++;
            else failed.push(item.name + " — після relink не вказує на копію");
        }

        proj.save();

        // ── POST-FLIGHT AUDIT ────────────────────────────────────
        // Walk every footage item in the saved project and prove it is
        // online AND inside the collect folder. Items the user knowingly
        // excluded (layered PSD/AI) are listed separately, not as failures.
        var audit = { offline: [], outside: [], skippedByChoice: [] };
        var root = job.footageRoot;
        for (var a = 1; a <= proj.numItems; a++) {
            var it = proj.item(a);
            if (!(it instanceof FootageItem)) continue;
            if (it.mainSource instanceof SolidSource) continue;
            if (it.mainSource instanceof PlaceholderSource) continue;

            var offline = false;
            try { offline = (it.footageMissing === true); } catch (eA) {}
            if (offline) { audit.offline.push(it.name); continue; }

            var p = "";
            try { p = it.file ? it.file.fsName : ""; } catch (eB) {}
            if (!p) { audit.offline.push(it.name + " (немає шляху)"); continue; }

            if (!_inside(p, root)) {
                if (skipIds[String(it.id)]) audit.skippedByChoice.push(it.name);
                else audit.outside.push(it.name + " → " + p);
            }
        }

        app.endSuppressDialogs(false);
        suppressed = false;

        app.open(_fsFile(origAepPath));               // user back on the original

        return JSON.stringify({
            success:  true,
            relinked: relinked,
            failed:   failed,
            audit:    audit
        });
    } catch (e) {
        if (suppressed) { try { app.endSuppressDialogs(false); } catch (x) {} }
        try { if (origAepPath) app.open(_fsFile(origAepPath)); } catch (x2) {}
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

// ─────────────────────────────────────────────────────────────
// organizeAndCleanV3 — reduceProject() via the API instead of
// findMenuCommandId("Reduce Project"), which resolves against the CURRENT
// UI LANGUAGE and silently returns 0 on a localized After Effects.
// Also drops the app.project.save() that v2 performed on the user's
// original file mid-operation.
// ─────────────────────────────────────────────────────────────
function organizeAndCleanV3(foldersJsonHex) {
    function fromHex(h) {
        var s = "";
        for (var i = 0; i < h.length; i += 4) s += String.fromCharCode(parseInt(h.substr(i, 4), 16));
        return s;
    }
    try {
        var proj = app.project;
        if (!proj) return JSON.stringify({ success: false, error: "No project open" });

        var selectedComps = [];
        for (var i = 0; i < proj.selection.length; i++) {
            if (proj.selection[i] instanceof CompItem) selectedComps.push(proj.selection[i]);
        }
        if (selectedComps.length === 0)
            return JSON.stringify({ success: false, error: "Please select at least one composition first" });

        var cfg = null;
        if (foldersJsonHex) { try { cfg = _v3_parse(fromHex(foldersJsonHex)); } catch (eC) { cfg = null; } }

        app.beginUndoGroup("Organize and Clean Project");
        var removed = proj.reduceProject(selectedComps);
        _doOrganize(cfg);
        app.endUndoGroup();

        return JSON.stringify({ success: true, removed: removed });
    } catch (e) {
        try { app.endUndoGroup(); } catch (x) {}
        return JSON.stringify({ success: false, error: e.toString() });
    }
}
