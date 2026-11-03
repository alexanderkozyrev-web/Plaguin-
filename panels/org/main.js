// main.js — OrganizeMe v2.8

const csInterface = new CSInterface();

// The version badge is read from CSXS/manifest.xml at startup instead of
// being hardcoded in index.html — v3.0 shipped showing "v2.8" in the panel
// header because the two lived in different files and drifted apart.
(function syncVersionBadge() {
    try {
        const manifestPath = require('path').join(
            csInterface.getExtensionPath(), 'CSXS', 'manifest.xml');
        const xml = require('fs').readFileSync(manifestPath, 'utf8');
        const m = xml.match(/ExtensionBundleVersion\s*=\s*"([^"]+)"/);
        if (!m) return;
        const short = m[1].split('.').slice(0, 2).join('.');   // 3.0.0 -> 3.0
        document.addEventListener('DOMContentLoaded', () => {
            const el = document.getElementById('versionBadge');
            if (el) el.textContent = 'v' + short;
        });
    } catch (e) { /* badge keeps the static fallback from index.html */ }
})();

// ─────────────────────────────────────────────────────────────
// Feature flags
// ─────────────────────────────────────────────────────────────
// v2.5: Layer-Name renaming is MUTED (not removed). When false, footage is
// always collected under its original disk filename. Flip to true to restore
// the v2.4 behaviour of renaming collected files to match their Layer Name.
const ENABLE_LAYER_RENAME = false;

// v2.9 EXPERIMENT: which font collector to run.
//   'plainly' — port of plainly-videos/after-effects-plugin. Reads
//               layer.sourceText, trusts fontLocation as reported, applies
//               Plainly's installed/substitute decision tree, whitelists
//               .otf/.ttf/.ttc and saves each file as <PostScriptName><ext>.
//               NO disk fallback search — if AE gives no location, the font
//               is reported, not guessed at.
//   'legacy'  — v2.8 behaviour (getFontInfo + fontSearchPaths index).
// ROLLBACK IS THIS ONE WORD. Both code paths are kept side by side.
// v3.0 collect engine.
//   'v3' — temp-file transport, footageMissing, pre-flight gate, proxies,
//          interpretation preserved, post-flight audit, rollback on failure.
//   'v2' — the 2.9 path (hex evalScript payload, File.exists, no audit).
// ROLLBACK IS THIS ONE WORD. Both host and panel keep both code paths.
const COLLECT_ENGINE = 'v3';

// Folder names. Centralised here so the planned Settings screen can let each
// team choose their own — nothing else in the code hardcodes these strings.
const FOLDER_NAMES = {
    footage:    '(Footage)',
    fonts:      'Fonts',
    // Project-panel folders created by Organize & Clean:
    finalComps: '#1_finalComps',
    preComps:   '#2_preComps',
    sound:      '#3_sound',
    footages:   '#4_footages',
    solids:     '#5_solids',
    motion:     'motion',
    graphics:   'static'
};

const FONT_ENGINE = 'plainly';

// Upstream Plainly aborts the whole export when a font is missing or has no
// location. Our agreed policy is strict on footage, soft on fonts — so this
// stays false and font problems only produce report lines. Flip to true for
// upstream-identical behaviour.
const PLAINLY_STRICT_FONTS = false;

// v2.8: The disclaimer gate is SOFT. Detection of localized disclaimers is
// heuristic and produced false "no disclaimer" blocks. When a disclaimer is
// not detected (or the check itself fails), the collect is no longer aborted —
// the user gets a Так/Ні confirmation popup and decides. Set to false to skip
// the check entirely.
const ENABLE_DISCLAIMER_GATE = true;

// Node.js modules (available in CEP via --enable-nodejs)
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execFile, exec } = require('child_process');

// ─────────────────────────────────────────────────────────────
// UI refs
// ─────────────────────────────────────────────────────────────
const organizeBtn      = document.getElementById('organizeBtn');
const organizeCleanBtn = document.getElementById('organizeCleanBtn');
const collectBtn       = document.getElementById('collectBtn');
const blackMagicBtn    = document.getElementById('blackMagicBtn');
const progressWrap     = document.getElementById('progressWrap');
const progressBar      = document.getElementById('progressBar');
const progressLabel    = document.getElementById('progressLabel');
const statusEl         = document.getElementById('status');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function setStatus(msg, type = '') {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (type ? ' ' + type : '');
}

function setProgress(pct, label, magic = false) {
    progressWrap.classList.remove('hidden');
    progressBar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    progressBar.className = 'progress-bar' + (magic ? ' magic' : '');
    if (label) progressLabel.textContent = label;
}

function hideProgress() {
    progressWrap.classList.add('hidden');
    progressBar.style.width = '0%';
}

function lockButtons(locked) {
    [organizeBtn, organizeCleanBtn, collectBtn, blackMagicBtn].forEach(b => {
        b.disabled = locked;
    });
}

// ─────────────────────────────────────────────────────────────
// In-panel modals (v2.8)
// alert()/confirm() can't render custom "Так"/"Ні" buttons and can't
// highlight report lines — a lightweight HTML overlay does both.
// ─────────────────────────────────────────────────────────────
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle   = document.getElementById('modalTitle');
const modalBody    = document.getElementById('modalBody');
const modalButtons = document.getElementById('modalButtons');

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// buttons: [{ label, value, cls }] — resolves with the clicked button's value
function showModal(title, bodyHTML, buttons) {
    return new Promise(resolve => {
        modalTitle.textContent = title;
        modalBody.innerHTML = bodyHTML;
        modalButtons.innerHTML = '';
        for (const b of buttons) {
            const btn = document.createElement('button');
            btn.className = 'modal-btn ' + (b.cls || '');
            btn.textContent = b.label;
            btn.onclick = () => {
                modalOverlay.classList.add('hidden');
                resolve(b.value);
            };
            modalButtons.appendChild(btn);
        }
        modalOverlay.classList.remove('hidden');
    });
}

// "Так" / "Ні" confirmation → Promise<boolean>
function confirmModal(title, bodyHTML) {
    return showModal(title, bodyHTML, [
        { label: 'Так', value: true,  cls: 'modal-btn-yes' },
        { label: 'Ні',  value: false, cls: 'modal-btn-no'  }
    ]);
}

// Collect report window. lines: [{ type: 'ok'|'warn'|'err'|'info', html }]
function reportModal(title, lines) {
    const body = lines
        .map(l => `<div class="report-line report-${l.type}">${l.html}</div>`)
        .join('');
    return showModal(title, body, [{ label: 'OK', value: true, cls: 'modal-btn-yes' }]);
}

function evalScript(script) {
    return new Promise((resolve, reject) => {
        csInterface.evalScript(script, result => {
            const s = (result || '').trim();
            try {
                const parsed = JSON.parse(s);
                if (parsed.success === false) reject(new Error(parsed.error || 'ExtendScript error'));
                else resolve(parsed);
            } catch (e) {
                if (s.startsWith('ERROR:')) reject(new Error(s.slice(6)));
                else resolve(s);
            }
        });
    });
}

