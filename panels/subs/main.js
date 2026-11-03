// main.js — FitMe Subs v1.0
//
// Flow: select layers -> one mono mixdown -> one transcript -> subtitles
// inside a dedicated "sub-N [subscomp]" precomp.
//
// Depends (load order matters): es-core.js, config.js, corrections.js,
// phrases.js, segmentation.js, expressions.js, styles.js.

const csInterface = new CSInterface();
window.csInterface = csInterface;

let isProcessing = false;
let cancelRequested = false;
let currentAbortController = null;

window.currentSubtitleData = null;

const SETTINGS_STORAGE_KEY = 'fitmesubs_settings_v1';
// SEGMENTATION_DEFAULTS lives in segmentation.js (used by the sentence builder).

let userSegmentationSettings = Object.assign({}, SEGMENTATION_DEFAULTS);
let selectedStyleName = 'classic';
let tempFolderPath = null;

const runtimeTranscriptCache = {};

// CLASSIC look — fixed pixel values, no resolution scaling by design.
//
// Vertical placement is anchored on the TOP of the first line, not the centre of
// the block. Centring makes a one-line and a two-line subtitle start at different
// heights, which reads as jitter; anchoring the top keeps the first line fixed and
// lets the block grow downwards.
//
// topYRatio = 1340/1920. Measured against a real 1080x1920 creative: the legal
// disclaimer starts at Y 1554, so a two-line subtitle ends at 1510 and leaves
// roughly half a line of air. Position is a RATIO (unlike font size) so the same
// spot is hit in any aspect ratio.
//
// AE box text anchors on the BOX centre and flows text down from the box top, so
// posY has to add half the box height. boxLines must clear the tallest group,
// since AE clips box-text overflow.
const CLASSIC = {
    font: 'Arial-BoldMT',
    fontSize: 68,
    strokeWidth: 12,
    strokeOverFill: false,
    allCaps: false,
    fillColor: [1, 1, 1],
    strokeColor: [0, 0, 0],
    topYRatio: 1340 / 1920,
    lineHeightFactor: 1.25,
    boxLines: 3,
    boxWidthRatio: 0.82
};

// ==================== LOGGING ====================

const runtimeLogLines = [];

function formatLogTimestamp(dateObj) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(dateObj.getHours()) + ':' + p(dateObj.getMinutes()) + ':' + p(dateObj.getSeconds());
}

function appendLogLine(level, msg) {
    const line = '[' + formatLogTimestamp(new Date()) + '] ' + safeString(msg);
    runtimeLogLines.push(line);
    if (runtimeLogLines.length > 4000) runtimeLogLines.shift();

    const logWindow = document.getElementById('logWindow');
    if (logWindow) {
        const div = document.createElement('div');
        div.className = 'log-line log-' + level;
        div.textContent = line;
        logWindow.appendChild(div);
        logWindow.scrollTop = logWindow.scrollHeight;
    }

    const status = document.getElementById('status');
    if (status && level !== 'debug') status.textContent = safeString(msg);
}

function log(msg) { appendLogLine('info', msg); }
function logWarn(msg) { appendLogLine('warn', 'WARN: ' + msg); }
function logError(msg) { appendLogLine('error', 'ERROR: ' + msg); }

function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
}

function legacyCopy(text) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
    } catch (e) {
        return false;
    }
}

function formatTimecode(seconds) {
    if (!isFiniteNumber(seconds)) return '00:00.000';
    const total = Math.max(0, seconds);
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    const ms = Math.round((total - Math.floor(total)) * 1000);
    function p(n, w) { let str = String(n); while (str.length < w) str = '0' + str; return str; }
    return p(m, 2) + ':' + p(s, 2) + '.' + p(ms, 3);
}

// ==================== PROGRESS / BUSY STATE ====================

function updateProgress(percent) {
    const bar = document.getElementById('progressBar');
    if (bar) bar.style.width = Math.max(0, Math.min(100, percent)) + '%';
}

function setBusy(busy) {
    isProcessing = busy;
    const main = document.getElementById('mainActionBtn');
    const caret = document.getElementById('modeToggleBtn');
    if (main) main.disabled = busy;
    if (caret) caret.disabled = busy;
    const styleCaret = document.getElementById('styleToggleBtn');
    if (styleCaret) styleCaret.disabled = busy;
    const container = document.getElementById('progressContainer');
    if (container) container.style.display = busy ? 'block' : 'none';
    if (!busy) updateProgress(0);
}

function throwIfCancelled() {
    if (cancelRequested) throw new Error('Cancelled by user');
}

// ==================== HOST SCRIPT HELPER ====================

function evalHost(script, useResolver) {
    return new Promise((resolve, reject) => {
        const wrapped = useResolver === 'tag' ? withTagResolver(script)
            : useResolver ? withJsonShimAndResolver(script)
            : withJsonShim(script);
        csInterface.evalScript(wrapped, (result) => {
            const normalized = safeTrim(safeString(result));
            if (!normalized) { reject(new Error('Empty response from After Effects')); return; }
            if (normalized.indexOf('ERROR:') === 0) { reject(new Error(normalized.substring(6))); return; }
            resolve(normalized);
        });
    });
}

async function evalHostJson(script, useResolver) {
    const raw = await evalHost(script, useResolver);
    const parsed = safeParseJSON(raw, null);
    if (!parsed) throw new Error('Malformed response from After Effects: ' + raw.substring(0, 200));
    if (parsed.success === false) throw new Error(parsed.error || 'Unknown host error');
    return parsed;
}

// ==================== TEMP FOLDER ====================

async function getTempFolder() {
    if (tempFolderPath) return tempFolderPath;
    const script = `
        (function() {
            try {
                var base = Folder.temp.fsName + "/_fitmesubs";
                var f = new Folder(base);
                if (!f.exists) f.create();
                var c = new Folder(base + "/cache");
                if (!c.exists) c.create();
                return JSON.stringify({success:true, path: f.fsName});
            } catch(e) { return "ERROR:" + e.toString(); }
        })();
    `;
    const res = await evalHostJson(script, false);
    tempFolderPath = res.path;
    return tempFolderPath;
}

function writeTextFile(path, content) {
    return new Promise((resolve, reject) => {
        try {
            const res = window.cep.fs.writeFile(path, content, window.cep.encoding.UTF8);
            if (res && res.err) { reject(new Error('writeFile failed: ' + res.err)); return; }
            resolve(path);
        } catch (e) {
            reject(e);
        }
    });
}

function readTextFile(path) {
    try {
        const res = window.cep.fs.readFile(path, window.cep.encoding.UTF8);
        if (!res || res.err) return null;
        return res.data;
    } catch (e) {
        return null;
    }
}

function deleteFileQuiet(path) {
    try { window.cep.fs.deleteFile(path); } catch (e) { /* ignore */ }
}

// ==================== FILE READING ====================

function buildFileUrl(fp) {
    const normalised = safeString(fp).replace(/\\/g, '/');
    if (normalised.indexOf('file://') === 0) return normalised.replace(/ /g, '%20');
    const segments = normalised.split('/');
    const encoded = segments.map((s) => encodeURIComponent(s).replace(/%2F/g, '/')).join('/');
    return normalised.charAt(0) === '/' ? 'file://' + encoded : 'file:///' + encoded;
}

function readFileAsArrayBuffer(filePath) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', buildFileUrl(filePath), true);
        xhr.responseType = 'arraybuffer';
        xhr.timeout = 180000;
        xhr.onload = function () {
            if (xhr.status === 200 || xhr.status === 0) resolve(xhr.response);
            else reject(new Error('Cannot read file (HTTP ' + xhr.status + '): ' + filePath));
        };
        xhr.onerror = function () {
            reject(new Error('Cannot read file. Locked or network drive? ' + filePath));
        };
        xhr.ontimeout = function () { reject(new Error('File read timed out: ' + filePath)); };
        xhr.send();
    });
}

// ==================== STEP 1: COLLECT AUDIO LAYERS ====================

