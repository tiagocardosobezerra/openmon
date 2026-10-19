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
  // ?companion=<id>: another Openmon of the team standing next to the main
  // one. It shows its own project's work (sleeping, working, cheering,
  // waiting) but no bubbles, card, toasts or sounds: those stay with the
  // main pet.
  const companionId = params.get('companion');
  const preview = params.has('preview');
  if (preview) {
    document.body.classList.add('preview');
    // ?bare: the preview without its buttons (README screenshots).
    $('controls').hidden = params.has('bare');
  }
  if (params.get('scale')) document.documentElement.style.setProperty('--scale', String(Number(params.get('scale')) || 1));

  const canvas = $('pet');
  const ctx = canvas.getContext('2d');
  const W = 280;
  const H = 250;
  const GROUND = 222;
  const CX = 140;
  const SIZE = 46;
  // The focus form's aura ring, and how far into it the pet is (0..1).
  const auraFocus = new Image();
  auraFocus.src = '/ui/aura-focus.svg';
  let focusK = 0;
  const STAGE_SCALE = { egg: 0.78, sprout: 0.66, juvenile: 0.82, adult: 1, mythic: 1.08 };
  const now = () => performance.now() / 1000;
  // The pet strolls a little when it has nothing to do; petX is how far
  // from the middle it is right now.
  let petX = 0;
  let walkTo = 0;
  let nextStroll = 12;
  const petCX = () => CX + petX;
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let setupInfo = null;
  let live = { pose: 'sleep', sessions: [], counts: {}, focus: null };
  let pet = null;
  // How many Openmons the team has (a companion always has company).
  let teamSize = companionId ? 2 : 1;
  let config = { muted: false };
  let demo = false;
  let connected = false;
  let pose = 'sleep';
  let poseSince = 0;
  let family = null;
  let pettedAt = null;
  let munchUntil = 0;
  let testFlash = null;
  let evolveFx = null;
  let force = null;
  // The card opens with a right-click; ?hover opens it at start (screenshots, smoke test).
  let hovering = params.has('hover');
  let lastZ = 0;
  let lastSpark = 0;
  const particles = [];
  let ackedFor = null;
  let restoreOffer = null;
  // Permission requests the pet can answer (only with the setting on).
  let permissions = [];
  // "Give it a nickname?" after hatching, until answered or for 2 minutes.
  let nicknameOffer = null;
  // The bubble you clicked (Answer / Open): it stays hidden for as long as
  // that same bubble would show. Each bubble has a stable id (kind, session,
  // when it started), so ticking timers and other agents' events do not
  // bring it back; a different bubble ends the dismissal.
  let dismissed = null;
  let bubbleId = null;
  function dismissBubble() {
    if (pose === 'attention' && live.focus) ackedFor = live.focus.since;
    dismissed = bubbleId;
    renderBubble();
  }
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

  // Season colours in February, October and December (Settings can turn
  // them off).
  const SEASONS = { 1: 'fev', 9: 'out', 11: 'dez' };
  function seasonNow() {
    return config && config.seasons === false ? null : SEASONS[new Date().getMonth()] || null;
  }
  function specOf(p) {
    if (!p) return { stage: 'egg', lineage: null, trait: null };
    return { stage: p.stage, lineage: p.lineage, trait: p.trait, chimera: p.chimera || null, nocturne: Boolean(p.nocturne), shiny: Boolean(p.shiny) && p.stage !== 'egg', wear: p.wear || null, region: p.region || null, legend: p.legend || null, friend: Boolean(p.friend), season: seasonNow() };
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
          burst('spark', 18, petCX(), GROUND - 60, Math.PI * 2, { colors: ['#fff', '#ffe156', '#c7baff'], gravity: 60 });
          burst('confetti', 26, petCX(), GROUND - 70, 2.2, { colors: CONFETTI, gravity: 260 });
          play('evolve');
          setTimeout(() => play('cry'), 650);
          const name = pet ? pet.name : 'Your Openmon';
          const dexLine = evolveFx.newDex && pet ? tr('scene.newDex', { no: String(pet.dexNo).padStart(3, '0') }) : '';
          toast = null;
          if (evolveFx.toStage === 'sprout') {
            nicknameOffer = { until: Date.now() + 120_000 };
            // After the nickname question, where to find help.
            tip('help', tr('tip.help'), tr('tip.help.sub'), 130_000);
            if (evolveFx.shiny) burst('spark', 24, petCX(), GROUND - 50, Math.PI * 2, { colors: ['#fffbe0', '#ffe156'], gravity: 40, max: 1.8 });
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
    // Eating a snack or a candy: crumbs and a chewing mouth.
    if (t < munchUntil && showPose !== 'attention') {
      anim.prop = 'crumbs';
      anim.mouth = 'chew';
      anim.eyes = 'happy';
    }
    if (reducedMotion) {
      anim.jump *= 0.3;
      anim.shake = 0;
      anim.turn = 1;
    }
    if (evolveFx) anim.glow = 1;
    // About to evolve: a soft pulse, so the moment does not come out of nowhere.
    else if (pet && pet.progress && pet.progress.ratio >= 0.9 && pet.progress.next && !pet.progress.needsBond) {
      if (spec.stage === 'egg') anim.tilt += Math.sin(t * 9) * 0.04;
      else anim.glow = Math.max(anim.glow, 0.3 + Math.sin(t * 3) * 0.2);
    }

    const walking = Math.abs(walkTo - petX) > 0.5 && !evolveFx;
    if (walking && !reducedMotion) {
      anim.turn = walkTo > petX ? 1 : -1;
      anim.jump = Math.max(anim.jump || 0, Math.abs(Math.sin(t * 9)) * 3.5);
      anim.lookX = anim.turn * 0.9;
      anim.tilt = Math.sin(t * 9) * 0.04;
    }
    if (silhouette <= 0) {
      ctx.save();
      ctx.translate(petCX(), GROUND);
      // Focus form: a long request (50+ actions) makes it bigger, inside
      // the designer's aura ring, until the request ends.
      const focusForm = showPose === 'working' && live.counts && live.counts.longTurn >= 50 && spec.stage !== 'egg';
      focusK += ((focusForm ? 1 : 0) - focusK) * 0.06;
      if (focusK > 0.01) {
        const k = 1 + focusK * 0.18;
        if (auraFocus.complete && auraFocus.naturalWidth) {
          const r = SIZE * 1.9 * k;
          ctx.save();
          ctx.translate(0, -SIZE * 0.95 * k);
          ctx.rotate(reducedMotion ? 0 : t * 0.4);
          ctx.globalAlpha = focusK * (0.75 + Math.sin(t * 3) * 0.15);
          ctx.drawImage(auraFocus, -r, -r, r * 2, r * 2);
          ctx.restore();
        }
        ctx.scale(k, k);
      }
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

  let emote = null;
  let nearSince = null;
  let lastEmote = 0;
  function showEmote(glyph, t, ms = 1800) {
    // "Chatter" off, quiet or focus mode: no little bubbles either.
    if (evolveFx || toast || !config.chatter || config.quiet || config.focus) return;
    emote = { glyph, at: t, until: t + ms / 1000 };
    lastEmote = t;
  }
  const NATURE_EMOTE = { curious: '?', cheerful: '♥', brave: '♥', calm: '♪', sleepy: '…', cheeky: '!?' };

  function drawEmote(t) {
    if (!emote || t > emote.until || hovering) {
      emote = null;
      return;
    }
    const stage = currentSpec().stage;
    const k = Math.min(1, (t - emote.at) / 0.18);
    const fade = Math.min(1, (emote.until - t) / 0.3);
    const x = petCX() + radius(stage) * 0.95;
    const y = headY(stage) - 4 - (1 - k) * 6;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(x, y);
    ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
    ctx.beginPath();
    ctx.roundRect(-14, -24, 28, 22, 9);
    ctx.moveTo(-6, -2);
    ctx.lineTo(-10, 6);
    ctx.lineTo(1, -2);
    ctx.fillStyle = '#fffdf7';
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#2a2140';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.fillStyle = emote.glyph === '♥' ? '#ff5d8f' : '#2a2140';
    ctx.font = '700 14px Fredoka, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emote.glyph, 0, -12.5);
    ctx.restore();
  }

  // Strolling and moods, decided a few times a second.
  function life(t, dt) {
    const idle = pose === 'idle' && !hovering && !down && !evolveFx && !(toast && toast.style === 'scene');
    if (!idle) walkTo = 0;
    else if (t > nextStroll && !reducedMotion && config.stroll !== false) {
      // A few steps to one side, a rest, then maybe back.
      walkTo = Math.abs(walkTo) > 10 && Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 16);
      nextStroll = t + 14 + Math.random() * 18;
    }
    const speed = idle ? 16 : 60;
    const step = Math.sign(walkTo - petX) * Math.min(Math.abs(walkTo - petX), speed * dt);
    if (step) {
      petX += step;
      document.documentElement.style.setProperty('--pet-x', `${petX.toFixed(1)}px`);
    }
    // The cursor resting near it: it reacts in character.
    const near = cursor && Date.now() - cursor.at < 1500 && Math.hypot(cursor.x, cursor.y) < 1.3;
    if (!near || pose !== 'idle') nearSince = null;
    else if (nearSince == null) nearSince = t;
    else if (t - nearSince > 2.2 && t - lastEmote > 18) showEmote(NATURE_EMOTE[pet && pet.nature] || '♪', t);
    // Humming now and then while idle.
    if (pose === 'idle' && t - lastEmote > 45 && Math.random() < dt / 30) showEmote(pet && pet.nature === 'sleepy' ? '…' : '♪', t);
  }

  function ambient(t) {
    const stage = currentSpec().stage;
    const R = radius(stage);
    if (pose === 'sleep' && t - lastZ > 1.4) {
      lastZ = t;
      spawn('z', petCX() + R * 0.7, headY(stage) + 10, { vx: 10, vy: -16, max: 2.2 });
    }
    if (pose === 'working' && family === 'craft' && stage !== 'egg' && Math.sin(t * 9) > 0.97 && t - lastSpark > 0.4) {
      lastSpark = t;
      burst('spark', 3, petCX() + R * 1.3, GROUND - R * 0.3, 1.6, { max: 0.5, gravity: 300 });
    }
  }

  let lastFrame = now();
  // A pet that sits on screen all day must be cheap: full frame rate only
  // while something is happening, less when idle, little while asleep, and
  // nothing when the window is hidden.
  function targetFps(t) {
    if (document.hidden) return 0;
    if (evolveFx || particles.length || down || hovering || toast || emote || Math.abs(walkTo - petX) > 0.5) return 60;
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
    life(t, dt);
    ambient(t);
    drawPet(t, dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawParticles(dt);
    drawEmote(t);
    if (toast && Date.now() > toast.until) nextToast();
    const f = live.focus;
    if (pose === 'attention' && f && f.since && ackedFor !== f.since && Date.now() - f.since > LONG_WAIT_MS && renudged !== f.since) {
      renudged = f.since;
      play('attention');
      burst('spark', 10, petCX(), GROUND - 90, Math.PI * 2, { colors: ['#ffe156', '#fff'], gravity: 80 });
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
  function tip(id, title, sub, delayMs = 0) {
    if (!config || (config.tips || []).includes(id) || demo || params.has('quiet')) return false;
    config.tips = [...(config.tips || []), id];
    setTimeout(() => pushToast(title, sub, 7000, 'say'), delayMs);
    post('/api/config', { tipSeen: id });
    return true;
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
    if (companionId) return;
    toasts.push({ title, text, ms, style });
    if (!toast) nextToast();
  }
  function nextToast() {
    const next = toasts.shift();
    toast = next ? { ...next, until: Date.now() + next.ms } : null;
    renderBubble();
  }

  // Commands that can destroy work, shown in red in a permission request.
  const DANGER = [
    /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b/i, /\bgit\s+push\b.*(--force\b|\s-f\b)/i, /\bgit\s+reset\s+--hard\b/i, /\bgit\s+clean\s+-[a-z]*f/i,
    /\bdrop\s+(table|database|schema)\b/i, /\btruncate\s+table\b/i, /\bdelete\s+from\s+\w+\s*;?\s*$/i, /\bmkfs\b/i, /\bdd\s+if=/i,
    /\bchmod\s+-R\s+777\b/i, /\bRemove-Item\b.*-Recurse\b.*-Force\b/i, /\bdel\s+\/[sq]\b/i, /\bformat\s+[a-z]:/i, /(curl|wget)[^|]*\|\s*(sudo\s+)?(sh|bash)\b/i,
  ];
  const isDanger = (text) => DANGER.some((re) => re.test(String(text || '')));

  // Status bubbles: a round icon, the session name, a title, one detail
  // line and, when it can jump to the agent's window, an action button.
  const BUBBLE_ICON = { attention: '!', done: '✓', error: '✕', toast: '★', setup: 'i', restore: '↺', warn: '?', notice: 'i' };
  let bubbleJump = null;
  function setBubble(cls, title, sub, { jump = null, eyebrow = null, action = null, choices = null, note = null, id = null } = {}) {
    const b = $('bubble');
    // A toast or the card in between (no id) keeps the dismissal; another
    // agent bubble, or no agent bubble at all (see renderBubble), ends it.
    if (cls && id && id === dismissed) cls = null;
    else if (dismissed && id && id !== dismissed) dismissed = null;
    bubbleId = cls ? id : null;
    bubbleJump = cls ? jump : null;
    if (!cls) {
      b.hidden = true;
      b.dataset.key = '';
      return;
    }
    // The title is left out of the key: it carries the waiting clock, which
    // ticks every second. Rebuilding the bubble each second swapped its
    // buttons under the cursor, so a click on "Open" could get lost.
    const key = [cls, sub, jump, eyebrow, action, choices && choices.id].join('|');
    if (b.dataset.key === key && !b.hidden) {
      // Same bubble: only the clock and the countdown change, in place.
      const t = b.querySelector('.title');
      if (t && t.textContent !== title) t.textContent = title;
      const n = b.querySelector('.note');
      if (n && note) n.textContent = note;
      return;
    }
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
    if (choices) {
      // Allow / Deny, right on the bubble.
      const row = document.createElement('span');
      row.className = 'choices';
      const options = [['allow', tr('perm.allow'), 'primary'], ['deny', tr('perm.deny'), '']];
      if (choices.canAlways) options.splice(1, 0, ['always', tr('perm.always'), '']);
      for (const [act, label, style] of options) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `btn sm ${style}`.trim();
        b.dataset.decide = act;
        b.textContent = label;
        row.appendChild(b);
      }
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'btn sm ghost';
      go.dataset.decide = 'open';
      go.textContent = tr('jump.open');
      row.appendChild(go);
      b.appendChild(row);
      if (note) add('span', 'note', note);
    } else if (jump) add('span', `btn sm act${kind === 'attention' || kind === 'restore' ? ' primary' : ''}`, action || tr('jump.open'));
    b.hidden = false;
  }

  function renderBubble() {
    // Where the bubble and the card sit, just above the pet's head: the
    // same rule for a companion, so every Openmon's card lines up.
    const stage = currentSpec().stage;
    const lift = pose === 'attention' ? 38 : 14;
    document.documentElement.style.setProperty('--bubble-bottom', `${Math.min(300, H - headY(stage) + lift)}px`);
    if (companionId) return setBubble(null);
    const f = live.focus || {};
    if (toast && toast.style === 'say' && (pose === 'attention' || pose === 'error')) toast = null;
    // Focus mode: only "needs you" (and its answer buttons) gets through.
    if (config.focus && pose !== 'attention' && !restoreOffer) {
      if (toast && toast.style !== 'scene') toast = null;
      return setBubble(null);
    }
    // First of all: a fresh install found a backup; offer to bring that pet back.
    if (restoreOffer) {
      const o = restoreOffer;
      return setBubble('restore', tr('restore.title'), tr('restore.sub', { name: o.name, form: o.form, level: o.level, date: new Date(o.savedAt).toLocaleDateString() }), { jump: 'restore', action: tr('restore.action') });
    }
    if (toast) return setBubble(toast.style || 'toast', toast.title, toast.text);
    if (nicknameOffer && Date.now() < nicknameOffer.until && pet && !pet.nickname && pose !== 'attention') {
      return setBubble('toast', tr('nick.title', { form: pet.form }), tr('nick.sub'), { jump: 'nickname', action: tr('nick.action') });
    }
    if (hovering) return setBubble(null);
    if (!connected && !preview) return setBubble(null);
    if (!connected) return setBubble('error', tr('offline'), tr('offline.sub'));
    // Not connected to any agent yet: say how, until it is.
    if (setupInfo && !setupInfo.hooks && !(live.sessions || []).length) {
      // On the desktop one click connects; in a browser, the command.
      return desktop && desktop.installHooks ? setBubble('setup', tr('setup'), tr('setup.click'), { jump: 'install', action: tr('setup.action') }) : setBubble('setup', tr('setup'), tr('setup.sub'));
    }
    const jump = !demo && f.id ? f.id : null;
    if (pose === 'attention') {
      const waiting = (live.sessions || []).filter((s) => s.state === 'attention');
      const answer = { jump, action: tr('jump.answer'), id: `attention|${waiting.length > 1 ? waiting.map((s) => s.id).join(',') : f.id}|${f.since}` };
      if (waiting.length > 1) return setBubble('attention', tr('needsYou.many', { n: waiting.length }), waiting.map((s) => s.label).join(', '), answer);
      const waited = f.since ? ` · ${clock(Date.now() - f.since)}` : '';
      const long = f.since && Date.now() - f.since > LONG_WAIT_MS && ackedFor !== f.since;
      const pending = permissions.find((p) => p.session === f.id);
      const danger = isDanger(f.detail) || (pending && isDanger(pending.detail));
      const title = danger ? tr('danger.title') : tr('bubble.needsYou');
      const cls = danger ? 'attention danger' : long ? 'attention long' : 'attention';
      if (pending) {
        const left = Math.max(0, Math.ceil((pending.until - Date.now()) / 1000));
        return setBubble(cls, title, trDetail(pending.detail || f.detail), { jump, eyebrow: f.label || tr('yourAgent'), choices: pending, note: danger ? tr('danger.note') : tr('perm.note', { s: left }), id: answer.id });
      }
      return setBubble(cls, title + waited, trDetail(f.detail), { ...answer, eyebrow: f.label || tr('yourAgent') });
    }
    if (pose === 'error') return setBubble('error', tr('ouch'), f.detail ? trDetail(f.detail) : tr('failed'), { jump, eyebrow: f.label || tr('yourAgent'), id: `error|${f.id}|${f.since}` });
    // Mid-task and silent for minutes, or one command running very long.
    const stuck = (live.sessions || []).find((x) => x.stuck);
    if (stuck && pose !== 'done') return setBubble('warn', tr('stuck.title', { t: clock(stuck.stuck) }), tr('stuck.sub'), { jump: demo ? null : stuck.id, eyebrow: stuck.label, id: `stuck|${stuck.id}` });
    const longTool = (live.sessions || []).find((x) => x.longTool);
    if (longTool && pose === 'working') return setBubble('warn', tr('longTool.title', { t: clock(longTool.longTool.ms) }), trDetail(longTool.longTool.detail), { jump: demo ? null : longTool.id, eyebrow: longTool.label, id: `long|${longTool.id}|${longTool.longTool.detail}` });
    // The "done" bubble says it once (90 s); after that the pet just looks pleased.
    if (pose === 'done' && now() - poseSince < 90) return setBubble('done', tr('bubble.done'), recapLine(f.recap) || tr('done.sub'), { jump, eyebrow: f.label || tr('yourAgent'), id: `done|${f.id}|${f.since}` });
    // Nothing to say about the agents: whatever was dismissed is over.
    dismissed = null;
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
  let statWeights = {};
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

  // 1234567 -> "1.2 M" (in the user's language).
  function compact(n) {
    return new Intl.NumberFormat(window.OpenmonI18n.lang, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
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
    const gear = $('card-settings');
    gear.hidden = !desktop;
    gear.title = tr('card.settings');
    gear.setAttribute('aria-label', gear.title);
    $('card-close').title = tr('card.close');
    $('card-close').setAttribute('aria-label', tr('card.close'));

    $('card-name').textContent = pet.shiny && pet.stage !== 'egg' ? `${pet.name} ★` : pet.name;
    // The species line only when a nickname takes the title.
    const dexNo = pet.dexNo ? `#${String(pet.dexNo).padStart(3, '0')}` : '';
    $('card-form').textContent = pet.nickname ? `${dexNo} ${pet.form}`.trim() : dexNo;
    $('card-level').textContent = tr('card.level', { n: pet.level || 1 });
    $('card-level').title = tr('card.levelHelp');
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
      [config.focus && config.focusUntil ? tr('card.focus', { t: new Date(config.focusUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }) : null, 'sun'],
      [pet.nocturne ? tr('card.night') : null, 'brand'],
      [pet.leaning && pet.stage !== 'mythic' && pet.stage !== 'egg' ? tr('card.leaning', { stat: statLabels[pet.leaning] || pet.leaning }) : null, ''],
      [pet.holding === 'everstone' ? tr(pr.next && pet.xp >= 0 && pr.ratio >= 1 ? 'card.everstoneReady' : 'card.everstone') : null, 'brand'],
      // Legendaries and mystery eggs have no project of their own.
      // With a team, every card names its project (the first Openmon has none).
      [pet.legend ? tr('party.legendTag') : pet.project && /^mystery:/.test(pet.project) ? tr('party.mysteryTag') : pet.project ? tr('party.project', { project: pet.project }) : teamSize > 1 ? tr('party.general') : null, 'brand'],
      [pet.region ? tr('region.chip', { region: tr(`region.${pet.region}`) }) : null, ''],
      [nature ? tr('card.nature', { nature }) : null, ''],
      [(pet.generation || 1) > 1 ? tr('card.gen', { n: pet.generation }) : null, ''],
    ]) if (text) chips.appendChild(el('span', `chip ${cls}`.trim(), text));

    $('xp-bar').style.width = `${Math.round(pr.ratio * 100)}%`;
    $('xp-text').textContent = !pr.next ? tr('card.max') : pr.needsBond && pr.xpToGo === 0 ? tr('card.needsBond', { n: pr.bondNeeded }) : tr(pet.stage === 'egg' ? 'card.hatchesIn' : 'card.toEvolve', { n: pr.xpToGo.toLocaleString(window.OpenmonI18n.lang) });
    // What the two bars mean, for anyone new to games.
    $('xp-bar').parentElement.parentElement.title = tr('meter.xp.help');
    $('bond-bar').parentElement.parentElement.title = tr('meter.bond.help');
    $('bond-bar').style.width = `${pet.bond}%`;
    $('bond-text').textContent = `${pet.bond}/100`;

    // Tabs, with a count on Agents (waiting) and Today (missions left).
    const sessions = live.sessions || [];
    const waitingN = sessions.filter((x) => x.state === 'attention').length;
    const missions = (pet.today && pet.today.missions) || [];
    const left = missions.filter((m) => !m.done).length;
    const tab = cardTab;
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
      // A permission the pet can answer: Allow / Deny on the row itself.
      const req = permissions.find((p) => p.session === x.id);
      if (req) {
        const row = el('li', 'perm-row');
        for (const [act, label, style] of [['allow', tr('perm.allow'), 'primary'], ...(req.canAlways ? [['always', tr('perm.always'), '']] : []), ['deny', tr('perm.deny'), '']]) {
          const b = el('button', `btn sm ${style}`.trim(), label);
          b.type = 'button';
          b.dataset.perm = req.id;
          b.dataset.decision = act;
          row.appendChild(b);
        }
        list.appendChild(row);
      }
    }

    // Today.
    const wait = $('card-wait');
    wait.textContent = '';
    if (pet.today && pet.today.waitMs) wait.append(el('b', '', shortDur(pet.today.waitMs)), el('span', '', tr('today.waited')));
    else wait.append(el('span', '', tr('today.noWaits')));
    if (pet.streak && pet.streak.days > 1) wait.append(el('span', 'chip sun streak', tr('today.streak', { n: pet.streak.days })));
    // Tokens today, one line under the waiting time.
    const oldTk = document.getElementById('card-tokens');
    if (oldTk) oldTk.remove();
    if (pet.today && pet.today.tokens) {
      const tk = el('div', 'card-wait tokens');
      tk.id = 'card-tokens';
      tk.title = tr('today.tokensHelp');
      tk.append(el('b', '', compact(pet.today.tokens)), el('span', '', tr('today.tokens')));
      wait.after(tk);
    }
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
    $('stat-info').hidden = pet.stage === 'egg';
    if (!$('stat-info').classList.contains('on')) $('stat-info').textContent = tr('stats.hint');
    if (pet.stage === 'egg') box.appendChild(el('span', 'egg-note', tr('card.eggStats')));
    else {
      const aff = pet.affinity || {};
      const max = Math.max(0.0001, ...Object.values(aff));
      const total = Object.values(aff).reduce((a, b) => a + b, 0) || 1;
      // The six first types always show; the newer ones (Docs, Git…) appear
      // once the agent has done that kind of work, so the card stays short.
      const CLASSIC = new Set(['craft', 'lore', 'shell', 'test', 'roam', 'swarm']);
      for (const [k, v] of Object.entries(pet.stats)) {
        if (!CLASSIC.has(k) && !v) continue;
        const d = el('div', k === pet.leaning && v > 0 ? 'top' : '');
        d.dataset.stat = k;
        d.dataset.n = v;
        d.tabIndex = 0;
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
      setTimeout(() => pose === 'done' && showEmote('♪', now()), 3000);
      burst('confetti', 18, petCX(), headY(stage) + 10, 1.8, { colors: CONFETTI, gravity: 260 });
      play('done');
    } else if (next === 'attention') {
      tip('jump', tr('tip.jump'), tr('tip.jump.sub'), 6000);
      // One chime per 20 s at most, however many prompts arrive.
      if (Date.now() - lastChime > 20_000) {
        lastChime = Date.now();
        play('attention');
      }
    } else if (next === 'error') {
      spawn('sweat', petCX() + radius(stage) * 0.75, headY(stage) + 18, { vx: 6, vy: 12, max: 1.4 });
    }
  }

  // The pose of a companion: what its own project's agent is doing.
  function companionLive(all, project) {
    const mine = (all.sessions || []).filter((s) => project && s.label === project);
    const pick = (st) => mine.find((s) => s.state === st);
    const s = pick('attention') || pick('working') || pick('done') || null;
    const poseOf = { attention: 'attention', working: 'working', done: 'done' };
    return { pose: s ? poseOf[s.state] : mine.length ? 'idle' : 'sleep', focus: s ? { id: s.id, label: s.label, detail: s.detail, since: 0 } : null, sessions: mine, counts: {}, family: null };
  }

  function onState(msg) {
    if (companionId) {
      const c = msg.companions && msg.companions[companionId];
      if (!c) return;
      pet = c;
      config = { ...(msg.config || config), muted: true, chatter: false };
      live = companionLive(msg.live, c.project);
      if (!params.get('scale') && msg.config) document.documentElement.style.setProperty('--scale', String(msg.config.scale || 1));
      if (live.pose !== pose) {
        pose = live.pose;
        poseSince = now();
      }
      // Its card (right-click) stays up to date like the main pet's.
      renderAll();
      return;
    }
    const first = !pet;
    setupInfo = msg.setup || null;
    restoreOffer = msg.restoreOffer || null;
    permissions = msg.permissions || [];
    // Pet size from the settings (a ?scale= in the URL wins, for OBS).
    if (!params.get('scale') && msg.config) document.documentElement.style.setProperty('--scale', String(msg.config.scale || 1));
    if (first) {
      // A brand-new egg explains itself once; everyone else gets a greeting.
      if (msg.restoreOffer) {
        // The restore offer speaks first.
      } else if (msg.pet.stage === 'egg' && msg.pet.counters.tools === 0 && (!msg.setup || msg.setup.hooks)) {
        setTimeout(() => pushToast(tr('intro'), tr('intro.sub'), 7000, 'say'), 1500);
      } else setTimeout(() => chatter('greet'), 2500);
      // Teach the right-click once, after the hello.
      config = msg.config || config;
      tip('rightclick', tr('tip.rightclick'), tr('tip.rightclick.sub'), 10_000);
    }
    if (msg.demo && !demo) pushToast(tr('demo'), tr('demo.sub'), 3000);
    demo = msg.demo;
    live = msg.live;
    // Focus just ended: say so, and suggest a short break.
    const wasFocus = Boolean(config && config.focus);
    config = msg.config || config;
    if (wasFocus && !config.focus && config.focusUntil && Date.now() >= config.focusUntil - 1000) pushToast(tr('focus.done'), tr('focus.doneSub'), 8000, 'scene');
    pet = msg.pet;
    teamSize = msg.party ? msg.party.members.length + msg.party.box.length : 1;
    const nextFamily = live.family || (live.focus && live.focus.family) || null;
    if (live.pose !== pose) {
      pose = live.pose;
      poseSince = now();
      if (!first) onPoseEnter(pose);
    }
    family = nextFamily;
    renderAll();
  }

  function onEvents(all) {
    if (companionId) all = all.filter((e) => e.petId === companionId).map((e) => ({ ...e, petId: null }));
    // Another pet of your party (its project's work): a toast, no scene.
    const others = all.filter((e) => e.petId && pet && e.petId !== pet.id);
    for (const e of others) {
      if (e.type === 'evolve') pushToast(tr('party.evolved', { name: e.petName || e.from, form: e.to }), tr('party.project', { project: e.project }), 5000);
    }
    const events = all.filter((e) => !others.includes(e));
    const t = now();
    const stage = currentSpec().stage;
    const top = headY(stage);
    let xp = 0;
    let petted = false;
    // The evolution reveal comes first; achievements from the same batch wait for it.
    const evolve = events.find((e) => e.type === 'evolve');
    if (evolve) {
      evolveFx = { start: t, from: specOf(pet), to: { stage: evolve.stage, lineage: evolve.lineage, trait: evolve.trait, chimera: evolve.chimera || null, nocturne: Boolean(evolve.nocturne), shiny: Boolean(evolve.shiny), friend: Boolean(evolve.friend), region: evolve.region || null, wear: pet && pet.wear, season: seasonNow() }, toName: evolve.to, toStage: evolve.stage, shiny: Boolean(evolve.shiny), newDex: evolve.newDex, after: [] };
      const name = pet ? pet.name : 'Your Openmon';
      toasts.length = 0;
      toast = null;
      pushToast(evolve.stage === 'sprout' ? tr('scene.hatching') : tr('scene.evolving', { name }), '', 2400, 'scene');
    }
    const newWear = events.filter((e) => e.type === 'cosmetic');
    if (newWear.length > 1) {
      pushToast(tr('toast.cosmeticMany', { n: newWear.length }), newWear.map((e) => tr(`wear.${e.id}`)).join(', '), 6000);
      play('level');
    }
    for (const e of events) {
      switch (e.type) {
        case 'petted':
          petted = true;
          pettedAt = t;
          for (let i = 0; i < 3; i++) spawn('heart', petCX() + (i - 1) * 22, top + 6, { vx: (i - 1) * 8, vy: -34, max: 1.3 });
          play('cry');
          break;
        case 'level':
          if (!evolve) {
            spawn('text', petCX() + 62, GROUND - 70, { text: `Lv ${e.level}!`, vy: -18, max: 1.6, sizePx: 15, color: '#d18b00' });
            burst('spark', 6, petCX() + 62, GROUND - 76, 2.4, { colors: ['#ffe156', '#fff'], gravity: 120, max: 0.8 });
            play('level');
          }
          break;
        case 'cosmetic':
          if (newWear.length > 1) break;
          pushToast(tr('toast.cosmetic', { item: tr(`wear.${e.id}`) }), tr('toast.cosmeticSub'), 5000);
          burst('spark', 14, petCX(), top - 10, Math.PI * 2, { colors: ['#ffe156', '#fff', '#ff7fa3'], gravity: 60 });
          play('level');
          break;
        case 'item':
          if (e.item !== 'snack') pushToast(tr('toast.item', { item: tr(`item.${e.item}`) }), tr(`item.${e.item}.text`), 4500);
          break;
        case 'fed':
          setTimeout(() => showEmote('♥', now()), 1700);
          pettedAt = t;
          munchUntil = t + 1.6;
          for (let i = 0; i < 3; i++) spawn('heart', petCX() + (i - 1) * 22, top + 6, { vx: (i - 1) * 8, vy: -34, max: 1.3 });
          if (e.item === 'candy') burst('spark', 16, petCX(), top, Math.PI * 2, { colors: ['#7c6cf2', '#fff', '#ffe156'], gravity: 40 });
          play('level');
          break;
        case 'hold':
          if (e.holding && e.holding.startsWith('stone-')) pushToast(tr('toast.holdStone', { type: tr(`power.${e.holding.slice(6)}`) }), tr('toast.holdStoneSub'), 4500);
          else pushToast(tr(e.holding ? 'toast.hold' : 'toast.letGo'), tr(e.holding ? 'toast.holdSub' : 'toast.letGoSub'), 4500);
          break;
        case 'stone-used':
          setTimeout(() => pushToast(tr('toast.stone', { type: tr(`power.${e.lineage}`) }), tr('toast.stoneSub'), 5000), 3200);
          break;
        case 'charm':
          pushToast(tr('toast.charm'), tr('toast.charmSub'), 4500);
          burst('spark', 14, petCX(), top, Math.PI * 2, { colors: ['#ffe156', '#fff', '#7c6cf2'], gravity: 40 });
          play('level');
          break;
        case 'legend':
          pushToast(tr('toast.legend', { name: e.id.charAt(0).toUpperCase() + e.id.slice(1) }), tr(e.place === 'box' ? 'toast.legendBox' : 'toast.legendSub'), 8000, 'scene');
          burst('spark', 24, petCX(), top - 10, Math.PI * 2, { colors: ['#ffe156', '#fff', '#a9dcff'], gravity: 30 });
          play('level');
          break;
        case 'mystery-hatch':
          pushToast(tr('toast.mystery'), tr('toast.mysterySub'), 6000);
          play('level');
          break;
        case 'wear':
          burst('spark', 10, petCX(), top - 6, Math.PI * 2, { colors: ['#ffe156', '#fff'], gravity: 50 });
          break;
        case 'yesterday': {
          const y = e.entry;
          const tests = (y.green || 0) + (y.red || 0);
          const bits = [tr('journal.tools', { n: y.tools }), y.turns ? tr('journal.turns', { n: y.turns }) : null, tests ? tr('yesterday.tests', { p: Math.round(((y.green || 0) / tests) * 100) }) : null, y.tokens ? tr('yesterday.tokens', { n: compact(y.tokens) }) : null].filter(Boolean);
          setTimeout(() => pushToast(tr('yesterday.title'), bits.join(' · '), 7000), 9000);
          break;
        }
        case 'daily-gift':
          setTimeout(() => pushToast(tr('gift.title'), e.streak > 1 ? tr('gift.streak', { n: e.streak }) : tr('gift.sub'), 5000), 2500);
          break;
        case 'project-egg':
          pushToast(tr('party.newEgg', { project: e.project }), tr(e.place === 'box' ? 'party.newEggBox' : 'party.newEggSub'), 6000);
          play('level');
          break;
        case 'switched':
          pushToast(tr('party.switched', { project: e.project }), '', 3000);
          break;
        case 'tests-fixed':
          pushToast(tr('fixed.title'), e.label, 4500, 'done');
          burst('confetti', 14, petCX(), GROUND - 80, 2, { colors: ['#5ccf74', '#fff', '#ffe156'], gravity: 260 });
          break;
        case 'loop':
          pushToast(tr('loop.title', { n: e.n }), `${e.label} · ${trDetail(e.detail)}`, 9000, 'notice');
          play('attention');
          break;
        case 'compact':
          pushToast(tr('compact.title'), tr('compact.sub', { label: e.label }), 6000, 'notice');
          break;
        case 'commit-nudge':
          pushToast(tr('commit.title', { n: e.edits }), tr('commit.sub', { label: e.label, t: shortDur(e.ms) }), 8000, 'notice');
          break;
        case 'break':
          if (!config.focus) pushToast(tr('break.title', { n: e.minutes }), tr('break.sub'), 9000, 'say');
          break;
        case 'restored':
          pushToast(tr('restore.done', { name: e.name }), tr('restore.doneSub'), 6000, 'scene');
          burst('confetti', 26, petCX(), GROUND - 80, 2.2, { colors: CONFETTI, gravity: 260 });
          play('level');
          break;
        case 'mission':
          pushToast(tr('mission.doneTitle'), `${tr(`mission.${e.id}`, { n: e.target })} · +${e.xp} XP`, 4500);
          play('level');
          break;
        case 'missions-all':
          pushToast(tr('missions.perfect'), `+${e.xp} XP`, 5000, 'scene');
          burst('confetti', 22, petCX(), GROUND - 80, 2.2, { colors: CONFETTI, gravity: 260 });
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
            burst('spark', 10, petCX(), top + 20, 2.6, { colors: ['#74cc63', '#c3ffa8', '#fff'], gravity: 120 });
            play('green');
          }
          break;
        case 'achievement':
          if (evolveFx && !evolveFx.revealed) evolveFx.after.push([`🏆 ${e.title}`, e.text]);
          else pushToast(`🏆 ${e.title}`, e.text);
          break;
        case 'bond':
          if (!petted) spawn('heart', petCX() + 30, top + 4, { vy: -26, max: 1.2 });
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
          if (!evolveFx) spawn('text', petCX() - 78, GROUND - 40, { text: `+${pendingXp} XP`, vy: -22, max: 1.2, sizePx: pendingXp >= 5 ? 14 : 12 });
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
    return ((x - petCX()) / (R * 1.45)) ** 2 + ((y - cy) / (h / 2 + 8)) ** 2 <= 1;
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
      if (companionId) {
        if (pose === 'attention' && live.focus) jumpTo(live.focus.id);
        else post('/api/pet', { id: companionId });
      } else if (pose === 'attention' && live.focus) {
        const id = live.focus.id;
        dismissBubble();
        jumpTo(id);
      } else post('/api/pet');
    }
    down = null;
  });
  // The press can end without a pointerup (the system took the pointer, a
  // menu opened): stop dragging anyway, or the window keeps chasing the mouse.
  const dropDrag = () => {
    if (!down) return;
    if (desktop) desktop.dragEnd();
    canvas.classList.remove('dragging');
    down = null;
  };
  canvas.addEventListener('pointercancel', dropDrag);
  canvas.addEventListener('lostpointercapture', () => setTimeout(dropDrag, 0));
  window.addEventListener('blur', dropDrag);
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    setHover(!hovering);
  });

  // The card opens with a right-click on the pet (or a click on the agent
  // counter) and stays until closed: X, Esc, another right-click, or
  // dragging the pet. A waiting agent opens it on the Agents tab.
  function setHover(on, tab = null) {
    if (on && !hovering) {
      const waiting = (live.sessions || []).some((x) => x.state === 'attention');
      if (tab || waiting) cardTab = tab || 'agents';
    } else if (on && tab) cardTab = tab;
    if (on === hovering) return renderCard();
    hovering = on;
    renderAll();
  }

  // Brings the agent's window (terminal, editor, app) to the front.
  async function jumpTo(id) {
    if (!id || demo) return;
    try {
      const r = await (await fetch('/api/focus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })).json();
      if (!r.ok) pushToast(tr('jump.fail'), tr('jump.failSub'), 4000, 'error');
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
    const inUi = Boolean(e.target.closest && e.target.closest('#card, #bubble, #badge, #controls'));
    const want = Boolean(inPet || inUi || down);
    if (desktop && want !== interactive) {
      interactive = want;
      desktop.setInteractive(want);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && hovering) setHover(false);
  });

  $('card-settings').addEventListener('click', () => desktop && desktop.menu());
  $('badge').addEventListener('click', () => setHover(!(hovering && cardTab === 'agents'), 'agents'));
  $('card-close').addEventListener('click', () => setHover(false));
  $('card-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) setCardTab(b.dataset.tab);
  });
  // Stats tab: pointing at a stat explains how your agent trains it.
  function statInfo(row) {
    const info = $('stat-info');
    if (!row) {
      info.textContent = tr('stats.hint');
      info.classList.remove('on');
      return;
    }
    const k = row.dataset.stat;
    info.textContent = '';
    const name = el('b', `aff-name aff-${k}`, statLabels[k] || k);
    info.append(name, ' ', tr('stats.row', { how: tr(`type.${k}.how`), w: statWeights[k] || 1, n: row.dataset.n }));
    info.classList.add('on');
  }
  $('stats').addEventListener('mouseover', (e) => statInfo(e.target.closest('[data-stat]')));
  $('stats').addEventListener('focusin', (e) => statInfo(e.target.closest('[data-stat]')));
  $('stats').addEventListener('mouseleave', () => statInfo(null));

  $('sessions').addEventListener('click', (e) => {
    const answer = e.target.closest && e.target.closest('[data-perm]');
    if (answer) {
      post('/api/permission/decide', { id: answer.dataset.perm, decision: answer.dataset.decision });
      permissions = permissions.filter((p) => p.id !== answer.dataset.perm);
      renderCard();
      return;
    }
    const li = e.target.closest('li.jump');
    if (li) jumpTo(li.dataset.id);
  });
  $('bubble').addEventListener('click', (e) => {
    const decide = e.target.closest && e.target.closest('[data-decide]');
    if (decide) {
      const pending = live.focus && permissions.find((p) => p.session === live.focus.id);
      if (decide.dataset.decide === 'open' || !pending) {
        const id = bubbleJump;
        dismissBubble();
        return jumpTo(id);
      }
      post('/api/permission/decide', { id: pending.id, decision: decide.dataset.decide });
      permissions = permissions.filter((p) => p !== pending);
      dismissBubble();
      if (decide.dataset.decide === 'allow') showEmote('♥', now());
      return;
    }
    if (!bubbleJump) return;
    if (bubbleJump === 'install') {
      desktop.installHooks();
      pushToast(tr('setup.done'), tr('setup.doneSub'), 6000, 'say');
      return;
    }
    if (bubbleJump === 'nickname') {
      nicknameOffer = null;
      if (desktop && desktop.openName) desktop.openName();
      else window.open('/name.html', '_blank', 'width=340,height=170');
      renderBubble();
      return;
    }
    if (bubbleJump === 'restore') {
      post('/api/restore', { file: 'latest' });
      return;
    }
    const id = bubbleJump;
    dismissBubble();
    jumpTo(id);
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
      statWeights = s.weights || {};
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
      // Names arrived after the first draw: draw the card again with them.
      renderAll();
    })
    .catch(() => {});

  if (desktop && desktop.onCommand) {
    desktop.onCommand((cmd) => {
      if (cmd === 'card') setHover(!hovering);
      if (cmd === 'powers') openPowers();
    });
  }

  document.documentElement.lang = window.OpenmonI18n.lang;
  if (!preview || params.has('lang')) post('/api/config', { lang: window.OpenmonI18n.lang });
  $('lbl-bond').textContent = tr('card.bond');
  $('lbl-powers').textContent = tr('act.powers');
  $('lbl-bag').textContent = tr('act.bag');
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
  $('card-bag').addEventListener('click', () => openPage('bag'));

  OpenmonArt.loadPack();
  connect();
  requestAnimationFrame(frame);
})();
