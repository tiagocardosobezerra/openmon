# Guía de Openmon

[Português](GUIDE.md) | [English](GUIDE.en.md) | **Español**

Esta página reúne todo lo que Openmon hace además de lo esencial. Para lo esencial y cómo instalarlo, mira el [README](../README.es.md).

## Más de lo que hace

* **Lleva un diario.** Lo que hicieron tus agentes cada día, por tipo de trabajo y por proyecto, y cuánto tiempo te esperaron.
* **No se pierde.** Hace copias en Documentos/Openmon Backups. ¿Formateaste la PC? En una instalación nueva pregunta si quieres traerla de vuelta.
* **Va contigo a otra computadora (opcional).** Inicia sesión con GitHub (`openmon login` o Ajustes → Computadora) y tu mascota queda guardada en un Gist secreto de tu cuenta. En otra computadora, inicia sesión con la misma cuenta y sigue donde la dejaste. Si cambió en las dos, Openmon pregunta cuál conservar. Sin servidor de Openmon: la app habla directo con GitHub.

## Utilidades del día a día

**Avisos que ahorran tiempo**
* **Parece trabado**: en medio de una tarea, sin ninguna herramienta corriendo y sin nada nuevo desde hace 4 minutos. Un clic te lleva al agente.
* **Sigue corriendo**: un comando (pruebas, build) que corre hace más de 8 minutos.
* **En bucle**: la misma falla 3 veces seguidas.
* **Comando peligroso**: `rm -rf`, `git push --force`, `git reset --hard`, `DROP TABLE`, `curl … | sh` y parecidos ponen el pedido de permiso en **rojo**.
* **Commit**: 30 ediciones en 45 minutos sin commit ganan un recordatorio amable.
* **Conversación larga**: avisa cuando Claude resume la conversación para seguir.
* **Pruebas de vuelta en verde**: celebra cuando pruebas que fallaban vuelven a pasar.

**Responder sin dejar lo que haces**
* **Permitir, Permitir siempre y Rechazar** en el globo. "Permitir siempre" aplica la regla que el propio Claude Code sugiere para ese pedido. **Explicar…** rechaza con un motivo que el agente lee (o rechaza y detiene al agente).
* **Preguntas del agente**: sus opciones se vuelven botones en el globo; **Otra…** abre una ventanita para escribir tu respuesta.
* **Mensaje a la conversación**: en el globo de "¡Terminó!" o en la tarjeta, **Mensaje** abre una ventanita. Un agente parado despierta enseguida; uno trabajando lo recibe con su próximo paso.
* **Abrir** pasa la pregunta o el pedido a la ventana del agente enseguida, sin esperar a la mascota.
* **Ver todo**: la burbuja muestra el comienzo del cambio; **Ver todo** abre una página con el cambio entero. Ahí, `Y` permite y `N` rechaza.
* **Desde la notificación del sistema**: si no miras la mascota, la notificación llega con **Permitir** y **Rechazar**.
* **Pausar todos los agentes**: en el panel **Más**, un botón pide a todas las conversaciones que trabajan que paren y te esperen.
* **Reglas de permiso de Claude Code** en Configuración → Computadora, un interruptor cada una: leer y buscar sin preguntar, correr las pruebas sin preguntar, y preguntar siempre antes de borrar o publicar.
* **¿Varios agentes esperando?** La tarjeta muestra los botones debajo de cada uno.
* **Atajos**: `Ctrl+Alt+O` abre la tarjeta, `Ctrl+Alt+J` te lleva al agente que espera, `Ctrl+Alt+C` abre el chat con Claude, `Ctrl+Alt+A` hace una pregunta rápida y `Ctrl+Alt+S` pregunta sobre tu pantalla.

