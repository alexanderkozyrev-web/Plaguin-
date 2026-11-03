// styles.js - 16 embedded subtitle styles
// minimal, bubble, word-bubble, underline-track, karaoke-wipe,
// neon, typewriter, glitch, stomp, color-pop, bounce, slide-scale,
// fade-lift, cinema, gravity-drop, word-highlight
// No server dependency — all ExtendScript code is inline.

window.STYLES = {

    // =====================================================================
    // 1. MINIMAL — Scale + Fade per word
    // =====================================================================
    // =====================================================================
    // 1. CLASSIC - the base look. No animation, no expressions at all.
    //    This is what SNAP SUBS produces when no other preset is chosen.
    //    Arial Bold 68px / 15px stroke / Fill Over Stroke / no all-caps
    //    is applied by main.js on the template layer itself.
    // =====================================================================
    'classic': {
        displayName: 'Classic',
        description: 'Plain, no animation',
        previewLabel: 'Hello',
        isBase: true,
        // Classic is the only style that shows sentence punctuation on screen
        // (commas, full stops, ! ? ...). Every other style gets it stripped.
        keepPunctuation: true,
        extendScriptControls: '',
        extendScriptApply: ''
    },

    'bubble': {
        displayName: 'Bubble',
        createsLayers: true,
        description: 'Speech bubble',
        previewLabel: 'Say Hi',

        extendScriptControls: [
            'var bubbleColor = controller.property("ADBE Effect Parade").addProperty("ADBE Color Control");',
            'bubbleColor.name = "Bubble Color";',
            'bubbleColor.property("Color").setValue([0.31, 0.47, 1, 1]);',
            '',
            'var bubbleOpacity = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
            'bubbleOpacity.name = "Bubble Opacity";',
            'bubbleOpacity.property("Slider").setValue(60);',
            '',
            'var roundness = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
            'roundness.name = "Roundness";',
            'roundness.property("Slider").setValue(20);',
            '',
            'var paddingX = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
            'paddingX.name = "Padding X";',
            'paddingX.property("Slider").setValue(20);',
            '',
            'var paddingY = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
            'paddingY.name = "Padding Y";',
            'paddingY.property("Slider").setValue(10);'
        ].join('\n'),

        extendScriptApply: [
            'var textLayers = [];',
            'for (var i = 1; i <= comp.numLayers; i++) {',
            '    var layer = comp.layer(i);',
            '    if (_isTargetLayer(layer)) textLayers.push(layer);',
            '}',
            '',
            'for (var j = 0; j < textLayers.length; j++) {',
            '    var layer = textLayers[j];',
            '    try {',
            '        var layerIdx = layer.index;',
            '        try { layer.parent = controller; } catch(e) {}',
            '',
            '        var shapeLayer = comp.layers.addShape();',
            '        shapeLayer.name = "[AC Bubble] " + layer.name;',
            '        shapeLayer.startTime = layer.inPoint;',
            '        shapeLayer.outPoint = layer.outPoint;',
            '        shapeLayer.moveAfter(layer);',
            '        shapeLayer.property("Anchor Point").setValue([0, 0]);',
            '',
            '        shapeLayer.property("Position").expression =',
            '            \'var txt = thisComp.layer(\' + layerIdx + \');\' +',
            '            \'var r = txt.sourceRectAtTime(time, false);\' +',
            '            \'var centerX = r.left + r.width / 2;\' +',
            '            \'var centerY = r.top + r.height / 2;\' +',
            '            \'txt.toComp([centerX, centerY]);\';',
            '',
            '        var contents = shapeLayer.property("Contents");',
            '        var rectGroup = contents.addProperty("ADBE Vector Group");',
            '        rectGroup.name = "Bubble";',
            '        var groupContents = rectGroup.property("Contents");',
            '',
            '        var rectPath = groupContents.addProperty("ADBE Vector Shape - Rect");',
            '        rectPath.property("ADBE Vector Rect Size").expression =',
            '            \'var txt = thisComp.layer(\' + layerIdx + \');\' +',
            '            \'var r = txt.sourceRectAtTime(time, false);\' +',
            '            \'var ctrl = thisComp.layer("\' + ctrlName + \'");\' +',
            '            \'var padX = ctrl.effect("Padding X")("Slider");\' +',
            '            \'var padY = ctrl.effect("Padding Y")("Slider");\' +',
            '            \'[r.width + padX * 2, r.height + padY * 2];\';',
            '',
            '        rectPath.property("ADBE Vector Rect Position").setValue([0, 0]);',
            '',
            '        rectPath.property("ADBE Vector Rect Roundness").expression =',
            '            \'var ctrl = thisComp.layer("\' + ctrlName + \'");\' +',
            '            \'ctrl.effect("Roundness")("Slider");\';',
            '',
            '        var fill = groupContents.addProperty("ADBE Vector Graphic - Fill");',
            '        fill.property("ADBE Vector Fill Color").expression =',
            '            \'var ctrl = thisComp.layer("\' + ctrlName + \'");\' +',
            '            \'ctrl.effect("Bubble Color")("Color");\';',
            '',
            '        fill.property("ADBE Vector Fill Opacity").expression =',
            '            \'var ctrl = thisComp.layer("\' + ctrlName + \'");\' +',
            '            \'ctrl.effect("Bubble Opacity")("Slider");\';',
            '',
            '        applied++;',
            '    } catch (e) { _noteFailure(e); }',
            '}'
        ].join('\n')
    },

    // =====================================================================
    // 3. WORD BUBBLE — Highlights each word with animated bubble
    // =====================================================================
    'word-bubble': {
        displayName: 'Word Bubble',
        createsLayers: true,
        description: 'Highlights each word',
        previewLabel: 'Say It',
        needsWordData: true,

        extendScriptControls: [
            'var bubbleColor = controller.property("ADBE Effect Parade").addProperty("ADBE Color Control");',
            'bubbleColor.name = "Bubble Color";',
            'bubbleColor.property("Color").setValue([1, 0.8, 0]);',
            '',
            'var bubbleOpacity = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
            'bubbleOpacity.name = "Bubble Opacity";',
            'bubbleOpacity.property("Slider").setValue(70);',
            '',
            'var roundness = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
            'roundness.name = "Roundness";',
            'roundness.property("Slider").setValue(12);',
            '',
            'var paddingX = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
            'paddingX.name = "Padding X";',
            'paddingX.property("Slider").setValue(12);',
            '',
            'var paddingY = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
            'paddingY.name = "Padding Y";',
            'paddingY.property("Slider").setValue(6);'
        ].join('\n'),

        // Full word-bubble apply code — measures real pixel widths, creates per-word highlight rects
        extendScriptApply: null  // Set below (too large for inline array)
    },

    // =====================================================================
    // 4. UNDERLINE TRACK — Line follows each word
    // =====================================================================
    'underline-track': {
        displayName: 'Underline',
        createsLayers: true,
        description: 'Line follows each word',
        previewLabel: 'Read',
        needsWordData: true,

        extendScriptControls: [
            'var lineColor = controller.property("ADBE Effect Parade").addProperty("ADBE Color Control");',
            'lineColor.name = "Line Color";',
            'lineColor.property("Color").setValue([0.3, 0.7, 1, 1]);',
            '',
            'var lineThickness = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
            'lineThickness.name = "Line Thickness";',
            'lineThickness.property("Slider").setValue(6);',
            '',
            'var lineOffset = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
            'lineOffset.name = "Line Offset Y";',
            'lineOffset.property("Slider").setValue(8);'
        ].join('\n'),

        extendScriptApply: null  // Set below
    },

    // =====================================================================
    // 5. KARAOKE WIPE — Word-by-word color fill
    // =====================================================================
    'karaoke-wipe': {
        displayName: 'Karaoke',
        createsLayers: true,
        description: 'Word-by-word color fill',
        previewLabel: 'Sing',
        needsWordData: true,

        extendScriptControls: [
            'var highlightColor = controller.property("ADBE Effect Parade").addProperty("ADBE Color Control");',
            'highlightColor.name = "Highlight Color";',
            'highlightColor.property("Color").setValue([1, 0.88, 0.21, 1]);',
            '',
            'var popScale = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
            'popScale.name = "Word Pop Scale";',
            'popScale.property("Slider").setValue(108);',
            '',
            'var popDuration = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
            'popDuration.name = "Pop Duration";',
            'popDuration.property("Slider").setValue(0.12);'
        ].join('\n'),

        extendScriptApply: null  // Set below
    }
};

// ==================== WORD-BUBBLE APPLY CODE ====================
// Separated because it's large and needs clean escaping

