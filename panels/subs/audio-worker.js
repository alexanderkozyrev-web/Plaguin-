// audio-worker.js — off-thread mono MP3 encoding.
// Receives Int16 PCM, returns MP3 bytes. Keeps the panel responsive while
// lamejs chews through a 3-5 minute mixdown.

/* global importScripts, lamejs, self */

try {
    importScripts('lame.min.js');
} catch (e) {
    self.postMessage({ ok: false, error: 'importScripts failed: ' + e.message });
}

self.onmessage = function (ev) {
    var msg = ev.data || {};
    try {
        var pcm = new Int16Array(msg.pcm);
        var sampleRate = msg.sampleRate || 16000;
        var bitrate = msg.bitrate || 64;

        var encoder = new lamejs.Mp3Encoder(1, sampleRate, bitrate);
        var blockSize = 1152;
        var chunks = [];
        var total = 0;

        for (var i = 0; i < pcm.length; i += blockSize) {
            var slice = pcm.subarray(i, Math.min(i + blockSize, pcm.length));
            var buf = encoder.encodeBuffer(slice);
            if (buf.length > 0) { chunks.push(buf); total += buf.length; }

            if ((i / blockSize) % 400 === 0) {
                self.postMessage({ progress: i / pcm.length });
            }
        }

        var tail = encoder.flush();
        if (tail.length > 0) { chunks.push(tail); total += tail.length; }

        var out = new Uint8Array(total);
        var offset = 0;
        for (var c = 0; c < chunks.length; c++) {
            out.set(chunks[c], offset);
            offset += chunks[c].length;
        }

        self.postMessage({ ok: true, mp3: out.buffer }, [out.buffer]);
    } catch (err) {
        self.postMessage({ ok: false, error: err && err.message ? err.message : String(err) });
    }
};
