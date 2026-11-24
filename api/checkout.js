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

const MINUTOS_PARA_CREDITO = 60;

function obtenerMinutosSimulados(value) {
  if (value === undefined || value === null || value === "") return null;
  const numero = Number(value);
  if (!Number.isFinite(numero) || numero < 0 || numero > 720) {
    throw new HttpError(400, "Los minutos simulados deben estar entre 0 y 720.");
  }
  return Math.floor(numero);
}

export async function POST(request) {
  try {
    const body = await readJson(request);
    const matricula = normalizarMatricula(body.matricula);
    if (!matriculaValida(matricula)) throw new HttpError(400, "Matricula invalida.");
    const simulados = obtenerMinutosSimulados(body.minutosSimulados);

    const resultado = await actualizarEstado((estado) => {
      const alumno = estado.alumnos.find((item) => item.matricula === matricula);
      if (!alumno) throw new HttpError(404, "Alumno no encontrado.");
      if (!alumno.dentro || !alumno.entradaAt) {
        throw new HttpError(409, "El alumno no tiene una entrada activa.");
      }

      const salida = new Date();
      const minutosReales = Math.max(0, Math.floor((salida.getTime() - new Date(alumno.entradaAt).getTime()) / 60000));
      const minutos = simulados ?? minutosReales;
      const creditoOtorgado = minutos >= MINUTOS_PARA_CREDITO;
      if (creditoOtorgado) alumno.creditos += 1;

      const entradaAt = alumno.entradaAt;
      alumno.dentro = false;
      alumno.entradaAt = null;
      alumno.ultimoMovimiento = salida.toISOString();

      const evento = {
        id: randomUUID(),
        tipo: "salida",
        matricula,
        nombre: alumno.nombre,
        timestamp: salida.toISOString(),
        entradaAt,
        minutos,
        creditoOtorgado,
        simulado: simulados !== null
      };
      estado.historial.unshift(evento);

      return { alumno: structuredClone(alumno), evento };
    });

    return json({
      mensaje: resultado.evento.creditoOtorgado
        ? "Salida registrada. Credito deportivo otorgado."
        : "Salida registrada. La estancia fue menor a 60 minutos; no se otorgo credito.",
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

