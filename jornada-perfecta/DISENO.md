# Diseño del minijuego: Jornada Perfecta

Este documento cubre los pasos 1 a 3 del encargo: las ideas, su evaluación y el diseño de la idea elegida. El juego construido, que es el paso 4, está en esta misma carpeta.

Supuestos que tomé:
- **Equipo:** Control Position.
- **Producto:** GoodRoute.
- **Día:** el viernes.
- **Dispositivo:** sin definir, así que el juego funciona en notebook y en tablet o teléfono.

---

## Paso 1: Lluvia de ideas

### 1. Jornada Perfecta
- **Frase:** "Arma el día de tu técnico: llega a la hora a cada cliente."
- **Mecánica:** un técnico y un mapa con clientes. Algunos tienen hora acordada (por ejemplo, 10:30) y otros no tienen hora. El jugador toca los clientes en orden. El reloj del día (8:00 a 19:00) empieza con el primer toque y el técnico va, atiende 60 min y sigue.
- **Decisión real:** el orden de visitas con ventanas horarias (30 min antes y 15 min después), tiempo de servicio, jornada y ruta abierta.
- **Puntaje:** puntos por cliente atendido a tiempo, por kilómetros cerca del óptimo y un bono si igualas a GoodRoute.
- **"¡Uh, casi!":** la hora del cliente se pone ámbar mientras el técnico va en camino y el reloj marca 10:44 con 10:45 de límite.
- **Mensaje final:** "GoodRoute atendió 6 de 6 a tiempo con 3,2 km menos, y lo planificó en milisegundos."

### 2. Despacho en Vivo
- **Frase:** "Llegan órdenes: asígnalas a tus técnicos antes de que se atrasen."
- **Mecánica:** van apareciendo órdenes de trabajo en el mapa. Se toca la orden y luego uno de 3 técnicos.
- **Decisión real:** qué técnico atiende cada orden.
- **Puntaje:** órdenes atendidas a tiempo.
- **"¡Uh, casi!":** una orden urgente aparece justo cuando todos están ocupados.
- **Mensaje final:** comparación con el reparto de GoodRoute con las mismas órdenes.

### 3. Carrera de Ruta (idea del equipo)
- **Frase:** "Visita a todos los clientes antes que GoodRoute."
- **Mecánica:** se elige el orden de visitas y los dos autos corren en paralelo.
- **Decisión real:** el orden de visitas, considerando solo la distancia.
- **Puntaje:** quién llega primero y cuánto más larga fue tu ruta.
- **"¡Uh, casi!":** los dos autos llegan con décimas de diferencia.
- **Mensaje final:** "Tu ruta fue 18% más larga."

### 4. Imprevisto
- **Frase:** "Se cortó una calle y entró una urgencia: reacomoda la ruta."
- **Mecánica:** el técnico ya va en ruta. Aparece una obra o una orden urgente y hay que tocar dónde insertarla.
- **Decisión real:** reprogramar en el día.
- **Puntaje:** clientes que siguen llegando a tiempo.
- **"¡Uh, casi!":** un imprevisto detrás de otro.
- **Mensaje final:** GoodRoute recalcula en segundos.

### 5. Laberinto de Obras (idea del amigo)
- **Frase:** "Lleva la camioneta al cliente esquivando las obras."
- **Mecánica:** una pelotita o camioneta recorre un laberinto generado al azar, con un tiempo límite.
- **Decisión real:** casi ninguna. Es un problema de navegación, no de planificación.
- **Puntaje:** tiempo de llegada.
- **"¡Uh, casi!":** quedar en un callejón sin salida.
- **Mensaje final:** débil; el optimizador no resuelve laberintos.

### 6. Jornada Llena
- **Frase:** "¿Cuántas órdenes alcanzas a meter en la jornada?"
- **Mecánica:** el jugador elige qué órdenes acepta. Una barra de 8:00 a 19:00 se va llenando con el viaje y el servicio.
- **Decisión real:** la capacidad de la jornada y qué órdenes quedan pendientes.
- **Puntaje:** órdenes que caben.
- **"¡Uh, casi!":** la última orden queda a 5 minutos de las 19:00.
- **Mensaje final:** GoodRoute metió 2 órdenes más en el mismo día.

---

## Paso 2: Evaluación

