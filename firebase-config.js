/* firebase-config.js — conexión para jugar con celulares (QR) en los juegos táctiles.
 *
 * Proyecto: minijuegos-goodroute (Realtime Database en us-central1).
 * Si esto queda en null, el botón "Jugar con celulares" aparece desactivado
 * y los juegos se siguen jugando en la pantalla táctil.
 *
 * Para activarlo, pega aquí la configuración de tu proyecto de Firebase
 * (Consola de Firebase → Configuración del proyecto → Tus apps → Web).
 * Debe incluir databaseURL (Realtime Database). Ejemplo:
 *
 * window.FIREBASE_CONFIG = {
 *   apiKey: "AIza...",
 *   authDomain: "mi-proyecto.firebaseapp.com",
 *   databaseURL: "https://mi-proyecto-default-rtdb.firebaseio.com",
 *   projectId: "mi-proyecto",
 *   appId: "1:123:web:abc",
 * };
 *
 * Estos datos no son secretos (identifican el proyecto); lo que protege la base
 * son sus reglas. Las reglas recomendadas están en README.md.
 */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDGiNCT7EqU3pp5hxYMOruF3Ns11_ZZREw",
  authDomain: "minijuegos-goodroute.firebaseapp.com",
  databaseURL: "https://minijuegos-goodroute-default-rtdb.firebaseio.com",
  projectId: "minijuegos-goodroute",
  storageBucket: "minijuegos-goodroute.firebasestorage.app",
  messagingSenderId: "982116281983",
  appId: "1:982116281983:web:d9f7d29cbe426598cc194a",
};
