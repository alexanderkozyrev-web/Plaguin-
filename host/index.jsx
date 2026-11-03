/* ------------------------------------------------------------------------ *
 * FitMe Studio 1.3.2 — host.
 *
 * GENERATED FILE. Do not edit.
 * Source: host/modules/*.jsx  ->  tools/gen-host.py
 *
 * The four modules below are byte-identical to their standalone builds except
 * for their #target directives, which are commented out here because only the
 * one at the top of this file is legal. Fix a module in its own repo, drop the
 * file into host/modules/, re-run the generator.
 *
 * Everything is concatenated into one file on purpose: AE evaluates a CEP
 * <ScriptPath> at global scope, which is the only way org.jsx's plain
 * `function organizeProject()` declarations become callable from the panel.
 * ------------------------------------------------------------------------ */

#target aftereffects

$.global.FitMeStudio = $.global.FitMeStudio || {};
$.global.FitMeStudio.VERSION = "1.3.2";
$.global.FitMeStudio.MODULES = ["subs.jsx", "motion-kit.jsx", "studio-inserts.jsx", "tags.jsx", "org.jsx"];

/**
 * Health check. Deliberately probes the symbols the panel actually calls
 * rather than trusting a "loaded" flag — the 1.0.1 bug was a module that
 * evaluated without error and still left nothing callable behind.
 */
$.global.FitMeStudio.probe = function (name) {
    try {
        if (name === "subs.jsx") {
            return typeof getSelectedAudioPath === "function";
        }
        if (name === "motion-kit.jsx") {
            return typeof MK === "object" && MK !== null && typeof MK.run === "function";
        }
        if (name === "tags.jsx") {
            return typeof $.global.RobertVitalik === "object" && $.global.RobertVitalik !== null;
        }
        if (name === "studio-inserts.jsx") {
            return typeof MK === "object" && MK !== null && MK.tools !== undefined &&
                   MK.tools["studio.disclaimer"] !== undefined &&
                   MK.tools["studio.cta"] !== undefined;
        }
        if (name === "org.jsx") {
            return typeof organizeProject === "function" &&
                   typeof organizeAndCleanV3 === "function" &&
                   typeof getProjectInfoToFile === "function";
        }
    } catch (e) {}
    return false;
};

/** Minimal string quoter — subs.jsx's JSON polyfill may not be up yet. */
$.global.FitMeStudio._q = function (value) {
    var text = String(value === null || value === undefined ? "" : value);
    var out = "";
    var i, ch, code, hex;

    for (i = 0; i < text.length; i++) {
        ch = text.charAt(i);
        code = text.charCodeAt(i);
        if (ch === '"' || ch === "\\") out += "\\" + ch;
        else if (ch === "\n") out += "\\n";
        else if (ch === "\r") out += "\\r";
        else if (ch === "\t") out += "\\t";
        else if (code < 32) {
            hex = code.toString(16);
            while (hex.length < 4) hex = "0" + hex;
            out += "\\u" + hex;
        } else out += ch;
    }
    return '"' + out + '"';
};

/** Panel-readable report. Returns a JSON string. */
$.global.FitMeStudio.status = function () {
    var S = $.global.FitMeStudio;
    var q = S._q;
    var mods = [];
    var ready = true;
    var i, name, ok;

    for (i = 0; i < S.MODULES.length; i++) {
        name = S.MODULES[i];
        ok = S.probe(name);
        mods.push(q(name) + ":" + (ok ? "true" : "false"));
        if (!ok) ready = false;
    }

    return '{"version":' + q(S.VERSION) +
           ',"ready":' + (ready ? "true" : "false") +
           ',"modules":{' + mods.join(",") + "}}";
};



/* ======================================================================== *
 * module: subs.jsx
 * ======================================================================== */

// host/index.jsx - ExtendScript for OpenAI Whisper

// [FitMe Studio] #target aftereffects  (directive hoisted to the top of the bundle)

// JSON polyfill — ExtendScript does not natively support JSON.
// Required for reliable operation regardless of which Adobe panels are open.
if (typeof JSON === 'undefined') { JSON = {}; }
if (typeof JSON.stringify !== 'function') {
    JSON.stringify = function(obj) {
        var t = typeof obj;
        if (t === 'undefined') return undefined;
        if (t === 'number' || t === 'boolean') return String(obj);
        if (t === 'string') return '"' + obj.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/\t/g,'\\t') + '"';
        if (obj === null) return 'null';
        if (obj instanceof Array) {
            var arr = [];
            for (var i = 0; i < obj.length; i++) arr.push(JSON.stringify(obj[i]));
            return '[' + arr.join(',') + ']';
        }
        var pairs = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                var val = JSON.stringify(obj[k]);
                if (typeof val !== 'undefined') pairs.push('"' + k + '":' + val);
            }
        }
        return '{' + pairs.join(',') + '}';
    };
}
if (typeof JSON.parse !== 'function') {
    JSON.parse = function(str) { return eval('(' + str + ')'); };
}

function getSelectedAudioPath() {
    try {
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem)) {
            return JSON.stringify({success: false, error: "No composition"});
        }
        
        var selectedLayers = comp.selectedLayers;
        if (!selectedLayers || selectedLayers.length === 0) {
            return JSON.stringify({success: false, error: "No layer"});
        }
        
        var layer = selectedLayers[0];
        
        if (!(layer instanceof AVLayer) || !layer.source || !layer.source.file) {
            return JSON.stringify({success: false, error: "No audio file"});
        }
        
        if (!layer.source.file.exists) {
            return JSON.stringify({success: false, error: "File not found"});
        }
        
        return JSON.stringify({
            success: true,
            audioPath: layer.source.file.fsName,
            layerName: layer.name
        });
        
    } catch(e) {
        return JSON.stringify({success: false, error: e.toString()});
    }
}


/* ======================================================================== *
 * module: motion-kit.jsx
 * ======================================================================== */

/* Motion Kit 1.2.1 — generated, do not edit. Source: host/*.jsx */

/* ===== 00-prelude.jsx ===== */
/**
 * Motion Kit — host prelude.
 * Namespace, small helpers, minimal JSON (ExtendScript has no global JSON).
 *
 * Rules for every file in host/:
 *   - matchName only, never an English display name (breaks on localized AE)
 *   - effects referenced by index, never by name
 *   - no state kept between calls; the panel owns all state
 */

MK = (typeof MK === "object" && MK) || {};

MK.VERSION = "1.2.1";

/** Tool table. Filled by the 2x-tools-*.jsx files, read by the dispatcher. */
MK.tools = {};

/* ---------- results ---------- */

MK.ok = function (message, data) {
    return { ok: true, message: message || "", data: data === undefined ? null : data };
};

MK.fail = function (message, data) {
    return { ok: false, message: message || "Failed", data: data === undefined ? null : data };
};

/* ---------- tiny utils ---------- */

MK.util = {
    isArray: function (v) {
        return Object.prototype.toString.call(v) === "[object Array]";
    },

    has: function (obj, key) {
        return obj !== null && obj !== undefined && obj[key] !== undefined;
    },

    /** Round to the nearest frame of a comp. Times in AE are floats in seconds. */
    snapToFrame: function (t, frameDuration) {
        return Math.round(t / frameDuration) * frameDuration;
    },

    /** Human-readable plural: n, "layer" -> "1 layer" / "3 layers" */
    plural: function (n, word) {
        return n + " " + word + (n === 1 ? "" : "s");
    }
};

/* ---------- JSON ---------- */

MK.json = (function () {
    var ESC = {
        "\b": "\\b",
        "\t": "\\t",
        "\n": "\\n",
        "\f": "\\f",
        "\r": "\\r",
        '"': '\\"',
        "\\": "\\\\"
    };

    function quote(s) {
        var out = '"';
        for (var i = 0; i < s.length; i++) {
            var c = s.charAt(i);
            var code = s.charCodeAt(i);
            if (ESC[c]) {
                out += ESC[c];
            } else if (code < 32 || code > 126) {
                var hex = code.toString(16);
                while (hex.length < 4) { hex = "0" + hex; }
                out += "\\u" + hex;
            } else {
                out += c;
            }
        }
        return out + '"';
    }

    function str(v) {
        if (v === null || v === undefined) { return "null"; }

        var t = typeof v;
        if (t === "string") { return quote(v); }
        if (t === "boolean") { return v ? "true" : "false"; }
        if (t === "number") { return isFinite(v) ? String(v) : "null"; }

        if (MK.util.isArray(v)) {
            var items = [];
            for (var i = 0; i < v.length; i++) { items.push(str(v[i])); }
            return "[" + items.join(",") + "]";
        }

        if (t === "object") {
            var pairs = [];
            for (var k in v) {
                if (!v.hasOwnProperty(k)) { continue; }
                if (typeof v[k] === "function") { continue; }
                pairs.push(quote(k) + ":" + str(v[k]));
            }
            return "{" + pairs.join(",") + "}";
        }

        return "null";
    }

    return {
        stringify: str,

        /**
         * Args always originate from our own panel, so eval is acceptable here.
         * Anything unparseable becomes an empty object rather than throwing.
         */
        parse: function (s) {
            if (!s) { return {}; }
            try {
                return eval("(" + s + ")");
            } catch (e) {
                return {};
            }
        }
    };
})();

/* ===== 10-lib-selection.jsx ===== */
/**
 * Motion Kit — selection helpers.
 *
 * One place decides whether a tool may run at all. Tools declare what they
 * need; the dispatcher calls MK.sel.check() before touching the project, so
 * no tool has to repeat "is there a comp / is anything selected" logic.
 */

MK.sel = (function () {

    function comp() {
        if (!app.project) { return null; }
        var item = app.project.activeItem;
        return (item && item instanceof CompItem) ? item : null;
    }

    function layers(c) {
        c = c || comp();
        return c ? c.selectedLayers : [];
    }

    function props(c) {
        c = c || comp();
        return c ? c.selectedProperties : [];
    }

    /** Selected properties that are Property (not groups) and can hold keys. */
    function animatableProps(c) {
        var all = props(c);
        var out = [];
        for (var i = 0; i < all.length; i++) {
            var p = all[i];
            if (p.propertyType === PropertyType.PROPERTY && p.canVaryOverTime) {
                out.push(p);
            }
        }
        return out;
    }

    /** Properties that actually have selected keyframes. */
    function propsWithSelectedKeys(c) {
        var list = animatableProps(c);
        var out = [];
        for (var i = 0; i < list.length; i++) {
            if (list[i].selectedKeys && list[i].selectedKeys.length > 0) {
                out.push(list[i]);
            }
        }
        return out;
    }

    function countSelectedKeys(c) {
        var list = propsWithSelectedKeys(c);
        var n = 0;
        for (var i = 0; i < list.length; i++) { n += list[i].selectedKeys.length; }
        return n;
    }

    function textLayers(c) {
        var ls = layers(c);
        var out = [];
        for (var i = 0; i < ls.length; i++) {
            if (ls[i] instanceof TextLayer) { out.push(ls[i]); }
        }
        return out;
    }

    function shapeLayers(c) {
        var ls = layers(c);
        var out = [];
        for (var i = 0; i < ls.length; i++) {
            if (ls[i] instanceof ShapeLayer) { out.push(ls[i]); }
        }
        return out;
    }

    /**
     * needs: {
     *   comp: true,
     *   layers: <minimum count>,
     *   textLayers: <minimum count>,
     *   shapeLayers: <minimum count>,
     *   props: <minimum count>,
     *   keys: <minimum count>
     * }
     * Returns MK.ok() when the tool may run, MK.fail(reason) otherwise.
     * Messages say what to do next, not what went wrong.
     */
    function check(needs) {
        needs = needs || {};

        var c = comp();
        if (needs.comp && !c) {
            return MK.fail("Open a composition to use this tool.");
        }

        if (needs.layers) {
            var nl = layers(c).length;
            if (nl < needs.layers) {
                return MK.fail(needs.layers === 1
                    ? "Select a layer."
                    : "Select at least " + MK.util.plural(needs.layers, "layer") + ".");
            }
        }

        if (needs.textLayers) {
            var nt = textLayers(c).length;
            if (nt < needs.textLayers) {
                return MK.fail("Select a text layer.");
            }
        }

        if (needs.shapeLayers) {
            var ns = shapeLayers(c).length;
            if (ns < needs.shapeLayers) {
                return MK.fail(needs.shapeLayers === 1
                    ? "Select a shape layer."
                    : "Select at least " + MK.util.plural(needs.shapeLayers, "shape layer") + ".");
            }
        }

        if (needs.props) {
            var np = animatableProps(c).length;
            if (np < needs.props) {
                return MK.fail("Select a property in the timeline.");
            }
        }

        if (needs.keys) {
            var nk = countSelectedKeys(c);
            if (nk < needs.keys) {
                return MK.fail(needs.keys === 1
                    ? "Select a keyframe."
                    : "Select at least " + MK.util.plural(needs.keys, "keyframe") + ".");
            }
        }

        return MK.ok();
    }

    return {
        comp: comp,
        layers: layers,
        props: props,
        animatableProps: animatableProps,
        propsWithSelectedKeys: propsWithSelectedKeys,
        countSelectedKeys: countSelectedKeys,
        textLayers: textLayers,
        shapeLayers: shapeLayers,
        check: check
    };
})();

/* ===== 11-lib-geo.jsx ===== */
/**
 * Motion Kit — geometry.
 *
 * Everything here works in *layer space*: the same space sourceRectAtTime
 * reports in, which is also the space the anchor point lives in. Nothing is
 * converted to comp space, because ExtendScript has no toComp() and the
 * anchor never needs it.
 */

MK.geo = (function () {

    var EPS = 0.0001;

    /* ---------- rects ---------- */

    function rect(left, top, width, height) {
        return { left: left, top: top, width: width, height: height };
    }

    function fromPoints(pts) {
        if (!pts.length) { return null; }
        var minX = pts[0][0], maxX = pts[0][0];
        var minY = pts[0][1], maxY = pts[0][1];
        for (var i = 1; i < pts.length; i++) {
            if (pts[i][0] < minX) { minX = pts[i][0]; }
            if (pts[i][0] > maxX) { maxX = pts[i][0]; }
            if (pts[i][1] < minY) { minY = pts[i][1]; }
            if (pts[i][1] > maxY) { maxY = pts[i][1]; }
        }
        return rect(minX, minY, maxX - minX, maxY - minY);
    }

    function intersect(a, b) {
        var left = Math.max(a.left, b.left);
        var top = Math.max(a.top, b.top);
        var right = Math.min(a.left + a.width, b.left + b.width);
        var bottom = Math.min(a.top + a.height, b.top + b.height);
        if (right <= left || bottom <= top) { return null; }
        return rect(left, top, right - left, bottom - top);
    }

    /* ---------- masks ---------- */

    /** Cubic bezier point at t. */
    function bezier(p0, p1, p2, p3, t) {
        var u = 1 - t;
        var a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        return [
            a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
            a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]
        ];
    }

    /**
     * Bounds of the layer's masks at a time, in layer space.
     * Curves are sampled rather than solved: 12 samples per segment is well
     * inside a pixel for any mask a person drew by hand, and it avoids a
     * cubic solver for a bounding box.
     * Subtract and None masks are ignored — they do not define visible area.
     */
    function maskBounds(layer, time) {
        var parade = layer.property("ADBE Mask Parade");
        if (!parade || parade.numProperties === 0) { return null; }

        var pts = [];

        for (var m = 1; m <= parade.numProperties; m++) {
            var mask = parade.property(m);
            var mode;
            try { mode = mask.maskMode; } catch (e) { continue; }
            if (mode === MaskMode.NONE || mode === MaskMode.SUBTRACT) { continue; }

            var shape;
            try { shape = mask.property("ADBE Mask Shape").valueAtTime(time, false); } catch (e2) { continue; }
            if (!shape || !shape.vertices || !shape.vertices.length) { continue; }

            var v = shape.vertices, inT = shape.inTangents, outT = shape.outTangents;
            var n = v.length;
            var last = shape.closed ? n : n - 1;

            for (var i = 0; i < last; i++) {
                var j = (i + 1) % n;
                var p0 = v[i];
                var p1 = [v[i][0] + outT[i][0], v[i][1] + outT[i][1]];
                var p2 = [v[j][0] + inT[j][0], v[j][1] + inT[j][1]];
                var p3 = v[j];
                for (var s = 0; s <= 12; s++) {
                    pts.push(bezier(p0, p1, p2, p3, s / 12));
                }
            }
            if (last === 0) { pts.push(v[0]); }
        }

        return pts.length ? fromPoints(pts) : null;
    }

    /**
     * Visible bounds of a layer in layer space.
     * withMasks: intersect the layer's own bounds with its mask bounds, which
     * is what the eye sees. Falls back to the raw bounds if the masks sit
     * entirely outside the content.
     */
    function layerBounds(layer, time, withMasks, withExtents) {
        var r = null;

        // Tight geometric bounds by default. includeExtents adds stroke and
        // shadow on every side, which inflates the box symmetrically: the
        // centre stays put but every corner and edge moves out by half the
        // stroke, which is exactly the error you would see on a stroked
        // title. The other form is tried only as a fallback, and the layer's
        // own size last, because some layers refuse both.
        var forms = withExtents ? [true, false] : [false, true];

        // Two clocks are tried: comp time, then the layer's own time. A layer
        // with a non-zero start time or time remapping measures empty on the
        // first and correctly on the second.
        var shifted = time - (layer.startTime || 0);
        var clocks = (Math.abs(shifted - time) > EPS) ? [time, shifted] : [time];

        for (var cI = 0; cI < clocks.length && !r; cI++) {
            for (var a = 0; a < forms.length && !r; a++) {
                try {
                    var sr = layer.sourceRectAtTime(clocks[cI], forms[a]);
                    if (sr && sr.width > EPS && sr.height > EPS) {
                        r = rect(sr.left, sr.top, sr.width, sr.height);
                        r.measured = forms[a] ? "with stroke" : "tight";
                    }
                } catch (e) { /* try the next form */ }
            }
        }

        if (!r && layer.width > 0 && layer.height > 0) {
            r = rect(0, 0, layer.width, layer.height);
            r.measured = "layer size";
        }

        if (!r) { return null; }

        if (withMasks) {
            var mb = maskBounds(layer, time);
            if (mb) {
                var hit = intersect(r, mb);
                if (hit) {
                    hit.measured = r.measured + " + masks";
                    r = hit;
                }
            }
        }

        return r;
    }

    /**
     * Point inside a rect from two multipliers, 0 = left/top, 1 = right/bottom.
     *
     * Deliberately branch-free. The previous form picked the edge with a chain
     * of string comparisons on a preset id; when the first branch did not
     * match, the value fell through to the centre silently, which is what
     * broke the top row and left column. Arithmetic cannot fall through.
     */
    function pointAt(r, fx, fy) {
        var x = Math.max(0, Math.min(1, fx));
        var y = Math.max(0, Math.min(1, fy));
        return [r.left + r.width * x, r.top + r.height * y];
    }

    /* ---------- transform compensation ---------- */

    /**
     * Moving the anchor moves the layer, because everything is drawn relative
     * to it. Position has to absorb the difference:
     *
     *   P = position + R*S*(p - anchor)     for any point p in layer space
     *   => position' = position + R*S*(anchor' - anchor)
     *
     * Position lives in the parent's space and R, S are the layer's own, so
     * parenting needs no special handling: both sides move together.
     *
     * Scale and rotation can themselves be animated, so the offset is taken
     * at a given time — that is what lets a keyframed Position be corrected
     * key by key instead of being refused.
     */
    function anchorOffsetAt(layer, delta, time) {
        var tg = layer.property("ADBE Transform Group");
        var scale = tg.property("ADBE Scale").valueAtTime(time, false);
        var rot = tg.property("ADBE Rotate Z").valueAtTime(time, false);

        var sx = scale[0] / 100;
        var sy = scale[1] / 100;
        var sz = (scale.length > 2 ? scale[2] : 100) / 100;

        var x = delta[0] * sx;
        var y = delta[1] * sy;

        var r = rot * Math.PI / 180;
        var cos = Math.cos(r), sin = Math.sin(r);

        return [x * cos - y * sin, x * sin + y * cos, (delta[2] || 0) * sz];
    }

    /** anchor' - anchor, always three components so callers need no branches. */
    function anchorDelta(oldAnchor, newAnchor) {
        return [
            newAnchor[0] - oldAnchor[0],
            newAnchor[1] - oldAnchor[1],
            (newAnchor.length > 2 ? newAnchor[2] : 0) - (oldAnchor.length > 2 ? oldAnchor[2] : 0)
        ];
    }

    /**
     * 3D rotation on X or Y, or a non-zero orientation, would need the full
     * rotation matrix and AE's composition order. Rather than move a layer to
     * the wrong place, those layers are refused.
     */
    function hasUnsupportedRotation(layer) {
        if (!layer.threeDLayer) { return false; }

        var tg = layer.property("ADBE Transform Group");

        function val(matchName) {
            var p = tg.property(matchName);
            return p ? p.value : 0;
        }

        var o = val("ADBE Orientation") || [0, 0, 0];
        return Math.abs(val("ADBE Rotate X")) > EPS ||
               Math.abs(val("ADBE Rotate Y")) > EPS ||
               Math.abs(o[0]) > EPS || Math.abs(o[1]) > EPS || Math.abs(o[2]) > EPS;
    }

    return {
        rect: rect,
        fromPoints: fromPoints,
        intersect: intersect,
        maskBounds: maskBounds,
        layerBounds: layerBounds,
        pointAt: pointAt,
        anchorOffsetAt: anchorOffsetAt,
        anchorDelta: anchorDelta,
        hasUnsupportedRotation: hasUnsupportedRotation
    };
})();