// Sanitize a string for use as a filename — strips path separators
// and characters that are invalid on Windows/macOS file systems.
function sanitizeFilename(s) {
    return String(s).replace(/[\/\\:*?"<>|\x00-\x1F]/g, '_').trim();
}

// Decide the target filename for a collected footage file.
// Rules:
//   - If layerName is empty → use original disk filename
//   - If layerName matches disk filename (with or without extension) → keep original
//   - Otherwise → use layerName, preserving original extension if missing
function resolveCollectedName(srcPath, layerName) {
    const diskName = path.basename(srcPath);
    const ext      = path.extname(diskName);
    const diskStem = path.basename(diskName, ext);

    if (!layerName) return diskName;

    const cleaned = sanitizeFilename(layerName);
    if (!cleaned) return diskName;

    // Already equal? Keep original.
    if (cleaned === diskName || cleaned === diskStem) return diskName;

    // If layer name has the same extension already → use as-is.
    const layerExt = path.extname(cleaned);
    if (layerExt.toLowerCase() === ext.toLowerCase()) return cleaned;

    // No / different extension → append the original extension.
    return cleaned + ext;
}

// Copy a file to destDir under a specific target filename, auto-renaming
// on collision (foo.mp4 → foo_1.mp4 → foo_2.mp4 …). Returns destination path.
function copyFileAs(src, destDir, targetName) {
    const ext  = path.extname(targetName);
    const base = path.basename(targetName, ext);
    let dest   = path.join(destDir, targetName);
    let counter = 1;
    while (fs.existsSync(dest)) {
        dest = path.join(destDir, base + '_' + counter + ext);
        counter++;
    }
    fs.copyFileSync(src, dest);
    return dest;
}

// ─────────────────────────────────────────────────────────────
// DESTINATION-AWARE PLACEMENT (v3.1)
//
// buildDedupPlan collapses duplicates *inside the project*. It knows nothing
// about what is already sitting in (Footage)/, and that gap is what made a
// repeated collect grow the folder fourfold: copyFileAs only ever looked for
// a free name, so a byte-identical file already on disk got a twin called
// name_1, then name_1_1, then name_1_2.
//
// So before copying, ask whether the file is already there. Size first
// (free), then the full content hash, which is the same test the in-project
// dedup trusts. Only genuinely different content earns a _N suffix.
//
// Names are never normalised on the way out. Trailing numbers are meaningful
// in this footage library — shot_01.mp4 and shot_02.mp4 are two different
// shots — so stripping them to tidy a chain would be trading a cosmetic
// problem for a wrong-file one. The chain stops growing because the copy is
// skipped, and collapseFootageDuplicates below shortens the names that are
// already there, by content rather than by spelling.
// ─────────────────────────────────────────────────────────────

function sameContent(a, b) {
    try {
        const sa = fs.statSync(winPath(a));
        const sb = fs.statSync(winPath(b));
        if (!sa.isFile() || !sb.isFile()) return false;
        if (sa.size !== sb.size) return false;
        if (sa.size === 0) return true;
        return contentHash(winPath(a), sa.size) === contentHash(winPath(b), sb.size);
    } catch (e) {
        return false;
    }
}

// Returns { path, reused }. Reused means nothing was written to disk.
function placeFileAs(src, destDir, targetName) {
    const ext  = path.extname(targetName);
    const base = path.basename(targetName, ext);

    let dest = path.join(destDir, targetName);
    let counter = 1;

    while (fs.existsSync(winPath(dest))) {
        if (sameContent(src, dest)) return { path: dest, reused: true };
        dest = path.join(destDir, base + '_' + counter + ext);
        counter++;
    }

    fs.copyFileSync(winPath(src), winPath(dest));
    return { path: dest, reused: false };
}

// Every file under dir, skipping whole subtrees listed in skipDirs.
function listFilesDeep(dir, skipDirs) {
    const skip = new Set((skipDirs || []).map(d => path.resolve(d)));
    const out = [];

    (function walk(d) {
        if (skip.has(path.resolve(d))) return;
        let entries;
        try { entries = fs.readdirSync(winPath(d), { withFileTypes: true }); } catch (e) { return; }
        for (const e of entries) {
            const full = path.join(d, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.isFile() && e.name !== '.DS_Store') out.push(full);
        }
    })(dir);

    return out;
}

// ─────────────────────────────────────────────────────────────
// Collapse byte-identical files already sitting in (Footage)/.
//
// A folder that has been collected into several times holds chains like
// Diagram_1.png / Diagram_1_1.png / Diagram_1_2.png / Diagram_1_2_1.png —
// four copies of one picture, with the project pointing at the longest name.
// Grouping by content and keeping the shortest name unwinds the chain and
// leaves the project on the tidiest of the four.
//
// Content, never spelling. Two files merge only if every byte matches, so
// shot_01.mp4 and shot_02.mp4 stay two files no matter how similar their
// names look.
//
// Returns a remap of planned path → surviving path. Deleting the losers is
// left to the sweep, which runs only after the relink has been audited.
// ─────────────────────────────────────────────────────────────
function collapseFootageDuplicates(footageDir, plannedPaths, protectedDirs) {
    const remap = new Map();
    const files = listFilesDeep(footageDir, protectedDirs);
    if (files.length < 2) return remap;

    const planned = new Set(plannedPaths.map(p => path.resolve(p)));

    const bySize = new Map();
    for (const f of files) {
        let st;
        try { st = fs.statSync(winPath(f)); } catch (e) { continue; }
        if (!bySize.has(st.size)) bySize.set(st.size, []);
        bySize.get(st.size).push({ path: f, size: st.size });
    }

    for (const group of bySize.values()) {
        if (group.length < 2) continue;
        if (!group.some(m => planned.has(path.resolve(m.path)))) continue;

        const byHash = new Map();
        for (const m of group) {
            let h;
            try { h = contentHash(winPath(m.path), m.size); } catch (e) { continue; }
            if (!byHash.has(h)) byHash.set(h, []);
            byHash.get(h).push(m.path);
        }

        for (const members of byHash.values()) {
            if (members.length < 2) continue;
            if (!members.some(m => planned.has(path.resolve(m)))) continue;

            const winner = members.slice().sort((a, b) => {
                const la = path.basename(a).length, lb = path.basename(b).length;
                if (la !== lb) return la - lb;
                return a < b ? -1 : 1;
            })[0];

            for (const m of members) {
                if (path.resolve(m) !== path.resolve(winner) && planned.has(path.resolve(m))) {
                    remap.set(path.resolve(m), winner);
                }
            }
        }
    }

    return remap;
}

// ─────────────────────────────────────────────────────────────
// Delete files in (Footage)/ that the saved project does not point at.
//
// Only ever called once the post-flight audit has confirmed every item in
// the collected project is online and resolves inside (Footage)/. Without
// that gate a failed relink would leave the project pointing at a file this
// function is about to delete.
//
// Sequence folders and (Proxies) are protected wholesale: their frames and
// proxy files are referenced by one entry each, so a per-file test would
// read them as unused and wipe them.
// ─────────────────────────────────────────────────────────────
function sweepOrphans(footageDir, usedPaths, protectedDirs) {
    const used = new Set(usedPaths.map(p => path.resolve(p)));
    let removed = 0;
    let bytes = 0;

    for (const f of listFilesDeep(footageDir, protectedDirs)) {
        if (used.has(path.resolve(f))) continue;
        try {
            const st = fs.statSync(winPath(f));
            fs.unlinkSync(winPath(f));
            removed++;
            bytes += st.size;
        } catch (e) { /* locked or already gone — leave it */ }
    }

    // Directories the sweep just emptied are noise in the delivered folder.
    for (let pass = 0; pass < 4; pass++) {
        for (const d of listDirsDeep(footageDir, protectedDirs)) {
            try {
                if (fs.readdirSync(winPath(d)).length === 0) fs.rmdirSync(winPath(d));
            } catch (e) {}
        }
    }

    return { removed, bytes };
}

function listDirsDeep(dir, skipDirs) {
    const skip = new Set((skipDirs || []).map(d => path.resolve(d)));
    const out = [];

    (function walk(d) {
        if (skip.has(path.resolve(d))) return;
        let entries;
        try { entries = fs.readdirSync(winPath(d), { withFileTypes: true }); } catch (e) { return; }
        for (const e of entries) {
            if (!e.isDirectory()) continue;
            const full = path.join(d, e.name);
            walk(full);
            out.push(full);
        }
    })(dir);

    return out;
}

// Copy a file, auto-rename on collision. Returns destination path.
function copyFileSafe(src, destDir) {
    const name = path.basename(src);
    let dest = path.join(destDir, name);
    let counter = 1;
    while (fs.existsSync(dest)) {
        const ext  = path.extname(name);
        const base = path.basename(name, ext);
        dest = path.join(destDir, base + '_' + counter + ext);
        counter++;
    }
    fs.copyFileSync(src, dest);
    return dest;
}

// ─────────────────────────────────────────────────────────────
// IMAGE SEQUENCES (v2.8)
// AE stores a sequence FootageItem as a single File pointing at the FIRST
// frame. v2.7 copied only that file → the collected project lost every other
// frame ("missing files" / sequence turned into a still after delivery).
// Native AE Collect Files copies the whole sequence — now we do too.
// ─────────────────────────────────────────────────────────────
function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Given the first frame's path, list every sibling frame of the sequence:
// same prefix/suffix around the LAST run of digits, same extension.
function listSequenceFiles(firstPath) {
    const dir  = path.dirname(firstPath);
    const ext  = path.extname(firstPath);
    const stem = path.basename(firstPath, ext);
    const m = stem.match(/^(.*?)(\d+)([^\d]*)$/);
    if (!m) return [firstPath];   // no frame counter → not really a sequence
    const re = new RegExp(
        '^' + escapeRegExp(m[1]) + '\\d+' + escapeRegExp(m[3]) + escapeRegExp(ext) + '$', 'i');
    let names;
    try {
        names = fs.readdirSync(dir).filter(n => re.test(n));
    } catch (e) {
        return [firstPath];
    }
    if (!names.length) return [firstPath];
    names.sort();
    return names.map(n => path.join(dir, n));
}

// Copy a whole sequence into destDir keeping exact frame names (renaming a
// frame would break the sequence). If ANY frame name already exists there,
// the entire sequence goes into a uniquely-suffixed subfolder instead.
// Returns the destination path of the FIRST frame (relink target).
function copySequenceAs(frames, destDir) {
    let target = destDir;
    const collision = frames.some(f => fs.existsSync(path.join(destDir, path.basename(f))));
    if (collision) {
        const ext  = path.extname(frames[0]);
        const stem = path.basename(frames[0], ext);
        let n = 1;
        do {
            target = path.join(destDir, stem + '_seq' + n);
            n++;
        } while (fs.existsSync(target));
    }
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    for (const f of frames) {
        fs.copyFileSync(f, path.join(target, path.basename(f)));
    }
    return target;   // caller anchors relink to <target>/<original first-frame name>
}

// Hex-encode a string (4 hex chars per character) for safe ExtendScript transfer
function toHex(str) {
    let hex = '';
    for (let i = 0; i < str.length; i++) {
        hex += ('0000' + str.charCodeAt(i).toString(16)).slice(-4);
    }
    return hex;
}

// ─────────────────────────────────────────────────────────────
// DUPLICATE DETECTION (v2.7)
//
// Goal: one collect must contain exactly ONE physical copy of each unique
// footage file, even when designers dragged the same asset in from different
// projects under Finder-suffixed names (cta.mp4 / cta(1).mp4 / cta copy.mp4).
//
// Merge criteria — ALL must hold:
//   1. same normalized filename (Finder/browser copy-suffixes stripped)
//   2. same exact byte size
//   3. same partial content hash (MD5 of first + last 1 MB + size)
//
// The hash check is what makes suffix-stripping safe: IMG_2338.MOV and
// IMG_2338(1).MOV from a camera can be two DIFFERENT shots — those differ
// in content and will never merge. Only bit-identical files collapse.
//
// The ORIGINAL project is never modified — merging happens purely in the
// collected copy: one file lands in (Footage)/, and every project item of
// the group is relinked to it.
// ─────────────────────────────────────────────────────────────
const crypto = require('crypto');

// Full content hash (MD5, streamed in 4 MB chunks). Only files that already
// match by normalized name AND exact byte size reach this stage, so the cost
// is negligible in practice (~1 s per 500 MB candidate) — and unlike a
// partial head+tail hash it can NEVER merge two different shots that happen
// to share size and container headers. Silent wrong-merge is the one failure
// mode this feature must not have.
function contentHash(filePath, size) {
    const h = crypto.createHash('md5');
    const CHUNK = 4 * 1024 * 1024;
    const buf = Buffer.alloc(Math.min(CHUNK, Math.max(size, 1)));
    const fd = fs.openSync(filePath, 'r');
    try {
        let pos = 0;
        while (pos < size) {
            const n = fs.readSync(fd, buf, 0, Math.min(CHUNK, size - pos), pos);
            if (n <= 0) break;
            h.update(buf.subarray(0, n));
            pos += n;
        }
    } finally {
        fs.closeSync(fd);
    }
    h.update(String(size));
    return h.digest('hex');
}

function normalizeStem(stem) {
    let s = String(stem), prev;
    do {
        prev = s;
        s = s.replace(/\s*\(\d+\)$/, '');            // "name (1)" / "name(2)"
        s = s.replace(/[ _-]copy(\s*\d+)?$/i, '');   // "name copy", "name copy 2", "name_copy"
        s = s.replace(/[ _-]dup(licate)?\d*$/i, ''); // "name_dup", "name duplicate"
        s = s.replace(/[ _-]\d{1,3}$/, '');          // "name_1", "name-2", "name 3" (collision/AE-collect suffixes)
    } while (s !== prev);
    return s.trim().toLowerCase();
}

// Pick the canonical file of a duplicate group: prefer the one whose real
// stem carries no copy-suffix (equals the normalized stem), then the
// shortest basename, then lexicographic — deterministic across re-collects.
function pickCanonical(members) {
    const scored = members.slice().sort((a, b) => {
        const aClean = normalizeStem(path.basename(a.path, path.extname(a.path))) ===
                       path.basename(a.path, path.extname(a.path)).trim().toLowerCase() ? 0 : 1;
        const bClean = normalizeStem(path.basename(b.path, path.extname(b.path))) ===
                       path.basename(b.path, path.extname(b.path)).trim().toLowerCase() ? 0 : 1;
        if (aClean !== bClean) return aClean - bClean;
        const al = path.basename(a.path).length, bl = path.basename(b.path).length;
        if (al !== bl) return al - bl;
        return a.path < b.path ? -1 : 1;
    });
    return scored[0];
}

// Input: info.footage — one entry per PROJECT ITEM (host no longer dedups).
// Output:
//   copyPlan: [{ canonical, itemIds, size }]   — one entry per unique content
//   merged:   [{ from, to, savedBytes }]       — report lines
//   unstatable: [paths]                        — stat failed (→ missing)
function buildDedupPlan(footage, onProgress) {
    // 1. Collapse by identical disk path first (many items → one file)
    const byPath = new Map();
    for (const it of footage) {
        if (!byPath.has(it.path)) {
            byPath.set(it.path, {
                path: it.path,
                folderPath: it.folderPath,
                layerName: it.layerName || '',
                isSequence: !!it.isSequence,
                itemIds: []
            });
        }
        const rec = byPath.get(it.path);
        rec.itemIds.push(it.itemId);
        if (it.isSequence) rec.isSequence = true;
    }

    // 2. stat + group candidates by normalized name + extension + size
    //    v2.8: image SEQUENCES bypass content dedup entirely — hashing only
    //    the first frame could merge two different sequences that share an
    //    identical frame 0, and hashing thousands of frames isn't worth it.
    //    Each sequence copies as its own unit.
    const unstatable = [];
    const candGroups = new Map();
    const seqPlans   = [];
    for (const rec of byPath.values()) {
        try {
            rec.size = fs.statSync(rec.path).size;
        } catch (e) {
            unstatable.push(rec.path);
            continue;
        }
        if (rec.isSequence) {
            seqPlans.push({ canonical: rec, itemIds: rec.itemIds.slice(), size: rec.size, isSequence: true });
            continue;
        }
        const ext  = path.extname(rec.path).toLowerCase();
        const stem = normalizeStem(path.basename(rec.path, path.extname(rec.path)));
        const key  = stem + '|' + ext + '|' + rec.size;
        if (!candGroups.has(key)) candGroups.set(key, []);
        candGroups.get(key).push(rec);
    }

    // 3. Hash-verify candidate groups; split by content hash
    const copyPlan = [];
    const merged   = [];
    let gi = 0;
    for (const cands of candGroups.values()) {
        gi++;
        if (cands.length === 1) {
            const r = cands[0];
            copyPlan.push({ canonical: r, itemIds: r.itemIds.slice(), size: r.size });
            continue;
        }
        if (onProgress) onProgress(gi, candGroups.size);
        const byHash = new Map();
        for (const r of cands) {
            let hh;
            try {
                hh = contentHash(r.path, r.size);
            } catch (e) {
                hh = 'ERR|' + r.path;   // unreadable → never merge it
            }
            if (!byHash.has(hh)) byHash.set(hh, []);
            byHash.get(hh).push(r);
        }
        for (const same of byHash.values()) {
            const canonical = pickCanonical(same);
            const itemIds = [];
            for (const r of same) {
                itemIds.push(...r.itemIds);
                if (r !== canonical) {
                    merged.push({
                        from: path.basename(r.path),
                        to:   path.basename(canonical.path),
                        savedBytes: r.size
                    });
                }
            }
            copyPlan.push({ canonical, itemIds, size: canonical.size });
        }
    }
    for (const sp of seqPlans) copyPlan.push(sp);
    return { copyPlan, merged, unstatable };
}

function fmtMB(bytes) {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─────────────────────────────────────────────────────────────
// Font file index — built once, used for all lookups
// ─────────────────────────────────────────────────────────────
let _fontIndex = null;

function buildFontIndex(searchDirs) {
    const index = new Map();
    for (const dir of searchDirs) _indexDir(dir, index);
    return index;
}

function _indexDir(dir, index) {
    if (!fs.existsSync(dir)) return;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                _indexDir(full, index);
            } else if (/\.(ttf|otf|ttc|woff|woff2)$/i.test(e.name)) {
                const stem = e.name.toLowerCase().replace(/\.[^.]+$/, '');
                if (!index.has(stem)) index.set(stem, full);
            }
        }
    } catch (e) {}
}

