# Validación de ExamIA 0.3.0

## Ejecutado en este paquete

- **44 pruebas unitarias del backend**, con Node.js y dobles en memoria de Sheets, Drive, Cache, bloqueo, OAuth y utilidades de Apps Script. Cubren autorización, aislamiento entre docentes, claves ocultas, secuencias de guardado, plazos, versiones de examen, calificación, sesiones, evidencias y retención.
- **15 comprobaciones de interfaz en Chromium**, con API y almacenamiento simulados: editor, asignación de estudiantes, gestión de roles, aviso previo, respuestas, evento de pegado, comprobante, revisión, notas y descargas CSV/HTML.
- Comprobación de sintaxis JavaScript del backend y del frontend.

La navegación del navegador de pruebas fue bloqueada por el entorno. Se cargó el HTML directamente y se utilizó un doble de IndexedDB; **no se validó persistencia nativa** en esa prueba. Los dobles están exclusivamente en `tests/`, no en la aplicación publicada.

Para repetir el backend:

```bash
node tests/backend.test.cjs
```

Para repetir las pruebas de interfaz se necesitan Python, Playwright y Chromium. En `tests/ui_smoke.py` puede ajustarse la ruta del ejecutable del navegador.

## No validado todavía

No se desplegó este backend en una cuenta Google real. No se probaron el consentimiento OAuth con una cuenta UPCH, la implementación `/exec`, el puente entre orígenes, políticas de Workspace, almacenamiento real de Drive/Sheets, dispositivos reales, precisión de MediaPipe ni 50 estudiantes simultáneos.

## Aceptación de una instalación

### Identidad y permisos

- [ ] Una cuenta UPCH completa OAuth y recibe el rol correcto.
- [ ] Se rechazan una cuenta personal y un dominio diferente.
- [ ] Un estudiante no puede convertirse en docente cambiando una solicitud.
- [ ] Un docente no puede leer ni editar exámenes o evidencias de otro.
- [ ] Deshabilitar una cuenta revoca su sesión.
- [ ] El cliente del estudiante no recibe claves de respuesta.

### Evaluación y persistencia

- [ ] Dos dispositivos ven la misma evaluación y la entrega correspondiente.
- [ ] Reanudar conserva el vencimiento original.
- [ ] Un envío repetido conserva el comprobante y no duplica el intento.
- [ ] Se conservan las últimas respuestas recibidas antes de un vencimiento.
- [ ] La desconexión se muestra como guardado pendiente, no como entrega exitosa.
- [ ] Las respuestas abiertas y la revisión docente persisten tras cerrar el navegador.
- [ ] Las notas se muestran al estudiante solo al publicarlas.

### Supervisión y evidencias

- [ ] La IA se inicia automáticamente con la cámara y no puede desactivarse desde la interfaz del estudiante.
- [ ] Se conserva el aviso y se requieren los permisos de cámara/pantalla.
- [ ] Una cámara o IA interrumpida bloquea temporalmente las respuestas y se registra como incidencia técnica.
- [ ] Las fotos llegan al Drive privado y se abren desde otra cuenta docente autorizada.
- [ ] Un evento copiar/pegar conserva tipo y longitud, sin leer el portapapeles global.
- [ ] El informe HTML incorpora las fotos disponibles e identifica las faltantes.
- [ ] Se verifica la caducidad de imágenes y el funcionamiento del disparador diario.

### Carga y disponibilidad

Realiza primero pruebas con 2–5 cuentas y después un simulacro de 50 participantes, fuera de un examen oficial. Mide latencias, fallas, conflictos de bloqueo, cuotas, espacio en Drive y pendientes de subida. Incluye inicio y entrega simultáneos, interrupciones de conexión y recuperación.

**Criterio de aceptación sugerido:** ningún acceso indebido, ningún comprobante falso, ninguna pérdida silenciosa de respuestas ya confirmadas y ninguna imagen que aparezca públicamente. Documenta además el tiempo de respuesta y la cantidad máxima de evidencias pendientes; la tolerancia operativa debe acordarla el responsable de la evaluación.

Las cuotas oficiales de Apps Script incluyen límites por usuario y por script. Una aplicación que se ejecuta como su propietario concentra las ejecuciones en esa cuenta. Que existan 50 navegadores conectados no demuestra que puedan procesarse 50 peticiones pesadas al mismo tiempo.

Referencia: [Cuotas oficiales](https://developers.google.com/apps-script/guides/services/quotas).
