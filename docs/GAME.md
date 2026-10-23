# O jogo do Openmon

**Português** | [English](GAME.en.md) | [Español](GAME.es.md)

O Openmon é um pet de desktop, no espírito dos jogos de criaturas e dos bichinhos virtuais, que vive no canto da tela enquanto o Claude Code trabalha. Ele lê quando o agente lê, martela quando o agente edita, levanta um escudo quando os testes rodam e pula segurando uma placa quando o agente **precisa de você**. Um clique nele e a janela do agente vem para a frente, pronta para você aprovar ou responder. Com os dias, o ovo choca, cresce e evolui para uma de 40 formas, decidida pelo tipo de trabalho que o seu agente mais faz.

Esta página explica o jogo. Para o que o Openmon faz por você e como instalar, veja o [README](../README.md).

## Como ele cresce

Cada coisa que o agente faz vale **experiência (XP)**. Com o bastante, ele evolui: ovo, jovem, adulto e ancião, em semanas de uso. O ovo choca direto no jovem do **tipo** que o trabalho do agente decide:

| Tipo | Vem de | Jovem | Adulto | Ancião |
|---|---|---|---|---|
| Forja | editar arquivos | Tinkit | Forgemaw | Archsmith |
| Saber | ler e buscar | Owlet | Scrollwyrm | Oracle |
| Terminal | rodar comandos | Sparkle | Voltcrab | Kernel |
| Teste | rodar testes | Shellby | Bastion | Aegis |
| Viagem | web e ferramentas MCP | Wisp | Skyfin | Wayfarer |
| Enxame | chamar outros agentes | Mote | Hivekin | Legion |
| Escriba | escrever documentação (.md, .rst, .txt) | Inkling | Quillmane | Archivist |
| Ramo | comandos git e gh | Twiglet | Branchoak | Mergewood |
| Caçador | consertar o que falhou | Mitey | Beetlock | Bugbane |
| Cristal | dados: SQL, CSV, notebooks, bancos | Cubit | Prismora | Datanaut |
| Pincel | folhas de estilo (.css, .scss) | Dabbit | Palettail | Chromancer |

**Seu primeiro Openmon você escolhe.** O primeiro ovo, e o ovo de cada nova geração, deixa você escolher entre três iniciais, os três trabalhos mais comuns de um agente: **Tinkit** (Forja), **Owlet** (Saber) e **Sparkle** (Terminal). Ele choca depois de alguns minutos de trabalho, já com a Habilidade do tipo, e fica nesse tipo para sempre: vira o Adulto e o Ancião da mesma linhagem, e todo XP conta. Uma Pedra de tipo ainda pode mudar a próxima evolução. Os outros ovos (de projeto e misteriosos) chocam no tipo do trabalho, aos 400 XP.

Trabalho raro vale mais, então todo tipo pode vencer. E existe uma linhagem escondida que pouca gente vai achar: *dizem que o segredo é o equilíbrio.*

* **Amizade** (0 a 100) só sobe: responda rápido ao agente, faça carinho com um clique, volte todo dia. Virar Ancião pede amizade 60.
* **Personalidade**: cada ovo nasce Corajoso, Sonolento, Curioso, Alegre, Calmo ou Atrevido, o que muda como ele se mexe e o que ele fala.
* **Raridades**: 1 em 128 nasce brilhante, com outras cores e sempre com brilho e estrelinhas em volta. Cada forma tem as 5 poses também na versão brilhante.
* **Linha oculta**: quando dois tipos de trabalho empatam quase exatamente, aparece a Chimera.
* **Lendários**: três, cada um ligado a um feito. *Mergeon* aparece no seu primeiro pull request aceito, *Aeonbyte* depois de um ano de Openmon e *Zeroday* depois de 100 consertos. Eles entram no seu Time e nunca evoluem.
* **Encontros selvagens**: de vez em quando (1 em 1.024 ações do agente, no máximo um por dia) um Openmon selvagem aparece ao lado do seu pet por 10 minutos. Ele é sempre um Jovem, quase sempre do tipo da ação que o chamou, e pode vir brilhante (1 em 128). Jogue uma *Openball* para tentar capturar: 3 em 4. Se escapar, metade das vezes ele fica para mais uma tentativa. Capturado, ele entra no Time sem projeto e com o tipo dele. Você ganha 3 Openballs com o primeiro Openmon, uma por dia perfeito e uma a cada 5 dias seguidos. Dá para desligar nas Configurações. Outros itens de campo: *Openball Plus* (captura 7 em 8, a cada 10 dias seguidos), *Openball Mestra* (captura sempre; ganha ao encontrar selvagens dos 11 tipos), *Isca* (por 1 hora, encontros 1 em 256, a cada 3 dias perfeitos), *Lanterna* (o próximo selvagem vem brilhante 1 em 16; ganha na 10ª captura) e *Mapa de campo* (escolhe o tipo do próximo selvagem, a cada 8 dias perfeitos).
* **Forma de foco**: num pedido longo (50 ações ou mais), ele cresce dentro de um anel de energia até o pedido acabar.
* **Apelido**: sem apelido ele usa o nome da espécie. Ao chocar, ele pergunta se você quer dar um.
* Ele nunca morre, nunca adoece e nunca perde o que conquistou.

<table>
<tr>
<td width="50%"><img src="screens/dex.pt-BR.png" alt="A Opendex com os tipos e as formas"><br><sub><b>Opendex</b>: os tipos, como cada um se conquista e as 40 formas</sub></td>
<td width="50%"><img src="screens/bag.pt-BR.png" alt="A Mochila com itens e acessórios"><br><sub><b>Mochila</b>: itens e acessórios para usar</sub></td>
</tr>
</table>

