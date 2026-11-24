# UniSport — Control de gimnasio con QR

Sistema web para registrar entradas y salidas del gimnasio universitario mediante un sensor optico CMOS (camara de laptop o movil) y validar automaticamente creditos deportivos.

## Funcionalidad entregada

- Pase movil del alumno con selector por matricula, estado, progreso y QR dinamico.
- Panel administrativo responsivo con metricas, lector QR por camara y captura manual de respaldo.
- Registro de entrada con timestamp y bloqueo de entradas duplicadas.
- Registro de salida con calculo de permanencia.
- Regla central en servidor: se otorga un credito solamente con una estancia de **60 minutos o mas**.
- Boton **Simular +65 min** para una demostracion inmediata de la regla.
- Historial de los ultimos 50 movimientos y alertas visuales de exito, informacion y error.
- Persistencia Redis/Upstash para Vercel y modo en memoria para desarrollo sin credenciales.
- Pruebas automatizadas y protocolo manual de cuatro casos.
- Ejecutable autocontenido para Windows y archivo BAT de respaldo para iniciar con doble clic.

## Arquitectura

```text
/
├── api/
│   ├── alumnos.js        # GET de alumnos, ocupacion, historial y metricas
│   ├── checkin.js        # POST de entrada
│   └── checkout.js       # POST de salida y validacion >= 60 min
├── lib/
│   ├── http.js           # Respuestas, validacion y errores compartidos
│   └── store.js          # Estado semilla y adaptador Redis/memoria
├── public/
│   ├── index.html        # Pase movil
│   ├── admin.html        # Panel de directivos y lector optico
│   ├── css/styles.css
│   └── js/
│       ├── alumno.js
│       └── admin.js
├── tests/
│   ├── api.test.js
│   └── pruebas_sistema.md
├── GimnasioQR.exe       # Servidor local autocontenido para Windows
├── Iniciar_Gimnasio_QR.bat
├── launcher.py          # Codigo fuente del ejecutable local
├── REPORTE_CONTRIBUCIONES.md
├── .env.example
├── .gitignore
├── package.json
└── vercel.json
```

### Flujo del sistema

```text
Pase del alumno → QR dinamico → Camara CMOS → html5-qrcode
                                               ↓
                                    matricula validada
                                               ↓
                         entrada activa? ── no ──→ /api/checkin
                              │
                              si
                              ↓
                         /api/checkout → minutos >= 60? → credito +1
                                      └→ minutos < 60  → sin credito
```

La regla vive en `api/checkout.js`; por ello no puede alterarse desde la interfaz del navegador. El parametro opcional `minutosSimulados` acepta valores de 0 a 720 y existe unicamente para pruebas y exposicion academica.

## Tecnologias

