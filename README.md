<p align="center"><img src="assets/brand/logo-full.svg" alt="Openmon" width="440"></p>

# Openmon

**Português** | [English](README.en.md)

**Um pet de desktop que cresce com o trabalho do seu agente de IA.**

Seu Openmon mora no canto da tela. Ele lê quando o agente lê, martela quando o agente edita, levanta um escudo quando os testes rodam e pula segurando uma placa quando o agente **precisa de você**. Ao longo de dias e semanas ele choca, cresce e evolui para uma de 18 formas (mais uma linhagem escondida que pouca gente vai achar), definida pelo jeito que o seu agente realmente trabalha.

- **Útil antes de tudo.** Você vê de relance quando o Claude Code está esperando uma permissão, terminou ou quebrou algo. Chega de voltar depois de 10 minutos e descobrir que o agente está parado desde o minuto dois.
- **Nunca atrapalha.** Só hooks oficiais (`async`), nada impresso, nada bloqueado, nenhuma tecla simulada. Os cliques atravessam tudo, menos o pet.
- **Gentil.** Ele nunca morre, nunca adoece e nunca perde progresso. Responder rápido ao seu agente é o que fortalece o laço.
- **Privado.** Nenhuma rede além de `127.0.0.1`, sem telemetria, sem conta. Seu pet é um arquivo JSON em `~/.openmon`.

## Começo rápido

```bash
npm install -g openmon
openmon install    # adiciona hooks em ~/.claude/settings.json (com backup)
openmon start      # seu ovo aparece; arraste para onde quiser
openmon demo       # assista a uma sessão roteirizada em um ovo descartável
openmon playground # pet de testes + painel de controle: todas as formas, cenas e estados em minutos
```

Abra uma sessão nova do Claude Code e trabalhe normalmente. O ovo choca durante a sua primeira sessão de verdade.

> O npm 11 pode pedir para aprovar o script de instalação do Electron: `npm install-scripts approve electron`.

## O que ele mostra

| Seu agente | Seu Openmon |
| --- | --- |
| Espera uma permissão ou resposta | Pula com uma placa **!**, balão amarelo com o projeto e a pergunta, um toque suave. Uma notificação do sistema depois de 20 s se você ainda não olhou. |
| Edita arquivos | Martela uma bigorna pequena |
| Lê e pesquisa | Lê um livro |
| Roda comandos no terminal | Digita em um terminalzinho |
| Roda testes | Levanta um escudo; brilha quando passam |
| Navega na web ou chama ferramentas MCP | Olha por uma luneta |
| Roda subagentes | Ajudantes orbitam em volta, um por subagente |
| Compacta o contexto | Mastiga |
| Uma ferramenta falha | Faz careta, gota de suor |
| Termina o turno | Comemora e mostra "terminou ✓" até você responder |
| Nada por 5 minutos | Dorme |

Vários agentes ao mesmo tempo: um contador mostra quantos estão ocupados, a pose segue o mais urgente, e um clique no contador abre o card com o resumo de cada sessão.

## Como ele cresce

Cada ferramenta que o agente termina treina um de seis atributos: **Forja** (edições), **Saber** (leitura, busca), **Terminal** (comandos), **Teste** (rodadas de teste; as verdes valem o triplo), **Viagem** (web, MCP) e **Enxame** (subagentes). Agentes leem muito mais do que navegam, então a linhagem é escolhida por afinidade *ponderada*: trabalho raro vale mais, e toda linhagem é alcançável.

| Estágio | Quando | Forma |
| --- | --- | --- |
| Ovo | primeiro dia | |
| Broto | 30 XP, já na primeira sessão | |
| Jovem | 400 XP, cerca de um dia | o atributo mais alto escolhe a linhagem |
| Adulto | 3 000 XP, cerca de uma semana | o mais alto de novo (pode mudar), mais um traço do segundo atributo |
| Mítico | 15 000 XP e laço 60, cerca de um mês | a forma final, com aura |

| Linhagem | Jovem | Adulto | Mítico |
| --- | --- | --- | --- |
| Forja | Tinkit | Forgemaw | Archsmith |
| Saber | Owlet | Scrollwyrm | Oracle |
| Terminal | Sparkle | Voltcrab | Kernel |
| Teste | Shellby | Bastion | Aegis |
| Viagem | Wisp | Skyfin | Wayfarer |
| Enxame | Mote | Hivekin | Legion |

Se evoluir entre meia-noite e 5 da manhã, ele ganha as cores **Nocturne**: azul meia-noite, barriga de luar e uma lua crescente na testa.

Todo ovo nasce com uma **natureza** (Corajosa, Sonolenta, Curiosa, Alegre, Calma ou Atrevida), que muda como ele fica parado e o que ele fala, e tem **1 chance em 128** de nascer **shiny**, com cores raras que brilham.