async function collectAudioLayers() {
    const excludeTags = JSON.stringify(
        (CONFIG.EXCLUDE_TAGS || []).map(function (t) { return String(t).toLowerCase(); })
    );

    const script = `
        (function() {
            try {
                var comp = app.project.activeItem;
                if (!comp || !(comp instanceof CompItem)) return "ERROR:No active composition";

                var sel = comp.selectedLayers;
                if (!sel || sel.length === 0) return "ERROR:No layers selected. Select the layers you want subtitled.";

                var soloActive = false;
                for (var s = 1; s <= comp.numLayers; s++) {
                    try { if (comp.layer(s).solo) { soloActive = true; break; } } catch(e) {}
                }

                var picked = [], skipped = [], warnings = [], excluded = [];
                var earliestIn = null, latestOut = 0;
                var excludeTags = ${excludeTags};

                for (var i = 0; i < sel.length; i++) {
                    var L = sel[i];
                    var nm = String(L.name);

                    var lowerName = nm.toLowerCase();
                    var taggedOut = false;
                    for (var tg = 0; tg < excludeTags.length; tg++) {
                        if (lowerName.indexOf(excludeTags[tg]) !== -1) {
                            excluded.push(nm + "  ->  " + excludeTags[tg]);
                            taggedOut = true;
                            break;
                        }
                    }
                    if (taggedOut) continue;

                    if (!L.hasAudio) { skipped.push(nm + " - no audio track"); continue; }
                    if (L.audioEnabled === false) { skipped.push(nm + " - audio switch off"); continue; }

                    var lvl = null;
                    try {
                        var ag = L.property("ADBE Audio Group");
                        if (ag) {
                            var al = ag.property("ADBE Audio Levels");
                            if (al && al.numKeys === 0) lvl = al.value;
                        }
                    } catch(e) {}

                    if (lvl && lvl.length >= 2 && lvl[0] <= -90 && lvl[1] <= -90) {
                        skipped.push(nm + " - audio levels silent");
                        continue;
                    }
                    if (lvl && lvl.length >= 2 && lvl[0] <= -30 && lvl[1] <= -30) {
                        warnings.push(nm + " is very quiet (" + lvl[0].toFixed(1) + " dB)");
                    }
                    if (soloActive && !L.solo) {
                        warnings.push(nm + " is not soloed, but solo is active in this comp - it will NOT be rendered by AE");
                    }
                    if (L.startTime < 0) {
                        warnings.push(nm + " starts before 0s - audio before the comp start is not captured");
                    }

                    var srcPath = "", srcName = "", srcSize = 0, srcMod = 0;
                    try {
                        if (L.source) {
                            srcName = String(L.source.name);
                            if (L.source.file) {
                                srcPath = L.source.file.fsName;
                                srcSize = L.source.file.length;
                                try { srcMod = L.source.file.modified ? L.source.file.modified.getTime() : 0; } catch(e2) {}
                            }
                        }
                    } catch(e) {}

                    if (earliestIn === null || L.inPoint < earliestIn) earliestIn = L.inPoint;
                    if (L.outPoint > latestOut) latestOut = L.outPoint;

                    picked.push({
                        layerIndex: L.index,
                        layerName: nm,
                        startTime: L.startTime,
                        inPoint: L.inPoint,
                        outPoint: L.outPoint,
                        stretch: (L.stretch === undefined ? 100 : L.stretch),
                        srcPath: srcPath,
                        srcName: srcName,
                        srcSize: srcSize,
                        srcMod: srcMod
                    });
                }

                var compItemIndex = 0;
                for (var pi = 1; pi <= app.project.numItems; pi++) {
                    if (app.project.item(pi) === comp) { compItemIndex = pi; break; }
                }

                return JSON.stringify({
                    success: true,
                    compItemIndex: compItemIndex,
                    compName: String(comp.name),
                    compWidth: comp.width,
                    compHeight: comp.height,
                    compPAR: comp.pixelAspect,
                    compFps: comp.frameRate,
                    compDuration: comp.duration,
                    layers: picked,
                    skipped: skipped,
                    excluded: excluded,
                    warnings: warnings,
                    earliestIn: earliestIn === null ? 0 : earliestIn,
                    latestOut: latestOut
                });
            } catch(e) {
                return "ERROR:" + e.toString();
            }
        })();
    `;

    const info = await evalHostJson(script, false);

    const excludedList = info.excluded || [];
    for (let e = 0; e < excludedList.length; e++) log('Excluded by tag: ' + excludedList[e]);
    for (let i = 0; i < info.skipped.length; i++) log('Skipped: ' + info.skipped[i]);
    for (let w = 0; w < info.warnings.length; w++) logWarn(info.warnings[w]);

    if (!info.layers.length) {
        throw new Error('None of the selected layers has audible audio.');
    }

    const names = info.layers.map((l) => l.layerName).join(', ');
    log('Audio layers (' + info.layers.length + '): ' + names);
    log('Mixdown range 0 - ' + formatTimecode(info.latestOut));

    return info;
}

// ==================== STEP 2: RENDER MIXDOWN ====================

async function renderMixToWav(sel) {
    const tempDir = await getTempFolder();
    const stamp = Date.now();
    const outPath = tempDir + '/mix_' + stamp + '.wav';

    const meta = JSON.stringify({ compItemIndex: sel.compItemIndex, compName: sel.compName });
    const indices = sel.layers.map((l) => l.layerIndex).join(',');
    const duration = sel.latestOut;

    const script = `
        (function() {
            var rq = app.project.renderQueue;
            var disabled = [];
            var myItem = null;
            var tempComp = null;
            var undoOpen = false;
            var dialogsSuppressed = false;

            try {
                var comp = resolveTargetComp(${meta}, "compItemIndex", "compName");
                if (!comp) return "ERROR:Cannot resolve composition";

                var dur = ${duration};
                if (!(dur > 0)) return "ERROR:Mixdown duration is zero";

                // Snap up to a whole frame and add one frame of headroom, so the
                // last word is never clipped by frame rounding.
                var frameDur = 1 / comp.frameRate;
                dur = (Math.ceil(dur / frameDur) + 1) * frameDur;

                try { app.beginSuppressDialogs(); dialogsSuppressed = true; } catch(e) {}

                for (var q = 1; q <= rq.numItems; q++) {
                    var it = rq.item(q);
                    if (it.status === RQItemStatus.QUEUED) { it.render = false; disabled.push(q); }
                }

                app.beginUndoGroup("Spilio Subs mixdown");
                undoOpen = true;

                tempComp = app.project.items.addComp(
                    "_fitmesubs_mix_${stamp}", 16, 16, 1, dur, comp.frameRate
                );

                var indices = [${indices}];
                var added = 0;
                for (var li = 0; li < indices.length; li++) {
                    var srcLayer = null;
                    try { srcLayer = comp.layer(indices[li]); } catch(e) { continue; }
                    if (!srcLayer) continue;

                    srcLayer.copyToComp(tempComp);
                    var nl = tempComp.layer(1);

                    nl.startTime = srcLayer.startTime;
                    var ni = srcLayer.inPoint;
                    var no = srcLayer.outPoint;
                    if (ni < 0) ni = 0;
                    if (no > dur) no = dur;
                    if (no <= ni) { nl.remove(); continue; }
                    nl.inPoint = ni;
                    nl.outPoint = no;

                    try { if (nl.hasVideo) nl.enabled = false; } catch(e) {}
                    try { nl.audioEnabled = true; } catch(e) {}
                    try { nl.solo = false; } catch(e) {}
                    added++;
                }

                if (added === 0) {
                    return "ERROR:No layers could be copied into the mixdown comp";
                }

                // AE reports the comp's own frame-rounded duration, which can be a
                // hair below what we asked for, and workAreaDuration must stay
                // within it. Never assume our number is the authoritative one.
                try { tempComp.workAreaStart = 0; } catch(e) {}
                var wa = tempComp.duration;
                var waSet = false;
                for (var attempt = 0; attempt < 4 && !waSet; attempt++) {
                    try {
                        tempComp.workAreaDuration = wa;
                        waSet = true;
                    } catch(e) {
                        wa = wa - (1 / tempComp.frameRate);
                        if (!(wa > 0)) break;
                    }
                }

                myItem = rq.items.add(tempComp);
                var om = myItem.outputModule(1);

                var applied = false;
                try {
                    var tpl = om.templates;
                    for (var t = 0; t < tpl.length; t++) {
                        if (String(tpl[t]).toUpperCase().indexOf("WAV") !== -1) {
                            om.applyTemplate(tpl[t]); applied = true; break;
                        }
                    }
                } catch(e) {}
                if (!applied) {
                    try {
                        var tpl2 = om.templates;
                        for (var t2 = 0; t2 < tpl2.length; t2++) {
                            var n2 = String(tpl2[t2]).toUpperCase();
                            if (n2.indexOf("AIFF") !== -1 || n2.indexOf("48") !== -1) {
                                om.applyTemplate(tpl2[t2]); applied = true; break;
                            }
                        }
                    } catch(e) {}
                }

                // Force audio-only regardless of which template landed.
                try { om.setSettings({ "Format": "WAV" }); } catch(e) {}
                try { om.setSettings({ "Video Output": false }); } catch(e) {}
                try { om.setSettings({ "Output Audio": "Audio Only" }); } catch(e) {}
                try { om.setSettings({ "Audio Channels": "Mono" }); } catch(e) {}
                try { om.setSettings({ "Audio Bit Depth": "16" }); } catch(e) {}

                om.file = new File("${outPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}");

                rq.render();

                var produced = null;
                try { produced = om.file.fsName; } catch(e) { produced = "${outPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"; }

                var outFile = new File(produced);
                if (!outFile.exists) {
                    var base = produced.replace(/\\.[^.]+$/, "");
                    var exts = [".wav", ".aif", ".aiff"];
                    for (var ei = 0; ei < exts.length; ei++) {
                        var alt = new File(base + exts[ei]);
                        if (alt.exists) { outFile = alt; break; }
                    }
                }
                if (!outFile.exists) return "ERROR:Mixdown file was not produced by the render queue";

                return JSON.stringify({ success: true, path: outFile.fsName, bytes: outFile.length });

            } catch(e) {
                return "ERROR:" + e.toString();
            } finally {
                try { if (myItem) myItem.remove(); } catch(e) {}
                try { if (tempComp) tempComp.remove(); } catch(e) {}
                for (var d = 0; d < disabled.length; d++) {
                    try { rq.item(disabled[d]).render = true; } catch(e) {}
                }
                try { if (undoOpen) app.endUndoGroup(); } catch(e) {}
                try { if (dialogsSuppressed) app.endSuppressDialogs(false); } catch(e) {}
            }
        })();
    `;

    const res = await evalHostJson(script, true);
    log('Mixdown rendered: ' + Math.round(res.bytes / 1024) + ' KB');
    return res.path;
}