/* ===== 12-lib-keys.jsx ===== */
/**
 * Motion Kit — keyframes.
 *
 * A keyframe in AE cannot be edited in place: there is no "move this key" and
 * no "copy this key". Everything here is read-all / write-all, which is why
 * the read and write sides live together and stay symmetrical.
 */

MK.keys = (function () {

    var EPS = 1e-6;

    /**
     * How many KeyframeEase objects a property wants.
     * Spatial properties (Position and friends) take exactly one regardless of
     * dimension, because their temporal ease applies to speed along the path.
     */
    function easeCount(prop) {
        if (prop.isSpatial) { return 1; }

        switch (prop.propertyValueType) {
        case PropertyValueType.ThreeD:
        case PropertyValueType.ThreeD_SPATIAL:
            return 3;
        case PropertyValueType.TwoD:
        case PropertyValueType.TwoD_SPATIAL:
            return 2;
        case PropertyValueType.COLOR:
            return 4;
        default:
            return 1;
        }
    }

    /** Stretch or trim an ease array to the length a property expects. */
    function fitEase(list, n) {
        var out = [];
        for (var i = 0; i < n; i++) {
            var src = list[i] || list[list.length - 1] || { speed: 0, influence: 16.67 };
            out.push(new KeyframeEase(src.speed, Math.max(0.1, Math.min(100, src.influence))));
        }
        return out;
    }

    function plainEase(list) {
        var out = [];
        for (var i = 0; i < list.length; i++) {
            out.push({ speed: list[i].speed, influence: list[i].influence });
        }
        return out;
    }

    function isHold(type) {
        return type === KeyframeInterpolationType.HOLD;
    }

    /* ---------- reading ---------- */

    /** Interpolation only — no time, no value. This is what Copy ease stores. */
    function readEase(prop, index) {
        var data = {
            inType: prop.keyInInterpolationType(index),
            outType: prop.keyOutInterpolationType(index),
            inEase: [],
            outEase: [],
            continuous: false,
            autoBezier: false
        };

        try { data.inEase = plainEase(prop.keyInTemporalEase(index)); } catch (e) { /* hold keys */ }
        try { data.outEase = plainEase(prop.keyOutTemporalEase(index)); } catch (e2) { /* hold keys */ }
        try { data.continuous = prop.keyTemporalContinuous(index); } catch (e3) { /* n/a */ }
        try { data.autoBezier = prop.keyTemporalAutoBezier(index); } catch (e4) { /* n/a */ }

        return data;
    }

    /** Everything needed to recreate a key elsewhere. */
    function readKey(prop, index) {
        var data = readEase(prop, index);

        data.time = prop.keyTime(index);
        data.value = prop.keyValue(index);
        data.roving = false;
        data.spatial = null;

        try { data.roving = prop.keyRoving(index); } catch (e) { /* n/a */ }

        if (prop.isSpatial) {
            try {
                data.spatial = {
                    inTangent: prop.keyInSpatialTangent(index),
                    outTangent: prop.keyOutSpatialTangent(index),
                    continuous: prop.keySpatialContinuous(index),
                    autoBezier: prop.keySpatialAutoBezier(index)
                };
            } catch (e2) { /* n/a */ }
        }

        return data;
    }

    /* ---------- writing ---------- */

    /**
     * Apply stored interpolation to an existing key.
     * Order matters: continuous and auto-bezier derive the ease, so they are
     * written last, exactly as the donor had them.
     */
    function applyEase(prop, index, data) {
        var n = easeCount(prop);

        try {
            prop.setInterpolationTypeAtKey(index, data.inType, data.outType);
        } catch (e) {
            return "interpolation type rejected";
        }

        if (!isHold(data.inType) || !isHold(data.outType)) {
            try {
                prop.setTemporalContinuousAtKey(index, false);
                prop.setTemporalAutoBezierAtKey(index, false);
                prop.setTemporalEaseAtKey(index,
                    fitEase(data.inEase, n),
                    fitEase(data.outEase, n));
            } catch (e2) {
                return "ease rejected";
            }
        }

        try {
            if (data.autoBezier) { prop.setTemporalAutoBezierAtKey(index, true); }
            if (data.continuous) { prop.setTemporalContinuousAtKey(index, true); }
        } catch (e3) { /* not fatal */ }

        return null;
    }

    /** Create a key from readKey() data at a given time. Returns its index. */
    function writeKey(prop, time, data) {
        prop.setValueAtTime(time, data.value);
        var index = prop.nearestKeyIndex(time);

        applyEase(prop, index, data);

        if (prop.isSpatial && data.spatial) {
            try {
                prop.setSpatialTangentsAtKey(index, data.spatial.inTangent, data.spatial.outTangent);
                prop.setSpatialAutoBezierAtKey(index, data.spatial.autoBezier);
                prop.setSpatialContinuousAtKey(index, data.spatial.continuous);
            } catch (e) { /* not fatal */ }
        }

        return index;
    }


    /* ---------- speed, in units the next property can understand ---------- */

    /**
     * A keyframe's ease is a pair: influence, which is a percentage and
     * travels anywhere, and speed, which is in the property's own units per
     * second. Copying speed literally from Position (pixels/sec) onto Scale
     * (percent/sec) is what produces those spikes in the graph editor.
     *
     * So speed is stored as a ratio against the segment's natural rate — the
     * value change divided by its duration — and rebuilt from the target's
     * own rate on the way out. A ratio of 1 means "as fast as a straight
     * line here", which means the same thing on every property.
     */
    function segment(prop, index, direction) {
        var other = index + direction;
        if (other < 1 || other > prop.numKeys) { return null; }

        var duration = Math.abs(prop.keyTime(other) - prop.keyTime(index));
        if (duration < EPS) { return null; }

        return { from: prop.keyValue(index), to: prop.keyValue(other), duration: duration };
    }

    /** Natural rate of one ease component: units per second along that axis. */
    function naturalRate(prop, seg, component) {
        if (!seg) { return 0; }

        var a = seg.from, b = seg.to;
        var change;

        if (a instanceof Array) {
            if (prop.isSpatial) {
                var sum = 0;
                for (var i = 0; i < a.length; i++) { sum += (b[i] - a[i]) * (b[i] - a[i]); }
                change = Math.sqrt(sum);
            } else {
                change = Math.abs(b[component] - a[component]);
            }
        } else {
            change = Math.abs(b - a);
        }

        return change / seg.duration;
    }

    function convertEase(prop, index, list, direction, toRatio) {
        var seg = segment(prop, index, direction);
        var out = [];

        for (var i = 0; i < list.length; i++) {
            var rate = naturalRate(prop, seg, i);
            var speed = list[i].speed;

            if (rate > EPS) {
                speed = toRatio ? (speed / rate) : (speed * rate);
            } else {
                speed = 0;
            }

            out.push({ speed: speed, influence: list[i].influence });
        }

        return out;
    }

    /** Interpolation in portable form: influence as-is, speed as a ratio. */
    function readEasePortable(prop, index) {
        var data = readEase(prop, index);
        data.inEase = convertEase(prop, index, data.inEase, -1, true);
        data.outEase = convertEase(prop, index, data.outEase, 1, true);
        data.portable = true;
        return data;
    }

    /** Apply portable interpolation, restoring speed in the target's units. */
    function applyEasePortable(prop, index, data) {
        var local = {
            inType: data.inType,
            outType: data.outType,
            continuous: data.continuous,
            autoBezier: data.autoBezier,
            inEase: convertEase(prop, index, data.inEase || [], -1, false),
            outEase: convertEase(prop, index, data.outEase || [], 1, false)
        };
        return applyEase(prop, index, local);
    }

    /** Swap in and out, for reversed clones. Easing must mirror with the motion. */
    function mirror(data) {
        var out = {
            time: data.time,
            value: data.value,
            roving: data.roving,
            inType: data.outType,
            outType: data.inType,
            inEase: data.outEase,
            outEase: data.inEase,
            continuous: data.continuous,
            autoBezier: data.autoBezier,
            spatial: null
        };

        if (data.spatial) {
            out.spatial = {
                inTangent: data.spatial.outTangent,
                outTangent: data.spatial.inTangent,
                continuous: data.spatial.continuous,
                autoBezier: data.spatial.autoBezier
            };
        }

        return out;
    }

    /** Does this property already have a key at this time? */
    function keyAt(prop, time) {
        if (prop.numKeys === 0) { return 0; }
        var i = prop.nearestKeyIndex(time);
        return Math.abs(prop.keyTime(i) - time) < EPS ? i : 0;
    }

    return {
        easeCount: easeCount,
        readEase: readEase,
        readEasePortable: readEasePortable,
        applyEasePortable: applyEasePortable,
        readKey: readKey,
        applyEase: applyEase,
        writeKey: writeKey,
        mirror: mirror,
        keyAt: keyAt,
        EPS: EPS
    };
})();

/* ===== 13-lib-shapes.jsx ===== */
/**
 * Motion Kit — shape layer helpers.
 *
 * Two constraints shape everything here:
 *   - a shape property cannot be moved between layers or between groups by
 *     script; only added, duplicated within its own parent, or removed
 *   - menu command ids are looked up by display name, which is the one place
 *     a localized After Effects can bite us, so lookups are guarded
 */

MK.shapes = (function () {

    var ROOT = "ADBE Root Vectors Group";
    var GROUP = "ADBE Vector Group";
    var GROUP_CONTENTS = "ADBE Vectors Group";
    var XFORM = "ADBE Vector Transform Group";
    var RECT = "ADBE Vector Shape - Rect";
    var RECT_SIZE = "ADBE Vector Rect Size";

    function root(layer) {
        return layer.property(ROOT);
    }

    /** Top-level groups of a shape layer, outermost first. */
    function topGroups(layer) {
        var r = root(layer);
        var out = [];
        if (!r) { return out; }
        for (var i = 1; i <= r.numProperties; i++) {
            var p = r.property(i);
            if (p.matchName === GROUP) { out.push(p); }
        }
        return out;
    }

    /** Walk every group under a container, deepest last. */
    function eachGroup(container, fn) {
        for (var i = 1; i <= container.numProperties; i++) {
            var p = container.property(i);
            if (p.matchName !== GROUP) { continue; }
            fn(p);
            var inner = p.property(GROUP_CONTENTS);
            if (inner) { eachGroup(inner, fn); }
        }
    }

    /** A group holding nothing that draws, at any depth. */
    function isEmptyGroup(group) {
        var contents = group.property(GROUP_CONTENTS);
        if (!contents || contents.numProperties === 0) { return true; }

        for (var i = 1; i <= contents.numProperties; i++) {
            var p = contents.property(i);
            if (p.matchName === GROUP) {
                if (!isEmptyGroup(p)) { return false; }
            } else {
                return false;   // a path, fill, stroke or effect
            }
        }
        return true;
    }

    /**
     * The rectangle Illustrator leaves behind for the artboard: a rect path
     * the size of the layer, within a pixel.
     */
    function isArtboardRect(group, layerW, layerH) {
        var contents = group.property(GROUP_CONTENTS);
        if (!contents) { return false; }

        for (var i = 1; i <= contents.numProperties; i++) {
            var p = contents.property(i);
            if (p.matchName !== RECT) { continue; }
            var size;
            try { size = p.property(RECT_SIZE).value; } catch (e) { continue; }
            if (Math.abs(size[0] - layerW) <= 1 && Math.abs(size[1] - layerH) <= 1) {
                return true;
            }
        }
        return false;
    }

    /** Is this layer a vector footage layer (Illustrator, EPS, SVG, PDF)? */
    function isVectorLayer(layer) {
        if (!(layer instanceof AVLayer)) { return false; }
        var src = layer.source;
        if (!src || !(src instanceof FootageItem) || !src.mainSource) { return false; }

        var file = null;
        try { file = src.mainSource.file; } catch (e) { return false; }
        if (!file) { return false; }

        return /\.(ai|eps|svg|pdf)$/i.test(file.name);
    }

    /**
     * Menu command lookup. The English name is tried first, then the few
     * localizations we are likely to meet. Returns 0 when nothing matched, so
     * callers can report a clear failure instead of firing a random command.
     */
    function commandId(names) {
        for (var i = 0; i < names.length; i++) {
            var id = 0;
            try { id = app.findMenuCommandId(names[i]); } catch (e) { id = 0; }
            if (id) { return id; }
        }
        return 0;
    }

    var CMD = {
        createShapes: ["Create Shapes from Vector Layer",
                       "Formen aus Vektorebene erstellen",
                       "Créer des formes à partir d'un calque vectoriel",
                       "Crear formas a partir de capa vectorial"],
        copy: ["Copy", "Kopieren", "Copier", "Copiar"],
        paste: ["Paste", "Einfügen", "Coller", "Pegar"]
    };

    function deselectAll(comp) {
        var layers = comp.layers;
        for (var i = 1; i <= layers.length; i++) {
            layers[i].selected = false;
        }
    }

    return {
        ROOT: ROOT,
        GROUP: GROUP,
        GROUP_CONTENTS: GROUP_CONTENTS,
        XFORM: XFORM,
        root: root,
        topGroups: topGroups,
        eachGroup: eachGroup,
        isEmptyGroup: isEmptyGroup,
        isArtboardRect: isArtboardRect,
        isVectorLayer: isVectorLayer,
        commandId: commandId,
        CMD: CMD,
        deselectAll: deselectAll
    };
})();

/* ===== 19-tools-system.jsx ===== */
/**
 * Motion Kit — diagnostics.
 * Runs when the panel loads, so a broken install shows up before the first
 * real click rather than after it.
 */

MK.tools["sys.ping"] = {
    needs: {},
    undo: false,

    run: function () {
        var comp = MK.sel.comp();

        var data = {
            host: app.version,
            kit: MK.VERSION,
            comp: comp ? comp.name : null,
            layers: MK.sel.layers(comp).length,
            props: MK.sel.animatableProps(comp).length,
            keys: MK.sel.countSelectedKeys(comp)
        };

        var msg = comp
            ? comp.name + " — " + MK.util.plural(data.layers, "layer") + ", " +
              MK.util.plural(data.keys, "key") + " selected."
            : "Connected to After Effects " + app.version + ". No composition open.";

        return MK.ok(msg, data);
    }
};