**Números de tu trabajo**
* **Tokens** usados hoy (en la tarjeta) y por día (en el Diario), leídos de los archivos de conversación del propio Claude Code, en tu computadora.
* **Costo estimado** en dólares por proyecto y en los últimos 7 días, con los precios de lista de la API de Anthropic. Es una estimación: los planes mensuales (Pro, Max, Team) no pagan por token.
* **Pedidos de hoy**: cada permiso pedido en el día, cómo se respondió (en la mascota, en el agente o sin respuesta) y el cambio que traía.
* **Ayer en una línea** en el primer uso del día.
* **Texto para la daily**: un botón en el Diario copia "último día de trabajo" y "hoy" listos para pegar.
* **Horas por proyecto (CSV)**: tiempo de trabajo del agente por proyecto y día, para tu hoja de horas.
* **Línea de tiempo** de cada sesión y **búsqueda** en todas ("¿en qué sesión tocó el agente cart.ts?").

**Para tu día**
* **Modo foco** (25, 50 o 90 minutos): solo aparece "te necesita"; al final, una sugerencia de pausa.
* **Recordatorio de pausa** después de 50 o 90 minutos seguidos de trabajo.
* **Se aparta en pantalla completa**: con un juego, un video o una presentación en pantalla completa, las mascotas se esconden y vuelven cuando termina (Windows y macOS; se puede apagar en Configuración → Mascota).
* **Primeros pasos**: en la Opendex, una lista muestra lo que falta para empezar (conectar, primera sesión, elegir el inicial…) hasta que todo esté hecho.
* **Versión nueva**: cuando sale una, la mascota avisa y el ícono de la bandeja muestra **Descargar**.
* **Modo presentación**: cambia los nombres de proyecto por "Proyecto A, B…" y oculta los comandos en todo lo que muestra Openmon, para compartir pantalla.
* **Aviso en el celular** (opcional, con la app gratuita ntfy): si un agente espera desde hace un rato, llega un aviso. Solo envía "Tu agente te necesita".
* **En OBS**: la mascota con fondo transparente para transmisiones (la dirección está en la página de Configuración).

## Para ir más allá

### Configuración

Haz clic derecho en la mascota y en **Más**, al pie de la tarjeta (o en el ícono de la bandeja). El menú tiene la tarjeta, las páginas, el **modo foco**, el **modo silencio** y la **Configuración**, una página con siete secciones:

* **Mascota**: apodo, tamaño, idioma, sonidos, frases, pasear por la pantalla y repartir las conversaciones entre los Openmons en pantalla.
* **Asistente**: abrir el asistente, su carpeta y su memoria, y leer las respuestas en voz alta.
* **Avisos**: notificación del sistema y responder permisos desde la mascota (con el tiempo de espera).
* **Foco y calma**: modo foco, modo silencio, modo presentación y recordatorio de pausa.
* **Celular**: aviso en el celular con la app ntfy (opcional).
* **Computadora**: iniciar con la computadora, conectar Claude Code y otros agentes, reglas de permiso de Claude Code, buscar versión nueva, tu mascota en cualquier computadora (cuenta de GitHub), copias de la mascota (hacer ahora, exportar, traer de un archivo) y devolver la mascota a la esquina.
* **Avanzado**: atajos de teclado, OBS y demostración.

### Tu arte

Las 39 formas vienen en arte vectorial oficial (`art/official`), con poses y versiones brillantes. Para cambiarlas, pon imágenes con el nombre de la forma (`craft-adult.png`, `craft-adult.shiny@sleep.svg`…) en `~/.openmon/art`. La guía está en [ART-PACKS.md](ART-PACKS.md). `OPENMON_CLASSIC=1` vuelve al arte dibujado en código.

### Otros agentes

* **Gemini CLI**: `openmon install --agent gemini`. Muestra herramientas, pruebas, fin de tarea y pedidos de permiso.
* **Cursor**: `openmon install --agent cursor`. Muestra herramientas, pruebas y fin de tarea (Cursor no avisa cuando te espera).
* **OpenCode**: `openmon install --agent opencode` instala un plugin que muestra herramientas, fin de tarea y pedidos de permiso.
* **Aider**: `openmon install --agent aider` muestra el comando para iniciar Aider con el aviso de "te toca".
* **Codex CLI**: `openmon codex` muestra la línea para pegar en `~/.codex/config.toml`. Codex solo avisa las tareas terminadas, así que la mascota celebra y crece, pero no muestra las herramientas.
* **Cualquier otro**: envía un POST a `http://127.0.0.1:4747/event` con `{"_agent":"signal","session":"mi-agente","kind":"tool-done","family":"craft"}`. Los tipos están en [`src/classify.js`](../src/classify.js).

