/* ExamIA 0.3 · shared exam workspace. Camera inference stays on this device. */
'use strict';
(() => {
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=()=>crypto.randomUUID(),time=t=>new Date(t).toLocaleString('es-PE');
const duration=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const settings={camera:true,images:true,screen:false,ai:true,tabs:true,clipboard:true,blockPaste:false,fullscreen:false,interval:30};
const S={user:null,exams:[],exam:null,a:null,active:false,finishing:false,events:[],images:[],sentEvents:{},seq:0,timers:[],urls:[],camera:null,screen:null,detector:null,aiReady:false,aiLoading:false,faceSince:0,faceKind:null,faceLogged:false,aiLastFrame:0,lastVideo:-1,away:null,job:null,db:null,review:null};
let api,aborter,localSaveTimer,clock={now:0,mono:0},toastTimer;
function say(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,7000);}
function fail(e){console.error(e);say(e.message||String(e));}
function clockSet(now){clock={now,mono:performance.now()};}
function now(){return clock.now+(performance.now()-clock.mono);}
function view(html){$('media-home').append($('media-dock'));$('media-dock').hidden=true;S.urls.forEach(URL.revokeObjectURL);S.urls=[];$('view').innerHTML=html;}
function mediaAt(host){$(host).append($('media-dock'));$('media-dock').hidden=false;}
function btn(action,label,value='',cls='secondary'){return `<button class="${cls}" data-cloud="${action}" data-id="${esc(value)}">${label}</button>`;}
const teacher=()=>S.user&&S.user.role!=='estudiante';
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('examia-cloud-queue-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('queue',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function local(mode,fn){return new Promise((resolve,reject)=>{const t=S.db.transaction('queue',mode),r=fn(t.objectStore('queue'));t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error);});}
async function keep(){if(!S.a)return;const data={id:S.a.id,student:S.user.email,apiUrl:api.url,attempt:S.a,events:S.events,images:S.images,sentEvents:S.sentEvents,seq:S.seq,updatedAt:Date.now()};await local('readwrite',o=>o.put(structuredClone(data)));}
function saveLocal(){clearTimeout(localSaveTimer);localSaveTimer=setTimeout(()=>keep().catch(fail),400);}
function stop(){S.active=false;aborter?.abort();S.timers.forEach(clearTimeout);S.timers=[];for(const k of ['camera','screen']){S[k]?.getTracks().forEach(t=>t.stop());S[k]=null;$(k+'-video').srcObject=null;}S.detector?.close();S.detector=null;S.aiReady=false;S.aiLoading=false;}
function nav(){ $('nav').hidden=false;$('nav').innerHTML=btn('home','Exámenes')+btn('attempts','Entregas y evidencias')+(S.user.role==='administrador'?btn('users','Usuarios y permisos'):'')+btn('logout','Salir')+`<span class="tag">${esc(S.user.email)} · ${esc(S.user.role)}</span>`;}
async function init(){
  try{api=new ExamIAClient(window.EXAMIA_CONFIG);S.db=await openDB();for(const q of await local('readonly',o=>o.getAll()))if(q.updatedAt<Date.now()-7*86400000)await local('readwrite',o=>o.delete(q.id));
    document.querySelector('header .tag').textContent='v0.3 · conexión institucional';
    $('storage-warning').innerHTML='<b>Modo conectado.</b> Identidad y permisos verificados en el servidor. Respuestas en Google Sheets; imágenes privadas en Drive. Antes de un examen oficial, complete las pruebas de aceptación de la instalación.';
    document.querySelector('.footer').textContent='Las alertas requieren revisión humana. Los plazos y las notas se calculan en el servidor; los eventos del navegador pueden ser manipulados y no prueban fraude.';
    if(api.token){const me=await api.call('me');S.user=me.user;clockSet(me.serverNow);nav();await home();}
    else login();
  }catch(e){login(e.message);}
}
function login(error=''){
  stop();$('nav').hidden=true;view(`<div class="grid"><section class="card"><span class="tag">PLATAFORMA DE EVALUACIÓN</span><h1>ExamIA UPCH</h1><p>Exámenes, supervisión automática y evidencias para una revisión docente con contexto.</p><p>Acceso exclusivo con una cuenta institucional UPCH.</p></section><section class="card"><h2>Iniciar sesión</h2>${error?`<div class="notice error">${esc(error)}</div>`:''}<p>Tu perfil es asignado por el administrador. No necesitas elegir un rol.</p>${btn('login','Continuar con Google UPCH','','')}<p class="muted">La contraseña se introduce únicamente en Google.</p></section></div>`);
}
async function home(){
  if(S.active||S.finishing||S.uploading)return say('Entregue el examen antes de salir.');stop();nav();
  S.exams=await api.call('exams');const queues=(await local('readonly',o=>o.getAll())).filter(q=>q.student===S.user.email&&q.apiUrl===api.url);
  view(`<div class="row between"><h1>Mis exámenes</h1>${teacher()?btn('new','Crear examen','',''):''}</div>
    ${queues.filter(q=>q.attempt.status==='running'||q.images.some(m=>!m.sent)).map(q=>`<div class="notice warning"><b>${esc(q.attempt.title)}</b><p>Hay un intento o evidencias pendientes en este equipo. No se confirma una entrega hasta recibir su comprobante del servidor.</p>${btn('recover','Revisar pendientes',q.id)}</div>`).join('')}
    <div class="grid">${S.exams.map(e=>`<article class="card"><span class="tag ${e.published?'ok':''}">${e.published?'Publicado':'Borrador'}</span><h2>${esc(e.title)}</h2><p>${esc(e.course)} · ${e.minutes} minutos · ${e.questions.length} preguntas</p><p>${e.settings.camera?'Cámara obligatoria'+(teacher()?' · IA automática':''):'Sin cámara'}${e.settings.screen?' · Compartir pantalla completa':''}</p><div class="row">${btn('prepare',teacher()?'Probar examen':'Rendir examen',e.id,'')}${teacher()&&(e.owner===S.user.email||S.user.role==='administrador')?btn('edit','Editar y configurar',e.id):''}</div></article>`).join('')||'<div class="card">No hay exámenes asignados a tu cuenta.</div>'}</div>`);
}
function editor(examId){
  S.exam=structuredClone(S.exams.find(e=>e.id===examId)||{id:id(),revision:0,title:'',course:'',minutes:30,published:false,resultsReleased:false,students:[],settings:{...settings},questions:[]});renderEditor();
}
function renderEditor(){const e=S.exam;
  const toggle=(key,label)=>`<label><input type="checkbox" data-setting="${key}" ${e.settings[key]?'checked':''}>${label}</label>`;
  view(`<h1>${e.revision?'Editar examen':'Nuevo examen'}</h1><div class="grid"><section class="card"><h2>Datos del examen</h2><label>Título<input data-exam="title" value="${esc(e.title)}"></label><label>Curso<input data-exam="course" value="${esc(e.course)}"></label><label>Duración (minutos)<input type="number" min="1" max="360" data-exam="minutes" value="${e.minutes}"></label><label>Estudiantes autorizados<textarea id="roster" placeholder="Un correo @upch.pe por línea">${esc(e.students.join('\n'))}</textarea><small>Solo estas cuentas podrán rendir. Un intento por estudiante y examen.</small></label><label><input type="checkbox" data-exam="published" ${e.published?'checked':''}>Publicar examen</label><label><input type="checkbox" data-exam="resultsReleased" ${e.resultsReleased?'checked':''}>Publicar las notas a los estudiantes</label></section>
  <section class="card"><h2>Supervisión</h2>${toggle('camera','Cámara obligatoria')}<div class="notice">Con cámara, la IA de presencia se inicia automáticamente y es obligatoria. Detecta ausencia o múltiples rostros; no identifica personas ni determina fraude.</div>${toggle('images','Guardar fotografías de cámara')}${toggle('screen','Exigir compartir una pantalla completa')}${toggle('tabs','Registrar foco y cambios de visibilidad')}${toggle('clipboard','Registrar copiar, cortar y pegar')}${toggle('blockPaste','Bloquear pegado en las respuestas')}${toggle('fullscreen','Exigir pantalla completa al inicio')}<label>Intervalo de capturas (segundos)<input type="number" min="15" max="120" data-setting="interval" value="${e.settings.interval}"></label><small>Máximo 120 JPEG por intento. Las imágenes vencen a los 7 días y el proceso diario las mueve a la papelera de Drive. No se graba audio.</small></section></div>
  <h2>Preguntas</h2>${e.questions.map((q,i)=>`<section class="card"><div class="row between"><b>Pregunta ${i+1}</b>${btn('remove-q','Eliminar',String(i),'secondary small')}</div><label>Enunciado<textarea data-q="${i}" data-field="text">${esc(q.text)}</textarea></label><div class="grid"><label>Tipo<select data-q="${i}" data-field="type">${[['choice','Opción múltiple'],['boolean','Verdadero / falso'],['text','Desarrollo']].map(([v,t])=>`<option value="${v}" ${q.type===v?'selected':''}>${t}</option>`).join('')}</select></label><label>Puntos<input type="number" min="0.1" step="0.1" data-q="${i}" data-field="points" value="${q.points}"></label></div>${q.type==='text'?'<small>Calificación manual del docente.</small>':q.options.map((o,j)=>`<label class="row"><input type="radio" name="key-${i}" data-q="${i}" data-correct="${j}" ${q.correct===j?'checked':''}><input style="width:85%" aria-label="Alternativa ${j+1}" data-q="${i}" data-option="${j}" value="${esc(o)}"></label>`).join('')}</section>`).join('')}
  <div class="toolbar">${btn('add-q','Añadir pregunta')}${btn('save-exam','Guardar en servidor','','')}${btn('home','Cancelar')}</div>`);
}
function readRoster(){if($('roster'))S.exam.students=$('roster').value.split(/[\s,;]+/).map(x=>x.trim().toLowerCase()).filter(Boolean);}
async function saveExam(){readRoster();const e=await api.call('saveExam',{exam:S.exam});S.exam=e;say('Examen guardado en el servidor.');await home();}
async function prepare(examId){
  stop();S.exam=(await api.call('prepare',{examId})).exam;S.a=null;S.finishing=false;S.faceKind=null;S.faceSince=0;S.faceLogged=false;
  const c=S.exam.settings;view(`<h1>${esc(S.exam.title)}</h1><div class="grid"><section class="card"><h2>Antes de comenzar</h2><p>${S.exam.minutes} minutos · Un intento.</p><div class="notice warning"><b>Aviso de supervisión</b><p>Se guardan tus respuestas y eventos técnicos. ${c.tabs?'Se registra la pérdida de foco o visibilidad. ':''}${c.clipboard?'Se registran las acciones copiar/cortar/pegar y la longitud del texto, no el portapapeles completo. ':''}${c.camera?'La cámara se analiza automáticamente en este dispositivo para detectar ausencia o múltiples rostros. ':''}${c.images&&c.camera?'Se guardan fotografías de cámara. ':''}${c.screen?'Se capturan imágenes del monitor que autorices; cierra datos privados y notificaciones. ':''}</p><p>El docente autorizado revisa las incidencias, sin penalización automática. Las respuestas se guardan en Google Sheets y las imágenes en Drive privado por 7 días; después se trasladan a la papelera. Hay una copia de recuperación en este navegador. No se graba audio ni se envían evidencias a GitHub.</p></div><label><input type="checkbox" id="consent">He leído el aviso y acepto la supervisión de esta evaluación.</label><div class="toolbar">${c.camera?btn('camera','Autorizar cámara','',''):''}${c.screen?btn('screen','Compartir pantalla','',''):''}</div><p id="monitor-state" role="status"></p>${btn('begin','Iniciar examen','','')}${btn('home','Cancelar')}</section><section class="card"><h2>Comprobación de dispositivos</h2><div id="prep-media"></div><p class="muted">La vista previa no guarda fotografías. El tiempo comienza cuando el servidor crea el intento; reanudarlo no reinicia el plazo.</p></section></div>`);mediaAt('prep-media');gate();
}
const live=k=>S[k]?.getVideoTracks().some(t=>t.readyState==='live'&&!t.muted);
function gate(){
  if(!S.exam)return;const c=S.exam.settings,missing=[];if(c.camera&&!live('camera'))missing.push('cámara');if(c.screen&&!live('screen'))missing.push('pantalla compartida');if(c.camera&&!S.aiReady)missing.push('supervisión automática');
  if($('monitor-state'))$('monitor-state').textContent=missing.length?'Pendiente: '+missing.join(', ')+'. La supervisión se prepara automáticamente.':'Supervisión lista.';
  if($('begin-btn'))$('begin-btn').disabled=!!missing.length||!$('consent')?.checked;
  const start=document.querySelector('[data-cloud="begin"]');if(start)start.disabled=!!missing.length||!$('consent')?.checked;
  if($('answer-area'))$('answer-area').disabled=!!missing.length||S.finishing;
  if($('exam-gate')){ $('exam-gate').hidden=!missing.length;$('exam-gate').textContent='Supervisión interrumpida: '+missing.join(', ')+'. Reconecta los dispositivos. Tus respuestas se conservan; el tiempo continúa.';}
}
async function enableMedia(kind){
  if(!S.active&&!$('consent')?.checked)return say('Lee y acepta primero el aviso.');
  const stream=kind==='camera'?await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false}):await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'monitor',frameRate:{max:5}},audio:false});
  if(kind==='screen'&&stream.getVideoTracks()[0].getSettings().displaySurface!=='monitor'){stream.getTracks().forEach(t=>t.stop());throw new Error('Selecciona una pantalla completa, no una ventana o pestaña.');}
  S[kind]?.getTracks().forEach(t=>t.stop());S[kind]=stream;$(kind+'-video').srcObject=stream;await $(kind+'-video').play();$(kind+'-state').textContent=kind==='camera'?'Cámara activa · sin audio':'Monitor autorizado';
  for(const event of ['ended','mute','unmute'])stream.getVideoTracks()[0].addEventListener(event,()=>{if(S[kind]!==stream)return;record(kind+'_'+event,'Señal de '+kind+': '+event,'attention');if(kind==='camera'){S.aiLastFrame=0;S.lastVideo=-1;S.faceKind=null;}gate();});
  if(kind==='camera')await loadAI();gate();
}
async function loadAI(){
  if(!live('camera')||S.aiLoading||S.detector)return;S.aiLoading=true;S.aiReady=false;gate();
  const stream=S.camera;let candidate,timeout;
  const job=(async()=>{const base='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';const {FaceDetector,FilesetResolver}=await import(base+'/vision_bundle.mjs');return FaceDetector.createFromOptions(await FilesetResolver.forVisionTasks(base+'/wasm'),{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',delegate:'CPU'},runningMode:'VIDEO',minDetectionConfidence:.65});})();
  let expired=false;
  try{candidate=await Promise.race([job,new Promise((_,reject)=>{timeout=setTimeout(()=>{expired=true;reject(new Error('El modelo no pudo cargar. Se reintentará automáticamente.'));},30000);})]);
    if(S.camera!==stream){candidate.close();return;}const out=candidate.detectForVideo($('camera-video'),performance.now());if(!Array.isArray(out?.detections))throw new Error('Modelo sin resultado válido.');
    S.detector=candidate;candidate=null;S.aiReady=true;S.aiLastFrame=performance.now();S.lastVideo=$('camera-video').currentTime;
  }catch(e){candidate?.close();say(e.message);const timer=setTimeout(()=>{if(S.camera===stream)loadAI();},8000);S.timers.push(timer);}
  finally{clearTimeout(timeout);S.aiLoading=false;gate();if(expired)job.then(d=>d.close()).catch(()=>{});}
}
async function begin(){
  const c=S.exam.settings;if(!$('consent')?.checked||c.camera&&(!live('camera')||!S.aiReady)||c.screen&&!live('screen'))throw new Error('Completa los requisitos de supervisión.');
  if(c.fullscreen)await document.documentElement.requestFullscreen();
  const a=await api.call('start',{examId:S.exam.id,revision:S.exam.revision,consent:true});clockSet(a.serverNow);
  if(a.status!=='running'){stop();S.a=a;return receipt(a);}
  S.a=a;S.exam=a.exam;S.seq=(a.lastSeq||0)+1;S.events=[];S.images=[];S.sentEvents={};
  const queued=await local('readonly',o=>o.get(a.id));if(queued&&queued.student===S.user.email&&queued.apiUrl===api.url){S.a.answers=queued.attempt.answers;S.events=queued.events||[];S.images=queued.images||[];S.sentEvents=queued.sentEvents||{};S.seq=Math.max(S.seq,queued.seq||0);}
  S.active=true;S.finishing=false;S.preDeadline=false;S.limitNoted=false;S.away=null;renderExam();attach();record('start','Intento iniciado o reanudado','info','La hora límite fue asignada por el servidor.');if(c.camera)record('ai_started','Supervisión automática iniciada');
  S.timers.push(setInterval(tick,1000),setInterval(faceTick,1000),setInterval(()=>capture(record('snapshot','Captura periódica','info','Muestreo, no grabación continua.',false)),c.interval*1000));
  scheduleSync();await keep();tick();
}
function renderExam(){
  $('nav').hidden=true;const a=S.a;view(`<div class="row between"><h1>${esc(a.title)}</h1><span class="tag">${esc(a.id.slice(0,8))}</span></div><div class="exam-layout"><section><div id="exam-gate" class="notice error" hidden></div><fieldset id="answer-area">${a.exam.questions.map((q,i)=>`<article class="card" data-question="${q.id}"><span class="tag">Pregunta ${i+1} · ${q.points} puntos</span><h2>${esc(q.text)}</h2>${q.type==='text'?`<textarea maxlength="8000" data-answer="${q.id}">${esc(a.answers[q.id]||'')}</textarea>`:q.options.map((o,j)=>`<label class="option"><input type="radio" name="a-${q.id}" data-answer="${q.id}" value="${j}" ${a.answers[q.id]===j?'checked':''}>${esc(o)}</label>`).join('')}</article>`).join('')}</fieldset>${btn('finish','Entregar examen','','')}</section><aside class="sidebar card"><p>Tiempo restante</p><div id="clock" class="clock"></div><p id="sync-state">Guardado pendiente de confirmar.</p><div id="exam-media"></div><p id="monitor-state"></p><div class="toolbar">${a.exam.settings.camera?btn('camera','Reconectar cámara','','small secondary'):''}${a.exam.settings.screen?btn('screen','Reconectar pantalla','','small secondary'):''}${btn('sync','Guardar ahora','','small secondary')}</div></aside></div>`);mediaAt('exam-media');gate();
}
function record(type,label,level='info',detail='',photo=true){
  if(!S.active||S.events.length>=2500)return null;const e={id:id(),type,label,level,detail,at:Date.now(),question:S.currentQ||null};S.events.push(e);saveLocal();if(photo)capture(e);return e;
}
function attach(){
  aborter=new AbortController();const opt={signal:aborter.signal},area=$('answer-area');
  area.addEventListener('focusin',e=>{const q=e.target.closest('[data-question]')?.dataset.question;S.currentQ=S.exam.questions.findIndex(x=>x.id===q)+1||null;},opt);
  if(S.exam.settings.tabs){const focus=()=>{const away=document.hidden||!document.hasFocus();if(away&&!S.away){const e=record('outside','Examen fuera de foco','attention','No se conoce la URL ni la aplicación de destino.');S.away={e,at:performance.now()};}else if(!away&&S.away){S.away.e.durationMs=Math.round(performance.now()-S.away.at);S.away=null;record('returned','Regreso al examen');}};document.addEventListener('visibilitychange',focus,opt);window.addEventListener('blur',focus,opt);window.addEventListener('focus',focus,opt);}
  for(const action of ['copy','cut','paste'])area.addEventListener(action,e=>{const c=S.exam.settings;if(!c.clipboard&&!c.blockPaste)return;if(action==='paste'&&c.blockPaste)e.preventDefault();const ev=record(action,{copy:'Acción copiar',cut:'Acción cortar',paste:c.blockPaste?'Pegado bloqueado':'Acción pegar'}[action],'attention','Evento dentro del examen; no se conoce el origen o destino del texto.');if(ev)ev.characters=action==='paste'?(e.clipboardData?.getData('text/plain')||'').length:typeof e.target.selectionStart==='number'?Math.abs(e.target.selectionEnd-e.target.selectionStart):(window.getSelection()?.toString()||'').length;},opt);
  area.addEventListener('drop',e=>{if(S.exam.settings.blockPaste)e.preventDefault();record('drop','Contenido arrastrado','attention');},opt);
  document.addEventListener('fullscreenchange',()=>record(document.fullscreenElement?'fullscreen_in':'fullscreen_out',document.fullscreenElement?'Pantalla completa activada':'Salida de pantalla completa','attention'),opt);
  for(const name of ['online','offline'])window.addEventListener(name,()=>record(name,name==='online'?'Conexión recuperada':'Sin conexión a Internet',name==='online'?'info':'attention'),opt);
  window.addEventListener('beforeunload',e=>{if(S.active){keep().catch(()=>{});e.preventDefault();e.returnValue='';}},opt);
}
async function jpeg(video,width){
  if(video.readyState<2||!video.videoWidth)throw new Error('No hay fotograma.');const canvas=document.createElement('canvas');
  for(let i=0;i<3;i++){const scale=Math.min(1,width/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.65));if(blob&&blob.size<=184320)return blob;width=Math.round(width*.7);}throw new Error('Captura demasiado grande.');
}
async function capture(event){
  if(!event||!S.active||S.capturing)return;if(S.images.length>=120){if(!S.limitNoted){S.limitNoted=true;record('capture_limit','Límite de imágenes alcanzado','attention','No se capturarán más fotos en este intento.',false);say('Se alcanzó el límite de imágenes; las respuestas y los eventos continúan.');}return;}S.capturing=true;
  try{for(const kind of ['camera','screen']){const c=S.exam.settings;if(kind==='camera'&&!(c.camera&&c.images)||kind==='screen'&&!c.screen||S.images.length>=120)continue;
    try{const blob=await jpeg($(kind+'-video'),kind==='camera'?640:1280);S.images.push({id:id(),eventId:event.id,kind,at:Date.now(),blob,sent:false});}catch(e){event.detail=(event.detail+' Sin imagen de '+kind+': '+e.message).slice(0,600);}}
    await keep();
  }finally{S.capturing=false;}
}
function faceTick(){
  if(!S.active||!S.exam.settings.camera)return;if(!live('camera')){gate();return;}
  if(!S.detector){loadAI();gate();return;}
  try{const v=$('camera-video');if(v.currentTime===S.lastVideo){if(S.aiLastFrame&&performance.now()-S.aiLastFrame>6000){S.aiReady=false;gate();}return;}S.lastVideo=v.currentTime;
    const out=S.detector.detectForVideo(v,performance.now());if(!Array.isArray(out?.detections))throw new Error('Resultado de detección inválido.');S.aiLastFrame=performance.now();S.aiReady=true;gate();
    const count=out.detections.length,kind=count===0?'no_face':count>1?'multiple_faces':'ok';if(kind!==S.faceKind){S.faceKind=kind;S.faceSince=performance.now();S.faceLogged=false;}
    if(kind!=='ok'&&!S.faceLogged&&performance.now()-S.faceSince>5000){S.faceLogged=true;record(kind,kind==='no_face'?'Rostro no detectado de forma persistente':'Múltiples rostros detectados','attention','Señal automática para revisión humana; no es prueba de fraude.');}
  }catch(e){S.detector?.close();S.detector=null;S.aiReady=false;record('ai_error','Supervisión automática interrumpida','attention','Incidencia técnica.');gate();loadAI();}
}
function scheduleSync(){S.timers.push(setTimeout(async()=>{if(!S.active)return;try{await sync();}catch(e){if($('sync-state'))$('sync-state').textContent='Sin confirmación del servidor. Reintentando; no cierre la pestaña.';}scheduleSync();},12000+Math.random()*6000));}
async function imageData(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});}
async function pushImage(m){await api.call('upload',{attemptId:S.a.id,id:m.id,eventId:m.eventId,kind:m.kind,at:m.at,data:await imageData(m.blob)});m.sent=true;}
function packet(){const pending=S.events.filter(e=>S.sentEvents[e.id]!==JSON.stringify(e)).slice(0,30);return {payload:{attemptId:S.a.id,seq:++S.seq,answers:structuredClone(S.a.answers),events:structuredClone(pending)},pending};}
async function sync(withImages=true){
  if(!S.a)return;if(S.job)return S.job;
  S.job=(async()=>{const {payload,pending}=packet();const result=await api.call('sync',payload);clockSet(result.serverNow);for(const e of payload.events)S.sentEvents[e.id]=JSON.stringify(e);
    if($('sync-state'))$('sync-state').textContent=result.lateAnswersRejected?'Plazo vencido: solo cuentan las respuestas que llegaron a tiempo.':'Respuestas recibidas por el servidor: '+time(result.lastSavedAt||result.serverNow);
    if(withImages){const m=S.images.find(m=>!m.sent);if(m)await pushImage(m);}await keep();return result;
  })();try{return await S.job;}finally{S.job=null;}
}
function tick(){
  if(!S.active)return;const remaining=S.a.deadlineAt-now();if($('clock'))$('clock').textContent=duration(remaining);
  if(remaining<7000&&remaining>0&&!S.preDeadline){S.preDeadline=true;sync(false).catch(()=>{});}
  if(remaining<=0&&!S.finishing)finish(true).catch(fail);
}
async function finish(auto=false){
  if(S.finishing)return;if(!auto&&!confirm('¿Entregar el examen? Ya no podrás modificar las respuestas.'))return;
  S.finishing=true;record('submit','Solicitud de entrega','info','La entrega se confirma únicamente con el comprobante del servidor.');
  // Stop further interaction and camera immediately; captured data remain in the local queue.
  stop();if($('answer-area'))$('answer-area').disabled=true;await keep();
  try{if(S.job)await S.job.catch(()=>{});const {payload,pending}=packet();const result=await api.call('submit',payload);for(const e of payload.events)S.sentEvents[e.id]=JSON.stringify(e);S.a={...S.a,...result};await keep();S.finishing=false;await receipt(result);try{await sendPending();}catch(e){say('Entrega confirmada; quedan evidencias pendientes: '+e.message);}}
  catch(e){S.finishing=false;view(`<section class="card"><h1>Entrega sin confirmar</h1><div class="notice error">${esc(e.message)}</div><p>No cierres esta pestaña. La copia local está conservada; al reconectar el servidor aplicará el plazo original. Una copia local no equivale a una entrega recibida.</p>${btn('retry-submit','Reintentar entrega','','')}</section>`);throw e;}
}
async function receipt(a){
  nav();view(`<section class="card"><span class="tag ok">${a.receipt?'Recepción confirmada':'Intento cerrado'}</span><h1>${esc(a.title)}</h1><p>Estado: ${esc(a.status==='expired'?'Plazo vencido':a.status==='submitted'?'Entregado':a.status)}</p><p>Comprobante: <b>${esc(a.receipt||'No disponible')}</b></p>${a.status==='expired'?'<div class="notice warning">Solo se califican respuestas recibidas por el servidor antes del vencimiento.</div>':''}${a.score?`<p>Puntaje: ${a.score.total}/${a.score.max} · ${a.score.pending} preguntas pendientes de revisión.</p>`:'<p>El docente aún no ha publicado la nota.</p>'}<p id="pending-state"></p>${btn('send-pending','Enviar evidencias pendientes')}${btn('home','Volver a exámenes')}${btn('clear-local','Borrar copia local')}</section>`);
  pendingState();
}
function pendingState(){if($('pending-state'))$('pending-state').textContent=`Imágenes pendientes en este equipo: ${S.images.filter(m=>!m.sent).length}. Se admiten hasta 10 minutos después del plazo. No cierres la página con imágenes pendientes.`;}
async function sendPending(){
  if(!S.a||S.uploading)return;S.uploading=true;try{for(let i=0;i<85;i++){const dirty=S.events.some(e=>S.sentEvents[e.id]!==JSON.stringify(e));if(!dirty)break;await sync(false);}
  for(const m of S.images.filter(m=>!m.sent)){await pushImage(m);await keep();pendingState();}say('No quedan imágenes pendientes de envío.');}finally{S.uploading=false;}
}
async function recover(queueId){
  const q=await local('readonly',o=>o.get(queueId));if(!q||q.student!==S.user.email||q.apiUrl!==api.url)throw new Error('No hay copia para esta cuenta.');
  S.a=q.attempt;S.events=q.events||[];S.images=q.images||[];S.sentEvents=q.sentEvents||{};S.seq=q.seq||0;
  const attempts=await api.call('attempts'),server=attempts.find(a=>a.id===queueId);if(server?.status==='running')return prepare(q.attempt.examId);
  if(server)S.a={...S.a,...server};return receipt(S.a);
}
async function attempts(){
  if(S.active)return;const items=await api.call('attempts');view(`<h1>Entregas y evidencias</h1>${items.map(a=>`<section class="card"><div class="row between"><h2>${esc(a.title)}</h2><span class="tag">${esc(a.status)}</span></div><p>${esc(a.student)}${a.preview?' · Vista previa docente':''}</p><p>${time(a.startedAt)} · ${a.eventCount||0} eventos · ${a.imageCount||0} imágenes registradas</p>${a.score?`<p>${a.score.total}/${a.score.max} puntos · ${a.score.pending} abiertas pendientes</p>`:''}${teacher()?btn('review','Revisar',a.id,''):''}<p class="muted">${a.receipt?'Comprobante: '+esc(a.receipt):'Sin comprobante de entrega'}</p></section>`).join('')||'<p>Sin entregas.</p>'}`);
}
async function review(attemptId){
  S.review=await api.call('review',{attemptId});const a=S.review;view(`<div class="row between"><h1>Revisión del intento</h1>${btn('attempts','Volver')}</div><section class="card"><h2>${esc(a.title)}</h2><p>${esc(a.student)} · ${time(a.startedAt)}</p><p>Estado: ${esc(a.status)} · Comprobante: ${esc(a.receipt||'Pendiente')}</p><div class="metrics"><div class="metric"><b>${a.events.length}</b><span>Eventos recibidos</span></div><div class="metric"><b>${a.media.length}</b><span>Imágenes disponibles</span></div><div class="metric"><b>${a.score?.total??'—'}</b><span>Puntos</span></div><div class="metric"><b>${a.score?.pending??'—'}</b><span>Abiertas pendientes</span></div></div><div class="notice">Las horas de los eventos son reportadas por el dispositivo; «recibido» es la hora del servidor. Las imágenes y los eventos no demuestran por sí solos fraude.</div><div class="toolbar">${btn('export-html','Informe HTML con fotos')}${btn('export-csv','Incidencias CSV')}${btn('export-json','Informe JSON (sin fotos)')}</div></section>
  <h2>Respuestas y calificación</h2>${a.exam.questions.map((q,i)=>`<section class="card"><h3>${i+1}. ${esc(q.text)}</h3><div class="answer">${esc(q.type==='text'?(a.answers[q.id]??'Sin respuesta'):(q.options[a.answers[q.id]]??'Sin respuesta'))}</div>${q.type==='text'?`<label>Puntos (0–${q.points})<input type="number" min="0" max="${q.points}" step="0.1" data-mark="${q.id}" value="${a.manual?.[q.id]??''}"></label>`:`<p>Respuesta correcta: ${esc(q.options[q.correct])} · ${a.answers[q.id]===q.correct?q.points:0}/${q.points}</p>`}</section>`).join('')}
  <section class="card"><label>Estado de revisión<select id="review-state">${['Pendiente','Justificada','Requiere revisión'].map(x=>`<option ${a.review?.state===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Observaciones<textarea id="review-note">${esc(a.review?.note||'')}</textarea></label>${a.status==='running'?'<p>El estudiante todavía no ha entregado.</p>':btn('grade','Guardar revisión','','')}</section><div class="row between"><h2>Historial de incidencias</h2><select id="event-filter" style="width:auto"><option value="all">Todos</option><option value="attention">Por revisar</option><option value="clipboard">Copiar / pegar</option><option value="images">Con imágenes</option><option value="ai">IA</option></select></div>
  <div class="timeline">${a.events.map(e=>`<article class="event ${e.level==='attention'?'attention':''}" data-event="${e.id}" data-type="${esc(e.type)}" data-level="${e.level}"><b>${esc(e.label)}</b><p><time>${time(e.at)} · Recibido: ${time(e.receivedAt)}</time>${e.question?' · Pregunta '+e.question:''}</p><p>${esc(e.detail)}${e.characters!==undefined?' · '+e.characters+' caracteres':''}${e.durationMs!==undefined?' · Duración '+duration(e.durationMs):''}</p><div class="thumbs">${a.media.filter(m=>m.eventId===e.id).map(m=>btn('image',(m.kind==='camera'?'Cámara':'Pantalla')+' · '+time(m.at),m.id,'secondary small')).join('')}</div></article>`).join('')}</div>`);
}
async function grade(){const manual={};for(const input of document.querySelectorAll('[data-mark]'))if(input.value.trim())manual[input.dataset.mark]=Number(input.value);await api.call('grade',{attemptId:S.review.id,manual,state:$('review-state').value,note:$('review-note').value});say('Calificación y revisión guardadas.');await review(S.review.id);}
async function showImage(imageId){const m=await api.call('image',{attemptId:S.review.id,id:imageId});const bytes=Uint8Array.from(atob(m.data),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));S.urls.push(url);$('large-image').src=url;$('image-download').href=url;$('image-download').download='ExamIA-'+imageId+'.jpg';$('image-title').textContent=m.kind==='camera'?'Evidencia de cámara':'Monitor autorizado';$('image-dialog').showModal();}
function download(name,body,type){const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function exportHTML(){
  const a=structuredClone(S.review),photos=new Map();let missing=0;
  for(const m of a.media){try{const image=await api.call('image',{attemptId:a.id,id:m.id});photos.set(m.id,'data:image/jpeg;base64,'+image.data);}catch{missing++;}}
  const blocks=a.events.map(e=>`<article><h3>${esc(e.label)}</h3><p>${esc(time(e.at))} · Recibido: ${esc(time(e.receivedAt))}</p><p>${esc(e.detail)}</p>${a.media.filter(m=>m.eventId===e.id).map(m=>photos.has(m.id)?`<figure><img src="${photos.get(m.id)}" alt="${esc(m.kind)}"><figcaption>${esc(m.kind)} · ${esc(time(m.at))}</figcaption></figure>`:'<p>Imagen no disponible.</p>').join('')}</article>`).join('');
  const html=`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>ExamIA · Informe</title><style>body{font:16px/1.6 system-ui;max-width:1050px;margin:30px auto;padding:20px}article,section{border:1px solid #ccd5df;padding:20px;margin:18px 0;break-inside:avoid}figure{display:inline-block;max-width:43%;vertical-align:top}img{width:100%}pre{white-space:pre-wrap}</style><h1>ExamIA · Informe de evaluación</h1><p>${esc(a.title)} · ${esc(a.student)}</p><p>Comprobante: ${esc(a.receipt||'Sin entrega')} · Estado: ${esc(a.status)}</p><p>Datos confidenciales: no publicar. Las señales no prueban fraude. Los eventos son reportados por el dispositivo; la hora de recepción y la calificación provienen del servidor. ${missing} imagen(es) no disponibles.</p><h2>Respuestas</h2>${a.exam.questions.map((q,i)=>`<section><b>${i+1}. ${esc(q.text)}</b><pre>${esc(q.type==='text'?(a.answers[q.id]??'Sin respuesta'):(q.options[a.answers[q.id]]??'Sin respuesta'))}</pre></section>`).join('')}<h2>Revisión</h2><p>${esc(a.review?.state)} · ${esc(a.review?.note)}</p><p>Puntos: ${a.score?.total??'—'}/${a.score?.max??'—'}</p><h2>Historial e imágenes</h2>${blocks}</html>`;
  download('ExamIA-'+a.id+'-informe.html',html,'text/html;charset=utf-8');
}
function exportReview(format){const a=S.review;if(format==='json')return download('ExamIA-'+a.id+'.json',JSON.stringify(a,null,2),'application/json');const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';const rows=[['Evento','Hora dispositivo','Recibido servidor','Pregunta','Duración ms','Caracteres','Detalle'],...a.events.map(e=>[e.label,time(e.at),time(e.receivedAt),e.question,e.durationMs,e.characters,e.detail])];download('ExamIA-'+a.id+'.csv','\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8');}
async function users(){const items=await api.call('users');view(`<h1>Usuarios y permisos</h1><section class="card"><h2>Autorizar o actualizar una cuenta</h2><label>Correo institucional<input id="user-email" type="email" placeholder="usuario@upch.pe"></label><label>Rol<select id="user-role"><option value="estudiante">Estudiante</option><option value="docente">Docente</option><option value="administrador">Administrador</option></select></label><label><input id="user-active" type="checkbox" checked>Cuenta habilitada</label>${btn('set-user','Guardar permiso','','')}<p class="muted">Una cuenta nueva ingresa como estudiante. Los cambios revocan sus sesiones anteriores.</p></section>${items.map(u=>`<section class="card"><b>${esc(u.email)}</b><p>${esc(u.role)} · ${u.active?'Habilitada':'Deshabilitada'}</p></section>`).join('')}`);}
// Input updates are held in memory and recovery storage. Server policy is authoritative.
document.addEventListener('input',e=>{const t=e.target;if(t.dataset.exam)S.exam[t.dataset.exam]=t.type==='checkbox'?t.checked:t.dataset.exam==='minutes'?Number(t.value):t.value;
  if(t.dataset.setting){S.exam.settings[t.dataset.setting]=t.type==='checkbox'?t.checked:Number(t.value);S.exam.settings.ai=!!S.exam.settings.camera;}
  if(t.dataset.q!==undefined){const q=S.exam.questions[+t.dataset.q];if(t.dataset.field&&t.dataset.field!=='type')q[t.dataset.field]=t.dataset.field==='points'?Number(t.value):t.value;if(t.dataset.option!==undefined)q.options[+t.dataset.option]=t.value;if(t.dataset.correct!==undefined)q.correct=+t.dataset.correct;}
  if(t.dataset.answer&&S.active){S.a.answers[t.dataset.answer]=t.type==='radio'?Number(t.value):t.value;saveLocal();}
});
document.addEventListener('change',e=>{const t=e.target;if(t.id==='consent'){if(!t.checked){stop();mediaAt('prep-media');}gate();}
  if(t.dataset.field==='type'){readRoster();const q=S.exam.questions[+t.dataset.q];q.type=t.value;q.options=t.value==='text'?[]:t.value==='boolean'?['Verdadero','Falso']:['','','',''];q.correct=0;renderEditor();}
  if(t.id==='event-filter')for(const el of document.querySelectorAll('[data-event]')){const type=el.dataset.type,v=t.value;el.hidden=!(v==='all'||v==='attention'&&el.dataset.level==='attention'||v==='clipboard'&&['copy','cut','paste','drop'].includes(type)||v==='images'&&!!el.querySelector('[data-cloud="image"]')||v==='ai'&&['ai_started','ai_error','no_face','multiple_faces'].includes(type));}
});
document.addEventListener('click',async event=>{
  if(event.target.closest('[data-act="close-image"]'))return $('image-dialog').close();
  const b=event.target.closest('[data-cloud]');if(!b||b.disabled)return;const action=b.dataset.cloud,value=b.dataset.id;if(S.uploading&&['home','prepare','logout','recover','new','edit','attempts'].includes(action))return say('Se están enviando evidencias. No cierre la página.');b.disabled=true;
  try{
    if(action==='login')api.signIn();else if(action==='home')await home();else if(action==='logout'){if(S.active||S.finishing||S.uploading)throw new Error('Entregue antes de salir.');try{await api.signOut();}finally{S.user=null;S.review=null;S.exams=[];login();}}
    else if(action==='new'||action==='edit')editor(value);else if(action==='add-q'){readRoster();S.exam.questions.push({id:id(),type:'choice',text:'',options:['','','',''],correct:0,points:1});renderEditor();}
    else if(action==='remove-q'){readRoster();S.exam.questions.splice(+value,1);renderEditor();}else if(action==='save-exam')await saveExam();else if(action==='prepare')await prepare(value);
    else if(action==='camera'||action==='screen')await enableMedia(action);else if(action==='begin')await begin();else if(action==='sync')await sync();else if(action==='finish'||action==='retry-submit')await finish(action==='retry-submit');
    else if(action==='attempts')await attempts();else if(action==='review')await review(value);else if(action==='grade')await grade();else if(action==='image')await showImage(value);
    else if(action==='export-csv'||action==='export-json')exportReview(action.slice(7));else if(action==='export-html')await exportHTML();else if(action==='recover')await recover(value);else if(action==='send-pending')await sendPending();
    else if(action==='clear-local'){if(S.images.some(m=>!m.sent)||S.events.some(e=>S.sentEvents[e.id]!==JSON.stringify(e)))throw new Error('Hay evidencias o eventos pendientes; envíelos antes de borrar.');if(confirm('¿Borrar la copia de recuperación de este equipo? El servidor conserva la entrega.')){await local('readwrite',o=>o.delete(S.a.id));await home();}}
    else if(action==='users')await users();else if(action==='set-user'){await api.call('setUser',{email:$('user-email').value,role:$('user-role').value,active:$('user-active').checked});await users();}
  }catch(e){fail(e);}finally{b.disabled=false;gate();}
});
init();
})();
