(() => {
  "use strict";

  const AJUSTES = {
    puestos: 5,
    nuevoMs: 15 * 60 * 1000,
    revisarMs: 3000,
  };

  const juegos = window.CATALOGO.juegos.filter((j) => !j.oculto);
  const $ = (id) => document.getElementById(id);
  const ui = { marcador: $("marcador"), tablas: $("tablas") };
  const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const formato = (n) => Math.round(n).toLocaleString("es-CL");

  function leer(carpeta) {
    try { return (JSON.parse(localStorage.getItem(carpeta + ".ranking")) || []).slice(0, AJUSTES.puestos); }
    catch { return []; }
  }

  function fila(r, i, ahora) {
    if (!r) {
      const texto = i === 0 ? "¡Sé el primero!" : "—";
      return `<li class="fila vacia${i === 0 ? " primera" : ""}"><span class="pos">${i + 1}</span><span class="nombre">${texto}</span><span class="pts"></span></li>`;
    }
    const nuevo = ahora - r.t < AJUSTES.nuevoMs;
    return `<li class="fila${i === 0 ? " primera" : ""}${nuevo ? " nueva" : ""}">` +
      `<span class="pos">${i + 1}</span>` +
      `<span class="nombre">${escapar(r.nombre || "Anónimo")}</span>` +
      `<span class="pts">${formato(r.puntos)}</span>${nuevo ? '<b class="chip">Nuevo</b>' : ""}</li>`;
  }

  function tabla(j, lista, ahora) {
    const filas = Array.from({ length: AJUSTES.puestos }, (_, i) => fila(lista[i], i, ahora)).join("");
    return `<article class="tarjeta">
      <div class="tarjeta-portada"><img src="biblioteca/miniaturas/${encodeURIComponent(j.carpeta)}.jpg" alt="" onerror="this.remove()" /></div>
      <div class="tarjeta-cuerpo">
        <h2>${escapar(j.nombre)}</h2>
        <p class="muestra">${escapar(j.muestra)}</p>
        <ol class="filas">${filas}</ol>
      </div>
    </article>`;
  }

  let firma = "";
  function pintar(forzar) {
    if (ui.marcador.hidden && !forzar) return;
    const ahora = Date.now();
    const datos = juegos.map((j) => leer(j.carpeta));
    const nueva = JSON.stringify(datos) + Math.floor(ahora / 60000);
    if (!forzar && nueva === firma) return;
    firma = nueva;
    ui.tablas.style.setProperty("--columnas", juegos.length);
    ui.tablas.innerHTML = juegos.map((j, i) => tabla(j, datos[i], ahora)).join("");
  }

  addEventListener("storage", (e) => { if (!e.key || e.key.endsWith(".ranking")) pintar(); });
  setInterval(() => pintar(), AJUSTES.revisarMs);

  window.Marcador = {
    mostrar() {
      ui.marcador.hidden = false;
      pintar(true);
    },
    ocultar() {
      ui.marcador.hidden = true;
    },
    pintar,
  };
})();
