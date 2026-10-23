# ExamIA UPCH — v0.2

Piloto de exámenes y revisión de evidencias. **No es todavía una plataforma multiusuario segura ni apta para evaluaciones oficiales.** Los perfiles son simulados y el almacenamiento es local a cada navegador.

## Probar la revisión

1. Abra la aplicación y compruebe que el encabezado dice `v0.2 · piloto local`.
2. Entre como docente de prueba. Abra **Editar y configurar** en un examen.
3. Active **Cámara obligatoria** y **Guardar fotos de cámara**. Los exámenes migrados conservan su configuración anterior: no se activa una cámara previamente desactivada sin intervención del docente.
4. Opcionalmente active **Exigir compartir una pantalla completa**. El estudiante debe aceptar el aviso y elegir una pantalla completa en el selector del navegador, no solo una pestaña.
5. Guarde, pulse **Probar examen**, acepte el aviso y conceda los permisos solicitados. Inicie la prueba, escriba una respuesta, pruebe copiar/pegar, cambie de pestaña y vuelva.
6. Entregue y abra **Entregas y evidencias → Revisar**. Puede ampliar/descargar imágenes, filtrar eventos, revisar respuestas, calificar desarrollo y exportar el informe.

## Cambios implementados

- Historial por intento con tipo de evento, hora local, tiempo desde el inicio, pregunta y duración de la pérdida de foco/visibilidad.
- Registro de acciones copiar, cortar y pegar dentro del área del examen, con cantidad de caracteres cuando está disponible. Bloqueo opcional de pegado y arrastre. No se conserva el texto del portapapeles ni se lee el portapapeles globalmente.
- Fotografías JPEG de cámara y capturas de la pantalla autorizada vinculadas a eventos. Capturas al inicio y entrega cuando hay fotograma disponible, en incidencias, durante una salida prolongada y periódicamente.
- Galería con ampliación y descarga individual. Avisos cuando no hay captura disponible, se alcanza un límite o falta señal.
- Respuestas cerradas y de desarrollo conservadas, guardado automático, recuperación de intentos con plazo original y entrega al agotarse el tiempo.
- Calificación automática de preguntas cerradas y manual de desarrollo. Observaciones y estado de revisión docente, sin penalización automática por incidencias.
- Informes HTML autocontenidos con imágenes embebidas, respaldo JSON con imágenes e incidencias CSV.
- Señales de cámara/pantalla interrumpidas, desconexión de Internet y entrada/salida de pantalla completa. Cuando una fuente obligatoria se pierde, se deshabilitan las respuestas hasta reconectarla; el tiempo no se detiene.
- Integración opcional de MediaPipe Face Detector para ausencia persistente y múltiples rostros. Su carga real y precisión deben validarse en los dispositivos de uso; no es reconocimiento de identidad, detección de teléfonos, orientación de cabeza ni prueba de fraude.

## Límites que no deben confundirse con detección de copia

Una página web puede detectar pérdida de visibilidad o foco, **pero no obtener automáticamente el título, contenido o URL de otra pestaña**. La pantalla compartida permite revisar visualmente lo que aparece en el monitor autorizado, si la captura lo muestra. No se inspeccionan otras pantallas físicas y no se garantiza observar todo cambio de ventana. Los temporizadores y fotogramas pueden verse afectados por el navegador en segundo plano.

Un evento copiar/pegar indica una acción dentro del examen; no demuestra el origen del texto ni su destino. Una ausencia de rostro puede deberse a postura, iluminación u oclusión. Toda señal requiere revisión humana.

No hay grabación continua ni audio. Las capturas no equivalen a un video. No se implementa vigilancia fuera del examen.

## Datos y privacidad

El código público de GitHub no recibe imágenes, respuestas ni informes. Los datos de intentos se guardan con IndexedDB en el navegador. Hay una copia local de recuperación de metadatos/respuestas, sin imágenes, en localStorage. No existe cifrado de aplicación ni protección frente a otros usuarios del mismo perfil de navegador.

Las imágenes tienen un plazo de 7 días y se eliminan al volver a abrir la aplicación después de ese plazo. Máximo 240 imágenes y 2500 eventos por intento; se muestran las limitaciones. Los informes descargados no se eliminan automáticamente. El botón de eliminación borra el intento y sus imágenes locales, no las copias descargadas.

No use datos reales sensibles en este piloto. No suba informes ni fotografías a un repositorio público. Los datos de v0.1 se migran sin borrar el almacenamiento anterior: las imágenes y respuestas que v0.1 nunca guardó no pueden reconstruirse.

La IA opcional descarga código/WebAssembly de jsDelivr (`@mediapipe/tasks-vision@0.10.14`) y el modelo BlazeFace de Google. Esas solicitudes exponen metadatos de red normales a esos proveedores; los fotogramas no se envían para inferencia. Para despliegue institucional deben revisarse las dependencias y considerarse su alojamiento propio.

## Estado de validación

Se revisó sintaxis con `node --check` y se ejecutaron 18 comprobaciones de interfaz/flujo en Chromium: respuestas, eventos de portapapeles, imágenes enlazadas, filtros, ampliación, calificación, exportaciones, recuperación, bloqueo opcional de pegado, exigencia de pantalla, reconexión de cámara y eliminación.

**Alcance de esas pruebas:** el entorno bloquea la navegación del navegador; la interfaz se cargó directamente y se usaron dobles de prueba para IndexedDB, localStorage, cámara, pantalla y eventos de visibilidad. Los dobles no forman parte de la aplicación publicada. Esto NO valida permisos de dispositivos reales, persistencia nativa de IndexedDB, precisión de MediaPipe ni funcionamiento con 50 estudiantes simultáneos.

## Pendiente imprescindible para uso institucional

Autenticación Google UPCH verificada en servidor, autorización real de administrador/docente/estudiante, aislamiento por cursos, respuestas correctas fuera del cliente, tiempo e intentos controlados por servidor, almacenamiento compartido y restringido de evidencias, recepción verificable de entregas, políticas institucionales y pruebas de carga con hasta 50 estudiantes. Un frontend estático y registros locales no ofrecen integridad frente a manipulación.

## Publicación

GitHub Pages: rama `main`, carpeta raíz. `index.html` carga `app-v02.js`. No necesita instalar dependencias para probar la interfaz. La IA opcional requiere descargar sus dependencias y modelo.
