const REDIS_KEY = "gimnasio-qr:estado:v1";

const estadoInicial = {
  alumnos: [
    {
      matricula: "A02341001",
      nombre: "Valeria Mendoza",
      carrera: "Ingenieria en Sistemas",
      creditos: 3,
      metaCreditos: 5,
      dentro: false,
      entradaAt: null,
      ultimoMovimiento: null
    },
    {
      matricula: "A02341002",
      nombre: "Diego Ramirez",
      carrera: "Administracion",
      creditos: 4,
      metaCreditos: 5,
      dentro: false,
      entradaAt: null,
      ultimoMovimiento: null
    },
    {
      matricula: "A02341003",
      nombre: "Sofia Hernandez",
      carrera: "Arquitectura",
      creditos: 1,
      metaCreditos: 5,
      dentro: false,
      entradaAt: null,
      ultimoMovimiento: null
    },
    {
      matricula: "A02341004",
      nombre: "Emiliano Torres",
      carrera: "Derecho",
      creditos: 2,
      metaCreditos: 5,
      dentro: false,
      entradaAt: null,
      ultimoMovimiento: null
    }
  ],
  historial: []
};

let memoria = structuredClone(estadoInicial);
let cola = Promise.resolve();

function configuracionRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function comandoRedis(comando) {
  const config = configuracionRedis();
  if (!config) return null;

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(comando)
  });

  if (!response.ok) {
    throw new Error(`Redis respondio con HTTP ${response.status}.`);
  }

  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

function estadoSano(value) {
  return value && Array.isArray(value.alumnos) && Array.isArray(value.historial);
}

export async function obtenerEstado() {
  const config = configuracionRedis();
  if (!config) return structuredClone(memoria);

  const raw = await comandoRedis(["GET", REDIS_KEY]);
  if (!raw) {
    const inicial = structuredClone(estadoInicial);
    await comandoRedis(["SET", REDIS_KEY, JSON.stringify(inicial)]);
    return inicial;
  }

  const parsed = JSON.parse(raw);
  if (!estadoSano(parsed)) throw new Error("El estado persistido tiene un formato invalido.");
  return parsed;
}

async function guardarEstado(estado) {
  if (configuracionRedis()) {
    await comandoRedis(["SET", REDIS_KEY, JSON.stringify(estado)]);
  } else {
    memoria = structuredClone(estado);
  }
}

export function actualizarEstado(transformacion) {
  const trabajo = cola.then(async () => {
    const estado = await obtenerEstado();
    const resultado = await transformacion(estado);
    await guardarEstado(estado);
    return resultado;
  });

  cola = trabajo.catch(() => undefined);
  return trabajo;
}

export function resumenEstado(estado) {
  return {
    alumnos: estado.alumnos,
    dentro: estado.alumnos.filter((alumno) => alumno.dentro),
    historial: estado.historial.slice(0, 50),
    metricas: {
      totalAlumnos: estado.alumnos.length,
      dentroAhora: estado.alumnos.filter((alumno) => alumno.dentro).length,
      creditosOtorgados: estado.historial.filter((evento) => evento.creditoOtorgado).length,
      visitasHoy: estado.historial.filter((evento) => {
        const hoy = new Date().toISOString().slice(0, 10);
        return evento.tipo === "entrada" && evento.timestamp.slice(0, 10) === hoy;
      }).length
    },
    almacenamiento: configuracionRedis() ? "redis" : "memoria"
  };
}

export function reiniciarMemoriaParaPruebas() {
  memoria = structuredClone(estadoInicial);
  cola = Promise.resolve();
}