| Idea | Relación con el producto | Intuitivo | Divertido de mirar | Competitivo | Factible en 1 día | Total |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| 1. Jornada Perfecta | 5 | 4 | 5 | 5 | 4 | **23** |
| 2. Despacho en Vivo | 5 | 3 | 4 | 4 | 2 | 18 |
| 3. Carrera de Ruta | 4 | 5 | 4 | 4 | 5 | 22 |
| 4. Imprevisto | 4 | 3 | 4 | 3 | 3 | 17 |
| 5. Laberinto de Obras | 1 | 5 | 4 | 4 | 4 | 18 |
| 6. Jornada Llena | 4 | 3 | 2 | 3 | 4 | 16 |

**Ganadora: Jornada Perfecta, con la comparación final de la Carrera de Ruta.**
- La Carrera solo mide distancia. Jornada Perfecta agrega lo que de verdad hace difícil planificar: horas acordadas, tolerancias, tiempo de servicio y fin de jornada. Eso es lo que diferencia a GoodRoute de "el camino más corto".
- El reloj corriendo genera la tensión que se ve desde atrás.
- Como hay clientes sin hora, no basta con ordenar por hora: hay que acomodarlos entre los que sí tienen hora.
- Se construye con la misma base técnica que un mapa de grilla, y el óptimo se calcula exacto por fuerza bruta (6 clientes son 720 órdenes).

---

## Paso 3: Diseño de la idea elegida

### Flujo de pantallas
1. **Inicio:**
   - El nombre del juego.
   - La frase "Arma el día de tu técnico: llega a la hora a cada cliente."
   - Tres líneas de cómo se juega y el botón **Jugar**.
   - Los mejores puntajes del stand.
2. **Partida (3 días):**
   - El mapa con la base, los clientes con su etiqueta de hora y las calles cortadas.
   - El HUD muestra el día, el reloj y el conteo de clientes a tiempo y atrasados.
   - El reloj parte en 8:00 y avanza recién con el primer toque. Mirar el mapa antes es gratis, como planificar la noche anterior.
3. **Resultado de cada día:**
   - Aparece la ruta de GoodRoute bajo la tuya, con su orden en números naranjos.
   - Una tarjeta compara clientes a tiempo, kilómetros y hora de término.
4. **Final:** el puntaje total, una frase según el desempeño, el nombre para el ranking, el ranking y el cierre con el mensaje del producto.

### Reglas del día, iguales a las del producto
- **Jornada:** de 8:00 a 19:00. Si un servicio terminaría después de las 19:00, ese cliente queda *pendiente* y el técnico no va.
- **Viaje y servicio:** cada cuadra son 5 min de viaje y 0,4 km. Cada visita toma 60 min de servicio.
- **Ventana:** el cliente con hora acordada `H` se puede atender entre `H − 30` y `H + 15`.
  - Si el técnico llega antes de que abra la ventana, espera.
  - Si llega después, atiende igual, pero queda *atrasado*.
- **Clientes sin hora:** son a tiempo siempre que se atiendan dentro de la jornada.
- **Ruta abierta:** el día termina en el último cliente.
- **Tiempo de decisión:** si dejas al técnico sin próximo cliente, se queda parado y el reloj sigue corriendo.

### Curva de dificultad

| Día | Clientes | Con hora | Calles cortadas |
|---|:-:|:-:|:-:|
| 1 | 4 | 2 | 3 |
| 2 | 5 | 3 | 8 |
| 3 | 6 | 3 | 14 |

Las horas se generan a partir de un recorrido al azar que se puede cumplir completo. Así siempre existe una solución con todos a tiempo, y el primer día es fácil de ganar.

### Puntaje por día
- **100** por cada cliente atendido a tiempo y **30** por cada atendido atrasado.
- **Hasta 300** por kilómetros: `300 × (km de GoodRoute ÷ tus km) × (atendidos ÷ total)`.
- **+200** si igualas a GoodRoute: los mismos clientes a tiempo y no más kilómetros.

### Comparación final contra el optimizador
La tarjeta tiene 3 filas, Tú contra GoodRoute: **A tiempo** (por ejemplo, 4/5 contra 5/5), **Kilómetros** y **Termina a las**.

Debajo va una frase concreta:
- "GoodRoute atendió 1 cliente más a tiempo con 2,4 km menos."
- O, si lo igualaste: "Igualaste a GoodRoute. Él lo calculó en 3 ms."

El tiempo de cálculo que se muestra es el real, medido en el navegador.
