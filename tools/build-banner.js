#!/usr/bin/env node
'use strict';

// The README animations are drawn by the designer in Portuguese
// (assets/openmon-banner.svg, assets/openmon-dentro.svg). This makes the
// English copies by swapping the texts, keeping the same timeline and art:
//
//   node tools/build-banner.js            writes assets/*.en.svg
//   node tools/build-banner.js --check    fails if they are out of date

const fs = require('node:fs');
const path = require('node:path');

const ASSETS = path.join(__dirname, '..', 'assets');

const COMMON = [
  ['Permitir', 'Allow'],
  ['Sempre', 'Always'],
  ['Recusar', 'Deny'],
  ['Forja', 'Craft'],
];

const FILES = {
  'openmon-banner.svg': {
    label: 'Openmon animation: an egg hatches in the corner of the screen; the creature reads, hammers and tests along with your AI agent; when the agent needs permission it jumps with a sign and you answer with one click; it evolves with the work and becomes a collection of 40 forms, with rare ones and legendaries. Your agent works. Your Openmon grows.',
    title: 'Openmon: the little creature that keeps your AI agent company',
    texts: [
      ['corrija o total do carrinho e publique', 'fix the cart total and publish'],
      ['● Pronto! Total corrigido e versão publicada.', '● Done! Total fixed and version published.'],
      ['Nível 12', 'Level 12'],
      ['Nível 33', 'Level 33'],
      ['Nível 60', 'Level 60'],
      ['jovem', 'juvenile'],
      ['adulto', 'adult'],
      ['mítico', 'mythic'],
      ['rumo a Forgemaw', 'next: Forgemaw'],
      ['rumo a Archsmith', 'next: Archsmith'],
      ['forma final ✦', 'final form ✦'],
      ['O tipo vem do trabalho que o agente mais faz:', 'Its type comes from the work your agent does most:'],
      ['Saber', 'Lore'],
      ['Teste', 'Test'],
      ['Escriba', 'Docs'],
      ['(editar)', '(edit)'],
      ['(ler)', '(read)'],
      ['(testar)', '(test)'],
      ['(documentar)', '(write docs)'],
      ['★ mais feito', '★ done most'],
      ['Cada ação do agente vale XP.', 'Every agent action is worth XP.'],
      ['Todas as formas que seu Openmon pode ter.', 'Every form your Openmon can take.'],
      ['formas vistas', 'forms seen'],
      ['☾ Noturno', '☾ Night'],
      ['★ Lendário', '★ Legendary'],
      ['Time · 3 na tela', 'Party · 3 on screen'],
      ['Precisa de você · alpha', 'Needs you · alpha'],
      ['Quer permissão para rodar: npm publish', 'Wants permission to run: npm publish'],
      ['Um bichinho no canto da sua tela.', 'A little creature in the corner of your screen.'],
      ['Ele lê, martela e testa junto com o seu agente.', 'It reads, hammers and tests along with your agent.'],
      ['Precisa de você? Ele avisa. Um clique e você responde.', 'Needs you? It tells you. One click and you answer.'],
      ['Ele evolui conforme o trabalho que o agente mais faz.', 'It evolves into the kind of work your agent does most.'],
      ['40 formas, raras e lendárias. Até 3 na tela.', '40 forms, rare ones and legendaries. Up to 3 on screen.'],
      ['Seu agente trabalha. Seu Openmon cresce.', 'Your agent works. Your Openmon grows.'],
      ['40 formas', '40 forms'],
      ['PT · EN · ES', 'EN · PT · ES'],
    ],
  },
  'openmon-dentro.svg': {
    label: 'How Openmon works inside: AI agents report each step through hooks; a local server at 127.0.0.1:4747 turns each notice into a signal; the pet picks a pose, earns experience and logs what the agent did; everything shows up in the corner of your screen without leaving your computer.',
    title: 'How Openmon works inside',
    texts: [
      ['Escuta. Cresce. Avisa.', 'Listens. Grows. Tells you.'],
      ['1 · O AGENTE AVISA', '1 · THE AGENT REPORTS'],
      ['Os agentes já avisam o que fazem (hooks).', 'Agents already report what they do (hooks).'],
      ['2 · VIRA SINAL', '2 · IT BECOMES A SIGNAL'],
      ['Um servidor local transforma cada aviso em sinal.', 'A local server turns each notice into a signal.'],
      ['3 · O PET DECIDE', '3 · THE PET DECIDES'],
      ['Ele decide a pose, ganha XP e anota o que o agente fez.', 'It picks a pose, earns XP and keeps a log of the work.'],
      ['4 · APARECE NA TELA', '4 · IT SHOWS UP ON SCREEN'],
      ['Tudo aparece no canto da tela. Nada sai do seu PC.', 'Everything shows up in the corner. Nothing leaves your PC.'],
      ['Agentes', 'Agents'],
      ['Servidor local', 'Local server'],
      ['só no seu PC', 'only on your PC'],
      ['O pet decide', 'The pet decides'],
      ['Pose', 'Pose'],
      ['dormir', 'sleep'],
      ['trabalhar', 'work'],
      ['pedir ajuda', 'ask for help'],
      ['comemorar', 'cheer'],
      ['XP e tipo', 'XP and type'],
      ['Poderes', 'Powers'],
      ['Diário de arquivos', 'Forge log'],
      ['Placar de testes', 'Test tracker'],
      ['Diário de consertos', 'Fix log'],
      ['Na sua tela', 'On your screen'],
      ['Precisa de você', 'Needs you'],
      ['opcional, ntfy', 'optional, ntfy'],
    ],
  },
};

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function translate(name) {
  const spec = FILES[name];
  let svg = fs.readFileSync(path.join(ASSETS, name), 'utf8');
  svg = svg.replace(/aria-label="[^"]*"/, `aria-label="${escapeXml(spec.label)}"`);
  svg = svg.replace(/<title>[^<]*<\/title>/, `<title>${escapeXml(spec.title)}</title>`);
  // Only whole text nodes are swapped: ">Forja<" changes, "Forjando" never.
  const missing = [];
  for (const [pt, en] of [...spec.texts, ...COMMON]) {
    const from = `>${escapeXml(pt)}<`;
    if (!svg.includes(from)) {
      if (spec.texts.some(([p]) => p === pt)) missing.push(pt);
      continue;
    }
    svg = svg.split(from).join(`>${escapeXml(en)}<`);
  }
  if (missing.length) throw new Error(`${name}: texts not found (the designer's file changed?): ${missing.join(' | ')}`);
  return svg.replace(/lang="pt-BR"/g, 'lang="en"');
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const name of Object.keys(FILES)) {
    const out = path.join(ASSETS, name.replace(/\.svg$/, '.en.svg'));
    const text = translate(name);
    if (check) {
      if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== text) {
        console.error(`out of date: ${path.basename(out)}`);
        stale++;
      }
    } else {
      fs.writeFileSync(out, text);
      console.log(path.relative(process.cwd(), out));
    }
  }
  if (stale) process.exit(1);
}

module.exports = { translate, FILES };
