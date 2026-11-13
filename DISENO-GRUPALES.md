# Juegos grupales: análisis y diseño

Este documento resume el análisis de los 5 juegos individuales y explica por qué se diseñaron así los dos grupales, *Flota en Vivo* y *Duelo de Rutas*.

## Los juegos individuales

| Juego | Qué decide el jugador | Mecánica | Contra GoodRoute |
|---|---|---|---|
| Gánale al Chip | Orden de visitas | Toca clientes en orden | Carrera contra el optimizador (Held-Karp) |
| Gánale al Chip · A pulso | Orden y manejo | Arrastra la camioneta por las calles | Carrera contra el optimizador |
| Jornada Perfecta | Orden con ventanas horarias | Toca clientes en orden | Compara con el óptimo |
| Reparto | Qué técnico hace cada orden | Toca una orden y elige el técnico | Compara con el reparto óptimo |
| Día Imprevisto | Qué hacer ante un imprevisto | Elige entre 3 opciones en 5 s | Día paralelo decidido por GoodRoute |

**Lo que tienen en común:**
- Duran alrededor de un minuto.
- Usan la misma ciudad en grilla, con obras.
- Al final se comparan con GoodRoute.
- Tienen ranking por navegador y modo stand.

**Lo que sirve para los grupales:**
- **El mapa compartido escala bien.** La base común (`comun.js`) ya dibuja varios técnicos con colores distintos (Reparto, Día Imprevisto). Para un juego en grupo, a cada persona le toca un técnico.
- **"Tocar en orden" se entiende en 2 segundos.** Gánale al Chip y Jornada Perfecta se explican solos. Esa mecánica sirve para que varias personas jueguen en paralelo sin explicación larga.
- **La comparación con GoodRoute es el remate.** En grupo, compararse entre ellos y además con GoodRoute hace que el producto quede en el centro.
- **Falta tiempo real con varias personas.** Hoy solo Día Imprevisto trabaja con eventos durante el día, pero lo decide una persona. El despacho en vivo es justo lo que más se nota cuando hay varias manos.

**Restricciones del stand:**
- Una sola pantalla, idealmente táctil multitáctil.
- La gente llega en grupos de 2 a 4.
- Las partidas tienen que durar alrededor de un minuto.
- Funciona sin servidor: los datos quedan en el navegador.

## Diseño

Se eligieron dos juegos que se complementan:

| | Flota en Vivo | Duelo de Rutas |
|---|---|---|
| Relación entre jugadores | **Cooperativo**: todos contra el reloj y contra GoodRoute | **Competitivo**: todos contra todos, y el grupo contra el optimizador |
| Pantalla | Un mapa compartido | Un tablero por jugador (pantalla dividida) |
| Entrada | Arrastrar (multitáctil, un dedo por persona) | Tocar en el propio tablero |
| Basado en | Reparto + Día Imprevisto | Gánale al Chip |
| Muestra | Despacho en tiempo real | Ruta óptima vs. ruta a ojo |

**Cómo cuenta cada participación:**
- **Flota en Vivo:** cada orden se acredita a quien la atendió. El final muestra el porcentaje de cada uno e insignias, para que todos tengan algo propio. Además, cada partida suma al contador del stand ("entre todos los equipos ya van N órdenes").
- **Duelo de Rutas:** cada uno tiene su puntaje, su lugar en el podio y su nombre en el ranking. El resultado del grupo cuenta cuántas veces, entre todos, igualaron al optimizador.

**Cómo se identifica a cada jugador en una sola pantalla:**
- **Flota en Vivo:** el arrastre empieza en la propia camioneta (o en la última orden de su cola), así que se sabe de quién es sin botones extra.
- **Duelo de Rutas:** cada toque cae dentro de un tablero, y cada tablero es de una persona.

En ambos juegos, cada dedo se sigue por su `pointerId`, así que varias personas pueden jugar exactamente al mismo tiempo.

## Juegos con un solo mouse

*Flota en Vivo* y *Duelo de Rutas* necesitan una pantalla multitáctil. En el stand hay **un solo mouse**, así que se agregaron dos juegos **por turnos**:

| | Ruta en Relevo | Turno de Crisis |
|---|---|---|
| Relación entre jugadores | Cooperativo: una sola ruta entre todos | Cooperativo: un solo día entre todos |
| Turno | Elegir el próximo cliente (8 s) | Resolver un imprevisto (7 s) |
| Turnos por persona | 3 | 2 |
| Basado en | Gánale al Chip | Día Imprevisto |
| Muestra | Ruta óptima | Reprogramación en el día |

**Pasar el mouse:** antes de cada turno aparece un aviso con el color y el número de quien sigue ("Turno de Verde", "Le toca a Rosa"). La barra de abajo, o la tarjeta del imprevisto, marca quién tiene el mouse.

**Cómo cuenta cada participación:**
- **Ruta en Relevo:** cada elección se mide con un cálculo exacto: la ruta más corta posible para lo que falta, antes y después de elegir. La diferencia son las "cuadras de más" de esa jugada (0 = la mejor posible). Al final, la ruta del equipo se ve pintada por tramos con el color de quien eligió cada uno.
- **Turno de Crisis:** cada decisión queda a nombre de quien la tomó, con su acierto (si eligió lo mismo que GoodRoute) y su rapidez.

Los colores de los jugadores de *Turno de Crisis* (turquesa, rosa, mostaza, grafito) son distintos de los técnicos (azul, verde, morado), para que no se confundan.

## Ideas para después

- Pantalla de espera que muestre en grande el total del stand (atrae público).
- Un modo de *Flota en Vivo* con más jugadores usando celulares. Requiere un servidor para compartir la partida.
