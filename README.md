# Minijuegos GoodRoute

Biblioteca de los minijuegos del stand de Control Position. Cada juego muestra una parte de **GoodRoute** en alrededor de un minuto.

## Cómo se usa

1. Abre `index.html` (esta carpeta) en el navegador.
2. Elige la pestaña **Individuales** o **Grupales** y toca la tarjeta de un juego. En Grupales hay un sub-filtro: **Mouse** (por turnos) o **Táctil** (pantalla multitáctil). El botón naranjo **Juego … al azar** (con el logo GR, que gira) sortea uno de la pestaña abierta, con una ruleta que recorre las tarjetas.
3. El juego se abre en la misma página. La barra de arriba tiene:
   - **← Biblioteca** para volver (el botón "atrás" del navegador también sirve).
   - ⛶ para pantalla completa.

Cada tarjeta muestra el récord del juego. Para destacar un juego con la etiqueta **Nuevo**, agrega `nuevo: true` a su entrada en `biblioteca/juegos.js`.

Los juegos **grupales** se juegan de 2 a 4 personas en la misma partida y en la misma pantalla:
- **Con un mouse (por turnos):** *Ruta en Relevo* y *Turno de Crisis*. Antes de cada turno, el juego avisa a quién le toca tomar el mouse. Son los indicados para un stand con un solo mouse.
- **Táctiles (al mismo tiempo):** *Flota en Vivo* y *Duelo de Rutas*. Necesitan una pantalla multitáctil para que jueguen todos a la vez. El análisis y el diseño están en `DISENO-GRUPALES.md`.

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
| Flota en Vivo | Grupal (2 a 4, táctil) | Despacho en tiempo real: cada uno maneja una camioneta |
| Duelo de Rutas | Grupal (2 a 4, táctil) | Ruta óptima vs. ruta a ojo: un tablero por jugador, la misma ciudad |

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
- `biblioteca/juegos.js`: el catálogo (nombre, frase, modo individual o grupal, qué muestra, duración).
- `biblioteca/biblioteca.js` y `biblioteca/biblioteca.css`: la lógica y los estilos de la biblioteca.
- `biblioteca/miniaturas/`: una captura por juego.
- `biblioteca/logo-goodroute.gif`: el logo animado de GoodRoute (también está en la carpeta de cada juego, para su pantalla de inicio).
- Una carpeta por juego, cada una con su propio `README.md`.