/* ===== 20-tools-anchor.jsx ===== */
/**
 * Motion Kit — anchor point.
 *
 * Moves the anchor to one of nine points on the layer's visible bounds and
 * absorbs the move in Position, so nothing shifts on screen.
 *
 * Animated Position is corrected key by key. The offset is recomputed at each
 * key's own time, so a layer whose scale or rotation is animated too still
 * lands correctly at every key.
 *
 * Refused rather than done wrong: 3D layers rotated on X or Y, or carrying an
 * orientation. That needs the full rotation matrix in AE's composition order,
 * and guessing it puts the layer somewhere wrong.
 */

MK.tools["anchor.move"] = {
    needs: { comp: true, layers: 1 },
    undo: true,
    undoName: "Move anchor point",

    run: function (args) {
        var comp = MK.sel.comp();
        var layers = MK.sel.layers(comp);

        // Masks are off by default now: anchoring to the layer's own bounds is
        // what every other tool does and what people expect. Alt opts in.
        var withMasks = !!(args.mod && args.mod.alt);
        var withExtents = !!(args.mod && args.mod.shift);

        var PRESETS = {
            tl: [0, 0],   tc: [0.5, 0],   tr: [1, 0],
            ml: [0, 0.5], mc: [0.5, 0.5], mr: [1, 0.5],
            bl: [0, 1],   bc: [0.5, 1],   br: [1, 1]
        };

        /**
         * The panel sends fx/fy as numbers. A preset id is accepted only as a
         * fallback for an older panel against a newer host. Note the explicit
         * typeof: fx can legitimately be 0, which is falsy.
         */
        var f;
        if (typeof args.fx === "number" && typeof args.fy === "number") {
            f = [args.fx, args.fy];
        } else {
            f = PRESETS[String(args.preset)] || [0.5, 0.5];
        }
        var fx = f[0];
        var fy = f[1];

        function nameOf(x, y) {
            var v = (y === 0) ? "top" : (y === 1) ? "bottom" : "middle";
            var h = (x === 0) ? "left" : (x === 1) ? "right" : "centre";
            return (v === "middle" && h === "centre") ? "centre" : v + " " + h;
        }

        var moved = 0;
        var keysFixed = 0;
        var skipped = [];
        var report = null;

        /** Shift one property by the anchor offset, keyframes and all. */
        function shift(layer, prop, delta, axis) {
            if (!prop) { return 0; }

            function apply(value, time) {
                var offset = MK.geo.anchorOffsetAt(layer, delta, time);
                if (axis !== undefined) {
                    return value + offset[axis];
                }
                var out = [value[0] + offset[0], value[1] + offset[1]];
                if (value.length > 2) { out.push(value[2] + offset[2]); }
                return out;
            }

            if (prop.numKeys === 0) {
                prop.setValue(apply(prop.value, comp.time));
                return 0;
            }

            for (var k = 1; k <= prop.numKeys; k++) {
                var t = prop.keyTime(k);
                prop.setValueAtKey(k, apply(prop.keyValue(k), t));
            }
            return prop.numKeys;
        }

        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];

            if (layer instanceof CameraLayer || layer instanceof LightLayer) {
                skipped.push(layer.name + ": not an artwork layer");
                continue;
            }

            var tg = layer.property("ADBE Transform Group");
            var anchor = tg.property("ADBE Anchor Point");
            var position = tg.property("ADBE Position");

            if (anchor.numKeys > 0) {
                skipped.push(layer.name + ": its anchor point is animated");
                continue;
            }

            if (MK.geo.hasUnsupportedRotation(layer)) {
                skipped.push(layer.name + ": 3D rotation is not supported yet");
                continue;
            }

            var bounds = MK.geo.layerBounds(layer, comp.time, withMasks, withExtents);
            if (!bounds) {
                skipped.push(layer.name + ": nothing visible at the playhead");
                continue;
            }

            var target = MK.geo.pointAt(bounds, fx, fy);
            var old = anchor.value;
            var next = (old.length > 2) ? [target[0], target[1], old[2]] : [target[0], target[1]];
            var delta = MK.geo.anchorDelta(old, next);

            if (position.dimensionsSeparated) {
                var sep = ["ADBE Position_0", "ADBE Position_1", "ADBE Position_2"];
                for (var d = 0; d < sep.length; d++) {
                    keysFixed += shift(layer, tg.property(sep[d]), delta, d);
                }
            } else {
                keysFixed += shift(layer, position, delta);
            }

            anchor.setValue(next);
            moved++;

            if (!report) {
                report = {
                    fx: fx,
                    fy: fy,
                    bounds: [Math.round(bounds.left), Math.round(bounds.top),
                             Math.round(bounds.width), Math.round(bounds.height)],
                    measured: bounds.measured,
                    from: [Math.round(old[0]), Math.round(old[1])],
                    to: [Math.round(next[0]), Math.round(next[1])]
                };
            }
        }

        if (!moved) {
            return MK.fail(skipped.length ? skipped[0] : "Nothing to move.");
        }

        // The message names the target and the numbers behind it, so a
        // wrong result says which half is wrong: the preset that arrived,
        // the bounds that were measured, or the anchor that was written.
        var msg = "Anchor \u2192 " + nameOf(report.fx, report.fy) +
            " [" + report.fx + "," + report.fy + "] on " +
            MK.util.plural(moved, "layer") + ". " +
            "Bounds " + report.bounds[2] + "\u00d7" + report.bounds[3] +
            " at " + report.bounds[0] + "," + report.bounds[1] +
            " (" + report.measured + "). " +
            "Anchor " + report.from[0] + "," + report.from[1] +
            " \u2192 " + report.to[0] + "," + report.to[1] + ".";

        if (keysFixed) {
            msg += " " + MK.util.plural(keysFixed, "position key") + " corrected.";
        }
        if (skipped.length) {
            msg += " Skipped " + skipped.length + ": " + skipped[0];
        }

        return MK.ok(msg, {
            moved: moved, keysFixed: keysFixed, skipped: skipped, report: report
        });
    }
};

/* ===== 21-tools-keys.jsx ===== */
/**
 * Motion Kit — keyframe tools.
 */

/* ---------------------------------------------------------------- ease --- */

MK.tools["keys.easeCopy"] = {
    needs: { comp: true, keys: 1 },
    undo: false,

    run: function () {
        var comp = MK.sel.comp();
        var props = MK.sel.propsWithSelectedKeys(comp);

        var donorProp = props[0];
        var donorIndex = donorProp.selectedKeys[0];

        var total = MK.sel.countSelectedKeys(comp);
        var ease = MK.keys.readEasePortable(donorProp, donorIndex);

        var msg = "Ease copied from " + donorProp.name + ", key " + donorIndex + ".";
        if (total > 1) {
            msg += " " + (total - 1) + " other selected key(s) ignored.";
        }

        return MK.ok(msg, { ease: ease });
    }
};

MK.tools["keys.easePaste"] = {
    needs: { comp: true, keys: 1 },
    undo: true,
    undoName: "Paste ease",

    run: function (args) {
        if (!args.ease || args.ease.inType === undefined) {
            return MK.fail("Copy an ease first.");
        }

        var comp = MK.sel.comp();
        var props = MK.sel.propsWithSelectedKeys(comp);

        var applied = 0;
        var failures = 0;

        for (var p = 0; p < props.length; p++) {
            var prop = props[p];
            var keys = prop.selectedKeys;
            for (var k = 0; k < keys.length; k++) {
                var problem = MK.keys.applyEasePortable(prop, keys[k], args.ease);
                if (problem) { failures++; } else { applied++; }
            }
        }

        if (!applied) {
            return MK.fail("No keyframe accepted that ease.");
        }

        return MK.ok("Ease applied to " + MK.util.plural(applied, "key") +
            (failures ? ", " + failures + " refused." : "."),
            { applied: applied, failures: failures });
    }
};

/* --------------------------------------------------------------- clone --- */

MK.tools["keys.clone"] = {
    needs: { comp: true, keys: 1 },
    undo: true,
    undoName: "Clone keys",

    run: function (args) {
        var comp = MK.sel.comp();
        var props = MK.sel.propsWithSelectedKeys(comp);
        var reverse = !!(args.mod && args.mod.shift);
        var selectNew = !!(args.mod && args.mod.alt);
        var playhead = comp.time;

        var cloned = 0;
        var overwritten = 0;

        for (var p = 0; p < props.length; p++) {
            var prop = props[p];
            var selected = prop.selectedKeys;

            // Read everything before writing: each new key renumbers the rest.
            var source = [];
            var first = null, last = null;
            for (var s = 0; s < selected.length; s++) {
                var data = MK.keys.readKey(prop, selected[s]);
                source.push(data);
                if (first === null || data.time < first) { first = data.time; }
                if (last === null || data.time > last) { last = data.time; }
            }

            var written = [];
            for (var w = 0; w < source.length; w++) {
                var d = source[w];
                var offset = reverse ? (last - d.time) : (d.time - first);
                var time = playhead + offset;

                if (MK.keys.keyAt(prop, time)) { overwritten++; }

                var index = MK.keys.writeKey(prop, time, reverse ? MK.keys.mirror(d) : d);
                written.push(index);
                cloned++;
            }

            if (selectNew) {
                try {
                    for (var o = 0; o < selected.length; o++) {
                        prop.setSelectedAtKey(selected[o], false);
                    }
                    for (var n = 0; n < written.length; n++) {
                        prop.setSelectedAtKey(written[n], true);
                    }
                } catch (e) { /* selection is a convenience, not the job */ }
            }
        }

        if (!cloned) {
            return MK.fail("Nothing was cloned.");
        }

        var msg = (reverse ? "Reverse cloned " : "Cloned ") +
            MK.util.plural(cloned, "key") + " to the playhead.";
        if (overwritten) {
            msg += " " + overwritten + " existing key(s) replaced.";
        }
        return MK.ok(msg, { cloned: cloned, overwritten: overwritten });
    }
};

/* ---------------------------------------------------------- snap to frame - */

MK.tools["keys.fixTime"] = {
    needs: { comp: true, keys: 1 },
    undo: true,
    undoName: "Snap keys to frames",

    run: function () {
        var comp = MK.sel.comp();
        var props = MK.sel.propsWithSelectedKeys(comp);
        var fd = comp.frameDuration;

        var movedTotal = 0;
        var roving = 0;
        var failed = 0;

        for (var p = 0; p < props.length; p++) {
            var prop = props[p];
            var selected = prop.selectedKeys;

            // Collect first: removing a key renumbers everything after it.
            var pending = [];
            for (var s = 0; s < selected.length; s++) {
                var index = selected[s];
                var data;
                try { data = MK.keys.readKey(prop, index); } catch (e) { failed++; continue; }

                if (data.roving) { roving++; continue; }

                var target = MK.util.snapToFrame(data.time, fd);
                if (Math.abs(target - data.time) < MK.keys.EPS) { continue; }

                pending.push({ index: index, data: data, target: target });
            }

            if (!pending.length) { continue; }

            // Remove from the end so lower indices stay valid.
            pending.sort(function (a, b) { return b.index - a.index; });
            for (var r = 0; r < pending.length; r++) {
                try { prop.removeKey(pending[r].index); } catch (e2) { failed++; }
            }

            // Write back earliest first; a frame already taken pushes the key
            // to the next free one rather than silently swallowing it.
            pending.sort(function (a, b) { return a.data.time - b.data.time; });
            for (var w = 0; w < pending.length; w++) {
                var time = pending[w].target;
                var guard = 0;
                while (MK.keys.keyAt(prop, time) && guard < 240) {
                    time += fd;
                    guard++;
                }
                try {
                    MK.keys.writeKey(prop, time, pending[w].data);
                    movedTotal++;
                } catch (e3) {
                    failed++;
                }
            }
        }

        if (!movedTotal) {
            var why = roving ? "Only roving keys were selected; they have no fixed time."
                             : "Every selected key is already on a frame.";
            return MK.ok(why, { moved: 0, roving: roving });
        }

        var msg = "Snapped " + MK.util.plural(movedTotal, "key") + " to whole frames.";
        if (roving) { msg += " " + roving + " roving key(s) left alone."; }
        if (failed) { msg += " " + failed + " could not be rewritten."; }

        return MK.ok(msg, { moved: movedTotal, roving: roving, failed: failed });
    }
};

/* ---------------------------------------------------------------- loop --- */

MK.tools["keys.loop"] = {
    needs: { comp: true, props: 1 },
    undo: true,
    undoName: "Loop",

    run: function (args) {
        var comp = MK.sel.comp();
        var props = MK.sel.animatableProps(comp);
        var inward = !!(args.mod && args.mod.alt);

        var type = args.type || "cycle";
        if (!/^(cycle|pingpong|offset|continue)$/.test(type)) { type = "cycle"; }

        var call = inward ? "loopIn" : "loopOut";
        var expression = call + '("' + type + '")';

        var applied = 0;
        var replaced = 0;
        var tooFewKeys = 0;
        var refused = 0;

        for (var i = 0; i < props.length; i++) {
            var prop = props[i];

            if (!prop.canSetExpression) { refused++; continue; }
            if (prop.numKeys < 2) { tooFewKeys++; continue; }
            if (prop.expression) { replaced++; }

            try {
                prop.expression = expression;
                prop.expressionEnabled = true;
                applied++;
            } catch (e) {
                refused++;
            }
        }

        if (!applied) {
            if (tooFewKeys) { return MK.fail("A loop needs at least two keyframes."); }
            return MK.fail("None of the selected properties can take an expression.");
        }

        var msg = expression + " added to " + MK.util.plural(applied, "property") + ".";
        if (replaced) { msg += " " + replaced + " existing expression(s) replaced."; }
        if (tooFewKeys) { msg += " " + tooFewKeys + " skipped for having under two keys."; }

        return MK.ok(msg, { applied: applied, replaced: replaced, refused: refused });
    }
};

/* ===== 22-tools-shapes.jsx ===== */
/**
 * Motion Kit — shape tools.
 */

/* ------------------------------------------------------- vector to shapes - */

MK.tools["shapes.fromVector"] = {
    needs: { comp: true, layers: 1 },
    undo: true,
    undoName: "Create shapes from vector layers",

    run: function () {
        var comp = MK.sel.comp();
        var layers = MK.sel.layers(comp);

        var vectors = [];
        for (var i = 0; i < layers.length; i++) {
            if (MK.shapes.isVectorLayer(layers[i])) { vectors.push(layers[i]); }
        }

        if (!vectors.length) {
            return MK.fail("Select an Illustrator, EPS, SVG or PDF layer.");
        }

        var id = MK.shapes.commandId(MK.shapes.CMD.createShapes);
        if (!id) {
            return MK.fail("After Effects did not report the 'Create Shapes from " +
                "Vector Layer' command. Use Layer > Create > Create Shapes from Vector Layer.");
        }

        MK.shapes.deselectAll(comp);
        for (var v = 0; v < vectors.length; v++) { vectors[v].selected = true; }

        app.executeCommand(id);

        return MK.ok("Converted " + MK.util.plural(vectors.length, "vector layer") + ".",
            { converted: vectors.length });
    }
};

/* ------------------------------------------------------------- artboards - */

MK.tools["shapes.removeArtboard"] = {
    needs: { comp: true, shapeLayers: 1 },
    undo: true,
    undoName: "Remove artboards",

    run: function (args) {
        var comp = MK.sel.comp();
        var layers = MK.sel.shapeLayers(comp);
        var alsoEmpty = !!(args.mod && args.mod.alt);

        var boards = 0;
        var empties = 0;

        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            var root = MK.shapes.root(layer);
            if (!root) { continue; }

            // Collect first: removing while walking invalidates the indices.
            var doomed = [];
            MK.shapes.eachGroup(root, function (group) {
                if (MK.shapes.isArtboardRect(group, layer.width, layer.height)) {
                    doomed.push(group);
                }
            });

            for (var d = 0; d < doomed.length; d++) {
                try { doomed[d].remove(); boards++; } catch (e) { /* already gone */ }
            }

            if (alsoEmpty) {
                // Emptying an inner group can empty its parent, so repeat
                // until a pass finds nothing.
                var pass = 0;
                var removedThisPass;
                do {
                    removedThisPass = 0;
                    var blanks = [];
                    MK.shapes.eachGroup(root, function (group) {
                        if (MK.shapes.isEmptyGroup(group)) { blanks.push(group); }
                    });
                    for (var b = 0; b < blanks.length; b++) {
                        try { blanks[b].remove(); removedThisPass++; } catch (e2) { /* nested */ }
                    }
                    empties += removedThisPass;
                    pass++;
                } while (removedThisPass > 0 && pass < 12);
            }
        }

        if (!boards && !empties) {
            return MK.ok("No artboard group found. It may already be gone, or the " +
                "artboard rectangle is not layer-sized.", { boards: 0 });
        }

        var msg = boards ? "Removed " + MK.util.plural(boards, "artboard group") + "." : "";
        if (empties) { msg += (msg ? " " : "") + "Removed " + MK.util.plural(empties, "empty group") + "."; }

        return MK.ok(msg, { boards: boards, empties: empties });
    }
};

/* --------------------------------------------------------------- extract - */

