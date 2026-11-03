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
