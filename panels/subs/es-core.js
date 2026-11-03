// es-core.js — safe string helpers + ExtendScript JSON shim and comp resolver.
// Extracted unchanged from v2.4: proven code, do not rewrite casually.

// ==================== SAFE STRING OPERATIONS ====================
// ИСПРАВЛЕНИЕ: Безопасная функция trim для Mac
function safeTrim(str) {
    if (str === null || str === undefined || typeof str !== 'string') {
        return '';
    }
    // Удаляем BOM (Byte Order Mark) - проблема на Mac
    str = str.replace(/^\uFEFF/, '');
    return str.trim();
}

function safeString(str) {
    return (str === null || str === undefined) ? '' : String(str);
}

function safeParseJSON(value, fallbackValue) {
    try {
        return JSON.parse(value);
    } catch (e) {
        return fallbackValue;
    }
}

function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
}

// ==================== EXTENDSCRIPT JSON SHIM ====================
// ExtendScript does NOT have native JSON. Without this shim, JSON.stringify/parse
// will fail on some AE installations where no other panel has loaded a polyfill.
// Every evalScript call MUST be wrapped with this shim for reliability.

const EXTENDSCRIPT_JSON_SHIM = `
(function() {
    if (typeof JSON === 'undefined') {
        JSON = {};
    }

    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function(value) {
            var type = typeof value;
            if (type === 'undefined') {
                return undefined;
            }
            if (type === 'string') {
                return '"' + value
                    .replace(/\\\\/g, '\\\\\\\\')
                    .replace(/"/g, '\\"')
                    .replace(/\\n/g, '\\\\n')
                    .replace(/\\r/g, '\\\\r')
                    .replace(/\\t/g, '\\\\t') + '"';
            }
            if (type === 'number' || type === 'boolean') {
                return String(value);
            }
            if (value === null) {
                return 'null';
            }
            if (value instanceof Array) {
                var arrResult = [];
                for (var i = 0; i < value.length; i++) {
                    var item = JSON.stringify(value[i]);
                    arrResult.push(item === undefined ? 'null' : item);
                }
                return '[' + arrResult.join(',') + ']';
            }
            if (type === 'object') {
                var objResult = [];
                for (var key in value) {
                    if (value.hasOwnProperty(key)) {
                        var serialized = JSON.stringify(value[key]);
                        if (serialized !== undefined) {
                            objResult.push('"' + key + '":' + serialized);
                        }
                    }
                }
                return '{' + objResult.join(',') + '}';
            }
            return 'null';
        };
    }

    if (typeof JSON.parse !== 'function') {
        JSON.parse = function(text) {
            return eval('(' + text + ')');
        };
    }
})();
`;

// ==================== EXTENDSCRIPT COMP RESOLVER ====================
// Reliable composition resolver — finds the target comp by item index, name,
// or falls back to activeItem. Critical when multiple comps are open.

const EXTENDSCRIPT_COMP_RESOLVER = `
function _safeString(v) {
    return (v === null || v === undefined) ? '' : String(v);
}

function getCompItemIndex(targetComp) {
    if (!targetComp || !app.project || !app.project.numItems) return 0;
    for (var pi = 1; pi <= app.project.numItems; pi++) {
        var item = null;
        try { item = app.project.item(pi); } catch (e) { item = null; }
        if (item && item === targetComp) return pi;
    }
    return 0;
}

function findCompByItemIndex(itemIndex) {
    var idx = Number(itemIndex);
    if (!(idx > 0) || !app.project || !app.project.numItems || idx > app.project.numItems) return null;
    var item = null;
    try { item = app.project.item(idx); } catch (e) { item = null; }
    if (item && (item instanceof CompItem)) return item;
    return null;
}

function findCompByName(name) {
    var expected = _safeString(name);
    if (!expected || !app.project || !app.project.numItems) return null;
    for (var pi = 1; pi <= app.project.numItems; pi++) {
        var item = null;
        try { item = app.project.item(pi); } catch (e) { item = null; }
        if (!item || !(item instanceof CompItem)) continue;
        if (_safeString(item.name) === expected) return item;
    }
    return null;
}

function resolveTargetComp(meta, indexKey, nameKey) {
    var idxKey = _safeString(indexKey || "compItemIndex");
    var nmKey = _safeString(nameKey || "compName");
    var active = app.project ? app.project.activeItem : null;
    var expectedIndex = Number(meta && meta[idxKey]);
    var expectedName = _safeString(meta && meta[nmKey]);
    var activeIndex = (active && (active instanceof CompItem)) ? getCompItemIndex(active) : 0;
    if (active && (active instanceof CompItem)) {
        var indexMatches = expectedIndex > 0 && activeIndex === expectedIndex;
        var nameMatches = expectedName && _safeString(active.name) === expectedName;
        if (indexMatches || nameMatches || (!expectedIndex && !expectedName)) {
            return active;
        }
    }
    var byIndex = findCompByItemIndex(expectedIndex);
    if (byIndex) return byIndex;
    var byName = findCompByName(expectedName);
    if (byName) return byName;
    if (active && (active instanceof CompItem)) return active;
    return null;
}
`;

function withJsonShim(script) {
    return EXTENDSCRIPT_JSON_SHIM + '\n' + safeString(script);
}

function withJsonShimAndResolver(script) {
    return EXTENDSCRIPT_JSON_SHIM + '\n' + EXTENDSCRIPT_COMP_RESOLVER + '\n' + safeString(script);
}

// ---------------------------------------------------------------------------
// v3.1 — index-independent comp resolution.
//
// app.project.item(N) indices are NOT stable across a session: comp.layers.addNull()
// creates a solid in the project, which shifts every index after it. Any script that
// resolves a comp, mutates the project, then resolves it again by index can silently
// land on the wrong comp. The subtitles precomp therefore carries a unique tag in its
// `comment` field, which nothing else touches and which never shifts.
// ---------------------------------------------------------------------------

const EXTENDSCRIPT_TAG_RESOLVER = `
function findCompByTag(tag) {
    var expected = _safeString(tag);
    if (!expected || !app.project || !app.project.numItems) return null;
    for (var pi = 1; pi <= app.project.numItems; pi++) {
        var item = null;
        try { item = app.project.item(pi); } catch (e) { item = null; }
        if (!item || !(item instanceof CompItem)) continue;
        var c = '';
        try { c = _safeString(item.comment); } catch (e) { c = ''; }
        if (c === expected) return item;
    }
    return null;
}

function resolveTaggedComp(meta) {
    var byTag = findCompByTag(meta && meta.compTag);
    if (byTag) return byTag;
    return resolveTargetComp(meta, "compItemIndex", "compName");
}
`;

function withTagResolver(script) {
    return EXTENDSCRIPT_JSON_SHIM + '\n' + EXTENDSCRIPT_COMP_RESOLVER + '\n' +
           EXTENDSCRIPT_TAG_RESOLVER + '\n' + safeString(script);
}
