import QRCode from "https://esm.sh/qrcode@1.5.4?bundle";

const select = document.querySelector("#matriculaSelect");
const pass = document.querySelector(".digital-pass");
const qrCanvas = document.querySelector("#qrCanvas");
const qrPlaceholder = document.querySelector("#qrPlaceholder");
const countdownNode = document.querySelector("#qrCountdown");
const refreshButton = document.querySelector("#refreshButton");
const toastRegion = document.querySelector("#toastRegion");

let alumnos = [];
let alumnoActual = null;
let segundosRestantes = 30;

function iniciales(nombre) {
  return nombre.split(/\s+/).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase();
}

function fechaHora(iso) {
  if (!iso) return "Sin entrada activa";
  return `Entrada: ${new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso))}`;
}

function toast(message, type = "info") {
  const node = document.createElement("div");
  node.className = `toast toast-${type}`;
  node.textContent = message;
  toastRegion.append(node);
  setTimeout(() => node.remove(), 3500);
}

async function api(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No fue posible consultar el sistema.");
  return data;
}

function crearPayloadQR() {
  return JSON.stringify({
    tipo: "gimnasio-qr",
    matricula: alumnoActual.matricula,
    emitido: new Date().toISOString(),
    nonce: crypto.randomUUID()
  });
}

async function generarQR() {
  if (!alumnoActual) return;
  qrPlaceholder.hidden = true;
  await QRCode.toCanvas(qrCanvas, crearPayloadQR(), {
    width: 220,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#09232d", light: "#ffffff" }
  });
  segundosRestantes = 30;
}

function renderAlumno(alumno) {
  alumnoActual = alumno;
  document.querySelector("#nombreAlumno").textContent = alumno.nombre;
  document.querySelector("#carreraAlumno").textContent = alumno.carrera;
  document.querySelector("#matriculaAlumno").textContent = `Matricula ${alumno.matricula}`;
  document.querySelector("#avatar").textContent = iniciales(alumno.nombre);
  document.querySelector("#creditosActuales").textContent = alumno.creditos;
  document.querySelector("#creditosMeta").textContent = alumno.metaCreditos;
  document.querySelector("#estadoTexto").textContent = alumno.dentro ? "Dentro del gimnasio" : "Fuera del gimnasio";
  document.querySelector("#horaEntrada").textContent = fechaHora(alumno.entradaAt);

  const porcentaje = Math.min(100, Math.round((alumno.creditos / alumno.metaCreditos) * 100));
  const progress = document.querySelector(".progress-track");
  document.querySelector("#progressFill").style.width = `${porcentaje}%`;
  progress.setAttribute("aria-valuemax", alumno.metaCreditos);
  progress.setAttribute("aria-valuenow", alumno.creditos);
  document.querySelector("#mensajeProgreso").textContent = alumno.creditos >= alumno.metaCreditos
    ? "Meta del periodo completada."
    : `Te faltan ${alumno.metaCreditos - alumno.creditos} creditos para completar tu meta.`;

  const badge = document.querySelector("#estadoBadge");
  badge.className = `status-pill ${alumno.dentro ? "status-success" : "status-neutral"}`;
  badge.innerHTML = `<span></span> ${alumno.dentro ? "En gimnasio" : "Disponible"}`;
  pass.setAttribute("aria-busy", "false");
  generarQR().catch(() => toast("No se pudo generar el codigo QR.", "error"));
}

async function cargarAlumnos(mantenerSeleccion = true) {
  const previa = mantenerSeleccion ? select.value || localStorage.getItem("matriculaSeleccionada") : "";
  const data = await api("/api/alumnos");
  alumnos = data.alumnos;
  select.replaceChildren(new Option("Selecciona tu matricula", ""));
  alumnos.forEach((alumno) => select.add(new Option(`${alumno.matricula} · ${alumno.nombre}`, alumno.matricula)));

  const seleccion = alumnos.some((item) => item.matricula === previa) ? previa : alumnos[0]?.matricula;
  if (seleccion) {
    select.value = seleccion;
    renderAlumno(alumnos.find((item) => item.matricula === seleccion));
  }
}

select.addEventListener("change", () => {
  const alumno = alumnos.find((item) => item.matricula === select.value);
  if (!alumno) return;
  localStorage.setItem("matriculaSeleccionada", alumno.matricula);
  renderAlumno(alumno);
});

refreshButton.addEventListener("click", async () => {
  refreshButton.classList.add("spinning");
  try {
    await cargarAlumnos();
    toast("Informacion actualizada.", "success");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    refreshButton.classList.remove("spinning");
  }
});

setInterval(() => {
  if (!alumnoActual) return;
  segundosRestantes -= 1;
  countdownNode.textContent = `${segundosRestantes} s`;
  if (segundosRestantes <= 0) generarQR();
}, 1000);

cargarAlumnos().catch((error) => {
  select.replaceChildren(new Option("Servicio no disponible", ""));
  pass.setAttribute("aria-busy", "false");
  toast(error.message, "error");
});

