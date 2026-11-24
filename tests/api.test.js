import test from "node:test";
import assert from "node:assert/strict";

import { GET as consultarAlumnos } from "../api/alumnos.js";
import { POST as registrarEntrada } from "../api/checkin.js";
import { POST as registrarSalida } from "../api/checkout.js";
import { reiniciarMemoriaParaPruebas } from "../lib/store.js";

const matricula = "A02341001";

function requestJson(url, body) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

test.beforeEach(() => {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  reiniciarMemoriaParaPruebas();
});

test("GET /api/alumnos entrega el catalogo y las metricas", async () => {
  const response = await consultarAlumnos(new Request("http://localhost/api/alumnos"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.alumnos.length, 4);
  assert.equal(body.metricas.dentroAhora, 0);
  assert.equal(body.almacenamiento, "memoria");
});

test("POST /api/checkin registra una entrada activa", async () => {
  const response = await registrarEntrada(requestJson("http://localhost/api/checkin", { matricula }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.alumno.dentro, true);
  assert.ok(body.alumno.entradaAt);
});

test("una salida antes de 60 minutos no otorga credito", async () => {
  await registrarEntrada(requestJson("http://localhost/api/checkin", { matricula }));
  const response = await registrarSalida(requestJson("http://localhost/api/checkout", {
    matricula,
    minutosSimulados: 59
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.evento.minutos, 59);
  assert.equal(body.evento.creditoOtorgado, false);
  assert.equal(body.alumno.creditos, 3);
  assert.equal(body.alumno.dentro, false);
});

test("una salida con 65 minutos otorga exactamente un credito", async () => {
  await registrarEntrada(requestJson("http://localhost/api/checkin", { matricula }));
  const response = await registrarSalida(requestJson("http://localhost/api/checkout", {
    matricula,
    minutosSimulados: 65
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.evento.minutos, 65);
  assert.equal(body.evento.creditoOtorgado, true);
  assert.equal(body.alumno.creditos, 4);
  assert.equal(body.alumno.dentro, false);
});

test("el sistema rechaza una segunda entrada activa", async () => {
  await registrarEntrada(requestJson("http://localhost/api/checkin", { matricula }));
  const response = await registrarEntrada(requestJson("http://localhost/api/checkin", { matricula }));
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.match(body.error, /entrada activa/i);
});

