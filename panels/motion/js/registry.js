/**
 * Motion Kit — registry.
 *
 * A flat list. The panel is one 4-column grid with no section headings, so
 * there is nothing between an entry here and a button on screen.
 *
 * Auto-placement does the layout; `cols` and `rows` are the only hints:
 *
 *   pad  2x2  -> columns 1-2, rows 1-2
 *   two  2x1  -> columns 3-4, rows 1 and 2
 *   four 1x1  -> row 3
 *
 * Item types:
 *   tool        a button that calls tool(id) with the held modifiers
 *   anchorGrid  the 3x3 anchor pad; each cell calls the same tool
 *   select      a persisted choice, passed to sibling tools as args
 *
 * Variants on a tool:
 *   pill        the label is a filled slab, for a tool whose output *is* that
 *   primary     a fully filled button
 *
 * Tools not listed here still exist in the host. Bringing one back — Loop,
 * Snap to frames, To shapes, Drop artboard, Extract, Merge — means adding an
 * entry, nothing else.
 */
window.Registry = [
{
    type: "anchorGrid",
    tool: "anchor.move",
    cols: 2,
    rows: 2,
    tip: "Move the anchor point to a corner or edge of the layer bounds. " +
         "The layer stays where it is.\n" +
         "Alt: include masks in the bounds.\n" +
         "Shift: include stroke and shadow in the bounds."
  },

  {
    type: "tool",
    tool: "text.pointToBox",
    icon: "pointToBox",
    label: "Text Wrap",
    tip: "Rebuild the selected point text layer as box text, so it wraps.\n" +
         "The box leaves two blank lines of room below the text, measured " +
         "from the layer's own font size and leading. Side padding is flat.\n" +
         "Alt: keep the original, switched off."
  },

  {
    type: "tool",
    tool: "text.box",
    icon: "textBox",
    label: "Plate",
    pill: true,
    tip: "Build an auto-sizing shape box behind the selected text layer, " +
         "parented to it and driven by expressions.\n" +
         "Padding, radius, fill and stroke sit on the box's effect controls.\n" +
         "Select existing boxes instead to re-apply their expressions."
  },

  {
    type: "tool",
    tool: "keys.clone",
    icon: "clone",
    label: "Clone",
    tip: "Copy the selected keyframes to the playhead.\n" +
         "Shift: reverse the copy in time.\n" +
         "Alt: select the new keyframes afterwards."
  },

  {
    type: "tool",
    tool: "layers.parentNull",
    icon: "parentNull",
    label: "Null",
    tip: "Add a null directly above the topmost selected layer and parent " +
         "the selection to it.\n" +
         "Alt: make the null 3D."
  },

  {
    type: "tool",
    tool: "keys.easeCopy",
    icon: "easeCopy",
    label: "Ease Copy",
    tip: "Store the interpolation of the selected keyframe.",
    store: "easeBuffer"
  },

  {
    type: "tool",
    tool: "keys.easePaste",
    icon: "easePaste",
    label: "Ease Paste",
    tip: "Apply the stored interpolation to every selected keyframe. " +
         "Values and timing are untouched.",
    args: { ease: "@easeBuffer.ease" }
  },

  {
    type: "tool",
    tool: "studio.preRender",
    label: "Pre-render any layers",
    cols: 2,
    tip: "Bake the selected layers into one clip named PRE-RENDER-N.mp4, " +
         "placed above them and starting where they start.\n" +
         "Any length \u2014 the clip is as long as the selection.\n" +
         "Numbering fills gaps: with 1, 2 and 5 taken, the next renders are " +
         "3, 4 and 6. Nothing already on disk is renamed.\n" +
         "The originals stay, with video and audio switched off."
  }
];
