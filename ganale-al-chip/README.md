# Gánale al Chip

Minijuego del stand de Control Position. El jugador compite contra el **chip**, que es nuestro optimizador de rutas: los dos tienen que visitar a todos los clientes de una ciudad, y gana el que termina primero.

## Cómo se juega

1. Toca los clientes en el orden en que quieres visitarlos. El auto va solo por el camino más corto entre uno y otro, así que lo único que decides es el **orden**. Eso es exactamente lo que resuelve el optimizador.
2. Tu auto sale apenas eliges el primer cliente. El chip calcula la ruta óptima y sale con una pequeña desventaja.
3. Hay 3 niveles, cada uno con más clientes y más calles cortadas por obras.
4. Al final ingresas tu nombre y quedas en el ranking del stand.

Una partida dura menos de un minuto.

## Correrlo

Es HTML, CSS y JS sin dependencias. Abre `index.html` en el navegador, o publícalo en GitHub Pages.

En el stand:
- Usa el botón ⛶ de la esquina para pasar a pantalla completa.
- Si nadie toca la pantalla por 40 s, el juego vuelve solo al inicio.
- El ranking queda guardado en ese navegador.
- Para borrar el ranking antes del evento, mantén presionado el logo 3 s.

## Ajustes

Todo lo que se puede ajustar está en `AJUSTES`, al comienzo de `juego.js`:
- Velocidad de los autos.
- Por nivel: cantidad de clientes, calles cortadas y ventaja del chip en segundos.
- Puntaje: hasta 600 puntos por eficiencia de la ruta y 400 por ganar.
