# Reporte de contribuciones del equipo

## Datos generales

| Campo | Informacion |
|---|---|
| Proyecto | UniSport — Control de gimnasio con QR |
| Materia | Programacion de Sistemas |
| Integrante 1 | Allan — `22011704@udec.edu.mx` |
| Integrante 2 | Miled El Salibe — `miledelsalibe.com@gmail.com` |
| Integrante 3 | alejandrotoledo368-dotcom — `alejandrotoledo368@gmail.com` |
| Entregable | Aplicacion web, ejecutable Windows, pruebas y despliegue Vercel |

> Las contrasenas no forman parte del codigo ni del historial. GitHub debe utilizarse con inicio de sesion, tokens o llaves SSH personales.

## Objetivo del sistema

UniSport registra entradas y salidas del gimnasio mediante codigos QR capturados por una camara CMOS. Al cerrar una visita, el servidor calcula la diferencia entre el timestamp de salida y el de entrada. Se otorga un credito deportivo solamente cuando la permanencia es mayor o igual a 60 minutos.

```text
Pase del alumno → QR dinamico → Camara CMOS → Panel administrativo
                                                        │
                               ┌────────────────────────┴─────────────────────┐
                               ▼                                              ▼
                        POST /api/checkin                              POST /api/checkout
                        guarda entrada                     calcula salida - entrada
                                                                        │
                                                         minutos >= 60 → credito +1
                                                         minutos < 60  → sin credito
```

## Allan — Backend y regla de negocio

### Rama y commits

Rama: `feature/backend-api`

- `feat(api): implementar consulta de alumnos y check-in`
- `feat(api): validar checkout y regla de 60 minutos`

### Trabajo realizado

1. Implemento `GET /api/alumnos` para consultar alumnos, ocupacion, historial y metricas.
2. Implemento `POST /api/checkin` para validar la matricula y guardar `entradaAt`.
3. Implemento `POST /api/checkout` para calcular minutos, registrar la salida y otorgar el credito.
4. Impidio entradas duplicadas y salidas sin una entrada activa mediante respuestas HTTP 409.
5. Creo `lib/http.js` para estandarizar JSON, validaciones y errores.
6. Creo `lib/store.js` con modo en memoria y persistencia Redis/Upstash para Vercel.
7. Limito `minutosSimulados` al intervalo de 0 a 720 para la demostracion academica.

### Archivos principales

| Archivo | Evidencia |
|---|---|
| `api/alumnos.js` | Consulta de alumnos y resumen del sistema. |
| `api/checkin.js` | Registro y proteccion de la entrada. |
| `api/checkout.js` | Regla `minutos >= 60`. |
| `lib/http.js` | Validaciones y respuestas HTTP. |
| `lib/store.js` | Estado inicial y adaptador Redis. |

### Guion para que Allan explique su parte

> Mi responsabilidad fue el backend. Separe el sistema en tres funciones serverless: consulta de alumnos, registro de entrada y registro de salida. En el check-in guardo un timestamp ISO y verifico que el alumno no tenga otra visita activa. En el checkout resto la fecha de entrada a la fecha de salida. La constante de negocio vale 60 y la condicion utiliza mayor o igual, de modo que exactamente 60 minutos si conceden el credito. Esta decision ocurre en el servidor y no en el navegador, porque el frontend puede modificarse. Para Vercel agregue Redis REST, ya que las funciones serverless no comparten memoria de manera garantizada.

Preguntas probables:

- **¿Por que validar en el servidor?** Para impedir que una modificacion del navegador otorgue creditos indebidamente.
- **¿Que pasa con 59 minutos?** La salida se registra, pero los creditos no cambian.
- **¿Que pasa con exactamente 60 minutos?** Si se otorga un credito porque la comparacion es `>= 60`.
- **¿Por que Redis?** Porque el almacenamiento en memoria de una funcion serverless puede desaparecer o quedar aislado entre instancias.
- **¿Como se evita una entrada doble?** El backend comprueba `dentro` y responde HTTP 409 si ya existe una visita activa.

## Miled El Salibe — Tarjeta virtual y QR

### Rama y commits

Rama: `feature/tarjeta-qr`

- `feat(tarjeta): crear credencial movil del alumno`
- `feat(qr): agregar estilos responsivos y QR dinamico`

### Trabajo realizado

1. Creo la tarjeta movil con nombre, matricula, carrera, estado y avance de creditos.
2. Implemento el selector de alumno y el consumo de `GET /api/alumnos`.
3. Integro `qrcode` para generar el pase desde el navegador.
4. Incluye matricula, fecha de emision y un identificador aleatorio en cada codigo.
5. Renueva el QR cada 30 segundos.
6. Creo el sistema visual responsivo, barra de progreso, estados y accesibilidad base.

