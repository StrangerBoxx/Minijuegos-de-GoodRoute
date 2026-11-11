# Reparto

Minijuego del stand de Control Position para mostrar **GoodRoute**.

> Reparte las órdenes del día entre tus técnicos para que nadie termine tarde.

**Qué muestra del producto:** la asignación de órdenes entre varios técnicos y el equilibrio de carga.

## Cómo se juega

1. **Asignar:** toca una orden y elige en el selector qué técnico la hace (A, P, L). La × la deja sin asignar.
2. **Ruta:** cada técnico arma solo su mejor ruta con lo que le tocó, así que tú decides únicamente *quién* hace cada orden.
3. **Jornada:**
   - Las barras de abajo muestran a qué hora termina cada técnico.
   - La línea vertical marca las 18:00.
   - Si un técnico no alcanza antes de las 19:00, sus últimas órdenes quedan pendientes y la barra se pone roja.
4. **Resultado:** al tocar **Listo**, o cuando se acaba el tiempo, se ve el día. Después aparecen el reparto de GoodRoute (rutas naranjas y una letra naranja en cada orden) y la comparación de órdenes atendidas, kilómetros y hora del último en terminar.

Son 2 rondas:
- **Ronda 1:** 2 técnicos y 6 órdenes, en 30 s.
- **Ronda 2:** 3 técnicos y 9 órdenes, en 45 s.

**GoodRoute calcula de verdad:** prueba todas las formas de repartir (cada orden a cada técnico o pendiente). Las rutas de cada técnico se calculan exactas con Held-Karp.

## Puntaje por ronda

| Concepto | Puntos |
|---|---|
| Orden atendida | 100 |
| Eficiencia en km | hasta 200 |
| Todas atendidas y nadie termina después de las 18:00 | +150 |
| Igualar a GoodRoute | +150 |

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
