# Minijuegos GoodRoute

Biblioteca de los minijuegos del stand de Control Position. Cada juego muestra una parte de **GoodRoute** en alrededor de un minuto.

## Lo que se ve hoy

La biblioteca (`index.html`) muestra **5 minijuegos de ruta** en una sola grilla (sin pestañas Individuales / Grupales):

| Juego | Etiqueta | Duración |
|---|---|---|
| ¿Cuál es más corta? | Ojo de optimizador | 40 s |
| Memoriza la ruta | Orden de visitas | 3 vidas |
| Despacho relámpago | Asignación | 45 s |
| Desvío | Calles cortadas | 60 s |
| Carril libre | Tráfico | 3 vidas |

Los 5 están en un solo archivo, `minijuegos-de-ruta/index.html`. La biblioteca abre cada uno directo, con `?juego=corta`, `memoria`, `despacho`, `desvio` o `carril`. Ese archivo también se puede abrir solo: tiene su propio inicio con las 5 tarjetas, pensado para celular.

**De 1 a 6 jugadores con celulares:** antes de jugar se elige cuántos juegan.
- **Jugar en esta pantalla:** 1 jugador, en la pantalla del stand.
- **Jugar con celulares:** de 1 a 6 jugadores.
  1. Aparece un QR a la vez, en orden de jugador. Cada uno lo escanea cuando le toca.
  2. Cada uno lee cómo se juega y toca **"¡Estoy listo!"** en su celular. La pantalla grande muestra quién confirmó.
  3. Cuando **todos confirmaron**, la partida empieza en todos los celulares a la vez, con los mismos desafíos para todos.
  4. Mientras juegan, la pantalla grande se divide en **un cuadro por jugador** y muestra **la partida de cada uno en vivo**, con su color, nombre y puntos, para que el público vea cómo juegan. Con "Terminar partida" (solo en el computador) se corta la partida en todos los celulares: el juego se detiene, ya no se puede seguir jugando y cada uno ve su puntaje y su lugar.
  5. Al final, la pantalla muestra el podio, y cada celular, su puntaje y en qué lugar quedó.

Usa la misma conexión de Firebase que *Flota en Vivo* y *Duelo de Rutas* (`online.js`). Para probar sin Firebase, abre `minijuegos-de-ruta/index.html?juego=corta&prueba=1` y los enlaces de los QR en otras pestañas del mismo navegador.

**Además se ven 3 de los minijuegos anteriores:** *Gánale al Chip · A pulso*, *Jornada Perfecta* y *Día Imprevisto*. Los tres también se pueden jugar **con celulares, de 1 a 6 jugadores**, igual que los minijuegos de ruta: QR en orden, "¡Estoy listo!", la misma partida para todos, cuadros en vivo, podio y "Terminar partida" desde el computador. Esto lo agrega `multi.js` (con `multi.css`), que se suma a cada juego sin cambiar su lógica. En vivo, cada celular manda una imagen reducida de su pantalla unas 3 veces por segundo. En *Día Imprevisto*, el puntaje se calcula al final del día, así que su cuadro marca 0 hasta que termina.

**Los otros 6 están ocultos:** *Gánale al Chip*, *Reparto*, *Ruta en Relevo*, *Turno de Crisis*, *Flota en Vivo* y *Duelo de Rutas*. Siguen en sus carpetas, sin cambios, pero en `biblioteca/juegos.js` tienen `oculto: true`. Para volver a mostrar uno, borra ese `oculto: true` de su entrada.

## Cómo se usa

1. Abre `index.html` (esta carpeta) en el navegador.
2. Elige la pestaña **Individuales** o **Grupales** y toca la tarjeta de un juego. En Grupales hay un sub-filtro: **Mouse** (por turnos) o **Celulares** (cada uno con su teléfono). El botón naranjo **Juego … al azar** (con el logo GR, que gira) sortea uno de la pestaña abierta, con una ruleta que recorre las tarjetas.
3. El juego se abre en la misma página. La barra de arriba tiene:
   - **← Biblioteca** para volver (el botón "atrás" del navegador también sirve).
   - ⛶ para pantalla completa.

