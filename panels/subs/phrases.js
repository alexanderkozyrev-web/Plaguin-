// phrases.js — multi-word phrases that must never be split across two subtitles.
//
// Matching is case-insensitive and punctuation-insensitive, so entries are
// written in lowercase. Single-word entries are pointless here (one word cannot
// be split) and were removed — put those in corrections.js instead.
//
// Product / programme names are NOT listed here: they come from
// window.CANONICAL_TERMS in corrections.js and are appended automatically.

window.UNBREAKABLE_PHRASES = [
    // ── Bodyweight ───────────────────────────────────────────────────────
    'push up',
    'pull up',
    'sit up',
    'jumping jack',
    'jumping jacks',
    'mountain climber',
    'mountain climbers',
    'high knee',
    'high knees',
    'butt kick',
    'butt kicks',
    'bear crawl',
    'bear crawls',
    'wall sit',
    'wall sits',
    'side plank',
    'plank hold',
    'pike push',
    'pike pushup',
    'diamond push',
    'step up',
    'step ups',
    'toe touch',
    'toe touches',
    'heel walk',
    'toe walk',

    // ── Squats & lunges ──────────────────────────────────────────────────
    'squat jump',
    'squat jumps',
    'jump squat',
    'jump squats',
    'box jump',
    'box jumps',
    'sumo squat',
    'sumo squats',
    'wide squat',
    'front squat',
    'back squat',
    'goblet squat',
    'split squat',
    'pistol squat',
    'overhead squat',
    'reverse lunge',
    'reverse lunges',

    // ── Hips & glutes ────────────────────────────────────────────────────
    'hip thrust',
    'hip thrusts',
    'hip hinge',
    'hip hinges',
    'glute bridge',
    'glute bridges',
    'donkey kick',
    'donkey kicks',
    'fire hydrant',
    'fire hydrants',

    // ── Presses & pulls ──────────────────────────────────────────────────
    'bench press',
    'shoulder press',
    'chest press',
    'leg press',
    'overhead press',
    'lat pulldown',
    'cable row',
    'cable rows',
    'face pull',
    'face pulls',
    'chest fly',
    'chest flies',

    // ── Arms ─────────────────────────────────────────────────────────────
    'tricep dip',
    'tricep dips',
    'bicep curl',
    'bicep curls',
    'hammer curl',
    'hammer curls',
    'arnold press',

    // ── Legs & core ──────────────────────────────────────────────────────
    'leg raise',
    'leg raises',
    'calf raise',
    'calf raises',
    'lateral raise',
    'lateral raises',
    'front raise',
    'front raises',
    'russian twist',
    'russian twists',
    'flutter kick',
    'flutter kicks',
    'scissor kick',
    'scissor kicks',
    'nordic curl',
    'nordic curls',
    'dead lift',
    'romanian deadlift',
    'stiff leg',
    'straight leg',
    'single leg',
    'good morning',
    'good mornings',

    // ── Olympic ──────────────────────────────────────────────────────────
    'power clean',
    'hang clean',
    'clean jerk',
    'snatch pull'
];

// Pre-compute normalized lookup for fast matching at runtime.
// Canonical product terms from corrections.js are folded in automatically.
window.UNBREAKABLE_PHRASES_NORMALIZED = (function () {
    var result = [];
    var seen = {};

    function add(phrase) {
        var words = String(phrase)
            .toLowerCase()
            .replace(/^\s+|\s+$/g, '')
            .split(/\s+/);
        if (words.length < 2) return;
        var key = words.join(' ');
        if (seen[key]) return;
        seen[key] = true;
        result.push(words);
    }

    var list = window.UNBREAKABLE_PHRASES || [];
    for (var i = 0; i < list.length; i++) add(list[i]);

    var canonical = window.CANONICAL_TERMS || [];
    for (var c = 0; c < canonical.length; c++) add(canonical[c]);

    // longest phrases first so the greedy matcher prefers the fuller term
    result.sort(function (a, b) { return b.length - a.length; });
    return result;
})();