## Instalar desde el código

Necesitas [Node.js](https://nodejs.org) 22.12 o más nuevo y [Claude Code](https://claude.com/claude-code).

### 1. Instala

```bash
git clone https://github.com/tiagocardosobezerra/openmon.git
cd openmon
npm install
npm link
```

`npm link` crea el comando `openmon`. La primera vez que la mascota se abre, Electron descarga su propio programa (unos 100 MB).

### 2. Conéctalo a Claude Code

```bash
openmon install
```

Agrega los avisos (hooks) en `~/.claude/settings.json` y guarda una copia de seguridad. Solo para un proyecto: `openmon install --settings .claude/settings.json`. ¿Lo olvidaste? El propio huevo muestra un botón **Conectar**.

### 3. Llama a tu Openmon

```bash
openmon start
```

El huevo aparece en la esquina de la pantalla y un ícono en la bandeja. Abre una conversación nueva en Claude Code y trabaja normalmente: eclosiona durante tu primera sesión. ¿Quieres verlo antes? `openmon demo`.

| Comando | Qué hace |
|---|---|
| `openmon start` / `openmon stop` | Abre o guarda la mascota |
| `openmon install` / `openmon uninstall` | Activa o desactiva los avisos de Claude Code (tu mascota queda guardada) |
| `openmon demo` | Muestra una sesión de ejemplo en un huevo desechable |
| `openmon playground` | Una mascota de pruebas con panel: mira todas las formas y escenas en minutos |
| `openmon dex` / `openmon card` | Abre la Opendex o la tarjeta de entrenador |
| `openmon name <apodo>` | Pone un apodo (`--clear` vuelve al nombre de la especie) |
| `openmon backup [archivo]` / `openmon restore <archivo\|latest>` | Hace una copia o trae una mascota de vuelta |
| `openmon login` / `openmon sync` / `openmon logout` | Lleva tu mascota entre computadoras con tu cuenta de GitHub |
| `openmon install --agent gemini\|cursor\|opencode\|aider` | Conecta Openmon a Gemini CLI, Cursor, OpenCode o Aider |
| `openmon autostart on\|off` | Abre la mascota al encender la computadora |
| `openmon stats` / `openmon status` | La mascota en la terminal / si todo está conectado |

## Dentro del código

```
Claude Code ──hook (async)──▶ src/hook.js ──POST /event──▶ daemon (127.0.0.1:4747)
                                                             │ classify → sessions → pet
                                                             ▼                       │
                               ventana de la mascota / navegador / OBS ◀── SSE /stream └─▶ ~/.openmon/pet.json
```

* [`classify.js`](../src/classify.js): convierte el aviso del agente en una señal pequeña.
* [`sessions.js`](../src/sessions.js): el estado de cada conversación y la pose que más importa.
* [`pet.js`](../src/pet.js): XP, amistad, evolución, misiones, objetos y accesorios, como funciones puras.
* [`focus.js`](../src/focus.js): encuentra la ventana del agente y la trae al frente.
* [`backup.js`](../src/backup.js): las copias en Documentos y la vuelta en una instalación nueva.
* [`public/art.js`](../public/art.js): dibuja el arte oficial, con ojos que parpadean y accesorios en su lugar.

El servidor solo escucha en `127.0.0.1` y rechaza pedidos de otras páginas web (verificación de Origin y Host). El hook nunca imprime nada, siempre sale con 0 y se rinde en hasta 1,5 s. `openmon start` corre la mascota con un supervisor que la trae de vuelta en dos segundos si se cae.
