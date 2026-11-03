// host/index.jsx - ExtendScript for OpenAI Whisper

#target aftereffects

// JSON polyfill — ExtendScript does not natively support JSON.
// Required for reliable operation regardless of which Adobe panels are open.
if (typeof JSON === 'undefined') { JSON = {}; }
if (typeof JSON.stringify !== 'function') {
    JSON.stringify = function(obj) {
        var t = typeof obj;
        if (t === 'undefined') return undefined;
        if (t === 'number' || t === 'boolean') return String(obj);
        if (t === 'string') return '"' + obj.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/\t/g,'\\t') + '"';
        if (obj === null) return 'null';
        if (obj instanceof Array) {
            var arr = [];
            for (var i = 0; i < obj.length; i++) arr.push(JSON.stringify(obj[i]));
            return '[' + arr.join(',') + ']';
        }
        var pairs = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                var val = JSON.stringify(obj[k]);
                if (typeof val !== 'undefined') pairs.push('"' + k + '":' + val);
            }
        }
        return '{' + pairs.join(',') + '}';
    };
}
if (typeof JSON.parse !== 'function') {
    JSON.parse = function(str) { return eval('(' + str + ')'); };
}

function getSelectedAudioPath() {
    try {
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem)) {
            return JSON.stringify({success: false, error: "No composition"});
        }
        
        var selectedLayers = comp.selectedLayers;
        if (!selectedLayers || selectedLayers.length === 0) {
            return JSON.stringify({success: false, error: "No layer"});
        }
        
        var layer = selectedLayers[0];
        
        if (!(layer instanceof AVLayer) || !layer.source || !layer.source.file) {
            return JSON.stringify({success: false, error: "No audio file"});
        }
        
        if (!layer.source.file.exists) {
            return JSON.stringify({success: false, error: "File not found"});
        }
        
        return JSON.stringify({
            success: true,
            audioPath: layer.source.file.fsName,
            layerName: layer.name
        });
        
    } catch(e) {
        return JSON.stringify({success: false, error: e.toString()});
    }
}