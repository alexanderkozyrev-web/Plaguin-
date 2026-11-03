(function () {
  var TAG_LABELS = {
    comp: '[comp]',
    text: '[text]',
    speech: '[speech]',
    speechnosubs: '[speechnosubs]',
    speechlink: '[speechlink:*]',
    subs: '[subs]',
    subscomp: '[subscomp]',
    body: '[body]',
  };

  var cs = new CSInterface();
  var state = {
    selection: null,
    // Set while a hook render is running. The 2.5s selection poll calls
    // updateButtons(), which would otherwise re-enable the button mid-render.
    hookBusy: false,
  };

  var els = {
    selectionBadge: document.getElementById('selectionBadge'),
    selectionSummary: document.getElementById('selectionSummary'),
    selectionList: document.getElementById('selectionList'),
    hintLine: document.getElementById('hintLine'),
    statusLine: document.getElementById('statusLine'),
    modal: document.getElementById('analysisModal'),
    analysisContent: document.getElementById('analysisContent'),
    refreshSelection: document.getElementById('refreshSelection'),
    closeAnalysis: document.getElementById('closeAnalysis'),
    analyzeProject: document.getElementById('analyzeProject'),
    analysisTitle: document.getElementById('analysisTitle'),
    renderHook: document.getElementById('renderHook'),
    hookScope: document.getElementById('hookScope'),
    hookWhy: document.getElementById('hookWhy'),
    hookTemplates: document.getElementById('hookTemplates'),
  };

  var actionButtons = Array.prototype.slice.call(document.querySelectorAll('.action-button'));

  function setStatus(message, tone) {
    els.statusLine.textContent = message;
    els.statusLine.className = 'status-line';
    if (tone === 'ok') els.statusLine.classList.add('status-ok');
    else if (tone === 'warn') els.statusLine.classList.add('status-warn');
    else if (tone === 'error') els.statusLine.classList.add('status-error');
    else els.statusLine.classList.add('muted');
  }

  function updateHint(text) {
    els.hintLine.textContent = text || 'Hover a button to see what it does.';
  }

  function parseHostPayload(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return { ok: false, error: 'Host returned invalid JSON.', raw: raw };
    }
  }

  function callHost(method, payload) {
    return new Promise(function (resolve) {
      var argLiteral = payload === undefined ? '' : JSON.stringify(JSON.stringify(payload));
      var script = '$.global.RobertVitalik.' + method + '(' + argLiteral + ')';
      cs.evalScript(script, function (result) {
        resolve(parseHostPayload(result));
      });
    });
  }

  function evalHostRaw(script) {
    return new Promise(function (resolve) {
      cs.evalScript(script, function (result) {
        resolve(result || '');
      });
    });
  }

  function inspectHostBridge() {
    return evalHostRaw(
      '(function () {' +
      'try {' +
      'if ($.global && $.global.RobertVitalik) return "api-present";' +
      'return "api-missing";' +
      '} catch (error) {' +
      'return "api-error:" + String(error);' +
      '}' +
      '})()'
    );
  }

  async function describeHostFailure(payload) {
    if (payload && payload.error && payload.error !== 'Host returned invalid JSON.') {
      return payload.error;
    }

    var bridgeState = await inspectHostBridge();
    if (bridgeState === 'api-present') {
      if (payload && payload.raw) {
        return 'Robert_Vitalik host API returned invalid data: ' + payload.raw;
      }
      return 'Robert_Vitalik host API is loaded but not responding. Replace the installed panel files and restart After Effects.';
    }
    if (bridgeState === 'api-missing') {
      return 'Robert_Vitalik hostscript did not load. Reinstall the panel into the CEP extensions folder and restart After Effects.';
    }
    if (bridgeState.indexOf('api-error:') === 0) {
      return bridgeState.slice('api-error:'.length);
    }
    return 'Host is not available.';
  }

  function formatSelectionSummary(selection) {
    if (!selection || !selection.hasActiveComp) return 'Open a comp and select layers to start tagging.';
    if (!selection.selectedCount) return 'Active comp detected. Select one or more layers to enable tagging.';

    var pieces = [selection.activeCompName, String(selection.selectedCount) + ' selected'];
    if (selection.activeCompTagged) {
      pieces.push('[comp] render target');
    }
    if (selection.activeCompTopLevel === false) {
      pieces.push('nested comp');
    }
    if (selection.taggedSelectionCount) {
      pieces.push(String(selection.taggedSelectionCount) + ' already tagged');
    }
    return pieces.join('  |  ');
  }

  function renderSelectionList(selection) {
    els.selectionList.innerHTML = '';
    if (!selection || !selection.layers || !selection.layers.length) return;

    selection.layers.slice(0, 6).forEach(function (layer) {
      var item = document.createElement('div');
      item.className = 'selection-item';
      var title = document.createElement('strong');
      title.textContent = layer.name;
      var meta = document.createElement('span');
      var details = [layer.kindLabel];
      if (layer.tag) details.push(TAG_LABELS[layer.tag] || '[' + layer.tag + ']');
      if (layer.speechLinkId) details.push('[speechlink:' + layer.speechLinkId + ']');
      if (layer.note) details.push(layer.note);
      meta.textContent = details.join('  |  ');
      item.appendChild(title);
      item.appendChild(meta);
      els.selectionList.appendChild(item);
    });

    if (selection.layers.length > 6) {
      var extra = document.createElement('p');
      extra.className = 'muted';
      extra.textContent = '+' + String(selection.layers.length - 6) + ' more selected';
      els.selectionList.appendChild(extra);
    }
  }

  function updateButtons(selection) {
    var validation = (selection && selection.validation) || {};
    actionButtons.forEach(function (button) {
      var action = button.getAttribute('data-action');
      if (action === 'analyze') {
        button.classList.remove('is-disabled');
        button.setAttribute('aria-disabled', 'false');
        button.removeAttribute('title');
        return;
      }

      // Hook render is not a tag, so it has no entry in validation{}. It only
      // needs an open comp with at least one selected layer.
      if (action === 'hookrender') {
        var canRender = !state.hookBusy && !!(selection && selection.hasActiveComp && selection.selectedCount);
        button.classList.toggle('is-disabled', !canRender);
        button.setAttribute('aria-disabled', canRender ? 'false' : 'true');
        if (state.hookBusy) {
          button.setAttribute('title', 'Rendering...');
        } else if (!canRender) {
          button.setAttribute('title', 'Open a comp and select the hook layers first.');
        } else {
          button.removeAttribute('title');
        }
        return;
      }

      var rule = validation[action];
      var allowed = !!(rule && rule.allowed);
      button.classList.toggle('is-disabled', !allowed);
      button.setAttribute('aria-disabled', allowed ? 'false' : 'true');

      // Native tooltip explains why the button is disabled
      if (!allowed && rule && rule.reason) {
        button.setAttribute('title', rule.reason);
      } else {
        button.removeAttribute('title');
      }
    });
  }

  function renderSelection(selection) {
    state.selection = selection;
    if (!selection || !selection.ok) {
      els.selectionBadge.textContent = 'Host error';
      els.selectionBadge.className = 'pill muted';
      els.selectionSummary.textContent = 'Unable to read the current selection.';
      els.selectionList.innerHTML = '';
      updateButtons(null);
      return;
    }

    if (!selection.hasActiveComp) {
      els.selectionBadge.textContent = 'No active comp';
      els.selectionBadge.className = 'pill muted';
    } else if (!selection.selectedCount) {
      els.selectionBadge.textContent = selection.activeCompName || 'Active comp';
      els.selectionBadge.className = 'pill muted';
    } else {
      els.selectionBadge.textContent = String(selection.selectedCount) + ' layer' + (selection.selectedCount === 1 ? '' : 's');
      els.selectionBadge.className = 'pill accent-teal';
    }

    els.selectionSummary.textContent = formatSelectionSummary(selection);
    renderSelectionList(selection);
    updateButtons(selection);
  }

  function createStat(label, value) {
    var box = document.createElement('div');
    box.className = 'analysis-stat';
    var strong = document.createElement('strong');
    strong.textContent = String(value);
    var span = document.createElement('span');
    span.textContent = label;
    box.appendChild(strong);
    box.appendChild(span);
    return box;
  }

  function createSection(title, stats) {
    var section = document.createElement('section');
    section.className = 'analysis-section';
    var heading = document.createElement('h3');
    heading.textContent = title;
    var grid = document.createElement('div');
    grid.className = 'analysis-grid';
    Object.keys(stats).forEach(function (key) {
      grid.appendChild(createStat(key, stats[key]));
    });
    section.appendChild(heading);
    section.appendChild(grid);
    return section;
  }

  function createWarningsSection(warnings, omittedCount) {
    var section = document.createElement('section');
    section.className = 'analysis-section';
    var heading = document.createElement('h3');
    heading.textContent = 'Warnings';
    section.appendChild(heading);

    if (!warnings.length) {
      var empty = document.createElement('p');
      empty.className = 'warning-empty';
      empty.textContent = 'No warnings detected in the current scan.';
      section.appendChild(empty);
      return section;
    }

    var list = document.createElement('ul');
    list.className = 'warning-list';
    warnings.forEach(function (warning) {
      var item = document.createElement('li');
      item.textContent = warning;
      list.appendChild(item);
    });
    if (omittedCount > 0) {
      var more = document.createElement('li');
      more.textContent = String(omittedCount) + ' additional warnings omitted from the preview.';
      list.appendChild(more);
    }
    section.appendChild(list);
    return section;
  }

  function renderAnalysis(analysis) {
    els.analysisContent.innerHTML = '';

    els.analysisContent.appendChild(createSection('Project Totals', {
      'Comps': analysis.projectTotals.compItems,
      'Layers': analysis.projectTotals.layers,
      'Precomp Layers': analysis.projectTotals.precompLayers,
      'Text Layers': analysis.projectTotals.textLayers,
      'Shape Layers': analysis.projectTotals.shapeLayers,
      'Media Layers': analysis.projectTotals.mediaLayers,
    }));

    els.analysisContent.appendChild(createSection('Tagged Totals', {
      '[text]': analysis.taggedTotals.text,
      '[speech]': analysis.taggedTotals.speech,
      '[speechnosubs]': analysis.taggedTotals.speechnosubs,
      '[speechlink:*]': analysis.taggedTotals.speechlink,
      '[subs]': analysis.taggedTotals.subs,
      '[comp]': analysis.taggedTotals.comp,
      '[subscomp]': analysis.taggedTotals.subscomp,
      '[body]': analysis.taggedTotals.body,
    }));

    els.analysisContent.appendChild(createSection('Resolved Actions', {
      'Render [comp]': analysis.resolvedActions.renderComp,
      'Text Localize': analysis.resolvedActions.textLocalize,
      'Speech -> Video': analysis.resolvedActions.speechVideo,
      'Speech -> Audio': analysis.resolvedActions.speechAudio,
      'Speech No Subs -> Video': analysis.resolvedActions.speechNoSubsVideo,
      'Speech No Subs -> Audio': analysis.resolvedActions.speechNoSubsAudio,
      'Speech-Link Text': analysis.resolvedActions.speechLinkedText,
      'Speech-Link Media': analysis.resolvedActions.speechLinkedMedia,
      'Delete [subs]': analysis.resolvedActions.deleteSubs,
      'Delete [subscomp]': analysis.resolvedActions.deleteSubsComp,
      'Mark Body': analysis.resolvedActions.markBody,
      'Tagged Disabled': analysis.resolvedActions.taggedDisabled,
    }));

    if (analysis.activeCompReachable) {
      els.analysisContent.appendChild(createSection('Reachable From Active Comp', {
        'Comps': analysis.activeCompReachable.compItems,
        'Layers': analysis.activeCompReachable.layers,
        'Tagged Layers': analysis.activeCompReachable.taggedLayers,
        'Text Localize': analysis.activeCompReachable.textLocalize,
        'Speech': analysis.activeCompReachable.speech,
        'Delete': analysis.activeCompReachable.deleteLayers,
      }));
    }

    els.analysisContent.appendChild(createWarningsSection(
      analysis.warningsPreview || [],
      Number(analysis.warningCount || 0) - (analysis.warningsPreview || []).length
    ));
  }

  function openAnalysis() {
    els.modal.classList.remove('hidden');
    els.modal.setAttribute('aria-hidden', 'false');
  }

  function closeAnalysis() {
    els.modal.classList.add('hidden');
    els.modal.setAttribute('aria-hidden', 'true');
  }

  function findRuleMessage(action) {
    if (!state.selection || !state.selection.validation) return null;
    var rule = state.selection.validation[action];
    return rule && rule.reason ? rule.reason : null;
  }

  async function refreshSelection(options) {
    options = options || {};
    var payload = await callHost('getSelectionState');
    if (!payload || !payload.ok) {
      renderSelection({ ok: false });
      setStatus(await describeHostFailure(payload), 'error');
      return;
    }

    renderSelection(payload);
    if (!options.silent) {
      setStatus('Selection state updated.', 'ok');
    }
  }

  async function applyTag(action) {
    var validationMessage = findRuleMessage(action);
    if (validationMessage && state.selection && state.selection.validation && !state.selection.validation[action].allowed) {
      setStatus(validationMessage, 'warn');
      return;
    }

    var payload = await callHost('applyTag', { tag: action });
    if (!payload || !payload.ok) {
      setStatus(payload && payload.error ? payload.error : 'Unable to apply tag.', 'error');
      return;
    }

    setStatus(payload.message || ('Applied ' + TAG_LABELS[action] + '.'), 'ok');
    await refreshSelection({ silent: true });
  }

  async function applySpeechLink() {
    var validationMessage = findRuleMessage('speechlink');
    if (validationMessage && state.selection && state.selection.validation && !state.selection.validation.speechlink.allowed) {
      setStatus(validationMessage, 'warn');
      return;
    }

    var payload = await callHost('applySpeechLink');
    if (!payload || !payload.ok) {
      setStatus(payload && payload.error ? payload.error : 'Unable to apply speech link.', 'error');
      return;
    }

    setStatus(payload.message || 'Applied speech link.', 'ok');
    await refreshSelection({ silent: true });
  }

  async function clearTag() {
    var payload = await callHost('clearTag');
    if (!payload || !payload.ok) {
      setStatus(payload && payload.error ? payload.error : 'Unable to clear tags.', 'error');
      return;
    }

    setStatus(payload.message || 'Cleared managed tags.', 'ok');
    await refreshSelection({ silent: true });
  }

  async function analyzeProject() {
    setStatus('Scanning project...', 'warn');
    var payload = await callHost('analyzeProject');
    if (!payload || !payload.ok) {
      setStatus(payload && payload.error ? payload.error : 'Analyze failed.', 'error');
      return;
    }

    renderAnalysis(payload.analysis);
    openModal('Project Scan');
    setStatus(
      'Analyze complete: ' + String(payload.analysis.warningCount) + ' warning' +
      (payload.analysis.warningCount === 1 ? '' : 's') + '.',
      payload.analysis.warningCount > 0 ? 'warn' : 'ok'
    );
  }

  // ─── Hook render ───────────────────────────────────────────────────────
  // The hook host methods take a plain scope string rather than a JSON blob,
  // so they get their own thin caller instead of callHost().

  function callHookHost(method, scopeValue) {
    return new Promise(function (resolve) {
      var script = '$.global.RobertVitalik.' + method + '(' + JSON.stringify(String(scopeValue)) + ')';
      cs.evalScript(script, function (result) {
        resolve(parseHostPayload(result));
      });
    });
  }

  function hookScope() {
    return (els.hookScope && els.hookScope.value) || 'all';
  }

  function round1(value) {
    return Math.round(Number(value) * 10) / 10;
  }

  function setHookBusy(busy) {
    state.hookBusy = busy;
    els.renderHook.classList.toggle('is-busy', busy);
    els.renderHook.classList.toggle('is-disabled', busy);
    els.renderHook.textContent = busy ? 'RENDERING...' : 'HOOK RENDER';
  }

  function openModal(title) {
    if (els.analysisTitle) els.analysisTitle.textContent = title;
    openAnalysis();
  }

  function appendLine(parent, label, value) {
    var row = document.createElement('p');
    row.className = 'small';
    var strong = document.createElement('strong');
    strong.textContent = label + ': ';
    row.appendChild(strong);
    row.appendChild(document.createTextNode(String(value)));
    parent.appendChild(row);
  }

  function renderHookDiagnostic(data) {
    els.analysisContent.innerHTML = '';

    var head = document.createElement('div');
    head.className = 'analysis-section';
    appendLine(head, 'Comp', data.compName);
    appendLine(head, 'Without tags', data.cleanName);
    appendLine(head, 'Creative', data.project + '   ·   variation ' + data.variation);
    els.analysisContent.appendChild(head);

    var none = 'none';
    var counts = document.createElement('div');
    counts.className = 'analysis-section';
    appendLine(counts, 'Max in this comp', data.maxComp > 0 ? data.maxComp : none);
    if (data.maxProject !== null && data.maxProject !== undefined) {
      appendLine(counts, 'Max in AE project', data.maxProject > 0 ? data.maxProject : none);
    }
    appendLine(counts, 'Max in selected scope', data.maxFound > 0 ? data.maxFound : none);
    appendLine(counts, 'Next name', data.outName);
    appendLine(counts, 'Folder', data.outDir);
    els.analysisContent.appendChild(counts);

    var hits = document.createElement('div');
    hits.className = 'analysis-section';
    var title = document.createElement('h3');
    if (data.hits && data.hits.length) {
      title.textContent = 'Taken numbers (top ' + data.hits.length + ' of ' + data.hitCount + ')';
      hits.appendChild(title);
      var list = document.createElement('ul');
      list.className = 'warning-list';
      data.hits.forEach(function (hit) {
        var li = document.createElement('li');
        li.textContent = hit.n + '  ←  ' + hit.name + '   (' + hit.where + ')';
        list.appendChild(li);
      });
      hits.appendChild(list);
    } else {
      title.textContent = 'No taken numbers found';
      hits.appendChild(title);
    }
    els.analysisContent.appendChild(hits);
  }

  function renderTemplateList(list) {
    els.analysisContent.innerHTML = '';
    var section = document.createElement('div');
    section.className = 'analysis-section';
    var title = document.createElement('h3');
    title.textContent = 'Output Module templates on this machine';
    section.appendChild(title);
    var ul = document.createElement('ul');
    ul.className = 'warning-list';
    (list || []).forEach(function (name) {
      var li = document.createElement('li');
      li.textContent = name;
      ul.appendChild(li);
    });
    section.appendChild(ul);
    els.analysisContent.appendChild(section);
  }

  async function renderHook() {
    if (state.hookBusy) return;
    if (els.renderHook.classList.contains('is-disabled')) {
      setStatus('Open a comp and select the hook layers first.', 'warn');
      return;
    }

    setHookBusy(true);
    setStatus('Rendering selection... After Effects will be busy.', 'warn');

    var payload = await callHookHost('renderHook', hookScope());
    setHookBusy(false);

    if (!payload || !payload.ok) {
      setStatus(payload && payload.error ? payload.error : 'Hook render failed.', 'error');
      await refreshSelection({ silent: true });
      return;
    }

    // Where the number came from, so a surprising jump is traceable at a glance
    var why = '';
    if (typeof payload.maxFound === 'number') {
      why = '  |  #' + payload.counter + ' (highest taken: ' +
            (payload.maxFound > 0 ? payload.maxFound : 'none') + ')';
    }
    var line = payload.outName + '  |  span ' + round1(payload.spanDur) + 's' + why;

    // Built-in H.264 presets are 5 / 15 / 40 Mbps. Only complain above our
    // 10 Mbps ceiling — a 5 Mbps fallback is fine.
    var heavy = null;
    if (payload.templateSafe === false) {
      var match = String(payload.template).match(/(\d+(?:[.,]\d+)?)\s*mb(?:p)?s/i);
      var mbps = match ? parseFloat(match[1].replace(',', '.')) : null;
      if (mbps !== null && mbps > 10) heavy = mbps;
    }

    if (heavy !== null) {
      els.analysisContent.innerHTML = '';
      var warn = document.createElement('div');
      warn.className = 'analysis-section';
      appendLine(warn, 'Rendered', payload.outName);
      appendLine(warn, 'Template used', payload.template);
      appendLine(warn, 'Bitrate', heavy + ' Mbps instead of our 10 — the file will be larger');
      appendLine(warn, 'Fix', 'Edit > Templates > Output Module... > Load... "LowCostRender H264 10Mbs"');
      els.analysisContent.appendChild(warn);
      if (payload.templateList) renderTemplateList(payload.templateList);
      openModal('Heavy Render Template');
      setStatus('Done, but with a ' + heavy + ' Mbps template: ' + line, 'warn');
    } else {
      setStatus('Done: ' + line + '  |  ' + payload.template, 'ok');
    }

    await refreshSelection({ silent: true });
  }

  async function explainHookNumber() {
    setStatus('Scanning for taken clip numbers...', 'warn');
    var payload = await callHookHost('diagnoseHookNames', hookScope());
    if (!payload || !payload.ok) {
      setStatus(payload && payload.error ? payload.error : 'Scan failed.', 'error');
      return;
    }
    renderHookDiagnostic(payload);
    openModal('Hook Naming');
    setStatus('Next hook name: ' + payload.outName, 'ok');
  }

  async function showRenderTemplates() {
    setStatus('Reading output templates...', 'warn');
    var payload = await callHookHost('listRenderTemplates', '');
    if (!payload || !payload.ok) {
      setStatus(payload && payload.error ? payload.error : 'Unable to read templates.', 'error');
      return;
    }
    renderTemplateList(payload.templates);
    openModal('Render Templates');
    setStatus(String((payload.templates || []).length) + ' output templates found.', 'ok');
  }

  function wireButtonHints() {
    actionButtons.forEach(function (button) {
      button.addEventListener('mouseenter', function () {
        var action = button.getAttribute('data-action');
        var hint = button.getAttribute('data-hint') || '';
        var rule = state.selection && state.selection.validation ? state.selection.validation[action] : null;
        if (rule && !rule.allowed && rule.reason) {
          updateHint(hint + ' Unavailable now: ' + rule.reason);
          return;
        }
        updateHint(hint);
      });
      button.addEventListener('focus', function () {
        var action = button.getAttribute('data-action');
        var hint = button.getAttribute('data-hint') || '';
        var rule = state.selection && state.selection.validation ? state.selection.validation[action] : null;
        if (rule && !rule.allowed && rule.reason) {
          updateHint(hint + ' Unavailable now: ' + rule.reason);
          return;
        }
        updateHint(hint);
      });
      button.addEventListener('mouseleave', function () { updateHint(''); });
      button.addEventListener('blur', function () { updateHint(''); });
    });
  }

  function wireButtons() {
    document.getElementById('tagText').addEventListener('click', function () { applyTag('text'); });
    document.getElementById('tagSpeech').addEventListener('click', function () { applyTag('speech'); });
    document.getElementById('tagSpeechNoSubs').addEventListener('click', function () { applyTag('speechnosubs'); });
    document.getElementById('tagSpeechLink').addEventListener('click', applySpeechLink);
    document.getElementById('tagSubs').addEventListener('click', function () { applyTag('subs'); });
    document.getElementById('tagSubsComp').addEventListener('click', function () { applyTag('subscomp'); });
    document.getElementById('tagComp').addEventListener('click', function () { applyTag('comp'); });
    document.getElementById('tagBody').addEventListener('click', function () { applyTag('body'); });
    document.getElementById('clearTag').addEventListener('click', clearTag);
    els.refreshSelection.addEventListener('click', refreshSelection);
    els.analyzeProject.addEventListener('click', analyzeProject);
    els.closeAnalysis.addEventListener('click', closeAnalysis);

    els.renderHook.addEventListener('click', renderHook);
    els.hookWhy.addEventListener('click', explainHookNumber);
    els.hookTemplates.addEventListener('click', showRenderTemplates);

    // remember the scan scope between sessions
    try {
      var savedScope = localStorage.getItem('robertvitalik.hookScope');
      if (savedScope) els.hookScope.value = savedScope;
    } catch (error) {}
    els.hookScope.addEventListener('change', function () {
      try { localStorage.setItem('robertvitalik.hookScope', els.hookScope.value); } catch (error) {}
    });

    Array.prototype.slice.call(document.querySelectorAll('[data-close-modal="true"]')).forEach(function (node) {
      node.addEventListener('click', closeAnalysis);
    });
  }

  function initialize() {
    if (!window.__adobe_cep__) {
      renderSelection({ ok: false });
      setStatus('CEP host bridge not found. Open this panel inside After Effects.', 'error');
      return;
    }

    wireButtonHints();
    wireButtons();
    refreshSelection({ silent: true });
    window.setInterval(function () {
      refreshSelection({ silent: true });
    }, 2500);
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();