- HTML5 semantico y CSS3 responsivo.
- JavaScript ES2022 con modulos.
- Node.js 20+ en Vercel Functions.
- [`qrcode` 1.5.4](https://www.npmjs.com/package/qrcode) para generar el pase.
- [`html5-qrcode` 2.3.8](https://www.npmjs.com/package/html5-qrcode) para decodificar la imagen de camara.
- Upstash Redis REST como persistencia serverless opcional.

## Inicio local

Requisitos: Node.js 20 o superior y npm.

```bash
npm install
npm run dev
```

Abrir:

- Pase del alumno: `http://localhost:3000/`
- Panel administrativo: `http://localhost:3000/admin`

En local, sin variables de entorno, se usa memoria volatil. Los datos se restablecen al reiniciar el servidor.

### Inicio con doble clic en Windows

Abrir `GimnasioQR.exe` o `Iniciar_Gimnasio_QR.bat`. El servidor espera a que el puerto 3000 este disponible y abre automaticamente:

- `http://localhost:3000/`
- `http://localhost:3000/admin.html`

El ejecutable incluye el runtime necesario y no requiere instalar Node.js ni Python. La ventana de consola debe permanecer abierta mientras se utiliza el sistema.

## Persistencia en Vercel

Las funciones serverless no comparten memoria de forma garantizada. Para conservar accesos entre ejecuciones se debe conectar una base Redis compatible con la API REST de Upstash y configurar:

```dotenv
KV_REST_API_URL=https://tu-instancia.upstash.io
KV_REST_API_TOKEN=tu_token_secreto
```

Tambien se reconocen `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`. Nunca se deben subir tokens al repositorio.

## Despliegue en Vercel

1. Subir el repositorio a GitHub, GitLab o Bitbucket.
2. En Vercel, seleccionar **Add New Project** e importar el repositorio.
3. No seleccionar framework; Vercel detecta `public/`, `api/` y `vercel.json`.
4. Agregar las dos variables de Redis en **Project Settings → Environment Variables**.
5. Desplegar y conceder permiso de camara al abrir `/admin`.

La camara requiere HTTPS o `localhost`; el despliegue de Vercel ya proporciona HTTPS.

## API

### `GET /api/alumnos`

Devuelve catalogo, alumnos dentro, historial, metricas y modo de almacenamiento. Con `?matricula=A02341001` devuelve solamente ese alumno.

### `POST /api/checkin`

```json
{ "matricula": "A02341001" }
```

Respuestas principales: `200` entrada creada, `404` alumno inexistente, `409` entrada ya activa.

### `POST /api/checkout`

```json
{ "matricula": "A02341001", "minutosSimulados": 65 }
```

`minutosSimulados` es opcional. Si se omite, la duracion se calcula con los timestamps reales.

## Pruebas

```bash
npm test
```

La especificacion manual con precondiciones, entradas, pasos, resultados y evidencias se encuentra en [`tests/pruebas_sistema.md`](tests/pruebas_sistema.md).

## Estrategia Git y autores

Se utiliza un flujo Git basado en tres Pull Requests:

- `main`: version estable y entregable.
- `feature/backend-api`: API, persistencia y regla de 60 minutos.
- `feature/tarjeta-qr`: tarjeta movil, estilos y generador QR.
- `feature/admin-pruebas`: panel administrativo, lector optico, ejecutable, pruebas y documentacion.

Cada rama contiene por lo menos dos commits significativos y se integra a `main` mediante un Pull Request con merge commit. El historial identifica a los tres integrantes:

| Identidad Git | Responsabilidad |
|---|---|
| `Allan <22011704@udec.edu.mx>` | Funciones serverless, persistencia, check-in, checkout y regla de 60 minutos. |
| `Miled El Salibe <miledelsalibe.com@gmail.com>` | Tarjeta movil, estilos responsivos y generacion del QR dinamico. |
| `alejandrotoledo368-dotcom <alejandrotoledo368@gmail.com>` | Panel administrativo, lector QR por camara, ejecutable, pruebas, README e integracion. |

El desglose de actividades, evidencias y guion de exposicion se encuentra en [`REPORTE_CONTRIBUCIONES.md`](REPORTE_CONTRIBUCIONES.md).

Para inspeccionar la evidencia:

```bash
git log --graph --oneline --decorate --all
git shortlog -sne --all
```

## Matriz de cumplimiento

| Criterio | Evidencia |
|---|---|
| Dispositivo fisico de entrada | Camara CMOS consumida por `html5-qrcode` en `public/js/admin.js`. |
| Captura y procesamiento | Decodificacion en tiempo real, validacion del payload y antirrebote de 4 segundos. |
| Regla de negocio | `api/checkout.js` calcula minutos y valida `>= 60`. |
| Interfaz alumno | `public/index.html` y `public/js/alumno.js`. |
| Interfaz directivos | `public/admin.html` y `public/js/admin.js`. |
| Servicios web | Tres endpoints bajo `/api`, con codigos HTTP y JSON. |
| Persistencia serverless | Adaptador Redis REST en `lib/store.js`. |
| Pruebas | `tests/api.test.js` y `tests/pruebas_sistema.md`. |
| Despliegue | `vercel.json`, variables documentadas y rutas limpias. |
| Control de versiones | Ramas de funcionalidad, merges no fast-forward y autores por responsabilidad. |

## Seguridad y operacion

- La camara se procesa dentro del navegador; no se transmiten ni almacenan fotogramas.
- Las matriculas se normalizan y validan en el servidor.
- Los endpoints rechazan metodos y tipos de contenido no admitidos.
- Las credenciales Redis solo se leen desde variables de entorno.
- La interfaz evita insertar datos sin escapar en el DOM, incluye foco visible y respeta `prefers-reduced-motion`.
- Para un entorno institucional real se debe agregar autenticacion de directivos y control de roles antes de manejar datos personales reales.

## Licencia y alcance

Proyecto academico para la materia **Programacion de Sistemas**. Los alumnos incluidos son datos ficticios de demostracion.