window.STYLES['word-bubble'].extendScriptApply = (function() {
    // This builds the word-measurement + shape-creation ExtendScript
    // Adapted from seed-styles word-bubble
    var code = '';
    code += 'var textLayers = [];\n';
    code += 'for (var i = 1; i <= comp.numLayers; i++) {\n';
    code += '    var layer = comp.layer(i);\n';
    code += '    if (_isTargetLayer(layer)) textLayers.push(layer);\n';
    code += '}\n';
    code += 'var hasWordData = (typeof _wordData !== "undefined") && _wordData && _wordData.length > 0;\n';
    code += '\n';
    code += 'for (var j = 0; j < textLayers.length; j++) {\n';
    code += '    var layer = textLayers[j];\n';
    code += '    try {\n';
    code += '        var layerName = layer.name;\n';
    code += '        try { layer.parent = controller; } catch(e) {}\n';
    code += '        var layerStart = layer.inPoint;\n';
    code += '        var layerEnd = layer.outPoint;\n';
    code += '        var layerWordData = null;\n';
    code += '        if (hasWordData) {\n';
    code += '            var tolerance = 0.05;\n';
    code += '            for (var wd = 0; wd < _wordData.length; wd++) {\n';
    code += '                if (Math.abs(_wordData[wd].start - layerStart) < tolerance) { layerWordData = _wordData[wd]; break; }\n';
    code += '            }\n';
    code += '        }\n';
    code += '        var srcText = layer.property("Source Text").value;\n';
    code += '        var fullText = srcText.text;\n';
    code += '        var layerWords = fullText.split(" ");\n';
    code += '        var numWords = layerWords.length;\n';
    // Single-word / multiline → simple full-layer bubble
    code += '        var _hasNewline = fullText.indexOf("\\r") >= 0 || fullText.indexOf("\\n") >= 0;\n';
    code += '        if (numWords <= 1 || _hasNewline) {\n';
    code += '            var shapeLayer = comp.layers.addShape();\n';
    code += '            shapeLayer.name = "[AC WB] " + layerName;\n';
    code += '            shapeLayer.startTime = layerStart; shapeLayer.outPoint = layerEnd;\n';
    code += '            shapeLayer.moveAfter(layer); shapeLayer.property("Anchor Point").setValue([0, 0]);\n';
    code += '            shapeLayer.property("Position").expression = \'var t = thisComp.layer("\' + layerName + \'");\\nvar r = t.sourceRectAtTime(time, false);\\nt.toComp([r.left + r.width / 2, r.top + r.height / 2]);\';\n';
    code += '            var contents = shapeLayer.property("Contents");\n';
    code += '            var grp = contents.addProperty("ADBE Vector Group"); grp.name = "WB";\n';
    code += '            var gc = grp.property("Contents");\n';
    code += '            var rect = gc.addProperty("ADBE Vector Shape - Rect"); rect.property("ADBE Vector Rect Position").setValue([0, 0]);\n';
    code += '            rect.property("ADBE Vector Rect Size").expression = \'var t = thisComp.layer("\' + layerName + \'");\\nvar r = t.sourceRectAtTime(time, false);\\nvar c = thisComp.layer("\' + ctrlName + \'");\\nvar px = c.effect("Padding X")("Slider");\\nvar py = c.effect("Padding Y")("Slider");\\n[r.width + px * 2, r.height + py * 2];\';\n';
    code += '            rect.property("ADBE Vector Rect Roundness").expression = \'var c = thisComp.layer("\' + ctrlName + \'");\\nc.effect("Roundness")("Slider");\';\n';
    code += '            var fl = gc.addProperty("ADBE Vector Graphic - Fill");\n';
    code += '            fl.property("ADBE Vector Fill Color").expression = \'var c = thisComp.layer("\' + ctrlName + \'");\\nc.effect("Bubble Color")("Color");\';\n';
    code += '            fl.property("ADBE Vector Fill Opacity").expression = \'var c = thisComp.layer("\' + ctrlName + \'");\\nc.effect("Bubble Opacity")("Slider");\';\n';
    code += '            applied++; continue;\n';
    code += '        }\n';
    // Multi-word: measure pixel widths
    code += '        var tmpLayer = comp.layers.addText("X");\n';
    code += '        var tmpTd = tmpLayer.property("Source Text").value;\n';
    code += '        tmpTd.font = srcText.font; tmpTd.fontSize = srcText.fontSize; tmpTd.tracking = srcText.tracking;\n';
    // The ruler must carry the stroke.
    //
    // sourceRectAtTime on the real layer returns the rect WITH the 12px
    // outline, but the ruler was drawing unstroked glyphs. So tc and the word
    // widths were measured in one space and r.width in another, and the
    // ratio between them quietly stretched every position — a couple of
    // percent, invisible on the first word and a dozen pixels out by the
    // last. That is why the bubble sat to the right of the word.
    //
    // allCaps and smallCaps are forced off rather than copied: writing a
    // TextDocument also rewrites AE\'s Character panel defaults, and copying
    // them here once leaked small caps onto subtitles nobody had styled.
    code += '        try { tmpTd.applyStroke = srcText.applyStroke; } catch (e) {}\n';
    code += '        try { if (srcText.applyStroke) { tmpTd.strokeColor = srcText.strokeColor; tmpTd.strokeWidth = srcText.strokeWidth; } } catch (e) {}\n';
    code += '        try { tmpTd.strokeOverFill = srcText.strokeOverFill; } catch (e) {}\n';
    code += '        try { tmpTd.allCaps = false; tmpTd.smallCaps = false; } catch (e) {}\n';
    code += '        tmpTd.justification = ParagraphJustification.LEFT_JUSTIFY; tmpTd.fillColor = [1,1,1];\n';
    code += '        tmpTd.text = fullText; tmpLayer.property("Source Text").setValue(tmpTd);\n';
    code += '        var fullW = tmpLayer.sourceRectAtTime(0, false).width;\n';

    // ---- Word Bubble is single-line, by construction ----
    //
    // Every wrong bubble this style ever produced came from the same place:
    // the text was box text, After Effects decided where to wrap it, and the
    // geometry then had to work out after the fact which word ended up on
    // which line. Measuring that back out of AE is where the small caps, the
    // slowdown and the misplaced plaques all came from.
    //
    // So the wrap is removed instead of reverse-engineered. The box is
    // widened past the measured width of the whole sentence, which leaves
    // exactly one line — and with one line the original arithmetic is exact:
    // the layer's rect IS the line, its height IS the bubble height, and a
    // word's position is its share of the width.
    //
    // The box grows symmetrically: boxTextPos moves left by half of what the
    // width gained, so centred text stays where the designer put it.
    code += '        var _oneLine = fullText.replace(/[\\r\\n]+/g, " ");\n';
    code += '        if (_oneLine !== fullText) {\n';
    code += '            fullText = _oneLine;\n';
    code += '            layerWords = fullText.split(" ");\n';
    code += '            tmpTd.text = fullText; tmpLayer.property("Source Text").setValue(tmpTd);\n';
    code += '            fullW = tmpLayer.sourceRectAtTime(0, false).width;\n';
    code += '        }\n';
    code += '        try {\n';
    code += '            if (srcText.boxText) {\n';
    code += '                var _need = fullW + srcText.fontSize;\n';
    code += '                var _have = srcText.boxTextSize[0];\n';
    code += '                if (_need > _have) {\n';
    code += '                    var _grew = _need - _have;\n';
    code += '                    srcText.boxTextSize = [_need, srcText.boxTextSize[1]];\n';
    code += '                    srcText.boxTextPos = [srcText.boxTextPos[0] - _grew / 2, srcText.boxTextPos[1]];\n';
    code += '                }\n';
    code += '            }\n';
    code += '            srcText.text = fullText;\n';
    code += '            layer.property("Source Text").setValue(srcText);\n';
    code += '        } catch (eOneLine) {}\n';
    code += '        var cumWidths = [], wordWidths = [];\n';
    code += '        for (var wi = 0; wi < layerWords.length; wi++) {\n';
    code += '            var sub = ""; for (var si = 0; si <= wi; si++) { if (si > 0) sub += " "; sub += layerWords[si]; }\n';
    code += '            tmpTd.text = sub; tmpLayer.property("Source Text").setValue(tmpTd); cumWidths.push(tmpLayer.sourceRectAtTime(0, false).width);\n';
    code += '            tmpTd.text = layerWords[wi]; tmpLayer.property("Source Text").setValue(tmpTd); wordWidths.push(tmpLayer.sourceRectAtTime(0, false).width);\n';
    code += '        }\n';
    code += '        tmpLayer.remove();\n';
    code += '        var wStarts = [], wLens = [];\n';
    code += '        for (var wi = 0; wi < layerWords.length; wi++) {\n';
    code += '            var leftEdge = cumWidths[wi] - wordWidths[wi];\n';
    code += '            wStarts.push(Math.round(leftEdge * 100) / 100);\n';
    code += '            wLens.push(Math.round(wordWidths[wi] * 100) / 100);\n';
    code += '        }\n';
    code += '        var tc = Math.round(fullW * 100) / 100;\n';
    // Create shape layer with Word Index keyframes
    code += '        var shapeLayer = comp.layers.addShape();\n';
    code += '        shapeLayer.name = "[AC WB] " + layerName;\n';
    code += '        shapeLayer.startTime = layerStart; shapeLayer.outPoint = layerEnd;\n';
    code += '        shapeLayer.moveAfter(layer); shapeLayer.property("Anchor Point").setValue([0, 0]);\n';
    code += '        var wiEffect = shapeLayer.property("ADBE Effect Parade").addProperty("ADBE Slider Control"); wiEffect.name = "Word Index";\n';
    code += '        var sl = wiEffect.property("Slider");\n';
    code += '        if (layerWordData && layerWordData.words && layerWordData.words.length > 1) {\n';
    code += '            sl.setValueAtTime(layerStart, 0);\n';
    code += '            for (var wk = 0; wk < layerWordData.words.length; wk++) { sl.setValueAtTime(layerWordData.words[wk].start, wk); }\n';
    code += '        } else {\n';
    code += '            var wordDur = (layerEnd - layerStart) / numWords;\n';
    code += '            for (var wk = 0; wk < numWords; wk++) { sl.setValueAtTime(layerStart + wk * wordDur, wk); }\n';
    code += '        }\n';
    code += '        for (var ki = 1; ki <= sl.numKeys; ki++) { sl.setInterpolationTypeAtKey(ki, KeyframeInterpolationType.HOLD); }\n';
    // Position expression
    code += '        shapeLayer.property("Position").expression =\n';
    code += '            \'var idx = Math.round(effect("Word Index")("Slider"));\\n\' +\n';
    code += '            \'var t = thisComp.layer("\' + layerName + \'");\\n\' +\n';
    code += '            \'var r = t.sourceRectAtTime(time, false);\\n\' +\n';
    code += '            \'var ws = [\' + wStarts.join(",") + \'];\\n\' +\n';
    code += '            \'var wl = [\' + wLens.join(",") + \'];\\n\' +\n';
    code += '            \'var tc = \' + tc + \';\\n\' +\n';
    code += '            \'idx = Math.max(0, Math.min(idx, ws.length - 1));\\n\' +\n';
    code += '            \'var x1 = r.left + (ws[idx] / tc) * r.width;\\n\' +\n';
    code += '            \'var x2 = r.left + ((ws[idx] + wl[idx]) / tc) * r.width;\\n\' +\n';
    code += '            \'t.toComp([(x1 + x2) / 2, r.top + r.height / 2]);\';\n';
    // Rect shape
    code += '        var contents = shapeLayer.property("Contents");\n';
    code += '        var grp = contents.addProperty("ADBE Vector Group"); grp.name = "WB";\n';
    code += '        var gc = grp.property("Contents");\n';
    code += '        var rect = gc.addProperty("ADBE Vector Shape - Rect"); rect.property("ADBE Vector Rect Position").setValue([0, 0]);\n';
    code += '        rect.property("ADBE Vector Rect Size").expression =\n';
    code += '            \'var idx = Math.round(effect("Word Index")("Slider"));\\n\' +\n';
    code += '            \'var t = thisComp.layer("\' + layerName + \'");\\n\' +\n';
    code += '            \'var r = t.sourceRectAtTime(time, false);\\n\' +\n';
    code += '            \'var wl = [\' + wLens.join(",") + \'];\\n\' +\n';
    code += '            \'var tc = \' + tc + \';\\n\' +\n';
    code += '            \'var c = thisComp.layer("\' + ctrlName + \'");\\n\' +\n';
    code += '            \'var px = c.effect("Padding X")("Slider");\\n\' +\n';
    code += '            \'var py = c.effect("Padding Y")("Slider");\\n\' +\n';
    code += '            \'idx = Math.max(0, Math.min(idx, wl.length - 1));\\n\' +\n';
    code += '            \'[(wl[idx] / tc) * r.width + px * 2, r.height + py * 2];\';\n';
    code += '        rect.property("ADBE Vector Rect Roundness").expression = \'var c = thisComp.layer("\' + ctrlName + \'");\\nc.effect("Roundness")("Slider");\';\n';
    code += '        var fl = gc.addProperty("ADBE Vector Graphic - Fill");\n';
    code += '        fl.property("ADBE Vector Fill Color").expression = \'var c = thisComp.layer("\' + ctrlName + \'");\\nc.effect("Bubble Color")("Color");\';\n';
    code += '        fl.property("ADBE Vector Fill Opacity").expression = \'var c = thisComp.layer("\' + ctrlName + \'");\\nc.effect("Bubble Opacity")("Slider");\';\n';
    code += '        applied++;\n';
    code += '    } catch (e) { _noteFailure(e); }\n';
    code += '}\n';
    return code;
})();