// ==================== STEP 3: DOWNMIX + ENCODE ====================

// We rendered this file ourselves, so parse it directly instead of relying on
// decodeAudioData(): the CEF build inside After Effects ships without audio
// decoders, so decodeAudioData() fails there for every format.

function readFourCC(view, offset) {
    return String.fromCharCode(
        view.getUint8(offset), view.getUint8(offset + 1),
        view.getUint8(offset + 2), view.getUint8(offset + 3)
    );
}

function parseWav(buffer) {
    const view = new DataView(buffer);
    if (readFourCC(view, 0) !== 'RIFF' || readFourCC(view, 8) !== 'WAVE') return null;

    let offset = 12;
    let fmt = null;
    let dataOffset = -1;
    let dataLength = 0;

    while (offset + 8 <= buffer.byteLength) {
        const id = readFourCC(view, offset);
        const size = view.getUint32(offset + 4, true);
        const body = offset + 8;

        if (id === 'fmt ') {
            let format = view.getUint16(body, true);
            const channels = view.getUint16(body + 2, true);
            const sampleRate = view.getUint32(body + 4, true);
            const bits = view.getUint16(body + 14, true);
            // WAVE_FORMAT_EXTENSIBLE: the real format lives in the subformat GUID
            if (format === 0xFFFE && size >= 40) format = view.getUint16(body + 24, true);
            fmt = { format: format, channels: channels, sampleRate: sampleRate, bits: bits };
        } else if (id === 'data') {
            dataOffset = body;
            dataLength = size;
            if (dataLength === 0 || body + dataLength > buffer.byteLength) {
                dataLength = buffer.byteLength - body;
            }
        }

        offset = body + size + (size % 2);   // chunks are word-aligned
        if (fmt && dataOffset >= 0 && id === 'data') break;
    }

    if (!fmt || dataOffset < 0) return null;
    return { fmt: fmt, dataOffset: dataOffset, dataLength: dataLength, buffer: buffer };
}

function parseAiff(buffer) {
    const view = new DataView(buffer);
    if (readFourCC(view, 0) !== 'FORM') return null;
    const form = readFourCC(view, 8);
    if (form !== 'AIFF' && form !== 'AIFC') return null;

    let offset = 12;
    let fmt = null;
    let dataOffset = -1;
    let dataLength = 0;

    while (offset + 8 <= buffer.byteLength) {
        const id = readFourCC(view, offset);
        const size = view.getUint32(offset + 4, false);
        const body = offset + 8;

        if (id === 'COMM') {
            const channels = view.getUint16(body, false);
            const bits = view.getUint16(body + 6, false);
            // sample rate is an 80-bit IEEE extended float
            const expo = view.getUint16(body + 8, false);
            const hi = view.getUint32(body + 10, false);
            const lo = view.getUint32(body + 14, false);
            const exponent = (expo & 0x7FFF) - 16383;
            const mantissa = hi * 4294967296 + lo;
            let rate = mantissa * Math.pow(2, exponent - 63);
            if (expo & 0x8000) rate = -rate;
            fmt = { format: 1, channels: channels, sampleRate: Math.round(rate), bits: bits, bigEndian: true };
        } else if (id === 'SSND') {
            const dataStart = view.getUint32(body, false);
            dataOffset = body + 8 + dataStart;
            dataLength = size - 8 - dataStart;
        }

        offset = body + size + (size % 2);
    }

    if (!fmt || dataOffset < 0) return null;
    return { fmt: fmt, dataOffset: dataOffset, dataLength: dataLength, buffer: buffer };
}

// Interleaved PCM -> one Float32Array per channel.
function pcmToChannels(parsed) {
    const f = parsed.fmt;
    const view = new DataView(parsed.buffer, parsed.dataOffset, parsed.dataLength);
    const little = !f.bigEndian;
    const bytesPerSample = f.bits / 8;
    const frameSize = bytesPerSample * f.channels;
    const frames = Math.floor(parsed.dataLength / frameSize);

    const channels = [];
    for (let c = 0; c < f.channels; c++) channels.push(new Float32Array(frames));

    for (let i = 0; i < frames; i++) {
        const base = i * frameSize;
        for (let c = 0; c < f.channels; c++) {
            const at = base + c * bytesPerSample;
            let v = 0;
            if (f.format === 3 && f.bits === 32) {
                v = view.getFloat32(at, little);
            } else if (f.bits === 16) {
                v = view.getInt16(at, little) / 32768;
            } else if (f.bits === 24) {
                const b0 = view.getUint8(at), b1 = view.getUint8(at + 1), b2 = view.getUint8(at + 2);
                let n = little ? (b2 << 16) | (b1 << 8) | b0 : (b0 << 16) | (b1 << 8) | b2;
                if (n & 0x800000) n -= 0x1000000;
                v = n / 8388608;
            } else if (f.bits === 32) {
                v = view.getInt32(at, little) / 2147483648;
            } else if (f.bits === 8) {
                v = (view.getUint8(at) - 128) / 128;
            }
            channels[c][i] = v;
        }
    }
    return { channels: channels, frames: frames, sampleRate: f.sampleRate };
}

function downmixToMono(channels, frames) {
    if (channels.length === 1) return channels[0];
    const out = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
        let sum = 0;
        for (let c = 0; c < channels.length; c++) sum += channels[c][i];
        out[i] = sum / channels.length;
    }
    return out;
}

// Box-average decimation. The averaging window doubles as a crude low-pass,
// which is all speech at 48k -> 16k needs.
function resampleMono(input, srcRate, dstRate) {
    if (srcRate === dstRate) return input;
    const ratio = srcRate / dstRate;
    const outLen = Math.max(1, Math.floor(input.length / ratio));
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
        const from = i * ratio;
        const to = Math.min(input.length, from + ratio);
        let sum = 0, n = 0;
        for (let j = Math.floor(from); j < to; j++) { sum += input[j]; n++; }
        out[i] = n ? sum / n : 0;
    }
    return out;
}

