// corrections.js — canonical spelling of product / programme names.
//
// ONE source of truth. It feeds three things:
//   1. Scribe keyterms  — biases recognition so the error never happens
//   2. post-transcript corrections — fixes what slipped through
//   3. unbreakable phrases — multi-word terms are never split across subtitles
//
// Update CANONICAL_TERMS as new programmes launch. Nothing else needs touching.

window.CANONICAL_TERMS = [
    'FitMe',
    'Chair Yoga',
    'Chair Yoga for Men',
    'Tai Chi',
    'Chair Tai Chi',
    'Wall Tai Chi',
    'Military Tai Chi',
    'Military Calisthenics',
    'Female Calisthenics'
];

// Mishearings that map onto a SINGLE canonical word (tokens get merged).
// Left side is lowercase, punctuation-stripped tokens as they arrive from the API.
window.CANONICAL_VARIANTS = [
    { match: ['fit', 'me'],   to: 'FitMe' },
    { match: ['fit', 'mi'],   to: 'FitMe' },
    { match: ['feet', 'me'],  to: 'FitMe' },
    { match: ['fitme'],       to: 'FitMe' },
    { match: ['fitmi'],       to: 'FitMe' },
    { match: ['fitmee'],      to: 'FitMe' },
    { match: ['taichi'],      to: 'Tai Chi' },
    { match: ['chairyoga'],   to: 'Chair Yoga' }
];

// ---------------------------------------------------------------------------
// Derived tables — built once at load.
// ---------------------------------------------------------------------------

function _corrNormalizeToken(token) {
    if (!token && token !== 0) return '';
    return String(token)
        .toLowerCase()
        .replace(/[^\wа-яіїєґ'’-]/gi, '')
        .replace(/^[-'’]+|[-'’]+$/g, '');
}

window._corrNormalizeToken = _corrNormalizeToken;

// Multi-token canonical terms → per-token recasing (token count preserved).
// e.g. ['chair','yoga'] → ['Chair','Yoga']
window.CANONICAL_RECASE = (function () {
    var out = [];
    for (var i = 0; i < window.CANONICAL_TERMS.length; i++) {
        var term = window.CANONICAL_TERMS[i];
        var parts = term.split(/\s+/);
        if (parts.length < 2) continue;
        var keys = [];
        for (var p = 0; p < parts.length; p++) keys.push(_corrNormalizeToken(parts[p]));
        out.push({ match: keys, tokens: parts });
    }
    // longest first so "Chair Yoga for Men" wins over "Chair Yoga"
    out.sort(function (a, b) { return b.match.length - a.match.length; });
    return out;
})();

// Variant tables (merge into one token), longest first.
window.CANONICAL_MERGE = (function () {
    var out = [];
    for (var i = 0; i < window.CANONICAL_VARIANTS.length; i++) {
        var v = window.CANONICAL_VARIANTS[i];
        var keys = [];
        for (var k = 0; k < v.match.length; k++) keys.push(_corrNormalizeToken(v.match[k]));
        out.push({ match: keys, to: v.to });
    }
    out.sort(function (a, b) { return b.match.length - a.match.length; });
    return out;
})();

// Single-word canonical terms → straight recasing (FitMe, etc.)
window.CANONICAL_SINGLE = (function () {
    var map = {};
    for (var i = 0; i < window.CANONICAL_TERMS.length; i++) {
        var term = window.CANONICAL_TERMS[i];
        if (term.indexOf(' ') !== -1) continue;
        map[_corrNormalizeToken(term)] = term;
    }
    return map;
})();

// Keyterms payload for Scribe (max 100 entries, 50 chars each).
// API limits: at most 100 terms, each strictly under 50 characters.
// Anything longer is dropped rather than truncated - a half term would bias
// the model towards a word that does not exist.
window.getKeyterms = function () {
    var out = [];
    for (var i = 0; i < window.CANONICAL_TERMS.length && out.length < 100; i++) {
        var term = window.CANONICAL_TERMS[i];
        if (!term) continue;
        term = String(term).replace(/^\s+|\s+$/g, '');
        if (!term || term.length >= 50) continue;
        out.push(term);
    }
    return out;
};
