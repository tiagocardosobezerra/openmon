# Openmon

[Português](README.md) | [English](README.en.md) | **Español**

**¿Tu agente de IA se detuvo a pedir permiso y no lo viste? Openmon es una criatura en la esquina de la pantalla que te avisa en el momento en que el agente te espera, y respondes con un clic.**

![Node.js 22.12+](https://img.shields.io/badge/node.js-22.12%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Electron](https://img.shields.io/badge/electron-44-47848F?style=flat-square&logo=electron&logoColor=white)
![Claude Code](https://img.shields.io/badge/Claude%20Code-hooks%20oficiales-D97757?style=flat-square&logo=anthropic&logoColor=white)
![100% local](https://img.shields.io/badge/datos-100%25%20locales-2ea44f?style=flat-square)
![MIT](https://img.shields.io/badge/licencia-MIT-blue?style=flat-square)

<img width="100%" alt="Animación de Openmon: un huevo eclosiona en la esquina de la pantalla; la mascota lee, martillea y prueba junto con el agente de IA; cuando el agente necesita permiso, salta con un cartel y respondes con un clic; también es tu asistente: pides un recordatorio en una cajita junto a ella y, a la hora, te avisa; evoluciona con el trabajo y se vuelve una colección de 39 formas, con brillantes y legendarias. Tu agente trabaja. Tu Openmon crece y te ayuda." src="assets/openmon-banner.es.svg" />

Agentes como Claude Code trabajan solos durante minutos, pero se detienen en silencio cuando te necesitan: un permiso, una pregunta, el fin de la tarea. Vuelves media hora después y estaba esperando desde el principio. Openmon sigue cada conversación y te llama solo cuando importa.

## Lo que hace por ti

* **Te avisa cuando el agente te necesita.** Pedido de permiso o pregunta: salta con un cartel, muestra el proyecto y el pedido en palabras simples ("Pide permiso para ejecutar un comando: npm publish") y suena un aviso suave. Si no miras, llega una notificación.
* **Te deja responder y hablar con el agente ahí mismo.** Con Claude Code, el globo gana **Permitir** y **Rechazar** en los pedidos de permiso y las opciones de cada pregunta del agente; **Mensaje** escribe a la conversación que sigue la mascota, y llega enseguida si el agente está parado. Claude Code espera tu respuesta en la mascota hasta 25 segundos; después pregunta como siempre. Nada se aprueba solo: solo tu clic responde. Se desactiva en Configuración → "Responder desde la mascota".
* **Te lleva al agente con un clic.** Un clic en la mascota, en el globo o en la notificación trae al frente la ventana donde corre el agente: terminal, VS Code o la app de Claude.
* **Muestra lo que pasa, sin mirar la terminal.** Martillo es editar, libro es leer, escudo es probar, catalejo es web. ¿Varios agentes a la vez? La tarjeta lista cada uno, con lo que está haciendo.
* **También avisa cuando algo parece mal.** El agente detenido 4 minutos en medio de una tarea, el mismo fallo 3 veces seguidas, o un comando peligroso (`rm -rf`, `git push --force`, `DROP TABLE`) que pone la solicitud en **rojo**.
* **Resume cada tarea.** Cuando el agente termina: "shop-api terminó ✓ · 3 archivos · 12 comandos · pruebas ✓ · 2m 10s".
* **No molesta y no sale de tu computadora.** Los clics atraviesan la ventana, nunca bloquea ni retrasa al agente, no usa cuenta ni manda nada tuyo a internet (solo revisa una vez al día si hay versión nueva; el aviso en el celular y GitHub los activas si quieres), y las contraseñas y claves aparecen ocultas (`•••`).

## Cómo se ve en la práctica

> **Tú:** arregla las pruebas del checkout
>
> **Claude:** lee los archivos, edita dos y pide ejecutar `npm publish`.
>
> **Openmon:** lee un libro, toma el martillo, levanta el escudo… y salta con el cartel: **"shop-api te necesita · Pide permiso para ejecutar un comando: npm publish"**. Haces clic en ella, aparece la ventana de Claude, apruebas. Celebra: **"¡Terminó! · 2 archivos · pruebas ✓"**, y gana experiencia.

<table>
<tr>
<td width="50%" align="center"><img src="docs/screens/pet-attention.es.png" width="300" alt="La mascota salta con el cartel: el agente te necesita"><br><sub>Cuando el agente te necesita</sub></td>
<td width="50%" align="center"><img src="docs/screens/pet-card.es.png" width="300" alt="La tarjeta con los agentes, la experiencia y la amistad"><br><sub>Clic derecho: la tarjeta con tus agentes</sub></td>
</tr>
</table>

| Lo que hace | Lo que significa |
|---|---|
| Salta con el cartel **!** | El agente espera tu permiso o respuesta. Haz clic en ella para ir allí |
| Martillo, libro, terminal, escudo, catalejo | El agente está editando, leyendo, ejecutando comandos, probando o en la web |
| Ayudantes volando alrededor | El agente llamó a otros agentes para ayudar |
| Celebra | El agente terminó: te toca |
| Hace una mueca | Algo falló, como una prueba |
| Duerme | No pasa nada desde hace unos minutos |

## Instala en 3 pasos

1. Descarga el instalador en [Releases](https://github.com/tiagocardosobezerra/openmon/releases/latest): Windows `.exe`, macOS `.dmg` (Apple Silicon) o Linux `.AppImage`.
2. Abre Openmon y haz clic en **Conectar** en el globo del huevo. Así se conecta Claude Code.
3. Elige tu primer Openmon: Tinkit (ediciones), Owlet (lectura y búsqueda) o Sparkle (comandos). Después abre una conversación nueva en Claude Code y trabaja normalmente: el huevo eclosiona durante tu primera sesión.

Los avisos del agente corren con [Node.js](https://nodejs.org), que quien usa Claude Code ya tiene. Los instaladores aún no están firmados: en Windows, haz clic en "Más información → Ejecutar de todas formas"; en macOS, clic derecho en la app y "Abrir". ¿Prefieres el código? Mira [Instalar desde el código](docs/GUIDE.es.md#instalar-desde-el-código).

**Privacidad:** todo queda en tu computadora, sin cuenta. Su única salida a internet es una vez al día, para ver en GitHub si hay una versión nueva (se puede apagar); el aviso en el celular y GitHub son opcionales. El asistente usa tu Claude Code, que habla con Anthropic como siempre; Openmon no envía nada más.

## Y además

* **Tu asistente personal.** `Ctrl+Alt+C` abre un chat con tu propio Claude Code, sin abrir Claude y sin clave de API, y `Ctrl+Alt+A` hace una pregunta rápida junto a la mascota. Crea recordatorios y tareas y guarda lo que debe recordar. Mira [el asistente](docs/ASSISTANT.es.md).
* **Un juego.** El huevo eclosiona, crece y evoluciona a una de 39 formas según el trabajo del agente, con objetos, accesorios, legendarios y misiones. Mira [el juego](docs/GAME.es.md).
* **Todo lo demás** está en la [guía](docs/GUIDE.es.md): el diario, las horas por proyecto, el modo foco, el aviso en el celular, otros agentes (Gemini CLI, Cursor, OpenCode, Aider, Codex), la configuración, los comandos e instalar desde el código.

## Cómo funciona por dentro

<img width="100%" alt="Cómo funciona Openmon por dentro: los agentes de IA avisan cada paso por hooks; un servidor local en 127.0.0.1:4747 convierte cada aviso en señal; la mascota elige la pose, gana experiencia y registra lo que hizo el agente; todo aparece en la esquina de la pantalla; y, como asistente, responde con tu propio Claude Code, que puede crear recordatorios, guardar lo que debe recordar y hablar por la burbuja. Openmon no envía nada más." src="assets/openmon-dentro.es.svg" />

1. **El agente avisa.** Claude Code, Gemini CLI, Cursor, OpenCode y Aider ya avisan cada paso que dan (hooks). Openmon solo escucha, sin bloquear nada.
2. **Se vuelve señal.** Un servidor local en `127.0.0.1:4747` convierte cada aviso en una señal simple: herramienta usada, prueba en verde o en rojo, "te necesita".
3. **La mascota decide.** Elige la pose, gana experiencia en el tipo de trabajo correcto y anota lo que hizo el agente en las Habilidades.
4. **Aparece en pantalla.** Todo queda en la esquina de tu pantalla. Nada tuyo sale de tu computadora; solo revisa una vez al día si hay versión nueva (el aviso en el celular y GitHub son opcionales: uno solo envía "Tu agente te necesita", el otro guarda tu mascota en un Gist secreto de tu cuenta).
5. **Y responde.** Como asistente, usa tu propio Claude Code (`claude -p`, con tu cuenta y tus conectores, sin clave de API), que habla con Anthropic como siempre. Claude puede usar las herramientas de Openmon: crear recordatorios y tareas, guardar en la memoria, hablar por la burbuja. Openmon no envía nada más.

## Desarrollar

```bash
npm install
npm test          # node:test, sin dependencias extra
npm run smoke     # abre todas las páginas en Electron oculto y falla ante cualquier error
npm run serve     # después abre http://127.0.0.1:4747/?preview
npm start         # la mascota de escritorio
```

Diseño, principios y próximos pasos: [docs/DESIGN.md](docs/DESIGN.md). Historial de revisiones: [docs/REVIEW-LOG.md](docs/REVIEW-LOG.md).

## Licencia

MIT. Openmon es un proyecto independiente, con criaturas y arte originales.