// v2.8: last-resort lookup only (AE < 24, where app.fonts can't hand us the
// real location). The old `includes()`-both-ways match was dangerously loose —
// "Arial" happily matched arialnarrow.ttf and shipped the WRONG font with no
// warning. Now: exact stem → separator-stripped equality → nothing. Better to
// report a font as not found than to silently collect a different one.
function findFontFile(fontIndex, fontName) {
    const exact = fontName.toLowerCase();
    if (fontIndex.has(exact)) return fontIndex.get(exact);
    const flat = s => s.replace(/[\s_\-]/g, '');
    const want = flat(exact);
    for (const [stem, filePath] of fontIndex) {
        if (flat(stem) === want) return filePath;
    }
    return null;
}

// ═════════════════════════════════════════════════════════════
// FONT ENGINE "plainly" — panel side
// Ports: node/utils.ts finalizePath, node/bridge isFontInstalled,
//        node/collectProject/utils.ts validateFonts,
//        node/collectProject/copyFonts.ts copyFonts
// ═════════════════════════════════════════════════════════════

function untildify(p) {
    return p.replace(/^~(?=$|\/|\\)/, os.homedir());
}

// Port of finalizePath(): path.resolve(decodeURI(untildify(entry))).
// The .normalize('NFC') is NOT upstream — it is ours. macOS hands back
// filenames in NFD while AE reports NFC, and without it existsSync() lies
// about any font or footage file with non-ASCII characters in its name.
function finalizePath(entry) {
    let p = untildify(String(entry));
    try { p = decodeURI(p); } catch (e) { /* literal % in path — leave as is */ }
    if (typeof p.normalize === 'function') p = p.normalize('NFC');
    return path.resolve(p);
}

