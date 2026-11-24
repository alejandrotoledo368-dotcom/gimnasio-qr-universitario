# Pruebas del sistema

## Objetivo

Comprobar el flujo completo del sensor optico, el registro de movimientos y la regla de negocio: un credito se concede solamente cuando `salida - entrada >= 60 minutos`.

## Ambiente de prueba

- Navegador Chrome, Edge o Safari reciente con permiso de camara.
- Aplicacion ejecutada con `npm run dev` o desplegada mediante HTTPS en Vercel.
- Alumno de prueba: `A02341001`.
- Panel administrativo: `/admin`.
- Pase de alumno: `/`.

Antes de cada caso se recomienda iniciar con el alumno fuera del gimnasio. En desarrollo se puede reiniciar el proceso de `vercel dev`; con Redis, se debe terminar cualquier visita activa desde el panel.

## Caso 1 — Consulta y generacion del pase QR

| Campo | Detalle |
|---|---|
| Proposito | Validar la lectura de alumnos y la generacion del identificador de entrada. |
| Precondicion | API disponible y al menos un alumno registrado. |
| Entrada | Seleccionar `A02341001` en la tarjeta movil. |
| Procedimiento | Abrir `/`, seleccionar la matricula, observar datos, progreso y QR; esperar 30 segundos. |
| Resultado esperado | Se muestran nombre, carrera, creditos y estado. El QR es visible y se renueva al terminar la cuenta regresiva. |
| Evidencia sugerida | Captura de la tarjeta antes y despues de la renovacion. |

**Criterio de aceptacion:** la respuesta `GET /api/alumnos?matricula=A02341001` es HTTP 200 y el contenido del QR incluye `tipo`, `matricula`, `emitido` y un `nonce` diferente en cada renovacion.

## Caso 2 — Registro de entrada con el sensor optico

| Campo | Detalle |
|---|---|
| Proposito | Verificar que la camara CMOS funciona como dispositivo fisico de entrada. |
| Precondicion | Alumno fuera del gimnasio y permiso de camara concedido. |
| Entrada | QR vigente de `A02341001`. |
| Procedimiento | Abrir `/admin`, activar camara y colocar el QR dentro del recuadro. Como respaldo, escribir la matricula y pulsar **Procesar acceso**. |
| Resultado esperado | Alerta verde, entrada con timestamp, contador **Dentro ahora** incrementado y alumno visible en la tabla. |
| Evidencia sugerida | Captura del lector y de la fila activa. |

**Criterio de aceptacion:** `POST /api/checkin` responde HTTP 200, `dentro=true` y `entradaAt` contiene una fecha ISO valida. Una segunda entrada responde HTTP 409.

## Caso 3 — Salida menor a 60 minutos, sin credito

| Campo | Detalle |
|---|---|
| Proposito | Comprobar el limite inferior de la regla de validacion. |
| Precondicion | El alumno tiene una entrada activa. |
| Entrada | `minutosSimulados: 59` en `POST /api/checkout`. |
| Procedimiento | Ejecutar la peticion o sustituir temporalmente 65 por 59 en una prueba automatizada. |
| Resultado esperado | La salida se registra, el alumno deja la tabla de ocupacion y sus creditos no cambian. El historial muestra **Sin credito**. |
| Evidencia sugerida | Respuesta JSON e historial posterior. |

**Criterio de aceptacion:** HTTP 200, `evento.minutos=59`, `creditoOtorgado=false` y el total de creditos permanece igual.

## Caso 4 — Salida de 65 minutos, con credito

| Campo | Detalle |
|---|---|
| Proposito | Validar el camino exitoso y la herramienta de demostracion. |
| Precondicion | El alumno tiene una entrada activa. |
| Entrada | Boton **Simular +65 min**. |
| Procedimiento | Pulsar el boton en la fila activa y confirmar el dialogo. Actualizar la tarjeta del alumno. |
| Resultado esperado | Alerta verde, salida registrada, incremento de un credito, historial con **Credito otorgado** y tarjeta actualizada. |
| Evidencia sugerida | Capturas del dialogo, historial y progreso del alumno. |

**Criterio de aceptacion:** HTTP 200, `evento.minutos=65`, `creditoOtorgado=true` y el total aumenta exactamente en uno.

## Ejecucion automatizada

```bash
npm test
```

La suite automatiza los cuatro comportamientos esenciales y agrega una prueba de control para impedir entradas duplicadas. Todos los casos deben terminar en estado `pass` antes de fusionar una rama a `develop`.

