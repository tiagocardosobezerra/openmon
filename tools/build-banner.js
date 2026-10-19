#!/usr/bin/env node
'use strict';

// The README animations are drawn by the designer in Portuguese
// (assets/openmon-banner.svg, assets/openmon-dentro.svg). This makes the
// English and Spanish copies by swapping the texts, keeping the same
// timeline and art:
//
//   node tools/build-banner.js            writes assets/*.en.svg and *.es.svg
//   node tools/build-banner.js --check    fails if they are out of date

const fs = require('node:fs');
const path = require('node:path');

const ASSETS = path.join(__dirname, '..', 'assets');
const LANGS = ['en', 'es'];

// [Portuguese, English, Spanish]. Only whole text nodes are swapped.
const COMMON = [
  ['Permitir', 'Allow', 'Permitir'],
  ['Sempre', 'Always', 'Siempre'],
  ['Recusar', 'Deny', 'Rechazar'],
  ['Forja', 'Craft', 'Forja'],
];

const FILES = {
  'openmon-banner.svg': {
    label: {
      en: 'Openmon animation: an egg hatches in the corner of the screen; the creature reads, hammers and tests along with your AI agent; when the agent needs permission it jumps with a sign and you answer with one click; it evolves with the work and becomes a collection of 40 forms, with rare ones and legendaries. Your agent works. Your Openmon grows.',
      es: 'Animación de Openmon: un huevo eclosiona en la esquina de la pantalla; la criatura lee, martillea y prueba junto con tu agente de IA; cuando el agente necesita permiso salta con un cartel y respondes con un clic; evoluciona con el trabajo y se vuelve una colección de 40 formas, con raras y legendarias. Tu agente trabaja. Tu Openmon crece.',
    },
    title: {
      en: 'Openmon: the little creature that keeps your AI agent company',
      es: 'Openmon: la criatura que acompaña a tu agente de IA',
    },
    texts: [
      ['corrija o total do carrinho e publique', 'fix the cart total and publish', 'corrige el total del carrito y publica'],
      ['● Pronto! Total corrigido e versão publicada.', '● Done! Total fixed and version published.', '● ¡Listo! Total corregido y versión publicada.'],
      ['Nível 12', 'Level 12', 'Nivel 12'],
      ['Nível 33', 'Level 33', 'Nivel 33'],
      ['Nível 60', 'Level 60', 'Nivel 60'],
      ['jovem', 'juvenile', 'joven'],
      ['adulto', 'adult', 'adulto'],
      ['ancião', 'elder', 'anciano'],
      ['rumo a Forgemaw', 'next: Forgemaw', 'hacia Forgemaw'],
      ['rumo a Archsmith', 'next: Archsmith', 'hacia Archsmith'],
      ['forma final ✦', 'final form ✦', 'forma final ✦'],
      ['O tipo vem do trabalho que o agente mais faz:', 'Its type comes from the work your agent does most:', 'Su tipo viene del trabajo que más hace tu agente:'],
      ['Saber', 'Lore', 'Saber'],
      ['Teste', 'Test', 'Prueba'],
      ['Escriba', 'Docs', 'Escriba'],
      ['(editar)', '(edit)', '(editar)'],
      ['(ler)', '(read)', '(leer)'],
      ['(testar)', '(test)', '(probar)'],
      ['(documentar)', '(write docs)', '(documentar)'],
      ['★ mais feito', '★ done most', '★ lo que más hace'],
      ['Cada ação do agente vale XP.', 'Every agent action is worth XP.', 'Cada acción del agente vale XP.'],
      ['Todas as formas que seu Openmon pode ter.', 'Every form your Openmon can take.', 'Todas las formas que puede tener tu Openmon.'],
      ['formas vistas', 'forms seen', 'formas vistas'],
      ['☾ Noturno', '☾ Night', '☾ Nocturno'],
      ['★ Lendário', '★ Legendary', '★ Legendario'],
      ['Time · 3 na tela', 'Party · 3 on screen', 'Equipo · 3 en pantalla'],
      ['Precisa de você · alpha', 'Needs you · alpha', 'Te necesita · alpha'],
      ['Quer permissão para rodar: npm publish', 'Wants permission to run: npm publish', 'Pide permiso para ejecutar: npm publish'],
      ['Um bichinho no canto da sua tela.', 'A little creature in the corner of your screen.', 'Una criatura en la esquina de tu pantalla.'],
      ['Ele lê, martela e testa junto com o seu agente.', 'It reads, hammers and tests along with your agent.', 'Lee, martillea y prueba junto con tu agente.'],
      ['Precisa de você? Ele avisa. Um clique e você responde.', 'Needs you? It tells you. One click and you answer.', '¿Te necesita? Te avisa. Un clic y respondes.'],
      ['Ele evolui conforme o trabalho que o agente mais faz.', 'It evolves into the kind of work your agent does most.', 'Evoluciona según el trabajo que más hace tu agente.'],
      ['40 formas, raras e lendárias. Até 3 na tela.', '40 forms, rare ones and legendaries. Up to 3 on screen.', '40 formas, raras y legendarias. Hasta 3 en pantalla.'],
      ['Seu agente trabalha. Seu Openmon cresce.', 'Your agent works. Your Openmon grows.', 'Tu agente trabaja. Tu Openmon crece.'],
      ['40 formas', '40 forms', '40 formas'],
      ['PT · EN · ES', 'EN · PT · ES', 'ES · PT · EN'],
    ],
  },
  'openmon-dentro.svg': {
    label: {
      en: 'How Openmon works inside: AI agents report each step through hooks; a local server at 127.0.0.1:4747 turns each notice into a signal; the pet picks a pose, earns experience and logs what the agent did; everything shows up in the corner of your screen without leaving your computer.',
      es: 'Cómo funciona Openmon por dentro: los agentes de IA avisan cada paso con hooks; un servidor local en 127.0.0.1:4747 convierte cada aviso en una señal; la mascota elige la pose, gana experiencia y anota lo que hizo el agente; todo aparece en la esquina de tu pantalla sin salir de tu computadora.',
    },
    title: {
      en: 'How Openmon works inside',
      es: 'Cómo funciona Openmon por dentro',
    },
    texts: [
      ['Escuta. Cresce. Avisa.', 'Listens. Grows. Tells you.', 'Escucha. Crece. Avisa.'],
      ['1 · O AGENTE AVISA', '1 · THE AGENT REPORTS', '1 · EL AGENTE AVISA'],
      ['Os agentes já avisam o que fazem (hooks).', 'Agents already report what they do (hooks).', 'Los agentes ya avisan lo que hacen (hooks).'],
      ['2 · VIRA SINAL', '2 · IT BECOMES A SIGNAL', '2 · SE VUELVE SEÑAL'],
      ['Um servidor local transforma cada aviso em sinal.', 'A local server turns each notice into a signal.', 'Un servidor local convierte cada aviso en una señal.'],
      ['3 · O PET DECIDE', '3 · THE PET DECIDES', '3 · LA MASCOTA DECIDE'],
      ['Ele decide a pose, ganha XP e anota o que o agente fez.', 'It picks a pose, earns XP and keeps a log of the work.', 'Elige la pose, gana XP y anota lo que hizo el agente.'],
      ['4 · APARECE NA TELA', '4 · IT SHOWS UP ON SCREEN', '4 · APARECE EN PANTALLA'],
      ['Tudo aparece no canto da tela. Nada sai do seu PC.', 'Everything shows up in the corner. Nothing leaves your PC.', 'Todo aparece en la esquina. Nada sale de tu PC.'],
      ['Agentes', 'Agents', 'Agentes'],
      ['Servidor local', 'Local server', 'Servidor local'],
      ['só no seu PC', 'only on your PC', 'solo en tu PC'],
      ['O pet decide', 'The pet decides', 'La mascota decide'],
      ['Pose', 'Pose', 'Pose'],
      ['dormir', 'sleep', 'dormir'],
      ['trabalhar', 'work', 'trabajar'],
      ['pedir ajuda', 'ask for help', 'pedir ayuda'],
      ['comemorar', 'cheer', 'celebrar'],
      ['XP e tipo', 'XP and type', 'XP y tipo'],
      ['Poderes', 'Powers', 'Poderes'],
      ['Diário de arquivos', 'Forge log', 'Diario de archivos'],
      ['Placar de testes', 'Test tracker', 'Marcador de pruebas'],
      ['Diário de consertos', 'Fix log', 'Diario de arreglos'],
      ['Na sua tela', 'On your screen', 'En tu pantalla'],
      ['Precisa de você', 'Needs you', 'Te necesita'],
      ['opcional, ntfy', 'optional, ntfy', 'opcional, ntfy'],
    ],
  },
};

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function translate(name, lang = 'en') {
  const spec = FILES[name];
  const col = LANGS.indexOf(lang) + 1;
  if (!col) throw new Error(`unknown language: ${lang}`);
  let svg = fs.readFileSync(path.join(ASSETS, name), 'utf8');
  svg = svg.replace(/aria-label="[^"]*"/, `aria-label="${escapeXml(spec.label[lang])}"`);
  svg = svg.replace(/<title>[^<]*<\/title>/, `<title>${escapeXml(spec.title[lang])}</title>`);
  // Only whole text nodes are swapped: ">Forja<" changes, "Forjando" never.
  const missing = [];
  for (const row of [...spec.texts, ...COMMON]) {
    const from = `>${escapeXml(row[0])}<`;
    if (!svg.includes(from)) {
      if (spec.texts.includes(row)) missing.push(row[0]);
      continue;
    }
    svg = svg.split(from).join(`>${escapeXml(row[col])}<`);
  }
  if (missing.length) throw new Error(`${name}: texts not found (the designer's file changed?): ${missing.join(' | ')}`);
  return svg.replace(/lang="pt-BR"/g, `lang="${lang}"`);
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const name of Object.keys(FILES)) {
    for (const lang of LANGS) {
      const out = path.join(ASSETS, name.replace(/\.svg$/, `.${lang}.svg`));
      const text = translate(name, lang);
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
  }
  if (stale) process.exit(1);
}

module.exports = { translate, FILES, LANGS };