async function decodeToMono16k(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const magic = arrayBuffer.byteLength >= 12
        ? readFourCC(view, 0) + '/' + readFourCC(view, 8)
        : '(too short)';

    let parsed = parseWav(arrayBuffer);
    if (!parsed) parsed = parseAiff(arrayBuffer);
    if (!parsed) {
        throw new Error('Unrecognised audio container from the render queue (' +
            magic + ', ' + arrayBuffer.byteLength + ' bytes)');
    }

    const pcm = pcmToChannels(parsed);
    if (!pcm.frames) throw new Error('Mixdown contains no audio frames');

    log('Container: ' + magic + ', ' + pcm.sampleRate + ' Hz, ' +
        parsed.fmt.channels + 'ch, ' + parsed.fmt.bits + '-bit');

    const mono = downmixToMono(pcm.channels, pcm.frames);
    const target = CONFIG.AUDIO.TARGET_SAMPLE_RATE;
    const resampled = resampleMono(mono, pcm.sampleRate, target);

    const out = new Int16Array(resampled.length);
    for (let i = 0; i < resampled.length; i++) {
        let v = resampled[i];
        if (v > 1) v = 1; else if (v < -1) v = -1;
        out[i] = v < 0 ? v * 0x8000 : v * 0x7FFF;
    }

    return {
        pcm: out,
        duration: resampled.length / target,
        sourceRate: pcm.sampleRate,
        channels: parsed.fmt.channels
    };
}

function encodeMp3Inline(pcm, sampleRate, bitrate) {
    const encoder = new lamejs.Mp3Encoder(1, sampleRate, bitrate);
    const blockSize = 1152;
    const chunks = [];
    let total = 0;
    for (let i = 0; i < pcm.length; i += blockSize) {
        const buf = encoder.encodeBuffer(pcm.subarray(i, Math.min(i + blockSize, pcm.length)));
        if (buf.length > 0) { chunks.push(buf); total += buf.length; }
    }
    const tail = encoder.flush();
    if (tail.length > 0) { chunks.push(tail); total += tail.length; }
    const out = new Uint8Array(total);
    let offset = 0;
    for (let c = 0; c < chunks.length; c++) { out.set(chunks[c], offset); offset += chunks[c].length; }
    return out;
}

function encodeMp3(pcm, sampleRate, bitrate) {
    return new Promise((resolve) => {
        if (!CONFIG.AUDIO.USE_WORKER) { resolve(encodeMp3Inline(pcm, sampleRate, bitrate)); return; }

        let worker = null;
        let settled = false;
        const fallback = (reason) => {
            if (settled) return;
            settled = true;
            try { if (worker) worker.terminate(); } catch (e) { /* ignore */ }
            logWarn('MP3 worker unavailable (' + reason + ') - encoding on main thread');
            resolve(encodeMp3Inline(pcm, sampleRate, bitrate));
        };

        try {
            worker = new Worker('audio-worker.js');
        } catch (e) {
            fallback(e.message);
            return;
        }

        worker.onerror = function (err) { fallback(err && err.message ? err.message : 'worker error'); };
        worker.onmessage = function (ev) {
            const msg = ev.data || {};
            if (msg.progress !== undefined && msg.ok === undefined) return;
            if (settled) return;
            if (msg.ok) {
                settled = true;
                try { worker.terminate(); } catch (e) { /* ignore */ }
                resolve(new Uint8Array(msg.mp3));
            } else {
                fallback(msg.error || 'unknown');
            }
        };

        const copy = new Int16Array(pcm);
        worker.postMessage({ pcm: copy.buffer, sampleRate: sampleRate, bitrate: bitrate }, [copy.buffer]);
    });
}

function pcmToWavBlob(pcm, sampleRate) {
    const bytes = pcm.length * 2;
    const buffer = new ArrayBuffer(44 + bytes);
    const view = new DataView(buffer);
    function str(offset, s) { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); }
    str(0, 'RIFF');
    view.setUint32(4, 36 + bytes, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    str(36, 'data');
    view.setUint32(40, bytes, true);
    new Int16Array(buffer, 44).set(pcm);
    return new Blob([buffer], { type: 'audio/wav' });
}

async function prepareUploadPayload(wavPath) {
    const raw = await readFileAsArrayBuffer(wavPath);
    log('Mixdown read: ' + Math.round(raw.byteLength / 1024) + ' KB');

    const decoded = await decodeToMono16k(raw);
    log('Downmixed to mono ' + CONFIG.AUDIO.TARGET_SAMPLE_RATE + ' Hz (' + decoded.duration.toFixed(1) + 's)');
    throwIfCancelled();

    if (CONFIG.AUDIO.ENCODE === 'wav') {
        const blob = pcmToWavBlob(decoded.pcm, CONFIG.AUDIO.TARGET_SAMPLE_RATE);
        log('Upload payload: WAV, ' + Math.round(blob.size / 1024) + ' KB');
        return { blob: blob, filename: 'mixdown.wav' };
    }

    const mp3 = await encodeMp3(decoded.pcm, CONFIG.AUDIO.TARGET_SAMPLE_RATE, CONFIG.AUDIO.MP3_BITRATE);
    const blob = new Blob([mp3], { type: 'audio/mpeg' });
    log('Upload payload: MP3 ' + CONFIG.AUDIO.MP3_BITRATE + ' kbps mono, ' + Math.round(blob.size / 1024) + ' KB');
    return { blob: blob, filename: 'mixdown.mp3' };
}

// ==================== STEP 4: TRANSCRIPTION ====================

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function transcribeBlob(blob, filename) {
    const providerKey = CONFIG.getActiveProviderKey();
    const provider = CONFIG.PROVIDERS[providerKey];

    if (!CONFIG.isProviderConfigured(providerKey)) {
        throw new Error('API key not configured for ' + provider.name);
    }
    if (blob.size > provider.maxFileSize) {
        throw new Error(provider.name + ' file limit is ' +
            Math.round(provider.maxFileSize / 1024 / 1024) + ' MB, payload is ' +
            Math.round(blob.size / 1024 / 1024) + ' MB');
    }

    const opts = {};
    if (provider.supportsKeyterms && CONFIG.KEYTERMS_ENABLED && window.getKeyterms) {
        opts.keyterms = window.getKeyterms();
        log('Keyterms: ' + opts.keyterms.length + ' terms');
    }

    const maxRetries = CONFIG.NET.MAX_RETRIES;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        throwIfCancelled();
        if (attempt > 0) {
            const wait = CONFIG.NET.BASE_BACKOFF_MS * Math.pow(2, attempt - 1) * (0.5 + Math.random());
            log('Retry ' + attempt + '/' + maxRetries + ' in ' + Math.round(wait / 1000) + 's...');
            await sleep(wait);
            throwIfCancelled();
        }

        const controller = new AbortController();
        currentAbortController = controller;
        const timer = setTimeout(() => controller.abort(), CONFIG.NET.TIMEOUT_MS);

        try {
            const response = await fetch(provider.endpoint, {
                method: 'POST',
                headers: provider.getHeaders(),
                body: provider.buildFormData(blob, filename, opts),
                signal: controller.signal
            });

            clearTimeout(timer);
            currentAbortController = null;

            const bodyText = await response.text();

            if (response.status === 429 || response.status >= 500) {
                const retryAfter = parseFloat(response.headers.get('retry-after'));
                if (retryAfter > 0) await sleep(retryAfter * 1000);
                lastError = new Error(provider.name + ' HTTP ' + response.status + ': ' +
                    safeTrim(bodyText).substring(0, 200));
                logWarn(lastError.message);
                continue;
            }

            if (!response.ok) {
                // Keyterms are an optimisation, never a reason to lose the whole run.
                // If the server rejects them, drop them and try once more.
                if (response.status === 400 && opts.keyterms && opts.keyterms.length) {
                    logWarn('Server rejected keyterms - retrying without them: ' +
                        safeTrim(bodyText).substring(0, 160));
                    delete opts.keyterms;
                    attempt--;
                    continue;
                }
                throw new Error(provider.name + ' HTTP ' + response.status + ': ' +
                    (safeTrim(bodyText).substring(0, 300) || response.statusText));
            }

            const concurrent = response.headers.get('current-concurrent-requests');
            const maxConcurrent = response.headers.get('maximum-concurrent-requests');
            if (concurrent && maxConcurrent) {
                log('Concurrency ' + concurrent + '/' + maxConcurrent);
            }

            const rawData = safeParseJSON(bodyText, null);
            if (!rawData || typeof rawData !== 'object') {
                throw new Error('Invalid JSON from ' + provider.name);
            }

            const normalized = provider.parseResponse(rawData);
            if (!normalized.words.length && !normalized.text) {
                throw new Error('Empty transcription from ' + provider.name);
            }

            normalized._provider = providerKey;
            normalized._needsPunctuationHints = !!provider.needsPunctuationHints;
            log('Transcribed: ' + normalized.words.length + ' words' +
                (normalized.language ? ' [' + normalized.language + ']' : ''));
            return normalized;

        } catch (err) {
            clearTimeout(timer);
            currentAbortController = null;
            if (cancelRequested) throw new Error('Cancelled by user');
            if (err.name === 'AbortError') {
                lastError = new Error('Request timed out after ' + (CONFIG.NET.TIMEOUT_MS / 1000) + 's');
                logWarn(lastError.message);
                continue;
            }
            if (err.message && err.message.indexOf('HTTP 4') !== -1) throw err;
            lastError = err;
            logWarn(err.message);
        }
    }

    throw lastError || new Error('Transcription failed');
}

