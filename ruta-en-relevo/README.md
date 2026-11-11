# Ruta en Relevo

Minijuego **grupal por turnos** del stand para mostrar **GoodRoute**. Juegan de 2 a 4 personas en la misma partida, **con un solo mouse**.

> Entre todos arman una sola ruta: por turnos, cada uno toma el mouse y elige el próximo cliente.

**Qué muestra del producto:** la ruta óptima. Elegir bien "el próximo cliente" no es lo mismo que ir al más cercano; el chip ve la ruta completa.

## Cómo se juega

1. **Inicio:** eligen cuántos juegan (2, 3 o 4). Cada persona tiene un color y un número (1 Azul, 2 Verde, 3 Morado, 4 Rosa).
2. **Turnos:** aparece "Turno de…" con el color de quien sigue, que toma el mouse. Tiene 8 segundos para hacer clic en el próximo cliente que visita la camioneta. Un clic en el mapa salta el aviso.
3. **Relevo:** el turno pasa a la siguiente persona, y así hasta visitar a todos. Son 3 turnos por persona: 6 clientes con 2 jugadores, hasta 12 con 4.
4. **Cada jugada se mide:** el aviso del turno siguiente dice cómo le fue a la anterior: "✓ eligió el mejor cliente" o "2 cuadras de más". Si se acaba el tiempo, la camioneta va al cliente más cercano y la jugada no suma.
5. **Resultado:**
   - La ruta del equipo, pintada por tramos con el color de quien eligió cada uno, contra la ruta del chip en naranjo.
   - La lista de jugadas (✓, +n o ⏱).
   - Lo que aportó cada persona, con insignias: *Mejor navegante*, *Todo perfecto* y *Más rápido*.

**GoodRoute calcula de verdad:**
- Antes y después de cada elección se calcula la ruta más corta posible para los clientes que faltan. Usa programación dinámica exacta, como Held-Karp.
- La diferencia entre esas dos rutas son las cuadras de más de esa jugada. Una jugada con 0 es la mejor posible.
- La ruta del chip es el óptimo exacto.

## Puntaje

| Concepto | Puntos |
|---|---|
| Jugada perfecta (0 cuadras de más) | 100 + 5 por cada segundo que sobró |
| Jugada con cuadras de más | 100 − 25 por cuadra (mínimo 0) |
| Sin elegir a tiempo | 0 |
| El equipo iguala al chip | +300 |

El ranking es por equipo.

## Correrlo

Es HTML, CSS y JS sin dependencias. Abre `index.html` en el navegador, o entra desde la biblioteca (`../index.html`).

En el stand:
- Usa el botón ⛶ para pasar a pantalla completa.
- Si nadie toca la pantalla por 40 s, el juego vuelve solo al inicio.
- Para borrar el ranking, mantén presionado el logo 3 s.

## Ajustes

Todo el balance está en `AJUSTES`, al comienzo de `juego.js`:
- Clientes por jugador.
- Segundos por turno y duración del aviso de cambio de turno.
- Obras.
- Puntajes.

## Archivos

- `juego.js`: la lógica del juego.
- `comun.js` y `comun.css`: la base compartida con los otros minijuegos. Son iguales en todas las carpetas.
- `estilos.css`: los estilos propios de este juego.