As evoluções são como num jogo de portátil: *"O quê? Openmon está evoluindo!"*, a tela escurece, a forma antiga e a nova piscam, vem a revelação, uma fanfarra e o grito da nova forma.

O **laço** (0 a 100) só sobe: responda ao agente em até 30 segundos (+2), faça carinho com um clique (+1, cinco por dia), volte em um novo dia (+1).

O XP tem limite de 120 a cada 10 minutos, então um loop descontrolado não acelera o seu pet.

### Opendex, cartão de treinador, gerações

- **Níveis**: Lv 1–100 numa curva no estilo Pokémon (Lv 9 na primeira evolução, Lv 25 no Adulto, Lv 55 no Mítico). O pet brilha quando uma evolução está perto.
- **Opendex** (`openmon dex`): 22 formas numeradas com anotações de campo, mais suas insígnias. Formas não vistas aparecem como silhuetas, e duas são escondidas: *dizem que o equilíbrio é a chave.*
- **Cartão de treinador** (`openmon card`): uma imagem 1200×630 do seu pet com o radar de atributos, pronta para postar.
- **Gerações**: quando seu Openmon chega ao Mítico, aposente-o no **Hall da Fama** pelo menu. Ele deixa um ovo que herda um décimo dos atributos; a Opendex e as insígnias continuam. Consegue completar a dex?

## Ajudas do dia a dia

- **Clique para responder**: quando um agente espera uma permissão, clique no pet, no balão, na sessão dentro do card ou na notificação do sistema, e a janela onde o agente roda (terminal, VS Code, app do Claude) vem para a frente, pronta para aprovar ou recusar. O hook acha essa janela uma vez por sessão subindo pela própria árvore de processos; nada é enviado para fora.
- **O card**: clique com o botão direito no pet para abrir, e ele fica aberto até você fechar (X, Esc ou outro clique direito). Abas para seus agentes, as missões de hoje e os atributos, mais Poderes, Opendex e cartão de treinador a um clique. A engrenagem no card abre as configurações (nome, sons, falas, notificações, modo silencioso, tamanho), que também ficam no ícone da bandeja.
- **Resumo do turno**: quando um agente termina, o balão diz o que o turno fez: *"shop-api terminou ✓ · 3 arquivos · 12 comandos · testes ✓ · 2m 10s"*.
- **Missões diárias**: três por dia (as mesmas para todo mundo), como "responder ao agente em até 30 s, 3×" ou "3 rodadas de testes verdes". +25 XP e laço cada, +50 por um dia perfeito.
- **Modo silencioso**: 30 minutos, 1 hora ou até amanhã, pelo menu. O pet continua mostrando tudo, em silêncio.
- **Esperas longas**: depois de dois minutos esperando, mais um toque e um cutucão mais forte; o ícone da bandeja ganha um "!" enquanto algum agente espera.
- **Privacidade**: tokens, senhas, chaves de API, cabeçalhos Authorization e credenciais em URLs aparecem mascarados (`•••`) nos balões, notificações e poderes.
- **Tamanho**: pequeno, normal ou grande, pelo menu. As configurações ficam em `~/.openmon/config.json`.

## Poderes: para que serve o seu Openmon

Cada linhagem em que seu Openmon evolui desbloqueia um **poder**, para sempre (a Opendex lembra entre gerações). Abra pelo botão Poderes no card ou pelo menu.

| Poder | Desbloqueado por | Mostra, por sessão do agente |
| --- | --- | --- |
| Diário da forja | Forja | cada arquivo alterado, edições, linhas adicionadas e removidas |
| Lista de leitura | Saber | arquivos lidos e buscas feitas, para você ver onde ele está procurando |
| Diário de comandos | Terminal | cada comando, ✓ ou ✗, quanto tempo levou, um clique para copiar |
| Placar de testes | Teste | cada rodada de teste com a linha de resumo, a sequência de verdes |
| Diário de viagem | Viagem | páginas abertas, buscas na web, ferramentas MCP |
| Visão da colmeia | Enxame | subagentes, ainda rodando ou prontos, e o tempo deles |

Todo mundo também tem o **contador de espera**: quanto tempo seus agentes ficaram esperando por você hoje, sua resposta mais rápida e um cronômetro ao vivo no balão "precisa de você". É o número que um bom pet ajuda a diminuir.

Tudo fica na memória da sua máquina; nada é gravado em disco nem enviado para lugar nenhum.

## Teste tudo agora: o Playground

Criar um Mítico leva semanas. `openmon playground` abre um segundo pet de testes (com save próprio em `~/.openmon-playground`, porta 4748) ao lado do seu, mais um painel de controle: choque e evolua para qualquer uma das 22 formas com a cena de verdade, shiny e Nocturne ligados ou desligados, o Chimera escondido com qualquer par, todos os estados do agente (editando, testes passando ou falhando, subagentes, "precisa de você" de um ou dois agentes), subidas de nível, laço, naturezas, insígnias, Hall da Fama, inglês/português. Feche o painel para encerrar. `--serve` roda no navegador.

