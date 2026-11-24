"""Servidor local autocontenido para el ejecutable GimnasioQR.exe.

Conserva la misma interfaz HTTP que las funciones serverless de /api para que
la demostracion pueda abrirse con doble clic sin instalar Node.js ni Vercel.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sys
import threading
import time
import uuid
import webbrowser
from copy import deepcopy
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import urlopen


HOST = "127.0.0.1"
PORT = 3000
MINUTOS_PARA_CREDITO = 60


def raiz_proyecto() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


PUBLIC_DIR = raiz_proyecto() / "public"


def ahora_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


ESTADO_INICIAL = {
    "alumnos": [
        {
            "matricula": "A02341001",
            "nombre": "Valeria Mendoza",
            "carrera": "Ingenieria en Sistemas",
            "creditos": 3,
            "metaCreditos": 5,
            "dentro": False,
            "entradaAt": None,
            "ultimoMovimiento": None,
        },
        {
            "matricula": "A02341002",
            "nombre": "Diego Ramirez",
            "carrera": "Administracion",
            "creditos": 4,
            "metaCreditos": 5,
            "dentro": False,
            "entradaAt": None,
            "ultimoMovimiento": None,
        },
        {
            "matricula": "A02341003",
            "nombre": "Sofia Hernandez",
            "carrera": "Arquitectura",
            "creditos": 1,
            "metaCreditos": 5,
            "dentro": False,
            "entradaAt": None,
            "ultimoMovimiento": None,
        },
        {
            "matricula": "A02341004",
            "nombre": "Emiliano Torres",
            "carrera": "Derecho",
            "creditos": 2,
            "metaCreditos": 5,
            "dentro": False,
            "entradaAt": None,
            "ultimoMovimiento": None,
        },
    ],
    "historial": [],
}

estado = deepcopy(ESTADO_INICIAL)
estado_lock = threading.RLock()


def matricula_normalizada(valor: object) -> str:
    return str(valor or "").strip().upper()


def matricula_valida(valor: str) -> bool:
    if not 4 <= len(valor) <= 20:
        return False
    return all(caracter.isalnum() or caracter == "-" for caracter in valor)


def alumno_por_matricula(matricula: str) -> dict | None:
    return next((item for item in estado["alumnos"] if item["matricula"] == matricula), None)


def resumen_estado() -> dict:
    hoy = datetime.now(timezone.utc).date().isoformat()
    alumnos = deepcopy(estado["alumnos"])
    historial = deepcopy(estado["historial"][:50])
    return {
        "alumnos": alumnos,
        "dentro": [item for item in alumnos if item["dentro"]],
        "historial": historial,
        "metricas": {
            "totalAlumnos": len(alumnos),
            "dentroAhora": sum(1 for item in alumnos if item["dentro"]),
            "creditosOtorgados": sum(1 for evento in historial if evento.get("creditoOtorgado")),
            "visitasHoy": sum(
                1
                for evento in historial
                if evento["tipo"] == "entrada" and evento["timestamp"].startswith(hoy)
            ),
        },
        "almacenamiento": "memoria-local",
    }


class GimnasioHandler(BaseHTTPRequestHandler):
    server_version = "GimnasioQR/1.0"

    def log_message(self, formato: str, *args: object) -> None:
        print(f"[{self.log_date_time_string()}] {formato % args}")

    def enviar_json(self, payload: dict, status: int = 200) -> None:
        cuerpo = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(cuerpo)

    def leer_json(self) -> dict | None:
        if "application/json" not in self.headers.get("Content-Type", ""):
            self.enviar_json({"error": "El cuerpo debe enviarse como application/json."}, 415)
            return None
        try:
            longitud = int(self.headers.get("Content-Length", "0"))
            if longitud <= 0 or longitud > 64_000:
                raise ValueError
            resultado = json.loads(self.rfile.read(longitud).decode("utf-8"))
            if not isinstance(resultado, dict):
                raise ValueError
            return resultado
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            self.enviar_json({"error": "El JSON enviado no es valido."}, 400)
            return None

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/alumnos":
            with estado_lock:
                matricula = matricula_normalizada(parse_qs(parsed.query).get("matricula", [""])[0])
                if matricula:
                    alumno = alumno_por_matricula(matricula)
                    if not alumno:
                        self.enviar_json({"error": "Alumno no encontrado."}, 404)
                        return
                    self.enviar_json({"alumno": deepcopy(alumno)})
                    return
                self.enviar_json(resumen_estado())
            return

        if parsed.path.startswith("/api/"):
            self.enviar_json({"error": "Endpoint no encontrado."}, 404)
            return

        self.servir_archivo(parsed.path)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path not in {"/api/checkin", "/api/checkout"}:
            self.enviar_json({"error": "Endpoint no encontrado."}, 404)
            return

        body = self.leer_json()
        if body is None:
            return
        matricula = matricula_normalizada(body.get("matricula"))
        if not matricula_valida(matricula):
            self.enviar_json({"error": "Matricula invalida."}, 400)
            return

        with estado_lock:
            alumno = alumno_por_matricula(matricula)
            if not alumno:
                self.enviar_json({"error": "Alumno no encontrado."}, 404)
                return
            if parsed.path == "/api/checkin":
                self.registrar_entrada(alumno)
            else:
                self.registrar_salida(alumno, body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Allow", "GET, POST, OPTIONS")
        self.end_headers()

    def registrar_entrada(self, alumno: dict) -> None:
        if alumno["dentro"]:
            self.enviar_json({"error": "El alumno ya tiene una entrada activa."}, 409)
            return
        timestamp = ahora_iso()
        alumno["dentro"] = True
        alumno["entradaAt"] = timestamp
        alumno["ultimoMovimiento"] = timestamp
        estado["historial"].insert(
            0,
            {
                "id": str(uuid.uuid4()),
                "tipo": "entrada",
                "matricula": alumno["matricula"],
                "nombre": alumno["nombre"],
                "timestamp": timestamp,
                "minutos": None,
                "creditoOtorgado": False,
                "simulado": False,
            },
        )
        self.enviar_json(
            {
                "mensaje": "Entrada registrada correctamente.",
                "alumno": deepcopy(alumno),
                "timestamp": timestamp,
            },
            200,
        )

    def registrar_salida(self, alumno: dict, body: dict) -> None:
        if not alumno["dentro"] or not alumno["entradaAt"]:
            self.enviar_json({"error": "El alumno no tiene una entrada activa."}, 409)
            return

        simulados = body.get("minutosSimulados")
        if simulados is not None and simulados != "":
            try:
                simulados = int(float(simulados))
                if not 0 <= simulados <= 720:
                    raise ValueError
            except (TypeError, ValueError):
                self.enviar_json({"error": "Los minutos simulados deben estar entre 0 y 720."}, 400)
                return
        else:
            simulados = None

        salida = datetime.now(timezone.utc)
        entrada = datetime.fromisoformat(alumno["entradaAt"].replace("Z", "+00:00"))
        minutos_reales = max(0, int((salida - entrada).total_seconds() // 60))
        minutos = simulados if simulados is not None else minutos_reales
        credito_otorgado = minutos >= MINUTOS_PARA_CREDITO
        if credito_otorgado:
            alumno["creditos"] += 1

        entrada_at = alumno["entradaAt"]
        timestamp = salida.isoformat(timespec="milliseconds").replace("+00:00", "Z")
        alumno["dentro"] = False
        alumno["entradaAt"] = None
        alumno["ultimoMovimiento"] = timestamp
        evento = {
            "id": str(uuid.uuid4()),
            "tipo": "salida",
            "matricula": alumno["matricula"],
            "nombre": alumno["nombre"],
            "timestamp": timestamp,
            "entradaAt": entrada_at,
            "minutos": minutos,
            "creditoOtorgado": credito_otorgado,
            "simulado": simulados is not None,
        }
        estado["historial"].insert(0, evento)
        mensaje = (
            "Salida registrada. Credito deportivo otorgado."
            if credito_otorgado
            else "Salida registrada. La estancia fue menor a 60 minutos; no se otorgo credito."
        )
        self.enviar_json({"mensaje": mensaje, "alumno": deepcopy(alumno), "evento": evento})

    def servir_archivo(self, ruta_url: str) -> None:
        rutas = {"/": "index.html", "/admin": "admin.html", "/admin.html": "admin.html"}
        relativa = rutas.get(ruta_url, ruta_url.lstrip("/"))
        objetivo = (PUBLIC_DIR / relativa).resolve()
        try:
            objetivo.relative_to(PUBLIC_DIR.resolve())
        except ValueError:
            self.send_error(403)
            return
        if not objetivo.is_file():
            self.send_error(404)
            return
        contenido = objetivo.read_bytes()
        tipo = mimetypes.guess_type(objetivo.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", f"{tipo}; charset=utf-8" if tipo.startswith("text/") else tipo)
        self.send_header("Content-Length", str(len(contenido)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Permissions-Policy", "camera=(self)")
        self.end_headers()
        self.wfile.write(contenido)


def esperar_y_abrir() -> None:
    salud = f"http://localhost:{PORT}/api/alumnos"
    for _ in range(50):
        try:
            with urlopen(salud, timeout=0.5) as respuesta:
                if respuesta.status == 200:
                    webbrowser.open_new_tab(f"http://localhost:{PORT}/")
                    webbrowser.open_new_tab(f"http://localhost:{PORT}/admin.html")
                    return
        except OSError:
            time.sleep(0.1)


def main() -> int:
    parser = argparse.ArgumentParser(description="Servidor local de UniSport")
    parser.add_argument("--no-browser", action="store_true", help="No abrir pestañas automáticamente")
    args = parser.parse_args()

    if not PUBLIC_DIR.is_dir():
        print(f"ERROR: no se encontro la carpeta de recursos: {PUBLIC_DIR}")
        input("Presiona Enter para cerrar...")
        return 1

    try:
        servidor = ThreadingHTTPServer((HOST, PORT), GimnasioHandler)
    except OSError as error:
        print(f"ERROR: no se pudo usar el puerto {PORT}: {error}")
        input("Presiona Enter para cerrar...")
        return 1

    print("=" * 58)
    print("  UniSport - Control de Gimnasio QR")
    print(f"  Alumno: http://localhost:{PORT}/")
    print(f"  Admin:  http://localhost:{PORT}/admin.html")
    print("  Cierra esta ventana para detener el servidor.")
    print("=" * 58)
    if not args.no_browser and os.environ.get("GIMNASIO_QR_NO_BROWSER") != "1":
        threading.Thread(target=esperar_y_abrir, daemon=True).start()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        servidor.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

