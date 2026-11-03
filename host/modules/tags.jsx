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
