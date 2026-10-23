// Draws an Openmon from the designer's art pack (art/official): the form's
// SVG for the pose, its shine, aura, accessories and props, on a 2D canvas.
// The origin is the point on the ground under the creature; y grows downward.
// While a pose loads, the same form at rest stands in; before any of its
// art has loaded, nothing is drawn.
//
// drawCreature(ctx, spec) where spec = {
//   stage, lineage, t (seconds), pose, shiny, wear, legend,
//   anim: { bob, squash, jump, shake, tilt, turn, eyes, prop, glow, motes }
// }

(function () {
  'use strict';

  const INK = '#2a2140';
  const LINE = 2.6;

  const PALETTES = {
    egg: { body: '#fff4e0', dark: '#efd9b4', belly: '#fffaf0', accent: '#f2b880', glow: '#fff1c9' },
    // Fallback for a form without a lineage of its own.
    plain: { body: '#f6e7c9', dark: '#dcc59c', belly: '#fff8ea', accent: '#78c86b', glow: '#fff3d1' },
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
    craft: { body: '#5d6d8f', dark: '#3f4c69', belly: '#cbd7f0', accent: '#e9c46a', glow: '#9fb6e8', extra: '#e9c46a' },
    lore: { body: '#f2c14e', dark: '#c9962c', belly: '#fff2c6', accent: '#7e5bd6', glow: '#ffe69a', extra: '#8a5a00' },
    shell: { body: '#ff6b8a', dark: '#d4466a', belly: '#ffe0e7', accent: '#7dffb0', glow: '#ffb3c3', extra: '#7a1f38' },
    test: { body: '#41476a', dark: '#2a2e47', belly: '#d9dcef', accent: '#e2b13c', glow: '#ffe08a', extra: '#e2b13c' },
    roam: { body: '#ffd36b', dark: '#e0a93c', belly: '#fff4d4', accent: '#ffffff', glow: '#fff0b8', extra: '#5fb3ff' },
    swarm: { body: '#7ce3b5', dark: '#4fb88c', belly: '#e3fff1', accent: '#ff80b8', glow: '#c2ffe4', extra: '#9b5de5' },
    docs: { body: '#f5d98a', dark: '#d9b45a', belly: '#fff3cf', accent: '#c0392b', glow: '#ffd9a8', extra: '#ffffff' },
    git: { body: '#ece6dc', dark: '#c9bfae', belly: '#fffaf2', accent: '#ff9fc4', glow: '#ffd1e3', extra: '#5a4e44' },
    debug: { body: '#f2c14e', dark: '#c9962c', belly: '#fff2c6', accent: '#1f6f5c', glow: '#ffe69a', extra: '#e5484d' },
    data: { body: '#b48cf2', dark: '#8a62d1', belly: '#f1e6ff', accent: '#3ddc97', glow: '#e6d6ff', extra: '#dcc6ff' },
    style: { body: '#8fe3c4', dark: '#5fbf9d', belly: '#eafff6', accent: '#ffd166', glow: '#c2ffe4', extra: '#5fb3ff' },
  };

  const STAGE_SCALE = { egg: 0.78, juvenile: 0.82, adult: 1, mythic: 1.08 };

  function palette(spec) {
    if (spec.stage === 'egg') return PALETTES.egg;
    const key = spec.lineage || 'plain';
    return (spec.shiny && SHINY[key]) || PALETTES[key] || PALETTES.plain;
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

  // The designer's prop (public/props/<id>.svg), when there is one: beside
  // the pet, or above its head for the sign and the thought bubble.
  const propArt = new Map();
  function propImage(kind) {
    let p = propArt.get(kind);
    // Only the props the pack lists (loadPack); none asked for before that.
    if (!p && !slots) return null;
    if (!p && !slots.has(`props/${kind}.svg`)) propArt.set(kind, (p = { ready: false }));
    if (!p) {
      p = { img: new Image(), ready: false };
      p.img.onload = () => (p.ready = true);
      p.img.src = `/props/${encodeURIComponent(kind)}.svg`;
      propArt.set(kind, p);
    }
    return p.ready ? p.img : null;
  }

  function prop(ctx, kind, R, cy, pal, t) {
    const art = propImage(kind);
    if (art) {
      const above = kind === 'sign' || kind === 'thought';
      const S = R * (above ? 0.8 : 0.9);
      const bob = Math.sin(t * 4) * R * 0.04;
      const x = above ? R * 0.55 : R * 1.05;
      const y = above ? cy - R * 1.75 : cy - S * 0.55;
      ctx.drawImage(art, x, y + bob, S * ((art.naturalWidth || 1) / (art.naturalHeight || 1)), S);
      return;
    }
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
  let tints = { forms: {} };
  let slots = null;

  function loadPack() {
    return fetch('/art/index.json')
      .then((r) => r.json())
      .then((j) => {
        const { files: list, pack, tints: t } = j;
        packInfo = pack;
        if (t) tints = { forms: t.forms || {} };
        slots = new Set(j.slots || []);
        for (const file of list || []) files.set(file.replace(/.(png|svg|webp)$/, ''), file);
      })
      .catch(() => (slots = new Set()));
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

  function spriteKey(spec) {
    if (spec.legend) return spec.legend;
    return spec.stage === 'egg' || !spec.lineage ? spec.stage : `${spec.lineage}-${spec.stage}`;
  }

  // Returns { img, tint }. Poses are drawn only in normal colours: a shiny
  // pose gets the shiny colours at draw time (tint), so it keeps every pose.
  function spriteFor(spec) {
    const key = spriteKey(spec);
    const pose = spec.pose && spec.pose !== 'idle' ? `@${spec.pose}` : '';
    const pick = (name, extra) => {
      const img = get(name);
      return img ? { img, ...extra } : null;
    };
    // Best first; while the best is still loading, the next one that is
    // ready stands in (the same form at rest), so the pet never blinks out.
    const wanted = [];
    if (spec.shiny && spec.stage !== 'egg') {
      const tint = (tints.forms[key] || {}).shiny;
      if (has(`${key}.shiny${pose}`)) wanted.push([`${key}.shiny${pose}`]);
      else if (pose && has(key + pose) && tint) wanted.push([key + pose, { tint: `form:${key}:shiny` }]);
      if (has(`${key}.shiny`)) wanted.push([`${key}.shiny`]);
    } else if (pose && has(key + pose)) wanted.push([key + pose]);
    if (has(key) && !(spec.shiny && spec.stage !== 'egg' && has(`${key}.shiny`))) wanted.push([key]);
    for (const [name, extra] of wanted) {
      const found = pick(name, extra);
      if (found) return found;
    }
    return null;
  }

  // --- accessories ---------------------------------------------------------------
  // Where hats, glasses and neckwear sit comes from each sprite's own outline: the top of the head (ignoring
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
    ctx.save();
    // The designer's files (public/wear/<id>.svg); nothing until loaded.
    if (wear.neck) drawWearSvg(ctx, wear.neck, 0, A.neckY, Math.min(Math.max(S * 0.6, A.neckW), S * 1.1) / 100);
    if (wear.face && A.face) drawWearSvg(ctx, wear.face, A.face.x, A.face.y, A.face.span / 40);
    if (wear.head) drawWearSvg(ctx, wear.head, 0, A.topY + S * 0.06, (S * 0.92) / 100);
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
      // A slit pupil is narrow but tall: its larger radius is what counts.
      .filter((k) => k.cx != null && Math.max(k.rx, k.ry) >= 2.5);
    // The biggest pair side by side wins (antennae and spots are smaller).
    // A face turned aside is not centred on x = 100, so only the height and
    // the gap between them count. A cyclops has a single eye.
    let pair = null;
    for (const l of ks) for (const r of ks) {
      if (r.cx - l.cx > l.rx + r.rx && Math.abs(l.cy - r.cy) < Math.max(l.ry, r.ry)) {
        if (!pair || l.rx + r.rx > pair[0].rx + pair[1].rx) pair = [l, r];
      }
    }
    if (!pair && ks.length) pair = [ks.reduce((a, b) => (b.rx > a.rx ? b : a))];
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
    // Art without a stylesheet still gets a drawn lid, in the eye's own ink.
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', eye.el.getAttribute('fill') || '#2a2140');
    path.setAttribute('stroke-width', String(Math.max(2.5, eye.ry * 0.55)));
    path.setAttribute('stroke-linecap', 'round');
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
    // region: a tint key (see tintSvg).
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
      const [l, r] = eyes.length > 1 ? eyes.map((e) => place(e, root)) : ((c) => [{ x: c.x - eyes[0].rx * 1.6, y: c.y }, { x: c.x + eyes[0].rx * 1.6, y: c.y }])(place(eyes[0], root));
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
  function tintSvg(text, tintKey) {
    const [kind, a, b] = tintKey.split(':');
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
    const img = livingImage(sprite.img, a, sprite.tint || null);
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

    // Ground shadow shrinks while jumping (the caller may draw its own).
    const lift = Math.max(0, a.jump);
    if (a.shadow !== false) {
      ctx.save();
      ctx.globalAlpha = 0.22 * (1 - Math.min(0.6, lift / (R * 1.5)));
      ellipse(ctx, 0, 2, R * 0.95 * (1 - lift / (R * 4)), R * 0.16);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(0, -lift + a.bob);

    const sprite = spriteFor(spec);
    if (sprite) drawSprite(ctx, sprite, spec, a, R, t);
    ctx.restore();
  }

  // Height the creature needs above the ground, for layout.
  function heightOf(stage, size = 48) {
    const R = size * (STAGE_SCALE[stage] || 1);
    return stage === 'egg' ? R * 2.5 : R * 2.4;
  }

  window.OpenmonArt = { drawCreature, heightOf, loadPack, PALETTES, SHINY, INK };
})();
