# Minijuegos GoodRoute

Biblioteca de minijuegos del stand de Control Position. Cada juego muestra una parte de **GoodRoute** en alrededor de un minuto.

- **Sitio:** https://strangerboxx.github.io/Minijuegos-de-GoodRoute/
- **Página principal:** `index.html`, la biblioteca.

## Juegos

La biblioteca muestra 3 juegos, en orden alfabético:

| Juego | Qué muestra | Duración | Carpeta |
|---|---|---|---|
| ¿Cuál es más corta? | Ojo de optimizador | 40 s | `minijuegos-de-ruta/` (`?juego=corta`) |
| Gánale al Chip · A pulso | Ruta óptima | 1 min · 3 niveles | `ganale-al-chip-pulso/` |
| Jornada Perfecta | Ventanas horarias | 1 min · 3 días | `jornada-perfecta/` |

**Minijuegos de ruta ocultos.** `minijuegos-de-ruta/index.html` es un solo archivo con 5 minijuegos. Además de *¿Cuál es más corta?*, tiene *Carril libre*, *Desvío*, *Despacho relámpago* y *Memoriza la ruta*, que están ocultos en la biblioteca (`oculto: true` en `biblioteca/juegos.js`). Para mostrar uno, borra ese `oculto: true`.

## Cómo se usa

1. Abre la biblioteca y toca la tarjeta de un juego, o el botón **Juego al azar**.
2. El juego se abre en la misma página. La barra de arriba tiene **← Biblioteca** para volver y ⛶ para pantalla completa.
3. Cada tarjeta muestra el récord del juego.

## Jugar con celulares (1 a 6 jugadores)

En la pantalla de inicio de cada juego se elige cuántos juegan:
- **Jugar (en esta pantalla):** 1 jugador, en la pantalla del stand.
- **Jugar con celulares:** de 1 a 6 jugadores, cada uno en su teléfono.
  1. Aparece **un QR a la vez**, en orden de jugador. Cada uno lo escanea cuando le toca, y así queda definido su color y su número.
  2. Cada uno lee cómo se juega y toca **"¡Estoy listo!"**. La pantalla grande muestra quién confirmó.
  3. Cuando **todos confirmaron**, la partida empieza a la vez en todos los celulares, con los mismos desafíos.
  4. La pantalla grande muestra **un cuadro por jugador con su partida en vivo**, con su color, nombre y puntos.
  5. **"Terminar partida"**, solo en el computador, corta el juego en todos los celulares.
  6. Al final aparece el **podio**, y cada celular muestra su puntaje y en qué lugar quedó.

Cómo está hecho:
- **¿Cuál es más corta?:** cada celular manda una "foto" del estado de su juego y la pantalla la redibuja con el mismo código.
- **Gánale al Chip · A pulso y Jornada Perfecta:** usan `multi.js` (y `multi.css`), que se suma al juego sin cambiar su lógica. Cada celular manda una imagen reducida de su pantalla unas 3 veces por segundo.

### Firebase

Los celulares se conectan con la pantalla a través de **Firebase Realtime Database**: proyecto `minijuegos-goodroute`, en `us-central1`. La configuración está en `firebase-config.js`. Si queda en `null`, el botón "Jugar con celulares" aparece desactivado y los juegos se siguen jugando en la pantalla.

Reglas de la base de datos: solo permiten leer y escribir partidas (`salas/CÓDIGO`).

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

**Para probar sin Firebase:** agrega `?prueba=1` a la dirección del juego y abre los enlaces de los QR en otras pestañas del **mismo navegador**.

**Notas:**
- Los celulares y la pantalla necesitan internet.
- Las partidas se borran solas al terminar.
- Los datos de `firebase-config.js` no son secretos; lo que protege la base son las reglas.

## En el stand

- **Un juego fijo:** abre `index.html#carpeta`, por ejemplo `index.html#jornada-perfecta`, y el juego se abre directo.
- **Vuelta a la biblioteca:** si nadie toca la pantalla por 2 minutos dentro de un juego, se vuelve sola a la biblioteca. Se ajusta en `AJUSTES`, al comienzo de `biblioteca/biblioteca.js`, y funciona cuando el sitio se sirve por http(s).
- **Rankings:** se guardan en el navegador de cada equipo. Para borrar el de un juego, mantén presionado su logo 3 s.

## Agregar o quitar un juego

1. Copia la carpeta del juego junto a las demás.
2. Agrega su entrada en `biblioteca/juegos.js`: nombre, frase, etiqueta y duración. Para ocultarlo sin borrarlo, usa `oculto: true`.
3. Pon una captura de 640×400 en `biblioteca/miniaturas/<carpeta>.jpg`.

## Archivos

- `index.html`: la biblioteca.
- `biblioteca/`: lógica, estilos, catálogo (`juegos.js`), logo, ícono y miniaturas.
- `minijuegos-de-ruta/`: los 5 minijuegos de ruta en un solo archivo (`index.html`), más `online.js` y `online.css`.
- `ganale-al-chip-pulso/` y `jornada-perfecta/`: un juego cada una. Cada carpeta tiene su `juego.js`, sus estilos, `multi.js` / `multi.css` y `online.js` / `online.css`.
- `firebase-config.js`: la conexión de Firebase.

## Versiones anteriores

Los juegos que se eliminaron siguen en el historial de GitHub: *Gánale al Chip*, *Reparto*, *Día Imprevisto*, *Ruta en Relevo*, *Turno de Crisis*, *Flota en Vivo* y *Duelo de Rutas*. Para recuperarlos, vuelve a la versión `a51e50d`. Por ejemplo, para traer una carpeta: `git checkout a51e50d -- reparto`.
