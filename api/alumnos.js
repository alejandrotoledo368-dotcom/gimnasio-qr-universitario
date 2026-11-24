import { handleError, json, methodNotAllowed, normalizarMatricula } from "../lib/http.js";
import { obtenerEstado, resumenEstado } from "../lib/store.js";

export async function GET(request) {
  try {
    const estado = await obtenerEstado();
    const matricula = normalizarMatricula(new URL(request.url).searchParams.get("matricula"));

    if (matricula) {
      const alumno = estado.alumnos.find((item) => item.matricula === matricula);
      if (!alumno) return json({ error: "Alumno no encontrado." }, 404);
      return json({ alumno });
    }

    return json(resumenEstado(estado));
  } catch (error) {
    return handleError(error);
  }
}

export default {
  fetch(request) {
    return request.method === "GET" ? GET(request) : methodNotAllowed(["GET"]);
  }
};