// ==================== TRANSCRIPT CACHE ====================

function hashString(input) {
    let hash = 5381;
    const str = safeString(input);
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16);
}

function buildMixCacheKey(sel) {
    const parts = sel.layers.map((l) =>
        [l.srcPath || l.srcName, l.srcSize, l.srcMod, l.startTime, l.inPoint, l.outPoint, l.stretch].join('|')
    );
    parts.sort();
    parts.push('provider=' + CONFIG.getActiveProviderKey());
    parts.push('rate=' + CONFIG.AUDIO.TARGET_SAMPLE_RATE);
    parts.push('enc=' + CONFIG.AUDIO.ENCODE);
    parts.push('terms=' + (window.CANONICAL_TERMS || []).join(','));
    return hashString(parts.join('\n'));
}

async function readTranscriptCache(key) {
    if (runtimeTranscriptCache[key]) return runtimeTranscriptCache[key];
    const dir = await getTempFolder();
    const data = readTextFile(dir + '/cache/' + key + '.json');
    if (!data) return null;
    const parsed = safeParseJSON(data, null);
    if (!parsed || !parsed.words) return null;
    runtimeTranscriptCache[key] = parsed;
    return parsed;
}

async function writeTranscriptCache(key, transcript) {
    runtimeTranscriptCache[key] = transcript;
    try {
        const dir = await getTempFolder();
        await writeTextFile(dir + '/cache/' + key + '.json', JSON.stringify(transcript));
    } catch (e) {
        logWarn('Cache write failed: ' + e.message);
    }
}

// ==================== STEP 5: SUBTITLES PRECOMP ====================

async function ensureSubsPrecomp(sel, reuseLayerName) {
    const meta = JSON.stringify({ compItemIndex: sel.compItemIndex, compName: sel.compName });
    const spanStart = Math.max(0, sel.earliestIn || 0);
    const spanEnd = sel.latestOut;
    const reuse = JSON.stringify(reuseLayerName || '');
    const tag = JSON.stringify('fitmesubs:' + Date.now() + ':' + Math.floor(Math.random() * 100000));

    const script = `
        (function() {
            var undoOpen = false;
            try {
                var comp = resolveTargetComp(${meta}, "compItemIndex", "compName");
                if (!comp) return "ERROR:Cannot resolve composition";

                app.beginUndoGroup("Spilio Subs: subtitles comp");
                undoOpen = true;

                var reuseName = ${reuse};
                var maxN = 0;
                var reuseLayer = null;

                for (var i = 1; i <= comp.numLayers; i++) {
                    var lyr = comp.layer(i);
                    var nm = String(lyr.name);
                    var m = nm.match(/^sub-(\\d+) \\[subscomp\\]$/);
                    if (!m) continue;
                    var n = parseInt(m[1], 10);
                    if (n > maxN) maxN = n;
                    if (reuseName && nm === reuseName) reuseLayer = lyr;
                }

                var precomp = null;
                var layer = null;

                if (reuseLayer && reuseLayer.source && (reuseLayer.source instanceof CompItem)) {
                    layer = reuseLayer;
                    precomp = reuseLayer.source;
                    for (var d = precomp.numLayers; d >= 1; d--) {
                        try { precomp.layer(d).remove(); } catch(e) {}
                    }
                } else {
                    var next = maxN + 1;

                    // The subtitles comp covers only the selected media: it starts at
                    // the first clip's in-point and ends at the last clip's out-point,
                    // instead of spanning the whole parent comp.
                    var frameDur = 1 / comp.frameRate;
                    var spanStart = ${spanStart};
                    var spanEnd = ${spanEnd};
                    var spanDur = spanEnd - spanStart;
                    if (!(spanDur > 0)) spanDur = comp.duration;
                    spanDur = (Math.ceil(spanDur / frameDur) + 1) * frameDur;
                    if (spanDur > comp.duration) spanDur = comp.duration;

                    precomp = app.project.items.addComp(
                        "sub-" + next, comp.width, comp.height, comp.pixelAspect,
                        spanDur, comp.frameRate
                    );
                    layer = comp.layers.add(precomp);
                    layer.startTime = spanStart;
                    layer.name = "sub-" + next + " [subscomp]";
                    layer.moveToBeginning();
                }

                // Subtitle timings arrive in PARENT comp time (the mixdown starts at 0),
                // so everything placed inside must be shifted back by this much.
                var timeOffset = 0;
                try { timeOffset = layer.startTime; } catch(e) {}

                // Stamp an identifier that survives project item reshuffling.
                var compTag = ${tag};
                try { precomp.comment = compTag; } catch(e) {}

                var precompIndex = 0;
                for (var pi = 1; pi <= app.project.numItems; pi++) {
                    if (app.project.item(pi) === precomp) { precompIndex = pi; break; }
                }

                app.endUndoGroup();
                undoOpen = false;

                return JSON.stringify({
                    success: true,
                    compTag: compTag,
                    compItemIndex: precompIndex,
                    compName: String(precomp.name),
                    layerName: String(layer.name),
                    timeOffset: timeOffset,
                    duration: precomp.duration,
                    width: precomp.width,
                    height: precomp.height
                });
            } catch(e) {
                try { if (undoOpen) app.endUndoGroup(); } catch(x) {}
                return "ERROR:" + e.toString();
            }
        })();
    `;

    const res = await evalHostJson(script, true);
    // Never let a log line kill the run: the host may omit fields on older builds.
    res.timeOffset = isFiniteNumber(Number(res.timeOffset)) ? Number(res.timeOffset) : 0;
    res.duration = isFiniteNumber(Number(res.duration)) ? Number(res.duration) : 0;
    log('Subtitles comp: ' + res.layerName + ' — ' +
        formatTimecode(res.timeOffset) + ' to ' + formatTimecode(res.timeOffset + res.duration) +
        (res.duration ? ' (' + res.duration.toFixed(2) + 's)' : ''));
    return res;
}

// ==================== STEP 6: BUILD SUBTITLES ====================

function targetMeta(target) {
    return JSON.stringify({
        compTag: target.compTag || '',
        compItemIndex: target.compItemIndex,
        compName: target.compName
    });
}

function classicTextDocScript(useBoxText, useFixedWidth) {
    return `
        var _fontSize = ${CLASSIC.fontSize};
        var _lineH = _fontSize * ${CLASSIC.lineHeightFactor};
        var _boxW = Math.round(comp.width * ${CLASSIC.boxWidthRatio});
        var _boxH = Math.round(_lineH * ${CLASSIC.boxLines});
        var _topY = comp.height * ${CLASSIC.topYRatio};

        var posX = comp.width * 0.5;
        var posY;

        var template;
        if (${useBoxText}) {
            template = comp.layers.addBoxText([_boxW, _boxH]);
            // box anchors on its centre; put the box top on the target line top
            posY = _topY + _boxH / 2;
        } else {
            // point text sits on the baseline of its single line
            template = comp.layers.addText("TEMPLATE");
            posY = _topY + _lineH * 0.8;
        }
        template.name = "SubPlugin_tpl";

        var textDoc = template.property("Source Text").value;
        textDoc.text = "TEMPLATE";
        textDoc.font = "${CLASSIC.font}";
        textDoc.fontSize = _fontSize;
        textDoc.fillColor = [${CLASSIC.fillColor.join(',')}];
        try { textDoc.applyFill = true; } catch(e) {}
        textDoc.strokeColor = [${CLASSIC.strokeColor.join(',')}];
        textDoc.strokeWidth = ${CLASSIC.strokeWidth};
        try { textDoc.applyStroke = true; } catch(e) {}
        try { textDoc.strokeOverFill = ${CLASSIC.strokeOverFill}; } catch(e) {}
        try { textDoc.allCaps = ${CLASSIC.allCaps}; } catch(e) {}
        try { textDoc.autoLeading = true; } catch(e) {}
        try { textDoc.tracking = 0; } catch(e) {}
        textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
        template.property("Source Text").setValue(textDoc);
        template.property("Transform").property("Position").setValue([posX, Math.round(posY)]);

        // Text > More Options > Fill & Stroke = All Fills Over All Strokes.
        // Not reachable through TextDocument (which only exposes the boolean
        // strokeOverFill); it is a layer property. Without it a thick stroke on one
        // glyph eats into its neighbours.
        try {
            var _more = template.property("ADBE Text Properties").property("ADBE Text More Options");
            if (_more) _more.property("ADBE Text Render Order").setValue(2);
        } catch(e) {}

        _subtitleY = Math.round(posY);
        _subtitleTopY = Math.round(_topY);
    `;
}

