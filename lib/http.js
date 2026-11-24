export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0"
    }
  });
}

export function methodNotAllowed(allowed) {
  return new Response(JSON.stringify({ error: "Metodo no permitido." }), {
    status: 405,
    headers: {
      "content-type": "application/json; charset=utf-8",
      allow: allowed.join(", ")
    }
  });
}

export async function readJson(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new HttpError(415, "El cuerpo debe enviarse como application/json.");
  }

  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "El JSON enviado no es valido.");
  }
}

export function matriculaValida(value) {
  return typeof value === "string" && /^[A-Z0-9-]{4,20}$/.test(value.trim().toUpperCase());
}

export function normalizarMatricula(value) {
  return String(value || "").trim().toUpperCase();
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function handleError(error) {
  if (error instanceof HttpError) {
    return json({ error: error.message }, error.status);
  }

  console.error("Error no controlado:", error);
  return json({ error: "No fue posible completar la operacion." }, 500);
}

