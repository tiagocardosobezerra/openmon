// Procedural art for every Openmon form. No image assets: each form is a
// body shape, a palette and a few features, drawn on a 2D canvas. The
// origin is the point on the ground under the creature; y grows downward.
//
// drawCreature(ctx, spec) where spec = {
//   stage, lineage, trait, t (seconds), pose, family,
//   anim: { bob, squash, jump, shake, tilt, lookX, lookY, eyes, mouth, prop, crack, glow }
// }

(function () {
  'use strict';

  const INK = '#2a2140';
  const LINE = 2.6;

  const PALETTES = {
    egg: { body: '#fff4e0', dark: '#efd9b4', belly: '#fffaf0', accent: '#f2b880', glow: '#fff1c9' },
    sprout: { body: '#f6e7c9', dark: '#dcc59c', belly: '#fff8ea', accent: '#78c86b', glow: '#fff3d1' },
    craft: { body: '#ff9f43', dark: '#d9762b', belly: '#ffe2bd', accent: '#7a5440', glow: '#ffc56e', extra: '#9aa3b5' },
    lore: { body: '#9381f2', dark: '#6c5bcf', belly: '#e6e0ff', accent: '#f5d35f', glow: '#c7baff', extra: '#4b3f8f' },
    shell: { body: '#35d0bf', dark: '#1fa496', belly: '#d5fff8', accent: '#ffe156', glow: '#9dfff2', extra: '#1d6f73' },
    test: { body: '#74cc63', dark: '#4e9f42', belly: '#e4f8d8', accent: '#3f7d4f', glow: '#c3ffa8', extra: '#f4d35e' },
    roam: { body: '#5fb3ff', dark: '#3d88d8', belly: '#e0f1ff', accent: '#ffffff', glow: '#b5e0ff', extra: '#ff8a5c' },
    swarm: { body: '#ff80b8', dark: '#e0579b', belly: '#ffe3f0', accent: '#ffd166', glow: '#ffbddb', extra: '#9b5de5' },
    chimera: { body: '#b9a6ff', dark: '#8b74e6', belly: '#fff0fb', accent: '#ffd166', glow: '#ffd6f5', extra: '#5fd4c4' },
    docs: { body: '#f3ead6', dark: '#d9c9a6', belly: '#fffaf0', accent: '#3b5bdb', glow: '#c5d3ff', extra: '#ffffff' },
    git: { body: '#c7835a', dark: '#9c5e3b', belly: '#f6dcc4', accent: '#5fd4a0', glow: '#b8f5d6', extra: '#7a4a30' },
    debug: { body: '#e5484d', dark: '#b8323a', belly: '#ffd9d6', accent: '#3a2f55', glow: '#ffb1a8', extra: '#ffd166' },
    data: { body: '#5fc8e8', dark: '#3a98bd', belly: '#e2f7ff', accent: '#7c6cf2', glow: '#c9f2ff', extra: '#9ee6ff' },
    style: { body: '#ffb3d1', dark: '#e787b0', belly: '#fff0f6', accent: '#ffd166', glow: '#ffd6f0', extra: '#5fb3ff' },
  };

  // Shiny variants: same form, rare colours (1 in 128, decided at birth).
  const SHINY = {
    sprout: { body: '#dff1ff', dark: '#a9cbe6', belly: '#f6fbff', accent: '#ff8fb8', glow: '#e9f6ff' },
    craft: { body: '#5d6d8f', dark: '#3f4c69', belly: '#cbd7f0', accent: '#e9c46a', glow: '#9fb6e8', extra: '#e9c46a' },
    lore: { body: '#f2c14e', dark: '#c9962c', belly: '#fff2c6', accent: '#7e5bd6', glow: '#ffe69a', extra: '#8a5a00' },
    shell: { body: '#ff6b8a', dark: '#d4466a', belly: '#ffe0e7', accent: '#7dffb0', glow: '#ffb3c3', extra: '#7a1f38' },
    test: { body: '#41476a', dark: '#2a2e47', belly: '#d9dcef', accent: '#e2b13c', glow: '#ffe08a', extra: '#e2b13c' },
    roam: { body: '#ffd36b', dark: '#e0a93c', belly: '#fff4d4', accent: '#ffffff', glow: '#fff0b8', extra: '#5fb3ff' },
    swarm: { body: '#7ce3b5', dark: '#4fb88c', belly: '#e3fff1', accent: '#ff80b8', glow: '#c2ffe4', extra: '#9b5de5' },
    // Same palettes as tools/build-variants.js.
    docs: { body: '#f5d98a', dark: '#d9b45a', belly: '#fff3cf', accent: '#c0392b', glow: '#ffd9a8', extra: '#ffffff' },
    git: { body: '#ece6dc', dark: '#c9bfae', belly: '#fffaf2', accent: '#ff9fc4', glow: '#ffd1e3', extra: '#5a4e44' },
    debug: { body: '#f2c14e', dark: '#c9962c', belly: '#fff2c6', accent: '#1f6f5c', glow: '#ffe69a', extra: '#e5484d' },
    data: { body: '#b48cf2', dark: '#8a62d1', belly: '#f1e6ff', accent: '#3ddc97', glow: '#e6d6ff', extra: '#dcc6ff' },
    style: { body: '#8fe3c4', dark: '#5fbf9d', belly: '#eafff6', accent: '#ffd166', glow: '#c2ffe4', extra: '#5fb3ff' },
  };

  // Body proportions per lineage: width, top height, bottom height, tip.
  const SHAPES = {
    sprout: { w: 1.0, top: 0.95, bottom: 0.8, tip: 0 },
    craft: { w: 1.08, top: 0.92, bottom: 0.85, tip: 0 },
    lore: { w: 0.92, top: 1.12, bottom: 0.82, tip: 0.05 },
    shell: { w: 1.18, top: 0.82, bottom: 0.8, tip: 0 },
    test: { w: 1.1, top: 0.95, bottom: 0.72, tip: 0 },
    roam: { w: 0.95, top: 1.05, bottom: 0.85, tip: 0.28 },
    swarm: { w: 1.0, top: 0.98, bottom: 0.86, tip: 0 },
  };

  // From Adult on, each lineage grows into its own silhouette.
  const GROWN_SHAPES = {
    craft: { w: 1.16, top: 0.95, bottom: 0.92, tip: 0 },
    lore: { w: 0.84, top: 1.3, bottom: 0.8, tip: 0.12 },
    shell: { w: 1.34, top: 0.72, bottom: 0.76, tip: 0 },
    test: { w: 1.2, top: 0.9, bottom: 0.7, tip: 0 },
    roam: { w: 0.9, top: 1.14, bottom: 0.84, tip: 0.48 },
    swarm: { w: 1.02, top: 0.98, bottom: 0.88, tip: 0 },
  };

  const EYE_STYLE = { craft: 'fierce', lore: 'owl', shell: 'cat', test: 'kind', roam: 'sparkle', swarm: 'bead' };

  const STAGE_SCALE = { egg: 0.78, sprout: 0.66, juvenile: 0.82, adult: 1, mythic: 1.08 };

  function palette(spec) {
    if (spec.stage === 'egg') return PALETTES.egg;
    const key = spec.stage === 'sprout' || !spec.lineage ? 'sprout' : spec.lineage;
    const base = (spec.shiny && SHINY[key]) || PALETTES[key] || PALETTES.sprout;
    return spec.nocturne ? nightify(base) : base;
  }

  // Nocturne colours: the same palette pulled toward midnight blue, with
  // a moonlit belly and glow.
  function mix(a, b, k) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [p(a), p(b)];
    return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
  }
  const nightCache = new Map();
  function nightify(pal) {
    if (!nightCache.has(pal)) {
      nightCache.set(pal, {
        ...pal,
        body: mix(pal.body, '#2b2f6b', 0.55),
        dark: mix(pal.dark, '#1b1d45', 0.6),
        belly: mix(pal.belly, '#c9d4ff', 0.5),
        accent: mix(pal.accent, '#e8ecff', 0.35),
        glow: '#a9dcff',
      });
    }
    return nightCache.get(pal);
  }

  function moon(ctx, R, top, t) {
    ctx.save();
    ctx.translate(0, top + R * 0.3);
    ctx.globalAlpha = 0.5 + Math.sin(t * 2) * 0.15;
    ellipse(ctx, 0, 0, R * 0.22, R * 0.22);
    ctx.fillStyle = '#a9dcff';
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.13, 0, Math.PI * 2);
    ctx.arc(R * 0.06, -R * 0.04, R * 0.11, 0, Math.PI * 2, true);
    ctx.fillStyle = '#fff7c2';
    ctx.fill('evenodd');
    ctx.restore();
  }

  function shapeOf(spec) {
    if (spec.stage === 'sprout' || !spec.lineage) return SHAPES.sprout;
    if (stageN(spec.stage) >= 2) return GROWN_SHAPES[spec.lineage] || SHAPES.sprout;
    return SHAPES[spec.lineage] || SHAPES.sprout;
  }

  function stroke(ctx, width = LINE) {
    ctx.lineWidth = width;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function fillStroke(ctx, fill, width) {
    ctx.fillStyle = fill;
    ctx.fill();
    stroke(ctx, width);
  }

  function ellipse(ctx, x, y, rx, ry, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  }

  // Soft blob centred at (0, cy): w half-width, ht top height, hb bottom height.
  function blobPath(ctx, cy, w, ht, hb, tip) {
    const k = 0.56;
    ctx.beginPath();
    ctx.moveTo(-w, cy);
    ctx.bezierCurveTo(-w, cy - ht * k, -w * (k - tip * 0.8), cy - ht, 0, cy - ht - tip * ht * 0.35);
    ctx.bezierCurveTo(w * (k - tip * 0.8), cy - ht, w, cy - ht * k, w, cy);
    ctx.bezierCurveTo(w, cy + hb * 0.62, w * 0.6, cy + hb, 0, cy + hb);
    ctx.bezierCurveTo(-w * 0.6, cy + hb, -w, cy + hb * 0.62, -w, cy);
    ctx.closePath();
  }

  // --- faces -----------------------------------------------------------------

  function eye(ctx, x, y, r, kind, lookX, lookY, side) {
    ctx.save();
    switch (kind) {
      case 'blink':
      case 'flat':
        ctx.beginPath();
        ctx.moveTo(x - r * 0.8, y);
        ctx.lineTo(x + r * 0.8, y);
        stroke(ctx, LINE + 0.4);
        break;
      case 'happy':
        ctx.beginPath();
        ctx.arc(x, y + r * 0.35, r * 0.75, Math.PI * 1.1, Math.PI * 1.9);
        stroke(ctx, LINE + 0.6);
        break;
      case 'closed':
        ctx.beginPath();
        ctx.arc(x, y - r * 0.2, r * 0.7, Math.PI * 0.15, Math.PI * 0.85);
        stroke(ctx, LINE + 0.4);
        break;
      case 'hurt': {
        const d = r * 0.65;
        ctx.beginPath();
        ctx.moveTo(x - d * side, y - d);
        ctx.lineTo(x + d * side, y);
        ctx.lineTo(x - d * side, y + d);
        stroke(ctx, LINE + 0.6);
        break;
      }
      case 'focus': {
        ellipse(ctx, x, y, r * 0.78, r * 0.95);
        ctx.fillStyle = INK;
        ctx.fill();
        ellipse(ctx, x + lookX * r * 0.3 - r * 0.22, y + lookY * r * 0.2 - r * 0.32, r * 0.24, r * 0.24);
        ctx.fillStyle = '#fff';
        ctx.fill();
        // Lid.
        ctx.beginPath();
        ctx.rect(x - r, y - r * 1.2, r * 2, r * 0.85);
        ctx.fillStyle = ctx.__lid || '#000';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - r * 0.95, y - r * 0.35);
        ctx.lineTo(x + r * 0.95, y - r * 0.35);
        stroke(ctx, LINE);
        break;
      }
      default:
        openEye(ctx, x, y, r, kind === 'wide', lookX, lookY, side, ctx.__eyeStyle || 'round');
    }
    ctx.restore();
  }

  // Each grown lineage has its own eyes, so faces are not all the same.
  function openEye(ctx, x, y, r, wide, lookX, lookY, side, style) {
    const px = x + lookX * r * 0.18;
    const py = y + lookY * r * 0.12;
    const highlight = (hx, hy, big, small) => {
      ellipse(ctx, hx, hy, r * big, r * big);
      ctx.fillStyle = ctx.__shine || '#fff';
      ctx.fill();
      if (small) {
        ellipse(ctx, hx + r * 0.45, hy + r * 0.62, r * small, r * small);
        ctx.fill();
      }
    };
    const hx = x + lookX * r * 0.35 - r * 0.25;
    const hy = y + lookY * r * 0.25 - r * 0.38;
    switch (wide ? 'round' : style) {
      case 'owl':
        ellipse(ctx, x, y, r * 1.0, r * 1.0);
        ctx.fillStyle = '#fff';
        ctx.fill();
        stroke(ctx, LINE - 0.4);
        ellipse(ctx, x + lookX * r * 0.35, y + lookY * r * 0.3, r * 0.5, r * 0.5);
        ctx.fillStyle = INK;
        ctx.fill();
        highlight(x + lookX * r * 0.35 - r * 0.16, y + lookY * r * 0.3 - r * 0.18, 0.16);
        return;
      case 'cat':
        ellipse(ctx, px, py, r * 0.62, r * 1.02, side * 0.18);
        ctx.fillStyle = INK;
        ctx.fill();
        highlight(hx + r * 0.05, hy, 0.24, 0.1);
        // Sharp upper lid.
        ctx.beginPath();
        ctx.moveTo(x - side * r * 0.95, y - r * 1.05);
        ctx.lineTo(x + side * r * 0.75, y - r * 0.7);
        stroke(ctx, LINE);
        return;
      case 'kind':
        ellipse(ctx, px, py + r * 0.1, r * 0.8, r * 0.82);
        ctx.fillStyle = INK;
        ctx.fill();
        highlight(hx, hy + r * 0.12, 0.28, 0.1);
        ctx.beginPath();
        ctx.arc(x, y - r * 0.15, r * 0.95, Math.PI * 1.15, Math.PI * 1.85);
        stroke(ctx, LINE);
        return;
      case 'sparkle':
        ellipse(ctx, px, py, r * 0.86, r * 1.06);
        ctx.fillStyle = INK;
        ctx.fill();
        // Anime eyes: a coloured lower half and a star highlight.
        ctx.save();
        ellipse(ctx, px, py, r * 0.86, r * 1.06);
        ctx.clip();
        ellipse(ctx, px, py + r * 0.75, r * 0.9, r * 0.6);
        ctx.fillStyle = ctx.__iris || '#5fb3ff';
        ctx.fill();
        ctx.restore();
        highlight(hx, hy, 0.3, 0.13);
        ctx.beginPath();
        const sx = hx + r * 0.55;
        const sy = hy + r * 0.05;
        ctx.moveTo(sx, sy - r * 0.2);
        ctx.lineTo(sx + r * 0.06, sy);
        ctx.lineTo(sx, sy + r * 0.2);
        ctx.lineTo(sx - r * 0.06, sy);
        ctx.fillStyle = '#fff';
        ctx.fill();
        return;
      case 'bead':
        ellipse(ctx, px, py + r * 0.1, r * 0.55, r * 0.62);
        ctx.fillStyle = INK;
        ctx.fill();
        highlight(px - r * 0.18, py - r * 0.12, 0.18);
        return;
      case 'fierce':
        ellipse(ctx, px, py, r * 0.8, r * 0.98);
        ctx.fillStyle = INK;
        ctx.fill();
        highlight(hx, hy + r * 0.1, 0.28, 0.11);
        // Flat, determined brow line cutting the top.
        ctx.beginPath();
        ctx.moveTo(x - r * 1.0, y - r * (side > 0 ? 1.0 : 0.62));
        ctx.lineTo(x + r * 1.0, y - r * (side > 0 ? 0.62 : 1.0));
        ctx.lineTo(x + r * 1.0, y - r * 1.4);
        ctx.lineTo(x - r * 1.0, y - r * 1.4);
        ctx.closePath();
        ctx.fillStyle = ctx.__lid || '#000';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - r * 1.0, y - r * (side > 0 ? 1.0 : 0.62));
        ctx.lineTo(x + r * 1.0, y - r * (side > 0 ? 0.62 : 1.0));
        stroke(ctx, LINE);
        return;
      default: {
        const rx = r * (wide ? 0.95 : 0.78);
        const ry = r * (wide ? 1.15 : 0.98);
        ellipse(ctx, px, py, rx, ry);
        ctx.fillStyle = INK;
        ctx.fill();
        highlight(hx, hy, wide ? 0.34 : 0.3, 0.12);
      }
    }
  }

  function mouth(ctx, x, y, s, kind, t) {
    ctx.save();
    switch (kind) {
      case 'open':
        ellipse(ctx, x, y + s * 0.5, s * 0.55, s * 0.6);
        fillStroke(ctx, '#7a2f45', LINE - 0.4);
        break;
      case 'grin':
        ctx.beginPath();
        ctx.moveTo(x - s * 1.1, y);
        ctx.quadraticCurveTo(x, y + s * 2.2, x + s * 1.1, y);
        ctx.closePath();
        fillStroke(ctx, '#7a2f45', LINE - 0.4);
        ctx.beginPath();
        ctx.ellipse(x, y + s * 0.95, s * 0.5, s * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ff8fa3';
        ctx.fill();
        break;
      case 'chew': {
        const o = (Math.sin(t * 14) + 1) / 2;
        ellipse(ctx, x, y + s * 0.4, s * 0.6, s * (0.15 + o * 0.5));
        fillStroke(ctx, '#7a2f45', LINE - 0.4);
        break;
      }
      case 'wobble':
        ctx.beginPath();
        ctx.moveTo(x - s, y + s * 0.3);
        for (let i = 1; i <= 4; i++) ctx.lineTo(x - s + (i * s) / 2, y + s * 0.3 + (i % 2 ? -s * 0.3 : s * 0.3));
        stroke(ctx, LINE - 0.4);
        break;
      case 'flat':
        ctx.beginPath();
        ctx.moveTo(x - s * 0.5, y + s * 0.3);
        ctx.lineTo(x + s * 0.5, y + s * 0.3);
        stroke(ctx, LINE - 0.4);
        break;
      default:
        ctx.beginPath();
        ctx.arc(x - s * 0.45, y, s * 0.45, Math.PI * 0.1, Math.PI * 0.9);
        ctx.moveTo(x + s * 0.9, y);
        ctx.arc(x + s * 0.45, y, s * 0.45, Math.PI * 0.1, Math.PI * 0.9);
        stroke(ctx, LINE - 0.4);
    }
    ctx.restore();
  }

  function face(ctx, R, cy, pal, a, t) {
    const ey = cy - R * 0.12;
    const ex = R * 0.36;
    const er = R * 0.17;
    ctx.__lid = pal.body;
    ctx.__iris = pal.glow;
    // Cheeks (rosier when happy or petted).
    const blush = a.eyes === 'happy' || a.mouth === 'grin' ? 0.8 : 0.55;
    ctx.globalAlpha = blush;
    ellipse(ctx, -ex - R * 0.16, ey + R * 0.26, R * 0.13, R * 0.08);
    ctx.fillStyle = '#ff7f9f';
    ctx.fill();
    ellipse(ctx, ex + R * 0.16, ey + R * 0.26, R * 0.13, R * 0.08);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.__eyeStyle = ctx.__eyeStyleL;
    eye(ctx, -ex, ey, er, a.eyes === 'wink' ? 'open' : a.eyes, a.lookX, a.lookY, 1);
    ctx.__eyeStyle = ctx.__eyeStyleR;
    eye(ctx, ex, ey, er, a.eyes === 'wink' ? 'happy' : a.eyes, a.lookX, a.lookY, -1);
    mouth(ctx, a.lookX * R * 0.05, ey + R * 0.24, R * 0.09, a.mouth, t);
    brows(ctx, ex, ey, er, a.brows);
  }

  // Eyebrows carry most of the emotion in a small face.
  function brows(ctx, ex, ey, er, kind) {
    if (!kind) return;
    for (const side of [-1, 1]) {
      const x = side * ex;
      const y = ey - er * 1.75;
      ctx.beginPath();
      if (kind === 'worried') {
        ctx.moveTo(x - side * er * 0.8, y + er * 0.05);
        ctx.lineTo(x + side * er * 0.7, y - er * 0.45);
      } else if (kind === 'up') {
        ctx.moveTo(x - er * 0.75, y - er * 0.1);
        ctx.quadraticCurveTo(x, y - er * 0.7, x + er * 0.75, y - er * 0.1);
      } else if (kind === 'determined') {
        ctx.moveTo(x - side * er * 0.8, y - er * 0.4);
        ctx.lineTo(x + side * er * 0.7, y + er * 0.12);
      }
      stroke(ctx, LINE);
    }
  }

  // --- lineage features --------------------------------------------------------

  const stageN = (stage) => ({ juvenile: 1, adult: 2, mythic: 3 })[stage] || 0;

  function backFeatures(ctx, spec, R, cy, pal, t) {
    const n = stageN(spec.stage);
    switch (spec.lineage) {
      case 'test': {
        // Shell on the back, bigger each stage.
        const w = R * (1.0 + n * 0.08);
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, cy - R * 0.05, w, R * (0.92 + n * 0.05), 0, Math.PI, 0);
        ctx.lineTo(w, cy + R * 0.15);
        ctx.lineTo(-w, cy + R * 0.15);
        ctx.closePath();
        fillStroke(ctx, pal.accent);
        ctx.clip();
        ctx.globalAlpha = 0.35;
        for (let i = -2; i <= 2; i++) {
          hex(ctx, i * R * 0.42, cy - R * 0.55 + (i % 2 ? R * 0.3 : 0), R * 0.2);
          ctx.strokeStyle = '#d8ffc9';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'roam': {
        // Wings, flapping.
        const flap = Math.sin(t * (spec.pose === 'working' ? 10 : 3)) * 0.18;
        const span = R * (0.5 + n * 0.22);
        for (const side of [-1, 1]) {
          ctx.save();
          ctx.translate(side * R * 0.75, cy - R * 0.2);
          ctx.rotate(side * (-0.5 + flap));
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(side * span, -span * 0.9, side * span * 1.2, -span * 0.2);
          ctx.quadraticCurveTo(side * span * 0.7, span * 0.1, side * span * 0.9, span * 0.35);
          ctx.quadraticCurveTo(side * span * 0.4, span * 0.25, 0, span * 0.2);
          ctx.closePath();
          fillStroke(ctx, pal.accent);
          ctx.restore();
        }
        break;
      }
      case 'shell':
        if (n >= 2) {
          // Pincers that snap open and shut.
          for (const side of [-1, 1]) {
            const open = 0.35 + Math.max(0, Math.sin(t * 4 + side)) * 0.3;
            ctx.save();
            ctx.translate(side * R * 1.25, cy - R * 0.35);
            ctx.scale(side, 1);
            for (const jaw of [-1, 1]) {
              ctx.save();
              ctx.rotate(jaw * open - 0.3);
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.quadraticCurveTo(R * 0.12, jaw * R * 0.3, R * 0.42, jaw * R * 0.08);
              ctx.quadraticCurveTo(R * 0.2, jaw * R * 0.05, 0, 0);
              fillStroke(ctx, pal.dark, LINE - 0.4);
              ctx.restore();
            }
            ellipse(ctx, 0, 0, R * 0.12, R * 0.12);
            fillStroke(ctx, pal.dark, LINE - 0.4);
            ctx.restore();
          }
        }
        break;
      case 'lore':
        if (n >= 2) {
          // Scroll tail.
          ctx.beginPath();
          ctx.moveTo(R * 0.6, cy + R * 0.5);
          ctx.quadraticCurveTo(R * 1.5, cy + R * 0.6, R * 1.3, cy - R * 0.2);
          ctx.arc(R * 1.15, cy - R * 0.2, R * 0.15, 0, Math.PI * 1.6);
          stroke(ctx, LINE + 5);
          ctx.strokeStyle = pal.dark;
          ctx.lineWidth = LINE + 1;
          ctx.stroke();
        }
        break;
      default:
        break;
    }
  }

  // Grown-up features drawn behind the body: tails, legs, buddies, rings.
  function grownFeatures(ctx, spec, R, cy, w, hb, pal, t) {
    const n = stageN(spec.stage);
    if (n < 2) return;
    switch (spec.lineage) {
      case 'craft': {
        // Spade tail, wagging.
        const wag = Math.sin(t * 3) * 0.15;
        ctx.save();
        ctx.translate(-w * 0.75, cy + hb * 0.55);
        ctx.rotate(-0.6 + wag);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-R * 0.45, -R * 0.1, -R * 0.62, -R * 0.42);
        stroke(ctx, LINE + 5);
        ctx.strokeStyle = pal.dark;
        ctx.lineWidth = LINE + 1;
        ctx.stroke();
        ctx.translate(-R * 0.62, -R * 0.42);
        ctx.beginPath();
        ctx.moveTo(0, -R * 0.22);
        ctx.quadraticCurveTo(R * 0.2, -R * 0.02, 0, R * 0.08);
        ctx.quadraticCurveTo(-R * 0.2, -R * 0.02, 0, -R * 0.22);
        fillStroke(ctx, pal.accent, LINE - 0.4);
        ctx.restore();
        break;
      }
      case 'roam': {
        // Fish tail fin.
        const flick = Math.sin(t * 4) * 0.2;
        ctx.save();
        ctx.translate(-w * 0.8, cy + hb * 0.35);
        ctx.rotate(0.5 + flick);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-R * 0.35, -R * 0.35, -R * 0.55, -R * 0.42);
        ctx.quadraticCurveTo(-R * 0.4, -R * 0.05, -R * 0.58, R * 0.28);
        ctx.quadraticCurveTo(-R * 0.3, R * 0.2, 0, 0);
        fillStroke(ctx, pal.dark, LINE - 0.4);
        ctx.restore();
        break;
      }
      case 'shell':
        // Crab legs.
        for (const side of [-1, 1]) {
          for (let i = 0; i < 3; i++) {
            const step = Math.sin(t * 8 + i * 1.7 + side) * R * 0.04;
            ctx.beginPath();
            ctx.moveTo(side * w * (0.55 + i * 0.13), cy + hb * 0.5);
            ctx.quadraticCurveTo(side * w * (0.85 + i * 0.12), cy + hb * 0.6 + step, side * w * (0.9 + i * 0.13), -R * 0.02);
            stroke(ctx, LINE + 3.5);
            ctx.strokeStyle = pal.dark;
            ctx.lineWidth = LINE;
            ctx.stroke();
          }
        }
        break;
      case 'swarm': {
        // Buddies clinging to the hive, more at Mythic.
        const spots = n >= 3 ? [[-1.35, 0.55], [1.35, 0.55], [-1.25, -0.9], [1.25, -0.9]] : [[-1.3, 0.6], [1.3, 0.6]];
        spots.forEach(([fx, fy], i) => {
          const bob = Math.sin(t * 3 + i * 1.3) * R * 0.05;
          const bx = fx * w;
          const by = cy + fy * R + bob;
          const s = R * 0.3;
          ellipse(ctx, bx, by, s, s * 0.9);
          fillStroke(ctx, pal.body, LINE - 0.4);
          ellipse(ctx, bx - s * 0.3, by - s * 0.05, s * 0.11, s * 0.15);
          ctx.fillStyle = INK;
          ctx.fill();
          ellipse(ctx, bx + s * 0.3, by - s * 0.05, s * 0.11, s * 0.15);
          ctx.fill();
        });
        break;
      }
      case 'test':
        if (n >= 3) {
          // Golden ring of shield arcs.
          ctx.save();
          ctx.translate(0, cy - R * 0.1);
          ctx.rotate(t * 0.6);
          for (let i = 0; i < 6; i++) {
            ctx.rotate(Math.PI / 3);
            ctx.beginPath();
            ctx.arc(0, 0, R * 1.45, -0.32, 0.32);
            stroke(ctx, LINE + 6);
            ctx.strokeStyle = pal.extra || '#f4d35e';
            ctx.lineWidth = LINE + 1.5;
            ctx.stroke();
          }
          ctx.restore();
        }
        break;
      default:
        break;
    }
  }

  // The shine every shiny wears (from the designer's shiny boards): a soft
  // golden glow with a dotted ring behind the creature, and four-point stars
  // and dots around it that twinkle one after another. Positions are the
  // designer's, relative to the glow's centre and radius.
  const SHINE_STARS = [[-0.81, -0.77, 0.117, 0], [0.81, -0.89, 0.085, 1], [0.94, -0.06, 0.106, 2], [-0.94, 0.13, 0.074, 3], [0.7, 0.7, 0.096, 1], [-0.7, 0.74, 0.064, 2]];
  const SHINE_DOTS = [[0, -1.1, 0.027, 0], [0.53, -0.55, 0.021, 3], [-0.98, -0.43, 0.021, 1]];
  function shine(ctx, x, y, r, t, layer) {
    const k = r / 94;
    const pulse = (d) => 0.45 + 0.55 * Math.max(0, Math.sin(t * 2.2 - d * 1.6));
    ctx.save();
    ctx.translate(x, y);
    // Shiny is the sparkle alone: no glow disc or ring behind the creature.
    if (layer === 'back') {
      ctx.restore();
      return;
    }
    for (const [sx, sy, size, d] of SHINE_STARS) {
      const p = pulse(d);
      const s = r * size * (0.75 + 0.25 * p);
      const px = sx * r;
      const py = sy * r;
      ctx.globalAlpha = p;
      ctx.beginPath();
      ctx.moveTo(px, py - s);
      ctx.quadraticCurveTo(px, py, px + s, py);
      ctx.quadraticCurveTo(px, py, px, py + s);
      ctx.quadraticCurveTo(px, py, px - s, py);
      ctx.quadraticCurveTo(px, py, px, py - s);
      ctx.fillStyle = '#fffbe0';
      ctx.fill();
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1, 2 * k);
      ctx.strokeStyle = '#e9a92a';
      ctx.stroke();
    }
    for (const [dx, dy, size, d] of SHINE_DOTS) {
      ctx.globalAlpha = pulse(d);
      ctx.beginPath();
      ctx.arc(dx * r, dy * r, Math.max(1, r * size), 0, Math.PI * 2);
      ctx.fillStyle = '#ffd166';
      ctx.fill();
    }
    ctx.restore();
  }


  function hex(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }

  function headFeatures(ctx, spec, R, top, pal, t) {
    const n = stageN(spec.stage);
    if (spec.stage === 'sprout') {
      // Leaf sprout.
      const sway = Math.sin(t * 2) * 0.15;
      ctx.save();
      ctx.translate(0, top + 2);
      ctx.rotate(sway);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -R * 0.35);
      stroke(ctx);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, -R * 0.32);
        ctx.quadraticCurveTo(side * R * 0.35, -R * 0.62, side * R * 0.42, -R * 0.3);
        ctx.quadraticCurveTo(side * R * 0.2, -R * 0.22, 0, -R * 0.32);
        fillStroke(ctx, pal.accent);
      }
      ctx.restore();
      return;
    }
    switch (spec.lineage) {
      case 'craft': {
        // Little horns, longer each stage.
        const h = R * (0.22 + n * 0.08);
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(side * R * 0.32, top + R * 0.12);
          ctx.quadraticCurveTo(side * R * 0.42, top - h, side * R * 0.62, top - h * 0.9);
          ctx.quadraticCurveTo(side * R * 0.58, top + R * 0.05, side * R * 0.56, top + R * 0.2);
          ctx.closePath();
          fillStroke(ctx, pal.accent);
        }
        if (n >= 2) goggles(ctx, R, top + R * 0.3, pal);
        if (n >= 3) ember(ctx, R, top, pal, t);
        break;
      }
      case 'lore':
        // Owl tufts.
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(side * R * 0.2, top + R * 0.1);
          ctx.lineTo(side * R * (0.55 + n * 0.05), top - R * (0.25 + n * 0.08));
          ctx.lineTo(side * R * 0.68, top + R * 0.3);
          ctx.closePath();
          fillStroke(ctx, pal.dark);
        }
        if (n >= 3) {
          // Third eye.
          ellipse(ctx, 0, top + R * 0.32, R * 0.1, R * 0.13);
          fillStroke(ctx, pal.accent, LINE - 0.6);
          ellipse(ctx, 0, top + R * 0.33, R * 0.04, R * 0.07);
          ctx.fillStyle = INK;
          ctx.fill();
        }
        break;
      case 'shell': {
        // Antenna with a spark bulb.
        const count = n >= 3 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const side = count === 1 ? 0 : i ? 1 : -1;
          const bx = side * R * 0.35 + Math.sin(t * 3 + i) * R * 0.05;
          const by = top - R * (0.45 + n * 0.06);
          ctx.beginPath();
          ctx.moveTo(side * R * 0.2, top + 3);
          ctx.quadraticCurveTo(side * R * 0.3 - R * 0.1, top - R * 0.2, bx, by);
          stroke(ctx);
          const pulse = 0.6 + Math.sin(t * 8 + i) * 0.4;
          ctx.save();
          ctx.globalAlpha = 0.45 * pulse;
          ellipse(ctx, bx, by, R * 0.2, R * 0.2);
          ctx.fillStyle = pal.accent;
          ctx.fill();
          ctx.restore();
          ellipse(ctx, bx, by, R * 0.1, R * 0.1);
          fillStroke(ctx, pal.accent, LINE - 0.4);
        }
        break;
      }
      case 'test':
        // Small crest.
        ctx.beginPath();
        ctx.moveTo(-R * 0.18, top + R * 0.08);
        ctx.quadraticCurveTo(0, top - R * (0.25 + n * 0.08), R * 0.18, top + R * 0.08);
        fillStroke(ctx, pal.dark);
        break;
      case 'roam':
        // Tuft swept by the wind.
        ctx.beginPath();
        ctx.moveTo(-R * 0.05, top + R * 0.05);
        ctx.quadraticCurveTo(R * 0.25, top - R * 0.4, R * 0.55, top - R * 0.2);
        ctx.quadraticCurveTo(R * 0.25, top - R * 0.1, R * 0.2, top + R * 0.1);
        fillStroke(ctx, pal.belly);
        break;
      case 'swarm': {
        // Bobble antennae, one more each stage.
        const count = n + 1;
        for (let i = 0; i < count; i++) {
          const f = count === 1 ? 0 : i / (count - 1) - 0.5;
          const bx = f * R * 1.1;
          const by = top - R * 0.35 - Math.abs(Math.sin(t * 4 + i)) * R * 0.06;
          ctx.beginPath();
          ctx.moveTo(f * R * 0.6, top + 4);
          ctx.lineTo(bx, by);
          stroke(ctx);
          ellipse(ctx, bx, by, R * 0.09, R * 0.09);
          fillStroke(ctx, pal.accent, LINE - 0.4);
        }
        break;
      }
      default:
        break;
    }
  }

  function goggles(ctx, R, y, pal) {
    ctx.beginPath();
    ctx.moveTo(-R * 0.95, y + 2);
    ctx.lineTo(R * 0.95, y + 2);
    stroke(ctx, LINE + 3);
    ctx.strokeStyle = '#5a3a2c';
    ctx.lineWidth = LINE;
    ctx.stroke();
    for (const side of [-1, 1]) {
      ellipse(ctx, side * R * 0.3, y, R * 0.18, R * 0.15);
      fillStroke(ctx, pal.extra);
      ellipse(ctx, side * R * 0.3 - R * 0.05, y - R * 0.04, R * 0.06, R * 0.04);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }

  function ember(ctx, R, top, pal, t) {
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * R * 0.28;
      const h = R * (0.28 + Math.sin(t * 9 + i * 2) * 0.06);
      ctx.beginPath();
      ctx.moveTo(x - R * 0.1, top - R * 0.02);
      ctx.quadraticCurveTo(x - R * 0.08, top - h * 0.7, x, top - h);
      ctx.quadraticCurveTo(x + R * 0.08, top - h * 0.7, x + R * 0.1, top - R * 0.02);
      ctx.closePath();
      ctx.fillStyle = i === 1 ? '#ffe066' : pal.glow;
      ctx.fill();
    }
  }

  // Second-best stat, shown from Adult on.
  function trait(ctx, spec, R, cy, top, pal, t) {
    if (!spec.trait || stageN(spec.stage) < 2) return;
    const tp = PALETTES[spec.trait];
    switch (spec.trait) {
      case 'lore':
        // Round glasses.
        for (const side of [-1, 1]) {
          ellipse(ctx, side * R * 0.36, cy - R * 0.12, R * 0.22, R * 0.22);
          stroke(ctx, LINE);
        }
        ctx.beginPath();
        ctx.moveTo(-R * 0.14, cy - R * 0.14);
        ctx.lineTo(R * 0.14, cy - R * 0.14);
        stroke(ctx, LINE);
        break;
      case 'roam':
        // Scarf.
        ctx.beginPath();
        ctx.moveTo(-R * 0.8, cy + R * 0.32);
        ctx.quadraticCurveTo(0, cy + R * 0.55, R * 0.8, cy + R * 0.32);
        ctx.lineTo(R * 0.78, cy + R * 0.5);
        ctx.quadraticCurveTo(0, cy + R * 0.72, -R * 0.78, cy + R * 0.5);
        ctx.closePath();
        fillStroke(ctx, tp.extra);
        ctx.beginPath();
        ctx.moveTo(R * 0.45, cy + R * 0.55);
        ctx.quadraticCurveTo(R * 0.75 + Math.sin(t * 5) * R * 0.08, cy + R * 0.85, R * 0.95, cy + R * 0.8);
        ctx.lineTo(R * 0.7, cy + R * 0.55);
        ctx.closePath();
        fillStroke(ctx, tp.extra);
        break;
      case 'test':
        // Shield badge.
        badge(ctx, R * 0.55, cy + R * 0.35, R * 0.2, tp.body, (c, s) => {
          c.beginPath();
          c.moveTo(-s * 0.4, 0);
          c.lineTo(-s * 0.1, s * 0.3);
          c.lineTo(s * 0.45, -s * 0.35);
          stroke(c, LINE - 0.6);
        });
        break;
      case 'craft':
        // Wrench badge.
        badge(ctx, R * 0.55, cy + R * 0.35, R * 0.2, tp.body, (c, s) => {
          c.beginPath();
          c.moveTo(-s * 0.35, s * 0.35);
          c.lineTo(s * 0.25, -s * 0.25);
          stroke(c, LINE);
          ellipse(c, s * 0.3, -s * 0.3, s * 0.18, s * 0.18);
          stroke(c, LINE - 0.6);
        });
        break;
      case 'shell':
        // Tiny lightning mark on the cheek.
        ctx.beginPath();
        ctx.moveTo(R * 0.72, cy - R * 0.45);
        ctx.lineTo(R * 0.6, cy - R * 0.28);
        ctx.lineTo(R * 0.74, cy - R * 0.28);
        ctx.lineTo(R * 0.62, cy - R * 0.1);
        stroke(ctx, LINE + 2);
        ctx.strokeStyle = tp.accent;
        ctx.lineWidth = LINE - 0.6;
        ctx.stroke();
        break;
      case 'swarm': {
        // A buddy mote circling.
        const a = t * 1.8;
        const x = Math.cos(a) * R * 1.25;
        const y = cy - R * 0.4 + Math.sin(a) * R * 0.35;
        ellipse(ctx, x, y, R * 0.12, R * 0.12);
        fillStroke(ctx, tp.accent, LINE - 0.6);
        break;
      }
      default:
        break;
    }
  }

  function badge(ctx, x, y, s, fill, inner) {
    ctx.save();
    ctx.translate(x, y);
    ellipse(ctx, 0, 0, s, s);
    fillStroke(ctx, fill, LINE - 0.4);
    inner(ctx, s);
    ctx.restore();
  }

  // --- auras and props ---------------------------------------------------------

  function aura(ctx, spec, R, cy, pal, t, strength) {
    if (strength <= 0) return;
    ctx.save();
    const g = ctx.createRadialGradient(0, cy, R * 0.5, 0, cy, R * 1.9);
    g.addColorStop(0, pal.glow);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = strength * (0.55 + Math.sin(t * 2) * 0.15);
    ctx.fillStyle = g;
    ellipse(ctx, 0, cy, R * 1.9, R * 1.9);
    ctx.fill();
    ctx.restore();
    if (spec.stage !== 'mythic') return;
    // Orbiting runes, one glyph per lineage.
    const glyph = { craft: '⚒', lore: '✦', shell: '</>', test: '✓', roam: '✧', swarm: '•', chimera: '∞' }[spec.lineage] || '✦';
    ctx.save();
    ctx.font = `bold ${Math.round(R * 0.28)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) {
      const a = t * 0.9 + (i * Math.PI * 2) / 3;
      const x = Math.cos(a) * R * 1.45;
      const y = cy - R * 0.2 + Math.sin(a) * R * 0.45;
      ctx.globalAlpha = 0.55 + 0.45 * ((Math.sin(a) + 1) / 2);
      ctx.fillStyle = INK;
      ctx.fillText(glyph, x + 1.2, y + 1.2);
      ctx.fillStyle = pal.glow;
      ctx.fillText(glyph, x, y);
    }
    ctx.restore();
  }

  function prop(ctx, kind, R, cy, pal, t) {
    ctx.save();
    switch (kind) {
      case 'hammer': {
        // Swings down onto a little anvil beside the pet, never over its face.
        const swing = Math.max(0, Math.sin(t * 9));
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(R * 1.05, -R * 0.26, R * 0.5, R * 0.2, 3);
        fillStroke(ctx, '#6b7385', LINE - 0.6);
        ctx.beginPath();
        ctx.rect(R * 1.2, -R * 0.08, R * 0.2, R * 0.08);
        fillStroke(ctx, '#6b7385', LINE - 0.6);
        ctx.restore();
        ctx.translate(R * 0.9, cy + R * 0.3);
        ctx.rotate(0.2 + swing * 1.9);
        ctx.beginPath();
        ctx.rect(-R * 0.05, -R * 0.75, R * 0.1, R * 0.75);
        fillStroke(ctx, '#a0714f', LINE - 0.6);
        ctx.beginPath();
        ctx.roundRect(-R * 0.24, -R * 0.92, R * 0.48, R * 0.24, 4);
        fillStroke(ctx, '#9aa3b5', LINE - 0.6);
        break;
      }
      case 'book': {
        const page = Math.sin(t * 2.4) * 0.1;
        ctx.translate(0, cy + R * 0.42);
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(side * R * 0.3, -R * (0.12 + (side > 0 ? page : 0)), side * R * 0.58, -R * 0.05);
          ctx.lineTo(side * R * 0.58, R * 0.32);
          ctx.quadraticCurveTo(side * R * 0.3, R * 0.22, 0, R * 0.35);
          ctx.closePath();
          fillStroke(ctx, '#fffaf0', LINE - 0.6);
          ctx.globalAlpha = 0.4;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(side * R * 0.1, R * (0.06 + i * 0.08));
            ctx.lineTo(side * R * 0.46, R * (0.04 + i * 0.08));
            stroke(ctx, 1.4);
          }
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'terminal': {
        ctx.translate(0, cy + R * 0.52);
        ctx.beginPath();
        ctx.roundRect(-R * 0.62, -R * 0.36, R * 1.24, R * 0.58, 6);
        fillStroke(ctx, '#1b1530', LINE - 0.6);
        ctx.font = `bold ${Math.round(R * 0.2)}px ui-monospace, monospace`;
        ctx.fillStyle = '#7dffb0';
        ctx.textBaseline = 'middle';
        const lines = Math.floor(t * 3) % 4;
        for (let i = 0; i < Math.min(lines, 2); i++) ctx.fillRect(-R * 0.5, -R * 0.24 + i * R * 0.14, R * (0.3 + ((i * 37) % 5) * 0.12), R * 0.06);
        ctx.fillText('>', -R * 0.52, -R * 0.24 + Math.min(lines, 2) * R * 0.14 + R * 0.03);
        if (Math.floor(t * 4) % 2) ctx.fillRect(-R * 0.36, -R * 0.24 + Math.min(lines, 2) * R * 0.14 - R * 0.02, R * 0.1, R * 0.1);
        break;
      }
      case 'shield': {
        ctx.translate(-R * 0.7, cy + R * 0.25);
        ctx.rotate(-0.15);
        ctx.beginPath();
        ctx.moveTo(0, -R * 0.42);
        ctx.quadraticCurveTo(R * 0.36, -R * 0.38, R * 0.38, -R * 0.3);
        ctx.quadraticCurveTo(R * 0.38, R * 0.2, 0, R * 0.42);
        ctx.quadraticCurveTo(-R * 0.38, R * 0.2, -R * 0.38, -R * 0.3);
        ctx.quadraticCurveTo(-R * 0.36, -R * 0.38, 0, -R * 0.42);
        fillStroke(ctx, ctx.__shield || '#9aa3b5', LINE - 0.4);
        ctx.beginPath();
        ctx.moveTo(-R * 0.15, 0);
        ctx.lineTo(-R * 0.03, R * 0.13);
        ctx.lineTo(R * 0.18, -R * 0.14);
        stroke(ctx, LINE);
        break;
      }
      case 'spyglass': {
        ctx.translate(R * 0.55, cy - R * 0.2);
        ctx.rotate(-0.5 + Math.sin(t * 1.5) * 0.15);
        ctx.beginPath();
        ctx.roundRect(0, -R * 0.1, R * 0.7, R * 0.2, 4);
        fillStroke(ctx, '#c9a227', LINE - 0.6);
        ctx.beginPath();
        ctx.roundRect(R * 0.62, -R * 0.14, R * 0.24, R * 0.28, 4);
        fillStroke(ctx, '#a6801a', LINE - 0.6);
        break;
      }
      case 'thought': {
        ctx.translate(R * 0.85, cy - R * 1.1);
        ellipse(ctx, 0, 0, R * 0.42, R * 0.28);
        fillStroke(ctx, '#fff', LINE - 0.6);
        ellipse(ctx, -R * 0.38, R * 0.36, R * 0.08, R * 0.08);
        fillStroke(ctx, '#fff', LINE - 0.8);
        ctx.fillStyle = INK;
        for (let i = 0; i < 3; i++) {
          const up = Math.max(0, Math.sin(t * 6 - i * 0.8)) * R * 0.06;
          ellipse(ctx, (i - 1) * R * 0.16, -up, R * 0.045, R * 0.045);
          ctx.fill();
        }
        break;
      }
      case 'crumbs':
        for (let i = 0; i < 4; i++) {
          const p = (t * 1.5 + i * 0.25) % 1;
          ctx.globalAlpha = 1 - p;
          ctx.fillStyle = ['#7dffb0', '#ffd166', '#9381f2', '#ff80b8'][i];
          ctx.fillRect((i - 1.5) * R * 0.15, cy + R * 0.2 + p * R * 0.6, R * 0.07, R * 0.07);
        }
        break;
      case 'sign': {
        const wave = Math.sin(t * 10) * 0.12;
        ctx.translate(R * 0.95, cy - R * 0.1);
        ctx.rotate(wave);
        ctx.beginPath();
        ctx.moveTo(0, R * 0.5);
        ctx.lineTo(0, -R * 0.75);
        stroke(ctx, LINE + 1);
        ctx.beginPath();
        ctx.roundRect(-R * 0.32, -R * 1.25, R * 0.64, R * 0.55, 6);
        fillStroke(ctx, '#ffe156', LINE);
        ctx.fillStyle = INK;
        ctx.font = `900 ${Math.round(R * 0.48)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, -R * 0.96);
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }

  function motes(ctx, count, R, cy, pal, t) {
    for (let i = 0; i < count; i++) {
      const a = t * 2.4 + (i * Math.PI * 2) / count;
      const x = Math.cos(a) * R * 1.35;
      const y = cy - R * 0.1 + Math.sin(a) * R * 0.5;
      const s = R * 0.16;
      ellipse(ctx, x, y, s, s * 0.9);
      fillStroke(ctx, PALETTES.swarm.body, LINE - 0.6);
      ellipse(ctx, x - s * 0.3, y - s * 0.1, s * 0.12, s * 0.16);
      ctx.fillStyle = INK;
      ctx.fill();
      ellipse(ctx, x + s * 0.3, y - s * 0.1, s * 0.12, s * 0.16);
      ctx.fill();
    }
  }

  // --- the egg -----------------------------------------------------------------

  function drawEgg(ctx, spec, R, a, t) {
    const pal = PALETTES.egg;
    const h = R * 1.25;
    const cy = -h;
    ctx.save();
    ctx.translate(a.shake, 0);
    ctx.rotate(a.tilt);
    ctx.beginPath();
    ctx.moveTo(0, cy - h);
    ctx.bezierCurveTo(R * 0.95, cy - h, R * 1.05, cy + h * 0.55, 0, cy + h);
    ctx.bezierCurveTo(-R * 1.05, cy + h * 0.55, -R * 0.95, cy - h, 0, cy - h);
    ctx.closePath();
    fillStroke(ctx, pal.body);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = pal.accent;
    for (const [x, y, r] of [[-0.45, -0.3, 0.2], [0.35, -0.65, 0.14], [0.4, 0.25, 0.24], [-0.2, 0.55, 0.13], [-0.05, -0.85, 0.1]]) {
      ellipse(ctx, x * R, cy + y * h, r * R, r * R * 0.85);
      ctx.fill();
    }
    ctx.globalAlpha = 0.5;
    ellipse(ctx, -R * 0.35, cy - h * 0.45, R * 0.15, R * 0.3, -0.4);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
    // Cracks grow as hatching gets close.
    const crack = a.crack || 0;
    if (crack > 0.15) {
      ctx.beginPath();
      const pts = [[-0.62, -0.42], [-0.38, -0.6], [-0.18, -0.38], [0.06, -0.58], [0.28, -0.36], [0.5, -0.55], [0.64, -0.4]];
      const used = Math.max(2, Math.round(pts.length * Math.min(1, crack)));
      pts.slice(0, used).forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x * R, cy + y * h));
      stroke(ctx, LINE);
    }
    // Peeking eyes when something happens.
    if (a.eyes === 'wide' || a.eyes === 'happy' || crack > 0.7) {
      // Eyes peeking through the crack.
      const kind = a.eyes === 'happy' ? 'happy' : 'open';
      eye(ctx, -R * 0.26, cy - h * 0.14, R * 0.13, kind, a.lookX, 0, 1);
      eye(ctx, R * 0.26, cy - h * 0.14, R * 0.13, kind, a.lookX, 0, -1);
    }
    ctx.restore();
  }

  // --- art packs ---------------------------------------------------------------
  //
  // Images in ~/.openmon/art named after a form ("craft-adult.png"), with
  // optional ".shiny" and "@pose" parts ("craft-adult.shiny@sleep.png"),
  // replace the procedural body. Props, particles and motion still apply.

  // The pack's file list comes first; each image loads the first time a
  // draw asks for it, so a page fetches only the art it shows. Until then
  // get() returns null and the creature is drawn in code for a frame or two.
  const files = new Map(); // name -> file
  const sprites = new Map(); // name -> loaded Image, or null while loading
  let packInfo = null;
  let tints = { forms: {}, seasons: {} };

  function loadPack() {
    return fetch('/art/index.json')
      .then((r) => r.json())
      .then(({ files: list, pack, tints: t }) => {
        packInfo = pack;
        if (t) tints = { forms: t.forms || {}, seasons: t.seasons || {} };
        for (const file of list || []) files.set(file.replace(/.(png|svg|webp)$/, ''), file);
      })
      .catch(() => {});
  }

  const has = (name) => files.has(name);

  // A file that fails to load leaves the list, so the next draw falls back.
  function get(name) {
    if (sprites.has(name)) return sprites.get(name);
    const file = files.get(name);
    if (!file) return null;
    sprites.set(name, null);
    const img = new Image();
    img.onload = () => {
      if (file.endsWith('.svg')) img.__svg = `/art/${encodeURIComponent(file)}`;
      sprites.set(name, img);
    };
    img.onerror = () => files.delete(name);
    img.src = `/art/${encodeURIComponent(file)}`;
    return null;
  }

  const CLASSIC = ['craft', 'lore', 'shell', 'test', 'roam', 'swarm'];

  function spriteKey(spec) {
    if (spec.legend) return spec.legend;
    return spec.stage === 'egg' || spec.stage === 'sprout' || !spec.lineage ? spec.stage : `${spec.lineage}-${spec.stage}`;
  }

  // The colouring a pet wears, strongest first: night, shiny, the friendship
  // form, a Chimera's own pair of types.
  function colourOf(spec, key) {
    if (spec.nocturne) return 'night';
    if (spec.shiny) return 'shiny';
    if (spec.friend && (has(`${key}.friend`) || (tints.forms[key] || {}).friend)) return 'friend';
    if (key === 'chimera-adult' && Array.isArray(spec.chimera) && spec.chimera.length === 2) {
      const pair = [...spec.chimera].sort((a, b) => CLASSIC.indexOf(a) - CLASSIC.indexOf(b)).join('-');
      if (has(`${key}.${pair}`)) return pair;
    }
    return null;
  }

  // Returns { img, night, regional, tint }. A pose drawn only in normal
  // colours gets the variant's colours at draw time (tint), so shiny, night
  // and Chimera pets keep every pose.
  function spriteFor(spec) {
    const key = spriteKey(spec);
    const pose = spec.pose && spec.pose !== 'idle' ? `@${spec.pose}` : '';
    const v = colourOf(spec, key);
    // Choose by the file list, then load only the image chosen.
    const pick = (name, extra) => {
      const img = get(name);
      return img ? { img, night: false, ...extra } : null;
    };
    if (v) {
      const exact = `${key}.${v}${pose}`;
      if (has(exact)) return pick(exact, { night: v === 'night' });
      const tint = (tints.forms[key] || {})[v];
      if (pose && has(key + pose) && tint) return pick(key + pose, { night: v === 'night', tint: `form:${key}:${v}` });
      const still = `${key}.${v}`;
      if (has(still)) return pick(still, { night: v === 'night' });
      // A pack without night art: shiny colours if it has them, then the
      // normal image tinted at draw time.
      if (v === 'night' && spec.shiny) {
        const shiny = [`${key}.shiny${pose}`, `${key}.shiny`].find(has);
        if (shiny) return pick(shiny);
      }
    }
    const base = [key + pose, key].find(has);
    if (!base) return null;
    if (v === 'night' || v === 'shiny') return pick(base);
    // Regions and seasons recolour the normal colouring only.
    if (spec.region && !v) {
      const regional = [`${key}.region-${spec.region}${pose}`, !pose && `${key}.region-${spec.region}`].find((n) => n && has(n));
      if (regional) return pick(regional, { regional: true });
      return pick(base, { region: spec.region });
    }
    if (spec.season && !v && tints.seasons[spec.season] && spec.stage !== 'egg') return pick(base, { tint: `season:${spec.season}:${spec.legend ? '' : spec.lineage || 'sprout'}` });
    return pick(base);
  }

  // Nocturne for packs without night art: the sprite pulled toward midnight blue.
  const tintCanvas = document.createElement('canvas');
  function nightTint(img) {
    const w = img.naturalWidth || 512;
    const h = img.naturalHeight || 512;
    tintCanvas.width = w;
    tintCanvas.height = h;
    const c = tintCanvas.getContext('2d');
    c.clearRect(0, 0, w, h);
    c.drawImage(img, 0, 0, w, h);
    c.globalCompositeOperation = 'source-atop';
    c.globalAlpha = 0.38;
    c.fillStyle = '#2b2f6b';
    c.fillRect(0, 0, w, h);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    return tintCanvas;
  }

  // --- accessories ---------------------------------------------------------------
  // Hats and neckwear, drawn in the same ink style as the creatures. Where they
  // sit comes from each sprite's own outline: the top of the head (ignoring
  // thin antennae and side ears), the head's width, and a "neck" line lower
  // on the body for scarves and medals.
  const anchorCache = new WeakMap();
  const anchorCanvas = document.createElement('canvas');

  function spriteAnchor(img) {
    let found = anchorCache.get(img);
    if (found) return found;
    const eyes = img.__svg ? eyeVariants(img.__svg) : null;
    const eyeY = eyes && eyes.ready ? eyes.eyeY : null;
    const H = 160;
    const W = Math.max(16, Math.round((H * (img.naturalWidth || 1)) / Math.max(1, img.naturalHeight || 1)));
    anchorCanvas.width = W;
    anchorCanvas.height = H;
    const c = anchorCanvas.getContext('2d', { willReadFrequently: true });
    c.clearRect(0, 0, W, H);
    c.drawImage(img, 0, 0, W, H);
    let data;
    try {
      data = c.getImageData(0, 0, W, H).data;
    } catch {
      return null;
    }
    const solid = (x, y) => data[(y * W + x) * 4 + 3] > 128;
    const cx = Math.round(W / 2);
    const tops = [];
    for (let x = Math.round(W * 0.36); x <= Math.round(W * 0.64); x++) {
      for (let y = 0; y < H; y++) if (solid(x, y)) { tops.push(y); break; }
    }
    tops.sort((a, b) => a - b);
    const widthAt = (y) => {
      y = Math.max(0, Math.min(H - 1, Math.round(y)));
      if (!solid(cx, y)) return 0;
      let l = cx;
      let r = cx;
      while (l > 0 && (solid(l - 1, y) || solid(Math.max(0, l - 2), y))) l--;
      while (r < W - 1 && (solid(r + 1, y) || solid(Math.min(W - 1, r + 2), y))) r++;
      return r - l;
    };
    // The 70th percentile skips antennae, leaves and single spikes. When the
    // middle is still thin there (eye stalks, a floating symbol), the head
    // starts at the first row that is really wide.
    let top = tops.length ? tops[Math.floor(tops.length * 0.7)] : 0;
    if (widthAt(top + H * 0.03) < W * 0.18) {
      let y = top;
      while (y < H * 0.7 && widthAt(y) < W * 0.22) y++;
      if (y < H * 0.7) top = y;
    }
    let bottom = H - 1;
    while (bottom > top && !solid(cx, bottom)) bottom--;
    const body = bottom - top;
    const eye = eyeY != null ? eyeY * H : top + body * 0.45;
    // Head width just above the eyes; the neckwear between mouth and feet.
    const headRow = top + (eye - top) * 0.55;
    const neckRow = eye + (bottom - eye) * 0.7;
    found = {
      top: top / H,
      // Wide bodies (claws, swarms) would make giant hats.
      headW: Math.min(widthAt(headRow), H * 0.5) / H,
      neckY: neckRow / H,
      neckW: widthAt(neckRow) / H,
    };
    // Cache only once the eyes are known (or there is no SVG to read).
    if (!img.__svg || (eyes && eyes.ready)) anchorCache.set(img, found);
    return found;
  }

  function inked(ctx, fill, lw) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function pom(ctx, x, y, r, fill, lw) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    inked(ctx, fill, lw);
  }

  const HATS = {
    cap(ctx, S, y, lw) {
      const r = S * 0.36;
      ctx.beginPath();
      ctx.ellipse(0, y, r, r * 0.78, 0, Math.PI, 0);
      ctx.closePath();
      inked(ctx, '#e5484d', lw);
      ctx.beginPath();
      ctx.ellipse(0, y - r * 0.05, r * 0.42, r * 0.5, 0, Math.PI, 0);
      ctx.closePath();
      inked(ctx, '#fff', lw * 0.7);
      ctx.beginPath();
      ctx.ellipse(r * 0.62, y, r * 0.62, r * 0.17, 0, 0, Math.PI * 2);
      inked(ctx, '#b4232a', lw);
    },
    party(ctx, S, y, lw, t) {
      ctx.save();
      ctx.translate(0, y);
      ctx.rotate(0.18 + Math.sin(t * 2) * 0.03);
      const b = S * 0.22;
      const h = S * 0.6;
      ctx.beginPath();
      ctx.moveTo(-b, 0);
      ctx.lineTo(0, -h);
      ctx.lineTo(b, 0);
      ctx.quadraticCurveTo(0, b * 0.35, -b, 0);
      inked(ctx, '#7c6cf2', lw);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#ffe156';
      for (let i = 1; i < 4; i++) ctx.fillRect(-b, -h * (i / 4) - S * 0.03, b * 2, S * 0.05);
      ctx.restore();
      pom(ctx, 0, -h, S * 0.07, '#ff7fa3', lw * 0.8);
      ctx.restore();
    },
    beanie(ctx, S, y, lw) {
      const r = S * 0.38;
      ctx.beginPath();
      ctx.ellipse(0, y + r * 0.1, r, r * 0.85, 0, Math.PI, 0);
      ctx.closePath();
      inked(ctx, '#35d0bf', lw);
      ctx.beginPath();
      ctx.roundRect(-r * 1.04, y - r * 0.08, r * 2.08, r * 0.36, r * 0.12);
      inked(ctx, '#1f9d8f', lw);
      pom(ctx, 0, y - r * 0.85, S * 0.08, '#fff', lw * 0.8);
    },
    headphones(ctx, S, y, lw) {
      const R = S * 0.5;
      const cy = y + S * 0.38;
      ctx.beginPath();
      ctx.arc(0, cy, R, Math.PI * 1.08, Math.PI * 1.92);
      ctx.lineWidth = S * 0.09;
      ctx.strokeStyle = INK;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineWidth = S * 0.05;
      ctx.strokeStyle = '#5fb3ff';
      ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(side * R * 0.98, cy + S * 0.02, S * 0.09, S * 0.14, 0, 0, Math.PI * 2);
        inked(ctx, '#2a2140', lw);
        ctx.beginPath();
        ctx.ellipse(side * R * 0.98, cy + S * 0.02, S * 0.05, S * 0.09, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#5fb3ff';
        ctx.fill();
      }
    },
    flower(ctx, S, y, lw, t) {
      const x = S * 0.26;
      const fy = y + S * 0.06;
      const r = S * 0.07;
      ctx.save();
      ctx.translate(x, fy);
      ctx.rotate(Math.sin(t * 1.5) * 0.1);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2, r, 0, Math.PI * 2);
        inked(ctx, '#ffb3c8', lw * 0.7);
      }
      pom(ctx, 0, 0, r * 0.8, '#ffe156', lw * 0.7);
      ctx.restore();
    },
    nightcap(ctx, S, y, lw, t) {
      const r = S * 0.36;
      const sway = Math.sin(t * 1.2) * S * 0.03;
      ctx.beginPath();
      ctx.moveTo(-r, y + r * 0.15);
      ctx.quadraticCurveTo(-r * 0.8, y - r * 1.3, r * 0.4, y - r * 1.15);
      ctx.quadraticCurveTo(r * 1.4 + sway, y - r * 1.05, r * 1.55 + sway, y - r * 0.15);
      ctx.quadraticCurveTo(r * 1.1, y - r * 0.55, r, y + r * 0.15);
      ctx.closePath();
      inked(ctx, '#6f86d6', lw);
      ctx.beginPath();
      ctx.roundRect(-r * 1.06, y - r * 0.05, r * 2.12, r * 0.32, r * 0.14);
      inked(ctx, '#fff', lw);
      pom(ctx, r * 1.55 + sway, y - r * 0.1, S * 0.075, '#fff', lw * 0.8);
    },
    wizard(ctx, S, y, lw) {
      const r = S * 0.5;
      ctx.beginPath();
      ctx.ellipse(0, y + S * 0.04, r, r * 0.2, 0, 0, Math.PI * 2);
      inked(ctx, '#4b3cc4', lw);
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, y);
      ctx.quadraticCurveTo(-r * 0.2, y - r * 0.9, r * 0.25, y - r * 1.5);
      ctx.quadraticCurveTo(r * 0.15, y - r * 0.8, r * 0.55, y);
      ctx.closePath();
      inked(ctx, '#6a59e0', lw);
      ctx.fillStyle = '#ffe156';
      for (const [sx, sy, k] of [[-0.1, -0.45, 1], [0.15, -0.9, 0.7]]) {
        const cx = r * sx;
        const cy = y + r * sy;
        const s = S * 0.045 * k;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const rr = i % 2 ? s * 0.45 : s;
          ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      }
    },
    crown(ctx, S, y, lw, t) {
      const r = S * 0.3;
      const h = r * 0.8;
      ctx.beginPath();
      ctx.moveTo(-r, y + h * 0.15);
      ctx.lineTo(-r, y - h * 0.55);
      ctx.lineTo(-r * 0.5, y - h * 0.15);
      ctx.lineTo(0, y - h);
      ctx.lineTo(r * 0.5, y - h * 0.15);
      ctx.lineTo(r, y - h * 0.55);
      ctx.lineTo(r, y + h * 0.15);
      ctx.closePath();
      inked(ctx, '#ffd23f', lw);
      for (const [x, c] of [[-r * 0.55, '#e5484d'], [0, '#5fb3ff'], [r * 0.55, '#5ccf74']]) {
        ctx.beginPath();
        ctx.arc(x, y - h * 0.05, S * 0.035, 0, Math.PI * 2);
        inked(ctx, c, lw * 0.6);
      }
      // A glint now and then.
      const g = t % 3.5;
      if (g < 0.4) {
        ctx.save();
        ctx.globalAlpha = Math.sin((g / 0.4) * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-r * 0.7, y - h * 0.4, S * 0.03, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
  };

  const NECKWEAR = {
    scarf(ctx, S, y, w, lw, t) {
      const half = w * 0.46;
      ctx.beginPath();
      ctx.roundRect(-half, y - S * 0.07, half * 2, S * 0.14, S * 0.07);
      inked(ctx, '#e5484d', lw);
      ctx.save();
      ctx.translate(half * 0.45, y + S * 0.03);
      ctx.rotate(0.15 + Math.sin(t * 2) * 0.05);
      ctx.beginPath();
      ctx.roundRect(-S * 0.06, 0, S * 0.12, S * 0.24, S * 0.04);
      inked(ctx, '#e5484d', lw);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-S * 0.06, S * 0.16, S * 0.12, S * 0.03);
      ctx.restore();
    },
    bowtie(ctx, S, y, w, lw) {
      const s = S * 0.13;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(side * s * 1.4, y - s * 0.8);
        ctx.lineTo(side * s * 1.4, y + s * 0.8);
        ctx.closePath();
        inked(ctx, '#7c6cf2', lw);
      }
      pom(ctx, 0, y, s * 0.35, '#5a49c9', lw * 0.8);
    },
    bandana(ctx, S, y, w, lw) {
      const half = w * 0.44;
      ctx.beginPath();
      ctx.moveTo(-half, y - S * 0.04);
      ctx.lineTo(half, y - S * 0.04);
      ctx.lineTo(0, y + S * 0.22);
      ctx.closePath();
      inked(ctx, '#5fb3ff', lw);
      ctx.fillStyle = '#fff';
      for (const [x, yy] of [[-0.18, 0.02], [0.18, 0.02], [0, 0.11]]) {
        ctx.beginPath();
        ctx.arc(S * x, y + S * yy, S * 0.018, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    medal(ctx, S, y, w, lw, t) {
      ctx.beginPath();
      ctx.moveTo(-S * 0.1, y - S * 0.05);
      ctx.lineTo(0, y + S * 0.1);
      ctx.lineTo(S * 0.1, y - S * 0.05);
      ctx.lineWidth = S * 0.05;
      ctx.strokeStyle = '#e5484d';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, y + S * 0.16, S * 0.075, 0, Math.PI * 2);
      inked(ctx, '#ffd23f', lw);
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(t * 3) * 0.3;
      ctx.fillStyle = '#fff6c2';
      ctx.beginPath();
      ctx.arc(-S * 0.025, y + S * 0.14, S * 0.02, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };

  // The designer's accessories (public/wear/<id>.svg), each in its own
  // frame: a hat's base at 0,0 on a head 100 units wide, neckwear centred on
  // the neck line of a body 100 wide, glasses centred between two eyes 40
  // units apart. Loaded once; drawn when ready.
  const wearArt = new Map();
  function wearSvg(id) {
    let w = wearArt.get(id);
    if (w) return w.ready ? w : null;
    w = { ready: false };
    wearArt.set(id, w);
    fetch(`/wear/${encodeURIComponent(id)}.svg`)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((text) => {
        const vb = (/viewBox="([^"]+)"/.exec(text) || [])[1];
        if (!vb) return;
        const img = new Image();
        img.onload = () => Object.assign(w, { ready: true, img, vb: vb.trim().split(/[\s,]+/).map(Number) });
        img.src = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
      })
      .catch(() => {});
    return null;
  }
  function drawWearSvg(ctx, id, x, y, scale) {
    const w = wearSvg(id);
    if (!w) return;
    const [vx, vy, vw, vh] = w.vb;
    ctx.drawImage(w.img, x + vx * scale, y + vy * scale, vw * scale, vh * scale);
  }

  // A = { topY, headW, neckY, neckW, face: { x, y, span } } in the creature's
  // local coordinates.
  function drawWear(ctx, wear, A, t) {
    if (!wear || !A) return;
    const S = Math.max(10, A.headW) * 1.25;
    const lw = Math.max(1.6, S * 0.04);
    ctx.save();
    ctx.lineCap = 'round';
    if (wear.neck && NECKWEAR[wear.neck]) NECKWEAR[wear.neck](ctx, S, A.neckY, Math.max(S * 0.6, A.neckW), lw, t);
    else if (wear.neck) drawWearSvg(ctx, wear.neck, 0, A.neckY, Math.min(Math.max(S * 0.6, A.neckW), S * 1.1) / 100);
    if (wear.face && A.face) drawWearSvg(ctx, wear.face, A.face.x, A.face.y, A.face.span / 40);
    if (wear.head && HATS[wear.head]) HATS[wear.head](ctx, S, A.topY + S * 0.05, lw, t);
    else if (wear.head) drawWearSvg(ctx, wear.head, 0, A.topY + S * 0.06, (S * 0.92) / 100);
    ctx.restore();
  }

  // --- living eyes for SVG art ------------------------------------------------
  // The official art is still images, so the code-drawn face (blinks, looks,
  // happy eyes) did not reach it. Each SVG's pupils are found once (a mirrored
  // pair of ink ellipses with their highlights), and variants are generated
  // from the SVG itself: closed, happy and eight look directions.
  const eyeCache = new Map(); // svg url -> { ready, imgs: { key: Image } }

  function num(el, name) {
    const v = el.getAttribute(name);
    return v == null ? null : Number(v);
  }

  function findEyes(doc) {
    const ks = [...doc.querySelectorAll('ellipse.k, circle.k')]
      .map((el) => ({ el, cx: num(el, 'cx'), cy: num(el, 'cy'), rx: num(el, 'rx') ?? num(el, 'r'), ry: num(el, 'ry') ?? num(el, 'r') }))
      .filter((k) => k.cx != null && k.rx >= 3);
    // The biggest mirrored pair wins (antennae and spots are smaller).
    let pair = null;
    for (const l of ks) for (const r of ks) {
      if (l.cx < 100 && r.cx > 100 && Math.abs(l.cx + r.cx - 200) < 8 && Math.abs(l.cy - r.cy) < 5) {
        if (!pair || l.rx + r.rx > pair[0].rx + pair[1].rx) pair = [l, r];
      }
    }
    if (!pair) return null;
    // Pupil parts (ink, highlights) move when it looks around; a white
    // sclera around the pupil stays put and only goes away when it closes.
    return pair.map((p) => {
      const near = (el) => {
        const cx = num(el, 'cx');
        const cy = num(el, 'cy');
        return cx != null && Math.abs(cx - p.cx) <= Math.max(p.rx, 4) * 1.25 && Math.abs(cy - p.cy) <= Math.max(p.ry, 4) * 1.25;
      };
      const round = [...p.el.parentNode.children].filter((el) => /^(ellipse|circle)$/.test(el.tagName) && near(el));
      const parts = round.filter((el) => /\b(k|w)\b/.test(el.getAttribute('class') || ''));
      const whites = round.filter((el) => !parts.includes(el) && /^(#fff(fff)?|white)$/i.test(el.getAttribute('fill') || ''));
      const size = Math.max(p.rx, ...whites.map((el) => num(el, 'rx') ?? num(el, 'r') ?? 0));
      return { ...p, parts, whites, size };
    });
  }

  function lid(doc, eye, d) {
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'o ln');
    path.setAttribute('d', d);
    const tr = eye.el.getAttribute('transform');
    if (tr) path.setAttribute('transform', tr);
    eye.el.parentNode.insertBefore(path, eye.el);
    for (const el of [...eye.parts, ...eye.whites]) el.remove();
  }

  function variantSvg(text, key) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const eyes = findEyes(doc);
    if (!eyes) return null;
    for (const e of eyes) {
      const w = Math.max(e.size, 5) * 1.1;
      if (key === 'blink') lid(doc, e, `M${e.cx - w} ${e.cy} Q${e.cx} ${e.cy + e.ry * 0.45} ${e.cx + w} ${e.cy}`);
      else if (key === 'happy') lid(doc, e, `M${e.cx - w} ${e.cy + e.ry * 0.25} Q${e.cx} ${e.cy - e.ry * 0.95} ${e.cx + w} ${e.cy + e.ry * 0.25}`);
      else {
        const [, x, y] = key.match(/^look(-?\d)(-?\d)$/);
        const dx = Number(x) * Math.max(e.rx, 4) * 0.32;
        const dy = Number(y) * Math.max(e.ry, 4) * 0.22;
        for (const el of e.parts) el.setAttribute('transform', `translate(${dx} ${dy}) ${el.getAttribute('transform') || ''}`.trim());
      }
    }
    return new XMLSerializer().serializeToString(doc);
  }

  const EYE_KEYS = ['blink', 'happy'];
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) if (x || y) EYE_KEYS.push(`look${x}${y}`);

  function eyeVariants(url, region = null) {
    // region: a region code or any tint key (see tintSvg).
    const cacheKey = region ? `${url}|${region}` : url;
    let entry = eyeCache.get(cacheKey);
    if (entry) return entry;
    entry = { ready: false, imgs: {} };
    eyeCache.set(cacheKey, entry);
    fetch(url)
      .then((r) => r.text())
      .then((raw) => {
        const text = region ? tintSvg(raw, region) : raw;
        if (region) {
          const base = new Image();
          base.onload = () => (entry.base = base);
          base.src = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
        }
        const geo = eyeGeometry(text);
        entry.eyeY = geo ? geo.y : null;
        entry.eyeX = geo ? [geo.x0, geo.x1] : null;
        for (const key of EYE_KEYS) {
          const svg = variantSvg(text, key);
          if (!svg) break;
          const img = new Image();
          img.onload = () => (entry.imgs[key] = img);
          img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        }
        entry.ready = true;
      })
      .catch(() => (entry.ready = true));
    return entry;
  }

  // Where the eyes sit, from 0 (top of the image) to 1 (bottom). Group
  // transforms (matrix, translate, scale) are applied by hand: a parsed
  // document is not rendered, so it has no layout to ask.
  function eyeHeight(text) {
    const g = eyeGeometry(text);
    return g ? g.y : null;
  }

  // Both eyes in image fractions: { y, x0, x1 } (0..1 of width and height).
  function eyeGeometry(text) {
    try {
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      const eyes = findEyes(doc);
      if (!eyes) return null;
      const root = doc.documentElement;
      const vb = (root.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
      if (vb.length !== 4 || !vb[3]) return null;
      const [l, r] = eyes.map((e) => place(e, root));
      const y = (l.y - vb[1]) / vb[3];
      // Eyes are always inside the picture; anything else is a misread.
      if (!(y > 0.05 && y < 0.9)) return null;
      return { y, x0: (l.x - vb[0]) / vb[2], x1: (r.x - vb[0]) / vb[2] };
    } catch {
      return null;
    }
  }

  function place(eye, root) {
    // Every transform list, from the eye up to the root, applied right to
    // left within each list (that is how SVG composes them).
    let x = eye.cx;
    let y = eye.cy;
    for (let el = eye.el; el && el !== root; el = el.parentNode) {
      const tr = el.getAttribute && el.getAttribute('transform');
      if (!tr) continue;
      const ops = [...tr.matchAll(/(matrix|translate|scale|rotate)\(([^)]*)\)/g)].reverse();
      for (const [, op, args] of ops) {
        const n = args.split(/[\s,]+/).filter(Boolean).map(Number);
        if (op === 'matrix') [x, y] = [n[0] * x + n[2] * y + n[4], n[1] * x + n[3] * y + n[5]];
        else if (op === 'translate') [x, y] = [x + n[0], y + (n[1] || 0)];
        else if (op === 'scale') [x, y] = [x * n[0], y * (n[1] ?? n[0])];
        else if (op === 'rotate') {
          const r = (n[0] * Math.PI) / 180;
          const cx = n[1] || 0;
          const cy = n[2] || 0;
          [x, y] = [cx + (x - cx) * Math.cos(r) - (y - cy) * Math.sin(r), cy + (x - cx) * Math.sin(r) + (y - cy) * Math.cos(r)];
        }
      }
    }
    return { x, y };
  }

  // --- regional forms ------------------------------------------------------------
  // A pet raised mostly on one language gets that region's colours (body,
  // shadow and belly of its type swapped) and the region's mark on its
  // forehead. A pack file "<form>.region-<region>.svg" replaces both.
  const TYPE_COLORS = {
    craft: ['#ff9f43', '#d9762b'], lore: ['#9381f2', '#6c5bcf'], shell: ['#35d0bf', '#1fa496'], test: ['#74cc63', '#4e9f42'],
    roam: ['#5fb3ff', '#3d88d8'], swarm: ['#ff80b8', '#e0579b'], chimera: ['#b9a6ff', '#8b74e6'], sprout: ['#f6e7c9', '#dcc59c'],
    docs: ['#f3ead6', '#d9c9a6'], git: ['#c7835a', '#9c5e3b'], debug: ['#e5484d', '#b8323a'], data: ['#5fc8e8', '#3a98bd'], style: ['#ffb3d1', '#e787b0'],
  };
  const REGIONS = {
    js: { body: '#ffd75e', shadow: '#e0b23a', belly: '#fff3c4', mark: '#3178c6' },
    py: { body: '#5b8fd6', shadow: '#3e6cad', belly: '#dfeaff', mark: '#ffd34d' },
    rs: { body: '#c8693c', shadow: '#9a4a26', belly: '#f6d8c4', mark: '#4fb3a0' },
    go: { body: '#5fd0e0', shadow: '#38a6b8', belly: '#e2fafd', mark: '#ffffff' },
    jvm: { body: '#8b5e3c', shadow: '#664229', belly: '#f1dcc6', mark: '#f2c14e' },
    cs: { body: '#8a6ad6', shadow: '#6648b5', belly: '#ece4ff', mark: '#e8dcff' },
  };

  // Colour changes for a pose drawn in normal colours: a colour map, the
  // white ring night pupils get, and added elements (the night moon) placed
  // before the same element as in the designer's variant.
  const SHAPE_SEL = 'path,ellipse,circle,rect,polygon,polyline,line';
  const GEOMETRY = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'points', 'x1', 'y1', 'x2', 'y2', 'transform'];
  const geometryKey = (el) => [el.tagName, ...GEOMETRY.map((g) => el.getAttribute(g) || '')].join('|');
  function toHex(c) {
    const v = String(c || '').trim().toLowerCase();
    const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
    if (m) return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
    if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    return v;
  }
  function recolor(text, map) {
    return text.replace(/\b(fill|stroke)="([^"]+)"/g, (all, attr, value) => {
      const to = map[toHex(value)];
      return to ? `${attr}="${to}"` : all;
    });
  }
  function seasonMap(season, lineage) {
    const to = tints.seasons[season];
    const from = PALETTES[lineage] || PALETTES.sprout;
    if (!to) return {};
    const map = {};
    for (const role of ['body', 'dark', 'belly', 'accent']) if (from[role] && to[role]) map[from[role].toLowerCase()] = to[role];
    return map;
  }
  function tintSvg(text, tintKey) {
    if (REGIONS[tintKey]) return regionSvg(text, tintKey);
    const [kind, a, b] = tintKey.split(':');
    if (kind === 'season') return recolor(text, seasonMap(a, b));
    const tint = kind === 'form' && (tints.forms[a] || {})[b];
    if (!tint) return text;
    const out = recolor(text, tint.map || {});
    if (!tint.ring && !(tint.extras || []).length) return out;
    try {
      const doc = new DOMParser().parseFromString(out, 'image/svg+xml');
      const NS = 'http://www.w3.org/2000/svg';
      if (tint.ring) {
        const eyes = findEyes(doc);
        for (const e of eyes || []) {
          const ring = doc.createElementNS(NS, 'ellipse');
          for (const n of ['cx', 'cy', 'transform']) if (e.el.getAttribute(n)) ring.setAttribute(n, e.el.getAttribute(n));
          ring.setAttribute('rx', String(e.rx + tint.ring));
          ring.setAttribute('ry', String(e.ry + tint.ring));
          ring.setAttribute('fill', '#fff');
          ring.setAttribute('stroke', 'none');
          e.el.parentNode.insertBefore(ring, e.el);
        }
      }
      const shapes = [...doc.querySelectorAll(SHAPE_SEL)];
      const byKey = new Map(shapes.map((el) => [geometryKey(el), el]));
      const outline = shapes.find((el) => /\bln\b/.test(el.getAttribute('class') || '')) || shapes[shapes.length - 1];
      for (const x of tint.extras || []) {
        const frag = new DOMParser().parseFromString(`<svg xmlns="${NS}">${x.svg}</svg>`, 'image/svg+xml').documentElement.firstElementChild;
        if (!frag) continue;
        const node = doc.importNode(frag, true);
        const before = x.before && byKey.get(x.before);
        const after = x.after && byKey.get(x.after);
        if (before) before.parentNode.insertBefore(node, before);
        else if (after) after.parentNode.insertBefore(node, after.nextSibling);
        else if (x.bottom && shapes[0]) shapes[0].parentNode.insertBefore(node, shapes[0]);
        else if (outline) outline.parentNode.appendChild(node);
      }
      return new XMLSerializer().serializeToString(doc);
    } catch {
      return out;
    }
  }

  function regionSvg(text, region) {
    const r = REGIONS[region];
    if (!r) return text;
    let out = text;
    for (const [type, [body, shadow]] of Object.entries(TYPE_COLORS)) {
      out = out.replace(new RegExp(body, 'gi'), r.body).replace(new RegExp(shadow, 'gi'), r.shadow);
      const belly = PALETTES[type] && PALETTES[type].belly;
      if (belly && r.belly) out = out.replace(new RegExp(belly, 'gi'), r.belly);
    }
    return out;
  }

  // The region's mark on the forehead, just above the eyes: the designer's
  // mark-<region>.svg when the pack has it, else drawn in code.
  function drawRegionMark(ctx, sprite, region, h) {
    const an = spriteAnchor(sprite.img);
    if (!an) return;
    const entry = sprite.img.__svg ? eyeVariants(sprite.img.__svg, region) : null;
    if (has(`mark-${region}`)) {
      const mark = get(`mark-${region}`);
      // Wait for the mark and the eye line (each loads once, then every frame has it).
      if (!mark || !entry || entry.eyeY == null) return;
      const S = Math.max(8, an.headW * h * 0.24);
      const y = -h + entry.eyeY * h - S * 1.05;
      ctx.drawImage(mark, -S / 2, y - S / 2, S, S);
      return;
    }
    drawMark(ctx, region, 0, -h + an.neckY * h + h * 0.03, an.headW * h);
  }

  function drawMark(ctx, region, x, y, S) {
    const r = REGIONS[region];
    if (!r) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = Math.max(1.4, S * 0.03);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.fillStyle = r.mark;
    const k = S * 0.14;
    switch (region) {
      case 'js':
        ctx.font = `800 ${Math.round(k * 2.2)}px Fredoka, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(2, S * 0.035);
        ctx.strokeText('{ }', 0, 0);
        ctx.fillText('{ }', 0, 0);
        break;
      case 'py':
        for (const dx of [-1.3, 0, 1.3]) {
          ctx.beginPath();
          ctx.moveTo(dx * k, -k * 0.8);
          ctx.lineTo(dx * k + k * 0.55, 0);
          ctx.lineTo(dx * k, k * 0.8);
          ctx.lineTo(dx * k - k * 0.55, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        break;
      case 'rs':
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const rr = i % 2 ? k * 0.95 : k * 1.3;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, k * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = INK;
        ctx.fill();
        break;
      case 'go':
        ctx.strokeStyle = r.mark;
        ctx.lineWidth = Math.max(2, S * 0.04);
        for (const [dy, w] of [[-0.7, 1.6], [0, 2.2], [0.7, 1.3]]) {
          ctx.beginPath();
          ctx.moveTo(-k * w * 0.5, dy * k);
          ctx.lineTo(k * w * 0.5, dy * k);
          ctx.stroke();
        }
        break;
      case 'jvm':
        ctx.beginPath();
        ctx.ellipse(0, 0, k * 0.8, k * 1.15, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-k * 0.3, -k * 0.75);
        ctx.quadraticCurveTo(k * 0.3, 0, -k * 0.1, k * 0.8);
        ctx.stroke();
        break;
      case 'cs':
        ctx.strokeStyle = r.mark;
        ctx.lineWidth = Math.max(2, S * 0.035);
        for (const d of [-0.4, 0.4]) {
          ctx.beginPath();
          ctx.moveTo(d * k - k * 0.15, -k);
          ctx.lineTo(d * k + k * 0.15, k);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-k, d * k);
          ctx.lineTo(k, d * k);
          ctx.stroke();
        }
        break;
      default:
        break;
    }
    ctx.restore();
  }

  // Which eyes the body language asks for.
  function eyeKey(a) {
    if (a.eyes === 'blink' || a.eyes === 'closed') return 'blink';
    if (a.eyes === 'happy' || a.eyes === 'wink') return 'happy';
    const x = a.lookX > 0.35 ? 1 : a.lookX < -0.35 ? -1 : 0;
    const y = a.lookY > 0.45 ? 1 : a.lookY < -0.45 ? -1 : 0;
    return x || y ? `look${x}${y}` : null;
  }

  function livingImage(img, a, region = null) {
    // region: a region code or a tint key; its recoloured image is entry.base.
    if (!img.__svg) return img;
    const entry = eyeVariants(img.__svg, region);
    const base = region ? entry.base || img : img;
    const key = eyeKey(a);
    if (!key) return base;
    return entry.imgs[key] || base;
  }

  // Where accessories sit, from the form's idle image: its eyes are open,
  // so glasses stay on while it sleeps. Same frame as every pose of the form.
  function wearAnchors(sprite, spec, w, h) {
    const still = get(spriteKey(spec)) || sprite.img;
    const an = spriteAnchor(still);
    if (!an) return null;
    const eyes = still.__svg ? eyeVariants(still.__svg) : null;
    const face = eyes && eyes.eyeX && eyes.eyeY != null ? { x: -w / 2 + ((eyes.eyeX[0] + eyes.eyeX[1]) / 2) * w, y: -h + eyes.eyeY * h, span: (eyes.eyeX[1] - eyes.eyeX[0]) * w } : null;
    return { topY: -h + an.top * h, headW: an.headW * h, neckY: -h + an.neckY * h, neckW: an.neckW * h, face };
  }

  function drawSprite(ctx, sprite, spec, a, R, t) {
    // Regional colours only on the normal colouring (shiny and night win);
    // a designer regional file is already coloured and marked.
    const region = sprite.region && REGIONS[sprite.region] ? sprite.region : null;
    const base = livingImage(sprite.img, a, sprite.tint || region);
    const img = spec.nocturne && !sprite.night ? nightTint(base) : base;
    const h = heightOf(spec.stage, spec.size || 48) * ((packInfo && packInfo.scale) || 1);
    const w = ((sprite.img.naturalWidth || 1) / Math.max(1, sprite.img.naturalHeight || 1)) * h;
    ctx.save();
    ctx.translate(a.shake, 0);
    ctx.rotate(a.tilt);
    ctx.scale((a.turn == null ? 1 : a.turn) * (1 + a.squash), 1 - a.squash);
    if (a.glow > 0 || spec.stage === 'mythic') aura(ctx, spec, R, -h * 0.45, palette(spec), t, Math.max(a.glow, spec.stage === 'mythic' ? 0.6 : 0));
    // A shiny always shines: glow and ring behind, stars in front.
    if (spec.shiny && spec.stage !== 'egg') shine(ctx, 0, -h * 0.5, Math.max(w, h) * 0.56, t, 'back');
    ctx.drawImage(img, -w / 2, -h, w, h);
    const anchors = spec.wear && spec.stage !== 'egg' ? wearAnchors(sprite, spec, w, h) : null;
    if (region && !sprite.regional && spec.stage !== 'egg' && spec.stage !== 'sprout') drawRegionMark(ctx, sprite, region, h);
    if (anchors) drawWear(ctx, spec.wear, anchors, t);
    ctx.restore();
    if (a.motes) motes(ctx, a.motes, R, -h * 0.45, palette(spec), t);
    if (a.prop) prop(ctx, a.prop, R, -h * 0.45, palette(spec), t);
    if (spec.shiny && spec.stage !== 'egg') shine(ctx, 0, -h * 0.5, Math.max(w, h) * 0.56, t, 'front');
  }

  // --- main entry --------------------------------------------------------------

  function drawCreature(ctx, spec) {
    const t = spec.t || 0;
    const a = {
      bob: 0, squash: 0, jump: 0, shake: 0, tilt: 0, lookX: 0, lookY: 0,
      eyes: 'open', mouth: 'smile', prop: null, crack: 0, glow: 0, motes: 0,
      ...(spec.anim || {}),
    };
    const base = spec.size || 48;
    const R = base * (STAGE_SCALE[spec.stage] || 1);

    // Ground shadow shrinks while jumping.
    ctx.save();
    const lift = Math.max(0, a.jump);
    ctx.globalAlpha = 0.22 * (1 - Math.min(0.6, lift / (R * 1.5)));
    ellipse(ctx, 0, 2, R * 0.95 * (1 - lift / (R * 4)), R * 0.16);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(0, -lift + a.bob);

    const sprite = spriteFor(spec);
    if (sprite) {
      drawSprite(ctx, sprite, spec, a, R, t);
      ctx.restore();
      return;
    }

    if (spec.stage === 'egg') {
      drawEgg(ctx, spec, R, a, t);
      ctx.restore();
      return;
    }

    const pal = palette(spec);
    // The hidden Chimera wears both of its lineages at once.
    const looks = spec.lineage === 'chimera' ? (spec.chimera || ['craft', 'lore']).map((l) => ({ ...spec, lineage: l })) : [spec];
    const shape = shapeOf(looks[0]);
    const sx = 1 + a.squash;
    const sy = 1 - a.squash;
    const w = R * shape.w * sx;
    const hb = R * shape.bottom * sy;
    const ht = R * shape.top * sy;
    const cy = -hb;
    const top = cy - ht;

    ctx.translate(a.shake, 0);
    ctx.rotate(a.tilt);
    if (a.turn != null && a.turn !== 1) ctx.scale(a.turn, 1);

    if (!spec.plain) aura(ctx, spec, R, cy, pal, t, Math.max(a.glow, spec.stage === 'mythic' ? 0.8 : 0));
    if (spec.shiny && !spec.plain) shine(ctx, 0, cy, R * 1.25, t, 'back');
    for (const look of looks) {
      backFeatures(ctx, look, R, cy, pal, t);
      grownFeatures(ctx, look, R, cy, w, hb, pal, t);
    }

    // Feet.
    for (const side of [-1, 1]) {
      ellipse(ctx, side * w * 0.45, -R * 0.06, R * 0.24, R * 0.14);
      fillStroke(ctx, pal.dark);
    }

    // Body and belly.
    blobPath(ctx, cy, w, ht, hb, shape.tip);
    fillStroke(ctx, pal.body, LINE + 0.4);
    ctx.save();
    blobPath(ctx, cy, w, ht, hb, shape.tip);
    ctx.clip();
    ellipse(ctx, 0, cy + hb * 0.55, w * 0.62, hb * 0.75);
    ctx.fillStyle = pal.belly;
    ctx.fill();
    // Soft top highlight.
    ctx.globalAlpha = 0.35;
    ellipse(ctx, -w * 0.35, cy - ht * 0.55, w * 0.25, ht * 0.18, -0.5);
    ctx.fillStyle = '#fff';
    ctx.fill();
    // Mythic circuit / pattern lines.
    if (spec.stage === 'mythic') {
      ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.15;
      ctx.strokeStyle = pal.glow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w, cy + hb * 0.1);
      ctx.lineTo(-w * 0.55, cy + hb * 0.1);
      ctx.lineTo(-w * 0.4, cy - ht * 0.15);
      ctx.moveTo(w, cy + hb * 0.25);
      ctx.lineTo(w * 0.6, cy + hb * 0.25);
      ctx.lineTo(w * 0.48, cy + hb * 0.45);
      ctx.stroke();
    }
    ctx.restore();

    for (const look of looks) headFeatures(ctx, look, R, top, pal, t);
    ctx.__shine = spec.nocturne ? '#bff4ff' : null;
    const grownEyes = stageN(spec.stage) >= 2;
    ctx.__eyeStyleL = grownEyes ? EYE_STYLE[looks[0].lineage] || 'round' : 'round';
    ctx.__eyeStyleR = grownEyes ? EYE_STYLE[(looks[1] || looks[0]).lineage] || 'round' : 'round';
    face(ctx, R, cy, pal, a, t);
    trait(ctx, spec, R, cy, top, pal, t);
    if (spec.nocturne && stageN(spec.stage) >= 1) moon(ctx, R, top, t);
    ctx.__shine = null;

    if (spec.wear && spec.stage !== 'egg') drawWear(ctx, spec.wear, { topY: top + ht * 0.08, headW: w * 1.25, neckY: cy + hb * 0.35, neckW: w * 1.7, face: { x: 0, y: cy - R * 0.12, span: R * 0.62 } }, t);

    // Arms: small nubs, raised when cheering or holding things.
    const raise = a.armsUp || a.eyes === 'happy' || a.prop === 'sign' ? -0.9 : a.prop ? -0.35 : 0.2;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * w * 0.92, cy + R * 0.12);
      ctx.rotate(side * raise + Math.sin(t * 6 + side) * (a.eyes === 'happy' ? 0.25 : 0.04));
      const arm = spec.lineage === 'craft' && stageN(spec.stage) >= 2 ? 1.35 : 1;
      ellipse(ctx, side * R * 0.1 * arm, 0, R * 0.17 * arm, R * 0.11 * arm);
      fillStroke(ctx, pal.body, LINE - 0.2);
      ctx.restore();
    }

    if (a.motes) motes(ctx, a.motes, R, cy, pal, t);
    ctx.__shield = PALETTES.test.extra;
    if (a.prop) prop(ctx, a.prop, R, cy, pal, t);
    if (spec.shiny) shine(ctx, 0, cy, R * 1.25, t, 'front');

    ctx.restore();
  }

  // Height the creature needs above the ground, for layout.
  function heightOf(stage, size = 48) {
    const R = size * (STAGE_SCALE[stage] || 1);
    return stage === 'egg' ? R * 2.5 : R * 2.4;
  }

  window.OpenmonArt = { drawCreature, heightOf, loadPack, eyeVariants, spriteAnchor, PALETTES, SHINY, INK, REGIONS };
})();