// evalScript wrapper matching Plainly's bridge: "undefined" -> undefined.
function evalScriptRaw(script) {
    return new Promise(resolve => {
        csInterface.evalScript(script, r => {
            const s = (r || '').trim();
            resolve(s === 'undefined' || s === '' ? undefined : s);
        });
    });
}

async function plGetInstalledFonts(fnName, ...args) {
    const call = `${fnName}(${args.map(a => JSON.stringify(a)).join(', ')})`;
    const raw = await evalScriptRaw(call);
    if (!raw) return undefined;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
    } catch (e) {
        throw new Error('Failed to parse fonts data.');
    }
}

// Faithful port of AeScriptsApi.isFontInstalled — including the branch where
// a font that neither lookup can resolve is reported as INSTALLED.
async function plIsFontInstalled(postScriptName, familyName, styleName) {
    let fonts = await plGetInstalledFonts(
        'getInstalledFontsByPostScriptName', postScriptName);

    if (!fonts) {
        fonts = await plGetInstalledFonts(
            'getInstalledFontsByFamilyNameAndStyleName',
            familyName || '', styleName || '');

        // Neither lookup resolved it -> upstream assumes installed.
        if (fonts === undefined) return true;
    }

    if (fonts[0] && fonts[0].isSubstitute) return false;
    return true;
}

// Port of validateFonts + copyFonts.
// Returns { copied, missingLocation[], notInstalled[], badFormat[], copyErrors[], used[] }
async function collectFontsPlainlyFlow(fontsDir) {
    const out = {
        copied: 0,
        missingLocation: [],
        notInstalled: [],
        badFormat: [],
        copyErrors: [],
        unseenByWalk: []
    };

    const info = await evalScript('collectFontsPlainly()');
    const fonts = info.fonts || [];

    // Diagnostic cross-check against AE's own list. Never blocks.
    try {
        const snap = await evalScript('getUsedFontsSnapshot()');
        const seen = new Set(fonts.map(f => f.postScriptName));
        for (const ps of (snap.used || [])) {
            if (ps && !seen.has(ps)) out.unseenByWalk.push(ps);
        }
    } catch (e) { /* diagnostic only */ }

    if (fonts.length === 0) return out;

    // --- validateFonts ---
    for (const f of fonts) {
        if (!f.fontLocation) out.missingLocation.push(f.postScriptName);
    }
    for (const f of fonts) {
        try {
            const ok = await plIsFontInstalled(
                f.postScriptName, f.fontFamily, f.fontStyle);
            if (!ok) out.notInstalled.push(f.postScriptName);
        } catch (e) {
            out.notInstalled.push(`${f.postScriptName} — перевірка не вдалася: ${e.message}`);
        }
    }

    if (PLAINLY_STRICT_FONTS) {
        if (out.missingLocation.length > 0)
            throw new Error(`Missing location for fonts on system:\n${out.missingLocation.join(', ')}`);
        if (out.notInstalled.length > 0)
            throw new Error(`Fonts used in the project are missing on the system:\n${out.notInstalled.join(', ')}`);
    }

    // --- copyFonts: dedup by fontLocation, whitelist ext, name by PostScript ---
    const seenLocations = new Set();
    const uniqueFonts = [];
    for (const f of fonts) {
        if (!f.fontLocation) continue;
        if (seenLocations.has(f.fontLocation)) continue;
        seenLocations.add(f.fontLocation);
        uniqueFonts.push(f);
    }
    if (uniqueFonts.length === 0) return out;

    if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });

    for (const font of uniqueFonts) {
        const src = finalizePath(font.fontLocation);
        const ext = path.extname(src).toLowerCase();

        if (!['.otf', '.ttf', '.ttc'].includes(ext)) {
            out.badFormat.push(`${font.postScriptName} (${ext || 'без розширення'}) — ${src}`);
            continue;
        }

        const dest = path.join(fontsDir, `${sanitizeFilename(font.postScriptName)}${ext}`);
        try {
            fs.copyFileSync(src, dest);
            out.copied++;
        } catch (e) {
            out.copyErrors.push(`${font.postScriptName} — ${e.message}`);
        }
    }

    return out;
}

// ═════════════════════════════════════════════════════════════
// COLLECT ENGINE v3 — panel-side helpers
// ═════════════════════════════════════════════════════════════

const IS_WIN = process.platform === 'win32';

// macOS hands back filenames in NFD, AE reports NFC. Comparing or stat-ing
// the two forms of the same non-ASCII name fails silently.
function nfc(p) {
    const s = String(p);
    return typeof s.normalize === 'function' ? s.normalize('NFC') : s;
}

