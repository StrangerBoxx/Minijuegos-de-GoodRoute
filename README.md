# Minijuegos GoodRoute

Biblioteca de minijuegos del stand de Control Position. Cada juego muestra una parte de **GoodRoute** en alrededor de un minuto.

- **Sitio:** https://strangerboxx.github.io/Minijuegos-de-GoodRoute/
- **Página principal:** `index.html`, la biblioteca.

## Juegos

La biblioteca muestra 4 juegos, en orden alfabético:

| Juego | Qué muestra | Duración | Carpeta |
|---|---|---|---|
| ¿Cuál es más corta? | Ojo de optimizador | 40 s | `minijuegos-de-ruta/` (`?juego=corta`) |
| Jornada Perfecta | Ventanas horarias | 1,5 min · 4 días | `jornada-perfecta/` |
| Modo GoodRoute | Varios técnicos | Sin tiempo · 5 niveles | `modo-goodroute/` |
| Ruta a Mano | Ruta óptima | 1,5 min · 4 niveles | `ganale-al-chip-pulso/` |

**Minijuegos de ruta ocultos.** `minijuegos-de-ruta/index.html` es un solo archivo con 5 minijuegos. Además de *¿Cuál es más corta?*, tiene *Carril libre*, *Desvío*, *Despacho relámpago* y *Memoriza la ruta*, que están ocultos en la biblioteca (`oculto: true` en `biblioteca/juegos.js`). Para mostrar uno, borra ese `oculto: true`.

**La dificultad sube en cada nivel:**
- **¿Cuál es más corta?:** cada ronda es un nivel. Suben los clientes (de 5 a 9) y las dos rutas se parecen cada vez más.
- **Ruta a Mano:** 4 niveles. Suben los clientes y las obras, el optimizador va más rápido y sale antes, y las calles se angostan.
- **Modo GoodRoute:** 5 niveles, de un técnico a un día al límite con varios técnicos, externos y órdenes que vencen hoy, más un nivel secreto contra el reloj. Puntaje por nivel terminado a mano: 200 + hasta 500 por viaje (el de GoodRoute ÷ el tuyo) + hasta 300 por rapidez (unos 10 s por orden); si lo resuelve GoodRoute, 0. Se ajusta en `PUNTOS`. Se juega con celulares igual que los otros (se transmite el mapa SVG) y todos reciben los mismos mapas.
- **Jornada Perfecta:** 4 días. Suben los clientes, los que tienen hora acordada y las obras, las horas quedan más justas y el reloj corre más rápido.

Todo se ajusta en `AJUSTES`, al comienzo del código de cada juego.

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
- **Ruta a Mano, Jornada Perfecta y Modo GoodRoute:** usan `multi.js` (y `multi.css`). Cada celular manda solo datos de su partida (`window.__vivo` en cada juego): el nivel una vez y lo que cambia (camioneta, reloj, órdenes elegidas) hasta 15 veces por segundo. La pantalla grande dibuja cada partida con el código del propio juego, nítida a cualquier tamaño. Modo GoodRoute manda su dibujo SVG, que es vectorial. Si un juego no tiene `__vivo`, se manda una imagen de la pantalla como respaldo.

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
- **Pantalla de ranking:** el botón del trofeo, abajo a la derecha en la biblioteca, cambia a la pantalla de ranking, y el del mando vuelve a los juegos. Se puede dejar fija abriendo `index.html#ranking`. Muestra el top 5 de cada juego en grande, en 16:9, para leerlo al pasar, y se actualiza sola cuando alguien entra al ranking. Las entradas de los últimos 15 minutos se marcan como **Nuevo**. El punto de abajo a la derecha es verde con internet y gris sin internet. Los botones se esconden cuando no se mueve el mouse. La biblioteca y el ranking comparten el mismo diseño en 16:9 (cabecera, tarjetas y botones de abajo a la derecha) y se escalan a cualquier pantalla. La pantalla completa se mantiene al cambiar entre ranking y juegos.
- **Vuelta a la biblioteca:** si nadie toca la pantalla por 2 minutos dentro de un juego, se vuelve sola a la biblioteca. Se ajusta en `AJUSTES`, al comienzo de `biblioteca/biblioteca.js`, y funciona cuando el sitio se sirve por http(s).
- **Rankings:** los 3 juegos usan la misma tabla: top 5 en el inicio y top 10 al final, donde cada uno escribe su nombre. En las partidas con celulares, el ganador queda con el nombre de su color. Se guardan en el navegador de cada equipo. Para borrar el de *Ruta a Mano* o *Jornada Perfecta*, mantén presionada su etiqueta naranja 3 s. Para borrar **todos** los récords y rankings de una vez, usa el botón ↺ de la pantalla de ranking. Pide confirmar 4 veces y no se puede deshacer.

## Agregar o quitar un juego

1. Copia la carpeta del juego junto a las demás.
2. Agrega su entrada en `biblioteca/juegos.js`: nombre, frase, etiqueta y duración. Para ocultarlo sin borrarlo, usa `oculto: true`.
3. Pon su portada en `biblioteca/miniaturas/<carpeta>.jpg` (16:10, por ejemplo 960×600). Las portadas actuales están dibujadas en `biblioteca/portadas.html`.

## Archivos

- `index.html`: la biblioteca.
- `biblioteca/ranking.js` y `biblioteca/ranking.css`: la pantalla de ranking, que vive dentro de `index.html`.
- `biblioteca/`: lógica, estilos, catálogo (`juegos.js`), logo, ícono y miniaturas.
- `minijuegos-de-ruta/`: los 5 minijuegos de ruta en un solo archivo (`index.html`), más `online.js` y `online.css`.
- `ganale-al-chip-pulso/` y `jornada-perfecta/`: un juego cada una. Cada carpeta tiene su `juego.js`, sus estilos, `multi.js` / `multi.css` y `online.js` / `online.css`.
- `firebase-config.js`: la conexión de Firebase.

## Versiones anteriores

Los juegos que se eliminaron siguen en el historial de GitHub: *Gánale al Chip*, *Reparto*, *Día Imprevisto*, *Ruta en Relevo*, *Turno de Crisis*, *Flota en Vivo* y *Duelo de Rutas*. Para recuperarlos, vuelve a la versión `a51e50d`. Por ejemplo, para traer una carpeta: `git checkout a51e50d -- reparto`.
