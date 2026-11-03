// expressions.js - Expression helpers
// All style expressions are now embedded directly in styles.js (ExtendScript strings).
// This file provides utility functions for expression-based operations if needed.

var EXPRESSIONS = {
    // Shared fade expression (used as fallback)
    fadeInOut: function(fadeIn, fadeOut) {
        return [
            'layerStart = inPoint;',
            'layerEnd = outPoint;',
            'fadeInDur = ' + (fadeIn || 0.2) + ';',
            'fadeOutDur = ' + (fadeOut || 0.15) + ';',
            'if (time < layerStart + fadeInDur) {',
            '    t = (time - layerStart) / fadeInDur;',
            '    easeOut(t, 0, 100);',
            '} else if (time < layerEnd - fadeOutDur) {',
            '    100;',
            '} else if (time < layerEnd) {',
            '    t = (time - (layerEnd - fadeOutDur)) / fadeOutDur;',
            '    easeIn(t, 100, 0);',
            '} else {',
            '    0;',
            '}'
        ].join('\n');
    }
};

// Helper: get expression string
function getExpression(style, parameter) {
    if (EXPRESSIONS[style] && EXPRESSIONS[style][parameter]) {
        return EXPRESSIONS[style][parameter];
    }
    return "";
}

if (typeof window !== 'undefined') {
    window.EXPRESSIONS = EXPRESSIONS;
    window.getExpression = getExpression;
}