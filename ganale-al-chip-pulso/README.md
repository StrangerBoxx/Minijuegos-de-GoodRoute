# Gánale al Chip · A pulso

Minijuego del stand de Control Position para mostrar **GoodRoute**. Es una versión de *Gánale al Chip* en que el jugador maneja la camioneta.

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
5. **Resultado:** compara tiempo, cuadras y choques, y muestra en naranjo el orden del chip.

Son 3 niveles: 4, 5 y 6 clientes, con más obras y un chip más rápido en cada uno.

**GoodRoute calcula de verdad:** la ruta del chip es el óptimo exacto (Held-Karp, ruta abierta). Tus cuadras se miden sobre el eje de la calle, así que el zigzag del pulso no cuenta.

## Puntaje por nivel

| Concepto | Puntos |
|---|---|
| Eficiencia en cuadras | hasta 500 (cuadras del chip ÷ tus cuadras × visitados ÷ total) |
| Ganarle al chip | +400 |
| Terminar sin choques | +100 |

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
