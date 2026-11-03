/**
 * Motion Kit — icons.
 *
 * Inline SVG stroked with currentColor, so armed, primary and disabled states
 * are handled entirely by CSS. Filled shapes use currentColor too, never a
 * literal colour, or they would not invert on a yellow background.
 *
 * Glyph language: a diamond is a keyframe, a rectangle is a layer, a filled
 * shape means "write", an outlined one means "read".
 */
window.Icons = (function () {

  function svg(body, box) {
    return '<svg viewBox="0 0 ' + (box || "24 24") + '" fill="none" ' +
           'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
           'stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  /** The eight handles AE draws round a selected box. Shared by TEXT WRAP
      and NULL, which are both "something inside a frame you can grab". */
  function handles(x, y, w, h, s) {
    var half = s / 2;
    var pts = [[x, y], [x + w / 2, y], [x + w, y],
               [x, y + h / 2], [x + w, y + h / 2],
               [x, y + h], [x + w / 2, y + h], [x + w, y + h]];
    var out = "";
    for (var i = 0; i < pts.length; i++) {
      out += '<rect x="' + (pts[i][0] - half) + '" y="' + (pts[i][1] - half) +
             '" width="' + s + '" height="' + s + '" fill="currentColor" stroke="none"/>';
    }
    return out;
  }

  /** Diamond centred on cx,cy with half-diagonal r.
      An outlined diamond reads larger than a filled one of the same r,
      because the stroke sits outside the path, so small clusters pass a
      thinner width and a smaller r to make the two match by eye. */
  function diamond(cx, cy, r, filled, strokeWidth) {
    var d = "M" + cx + " " + (cy - r) +
            "L" + (cx + r) + " " + cy +
            "L" + cx + " " + (cy + r) +
            "L" + (cx - r) + " " + cy + "Z";
    if (filled) {
      return '<path d="' + d + '" fill="currentColor" stroke="none"/>';
    }
    return '<path d="' + d + '"' +
           (strokeWidth ? ' stroke-width="' + strokeWidth + '"' : "") + '/>';
  }

  var KEY = 'M10 6.5 13 10 10 13.5 7 10Z';

  return {

    /* ---- shown in the panel ---- */

    /* A null: outlined box with its anchor dot at the centre. */
    /* A null's own box, in the same language as TEXT WRAP: a square with
       grab handles. Drawn near the edges of the 24-unit box so it carries
       the same visual weight as the ease diamonds beside it — a smaller
       square reads as a smaller button even when the tile is identical. */
    parentNull: svg('<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="1" ' +
                    'stroke-width="1.9"/>' +
                    '<path d="M12 6.6v10.8M6.6 12h10.8" stroke-width="2.3"/>' +
                    handles(3.2, 3.2, 17.6, 17.6, 3.6)),

    easeCopy: svg(diamond(12, 12, 7.5, false)),

    /* Write an ease: the same diamond, filled. */
    easePaste: svg(diamond(12, 12, 7.5, true)),

    /* Duplicate keyframes: one pair of keys, and the same pair again offset.
       Four diamonds of one size on a regular lattice — the repetition is
       what reads as a copy, so nothing here should look accidental. */
    /* Keyframes being copied. They are the subject of the tool, so they are
       drawn large — the old cluster sat in the middle of the box and read as
       decoration rather than as keys. */
    clone: svg(diamond(6.6, 6.8, 5, true) +
               diamond(17.4, 6.8, 4.2, false, 1.8) +
               diamond(9.2, 17.2, 5, true) +
               diamond(19.2, 17.2, 4.2, false, 1.8)),

    /* Box text as AE shows it selected: a frame with grab handles.
       Deliberately not a solid border — the frame is a guide, nothing is
       drawn in the render, and a solid rectangle would promise otherwise.
       Square now, so it sits with the other square tools. */
    pointToBox: svg('<rect x="3.5" y="6.5" width="17" height="11" rx="1" ' +
                    'stroke-width="1.3" opacity=".9"/>' +
                    '<path d="M7 11.5h10M7 14.5h6" stroke-width="1.8"/>' +
                    handles(3.5, 6.5, 17, 11, 2.4)),

    /* ---- kept so a tool is one registry line away from coming back ---- */

    /* Layers collapsing into one baked clip. */
    preRender: svg('<path d="M4 6.5h6M4 10h6M4 13.5h6" stroke-width="1.8"/>' +
                   '<path d="M12.5 10h3.5M14 7.5l2.5 2.5-2.5 2.5"/>' +
                   '<rect x="17.5" y="5" width="3" height="10" rx="1" ' +
                   'fill="currentColor" stroke="none"/>'),

    /* The plate itself: a filled rounded rectangle, which is exactly what
       the tool puts behind the text. */
    textBox: svg('<rect x="3" y="6.5" width="18" height="11" rx="3" ' +
                 'fill="currentColor" stroke="none"/>'),
    fixTime: svg('<path d="' + KEY + '"/><path d="M3 4v12M9 4v12M15 4v12" opacity=".45"/>',
                 "20 20"),
    loop: svg('<path d="M5 8a4 4 0 0 1 4-4h6"/><path d="M13 2l2 2-2 2"/>' +
              '<path d="M15 12a4 4 0 0 1-4 4H5"/><path d="M7 18l-2-2 2-2"/>', "20 20"),
    anchor: svg('<circle cx="10" cy="10" r="2.5"/>' +
                '<path d="M10 2v3M10 15v3M2 10h3M15 10h3"/>', "20 20"),
    fromVector: svg('<path d="M4 6h12v8H4z"/><path d="M4 6l6 4 6-4" opacity=".45"/>' +
                    '<circle cx="4" cy="6" r="1.4"/><circle cx="16" cy="14" r="1.4"/>', "20 20"),
    removeArtboard: svg('<path d="M3 5h14v10H3z" opacity=".4"/><path d="M7 9h6v6H7z"/>' +
                        '<path d="M3 5l3 3" opacity=".4"/>', "20 20"),
    extract: svg('<path d="M3 4h7v7H3z"/><path d="M11 9h6v7h-6z"/>' +
                 '<path d="M10 7h4" opacity=".6"/>', "20 20"),
    merge: svg('<path d="M3 4h6v6H3z"/><path d="M11 10h6v6h-6z"/>' +
               '<path d="M9 7h3v3" opacity=".6"/>', "20 20")
  };
})();