// ==================== UNDERLINE-TRACK APPLY CODE ====================
window.STYLES['underline-track'].extendScriptApply = (function() {
    var c = '';
    c += 'var textLayers = [];\n';
    c += 'for (var i = 1; i <= comp.numLayers; i++) { var layer = comp.layer(i); if (_isTargetLayer(layer)) textLayers.push(layer); }\n';
    c += 'var hasWordData = (typeof _wordData !== "undefined") && _wordData && _wordData.length > 0;\n';
    c += 'for (var j = 0; j < textLayers.length; j++) {\n';
    c += '    var layer = textLayers[j];\n';
    c += '    try {\n';
    c += '        var layerName = layer.name;\n';
    c += '        try { layer.parent = controller; } catch(e) {}\n';
    c += '        var layerStart = layer.inPoint; var layerEnd = layer.outPoint;\n';
    c += '        var layerWordData = null;\n';
    c += '        if (hasWordData) { for (var wd = 0; wd < _wordData.length; wd++) { if (Math.abs(_wordData[wd].start - layerStart) < 0.05) { layerWordData = _wordData[wd]; break; } } }\n';
    c += '        var srcText = layer.property("Source Text").value;\n';
    c += '        var fullText = srcText.text;\n';
    c += '        var layerWords = fullText.split(" ");\n';
    c += '        var numWords = layerWords.length;\n';
    c += '        var tmpLayer = comp.layers.addText("X");\n';
    c += '        var tmpTd = tmpLayer.property("Source Text").value;\n';
    c += '        tmpTd.font = srcText.font; tmpTd.fontSize = srcText.fontSize; tmpTd.tracking = srcText.tracking;\n';
    c += '        tmpTd.justification = ParagraphJustification.LEFT_JUSTIFY; tmpTd.fillColor = [1,1,1];\n';
    c += '        tmpTd.text = fullText; tmpLayer.property("Source Text").setValue(tmpTd);\n';
    c += '        var fullW = tmpLayer.sourceRectAtTime(0, false).width;\n';
    c += '        var cumWidths = [], wordWidths = [];\n';
    c += '        for (var wi = 0; wi < layerWords.length; wi++) {\n';
    c += '            var sub = ""; for (var si = 0; si <= wi; si++) { if (si > 0) sub += " "; sub += layerWords[si]; }\n';
    c += '            tmpTd.text = sub; tmpLayer.property("Source Text").setValue(tmpTd); cumWidths.push(tmpLayer.sourceRectAtTime(0, false).width);\n';
    c += '            tmpTd.text = layerWords[wi]; tmpLayer.property("Source Text").setValue(tmpTd); wordWidths.push(tmpLayer.sourceRectAtTime(0, false).width);\n';
    c += '        }\n';
    c += '        tmpLayer.remove();\n';
    c += '        var wStarts = [], wLens = [];\n';
    c += '        for (var wi = 0; wi < layerWords.length; wi++) { var le = cumWidths[wi] - wordWidths[wi]; wStarts.push(Math.round(le * 100) / 100); wLens.push(Math.round(wordWidths[wi] * 100) / 100); }\n';
    c += '        var tc = Math.round(fullW * 100) / 100;\n';
    c += '        var shapeLayer = comp.layers.addShape();\n';
    c += '        shapeLayer.name = "[AC UL] " + layerName;\n';
    c += '        shapeLayer.startTime = layerStart; shapeLayer.outPoint = layerEnd;\n';
    c += '        shapeLayer.moveAfter(layer); shapeLayer.property("Anchor Point").setValue([0, 0]);\n';
    c += '        var wiEffect = shapeLayer.property("ADBE Effect Parade").addProperty("ADBE Slider Control"); wiEffect.name = "Word Index"; var sl = wiEffect.property("Slider");\n';
    c += '        if (layerWordData && layerWordData.words && layerWordData.words.length > 1) { sl.setValueAtTime(layerStart, 0); for (var wk = 0; wk < layerWordData.words.length; wk++) { sl.setValueAtTime(layerWordData.words[wk].start, wk); } } else { var wordDur = (layerEnd - layerStart) / numWords; for (var wk = 0; wk < numWords; wk++) { sl.setValueAtTime(layerStart + wk * wordDur, wk); } }\n';
    c += '        for (var ki = 1; ki <= sl.numKeys; ki++) { sl.setInterpolationTypeAtKey(ki, KeyframeInterpolationType.HOLD); }\n';
    c += '        shapeLayer.property("Position").expression = \'var idx = Math.round(effect("Word Index")("Slider")); var t = thisComp.layer("\' + layerName + \'"); var r = t.sourceRectAtTime(time, false); var ws = [\' + wStarts.join(",") + \']; var wl = [\' + wLens.join(",") + \']; var tc = \' + tc + \'; var ctrl = thisComp.layer("\' + ctrlName + \'"); var offY = ctrl.effect("Line Offset Y")("Slider"); idx = Math.max(0, Math.min(idx, ws.length - 1)); var x1 = r.left + (ws[idx] / tc) * r.width; var x2 = r.left + ((ws[idx] + wl[idx]) / tc) * r.width; t.toComp([(x1 + x2) / 2, r.top + r.height + offY]);\';\n';
    c += '        var contents = shapeLayer.property("Contents"); var grp = contents.addProperty("ADBE Vector Group"); grp.name = "Line"; var gc = grp.property("Contents");\n';
    c += '        var rect = gc.addProperty("ADBE Vector Shape - Rect"); rect.property("ADBE Vector Rect Position").setValue([0, 0]);\n';
    c += '        rect.property("ADBE Vector Rect Size").expression = \'var idx = Math.round(effect("Word Index")("Slider")); var t = thisComp.layer("\' + layerName + \'"); var r = t.sourceRectAtTime(time, false); var wl = [\' + wLens.join(",") + \']; var tc = \' + tc + \'; var ctrl = thisComp.layer("\' + ctrlName + \'"); var thick = ctrl.effect("Line Thickness")("Slider"); idx = Math.max(0, Math.min(idx, wl.length - 1)); [(wl[idx] / tc) * r.width + 4, thick];\';\n';
    c += '        rect.property("ADBE Vector Rect Roundness").setValue(3);\n';
    c += '        var fl = gc.addProperty("ADBE Vector Graphic - Fill");\n';
    c += '        fl.property("ADBE Vector Fill Color").expression = \'thisComp.layer("\' + ctrlName + \'").effect("Line Color")("Color");\';\n';
    c += '        applied++;\n';
    c += '    } catch (e) { _noteFailure(e); }\n';
    c += '}\n';
    return c;
})();

// ==================== KARAOKE-WIPE APPLY CODE ====================
window.STYLES['karaoke-wipe'].extendScriptApply = (function() {
    var c = '';
    c += 'var textLayers = [];\n';
    c += 'for (var i = 1; i <= comp.numLayers; i++) { var layer = comp.layer(i); if (_isTargetLayer(layer)) textLayers.push(layer); }\n';
    c += 'var hasWordData = (typeof _wordData !== "undefined") && _wordData && _wordData.length > 0;\n';
    c += 'for (var j = 0; j < textLayers.length; j++) {\n';
    c += '    var layer = textLayers[j];\n';
    c += '    try {\n';
    c += '        var layerName = layer.name;\n';
    c += '        try { layer.parent = controller; } catch(e) {}\n';
    c += '        try { var _fd = layer.property("Source Text").value; _fd.fillColor = [1,1,1]; layer.property("Source Text").setValue(_fd); } catch(e) {}\n';
    c += '        var layerStart = layer.inPoint; var layerEnd = layer.outPoint;\n';
    c += '        var layerWordData = null;\n';
    c += '        if (hasWordData) { var tolerance = 0.05; for (var wd = 0; wd < _wordData.length; wd++) { if (Math.abs(_wordData[wd].start - layerStart) < tolerance) { layerWordData = _wordData[wd]; break; } } }\n';
    c += '        var srcText = layer.property("Source Text").value;\n';
    c += '        var fullText = srcText.text;\n';
    c += '        var layerWords = fullText.split(" ");\n';
    c += '        var numWords = layerWords.length;\n';
    c += '        var totalChars = fullText.length;\n';
    // Text Animator for karaoke color wipe
    c += '        var textProps = layer.property("ADBE Text Properties"); var animators = textProps.property("ADBE Text Animators");\n';
    c += '        var animator = animators.addProperty("ADBE Text Animator"); animator.name = "Karaoke Fill";\n';
    c += '        var selectors = animator.property("ADBE Text Selectors"); var rangeSelector = selectors.addProperty("ADBE Text Selector");\n';
    c += '        var startProp = rangeSelector.property("ADBE Text Percent Start"); var endProp = rangeSelector.property("ADBE Text Percent End");\n';
    c += '        startProp.setValue(0);\n';
    // Character percentages
    c += '        var cumChars = 0; var wordEndPcts = [];\n';
    c += '        for (var wi = 0; wi < layerWords.length; wi++) { cumChars += layerWords[wi].length; if (wi < layerWords.length - 1) cumChars += 1; wordEndPcts.push((cumChars / totalChars) * 100); }\n';
    // Keyframe End property
    c += '        endProp.setValueAtTime(layerStart, 0);\n';
    c += '        if (layerWordData && layerWordData.words && layerWordData.words.length > 1) {\n';
    c += '            for (var wk = 0; wk < layerWordData.words.length; wk++) { var pct = (wk < wordEndPcts.length) ? wordEndPcts[wk] : 100; endProp.setValueAtTime(layerWordData.words[wk].start, pct); }\n';
    c += '        } else {\n';
    c += '            var wordDur = (layerEnd - layerStart) / numWords;\n';
    c += '            for (var wk = 0; wk < numWords; wk++) { endProp.setValueAtTime(layerStart + wk * wordDur, wordEndPcts[wk]); }\n';
    c += '        }\n';
    c += '        for (var ki = 1; ki <= endProp.numKeys; ki++) { endProp.setInterpolationTypeAtKey(ki, KeyframeInterpolationType.HOLD); }\n';
    // Fill Color = Highlight
    c += '        var animProps = animator.property("ADBE Text Animator Properties");\n';
    c += '        var fillColorProp = animProps.addProperty("ADBE Text Fill Color");\n';
    c += '        fillColorProp.expression = \'thisComp.layer("\' + ctrlName + \'").effect("Highlight Color")("Color");\';\n';
    // Scale pop
    c += '        layer.property("Transform").property("Scale").expression = \'var ctrl = thisComp.layer("\' + ctrlName + \'");var ps = ctrl.effect("Word Pop Scale")("Slider");var pd = ctrl.effect("Pop Duration")("Slider");var ls = inPoint;var ae = ls + pd;if (time < ls) [ps, ps];else if (time < ae) { var t = (time - ls) / pd; var s = easeOut(t, ps, 100); [s, s]; } else [100, 100];\';\n';
    // Fade
    c += '        layer.property("Transform").property("Opacity").expression = \'var ls = inPoint; var le = outPoint;var fi = 0.15; var fo = 0.12;if (time < ls + fi) easeOut((time - ls) / fi, 0, 100);else if (time < le - fo) 100;else if (time < le) easeIn((time - (le - fo)) / fo, 100, 0);else 0;\';\n';
    c += '        applied++;\n';
    c += '    } catch (e) { _noteFailure(e); }\n';
    c += '}\n';
    return c;
})();


// =====================================================================
// 6. NEON — Glow pulse effect
// =====================================================================
window.STYLES['neon'] = {
    displayName: 'Neon',
    description: 'Glow pulse',
    previewLabel: 'Glow',

    extendScriptControls: [
        'var glowColor = controller.property("ADBE Effect Parade").addProperty("ADBE Color Control");',
        'glowColor.name = "Glow Color"; glowColor.property("Color").setValue([0, 1, 1, 1]);',
        'var glowIntensity = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'glowIntensity.name = "Glow Intensity"; glowIntensity.property("Slider").setValue(2.5);',
        'var glowRadius = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'glowRadius.name = "Glow Radius"; glowRadius.property("Slider").setValue(80);',
        'var pulseSpeed = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'pulseSpeed.name = "Pulse Speed"; pulseSpeed.property("Slider").setValue(2);'
    ].join('\n'),

    extendScriptApply: (function() {
        var c = '';
        c += 'for (var i = 1; i <= comp.numLayers; i++) {\n';
        c += '    var layer = comp.layer(i);\n';
        c += '    if (_isTargetLayer(layer)) {\n';
        c += '        try {\n';
        c += '            try { layer.parent = controller; } catch(e) {}\n';
        c += '            var fx = layer.property("ADBE Effect Parade");\n';
        c += '            if (!fx) continue;\n';
        c += '            var glow = null;\n';
        c += '            for (var j = 1; j <= fx.numProperties; j++) { var p = fx.property(j); if (p.matchName === "ADBE Glo2") { glow = p; break; } }\n';
        c += '            if (!glow) { glow = fx.addProperty("ADBE Glo2"); }\n';
        c += '            if (glow) {\n';
        c += '                glow.property("Glow Threshold").setValue(50);\n';
        c += '                glow.property("Glow Radius").setValue(25);\n';
        c += '                glow.property("Glow Intensity").expression =\n';
        c += '                    \'try { ctrl = thisComp.layer("\' + ctrlName + \'");\' +\n';
        c += '                    \'if (ctrl) { intensity = ctrl.effect("Glow Intensity")("Slider");\' +\n';
        c += '                    \'pulseSpeed = ctrl.effect("Pulse Speed")("Slider");\' +\n';
        c += '                    \'if (time >= inPoint && time <= outPoint) {\' +\n';
        c += '                    \'pulse = Math.sin((time - inPoint) * pulseSpeed * 6.28) * 0.3; intensity + pulse;\' +\n';
        c += '                    \'} else { intensity; } } else { value; } } catch(e) { value; }\';\n';
        c += '                glow.property("Glow Colors").setValue(1);\n';
        c += '                glow.property("Color A").setValue([0, 1, 1, 1]);\n';
        c += '                glow.property("Color A").expression =\n';
        c += '                    \'try { ctrl = thisComp.layer("\' + ctrlName + \'"); if (ctrl) { ctrl.effect("Glow Color")("Color"); } else { value; } } catch(e) { value; }\';\n';
        c += '            }\n';
        c += '            applied++;\n';
        c += '        } catch (e) { _noteFailure(e); }\n';
        c += '    }\n';
        c += '}\n';
        return c;
    })()
};