MK.tools["shapes.extract"] = {
    needs: { comp: true, shapeLayers: 1 },
    undo: true,
    undoName: "Extract shapes",

    run: function (args) {
        var comp = MK.sel.comp();
        var layers = MK.sel.shapeLayers(comp);
        var keepSource = !!(args.mod && args.mod.alt);

        var made = 0;
        var untouched = 0;

        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            var groups = MK.shapes.topGroups(layer);

            if (groups.length < 2) { untouched++; continue; }

            var names = [];
            for (var g = 0; g < groups.length; g++) { names.push(groups[g].name); }

            // Work from the last group upwards so the new layers end up in the
            // same stacking order the groups had.
            for (var k = names.length - 1; k >= 0; k--) {
                var copy = layer.duplicate();
                copy.moveBefore(layer);

                var root = MK.shapes.root(copy);
                var keep = k + 1;   // groups are 1-based inside the root

                for (var p = root.numProperties; p >= 1; p--) {
                    var prop = root.property(p);
                    if (prop.matchName !== MK.shapes.GROUP) { continue; }
                    if (p !== keep) {
                        try { prop.remove(); } catch (e) { /* ignore */ }
                    }
                }

                copy.name = names[k];
                made++;
            }

            if (!keepSource) {
                try { layer.remove(); } catch (e2) { /* ignore */ }
            }
        }

        if (!made) {
            return MK.fail(untouched
                ? "Those layers hold a single group — there is nothing to split."
                : "Nothing to extract.");
        }

        return MK.ok("Extracted " + MK.util.plural(made, "shape") + " onto separate layers.",
            { made: made });
    }
};

/* ----------------------------------------------------------------- merge - */

/**
 * Merge is the one tool that leans on AE's own copy and paste, because a
 * shape group cannot be moved between layers by script — there is no API for
 * it, only add, duplicate-in-place and remove. Copy/paste is what a person
 * would do by hand, driven from here.
 *
 * Consequence: it needs the menu command ids, and it only bakes translation
 * between layers. Scaled or rotated source layers are reported, not guessed.
 */
MK.tools["shapes.merge"] = {
    needs: { comp: true, shapeLayers: 2 },
    undo: true,
    undoName: "Merge shapes",

    run: function (args) {
        var comp = MK.sel.comp();
        var layers = MK.sel.shapeLayers(comp);
        var keepSources = !!(args.mod && args.mod.alt);

        var copyId = MK.shapes.commandId(MK.shapes.CMD.copy);
        var pasteId = MK.shapes.commandId(MK.shapes.CMD.paste);
        if (!copyId || !pasteId) {
            return MK.fail("After Effects did not report the copy and paste commands, " +
                "so groups cannot be moved between layers.");
        }

        // Topmost selected layer wins; sources come to it.
        layers.sort(function (a, b) { return a.index - b.index; });
        var dest = layers[0];
        var destPos = dest.property("ADBE Transform Group").property("ADBE Position").value;

        var destRoot = MK.shapes.root(dest);
        if (!destRoot) { return MK.fail("The destination layer has no contents."); }

        var mergedGroups = 0;
        var warnings = [];

        for (var i = 1; i < layers.length; i++) {
            var src = layers[i];
            var srcTg = src.property("ADBE Transform Group");
            var srcPos = srcTg.property("ADBE Position").value;
            var srcScale = srcTg.property("ADBE Scale").value;
            var srcRot = srcTg.property("ADBE Rotate Z").value;

            if (Math.abs(srcScale[0] - 100) > 0.01 || Math.abs(srcScale[1] - 100) > 0.01 ||
                Math.abs(srcRot) > 0.01) {
                warnings.push(src.name + " is scaled or rotated; only its offset was kept");
            }

            var groups = MK.shapes.topGroups(src);
            if (!groups.length) { continue; }

            var before = destRoot.numProperties;

            MK.shapes.deselectAll(comp);
            src.selected = true;
            for (var g = 0; g < groups.length; g++) { groups[g].selected = true; }
            app.executeCommand(copyId);

            MK.shapes.deselectAll(comp);
            dest.selected = true;
            destRoot.selected = true;
            app.executeCommand(pasteId);

            var added = destRoot.numProperties - before;
            if (added <= 0) {
                warnings.push(src.name + ": nothing arrived on paste");
                continue;
            }

            // Pasted groups land at the top of the contents. Shift each one by
            // the distance between the two layers so the artwork stays put.
            var dx = srcPos[0] - destPos[0];
            var dy = srcPos[1] - destPos[1];

            for (var a = 1; a <= added; a++) {
                var group = destRoot.property(a);
                if (!group || group.matchName !== MK.shapes.GROUP) { continue; }
                try {
                    var gp = group.property(MK.shapes.XFORM).property("ADBE Vector Position");
                    if (gp.numKeys === 0) {
                        var v = gp.value;
                        gp.setValue([v[0] + dx, v[1] + dy]);
                    } else {
                        warnings.push(group.name + " has position keys; offset not applied");
                    }
                } catch (e) { /* group without a standard transform */ }
                mergedGroups++;
            }

            if (!keepSources) {
                try { src.remove(); } catch (e2) { /* ignore */ }
            }
        }

        MK.shapes.deselectAll(comp);
        dest.selected = true;

        if (!mergedGroups) {
            return MK.fail("Nothing was merged. " + (warnings[0] || ""));
        }

        var msg = "Merged " + MK.util.plural(mergedGroups, "group") + " into " + dest.name + ".";
        if (warnings.length) { msg += " " + warnings[0]; }

        return MK.ok(msg, { groups: mergedGroups, warnings: warnings });
    }
};

/* ===== 23-tools-layers.jsx ===== */
/**
 * Motion Kit — layer tools.
 */

MK.tools["layers.parentNull"] = {
    needs: { comp: true, layers: 1 },
    undo: true,
    undoName: "Add parent null",

    run: function (args) {
        var comp = MK.sel.comp();
        var layers = MK.sel.layers(comp);
        var force3D = !!(args.mod && args.mod.alt);

        // Centre of the selection, measured from the layers that are not
        // already parented — their Position values share the comp's space.
        var sumX = 0, sumY = 0, sumZ = 0, counted = 0;
        var any3D = false;

        // Hold the layer itself, not its index: addNull() inserts at the top
        // and renumbers every other layer, so an index captured now points
        // somewhere else a moment later.
        var topLayer = layers[0];

        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            if (layer.index < topLayer.index) { topLayer = layer; }
            if (layer.threeDLayer) { any3D = true; }

            if (!layer.parent) {
                var p = layer.property("ADBE Transform Group").property("ADBE Position").value;
                sumX += p[0];
                sumY += p[1];
                sumZ += (p.length > 2 ? p[2] : 0);
                counted++;
            }
        }

        var centre = counted
            ? [sumX / counted, sumY / counted, sumZ / counted]
            : [comp.width / 2, comp.height / 2, 0];

        var nul = comp.layers.addNull(comp.duration);
        nul.name = "NULL " + comp.name;
        nul.threeDLayer = force3D || any3D;

        var tg = nul.property("ADBE Transform Group");
        tg.property("ADBE Anchor Point").setValue(
            nul.threeDLayer ? [nul.width / 2, nul.height / 2, 0] : [nul.width / 2, nul.height / 2]);
        tg.property("ADBE Position").setValue(
            nul.threeDLayer ? centre : [centre[0], centre[1]]);

        // Directly above the highest selected layer, not at the top of the comp.
        nul.moveBefore(topLayer);

        // Span the selection in time.
        var inPoint = layers[0].inPoint, outPoint = layers[0].outPoint;
        for (var s = 1; s < layers.length; s++) {
            if (layers[s].inPoint < inPoint) { inPoint = layers[s].inPoint; }
            if (layers[s].outPoint > outPoint) { outPoint = layers[s].outPoint; }
        }
        try {
            nul.inPoint = inPoint;
            nul.outPoint = outPoint;
        } catch (e) { /* zero-length selections */ }

        // Plain assignment keeps each layer's transform; setParentWithJump
        // would move them.
        var parented = 0;
        for (var k = 0; k < layers.length; k++) {
            try {
                layers[k].parent = nul;
                parented++;
            } catch (e2) { /* cameras and lights refuse some parents */ }
        }

        nul.selected = true;

        return MK.ok("Null added, " + MK.util.plural(parented, "layer") + " parented.",
            { parented: parented, threeD: nul.threeDLayer });
    }
};

/* ===== 24-tools-text.jsx ===== */
/**
 * Motion Kit — point text to box text.
 *
 * There is no conversion API. TextDocument.boxText is read-only and the menu
 * item is not reachable through executeCommand — the command id it reports is
 * shared between both directions and does nothing when executed. So the layer
 * is rebuilt with addBoxText() and everything is carried across by hand.
 *
 * What cannot be carried, and is therefore refused up front rather than
 * silently dropped:
 *   - text animators: no API moves them between layers
 *   - keyframes or an expression on Source Text
 *
 * The original is only deleted when everything transferred. Otherwise it is
 * kept, and the report says what is still on it.
 */

MK.tools["text.pointToBox"] = {
    needs: { comp: true, textLayers: 1 },
    undo: true,
    undoName: "Point text to box text",

    run: function (args) {
        var comp = MK.sel.comp();
        var layers = MK.sel.textLayers(comp);
        var padding = (args.padding === undefined) ? 40 : Number(args.padding);

        // Blank lines of room left below the text. Set to 0 for the old
        // behaviour of a box that just fits.
        var extraLines = (args.extraLines === undefined) ? 2 : Number(args.extraLines);

        var keepOriginal = !!(args.mod && args.mod.alt);

        /**
         * Height of one line of the given text, in pixels.
         *
         * AE's auto leading is 120% of the font size. TextDocument.leading
         * only carries a meaningful number while autoLeading is off — with it
         * on, the value is whatever was last set by hand and has nothing to do
         * with what is on screen. Every read is guarded because a layer with
         * more than one style throws instead of returning a value.
         *
         * Returns 0 when nothing usable could be read, which the caller takes
         * as "fall back to the flat padding".
         */
        function lineHeightOf(doc) {
            var size = 0;
            var auto = true;
            var lead = 0;

            try { size = Number(doc.fontSize); } catch (eSize) { size = 0; }
            if (!(size > 0)) { size = 0; }

            try { auto = (doc.autoLeading !== false); } catch (eAuto) { auto = true; }

            if (!auto) {
                try { lead = Number(doc.leading); } catch (eLead) { lead = 0; }
                if (!(lead > 0)) { lead = 0; }
            }

            if (lead > 0) { return lead; }
            return size > 0 ? size * 1.2 : 0;
        }

        // Order matters on the way out: applyFill and applyStroke gate the
        // properties under them. Writing a colour onto a document that has no
        // stroke yet throws, and so does *reading* one — AE raises
        // "this text has no stroke" rather than returning nothing, so both
        // directions are guarded.
        var FLAGS = ["applyFill", "applyStroke"];

        var GATED = {
            fillColor: "applyFill",
            strokeColor: "applyStroke",
            strokeWidth: "applyStroke",
            strokeOverFill: "applyStroke"
        };

        var WRITABLE = [
            "text", "font", "fontSize",
            "fillColor", "strokeColor", "strokeWidth", "strokeOverFill",
            "justification", "tracking", "leading", "autoLeading",
            "baselineShift", "allCaps", "smallCaps",
            "fauxBold", "fauxItalic", "subscript", "superscript"
        ];

        var TRANSFORM = ["ADBE Anchor Point", "ADBE Position", "ADBE Scale",
                         "ADBE Rotate Z", "ADBE Opacity"];

        var converted = 0;
        var notes = [];

        function textProp(layer) {
            return layer.property("ADBE Text Properties").property("ADBE Text Document");
        }

        function copyProperty(from, to) {
            if (!from || !to) { return; }
            if (from.numKeys === 0) {
                try { to.setValue(from.value); } catch (e) { /* type mismatch */ }
                return;
            }
            for (var k = 1; k <= from.numKeys; k++) {
                try {
                    MK.keys.writeKey(to, from.keyTime(k), MK.keys.readKey(from, k));
                } catch (e2) { /* reported by the caller's note */ }
            }
        }

        for (var i = 0; i < layers.length; i++) {
            var src = layers[i];
            var srcName = src.name;   // src dies on remove(); the name must outlive it
            var srcProp = textProp(src);
            var srcDoc = srcProp.value;

            var already = false;
            try { already = srcDoc.boxText === true; } catch (e) { /* unreadable */ }
            if (already) {
                notes.push(srcName + " is already box text");
                continue;
            }

            var animators = null;
            try {
                animators = src.property("ADBE Text Properties").property("ADBE Text Animators");
            } catch (e2) { /* absent */ }
            if (animators && animators.numProperties > 0) {
                notes.push(srcName + " has text animators, which cannot be moved");
                continue;
            }

            if (srcProp.numKeys > 0 || srcProp.expression) {
                notes.push(srcName + " has animated source text");
                continue;
            }

            var rect;
            try { rect = src.sourceRectAtTime(comp.time, true); } catch (e3) { rect = null; }
            if (!rect || rect.width <= 0) {
                notes.push(srcName + " has nothing visible at the playhead");
                continue;
            }

            /**
             * Vertical slack is measured in lines, not pixels.
             *
             * The sides keep the flat padding — horizontal room is about not
             * clipping a descender or an italic, and a fixed number is right
             * for that. Downward room is a different problem: the box exists
             * so the copy can grow, and "one more line" is the unit that
             * actually means something. 40px is most of a line at 34pt and a
             * third of one at 96pt, which is why the same number felt
             * generous on small text and tight on large.
             *
             * Box text flows from the top of its box, and the anchor fix
             * further down pins the first line exactly where the point text
             * sat — so every extra pixel of height lands underneath the text,
             * never above it.
             *
             * Leading falls back to the font size when it cannot be read:
             * mixed-style runs make TextDocument raise rather than return
             * something approximate.
             */
            var lineHeight = lineHeightOf(srcDoc);
            var slackDown = (lineHeight > 0) ? Math.ceil(extraLines * lineHeight) : padding;

            var box = [Math.ceil(rect.width) + padding, Math.ceil(rect.height) + slackDown];

            var dst = comp.layers.addBoxText(box);
            var dstProp = textProp(dst);
            var dstDoc = dstProp.value;      // boxText is already true here

            var lost = [];
            var carried = {};

            function take(key) {
                try {
                    var v = srcDoc[key];
                    if (v !== undefined) { carried[key] = v; }
                } catch (eRead) {
                    // the property is not in play on this layer at all
                }
            }

            for (var g = 0; g < FLAGS.length; g++) { take(FLAGS[g]); }
            for (var r = 0; r < WRITABLE.length; r++) { take(WRITABLE[r]); }

            function put(key) {
                if (carried[key] === undefined) { return; }
                var gate = GATED[key];
                if (gate && carried[gate] !== true) { return; }
                try { dstDoc[key] = carried[key]; } catch (eWrite) { lost.push(key); }
            }

            for (var gg = 0; gg < FLAGS.length; gg++) { put(FLAGS[gg]); }
            for (var rr = 0; rr < WRITABLE.length; rr++) { put(WRITABLE[rr]); }

            dstProp.setValue(dstDoc);

            // If the document copy dragged the point-text flag along, back out
            // rather than leave a broken duplicate behind.
            var stillBox = false;
            try { stillBox = textProp(dst).value.boxText === true; } catch (e5) { /* ignore */ }
            if (!stillBox) {
                try { dst.remove(); } catch (e6) { /* ignore */ }
                notes.push(srcName + ": the rebuilt layer reverted to point text");
                continue;
            }

            /* layer attributes */
            dst.moveBefore(src);
            dst.name = srcName;
            dst.label = src.label;
            dst.threeDLayer = src.threeDLayer;
            dst.blendingMode = src.blendingMode;
            dst.motionBlur = src.motionBlur;
            dst.guideLayer = src.guideLayer;
            dst.shy = src.shy;

            try {
                dst.startTime = src.startTime;
                dst.inPoint = src.inPoint;
                dst.outPoint = src.outPoint;
            } catch (e7) { /* ignore */ }

            /* transform */
            var srcTg = src.property("ADBE Transform Group");
            var dstTg = dst.property("ADBE Transform Group");
            for (var t = 0; t < TRANSFORM.length; t++) {
                copyProperty(srcTg.property(TRANSFORM[t]), dstTg.property(TRANSFORM[t]));
            }

            /* effects, static values only */
            var srcFx = src.property("ADBE Effect Parade");
            var dstFx = dst.property("ADBE Effect Parade");
            var keyedEffects = 0;
            if (srcFx && srcFx.numProperties) {
                for (var f = 1; f <= srcFx.numProperties; f++) {
                    var effect = srcFx.property(f);
                    var copy = null;
                    try { copy = dstFx.addProperty(effect.matchName); } catch (e8) { copy = null; }
                    if (!copy) { lost.push("effect " + effect.name); continue; }

                    copy.name = effect.name;
                    for (var pIndex = 1; pIndex <= effect.numProperties; pIndex++) {
                        var from = effect.property(pIndex);
                        var to = copy.property(pIndex);
                        if (!from || !to || from.propertyType !== PropertyType.PROPERTY) { continue; }
                        if (from.numKeys > 0) { keyedEffects++; }
                        try {
                            if (from.canVaryOverTime && from.numKeys === 0) { to.setValue(from.value); }
                        } catch (e9) { /* custom value types */ }
                    }
                }
            }
            if (keyedEffects) { lost.push(keyedEffects + " keyed effect parameter(s)"); }

            /* masks */
            var srcMasks = src.property("ADBE Mask Parade");
            if (srcMasks && srcMasks.numProperties) {
                lost.push(srcMasks.numProperties + " mask(s)");
            }

            /* Box text measures from a different origin than point text, so
               nudge the anchor until the glyphs sit exactly where they did. */
            var anchor = dstTg.property("ADBE Anchor Point");
            if (anchor.numKeys === 0) {
                try {
                    var after = dst.sourceRectAtTime(comp.time, true);
                    var a = anchor.value;
                    var shifted = [a[0] + (after.left - rect.left), a[1] + (after.top - rect.top)];
                    if (a.length > 2) { shifted.push(a[2]); }
                    anchor.setValue(shifted);
                } catch (e10) {
                    lost.push("alignment");
                }
            } else {
                lost.push("alignment (anchor is animated)");
            }

            /* parent last: assigning it earlier would fight the transform copy */
            if (src.parent) {
                try { dst.parent = src.parent; } catch (e11) { lost.push("parent"); }
            }

            // The original goes. Anything that genuinely cannot be rebuilt —
            // animators, animated source text — was refused before we got
            // here, so what remains in `lost` is worth reporting, not worth
            // leaving a duplicate layer behind for. Alt keeps the original.
            if (keepOriginal) {
                src.enabled = false;
                src.name = srcName + " (point text)";
            } else {
                try { src.remove(); } catch (e12) { notes.push(srcName + ": could not be removed"); }
            }

            if (lost.length) {
                notes.push(srcName + ": not carried over — " + lost.join(", "));
            }

            converted++;
        }

        if (!converted) {
            return MK.fail(notes.length ? notes[0] : "Nothing to convert.");
        }

        var msg = "Rebuilt " + MK.util.plural(converted, "layer") + " as box text.";
        if (notes.length) { msg += " " + notes[0]; }

        return MK.ok(msg, { converted: converted, notes: notes });
    }
};