// Windows refuses paths past MAX_PATH unless they carry the \\?\ prefix.
// Applied only at the syscall boundary — never stored or shown to the user,
// and never handed back to ExtendScript, whose File() cannot parse it.
function winPath(p) {
    const n = nfc(p);
    if (!IS_WIN) return n;
    if (n.startsWith('\\\\?\\')) return n;
    if (n.length < 250) return n;
    return n.startsWith('\\\\') ? '\\\\?\\UNC\\' + n.slice(2) : '\\\\?\\' + n;
}

function copyFileLong(src, dest) {
    fs.copyFileSync(winPath(src), winPath(dest));
}

function tempFilePath(tag) {
    return path.join(os.tmpdir(),
        `organizeme_${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}.json`);
}

// Read the inventory the host wrote to disk, instead of squeezing it through
// an evalScript return value.
async function readProjectInfoV3() {
    const out = tempFilePath('info');
    const ack = await evalScript(`getProjectInfoToFile('${toHex(out)}')`);
    if (!ack || ack.success !== true) {
        throw new Error('Не вдалося прочитати проєкт: ' + ((ack && ack.error) || 'невідома помилка'));
    }
    let raw;
    try {
        raw = fs.readFileSync(winPath(out), 'utf8');
    } catch (e) {
        throw new Error('Хост записав інвентар, але панель не змогла його прочитати: ' + e.message);
    } finally {
        try { fs.unlinkSync(winPath(out)); } catch (e) {}
    }
    let info;
    try {
        info = JSON.parse(raw);
    } catch (e) {
        // v2 resolved the raw string here and crashed later with a confusing
        // message. Fail immediately and say what actually happened.
        throw new Error('Інвентар проєкту не парситься як JSON — можливо, обірваний запис.');
    }
    if (info.success !== true) throw new Error(info.error || 'ExtendScript error');
    info.projName = decodeIfUriEncoded(info.projName);
    info.aepName  = decodeIfUriEncoded(info.aepName);
    return info;
}

// Predict every destination path before a single byte is copied, so a
// Windows MAX_PATH failure is a clear message up front rather than a
// half-finished collect folder.
function predictLongPaths(footage, collectDir) {
    if (!IS_WIN) return [];
    const footageDir = path.join(collectDir, FOLDER_NAMES.footage);
    const tooLong = [];
    for (const f of footage) {
        const sub = f.folderPath ? path.join(footageDir, f.folderPath) : footageDir;
        const dest = path.join(sub, path.basename(f.path));
        if (dest.length > 255) tooLong.push({ name: path.basename(f.path), length: dest.length });
    }
    return tooLong;
}

// Hard gate. Returns null to proceed, or a reason string to abort.
async function preflightCollect(info, collectDir) {
    const missing = info.missing || [];
    if (missing.length > 0) {
        const names = missing.map(m => escapeHtml(m.name || m.path || String(m)));
        await showModal('Колект зупинено',
            `<div class="report-line report-err">У проєкті є відсутні футажі (${missing.length}). ` +
            `Колект зупинено, щоб не віддати неповний пакет.</div>` +
            `<div class="report-sub">${names.join('<br>')}</div>` +
            `<div class="report-line report-info">Перелінкуйте або видаліть їх і запустіть колект знову.</div>`,
            [{ label: 'Зрозуміло', value: true, cls: 'modal-btn-yes' }]);
        return 'missing footage';
    }

    const tooLong = predictLongPaths(info.footage, collectDir);
    if (tooLong.length > 0) {
        const rows = tooLong.map(t => `${escapeHtml(t.name)} — ${t.length} символів`);
        await showModal('Колект зупинено',
            `<div class="report-line report-err">Шляхи призначення перевищують ліміт Windows ` +
            `(${tooLong.length} файл(ів)). After Effects не зможе їх відкрити.</div>` +
            `<div class="report-sub">${rows.join('<br>')}</div>` +
            `<div class="report-line report-info">Оберіть теку ближче до кореня диска або ` +
            `скоротіть назву проєкту.</div>`,
            [{ label: 'Зрозуміло', value: true, cls: 'modal-btn-yes' }]);
        return 'path too long';
    }

    return null;
}

// ─────────────────────────────────────────────────────────────
// COLLECT core logic
//
// Flow:
//   1. getProjectInfo() — gather footage list
//   2. Choose destination folder
//   3. Copy all footage into (Footage)/
//   4. relinkAndSave() — relink → save collected .aep → undo → save original
//   5. Copy fonts into Fonts/
// ─────────────────────────────────────────────────────────────
// v2.6: ExtendScript File.name is URI-encoded; the host now sends decoded
// displayName, but decode defensively anyway so a stale host script can
// never again produce folders with literal "%20" in their names.
function decodeIfUriEncoded(s) {
    if (typeof s !== 'string' || !/%[0-9A-Fa-f]{2}/.test(s)) return s;
    try { return decodeURIComponent(s); } catch (e) { return s; }
}