async function createTemplateLayer(target, mode) {
    const useBoxText = (mode === 'sentences' || mode === 'smartwords');
    const useFixedWidth = (mode === 'smartwords');
    const meta = targetMeta(target);

    const script = `
        (function() {
            var undoOpen = false;
            try {
                var comp = resolveTaggedComp(${meta});
                if (!comp) return "ERROR:Cannot resolve subtitles comp";
                app.beginUndoGroup("Spilio Subs: template");
                undoOpen = true;
                var _subtitleY = 0;
                var _subtitleTopY = 0;
                ${classicTextDocScript(useBoxText, useFixedWidth)}
                app.endUndoGroup();
                undoOpen = false;
                return JSON.stringify({ success: true, index: template.index, posY: _subtitleY, topY: _subtitleTopY, compHeight: comp.height });
            } catch(e) {
                try { if (undoOpen) app.endUndoGroup(); } catch(x) {}
                return "ERROR:" + e.toString();
            }
        })();
    `;
    return evalHostJson(script, 'tag');
}

async function duplicateBatch(target, jobPath, from, to, mode) {
    const meta = targetMeta(target);
    const offset = target.timeOffset || 0;
    const safeJobPath = jobPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const script = `
        (function() {
            var undoOpen = false;
            try {
                var comp = resolveTaggedComp(${meta});
                if (!comp) return "ERROR:Cannot resolve subtitles comp";

                var template = null;
                for (var i = 1; i <= comp.numLayers; i++) {
                    if (String(comp.layer(i).name) === "SubPlugin_tpl") { template = comp.layer(i); break; }
                }
                if (!template) return "ERROR:Template layer disappeared";

                var jf = new File("${safeJobPath}");
                jf.encoding = "UTF-8";
                if (!jf.exists) return "ERROR:Job file missing";
                jf.open("r");
                var raw = jf.read();
                jf.close();
                var data = JSON.parse(raw);

                app.beginUndoGroup("Spilio Subs: subtitles ${from}");
                undoOpen = true;

                var baseDoc = template.property("Source Text").value;
                var made = 0;

                for (var k = ${from}; k < ${to} && k < data.length; k++) {
                    var item = data[k];
                    var text = String(item.text || item.word || "");
                    text = text.replace(/^\\s+|\\s+$/g, "");
                    if (!text) continue;

                    var lyr = template.duplicate();
                    baseDoc.text = text;
                    lyr.property("Source Text").setValue(baseDoc);
                    lyr.name = "SubPlugin_${mode}_" + Math.round(item.start * 1000) + "_" + k;

                    var st = (item.start || 0) - ${offset};
                    var en = item.end - ${offset};
                    if (st < 0) st = 0;
                    if (!(en > st)) en = st + 0.4;
                    lyr.startTime = st;
                    lyr.inPoint = st;
                    lyr.outPoint = en;
                    made++;
                }

                app.endUndoGroup();
                undoOpen = false;
                return JSON.stringify({ success: true, made: made });
            } catch(e) {
                try { if (undoOpen) app.endUndoGroup(); } catch(x) {}
                return "ERROR:" + e.toString();
            }
        })();
    `;
    return evalHostJson(script, 'tag');
}

async function removeTemplateLayer(target) {
    const meta = targetMeta(target);
    const script = `
        (function() {
            try {
                var comp = resolveTaggedComp(${meta});
                if (!comp) return "ERROR:Cannot resolve subtitles comp";
                app.beginUndoGroup("Spilio Subs: cleanup");
                for (var i = comp.numLayers; i >= 1; i--) {
                    if (String(comp.layer(i).name) === "SubPlugin_tpl") comp.layer(i).remove();
                }
                app.endUndoGroup();
                return JSON.stringify({ success: true });
            } catch(e) {
                try { app.endUndoGroup(); } catch(x) {}
                return "ERROR:" + e.toString();
            }
        })();
    `;
    return evalHostJson(script, 'tag');
}

// Says what the style actually did, not what we hoped it did. The old log reused
// the build count, so a style that touched nothing still read as a success.
function reportStyleResult(result, style) {
    if (!result || typeof result !== 'object') return;
    const name = style ? style.displayName : 'style';
    log('Style "' + name + '" applied to ' + result.applied + '/' + result.targets + ' layers');
    if (result.failed) {
        logWarn(result.failed + ' layer(s) failed: ' + (result.firstError || 'no detail'));
    }
    if (result.targets && result.applied === 0) {
        logError('Style matched ' + result.targets + ' layers but changed none.');
    }
}

const BATCH_SIZE = 150;

// The job file is read back by ExtendScript, so keep it lean:
// only what the builder and the per-word styles actually consume.
function slimForJob(layersData) {
    return layersData.map(function (item) {
        var words = (item.words || []).map(function (w) {
            return { word: w.word, start: w.start, end: w.end };
        });
        return {
            text: item.text !== undefined ? item.text : item.word,
            start: item.start,
            end: item.end,
            words: words
        };
    });
}

async function buildSubtitleLayers(layersData, mode, target, styleName) {
    const dir = await getTempFolder();
    const jobPath = dir + '/job_' + Date.now() + '.json';
    const slim = slimForJob(layersData);
    await writeTextFile(jobPath, JSON.stringify(slim));
    log('Job file: ' + Math.round(JSON.stringify(slim).length / 1024) + ' KB, ' + slim.length + ' segments');

    try {
        const tpl = await createTemplateLayer(target, mode);
        log('First subtitle line top: ' + tpl.topY + ' px (comp height ' + tpl.compHeight + ')');

        const style = window.STYLES[styleName];
        // A style can only be baked into the template when it lives entirely on the
        // text layer's own properties. Anything that spawns a companion layer (a
        // bubble shape, an underline) cannot: duplicate() copies the text layer
        // alone, so 213 subtitles would share one orphaned shape.
        const templateFirst = style && !style.isBase && !style.needsWordData && !style.createsLayers;

        if (templateFirst) {
            log('Applying style "' + style.displayName + '" to template...');
            reportStyleResult(await applySubtitleStyle(styleName, null, target), style);
        }

        let made = 0;
        for (let i = 0; i < layersData.length; i += BATCH_SIZE) {
            throwIfCancelled();
            const to = Math.min(i + BATCH_SIZE, layersData.length);
            const res = await duplicateBatch(target, jobPath, i, to, mode);
            made += res.made;
            updateProgress(70 + Math.round((to / layersData.length) * 25));
            log('Built ' + made + '/' + layersData.length + ' subtitles');
        }

        await removeTemplateLayer(target);

        if (style && !style.isBase && (style.needsWordData || style.createsLayers)) {
            log('Applying style "' + style.displayName + '" (per-layer pass)...');
            reportStyleResult(await applySubtitleStyle(styleName, { data: layersData }, target), style);
        }

        return made;
    } finally {
        deleteFileQuiet(jobPath);
    }
}

// ==================== SRT MODE: SINGLE LAYER ====================

