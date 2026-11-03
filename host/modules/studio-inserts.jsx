/**
 * FitMe Studio — Disclaimer and CTA inserts.
 *
 * Two extra tools hung off Motion Kit's dispatcher (MK.tools / MK.run), kept
 * in their own file so motion-kit.jsx stays as close to its upstream build as
 * possible.
 *
 * Nothing here draws anything. The chevrons, the blackout ramp, the type
 * settings and every keyframe come from assets/fitme-studio-templates.aep —
 * the project the designer actually made — and are brought across with
 * Layer.copyToComp(). Rebuilding a shape layer and its animation from script
 * would mean guessing at path data and easing, and the result would drift from
 * the reference the moment either was touched. Copying cannot drift: the
 * template *is* the specification.
 *
 * The template is imported once per project and parked in a folder. Later
 * presses reuse it. It is found again by a tag in the comp's comment rather
 * than by name or index — names collide and indices move the moment anything
 * is added to the project.
 *
 * What the tools decide at runtime, because a template cannot know it:
 *   - where the layers sit in the stack
 *   - when they start and how long they last
 *   - how to cope with a comp that is not 1080x1920
 */

/* global MK, app, File, ImportOptions, CompItem, FolderItem, TextLayer */

(function () {

    if (typeof MK !== "object" || !MK || !MK.tools) { return; }

    var TEMPLATE_FILE = "/assets/fitme-studio-templates.aep";
    var TEMPLATE_COMP = "explanation comp for Claude";
    var TEMPLATE_TAG  = "[fitme-studio-template]";
    var TEMPLATE_DIR  = "Spilio Studio templates";

    var L_DISCLAIMER = "Long disclaimer [text]";

    // Text written into the disclaimer layer after it is copied from the
    // template. The template still carries the old long legal text; this
    // overrides it. Set to "" to keep whatever the template says.
    var DISCLAIMER_TEXT = "This video contains AI-generated content";
    var L_CTA_TEXT   = "Tap the screen! [text]";
    var L_CTA_ARROWS = "CTA";
    var L_BLACKOUT   = "BlackOut";

    // The template was built at the FitMe vertical size. Anything else gets
    // remapped, and the report says so.
    var BASE_W = 1080;
    var BASE_H = 1920;

    // Longest a CTA blackout may run, regardless of how much comp is left.
    var CTA_MAX_SECONDS = 15;

    // Font size forced onto the CTA line after its scale is normalised.
    // Set to 0 to keep whatever size the template carries.
    var CTA_FONT_SIZE = 82;

    /* ------------------------------------------------------------ template */

    function taggedComp() {
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem &&
                item.comment &&
                item.comment.indexOf(TEMPLATE_TAG) !== -1) {
                return item;
            }
        }
        return null;
    }

    function findFolder(name) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof FolderItem && item.name === name) { return item; }
        }
        return null;
    }

    /**
     * Import the template project and return its comp.
     *
     * Importing an .aep drags in the source project's whole folder tree. The
     * new items are identified by diffing item ids across the import rather
     * than by trusting what importFile returns, then the comp is moved
     * somewhere obvious and the empty folders that came with it are dropped.
     */
    function importTemplate(extensionPath) {
        if (!extensionPath) {
            throw new Error("The panel did not pass its extension path.");
        }

        var file = new File(extensionPath + TEMPLATE_FILE);
        if (!file.exists) {
            throw new Error("Template project missing at " + file.fsName);
        }

        var before = {};
        var i, item;
        for (i = 1; i <= app.project.numItems; i++) {
            before[app.project.item(i).id] = true;
        }

        app.project.importFile(new ImportOptions(file));

        var comp = null;
        var fresh = [];
        for (i = 1; i <= app.project.numItems; i++) {
            item = app.project.item(i);
            if (before[item.id]) { continue; }
            fresh.push(item);
            if (item instanceof CompItem && item.name === TEMPLATE_COMP) { comp = item; }
        }

        if (!comp) {
            throw new Error('Imported the template but found no comp named "' + TEMPLATE_COMP + '".');
        }

        comp.comment = (comp.comment || "") + " " + TEMPLATE_TAG;

        var home = findFolder(TEMPLATE_DIR) || app.project.items.addFolder(TEMPLATE_DIR);
        comp.parentFolder = home;

        // Only folders that arrived with this import, and only once they are
        // empty. Nothing of the user's is touched.
        for (i = fresh.length - 1; i >= 0; i--) {
            item = fresh[i];
            try {
                if (item instanceof FolderItem && item.numItems === 0) { item.remove(); }
            } catch (e) { /* still in use — leave it */ }
        }

        return comp;
    }

    function template(args) {
        return taggedComp() || importTemplate(args && args.extensionPath);
    }

    /* --------------------------------------------------------------- layers */

    function layerNamed(comp, name) {
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).name === name) { return comp.layer(i); }
        }
        return null;
    }

    /**
     * Copy one template layer into the destination comp and hand back the
     * copy itself.
     *
     * Never assume where copyToComp puts it. It behaves like a paste: the
     * landing spot follows the current selection, so with a layer selected the
     * copy arrives next to that layer rather than at the top. 1.0.6 returned
     * dst.layer(1) on the assumption it landed there, which handed every
     * caller the comp's existing top layer instead — that layer then got the
     * timing meant for the copy (stretched across the whole comp) while the
     * real copies sat where the paste dropped them, in copy order.
     *
     * So: clear the selection first, which also stops the paste landing
     * against whatever the designer happened to have clicked, then find the
     * layer that was not there a moment ago. Layer.id is unique and survives
     * between sessions; if a host ever returns nothing useful for it, the
     * freshly pasted layer is the selected one.
     */
    function bring(src, name, dst) {
        var layer = layerNamed(src, name);
        if (!layer) { throw new Error('Template layer "' + name + '" is missing.'); }

        var before = {};
        var usableIds = true;
        var i, existing;

        for (i = 1; i <= dst.numLayers; i++) {
            existing = dst.layer(i);
            existing.selected = false;
            if (typeof existing.id !== "number") { usableIds = false; }
            before["k" + existing.id] = true;
        }

        layer.copyToComp(dst);

        if (usableIds) {
            for (i = 1; i <= dst.numLayers; i++) {
                if (!before["k" + dst.layer(i).id]) { return dst.layer(i); }
            }
        }

        var picked = dst.selectedLayers;
        if (picked && picked.length === 1) { return picked[0]; }

        throw new Error('Could not find the copy of "' + name + '" in the comp.');
    }

    /**
     * Fit a copied layer to a comp that is not the template's size.
     *
     * Position is remapped by each axis independently so things keep their
     * relative place in frame. Scale is uniform, because non-uniform scale on
     * type and chevrons looks wrong — except for a full-frame cover like the
     * blackout, which has to grow by the larger ratio or it leaves a gap.
     *
     * Anything keyframed is left alone and reported; silently rewriting the
     * first key of an animated position would be worse than not fitting.
     */
    function refit(layer, dst, cover, notes) {
        var sx = dst.width / BASE_W;
        var sy = dst.height / BASE_H;
        if (sx === 1 && sy === 1) { return; }

        var factor = cover ? Math.max(sx, sy) : Math.min(sx, sy);
        var group = layer.property("ADBE Transform Group");

        var pos = group.property("ADBE Position");
        if (pos && pos.numKeys === 0) {
            var p = pos.value;
            var moved = [p[0] * sx, p[1] * sy];
            if (p.length > 2) { moved.push(p[2] * factor); }
            pos.setValue(moved);
        } else if (pos) {
            notes.push(layer.name + ": animated position left as-is");
        }

        var scale = group.property("ADBE Scale");
        if (scale && scale.numKeys === 0) {
            var s = scale.value;
            var scaled = [s[0] * factor, s[1] * factor];
            if (s.length > 2) { scaled.push(s[2] * factor); }
            scale.setValue(scaled);
        } else if (scale) {
            notes.push(layer.name + ": animated scale left as-is");
        }
    }

    /**
     * Bring a text layer to Scale 100% and, optionally, to a fixed font size.
     *
     * Layers copied from the template arrive with whatever scale the designer
     * left on them — the CTA line comes in at 174% — and a text layer sitting
     * at a non-100% scale is a nuisance downstream: every later size decision
     * has to be made through a multiplier, and nobody remembers to.
     *
     * Two separate steps, in this order:
     *
     *   1. Normalise. Everything measured in layer space — the text box, its
     *      offset, the anchor, manual leading, the stroke and the font size
     *      itself — is multiplied by the old scale factor, then Scale is set
     *      to 100%. Nothing moves and nothing changes size on screen; the same
     *      picture is simply described honestly.
     *
     *   2. Resize, if a font size was asked for. The stroke and any manual
     *      leading follow it by the same ratio, so the proportions the
     *      designer chose survive the new size.
     *
     * Anything animated is left exactly as it was and named in the status
     * line. Rewriting the static value of a property that has keyframes would
     * do nothing useful and would hide the fact that it did nothing.
     */
    function normaliseText(layer, fontSize, notes) {
        var group = layer.property("ADBE Transform Group");
        var scaleProp = group.property("ADBE Scale");
        var anchorProp = group.property("ADBE Anchor Point");
        var textGroup = layer.property("ADBE Text Properties");
        var docProp = textGroup ? textGroup.property("ADBE Text Document") : null;

        if (!docProp || !scaleProp) { return; }

        if (scaleProp.numKeys > 0 || (anchorProp && anchorProp.numKeys > 0) || docProp.numKeys > 0) {
            notes.push(layer.name + ": animated, left at " +
                       Math.round(scaleProp.value[0]) + "%");
            return;
        }

        var doc;
        try {
            doc = docProp.value;
        } catch (eRead) {
            notes.push(layer.name + ": mixed styles, scale left as-is");
            return;
        }

        var s = scaleProp.value;
        var fx = s[0] / 100;
        var fy = s[1] / 100;

        /* ---- 1. scale the layer's own geometry up, then Scale down to 100 */

        if (fx !== 1 || fy !== 1) {
            try {
                if (doc.boxText) {
                    doc.boxTextSize = [doc.boxTextSize[0] * fx, doc.boxTextSize[1] * fy];
                    doc.boxTextPos = [doc.boxTextPos[0] * fx, doc.boxTextPos[1] * fy];
                }
            } catch (eBox) { notes.push(layer.name + ": text box left as-is"); }

            try { doc.fontSize = doc.fontSize * fx; } catch (eSize) {}
            try { if (!doc.autoLeading) { doc.leading = doc.leading * fx; } } catch (eLead) {}
            try { if (doc.applyStroke) { doc.strokeWidth = doc.strokeWidth * fx; } } catch (eStroke) {}

            if (anchorProp && anchorProp.numKeys === 0) {
                var a = anchorProp.value;
                var moved = [a[0] * fx, a[1] * fy];
                if (a.length > 2) { moved.push(a[2] * fx); }
                anchorProp.setValue(moved);
            }

            scaleProp.setValue(s.length > 2 ? [100, 100, 100] : [100, 100]);
        }

        /* ---- 2. the size actually wanted, with stroke and leading in step */

        if (fontSize) {
            var current = 0;
            try { current = Number(doc.fontSize); } catch (eNow) { current = 0; }

            if (current > 0 && current !== fontSize) {
                var ratio = fontSize / current;
                try { doc.fontSize = fontSize; } catch (eSet) {}
                try { if (!doc.autoLeading) { doc.leading = doc.leading * ratio; } } catch (eL2) {}
                try { if (doc.applyStroke) { doc.strokeWidth = doc.strokeWidth * ratio; } } catch (eS2) {}
            }
        }

        try { docProp.setValue(doc); } catch (eWrite) {
            notes.push(layer.name + ": could not write text settings");
        }
    }

    /**
     * Slide a layer so its in point lands on `start`, keeping its internal
     * timing intact, then trim the tail.
     *
     * startTime is moved rather than inPoint because inPoint trims: setting it
     * directly would cut the head off the animation instead of moving it.
     */
    function place(layer, start, end) {
        layer.startTime += (start - layer.inPoint);
        layer.inPoint = start;
        layer.outPoint = end;
    }

    /**
     * Replace the copied layer's Source Text, keeping font, size, colour,
     * stroke, box and alignment exactly as the template set them. Only the
     * string changes. An animated Source Text is left alone and reported.
     */
    function setText(layer, text, notes) {
        if (!text) { return; }

        var textGroup = layer.property("ADBE Text Properties");
        var docProp = textGroup ? textGroup.property("ADBE Text Document") : null;
        if (!docProp) { notes.push(layer.name + ": not a text layer, text left as-is"); return; }

        if (docProp.numKeys > 0) {
            notes.push(layer.name + ": source text is animated, text left as-is");
            return;
        }

        var doc;
        try { doc = docProp.value; } catch (eRead) {
            notes.push(layer.name + ": mixed styles, text left as-is");
            return;
        }

        try {
            doc.text = text;
            docProp.setValue(doc);
        } catch (eWrite) {
            notes.push(layer.name + ": could not write the text");
        }
    }

    /** Topmost layer whose name mentions a disclaimer, or null. */
    function disclaimerIn(comp) {
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).name.toLowerCase().indexOf("disclaimer") !== -1) {
                return comp.layer(i);
            }
        }
        return null;
    }

    function sizeNote(comp, notes) {
        if (comp.width !== BASE_W || comp.height !== BASE_H) {
            notes.push("comp is " + comp.width + "x" + comp.height +
                       ", template is " + BASE_W + "x" + BASE_H + " — positions remapped");
        }
    }

    function report(message, notes) {
        return MK.ok(notes.length ? message + " (" + notes.join("; ") + ")" : message);
    }

    /* ----------------------------------------------------------- disclaimer */

    MK.tools["studio.disclaimer"] = {
        needs: { comp: true },
        undo: true,
        undoName: "Insert disclaimer",

        run: function (args) {
            var comp = MK.sel.comp();
            var notes = [];

            if (disclaimerIn(comp)) {
                return MK.fail("This comp already has a disclaimer layer.");
            }

            var src = template(args);
            var layer = bring(src, L_DISCLAIMER, comp);

            // The template's wording is replaced; its typography is kept.
            setText(layer, DISCLAIMER_TEXT, notes);

            // Whole comp, very top. moveToBeginning is doing real work here:
            // the paste lands wherever the selection was, not at index 1.
            layer.startTime = 0;
            layer.inPoint = 0;
            layer.outPoint = comp.duration;
            layer.moveToBeginning();

            // Scale only — the disclaimer's size is the designer's call, so
            // no font size is forced here.
            normaliseText(layer, 0, notes);

            sizeNote(comp, notes);
            refit(layer, comp, false, notes);

            return report("Disclaimer added over the whole comp.", notes);
        }
    };

    /* ------------------------------------------------------------------ CTA */

    MK.tools["studio.cta"] = {
        needs: { comp: true },
        undo: true,
        undoName: "Insert CTA",

        run: function (args) {
            var comp = MK.sel.comp();
            var notes = [];

            var start = comp.time;
            if (start >= comp.duration) {
                return MK.fail("The playhead is at the end of the comp.");
            }

            var end = Math.min(comp.duration, start + CTA_MAX_SECONDS);
            if (comp.duration - start > CTA_MAX_SECONDS) {
                notes.push("capped at " + CTA_MAX_SECONDS + "s");
            }

            var src = template(args);

            // Copy order no longer decides the stack — bring() hands back the
            // actual copy wherever the paste dropped it, and the block is
            // moved into place below. Copied in reading order to match.
            var text     = bring(src, L_CTA_TEXT, comp);
            var arrows   = bring(src, L_CTA_ARROWS, comp);
            var blackout = bring(src, L_BLACKOUT, comp);

            var block = [text, arrows, blackout];
            var i;

            for (i = 0; i < block.length; i++) {
                place(block[i], start, end);
            }

            // Top down: text, then chevrons, then blackout. moveAfter puts a
            // layer directly below the one named, so walking the block in
            // order and carrying `above` forward builds the stack as written.
            // A disclaimer, if the comp has one, outranks the whole block.
            var above = disclaimerIn(comp);
            for (i = 0; i < block.length; i++) {
                if (above) { block[i].moveAfter(above); }
                else { block[i].moveToBeginning(); }
                above = block[i];
            }

            normaliseText(text, CTA_FONT_SIZE, notes);

            // After normalising, before refit: in a 1080x1920 comp refit is a
            // no-op and the layer stays at a clean 100%. Anywhere else refit
            // scales on purpose, and that should be the last word.
            sizeNote(comp, notes);
            refit(text, comp, false, notes);
            refit(arrows, comp, false, notes);
            refit(blackout, comp, true, notes);

            var seconds = Math.round((end - start) * 10) / 10;
            return report("CTA added at the playhead for " + seconds + "s.", notes);
        }
    };
    /* ------------------------------------------------------------ body */

    /**
     * Keep the last reply where the panel can fetch it separately.
     *
     * Importing a 78 MB render into a comp with a hundred-odd layers takes
     * long enough that CEP hands the callback an empty string even though the
     * script finished and the layer is sitting in the timeline. The panel then
     * reports "Unreadable host response" for work that plainly succeeded.
     *
     * So the outcome is stashed here as well as returned. When the reply comes
     * back empty, the panel asks for this instead — a second, instant call
     * that cannot time out.
     */
    function remember(result) {
        try {
            $.global.FitMeStudio = $.global.FitMeStudio || {};
            $.global.FitMeStudio.lastImport = MK.json.stringify(result);
        } catch (e) {}
        return result;
    }

    /**
     * Hex in, path out.
     *
     * The file name comes from Drive, so it can carry anything — accents,
     * CJK, an apostrophe. Squeezing that through an evalScript string literal
     * is how path bugs start, so the panel sends it hex-encoded. Same reason
     * org.jsx does it.
     */
    function fromHex(hex) {
        var out = "";
        for (var i = 0; i + 1 < hex.length; i += 2) {
            out += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        }
        return decodeURIComponent(escape(out));   // the bytes were UTF-8
    }

    MK.tools["studio.importBody"] = {
        needs: { comp: true },
        undo: true,
        undoName: "Import body",

        /**
         * Step-tracked on purpose.
         *
         * When this failed in the field the panel showed "Unreadable host
         * response:" with nothing after the colon — an empty string back from
         * evalScript, which is what AE gives when the script never returns a
         * value at all. MK.run catches exceptions and always serialises, so an
         * empty reply means execution left the building somewhere no catch
         * could see it.
         *
         * Every stage now records where it got to, and the reply names that
         * stage. A failure says "importing the file" or "adding the layer"
         * instead of nothing.
         */
        run: function (args) {
            var stage = "starting";
            var notes = [];

            try {
                stage = "reading the path";
                if (!args || !args.pathHex) { return MK.fail("No file was passed."); }

                var file = new File(fromHex(args.pathHex));
                if (!file.exists) { return MK.fail("Downloaded file not found: " + file.fsName); }

                stage = "finding the comp";
                var comp = MK.sel.comp();
                if (!comp) { return MK.fail("Open a comp first."); }

                stage = "importing the file";
                var io = new ImportOptions(file);
                if (!io.canImportAs(ImportAsType.FOOTAGE)) {
                    return MK.fail("After Effects cannot import " + file.name + ".");
                }
                io.importAs = ImportAsType.FOOTAGE;

                // Reuse an item already in the project rather than importing
                // the same render a second time on every press.
                var item = null;
                for (var i = 1; i <= app.project.numItems; i++) {
                    var candidate = app.project.item(i);
                    try {
                        if (candidate instanceof FootageItem && candidate.file &&
                            candidate.file.fsName === file.fsName) {
                            item = candidate;
                            notes.push("already in the project");
                            break;
                        }
                    } catch (eScan) {}
                }

                if (!item) { item = app.project.importFile(io); }
                if (!item) { return MK.fail("Import returned nothing for " + file.name + "."); }

                stage = "adding the layer";
                var layer = comp.layers.add(item);
                if (!layer) { return MK.fail("The footage imported but no layer was created."); }

                stage = "placing the layer";
                try { layer.moveToBeginning(); } catch (eMove) { notes.push("could not move to the top"); }

                // Starts where the playhead is, not at zero — the body is
                // dropped in at the point being worked on.
                try {
                    layer.startTime = comp.time;
                } catch (eTime) { notes.push("could not move to the playhead"); }

                stage = "tagging";
                // Written directly rather than through RobertVitalik.applyTag:
                // that opens and closes its own undo group, and closing it from
                // inside the group MK already opened breaks the reply.
                try {
                    if (layer.name.indexOf("[body]") === -1) {
                        layer.name = layer.name + " [body]";
                    }
                } catch (eTag) { notes.push("could not tag"); }

                return remember(report("Added " + file.name + " to " + comp.name + ".", notes));

            } catch (e) {
                return remember(MK.fail("Failed while " + stage + ": " +
                                        (e && e.message ? e.message : String(e)) +
                                        (e && e.line ? " (line " + e.line + ")" : "")));
            }
        }
    };

    /* ------------------------------------------------------- pre-render */

    var PRE_PREFIX = "PRE-RENDER-";

    /** Folder next to the .aep, or the OS temp folder for an unsaved project. */
    function outDirOf() {
        var dir = null;
        try { if (app.project.file) { dir = app.project.file.parent; } } catch (e) {}
        if (!dir) { dir = Folder.temp; }
        return dir;
    }

    /**
     * Numbers already taken by PRE-RENDER files, from the project and from
     * the folder beside it.
     *
     * Both are checked because they disagree: a render can sit on disk with
     * nobody having imported it, and an item can point at a file that was
     * moved away. Taking the union means a number is never handed out twice.
     */
    function usedPreNumbers(outDir) {
        var used = {};
        var rx = new RegExp("^" + PRE_PREFIX + "(\\d+)\\b", "i");
        var i, m;

        for (i = 1; i <= app.project.numItems; i++) {
            try {
                m = rx.exec(String(app.project.item(i).name));
                if (m) { used[parseInt(m[1], 10)] = true; }
            } catch (eItem) {}
        }

        try {
            var files = outDir.getFiles(PRE_PREFIX + "*");
            for (i = 0; i < files.length; i++) {
                m = rx.exec(String(files[i].name));
                if (m) { used[parseInt(m[1], 10)] = true; }
            }
        } catch (eDir) {}

        return used;
    }

    /**
     * Smallest number nobody is using.
     *
     * Deliberately fills gaps rather than continuing past the highest: with
     * PRE-RENDER-1, -2 and -5 in the project, the next three renders become
     * 3, 4 and 6. Existing files are never renamed to close a gap — they are
     * already referenced by comps and by whoever is working on them.
     */
    function nextPreNumber(used) {
        for (var n = 1; n < 10000; n++) {
            if (!used[n]) { return n; }
        }
        return 1;
    }

    /** An H.264 output template, preferring the team's own. */
    function applyH264(om) {
        var preferred = ["LowCosRender-H264-10Mbps", "LowCosRender H264 10Mbps",
                         "LowCostRender H264 10Mbs", "RENAMER H264 10Mbps",
                         "Prepailer H264 10Mbps"];
        var list = [];
        var i, t;

        try {
            var templates = om.templates;
            for (i = 0; i < templates.length; i++) { list.push(String(templates[i])); }
        } catch (e) {}

        function norm(x) { return String(x).toLowerCase().replace(/[^a-z0-9]/g, ""); }

        for (i = 0; i < preferred.length; i++) {
            for (t = 0; t < list.length; t++) {
                if (norm(list[t]) === norm(preferred[i])) {
                    try { om.applyTemplate(list[t]); return list[t]; } catch (eA) {}
                }
            }
        }

        for (t = 0; t < list.length; t++) {
            if (/h\.?264/i.test(list[t])) {
                try { om.applyTemplate(list[t]); return list[t]; } catch (eB) {}
            }
        }

        try { return String(om.name); } catch (eC) { return null; }
    }

    function restoreQueue(saved, suppressing) {
        for (var i = 0; i < saved.length; i++) {
            try { saved[i].item.render = saved[i].flag; } catch (e) {}
        }
        if (suppressing) { try { app.endSuppressDialogs(false); } catch (e2) {} }
    }

    MK.tools["studio.preRender"] = {
        needs: { comp: true, layers: 1 },
        // No undo wrapper from MK: this opens its own group around the import
        // only, and rendering must not sit inside one.
        undo: false,

        /**
         * Bake the selected layers into one clip, the way HOOK RENDER does —
         * but named PRE-RENDER-N and with no length limit. A hook is a hook;
         * a pre-render is however long the selection is.
         */
        run: function () {
            var tempComp = null, rqItem = null, saved = [], suppressing = false;

            try {
                var comp = MK.sel.comp();
                var sel = comp.selectedLayers;
                if (!sel || !sel.length) { return MK.fail("Select the layers to pre-render."); }

                // A time-reversed layer reports inPoint > outPoint, so each
                // edge is normalised before it can shrink the span.
                var first = null, last = null, topIndex = null;
                var i, L;
                for (i = 0; i < sel.length; i++) {
                    L = sel[i];
                    var a = Math.min(L.inPoint, L.outPoint);
                    var b = Math.max(L.inPoint, L.outPoint);
                    if (first === null || a < first) { first = a; }
                    if (last === null || b > last) { last = b; }
                    if (topIndex === null || L.index < topIndex) { topIndex = L.index; }
                }

                var span = last - first;
                if (span <= 0) { return MK.fail("The selection has zero duration."); }

                var outDir = outDirOf();
                var number = nextPreNumber(usedPreNumbers(outDir));
                var outName = PRE_PREFIX + number + ".mp4";
                var outFile = new File(outDir.fsName + "/" + outName);

                tempComp = app.project.items.addComp(
                    "__PRERENDER_TMP_" + comp.id + "_" + number,
                    comp.width, comp.height, comp.pixelAspect, span, 24);

                // Bottom-up, so the stack survives the copy.
                var order = [];
                for (i = 0; i < sel.length; i++) { order.push(sel[i]); }
                order.sort(function (x, y) { return y.index - x.index; });

                for (i = 0; i < order.length; i++) {
                    var want = Math.min(order[i].inPoint, order[i].outPoint) - first;
                    order[i].copyToComp(tempComp);
                    var copied = tempComp.layer(1);
                    try {
                        copied.startTime = copied.startTime - first;
                        // startTime behaves differently under negative stretch,
                        // so measure where it landed instead of trusting it.
                        var got = Math.min(copied.inPoint, copied.outPoint);
                        if (Math.abs(got - want) > 0.001) {
                            copied.startTime = copied.startTime + (want - got);
                        }
                    } catch (eSh) {}
                }

                // Render only this item: park everyone else's flag, restore after.
                var rq = app.project.renderQueue;
                for (i = 1; i <= rq.numItems; i++) {
                    var rqi = rq.item(i), flag = false;
                    try { flag = rqi.render; } catch (eF) {}
                    saved.push({ item: rqi, flag: flag });
                    try { rqi.render = false; } catch (eF2) {}
                }
                try { app.beginSuppressDialogs(); suppressing = true; } catch (eS) {}

                rqItem = rq.items.add(tempComp);
                var om = rqItem.outputModule(1);
                var template = applyH264(om);
                om.file = outFile;
                var wrote = om.file.fsName;

                try { rqItem.render = true; } catch (eR) {}
                rq.render();

                var done = false;
                try { done = (rqItem.status === RQItemStatus.DONE); } catch (eD) {}
                try { rqItem.remove(); } catch (eRm) {}

                var got2 = new File(wrote);
                if (!got2.exists) {
                    // Some templates append their own extension.
                    var stem = outName.replace(/\.mp4$/i, "");
                    var found = outDir.getFiles(stem + ".*");
                    if (found && found.length) {
                        found.sort(function (x, y) { return y.modified - x.modified; });
                        got2 = found[0]; wrote = got2.fsName; done = true;
                    }
                }

                try { tempComp.remove(); } catch (eT) {} 
                tempComp = null;
                restoreQueue(saved, suppressing); saved = []; suppressing = false;

                if (!(done && got2.exists)) {
                    return MK.fail("Render did not finish. Template: " + (template || "none"));
                }

                app.beginUndoGroup("Insert pre-render");
                try {
                    var item = app.project.importFile(new ImportOptions(got2));
                    var anchor = null;
                    try { anchor = comp.layer(topIndex); } catch (eAn) {}

                    var layer = comp.layers.add(item);
                    if (anchor) { try { layer.moveBefore(anchor); } catch (eMv) {} }
                    try { layer.startTime = first; } catch (eSt) {}
                    try { layer.name = outName; } catch (eNm) {}

                    // Originals stay, silenced: eye off and speaker off. Both
                    // are needed — either one alone still leaks through.
                    for (i = 0; i < sel.length; i++) {
                        try { sel[i].enabled = false; } catch (eEn) {}
                        try { if (sel[i].hasAudio) { sel[i].audioEnabled = false; } } catch (eAu) {}
                    }
                } finally {
                    app.endUndoGroup();
                }

                return MK.ok(outName + " \u2014 " + (Math.round(span * 10) / 10) +
                             "s from " + sel.length + " layer" + (sel.length === 1 ? "" : "s") + ".");

            } catch (e) {
                try { if (rqItem) { rqItem.remove(); } } catch (e1) {}
                try { if (tempComp) { tempComp.remove(); } } catch (e2) {}
                restoreQueue(saved, suppressing);
                return MK.fail("Pre-render failed: " + (e && e.message ? e.message : String(e)));
            }
        }
    };
})();