// =====================================================================
// 7. TYPEWRITER — Character-by-character reveal
// =====================================================================
window.STYLES['typewriter'] = {
    displayName: 'Typewriter',
    description: 'Char reveal',
    previewLabel: 'Type...',

    extendScriptControls: '',

    extendScriptApply: (function() {
        var c = '';
        c += 'for (var i = 1; i <= comp.numLayers; i++) {\n';
        c += '    var layer = comp.layer(i);\n';
        c += '    if (_isTargetLayer(layer)) {\n';
        c += '        try {\n';
        c += '            try { layer.parent = controller; } catch(e) {}\n';
        c += '            try { var textDoc = layer.property("Source Text").value; textDoc.font = "CourierNewPSMT"; layer.property("Source Text").setValue(textDoc); } catch(e) {}\n';
        c += '            var textProps = layer.property("ADBE Text Properties");\n';
        c += '            var animators = textProps.property("ADBE Text Animators");\n';
        c += '            var animator = animators.addProperty("ADBE Text Animator");\n';
        c += '            var selectors = animator.property("ADBE Text Selectors");\n';
        c += '            var rangeSelector = selectors.addProperty("ADBE Text Selector");\n';
        c += '            var startProp = rangeSelector.property("ADBE Text Percent Start");\n';
        c += '            var endProp = rangeSelector.property("ADBE Text Percent End");\n';
        c += '            startProp.setValue(0); endProp.setValue(100);\n';
        c += '            var animProps = animator.property("ADBE Text Animator Properties");\n';
        c += '            var opacityProp = animProps.addProperty("ADBE Text Opacity");\n';
        c += '            opacityProp.setValue(0);\n';
        c += '            var layerStartTime = layer.inPoint;\n';
        c += '            var layerEndTime = layer.outPoint;\n';
        c += '            startProp.setValueAtTime(layerStartTime, 0);\n';
        c += '            startProp.setValueAtTime(layerEndTime, 100);\n';
        c += '            if (startProp.numKeys >= 2) {\n';
        c += '                startProp.setInterpolationTypeAtKey(1, KeyframeInterpolationType.LINEAR);\n';
        c += '                startProp.setInterpolationTypeAtKey(2, KeyframeInterpolationType.LINEAR);\n';
        c += '            }\n';
        c += '            applied++;\n';
        c += '        } catch (e) { _noteFailure(e); }\n';
        c += '    }\n';
        c += '}\n';
        return c;
    })()
};

// =====================================================================
// 8. GLITCH (Horror) — Jitter + RGB split + flicker
// =====================================================================
window.STYLES['glitch'] = {
    displayName: 'Horror',
    description: 'Glitch + RGB split',
    previewLabel: 'FEAR',

    extendScriptControls: [
        'var glitchIntensity = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'glitchIntensity.name = "Glitch Intensity"; glitchIntensity.property("Slider").setValue(26);',
        'var glitchFrequency = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'glitchFrequency.name = "Glitch Frequency"; glitchFrequency.property("Slider").setValue(322);',
        'var horizontalAmount = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'horizontalAmount.name = "Horizontal Amount"; horizontalAmount.property("Slider").setValue(6);',
        'var verticalAmount = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'verticalAmount.name = "Vertical Amount"; verticalAmount.property("Slider").setValue(20);',
        'var flickerChance = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'flickerChance.name = "Flicker Chance"; flickerChance.property("Slider").setValue(25);',
        'var scaleShake = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'scaleShake.name = "Scale Shake"; scaleShake.property("Slider").setValue(1);',
        'var rgbSeparation = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'rgbSeparation.name = "RGB Separation"; rgbSeparation.property("Slider").setValue(8);',
        'var turbulentAmount = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'turbulentAmount.name = "Turbulent Amount"; turbulentAmount.property("Slider").setValue(0);',
        'var turbulentSize = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'turbulentSize.name = "Turbulent Size"; turbulentSize.property("Slider").setValue(8);',
        'var textColor = controller.property("ADBE Effect Parade").addProperty("ADBE Color Control");',
        'textColor.name = "Text Color"; textColor.property("Color").setValue([1, 0.2, 0.2, 1]);'
    ].join('\n'),

    extendScriptApply: (function() {
        var c = '';
        c += 'for (var i = 1; i <= comp.numLayers; i++) {\n';
        c += '    var layer = comp.layer(i);\n';
        c += '    if (_isTargetLayer(layer)) {\n';
        c += '        try {\n';
        c += '            try { layer.parent = controller; } catch(e) {}\n';
        // Fill color
        c += '            var textFx = layer.property("ADBE Effect Parade");\n';
        c += '            var fillEff = textFx.addProperty("ADBE Fill");\n';
        c += '            fillEff.property("ADBE Fill-0002").expression = \'thisComp.layer("\' + ctrlName + \'").effect("Text Color")("Color");\';\n';
        // Position jitter
        c += '            layer.property("Transform").property("Position").expression =\n';
        c += '                \'ctrl = thisComp.layer("\' + ctrlName + \'");\' +\n';
        c += '                \'intensity = ctrl.effect("Glitch Intensity")("Slider");\' +\n';
        c += '                \'freq = ctrl.effect("Glitch Frequency")("Slider");\' +\n';
        c += '                \'hAmount = ctrl.effect("Horizontal Amount")("Slider") / 100;\' +\n';
        c += '                \'vAmount = ctrl.effect("Vertical Amount")("Slider") / 100;\' +\n';
        c += '                \'freq = Math.max(freq, 1); posterizeTime(freq);\' +\n';
        c += '                \'seedRandom(Math.floor(time * freq * 100), true); orig = value;\' +\n';
        c += '                \'offsetX = random(-intensity * hAmount, intensity * hAmount);\' +\n';
        c += '                \'offsetY = random(-intensity * vAmount, intensity * vAmount);\' +\n';
        c += '                \'[orig[0] + offsetX, orig[1] + offsetY];\';\n';
        // Opacity flicker
        c += '            layer.property("Transform").property("Opacity").expression =\n';
        c += '                \'ctrl = thisComp.layer("\' + ctrlName + \'");\' +\n';
        c += '                \'freq = ctrl.effect("Glitch Frequency")("Slider");\' +\n';
        c += '                \'flickerChance = ctrl.effect("Flicker Chance")("Slider") / 100;\' +\n';
        c += '                \'freq = Math.max(freq, 1); posterizeTime(freq * 2);\' +\n';
        c += '                \'seedRandom(Math.floor(time * freq * 200), true);\' +\n';
        c += '                \'if (random() < flickerChance) { random(0, 50); } else { value; }\';\n';
        // Scale shake
        c += '            layer.property("Transform").property("Scale").expression =\n';
        c += '                \'ctrl = thisComp.layer("\' + ctrlName + \'");\' +\n';
        c += '                \'shakeAmount = ctrl.effect("Scale Shake")("Slider");\' +\n';
        c += '                \'freq = ctrl.effect("Glitch Frequency")("Slider");\' +\n';
        c += '                \'freq = Math.max(freq, 1); posterizeTime(freq);\' +\n';
        c += '                \'seedRandom(Math.floor(time * freq * 300), true); orig = value;\' +\n';
        c += '                \'shake = random(-shakeAmount, shakeAmount); [orig[0] + shake, orig[1] + shake];\';\n';
        // RGB split via Channel Blur
        c += '            var fx = layer.property("ADBE Effect Parade");\n';
        c += '            if (fx) {\n';
        c += '                var chBlur = fx.addProperty("ADBE Channel Blur");\n';
        c += '                if (chBlur) {\n';
        c += '                    chBlur.name = "RGB Split";\n';
        c += '                    chBlur.property(1).expression = \'thisComp.layer("\' + ctrlName + \'").effect("RGB Separation")("Slider");\';\n';
        c += '                    chBlur.property(2).setValue(0);\n';
        c += '                    chBlur.property(3).expression = \'thisComp.layer("\' + ctrlName + \'").effect("RGB Separation")("Slider");\';\n';
        c += '                    chBlur.property(4).setValue(0);\n';
        c += '                    try { chBlur.property(5).setValue(1); } catch(e) {}\n';
        c += '                    try { chBlur.property(6).setValue(1); } catch(e) {}\n';
        c += '                }\n';
        c += '                var turb = fx.addProperty("ADBE Turbulent Displace");\n';
        c += '                if (turb) {\n';
        c += '                    try {\n';
        c += '                        turb.property("ADBE Turbulent Displace-0002").expression = \'thisComp.layer("\' + ctrlName + \'").effect("Turbulent Amount")("Slider");\';\n';
        c += '                        turb.property("ADBE Turbulent Displace-0003").expression = \'thisComp.layer("\' + ctrlName + \'").effect("Turbulent Size")("Slider");\';\n';
        c += '                        turb.property("ADBE Turbulent Displace-0006").expression = \'var freq = thisComp.layer("\' + ctrlName + \'").effect("Glitch Frequency")("Slider"); time * freq * 100;\';\n';
        c += '                    } catch(e) {}\n';
        c += '                }\n';
        c += '            }\n';
        c += '            applied++;\n';
        c += '        } catch (e) { _noteFailure(e); }\n';
        c += '    }\n';
        c += '}\n';
        return c;
    })()
};

// =====================================================================
// 9. STOMP — Heavy impact scale + screen shake
// =====================================================================
window.STYLES['stomp'] = {
    displayName: 'Stomp',
    description: 'Heavy impact',
    previewLabel: 'HIT',

    extendScriptControls: [
        'var stompScale = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'stompScale.name = "Impact Scale"; stompScale.property("Slider").setValue(300);',
        'var stompSpeed = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'stompSpeed.name = "Impact Speed"; stompSpeed.property("Slider").setValue(0.15);',
        'var shakeAmount = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'shakeAmount.name = "Screen Shake"; shakeAmount.property("Slider").setValue(15);'
    ].join('\n'),

    extendScriptApply: (function() {
        var c = '';
        c += 'for (var i = 1; i <= comp.numLayers; i++) {\n';
        c += '    var layer = comp.layer(i);\n';
        c += '    if (_isTargetLayer(layer)) {\n';
        c += '        try {\n';
        c += '            try { layer.parent = controller; } catch(e) {}\n';
        c += '            layer.property("Transform").property("Scale").expression =\n';
        c += '                \'var ctrl = thisComp.layer("\' + ctrlName + \'");var is = ctrl.effect("Impact Scale")("Slider");var sp = ctrl.effect("Impact Speed")("Slider");var ls = inPoint;var ae = ls+sp;var bo = ls+sp*2;if (time < ls) [is,is]; else if (time < ae) { var t=(time-ls)/sp; var s=easeOut(t,is,95); [s,s]; } else if (time < bo) { var t=(time-ae)/sp; var s=easeOut(t,95,100); [s,s]; } else [100,100];\';\n';
        c += '            layer.property("Transform").property("Position").expression =\n';
        c += '                \'var ctrl = thisComp.layer("\' + ctrlName + \'");var shake = ctrl.effect("Screen Shake")("Slider");var sp = ctrl.effect("Impact Speed")("Slider");var ls = inPoint;var se = ls+sp*3;if (time > ls && time < se) { var decay = 1-(time-ls)/(sp*3); seedRandom(Math.floor(time*50),true); value+[random(-shake,shake)*decay, random(-shake,shake)*decay]; } else value;\';\n';
        c += '            layer.property("Transform").property("Opacity").expression =\n';
        c += '                \'var ls = inPoint;var le = outPoint;if (time < ls) 0;else if (time < ls+0.08) easeOut((time-ls)/0.08, 0, 100);else if (time < le-0.1) 100;else if (time < le) easeIn((time-(le-0.1))/0.1, 100, 0);else 0;\';\n';
        c += '            applied++;\n';
        c += '        } catch (e) { _noteFailure(e); }\n';
        c += '    }\n';
        c += '}\n';
        return c;
    })()
};

