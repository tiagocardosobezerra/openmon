// Maps what the agent is doing (pose + tool family) to body language:
// the `anim` object art.js draws. Shared by the pet, the Opendex and the trainer card.

(function () {
  'use strict';

  const WORK = {
    craft: { prop: 'hammer', eyes: 'open', lookX: 0.8, lookY: 0.5 },
    lore: { prop: 'book', eyes: 'open', lookY: 0.9, scan: true },
    shell: { prop: 'terminal', eyes: 'open', lookY: 0.9 },
    test: { prop: 'shield', eyes: 'open', lookX: -0.3 },
    roam: { prop: 'spyglass', eyes: 'open', lookX: 0.9, lookY: -0.5 },
    swarm: { prop: null, eyes: 'open', swarm: true },
    memory: { prop: 'crumbs', eyes: 'happy', mouth: 'chew' },
    null: { prop: 'thought', eyes: 'open', lookX: 0.6, lookY: -0.7 },
  };

  const hop = (phase) => Math.max(0, Math.sin(phase * Math.PI));

  const NATURE_IDLE = {
    brave: { speed: 1.1, look: 1, hop: 13, hopEvery: 4 },
    sleepy: { speed: 0.6, look: 0.6, hop: 4, hopEvery: 14, yawn: true },
    curious: { speed: 1.1, look: 1.6, hop: 7, hopEvery: 7 },
    cheerful: { speed: 1.2, look: 1, hop: 10, hopEvery: 5, bounce: true },
    calm: { speed: 0.8, look: 0.8, hop: 6, hopEvery: 9 },
    cheeky: { speed: 1, look: 1.2, hop: 8, hopEvery: 6, wink: true },
  };

  // s = { pose, family, t, since, stage, progress, subagents, pettedAt, testFlash }
  function poseAnim(s) {
    const t = s.t;
    const age = t - (s.since || 0);
    // A blink every few seconds, sometimes a quick double blink.
    const blink = t % 4.3 < 0.13 || (t + 1.7) % 9.1 < 0.12 || ((t + 1.7) % 9.1 > 0.24 && (t + 1.7) % 9.1 < 0.34);
    const a = { bob: 0, squash: 0, jump: 0, shake: 0, tilt: 0, lookX: 0, lookY: 0, eyes: 'open', mouth: 'smile', prop: null, glow: 0, motes: 0 };

    switch (s.pose) {
      case 'sleep':
        a.eyes = 'closed';
        a.mouth = 'flat';
        a.squash = 0.07 + Math.sin(t * 1.3) * 0.035;
        a.bob = 2;
        break;

      case 'working': {
        const w = WORK[s.family] || WORK.null;
        a.eyes = w.eyes;
        a.prop = w.prop;
        a.mouth = w.mouth || 'smile';
        a.lookX = w.lookX || 0;
        a.lookY = w.lookY || 0;
        a.bob = Math.sin(t * 5) * 1.2;
        if (w.scan) a.lookX = Math.sin(t * 2.4) * 0.8;
        if (s.family === 'craft') a.squash = Math.max(0, -Math.sin(t * 9)) * 0.06;
        if (s.family === 'shell') a.bob = Math.abs(Math.sin(t * 12)) * -1.5;
        if (w.swarm) {
          a.motes = Math.max(2, Math.min(6, s.subagents || 2));
          a.lookX = Math.sin(t * 2.4) * 0.9;
        }
        if (s.subagents && !w.swarm) a.motes = Math.min(6, s.subagents);
        if (s.family === 'craft' || s.family === 'shell' || s.family === 'test') a.brows = 'determined';
        if (blink && a.eyes === 'open') a.eyes = 'blink';
        break;
      }

      case 'attention':
        a.prop = 'sign';
        a.brows = 'up';
        if (s.acked) {
          // You have seen it: hold the sign up and wait patiently.
          a.bob = Math.sin(t * 2) * 1.5;
          a.eyes = 'open';
          a.mouth = 'smile';
          a.glow = 0.25;
          break;
        }
        a.jump = hop((t * 2.2) % 1) * 16;
        a.squash = a.jump < 2 ? 0.08 : -0.05;
        a.eyes = 'wide';
        a.mouth = 'open';
        a.glow = 0.7;
        break;

      case 'error':
        a.eyes = 'hurt';
        a.mouth = 'wobble';
        a.brows = 'worried';
        a.shake = age < 0.7 ? Math.sin(t * 45) * 3 : 0;
        a.tilt = -0.06;
        a.squash = 0.05;
        break;

      case 'done':
        if (age < 2.6) {
          a.jump = hop((age * 2.4) % 1) * 14;
          a.eyes = 'happy';
          a.mouth = 'grin';
        } else {
          a.eyes = blink ? 'blink' : 'happy';
          a.mouth = 'smile';
          a.bob = Math.sin(t * 2) * 1.2;
        }
        break;

      default: {
        // Idle: breathe, look around, a hop now and then. The nature
        // rolled at birth changes the rhythm.
        const n = NATURE_IDLE[s.nature] || NATURE_IDLE.calm;
        const ts = t * n.speed;
        // Breathing you can see, and a slow sway from side to side.
        a.bob = Math.sin(ts * 2) * 1.8 + (n.bounce ? -Math.abs(Math.sin(ts * 4)) * 2.5 : 0);
        a.squash = Math.sin(ts * 2) * 0.035;
        a.tilt = Math.sin(ts * 0.7) * 0.03;
        // Looks around in glances (left, back, up, back) rather than a slow drift.
        const g = (ts * n.look) % 12;
        a.lookX = g < 2 ? -0.9 : g > 5 && g < 7 ? 0.9 : 0;
        a.lookY = g > 9 && g < 10.5 ? -0.8 : 0;
        const cycle = t % n.hopEvery;
        if (cycle < 0.5) a.jump = hop(cycle / 0.5) * n.hop;
        if (blink) a.eyes = 'blink';
        if (n.yawn && t % 11 < 1.2) {
          a.eyes = 'closed';
          a.mouth = 'open';
        }
        if (n.wink && t % 9 < 0.6) {
          a.eyes = 'wink';
          a.mouth = 'grin';
        }
        // Idle acts now and then: a big stretch, a happy spin.
        const stretch = t % 31;
        if (stretch < 1.4) {
          const k = Math.sin((stretch / 1.4) * Math.PI);
          a.squash = -0.13 * k;
          a.eyes = 'closed';
          a.mouth = 'open';
          a.armsUp = true;
        }
        const wiggle = (t + 5) % 17;
        if (wiggle < 0.6) {
          a.tilt = Math.sin(wiggle * 30) * 0.09 * (1 - wiggle / 0.6);
          a.eyes = 'happy';
        }
        const spin = (t + 13) % 43;
        if (spin < 0.9) {
          a.turn = Math.cos((spin / 0.9) * Math.PI * 2);
          a.jump = Math.max(a.jump, Math.sin((spin / 0.9) * Math.PI) * 10);
        }
      }
    }

    // Looks at your cursor when it is near, and beams when you hover it.
    if (s.cursor && s.pose !== 'sleep' && s.pose !== 'attention' && a.eyes !== 'closed') {
      a.lookX = Math.max(-1, Math.min(1, s.cursor.x));
      a.lookY = Math.max(-1, Math.min(1, s.cursor.y));
    }
    if (s.hover && (s.pose === 'idle' || s.pose === 'done')) {
      a.mouth = 'grin';
      if (a.eyes === 'blink') a.eyes = 'open';
    }

    // Reactions layered over the pose.
    if (s.pettedAt != null && t - s.pettedAt < 1.3) {
      const p = t - s.pettedAt;
      a.eyes = 'happy';
      a.mouth = 'grin';
      a.squash = Math.sin(p * 18) * 0.08 * (1 - p / 1.3);
      a.prop = s.pose === 'attention' ? a.prop : null;
    }
    if (s.testFlash && t - s.testFlash.at < 1.6) {
      a.glow = Math.max(a.glow, 1 - (t - s.testFlash.at) / 1.6);
      if (s.testFlash.passed) a.eyes = 'happy';
    }

    if (s.stage === 'egg') {
      a.crack = s.progress || 0;
      a.tilt = s.pose === 'attention' ? Math.sin(t * 14) * 0.16 : s.pose === 'working' ? Math.sin(t * 4) * 0.07 : Math.sin(t * 1.6) * 0.03;
      a.jump = s.pose === 'attention' ? a.jump * 0.5 : 0;
      if (s.pettedAt != null && t - s.pettedAt < 1.3) {
        const p = t - s.pettedAt;
        a.tilt = Math.sin(p * 22) * 0.22 * (1 - p / 1.3);
        a.eyes = 'happy';
      }
      a.prop = null;
      a.motes = 0;
    }
    return a;
  }

  window.OpenmonMotion = { poseAnim };
})();
