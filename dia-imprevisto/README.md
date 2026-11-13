# Día Imprevisto

Minijuego del stand de Control Position para mostrar **GoodRoute**.

> El día ya está planificado. Cuando algo salga mal, decide rápido.

**Qué muestra del producto:** la reprogramación durante el día, la exclusión de técnicos y las órdenes que quedan pendientes.

## Cómo se juega

1. **El día:** Ana, Pedro y Luis salen con 5 órdenes cada uno y el reloj avanza.
2. **Imprevistos:** pasan 4 durante el día, en orden al azar. Cuando aparece uno, el reloj se detiene y tienes **5 segundos** para elegir. Si no eliges, pasa lo peor. Hay tres tipos:
   - **Un técnico se enferma:** sus órdenes pasan todas a uno, todas al otro o se reparten entre los dos.
   - **Entra una orden urgente** con hora límite: la toma uno de los técnicos o queda pendiente.
   - **Un trabajo se alarga 1 hora:** el técnico sigue con todo o pasa su próxima orden a otro.
3. **Ruta:** después de cada decisión, el orden de visitas de cada técnico se recalcula solo.
4. **Resultado:** al final ves cada decisión (✓ si elegiste lo mismo que GoodRoute) y la comparación con un día paralelo en que GoodRoute decidió todo, con los mismos imprevistos.

Una partida dura alrededor de un minuto.

**GoodRoute calcula de verdad:**
- Cada opción se evalúa simulando el resto del día completo.
- GoodRoute decide cada imprevisto con la mejor opción en ese momento, sin saber cuál viene después. Por eso, de vez en cuando, un jugador puede terminar mejor, y el juego lo dice.

## Puntaje

| Concepto | Puntos |
|---|---|
| Orden a tiempo | 100 |
| Orden atrasada | 30 |
| Orden pendiente | −50 |
| Elegir la mejor opción | +50, más 10 por cada segundo que te sobró |

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

Es HTML, CSS y JS sin dependencias. Abre `index.html` en el navegador, o publícalo en GitHub Pages.

En el stand:
- Usa el botón ⛶ para pasar a pantalla completa.
- Si nadie toca la pantalla por 40 s, el juego vuelve solo al inicio.
- El ranking queda guardado en ese navegador (top 10).
- Para borrar el ranking, mantén presionado el logo 3 s.

## Archivos

- `juego.js`: la lógica del juego. Todo el balance está en el objeto `AJUSTES`, al comienzo.
- `comun.js` y `comun.css`: la base compartida con los otros minijuegos (ciudad, rutas óptimas, dibujo, ranking y modo stand). Son iguales en todas las carpetas.
- `estilos.css`: los estilos propios de este juego.