// =====================================================================
// 10. COLOR POP — Colorful word pop with Fill effect
// =====================================================================
window.STYLES['color-pop'] = {
    displayName: 'Color Pop',
    description: 'Colorful word pop',
    previewLabel: 'POP',

    extendScriptControls: [
        'var popScale = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'popScale.name = "Pop Scale"; popScale.property("Slider").setValue(130);',
        'var popSpeed = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'popSpeed.name = "Pop Speed"; popSpeed.property("Slider").setValue(0.3);',
        'var color1 = controller.property("ADBE Effect Parade").addProperty("ADBE Color Control");',
        'color1.name = "Color 1"; color1.property("Color").setValue([1, 0.42, 0.42, 1]);',
        'var color2 = controller.property("ADBE Effect Parade").addProperty("ADBE Color Control");',
        'color2.name = "Color 2"; color2.property("Color").setValue([0.31, 0.8, 0.77, 1]);',
        'var color3 = controller.property("ADBE Effect Parade").addProperty("ADBE Color Control");',
        'color3.name = "Color 3"; color3.property("Color").setValue([1, 0.85, 0.3, 1]);'
    ].join('\n'),

    extendScriptApply: (function() {
        var c = '';
        c += 'for (var i = 1; i <= comp.numLayers; i++) {\n';
        c += '    var layer = comp.layer(i);\n';
        c += '    if (_isTargetLayer(layer)) {\n';
        c += '        try {\n';
        c += '            try { layer.parent = controller; } catch(e) {}\n';
        c += '            layer.property("Transform").property("Scale").expression =\n';
        c += '                \'var ctrl = thisComp.layer("\' + ctrlName + \'");var ps = ctrl.effect("Pop Scale")("Slider");var sp = ctrl.effect("Pop Speed")("Slider");var ls = inPoint;var ae = ls + sp;if (time < ls) [ps,ps]; else if (time < ae) { var t = (time-ls)/sp; var s = easeOut(t, ps, 100) + Math.sin(t*Math.PI*2)*8*(1-t); [s,s]; } else [100,100];\';\n';
        c += '            var fx = layer.property("ADBE Effect Parade");\n';
        c += '            var fillEff = fx.addProperty("ADBE Fill");\n';
        c += '            fillEff.property("ADBE Fill-0002").expression =\n';
        c += '                \'var ctrl = thisComp.layer("\' + ctrlName + \'");var idx = index % 3;if (idx == 0) ctrl.effect("Color 1")("Color"); else if (idx == 1) ctrl.effect("Color 2")("Color"); else ctrl.effect("Color 3")("Color");\';\n';
        c += '            layer.property("Transform").property("Opacity").expression =\n';
        c += '                \'var ls = inPoint; var le = outPoint;if (time < ls+0.15) easeOut((time-ls)/0.15, 0, 100);else if (time < le-0.15) 100;else if (time < le) easeIn((time-(le-0.15))/0.15, 100, 0);else 0;\';\n';
        c += '            applied++;\n';
        c += '        } catch (e) { _noteFailure(e); }\n';
        c += '    }\n';
        c += '}\n';
        return c;
    })()
};


// =====================================================================
// 11. BOUNCE — Spring in with overshoot
// =====================================================================
window.STYLES['bounce'] = {
    displayName: 'Bounce',
    description: 'Spring in',
    previewLabel: 'Boing',

    extendScriptControls: [
        'var bounceHeight = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'bounceHeight.name = "Bounce Height"; bounceHeight.property("Slider").setValue(100);',
        'var animSpeed = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'animSpeed.name = "Animation Speed"; animSpeed.property("Slider").setValue(0.6);'
    ].join('\n'),

    extendScriptApply: (function() {
        var c = '';
        c += 'for (var i = 1; i <= comp.numLayers; i++) {\n';
        c += '    var layer = comp.layer(i);\n';
        c += '    if (_isTargetLayer(layer)) {\n';
        c += '        try {\n';
        c += '            try { layer.parent = controller; } catch(e) {}\n';
        c += '            layer.property("Transform").property("Position").expression =\n';
        c += '                \'ctrl = thisComp.layer("\' + ctrlName + \'");\' +\n';
        c += '                \'bounceHeight = ctrl.effect("Bounce Height")("Slider");\' +\n';
        c += '                \'animSpeed = ctrl.effect("Animation Speed")("Slider");\' +\n';
        c += '                \'layerStart = inPoint; animEnd = layerStart + animSpeed;\' +\n';
        c += '                \'originalY = value[1];\' +\n';
        c += '                \'if (time < layerStart) { [value[0], originalY + bounceHeight]; }\' +\n';
        c += '                \'else if (time < animEnd) {\' +\n';
        c += '                \'t = (time - layerStart) / animSpeed;\' +\n';
        c += '                \'bounce = Math.sin(t * Math.PI) * Math.pow(1 - t, 2) * bounceHeight;\' +\n';
        c += '                \'[value[0], originalY + bounce]; } else { [value[0], originalY]; }\';\n';
        c += '            layer.property("Transform").property("Scale").expression =\n';
        c += '                \'animSpeed = 0.5; layerStart = inPoint; animEnd = layerStart + animSpeed;\' +\n';
        c += '                \'if (time < layerStart) { [80, 80]; }\' +\n';
        c += '                \'else if (time < animEnd) {\' +\n';
        c += '                \'t = (time - layerStart) / animSpeed;\' +\n';
        c += '                \'overshoot = 1 + Math.sin(t * Math.PI * 3) * 0.1 * (1 - t);\' +\n';
        c += '                \'scale = easeOut(t, 80, 100) * overshoot; [scale, scale]; }\' +\n';
        c += '                \'else { [100, 100]; }\';\n';
        c += '            applied++;\n';
        c += '        } catch (e) { _noteFailure(e); }\n';
        c += '    }\n';
        c += '}\n';
        return c;
    })()
};

// =====================================================================
// 12. SLIDE & SCALE — Slide from side with scale
// =====================================================================
window.STYLES['slide-scale'] = {
    displayName: 'Slide & Scale',
    description: 'Slide from side',
    previewLabel: 'Slide',

    extendScriptControls: [
        'var slideDistance = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'slideDistance.name = "Slide Distance"; slideDistance.property("Slider").setValue(200);',
        'var slideDirection = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'slideDirection.name = "Slide Direction"; slideDirection.property("Slider").setValue(-1);',
        'var animSpeed = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'animSpeed.name = "Animation Speed"; animSpeed.property("Slider").setValue(0.5);',
        'var scaleAmount = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'scaleAmount.name = "Scale Amount"; scaleAmount.property("Slider").setValue(110);'
    ].join('\n'),

    extendScriptApply: (function() {
        var c = '';
        c += 'for (var i = 1; i <= comp.numLayers; i++) {\n';
        c += '    var layer = comp.layer(i);\n';
        c += '    if (_isTargetLayer(layer)) {\n';
        c += '        try {\n';
        c += '            try { layer.parent = controller; } catch(e) {}\n';
        c += '            layer.property("Transform").property("Position").expression =\n';
        c += '                \'ctrl = thisComp.layer("\' + ctrlName + \'");\' +\n';
        c += '                \'slideDistance = ctrl.effect("Slide Distance")("Slider");\' +\n';
        c += '                \'direction = ctrl.effect("Slide Direction")("Slider");\' +\n';
        c += '                \'animSpeed = ctrl.effect("Animation Speed")("Slider");\' +\n';
        c += '                \'layerStart = inPoint; animEnd = layerStart + animSpeed; originalX = value[0];\' +\n';
        c += '                \'if (time < layerStart) { [originalX + (slideDistance * direction), value[1]]; }\' +\n';
        c += '                \'else if (time < animEnd) { t = (time - layerStart) / animSpeed;\' +\n';
        c += '                \'offsetX = easeOut(t, slideDistance * direction, 0); [originalX + offsetX, value[1]]; }\' +\n';
        c += '                \'else { [originalX, value[1]]; }\';\n';
        c += '            layer.property("Transform").property("Scale").expression =\n';
        c += '                \'ctrl = thisComp.layer("\' + ctrlName + \'");\' +\n';
        c += '                \'scaleAmount = ctrl.effect("Scale Amount")("Slider");\' +\n';
        c += '                \'animSpeed = ctrl.effect("Animation Speed")("Slider");\' +\n';
        c += '                \'layerStart = inPoint; animEnd = layerStart + animSpeed;\' +\n';
        c += '                \'if (time < layerStart) { [70, 70]; }\' +\n';
        c += '                \'else if (time < animEnd) { t = (time - layerStart) / animSpeed;\' +\n';
        c += '                \'scale = easeOut(t, 70, scaleAmount); [scale, scale]; }\' +\n';
        c += '                \'else if (time < layerStart + animSpeed + 0.2) {\' +\n';
        c += '                \'t = (time - animEnd) / 0.2; scale = easeIn(t, scaleAmount, 100); [scale, scale]; }\' +\n';
        c += '                \'else { [100, 100]; }\';\n';
        c += '            layer.property("Transform").property("Opacity").expression =\n';
        c += '                \'animSpeed = 0.3; layerStart = inPoint; layerEnd = outPoint;\' +\n';
        c += '                \'animEnd = layerStart + animSpeed; fadeOut = 0.2;\' +\n';
        c += '                \'if (time < layerStart) 0;\' +\n';
        c += '                \'else if (time < animEnd) easeOut((time - layerStart) / animSpeed, 0, 100);\' +\n';
        c += '                \'else if (time < layerEnd - fadeOut) 100;\' +\n';
        c += '                \'else if (time < layerEnd) easeIn((time - (layerEnd - fadeOut)) / fadeOut, 100, 0);\' +\n';
        c += '                \'else 0;\';\n';
        c += '            applied++;\n';
        c += '        } catch (e) { _noteFailure(e); }\n';
        c += '    }\n';
        c += '}\n';
        return c;
    })()
};

