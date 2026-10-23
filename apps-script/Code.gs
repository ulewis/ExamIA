/**
 * ExamIA UPCH · backend 0.3.0 · Google Apps Script (V8)
 * Setup: execute setupExamIA_ from the editor, never from a web client.
 * All helpers end in '_' so google.script.run cannot call them.
 * No student images, answer keys, or OAuth secrets belong in GitHub.
 */
const EXAMIA_ = {version:'0.3.0', domain:'upch.pe', sessionHours:8,
  maxEvents:2500, maxImages:120, imageBytes:184320, retentionDays:7,
  tables:['Users','Exams','Versions','Attempts','Answers','Events','Evidence','Audit']};
let dbMemo_;

function setupExamIA_() {
  const p=PropertiesService.getScriptProperties();
  const owner=Session.getEffectiveUser().getEmail().toLowerCase();
  assert_(owner.endsWith('@'+EXAMIA_.domain),'Use su cuenta institucional @upch.pe.');
  if(!p.getProperty('APP_URL')) p.setProperty('APP_URL','https://ulewis.github.io/ExamIA/');
  if(!p.getProperty('SESSION_SECRET')) p.setProperty('SESSION_SECRET',random_()+random_());
  if(!p.getProperty('DB_ID')) {
    const ss=SpreadsheetApp.create('ExamIA UPCH · Base de datos');
    p.setProperty('DB_ID',ss.getId());
    EXAMIA_.tables.forEach((n,i)=>{
      const sh=i===0?ss.getSheets()[0].setName(n):ss.insertSheet(n);
      sh.getRange(1,1,1,2).setValues([['id','json']]); sh.setFrozenRows(1);
    });
  }
  if(!p.getProperty('EVIDENCE_FOLDER_ID')) {
    const folder=DriveApp.createFolder('ExamIA UPCH · Evidencias privadas');
    folder.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.VIEW);
    p.setProperty('EVIDENCE_FOLDER_ID',folder.getId());
  }
  lock_(()=>{if(!read_('Users',owner)) write_('Users',owner,{email:owner,sub:null,
    name:owner,role:'administrador',active:true,revision:1});});
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='purgeEvidence_'))
    ScriptApp.newTrigger('purgeEvidence_').timeBased().everyDays(1).atHour(3).create();
  console.log('Configuración creada. DB_ID y carpeta están en Propiedades del script.');
  console.log('Añada OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET y WEB_APP_URL antes de iniciar sesión.');
}
function config_(){
  const p=PropertiesService.getScriptProperties().getProperties();
  assert_(p.DB_ID&&p.SESSION_SECRET&&p.EVIDENCE_FOLDER_ID,'Ejecute setupExamIA_ primero.');
  assert_(/^https:\/\/[^?#]+\/$/.test(p.APP_URL||''),'APP_URL debe ser HTTPS, terminar en / y no incluir parámetros.');
  p.origin=p.APP_URL.match(/^https:\/\/[^/]+/)[0]; return p;
}
function oauthConfig_(){const c=config_();assert_(c.OAUTH_CLIENT_ID&&c.OAUTH_CLIENT_SECRET&&/^https:\/\/script.google.com\/macros\/s\/[^/]+\/exec$/.test(c.WEB_APP_URL||''),'Falta configurar OAuth o WEB_APP_URL.');return c;}
function assert_(ok,message){if(!ok)throw new Error(message);}
function random_(){return Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');}
function uuid_(v){assert_(typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),'Identificador inválido.');return v;}
function text_(v,max=2000){assert_(typeof v==='string'&&v.length<=max,'Texto inválido o demasiado largo.');return v;}
function number_(v,min,max){assert_(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,'Número fuera de rango.');return v;}
function clone_(v){return JSON.parse(JSON.stringify(v));}
function lock_(fn){const l=LockService.getScriptLock();assert_(l.tryLock(5000),'BUSY: reintente la operación.');try{return fn();}finally{l.releaseLock();}}
function sheet_(name){assert_(EXAMIA_.tables.includes(name),'Tabla no permitida.');if(!dbMemo_)dbMemo_=SpreadsheetApp.openById(config_().DB_ID);return dbMemo_.getSheetByName(name);}
function row_(sh,id){const n=sh.getLastRow();if(n<2)return null;return sh.getRange(2,1,n-1,1).createTextFinder(id).matchEntireCell(true).useRegularExpression(false).findNext();}
function read_(table,id){const sh=sheet_(table),r=row_(sh,id);return r?JSON.parse(sh.getRange(r.getRow(),2).getValue()):null;}
function write_(table,id,obj){const s=JSON.stringify(obj);assert_(s.length<=45000,'Registro demasiado grande.');const sh=sheet_(table),r=row_(sh,id);sh.getRange(r?r.getRow():sh.getLastRow()+1,1,1,2).setValues([[id,s]]);return obj;}
function list_(table){const sh=sheet_(table),n=sh.getLastRow();return n<2?[]:sh.getRange(2,2,n-1,1).getValues().filter(r=>r[0]).map(r=>JSON.parse(r[0]));}
function prefix_(table,prefix){const sh=sheet_(table),n=sh.getLastRow();if(n<2)return [];return sh.getRange(2,1,n-1,1).createTextFinder('^'+prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).useRegularExpression(true).findAll().map(r=>JSON.parse(sh.getRange(r.getRow(),2).getValue()));}
function audit_(actor,action,id){write_('Audit',Utilities.getUuid(),{actor:actor.email,action,id,at:Date.now()});}
function email_(v){const e=text_(v,200).trim().toLowerCase();assert_(/^[a-z0-9][a-z0-9._+-]*@upch\.pe$/.test(e),'Solo se admiten correos @upch.pe.');return e;}
function teacher_(u){assert_(['docente','administrador'].includes(u.role),'Solo docentes o administradores.');}
function owns_(u,e){assert_(e&&(u.role==='administrador'||e.owner===u.email),'No tiene permiso para este examen.');}
function assigned_(u,e){return u.role==='administrador'||e.owner===u.email||(e.published&&e.students.includes(u.email));}
function b64_(x){return Utilities.base64EncodeWebSafe(x).replace(/=+$/,'');}
function hash_(s){return b64_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8));}
function sign_(s){return b64_(Utilities.computeHmacSha256Signature(s,config_().SESSION_SECRET));}
function equal_(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
function session_(u){const body=b64_(JSON.stringify({email:u.email,sub:u.sub,revision:u.revision,exp:Date.now()+EXAMIA_.sessionHours*3600000,nonce:random_()}));return body+'.'+sign_(body);}
function auth_(token){
  assert_(typeof token==='string'&&token.length<3000,'AUTH: inicie sesión.');const parts=token.split('.');
  assert_(parts.length===2&&equal_(sign_(parts[0]),parts[1]),'AUTH: sesión inválida.');
  const data=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  assert_(Number.isFinite(data.exp)&&data.exp>Date.now(),'AUTH: sesión vencida.');
  const u=read_('Users',email_(data.email));
  assert_(u&&u.active&&u.sub===data.sub&&u.revision===data.revision,'AUTH: acceso revocado.');return u;
}
function escape_(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function page_(title,message,url,label){return HtmlService.createHtmlOutput('<!doctype html><html lang="es"><head><meta name="referrer" content="no-referrer"><base target="_top"><style>body{font:17px system-ui;max-width:660px;margin:10vh auto;padding:28px;color:#163244}a{display:inline-block;background:#176b66;color:white;padding:14px 20px;border-radius:8px;text-decoration:none}</style></head><body><h1>'+escape_(title)+'</h1><p>'+escape_(message)+'</p>'+(url?'<a rel="noreferrer" href="'+escape_(url)+'">'+escape_(label)+'</a>':'')+'</body></html>').setTitle(title);}
function login_(nonce){
  const c=oauthConfig_();assert_(/^[a-f0-9]{64}$/.test(nonce||''),'Solicitud de acceso inválida. Inicie desde ExamIA.');
  const state=random_(),verifier=random_();
  CacheService.getScriptCache().put('oauth:'+state,JSON.stringify({nonce,verifier}),600);
  const args={client_id:c.OAUTH_CLIENT_ID,redirect_uri:c.WEB_APP_URL,response_type:'code',scope:'openid email profile',state,
    code_challenge:hash_(verifier),code_challenge_method:'S256',hd:EXAMIA_.domain,prompt:'select_account',access_type:'online'};
  const url='https://accounts.google.com/o/oauth2/v2/auth?'+Object.keys(args).map(k=>k+'='+encodeURIComponent(args[k])).join('&');
  return page_('ExamIA · Acceso UPCH','Use su cuenta institucional. Google gestiona su contraseña; ExamIA no la recibe.',url,'Continuar con Google');
}
function callback_(code,state){
  const c=oauthConfig_();assert_(/^[a-f0-9]{64}$/.test(state||''),'Estado OAuth inválido.');
  const saved=lock_(()=>{const cache=CacheService.getScriptCache(),v=cache.get('oauth:'+state);cache.remove('oauth:'+state);return v;});
  assert_(saved,'Acceso vencido o ya utilizado. Vuelva a iniciar desde ExamIA.');const data=JSON.parse(saved);
  const r=UrlFetchApp.fetch('https://oauth2.googleapis.com/token',{method:'post',payload:{code:text_(code,3000),client_id:c.OAUTH_CLIENT_ID,client_secret:c.OAUTH_CLIENT_SECRET,redirect_uri:c.WEB_APP_URL,grant_type:'authorization_code',code_verifier:data.verifier},muteHttpExceptions:true});
  assert_(r.getResponseCode()===200,'No se pudo completar el acceso con Google.');const tokens=JSON.parse(r.getContentText());
  // Identity is retrieved directly from Google's authenticated HTTPS userinfo endpoint.
  // Never trust a decoded, unverified client JWT or a client-supplied email/role.
  const info=UrlFetchApp.fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokens.access_token},muteHttpExceptions:true});
  assert_(info.getResponseCode()===200,'Google no confirmó la identidad.');const g=JSON.parse(info.getContentText());
  assert_(g.email_verified===true&&g.hd===EXAMIA_.domain&&typeof g.sub==='string','Solo cuentas institucionales administradas por UPCH.');
  const email=email_(g.email);const user=lock_(()=>{
    let u=read_('Users',email)||{email,role:'estudiante',active:true,revision:1};
    assert_(u.active,'Cuenta deshabilitada.');assert_(!u.sub||u.sub===g.sub,'La identidad de esta cuenta cambió; consulte al administrador.');
    u.sub=g.sub;u.name=String(g.name||email).slice(0,200);write_('Users',email,u);return u;
  });
  const target=c.APP_URL+'#auth='+encodeURIComponent(session_(user))+'&nonce='+data.nonce;
  return page_('Identidad verificada','Regrese a ExamIA para continuar. Este enlace es personal; no lo comparta.',target,'Volver a ExamIA');
}
function doGet(e){
  try{const q=e&&e.parameter||{};
    if(q.code)return callback_(q.code,q.state);
    if(q.error)return page_('Acceso cancelado','Vuelva a ExamIA e inicie sesión nuevamente.');
    if(q.mode==='login')return login_(q.nonce);
    if(q.mode==='bridge'){
      const c=config_();assert_(/^[a-f0-9]{64}$/.test(q.nonce||''),'Canal inválido.');
      const t=HtmlService.createTemplateFromFile('Bridge');t.origin=JSON.stringify(c.origin);t.nonce=JSON.stringify(q.nonce);
      return t.evaluate().setTitle('ExamIA · Canal de datos').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    return page_('ExamIA API · '+EXAMIA_.version,'Servicio disponible. Abra la plataforma para iniciar sesión.',config_().APP_URL,'Abrir ExamIA');
  }catch(err){return page_('No se completó la solicitud',err.message);}
}
function doPost(e){
  let result;try{assert_(e&&e.postData&&e.postData.contents.length<=360000,'Solicitud demasiado grande.');result=rpc(JSON.parse(e.postData.contents));}
  catch(err){result={ok:false,error:err.message};}
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
/** The only remote callable business endpoint. Every route is authenticated. */
function rpc(request){
  try{
    assert_(request&&typeof request==='object'&&JSON.stringify(request).length<=360000,'Solicitud inválida.');
    const u=auth_(request.token),p=request.payload||{},action=request.action;
    const routes={
      me:()=>({user:{email:u.email,name:u.name,role:u.role},version:EXAMIA_.version,serverNow:Date.now()}),
      logout:()=>lock_(()=>{u.revision++;write_('Users',u.email,u);return true;}),
      users:()=>{assert_(u.role==='administrador','Solo administrador.');return list_('Users').map(({email,name,role,active})=>({email,name,role,active}));},
      setUser:()=>lock_(()=>setUser_(u,p)),
      exams:()=>list_('Exams').filter(e=>assigned_(u,e)).map(e=>publicExam_(e,u)),
      saveExam:()=>lock_(()=>saveExam_(u,p)),
      prepare:()=>prepare_(u,p),
      start:()=>lock_(()=>start_(u,p)),
      sync:()=>lock_(()=>sync_(u,p)),
      submit:()=>lock_(()=>submit_(u,p)),
      attempts:()=>attempts_(u),
      review:()=>review_(u,p),
      grade:()=>lock_(()=>manualGrade_(u,p)),
      upload:()=>upload_(u,p),
      image:()=>image_(u,p)
    };
    assert_(Object.prototype.hasOwnProperty.call(routes,action),'Operación no permitida.');
    return {ok:true,data:routes[action](),serverNow:Date.now()};
  }catch(err){return {ok:false,error:err.message||'Error del servidor',serverNow:Date.now()};}
}
function setUser_(actor,p){
  assert_(actor.role==='administrador','Solo administrador.');const email=email_(p.email);
  assert_(['administrador','docente','estudiante'].includes(p.role)&&typeof p.active==='boolean','Rol o estado inválido.');
  assert_(email!==actor.email||p.role==='administrador'&&p.active,'No puede quitarse su propio acceso de administrador.');
  const u=read_('Users',email)||{email,sub:null,name:email,revision:0};
  u.role=p.role;u.active=p.active;u.revision++;write_('Users',email,u);audit_(actor,'user.updated',email);return {email,role:u.role,active:u.active};
}
function publicExam_(e,u,alwaysRedact=false){const x=clone_(e);if(alwaysRedact||!(u.role==='administrador'||e.owner===u.email)){delete x.students;x.questions=x.questions.map(({correct,...q})=>q);}return x;}
function saveExam_(u,p){
  teacher_(u);const raw=p.exam;assert_(raw&&typeof raw==='object','Examen requerido.');
  const id=raw.id?uuid_(raw.id):Utilities.getUuid(),old=read_('Exams',id);
  if(old){owns_(u,old);assert_(raw.revision===old.revision,'El examen cambió. Recargue antes de editar.');}
  assert_(Array.isArray(raw.questions)&&raw.questions.length>=1&&raw.questions.length<=50,'Use de 1 a 50 preguntas.');
  const seen=new Set();const questions=raw.questions.map(q=>{
    const qid=uuid_(q.id);assert_(!seen.has(qid),'Preguntas duplicadas.');seen.add(qid);
    assert_(['text','choice','boolean'].includes(q.type),'Tipo de pregunta inválido.');
    const out={id:qid,type:q.type,text:text_(q.text,3000),points:number_(q.points,.1,100)};assert_(out.text.trim(),'Falta un enunciado.');
    out.options=q.type==='text'?[]:(assert_(Array.isArray(q.options)&&q.options.length>=2&&q.options.length<=8,'Alternativas inválidas.'),q.options.map(o=>text_(o,1000)));
    if(q.type!=='text'){assert_(Number.isInteger(q.correct)&&q.correct>=0&&q.correct<out.options.length&&out.options.every(o=>o.trim()),'Clave o alternativas inválidas.');out.correct=q.correct;}
    return out;
  });
  const s=raw.settings||{},settings={};for(const key of ['camera','images','screen','tabs','clipboard','blockPaste','fullscreen'])settings[key]=s[key]===true;
  settings.ai=settings.camera;settings.images=settings.camera&&settings.images;settings.interval=number_(s.interval||30,15,120);
  assert_(Array.isArray(raw.students)&&raw.students.length<=300,'Incluya la lista de estudiantes (máximo 300).');
  const students=[...new Set(raw.students.map(email_))];assert_(!raw.published||students.length>0,'Asigne estudiantes antes de publicar.');
  const e={id,owner:old?old.owner:u.email,title:text_(raw.title,200),course:text_(raw.course,200),minutes:number_(raw.minutes,1,360),published:raw.published===true,
    resultsReleased:raw.resultsReleased===true,students,settings,questions,revision:(old?old.revision:0)+1,updatedAt:Date.now()};
  assert_(e.title.trim()&&JSON.stringify(e).length<=30000,'Título vacío o examen demasiado grande (30 000 caracteres).');
  write_('Versions',id+':'+e.revision,e);write_('Exams',id,e);audit_(u,'exam.saved',id);return e;
}
function attempt_(u,id,teacherOnly=false){const a=read_('Attempts',uuid_(id));assert_(a,'Intento no encontrado.');
  const e=read_('Versions',a.versionKey);assert_(e,'No se encontró la versión del examen.');
  if(teacherOnly){teacher_(u);owns_(u,e);}else assert_(u.email===a.student||u.role==='administrador'||u.email===e.owner,'No tiene acceso al intento.');return {a,e};}
function safeAttempt_(u,a,e){
  const x=clone_(a),answers=read_('Answers',a.id)||{answers:{}};
  x.exam=publicExam_(e,u,true);x.answers=answers.answers;x.serverNow=Date.now();
  const current=read_('Exams',e.id);if(u.email===a.student&&!current?.resultsReleased){delete x.score;delete x.manual;delete x.review;}
  return x;
}
function prepare_(u,p){
  const e=read_('Exams',uuid_(p.examId));assert_(e&&assigned_(u,e),'Examen no disponible.');
  const a=list_('Attempts').find(a=>a.examId===e.id&&a.student===u.email);
  return {exam:publicExam_(a?read_('Versions',a.versionKey):e,u,true),priorStatus:a?.status||null};
}
function start_(u,p){
  const e=read_('Exams',uuid_(p.examId));assert_(e&&assigned_(u,e),'Examen no disponible para esta cuenta.');
  const prior=list_('Attempts').find(a=>a.examId===e.id&&a.student===u.email);
  if(prior){const version=read_('Versions',prior.versionKey);if(prior.status==='running'&&Date.now()>prior.deadlineAt)finalize_(prior,version,'expired');return safeAttempt_(u,prior,version);}
  assert_(p.consent===true,'Debe aceptar el aviso de supervisión.');assert_(p.revision===e.revision,'El examen cambió: vuelva a prepararlo antes de iniciar.');const now=Date.now();
  const a={id:Utilities.getUuid(),examId:e.id,versionKey:e.id+':'+e.revision,title:e.title,owner:e.owner,student:u.email,startedAt:now,deadlineAt:now+e.minutes*60000,
    status:'running',lastSeq:-1,eventCount:0,imageCount:0,consentAt:now,consentVersion:'0.3.0',manual:{},review:{state:'Pendiente',note:''},preview:u.email===e.owner||u.role==='administrador'};
  write_('Attempts',a.id,a);write_('Answers',a.id,{answers:{}});return safeAttempt_(u,a,e);
}
function answers_(input,e){
  assert_(input&&typeof input==='object'&&!Array.isArray(input)&&JSON.stringify(input).length<=28000,'Respuestas demasiado grandes (28 000 caracteres).');const out={};
  for(const q of e.questions){if(!Object.prototype.hasOwnProperty.call(input,q.id))continue;const v=input[q.id];
    if(q.type==='text')out[q.id]=text_(v,8000);else{assert_(Number.isInteger(v)&&v>=0&&v<q.options.length,'Alternativa inválida.');out[q.id]=v;}}
  return out;
}
function event_(raw){
  const out={id:uuid_(raw.id),type:text_(raw.type,60),label:text_(raw.label||raw.type,140),detail:text_(raw.detail||'',600),level:raw.level==='attention'?'attention':'info',
    at:number_(raw.at,0,1e15),receivedAt:Date.now(),clientReported:true};
  for(const k of ['durationMs','question','characters'])if(raw[k]!==undefined&&raw[k]!==null)out[k]=number_(raw[k],0,1e12);
  return out;
}
function sync_(u,p){
  const {a,e}=attempt_(u,p.attemptId);assert_(a.student===u.email,'Solo el estudiante puede guardar sus respuestas.');
  assert_(Number.isSafeInteger(p.seq)&&p.seq>=0,'Secuencia inválida.');const now=Date.now(),late=now>a.deadlineAt;
  // Validate the entire batch before applying any writes. Retries use the same seq and event IDs.
  const newAnswers=answers_(p.answers||{},e),events=p.events||[];assert_(Array.isArray(events)&&events.length<=30,'Máximo 30 eventos por lote.');
  const clean=events.map(event_);
  if(a.status==='running'&&!late&&p.seq>a.lastSeq){write_('Answers',a.id,{answers:newAnswers});a.lastSeq=p.seq;a.lastSavedAt=now;}
  if(now<=a.deadlineAt+600000){for(const ev of clean){const id=a.id+':'+ev.id,old=read_('Events',id);if(old||a.eventCount<EXAMIA_.maxEvents){if(!old)a.eventCount++;write_('Events',id,ev);}}}
  if(a.status==='running'&&late)finalize_(a,e,'expired');else write_('Attempts',a.id,a);
  return {status:a.status,acceptedSeq:a.lastSeq,lastSavedAt:a.lastSavedAt||null,deadlineAt:a.deadlineAt,lateAnswersRejected:late,serverNow:now};
}
function score_(a,e){
  const answers=read_('Answers',a.id)?.answers||{};let total=0,max=0,pending=0;
  for(const q of e.questions){max+=q.points;if(q.type==='text'){if(Object.prototype.hasOwnProperty.call(a.manual||{},q.id))total+=a.manual[q.id];else pending++;}
    else if(answers[q.id]===q.correct)total+=q.points;}
  return {total:Math.round(total*100)/100,max:Math.round(max*100)/100,pending};
}
function finalize_(a,e,status){
  a.status=status;a.submittedAt=Date.now();a.score=score_(a,e);a.receipt=a.receipt||Utilities.getUuid();write_('Attempts',a.id,a);return a;
}
function submit_(u,p){
  const {a,e}=attempt_(u,p.attemptId);assert_(a.student===u.email,'Solo el titular puede entregar.');
  if(a.status==='running'){sync_(u,p);const latest=read_('Attempts',a.id);if(latest.status==='running')finalize_(latest,e,'submitted');}
  return safeAttempt_(u,read_('Attempts',a.id),e);
}
function attempts_(u){return list_('Attempts').filter(a=>u.role==='administrador'||a.student===u.email||a.owner===u.email).map(a=>{
  if(a.status==='running'&&Date.now()>a.deadlineAt)a=lock_(()=>{const current=read_('Attempts',a.id);return current.status==='running'?finalize_(current,read_('Versions',current.versionKey),'expired'):current;});
  const out={id:a.id,title:a.title,student:a.student,status:a.status,startedAt:a.startedAt,deadlineAt:a.deadlineAt,preview:a.preview,eventCount:a.eventCount,imageCount:a.imageCount,receipt:a.receipt||null};
  if(u.role!=='estudiante'||read_('Exams',a.examId)?.resultsReleased)out.score=a.score;return out;
});}
function review_(u,p){const {a,e}=attempt_(u,p.attemptId,true);return {...a,exam:e,answers:read_('Answers',a.id)?.answers||{},events:prefix_('Events',a.id+':').sort((x,y)=>x.at-y.at),
  media:prefix_('Evidence',a.id+':').filter(m=>m.status==='ready').map(({fileId,...m})=>m),serverNow:Date.now()};}
function manualGrade_(u,p){
  const {a,e}=attempt_(u,p.attemptId,true);assert_(a.status!=='running','Finalice el intento antes de calificar.');
  const manual={};for(const q of e.questions)if(q.type==='text'&&Object.prototype.hasOwnProperty.call(p.manual||{},q.id))manual[q.id]=number_(p.manual[q.id],0,q.points);
  assert_(['Pendiente','Justificada','Requiere revisión'].includes(p.state),'Estado de revisión inválido.');
  a.manual=manual;a.review={state:p.state,note:text_(p.note||'',4000),reviewer:u.email,at:Date.now()};a.score=score_(a,e);
  write_('Attempts',a.id,a);audit_(u,'attempt.graded',a.id);return a.score;
}
function upload_(u,p){
  const {a,e}=attempt_(u,p.attemptId);assert_(a.student===u.email,'Solo el titular puede enviar evidencia.');
  assert_(Date.now()<=a.deadlineAt+600000,'Plazo de recepción de evidencias terminado.');
  assert_(['camera','screen'].includes(p.kind)&&(p.kind==='camera'?e.settings.camera&&e.settings.images:e.settings.screen),'Fuente de evidencia no autorizada.');
  const id=uuid_(p.id),key=a.id+':'+id,eventId=uuid_(p.eventId);text_(p.data,250000);
  assert_(/^[A-Za-z0-9+/]+={0,2}$/.test(p.data),'Base64 inválido.');const bytes=Utilities.base64Decode(p.data);
  assert_(bytes.length>3&&bytes.length<=EXAMIA_.imageBytes&&(bytes[0]&255)===255&&(bytes[1]&255)===216&&(bytes[2]&255)===255,'Solo JPEG hasta 180 KiB.');
  const existing=lock_(()=>{
    const old=read_('Evidence',key);if(old?.status==='ready')return old;
    assert_(!old||old.reservedAt<Date.now()-120000,'BUSY: imagen en proceso.');
    const current=read_('Attempts',a.id);assert_(current.imageCount<EXAMIA_.maxImages||old,'Límite de 120 imágenes alcanzado.');
    if(!old){current.imageCount++;write_('Attempts',a.id,current);}
    write_('Evidence',key,{id,attemptId:a.id,eventId,kind:p.kind,at:number_(p.at,0,1e15),receivedAt:Date.now(),expiresAt:Date.now()+EXAMIA_.retentionDays*86400000,status:'pending',reservedAt:Date.now()});return null;
  });
  if(existing)return {id:existing.id,stored:true};
  let file;
  try{
    file=DriveApp.getFolderById(config_().EVIDENCE_FOLDER_ID).createFile(Utilities.newBlob(bytes,'image/jpeg',a.id+'_'+id+'.jpg'));
    const meta=lock_(()=>{const m=read_('Evidence',key);m.status='ready';m.fileId=file.getId();m.bytes=bytes.length;write_('Evidence',key,m);return m;});
    return {id:meta.id,stored:true,expiresAt:meta.expiresAt};
  }catch(err){if(file)file.setTrashed(true);throw err;}
}
function image_(u,p){
  const {a}=attempt_(u,p.attemptId,true),m=read_('Evidence',a.id+':'+uuid_(p.id));
  assert_(m&&m.status==='ready'&&m.expiresAt>Date.now(),'Imagen no disponible o caducada.');
  return {id:m.id,kind:m.kind,data:Utilities.base64Encode(DriveApp.getFileById(m.fileId).getBlob().getBytes())};
}
/** Daily retention: move expired images to Drive trash; downloaded copies are unaffected. */
function purgeEvidence_(){
  const now=Date.now();let count=0;
  for(const m of list_('Evidence'))if(m.status==='ready'&&m.expiresAt<now&&count<200){
    try{DriveApp.getFileById(m.fileId).setTrashed(true);lock_(()=>{m.status='expired';delete m.fileId;write_('Evidence',m.attemptId+':'+m.id,m);});count++;}catch(err){console.warn('No se pudo retirar evidencia '+m.id);}
  }
  return {trashed:count};
}