/* ===== 26-tools-textbox.jsx ===== */
/**
 * Motion Kit — auto-sizing text box.
 *
 * Ported from TextBox_i_Karate 1.0.0. The rig is pure expressions on a shape
 * layer parented to the text, so the result carries no dependency on this
 * panel: any AE 2024+ opens the project and renders it correctly.
 *
 * Three choices in the generated expressions are load-bearing and must not be
 * "tidied up":
 *
 *   thisLayer.parent, never a layer name — survives renaming the text layer,
 *   and survives duplicating the pair, because AE relinks parenting to the
 *   duplicate while a name reference would keep pointing at the original.
 *
 *   Effect params by index — effect("TB PadL")(1) — because parameter display
 *   names are localised and a name reference breaks in a non-English AE. The
 *   control names themselves are set explicitly for the same reason.
 *
 *   The unused read of T.text.sourceText — without a dependency on the text,
 *   sourceRectAtTime does not reliably re-evaluate after an edit and the box
 *   freezes at its old size.
 *
 * Expressions are left bare rather than wrapped in try/catch: an earlier
 * version swallowed a real failure into a fallback `value`, which drew a
 * default 100x100 rect and looked like a layout bug instead of an error.
 */

MK.textbox = (function () {

    var DEF = {
        padL: 40,
        padR: 40,
        padT: 24,
        padB: 24,
        radius: 0,
        strokeW: 0,
        fill: "#FAD500",
        stroke: "#FFFFFF",
        label: 2                     /* AE label index 2 = Yellow */
    };

    var HEAD = [
        'var T = thisLayer.parent;',
        'var d = T.text.sourceText;',
        'var r = T.sourceRectAtTime(time, false);',
        'var pl = thisLayer.effect("TB PadL")(1).value;',
        'var pr = thisLayer.effect("TB PadR")(1).value;',
        'var pt = thisLayer.effect("TB PadT")(1).value;',
        'var pb = thisLayer.effect("TB PadB")(1).value;'
    ].join("\n");

    var EXPR_SIZE = HEAD + "\n" +
        "[Math.max(1, r.width + pl + pr), Math.max(1, r.height + pt + pb)];";

    var EXPR_POS = HEAD + "\n" +
        "[r.left + r.width / 2 + (pr - pl) / 2, r.top + r.height / 2 + (pb - pt) / 2];";

    var EXPR_ROUND = HEAD + "\n" + [
        'var w = r.width + pl + pr;',
        'var h = r.height + pt + pb;',
        'Math.max(0, Math.min(thisLayer.effect("TB Radius")(1).value, Math.min(w, h) / 2));'
    ].join("\n");

    function link(effName) {
        return 'thisLayer.effect("' + effName + '")(1).value;';
    }

    function hexToRGBA(hex) {
        var s = String(hex).replace("#", "");
        if (s.length === 3) {
            s = s.charAt(0) + s.charAt(0) + s.charAt(1) +
                s.charAt(1) + s.charAt(2) + s.charAt(2);
        }
        var r = parseInt(s.substring(0, 2), 16) / 255;
        var g = parseInt(s.substring(2, 4), 16) / 255;
        var b = parseInt(s.substring(4, 6), 16) / 255;
        if (isNaN(r) || isNaN(g) || isNaN(b)) { return [0, 0, 0, 1]; }
        return [r, g, b, 1];
    }

    /* A freshly added control carries a localised default name. */
    function addCtrl(layer, matchName, name, value) {
        var fx = layer.property("ADBE Effect Parade").addProperty(matchName);
        fx.name = name;
        if (value !== null && value !== undefined) { fx.property(1).setValue(value); }
        return fx;
    }

    function isBox(layer) {
        if (!(layer instanceof ShapeLayer)) { return false; }
        var fx = layer.property("ADBE Effect Parade");
        for (var i = 1; i <= fx.numProperties; i++) {
            if (fx.property(i).name === "TB PadL") { return true; }
        }
        return false;
    }

    /* Walks the whole tree, so a repair still works after the user has
       renamed or regrouped the contents. */
    function collect(group, bag) {
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.matchName === "ADBE Vector Shape - Rect" && !bag.rect) { bag.rect = p; }
            else if (p.matchName === "ADBE Vector Graphic - Fill" && !bag.fill) { bag.fill = p; }
            else if (p.matchName === "ADBE Vector Graphic - Stroke" && !bag.stroke) { bag.stroke = p; }
            else if (p.matchName === "ADBE Vector Group") {
                collect(p.property("ADBE Vectors Group"), bag);
            }
        }
        return bag;
    }

    function applyExpressions(sh) {
        var bag = collect(sh.property("ADBE Root Vectors Group"), {});
        if (!bag.rect) { throw new Error("no rectangle path on \"" + sh.name + "\""); }

        bag.rect.property("ADBE Vector Rect Size").expression = EXPR_SIZE;
        bag.rect.property("ADBE Vector Rect Position").expression = EXPR_POS;
        bag.rect.property("ADBE Vector Rect Roundness").expression = EXPR_ROUND;

        if (bag.fill) {
            bag.fill.property("ADBE Vector Fill Color").expression = link("TB Fill");
        }
        if (bag.stroke) {
            bag.stroke.property("ADBE Vector Stroke Color").expression = link("TB Stroke");
            bag.stroke.property("ADBE Vector Stroke Width").expression = link("TB Stroke W");
        }
    }

    /**
     * The box is a shape layer, so it must not inherit the [text] tag from
     * the layer it frames — downstream automation reads that tag to decide
     * what is a text layer, and a shape carrying it gets misclassified.
     * Every other tag is left alone; only [text] is meaningless here.
     */
    function boxName(name) {
        var out = String(name).replace(/\s*\[text\]\s*/gi, " ");
        out = out.replace(/\s+/g, " ").replace(/^\s+/, "").replace(/\s+$/, "");
        return "BOX " + (out || String(name));
    }

    function build(comp, t) {
        var sh = comp.layers.addShape();
        sh.name = boxName(t.name);

        /* Below the text, so the box never covers the words it frames. */
        sh.moveAfter(t);

        /* Match dimensionality before parenting: a 2D box under a 3D text
           layer ends up on the wrong plane. */
        if (t.threeDLayer) { sh.threeDLayer = true; }
        sh.parent = t;

        var tr = sh.property("ADBE Transform Group");
        tr.property("ADBE Anchor Point").setValue(t.threeDLayer ? [0, 0, 0] : [0, 0]);
        tr.property("ADBE Position").setValue(t.threeDLayer ? [0, 0, 0] : [0, 0]);
        tr.property("ADBE Scale").setValue(t.threeDLayer ? [100, 100, 100] : [100, 100]);
        tr.property("ADBE Rotate Z").setValue(0);

        sh.startTime = t.startTime;
        sh.inPoint = t.inPoint;
        sh.outPoint = t.outPoint;
        sh.motionBlur = t.motionBlur;
        sh.label = DEF.label;

        /* Controls live on the box, so duplicating the pair yields a fully
           independent rig. */
        addCtrl(sh, "ADBE Slider Control", "TB PadL", DEF.padL);
        addCtrl(sh, "ADBE Slider Control", "TB PadR", DEF.padR);
        addCtrl(sh, "ADBE Slider Control", "TB PadT", DEF.padT);
        addCtrl(sh, "ADBE Slider Control", "TB PadB", DEF.padB);
        addCtrl(sh, "ADBE Slider Control", "TB Radius", DEF.radius);
        addCtrl(sh, "ADBE Slider Control", "TB Stroke W", DEF.strokeW);
        addCtrl(sh, "ADBE Color Control", "TB Fill", hexToRGBA(DEF.fill));
        addCtrl(sh, "ADBE Color Control", "TB Stroke", hexToRGBA(DEF.stroke));

        /* A Fill/Stroke operator paints the paths listed above it, so the
           path goes in first and the stroke lands above the fill. */
        var grp = sh.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        grp.name = "Box";
        var gc = grp.property("ADBE Vectors Group");
        gc.addProperty("ADBE Vector Shape - Rect");
        gc.addProperty("ADBE Vector Graphic - Stroke");
        gc.addProperty("ADBE Vector Graphic - Fill");

        applyExpressions(sh);
        return sh;
    }

    return {
        DEF: DEF,
        isBox: isBox,
        build: build,
        applyExpressions: applyExpressions
    };
})();


MK.tools["text.box"] = {
    needs: { comp: true, layers: 1 },
    undo: true,
    undoName: "Create text box",

    run: function (args) {
        var comp = MK.sel.comp();
        var selection = MK.sel.layers(comp);
        var notes = [];

        /* Selecting existing boxes re-applies their expressions instead of
           building a second box on top. Nothing to guess about intent. */
        var boxes = [];
        var texts = [];
        for (var i = 0; i < selection.length; i++) {
            if (MK.textbox.isBox(selection[i])) { boxes.push(selection[i]); }
            else if (selection[i] instanceof TextLayer) { texts.push(selection[i]); }
        }

        if (boxes.length && !texts.length) {
            var repaired = 0;
            for (var b = 0; b < boxes.length; b++) {
                if (!boxes[b].parent) {
                    notes.push(boxes[b].name + " has no parent text layer");
                    continue;
                }
                try {
                    MK.textbox.applyExpressions(boxes[b]);
                    repaired++;
                } catch (e) {
                    notes.push(boxes[b].name + ": " + e.toString());
                }
            }
            if (!repaired) {
                return MK.fail(notes.length ? notes[0] : "Nothing to repair.");
            }
            var rmsg = "Re-applied " + repaired + (repaired === 1 ? " box" : " boxes") + ".";
            if (notes.length) { rmsg += " " + notes[0]; }
            return MK.ok(rmsg, { repaired: repaired, notes: notes });
        }

        if (!texts.length) {
            return MK.fail("Select a text layer, or a box layer to re-apply.");
        }

        var made = [];
        for (var t = 0; t < texts.length; t++) {
            try {
                made.push(MK.textbox.build(comp, texts[t]).name);
            } catch (e2) {
                notes.push(texts[t].name + ": " + e2.toString());
            }
        }

        if (!made.length) {
            return MK.fail(notes.length ? notes[0] : "No box was created.");
        }

        MK.shapes.deselectAll(comp);

        var msg = "Built " + made.length +
                  (made.length === 1 ? " text box" : " text boxes") +
                  ". Padding and colour are on the box's effect controls.";
        if (notes.length) { msg += " " + notes[0]; }

        return MK.ok(msg, { created: made, notes: notes });
    }
};

/* ===== 99-dispatch.jsx ===== */
/**
 * Motion Kit — dispatcher.
 *
 * The panel's only entry point:  MK.run(toolId, argsJson) -> JSON string
 *
 * Guarantees, so the panel never has to special-case anything:
 *   - always returns a JSON string, never throws across the bridge
 *   - requirements are checked before any project access
 *   - exactly one undo group per call, closed even if run() throws
 */

MK.run = function (toolId, argsJson) {
    var result;

    try {
        var tool = MK.tools[toolId];
        if (!tool) {
            return MK.json.stringify(MK.fail("Unknown tool: " + toolId));
        }

        var gate = MK.sel.check(tool.needs);
        if (!gate.ok) {
            return MK.json.stringify(gate);
        }

        var args = MK.json.parse(argsJson);

        if (tool.undo) {
            app.beginUndoGroup(tool.undoName || toolId);
        }
        try {
            result = tool.run(args) || MK.ok();
        } finally {
            if (tool.undo) {
                app.endUndoGroup();
            }
        }
    } catch (e) {
        var where = e.line ? " (line " + e.line + ")" : "";
        result = MK.fail(String(e) + where);
    }

    return MK.json.stringify(result);
};



/* ======================================================================== *
 * module: studio-inserts.jsx
 * ======================================================================== */

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
    var TEMPLATE_DIR  = "FitMe Studio templates";

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


/* ======================================================================== *
 * module: tags.jsx
 * ======================================================================== */

