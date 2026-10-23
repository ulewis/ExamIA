# Instalación de ExamIA con Google Apps Script

Esta guía conecta la interfaz alojada en `ulewis/ExamIA` con un backend de Google. No requiere instalar un servidor de IA. El análisis de cámara permanece en el navegador.

## 1. Preparar el proyecto

Accede a [Google Apps Script](https://script.google.com/) con tu cuenta `@upch.pe` y crea un proyecto independiente llamado **ExamIA UPCH**.

Crea estos archivos, usando sus contenidos del repositorio:

| Archivo en el repositorio | En el editor de Apps Script |
| --- | --- |
| [`apps-script/Code.gs`](../apps-script/Code.gs) | Reemplaza el contenido de `Code.gs`. |
| [`apps-script/Bridge.html`](../apps-script/Bridge.html) | Añade un archivo **HTML** llamado `Bridge`. |
| [`apps-script/appsscript.json`](../apps-script/appsscript.json) | Activa «Mostrar el archivo de manifiesto» en Configuración del proyecto y reemplaza `appsscript.json`. |

No copies el frontend de cámara dentro de Apps Script: el sitio principal debe seguir abierto en GitHub Pages, no en el iframe de HtmlService.

## 2. Crear la base y el administrador

Desde el editor ejecuta **`setupExamIA_`**, revisa los permisos y autoriza tu propio proyecto. La función termina en guion bajo para que no pueda ejecutarse remotamente desde `google.script.run`.

El instalador crea:

- Una hoja de cálculo **ExamIA UPCH · Base de datos**, con las tablas internas.
- Una carpeta **ExamIA UPCH · Evidencias privadas**, sin acceso público.
- Tu cuenta como administrador inicial.
- Una tarea diaria para trasladar a la papelera las imágenes vencidas.

Se puede repetir la función: reutiliza los recursos cuyos identificadores ya están guardados. **No compartas la base ni la carpeta con los estudiantes.** El acceso se realiza mediante la API y sus permisos, no compartiendo archivos de Drive.

En **Configuración del proyecto → Propiedades del script** se crean `DB_ID`, `EVIDENCE_FOLDER_ID`, `SESSION_SECRET` y `APP_URL`. No copies esas propiedades al repositorio. `APP_URL` queda como `https://ulewis.github.io/ExamIA/`.

## 3. Crear la implementación web

Selecciona **Implementar → Nueva implementación → Aplicación web**.

- **Ejecutar como:** tu cuenta, propietaria del script.
- **Quién tiene acceso:** **Cualquier usuario**. No selecciones «Solo yo» ni «Cualquier usuario con una cuenta de Google» para el canal anónimo que utiliza esta arquitectura.

El endpoint es accesible, pero **todas las operaciones de datos exigen una sesión de ExamIA validada en servidor**. Publicar el endpoint no vuelve pública la base de datos.

Copia la URL de implementación terminada en **`/exec`**. No uses la URL del editor ni `/dev`.

Añade en las propiedades del script:

```text
WEB_APP_URL = la URL /exec que acabas de copiar
```

Si UPCH no permite una implementación accesible a cualquier usuario, detén esta instalación y consulta a su administrador de Workspace. No elimines los controles de identidad ni hagas públicas las hojas para sortear la restricción.

## 4. Configurar el acceso institucional de Google

Esta versión utiliza un flujo OAuth de servidor. Necesita un cliente web de Google; una comprobación del texto `@upch.pe` no sustituye la autenticación.

En [Google Cloud Console](https://console.cloud.google.com/), utilizando la cuenta UPCH:

1. Crea o selecciona un proyecto y configura **Google Auth Platform / Pantalla de consentimiento OAuth**. Usa el nombre ExamIA y un correo de soporte de tu organización. Selecciona audiencia **Interna** cuando esté disponible en la organización UPCH. La disponibilidad depende de sus permisos administrativos.
2. Crea un **ID de cliente OAuth → Aplicación web**.
3. En **URI de redirección autorizados**, registra **exactamente** la misma URL `/exec` guardada en `WEB_APP_URL`, sin parámetros y sin cambiar `/s/` por `/d/`.
4. Copia el ID del cliente y su secreto a las **propiedades del script**, no a archivos de GitHub:

```text
OAUTH_CLIENT_ID = ID del cliente web
OAUTH_CLIENT_SECRET = secreto de ese cliente
```

El acceso solicita únicamente identidad: `openid email profile`. No solicita permiso para el Drive de cada estudiante. La escritura en Sheets y Drive utiliza los permisos del propietario del script.

El backend obtiene el código OAuth, lo intercambia en Google, consulta la identidad por HTTPS y verifica correo confirmado y dominio administrado `hd = upch.pe`. Utiliza `state` de un solo uso y PKCE. No usa el endpoint `tokeninfo` como sustituto de autenticación de producción.

Si la organización bloquea OAuth o la creación de clientes, se requiere autorización de su administrador. No se incluyen credenciales ficticias que permitan eludir este paso.

## 5. Conectar GitHub Pages

Edita [`config.js`](../config.js) en GitHub:

```javascript
window.EXAMIA_CONFIG = Object.freeze({
  apiUrl: "PEGA_AQUI_TU_URL_REAL_TERMINADA_EN_EXEC",
  transport: "bridge"
});
```

Solo la URL es pública. **Nunca añadas el secreto OAuth, `SESSION_SECRET`, tokens de sesión o evidencias.**

Guarda el cambio en `main`. Mantén la publicación de Pages desde esa rama y la carpeta raíz. Al recargar el sitio deberá aparecer **v0.3 · conexión institucional**.

Hasta que `apiUrl` tenga un valor, ExamIA sigue mostrando el piloto local. Los intentos del piloto no se convierten en entregas verificadas ni se suben automáticamente. Crea las evaluaciones reales en el modo conectado.

## 6. Primera prueba entre dos cuentas

Abre ExamIA, pulsa **Continuar con Google UPCH**, elige tu cuenta y utiliza **Volver a ExamIA** cuando termine la verificación. Continúa en la misma pestaña: se comprueba un identificador de inicio guardado en ella.

Como administrador, entra a **Usuarios y permisos** para autorizar a otro docente. Una cuenta nueva, validada por Google, entra como estudiante; no puede elegirse un rol superior.

Crea un examen de prueba, añade el correo de una segunda cuenta en «Estudiantes autorizados» y publícalo. Inicia con esa segunda cuenta en un perfil de navegador separado. Confirma que:

- No puede editar exámenes, cambiar su rol ni ver respuestas correctas.
- Su entrega obtiene un comprobante y aparece desde el equipo del docente.
- Las imágenes llegan a la carpeta privada y el docente autorizado puede abrirlas.
- Las notas solo se muestran al estudiante después de publicarlas desde el examen.

No compartas una sesión de administrador ni el mismo perfil de navegador con los estudiantes.

## 7. Plazos, desconexiones e imágenes

El reloj de referencia es el del servidor. Reanudar un intento conserva su plazo; solo se permite un intento por estudiante y examen. Los intentos de prueba del docente se etiquetan como vista previa.

Las respuestas se envían aproximadamente cada 12–18 segundos, con distribución aleatoria de solicitudes, y al entregar. Hay una copia local de recuperación. **Las respuestas que llegan después de la hora límite no sustituyen a las que ya recibió el servidor**, aunque se hayan escrito antes en un dispositivo desconectado. El informe y el comprobante deben revisarse antes de afirmar que una entrega está completa.

Las imágenes se envían progresivamente y se intenta completar su envío al entregar. Si falla, la página muestra lo pendiente y permite reintentar. El backend admite evidencias hasta 10 minutos después del vencimiento; eso no amplía el plazo de respuestas.

Límites iniciales: 50 preguntas, 28 000 caracteres totales de respuestas, 8 000 por respuesta abierta, 2 500 eventos y 120 JPEG de hasta 180 KiB por intento. Estos límites están definidos en el código; no equivalen a una garantía de capacidad concurrente.

## 8. Actualizar una instalación

Actualiza `Code.gs`, `Bridge` y, si cambió, el manifiesto. Después utiliza **Implementar → Gestionar implementaciones → Editar → Nueva versión** manteniendo la misma implementación para conservar su URL. Actualizar el código en el editor no actualiza por sí solo una versión desplegada.

Publica los cambios del frontend en GitHub. No borres las propiedades del script ni ejecutes un instalador distinto sobre una base existente sin respaldo.

## Resolución de problemas

| Mensaje o síntoma | Revisión |
| --- | --- |
| `redirect_uri_mismatch` | El URI OAuth y `WEB_APP_URL` deben ser idénticos al `/exec` vigente. |
| No se abrió el canal | Comprueba la URL, la implementación anónima, `Bridge.html`, `APP_URL` y las políticas de Workspace. El navegador puede bloquear el iframe. |
| `AUTH` | La sesión expiró o fue revocada. Inicia sesión otra vez; una sesión dura hasta 8 horas. |
| Solo admite UPCH | Debe ser una cuenta administrada por UPCH, no una cuenta personal con un correo parecido. |
| `BUSY` | El servidor está atendiendo otra escritura. Espera a que la página reintente; no abras muchos intentos paralelos. |
| Cámara o IA sin funcionar | Prueba en un equipo con cámara y navegador compatible; valida los permisos y el acceso a las dependencias de MediaPipe. |
| Se ve la versión local | `config.js` sigue sin URL o el navegador usa una copia en caché. |
| Nota distinta después del vencimiento | El servidor no aceptó respuestas tardías; revisa la última confirmación de guardado. |

Existe un transporte alternativo `transport: "fetch"` con POST de texto simple. **Úsalo solo después de comprobar desde Pages que tu despliegue devuelve respuestas JSON legibles entre orígenes**. No usa `no-cors` y nunca interpreta una respuesta opaca como confirmación de guardado. No cambies al transporte alternativo para ocultar un error de autenticación.

## Antes de los 50 estudiantes

Realiza la lista de aceptación de [VALIDACION.md](VALIDACION.md). Apps Script tiene límites de ejecución simultánea y cuotas por cuenta; 50 estudiantes no deben provocar 50 ejecuciones largas al mismo tiempo. El guardado distribuido reduce picos, pero no sustituye una prueba de carga.

## Referencias oficiales

- [Aplicaciones web de Apps Script](https://developers.google.com/apps-script/guides/web)
- [Comunicación con funciones del servidor](https://developers.google.com/apps-script/guides/html/communication)
- [OAuth para aplicaciones de servidor](https://developers.google.com/identity/protocols/oauth2/web-server)
- [OpenID Connect de Google](https://developers.google.com/identity/openid-connect/openid-connect)
- [Cuotas de Apps Script](https://developers.google.com/apps-script/guides/services/quotas)
