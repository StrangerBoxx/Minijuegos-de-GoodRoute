# Turno de Crisis

Minijuego **grupal por turnos** del stand para mostrar **GoodRoute**. Juegan de 2 a 4 personas en la misma partida, **con un solo mouse**. Es la versión grupal de *Día Imprevisto*.

> Son la central de despacho: cada imprevisto del día le toca a una persona distinta.

**Qué muestra del producto:** la reprogramación durante el día: qué hacer cuando un técnico se enferma, entra una orden urgente o un trabajo se alarga.

## Cómo se juega

1. **Inicio:** eligen cuántos juegan (2, 3 o 4). Cada persona tiene un color y un número (1 Turquesa, 2 Rosa, 3 Mostaza, 4 Grafito). Son colores distintos de los técnicos Ana, Pedro y Luis, para que no se confundan.
2. **El día:** los técnicos salen con su ruta armada y el reloj avanza.
3. **Turnos:** antes de cada imprevisto aparece "Le toca a…" y esa persona toma el mouse. La tarjeta del imprevisto dice quién decide, y tiene 7 segundos para elegir. Si no elige, pasa lo peor.
4. **Cada uno resuelve 2 imprevistos.** Con 2 jugadores son 4 en el día, y con 4 jugadores son 8.
5. **Resultado:**
   - El día del equipo contra un día paralelo en que GoodRoute decidió todo.
   - Cada decisión, con quién la tomó.
   - Lo que aportó cada persona, con insignias: *Mejor despachador*, *Todo como GoodRoute* y *Más rápido*.

**GoodRoute calcula de verdad:** igual que en *Día Imprevisto*, cada opción se evalúa simulando el resto del día completo. Solo un técnico puede enfermarse por día.

## Puntaje

El puntaje es del equipo y se calcula igual que en *Día Imprevisto*. El bono de cada decisión se acredita a quien la tomó.

| Concepto | Puntos |
|---|---|
| Orden a tiempo | 100 |
| Orden atrasada | 30 |
| Orden pendiente | −50 |
| Elegir la mejor opción | +50, más 10 por cada segundo que sobró |

El ranking es por equipo.

## Correrlo

Es HTML, CSS y JS sin dependencias. Abre `index.html` en el navegador, o entra desde la biblioteca (`../index.html`).

En el stand:
- Usa el botón ⛶ para pasar a pantalla completa.
- Si nadie toca la pantalla por 40 s, el juego vuelve solo al inicio.
- Para borrar el ranking, mantén presionado el logo 3 s.

## Ajustes

Todo el balance está en `AJUSTES`, al comienzo de `juego.js`:
- Imprevistos por jugador y en qué horario ocurren.
- Segundos para decidir y duración del aviso de turno.
- Los tipos de imprevisto.
- Puntajes.

## Archivos

- `juego.js`: la lógica del juego.
- `comun.js` y `comun.css`: la base compartida con los otros minijuegos. Son iguales en todas las carpetas.
- `estilos.css`: los estilos propios de este juego.