// =====================================================================
// 13. FADE & LIFT — Rise up softly with blur
// =====================================================================
window.STYLES['fade-lift'] = {
    displayName: 'Fade & Lift',
    description: 'Rise up softly',
    previewLabel: 'Lift',

    extendScriptControls: [
        'var liftDistance = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'liftDistance.name = "Lift Distance"; liftDistance.property("Slider").setValue(50);',
        'var liftSpeed = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'liftSpeed.name = "Lift Speed"; liftSpeed.property("Slider").setValue(0.8);',
        'var softBlur = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'softBlur.name = "Soft Blur"; softBlur.property("Slider").setValue(5);'
    ].join('\n'),

    extendScriptApply: (function() {
        var c = '';
        c += 'for (var i = 1; i <= comp.numLayers; i++) {\n';
        c += '    var layer = comp.layer(i);\n';
        c += '    if (_isTargetLayer(layer)) {\n';
        c += '        try {\n';
        c += '            try { layer.parent = controller; } catch(e) {}\n';
        c += '            layer.property("Transform").property("Position").expression =\n';
        c += '                \'ctrl = thisComp.layer("\' + ctrlName + \'");\' +\n';
        c += '                \'liftDistance = ctrl.effect("Lift Distance")("Slider");\' +\n';
        c += '                \'liftSpeed = ctrl.effect("Lift Speed")("Slider");\' +\n';
        c += '                \'layerStart = inPoint; animEnd = layerStart + liftSpeed; originalY = value[1];\' +\n';
        c += '                \'if (time < layerStart) { [value[0], originalY + liftDistance]; }\' +\n';
        c += '                \'else if (time < animEnd) { t = (time - layerStart) / liftSpeed;\' +\n';
        c += '                \'offsetY = easeOut(t, liftDistance, 0); [value[0], originalY + offsetY]; }\' +\n';
        c += '                \'else { [value[0], originalY]; }\';\n';
        c += '            layer.property("Transform").property("Opacity").expression =\n';
        c += '                \'ctrl = thisComp.layer("\' + ctrlName + \'");\' +\n';
        c += '                \'liftSpeed = ctrl.effect("Lift Speed")("Slider");\' +\n';
        c += '                \'layerStart = inPoint; layerEnd = outPoint;\' +\n';
        c += '                \'animEnd = layerStart + liftSpeed; fadeOut = 0.3;\' +\n';
        c += '                \'if (time < layerStart) 0;\' +\n';
        c += '                \'else if (time < animEnd) easeOut((time - layerStart) / liftSpeed, 0, 100);\' +\n';
        c += '                \'else if (time < layerEnd - fadeOut) 100;\' +\n';
        c += '                \'else if (time < layerEnd) easeIn((time - (layerEnd - fadeOut)) / fadeOut, 100, 0);\' +\n';
        c += '                \'else 0;\';\n';
        c += '            var flfx = layer.property("ADBE Effect Parade");\n';
        c += '            if (flfx) {\n';
        c += '                var flBlur = flfx.addProperty("ADBE Gaussian Blur 2");\n';
        c += '                if (flBlur) {\n';
        c += '                    flBlur.property("Blurriness").expression =\n';
        c += '                        \'var ctrl = thisComp.layer("\' + ctrlName + \'");\' +\n';
        c += '                        \'var softBlur = ctrl.effect("Soft Blur")("Slider");\' +\n';
        c += '                        \'var liftSpeed = ctrl.effect("Lift Speed")("Slider");\' +\n';
        c += '                        \'var layerStart = inPoint; var animEnd = layerStart + liftSpeed;\' +\n';
        c += '                        \'if (time < layerStart) softBlur;\' +\n';
        c += '                        \'else if (time < animEnd) easeOut((time - layerStart) / liftSpeed, softBlur, 0);\' +\n';
        c += '                        \'else 0;\';\n';
        c += '                }\n';
        c += '            }\n';
        c += '            applied++;\n';
        c += '        } catch (e) { _noteFailure(e); }\n';
        c += '    }\n';
        c += '}\n';
        return c;
    })()
};

// =====================================================================
// 14. CINEMA — Letterbox bars + tracking animation
// =====================================================================
window.STYLES['cinema'] = {
    displayName: 'Cinema',
    description: 'Letterbox cinematic',
    previewLabel: 'CUT',

    extendScriptControls: [
        'var barHeight = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'barHeight.name = "Bar Height"; barHeight.property("Slider").setValue(120);',
        'var barColor = controller.property("ADBE Effect Parade").addProperty("ADBE Color Control");',
        'barColor.name = "Bar Color"; barColor.property("Color").setValue([0, 0, 0, 1]);',
        'var trackingStart = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'trackingStart.name = "Tracking Start"; trackingStart.property("Slider").setValue(80);',
        'var trackingEnd = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'trackingEnd.name = "Tracking End"; trackingEnd.property("Slider").setValue(25);',
        'var animSpeed = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'animSpeed.name = "Animation Speed"; animSpeed.property("Slider").setValue(0.8);'
    ].join('\n'),

    extendScriptApply: (function() {
        var c = '';
        // Create letterbox bars
        c += 'var barsExist = false;\n';
        c += 'for (var bi = 1; bi <= comp.numLayers; bi++) { if (comp.layer(bi).name === "StyleCtrl_cinema_Bars") { barsExist = true; break; } }\n';
        c += 'if (!barsExist) {\n';
        c += '    var barLayer = comp.layers.addShape();\n';
        c += '    barLayer.name = "StyleCtrl_cinema_Bars";\n';
        c += '    barLayer.startTime = comp.workAreaStart;\n';
        c += '    barLayer.outPoint = comp.workAreaStart + comp.workAreaDuration;\n';
        c += '    barLayer.label = 5;\n';
        c += '    barLayer.property("Anchor Point").setValue([0, 0]);\n';
        c += '    barLayer.property("Position").setValue([0, 0]);\n';
        c += '    var contents = barLayer.property("Contents");\n';
        // Top bar
        c += '    var topGrp = contents.addProperty("ADBE Vector Group"); topGrp.name = "Top Bar";\n';
        c += '    var topGC = topGrp.property("Contents");\n';
        c += '    var topRect = topGC.addProperty("ADBE Vector Shape - Rect");\n';
        c += '    topRect.property("ADBE Vector Rect Size").expression = \'var ctrl = thisComp.layer("\' + ctrlName + \'"); var h = ctrl.effect("Bar Height")("Slider"); [thisComp.width, h];\';\n';
        c += '    topRect.property("ADBE Vector Rect Position").expression = \'var ctrl = thisComp.layer("\' + ctrlName + \'"); var h = ctrl.effect("Bar Height")("Slider"); [thisComp.width / 2, h / 2];\';\n';
        c += '    var topFill = topGC.addProperty("ADBE Vector Graphic - Fill");\n';
        c += '    topFill.property("ADBE Vector Fill Color").expression = \'thisComp.layer("\' + ctrlName + \'").effect("Bar Color")("Color");\';\n';
        // Bottom bar
        c += '    var botGrp = contents.addProperty("ADBE Vector Group"); botGrp.name = "Bottom Bar";\n';
        c += '    var botGC = botGrp.property("Contents");\n';
        c += '    var botRect = botGC.addProperty("ADBE Vector Shape - Rect");\n';
        c += '    botRect.property("ADBE Vector Rect Size").expression = \'var ctrl = thisComp.layer("\' + ctrlName + \'"); var h = ctrl.effect("Bar Height")("Slider"); [thisComp.width, h];\';\n';
        c += '    botRect.property("ADBE Vector Rect Position").expression = \'var ctrl = thisComp.layer("\' + ctrlName + \'"); var h = ctrl.effect("Bar Height")("Slider"); [thisComp.width / 2, thisComp.height - h / 2];\';\n';
        c += '    var botFill = botGC.addProperty("ADBE Vector Graphic - Fill");\n';
        c += '    botFill.property("ADBE Vector Fill Color").expression = \'thisComp.layer("\' + ctrlName + \'").effect("Bar Color")("Color");\';\n';
        c += '    barLayer.moveToBeginning();\n';
        c += '}\n';
        // Apply to text layers
        c += 'for (var i = 1; i <= comp.numLayers; i++) {\n';
        c += '    var layer = comp.layer(i);\n';
        c += '    if (_isTargetLayer(layer)) {\n';
        c += '        try {\n';
        c += '            try { layer.parent = controller; } catch(e) {}\n';
        // Uppercase text
        c += '            try { var td = layer.property("Source Text").value; td.allCaps = true; layer.property("Source Text").setValue(td); } catch(e) {}\n';
        // Tracking animator
        c += '            var textProps = layer.property("ADBE Text Properties");\n';
        c += '            var animators = textProps.property("ADBE Text Animators");\n';
        c += '            var animator = animators.addProperty("ADBE Text Animator"); animator.name = "Cinema Tracking";\n';
        c += '            var selectors = animator.property("ADBE Text Selectors");\n';
        c += '            var rangeSelector = selectors.addProperty("ADBE Text Selector");\n';
        c += '            rangeSelector.property("ADBE Text Percent Start").setValue(0);\n';
        c += '            rangeSelector.property("ADBE Text Percent End").setValue(100);\n';
        c += '            var animProps = animator.property("ADBE Text Animator Properties");\n';
        c += '            var trackingProp = animProps.addProperty("ADBE Text Tracking Amount");\n';
        c += '            trackingProp.expression = \'var ctrl = thisComp.layer("\' + ctrlName + \'"); var ts = ctrl.effect("Tracking Start")("Slider"); var te = ctrl.effect("Tracking End")("Slider"); var sp = ctrl.effect("Animation Speed")("Slider"); var ls = thisLayer.inPoint; var ae = ls + sp; if (time < ls) ts; else if (time < ae) { var t = (time - ls) / sp; easeOut(t, ts, te); } else te;\';\n';
        c += '            layer.property("Transform").property("Scale").expression =\n';
        c += '                \'var ctrl = thisComp.layer("\' + ctrlName + \'"); var sp = ctrl.effect("Animation Speed")("Slider"); var ls = inPoint; var ae = ls + sp;\' +\n';
        c += '                \'if (time < ls) [92, 92]; else if (time < ae) { var t = (time - ls) / sp; var s = easeOut(t, 92, 100); [s, s]; } else [100, 100];\';\n';
        c += '            layer.property("Transform").property("Opacity").expression =\n';
        c += '                \'var ctrl = thisComp.layer("\' + ctrlName + \'"); var sp = ctrl.effect("Animation Speed")("Slider"); var ls = inPoint; var le = outPoint;\' +\n';
        c += '                \'var fi = sp * 0.6; var fo = 0.3;\' +\n';
        c += '                \'if (time < ls + fi) easeOut((time - ls) / fi, 0, 100);\' +\n';
        c += '                \'else if (time < le - fo) 100;\' +\n';
        c += '                \'else if (time < le) easeIn((time - (le - fo)) / fo, 100, 0);\' +\n';
        c += '                \'else 0;\';\n';
        c += '            applied++;\n';
        c += '        } catch (e) { _noteFailure(e); }\n';
        c += '    }\n';
        c += '}\n';
        return c;
    })()
};

