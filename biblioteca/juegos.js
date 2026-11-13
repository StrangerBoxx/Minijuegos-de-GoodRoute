/* juegos.js — catálogo de la biblioteca de minijuegos de GoodRoute.
 *
 * Para agregar un juego: copia su carpeta junto a las demás, agrega una
 * entrada aquí (tipo "individual" o "grupal"; control "mouse" o "tactil";
 * "oculto: true" lo saca de la biblioteca sin borrarlo; "url" si no está en <carpeta>/index.html;
 * los grupales llevan "jugadores") y pon una captura de 640×400 en biblioteca/miniaturas/<carpeta>.jpg.
 * El orden de esta lista es el orden en que aparecen en la biblioteca.
 */
window.CATALOGO = {
  // Modo de juego: se usan como filtros.
  //   individual: una persona juega y compite por el récord.
  //   grupal: cada participación suma a un resultado común del grupo.
  tipos: {
    individual: "Individuales",
    grupal: "Grupales",
  },
  // Cómo se juega: "mouse" (sirve con un solo mouse) o "tactil" (cada uno con su celular vía QR,
  // o todos en una pantalla multitáctil).
  controles: {
    mouse: { nombre: "Mouse", detalle: "Se juegan por turnos: el mouse pasa de mano en mano." },
    tactil: { nombre: "Celulares", detalle: "Juegan todos a la vez: cada uno escanea un QR y juega en su celular (o en una pantalla táctil)." },
  },
  juegos: [
    // Visibles, en orden alfabético. Cada descripción es una frase breve que parte con lo que haces.
    // Los 5 minijuegos de ruta viven en minijuegos-de-ruta/index.html (un solo archivo);
    // la biblioteca abre cada uno directo con ?juego=<id>.
    {
      oculto: true, carpeta: "ruta-carril", url: "minijuegos-de-ruta/index.html?juego=carril", nombre: "Carril libre", tipo: "individual", control: "mouse",
      frase: "Cambia de carril para esquivar los tacos y recoge clientes en el camino.",
      muestra: "Tráfico", duracion: "3 vidas", rondas: "sin fin",
    },
    {
      carpeta: "ruta-corta", url: "minijuegos-de-ruta/index.html?juego=corta", nombre: "¿Cuál es más corta?", tipo: "individual", control: "mouse",
      frase: "Compara dos rutas con los mismos clientes y elige la más corta.",
      muestra: "Ojo de optimizador", duracion: "40 s", rondas: "contrarreloj",
    },
    {
      oculto: true, carpeta: "ruta-despacho", url: "minijuegos-de-ruta/index.html?juego=despacho", nombre: "Despacho relámpago", tipo: "individual", control: "mouse",
      frase: "Asigna cada pedido al técnico más cercano antes de que expire.",
      muestra: "Asignación", duracion: "45 s", rondas: "contrarreloj",
    },
    {
      oculto: true, carpeta: "ruta-desvio", url: "minijuegos-de-ruta/index.html?juego=desvio", nombre: "Desvío", tipo: "individual", control: "mouse",
      frase: "Esquiva las calles cortadas y traza el camino más corto hasta el cliente.",
      muestra: "Calles cortadas", duracion: "60 s", rondas: "contrarreloj",
    },
    {
      carpeta: "jornada-perfecta", nombre: "Jornada Perfecta", tipo: "individual", control: "mouse",
      frase: "Ordena las visitas del día para llegar a la hora a cada cliente.",
      muestra: "Ventanas horarias", duracion: "1,5 min", rondas: "4 días",
    },
    {
      carpeta: "ganale-al-chip-pulso", nombre: "Ruta a Mano", tipo: "individual", control: "mouse",
      frase: "Maneja la camioneta por las calles y visita a todos antes que el optimizador.",
      muestra: "Ruta óptima", duracion: "1,5 min", rondas: "4 niveles",
    },
    {
      oculto: true, carpeta: "ruta-memoria", url: "minijuegos-de-ruta/index.html?juego=memoria", nombre: "Memoriza la ruta", tipo: "individual", control: "mouse",
      frase: "Mira el recorrido óptimo y repite el orden de visitas.",
      muestra: "Orden de visitas", duracion: "3 vidas", rondas: "niveles",
    },
    // Ocultos (no aparecen en la biblioteca): minijuegos de ruta que siguen en minijuegos-de-ruta/index.html.
  ],
};
