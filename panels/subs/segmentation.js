// segmentation.js — transcript normalization, punctuation hints,
// sentence building and SNAP (smart-word) grouping.
// Core algorithms carried over unchanged from v2.4.

// Defaults shared by the sentence builder and main.js.
// Lives here because buildSentenceLayersFromWords() depends on it.
var SEGMENTATION_DEFAULTS = {
    boundaryMode: 'punctuation_optional',
    punctuationOutputMode: 'keep',
    gapBreakSeconds: 0.55,
    maxWordsPerSentence: 14,
    maxSentenceDuration: 6,
    minWordsForDurationBreak: 4,
    minTailWordsToMerge: 3
};

function normalizeTranscriptWord(rawWord, fallbackStart) {
    if (!rawWord || typeof rawWord !== 'object') return null;

    const tokenText = safeTrim(safeString(rawWord.word || rawWord.text));
    if (!tokenText) return null;

    const start = isFiniteNumber(rawWord.start) ? rawWord.start : fallbackStart;
    let end;

    if (isFiniteNumber(rawWord.end)) {
        end = rawWord.end;
    } else if (isFiniteNumber(rawWord.start)) {
        end = rawWord.start + 0.25;
    } else {
        end = start + 0.25;
    }

    if (end < start) {
        end = start + 0.01;
    }

    return {
        text: tokenText,
        word: tokenText,
        start: start,
        end: end
    };
}

function tokenJoinsPrevious(token) {
    return /^[,.;:!?%)\]\}]+$/.test(token) || /^\u2026+$/.test(token);
}

