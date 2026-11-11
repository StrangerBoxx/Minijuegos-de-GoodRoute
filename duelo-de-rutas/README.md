# Duelo de Rutas

Minijuego **grupal** del stand de Control Position para mostrar **GoodRoute**. Juegan de 2 a 4 personas a la vez, en la misma pantalla y en la misma partida.

> La misma ciudad para todos, un tablero para cada uno. ¿Quién arma la ruta más corta, y alguien le gana al chip?

**Qué muestra del producto:** la ruta óptima contra la ruta hecha a ojo. Cuando varias personas lo intentan con la misma ciudad, se nota lo distintas que salen las rutas y que el chip siempre encuentra la más corta.

## Cómo se juega

1. **Inicio:** eligen cuántos juegan (2, 3 o 4). La pantalla se divide en un tablero por persona, con su color y su número.
2. **Ronda:** todos los tableros tienen la misma ciudad, la misma base y los mismos clientes. Cada uno toca los clientes en el orden en que los visitaría, saliendo de la base. Tocar un cliente ya elegido deshace la ruta hasta ahí.
3. **Al mismo tiempo:** cada tablero recibe sus propios toques, así que en una pantalla multitáctil juegan todos a la vez.
4. **Fin de ronda:** cuando todos completan la ruta, o se acaba el tiempo. Se ve la ruta del chip en naranjo en todos los tableros, con su orden de visita, y el puntaje de la ronda.

Son 3 rondas: 5, 6 y 7 clientes, con 25, 30 y 35 s.

**Cada participación cuenta:**
- Cada persona tiene su puntaje y su lugar en el podio.
- El resultado final también cuenta cuántas veces el grupo, entre todos, igualó al chip.
- Cada jugador puede escribir su nombre para el ranking.

**GoodRoute calcula de verdad:** la ruta del chip es el óptimo exacto (Held-Karp, ruta abierta desde la base), igual que en *Gánale al Chip*.

## Puntaje por ronda

| Concepto | Puntos |
|---|---|
| Eficiencia en cuadras | hasta 500 (cuadras del chip ÷ tus cuadras × visitados ÷ total) |
| Igualar al chip | +200 |
| Terminar 1º / 2º / 3º (con la ruta completa) | +150 / +100 / +50 |

## Correrlo

Es HTML, CSS y JS sin dependencias. Abre `index.html` en el navegador, o entra desde la biblioteca (`../index.html`).

En el stand:
- Conviene una pantalla táctil **multitáctil**. Con mouse también funciona, pero de a un toque.
- Usa el botón ⛶ para pasar a pantalla completa.
- Si nadie toca la pantalla por 40 s, el juego vuelve solo al inicio.
- El ranking (individual) queda guardado en ese navegador (top 10).
- Para borrar el ranking, mantén presionado el logo 3 s.

## Ajustes

Todo el balance está en `AJUSTES`, al comienzo de `juego.js`:
- Por ronda: clientes, obras y segundos.
- Los puntajes y el bono por terminar primero.

## Archivos

- `juego.js`: la lógica del juego.
- `comun.js` y `comun.css`: la base compartida con los otros minijuegos. Son iguales en todas las carpetas.
- `estilos.css`: los estilos propios de este juego.
