'use strict';

// Translations of the game data (stats, natures, badges, Opendex notes).
// Form names are proper nouns and stay the same everywhere.

const PT_BR = {
  statLabels: { craft: 'Forja', lore: 'Saber', shell: 'Terminal', test: 'Teste', roam: 'Viagem', swarm: 'Enxame' },
  natures: {
    brave: { label: 'Corajosa', text: 'Pula bastante e comemora alto.' },
    sleepy: { label: 'Sonolenta', text: 'Cochila sempre que pode e boceja entre as tarefas.' },
    curious: { label: 'Curiosa', text: 'Sempre olhando o que você está fazendo.' },
    cheerful: { label: 'Alegre', text: 'Saltitante, comemora cada pequena vitória.' },
    calm: { label: 'Calma', text: 'Devagar e sempre. Quase nada a surpreende.' },
    cheeky: { label: 'Atrevida', text: 'Pisca para você e faz piada do seu código.' },
  },
  achievements: {
    hatch: { title: 'Olá, mundo', text: 'Seu Openmon nasceu.' },
    'first-green': { title: 'Primeiro verde', text: 'Seu agente fez uma rodada de testes passar.' },
    'first-evolution': { title: 'Crescendo', text: 'Primeira evolução.' },
    'green-100': { title: 'Máquina verde', text: '100 rodadas de testes verdes.' },
    'edits-1000': { title: 'Mil cortes', text: '1.000 edições.' },
    marathon: { title: 'Maratona', text: '50 ações num único pedido ao agente.' },
    swarm: { title: 'Senhor do enxame', text: 'Cinco agentes trabalhando ao mesmo tempo.' },
    'night-owl': { title: 'Coruja', text: 'Seu agente trabalhou entre meia-noite e 5 da manhã.' },
    'quick-hands': { title: 'Mãos rápidas', text: 'Respondeu rápido ao agente 10 vezes num dia.' },
    'best-friends': { title: 'Melhores amigos', text: 'Amizade chegou a 100.' },
    mythic: { title: 'Lenda', text: 'Chegou ao estágio Mítico.' },
    shiny: { title: 'Brilhante!', text: 'Nasceu um Openmon brilhante, chance de 1 em 128.' },
    hidden: { title: 'Quem é esse Openmon?', text: 'Encontrou uma forma oculta.' },
    nocturne: { title: 'Filho da noite', text: 'Evoluiu entre meia-noite e 5 da manhã, com cores Nocturne.' },
  },
  dex: {
    egg: 'Quentinho ao toque. Escuta cada tecla e choca quando já ouviu o bastante.',
    sprout: 'Recém-nascido e curioso. A folha na cabeça vira para o que o agente estiver fazendo.',
    'craft-juvenile': 'Bate em tudo que alcança. Os chifrinhos esquentam depois de uma edição longa.',
    'craft-adult': 'Martela código bruto até tomar forma numa bigorna minúscula. Dorme de óculos de proteção.',
    'craft-mythic': 'Dizem que forjou o primeiro compilador. A coroa de brasas brilha mais a cada build limpo.',
    'lore-juvenile': 'Lê mais rápido do que pisca. Fica ranzinza quando um arquivo é maior do que esperava.',
    'lore-adult': 'Sua cauda é um pergaminho de todo arquivo que já leu. Nunca esquece um número de linha.',
    'lore-mythic': 'O terceiro olho vê o código inteiro de uma vez. Só responde com citações perfeitas.',
    'shell-juvenile': 'A antena estala quando um comando vai rodar. Adora cheiro de terminal novo.',
    'shell-adult': 'Bate as pinças no ritmo do cursor. Consegue mandar qualquer coisa por pipe para qualquer coisa.',
    'shell-mythic': 'Vive no ring zero. Todo processo da máquina se curva quando ele passa.',
    'test-juvenile': 'Se esconde no casco no primeiro teste vermelho, depois espia para tentar de novo.',
    'test-adult': 'Uma muralha que nenhuma regressão atravessou. O casco endurece a cada rodada verde.',
    'test-mythic': 'O escudo dourado transforma falhas em lições. Bugs não nascem perto dele.',
    'roam-juvenile': 'Flutua de página em página em correntes de curiosidade.',
    'roam-adult': 'Nada pela web aberta tão fácil quanto pelo céu. Sempre volta com um link.',
    'roam-mythic': 'Já visitou cada canto da internet e guardou um cartão-postal de cada um.',
    'swarm-juvenile': 'Nunca fica sozinho por muito tempo. Copinhas dele aparecem quando há trabalho demais.',
    'swarm-adult': 'Uma colônia alegre. Cada ajudante cuida de uma tarefa e volta correndo para a colmeia.',
    'swarm-mythic': 'Comanda mil ajudantes com um único pensamento. Sua coroa é feita de motes leais.',
    'chimera-adult': 'Nasce quando dois tipos de trabalho pesam exatamente igual. Cada olho é de um tipo.',
    'chimera-mythic': 'Um equilíbrio perfeito que poucos treinadores alcançam. Pesquisadores discutem de que tipo ele realmente é.',
  },
};

const LOCALES = { 'pt-BR': PT_BR };

function localeOf(lang) {
  return /^pt/i.test(String(lang || '')) ? 'pt-BR' : 'en';
}

// Returns the species payload for /api/species, translated when we can.
function localizeSpecies(base, lang) {
  const t = LOCALES[localeOf(lang)];
  if (!t) return base;
  return {
    ...base,
    statLabels: { ...base.statLabels, ...t.statLabels },
    natures: Object.fromEntries(Object.entries(base.natures).map(([k, v]) => [k, { ...v, ...(t.natures[k] || {}) }])),
    achievements: Object.fromEntries(Object.entries(base.achievements).map(([k, v]) => [k, { ...v, ...(t.achievements[k] || {}) }])),
    dex: base.dex.map((e) => ({ ...e, text: t.dex[e.key] || e.text })),
  };
}

module.exports = { localizeSpecies, localeOf };
