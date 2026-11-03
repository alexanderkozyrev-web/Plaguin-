// config.js — provider configuration
// Default: ElevenLabs Scribe v2. Fallback: OpenAI whisper-1.
//
// Every provider must expose parseResponse() returning the INTERNAL shape:
//   { text: String, language: String, words: [ { word, start, end } ], segments: [] | null }
// segments is only populated by whisper-1 (needed for punctuation hints).

window.CONFIG = {

    // ==================== API KEYS ====================
    ELEVENLABS_API_KEY: 'YOUR-ELEVENLABS-API-KEY',
    OPENAI_API_KEY: 'YOUR-OPENAI-API-KEY',

    DEFAULT_PROVIDER: 'elevenlabs',

    // ==================== LAYER NAME TAGS ====================
    // Selected layers whose name contains any of these tags are kept OUT of the
    // mixdown, even if they have audible audio. Matching is case-insensitive
    // and substring-based. Add your own tags here.
    EXCLUDE_TAGS: ['[speechnosubs]'],

    // ==================== AUDIO PIPELINE ====================
    AUDIO: {
        TARGET_SAMPLE_RATE: 16000,   // Whisper/Scribe both resample to 16k internally
        MP3_BITRATE: 64,             // kbps, mono
        ENCODE: 'mp3',               // 'mp3' | 'wav'  — rollback switch
        USE_WORKER: true             // falls back to main thread automatically
    },

    // ==================== NETWORK ====================
    NET: {
        TIMEOUT_MS: 180000,
        MAX_RETRIES: 4,
        BASE_BACKOFF_MS: 1200
    },

    // Send canonical product terms to Scribe as keyterms (biases recognition)
    KEYTERMS_ENABLED: true,

    PROVIDERS: {

        // ---------------------------------------------------------------
        // ElevenLabs Scribe v2 — default
        // ---------------------------------------------------------------
        elevenlabs: {
            name: 'ElevenLabs Scribe v2',
            endpoint: 'https://api.elevenlabs.io/v1/speech-to-text',
            model: 'scribe_v2',
            maxFileSize: 1024 * 1024 * 1024,
            supportsKeyterms: true,
            needsPunctuationHints: false,   // Scribe returns punctuation inline

            getHeaders: function () {
                return { 'xi-api-key': window.CONFIG.ELEVENLABS_API_KEY };
            },

            buildFormData: function (blob, filename, opts) {
                opts = opts || {};
                var fd = new FormData();
                fd.append('file', blob, filename);
                fd.append('model_id', 'scribe_v2');
                fd.append('tag_audio_events', 'false');
                fd.append('diarize', 'false');
                fd.append('timestamps_granularity', 'word');
                // Each keyterm MUST be its own form field. Sending the array as a
                // single JSON string makes the API measure the whole string against
                // the 50-character limit and reject it with invalid_keyword_length.
                if (opts.keyterms && opts.keyterms.length) {
                    for (var ki = 0; ki < opts.keyterms.length; ki++) {
                        fd.append('keyterms', String(opts.keyterms[ki]));
                    }
                }
                return fd;
            },

            parseResponse: function (data) {
                var out = {
                    text: (data && data.text) || '',
                    language: (data && data.language_code) || '',
                    words: [],
                    segments: null
                };
                var raw = (data && data.words) || [];
                for (var i = 0; i < raw.length; i++) {
                    var w = raw[i];
                    if (!w) continue;
                    // Scribe emits type: 'word' | 'spacing' | 'audio_event'
                    if (w.type && w.type !== 'word') continue;
                    var token = (w.text === undefined || w.text === null) ? '' : String(w.text);
                    if (!token.replace(/^\s+|\s+$/g, '')) continue;
                    out.words.push({
                        word: token,
                        start: Number(w.start),
                        end: Number(w.end),
                        characters: w.characters || null
                    });
                }
                if (!out.text && out.words.length) {
                    var parts = [];
                    for (var k = 0; k < out.words.length; k++) parts.push(out.words[k].word);
                    out.text = parts.join(' ');
                }
                return out;
            }
        },

        // ---------------------------------------------------------------
        // OpenAI whisper-1 — fallback
        // ---------------------------------------------------------------
        whisper: {
            name: 'OpenAI Whisper',
            endpoint: 'https://api.openai.com/v1/audio/transcriptions',
            model: 'whisper-1',
            maxFileSize: 25 * 1024 * 1024,
            supportsKeyterms: false,
            needsPunctuationHints: true,    // words come bare, punctuation lives in segments

            getHeaders: function () {
                return { 'Authorization': 'Bearer ' + window.CONFIG.OPENAI_API_KEY };
            },

            buildFormData: function (blob, filename) {
                var fd = new FormData();
                fd.append('file', blob, filename);
                fd.append('model', 'whisper-1');
                fd.append('response_format', 'verbose_json');
                fd.append('timestamp_granularities[]', 'word');
                fd.append('timestamp_granularities[]', 'segment');
                return fd;
            },

            parseResponse: function (data) {
                var out = {
                    text: (data && data.text) || '',
                    language: (data && data.language) || '',
                    words: [],
                    segments: (data && data.segments) || null
                };
                var raw = (data && data.words) || [];
                for (var i = 0; i < raw.length; i++) {
                    var w = raw[i];
                    if (!w) continue;
                    var token = w.word !== undefined ? w.word : w.text;
                    token = (token === undefined || token === null) ? '' : String(token);
                    if (!token.replace(/^\s+|\s+$/g, '')) continue;
                    out.words.push({
                        word: token,
                        start: Number(w.start),
                        end: Number(w.end),
                        characters: null
                    });
                }
                return out;
            }
        }
    },

    // ==================== HELPERS ====================
    getActiveProviderKey: function () {
        var sel = document.getElementById('providerSelect');
        var key = sel ? sel.value : this.DEFAULT_PROVIDER;
        return this.PROVIDERS[key] ? key : this.DEFAULT_PROVIDER;
    },

    getActiveProvider: function () {
        return this.PROVIDERS[this.getActiveProviderKey()];
    },

    isProviderConfigured: function (providerKey) {
        var key = providerKey || this.getActiveProviderKey();
        if (key === 'elevenlabs') {
            return !!this.ELEVENLABS_API_KEY && this.ELEVENLABS_API_KEY.indexOf('YOUR-') === -1;
        }
        if (key === 'whisper') {
            return !!this.OPENAI_API_KEY && this.OPENAI_API_KEY.indexOf('YOUR-') === -1;
        }
        return false;
    }
};
