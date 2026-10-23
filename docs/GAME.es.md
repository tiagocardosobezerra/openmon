# El juego de Openmon

[Português](GAME.md) | [English](GAME.en.md) | **Español**

Openmon es una mascota de escritorio, en el espíritu de los juegos de criaturas y de las mascotas virtuales, que vive en la esquina de la pantalla mientras Claude Code trabaja. Lee cuando el agente lee, martillea cuando el agente edita, levanta un escudo cuando corren las pruebas y salta con un cartel cuando el agente **te necesita**. Un clic en ella y la ventana del agente pasa al frente, lista para que apruebes o respondas. Con los días, el huevo eclosiona, crece y evoluciona a una de 40 formas, según el tipo de trabajo que más hace tu agente.

Esta página explica el juego. Para lo que Openmon hace por ti y cómo instalarlo, mira el [README](../README.es.md).

## Cómo crece

Cada cosa que hace el agente vale **experiencia (XP)**. Con suficiente, evoluciona: huevo, joven, adulto y anciano, en semanas de uso. El huevo eclosiona directo en el joven del **tipo** que decide el trabajo del agente:

| Tipo | Viene de | Joven | Adulto | Anciano |
|---|---|---|---|---|
| Forja | editar archivos | Tinkit | Forgemaw | Archsmith |
| Saber | leer y buscar | Owlet | Scrollwyrm | Oracle |
| Terminal | ejecutar comandos | Sparkle | Voltcrab | Kernel |
| Prueba | ejecutar pruebas | Shellby | Bastion | Aegis |
| Viaje | web y herramientas MCP | Wisp | Skyfin | Wayfarer |
| Enjambre | llamar a otros agentes | Mote | Hivekin | Legion |
| Escriba | escribir documentación (.md, .rst, .txt) | Inkling | Quillmane | Archivist |
| Rama | comandos git y gh | Twiglet | Branchoak | Mergewood |
| Cazador | arreglar lo que falló | Mitey | Beetlock | Bugbane |
| Cristal | datos: SQL, CSV, notebooks, bases de datos | Cubit | Prismora | Datanaut |
| Pincel | hojas de estilo (.css, .scss) | Dabbit | Palettail | Chromancer |

**Tu primer Openmon lo eliges tú.** El primer huevo, y el huevo de cada nueva generación, te deja elegir entre tres iniciales, los tres trabajos más comunes de un agente: **Tinkit** (Forja), **Owlet** (Saber) y **Sparkle** (Terminal). Eclosiona tras unos minutos de trabajo, ya con la Habilidad de su tipo, y se queda en ese tipo para siempre: llega al Adulto y al Anciano de la misma línea, y todo el XP cuenta. Una Piedra de tipo aún puede cambiar la siguiente evolución. Los demás huevos (de proyecto y misteriosos) eclosionan en el tipo del trabajo, a los 400 XP.

El trabajo raro vale más, así que cualquier tipo puede ganar. Y hay un linaje escondido que poca gente va a encontrar: *dicen que el secreto es el equilibrio.*

* **Amistad** (0 a 100) solo sube: responde rápido al agente, acaríciala con un clic, vuelve todos los días. Llegar a Anciano pide amistad 60.
* **Personalidad**: cada huevo nace Valiente, Dormilona, Curiosa, Alegre, Tranquila o Pícara, lo que cambia cómo se mueve y lo que dice.
* **Rarezas**: 1 de cada 128 nace con colores brillantes (shiny), siempre con brillo y estrellitas alrededor. Cada forma tiene las 5 poses también en shiny.
* **Línea oculta**: cuando dos tipos de trabajo empatan casi exactamente, aparece la Chimera.
* **Legendarios**: tres, cada uno ligado a una hazaña. *Mergeon* aparece con tu primer pull request aceptado, *Aeonbyte* después de un año de Openmon y *Zeroday* después de 100 arreglos. Entran en tu Equipo y nunca evolucionan.
* **Encuentros salvajes**: de vez en cuando (1 de cada 1.024 acciones del agente, como máximo uno al día) un Openmon salvaje aparece junto a tu mascota durante 10 minutos. Siempre es un Joven, casi siempre del tipo de la acción que lo llamó, y puede ser brillante (1 de cada 128). Lanza una *Openball* para intentar atraparlo: 3 de cada 4. Si se suelta, la mitad de las veces se queda para otro intento. Atrapado, entra en tu Equipo sin proyecto y conserva su tipo. Ganas 3 Openballs con tu primer Openmon, una por día perfecto y una cada 5 días seguidos. Se pueden desactivar en la Configuración.
* **Forma de foco**: en un pedido largo (50 acciones o más), crece dentro de un anillo de energía hasta que el pedido termina.
* **Apodo**: sin apodo usa el nombre de la especie. Al eclosionar, pregunta si quieres ponerle uno.
* Nunca muere, nunca se enferma y nunca pierde lo que ganó.

<table>
<tr>
<td width="50%"><img src="screens/dex.es.png" alt="La Opendex con los tipos y las formas"><br><sub><b>Opendex</b>: los tipos, cómo se gana cada uno y las 40 formas</sub></td>
<td width="50%"><img src="screens/bag.es.png" alt="La Mochila con objetos y accesorios"><br><sub><b>Mochila</b>: objetos y accesorios para usar</sub></td>
</tr>
</table>

## Un Openmon por proyecto