// =====================================================================
// 15. GRAVITY DROP — Fall + bounce physics
// =====================================================================
window.STYLES['gravity-drop'] = {
    displayName: 'Gravity Drop',
    description: 'Fall + bounce',
    previewLabel: 'DROP',

    extendScriptControls: [
        'var dropHeight = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'dropHeight.name = "Drop Height"; dropHeight.property("Slider").setValue(400);',
        'var bounceCount = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'bounceCount.name = "Bounce Count"; bounceCount.property("Slider").setValue(3);',
        'var bounceDamping = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'bounceDamping.name = "Bounce Damping"; bounceDamping.property("Slider").setValue(0.45);',
        'var dropDuration = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'dropDuration.name = "Drop Duration"; dropDuration.property("Slider").setValue(0.5);',
        'var squashAmount = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'squashAmount.name = "Squash Amount"; squashAmount.property("Slider").setValue(25);'
    ].join('\n'),

    extendScriptApply: (function() {
        var c = '';
        c += 'for (var i = 1; i <= comp.numLayers; i++) {\n';
        c += '    var layer = comp.layer(i);\n';
        c += '    if (_isTargetLayer(layer)) {\n';
        c += '        try {\n';
        c += '            try { layer.parent = controller; } catch(e) {}\n';
        // Position: gravity + bounces
        c += '            layer.property("Transform").property("Position").expression =\n';
        c += '                \'var ctrl = thisComp.layer("\' + ctrlName + \'");\' +\n';
        c += '                \'var h = ctrl.effect("Drop Height")("Slider");\' +\n';
        c += '                \'var bc = Math.round(ctrl.effect("Bounce Count")("Slider"));\' +\n';
        c += '                \'var damp = ctrl.effect("Bounce Damping")("Slider");\' +\n';
        c += '                \'var dur = ctrl.effect("Drop Duration")("Slider");\' +\n';
        c += '                \'var ls = inPoint; var t = time - ls; var yOff = -h;\' +\n';
        c += '                \'if (t < 0) { yOff = -h; }\' +\n';
        c += '                \'else if (t < dur) { var p = t / dur; yOff = -h * (1 - p * p); }\' +\n';
        c += '                \'else { var elapsed = t - dur; var bounceH = h; yOff = 0;\' +\n';
        c += '                \'for (var b = 0; b < bc; b++) { bounceH *= damp;\' +\n';
        c += '                \'var bounceDur = dur * Math.pow(damp, b + 1) * 2;\' +\n';
        c += '                \'if (elapsed < bounceDur) { var bp = elapsed / bounceDur;\' +\n';
        c += '                \'yOff = -bounceH * 4 * bp * (1 - bp); break; } elapsed -= bounceDur; } }\' +\n';
        c += '                \'[value[0], value[1] + yOff];\';\n';
        // Scale: squash
        c += '            layer.property("Transform").property("Scale").expression =\n';
        c += '                \'var ctrl = thisComp.layer("\' + ctrlName + \'");\' +\n';
        c += '                \'var sq = ctrl.effect("Squash Amount")("Slider");\' +\n';
        c += '                \'var dur = ctrl.effect("Drop Duration")("Slider");\' +\n';
        c += '                \'var ls = inPoint; var t = time - ls; var sx = 100; var sy = 100;\' +\n';
        c += '                \'if (t >= dur * 0.8 && t < dur + 0.08) {\' +\n';
        c += '                \'var imp = 0; if (t < dur) imp = (t - dur * 0.8) / (dur * 0.2);\' +\n';
        c += '                \'else imp = 1 - (t - dur) / 0.08;\' +\n';
        c += '                \'imp = Math.max(0, Math.min(1, imp));\' +\n';
        c += '                \'sx = 100 + sq * imp; sy = 100 - sq * 0.7 * imp; }\' +\n';
        c += '                \'[sx, sy];\';\n';
        // Opacity
        c += '            layer.property("Transform").property("Opacity").expression =\n';
        c += '                \'var dur = thisComp.layer("\' + ctrlName + \'").effect("Drop Duration")("Slider");\' +\n';
        c += '                \'var ls = inPoint; var le = outPoint;\' +\n';
        c += '                \'if (time < ls) 0;\' +\n';
        c += '                \'else if (time < ls + dur * 0.3) easeOut((time - ls) / (dur * 0.3), 0, 100);\' +\n';
        c += '                \'else if (time < le - 0.15) 100;\' +\n';
        c += '                \'else if (time < le) easeIn((time - (le - 0.15)) / 0.15, 100, 0);\' +\n';
        c += '                \'else 0;\';\n';
        // Drop shadow
        c += '            try { var fx = layer.property("ADBE Effect Parade"); var ds = fx.addProperty("ADBE Drop Shadow");\n';
        c += '                ds.property("ADBE Drop Shadow-0001").setValue([0, 0, 0, 1]);\n';
        c += '                ds.property("ADBE Drop Shadow-0002").setValue(160);\n';
        c += '                ds.property("ADBE Drop Shadow-0004").setValue(5);\n';
        c += '                ds.property("ADBE Drop Shadow-0005").setValue(4);\n';
        c += '            } catch(e4) {}\n';
        c += '            applied++;\n';
        c += '        } catch (e) { _noteFailure(e); }\n';
        c += '    }\n';
        c += '}\n';
        return c;
    })()
};


// =====================================================================
// 16. WORD HIGHLIGHT — Color highlight on active word + black stroke
// =====================================================================
window.STYLES['word-highlight'] = {
    displayName: 'Word Highlight',
    description: 'Color active word',
    previewLabel: 'SAY',
    needsWordData: true,

    extendScriptControls: [
        'var highlightColor = controller.property("ADBE Effect Parade").addProperty("ADBE Color Control");',
        'highlightColor.name = "Highlight Color";',
        'highlightColor.property("Color").setValue([1, 0.84, 0, 1]);',
        '',
        'var baseColor = controller.property("ADBE Effect Parade").addProperty("ADBE Color Control");',
        'baseColor.name = "Base Color";',
        'baseColor.property("Color").setValue([1, 1, 1, 1]);',
        '',
        'var strokeWidth = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");',
        'strokeWidth.name = "Stroke Width";',
        'strokeWidth.property("Slider").setValue(10);',
        '',
        'var strokeColor = controller.property("ADBE Effect Parade").addProperty("ADBE Color Control");',
        'strokeColor.name = "Stroke Color";',
        'strokeColor.property("Color").setValue([0, 0, 0, 1]);'
    ].join('\n'),

    extendScriptApply: null  // Set below
};

// ==================== WORD-HIGHLIGHT APPLY CODE ====================
window.STYLES['word-highlight'].extendScriptApply = (function() {
    var c = '';
    c += 'var textLayers = [];\n';
    c += 'for (var i = 1; i <= comp.numLayers; i++) { var layer = comp.layer(i); if (_isTargetLayer(layer)) textLayers.push(layer); }\n';
    c += 'var hasWordData = (typeof _wordData !== "undefined") && _wordData && _wordData.length > 0;\n';
    c += 'for (var j = 0; j < textLayers.length; j++) {\n';
    c += '    var layer = textLayers[j];\n';
    c += '    try {\n';
    c += '        var layerName = layer.name;\n';
    c += '        try { layer.parent = controller; } catch(e) {}\n';
    // Set initial text properties: white fill, black stroke 10px, stroke enabled
    c += '        try {\n';
    c += '            var _td = layer.property("Source Text").value;\n';
    c += '            _td.fillColor = [1, 1, 1];\n';
    c += '            _td.applyStroke = true;\n';
    c += '            _td.strokeColor = [0, 0, 0];\n';
    c += '            _td.strokeWidth = 12;\n';
    c += '            _td.strokeOverFill = false;\n';
    c += '            try { _td.allCaps = true; } catch(e) {}\n';
    c += '            layer.property("Source Text").setValue(_td);\n';
    c += '        } catch(e) {}\n';
    // Set "All Fills Over All Strokes" via Inter-character Blending (value 2)
    c += '        try {\n';
    c += '            var textOptions = layer.property("ADBE Text Properties").property("ADBE Text More Options");\n';
    c += '            if (textOptions) { textOptions.property("ADBE Text Render Order").setValue(2); }\n';
    c += '        } catch(e) {}\n';
    c += '        var layerStart = layer.inPoint; var layerEnd = layer.outPoint;\n';
    c += '        var layerWordData = null;\n';
    c += '        if (hasWordData) { var tolerance = 0.05; for (var wd = 0; wd < _wordData.length; wd++) { if (Math.abs(_wordData[wd].start - layerStart) < tolerance) { layerWordData = _wordData[wd]; break; } } }\n';
    c += '        var srcText = layer.property("Source Text").value;\n';
    c += '        var fullText = srcText.text;\n';
    c += '        var layerWords = fullText.split(" ");\n';
    c += '        var numWords = layerWords.length;\n';
    c += '        var totalChars = fullText.length;\n';
    // Calculate per-word character start% and end%
    c += '        var wordStartPcts = []; var wordEndPcts = []; var cumChars = 0;\n';
    c += '        for (var wi = 0; wi < layerWords.length; wi++) {\n';
    c += '            wordStartPcts.push((cumChars / totalChars) * 100);\n';
    c += '            cumChars += layerWords[wi].length;\n';
    c += '            wordEndPcts.push((cumChars / totalChars) * 100);\n';
    c += '            if (wi < layerWords.length - 1) cumChars += 1;\n';
    c += '        }\n';
    // ── Animator 1: "Stroke Control" — applies to ALL chars (100%), controls stroke color + width from controller
    c += '        var textProps = layer.property("ADBE Text Properties"); var animators = textProps.property("ADBE Text Animators");\n';
    c += '        var strokeAnim = animators.addProperty("ADBE Text Animator"); strokeAnim.name = "Stroke Control";\n';
    c += '        var strokeSel = strokeAnim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");\n';
    c += '        strokeSel.property("ADBE Text Percent Start").setValue(0);\n';
    c += '        strokeSel.property("ADBE Text Percent End").setValue(100);\n';
    c += '        var strokeAnimProps = strokeAnim.property("ADBE Text Animator Properties");\n';
    c += '        var strokeColorProp = strokeAnimProps.addProperty("ADBE Text Stroke Color");\n';
    c += '        strokeColorProp.expression = \'thisComp.layer("\' + ctrlName + \'").effect("Stroke Color")("Color");\';\n';
    c += '        var strokeWidthProp = strokeAnimProps.addProperty("ADBE Text Stroke Width");\n';
    c += '        strokeWidthProp.expression = \'thisComp.layer("\' + ctrlName + \'").effect("Stroke Width")("Slider") - 10;\';\n';
    // Note: Text Animator Stroke Width is ADDITIVE (offset from base), so we subtract the initial 10
    // ── Animator 2: "Base Fill" — applies to ALL chars, sets fill color from controller
    c += '        var baseAnim = animators.addProperty("ADBE Text Animator"); baseAnim.name = "Base Fill";\n';
    c += '        var baseSel = baseAnim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");\n';
    c += '        baseSel.property("ADBE Text Percent Start").setValue(0);\n';
    c += '        baseSel.property("ADBE Text Percent End").setValue(100);\n';
    c += '        var baseAnimProps = baseAnim.property("ADBE Text Animator Properties");\n';
    c += '        var baseFillProp = baseAnimProps.addProperty("ADBE Text Fill Color");\n';
    c += '        baseFillProp.expression = \'thisComp.layer("\' + ctrlName + \'").effect("Base Color")("Color");\';\n';
    // ── Animator 3: "Word Highlight" — only active word, overrides fill color to Highlight Color
    c += '        var hlAnim = animators.addProperty("ADBE Text Animator"); hlAnim.name = "Word Highlight";\n';
    c += '        var hlSel = hlAnim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");\n';
    c += '        var startProp = hlSel.property("ADBE Text Percent Start");\n';
    c += '        var endProp = hlSel.property("ADBE Text Percent End");\n';
    // Keyframe Start and End to jump per word
    c += '        if (layerWordData && layerWordData.words && layerWordData.words.length > 1) {\n';
    c += '            startProp.setValueAtTime(layerStart, 0); endProp.setValueAtTime(layerStart, wordEndPcts[0]);\n';
    c += '            for (var wk = 0; wk < layerWordData.words.length; wk++) {\n';
    c += '                var sp = (wk < wordStartPcts.length) ? wordStartPcts[wk] : 0;\n';
    c += '                var ep = (wk < wordEndPcts.length) ? wordEndPcts[wk] : 100;\n';
    c += '                startProp.setValueAtTime(layerWordData.words[wk].start, sp);\n';
    c += '                endProp.setValueAtTime(layerWordData.words[wk].start, ep);\n';
    c += '            }\n';
    c += '        } else {\n';
    c += '            var wordDur = (layerEnd - layerStart) / numWords;\n';
    c += '            for (var wk = 0; wk < numWords; wk++) {\n';
    c += '                startProp.setValueAtTime(layerStart + wk * wordDur, wordStartPcts[wk]);\n';
    c += '                endProp.setValueAtTime(layerStart + wk * wordDur, wordEndPcts[wk]);\n';
    c += '            }\n';
    c += '        }\n';
    // Set HOLD interpolation so it snaps word to word
    c += '        for (var ki = 1; ki <= startProp.numKeys; ki++) { startProp.setInterpolationTypeAtKey(ki, KeyframeInterpolationType.HOLD); }\n';
    c += '        for (var ki = 1; ki <= endProp.numKeys; ki++) { endProp.setInterpolationTypeAtKey(ki, KeyframeInterpolationType.HOLD); }\n';
    // Fill Color on highlight animator = Highlight Color
    c += '        var hlAnimProps = hlAnim.property("ADBE Text Animator Properties");\n';
    c += '        var hlFillProp = hlAnimProps.addProperty("ADBE Text Fill Color");\n';
    c += '        hlFillProp.expression = \'thisComp.layer("\' + ctrlName + \'").effect("Highlight Color")("Color");\';\n';
    // Fade in/out
    c += '        layer.property("Transform").property("Opacity").expression = \'var ls = inPoint; var le = outPoint; var fi = 0.15; var fo = 0.12; if (time < ls + fi) easeOut((time - ls) / fi, 0, 100); else if (time < le - fo) 100; else if (time < le) easeIn((time - (le - fo)) / fo, 100, 0); else 0;\';\n';
    c += '        applied++;\n';
    c += '    } catch (e) { _noteFailure(e); }\n';
    c += '}\n';
    return c;
})();


