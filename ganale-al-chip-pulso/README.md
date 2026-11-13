# Ruta a Mano

Minijuego del stand de Control Position para mostrar **GoodRoute**. Antes se llamaba *Gánale al Chip · A pulso*: es una versión de *Gánale al Chip* en que el jugador maneja la camioneta. La carpeta conserva el nombre `ganale-al-chip-pulso`.

> Lleva tú la camioneta por las calles hasta todos los clientes, antes que el chip y sin tocar los bordes.

**Qué muestra del producto:** la ruta óptima contra la ruta hecha a mano. El jugador tiene que decidir el orden y además manejar bien; el chip solo planifica y nunca se equivoca.

## Cómo se juega

1. **Partida:** después de la cuenta regresiva, agarra la camioneta azul en la base y arrástrala con el mouse o el dedo. Si la sueltas, se queda donde está y la puedes volver a agarrar.
2. **Recorrido:** pasa por todos los clientes en el orden que quieras. Cada cliente visitado se pinta azul con su número.
3. **Choques:** si tocas el borde de una manzana, una obra o el borde del mapa:
   - Chocas y vuelves a empezar desde la base.
   - Los clientes visitados se borran.
   - El reloj sigue corriendo.

   Cuando vas muy cerca del borde, aparece un anillo rojo.
4. **El chip:** sale con unos segundos de desventaja y recorre la ruta óptima, en naranjo. Gana quien visite a todos primero. Si el chip llega antes, te quedan 10 s para terminar.
   Si terminas antes que el chip, el resto de su recorrido se ve al doble de velocidad (×2), para que la espera sea más corta. El resultado no cambia.
5. **Resultado:** compara tiempo, cuadras y choques, y muestra en naranjo el orden del chip.

Son 4 niveles, y cada uno es más difícil:
- Clientes: 3, 4, 5 y 6.
- Más obras.
- Un chip más rápido que sale antes.
- Calles más angostas, así que es más fácil chocar.

**GoodRoute calcula de verdad:** la ruta del chip es el óptimo exacto (Held-Karp, ruta abierta). Tus cuadras se miden sobre el eje de la calle, así que el zigzag del pulso no cuenta.

## Puntaje por nivel

| Concepto | Puntos |
|---|---|
| Eficiencia en cuadras | hasta 500 (cuadras del chip ÷ tus cuadras × visitados ÷ total) |
| Ganarle al chip | +400 |
| Terminar sin choques | +100 |

## Con celulares (de 1 a 6 jugadores)

En la pantalla de inicio se elige cuántos juegan:
- **Jugar:** 1 jugador, en esta pantalla, como siempre.
- **Jugar con celulares:** de 1 a 6 jugadores.
  1. Aparece un QR a la vez. Cada uno lo escanea y confirma "¡Estoy listo!" en su celular.
  2. Cuando todos confirmaron, la partida empieza a la vez en todos, con los mismos desafíos.
  3. La pantalla grande muestra un cuadro por jugador con su partida en vivo y, al final, el podio.
  4. "Terminar partida", solo en el computador, corta el juego en todos los celulares.

Lo agrega `multi.js` (con `multi.css` y `online.js`), sin cambiar `juego.js`. Necesita Firebase configurado (ver el README principal). Para probar sin Firebase, abre `index.html?prueba=1`.

## Correrlo

Es HTML, CSS y JS sin dependencias. Abre `index.html` en el navegador, o publícalo en GitHub Pages. También está en la biblioteca (`../index.html`).

En el stand:
- Usa el botón ⛶ para pasar a pantalla completa.
- Si nadie toca la pantalla por 40 s, el juego vuelve solo al inicio.
- El ranking queda guardado en ese navegador (top 10).
- Para borrar el ranking, mantén presionado el logo 3 s.

## Ajustes

Todo el balance está en `AJUSTES`, al comienzo de `juego.js`:
- `anchoCalle`: el ancho de las calles. Más ancho es más fácil; conviene subirlo si el juego se usa en pantallas táctiles chicas.
- `alChocar`: qué pasa al chocar. `"inicio"` vuelve a la base y borra los clientes; `"cliente"` vuelve al último cliente visitado.
- Por nivel: clientes, obras, velocidad del chip y su desventaja en segundos.
- `segundosExtra` y los puntajes.

## Archivos

- `juego.js`: la lógica del juego.
- `comun.js` y `comun.css`: la base compartida con los otros minijuegos. Son iguales en todas las carpetas.
- `estilos.css`: los estilos propios de este juego.
