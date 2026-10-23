/* Keep the local pilot intact until the backend URL has been configured. */
'use strict';
const configured=Boolean(window.EXAMIA_CONFIG?.apiUrl);
const app=document.createElement('script');
app.src=configured?'cloud-app.js?v=0.3.0':'app-v021.js?v=0.2.1';
app.onerror=()=>{document.getElementById('view').textContent='No se pudo cargar ExamIA. Recargue la página.';};
if(!configured){const note=document.createElement('div');note.className='notice';note.innerHTML='<b>Backend disponible para instalar.</b> Esta vista sigue siendo el piloto local. <a href="https://github.com/ulewis/ExamIA/blob/main/docs/INSTALACION.md" target="_blank" rel="noopener">Configurar Google Apps Script</a>';document.querySelector('main').prepend(note);}
document.head.append(app);
