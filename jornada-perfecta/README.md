# Jornada Perfecta

Minijuego del stand de Control Position para mostrar **GoodRoute**, nuestro optimizador de rutas.

> Arma el día de tu técnico: llega a la hora a cada cliente.

## Cómo se juega

1. **Mapa:** aparece una ciudad con la base, clientes y algunas calles cortadas por obras.
2. **Clientes:** algunos tienen hora acordada, por ejemplo `10:30`. Al técnico le sirve llegar entre 30 min antes y 15 min después. Otros no tienen hora, y basta con atenderlos antes de las 19:00.
3. **Orden de visitas:** tocas los clientes en el orden en que quieres visitarlos. El reloj del día parte en las 8:00 con tu primer toque.
4. **El día:** el técnico viaja (5 min por cuadra) y atiende a cada cliente durante 60 min. Si queda sin próximo cliente, se queda parado mientras el reloj sigue corriendo.
5. **Resultado:** al terminar el día ves la ruta de GoodRoute (en naranjo) y una comparación de clientes a tiempo, kilómetros y hora de término.

Son 3 días, con 4, 5 y 6 clientes. Una partida dura alrededor de un minuto.

**Detalles de diseño:**
- **GoodRoute de verdad:** su ruta es el óptimo exacto, porque prueba todos los órdenes posibles. Usa las mismas reglas que el jugador: jornada, ventanas, servicio y ruta abierta.
- **Siempre hay solución:** las horas se generan de modo que existe al menos un orden con todos los clientes a tiempo.

## Puntaje por día

| Concepto | Puntos |
|---|---|
| Cliente atendido a tiempo | 100 |
| Cliente atendido atrasado | 30 |
| Eficiencia en km | hasta 300 (km GoodRoute ÷ tus km × atendidos ÷ total) |
| Igualar a GoodRoute | +200 |

## Correrlo

Es HTML, CSS y JS sin dependencias. Abre `index.html` en el navegador, o publícalo en GitHub Pages.

En el stand:
- Usa el botón ⛶ para pasar a pantalla completa.
- Si nadie toca la pantalla por 40 s, el juego vuelve solo al inicio.
- El ranking queda guardado en ese navegador (top 10).
- Para borrar el ranking, mantén presionado el logo 3 s.

## Ajustes

Todo el balance está en `AJUSTES`, al comienzo de `juego.js`:
- Las reglas del día y la velocidad del reloj.
- Por día: clientes, clientes con hora y calles cortadas.
- La holgura con que se generan las horas.
- Los puntajes.

El documento de diseño, con las 6 ideas evaluadas y por qué se eligió esta, está en `DISENO.md`.