Cada tarjeta muestra el récord del juego. Para destacar un juego con la etiqueta **Nuevo**, agrega `nuevo: true` a su entrada en `biblioteca/juegos.js`.

Los juegos **grupales** se juegan de 2 a 4 personas en la misma partida y en la misma pantalla:
- **Con un mouse (por turnos):** *Ruta en Relevo* y *Turno de Crisis*. Antes de cada turno, el juego avisa a quién le toca tomar el mouse. Son los indicados para un stand con un solo mouse.
- **Con celulares (al mismo tiempo):** *Flota en Vivo* y *Duelo de Rutas*. Cada uno escanea un QR y juega en su teléfono (ver más abajo). También se pueden jugar en una pantalla multitáctil. El análisis y el diseño están en `DISENO-GRUPALES.md`.

## Juegos

| Juego | Modo | Qué muestra del producto |
|---|---|---|
| Gánale al Chip · A pulso | Individual | Ruta óptima vs. ruta a mano (manejas tú, sin tocar los bordes) |
| Gánale al Chip | Individual | Orden de visitas |
| Jornada Perfecta | Individual | Ventanas horarias |
| Reparto | Individual | Asignación y equilibrio de carga |
| Día Imprevisto | Individual | Reprogramación durante el día |
| Ruta en Relevo | Grupal (2 a 4, un mouse) | Ruta óptima: por turnos, cada uno elige el próximo cliente y se mide cada jugada |
| Turno de Crisis | Grupal (2 a 4, un mouse) | Reprogramación: cada imprevisto le toca a una persona distinta |
| Flota en Vivo | Grupal (2 a 4, celulares o táctil) | Despacho en tiempo real: cada uno maneja una camioneta |
| Duelo de Rutas | Grupal (2 a 4, celulares o táctil) | Ruta óptima vs. ruta a ojo: un tablero por jugador, la misma ciudad |

## Jugar con celulares (QR)

En los juegos grupales de la sección **Celulares** (*Flota en Vivo* y *Duelo de Rutas*), cada persona puede jugar desde su teléfono:

1. En la pantalla del stand, elige cuántos juegan y toca **Jugar con celulares**.
2. Aparece un QR a la vez, en orden: primero el del jugador 1, y cuando ese celular se conecta, el del 2, y así. Cada persona escanea el suyo cuando le toca, y así queda definido su color y su número.
3. Cuando están todos conectados, la partida empieza sola. Cada uno juega en su celular y la pantalla grande muestra el juego en vivo.
4. Al final, cada celular muestra su resultado. En *Duelo de Rutas* cada uno escribe su nombre para el ranking; en *Flota en Vivo* el jugador 1 escribe el nombre del equipo.

Si no hay conexión, **Jugar en esta pantalla** sigue funcionando como antes, en una pantalla táctil.

### Activar Firebase (una sola vez)

Ya está activado con el proyecto **minijuegos-goodroute** (Realtime Database en `us-central1`, con las reglas de abajo). Estos pasos sirven si algún día hay que armarlo de nuevo en otro proyecto.

Los celulares se conectan con la pantalla a través de **Firebase Realtime Database**, un servicio gratuito de Google. Mientras no esté configurado, el botón aparece desactivado.

1. Entra a https://console.firebase.google.com con tu cuenta de Google y crea un proyecto. Puedes desactivar Google Analytics.
2. En el menú, abre **Compilación → Realtime Database → Crear base de datos**. Elige una ubicación (por ejemplo `us-central1`) y empieza en **modo bloqueado**.
3. En la pestaña **Reglas** de la base de datos, pega estas reglas y toca **Publicar**:

   ```json
   {
     "rules": {
       "salas": {
         ".read": true,
         "$sala": {
           ".write": true,
           ".validate": "$sala.matches(/^[A-Z0-9]{5}$/)"
         }
       }
     }
   }
   ```

   Solo permiten leer y escribir partidas (`salas/CÓDIGO`); el resto de la base queda cerrado.