async function buildSrtLayer(layersData, target) {
    const offset = target.timeOffset || 0;
    const dir = await getTempFolder();
    const jobPath = dir + '/job_' + Date.now() + '.json';
    await writeTextFile(jobPath, JSON.stringify(slimForJob(layersData)));
    const meta = targetMeta(target);
    const safeJobPath = jobPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const script = `
        (function() {
            var undoOpen = false;
            try {
                var comp = resolveTaggedComp(${meta});
                if (!comp) return "ERROR:Cannot resolve subtitles comp";

                var jf = new File("${safeJobPath}");
                jf.encoding = "UTF-8";
                if (!jf.exists) return "ERROR:Job file missing";
                jf.open("r");
                var data = JSON.parse(jf.read());
                jf.close();
                if (!data.length) return "ERROR:No subtitle data";

                app.beginUndoGroup("Spilio Subs: SRT layer");
                undoOpen = true;

                var _subtitleY = 0;
                var _subtitleTopY = 0;
                ${classicTextDocScript(true, false)}
                template.name = "SRT_SUBTITLES";
                var prop = template.property("Source Text");
                var doc = prop.value;

                var EPS = 0.001;
                for (var i = 0; i < data.length; i++) {
                    var item = data[i];
                    var text = String(item.text || item.word || "").replace(/^\\s+|\\s+$/g, "");
                    if (!text) continue;

                    var start = item.start - ${offset};
                    if (start < 0) start = 0;
                    doc.text = text;
                    prop.setValueAtTime(start, doc);

                    var nextStart = (i + 1 < data.length) ? (data[i + 1].start - ${offset}) : null;
                    var end = item.end - ${offset};
                    if (!(end > start)) end = start + 0.4;
                    if (nextStart === null || nextStart > end + EPS) {
                        doc.text = "";
                        prop.setValueAtTime(end, doc);
                    }
                }

                for (var k = 1; k <= prop.numKeys; k++) {
                    prop.setInterpolationTypeAtKey(k, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
                }

                template.startTime = 0;
                var firstStart = Math.max(0, data[0].start - ${offset});
                var lastEnd = data[data.length - 1].end - ${offset};
                template.inPoint = firstStart;
                template.outPoint = (lastEnd > firstStart) ? lastEnd : (firstStart + 1);

                app.endUndoGroup();
                undoOpen = false;
                return JSON.stringify({ success: true, made: prop.numKeys });
            } catch(e) {
                try { if (undoOpen) app.endUndoGroup(); } catch(x) {}
                return "ERROR:" + e.toString();
            }
        })();
    `;

    try {
        const res = await evalHostJson(script, 'tag');
        return res.made;
    } finally {
        deleteFileQuiet(jobPath);
    }
}

// ==================== SEGMENTATION DISPATCH ====================

function segmentTranscript(transcript, mode) {
    const settings = Object.assign({}, SEGMENTATION_DEFAULTS, userSegmentationSettings);
    let layersData = [];

    if (!transcript.words || !transcript.words.length) {
        if (transcript.text) {
            layersData = [{ text: safeTrim(transcript.text), start: 0, end: 3, words: [] }];
        }
        return layersData;
    }

    if (mode === 'words' || mode === 'srt') {
        // Whisper returns bare words; pull punctuation in from the segment text
        // so the Classic style has something to show. Other styles strip it later.
        let plainWords = transcript.words;
        if (transcript._needsPunctuationHints) {
            plainWords = applyPunctuationHintsToWords(plainWords, transcript);
        }
        layersData = plainWords.map((w) => ({
            text: w.word,
            word: w.word,
            start: w.start,
            end: w.end,
            words: [w]
        }));
    } else if (mode === 'sentences') {
        let words = transcript.words;
        if (transcript._needsPunctuationHints) {
            const before = countWordsWithPunctuation(words);
            words = applyPunctuationHintsToWords(words, transcript);
            log('Punctuation hints: ' + before + ' -> ' + countWordsWithPunctuation(words) + ' tokens');
        }
        layersData = buildSentenceLayersFromWords(words, settings);
    } else if (mode === 'smartwords') {
        let words = transcript.words;
        if (transcript._needsPunctuationHints) {
            words = applyPunctuationHintsToWords(words, transcript);
        }
        layersData = groupSmartWords(words);
    }

    return layersData;
}

// ==================== DISPLAY TEXT PER STYLE ====================
// The segmented data is kept RAW (punctuation included) in memory, and the
// on-screen text is derived from it at build time. That way switching
// Classic <-> any other style always gets the right variant.
// SRT has no style, so it stays punctuation-free as before.

function styleKeepsPunctuation(styleName) {
    const style = window.STYLES && window.STYLES[styleName];
    return !!(style && style.keepPunctuation);
}

function displayLayersFor(rawLayers, mode, styleName) {
    if (mode !== 'srt' && styleKeepsPunctuation(styleName)) {
        return keepPunctuationInLayers(rawLayers);
    }
    return stripPunctuationInLayers(rawLayers);
}

// ==================== MAIN FLOW ====================

const MODE_LABELS = {
    smartwords: 'SNAP SUBS',
    sentences: 'SENT',
    words: 'SUB',
    srt: 'SRT'
};

async function processAudio(mode) {
    if (isProcessing) return;
    cancelRequested = false;
    setBusy(true);

    const started = Date.now();
    const timings = [];
    function mark(label, t0) { timings.push(label + ' ' + ((Date.now() - t0) / 1000).toFixed(1) + 's'); }

    try {
        log('=== ' + (MODE_LABELS[mode] || mode) + ' started ===');
        updateProgress(3);

        let t = Date.now();
        const sel = await collectAudioLayers();
        mark('collect', t);
        throwIfCancelled();
        updateProgress(8);

        const cacheKey = buildMixCacheKey(sel);
        let transcript = await readTranscriptCache(cacheKey);

        if (transcript) {
            log('Transcript cache HIT (' + transcript.words.length + ' words) - skipping render and API');
            updateProgress(60);
        } else {
            t = Date.now();
            const wavPath = await renderMixToWav(sel);
            mark('render', t);
            throwIfCancelled();
            updateProgress(25);

            let payload;
            try {
                t = Date.now();
                payload = await prepareUploadPayload(wavPath);
                mark('encode', t);
            } finally {
                deleteFileQuiet(wavPath);
            }
            throwIfCancelled();
            updateProgress(40);

            t = Date.now();
            transcript = await transcribeBlob(payload.blob, payload.filename);
            mark('api', t);
            updateProgress(60);

            await writeTranscriptCache(cacheKey, transcript);
        }

        throwIfCancelled();

        const corrected = applyCanonicalCorrections(transcript.words);
        if (corrected.merged || corrected.recased) {
            log('Corrections: ' + corrected.merged + ' merged, ' + corrected.recased + ' recased');
        }
        const working = Object.assign({}, transcript, { words: corrected.words });

        const rawLayers = segmentTranscript(working, mode);
        const layersData = displayLayersFor(rawLayers, mode, selectedStyleName);
        log('Punctuation: ' + (mode !== 'srt' && styleKeepsPunctuation(selectedStyleName) ? 'kept (Classic)' : 'stripped'));

        if (!layersData.length) throw new Error('Segmentation produced no subtitles');
        log('Segments: ' + layersData.length);
        updateProgress(65);

        t = Date.now();
        const target = await ensureSubsPrecomp(sel, null);
        throwIfCancelled();

        let made;
        if (mode === 'srt') {
            made = await buildSrtLayer(layersData, target);
        } else {
            made = await buildSubtitleLayers(layersData, mode, target, selectedStyleName);
        }
        mark('build', t);

        window.currentSubtitleData = { data: layersData, raw: rawLayers, target: target, mode: mode };

        updateProgress(100);
        log('Done: ' + made + ' subtitles in ' + target.layerName +
            ' (' + ((Date.now() - started) / 1000).toFixed(1) + 's total)');
        log('Timing: ' + timings.join(' | '));

    } catch (err) {
        if (cancelRequested) logWarn('Cancelled');
        else logError(err && err.message ? err.message : String(err));
    } finally {
        setBusy(false);
        currentAbortController = null;
    }
}

// ==================== SETTINGS ====================

function loadSettings() {
    try {
        const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
        const parsed = saved ? safeParseJSON(saved, null) : null;
        if (parsed && typeof parsed === 'object') {
            userSegmentationSettings = Object.assign({}, SEGMENTATION_DEFAULTS, parsed.segmentation || {});
            if (parsed.mode && MODE_LABELS[parsed.mode]) currentMode = parsed.mode;
            if (parsed.style) selectedStyleName = parsed.style;
            if (parsed.provider) {
                const sel = document.getElementById('providerSelect');
                if (sel) sel.value = parsed.provider;
            }
        }
    } catch (e) { /* defaults */ }
}

