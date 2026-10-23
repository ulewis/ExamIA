<div align="center">

# ExamIA UPCH

### Evaluación virtual con supervisión local y revisión docente

Una plataforma para crear exámenes, recoger respuestas y revisar incidencias con evidencia, manteniendo al docente a cargo de la evaluación.

**JavaScript · Google Apps Script · Google Sheets · Google Drive · MediaPipe**

[Abrir plataforma](https://ulewis.github.io/ExamIA/) · [Instalación](docs/INSTALACION.md) · [Arquitectura y seguridad](docs/SEGURIDAD.md) · [Validación](docs/VALIDACION.md)

</div>

---

## El proyecto

ExamIA está orientado a la comunidad de la Universidad Peruana Cayetano Heredia. Integra la creación de evaluaciones, el acceso institucional y la supervisión del navegador en un mismo flujo: **preparar → rendir → revisar → publicar resultados**.

La cámara se procesa en el equipo del estudiante. El servidor administra los permisos, los plazos, las respuestas y las calificaciones. Las alertas sirven para revisar lo ocurrido, no para decidir automáticamente que existe fraude.

## Capacidades

| Área | Funciones |
| --- | --- |
| **Evaluaciones** | Opción múltiple, verdadero/falso y desarrollo; puntajes, duración, publicación y estudiantes autorizados. |
| **Acceso** | Google institucional UPCH; perfiles de administrador, docente y estudiante asignados en servidor. |
| **Supervisión** | Cámara configurable por examen; IA automática y obligatoria cuando se exige cámara; ausencia y múltiples rostros. |
| **Evidencias** | Fotografías de cámara, capturas del monitor autorizado, copiar/cortar/pegar, foco, visibilidad y eventos técnicos. |
| **Entregas** | Inicio y vencimiento en servidor, guardado periódico, recuperación local y comprobante de recepción. |
| **Revisión** | Historial por intento, imágenes privadas, calificación automática y manual, observaciones e informes HTML, JSON y CSV. |

## Roles

**Administrador.** Autoriza docentes, administra cuentas y consulta las evaluaciones de la instalación.

**Docente.** Crea sus exámenes, asigna estudiantes, configura la supervisión, revisa evidencias y publica las notas.

**Estudiante.** Accede a los exámenes asignados, responde con guardado periódico y consulta las notas publicadas. No selecciona su rol ni activa o desactiva la IA.

## Arquitectura

```text
GitHub Pages
    └── Interfaz de ExamIA
         ├── Cámara + MediaPipe → análisis en el dispositivo
         ├── IndexedDB → recuperación temporal
         └── Apps Script → identidad, autorización y reglas de evaluación
               ├── Google Sheets → exámenes, respuestas, notas y eventos
               └── Google Drive → imágenes privadas
```

El repositorio contiene **código y documentación**, nunca evidencias reales, respuestas de estudiantes ni secretos OAuth.

## Puesta en marcha

1. Copia `apps-script/Code.gs`, `apps-script/Bridge.html` y el manifiesto a un proyecto de Google Apps Script.
2. Ejecuta `setupExamIA_()` con tu cuenta UPCH. El instalador crea la base de datos, la carpeta privada y el administrador inicial.
3. Configura el acceso OAuth de Google y despliega la aplicación web.
4. Coloca la URL `/exec` en `config.js` y completa la prueba de aceptación.

**La guía completa está en [docs/INSTALACION.md](docs/INSTALACION.md).** Incluye las propiedades necesarias, los permisos, la conexión con Pages y los errores habituales.

Mientras `apiUrl` esté vacío, la página conserva el piloto local existente. Al configurar la URL, carga el modo conectado. La demostración anterior también permanece en `demo.html`.

## Estructura del repositorio

```text
apps-script/
  Code.gs               API, identidad, datos, evaluación y retención
  Bridge.html           Canal entre GitHub Pages y Apps Script
  appsscript.json       Manifiesto y permisos
config.js               URL pública de la instalación; sin secretos
boot.js                 Selección de modo local o conectado
cloud-client.js          Transporte autenticado
cloud-app.js             Interfaz multiusuario conectada
index.html              Interfaz principal
app-v021.js             Piloto local conservado
demo.html              Acceso independiente a la demostración
docs/                  Instalación, seguridad y validación
tests/                 Pruebas del backend y de la interfaz
```

## Desarrollo y pruebas

No se necesita compilar el frontend ni instalar dependencias para publicarlo en Pages.

```bash
node tests/backend.test.cjs
node --check cloud-app.js
node --check cloud-client.js
```

Las pruebas de interfaz usan Python y Playwright. El alcance y los resultados están documentados en [VALIDACION.md](docs/VALIDACION.md); las pruebas con servicios simulados no sustituyen una validación en Google Workspace.

## Estado de la versión

**v0.3.0 — integración preparada para instalar.** Incluye backend, frontend conectado y documentación de despliegue. No se incluyen credenciales ni una implementación activa de Apps Script.

El objetivo inicial es un grupo de hasta **50 estudiantes**, sujeto a un simulacro de carga y a las cuotas de la cuenta utilizada. La aprobación para uso institucional requiere validar acceso, persistencia, dispositivos, privacidad y capacidad en la instalación real.

## Supervisión responsable

La plataforma informa qué datos captura y solicita los permisos del navegador. No graba audio, no reconoce identidades y no conoce automáticamente la dirección de otra pestaña. Las incidencias siempre requieren interpretación humana. Consulta [SEGURIDAD.md](docs/SEGURIDAD.md) para conocer los límites y la retención.

---

**Responsable del proyecto:** Lewis De La Cruz  
**Contexto académico:** Universidad Peruana Cayetano Heredia · Ingeniería Biomédica
