const state = {
  scanner: null,
  scannerActivo: false,
  procesando: false,
  datos: null,
  matriculaSimulacion: null,
  ultimoCodigo: "",
  ultimoEscaneoAt: 0
};

const $ = (selector) => document.querySelector(selector);
const toastRegion = $("#toastRegion");
const modal = $("#confirmDialog");

function toast(message, type = "info") {
  const node = document.createElement("div");
  node.className = `toast toast-${type}`;
  node.innerHTML = `<span>${type === "success" ? "✓" : type === "error" ? "!" : "i"}</span><p>${escapeHtml(message)}</p>`;
  toastRegion.append(node);
  setTimeout(() => node.remove(), 4200);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function formatoFecha(iso, incluirFecha = true) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    ...(incluirFecha ? { day: "2-digit", month: "short" } : {}),
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function minutosTranscurridos(iso) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { accept: "application/json", ...(options.body ? { "content-type": "application/json" } : {}), ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No fue posible completar la operacion.");
  return data;
}

function renderMetricas(metricas) {
  $("#metricDentro").textContent = metricas.dentroAhora;
  $("#metricCreditos").textContent = metricas.creditosOtorgados;
  $("#metricVisitas").textContent = metricas.visitasHoy;
  $("#metricAlumnos").textContent = metricas.totalAlumnos;
}

function renderDentro(alumnos) {
  const tbody = $("#insideTableBody");
  tbody.replaceChildren();
  $("#occupancyCount").textContent = alumnos.length;
  $("#insideEmpty").hidden = alumnos.length > 0;

  alumnos.forEach((alumno) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><div class="table-person"><span>${escapeHtml(alumno.nombre.split(/\s+/).map((p) => p[0]).slice(0, 2).join(""))}</span><div><strong>${escapeHtml(alumno.nombre)}</strong><small>${escapeHtml(alumno.matricula)}</small></div></div></td>
      <td>${formatoFecha(alumno.entradaAt, false)}</td>
      <td><strong class="elapsed" data-entry="${escapeHtml(alumno.entradaAt)}">${minutosTranscurridos(alumno.entradaAt)} min</strong></td>
      <td><div class="row-actions"><button class="mini-button checkout-button" data-matricula="${escapeHtml(alumno.matricula)}" type="button">Registrar salida</button><button class="mini-button simulate-button" data-matricula="${escapeHtml(alumno.matricula)}" type="button">Simular +65 min</button></div></td>`;
    tbody.append(row);
  });
}

function renderHistorial(historial) {
  const tbody = $("#historyTableBody");
  tbody.replaceChildren();
  $("#historyEmpty").hidden = historial.length > 0;

  historial.forEach((evento) => {
    const row = document.createElement("tr");
    const resultado = evento.tipo === "entrada"
      ? '<span class="result-badge result-info">Acceso activo</span>'
      : evento.creditoOtorgado
        ? '<span class="result-badge result-success">Credito otorgado</span>'
        : '<span class="result-badge result-warning">Sin credito</span>';
    row.innerHTML = `
      <td>${formatoFecha(evento.timestamp)}</td>
      <td><strong>${escapeHtml(evento.nombre)}</strong><small class="cell-subtitle">${escapeHtml(evento.matricula)}</small></td>
      <td><span class="movement movement-${evento.tipo}">${evento.tipo === "entrada" ? "Entrada" : "Salida"}</span></td>
      <td>${evento.minutos === null ? "—" : `${evento.minutos} min${evento.simulado ? " · sim." : ""}`}</td>
      <td>${resultado}</td>`;
    tbody.append(row);
  });
}

async function cargarDatos(silencioso = false) {
  try {
    const datos = await api("/api/alumnos");
    state.datos = datos;
    renderMetricas(datos.metricas);
    renderDentro(datos.dentro);
    renderHistorial(datos.historial);
    $("#storageMode").textContent = datos.almacenamiento === "redis" ? "Persistencia Redis activa" : "Modo demostracion local";
  } catch (error) {
    if (!silencioso) toast(error.message, "error");
    throw error;
  }
}

function extraerMatricula(codigo) {
  const limpio = String(codigo || "").trim();
  try {
    const payload = JSON.parse(limpio);
    if (payload.tipo !== "gimnasio-qr" || !payload.matricula) throw new Error();
    return String(payload.matricula).trim().toUpperCase();
  } catch {
    if (/^[A-Z0-9-]{4,20}$/i.test(limpio)) return limpio.toUpperCase();
    throw new Error("El codigo QR no corresponde a un pase UniSport valido.");
  }
}

async function procesarAcceso(codigo) {
  if (state.procesando) return;
  state.procesando = true;
  try {
    const matricula = extraerMatricula(codigo);
    await cargarDatos(true);
    const alumno = state.datos.alumnos.find((item) => item.matricula === matricula);
    if (!alumno) throw new Error("La matricula no esta registrada.");
    const endpoint = alumno.dentro ? "/api/checkout" : "/api/checkin";
    const resultado = await api(endpoint, { method: "POST", body: JSON.stringify({ matricula }) });
    toast(resultado.mensaje, resultado.evento && !resultado.evento.creditoOtorgado ? "info" : "success");
    await cargarDatos(true);
  } catch (error) {
    toast(error.message, "error");
  } finally {
    state.procesando = false;
  }
}

async function alternarScanner() {
  if (state.scannerActivo) {
    await state.scanner.stop();
    state.scanner.clear();
    state.scannerActivo = false;
    state.scanner = null;
    $("#scannerEmpty").hidden = false;
    $("#toggleScanner").textContent = "Activar camara";
    $("#cameraStatus").className = "status-pill status-neutral";
    $("#cameraStatus").innerHTML = "<span></span> Inactivo";
    return;
  }

  if (!window.Html5Qrcode) {
    toast("No se cargo la libreria del lector QR. Revisa tu conexion.", "error");
    return;
  }

  try {
    $("#scannerEmpty").hidden = true;
    state.scanner = new window.Html5Qrcode("reader");
    await state.scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.333 },
      (decodedText) => {
        const ahora = Date.now();
        if (decodedText === state.ultimoCodigo && ahora - state.ultimoEscaneoAt < 4000) return;
        state.ultimoCodigo = decodedText;
        state.ultimoEscaneoAt = ahora;
        procesarAcceso(decodedText);
      },
      () => undefined
    );
    state.scannerActivo = true;
    $("#toggleScanner").textContent = "Detener camara";
    $("#cameraStatus").className = "status-pill status-success";
    $("#cameraStatus").innerHTML = "<span></span> Leyendo";
  } catch {
    state.scanner = null;
    $("#scannerEmpty").hidden = false;
    toast("No se pudo acceder a la camara. Usa HTTPS y concede el permiso, o captura la matricula manualmente.", "error");
  }
}

async function registrarSalida(matricula, minutosSimulados) {
  try {
    const resultado = await api("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ matricula, ...(minutosSimulados !== undefined ? { minutosSimulados } : {}) })
    });
    toast(resultado.mensaje, resultado.evento.creditoOtorgado ? "success" : "info");
    await cargarDatos(true);
  } catch (error) {
    toast(error.message, "error");
  }
}

$("#manualForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("#manualMatricula");
  procesarAcceso(input.value);
  input.value = "";
});

$("#toggleScanner").addEventListener("click", alternarScanner);
$("#refreshDashboard").addEventListener("click", () => cargarDatos().then(() => toast("Panel actualizado.", "success")));

$("#insideTableBody").addEventListener("click", (event) => {
  const checkoutButton = event.target.closest(".checkout-button");
  const simulateButton = event.target.closest(".simulate-button");
  if (checkoutButton) registrarSalida(checkoutButton.dataset.matricula);
  if (simulateButton) {
    state.matriculaSimulacion = simulateButton.dataset.matricula;
    modal.hidden = false;
    $("#cancelSimulation").focus();
  }
});

$("#cancelSimulation").addEventListener("click", () => {
  modal.hidden = true;
  state.matriculaSimulacion = null;
});

$("#confirmSimulation").addEventListener("click", async () => {
  const matricula = state.matriculaSimulacion;
  modal.hidden = true;
  state.matriculaSimulacion = null;
  if (matricula) await registrarSalida(matricula, 65);
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) $("#cancelSimulation").click();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) $("#cancelSimulation").click();
});

setInterval(() => {
  document.querySelectorAll(".elapsed").forEach((node) => {
    node.textContent = `${minutosTranscurridos(node.dataset.entry)} min`;
  });
}, 30000);

$("#currentDate").textContent = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
cargarDatos().catch(() => undefined);

