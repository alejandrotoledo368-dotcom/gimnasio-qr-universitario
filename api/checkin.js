import { randomUUID } from "node:crypto";
import {
  handleError,
  HttpError,
  json,
  matriculaValida,
  methodNotAllowed,
  normalizarMatricula,
  readJson
} from "../lib/http.js";
import { actualizarEstado } from "../lib/store.js";

export async function POST(request) {
  try {
    const body = await readJson(request);
    const matricula = normalizarMatricula(body.matricula);
    if (!matriculaValida(matricula)) throw new HttpError(400, "Matricula invalida.");

    const resultado = await actualizarEstado((estado) => {
      const alumno = estado.alumnos.find((item) => item.matricula === matricula);
      if (!alumno) throw new HttpError(404, "Alumno no encontrado.");
      if (alumno.dentro) throw new HttpError(409, "El alumno ya tiene una entrada activa.");

      const timestamp = new Date().toISOString();
      alumno.dentro = true;
      alumno.entradaAt = timestamp;
      alumno.ultimoMovimiento = timestamp;
      estado.historial.unshift({
        id: randomUUID(),
        tipo: "entrada",
        matricula,
        nombre: alumno.nombre,
        timestamp,
        minutos: null,
        creditoOtorgado: false,
        simulado: false
      });

      return { alumno: structuredClone(alumno), timestamp };
    });

    return json({
      mensaje: "Entrada registrada correctamente.",
      ...resultado
    });
  } catch (error) {
    return handleError(error);
  }
}

export default {
  fetch(request) {
    return request.method === "POST" ? POST(request) : methodNotAllowed(["POST"]);
  }
};