(function () {
  var TAG_REGEX = /\s\[(text|speech|speechnosubs|subs|subscomp|body)\]$/i;
  var SPEECH_LINK_PRIMARY_REGEX = /\s\[speechlink:([a-z0-9_-]+)\]$/i;
  var ANY_SPEECH_LINK_REGEX_GLOBAL = /\s\[speechlink:([a-z0-9_-]+)\]/ig;
  var COMP_TAG_REGEX = /\s\[comp\]$/i;
  var WARNING_PREVIEW_LIMIT = 20;
  var OBJECT_TO_STRING = Object.prototype.toString;

  function hasOwn(target, key) {
    return !!target && Object.prototype.hasOwnProperty.call(target, key);
  }

  function isArray(value) {
    return OBJECT_TO_STRING.call(value) === '[object Array]';
  }

  function quoteJsonString(value) {
    var text = value === null || value === undefined ? '' : String(value);
    var out = '"';
    var i;
    var ch;
    var code;
    var hex;

    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i);
      code = text.charCodeAt(i);
      if (ch === '"' || ch === '\\') out += '\\' + ch;
      else if (ch === '\b') out += '\\b';
      else if (ch === '\f') out += '\\f';
      else if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else if (code < 32) {
        hex = code.toString(16);
        while (hex.length < 4) hex = '0' + hex;
        out += '\\u' + hex;
      } else {
        out += ch;
      }
    }

    return out + '"';
  }

  function serializeJson(value) {
    var type = typeof value;
    var parts = [];
    var i;
    var key;

    if (value === null) return 'null';
    if (type === 'string') return quoteJsonString(value);
    if (type === 'number') return isFinite(value) ? String(value) : 'null';
    if (type === 'boolean') return value ? 'true' : 'false';
    if (type === 'undefined' || type === 'function') return 'null';

    if (isArray(value)) {
      for (i = 0; i < value.length; i++) {
        parts.push(serializeJson(value[i]));
      }
      return '[' + parts.join(',') + ']';
    }

    for (key in value) {
      if (!hasOwn(value, key)) continue;
      parts.push(quoteJsonString(key) + ':' + serializeJson(value[key]));
    }
    return '{' + parts.join(',') + '}';
  }

  function parseJsonText(raw) {
    if (typeof JSON !== 'undefined' && JSON && typeof JSON.parse === 'function') {
      return JSON.parse(raw);
    }
    return eval('(' + raw + ')');
  }

  function toJson(value) {
    if (typeof JSON !== 'undefined' && JSON && typeof JSON.stringify === 'function') {
      return JSON.stringify(value);
    }
    return serializeJson(value);
  }

  function respondOk(payload) {
    payload = payload || {};
    payload.ok = true;
    return toJson(payload);
  }

  function respondError(message) {
    return toJson({ ok: false, error: String(message || 'Unknown error.') });
  }

  function parseArgs(raw) {
    if (!raw) return {};
    if (typeof raw !== 'string') return raw;
    try {
      return parseJsonText(raw);
    } catch (error) {
      return {};
    }
  }

  function safeString(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function stripManagedTag(name) {
    return safeString(name)
      .replace(SPEECH_LINK_PRIMARY_REGEX, '')
      .replace(TAG_REGEX, '')
      .replace(/\s+$/, '');
  }

  function getManagedTag(name) {
    if (SPEECH_LINK_PRIMARY_REGEX.test(safeString(name))) return 'speechlink';
    var match = safeString(name).match(TAG_REGEX);
    return match ? String(match[1]).toLowerCase() : '';
  }

  function getSpeechLinkId(name) {
    var match = safeString(name).match(SPEECH_LINK_PRIMARY_REGEX);
    return match ? String(match[1]).toLowerCase() : '';
  }

  function hasAnySpeechLinkMarkup(name) {
    return /\s\[speechlink:([a-z0-9_-]+)\]/i.test(safeString(name));
  }

  function sanitizeSpeechLinkId(value) {
    var cleaned = safeString(value).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    cleaned = cleaned.replace(/^-+|-+$/g, '');
    return cleaned;
  }

  function padNumber(value, width) {
    var text = String(Math.max(0, Number(value) || 0));
    while (text.length < width) text = '0' + text;
    return text;
  }

  function stripManagedDecorators(name) {
    return stripManagedTag(name).replace(ANY_SPEECH_LINK_REGEX_GLOBAL, '').replace(/\s+$/, '');
  }

  function stripCompTag(name) {
    return safeString(name).replace(COMP_TAG_REGEX, '').replace(/\s+$/, '');
  }

  function hasCompTag(name) {
    return COMP_TAG_REGEX.test(safeString(name));
  }

  function applyManagedTag(name, tag) {
    var base = stripManagedDecorators(name);
    return base ? (base + ' [' + tag + ']') : ('[' + tag + ']');
  }

  function applySpeechLinkTag(name, linkId) {
    var safeId = sanitizeSpeechLinkId(linkId);
    var base = stripManagedDecorators(name);
    if (!safeId) {
      throw new Error('Speech link id may use only letters, numbers, "_" and "-".');
    }
    return base ? (base + ' [speechlink:' + safeId + ']') : ('[speechlink:' + safeId + ']');
  }

  function applyCompTag(name) {
    var base = stripCompTag(name);
    return base ? (base + ' [comp]') : '[comp]';
  }

  function getActiveComp() {
    try {
      if (app && app.project && app.project.activeItem && app.project.activeItem instanceof CompItem) {
        return app.project.activeItem;
      }
    } catch (error) {}
    return null;
  }

  function getSelectedLayers() {
    var comp = getActiveComp();
    if (!comp) return [];
    try {
      return comp.selectedLayers || [];
    } catch (error) {
      return [];
    }
  }

  function getAllCompItems() {
    var comps = [];
    try {
      if (!app || !app.project) return comps;
      for (var i = 1; i <= app.project.numItems; i++) {
        var item = app.project.item(i);
        if (item instanceof CompItem) comps.push(item);
      }
    } catch (error) {}
    return comps;
  }

  function collectProjectSpeechLinkIds() {
    var result = {};
    var comps = getAllCompItems();
    var compIdx;
    var layerIdx;
    for (compIdx = 0; compIdx < comps.length; compIdx++) {
      var comp = comps[compIdx];
      for (layerIdx = 1; layerIdx <= comp.numLayers; layerIdx++) {
        var layer = comp.layer(layerIdx);
        if (!layer) continue;
        var speechLinkId = getSpeechLinkId(layer.name);
        if (speechLinkId) result[speechLinkId] = true;
      }
    }
    return result;
  }

  function nextAutoSpeechLinkId() {
    var existing = collectProjectSpeechLinkIds();
    var maxNumeric = 0;
    var key;
    for (key in existing) {
      if (!hasOwn(existing, key)) continue;
      if (!/^\d+$/.test(String(key))) continue;
      var parsed = Number(key);
      if (isFinite(parsed) && parsed > maxNumeric) maxNumeric = parsed;
    }

    var nextValue = maxNumeric + 1;
    var candidate = padNumber(nextValue, 3);
    while (existing[candidate]) {
      nextValue++;
      candidate = padNumber(nextValue, 3);
    }
    return candidate;
  }

  function resolveSpeechLinkIdFromSelection(selectedLayers) {
    var unique = {};
    var count = 0;
    var key;
    var i;

    for (i = 0; i < selectedLayers.length; i++) {
      var id = getSpeechLinkId(selectedLayers[i].name);
      if (!id || unique[id]) continue;
      unique[id] = true;
      count++;
    }

    if (count > 1) {
      throw new Error('Selected layers already contain multiple different speech links. Clear them or select one group.');
    }

    for (key in unique) {
      if (hasOwn(unique, key)) {
        return { id: key, mode: 'reuse-selected' };
      }
    }

    return { id: nextAutoSpeechLinkId(), mode: 'generated' };
  }

  function isCompUsedAsPrecomp(targetComp) {
    if (!targetComp) return false;
    var comps = getAllCompItems();
    var compIdx;
    var layerIdx;
    for (compIdx = 0; compIdx < comps.length; compIdx++) {
      var comp = comps[compIdx];
      if (comp === targetComp) continue;
      for (layerIdx = 1; layerIdx <= comp.numLayers; layerIdx++) {
        var layer = comp.layer(layerIdx);
        if (!layer) continue;
        try {
          if (layer.source && layer.source === targetComp) return true;
        } catch (error) {}
      }
    }
    return false;
  }

  function isTopLevelComp(comp) {
    return !!comp && !isCompUsedAsPrecomp(comp);
  }

  function setActiveCompAsRenderTarget(comp) {
    var currentChanged = false;
    var currentName = '';

    if (comp) {
      currentName = safeString(comp.name);
      if (!hasCompTag(currentName)) {
        comp.name = applyCompTag(currentName);
        currentChanged = true;
      }
    }

    return {
      currentChanged: currentChanged,
      activeCompName: comp ? safeString(comp.name) : ''
    };
  }

  function autoTagActiveCompIfEligible(comp) {
    if (!comp || !isTopLevelComp(comp)) {
      return {
        applied: false,
        skipped: true,
        reason: 'nested-or-missing'
      };
    }

    var result = setActiveCompAsRenderTarget(comp);
    return {
      applied: result.currentChanged,
      skipped: false,
      currentChanged: result.currentChanged,
      activeCompName: result.activeCompName
    };
  }

  function isTextLayer(layer) {
    try {
      if (typeof TextLayer !== 'undefined' && layer instanceof TextLayer) return true;
    } catch (error) {}
    return safeString(layer.matchName) === 'ADBE Text Layer';
  }

  function isShapeLayer(layer) {
    try {
      if (typeof ShapeLayer !== 'undefined' && layer instanceof ShapeLayer) return true;
    } catch (error) {}
    return safeString(layer.matchName) === 'ADBE Vector Layer';
  }

  function isLightLayer(layer) {
    try {
      if (typeof LightLayer !== 'undefined' && layer instanceof LightLayer) return true;
    } catch (error) {}
    return safeString(layer.matchName) === 'ADBE Light Layer';
  }

  function isCameraLayer(layer) {
    try {
      if (typeof CameraLayer !== 'undefined' && layer instanceof CameraLayer) return true;
    } catch (error) {}
    return safeString(layer.matchName) === 'ADBE Camera Layer';
  }

  function isNullLayer(layer) {
    try {
      return !!layer.nullLayer;
    } catch (error) {
      return false;
    }
  }

  function hasLayerAudio(layer) {
    try {
      return !!layer.hasAudio;
    } catch (error) {
      return false;
    }
  }

  function hasLayerVideo(layer) {
    try {
      return !!layer.hasVideo;
    } catch (error) {
      return false;
    }
  }

  function isAudioEnabled(layer) {
    try {
      if (!layer.hasAudio) return false;
      return layer.audioEnabled !== false;
    } catch (error) {
      return false;
    }
  }

  function isVideoEnabled(layer) {
    try {
      if (!layer.hasVideo) return false;
      return layer.enabled !== false;
    } catch (error) {
      return false;
    }
  }

  function getLayerSource(layer) {
    try {
      return layer.source || null;
    } catch (error) {
      return null;
    }
  }

  function isPrecompLayer(layer) {
    var source = getLayerSource(layer);
    try {
      return source && source instanceof CompItem;
    } catch (error) {
      return false;
    }
  }

  function isFootageLayer(layer) {
    var source = getLayerSource(layer);
    try {
      return source && source instanceof FootageItem;
    } catch (error) {
      return false;
    }
  }

  function isSolidLayer(layer) {
    var source = getLayerSource(layer);
    try {
      return source && source.mainSource && source.mainSource instanceof SolidSource;
    } catch (error) {
      return false;
    }
  }

  function isSpeechCandidate(layer) {
    if (isTextLayer(layer) || isShapeLayer(layer) || isCameraLayer(layer) || isLightLayer(layer)) return false;
    if (isPrecompLayer(layer)) return false;
    return hasLayerAudio(layer);
  }

  function getLayerKind(layer) {
    if (isTextLayer(layer)) return 'text';
    if (isShapeLayer(layer)) return 'shape';
    if (isPrecompLayer(layer)) return 'precomp';
    if (isCameraLayer(layer)) return 'camera';
    if (isLightLayer(layer)) return 'light';
    if (isNullLayer(layer)) return 'null';
    if (isSolidLayer(layer)) return 'solid';
    if (isFootageLayer(layer) && hasLayerAudio(layer) && !hasLayerVideo(layer)) return 'audio';
    if (isFootageLayer(layer)) return 'media';
    if (hasLayerAudio(layer) && !hasLayerVideo(layer)) return 'audio';
    if (hasLayerVideo(layer)) return 'media';
    return 'unknown';
  }

  function getKindLabel(kind) {
    if (kind === 'text') return 'Text layer';
    if (kind === 'shape') return 'Shape layer';
    if (kind === 'precomp') return 'Precomp layer';
    if (kind === 'camera') return 'Camera layer';
    if (kind === 'light') return 'Light layer';
    if (kind === 'null') return 'Null layer';
    if (kind === 'solid') return 'Solid layer';
    if (kind === 'audio') return 'Audio layer';
    if (kind === 'media') return 'Media layer';
    return 'Layer';
  }

  function validateLayerForTag(layer, tag) {
    if (tag === 'text') return isTextLayer(layer);
    if (tag === 'speech' || tag === 'speechnosubs') return isSpeechCandidate(layer);
    if (tag === 'speechlink') return validateLayerForSpeechLink(layer);
    if (tag === 'subs') return isTextLayer(layer) || isShapeLayer(layer) || (hasLayerVideo(layer) && !isPrecompLayer(layer));
    // [body] marks a segment, not a media role, so every layer type qualifies —
    // a precomp sitting on the timeline is the common case.
    if (tag === 'body') return true;
    if (tag === 'subscomp') return isPrecompLayer(layer);
    return false;
  }

  function validateLayerForSpeechLink(layer) {
    return isTextLayer(layer) || isSpeechCandidate(layer);
  }

  function buildValidation(selectedLayers, activeComp) {
    var result = {
      text: { allowed: false, reason: 'Select only text layers.' },
      speech: { allowed: false, reason: 'Select only spoken-media layers with audio.' },
      speechnosubs: { allowed: false, reason: 'Select only spoken-media layers with audio.' },
      speechlink: { allowed: false, reason: 'Select text layers and/or spoken-media layers to bind them into one speech-linked group.' },
      subs: { allowed: false, reason: 'Select only subtitle text, shape, or video layers. Precomps must use [subscomp].' },
      subscomp: { allowed: false, reason: 'Select only precomp layers.' },
      body: { allowed: false, reason: 'Select at least one layer to mark as the body segment.' },
      comp: { allowed: false, reason: 'Open a top-level comp to tag it as a render target.' },
      clear: { allowed: false, reason: 'Select at least one tagged layer or open a tagged render comp.' }
    };

    if (activeComp) {
      if (isTopLevelComp(activeComp)) {
        result.comp.allowed = true;
        result.comp.reason = 'Tag the active top-level comp as a render target.';
      } else {
        result.comp.reason = 'Active comp is used as a precomp. Open the top-level render comp to tag [comp].';
      }
    }

    if (!selectedLayers || !selectedLayers.length) {
      if (activeComp && hasCompTag(activeComp.name)) {
        result.clear.allowed = true;
        result.clear.reason = 'Remove [comp] from the active comp.';
      }
      return result;
    }

    var allText = true;
    var allSpeech = true;
    var allSpeechLink = true;
    var allSubs = true;
    var allSubsComp = true;
    var anyTagged = false;
    var i;

    for (i = 0; i < selectedLayers.length; i++) {
      var layer = selectedLayers[i];
      if (!isTextLayer(layer)) allText = false;
      if (!isSpeechCandidate(layer)) allSpeech = false;
      if (!validateLayerForSpeechLink(layer)) allSpeechLink = false;
      if (!(isTextLayer(layer) || isShapeLayer(layer) || (hasLayerVideo(layer) && !isPrecompLayer(layer)))) allSubs = false;
      if (!isPrecompLayer(layer)) allSubsComp = false;
      if (getManagedTag(layer.name) || hasAnySpeechLinkMarkup(layer.name)) anyTagged = true;
    }

    result.text.allowed = allText;
    result.speech.allowed = allSpeech;
    result.speechnosubs.allowed = allSpeech;
    result.speechlink.allowed = allSpeechLink;
    result.subs.allowed = allSubs;
    result.subscomp.allowed = allSubsComp;
    result.body.allowed = true;
    result.body.reason = 'Mark the selected layers as the body segment of the creative.';
    result.clear.allowed = anyTagged || (activeComp && hasCompTag(activeComp.name));

    if (allSpeech) {
      result.speech.reason = 'Speech tagging will resolve to video or audio automatically.';
      result.speechnosubs.reason = 'Speech tagging will localize media but skip generated subtitles.';
    }
    if (allSpeechLink) {
      result.speechlink.reason = 'Use one shared id on one speech/media layer and all text layers that should mirror its localized transcript. Speech Link does not generate subtitles and replaces old localization tags on the selected layers.';
    }

    return result;
  }

  function describeLayerSelection(layer) {
    var kind = getLayerKind(layer);
    var note = '';
    if (kind === 'audio') note = 'Audio-only source';
    else if (kind === 'media' && hasLayerAudio(layer) && !isVideoEnabled(layer) && isAudioEnabled(layer)) note = 'Video off, audio on';
    else if (kind === 'precomp') note = 'Source comp: ' + safeString(getLayerSource(layer).name);

    return {
      name: safeString(layer.name),
      tag: getManagedTag(layer.name),
      speechLinkId: getSpeechLinkId(layer.name),
      kind: kind,
      kindLabel: getKindLabel(kind),
      note: note
    };
  }

  function getSelectionState() {
    try {
      var comp = getActiveComp();
      var selectedLayers = getSelectedLayers();
      var validation = buildValidation(selectedLayers, comp);
      var described = [];
      var taggedSelectionCount = 0;
      var i;

      for (i = 0; i < selectedLayers.length; i++) {
        var layerDesc = describeLayerSelection(selectedLayers[i]);
        if (layerDesc.tag) taggedSelectionCount++;
        described.push(layerDesc);
      }

      return respondOk({
        hasActiveComp: !!comp,
        activeCompName: comp ? safeString(comp.name) : '',
        activeCompTagged: comp ? hasCompTag(comp.name) : false,
        activeCompTopLevel: comp ? isTopLevelComp(comp) : false,
        selectedCount: selectedLayers.length,
        taggedSelectionCount: taggedSelectionCount,
        layers: described,
        validation: validation
      });
    } catch (error) {
      return respondError(error);
    }
  }

  function applyTag(rawArgs) {
    var undoStarted = false;
    try {
      var args = parseArgs(rawArgs);
      var tag = safeString(args.tag).toLowerCase();
      var activeComp = getActiveComp();
      var selectedLayers = getSelectedLayers();
      var validation = buildValidation(selectedLayers, activeComp);
      var i;

      if (!validation[tag] || !validation[tag].allowed) {
        return respondError(validation[tag] ? validation[tag].reason : 'Invalid tag.');
      }

      app.beginUndoGroup('Robert_Vitalik Apply Tag');
      undoStarted = true;
      if (tag === 'comp') {
        if (!activeComp) {
          throw new Error('Open a top-level comp first.');
        }
        setActiveCompAsRenderTarget(activeComp);
      } else {
        for (i = 0; i < selectedLayers.length; i++) {
          selectedLayers[i].name = applyManagedTag(selectedLayers[i].name, tag);
        }
        autoTagActiveCompIfEligible(activeComp);
      }
      app.endUndoGroup();
      undoStarted = false;

      if (tag === 'comp') {
        return respondOk({
          message: 'Tagged active comp as [comp].'
        });
      }

      return respondOk({
        message: 'Applied [' + tag + '] to ' + String(selectedLayers.length) + ' layer' +
          (selectedLayers.length === 1 ? '' : 's') + '.' +
          (activeComp && isTopLevelComp(activeComp) ? ' Active top-level comp is marked [comp].' : '')
      });
    } catch (error) {
      if (undoStarted) {
        try { app.endUndoGroup(); } catch (noop) {}
      }
      return respondError(error);
    }
  }

  function applySpeechLink(rawArgs) {
    var undoStarted = false;
    try {
      var args = parseArgs(rawArgs);
      var activeComp = getActiveComp();
      var selectedLayers = getSelectedLayers();
      var validation = buildValidation(selectedLayers, activeComp);
      var resolution;
      var linkId = '';
      var changedCount = 0;
      var i;

      if (!validation.speechlink || !validation.speechlink.allowed) {
        return respondError(validation.speechlink ? validation.speechlink.reason : 'Invalid speech link selection.');
      }

      if (args && args.id) {
        linkId = sanitizeSpeechLinkId(args.id);
        resolution = { id: linkId, mode: 'manual' };
        if (!linkId) {
          return respondError('Speech link id may use only letters, numbers, "_" and "-".');
        }
      } else {
        resolution = resolveSpeechLinkIdFromSelection(selectedLayers);
        linkId = resolution.id;
      }

      app.beginUndoGroup('Robert_Vitalik Apply Speech Link');
      undoStarted = true;
      for (i = 0; i < selectedLayers.length; i++) {
        var currentName = safeString(selectedLayers[i].name);
        var nextName = applySpeechLinkTag(currentName, linkId);
        if (currentName !== nextName) {
          selectedLayers[i].name = nextName;
          changedCount++;
        }
      }
      autoTagActiveCompIfEligible(activeComp);
      app.endUndoGroup();
      undoStarted = false;

      return respondOk({
        speechLinkId: linkId,
        generated: resolution.mode === 'generated',
        reused: resolution.mode === 'reuse-selected',
        changedCount: changedCount,
        message:
          (resolution.mode === 'generated'
            ? 'Created '
            : resolution.mode === 'reuse-selected'
              ? 'Extended '
              : 'Applied ') +
          '[speechlink:' + linkId + '] on ' + String(selectedLayers.length) + ' layer' +
          (selectedLayers.length === 1 ? '' : 's') + '.'
      });
    } catch (error) {
      if (undoStarted) {
        try { app.endUndoGroup(); } catch (noop) {}
      }
      return respondError(error);
    }
  }

  function clearTag() {
    var undoStarted = false;
    try {
      var activeComp = getActiveComp();
      var selectedLayers = getSelectedLayers();
      var clearedLayerCount = 0;
      var clearedCompTag = false;
      var i;

      if (!selectedLayers.length && !(activeComp && hasCompTag(activeComp.name))) {
        return respondError('Select one or more tagged layers or open a tagged render comp first.');
      }

      app.beginUndoGroup('Robert_Vitalik Clear Tag');
      undoStarted = true;
      for (i = 0; i < selectedLayers.length; i++) {
        var currentName = safeString(selectedLayers[i].name);
        var nextName = stripManagedDecorators(currentName);
        if (currentName !== nextName) {
          selectedLayers[i].name = nextName;
          clearedLayerCount++;
        }
      }
      if (clearedLayerCount === 0 && activeComp && hasCompTag(activeComp.name)) {
        activeComp.name = stripCompTag(activeComp.name);
        clearedCompTag = true;
      }
      app.endUndoGroup();
      undoStarted = false;

      var message = 'No managed Robert_Vitalik tags were found in the selection.';
      if (clearedLayerCount > 0) {
        message = 'Cleared tags from ' + String(clearedLayerCount) + ' layer' +
          (clearedLayerCount === 1 ? '' : 's') + '.';
        if (clearedCompTag) message += ' Cleared [comp] from the active comp.';
      } else if (clearedCompTag) {
        message = 'Cleared [comp] from the active comp.';
      }

      return respondOk({
        message: message
      });
    } catch (error) {
      if (undoStarted) {
        try { app.endUndoGroup(); } catch (noop) {}
      }
      return respondError(error);
    }
  }

  function initTotals() {
    return {
      compItems: 0,
      layers: 0,
      precompLayers: 0,
      textLayers: 0,
      shapeLayers: 0,
      mediaLayers: 0,
      taggedLayers: 0,
      textLocalize: 0,
      speech: 0,
      deleteLayers: 0
    };
  }

  function initTaggedTotals() {
    return {
      comp: 0,
      text: 0,
      speech: 0,
      speechnosubs: 0,
      speechlink: 0,
      subs: 0,
      subscomp: 0,
      body: 0
    };
  }

  function initResolvedActions() {
    return {
      renderComp: 0,
      textLocalize: 0,
      speechVideo: 0,
      speechAudio: 0,
      speechNoSubsVideo: 0,
      speechNoSubsAudio: 0,
      speechLinkedText: 0,
      speechLinkedMedia: 0,
      deleteSubs: 0,
      deleteSubsComp: 0,
      markBody: 0,
      taggedDisabled: 0
    };
  }

  function pushWarning(warnings, message) {
    warnings.push(String(message));
  }

  function layerPath(comp, layer) {
    return safeString(comp.name) + ' > ' + safeString(layer.name);
  }

  function analyzeTaggedLayer(comp, layer, taggedTotals, resolvedActions, warnings, reachableTotals) {
    var tag = getManagedTag(layer.name);
    var path = layerPath(comp, layer);
    if (!tag) return;

    if (taggedTotals) {
      taggedTotals[tag] = (taggedTotals[tag] || 0) + 1;
    }
    if (reachableTotals) reachableTotals.taggedLayers++;

    if (!validateLayerForTag(layer, tag)) {
      if (warnings) pushWarning(warnings, path + ' has invalid tag/type pairing [' + tag + '].');
      return;
    }

    if (tag === 'speechlink') {
      if (isTextLayer(layer)) {
        if (resolvedActions) resolvedActions.speechLinkedText++;
        return;
      }
      if (reachableTotals) reachableTotals.speech++;
      if (!hasLayerAudio(layer)) {
        if (warnings) pushWarning(warnings, path + ' is tagged [speechlink] but has no audio capability.');
        return;
      }
      if (!isAudioEnabled(layer)) {
        if (resolvedActions) resolvedActions.taggedDisabled++;
        if (warnings) pushWarning(warnings, path + ' is tagged [speechlink] but audio is disabled.');
        return;
      }
      if (resolvedActions) resolvedActions.speechLinkedMedia++;
      return;
    }

    if (tag === 'text') {
      if (resolvedActions) resolvedActions.textLocalize++;
      if (reachableTotals) reachableTotals.textLocalize++;
      return;
    }

    if (tag === 'body') {
      if (resolvedActions) resolvedActions.markBody++;
      return;
    }

    if (tag === 'subs') {
      if (resolvedActions) resolvedActions.deleteSubs++;
      if (reachableTotals) reachableTotals.deleteLayers++;
      return;
    }

    if (tag === 'subscomp') {
      if (resolvedActions) resolvedActions.deleteSubsComp++;
      if (reachableTotals) reachableTotals.deleteLayers++;
      return;
    }

    if (tag === 'speech' || tag === 'speechnosubs') {
      if (reachableTotals) reachableTotals.speech++;
      if (!hasLayerAudio(layer)) {
        if (warnings) pushWarning(warnings, path + ' is tagged [' + tag + '] but has no audio capability.');
        return;
      }
      if (!isAudioEnabled(layer)) {
        if (resolvedActions) resolvedActions.taggedDisabled++;
        if (warnings) pushWarning(warnings, path + ' is tagged [' + tag + '] but audio is disabled.');
        return;
      }
      if (hasLayerVideo(layer) && isVideoEnabled(layer)) {
        if (resolvedActions) {
          if (tag === 'speechnosubs') resolvedActions.speechNoSubsVideo++;
          else resolvedActions.speechVideo++;
        }
      } else {
        if (resolvedActions) {
          if (tag === 'speechnosubs') resolvedActions.speechNoSubsAudio++;
          else resolvedActions.speechAudio++;
        }
      }
    }
  }

  function analyzeCompLayers(comp, projectTotals, taggedTotals, resolvedActions, warnings) {
    var layerIdx;
    projectTotals.compItems++;
    if (hasCompTag(comp.name)) {
      taggedTotals.comp++;
      if (resolvedActions) resolvedActions.renderComp++;
      if (!isTopLevelComp(comp)) {
        pushWarning(warnings, safeString(comp.name) + ' is tagged [comp] but is used as a precomp.');
      }
    }
    for (layerIdx = 1; layerIdx <= comp.numLayers; layerIdx++) {
      var layer = comp.layer(layerIdx);
      var kind = getLayerKind(layer);
      projectTotals.layers++;
      if (kind === 'precomp') projectTotals.precompLayers++;
      else if (kind === 'text') projectTotals.textLayers++;
      else if (kind === 'shape') projectTotals.shapeLayers++;
      else if (kind === 'media' || kind === 'audio') projectTotals.mediaLayers++;

      analyzeTaggedLayer(comp, layer, taggedTotals, resolvedActions, warnings, null);
    }
  }

  function traverseReachableComp(comp, totals, taggedTotals, resolvedActions, warnings, visited) {
    if (!comp) return;
    var compKey = String(comp.id || comp.name);
    if (visited[compKey]) return;
    visited[compKey] = true;
    totals.compItems++;

    for (var layerIdx = 1; layerIdx <= comp.numLayers; layerIdx++) {
      var layer = comp.layer(layerIdx);
      var kind = getLayerKind(layer);
      totals.layers++;
      if (kind === 'precomp') totals.precompLayers++;
      else if (kind === 'text') totals.textLayers++;
      else if (kind === 'shape') totals.shapeLayers++;
      else if (kind === 'media' || kind === 'audio') totals.mediaLayers++;

      analyzeTaggedLayer(comp, layer, null, null, null, totals);

      if (isPrecompLayer(layer)) {
        traverseReachableComp(getLayerSource(layer), totals, taggedTotals, resolvedActions, warnings, visited);
      }
    }
  }

  function analyzeProject() {
    try {
      var projectTotals = initTotals();
      var taggedTotals = initTaggedTotals();
      var resolvedActions = initResolvedActions();
      var warnings = [];
      var project = app.project;
      var i;

      if (!project) {
        return respondError('No project is open.');
      }

      for (i = 1; i <= project.numItems; i++) {
        var item = project.item(i);
        if (!(item instanceof CompItem)) continue;
        analyzeCompLayers(item, projectTotals, taggedTotals, resolvedActions, warnings);
      }

      if (taggedTotals.comp === 0) {
        pushWarning(warnings, 'No comp is tagged [comp]. Tag every real final render comp.');
      }

      var activeComp = getActiveComp();
      var activeCompReachable = null;
      if (activeComp) {
        activeCompReachable = initTotals();
        traverseReachableComp(activeComp, activeCompReachable, taggedTotals, resolvedActions, warnings, {});
      }

      return respondOk({
        analysis: {
          projectTotals: projectTotals,
          taggedTotals: taggedTotals,
          resolvedActions: resolvedActions,
          activeCompReachable: activeCompReachable,
          warningCount: warnings.length,
          warningsPreview: warnings.slice(0, WARNING_PREVIEW_LIMIT)
        }
      });
    } catch (error) {
      return respondError(error);
    }
  }

  function ping() {
    return respondOk({ message: 'pong' });
  }

  $.global.RobertVitalik = {
    ping: ping,
    getSelectionState: getSelectionState,
    applyTag: applyTag,
    applySpeechLink: applySpeechLink,
    clearTag: clearTag,
    analyzeProject: analyzeProject
  };
})();

