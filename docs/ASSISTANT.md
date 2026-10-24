# Seu assistente pessoal: converse com o Claude sem abrir o Claude

**Português** | [English](ASSISTANT.en.md) | [Español](ASSISTANT.es.md)

Esta página explica o assistente. Para o que o Openmon faz por você e como instalar, veja o [README](../README.md).

`Ctrl+Alt+C` (ou **Mais → Assistente**, a barra de cima das páginas ou o ícone da bandeja) abre o assistente. Ele usa o seu próprio Claude Code, com o seu login, as suas configurações, os seus conectores (MCP) e o seu `CLAUDE.md`. Não precisa de chave de API.

* **Conversas de verdade:** a resposta aparece enquanto é escrita, com uma linha para cada ferramenta usada ("Write: lista.txt", "Bash: npm test"). Escolha a pasta de cada conversa: um projeto, ou a pasta do **Assistente** (Documentos/Openmon Assistente) para assuntos gerais.
* **Pedidos dentro do chat:** quando o Claude precisa de permissão, o pedido aparece no chat com a mudança, e também no balão do pet, na notificação e nos atalhos. Nada é aprovado sozinho.
* **Conversas abertas em outro lugar:** as conversas do terminal ou do editor aparecem na lista e são lidas ao vivo. Dá para escrever para elas, ou **Continuar aqui**.
* **Ações rápidas:** "O que tenho hoje?", "Explicar o que copiei", "Revisar mudanças", "Rodar os testes" e as que você criar. `{clipboard}` vira o que você copiou.
* **Arquivos e imagens:** arraste para a janela, anexe pelo clipe ou cole uma captura de tela. Imagens vão para o Claude ver.
* **Lembretes e tarefas:** "daqui a 30 minutos", "hoje às 15h", "todo dia às 9h" ou "dias úteis às 9h". Um lembrete faz o pet avisar; uma tarefa faz o Claude trabalhar na hora, e o pet avisa quando terminar.
* **Memória do assistente:** o `CLAUDE.md` da pasta do assistente, com o que o Claude deve sempre saber sobre você, editável no próprio chat.
* **Pelo celular (opcional):** com o aviso no celular ligado, o que você manda no tópico `<seu tópico>-in` do app ntfy vai para o agente que espera você, ou para a sua última conversa.
* **Custo estimado** de cada conversa pelos preços de tabela da API. Em plano mensal (Pro, Max, Team), o chat mostra "incluído no seu plano".
* **O assistente é o seu Openmon:** ele responde com o nome e o jeito do seu pet, e a resposta aparece no balão. Em Configurações → Pet, o pet pode ler as respostas em voz alta (vozes do computador, sem internet).
* **Pergunta rápida** (`Ctrl+Alt+A`): uma caixinha ao lado do pet; Enter, e a resposta aparece ali mesmo, com o que o Claude está fazendo. **Responder** continua a conversa, **Abrir no assistente** mostra inteira; fechada a caixinha, a resposta vem no balão. `Ctrl+Alt+S` faz o mesmo mandando uma imagem da tela ("o que é esse erro?"). Também dá para mandar o que você copiou.
* **O Claude age no Openmon:** "me lembra às 15h de ligar pro João", "toda segunda me dá um resumo da semana", "lembre que eu prefiro tópicos". Ele cria lembretes e tarefas, guarda fatos na memória, fala pelo balão, manda notificações e lê o que seus agentes fizeram (ferramentas do Openmon, que não pedem permissão).
* **Rotinas prontas** em Lembretes e tarefas: resumo da manhã e fechamento do dia, nos dias úteis.
* **No chat:** os passos de cada resposta ficam numa linha que abre ("6 passos · editou 2 · rodou 1"); código com cores e **Copiar**; `Ctrl+N` nova conversa, `Ctrl+K` busca, `Esc` para, `↑` repete a última mensagem. A notificação "O Claude respondeu" tem **Responder**.
* **Organização:** escolha o modelo de cada conversa (Haiku, Sonnet, Opus), fixe conversas, busque em todas e exporte uma em Markdown. Em cada resposta: **Ouvir** e **Lembrar**.