## Um Openmon por projeto

Cada projeto em que o agente trabalha bastante ganha **o seu próprio ovo**. Até 6 andam no **Time**; os outros esperam no **Ninho**, com 12 papéis de parede para escolher. Até 3 podem ficar na tela ao mesmo tempo: no Time, use "Também na tela"; cada um mostra o que o agente do seu projeto está fazendo. Cada um cresce só com o trabalho do seu projeto, e a Mochila, a Opendex e as insígnias são suas, de treinador, e valem para todos. Na página **Time** você escolhe quem fica na tela e o que cada um acompanha. Pastas temporárias (a pasta temporária do sistema ou a área de rascunho de um app) não contam como projeto. Todo trabalho sem um Openmon próprio no Time (pasta temporária, projeto novo, pet descansando no Ninho) treina o **Openmon principal**, o da tela: para treinar um ovo, faça dele o principal. Com mais de um Openmon na tela, cada sessão de agente sem pet próprio vai para um deles, o que tiver menos sessões, e fica com ele: esse pet ganha o XP dela e a mostra no seu card. No Ninho, eles descansam e não ganham XP.

**Quem acompanha o quê.** Quem acompanha cada conversa, nesta ordem: 1) uma conversa que você fixou num Openmon (botão direito → Agentes → clique no nome do pet ao lado da conversa); 2) um projeto que você fixou num Openmon (Time → "Acompanha"); 3) o Openmon do próprio projeto, enquanto ele está no Time; 4) a fila: com mais de um na tela, cada conversa nova vai para um deles, na vez de cada um. Em Configurações → Pet dá para desligar a divisão; aí tudo fica com o principal, menos o que você fixou. No Ninho, os pets descansam e não ganham XP.

**Falar com o agente pelo pet.** O pet é o seu ponto de contato com a conversa que ele acompanha, não só um aviso. Com o Claude Code: num pedido de permissão, **Permitir**, **Sempre permitir**, **Recusar** ou **Explicar…** (recusar com um motivo que o agente lê, ou recusar e parar); numa pergunta do agente, as opções viram botões e **Outra…** deixa você escrever a resposta; e **Mensagem** (no balão de "Terminou!" ou no card) manda um recado para a conversa: se o agente está parado, ele acorda na hora; se está trabalhando, o recado vai junto com o próximo passo. Nada é aprovado sozinho, o texto só sai quando você clica em Enviar, e só o app de desktop pode escrever ao agente. Nos outros agentes (Codex, Gemini CLI, Cursor, OpenCode, Aider), um clique no pet continua levando você à janela do agente.


## Todo dia tem algo

* **Missões**: três por dia, como "responder ao agente em até 30 s, 3 vezes" ou "3 rodadas de testes verdes". Cada uma dá experiência, amizade e um Biscoito.
* **Mochila**: *Biscoito* (+2 de amizade), *Bala de nível* (sobe um nível), *Doce de amizade* (+10), *Amuleto de XP* (experiência em dobro por um dia), *Ovo misterioso* (choca um novo membro, com mais chance de vir brilhante), *Pedra firme* (enquanto ele segura, não evolui) e 11 *Pedras de tipo* (segure uma e a próxima evolução vai para aquele tipo).
* **30 acessórios** na cabeça, no rosto e no pescoço: boné, coroa, cachecol, óculos redondos e escuros, monóculo, máscara de herói, capacete de obra, coroa de folhas, chapéu de explorador, gorro de chef, laço, tiara de estrelas, chapéu de abóbora, gorro de Natal, gravata, colar de pérolas, capa, sininho, mochilinha e outros, cada um liberado por uma conquista (100 commits, 50 consertos, 200 páginas lidas…). Aparecem no pet, na Mochila e no cartão de treinador.
* **Presente do dia e sequência**: um Biscoito por dia de uso, uma Pedra de tipo a cada 3 dias seguidos, uma Bala de nível a cada 7, um Amuleto de XP a cada 14 e um Ovo misterioso a cada 30.
* **Opendex, insígnias e Hall da Fama**: quando o seu chega a Ancião, aposente-o no Hall da Fama e comece uma nova geração, escolhendo de novo o inicial; a Mochila, a Opendex e as insígnias continuam.

## Habilidades: utilidades que a evolução libera

Cada tipo em que seu Openmon evolui libera, para sempre, um painel útil sobre as sessões do agente:

| Habilidade | Tipo | Mostra |
|---|---|---|
| Diário da forja | Forja | cada arquivo alterado, quantas vezes, linhas que entraram e saíram |
| Lista de leitura | Saber | o que o agente leu e buscou antes de agir |
| Diário de comandos | Terminal | cada comando, se deu certo, quanto tempo levou, com botão de copiar |
| Placar de testes | Teste | cada rodada de testes e a sequência de verdes |
| Diário de viagem | Viagem | páginas abertas, buscas na web e ferramentas MCP |
| Visão da colmeia | Enxame | os agentes ajudantes, quais ainda rodam e quanto levaram |
| Diário do escriba | Escriba | cada documento escrito, linhas que entraram e saíram |
| Diário dos ramos | Ramo | cada comando git e gh, e quantos commits |
| Diário de consertos | Caçador | o que falhou e voltou a funcionar, em quantas tentativas e quanto tempo |
| Diário de dados | Cristal | arquivos de dados lidos ou mudados e cada comando de banco |
| Diário de estilos | Pincel | cada folha de estilo alterada, linhas que entraram e saíram |

Para todo mundo: o **Diário** dos últimos 14 dias e o **contador de espera**, quanto tempo seus agentes esperaram por você hoje.

<img width="100%" alt="As Habilidades, com o diário dos últimos 14 dias" src="screens/powers.pt-BR.png" />
