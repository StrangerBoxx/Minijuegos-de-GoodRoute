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
    // Minijuegos de ruta: los 5 viven en minijuegos-de-ruta/index.html (un solo archivo);
    // la biblioteca abre cada uno directo con ?juego=<id>.
    {
      carpeta: "ruta-corta", url: "minijuegos-de-ruta/index.html?juego=corta", nombre: "¿Cuál es más corta?", tipo: "individual", control: "mouse",
      frase: "Dos rutas, los mismos clientes. Toca la más corta antes de que se acabe el tiempo.",
      muestra: "Ojo de optimizador", rondas: "contrarreloj", duracion: "40 s",
    },
    {
      carpeta: "ruta-memoria", url: "minijuegos-de-ruta/index.html?juego=memoria", nombre: "Memoriza la ruta", tipo: "individual", control: "mouse",
      frase: "Mira cómo la camioneta recorre la ruta óptima y repite el orden de visitas.",
      muestra: "Orden de visitas", rondas: "niveles", duracion: "3 vidas",
    },
    {
      carpeta: "ruta-despacho", url: "minijuegos-de-ruta/index.html?juego=despacho", nombre: "Despacho relámpago", tipo: "individual", control: "mouse",
      frase: "Llega un pedido: toca al técnico más cercano antes de que el cliente se canse de esperar.",
      muestra: "Asignación", rondas: "contrarreloj", duracion: "45 s",
    },
    {
      carpeta: "ruta-desvio", url: "minijuegos-de-ruta/index.html?juego=desvio", nombre: "Desvío", tipo: "individual", control: "mouse",
      frase: "Hay calles cortadas. Traza el camino más corto desde la camioneta hasta el cliente.",
      muestra: "Calles cortadas", rondas: "contrarreloj", duracion: "60 s",
    },
    {
      carpeta: "ruta-carril", url: "minijuegos-de-ruta/index.html?juego=carril", nombre: "Carril libre", tipo: "individual", control: "mouse",
      frase: "Esquiva los tacos cambiando de carril y recoge clientes en el camino.",
      muestra: "Tráfico", rondas: "sin fin", duracion: "3 vidas",
    },
    {
      oculto: true, carpeta: "ruta-en-relevo", nombre: "Ruta en Relevo", tipo: "grupal", control: "mouse", jugadores: "2 a 4",
      frase: "Entre todos arman una sola ruta: por turnos, cada uno toma el mouse y elige el próximo cliente.",
      muestra: "Ruta óptima, jugada a jugada", rondas: "3 turnos c/u", duracion: "1,5 min",
    },
    {
      oculto: true, carpeta: "turno-de-crisis", nombre: "Turno de Crisis", tipo: "grupal", control: "mouse", jugadores: "2 a 4",
      frase: "Son la central de despacho: cada imprevisto del día le toca a una persona distinta.",
      muestra: "Reprogramación en equipo", rondas: "2 imprevistos c/u", duracion: "1,5 min",
    },
    {
      oculto: true, carpeta: "flota-en-vivo", nombre: "Flota en Vivo", tipo: "grupal", control: "tactil", jugadores: "2 a 4",
      frase: "Las órdenes llegan durante el día. Cada uno maneja una camioneta y entre todos las atienden a tiempo.",
      muestra: "Despacho en tiempo real", rondas: "1 día", duracion: "1,5 min",
    },
    {
      oculto: true, carpeta: "duelo-de-rutas", nombre: "Duelo de Rutas", tipo: "grupal", control: "tactil", jugadores: "2 a 4",
      frase: "La misma ciudad para todos, un tablero para cada uno. ¿Quién arma la ruta más corta?",
      muestra: "Ruta óptima vs. ruta a ojo", rondas: "3 rondas", duracion: "1,5 min",
    },
    {
      carpeta: "ganale-al-chip-pulso", nombre: "Gánale al Chip · A pulso", tipo: "individual", control: "mouse",
      frase: "Lleva tú la camioneta por las calles hasta todos los clientes, antes que el chip y sin tocar los bordes.",
      muestra: "Ruta óptima vs. ruta a mano", rondas: "3 niveles", duracion: "1 min",
    },
    {
      oculto: true, carpeta: "ganale-al-chip", nombre: "Gánale al Chip", tipo: "individual", control: "mouse",
      frase: "El chip es nuestro optimizador de rutas. ¿Puedes armar una ruta mejor y llegar antes que él?",
      muestra: "Orden de visitas", rondas: "3 niveles", duracion: "1 min",
    },
    {
      carpeta: "jornada-perfecta", nombre: "Jornada Perfecta", tipo: "individual", control: "mouse",
      frase: "Arma el día de tu técnico: llega a la hora a cada cliente.",
      muestra: "Ventanas horarias", rondas: "3 días", duracion: "1 min",
    },
    {
      oculto: true, carpeta: "reparto", nombre: "Reparto", tipo: "individual", control: "mouse",
      frase: "Reparte las órdenes del día entre tus técnicos para que nadie termine tarde.",
      muestra: "Asignación y equilibrio de carga", rondas: "2 rondas", duracion: "1,5 min",
    },
    {
      carpeta: "dia-imprevisto", nombre: "Día Imprevisto", tipo: "individual", control: "mouse",
      frase: "El día ya está planificado. Cuando algo salga mal, decide rápido.",
      muestra: "Reprogramación durante el día", rondas: "4 imprevistos", duracion: "1 min",
    },
  ],
};