// ==================== APPLY STYLE ENGINE ====================

// ==================== APPLY STYLE ====================
// target = { compItemIndex, compName } of the "sub-N" subtitles precomp.
// Every style loop below runs against THAT comp, not the active one, because
// subtitle layers now live inside the precomp.

function applySubtitleStyle(styleName, subtitleData, target) {
    return new Promise(function(resolve, reject) {
        if (!styleName || !window.STYLES[styleName]) {
            reject(new Error('Unknown style: ' + styleName));
            return;
        }

        var style = window.STYLES[styleName];

        if (style.isBase) {
            resolve(0);
            return;
        }

        if (!target || !target.compItemIndex) {
            reject(new Error('No subtitles comp to style. Create subtitles first.'));
            return;
        }

        var meta = JSON.stringify({
            compTag: target.compTag || '',
            compItemIndex: target.compItemIndex,
            compName: target.compName
        });

        var wordDataInjection = '';
        if (style.needsWordData && subtitleData && subtitleData.data) {
            var wordDataJson = JSON.stringify(subtitleData.data);
            var escaped = wordDataJson.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
            wordDataInjection = 'var _wordData = JSON.parse(\'' + escaped + '\');\n';
        }

        var script = '';
        script += '(function() {\n';
        script += '    var undoOpen = false;\n';
        script += '    try {\n';
        script += '        var comp = resolveTaggedComp(' + meta + ');\n';
        script += '        if (!comp || !(comp instanceof CompItem)) throw new Error("Cannot resolve subtitles comp");\n';
        script += '        app.beginUndoGroup("Apply Style: ' + styleName + '");\n';
        script += '        undoOpen = true;\n';
        script += '        var applied = 0;\n';
        script += '        var _targets = 0;\n';
        script += '        var _failed = 0;\n';
        script += '        var _firstError = "";\n';
        script += '\n';
        // Inside the precomp every subtitle layer is a target. No selection filtering.
        script += '        function _noteFailure(e) { _failed++; if (!_firstError) _firstError = String(e); }\n';
        script += '        function _isTargetLayer(layer) {\n';
        script += '            var n = String(layer.name);\n';
        script += '            if (n.indexOf("SubPlugin_") !== 0 && n !== "SRT_SUBTITLES") return false;\n';
        script += '            if (!layer.property("Source Text")) return false;\n';
        script += '            return true;\n';
        script += '        }\n';
        script += '\n';
        // Remove controllers / helper shapes from a previous style pass
        script += '        for (var i = comp.numLayers; i >= 1; i--) {\n';
        script += '            var lyr = comp.layer(i); var n = String(lyr.name);\n';
        script += '            if (n.indexOf("StyleCtrl_") === 0 || n.indexOf("[AC WB] ") === 0 || n.indexOf("[AC UL] ") === 0 || n.indexOf("[AC Bubble] ") === 0 || n.indexOf("[AC DV] ") === 0 || n.indexOf("StyleController_") === 0) lyr.remove();\n';
        script += '        }\n';
        // Clear expressions left by a previous style
        script += '        for (var i = 1; i <= comp.numLayers; i++) {\n';
        script += '            var lyr = comp.layer(i);\n';
        script += '            if (!_isTargetLayer(lyr)) continue;\n';
        script += '            try { var p = lyr.property("Transform").property("Scale"); if (p.expressionEnabled) { p.expression = ""; p.expressionEnabled = false; } } catch(e) {}\n';
        script += '            try { var p = lyr.property("Transform").property("Opacity"); if (p.expressionEnabled) { p.expression = ""; p.expressionEnabled = false; } p.setValue(100); } catch(e) {}\n';
        script += '            try { var p = lyr.property("Transform").property("Position"); if (p.expressionEnabled) { p.expression = ""; p.expressionEnabled = false; } } catch(e) {}\n';
        script += '            try { var p = lyr.property("Transform").property("Rotation"); if (p.expressionEnabled) { p.expression = ""; p.expressionEnabled = false; } } catch(e) {}\n';
        script += '            try { var p = lyr.property("Source Text"); if (p.expressionEnabled) { p.expression = ""; p.expressionEnabled = false; } } catch(e) {}\n';
        script += '            try { lyr.property("Transform").property("Scale").setValue([100,100]); } catch(e) {}\n';
        script += '        }\n';
        script += '\n';
        // Controller null — lives INSIDE the precomp so thisComp.layer(ctrlName) resolves
        script += '        for (var _t = 1; _t <= comp.numLayers; _t++) { if (_isTargetLayer(comp.layer(_t))) _targets++; }\n';
        script += '        var controller = comp.layers.addNull();\n';
        script += '        controller.name = "StyleCtrl_' + styleName + '";\n';
        script += '        controller.label = 5;\n';
        script += '        var ctrlName = controller.name;\n';
        script += '\n';
        script += style.extendScriptControls + '\n';
        script += '\n';
        script += wordDataInjection;
        script += style.extendScriptApply + '\n';
        script += '\n';
        // Fill & Stroke = All Fills Over All Strokes, forced on every subtitle layer.
        // Must run AFTER the style body, which rewrites the text document.
        script += '        for (var _r = 1; _r <= comp.numLayers; _r++) {\n';
        script += '            var _rl = comp.layer(_r);\n';
        script += '            if (!_isTargetLayer(_rl)) continue;\n';
        script += '            try {\n';
        script += '                var _mo = _rl.property("ADBE Text Properties").property("ADBE Text More Options");\n';
        script += '                if (_mo) _mo.property("ADBE Text Render Order").setValue(2);\n';
        script += '            } catch(_re) {}\n';
        script += '        }\n';

        // Expose controller sliders as Master Properties on the "sub-N [subscomp]"
        // layer in the parent comp, so colours can be tweaked without stepping inside.
        script += '        try {\n';
        script += '            var _eg = controller.property("ADBE Effect Parade");\n';
        script += '            if (_eg) {\n';
        script += '                for (var _e = 1; _e <= _eg.numProperties; _e++) {\n';
        script += '                    var _fx = _eg.property(_e);\n';
        script += '                    for (var _pp = 1; _pp <= _fx.numProperties; _pp++) {\n';
        script += '                        var _prop = _fx.property(_pp);\n';
        script += '                        try {\n';
        script += '                            if (_prop.canAddToMotionGraphicsTemplate && _prop.canAddToMotionGraphicsTemplate(comp)) {\n';
        script += '                                _prop.addToMotionGraphicsTemplate(comp);\n';
        script += '                            }\n';
        script += '                        } catch(_ex) {}\n';
        script += '                    }\n';
        script += '                }\n';
        script += '            }\n';
        script += '        } catch(_egErr) {}\n';
        script += '\n';
        script += '        app.endUndoGroup();\n';
        script += '        undoOpen = false;\n';
        script += '        return "SUCCESS:" + applied + "|" + _targets + "|" + _failed + "|" + _firstError;\n';
        script += '    } catch(e) {\n';
        script += '        try { if (undoOpen) app.endUndoGroup(); } catch(x) {}\n';
        script += '        return "ERROR:" + e.toString();\n';
        script += '    }\n';
        script += '})();\n';

        csInterface.evalScript(withTagResolver(script), function(result) {
            result = (result || '').replace(/^\s+|\s+$/g, '');
            if (result.indexOf('SUCCESS:') === 0) {
                var parts = result.substring(8).split('|');
                resolve({
                    applied: parseInt(parts[0], 10) || 0,
                    targets: parseInt(parts[1], 10) || 0,
                    failed: parseInt(parts[2], 10) || 0,
                    firstError: parts.slice(3).join('|') || ''
                });
            } else {
                reject(new Error(result.replace('ERROR:', '')));
            }
        });
    });
}

// ==================== RESET STYLE ====================

function resetSubtitleStyle(target) {
    return new Promise(function(resolve, reject) {
        if (!target || !target.compItemIndex) {
            reject(new Error('No subtitles comp to reset.'));
            return;
        }
        var meta = JSON.stringify({
            compTag: target.compTag || '',
            compItemIndex: target.compItemIndex,
            compName: target.compName
        });

        var script = [
            '(function() {',
            '    var undoOpen = false;',
            '    try {',
            '        var comp = resolveTaggedComp(' + meta + ');',
            '        if (!comp || !(comp instanceof CompItem)) return "ERROR:Cannot resolve subtitles comp";',
            '        app.beginUndoGroup("Reset Style");',
            '        undoOpen = true;',
            '        var reset = 0;',
            '        for (var i = 1; i <= comp.numLayers; i++) {',
            '            var layer = comp.layer(i);',
            '            var n = String(layer.name);',
            '            if (n.indexOf("SubPlugin_") !== 0 && n !== "SRT_SUBTITLES") continue;',
            '            if (!layer.property("Source Text")) continue;',
            '            try {',
            '                var props = ["Scale","Opacity","Position","Rotation"];',
            '                for (var p = 0; p < props.length; p++) {',
            '                    var pr = layer.property("Transform").property(props[p]);',
            '                    if (pr && pr.expressionEnabled) { pr.expression = ""; pr.expressionEnabled = false; }',
            '                }',
            '                var st = layer.property("Source Text");',
            '                if (st && st.expressionEnabled) { st.expression = ""; st.expressionEnabled = false; }',
            '                layer.property("Transform").property("Opacity").setValue(100);',
            '                layer.property("Transform").property("Scale").setValue([100,100]);',
            '                try { var td = st.value; td.allCaps = false; st.setValue(td); } catch(ec) {}',
            '                reset++;',
            '            } catch(ex) {}',
            '        }',
            '        for (var i = comp.numLayers; i >= 1; i--) {',
            '            var lyr = comp.layer(i); var nn = String(lyr.name);',
            '            if (nn.indexOf("StyleCtrl_") === 0 || nn.indexOf("[AC WB] ") === 0 || nn.indexOf("[AC UL] ") === 0 || nn.indexOf("[AC Bubble] ") === 0 || nn.indexOf("[AC DV] ") === 0 || nn.indexOf("StyleController_") === 0) lyr.remove();',
            '        }',
            '        app.endUndoGroup();',
            '        undoOpen = false;',
            '        return "SUCCESS:" + reset;',
            '    } catch(e) {',
            '        try { if (undoOpen) app.endUndoGroup(); } catch(x) {}',
            '        return "ERROR:" + e.toString();',
            '    }',
            '})();'
        ].join('\n');

        csInterface.evalScript(withTagResolver(script), function(result) {
            result = (result || '').replace(/^\s+|\s+$/g, '');
            if (result.indexOf('SUCCESS:') === 0) resolve(parseInt(result.substring(8), 10) || 0);
            else reject(new Error(result.replace('ERROR:', '')));
        });
    });
}

function updateStylesUIState() {
    var gallery = document.getElementById('stylesGallery');
    if (!gallery) return;
    var cards = gallery.querySelectorAll('.style-card');
    var hasData = !!window.currentSubtitleData;
    cards.forEach(function(card) {
        card.style.opacity = hasData ? '1' : '0.5';
        card.style.pointerEvents = hasData ? 'auto' : 'none';
    });
}

// ==================== STYLE GALLERY UI ====================
// The old collapsible gallery and its "Apply Selected Style" button are gone.
// Selecting a style in the picker simply records it; SNAP SUBS builds with it.
// main.js owns the picker wiring, so nothing to do here.

function updateStylesUIState() { /* no-op, kept for older callers */ }
