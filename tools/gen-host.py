#!/usr/bin/env python3
"""
FitMe Studio — generate host/index.jsx from host/modules/*.jsx.

Why this exists instead of $.evalFile
-------------------------------------
1.0.0 and 1.0.1 loaded the four host scripts with $.evalFile from a loader.
Three modules survived that; OrganizeMe did not, and the reason is what each
module does to reach the global scope:

    motion-kit.jsx   MK = {...}                  bare assignment -> global from
                                                 any scope
    tags.jsx         $.global.RobertVitalik      explicitly global
    subs.jsx         function + JSON polyfill    one function, barely used
    org.jsx          function organizeProject()  a *declaration* — global only
                     and ~35 more                if the evaluation itself was
                                                 at global scope

$.evalFile does not reliably evaluate at global scope, so org.jsx's function
declarations landed somewhere the panel could not see them. The ORG tab drew
perfectly and every button did nothing.

Concatenation removes the question. AE evaluates <ScriptPath> at global scope,
full stop, so everything in the generated file is global by construction. It
also deletes the whole extension-path dance: nothing is resolved at runtime.

The modules in host/modules/ stay byte-identical to their standalone builds.
The only edit this script makes is commenting out their #target directives,
which are only legal at the top of a file; one is emitted for the whole
bundle instead.

Usage:  python3 tools/gen-host.py        (run from the extension root)
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODULES_DIR = ROOT / "host" / "modules"
OUT = ROOT / "host" / "index.jsx"

# Load order matters twice. subs.jsx first: it installs the JSON polyfill the
# others fall back on when the host ExtendScript has no native JSON.
# studio-inserts.jsx after motion-kit.jsx: it hangs two extra tools off MK.tools
# and does nothing at all if MK is not there yet.
MODULES = ["subs.jsx", "motion-kit.jsx", "studio-inserts.jsx", "tags.jsx", "org.jsx"]

DIRECTIVE = re.compile(r"^(\s*)(#(?:target|engine|script|strict|include|includepath)\b.*)$")

PRELUDE = '''/* ------------------------------------------------------------------------ *
 * FitMe Studio {version} — host.
 *
 * GENERATED FILE. Do not edit.
 * Source: host/modules/*.jsx  ->  tools/gen-host.py
 *
 * The four modules below are byte-identical to their standalone builds except
 * for their #target directives, which are commented out here because only the
 * one at the top of this file is legal. Fix a module in its own repo, drop the
 * file into host/modules/, re-run the generator.
 *
 * Everything is concatenated into one file on purpose: AE evaluates a CEP
 * <ScriptPath> at global scope, which is the only way org.jsx's plain
 * `function organizeProject()` declarations become callable from the panel.
 * ------------------------------------------------------------------------ */

#target aftereffects

$.global.FitMeStudio = $.global.FitMeStudio || {{}};
$.global.FitMeStudio.VERSION = "{version}";
$.global.FitMeStudio.MODULES = [{module_list}];

/**
 * Health check. Deliberately probes the symbols the panel actually calls
 * rather than trusting a "loaded" flag — the 1.0.1 bug was a module that
 * evaluated without error and still left nothing callable behind.
 */
$.global.FitMeStudio.probe = function (name) {{
    try {{
        if (name === "subs.jsx") {{
            return typeof getSelectedAudioPath === "function";
        }}
        if (name === "motion-kit.jsx") {{
            return typeof MK === "object" && MK !== null && typeof MK.run === "function";
        }}
        if (name === "tags.jsx") {{
            return typeof $.global.RobertVitalik === "object" && $.global.RobertVitalik !== null;
        }}
        if (name === "studio-inserts.jsx") {{
            return typeof MK === "object" && MK !== null && MK.tools !== undefined &&
                   MK.tools["studio.disclaimer"] !== undefined &&
                   MK.tools["studio.cta"] !== undefined;
        }}
        if (name === "org.jsx") {{
            return typeof organizeProject === "function" &&
                   typeof organizeAndCleanV3 === "function" &&
                   typeof getProjectInfoToFile === "function";
        }}
    }} catch (e) {{}}
    return false;
}};

/** Minimal string quoter — subs.jsx's JSON polyfill may not be up yet. */
$.global.FitMeStudio._q = function (value) {{
    var text = String(value === null || value === undefined ? "" : value);
    var out = "";
    var i, ch, code, hex;

    for (i = 0; i < text.length; i++) {{
        ch = text.charAt(i);
        code = text.charCodeAt(i);
        if (ch === '"' || ch === "\\\\") out += "\\\\" + ch;
        else if (ch === "\\n") out += "\\\\n";
        else if (ch === "\\r") out += "\\\\r";
        else if (ch === "\\t") out += "\\\\t";
        else if (code < 32) {{
            hex = code.toString(16);
            while (hex.length < 4) hex = "0" + hex;
            out += "\\\\u" + hex;
        }} else out += ch;
    }}
    return '"' + out + '"';
}};

/** Panel-readable report. Returns a JSON string. */
$.global.FitMeStudio.status = function () {{
    var S = $.global.FitMeStudio;
    var q = S._q;
    var mods = [];
    var ready = true;
    var i, name, ok;

    for (i = 0; i < S.MODULES.length; i++) {{
        name = S.MODULES[i];
        ok = S.probe(name);
        mods.push(q(name) + ":" + (ok ? "true" : "false"));
        if (!ok) ready = false;
    }}

    return '{{"version":' + q(S.VERSION) +
           ',"ready":' + (ready ? "true" : "false") +
           ',"modules":{{' + mods.join(",") + "}}}}";
}};
'''


def neutralise_directives(text, name):
    out = []
    for line in text.split("\n"):
        m = DIRECTIVE.match(line)
        if m:
            out.append("%s// [FitMe Studio] %s  (directive hoisted to the top of the bundle)"
                       % (m.group(1), m.group(2)))
        else:
            out.append(line)
    return "\n".join(out)


def main():
    version = sys.argv[1] if len(sys.argv) > 1 else "1.0.2"

    missing = [m for m in MODULES if not (MODULES_DIR / m).is_file()]
    if missing:
        sys.exit("missing module(s) in %s: %s" % (MODULES_DIR, ", ".join(missing)))

    parts = [PRELUDE.format(
        version=version,
        module_list=", ".join('"%s"' % m for m in MODULES),
    )]

    for name in MODULES:
        src = (MODULES_DIR / name).read_text(encoding="utf-8")
        parts.append(
            "\n\n/* ======================================================================== *\n"
            " * module: %s\n"
            " * ======================================================================== */\n\n"
            % name
            + neutralise_directives(src, name)
        )

    text = "\n".join(parts).rstrip() + "\n"
    OUT.write_text(text, encoding="utf-8")
    print("wrote %s  (%d lines, %d modules, version %s)"
          % (OUT.relative_to(ROOT), text.count("\n") + 1, len(MODULES), version))


if __name__ == "__main__":
    main()