4. Ve a **Configuración del proyecto** (el engranaje) → **Tus apps** → el ícono **</>** (Web), registra una app (sin Hosting) y copia el objeto `firebaseConfig`.
5. Pégalo en `firebase-config.js`, en la raíz del proyecto, como `window.FIREBASE_CONFIG = { … }`. Revisa que incluya `databaseURL`.
6. Sube el cambio a GitHub (`git commit` y `git push`). En uno o dos minutos, el botón **Jugar con celulares** queda activo.

**Para probar sin Firebase:** abre el juego con `?prueba=1` al final de la dirección (por ejemplo `flota-en-vivo/index.html?prueba=1`) y abre los enlaces de los QR en otras pestañas del **mismo navegador**. Sirve para ver cómo funciona; con celulares de verdad se necesita Firebase.

**Notas:**
- Los celulares necesitan internet (Wi-Fi o datos). La pantalla del stand también.
- Las partidas se borran solas al terminar. Las que quedan abandonadas se borran al crear una nueva, después de unas horas.
- Los datos de `firebase-config.js` no son secretos: identifican el proyecto. Lo que protege la base son las reglas.

## La ciudad

Todos los juegos usan la misma ciudad en grilla, con dos tipos de obstáculo:
- **Edificios:** manzanas vecinas unidas en bloques de 2×1, 2×2 o 3×1. La calle entre ellas desaparece, así que hay que rodearlos.
- **Obras:** calles cortadas, marcadas con barreras naranjas.

Siempre se puede llegar a todas partes, y nunca queda un cliente ni una base dentro de un edificio. La cantidad de obras se ajusta en `AJUSTES` de cada juego. La de edificios (uno cada ~9 manzanas) se ajusta en `crearCiudad`, en `comun.js`, y en `ponerEdificios`, en Gánale al Chip y Jornada Perfecta.

## En el stand

- **Un juego fijo:** abre `index.html#nombre-de-la-carpeta`, por ejemplo `index.html#reparto`, y el juego se abre directo.
- **Vuelta a la biblioteca:** si nadie toca la pantalla por 2 minutos dentro de un juego, se vuelve sola a la biblioteca. Se ajusta en `AJUSTES`, al comienzo de `biblioteca/biblioteca.js` (`0` la desactiva). Solo funciona si la carpeta se sirve por http(s), por ejemplo con GitHub Pages o Live Server. Si abres el archivo directo, el navegador no deja medir los toques dentro del juego.
- **Rankings:** cada juego mantiene su propio ranking y su propia vuelta al inicio a los 40 s. Para borrar un ranking, abre ese juego y mantén presionado su logo 3 s.

## Agregar un juego

1. Copia la carpeta del juego junto a las demás. Los juegos no se modifican: cada carpeta sigue funcionando sola.
2. Agrega una entrada en `biblioteca/juegos.js` con `tipo: "individual"` o `tipo: "grupal"`.
3. Pon una captura de 640×400 en `biblioteca/miniaturas/<carpeta>.jpg`. Si falta, la tarjeta igual funciona, sin imagen.

Para que la tarjeta muestre el récord, el juego debe guardar su ranking en `localStorage` con la clave `<carpeta>.ranking`, como lo hace `Comun.Ranking`.

## Archivos

- `index.html`: la biblioteca.
- `minijuegos-de-ruta/index.html`: los 5 minijuegos de ruta, en un solo archivo.
- `biblioteca/juegos.js`: el catálogo (nombre, frase, modo individual o grupal, qué muestra, duración).
- `biblioteca/biblioteca.js` y `biblioteca/biblioteca.css`: la lógica y los estilos de la biblioteca.
- `biblioteca/miniaturas/`: una captura por juego.
- `firebase-config.js`: la conexión de Firebase para jugar con celulares.
- `online.js` y `online.css` (en *Flota en Vivo* y *Duelo de Rutas*): la sala con los QR y la conexión. `control.html` y `control.js`: lo que se ve en el celular.
- `biblioteca/logo-goodroute.gif`: el logo animado de GoodRoute (también está en la carpeta de cada juego, para su pantalla de inicio).
- Una carpeta por juego, cada una con su propio `README.md`.
