# Arquitectura, seguridad y privacidad

## Fronteras de confianza

La interfaz se ejecuta en GitHub Pages. Sus solicitudes llegan a una implementación de Apps Script mediante un puente HtmlService (`postMessage` + `google.script.run`) o, en instalaciones verificadas, POST simple. El puente compara el origen, la ventana y un identificador aleatorio del canal. Ninguno de esos controles sustituye la autenticación: la API valida una sesión firmada en **cada** operación.

Google verifica la cuenta mediante OAuth de servidor y un intercambio de código con PKCE y `state` de un solo uso. El backend consulta `userinfo` por HTTPS y exige `email_verified = true`, `hd = upch.pe` y un correo institucional. El rol se lee de la tabla privada `Users`, no del navegador. Las cuentas nuevas son estudiantes. El secreto del cliente OAuth y la clave de firma solo residen en las propiedades del script.

La sesión de ExamIA dura hasta 8 horas, está firmada mediante HMAC-SHA256 y contiene identidad, revisión y vencimiento. Cambiar el rol, deshabilitar la cuenta o cerrar sesión revoca las sesiones anteriores de esa cuenta. El token se mantiene en `sessionStorage`, no en GitHub. El retorno OAuth lo transmite en un fragmento, que se elimina de la barra de dirección al validarlo. No se debe compartir ese enlace ni registrar tokens en logs.

No hay una auditoría externa de seguridad de esta implementación. El intercambio OAuth y el puente requieren pruebas de extremo a extremo antes de producción.

## Autorización de datos

Un estudiante solo puede acceder a los exámenes publicados y asignados a su correo, iniciar su intento y enviar sus respuestas y evidencias. El backend elimina las claves de respuesta de los exámenes que entrega al estudiante. No puede asignarse un rol ni consultar informes de supervisión.

Un docente solo puede modificar sus exámenes, revisar los intentos de esos exámenes y recuperar sus imágenes. El administrador tiene acceso transversal. Los permisos se comprueban en los endpoints; ocultar un botón no constituye el control de seguridad.

Las definiciones de examen se versionan. Un intento conserva la versión con la que comenzó; editar posteriormente una pregunta no cambia su clave histórica. El servidor genera el inicio, el vencimiento, la nota automática y el comprobante. Se rechazan respuestas fuera de plazo y secuencias de guardado antiguas. Las llamadas repetidas de inicio y entrega no crean un segundo intento ni otro comprobante.

## Qué se captura

Durante una evaluación iniciada, y según la configuración del docente: respuestas; foco y visibilidad; acciones copiar/cortar/pegar y longitud del texto; cambios de pantalla completa; interrupciones técnicas; resultados locales de presencia de rostros; fotografías y capturas del monitor autorizado.

El estudiante recibe un aviso y concede los permisos del navegador. La IA no tiene un interruptor para el estudiante y es obligatoria cuando se exige cámara. El aviso no se elimina ni se realiza captura fuera del examen. No hay audio, reconocimiento de identidad, detección de teléfonos, estimación de mirada ni grabación continua en esta versión.

Los modelos se descargan de jsDelivr y Google; esas solicitudes comunican metadatos de red normales. La inferencia se realiza en el dispositivo. Las fotografías configuradas sí se envían al backend privado, no a un servicio de inferencia ni al repositorio.

## Límites de integridad y detección

Los eventos y los fotogramas proceden del equipo del estudiante y **pueden ser manipulados** por quien lo controla. Una sesión verificada autentica la cuenta; no demuestra que una cámara sea genuina ni que los eventos sean exhaustivos. El servidor conserva por separado las horas de recepción. No debe presentarse este sistema como infalible o resistente a toda manipulación.

Una página web no conoce automáticamente el título ni la URL de otra pestaña. Compartir un monitor permite revisar imágenes de ese monitor, con permiso, pero no observar otras pantallas o dispositivos. Los navegadores pueden reducir la frecuencia de ejecución cuando una pestaña está en segundo plano.

La IA de presencia puede producir falsos positivos. Una ausencia puede ser causada por iluminación, postura, oclusión o interrupciones técnicas. No hay penalización automática. Si se pierde la supervisión requerida, la interfaz bloquea respuestas y procura restablecerla; el reloj continúa. Deben planificarse ajustes razonables y un procedimiento docente para fallas técnicas.

## Almacenamiento y retención

La hoja de cálculo y la carpeta pertenecen al propietario del script y no se comparten públicamente. Los archivos se sirven al docente autorizado a través de la API. No se crean enlaces públicos de Drive.

Las imágenes vencen a los 7 días; la API deja de mostrarlas y la tarea diaria mueve hasta 200 imágenes vencidas por ejecución a la papelera. **Mover a la papelera no equivale a borrado permanente**. Ante volúmenes mayores, habrá una cola hasta las siguientes ejecuciones. El propietario debe gestionar esa cola, el espacio y el vaciado según la política institucional. Los informes descargados no se borran automáticamente.

Las respuestas, notas, versiones, eventos y auditoría no tienen un borrado automático configurado. Definir su plazo institucional y un proceso de eliminación es un requisito previo al uso oficial.

La copia local de recuperación usa IndexedDB. Se elimina al abrir la aplicación si supera 7 días desde su última actualización; también puede borrarse desde el comprobante cuando ya no hay datos pendientes. No existe cifrado adicional de aplicación en esa copia. Evita perfiles de navegador compartidos; borrar una copia local no borra la entrega del servidor.

## Operación

No guardes secretos en `config.js`, no compartas tokens y no subas informes de estudiantes al repositorio público. Mantén la hoja y la carpeta privadas. El uso de Pages en un origen compartido con otros proyectos implica confiar también en los scripts ejecutados bajo ese origen; una instalación institucional puede preferir un dominio dedicado.

No hay protección especializada contra denegación de servicio, administración de dispositivos, bloqueo de otras aplicaciones, supervisión de terceros monitores ni garantía de recepción durante desconexión. Si se requiere mayor disponibilidad o integridad, migra la capa de datos y control a una infraestructura dimensionada y auditada.
