/* juegos.js — catálogo de la biblioteca de minijuegos de GoodRoute.
 *
 * Para agregar un juego: copia su carpeta junto a las demás, agrega una
 * entrada aquí (tipo "individual" o "grupal"; control "mouse" o "tactil";
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
  // Cómo se juega: "mouse" (sirve con un solo mouse) o "tactil" (necesita pantalla multitáctil).
  controles: {
    mouse: { nombre: "Mouse", detalle: "Se juegan por turnos: el mouse pasa de mano en mano." },
    tactil: { nombre: "Táctil", detalle: "Juegan todos a la vez: necesitan una pantalla multitáctil." },
  },
  juegos: [
    {
      carpeta: "ruta-en-relevo", nombre: "Ruta en Relevo", tipo: "grupal", control: "mouse", jugadores: "2 a 4",
      frase: "Entre todos arman una sola ruta: por turnos, cada uno toma el mouse y elige el próximo cliente.",
      muestra: "Ruta óptima, jugada a jugada", rondas: "3 turnos c/u", duracion: "1,5 min",
    },
    {
      carpeta: "turno-de-crisis", nombre: "Turno de Crisis", tipo: "grupal", control: "mouse", jugadores: "2 a 4",
      frase: "Son la central de despacho: cada imprevisto del día le toca a una persona distinta.",
      muestra: "Reprogramación en equipo", rondas: "2 imprevistos c/u", duracion: "1,5 min",
    },
    {
      carpeta: "flota-en-vivo", nombre: "Flota en Vivo", tipo: "grupal", control: "tactil", jugadores: "2 a 4",
      frase: "Las órdenes llegan durante el día. Cada uno maneja una camioneta y entre todos las atienden a tiempo.",
      muestra: "Despacho en tiempo real", rondas: "1 día", duracion: "1,5 min",
    },
    {
      carpeta: "duelo-de-rutas", nombre: "Duelo de Rutas", tipo: "grupal", control: "tactil", jugadores: "2 a 4",
      frase: "La misma ciudad para todos, un tablero para cada uno. ¿Quién arma la ruta más corta?",
      muestra: "Ruta óptima vs. ruta a ojo", rondas: "3 rondas", duracion: "1,5 min",
    },
    {
      carpeta: "ganale-al-chip-pulso", nombre: "Gánale al Chip · A pulso", tipo: "individual", control: "mouse",
      frase: "Lleva tú la camioneta por las calles hasta todos los clientes, antes que el chip y sin tocar los bordes.",
      muestra: "Ruta óptima vs. ruta a mano", rondas: "3 niveles", duracion: "1 min",
    },
    {
      carpeta: "ganale-al-chip", nombre: "Gánale al Chip", tipo: "individual", control: "mouse",
      frase: "El chip es nuestro optimizador de rutas. ¿Puedes armar una ruta mejor y llegar antes que él?",
      muestra: "Orden de visitas", rondas: "3 niveles", duracion: "1 min",
    },
    {
      carpeta: "jornada-perfecta", nombre: "Jornada Perfecta", tipo: "individual", control: "mouse",
      frase: "Arma el día de tu técnico: llega a la hora a cada cliente.",
      muestra: "Ventanas horarias", rondas: "3 días", duracion: "1 min",
    },
    {
      carpeta: "reparto", nombre: "Reparto", tipo: "individual", control: "mouse",
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