async function runCollect(isMagic = false) {
    // 1. Get project info from AE
    setProgress(5, 'Reading project…', isMagic);
    let info;
    if (COLLECT_ENGINE === 'v3') {
        info = await readProjectInfoV3();
    } else {
        info = await evalScript('getProjectInfo()');
        info.projName = decodeIfUriEncoded(info.projName);
        info.aepName  = decodeIfUriEncoded(info.aepName);
    }

    // 2. Ask destination
    const destFolder = await new Promise(resolve => {
        csInterface.evalScript(
            `(function(){ var f = Folder.selectDialog("Choose destination folder"); return f ? f.fsName : ""; })()`,
            r => resolve((r || '').trim())
        );
    });
    if (!destFolder) { hideProgress(); setStatus('Cancelled', 'info'); return; }

    // 3. Create collect folder structure
    const collectDir  = path.join(destFolder, info.projName);
    const footageDir  = path.join(collectDir, FOLDER_NAMES.footage);
    const fontsDir    = path.join(collectDir, FOLDER_NAMES.fonts);

    // 3a. Pre-flight gate — strict on footage, by agreement. Nothing has been
    //     written to disk at this point, so aborting here leaves no mess.
    const skipRelinkIds = [];
    if (COLLECT_ENGINE === 'v3') {
        const stop = await preflightCollect(info, collectDir);
        if (stop) { hideProgress(); setStatus('Колект зупинено: ' + stop, 'err'); return; }

        // Layered PSD/AI: item.replace() on them is unreliable, so ask rather
        // than silently corrupt or silently skip.
        const layered = info.footage.filter(f => f.isLayered);
        if (layered.length > 0) {
            const names = layered.map(f => escapeHtml(path.basename(f.path)));
            const skipThem = await confirmModal('Шаруваті PSD / AI',
                `<div class="report-line report-warn">У проєкті ${layered.length} шаруватий(х) файл(ів). ` +
                `Перелінк таких файлів у After Effects ненадійний і може зламати посилання на шари.</div>` +
                `<div class="report-sub">${names.join('<br>')}</div>` +
                `<div class="report-line report-info">Пропустити їх? Файли будуть скопійовані в ` +
                `${escapeHtml(FOLDER_NAMES.footage)}/, але проєкт і далі посилатиметься на оригінали ` +
                `(рекомендовано). «Ні» — спробувати перелінкувати попри ризик.</div>`);
            if (skipThem) for (const f of layered) skipRelinkIds.push(f.itemId);
        }
    }

    if (!fs.existsSync(collectDir))  fs.mkdirSync(collectDir,  { recursive: true });
    if (!fs.existsSync(footageDir))  fs.mkdirSync(footageDir,  { recursive: true });

    // 4. Detect duplicates, then copy ONE physical file per unique content
    //    into (Footage)/ — every project item of a duplicate group is relinked
    //    to that single copy. Files must exist on disk BEFORE relink.
    setProgress(7, 'Checking duplicates…', isMagic);
    const missing = (info.missing || []).map(m =>
        typeof m === 'string' ? m : (m.name || m.path || String(m)));
    for (const sk of (info.skipped || [])) missing.push(`${sk.name} — ${sk.reason}`);
    const dedup = buildDedupPlan(info.footage, (g, n) =>
        setProgress(7, `Checking duplicates… (${g}/${n})`, isMagic));
    for (const p of dedup.unstatable) missing.push(path.basename(p));

    const copyPlan = dedup.copyPlan;
    const total    = copyPlan.length;                 // unique files to copy
    const totalItems = info.footage.length;           // project items covered
    const relinkEntries = [];   // "itemId|hexNewPath" pairs
    let renamedCount = 0;       // how many files got renamed via Layer Name
    let dupSavedBytes = 0;
    for (const m of dedup.merged) dupSavedBytes += m.savedBytes;

    let sequencesCopied = 0;
    let sequenceFrames  = 0;
    const relinkJobs    = [];            // v3 structured payload
    const copiedProxies = new Set();
    let proxiesCopied   = 0;
    let reusedCount     = 0;            // already in (Footage)/, not copied again
    let collapsedCount  = 0;            // chains from earlier collects, unwound
    let sweptCount      = 0;            // orphan files deleted
    let sweptBytes      = 0;
    const protectedDirs = [path.join(footageDir, '(Proxies)')];

    for (let i = 0; i < total; i++) {
        const plan = copyPlan[i];
        const src  = plan.canonical.path;
        setProgress(8 + Math.round((i / Math.max(total, 1)) * 52),
                    `Copying footage ${i + 1} / ${total}…`, isMagic);
        try {
            const subDir = plan.canonical.folderPath
                ? path.join(footageDir, plan.canonical.folderPath)
                : footageDir;
            if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });

            if (plan.isSequence) {
                // v2.8: copy EVERY frame of the sequence, relink to the first
                // frame with the "S" flag → host uses replaceWithSequence().
                const frames  = listSequenceFiles(src);
                const seqDir  = copySequenceAs(frames, subDir);
                protectedDirs.push(seqDir);
                const destFile = path.join(seqDir, path.basename(src));
                sequencesCopied++;
                sequenceFrames += frames.length;
                const hexDest = toHex(destFile);
                for (const id of plan.itemIds) {
                    relinkEntries.push(String(id) + '|' + hexDest + '|S');
                    relinkJobs.push({ id: id, path: destFile, isSeq: true });
                }
                continue;
            }

            // Decide target filename. With rename muted (v2.5) we always keep
            // the original disk name; resolveCollectedName stays available for
            // when ENABLE_LAYER_RENAME is flipped back on.
            const targetName = ENABLE_LAYER_RENAME
                ? resolveCollectedName(src, plan.canonical.layerName || '')
                : path.basename(src);
            const wasRenamed = (targetName !== path.basename(src));
            if (wasRenamed) renamedCount++;

            // placeFileAs, not copyFileAs: if a byte-identical file is
            // already in (Footage)/ from an earlier collect, it is reused
            // instead of gaining a _1 twin. This is the fix for the folder
            // growing by one full generation on every run.
            const placed = placeFileAs(src, subDir, targetName);
            const destFile = placed.path;
            if (placed.reused) reusedCount++;
            // Relink EVERY project item of this group to the single copy
            const hexDest = toHex(destFile);
            for (const id of plan.itemIds) {
                relinkEntries.push(String(id) + '|' + hexDest);
                relinkJobs.push({ id: id, path: destFile, isSeq: false });
            }

        } catch (e) {
            missing.push(path.basename(src) + ' — помилка копіювання: ' + e.message);
        }
    }

    // 4b. Proxies — walked over the FULL footage list, not the dedup plan:
    //     grouping collapses items by path, so a proxy attached to a
    //     non-canonical duplicate would never be seen. AE's native Collect
    //     Files takes master and proxy both; v2 ignored proxySource entirely
    //     and delivered projects whose proxy was offline.
    if (COLLECT_ENGINE === 'v3') {
        for (const f of info.footage) {
            if (!f.proxyPath || copiedProxies.has(f.proxyPath)) continue;
            copiedProxies.add(f.proxyPath);
            try {
                const pDir = path.join(footageDir, '(Proxies)');
                if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });
                copyFileLong(f.proxyPath, path.join(pDir, path.basename(f.proxyPath)));
                proxiesCopied++;
            } catch (e) {
                missing.push(path.basename(f.proxyPath) + ' (проксі) — ' + e.message);
            }
        }
    }

    // 4c. Unwind chains left by earlier collects into this same folder.
    //     Runs before the relink so the project is pointed at the surviving
    //     file directly — no second relink pass, and nothing is deleted yet.
    if (COLLECT_ENGINE === 'v3' && relinkJobs.length > 0) {
        setProgress(60, 'Checking the collect folder…', isMagic);
        try {
            const plannedPaths = relinkJobs.filter(j => !j.isSeq).map(j => j.path);
            const remap = collapseFootageDuplicates(footageDir, plannedPaths, protectedDirs);

            if (remap.size > 0) {
                for (const job of relinkJobs) {
                    const to = remap.get(path.resolve(job.path));
                    if (to) job.path = to;
                }
                // relinkEntries is the v2 payload and this block is v3-only,
                // so only relinkJobs needs rewriting.
                collapsedCount = remap.size;
            }
        } catch (e) {
            missing.push('Перевірка теки колекту: ' + e.message);
        }
    }

    // 5. Relink footage in AE → Save As collected .aep → relink → save → reopen original
    //    The original .aep is never modified after step 1 of relinkAndSave.
    //    This gives us a clean collected .aep with paths pointing to (Footage)/
    //    and leaves the user back on their original project.
    let relinkResult = null;
    if (relinkEntries.length > 0) {
        setProgress(62, 'Relinking project…', isMagic);
        const collectAepPath = path.join(collectDir, info.aepName);

        try {
            if (COLLECT_ENGINE === 'v3') {
                // The whole payload goes through a temp JSON file. v2 packed
                // it into the evalScript argument at 4 hex chars per path
                // character, where a few hundred items could truncate the
                // call and silently relink nothing.
                const jobPath = tempFilePath('job');
                const skipSet = new Set(skipRelinkIds);
                const job = {
                    collectAep:    collectAepPath,
                    origAep:       info.aepPath,
                    footageRoot:   footageDir,
                    relink:        relinkJobs.filter(j => !skipSet.has(j.id)),
                    skipRelinkIds: skipRelinkIds
                };
                fs.writeFileSync(winPath(jobPath), JSON.stringify(job), 'utf8');
                try {
                    relinkResult = await evalScript(`relinkAndSaveFromFile('${toHex(jobPath)}')`);
                } finally {
                    try { fs.unlinkSync(winPath(jobPath)); } catch (e) {}
                }
            } else {
                relinkResult = await evalScript(
                    "relinkAndSave('" + relinkEntries.join(';;') + "','" +
                    toHex(collectAepPath) + "','" + toHex(info.aepPath) + "')"
                );
            }
        } catch (e) {
            // relinkAndSave threw (or returned success:false). Do NOT silently
            // copy the .aep as-is — that produces a collected project pointing at
            // ORIGINAL paths, which goes offline the moment the folder is moved.
            // Surface it loudly instead.
            relinkResult = { success: false, error: e.message };
        }
    } else {
        // No footage to relink — just copy .aep
        fs.copyFileSync(info.aepPath, path.join(collectDir, info.aepName));
    }

    // 6. Copy fonts into Fonts/  (v2.8 — Plainly-style)
    // The host now reports, per font: PostScript name, family/style, absolute
    // file location and INSTALLED state (verified via app.fonts.isSubstitute
    // on AE 24+). Not-installed fonts are never guessed at — they land in the
    // report as "не встановлений на цьому пристрої". The filename-index
    // search survives only as a fallback for AE < 24 fonts with unknown state.
    // 5b. POST-FLIGHT AUDIT — the host walked every footage item in the saved
    //     project. A collect is only a success if it can be proven, so any
    //     item that is offline or still points outside (Footage)/ fails the
    //     whole run and the folder is removed rather than delivered.
    const auditOffline = [];
    const auditOutside = [];
    const auditSkipped = [];
    if (COLLECT_ENGINE === 'v3' && relinkResult && relinkResult.audit) {
        for (const n of relinkResult.audit.offline)          auditOffline.push(n);
        for (const n of relinkResult.audit.outside)          auditOutside.push(n);
        for (const n of relinkResult.audit.skippedByChoice)  auditSkipped.push(n);

        if (auditOffline.length > 0 || auditOutside.length > 0) {
            const rows = auditOffline.map(n => `❌ офлайн: ${escapeHtml(n)}`)
                .concat(auditOutside.map(n => `❌ поза колектом: ${escapeHtml(n)}`));
            const keep = await confirmModal('Колект не пройшов перевірку',
                `<div class="report-line report-err">Зібраний проєкт містить ` +
                `${auditOffline.length + auditOutside.length} проблемних елемент(ів). ` +
                `Такий пакет зламається у отримувача.</div>` +
                `<div class="report-sub">${rows.join('<br>')}</div>` +
                `<div class="report-line report-info">Видалити теку колекту? ` +
                `«Ні» — залишити її для ручного розбору.</div>`);
            if (keep) {
                try { fs.rmSync(winPath(collectDir), { recursive: true, force: true }); } catch (e) {}
                hideProgress();
                setStatus('Колект скасовано: перевірка не пройдена', 'err');
                return;
            }
        }
    }

    // 5c. Sweep. Everything in (Footage)/ that the saved project does not
    //     point at goes — the leftovers of earlier collects into this same
    //     folder, plus whatever the collapse above superseded.
    //
    //     Gated on a clean audit, and that gate is the whole safety argument:
    //     the audit has just confirmed, item by item, that the saved project
    //     is online and resolves inside (Footage)/. Deleting on an unproven
    //     relink could take a file the project still needs.
    if (COLLECT_ENGINE === 'v3' && relinkJobs.length > 0 &&
        auditOffline.length === 0 && auditOutside.length === 0 &&
        relinkResult && relinkResult.success !== false) {
        setProgress(66, 'Clearing leftovers…', isMagic);
        try {
            const used = relinkJobs.map(j => j.path);
            const swept = sweepOrphans(footageDir, used, protectedDirs);
            sweptCount = swept.removed;
            sweptBytes = swept.bytes;
        } catch (e) {
            missing.push('Прибирання теки: ' + e.message);
        }
    }

    setProgress(68, 'Collecting fonts…', isMagic);
    let fontsCopied       = 0;
    const fontsMissing    = [];   // used in project, NOT installed on this machine
    const fontsNotFound   = [];   // installed/unknown, but file couldn't be located/copied
    const fontsBadFormat  = [];   // resolved, but not .otf/.ttf/.ttc (Adobe Fonts etc.)
    const fontsUnseen     = [];   // AE lists them as used, our walk never saw them
    let fontCheckError    = null;

    if (FONT_ENGINE === 'plainly') {
        try {
            const r = await collectFontsPlainlyFlow(fontsDir);
            fontsCopied = r.copied;
            for (const n of r.notInstalled)    fontsMissing.push(n);
            for (const n of r.missingLocation) fontsNotFound.push(`${n} — AE не повідомив шлях до файлу`);
            for (const n of r.copyErrors)      fontsNotFound.push(n);
            for (const n of r.badFormat)       fontsBadFormat.push(n);
            for (const n of r.unseenByWalk)    fontsUnseen.push(n);
        } catch (e) {
            fontCheckError = e.message;
        }
    } else try {
        const fontInfo = await evalScript('getFontInfo()');
        const fonts = fontInfo.fonts || [];

        if (fonts.length > 0) {
            if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });
            const copiedPaths = new Set();

            const isWin = process.platform === 'win32';
            const fontSearchPaths = isWin
                ? ['C:\\Windows\\Fonts',
                   path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Windows', 'Fonts'),
                   path.join(os.homedir(), 'AppData', 'Roaming', 'Adobe', 'CoreSync', 'plugins', 'livetype', 'r')]
                : ['/Library/Fonts',
                   '/System/Library/Fonts',
                   '/System/Library/Fonts/Supplemental',
                   path.join(os.homedir(), 'Library', 'Fonts'),
                   path.join(os.homedir(), 'Library', 'Application Support', 'Adobe', 'CoreSync', 'plugins', 'livetype', '.r')];

            for (const font of fonts) {
                const label = font.psName + (font.family ? ` (${font.family} ${font.style})` : '');

                if (font.installed === 0) {
                    // AE substituted this font — it is NOT on this machine.
                    fontsMissing.push(label);
                    continue;
                }

                let src = font.location && fs.existsSync(font.location) ? font.location : null;

                if (!src && font.installed !== 1) {
                    // Unknown state (AE < 24) → conservative filename lookup
                    if (!_fontIndex) _fontIndex = buildFontIndex(fontSearchPaths);
                    src = findFontFile(_fontIndex, font.psName);
                }

                if (!src) {
                    fontsNotFound.push(label);
                    continue;
                }
                if (copiedPaths.has(src)) continue;   // one .ttc/.otf can serve several styles

                try {
                    copyFileSafe(src, fontsDir);
                    copiedPaths.add(src);
                    fontsCopied++;
                } catch (e) {
                    fontsNotFound.push(label + ' — помилка копіювання: ' + e.message);
                }
            }
        }
    } catch (e) {
        fontCheckError = e.message;
    }

    setProgress(100, 'Done!', isMagic);

    // 7. Report — highlighted modal window (v2.8). Warnings never hide behind
    // a wall of plain alert() text again; missing fonts get their own amber
    // lines with the reason spelled out.
    const relinkFailed =
        !relinkResult ? false :
        (relinkResult.success === false) ||
        (relinkResult.failed && relinkResult.failed.length > 0);

    const lines = [];
    lines.push({ type: 'ok', html:
        `📦 Зібрано <b>${total}</b> унікальних файлів футажів (${totalItems} елемент(ів) проєкту)` });

    if (sequencesCopied > 0) {
        lines.push({ type: 'ok', html:
            `🎞️ Секвенцій зображень: <b>${sequencesCopied}</b> (${sequenceFrames} кадрів скопійовано повністю)` });
    }
    if (dedup.merged.length > 0) {
        const dupList = dedup.merged.map(m => `${escapeHtml(m.from)} → ${escapeHtml(m.to)}`).join('<br>');
        lines.push({ type: 'ok', html:
            `♻️ Об'єднано дублікатів: <b>${dedup.merged.length}</b>, заощаджено ${fmtMB(dupSavedBytes)}<div class="report-sub">${dupList}</div>` });
    }
    if (reusedCount > 0) {
        lines.push({ type: 'ok', html:
            `♻️ Вже було в теці, не копіювалось: <b>${reusedCount}</b>` });
    }
    if (collapsedCount > 0) {
        lines.push({ type: 'ok', html:
            `🔗 Розплутано ланцюжків від попередніх колектів: <b>${collapsedCount}</b>` });
    }
    if (sweptCount > 0) {
        lines.push({ type: 'ok', html:
            `🧹 Прибрано зайвих файлів: <b>${sweptCount}</b>, звільнено ${fmtMB(sweptBytes)}` });
    }
    if (renamedCount > 0) {
        lines.push({ type: 'info', html: `✏️ Перейменовано за Layer Name: ${renamedCount}` });
    }

    if (relinkResult && relinkResult.success) {
        lines.push({ type: 'ok', html:
            `🔗 Перелінковано <b>${relinkResult.relinked}</b> елемент(ів) → (Footage)/` });
        if (relinkResult.failed && relinkResult.failed.length > 0) {
            lines.push({ type: 'err', html:
                `⚠️ НЕ перелінковано ${relinkResult.failed.length} елемент(ів):<div class="report-sub">${relinkResult.failed.map(escapeHtml).join('<br>')}</div>` });
        }
    } else if (relinkResult && relinkResult.success === false) {
        lines.push({ type: 'err', html:
            `⚠️ РЕЛІНК НЕ ВДАВСЯ: ${escapeHtml(relinkResult.error)}<div class="report-sub">Зібраний .aep може досі вказувати на оригінальні шляхи.</div>` });
    }

    if (fontsCopied > 0) {
        lines.push({ type: 'ok', html: `🔤 Скопійовано шрифтів: <b>${fontsCopied}</b>` });
    }
    for (const f of fontsMissing) {
        lines.push({ type: 'warn', html:
            `🔤 Шрифт «<b>${escapeHtml(f)}</b>» не зібрано — він <b>не встановлений на вашому пристрої</b> (AE підмінив його іншим). Встановіть шрифт і повторіть колект, або передайте файл шрифта окремо.` });
    }
    for (const f of fontsNotFound) {
        lines.push({ type: 'warn', html:
            `🔤 Шрифт «<b>${escapeHtml(f)}</b>»: файл не знайдено на диску — додайте його в Fonts/ вручну.` });
    }
    for (const f of fontsBadFormat) {
        lines.push({ type: 'warn', html:
            `🔤 «<b>${escapeHtml(f)}</b>» — непереносимий формат (найімовірніше Adobe Fonts). ` +
            `Не скопійовано: активуйте цей шрифт на цільовій машині.` });
    }
    if (fontsUnseen.length > 0) {
        lines.push({ type: 'warn', html:
            `🔎 AE вважає використаними шрифти, яких збирач не побачив (${fontsUnseen.length}) — ` +
            `найімовірніше змішані шрифти в одному шарі або анімований Source Text:` +
            `<div class="report-sub">${fontsUnseen.map(escapeHtml).join('<br>')}</div>` });
    }
    if (fontCheckError) {
        lines.push({ type: 'warn', html:
            `🔤 Не вдалося перевірити шрифти: ${escapeHtml(fontCheckError)}` });
    }

    if (proxiesCopied > 0) {
        lines.push({ type: 'ok', html:
            `🎞️ Проксі скопійовано: <b>${proxiesCopied}</b> → ${escapeHtml(FOLDER_NAMES.footage)}/(Proxies)/` });
    }
    if (auditSkipped.length > 0) {
        lines.push({ type: 'warn', html:
            `📄 Шаруваті PSD/AI пропущено на ваш вибір (${auditSkipped.length}) — ` +
            `файли в колекті є, але проєкт посилається на оригінали:` +
            `<div class="report-sub">${auditSkipped.map(escapeHtml).join('<br>')}</div>` });
    }
    if (COLLECT_ENGINE === 'v3' && relinkResult && relinkResult.success &&
        auditOffline.length === 0 && auditOutside.length === 0) {
        lines.push({ type: 'ok', html:
            `✅ Перевірка зібраного проєкту пройдена — усі футажі онлайн і всередині ` +
            `${escapeHtml(FOLDER_NAMES.footage)}/.` });
    }
    if (missing.length > 0) {
        lines.push({ type: 'err', html:
            `⚠️ Відсутні вихідні файли (${missing.length}) — вони НЕ потрапили в колект і лишились на оригінальних шляхах:<div class="report-sub">${missing.map(escapeHtml).join('<br>')}</div>` });
    }

    lines.push({ type: 'info', html:
        `📁 Папку збережено:<div class="report-sub">${escapeHtml(collectDir)}</div>` });

    const hasWarnings = fontsMissing.length > 0 || fontsNotFound.length > 0 ||
                        fontsBadFormat.length > 0 || fontsUnseen.length > 0 ||
                        auditOffline.length > 0 || auditOutside.length > 0 ||
                        auditSkipped.length > 0 ||
                        missing.length > 0 || relinkFailed || fontCheckError;

    setTimeout(() => {
        hideProgress();
        if (relinkFailed) {
            setStatus(`⚠️ ${info.projName} — колект з помилками лінків`, 'error');
        } else if (hasWarnings) {
            setStatus(`✓ ${info.projName} зібрано, є попередження`, 'success');
        } else {
            setStatus(`✓ ${info.projName} зібрано та перелінковано`, 'success');
        }
    }, 800);

    const title = relinkFailed
        ? '⚠️ Колект завершено з помилками'
        : (hasWarnings ? '✅ Колект пройшов успішно, але є попередження' : '✅ Колект пройшов успішно');
    await reportModal(title, lines);
    return !relinkFailed;
}

