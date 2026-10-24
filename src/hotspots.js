'use strict';

// Where a pet window takes clicks: its own spots, as the page reports them
// (hot-rects, in window pixels). The first is the pet's body, which the page
// hits as the ellipse inside that box; the rest (card, bubble, badge,
// controls) are boxes. The shell checks the pointer against them itself, so
// the pet can still be grabbed when Windows stops passing the mouse moves on
// to the click-through window (it drops a mouse hook that answered late,
// which happens while the agent keeps Openmon busy).

function onSpot(bounds, hot, point) {
  const x = point.x - bounds.x;
  const y = point.y - bounds.y;
  return (hot || []).some(([hx, hy, w, h], i) => {
    if (!(w > 0 && h > 0)) return false;
    if (i > 0) return x >= hx && x < hx + w && y >= hy && y < hy + h;
    const dx = (x - (hx + w / 2)) / (w / 2);
    const dy = (y - (hy + h / 2)) / (h / 2);
    return dx * dx + dy * dy <= 1;
  });
}

module.exports = { onSpot };