Cada proyecto en el que el agente trabaja bastante gana **su propio huevo**. Hasta 6 van en el **Equipo**; los demás esperan en el **Nido**, con 12 fondos para elegir. Hasta 3 pueden estar en pantalla a la vez: en el Equipo, usa "También en pantalla"; cada uno muestra lo que hace el agente de su proyecto. Cada uno crece solo con el trabajo de su proyecto, y la Mochila, la Opendex y las insignias son tuyas, de entrenador, y valen para todos. En la página **Equipo** eliges quién está en pantalla y qué acompaña cada uno. Las carpetas temporales (la carpeta temporal del sistema o el área de borrador de una app) no cuentan como proyecto. Todo trabajo sin un Openmon propio en el Equipo (carpeta temporal, proyecto nuevo, mascota descansando en el Nido) entrena al **Openmon principal**, el de la pantalla: para entrenar un huevo, hazlo el principal. Con más de un Openmon en pantalla, cada sesión de agente sin mascota propia va a uno de ellos, el que tenga menos sesiones, y se queda con él: esa mascota gana su XP y la muestra en su tarjeta. En el Nido descansan y no ganan XP.

**Quién acompaña qué.** Quién acompaña cada conversación, en este orden: 1) una conversación que fijaste en un Openmon (clic derecho → Agentes → clic en el nombre de la mascota junto a la conversación); 2) un proyecto que fijaste en un Openmon (Equipo → "Acompaña"); 3) el Openmon del propio proyecto, mientras está en el Equipo; 4) la fila: con más de uno en pantalla, cada conversación nueva va a uno de ellos, por turno. En Ajustes → Mascota puedes apagar el reparto; entonces todo queda con el principal, salvo lo que fijaste. En el Nido, las mascotas descansan y no ganan XP.

**Hablar con el agente desde la mascota.** La mascota es tu punto de contacto con la conversación que sigue, no solo un aviso. Con Claude Code: en un pedido de permiso, **Permitir**, **Permitir siempre**, **Rechazar** o **Explicar…** (rechazar con un motivo que el agente lee, o rechazar y detener); en una pregunta del agente, sus opciones se vuelven botones y **Otra…** te deja escribir tu respuesta; y **Mensaje** (en el globo de "¡Terminó!" o en la tarjeta) manda una nota a la conversación: un agente parado despierta enseguida, uno trabajando la recibe con su próximo paso. Nada se aprueba solo, el texto solo sale cuando haces clic en Enviar, y solo la app de escritorio puede escribirle al agente. Con los demás agentes (Codex, Gemini CLI, Cursor, OpenCode, Aider), un clic en la mascota sigue llevándote a la ventana del agente.


## Todos los días hay algo

* **Misiones**: tres por día, como "responder al agente en menos de 30 s, 3 veces" o "3 rondas de pruebas en verde". Cada una da experiencia, amistad y una Galleta.
* **Mochila**: *Galleta* (+2 de amistad), *Caramelo de nivel* (sube un nivel), *Dulce de amistad* (+10), *Amuleto de XP* (experiencia doble por un día), *Huevo misterioso* (eclosiona un nuevo miembro, con más probabilidad de shiny), *Piedra firme* (mientras la sostiene, no evoluciona) y 11 *Piedras de tipo* (sostén una y la próxima evolución va hacia ese tipo).
* **30 accesorios** en la cabeza, la cara y el cuello: gorra, corona, bufanda, gafas redondas y de sol, monóculo, máscara de héroe, casco de obra, corona de hojas, sombrero de explorador, gorro de chef, lazo, tiara de estrellas, sombrero de calabaza, gorro de Navidad, corbata, collar de perlas, capa, cascabel, mochilita y otros, cada uno ganado con un logro (100 commits, 50 arreglos, 200 páginas leídas…). Aparecen en la mascota, en la Mochila y en la tarjeta de entrenador.
* **Regalo del día y racha**: una Galleta por día de uso, una Piedra de tipo cada 3 días seguidos, un Caramelo de nivel cada 7, un Amuleto de XP cada 14 y un Huevo misterioso cada 30.
* **Opendex, insignias y Salón de la Fama**: cuando el tuyo llega a Anciano, retíralo al Salón de la Fama y empieza una nueva generación, eligiendo de nuevo el inicial; la Mochila, la Opendex y las insignias se quedan.

## Habilidades: utilidades que libera la evolución

Cada tipo al que evoluciona tu Openmon libera, para siempre, un panel útil sobre las sesiones del agente:

| Habilidad | Tipo | Muestra |
|---|---|---|
| Diario de la forja | Forja | cada archivo cambiado, cuántas veces, líneas que entraron y salieron |
| Lista de lectura | Saber | lo que el agente leyó y buscó antes de actuar |
| Diario de comandos | Terminal | cada comando, si salió bien, cuánto tardó, con botón para copiar |
| Marcador de pruebas | Prueba | cada ronda de pruebas y la racha de verdes |
| Diario de viaje | Viaje | páginas abiertas, búsquedas web y herramientas MCP |
| Vista de la colmena | Enjambre | los agentes ayudantes, cuáles siguen corriendo y cuánto tardaron |
| Diario del escriba | Escriba | cada documento escrito, líneas que entraron y salieron |
| Diario de ramas | Rama | cada comando git y gh, y cuántos commits |
| Diario de arreglos | Cazador | lo que falló y volvió a funcionar, en cuántos intentos y cuánto tiempo |
| Diario de datos | Cristal | archivos de datos leídos o cambiados y cada comando de base de datos |
| Diario de estilos | Pincel | cada hoja de estilo cambiada, líneas que entraron y salieron |

Para todos: el **Diario** de los últimos 14 días y el **contador de espera**, cuánto tiempo te esperaron hoy tus agentes.

<img width="100%" alt="Las Habilidades, con el diario de los últimos 14 días" src="screens/powers.es.png" />
