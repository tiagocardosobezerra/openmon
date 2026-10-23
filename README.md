# Openmon

**Português** | [English](README.en.md) | [Español](README.es.md)

**Seu agente de IA trabalha. Um bichinho no canto da tela mostra o que ele está fazendo, avisa quando ele precisa de você e cresce com cada tarefa.**

![Node.js 22.12+](https://img.shields.io/badge/node.js-22.12%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Electron](https://img.shields.io/badge/electron-44-47848F?style=flat-square&logo=electron&logoColor=white)
![Claude Code](https://img.shields.io/badge/Claude%20Code-hooks%20oficiais-D97757?style=flat-square&logo=anthropic&logoColor=white)
![100% local](https://img.shields.io/badge/dados-100%25%20local-2ea44f?style=flat-square)
![MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue?style=flat-square)

<img width="100%" alt="Animação do Openmon: um ovo choca no canto da tela, o bichinho lê, martela e testa junto com o agente de IA, pula com uma placa quando precisa de você e evolui com o trabalho. Seu agente trabalha. Seu Openmon cresce." src="assets/openmon-banner.svg" />

## O que ele faz por você

* **Avisa quando o agente precisa de você.** Pedido de permissão ou pergunta: ele pula com uma placa, mostra o projeto e o pedido em palavras simples ("Quer permissão para rodar um comando: npm publish") e toca um som leve. Se você não olhar, chega uma notificação.
* **Leva você até o agente com um clique.** Um clique no pet, no balão ou na notificação traz para a frente a janela onde o agente roda: terminal, VS Code ou o app do Claude.
* **Resume cada tarefa.** Quando o agente termina: "shop-api terminou ✓ · 3 arquivos · 12 comandos · testes ✓ · 2m 10s".

## Instale em 3 passos

1. Baixe o instalador em [Releases](https://github.com/tiagocardosobezerra/openmon/releases/latest): Windows `.exe`, macOS `.dmg` (Apple Silicon) ou Linux `.AppImage`.
2. Abra o Openmon e clique em **Conectar** no balão do ovo. Isso liga o Claude Code.
3. Escolha seu primeiro Openmon: Tinkit (edições), Owlet (leitura e busca) ou Sparkle (comandos). Depois abra uma conversa nova no Claude Code e trabalhe normalmente: o ovo choca durante a sua primeira sessão.

Os avisos do agente rodam com o [Node.js](https://nodejs.org), que quem usa o Claude Code já tem. Os instaladores ainda não são assinados: no Windows, clique em "Mais informações → Executar assim mesmo"; no macOS, clique com o botão direito no app e em "Abrir". Prefere pelo código? Veja [Instalar pelo código](#instalar-pelo-código).

**Privacidade:** tudo fica no seu computador, sem conta e sem internet; o aviso no celular e o GitHub são opcionais.

Por trás disso há um jogo: o ovo choca, cresce e evolui para uma de 39 formas conforme o trabalho do agente. Tipos, itens, acessórios, formas regionais, lendários, habilidades e missões estão em [docs/GAME.md](docs/GAME.md).

## Mais do que ele faz

* **Deixa você responder ali mesmo (opcional).** Ligue "Responder permissões pelo pet" nas configurações e o balão ganha **Permitir** e **Recusar**. O Claude Code espera sua resposta no pet por até 25 segundos; depois disso ele pergunta como sempre. Desligado por padrão.
* **Mostra o que está acontecendo, sem você olhar o terminal.** Martelo é editar, livro é ler, escudo é testar, luneta é web. Vários agentes ao mesmo tempo? O card lista cada um, com o que está fazendo.
* **Guarda um diário.** O que seus agentes fizeram em cada dia, por tipo de trabalho e por projeto, e quanto tempo esperaram por você.
* **Não atrapalha e não sai do seu computador.** Os cliques passam através da janela, ele nunca bloqueia nem atrasa o agente, não usa internet nem conta (a não ser que você ligue o aviso no celular ou o GitHub), e senhas e chaves aparecem escondidas (`•••`).
* **Não se perde.** Ele faz cópias em Documentos/Openmon Backups. Formatou o PC? Numa instalação nova ele pergunta se você quer trazê-lo de volta.
* **Vai com você para outro computador (opcional).** Entre com o GitHub (`openmon login` ou Configurações → Computador) e seu pet fica salvo num Gist secreto da sua conta. Em outro computador, entre com a mesma conta e ele continua de onde parou. Se ele mudou nos dois, o Openmon pergunta qual manter. Sem servidor do Openmon: o app fala direto com o GitHub.

## Como fica na prática

> **Você:** corrige os testes do checkout
>
> **Claude:** lê os arquivos, edita dois deles e pede para rodar `npm publish`.
>
> **O Openmon:** lê um livro, pega o martelo, levanta o escudo… e pula com a placa: **"shop-api precisa de você · Quer permissão para rodar um comando: npm publish"**. Você clica nele, a janela do Claude aparece, você aprova. Ele comemora: **"Terminou! · 2 arquivos · testes ✓"**, e ganha experiência.

<table>
<tr>
<td width="50%" align="center"><img src="docs/screens/pet-attention.pt-BR.png" width="300" alt="O pet pula com a placa: o agente precisa de você"><br><sub>Quando o agente precisa de você</sub></td>
<td width="50%" align="center"><img src="docs/screens/pet-card.pt-BR.png" width="300" alt="O card com os agentes, a experiência e a amizade"><br><sub>Botão direito: o card com seus agentes</sub></td>
</tr>
</table>

| O que ele faz | O que significa |
|---|---|
| Pula segurando a placa **!** | O agente espera sua permissão ou resposta. Clique nele para ir até lá |
| Martelo, livro, terminal, escudo, luneta | O agente está editando, lendo, rodando comandos, testando ou na web |
| Ajudantes voando em volta | O agente chamou outros agentes para ajudar |
| Comemora | O agente terminou: sua vez |
| Faz careta | Algo falhou, como um teste |
| Dorme | Nada acontece há alguns minutos |

## Instalar pelo código

Você precisa do [Node.js](https://nodejs.org) 20 ou mais novo e do [Claude Code](https://claude.com/claude-code).

### 1. Instale

```bash
git clone https://github.com/tiagocardosobezerra/openmon.git
cd openmon
npm install
npm link
```

O `npm link` cria o comando `openmon`. Na primeira vez que o pet abre, o Electron baixa o próprio programa (cerca de 100 MB).

### 2. Ligue no Claude Code

```bash
openmon install
```

Adiciona os avisos (hooks) em `~/.claude/settings.json` e guarda um backup. Só para um projeto: `openmon install --settings .claude/settings.json`. Esqueceu? O próprio ovo mostra um botão **Conectar**.

### 3. Chame seu Openmon

```bash
openmon start
```

O ovo aparece no canto da tela e um ícone surge na bandeja. Abra uma conversa nova no Claude Code e trabalhe normalmente: ele choca durante a sua primeira sessão. Quer ver antes? `openmon demo`.

| Comando | O que faz |
|---|---|
| `openmon start` / `openmon stop` | Abre ou guarda o pet |
| `openmon install` / `openmon uninstall` | Liga ou desliga os avisos do Claude Code (seu pet fica guardado) |
| `openmon demo` | Mostra uma sessão de exemplo num ovo descartável |
| `openmon playground` | Um pet de testes com painel: veja todas as formas e cenas em minutos |
| `openmon dex` / `openmon card` | Abre a Opendex ou o cartão de treinador |
| `openmon name <apelido>` | Dá um apelido (`--clear` volta ao nome da espécie) |
| `openmon backup [arquivo]` / `openmon restore <arquivo\|latest>` | Faz uma cópia ou traz um pet de volta |
| `openmon login` / `openmon sync` / `openmon logout` | Leva seu pet entre computadores pela sua conta do GitHub |
| `openmon install --agent gemini\|cursor\|opencode\|aider` | Liga o Openmon no Gemini CLI, Cursor, OpenCode ou Aider |
| `openmon autostart on\|off` | Abre o pet quando você liga o computador |
| `openmon stats` / `openmon status` | O pet no terminal / se está tudo ligado |

## Utilidades do dia a dia

**Avisos que poupam tempo**
* **Parece travado**: no meio de uma tarefa, sem nenhuma ferramenta rodando e nada acontecendo há 4 minutos. Um clique leva ao agente.
* **Ainda rodando**: um comando (testes, build) rodando há mais de 8 minutos.
* **Em loop**: a mesma falha 3 vezes seguidas.
* **Comando perigoso**: `rm -rf`, `git push --force`, `git reset --hard`, `DROP TABLE`, `curl … | sh` e parecidos deixam o pedido de permissão **vermelho**.
* **Commit**: 30 edições em 45 minutos sem commit ganham um lembrete gentil.
* **Conversa longa**: avisa quando o Claude resume a conversa para continuar.
* **Testes de volta ao verde**: comemora quando testes que falhavam voltam a passar.

**Responder sem sair do que está fazendo**
* **Permitir, Sempre permitir e Recusar** no balão (desligado por padrão). "Sempre permitir" aplica a regra que o próprio Claude Code sugere para aquele pedido.
* **Vários agentes esperando?** O card mostra os botões embaixo de cada um.
* **Atalhos**: `Ctrl+Alt+O` abre o card, `Ctrl+Alt+J` leva ao agente que espera.

**Números do seu trabalho**
* **Tokens** usados hoje (no card) e por dia (no Diário), lidos dos arquivos de conversa do próprio Claude Code, no seu computador.
* **Ontem em uma linha** no primeiro uso do dia.
* **Texto para a daily**: um botão no Diário copia "último dia de trabalho" e "hoje" prontos para colar.
* **Horas por projeto (CSV)**: tempo de trabalho do agente por projeto e dia, para planilha de horas.
* **Linha do tempo** de cada sessão e **busca** em todas ("em que sessão o agente mexeu em cart.ts?").

**Para o seu dia**
* **Modo foco** (25, 50 ou 90 minutos): só "precisa de você" aparece; no fim, uma sugestão de pausa.
* **Lembrete de pausa** depois de 50 ou 90 minutos seguidos de trabalho.
* **Modo apresentação**: troca nomes de projeto por "Projeto A, B…" e esconde comandos em tudo o que o Openmon mostra, para compartilhar a tela.
* **Aviso no celular** (opcional, via app gratuito ntfy): se um agente espera há um tempo, chega um aviso. Manda só "Seu agente precisa de você".
* **No OBS**: o pet com fundo transparente para lives (endereço na página de Configurações).

## Para ir além

### Configurações

Clique com o botão direito no pet e em **Mais**, no pé do card (ou no ícone da bandeja). O menu tem o card, as páginas, o **modo foco**, o **modo silencioso** e as **Configurações**, uma página com seis seções:

* **Pet**: apelido, tamanho, idioma, cores de época, sons, falas, passear pela tela e dividir as conversas entre os Openmons na tela.
* **Avisos**: notificação do sistema e responder permissões pelo pet (com o tempo de espera).
* **Foco e calma**: modo foco, modo silencioso, modo apresentação e lembrete de pausa.
* **Celular**: aviso no celular pelo app ntfy (opcional).
* **Computador**: iniciar com o computador, conectar o Claude Code, seu pet em qualquer computador (conta do GitHub), cópias do pet (fazer agora, exportar, trazer de um arquivo) e voltar o pet ao canto da tela.
* **Avançado**: atalhos de teclado, OBS e demonstração.

### Sua arte

As 39 formas vêm em arte vetorial oficial (`art/official`), com poses, versões brilhantes e noturnas. Para trocar, coloque imagens com o nome da forma (`craft-adult.png`, `craft-adult.shiny@sleep.svg`…) em `~/.openmon/art`. O guia está em [docs/ART-PACKS.md](docs/ART-PACKS.md). `OPENMON_CLASSIC=1` volta para a arte desenhada em código.

### Outros agentes

* **Gemini CLI**: `openmon install --agent gemini`. Mostra ferramentas, testes, fim de tarefa e pedidos de permissão.
* **Cursor**: `openmon install --agent cursor`. Mostra ferramentas, testes e fim de tarefa (o Cursor não avisa quando espera por você).
* **OpenCode**: `openmon install --agent opencode` instala um plugin que mostra ferramentas, fim de tarefa e pedidos de permissão.
* **Aider**: `openmon install --agent aider` mostra o comando para iniciar o Aider com aviso de "sua vez".
* **Codex CLI**: `openmon codex` mostra a linha para colar em `~/.codex/config.toml`. O Codex só avisa tarefas terminadas, então o pet comemora e cresce, mas não mostra as ferramentas.
* **Qualquer outro**: mande um POST para `http://127.0.0.1:4747/event` com `{"_agent":"signal","session":"meu-agente","kind":"tool-done","family":"craft"}`. Os tipos estão em [`src/classify.js`](src/classify.js).

<details>
<summary><strong>Como funciona por dentro</strong></summary>

```
Claude Code ──hook (async)──▶ src/hook.js ──POST /event──▶ daemon (127.0.0.1:4747)
                                                             │ classify → sessions → pet
                                                             ▼                       │
                                     janela do pet / navegador / OBS ◀── SSE /stream └─▶ ~/.openmon/pet.json
```

* [`classify.js`](src/classify.js): transforma o aviso do agente num sinal pequeno.
* [`sessions.js`](src/sessions.js): o estado de cada conversa e a pose que mais importa.
* [`pet.js`](src/pet.js): XP, amizade, evolução, missões, itens e acessórios, como funções puras.
* [`focus.js`](src/focus.js): acha e traz para a frente a janela do agente.
* [`backup.js`](src/backup.js): as cópias em Documentos e a volta numa instalação nova.
* [`public/art.js`](public/art.js): desenha a arte oficial, com olhos que piscam e acessórios no lugar certo.

O servidor só escuta em `127.0.0.1` e recusa pedidos de outras páginas da web (checagem de Origin e Host). O hook nunca imprime nada, sempre sai com 0 e desiste em até 1,5 s. `openmon start` roda o pet com um supervisor que o traz de volta em dois segundos se ele cair.

</details>

## Como funciona por dentro

<img width="100%" alt="Como o Openmon funciona por dentro: os agentes avisam cada passo por hooks, um servidor local em 127.0.0.1:4747 transforma cada aviso em sinal, o pet decide a pose, ganha XP e anota o que o agente fez, e tudo aparece no canto da tela" src="assets/openmon-dentro.svg" />

1. **O agente avisa.** Claude Code, Gemini CLI, Cursor, OpenCode e Aider já avisam cada passo que dão (hooks). O Openmon só escuta, sem bloquear nada.
2. **Vira sinal.** Um servidor local em `127.0.0.1:4747` transforma cada aviso em um sinal simples: ferramenta usada, teste verde ou vermelho, "precisa de você".
3. **O pet decide.** Ele escolhe a pose, ganha experiência no tipo de trabalho certo e anota o que o agente fez nas Habilidades.
4. **Aparece na tela.** Tudo fica no canto da sua tela. Nada sai do seu computador (o aviso no celular e o GitHub são opcionais: um manda só "Seu agente precisa de você", o outro guarda seu pet num Gist secreto da sua conta).

## Desenvolver

```bash
npm install
npm test          # node:test, sem dependências extras
npm run smoke     # abre todas as páginas no Electron escondido e falha em qualquer erro
npm run serve     # depois abra http://127.0.0.1:4747/?preview
npm start         # o pet de desktop
```

Design, princípios e próximos passos: [docs/DESIGN.md](docs/DESIGN.md). Histórico das revisões: [docs/REVIEW-LOG.md](docs/REVIEW-LOG.md).

## Licença

MIT. Openmon é um projeto independente, com criaturas e arte originais.