function previousTokenJoinsNext(token) {
    return /[(\[\{'"`\u00AB\u201C]$/.test(token) || /[\u2019']$/.test(token);
}

function hasSentenceTerminal(token) {
    return /[.!?\u2026]["')\]]*$/.test(token) || /[\u3002\uFF01\uFF1F]["')\]]*$/.test(token);
}

function normalizeTokenForMatch(token) {
    const lower = safeTrim(safeString(token)).toLowerCase();
    if (!lower) return '';

    // Keep alnum from common latin/cyrillic ranges, drop outer punctuation and separators.
    const stripped = lower
        .replace(/^[^a-z0-9\u00c0-\u024f\u0400-\u04ff]+/g, '')
        .replace(/[^a-z0-9\u00c0-\u024f\u0400-\u04ff]+$/g, '')
        .replace(/['\u2019-]+/g, '');

    return safeTrim(stripped);
}

function buildPunctuationHintText(transcript) {
    if (transcript && Array.isArray(transcript.segments) && transcript.segments.length > 0) {
        const segmentTexts = [];
        for (let i = 0; i < transcript.segments.length; i++) {
            const segText = safeTrim(safeString(transcript.segments[i] && transcript.segments[i].text));
            if (segText) {
                segmentTexts.push(segText);
            }
        }

        if (segmentTexts.length > 0) {
            return segmentTexts.join(' ');
        }
    }

    return safeTrim(safeString(transcript && transcript.text));
}

function applyPunctuationHintsToWords(words, transcript) {
    if (!Array.isArray(words) || words.length === 0) return [];

    const hintText = buildPunctuationHintText(transcript);
    if (!hintText) return words.slice();

    const hintTokens = hintText.split(/\s+/).filter((token) => safeTrim(token));
    if (!hintTokens.length) return words.slice();

    const hintedWords = [];
    let hintIndex = 0;

    for (let i = 0; i < words.length; i++) {
        const rawWord = words[i];
        const originalText = safeTrim(safeString(rawWord && (rawWord.word || rawWord.text)));
        const wordNorm = normalizeTokenForMatch(originalText);
        let matchedToken = '';

        if (wordNorm) {
            while (hintIndex < hintTokens.length) {
                const candidate = hintTokens[hintIndex++];
                const candidateNorm = normalizeTokenForMatch(candidate);
                if (!candidateNorm) continue;
                if (candidateNorm === wordNorm) {
                    matchedToken = candidate;
                    break;
                }
            }
        }

        const displayText = matchedToken || originalText;
        const updatedWord = Object.assign({}, rawWord || {});
        updatedWord.text = displayText;
        updatedWord.word = displayText;
        hintedWords.push(updatedWord);
    }

    return hintedWords;
}

function countWordsWithPunctuation(words) {
    if (!Array.isArray(words)) return 0;
    let count = 0;
    for (let i = 0; i < words.length; i++) {
        const token = safeTrim(safeString(words[i] && (words[i].text || words[i].word)));
        if (/[,.!?;:\u2026]/.test(token)) {
            count++;
        }
    }
    return count;
}

function buildSentenceTextFromTokens(tokens) {
    let sentenceText = '';

    for (let i = 0; i < tokens.length; i++) {
        const token = safeTrim(safeString(tokens[i]));
        if (!token) continue;

        if (!sentenceText) {
            sentenceText = token;
            continue;
        }

        const previousToken = safeTrim(safeString(tokens[i - 1]));
        if (tokenJoinsPrevious(token) || previousTokenJoinsNext(previousToken)) {
            sentenceText += token;
        } else {
            sentenceText += ' ' + token;
        }
    }

    return safeTrim(sentenceText);
}

function applyTerminalPunctuationMode(sentenceText, punctuationOutputMode) {
    if (punctuationOutputMode !== 'strip') {
        return sentenceText;
    }

    return safeTrim(sentenceText.replace(/[.!?\u2026\u3002\uFF01\uFF1F]+["')\]]*$/, ''));
}

function buildSentenceLayersFromWords(words, options) {
    const settings = Object.assign({}, SEGMENTATION_DEFAULTS, options || {});
    const boundaryMode = settings.boundaryMode;
    const punctuationOutputMode = settings.punctuationOutputMode;
    const gapBreakSeconds = settings.gapBreakSeconds;
    const maxWordsPerSentence = settings.maxWordsPerSentence;
    const maxSentenceDuration = settings.maxSentenceDuration;
    const minWordsForDurationBreak = settings.minWordsForDurationBreak;
    const minTailWordsToMerge = settings.minTailWordsToMerge;

    const sentenceLayers = [];
    let currentWords = [];
    let sentenceStart = null;
    let sentenceEnd = null;
    let lastWordEnd = 0;

    function flushSentence() {
        if (!currentWords.length) return;

        const baseText = buildSentenceTextFromTokens(currentWords.map(function(word) { return word.text; }));
        const sentenceText = applyTerminalPunctuationMode(baseText, punctuationOutputMode);
        const startTime = sentenceStart === null ? 0 : sentenceStart;
        let endTime = sentenceEnd === null ? (startTime + 0.5) : sentenceEnd;

        if (endTime <= startTime) {
            endTime = startTime + 0.01;
        }

        if (sentenceText) {
            sentenceLayers.push({
                text: sentenceText,
                start: startTime,
                end: endTime,
                words: currentWords.slice()
            });
        }

        currentWords = [];
        sentenceStart = null;
        sentenceEnd = null;
    }

    for (let i = 0; i < words.length; i++) {
        const normalizedWord = normalizeTranscriptWord(words[i], lastWordEnd);
        if (!normalizedWord) continue;

        const hasGapBreak = currentWords.length > 0 && (normalizedWord.start - lastWordEnd) > gapBreakSeconds;
        const useGapBoundary = boundaryMode === 'pause_only' || boundaryMode === 'punctuation_optional';
        if (hasGapBreak && useGapBoundary) {
            flushSentence();
        }

        if (!currentWords.length) {
            sentenceStart = normalizedWord.start;
        }

        currentWords.push(normalizedWord);
        sentenceEnd = normalizedWord.end;
        lastWordEnd = normalizedWord.end;

        const sentenceDuration = sentenceEnd - sentenceStart;
        const usePunctuationBoundary = boundaryMode !== 'pause_only';
        const hitPunctuationBoundary = usePunctuationBoundary && hasSentenceTerminal(normalizedWord.text);
        const hitWordBoundary = currentWords.length >= maxWordsPerSentence;
        const hitDurationBoundary = currentWords.length >= minWordsForDurationBreak &&
                                   sentenceDuration >= maxSentenceDuration;

        if (hitPunctuationBoundary || hitWordBoundary || hitDurationBoundary) {
            flushSentence();
        }
    }

    flushSentence();

    if (sentenceLayers.length > 1 && minTailWordsToMerge > 0) {
        const lastLayer = sentenceLayers[sentenceLayers.length - 1];
        const previousLayer = sentenceLayers[sentenceLayers.length - 2];
        const lastWords = Array.isArray(lastLayer.words) ? lastLayer.words : [];
        const prevWords = Array.isArray(previousLayer.words) ? previousLayer.words : [];

        if (lastWords.length > 0 && lastWords.length < minTailWordsToMerge && prevWords.length > 0) {
            const mergedWords = prevWords.concat(lastWords);
            previousLayer.words = mergedWords;
            previousLayer.start = previousLayer.start;
            previousLayer.end = lastLayer.end;
            previousLayer.text = applyTerminalPunctuationMode(
                buildSentenceTextFromTokens(mergedWords.map(function(word) { return word.text; })),
                punctuationOutputMode
            );
            sentenceLayers.pop();
        }
    }

    return sentenceLayers;
}

// ==================== SNAP / SMART WORD GROUPING ====================
// Groups 1-4 words per subtitle, honouring pauses, commas, capitals and
// unbreakable phrases from phrases.js.
function groupSmartWords(words) {
    var layersData = [];
    if (!words || !words.length) return layersData;
    var transcript = { words: words };
const PAUSE_THRESHOLD = 0.35;
const allWords = transcript.words;
let wi = 0;

function _startsWithCapital(w) {
    if (!w || typeof w !== 'string') return false;
    var clean = w.replace(/^[^\w]+/, '');
    return /^[A-Z]/.test(clean) && clean !== clean.toUpperCase();
}

function _getWord(obj) {
    return safeTrim(safeString(obj.word || obj.text));
}

function _cleanWord(w) {
    return w.toLowerCase().replace(/[^\wа-яіїєґ-]/gi, '');
}

// Pre-load normalized phrases once
const _phrases = (window.UNBREAKABLE_PHRASES_NORMALIZED) || [];

// Check if words[idx] and words[idx+1] (etc.) form the START of any phrase
// Returns the full phrase array if match found at position idx, else null
function _phraseStartingAt(idx) {
    for (let pi = 0; pi < _phrases.length; pi++) {
        const ph = _phrases[pi];
        if (idx + ph.length > allWords.length) continue;
        let match = true;
        for (let k = 0; k < ph.length; k++) {
            if (_cleanWord(_getWord(allWords[idx + k])) !== ph[k]) {
                match = false; break;
            }
        }
        if (match) return ph;
    }
    return null;
}

// Check if the LAST n words of group match the first n words of any phrase
// and the next words complete it → return how many next words to pull in
function _phraseCrossedBoundary(grp, nextIdx) {
    for (let pi = 0; pi < _phrases.length; pi++) {
        const ph = _phrases[pi];
        for (let tailLen = 1; tailLen < ph.length; tailLen++) {
            const headLen = ph.length - tailLen;
            if (tailLen > grp.length) continue;
            if (nextIdx + headLen > allWords.length) continue;
            // tail must match end of group
            let tailOk = true;
            for (let ti = 0; ti < tailLen; ti++) {
                if (_cleanWord(_getWord(grp[grp.length - tailLen + ti])) !== ph[ti]) {
                    tailOk = false; break;
                }
            }
            if (!tailOk) continue;
            // head must match next words
            let headOk = true;
            for (let hi = 0; hi < headLen; hi++) {
                if (_cleanWord(_getWord(allWords[nextIdx + hi])) !== ph[tailLen + hi]) {
                    headOk = false; break;
                }
            }
            if (headOk) return headLen; // pull in this many next words
        }
    }
    return 0;
}

const DANGLING_WORDS = [
    'a','an','the',
    'in','on','at','to','of','for','by','up',
    'and','or','but','nor',
    'а','в','у','і','й','та','чи','бо','але',
    'на','до','від','за','по','при','під','над',
    'із','зі','з','ще','як','що','це'
];

while (wi < allWords.length) {
    const group = [];
    let hitComma = false;
    let hitEndPunct = false;

    // Check if a phrase starts at current position
    const phraseAtStart = _phraseStartingAt(wi);

    for (let j = 0; j < 4 && wi + j < allWords.length; j++) {
        const wordObj = allWords[wi + j];
        const word = _getWord(wordObj);
        if (!word) continue;

        // Capital letter → start new group (unless it's part of a phrase)
        if (j > 0 && _startsWithCapital(word)) {
            // Allow if this word continues an unbreakable phrase from wi
            const stillInPhrase = phraseAtStart && j < phraseAtStart.length;
            if (!stillInPhrase) {
                hitEndPunct = true;
                break;
            }
        }

        // Pause or comma in previous word → break (unless inside a phrase)
        if (j > 0) {
            const prevObj = allWords[wi + j - 1];
            const pause = wordObj.start - prevObj.end;
            const stillInPhrase = phraseAtStart && j < phraseAtStart.length;
            if (!stillInPhrase) {
                if (pause >= PAUSE_THRESHOLD) break;
                const prevWord = _getWord(prevObj);
                if (prevWord && prevWord.indexOf(',') !== -1) {
                    hitComma = true;
                    break;
                }
            }
        }

        group.push(wordObj);

        // Current word has comma (and not first) → end group
        if (word.indexOf(',') !== -1 && j >= 1) {
            hitComma = true;
            break;
        }

        // End punctuation → end group
        if (/[.!?]/.test(word)) {
            hitEndPunct = true;
            break;
        }
    }

    // Short-word protection
    if (!hitComma && !hitEndPunct && group.length > 0 && group.length <= 4
        && wi + group.length < allWords.length) {
        const lastObj = group[group.length - 1];
        const nextObj = allWords[wi + group.length];
        const lastWord = _getWord(lastObj);
        const nextWord = _getWord(nextObj);
        if (lastWord && nextWord) {
            const cleanLast = lastWord.toLowerCase().replace(/[^\w]/g, '');
            const pauseNext = nextObj.start - lastObj.end;
            if (pauseNext < PAUSE_THRESHOLD
                && !_startsWithCapital(nextWord)
                && !/[.!?,]/.test(nextWord)
                && cleanLast.length <= 2) {
                group.push(nextObj);
            }
        }
    }

    // Dangling word protection: last word must not be a loose article/preposition
    if (group.length > 1) {
        const lastW = _cleanWord(_getWord(group[group.length - 1]));
        if (DANGLING_WORDS.indexOf(lastW) !== -1) {
            group.pop();
        }
    }

    // Unbreakable phrase boundary check:
    // If the last word(s) of this group + next words form a phrase → pull them in
    if (group.length > 0 && wi + group.length < allWords.length) {
        const pullCount = _phraseCrossedBoundary(group, wi + group.length);
        for (let p = 0; p < pullCount; p++) {
            const nextIdx = wi + group.length;
            if (nextIdx < allWords.length) group.push(allWords[nextIdx]);
        }
    }

    if (group.length > 0) {
        // Build text: if an unbreakable phrase starts mid-group,
        // insert a newline before it so it stays on its own line
        let text = '';
        const words = group.map(function(w) { return _getWord(w); });
        for (let ti = 0; ti < words.length; ti++) {
            if (ti === 0) {
                text += words[ti];
            } else {
                // Check if a phrase starts at position ti within this group
                let phraseStartsHere = false;
                for (let pi2 = 0; pi2 < _phrases.length; pi2++) {
                    const ph2 = _phrases[pi2];
                    if (ti + ph2.length > words.length) continue;
                    let m = true;
                    for (let pk = 0; pk < ph2.length; pk++) {
                        if (_cleanWord(words[ti + pk]) !== ph2[pk]) { m = false; break; }
                    }
                    if (m) { phraseStartsHere = true; break; }
                }
                text += (phraseStartsHere ? '\n' : ' ') + words[ti];
            }
        }
        layersData.push({
            text: text,
            start: group[0].start,
            end: group[group.length - 1].end,
            words: group
        });
    }

    // ALWAYS advance at least 1 to prevent infinite loop
    wi += Math.max(1, group.length);
}
    return layersData;
}
// ==================== CANONICAL CORRECTIONS ====================
// Fixes spelling / casing of product and programme names AFTER transcription.
// Two operations:
//   merge  — several heard tokens collapse into one canonical word ("fit me" -> "FitMe")
//   recase — token count is unchanged, only capitalisation is fixed ("chair yoga" -> "Chair Yoga")

function _corrTrailing(token) {
    var m = String(token).match(/[.,!?;:…"'’”)\]]+$/);
    return m ? m[0] : '';
}

function applyCanonicalCorrections(words) {
    if (!words || !words.length) return { words: [], merged: 0, recased: 0 };

    var norm = window._corrNormalizeToken;
    var merges = window.CANONICAL_MERGE || [];
    var recases = window.CANONICAL_RECASE || [];
    var singles = window.CANONICAL_SINGLE || {};

    var out = [];
    var mergedCount = 0;
    var recasedCount = 0;
    var i = 0;

    function matchesAt(keys, idx) {
        if (idx + keys.length > words.length) return false;
        for (var k = 0; k < keys.length; k++) {
            if (norm(words[idx + k].word) !== keys[k]) return false;
        }
        return true;
    }

    while (i < words.length) {
        var handled = false;

        // 1. merge variants (longest first)
        for (var m = 0; m < merges.length; m++) {
            var rule = merges[m];
            if (!matchesAt(rule.match, i)) continue;
            var first = words[i];
            var last = words[i + rule.match.length - 1];
            out.push({
                word: rule.to + _corrTrailing(last.word),
                start: first.start,
                end: last.end,
                characters: null
            });
            if (rule.match.length > 1) mergedCount++;
            else recasedCount++;
            i += rule.match.length;
            handled = true;
            break;
        }
        if (handled) continue;

        // 2. multi-word recase (longest first)
        for (var r = 0; r < recases.length; r++) {
            var rc = recases[r];
            if (!matchesAt(rc.match, i)) continue;
            for (var t = 0; t < rc.match.length; t++) {
                var src = words[i + t];
                out.push({
                    word: rc.tokens[t] + _corrTrailing(src.word),
                    start: src.start,
                    end: src.end,
                    characters: src.characters || null
                });
            }
            recasedCount++;
            i += rc.match.length;
            handled = true;
            break;
        }
        if (handled) continue;

        // 3. single-word canonical
        var w = words[i];
        var key = norm(w.word);
        if (singles[key] && w.word.indexOf(singles[key]) !== 0) {
            out.push({
                word: singles[key] + _corrTrailing(w.word),
                start: w.start,
                end: w.end,
                characters: null
            });
            recasedCount++;
        } else {
            out.push(w);
        }
        i++;
    }

    return { words: out, merged: mergedCount, recased: recasedCount };
}

// ==================== PUNCTUATION STRIPPING ====================
// Removes sentence punctuation from the ON-SCREEN text only.
// Runs AFTER segmentation, because the segmenters rely on punctuation to find
// sentence and phrase boundaries.
// Apostrophes and hyphens are preserved: don't / push-up must survive.

var PUNCT_STRIP_RE = /[.,!?;:\u2026\u3002\u3001\uFF0C\uFF1B\uFF1A\uFF01\uFF1F"\u201C\u201D\u00AB\u00BB()\[\]{}]/g;

function stripDisplayPunctuation(text) {
    if (!text && text !== 0) return '';
    return String(text)
        .replace(PUNCT_STRIP_RE, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/^\s+|\s+$/g, '');
}

function stripPunctuationInLayers(layersData) {
    if (!layersData) return [];
    var out = [];
    for (var i = 0; i < layersData.length; i++) {
        var item = layersData[i];
        if (!item) continue;
        var clone = {
            start: item.start,
            end: item.end,
            words: item.words || []
        };
        if (item.text !== undefined && item.text !== null) {
            clone.text = stripDisplayPunctuation(item.text);
        }
        if (item.word !== undefined && item.word !== null) {
            clone.word = stripDisplayPunctuation(item.word);
        }
        var display = clone.text || clone.word || '';
        if (!display) continue;
        out.push(clone);
    }
    return out;
}

// ==================== PUNCTUATION KEEPING (Classic only) ====================
// Same clone shape as stripPunctuationInLayers, but the punctuation stays.
// Only tidies spacing: no space before , . ! ? ; : and no doubled spaces.

function tidyDisplayPunctuation(text) {
    if (!text && text !== 0) return '';
    return String(text)
        .replace(/[ \t]+([.,!?;:\u2026])/g, '$1')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/^\s+|\s+$/g, '');
}

function keepPunctuationInLayers(layersData) {
    if (!layersData) return [];
    var out = [];
    for (var i = 0; i < layersData.length; i++) {
        var item = layersData[i];
        if (!item) continue;
        var clone = {
            start: item.start,
            end: item.end,
            words: item.words || []
        };
        if (item.text !== undefined && item.text !== null) {
            clone.text = tidyDisplayPunctuation(item.text);
        }
        if (item.word !== undefined && item.word !== null) {
            clone.word = tidyDisplayPunctuation(item.word);
        }
        var display = clone.text || clone.word || '';
        if (!display) continue;
        out.push(clone);
    }
    return out;
}