## Comandos

```
openmon install      adiciona hooks em ~/.claude/settings.json (com backup)
openmon start        abre o pet
openmon demo         sessão roteirizada em um ovo descartável
openmon stats        seu pet no terminal
openmon name <nome>  renomeia
openmon dex          abre a Opendex
openmon card         abre o cartão de treinador
openmon stop         guarda o pet
openmon autostart on abre o pet ao entrar no sistema (também off / status)
openmon art          pasta e nomes de arquivo de pacotes de arte (veja docs/ART-PACKS.md)
openmon serve        só o daemon: abra http://127.0.0.1:4747/ no navegador ou adicione no OBS
openmon codex        mostra a linha que conecta o Codex CLI
openmon status       estado do daemon e dos hooks
openmon uninstall    remove os hooks (seu pet é mantido)
```

`--settings .claude/settings.json` instala só para um projeto. `OPENMON_PORT` e `OPENMON_HOME` mudam a porta e a pasta de dados.

No pet: **clique** para fazer carinho (ou, enquanto um agente espera por você, para ir até a janela dele), **arraste** para mover, **clique direito** para abrir ou fechar o card; a **engrenagem** do card e o ícone da bandeja abrem o menu (nome, Opendex, cartão de treinador, sons, falas, notificações, iniciar com o computador, demo, sair). Os olhos dele seguem o cursor.

Só pedidos de permissão e perguntas disparam o alarme, com no máximo um toque a cada 20 s. "Esperando sua resposta" depois de um turno terminado só mostra "terminou ✓".

## Idiomas e arte

- Inglês e português do Brasil, escolhidos pelo idioma do sistema (ou `?lang=pt-BR` no navegador). Os nomes das formas são os mesmos em todos os idiomas.
- **Arte oficial**: os 22 Openmons vêm em arte vetorial (`art/official`); `OPENMON_CLASSIC=1` volta para a arte desenhada em código.
- **Pacotes de arte**: coloque imagens com o nome das formas (`craft-adult.png`, `craft-adult.shiny@sleep.svg`…) em `~/.openmon/art` e elas substituem a arte embutida, com movimento, adereços e efeitos ainda aplicados. Guia para artistas: [docs/ART-PACKS.md](docs/ART-PACKS.md).

## Outros agentes

- **Codex CLI**: `openmon codex` mostra uma linha `notify = [...]` para `~/.codex/config.toml`. Hoje o Codex só avisa turnos terminados, então o pet comemora e sobe de nível, mas não mostra ferramentas.
- **Qualquer outro**: faça POST de um sinal para `http://127.0.0.1:4747/event`:
  `{"_agent":"signal","session":"meu-agente","kind":"tool-done","family":"craft"}`.
  Os tipos e famílias estão em [`src/classify.js`](src/classify.js).

## Como funciona

```
Claude Code ──hook (async)──▶ src/hook.js ──POST /event──▶ daemon (127.0.0.1:4747)
                                                             │ classify → sessions → pet engine
                                                             ▼                       │
                                     janela do pet / navegador / OBS ◀── SSE /stream └─▶ ~/.openmon/pet.json
```

- [`classify.js`](src/classify.js): payload do hook vira um sinal pequeno. Uma função por agente.
- [`sessions.js`](src/sessions.js): estado ao vivo por sessão e a pose que mais importa.
- [`pet.js`](src/pet.js): XP, atributos, laço, evolução e conquistas, como funções puras.
- [`species.js`](src/species.js): todos os estágios, linhagens e nomes como dados.
- [`public/art.js`](public/art.js): desenha a arte vetorial oficial (`art/official`), com todas as formas também desenhadas em código como reserva.
- [`src/focus.js`](src/focus.js): acha e traz para a frente a janela onde um agente roda, para o "clique para responder".

`openmon start` roda o pet sob um pequeno supervisor: se o pet morrer sem ter sido mandado sair (um processo de GPU ou de rede que trava pode causar isso em algumas máquinas), ele volta em até dois segundos, e o reinício fica registrado em `~/.openmon/error.log`.

O daemon só escuta em `127.0.0.1` e recusa pedidos de outras páginas web (checagem de Origin e Host), então um site não consegue alimentar nem espionar seu pet. O hook sempre sai com 0 e não imprime nada. Ele desiste depois de 1,5 s, ou 4,5 s no único evento por sessão em que procura a janela do agente (os hooks são async, então o agente nunca espera).

Design do produto, princípios e roadmap: [docs/DESIGN.md](docs/DESIGN.md).

## Desenvolver

```bash
npm install
npm test          # node:test, sem dependências extras
npm run smoke     # carrega todas as páginas em janelas ocultas do Electron, falha em qualquer erro de console
npm run serve     # depois abra http://127.0.0.1:4747/?preview
npm start         # o pet de desktop
```

## Licença

MIT