function persistSettings() {
    try {
        const sel = document.getElementById('providerSelect');
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
            segmentation: userSegmentationSettings,
            mode: currentMode,
            style: selectedStyleName,
            provider: sel ? sel.value : CONFIG.DEFAULT_PROVIDER
        }));
    } catch (e) { /* ignore */ }
}

// ==================== UI WIRING ====================

let currentMode = 'smartwords';

function setMode(mode) {
    if (!MODE_LABELS[mode]) return;
    currentMode = mode;
    const btn = document.getElementById('mainActionBtn');
    if (btn) btn.textContent = MODE_LABELS[mode];
    persistSettings();
}

let uiInitialised = false;

function initUI() {
    if (uiInitialised) return;
    uiInitialised = true;

    window.addEventListener('error', function (ev) {
        logError('Uncaught: ' + (ev.message || 'unknown') +
            (ev.filename ? ' @ ' + String(ev.filename).split('/').pop() + ':' + ev.lineno : ''));
    });
    window.addEventListener('unhandledrejection', function (ev) {
        const reason = ev.reason;
        logError('Unhandled: ' + (reason && reason.message ? reason.message : String(reason)));
    });

    loadSettings();
    setMode(currentMode);

    const mainBtn = document.getElementById('mainActionBtn');
    const caret = document.getElementById('modeToggleBtn');
    const menu = document.getElementById('modeMenu');

    if (!mainBtn) {
        logError('Action button not found in the panel markup - the panel cannot work.');
    } else {
        mainBtn.onclick = function () { processAudio(currentMode); };
    }

    if (caret && menu) {
        caret.onclick = function (ev) {
            ev.stopPropagation();
            menu.classList.toggle('open');
        };
        document.addEventListener('click', function () { menu.classList.remove('open'); });
        const items = menu.querySelectorAll('.mode-item');
        for (let mi = 0; mi < items.length; mi++) {
            (function (item) {
                item.onclick = function (ev) {
                    ev.stopPropagation();
                    setMode(item.getAttribute('data-mode'));
                    menu.classList.remove('open');
                };
            })(items[mi]);
        }
    }

    // ---- style picker: the active card IS the selection; there is no Apply.
    const styleCaret = document.getElementById('styleToggleBtn');
    const styleMenu = document.getElementById('styleMenu');
    const activeCard = document.getElementById('activeStyleCard');

    function paintActiveStyle(name) {
        const source = styleMenu ? styleMenu.querySelector('.style-card[data-style="' + name + '"]') : null;
        if (!source || !activeCard) return;
        activeCard.setAttribute('data-style', name);
        activeCard.innerHTML = source.innerHTML;
        const cards = styleMenu.querySelectorAll('.style-card');
        for (let ci = 0; ci < cards.length; ci++) {
            cards[ci].classList.toggle('active', cards[ci].getAttribute('data-style') === name);
        }
    }
    window.paintActiveStyle = paintActiveStyle;

    if (styleCaret && styleMenu) {
        const openPicker = function (ev) {
            ev.stopPropagation();
            styleMenu.classList.toggle('open');
            styleCaret.setAttribute('aria-expanded', styleMenu.classList.contains('open') ? 'true' : 'false');
        };
        styleCaret.onclick = openPicker;
        if (activeCard) activeCard.onclick = openPicker;
        document.addEventListener('click', function () { styleMenu.classList.remove('open'); });

        const cards = styleMenu.querySelectorAll('.style-card');
        for (let ci = 0; ci < cards.length; ci++) {
            (function (card) {
                card.onclick = function (ev) {
                    ev.stopPropagation();
                    const name = card.getAttribute('data-style');
                    selectedStyleName = name;
                    persistSettings();
                    paintActiveStyle(name);
                    styleMenu.classList.remove('open');
                    const st = window.STYLES[name];
                    log('Style set to "' + (st ? st.displayName : name) + '" - press SNAP SUBS to build with it');
                };
            })(cards[ci]);
        }
        paintActiveStyle(selectedStyleName);
    }

    // ---- log panel collapse
    const logToggle = document.getElementById('logToggleBtn');
    const logWrap = document.getElementById('logWrap');
    if (logToggle && logWrap) {
        logToggle.onclick = function () {
            const collapsed = logWrap.classList.toggle('collapsed');
            logToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            logToggle.innerHTML = collapsed ? '&#9662;' : '&#9652;';
            if (!collapsed) {
                const lw = document.getElementById('logWindow');
                if (lw) lw.scrollTop = lw.scrollHeight;
            }
        };
    }

    const boundary = document.getElementById('boundaryMode');
    if (boundary) {
        boundary.value = userSegmentationSettings.boundaryMode;
        boundary.onchange = () => {
            userSegmentationSettings.boundaryMode = boundary.value;
            persistSettings();
        };
    }

    const provider = document.getElementById('providerSelect');
    if (provider) {
        provider.onchange = () => {
            log('Provider: ' + CONFIG.getActiveProvider().name);
            persistSettings();
        };
    }

    const copyBtn = document.getElementById('copyLogsBtn');
    const clearBtn = document.getElementById('clearLogsBtn');
    const logWindow = document.getElementById('logWindow');
    if (copyBtn && logWindow) {
        copyBtn.onclick = () => {
            copyTextToClipboard(runtimeLogLines.join('\n')).then(() => {
                copyBtn.textContent = 'Copied';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
            });
        };
    }
    if (clearBtn && logWindow) {
        clearBtn.onclick = () => { logWindow.innerHTML = ''; runtimeLogLines.length = 0; };
    }

    setBusy(false);
    log('Panel ready - ' + MODE_LABELS[currentMode] + ' mode, ' +
        CONFIG.getActiveProvider().name);
}

// Style gallery selection is owned by styles.js; it calls back here.
window.setSelectedStyle = function (styleName) {
    selectedStyleName = styleName || 'classic';
    persistSettings();
};
window.getSelectedStyle = function () { return selectedStyleName; };

document.addEventListener('DOMContentLoaded', initUI);
if (document.readyState === 'interactive' || document.readyState === 'complete') initUI();

log('Ready - select layers with audio, then press SNAP SUBS');

// ==================== RESTYLE (rebuild from cached transcript) ====================
// Changing a style rebuilds the subtitles inside the SAME sub-N precomp.
// No API call, no re-render: the segmented data is already in memory.
// The precomp number is deliberately NOT incremented.

async function clearSubsPrecomp(target) {
    const meta = targetMeta(target);
    const script = `
        (function() {
            var undoOpen = false;
            try {
                var comp = resolveTaggedComp(${meta});
                if (!comp) return "ERROR:Cannot resolve subtitles comp";
                app.beginUndoGroup("Spilio Subs: clear subtitles");
                undoOpen = true;
                for (var i = comp.numLayers; i >= 1; i--) {
                    try { comp.layer(i).remove(); } catch(e) {}
                }
                app.endUndoGroup();
                undoOpen = false;
                return JSON.stringify({ success: true });
            } catch(e) {
                try { if (undoOpen) app.endUndoGroup(); } catch(x) {}
                return "ERROR:" + e.toString();
            }
        })();
    `;
    return evalHostJson(script, 'tag');
}

window.rebuildWithStyle = async function (styleName) {
    if (isProcessing) return;
    const cur = window.currentSubtitleData;
    if (!cur || !cur.target) {
        logError('Create subtitles first, then pick a style.');
        return;
    }

    cancelRequested = false;
    setBusy(true);
    const started = Date.now();

    try {
        selectedStyleName = styleName || 'classic';
        persistSettings();

        const style = window.STYLES[selectedStyleName];
        log('Rebuilding ' + cur.data.length + ' subtitles as "' +
            (style ? style.displayName : selectedStyleName) + '"...');

        // Re-derive the on-screen text: Classic keeps punctuation, the rest do not.
        if (cur.raw) cur.data = displayLayersFor(cur.raw, cur.mode, selectedStyleName);

        await clearSubsPrecomp(cur.target);
        updateProgress(20);

        let made;
        if (cur.mode === 'srt') {
            made = await buildSrtLayer(cur.data, cur.target);
        } else {
            made = await buildSubtitleLayers(cur.data, cur.mode, cur.target, selectedStyleName);
        }

        updateProgress(100);
        log('Restyled: ' + made + ' subtitles in ' +
            ((Date.now() - started) / 1000).toFixed(1) + 's');
    } catch (err) {
        logError(err && err.message ? err.message : String(err));
    } finally {
        setBusy(false);
    }
};