// ============================================================================
// HOOK RENDER — RENAMER 2.3 engine, grafted onto the Robert_Vitalik host API.
//
// Renders the SELECTED layers of the active comp into a single H.264 MP4 via
// the NATIVE AE render queue (template-only, no ffmpeg), names it by the
// Renamer convention HOOK-{variation}-{N}-{project}.mp4, and places it as a
// new layer above the topmost selected layer. The original timeline is
// untouched — the source layers are only muted (eye + speaker off).
//
// This is a self-contained IIFE. It shares nothing with the tagging closure
// above except the $.global.RobertVitalik namespace, which it EXTENDS (never
// replaces) so both feature sets live behind one bridge and panel.js can keep
// using its existing callHost() contract: every entry point returns
// { ok: true, ... } or { ok: false, error: "..." }.
//
// Tag awareness is the reason the two tools fit together: Robert_Vitalik writes tags
// like "NAME [speech]" onto layers and "[comp]" onto the render comp, and this
// engine strips every [...] chunk before parsing names or matching existing
// clip numbers. A tagged layer therefore still occupies its number instead of
// silently resetting the counter back to 1.
// ============================================================================
(function () {
  var HIT_CAP = 300;

  // ---------------------------------------------------------------------
  // Local JSON serializer. ExtendScript has no native JSON, and Robert_Vitalik's
  // serializer lives inside its own closure, so this module carries its own.
  // ---------------------------------------------------------------------
  function quoteJson(value) {
    var text = value === null || value === undefined ? '' : String(value);
    var out = '"';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      var code = text.charCodeAt(i);
      if (ch === '"' || ch === '\\') out += '\\' + ch;
      else if (ch === '\b') out += '\\b';
      else if (ch === '\f') out += '\\f';
      else if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else if (code < 32) {
        var hex = code.toString(16);
        while (hex.length < 4) hex = '0' + hex;
        out += '\\u' + hex;
      } else out += ch;
    }
    return out + '"';
  }

  function toJson(value) {
    var type = typeof value;
    var parts = [];
    var i, key;
    if (value === null) return 'null';
    if (type === 'string') return quoteJson(value);
    if (type === 'number') return isFinite(value) ? String(value) : 'null';
    if (type === 'boolean') return value ? 'true' : 'false';
    if (type === 'undefined' || type === 'function') return 'null';
    if (Object.prototype.toString.call(value) === '[object Array]') {
      for (i = 0; i < value.length; i++) parts.push(toJson(value[i]));
      return '[' + parts.join(',') + ']';
    }
    for (key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        parts.push(quoteJson(key) + ':' + toJson(value[key]));
      }
    }
    return '{' + parts.join(',') + '}';
  }

  function ok(payload) {
    payload = payload || {};
    payload.ok = true;
    return toJson(payload);
  }

  function fail(message) {
    return toJson({ ok: false, error: String(message || 'Unknown error.') });
  }

  // ---------------------------------------------------------------------
  // Tag stripping
  // Every "[...]" chunk is Robert_Vitalik metadata, not part of the name. It has to
  // go before we parse a comp name AND before we look for existing HOOK-…
  // numbers, otherwise "11733_1 [comp]" fails to parse and
  // "HOOK-4-1-11733.mp4 [speech]" stops being recognised as a used number.
  // ---------------------------------------------------------------------
  function stripTags(s) {
    var out = String(s);
    for (var pass = 0; pass < 4; pass++) {
      var next = out.replace(/\[[^\[\]]*\]/g, ' ');
      if (next === out) break;
      out = next;
    }
    out = out.replace(/\s+/g, ' ');
    return out.replace(/^\s+|\s+$/g, '');
  }

  function trim(s) { return String(s).replace(/^\s+|\s+$/g, ''); }

  // ---------------------------------------------------------------------
  // Comp-name parsing — tag-aware.
  // "11733_1", "11733_1 [comp]", "[comp] 1_11733" and the long FitMe form
  // "11167_4_fMIL_10761_gF_…_Clean [comp]" all resolve.
  // ---------------------------------------------------------------------
  function isProjectToken(t)   { return /^\d{4,6}$/.test(t); }
  function isVariationToken(t) { return /^\d{1,2}$/.test(t); }

  function parseCompName(name) {
    var clean = stripTags(name);
    // "_" is the convention, but a stripped tag can leave a stray space and
    // some comps use "-", so treat all three as the same separator.
    var raw = clean.split(/[_\s\-]+/);
    var tokens = [];
    for (var i = 0; i < raw.length; i++) {
      var t = trim(raw[i]);
      if (t !== '') tokens.push(t);
    }
    if (tokens.length < 2) return null;

    var t0 = tokens[0], t1 = tokens[1];
    if (isProjectToken(t0) && isVariationToken(t1)) return { project: t0, variation: t1 };
    if (isVariationToken(t0) && isProjectToken(t1)) return { project: t1, variation: t0 };

    // fallback: first adjacent project/variation pair anywhere in the name
    for (var k = 0; k < tokens.length - 1; k++) {
      var a = tokens[k], b = tokens[k + 1];
      if (isProjectToken(a) && isVariationToken(b)) return { project: a, variation: b };
      if (isVariationToken(a) && isProjectToken(b)) return { project: b, variation: a };
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Counter discovery — ONE scan, with provenance.
  //
  // A rendered hook is uniquely identified by HOOK-{variation}-{N}-{project},
  // so the project id already scopes the numbering: creative 12333 starts at 1
  // again even when 11733 is at 5.
  //
  // SCOPE decides how far the search reaches:
  //   "comp"    — layers of the active comp only (what you see on the timeline)
  //   "project" — + every other comp's layers, every project item, every
  //               footage source filename (things AE knows but you don't see)
  //   "all"     — + every file in the .aep folder and its immediate subfolders
  //
  // Every hit records where it came from, so the diagnostic can name the exact
  // file that pushed the counter up. Render and diagnostic share this code
  // path, so the two can never disagree.
  // ---------------------------------------------------------------------
  function hookRe(variation, project) {
    // separator before N and before the project id may be "-", "_" or a space;
    // the lookahead stops "11167" from matching inside "111670"
    return new RegExp('HOOK[-_ ]?' + variation + '[-_ ](\\d{1,4})[-_ ]' + project + '(?![0-9])', 'gi');
  }

  // max N inside one string, or 0 when it holds no matching name
  function scanName(s, variation, project) {
    if (s === null || s === undefined) return 0;
    var clean = stripTags(s);
    if (clean === '') return 0;
    var re = hookRe(variation, project), m, cur = 0;
    while ((m = re.exec(clean)) !== null) {
      var v = parseInt(m[1], 10);
      if (!isNaN(v) && v > cur) cur = v;
      if (re.lastIndex === m.index) re.lastIndex++;   // zero-width guard
    }
    return cur;
  }

  function fileNameOf(f) {
    var n = '';
    try { n = decodeURI(f.name); } catch (e) { try { n = String(f.name); } catch (e2) { n = ''; } }
    return n;
  }

  function pushHit(hits, where, name, variation, project) {
    var n = scanName(name, variation, project);
    if (n > 0 && hits.length < HIT_CAP) {
      hits.push({ where: String(where), name: String(name), n: n });
    }
    return n;
  }

  function hitsFromComp(hits, c, where, variation, project) {
    try {
      for (var i = 1; i <= c.numLayers; i++) {
        var L = c.layer(i);
        var fromLayer = 0;
        try { fromLayer = pushHit(hits, where, String(L.name), variation, project); } catch (e1) {}
        // a layer can be renamed while its source keeps the real filename;
        // only record the source when the layer name itself said nothing
        if (fromLayer === 0) {
          try {
            if (L.source && L.source.name) {
              pushHit(hits, where + ' (source)', String(L.source.name), variation, project);
            }
          } catch (e2) {}
        }
      }
    } catch (e) {}
  }

  // depth 1 = the output folder plus its immediate subfolders (the pipeline
  // moves finished mp4s into per-type folders and those names must still
  // count). budget caps the walk so a project sitting next to a huge footage
  // library cannot hang the panel.
  function hitsFromFolder(hits, folder, prefix, variation, project, depth, budget) {
    if (!folder || budget.n <= 0) return;
    var list = null;
    try { list = folder.getFiles(); } catch (e) { return; }
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      if (budget.n <= 0) return;
      budget.n--;
      var f = list[i];
      var isFolder = false;
      try { isFolder = (f instanceof Folder); } catch (eF) {}
      var nm = fileNameOf(f);
      if (isFolder) {
        if (depth > 0 && nm.charAt(0) !== '.') {
          hitsFromFolder(hits, f, prefix + nm + '/', variation, project, depth - 1, budget);
        }
        continue;
      }
      pushHit(hits, 'disk: ' + (prefix === '' ? '.aep folder' : prefix), nm, variation, project);
    }
  }

  function collectHits(comp, variation, project, outDir, scope) {
    var hits = [];

    // 1) the active comp's own layers — always
    hitsFromComp(hits, comp, 'comp layer', variation, project);
    if (scope === 'comp') return hits;

    // 2) everything AE knows: project items, footage filenames, other comps
    try {
      var items = app.project.items;
      for (var i = 1; i <= items.length; i++) {
        var it = null;
        try { it = items[i]; } catch (eG) { continue; }
        if (!it) continue;
        var isThisComp = false;
        try { isThisComp = (it instanceof CompItem && it.id === comp.id); } catch (eC) {}
        if (isThisComp) continue;

        var fromItem = 0;
        try { fromItem = pushHit(hits, 'Project panel', String(it.name), variation, project); } catch (e1) {}
        if (fromItem === 0) {
          try {
            if (it instanceof FootageItem && it.mainSource && it.mainSource.file) {
              pushHit(hits, 'Project panel (file)', fileNameOf(it.mainSource.file), variation, project);
            }
          } catch (e2) {}
        }
        try {
          if (it instanceof CompItem) {
            hitsFromComp(hits, it, 'comp "' + String(it.name).substr(0, 28) + '"', variation, project);
          }
        } catch (e3) {}
      }
    } catch (eI) {}
    if (scope === 'project') return hits;

    // 3) files already sitting on disk next to the .aep
    try { hitsFromFolder(hits, outDir, '', variation, project, 1, { n: 8000 }); } catch (eD) {}
    return hits;
  }

  function maxOf(hits) {
    var m = 0;
    for (var i = 0; i < hits.length; i++) { if (hits[i].n > m) m = hits[i].n; }
    return m;
  }

  // hits sorted by N desc, deduplicated — for the diagnostic report
  function topHits(hits, limit) {
    var copy = [];
    for (var i = 0; i < hits.length; i++) copy.push(hits[i]);
    copy.sort(function (a, b) { return b.n - a.n; });
    var out = [], seen = {};
    for (var k = 0; k < copy.length && out.length < limit; k++) {
      var key = copy[k].name + '|' + copy[k].where;
      if (seen[key]) continue;
      seen[key] = true;
      out.push(copy[k]);
    }
    return out;
  }

  function normScope(scope) {
    var s = String(scope || 'all').toLowerCase();
    // panel.js may hand this over as a bare string or as a tiny JSON blob;
    // pull the first known keyword out either way
    if (s.indexOf('comp') !== -1 && s.indexOf('project') === -1) return 'comp';
    if (s.indexOf('project') !== -1) return 'project';
    return 'all';
  }

  // ---------------------------------------------------------------------
  // utils
  // ---------------------------------------------------------------------
  function round1(x) { return Math.round(x * 10) / 10; }

  function activeComp() {
    try {
      if (app && app.project && app.project.activeItem &&
          app.project.activeItem instanceof CompItem) {
        return app.project.activeItem;
      }
    } catch (e) {}
    return null;
  }

  function outDirOf() {
    var dir = null;
    try { if (app.project.file) dir = app.project.file.parent; } catch (e) {}
    if (!dir) dir = Folder.temp;
    return dir;
  }

  // Next free name: max found + 1, then walk forward past anything that
  // already exists on disk. Never reuses a number, never overwrites a file.
  function nextName(variation, project, maxN, outDir) {
    var counter = maxN + 1;
    var name = 'HOOK-' + variation + '-' + counter + '-' + project + '.mp4';
    var guard = 0;
    while (new File(outDir.fsName + '/' + name).exists && guard < 999) {
      counter++; guard++;
      name = 'HOOK-' + variation + '-' + counter + '-' + project + '.mp4';
    }
    return { counter: counter, name: name };
  }

  // ---------------------------------------------------------------------
  // H.264 output template (template-only — setSettings pops modal dialogs).
  // Case, spaces, dashes and dots are all sources of near-miss mismatches
  // ("10 Mbs" vs "10Mbs" vs "10mbps"), so names are normalized before compare.
  // ---------------------------------------------------------------------
  function normTpl(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  // Team templates are hand-made on each machine, so spelling drifts
  // ("LowCosRender" / "LowCostRender", dashes or spaces). Match on the stem.
  function isTeamTpl(name) {
    var n = normTpl(name);
    return n.indexOf('lowcos') !== -1 || n.indexOf('renamerh264') !== -1 ||
           n.indexOf('prepailerh264') !== -1;
  }

  // "H.264" and "H264" are the same codec written two ways.
  function isH264(name) { return normTpl(name).indexOf('h264') !== -1; }

  // Read the bitrate out of a template name ("... - 15 Mbps" -> 15).
  function tplBitrate(name) {
    var m = String(name).match(/(\d+(?:[.,]\d+)?)\s*mb(?:p)?s/i);
    if (!m) return null;
    var v = parseFloat(String(m[1]).replace(',', '.'));
    return isNaN(v) ? null : v;
  }

  function applyH264(om) {
    var preferred = ['LowCosRender-H264-10Mbps', 'LowCosRender H264 10Mbps',
                     'LowCostRender H264 10Mbs', 'RENAMER H264 10Mbps',
                     'Prepailer H264 10Mbps'];
    var templates = [];
    try { templates = om.templates; } catch (e) {}

    var list = [];
    for (var li = 0; li < templates.length; li++) list.push(String(templates[li]));
    var applyErr = null;

    // 0) the template already applied (the user's Movie Default) may well be
    // the right one — if it is, leave it alone rather than overriding it.
    var cur = null;
    try { cur = String(om.name); } catch (eN) {}
    if (cur && (isTeamTpl(cur) || (tplBitrate(cur) !== null && tplBitrate(cur) <= 10))) {
      return { name: cur, safe: true, list: list };
    }

    // 1) preferred names, ignoring case / spaces / punctuation
    for (var w = 0; w < preferred.length; w++) {
      var key = normTpl(preferred[w]);
      for (var t = 0; t < list.length; t++) {
        if (normTpl(list[t]) === key) {
          try { om.applyTemplate(list[t]); return { name: list[t], safe: true, list: list }; }
          catch (e2) { applyErr = 'applyTemplate("' + list[t] + '"): ' + e2.message; }
        }
      }
    }
    // 2) anything that still looks like one of our team templates
    for (var t3 = 0; t3 < list.length; t3++) {
      if (isTeamTpl(list[t3])) {
        try { om.applyTemplate(list[t3]); return { name: list[t3], safe: true, list: list }; }
        catch (e4) { applyErr = 'applyTemplate("' + list[t3] + '"): ' + e4.message; }
      }
    }
    // 3) no team template here — pick by bitrate. Best = the heaviest H.264
    // preset still at or under our 10 Mbps ceiling (built-ins are 5 / 15 / 40,
    // so this lands on 5 Mbps).
    var best = null, bestBr = -1, lightest = null, lightestBr = null;
    for (var t4 = 0; t4 < list.length; t4++) {
      if (!isH264(list[t4])) continue;
      var br = tplBitrate(list[t4]);
      if (br === null) continue;
      if (br <= 10 && br > bestBr) { best = list[t4]; bestBr = br; }
      if (lightestBr === null || br < lightestBr) { lightest = list[t4]; lightestBr = br; }
    }
    if (best) {
      try { om.applyTemplate(best); return { name: best, safe: true, list: list, applyErr: applyErr }; }
      catch (e5) { applyErr = 'applyTemplate("' + best + '"): ' + e5.message; }
    }
    // 4) everything available is above 10 Mbps — take the lightest and flag it
    if (lightest) {
      try { om.applyTemplate(lightest); return { name: lightest, safe: false, list: list, applyErr: applyErr }; }
      catch (e6) {}
    }
    // 5) last resort: any H.264 template at all, bitrate unknown
    for (var t2 = 0; t2 < list.length; t2++) {
      if (isH264(list[t2])) {
        try { om.applyTemplate(list[t2]); return { name: list[t2], safe: false, list: list, applyErr: applyErr }; }
        catch (e3) {}
      }
    }
    return null;
  }

  function restoreQueue(savedFlags, suppressing) {
    for (var s = 0; s < savedFlags.length; s++) {
      try { savedFlags[s].item.render = savedFlags[s].flag; } catch (e) {}
    }
    if (suppressing) { try { app.endSuppressDialogs(false); } catch (e2) {} }
  }

  // ---------------------------------------------------------------------
  // Diagnostic: output-module templates AE knows about. Nothing is rendered.
  // Needs a render-queue item to read om.templates, so it uses a throwaway
  // comp and cleans both up.
  // ---------------------------------------------------------------------
  function listRenderTemplates() {
    var tempComp = null, rqItem = null;
    try {
      tempComp = app.project.items.addComp('__HOOK_TPL_PROBE', 64, 64, 1, 1, 24);
      rqItem = app.project.renderQueue.items.add(tempComp);
      try { rqItem.render = false; } catch (eR) {}
      var om = rqItem.outputModule(1);
      var templates = om.templates;
      var list = [];
      for (var i = 0; i < templates.length; i++) list.push(String(templates[i]));
      try { rqItem.remove(); } catch (e1) {}
      try { tempComp.remove(); } catch (e2) {}
      return ok({ templates: list });
    } catch (error) {
      try { if (rqItem)   rqItem.remove();   } catch (x1) {}
      try { if (tempComp) tempComp.remove(); } catch (x2) {}
      return fail(error);
    }
  }

  // ---------------------------------------------------------------------
  // Diagnostic: what name would the NEXT render get, and WHERE did the number
  // come from. Read-only — nothing is created, imported or rendered.
  // ---------------------------------------------------------------------
  function diagnoseHookNames(rawScope) {
    try {
      var scope = normScope(rawScope);
      var comp = activeComp();
      if (!comp) return fail('Open a comp first.');

      var parsed = parseCompName(comp.name);
      if (!parsed) {
        return fail('Cannot read the comp name: "' + comp.name +
                    '". With [tags] removed it reads "' + stripTags(comp.name) +
                    '". Expected a project id (4-6 digits) and a variation (1-2 digits).');
      }

      var outDir = outDirOf();
      var hits   = collectHits(comp, parsed.variation, parsed.project, outDir, scope);
      var maxN   = maxOf(hits);
      var next   = nextName(parsed.variation, parsed.project, maxN, outDir);

      // how far each scope level reaches — makes the culprit obvious
      var compHits = collectHits(comp, parsed.variation, parsed.project, outDir, 'comp');
      var projHits = (scope === 'comp') ? [] :
                     collectHits(comp, parsed.variation, parsed.project, outDir, 'project');

      return ok({
        scope: scope,
        compName: String(comp.name),
        cleanName: stripTags(comp.name),
        project: parsed.project,
        variation: parsed.variation,
        maxComp: maxOf(compHits),
        maxProject: (scope === 'comp') ? null : maxOf(projHits),
        maxFound: maxN,
        counter: next.counter,
        outName: next.name,
        hitCount: hits.length,
        hits: topHits(hits, 25),
        outDir: outDir.fsName
      });
    } catch (error) {
      return fail(error);
    }
  }

  // ---------------------------------------------------------------------
  // MAIN — render the selected layers to mp4 (native RQ) and place the layer
  // ---------------------------------------------------------------------
  function renderHook(rawScope) {
    var tempComp = null, rqItem = null, savedFlags = [], suppressing = false, undoOpen = false;
    try {
      var scope = normScope(rawScope);
      var comp = activeComp();
      if (!comp) return fail('Open a comp first.');

      var parsed = parseCompName(comp.name);
      if (!parsed) {
        return fail('Cannot read the comp name: "' + comp.name +
                    '". With [tags] removed it reads "' + stripTags(comp.name) +
                    '". Expected a project id (4-6 digits) and a variation (1-2 digits).');
      }

      var sel = comp.selectedLayers;
      if (!sel || sel.length === 0) {
        return fail('No layers selected. Select the hook video layers on the timeline.');
      }

      // span = [earliest edge .. latest edge] of the selection.
      // NOTE: a time-reversed layer (stretch = -100) reports inPoint > outPoint
      // because its first source frame sits at the END of the visible range.
      // Normalize per layer with min/max, otherwise reversed clips shrink the
      // span and fall outside the temp comp — they would silently not render.
      var earliestIn = null, latestOut = null, topIndex = null;
      for (var i = 0; i < sel.length; i++) {
        var L = sel[i];
        var lStart = Math.min(L.inPoint, L.outPoint);
        var lEnd   = Math.max(L.inPoint, L.outPoint);
        if (earliestIn === null || lStart < earliestIn) earliestIn = lStart;
        if (latestOut === null || lEnd   > latestOut)   latestOut  = lEnd;
        if (topIndex   === null || L.index < topIndex)  topIndex   = L.index;
      }
      var spanDur = latestOut - earliestIn;
      if (spanDur <= 0) return fail('The selection has zero duration.');
      if (spanDur > 30.0 + 1e-4) {
        return fail('The selected clips span ' + round1(spanDur) +
                    's, over the 30s limit. Select fewer clips.');
      }

      // output dir: next to the .aep (the pipeline reads by name); else OS temp
      var outDir = outDirOf();

      // next counter — the same scan the diagnostic uses, so they cannot disagree
      var hits = collectHits(comp, parsed.variation, parsed.project, outDir, scope);
      var maxN = maxOf(hits);
      var next = nextName(parsed.variation, parsed.project, maxN, outDir);
      var counter = next.counter;
      var outName = next.name;
      var finalFile = new File(outDir.fsName + '/' + outName);

      // what pushed the counter this high — reported back for the status line
      var topHit = null;
      var th = topHits(hits, 1);
      if (th.length > 0) topHit = th[0];

      // temp comp: same frame size, forced 24 fps, duration = span
      tempComp = app.project.items.addComp('__HOOK_TMP_' + comp.id + '_' + counter,
                                           comp.width, comp.height, comp.pixelAspect, spanDur, 24);

      // copy the selection BOTTOM-UP to preserve stacking, shifting so the
      // earliest in-point lands on 0
      var order = [];
      for (var s2 = 0; s2 < sel.length; s2++) order.push(sel[s2]);
      order.sort(function (a, b) { return b.index - a.index; });
      for (var k = 0; k < order.length; k++) {
        var wantStart = Math.min(order[k].inPoint, order[k].outPoint) - earliestIn;
        order[k].copyToComp(tempComp);
        var copied = tempComp.layer(1);
        try {
          copied.startTime = copied.startTime - earliestIn;
          // startTime semantics differ under negative stretch, so don't trust
          // the shift — measure where the layer actually landed and correct.
          var gotStart = Math.min(copied.inPoint, copied.outPoint);
          if (Math.abs(gotStart - wantStart) > 0.001) {
            copied.startTime = copied.startTime + (wantStart - gotStart);
          }
        } catch (eSh) {}
      }

      // render ONLY our item: park every other queue flag, restore it after
      var rq = app.project.renderQueue;
      for (var q = 1; q <= rq.numItems; q++) {
        var rqi = rq.item(q), fl = false;
        try { fl = rqi.render; } catch (eF) {}
        savedFlags.push({ item: rqi, flag: fl });
        try { rqi.render = false; } catch (eF2) {}
      }
      try { app.beginSuppressDialogs(); suppressing = true; } catch (eSup) {}

      rqItem = rq.items.add(tempComp);
      var om = rqItem.outputModule(1);
      var tpl = applyH264(om);
      if (!tpl) {
        try { rqItem.remove(); } catch (e1) {}
        try { tempComp.remove(); } catch (e2) {}
        restoreQueue(savedFlags, suppressing);
        return fail('No H.264 output template found. Load "LowCostRender H264 10Mbs" via Edit > Templates > Output Module... > Load...');
      }
      om.file = finalFile;
      var actualPath = om.file.fsName;
      try { rqItem.render = true; } catch (eRf) {}
      rq.render();

      var done = false;
      try { done = (rqItem.status === RQItemStatus.DONE); } catch (eD) {}
      try { rqItem.remove(); } catch (e3) {}

      var outF = new File(actualPath);
      if (!outF.exists) {
        // some templates append their own extension — find what actually landed
        var stem = outName.replace(/\.mp4$/i, '');
        var files = outDir.getFiles(stem + '.*');
        if (files && files.length > 0) {
          files.sort(function (a, b) { return b.modified - a.modified; });
          outF = files[0]; actualPath = outF.fsName; done = true;
        }
      }
      try { tempComp.remove(); } catch (e4) {}
      restoreQueue(savedFlags, suppressing);

      if (!(done && outF.exists)) {
        return fail('Render did not finish (no mp4 was written). Template: ' + tpl.name);
      }

      // import and place above the topmost selected layer
      app.beginUndoGroup('Robert_Vitalik — HOOK render'); undoOpen = true;
      var item = app.project.importFile(new ImportOptions(outF));
      var anchor = null;
      try { anchor = comp.layer(topIndex); } catch (eA) {}
      var nl = comp.layers.add(item);
      if (anchor) { try { nl.moveBefore(anchor); } catch (eMv) {} }
      try { nl.startTime = earliestIn; } catch (eST) {}
      try { nl.name = outName; } catch (eNm) {}

      // neutralize the originals so they don't conflict with the baked clip:
      // eye off (video) + speaker off (audio) — both are needed to fully mute
      for (var mi = 0; mi < sel.length; mi++) {
        try { sel[mi].enabled = false; } catch (eEn) {}
        try { if (sel[mi].hasAudio) sel[mi].audioEnabled = false; } catch (eAu) {}
      }

      app.endUndoGroup(); undoOpen = false;

      return ok({
        scope: scope,
        outName: outName,
        spanDur: spanDur,
        template: tpl.name,
        templateSafe: tpl.safe,
        templateList: tpl.safe ? null : tpl.list,
        templateApplyErr: tpl.applyErr ? tpl.applyErr : null,
        counter: counter,
        maxFound: maxN,
        topHitWhere: topHit ? topHit.where : null,
        topHitName:  topHit ? topHit.name  : null,
        project: parsed.project,
        variation: parsed.variation,
        outPath: actualPath
      });

    } catch (error) {
      try { if (rqItem)   rqItem.remove();   } catch (x1) {}
      try { if (tempComp) tempComp.remove(); } catch (x2) {}
      restoreQueue(savedFlags, suppressing);
      if (undoOpen) { try { app.endUndoGroup(); } catch (x3) {} }
      return fail(error && error.message ? error.message : String(error));
    }
  }

  // EXTEND the namespace, never replace it — the tagging IIFE above has
  // already populated $.global.RobertVitalik and its methods must survive.
  if (!$.global.RobertVitalik) $.global.RobertVitalik = {};
  $.global.RobertVitalik.renderHook = renderHook;
  $.global.RobertVitalik.diagnoseHookNames = diagnoseHookNames;
  $.global.RobertVitalik.listRenderTemplates = listRenderTemplates;
})();



/* ======================================================================== *
 * module: org.jsx
 * ======================================================================== */

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
    // Current wording inserted by Motion > Disclaimer (FitMe Studio 1.3.2+)
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
