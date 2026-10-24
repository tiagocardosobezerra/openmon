# Openmon

**Português** | [English](README.en.md) | [Español](README.es.md)

**Seu agente de IA parou para pedir permissão e você nem viu? O Openmon é um bichinho no canto da tela que avisa na hora em que o agente espera por você, e você responde com um clique.**

![Node.js 22.12+](https://img.shields.io/badge/node.js-22.12%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Electron](https://img.shields.io/badge/electron-44-47848F?style=flat-square&logo=electron&logoColor=white)
![Claude Code](https://img.shields.io/badge/Claude%20Code-hooks%20oficiais-D97757?style=flat-square&logo=anthropic&logoColor=white)
![100% local](https://img.shields.io/badge/dados-100%25%20local-2ea44f?style=flat-square)
![MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue?style=flat-square)

<img width="100%" alt="Animação do Openmon: um ovo choca no canto da tela; o bichinho lê, martela e testa junto com o agente de IA; quando o agente precisa de permissão, ele pula com uma placa e você responde com um clique; ele também é o seu assistente: você pede um lembrete numa caixinha ao lado dele, e na hora ele avisa; ele evolui com o trabalho e vira uma coleção de 39 formas, com brilhantes e lendários. Seu agente trabalha. Seu Openmon cresce e te ajuda." src="assets/openmon-banner.svg" />

Agentes como o Claude Code trabalham sozinhos por minutos, mas param em silêncio quando precisam de você: uma permissão, uma pergunta, o fim da tarefa. Você volta meia hora depois e ele estava esperando desde o começo. O Openmon acompanha cada conversa e chama você só quando importa.

## O que ele faz por você

* **Avisa quando o agente precisa de você.** Pedido de permissão ou pergunta: ele pula com uma placa, mostra o projeto e o pedido em palavras simples ("Quer permissão para rodar um comando: npm publish") e toca um som leve. Se você não olhar, chega uma notificação.
* **Deixa você responder e falar com o agente ali mesmo.** Com o Claude Code, o balão ganha **Permitir** e **Recusar** nos pedidos de permissão e as opções de cada pergunta do agente; **Mensagem** escreve para a conversa que o pet acompanha, e ela chega na hora se o agente estiver parado. O Claude Code espera sua resposta no pet por até 25 segundos; depois disso ele pergunta como sempre. Nada é aprovado sozinho: só o seu clique responde. Dá para desligar em Configurações → "Responder pelo pet".
* **Leva você até o agente com um clique.** Um clique no pet, no balão ou na notificação traz para a frente a janela onde o agente roda: terminal, VS Code ou o app do Claude.
* **Mostra o que está acontecendo, sem você olhar o terminal.** Martelo é editar, livro é ler, escudo é testar, luneta é web. Vários agentes ao mesmo tempo? O card lista cada um, com o que está fazendo.
* **Avisa também quando algo parece errado.** O agente parado há 4 minutos no meio de uma tarefa, a mesma falha 3 vezes seguidas, ou um comando perigoso (`rm -rf`, `git push --force`, `DROP TABLE`) que deixa o pedido **vermelho**.
* **Resume cada tarefa.** Quando o agente termina: "shop-api terminou ✓ · 3 arquivos · 12 comandos · testes ✓ · 2m 10s".
* **Não atrapalha e não sai do seu computador.** Os cliques passam através da janela, ele nunca bloqueia nem atrasa o agente, não usa conta nem manda nada seu para a internet (só confere uma vez por dia se há versão nova; o aviso no celular e o GitHub você liga se quiser), e senhas e chaves aparecem escondidas (`•••`).

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

## Instale em 3 passos

1. Baixe o instalador em [Releases](https://github.com/tiagocardosobezerra/openmon/releases/latest): Windows `.exe`, macOS `.dmg` (Apple Silicon) ou Linux `.AppImage`.
2. Abra o Openmon e clique em **Conectar** no balão do ovo. Isso liga o Claude Code.
3. Escolha seu primeiro Openmon: Tinkit (edições), Owlet (leitura e busca) ou Sparkle (comandos). Depois abra uma conversa nova no Claude Code e trabalhe normalmente: o ovo choca durante a sua primeira sessão.

Os avisos do agente rodam com o [Node.js](https://nodejs.org), que quem usa o Claude Code já tem. Os instaladores ainda não são assinados: no Windows, clique em "Mais informações → Executar assim mesmo"; no macOS, clique com o botão direito no app e em "Abrir". Prefere pelo código? Veja [Instalar pelo código](docs/GUIDE.md#instalar-pelo-código).

**Privacidade:** tudo fica no seu computador, sem conta. A única ida à internet é uma vez por dia, para ver no GitHub se há versão nova (dá para desligar); o aviso no celular e o GitHub são opcionais. O assistente usa o seu Claude Code, que conversa com a Anthropic como sempre; o Openmon não manda nada a mais.

## E ainda

* **Seu assistente pessoal.** `Ctrl+Alt+C` abre um chat com o seu próprio Claude Code, sem abrir o Claude e sem chave de API, e `Ctrl+Alt+A` faz uma pergunta rápida ao lado do pet. Ele cria lembretes e tarefas e guarda o que deve lembrar. Veja [o assistente](docs/ASSISTANT.md).
* **Um jogo.** O ovo choca, cresce e evolui para uma de 39 formas conforme o trabalho do agente, com itens, acessórios, lendários e missões. Veja [o jogo](docs/GAME.md).
* **Todo o resto** está no [guia](docs/GUIDE.md): diário, horas por projeto, modo foco, aviso no celular, outros agentes (Gemini CLI, Cursor, OpenCode, Aider, Codex), configurações, comandos e instalar pelo código.

## Como funciona por dentro

<img width="100%" alt="Como o Openmon funciona por dentro: os agentes de IA avisam cada passo por hooks; um servidor local em 127.0.0.1:4747 transforma cada aviso em sinal; o pet decide a pose, ganha experiência e registra o que o agente fez; tudo aparece no canto da tela; e, como assistente, ele responde usando o seu próprio Claude Code, que pode criar lembretes, guardar o que deve lembrar e falar pelo balão. O Openmon não manda nada a mais." src="assets/openmon-dentro.svg" />

1. **O agente avisa.** Claude Code, Gemini CLI, Cursor, OpenCode e Aider já avisam cada passo que dão (hooks). O Openmon só escuta, sem bloquear nada.
2. **Vira sinal.** Um servidor local em `127.0.0.1:4747` transforma cada aviso em um sinal simples: ferramenta usada, teste verde ou vermelho, "precisa de você".
3. **O pet decide.** Ele escolhe a pose, ganha experiência no tipo de trabalho certo e anota o que o agente fez nas Habilidades.
4. **Aparece na tela.** Tudo fica no canto da sua tela. Nada seu sai do computador; ele só confere uma vez por dia se há versão nova (o aviso no celular e o GitHub são opcionais: um manda só "Seu agente precisa de você", o outro guarda seu pet num Gist secreto da sua conta).
5. **E responde.** Como assistente, ele usa o seu próprio Claude Code (`claude -p`, com o seu login e os seus conectores, sem chave de API), que conversa com a Anthropic como sempre. O Claude pode usar as ferramentas do Openmon: criar lembretes e tarefas, guardar na memória, falar pelo balão. O Openmon não manda nada a mais.

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
