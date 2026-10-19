// The pet window: listens to the daemon, picks the pose, plays reactions,
// particles and sounds, and handles petting, dragging and the hover card.
// Runs the same in the Electron window, a browser tab and OBS.

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const { t: tr, detail: trDetail } = window.OpenmonI18n;
  // 0:42, 3:05, 1:02:10
  const clock = (ms) => {
    const t = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const sec = String(t % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  };
  const shortDur = (ms) => {
    const t = Math.round((ms || 0) / 1000);
    if (t < 60) return `${t}s`;
    const m = Math.floor(t / 60);
    return m < 60 ? `${m}m ${String(t % 60).padStart(2, '0')}s` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
  };
  const params = new URLSearchParams(location.search);
  const desktop = window.openmonDesktop || null;
  const preview = params.has('preview');
  if (preview) {
    document.body.classList.add('preview');
    $('controls').hidden = false;
  }
  if (params.get('scale')) document.documentElement.style.setProperty('--scale', String(Number(params.get('scale')) || 1));

  const canvas = $('pet');
  const ctx = canvas.getContext('2d');
  const W = 280;
  const H = 250;
  const GROUND = 222;
  const CX = 140;
  const SIZE = 46;
  const STAGE_SCALE = { egg: 0.78, sprout: 0.66, juvenile: 0.82, adult: 1, mythic: 1.08 };
  const now = () => performance.now() / 1000;
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let setupInfo = null;
  let live = { pose: 'sleep', sessions: [], counts: {}, focus: null };
  let pet = null;
  let config = { muted: false };
  let demo = false;
  let connected = false;
  let pose = 'sleep';
  let poseSince = 0;
  let family = null;
  let pettedAt = null;
  let testFlash = null;
  let evolveFx = null;
  let force = null;
  // ?hover keeps the stats card open (screenshots, smoke test).
  let hovering = params.has('hover');
  let pinned = hovering;
  let lastZ = 0;
  let lastSpark = 0;
  const particles = [];
  let ackedFor = null;
  let renudged = null;
  const LONG_WAIT_MS = 2 * 60 * 1000;
  let lastUiCheck = 0;
  let lastChime = 0;
  let pendingXp = 0;
  let xpTimer = null;
  const toasts = [];
  let toast = null;

  // --- sound -------------------------------------------------------------------

  let audio = null;
  function tone(freq, at, dur, type = 'sine', vol = 0.1) {
    const t0 = audio.currentTime + at;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
  const SOUNDS = {
    attention: () => { tone(1318.5, 0, 0.22, 'sine', 0.13); tone(1046.5, 0.17, 0.4, 'sine', 0.13); },
    evolve: () => [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, i * 0.1, i === 4 ? 0.7 : 0.25, 'triangle', 0.09)),
    pet: () => { tone(880, 0, 0.09, 'sine', 0.05); tone(1320, 0.06, 0.1, 'sine', 0.04); },
    done: () => { tone(784, 0, 0.14, 'sine', 0.06); tone(1175, 0.11, 0.22, 'sine', 0.06); },
    level: () => { tone(988, 0, 0.1, 'square', 0.035); tone(1319, 0.09, 0.22, 'square', 0.035); },
    green: () => [1046.5, 1318.5, 1568].forEach((f, i) => tone(f, i * 0.06, 0.16, 'sine', 0.05)),
    cry: () => {
      // Every lineage has its own little call, like a species cry.
      const spec = currentSpec();
      const c = CRIES[spec.stage === 'egg' || spec.stage === 'sprout' ? spec.stage : spec.lineage] || CRIES.sprout;
      const scale = spec.stage === 'mythic' ? 0.8 : spec.stage === 'adult' ? 0.9 : 1;
      c.notes.forEach(([f, at, dur], i) => slide(f * scale, f * scale * c.slide, at, dur, c.wave, i === 0 ? 0.09 : 0.07));
    },
  };
  const CRIES = {
    egg: { wave: 'triangle', slide: 0.7, notes: [[420, 0, 0.06], [380, 0.14, 0.07]] },
    sprout: { wave: 'sine', slide: 1.25, notes: [[880, 0, 0.12], [1100, 0.1, 0.16]] },
    craft: { wave: 'square', slide: 0.8, notes: [[330, 0, 0.1], [392, 0.09, 0.1], [262, 0.18, 0.2]] },
    lore: { wave: 'triangle', slide: 1.15, notes: [[523, 0, 0.18], [659, 0.16, 0.26]] },
    shell: { wave: 'sawtooth', slide: 1.6, notes: [[700, 0, 0.06], [700, 0.08, 0.06], [940, 0.16, 0.14]] },
    test: { wave: 'triangle', slide: 0.9, notes: [[262, 0, 0.2], [330, 0.18, 0.28]] },
    roam: { wave: 'sine', slide: 1.5, notes: [[600, 0, 0.25], [900, 0.2, 0.3]] },
    swarm: { wave: 'square', slide: 1.1, notes: [[780, 0, 0.05], [880, 0.06, 0.05], [990, 0.12, 0.05], [1180, 0.18, 0.1]] },
  };
  function slide(from, to, at, dur, type, vol) {
    const t0 = audio.currentTime + at;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(type === 'sine' || type === 'triangle' ? vol : vol * 0.45, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
  function play(name) {
    if (config.muted || config.quiet || params.has('mute')) return;
    try {
      audio ||= new AudioContext();
      if (audio.state === 'suspended') audio.resume();
      SOUNDS[name]();
    } catch {}
  }

  // --- particles ---------------------------------------------------------------

  function spawn(kind, x, y, extra = {}) {
    if (reducedMotion && kind !== 'text' && kind !== 'z' && particles.length > 4) return;
    particles.push({ kind, x, y, vx: 0, vy: -20, life: 0, max: 1.2, rot: 0, vr: 0, ...extra });
  }
  function burst(kind, n, x, y, spread, extra = {}) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * spread;
      const v = 60 + Math.random() * 90;
      spawn(kind, x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, max: 1 + Math.random() * 0.6, color: extra.colors ? extra.colors[i % extra.colors.length] : extra.color, ...extra });
    }
  }
  const CONFETTI = ['#ff9f43', '#9381f2', '#35d0bf', '#74cc63', '#5fb3ff', '#ff80b8', '#ffe156'];

  function heart(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y + s * 0.35);
    c.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.45, y - s, x, y - s * 0.45);
    c.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
    c.closePath();
  }
  function star(c, x, y, s) {
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? s * 0.4 : s;
      const a = (i * Math.PI) / 4;
      c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    c.closePath();
  }

  function drawParticles(dt) {
    const INK = OpenmonArt.INK;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) {
        particles.splice(i, 1);
        continue;
      }
      if (p.gravity) p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const k = p.life / p.max;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - k) * 1.6);
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      switch (p.kind) {
        case 'heart':
          heart(ctx, p.x + Math.sin(p.life * 6) * 4, p.y, 8 + k * 3);
          ctx.fillStyle = '#ff6f91';
          ctx.fill();
          ctx.stroke();
          break;
        case 'spark':
          star(ctx, p.x, p.y, 5 * (1 - k * 0.5));
          ctx.fillStyle = p.color || '#ffe156';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.stroke();
          break;
        case 'confetti':
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-4, -2.5, 8, 5);
          break;
        case 'z':
          ctx.font = `800 ${12 + k * 8}px system-ui, sans-serif`;
          ctx.fillStyle = '#fff';
          ctx.lineWidth = 3;
          ctx.strokeText('z', p.x + Math.sin(p.life * 3) * 6, p.y);
          ctx.fillText('z', p.x + Math.sin(p.life * 3) * 6, p.y);
          break;
        case 'sweat':
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - 8);
          ctx.quadraticCurveTo(p.x + 6, p.y, p.x, p.y + 4);
          ctx.quadraticCurveTo(p.x - 6, p.y, p.x, p.y - 8);
          ctx.fillStyle = '#8fd3ff';
          ctx.fill();
          ctx.stroke();
          break;
        case 'text':
          ctx.font = `800 ${p.sizePx || 13}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = '#fff';
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillStyle = p.color || '#7c6cf2';
          ctx.fillText(p.text, p.x, p.y);
          break;
        default:
          break;
      }
      ctx.restore();
    }
  }

  // --- what to draw ------------------------------------------------------------

  function specOf(p) {
    if (!p) return { stage: 'egg', lineage: null, trait: null };
    return { stage: p.stage, lineage: p.lineage, trait: p.trait, chimera: p.chimera || null, nocturne: Boolean(p.nocturne), shiny: Boolean(p.shiny) && p.stage !== 'egg' };
  }
  function currentSpec() {
    return force || specOf(pet);
  }
  function radius(stage) {
    return SIZE * (STAGE_SCALE[stage] || 1);
  }
  function headY(stage) {
    return GROUND - OpenmonArt.heightOf(stage, SIZE);
  }

  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d');

  function drawPet(t, dpr) {
    const base = currentSpec();
    const showPose = connected || preview ? pose : 'sleep';
    let spec = base;
    let silhouette = 0;

    if (evolveFx) {
      const e = t - evolveFx.start;
      if (e < 2.4) {
        // Flicker between old and new forms, faster and faster.
        const flips = Math.floor(Math.pow(e / 2.4, 2) * 16);
        spec = flips % 2 ? evolveFx.to : evolveFx.from;
        silhouette = Math.min(1, e / 0.5);
      } else if (e < 3.6) {
        if (!evolveFx.revealed) {
          evolveFx.revealed = true;
          burst('spark', 18, CX, GROUND - 60, Math.PI * 2, { colors: ['#fff', '#ffe156', '#c7baff'], gravity: 60 });
          burst('confetti', 26, CX, GROUND - 70, 2.2, { colors: CONFETTI, gravity: 260 });
          play('evolve');
          setTimeout(() => play('cry'), 650);
          const name = pet ? pet.name : 'Your Openmon';
          const dexLine = evolveFx.newDex && pet ? tr('scene.newDex', { no: String(pet.dexNo).padStart(3, '0') }) : '';
          toast = null;
          if (evolveFx.toStage === 'sprout') {
            if (evolveFx.shiny) burst('spark', 24, CX, GROUND - 50, Math.PI * 2, { colors: ['#fffbe0', '#ffe156'], gravity: 40, max: 1.8 });
            pushToast(evolveFx.shiny ? tr('scene.shiny', { form: evolveFx.toName }) : tr('scene.hatched', { name }), tr(evolveFx.shiny ? 'scene.shiny.sub' : 'scene.hatched.sub'), 5500, 'scene');
          } else {
            pushToast(tr('scene.evolved', { name, form: evolveFx.toName }), evolveFx.to.nocturne ? tr('scene.night') : dexLine || (evolveFx.toStage === 'mythic' ? tr('scene.legend') : tr('scene.evolved.sub', { stage: tr(`stage.${evolveFx.toStage}`) })), 5000, 'scene');
          }
          for (const [title, text] of evolveFx.after) pushToast(title, text);
        }
        spec = evolveFx.to;
        silhouette = 1 - (e - 2.4) / 1.2;
      } else {
        evolveFx = null;
      }
    }

    if (evolveFx && !evolveFx.revealed) {
      // Dim the world around the pet, like an evolution screen.
      const k = Math.min(1, (t - evolveFx.start) / 0.6);
      const v = ctx.createRadialGradient(CX, GROUND - 60, 30, CX, GROUND - 60, 150);
      v.addColorStop(0, `rgba(255,255,255,${0.35 * k})`);
      v.addColorStop(0.55, `rgba(42,33,64,${0.35 * k})`);
      v.addColorStop(1, 'rgba(42,33,64,0)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    }

    const anim = OpenmonMotion.poseAnim({
      nature: pet && pet.nature,
      pose: evolveFx ? 'idle' : showPose,
      family,
      t,
      since: poseSince,
      stage: spec.stage,
      progress: pet && pet.progress ? pet.progress.ratio : 0,
      subagents: live.counts ? live.counts.subagents : 0,
      pettedAt,
      testFlash,
      cursor: cursor && Date.now() - cursor.at < 4000 ? cursor : null,
      acked: pose === 'attention' && live.focus && ackedFor === live.focus.since,
      hover: hovering,
    });
    if (reducedMotion) {
      anim.jump *= 0.3;
      anim.shake = 0;
      anim.turn = 1;
    }
    if (evolveFx) anim.glow = 1;
    // About to evolve: a soft pulse, like a Digimon about to digivolve.
    else if (pet && pet.progress && pet.progress.ratio >= 0.9 && pet.progress.next && !pet.progress.needsBond) {
      if (spec.stage === 'egg') anim.tilt += Math.sin(t * 9) * 0.04;
      else anim.glow = Math.max(anim.glow, 0.3 + Math.sin(t * 3) * 0.2);
    }

    if (silhouette <= 0) {
      ctx.save();
      ctx.translate(CX, GROUND);
      OpenmonArt.drawCreature(ctx, { ...spec, t, size: SIZE, pose: showPose, anim });
      ctx.restore();
      return;
    }
    // Draw off-screen, then paint it white for the evolution flash.
    if (off.width !== canvas.width) {
      off.width = canvas.width;
      off.height = canvas.height;
    }
    offCtx.setTransform(1, 0, 0, 1, 0, 0);
    offCtx.clearRect(0, 0, off.width, off.height);
    offCtx.setTransform(dpr, 0, 0, dpr, CX * dpr, GROUND * dpr);
    OpenmonArt.drawCreature(offCtx, { ...spec, t, size: SIZE, pose: 'idle', anim });
    offCtx.setTransform(1, 0, 0, 1, 0, 0);
    offCtx.globalCompositeOperation = 'source-atop';
    offCtx.globalAlpha = silhouette;
    offCtx.fillStyle = '#fff';
    offCtx.fillRect(0, 0, off.width, off.height);
    offCtx.globalAlpha = 1;
    offCtx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  }

  function ambient(t) {
    const stage = currentSpec().stage;
    const R = radius(stage);
    if (pose === 'sleep' && t - lastZ > 1.4) {
      lastZ = t;
      spawn('z', CX + R * 0.7, headY(stage) + 10, { vx: 10, vy: -16, max: 2.2 });
    }
    if (pose === 'working' && family === 'craft' && stage !== 'egg' && Math.sin(t * 9) > 0.97 && t - lastSpark > 0.4) {
      lastSpark = t;
      burst('spark', 3, CX + R * 1.3, GROUND - R * 0.3, 1.6, { max: 0.5, gravity: 300 });
    }
  }

  let lastFrame = now();
  // A pet that sits on screen all day must be cheap: full frame rate only
  // while something is happening, less when idle, little while asleep, and
  // nothing when the window is hidden.
  function targetFps(t) {
    if (document.hidden) return 0;
    if (evolveFx || particles.length || down || hovering || toast) return 60;
    if (pose === 'attention' || pose === 'working' || pose === 'error') return 60;
    if (pose === 'done' && t - poseSince < 4) return 60;
    if (pose === 'sleep') return 12;
    return 30;
  }

  function frame() {
    const t = now();
    const fps = targetFps(t);
    if (!fps || t - lastFrame < 1 / fps - 0.004) {
      requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(0.05, t - lastFrame);
    lastFrame = t;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(W * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ambient(t);
    drawPet(t, dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawParticles(dt);
    if (toast && Date.now() > toast.until) nextToast();
    const f = live.focus;
    if (pose === 'attention' && f && f.since && ackedFor !== f.since && Date.now() - f.since > LONG_WAIT_MS && renudged !== f.since) {
      renudged = f.since;
      play('attention');
      burst('spark', 10, CX, GROUND - 90, Math.PI * 2, { colors: ['#ffe156', '#fff'], gravity: 80 });
    }
    // Time-based bubble rules (the 90 s "done") need a gentle re-check.
    if (t - lastUiCheck > 1) {
      lastUiCheck = t;
      renderBubble();
    }
    requestAnimationFrame(frame);
  }

  // --- chatter ---------------------------------------------------------------------

  // Short lines, at most one every 75 s, never over a "needs you".
  // Lines live in i18n.js, per language.
  const LINES = (key) => tr(`lines.${key}`);
  let lastSay = 0;
  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }
  function chatter(kind) {
    if (!kind || !config.chatter || config.quiet || params.has('quiet') || !pet || pet.stage === 'egg') return;
    if (toast || hovering || evolveFx || pose === 'attention' || pose === 'error') return;
    const chance = { green: 0.4, red: 0.5, idle: 1, greet: 1 }[kind] || 0;
    if (Date.now() - lastSay < 75_000 || Math.random() > chance) return;
    let line;
    if (kind === 'greet') {
      const h = new Date().getHours();
      line = pick(LINES(h < 5 || h >= 23 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'));
    } else if (kind === 'idle') {
      line = pick(LINES(pet.nature || 'calm'));
    } else {
      line = pick(LINES(kind));
    }
    lastSay = Date.now();
    pushToast(line, '', 3500, 'say');
  }
  setInterval(() => {
    if (pose === 'idle' && Math.random() < 0.3) chatter('idle');
  }, 40_000);

  // --- bubble, badge, card -------------------------------------------------------

  function pushToast(title, text, ms = 4500, style = 'toast') {
    toasts.push({ title, text, ms, style });
    if (!toast) nextToast();
  }
  function nextToast() {
    const next = toasts.shift();
    toast = next ? { ...next, until: Date.now() + next.ms } : null;
    renderBubble();
  }

  // Status bubbles: a round icon, the session name, a title, one detail
  // line and, when it can jump to the agent's window, an action button.
  const BUBBLE_ICON = { attention: '!', done: '✓', error: '✕', toast: '★', setup: 'i' };
  let bubbleJump = null;
  function setBubble(cls, title, sub, { jump = null, eyebrow = null, action = null } = {}) {
    const b = $('bubble');
    bubbleJump = jump;
    if (!cls) {
      b.hidden = true;
      b.dataset.key = '';
      return;
    }
    const key = [cls, title, sub, jump, eyebrow, action].join('|');
    if (b.dataset.key === key && !b.hidden) return;
    b.dataset.key = key;
    const kind = cls.split(' ')[0];
    const icon = BUBBLE_ICON[kind];
    b.className = [cls, icon ? 'status' : '', jump ? 'jump' : ''].filter(Boolean).join(' ');
    b.textContent = '';
    const add = (tag, klass, text) => {
      const e = document.createElement(tag);
      e.className = klass;
      e.textContent = text;
      b.appendChild(e);
    };
    if (icon) add('span', 'ic', icon);
    if (eyebrow) add('span', 'eyebrow', eyebrow);
    add('span', 'title', title);
    if (sub) add('small', '', sub);
    if (jump) add('span', `btn sm act${kind === 'attention' ? ' primary' : ''}`, action || tr('jump.open'));
    b.hidden = false;
  }

  function renderBubble() {
    const stage = currentSpec().stage;
    const lift = pose === 'attention' ? 38 : 14;
    document.documentElement.style.setProperty('--bubble-bottom', `${Math.min(300, H - headY(stage) + lift)}px`);
    const f = live.focus || {};
    if (toast && toast.style === 'say' && (pose === 'attention' || pose === 'error')) toast = null;
    if (toast) return setBubble(toast.style || 'toast', toast.title, toast.text);
    if (hovering) return setBubble(null);
    if (!connected && !preview) return setBubble(null);
    if (!connected) return setBubble('error', tr('offline'), tr('offline.sub'));
    // Not connected to any agent yet: say how, until it is.
    if (setupInfo && !setupInfo.hooks && !(live.sessions || []).length) return setBubble('setup', tr('setup'), tr('setup.sub'));
    const jump = !demo && f.id ? f.id : null;
    if (pose === 'attention') {
      const waiting = (live.sessions || []).filter((s) => s.state === 'attention');
      const answer = { jump, action: tr('jump.answer') };
      if (waiting.length > 1) return setBubble('attention', tr('needsYou.many', { n: waiting.length }), waiting.map((s) => s.label).join(', '), answer);
      const waited = f.since ? ` · ${clock(Date.now() - f.since)}` : '';
      const long = f.since && Date.now() - f.since > LONG_WAIT_MS && ackedFor !== f.since;
      return setBubble(long ? 'attention long' : 'attention', tr('bubble.needsYou') + waited, trDetail(f.detail), { ...answer, eyebrow: f.label || tr('yourAgent') });
    }
    if (pose === 'error') return setBubble('error', tr('ouch'), f.detail ? trDetail(f.detail) : tr('failed'), { jump, eyebrow: f.label || tr('yourAgent') });
    // The "done" bubble says it once (90 s); after that the pet just looks pleased.
    if (pose === 'done' && now() - poseSince < 90) return setBubble('done', tr('bubble.done'), recapLine(f.recap) || tr('done.sub'), { jump, eyebrow: f.label || tr('yourAgent') });
    return setBubble(null);
  }

  // "3 files · 12 commands · tests ✓ · 2m 10s": what the finished turn did.
  function recapLine(r) {
    if (!r) return '';
    const parts = [];
    if (r.files) parts.push(tr(r.files === 1 ? 'recap.file' : 'recap.files', { n: r.files }));
    if (r.commands) parts.push(tr(r.commands === 1 ? 'recap.command' : 'recap.commands', { n: r.commands }));
    if (r.green || r.red) parts.push(r.red && !r.green ? tr('recap.testsRed') : r.red ? tr('recap.testsMixed', { g: r.green, r: r.red }) : tr('recap.testsGreen'));
    if (!r.files && r.reads) parts.push(tr(r.reads === 1 ? 'recap.read' : 'recap.reads', { n: r.reads }));
    if (r.agents) parts.push(tr(r.agents === 1 ? 'recap.agent' : 'recap.agents', { n: r.agents }));
    if (r.ms > 1500) parts.push(shortDur(r.ms));
    return parts.join(' · ');
  }

  function renderBadge() {
    const badge = $('badge');
    const c = live.counts || {};
    const n = (live.sessions || []).filter((s) => s.state === 'working' || s.state === 'attention').length;
    badge.hidden = n < 2;
    badge.textContent = tr('agents', { n });
    badge.className = c.waiting ? 'waiting' : '';
    badge.title = `${c.working || 0} working, ${c.waiting || 0} waiting for you`;
  }

  let stats = null;
  let statLabels = {};
  let natures = {};
  // Which tab the card shows. An agent waiting for you always wins.
  let cardTab = 'agents';
  try {
    cardTab = localStorage.getItem('openmon.cardTab') || 'agents';
  } catch {}
  function setCardTab(t) {
    cardTab = t;
    try {
      localStorage.setItem('openmon.cardTab', t);
    } catch {}
    renderCard();
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderCard() {
    const card = $('card');
    // Never cover an evolution or a scene message.
    const show = hovering && pet && !evolveFx && !(toast && toast.style === 'scene');
    if (!show) {
      if (!card.hidden && !card.classList.contains('closing')) {
        card.classList.add('closing');
        setTimeout(() => {
          if (card.classList.contains('closing')) {
            card.hidden = true;
            card.classList.remove('closing');
          }
        }, 140);
      }
      return;
    }
    card.classList.remove('closing');
    card.hidden = false;
    card.classList.toggle('pinned', pinned);
    const pinBtn = $('card-pin');
    pinBtn.setAttribute('aria-pressed', String(pinned));
    pinBtn.title = tr(pinned ? 'card.unpin' : 'card.pin');
    pinBtn.setAttribute('aria-label', pinBtn.title);
    $('card-close').title = tr('card.close');
    $('card-close').setAttribute('aria-label', tr('card.close'));

    $('card-name').textContent = pet.shiny && pet.stage !== 'egg' ? `${pet.name} ★` : pet.name;
    $('card-form').textContent = pet.dexNo ? `#${String(pet.dexNo).padStart(3, '0')} ${pet.form}` : pet.form;
    $('card-level').textContent = `Lv ${pet.level || 1}`;
    $('card-stage').textContent = tr(`stage.${pet.stage}`);
    const pr = pet.progress;
    const soon = pr.next && pr.ratio >= 0.9 && !pr.needsBond;
    const nature = natures[pet.nature] ? natures[pet.nature].label : '';
    const quiet = config.quiet && config.quietUntil ? tr('card.quiet', { t: new Date(config.quietUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }) : '';
    const chips = $('card-sub');
    chips.textContent = '';
    for (const [text, cls] of [
      [soon ? tr(pet.stage === 'egg' ? 'card.aboutToHatch' : 'card.evolveSoon') : null, 'sun'],
      [quiet || null, ''],
      [pet.nocturne ? tr('card.night') : null, 'brand'],
      [pet.leaning && pet.stage !== 'mythic' && pet.stage !== 'egg' ? tr('card.leaning', { stat: statLabels[pet.leaning] || pet.leaning }) : null, ''],
      [nature ? tr('card.nature', { nature }) : null, ''],
      [(pet.generation || 1) > 1 ? tr('card.gen', { n: pet.generation }) : null, ''],
    ]) if (text) chips.appendChild(el('span', `chip ${cls}`.trim(), text));

    $('xp-bar').style.width = `${Math.round(pr.ratio * 100)}%`;
    $('xp-text').textContent = !pr.next ? tr('card.max') : pr.needsBond && pr.xpToGo === 0 ? tr('card.needsBond', { n: pr.bondNeeded }) : tr(pet.stage === 'egg' ? 'card.hatchesIn' : 'card.toEvolve', { n: pr.xpToGo });
    $('bond-bar').style.width = `${pet.bond}%`;
    $('bond-text').textContent = `${pet.bond}/100`;

    // Tabs, with a count on Agents (waiting) and Today (missions left).
    const sessions = live.sessions || [];
    const waitingN = sessions.filter((x) => x.state === 'attention').length;
    const missions = (pet.today && pet.today.missions) || [];
    const left = missions.filter((m) => !m.done).length;
    const tab = waitingN ? 'agents' : cardTab;
    for (const [id, label, n] of [['agents', tr('tab.agents'), waitingN], ['today', tr('tab.today'), left], ['stats', tr('tab.stats'), 0]]) {
      const b = $(`tab-${id}`);
      b.textContent = label;
      if (n) b.appendChild(el('span', 'n', String(n)));
      b.setAttribute('aria-selected', String(id === tab));
    }
    for (const sec of card.querySelectorAll('.tab-body')) sec.hidden = sec.dataset.tab !== tab;

    // Agents.
    const list = $('sessions');
    list.textContent = '';
    if (!sessions.length) list.appendChild(el('li', 'empty', tr('noAgents')));
    const order = { attention: 0, working: 1, done: 2, idle: 3 };
    const sorted = [...sessions].sort((a, b) => (order[a.state] ?? 4) - (order[b.state] ?? 4));
    for (const x of sorted.slice(0, 5)) {
      const li = el('li', x.state);
      if (!demo) {
        li.classList.add('jump');
        li.dataset.id = x.id;
        li.title = tr('session.jump');
      }
      const detail = x.state === 'attention' ? trDetail(x.detail) || tr('session.needsYou') : x.state === 'working' ? trDetail(x.detail) || tr('session.working') : tr(x.state === 'done' ? 'session.done' : 'session.idle');
      li.append(el('i', 'dot'), el('b', '', x.label), el('span', '', detail), el('em', 'go', demo ? '' : x.state === 'attention' ? tr('session.go') : '↗'));
      list.appendChild(li);
    }

    // Today.
    const wait = $('card-wait');
    wait.textContent = '';
    if (pet.today && pet.today.waitMs) wait.append(el('b', '', shortDur(pet.today.waitMs)), el('span', '', tr('today.waited')));
    else wait.append(el('span', '', tr('today.noWaits')));
    const ml = $('missions');
    ml.textContent = '';
    ml.hidden = !missions.length;
    if (missions.length) {
      ml.appendChild(el('li', 'head', pet.today.perfect ? tr('missions.perfectHead') : tr('missions.head')));
      for (const m of missions) {
        const li = el('li', m.done ? 'done' : '');
        li.append(el('span', 'mark', m.done ? '✓' : ''), el('span', '', tr(`mission.${m.id}`, { n: m.target })), el('b', '', m.done ? '' : `${m.progress}/${m.target}`));
        ml.appendChild(li);
      }
    }

    // Stats: affinity bars, the weighted share that actually decides the lineage.
    const box = $('stats');
    box.textContent = '';
    if (pet.stage === 'egg') box.appendChild(el('span', 'egg-note', tr('card.eggStats')));
    else {
      const aff = pet.affinity || {};
      const max = Math.max(0.0001, ...Object.values(aff));
      const total = Object.values(aff).reduce((a, b) => a + b, 0) || 1;
      for (const [k, v] of Object.entries(pet.stats)) {
        const d = el('div', k === pet.leaning && v > 0 ? 'top' : '');
        d.title = tr('actions', { n: v, stat: statLabels[k] || k });
        const bar = el('i', `aff aff-${k}`);
        bar.style.setProperty('--w', `${Math.round(((aff[k] || 0) / max) * 100)}%`);
        d.append(el('span', '', statLabels[k] || k), bar, el('em', '', `${Math.round(((aff[k] || 0) / total) * 100)}%`));
        box.appendChild(d);
      }
    }
  }

  function renderAll() {
    renderBubble();
    renderBadge();
    renderCard();
  }

  // --- daemon messages ---------------------------------------------------------

  function onPoseEnter(next) {
    const stage = currentSpec().stage;
    if (evolveFx) return;
    if (next === 'done') {
      burst('confetti', 18, CX, headY(stage) + 10, 1.8, { colors: CONFETTI, gravity: 260 });
      play('done');
    } else if (next === 'attention') {
      // One chime per 20 s at most, however many prompts arrive.
      if (Date.now() - lastChime > 20_000) {
        lastChime = Date.now();
        play('attention');
      }
    } else if (next === 'error') {
      spawn('sweat', CX + radius(stage) * 0.75, headY(stage) + 18, { vx: 6, vy: 12, max: 1.4 });
    }
  }

  function onState(msg) {
    const first = !pet;
    setupInfo = msg.setup || null;
    // Pet size from the settings (a ?scale= in the URL wins, for OBS).
    if (!params.get('scale') && msg.config) document.documentElement.style.setProperty('--scale', String(msg.config.scale || 1));
    if (first) {
      // A brand-new egg explains itself once; everyone else gets a greeting.
      if (msg.pet.stage === 'egg' && msg.pet.counters.tools === 0 && (!msg.setup || msg.setup.hooks)) {
        setTimeout(() => pushToast(tr('intro'), tr('intro.sub'), 7000, 'say'), 1500);
      } else setTimeout(() => chatter('greet'), 2500);
    }
    if (msg.demo && !demo) pushToast(tr('demo'), tr('demo.sub'), 3000);
    demo = msg.demo;
    live = msg.live;
    config = msg.config || config;
    pet = msg.pet;
    const nextFamily = live.family || (live.focus && live.focus.family) || null;
    if (live.pose !== pose) {
      pose = live.pose;
      poseSince = now();
      if (!first) onPoseEnter(pose);
    }
    family = nextFamily;
    renderAll();
  }

  function onEvents(events) {
    const t = now();
    const stage = currentSpec().stage;
    const top = headY(stage);
    let xp = 0;
    let petted = false;
    // The evolution reveal comes first; achievements from the same batch wait for it.
    const evolve = events.find((e) => e.type === 'evolve');
    if (evolve) {
      evolveFx = { start: t, from: specOf(pet), to: { stage: evolve.stage, lineage: evolve.lineage, trait: evolve.trait, chimera: evolve.chimera || null, nocturne: Boolean(evolve.nocturne), shiny: Boolean(evolve.shiny) }, toName: evolve.to, toStage: evolve.stage, shiny: Boolean(evolve.shiny), newDex: evolve.newDex, after: [] };
      const name = pet ? pet.name : 'Your Openmon';
      toasts.length = 0;
      toast = null;
      pushToast(evolve.stage === 'sprout' ? tr('scene.hatching') : tr('scene.evolving', { name }), '', 2400, 'scene');
    }
    for (const e of events) {
      switch (e.type) {
        case 'petted':
          petted = true;
          pettedAt = t;
          for (let i = 0; i < 3; i++) spawn('heart', CX + (i - 1) * 22, top + 6, { vx: (i - 1) * 8, vy: -34, max: 1.3 });
          play('cry');
          break;
        case 'level':
          if (!evolve) {
            spawn('text', CX + 62, GROUND - 70, { text: `Lv ${e.level}!`, vy: -18, max: 1.6, sizePx: 15, color: '#d18b00' });
            burst('spark', 6, CX + 62, GROUND - 76, 2.4, { colors: ['#ffe156', '#fff'], gravity: 120, max: 0.8 });
            play('level');
          }
          break;
        case 'mission':
          pushToast(tr('mission.doneTitle'), `${tr(`mission.${e.id}`, { n: e.target })} · +${e.xp} XP`, 4500);
          play('level');
          break;
        case 'missions-all':
          pushToast(tr('missions.perfect'), `+${e.xp} XP`, 5000, 'scene');
          burst('confetti', 22, CX, GROUND - 80, 2.2, { colors: CONFETTI, gravity: 260 });
          break;
        case 'new-egg':
          pushToast(tr('scene.hall', { name: e.retired.name, form: e.retired.form }), tr('scene.hall.sub', { gen: e.generation }), 6000, 'scene');
          break;
        case 'xp':
          xp += e.amount;
          break;
        case 'tests':
          testFlash = { at: t, passed: e.passed };
          if (e.passed) {
            burst('spark', 10, CX, top + 20, 2.6, { colors: ['#74cc63', '#c3ffa8', '#fff'], gravity: 120 });
            play('green');
          }
          break;
        case 'achievement':
          if (evolveFx && !evolveFx.revealed) evolveFx.after.push([`🏆 ${e.title}`, e.text]);
          else pushToast(`🏆 ${e.title}`, e.text);
          break;
        case 'bond':
          if (!petted) spawn('heart', CX + 30, top + 4, { vy: -26, max: 1.2 });
          break;
        default:
          break;
      }
    }
    // XP floats up in batches, not once per tool call.
    if (xp) {
      pendingXp += xp;
      if (!xpTimer) {
        xpTimer = setTimeout(() => {
          if (!evolveFx) spawn('text', CX - 78, GROUND - 40, { text: `+${pendingXp} XP`, vy: -22, max: 1.2, sizePx: pendingXp >= 5 ? 14 : 12 });
          pendingXp = 0;
          xpTimer = null;
        }, 1200);
      }
    }
    for (const e of events) if (e.type === 'tests') chatter(e.passed ? 'green' : e.passed === false ? 'red' : null);
  }

  function connect() {
    const es = new EventSource('/stream');
    es.onopen = () => {
      connected = true;
      renderAll();
    };
    es.onmessage = (m) => {
      connected = true;
      const msg = JSON.parse(m.data);
      if (msg.type === 'state') onState(msg);
      else if (msg.type === 'events') onEvents(msg.events);
    };
    es.onerror = () => {
      connected = false;
      renderAll();
    };
  }

  // --- input ---------------------------------------------------------------------

  function overPet(x, y) {
    const stage = currentSpec().stage;
    const R = radius(stage);
    const h = OpenmonArt.heightOf(stage, SIZE);
    const cy = GROUND - h / 2;
    return ((x - CX) / (R * 1.45)) ** 2 + ((y - cy) / (h / 2 + 8)) ** 2 <= 1;
  }

  function localPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  function post(path, body) {
    return fetch(path, { method: 'POST', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }).catch(() => {});
  }

  let down = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const p = localPoint(e);
    if (!overPet(p.x, p.y)) return;
    down = { x: e.screenX, y: e.screenY, moved: false };
    canvas.setPointerCapture(e.pointerId);
    if (desktop) desktop.dragStart();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (down && !down.moved && Math.hypot(e.screenX - down.x, e.screenY - down.y) > 5) {
      down.moved = true;
      canvas.classList.add('dragging');
      setHover(false);
    }
  });
  canvas.addEventListener('pointerup', () => {
    if (!down) return;
    if (desktop) desktop.dragEnd();
    canvas.classList.remove('dragging');
    if (!down.moved) {
      // Clicking while it waits means "take me there": it calms down and
      // brings the agent's window to the front.
      if (pose === 'attention' && live.focus) {
        ackedFor = live.focus.since;
        jumpTo(live.focus.id);
      } else post('/api/pet');
    }
    down = null;
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (desktop) desktop.menu();
    else setPinned(!(hovering && pinned));
  });

  // The card opens after resting on the pet, and stays open while the
  // cursor travels up to it (a short grace period), while it is over the
  // card, and for good when pinned.
  let hoverTimer = null;
  let leaveTimer = null;
  const OPEN_MS = 380;
  const GRACE_MS = 650;
  function setHover(on) {
    clearTimeout(hoverTimer);
    clearTimeout(leaveTimer);
    hoverTimer = leaveTimer = null;
    if (!on) pinned = false;
    if (on === hovering) return renderCard();
    hovering = on;
    renderAll();
  }
  function setPinned(on) {
    pinned = on;
    if (on) setHover(true);
    else renderCard();
  }
  function scheduleClose() {
    if (pinned || !hovering || leaveTimer) return;
    leaveTimer = setTimeout(() => {
      leaveTimer = null;
      if (!pinned) setHover(false);
    }, GRACE_MS);
  }
  function keepOpen() {
    clearTimeout(leaveTimer);
    leaveTimer = null;
  }

  // Brings the agent's window (terminal, editor, app) to the front.
  async function jumpTo(id) {
    if (!id || demo) return;
    try {
      const r = await (await fetch('/api/focus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })).json();
      if (!r.ok) pushToast(tr('jump.fail'), tr('jump.failSub'), 4000);
    } catch {}
  }

  // Click-through outside the pet and its UI (desktop).
  let interactive = null;
  let cursor = null;
  document.addEventListener('mousemove', (e) => {
    const p = localPoint(e);
    // Where the cursor is, relative to the pet's face, for its eyes.
    const stage = currentSpec().stage;
    const faceY = GROUND - OpenmonArt.heightOf(stage, SIZE) * 0.55;
    cursor = { x: (p.x - CX) / 110, y: (p.y - faceY) / 110, at: Date.now() };
    const inPet = overPet(p.x, p.y);
    canvas.style.cursor = down ? 'grabbing' : inPet ? 'grab' : 'default';
    const inCard = Boolean(e.target.closest && e.target.closest('#card'));
    const inUi = inCard || Boolean(e.target.closest && e.target.closest('#bubble, #controls'));
    const want = Boolean(inPet || inUi || down);
    if (desktop && want !== interactive) {
      interactive = want;
      desktop.setInteractive(want);
    }
    if (inPet && !down) {
      keepOpen();
      if (!hovering && !hoverTimer) hoverTimer = setTimeout(() => { hoverTimer = null; setHover(true); }, OPEN_MS);
    } else if (inCard) {
      keepOpen();
    } else {
      clearTimeout(hoverTimer);
      hoverTimer = null;
      scheduleClose();
    }
  });
  document.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimer);
    hoverTimer = null;
    scheduleClose();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && hovering) setHover(false);
  });

  $('card-pin').addEventListener('click', () => setPinned(!pinned));
  $('card-close').addEventListener('click', () => setHover(false));
  $('card-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) setCardTab(b.dataset.tab);
  });
  $('sessions').addEventListener('click', (e) => {
    const li = e.target.closest('li.jump');
    if (li) jumpTo(li.dataset.id);
  });
  $('bubble').addEventListener('click', () => {
    if (!bubbleJump) return;
    if (pose === 'attention' && live.focus) ackedFor = live.focus.since;
    jumpTo(bubbleJump);
  });

  // --- preview controls ------------------------------------------------------------

  $('controls').addEventListener('click', (e) => {
    const act = e.target.dataset && e.target.dataset.act;
    if (act === 'demo') post('/api/demo');
    if (act === 'stop') post('/api/demo/stop');
    if (act === 'pet') post('/api/pet');
    if (act === 'mute') post('/api/config', { muted: !config.muted });
  });
  $('force').addEventListener('change', (e) => {
    const [stage, lineage, trait] = e.target.value.split(':');
    force = stage ? { stage, lineage: lineage || null, trait: trait || null } : null;
    renderAll();
  });

  fetch(`/api/species?lang=${window.OpenmonI18n.lang}`)
    .then((r) => r.json())
    .then((s) => {
      statLabels = s.statLabels;
      natures = s.natures || {};
      stats = s.stats;
      const select = $('force');
      const add = (value, label) => {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = label;
        select.appendChild(o);
      };
      add('egg', 'Egg');
      add('sprout', 'Sprout');
      for (const [lineage, forms] of Object.entries(s.lineages)) {
        const trait = stats.find((x) => x !== lineage);
        for (const stage of ['juvenile', 'adult', 'mythic']) add(`${stage}:${lineage}:${trait}`, `${forms[stage]} (${lineage} ${stage})`);
      }
    })
    .catch(() => {});

  if (desktop && desktop.onCommand) {
    desktop.onCommand((cmd) => {
      if (cmd === 'card') setPinned(!(hovering && pinned));
      if (cmd === 'powers') openPowers();
    });
  }

  document.documentElement.lang = window.OpenmonI18n.lang;
  $('lbl-bond').textContent = tr('card.bond');
  $('lbl-powers').textContent = tr('act.powers');
  $('lbl-share').textContent = tr('act.card');
  function openPowers() {
    if (desktop && desktop.openPowers) desktop.openPowers();
    else window.open('/powers.html', '_blank');
  }
  function openPage(page) {
    if (desktop && desktop.openPage) desktop.openPage(page);
    else window.open(`/${page}.html`, '_blank');
  }
  $('card-powers').addEventListener('click', openPowers);
  $('card-dex').addEventListener('click', () => openPage('dex'));
  $('card-share').addEventListener('click', () => openPage('card'));

  OpenmonArt.loadPack();
  connect();
  requestAnimationFrame(frame);
})();