// ─────────────────────────────────────────────────────────────
// BUTTON HANDLERS
// ─────────────────────────────────────────────────────────────

// Organize
organizeBtn.onclick = async () => {
    lockButtons(true);
    setStatus('Organizing…', 'info');
    try {
        await evalScript('organizeProject()');
        setStatus('✓ Project organized', 'success');
    } catch (e) {
        setStatus('✗ ' + e.message, 'error');
    } finally {
        lockButtons(false);
    }
};

// Organize & Clean
organizeCleanBtn.onclick = async () => {
    lockButtons(true);
    setStatus('Reducing and organizing…', 'info');
    try {
        await evalScript(COLLECT_ENGINE === 'v3'
            ? `organizeAndCleanV3('${toHex(JSON.stringify(FOLDER_NAMES))}')`
            : 'organizeAndClean()');
        setStatus('✓ Cleaned and organized', 'success');
    } catch (e) {
        setStatus('✗ ' + e.message, 'error');
    } finally {
        lockButtons(false);
    }
};

// ─────────────────────────────────────────────────────────────
// Disclaimer gate (v2.8 — SOFT)
// Runs BEFORE any collect/clean work. Detection of localized disclaimers is
// heuristic (registered variants + structural fallback), so a missed match is
// NOT proof the disclaimer is absent. Instead of hard-blocking, the user gets
// a Так/Ні confirmation and decides whether to proceed.
// Returns true if it's OK to proceed.
// ─────────────────────────────────────────────────────────────
async function passesDisclaimerGate() {
    if (!ENABLE_DISCLAIMER_GATE) return true;

    setStatus('Перевірка дисклеймера…', 'info');
    let res;
    try {
        res = await evalScript('validateDisclaimer()');
    } catch (e) {
        // The check itself failed to run — don't block on a broken check,
        // let the user decide.
        const goOn = await confirmModal(
            '⚠️ Відсутній дисклеймер?',
            `<div class="report-line report-warn">Не вдалося перевірити дисклеймер: ${escapeHtml(e.message)}</div>` +
            `<div class="report-line report-info">Продовжити колект?</div>`
        );
        if (!goOn) setStatus('Колект скасовано', 'info');
        return goOn;
    }

    if (res && res.pass) return true;

    const problems = (res && res.problems && res.problems.length)
        ? res.problems.map(p => `<div class="report-line report-warn">${escapeHtml(p)}</div>`).join('')
        : `<div class="report-line report-warn">Дисклеймер не знайдено в жодному компі.</div>`;

    const goOn = await confirmModal(
        '⚠️ Відсутній дисклеймер',
        problems +
        `<div class="report-line report-info">Скрипт міг не розпізнати локалізований дисклеймер. ` +
        `Якщо дисклеймер точно є в кадрі — тисніть «Так».<br><br><b>Продовжити колект?</b></div>`
    );
    if (!goOn) setStatus('⛔ Колект скасовано (дисклеймер)', 'error');
    return goOn;
}

// Collect
collectBtn.onclick = async () => {
    lockButtons(true);
    setStatus('', '');
    try {
        if (!(await passesDisclaimerGate())) return;
        await runCollect(false);
    } catch (e) {
        hideProgress();
        setStatus('✗ ' + e.message, 'error');
    } finally {
        lockButtons(false);
    }
};

// Black Magic: Clean → Organize → Collect
blackMagicBtn.onclick = async () => {
    lockButtons(true);
    setStatus('', '');
    try {
        // Gate first — before any destructive clean/organize.
        if (!(await passesDisclaimerGate())) return;

        setProgress(0, 'Step 1/2 — Cleaning & organizing…', true);
        await evalScript(COLLECT_ENGINE === 'v3'
            ? `organizeAndCleanV3('${toHex(JSON.stringify(FOLDER_NAMES))}')`
            : 'organizeAndClean()');
        setProgress(10, 'Step 1/2 — Done. Starting collect…', true);

        await runCollect(true);
    } catch (e) {
        hideProgress();
        setStatus('✗ ' + e.message, 'error');
    } finally {
        lockButtons(false);
    }
};