### Archivos principales

| Archivo | Evidencia |
|---|---|
| `public/index.html` | Estructura de la tarjeta virtual. |
| `public/js/alumno.js` | Consulta, renderizado y generacion del QR. |
| `public/css/styles.css` | Sistema visual y diseño responsivo. |

### Guion para que Miled explique su parte

> Mi parte fue la tarjeta virtual del alumno. La pantalla consume la API y presenta los datos y creditos actuales. Con la biblioteca qrcode genero un codigo que contiene la matricula, la fecha de emision y un identificador aleatorio. El QR se renueva cada 30 segundos para demostrar un pase dinamico. Tambien adapte la interfaz a telefono y escritorio, agregue progreso accesible y estados claros para saber si el alumno se encuentra dentro o fuera.

Preguntas probables:

- **¿Por que cambia el QR?** Cada renovacion genera un timestamp y un `nonce` nuevos.
- **¿Que contiene?** Tipo de pase, matricula, fecha de emision e identificador aleatorio.
- **¿El QR otorga el credito?** No. Solo identifica al alumno; el servidor decide el credito.
- **¿Como se actualiza la tarjeta?** Consulta nuevamente `/api/alumnos` y vuelve a renderizar los datos.

## alejandrotoledo368-dotcom — Panel, sensor, ejecutable y calidad

### Rama y commits

Rama: `feature/admin-pruebas`

- `feat(admin): integrar panel y lector optico QR`
- `test: automatizar casos de entrada y credito`
- `build(docs): agregar ejecutable y documentacion final`

### Trabajo realizado

1. Creo el dashboard administrativo con metricas, tabla de ocupacion e historial.
2. Integro `html5-qrcode` para leer el pase mediante la camara CMOS.
3. Agrego antirrebote de cuatro segundos y captura manual de respaldo.
4. Implemento alertas visuales y el boton **Simular +65 min**.
5. Creo las pruebas automatizadas de consulta, entrada, salida sin credito, salida con credito y entrada duplicada.
6. Documento los cuatro casos de prueba solicitados.
7. Desarrollo `launcher.py`, compila `GimnasioQR.exe` con PyInstaller y agrega el BAT de respaldo.
8. Configura el ejecutable para esperar al puerto 3000 y abrir las dos vistas automaticamente.
9. Actualiza el README, el reporte, las ramas y los Pull Requests.

### Archivos principales

| Archivo | Evidencia |
|---|---|
| `public/admin.html` | Estructura del panel administrativo. |
| `public/js/admin.js` | Camara, lectura QR, alertas y consumo de API. |
| `tests/api.test.js` | Pruebas automatizadas. |
| `tests/pruebas_sistema.md` | Protocolo manual de cuatro casos. |
| `launcher.py` | Servidor local autocontenido. |
| `GimnasioQR.exe` | Ejecutable de doble clic para Windows. |
| `Iniciar_Gimnasio_QR.bat` | Respaldo de arranque. |
| `README.md` | Instalacion, API, despliegue y evidencia Git. |

### Guion para que alejandrotoledo368-dotcom explique su parte

> Mi parte integra el sensor fisico con el sistema. El panel usa html5-qrcode para solicitar acceso a la camara CMOS y procesar los fotogramas localmente; las imagenes no se almacenan. Cuando obtiene una matricula consulta el estado: si el alumno esta fuera solicita un check-in y si esta dentro solicita un checkout. Tambien agregue una entrada manual de respaldo y la simulacion de 65 minutos. Para facilitar la demostracion compile un ejecutable autocontenido que levanta el servidor, comprueba el puerto y abre las dos vistas. Finalmente automatice las pruebas y organice las contribuciones mediante tres Pull Requests.

Preguntas probables:

- **¿Por que la camara es un sensor de entrada?** Convierte la luz en fotogramas digitales que se decodifican como un QR.
- **¿Se almacenan fotogramas?** No; el procesamiento ocurre en el navegador.
- **¿Que pasa si falla la camara?** Se utiliza la captura manual y se ejecuta la misma API.
- **¿Para que sirve el ejecutable?** Permite demostrar el sistema con doble clic sin instalar Node.js o Python.
- **¿Como se probo?** Con cinco pruebas automatizadas y un flujo HTTP real sobre el ejecutable.

## Integracion y evidencia Git

Las tres ramas parten de una base estable y se integran a `main` mediante Pull Requests. Cada integrante tiene al menos dos commits significativos asociados con su responsabilidad.

```bash
git shortlog -sne --all
git log --graph --pretty=format:"%h | %an <%ae> | %s" --all
```

La aplicacion final combina las tres aportaciones: Miled produce el pase, alejandrotoledo368-dotcom lo captura y presenta la operacion, y Allan valida y almacena el resultado en el servidor.

