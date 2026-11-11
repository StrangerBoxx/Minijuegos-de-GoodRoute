# Flota en Vivo

Minijuego **grupal** del stand de Control Position para mostrar **GoodRoute**. Juegan de 2 a 4 personas a la vez, en la misma pantalla y en la misma partida.

> Las órdenes llegan durante el día. Cada uno maneja una camioneta y entre todos las atienden a tiempo.

**Qué muestra del producto:** el despacho en tiempo real. Las órdenes entran durante el día y hay que decidir en el momento qué camioneta toma cada una.

## Cómo se juega

1. **Inicio:** eligen cuántos juegan (2, 3 o 4). Cada persona es una camioneta, con su color y su número (1 Azul, 2 Verde, 3 Morado, 4 Rosa).
2. **Tomar órdenes:** se arrastra desde la propia camioneta hasta una orden. Para encadenar varias, se arrastra desde la última orden de la cola. La camioneta va sola por el camino más corto. Una orden que está en la cola de otro jugador, y a la que todavía no partió, se le puede quitar arrastrándola a la propia.
3. **Al mismo tiempo:** en una pantalla multitáctil cada uno arrastra con su dedo sin esperar a los demás.
4. **Plazos:** cada orden tiene un anillo que se va vaciando hasta su hora límite. Si se llega después, la orden cuenta como atrasada y vale menos. Las urgentes (⚡) tienen menos plazo y valen más.
5. **El día:** va de 8:00 a 17:00 en alrededor de 70 s. Lo que no se alcanza a atender queda sin atender.
6. **Resultado:** el equipo se compara con GoodRoute, y se ve cuánto aportó cada persona: puntos, porcentaje del equipo e insignias (*Más órdenes*, *Rescató urgentes*, *Menos km por orden*, *Todo a tiempo*).

**Cada participación cuenta:**
- Cada orden suma al equipo y a quien la atendió.
- Al final, las órdenes del equipo se suman al **total del stand**: "Entre todos los equipos del stand ya van N órdenes atendidas".

**GoodRoute calcula de verdad:** el día de GoodRoute se simula en paralelo, con las mismas órdenes, camionetas y reglas. Cada vez que una camioneta queda libre o entra una orden, GoodRoute elige la mejor combinación de camioneta y orden con lo que llegó hasta ese momento. No sabe qué órdenes vienen después, igual que los jugadores.

## Puntaje del equipo

| Concepto | Puntos |
|---|---|
| Orden a tiempo | 100 |
| Urgente a tiempo | 150 |
| Orden atrasada | 40 |
| Igualar o superar a GoodRoute | +300 |

El ranking es por equipo: al final se escribe el nombre del equipo.

## Con celulares

Al empezar se elige **Jugar con celulares** o **Jugar en esta pantalla**. Con celulares, la pantalla muestra un QR por color; cada persona escanea el suyo y toca una orden en su celular para que la tome su camioneta, mientras la pantalla grande muestra el juego en vivo. Necesita Firebase configurado (ver el README principal). Para probar sin Firebase, abre `index.html?prueba=1` y los enlaces de los QR en otras pestañas del mismo navegador.

## Correrlo

Es HTML, CSS y JS sin dependencias. Abre `index.html` en el navegador, o entra desde la biblioteca (`../index.html`).

En el stand:
- Conviene una pantalla táctil **multitáctil**. Con mouse también funciona, pero arrastra una persona a la vez.
- Usa el botón ⛶ para pasar a pantalla completa.
- Si nadie toca la pantalla por 40 s, el juego vuelve solo al inicio.
- El ranking y el total del stand quedan guardados en ese navegador.
- Para borrar el ranking, mantén presionado el logo 3 s. El total del stand se borra con la clave `flota-en-vivo.total` de `localStorage`.

## Ajustes

Todo el balance está en `AJUSTES`, al comienzo de `juego.js`:
- Largo y velocidad del día.
- Minutos por cuadra y de servicio.
- Órdenes por jugador, plazos normales y urgentes, y porcentaje de urgentes.
- Puntajes.

## Archivos

- `juego.js`: la lógica del juego.
- `comun.js` y `comun.css`: la base compartida con los otros minijuegos. Son iguales en todas las carpetas.
- `estilos.css`: los estilos propios de este juego.
- `online.js` y `online.css`: la sala con los QR y la conexión con los celulares (iguales en los juegos que los usan).
- `control.html` y `control.js`: lo que ve cada jugador en su celular.
