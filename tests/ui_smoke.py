"""Browser smoke checks. Real Chromium DOM, fake backend and IndexedDB; no Google login."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
STORAGE=r'''
const dataStore=new Map();
Object.defineProperty(window,'indexedDB',{value:{open(){const req={};setTimeout(()=>{req.result={createObjectStore(){},transaction(){const tr={};tr.objectStore=()=>({get(k){const r={result:structuredClone(dataStore.get(k))};setTimeout(()=>tr.oncomplete?.(),0);return r;},getAll(){const r={result:structuredClone([...dataStore.values()])};setTimeout(()=>tr.oncomplete?.(),0);return r;},put(v){dataStore.set(v.id,structuredClone(v));const r={result:v.id};setTimeout(()=>tr.oncomplete?.(),0);return r;},delete(k){dataStore.delete(k);const r={};setTimeout(()=>tr.oncomplete?.(),0);return r;}});return tr;}};req.onupgradeneeded?.();req.onsuccess?.();},0);return req;}}});
if(!crypto.randomUUID)crypto.randomUUID=()=> 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16);});
'''
MOCK=r'''
window.EXAMIA_CONFIG={apiUrl:'https://script.google.com/macros/s/TEST/exec'};
const exam={id:'11111111-1111-4111-8111-111111111111',revision:1,owner:'teacher@upch.pe',title:'Prueba conectada',course:'Proyecto Integrador',minutes:20,published:true,students:['student@upch.pe'],settings:{camera:false,images:false,screen:false,clipboard:true,tabs:true,interval:30},questions:[{id:'22222222-2222-4222-8222-222222222222',type:'choice',text:'Protocolo de IoT',options:['MQTT','HTTP'],correct:0,points:5},{id:'33333333-3333-4333-8333-333333333333',type:'text',text:'Explica diseño modular',options:[],points:5}]};
window.calls=[];window.lastAttempt=null;
window.ExamIAClient=class{constructor(){this.token='unit-test';this.url=EXAMIA_CONFIG.apiUrl;}async signOut(){}async call(action,payload={}){window.calls.push({action,payload});if(action==='me')return {user:{email:'teacher@upch.pe',role:'administrador'},serverNow:Date.now()};if(action==='exams')return [exam];if(action==='prepare')return {exam};if(action==='saveExam')return {...payload.exam,revision:2};if(action==='users')return [{email:'teacher@upch.pe',role:'administrador',active:true}];if(action==='setUser')return payload;if(action==='start'){lastAttempt={id:'44444444-4444-4444-8444-444444444444',examId:exam.id,title:exam.title,student:'teacher@upch.pe',exam,answers:{},status:'running',startedAt:Date.now(),deadlineAt:Date.now()+1200000,serverNow:Date.now(),lastSeq:-1};return lastAttempt;}if(action==='sync')return {status:'running',acceptedSeq:payload.seq,lastSavedAt:Date.now(),serverNow:Date.now()};if(action==='submit'){lastAttempt={...lastAttempt,answers:payload.answers,events:payload.events,status:'submitted',receipt:'RECEIPT-TEST'};return lastAttempt;}if(action==='attempts')return lastAttempt?[lastAttempt]:[];if(action==='review')return {...lastAttempt,exam,media:[],events:(lastAttempt.events||[]).map(e=>({...e,receivedAt:Date.now()})),manual:{},review:{state:'Pendiente',note:''},score:{total:5,max:10,pending:1}};if(action==='grade')return {total:9,max:10,pending:0};throw Error('Unexpected action: '+action);}};
'''
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1300,'height':1000})
    html=(ROOT/'index.html').read_text()
    import re
    html=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>','',html)
    page.set_content(html)
    page.add_script_tag(content=STORAGE)
    page.add_script_tag(content=MOCK)
    page.add_script_tag(content=(ROOT/'cloud-app.js').read_text())
    checks=[]
    def check(name,condition):
        assert condition,name
        checks.append(name)
    page.get_by_role('heading',name='Mis exámenes').wait_for()
    check('Institutional home renders',True)
    check('No role selector on connected login',page.locator('#role').count()==0)
    page.get_by_role('button',name='Editar y configurar').click()
    check('Roster and publication controls present',page.locator('#roster').input_value()=='student@upch.pe')
    page.get_by_role('button',name='Añadir pregunta').click()
    check('Question editor adds a question',page.locator('[data-field="text"]').count()==3)
    page.get_by_role('button',name='Guardar en servidor').click()
    page.get_by_role('heading',name='Mis exámenes').wait_for()
    check('Editor calls backend save',page.evaluate("calls.some(x=>x.action==='saveExam')"))
    page.get_by_role('button',name='Usuarios y permisos').click()
    page.locator('#user-email').fill('new@upch.pe')
    page.locator('#user-role').select_option('docente')
    page.get_by_role('button',name='Guardar permiso').click()
    check('Administrator role API connected',page.evaluate("calls.some(x=>x.action==='setUser'&&x.payload.role==='docente')"))
    page.get_by_role('button',name='Exámenes',exact=True).click()
    page.get_by_role('button',name='Probar examen').click()
    check('Consent required before start',page.get_by_role('button',name='Iniciar examen').is_disabled())
    page.locator('#consent').check()
    check('No AI toggle in preparation',page.locator('[data-setting="ai"]').count()==0)
    page.get_by_role('button',name='Iniciar examen').click()
    page.locator('#answer-area').wait_for()
    page.locator('input[data-answer]').first.check()
    page.locator('textarea[data-answer]').fill('Permite sustituir un módulo sin reconstruir el sistema.')
    page.evaluate("document.querySelector('textarea[data-answer]').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:new DataTransfer()}))")
    page.get_by_role('button',name='Guardar ahora').click()
    page.wait_for_function("calls.some(x=>x.action==='sync')")
    check('Answers transmitted',page.evaluate("calls.find(x=>x.action==='sync').payload.answers['33333333-3333-4333-8333-333333333333'].includes('módulo')"))
    check('Clipboard event transmitted',page.evaluate("calls.some(x=>x.action==='sync'&&x.payload.events.some(e=>e.type==='paste'))"))
    page.on('dialog',lambda d:d.accept())
    page.get_by_role('button',name='Entregar examen',exact=True).click()
    page.get_by_text('RECEIPT-TEST',exact=True).wait_for()
    check('Server receipt shown after submission',True)
    page.get_by_role('button',name='Entregas y evidencias').click()
    page.get_by_role('button',name='Revisar',exact=True).click()
    page.get_by_role('heading',name='Revisión del intento').wait_for()
    check('Review and manual grading available',page.locator('[data-mark]').count()==1)
    page.locator('[data-mark]').fill('4')
    page.get_by_role('button',name='Guardar revisión',exact=True).click()
    check('Manual marks go to backend',page.evaluate("calls.some(x=>x.action==='grade'&&Object.values(x.payload.manual)[0]===4)"))
    page.get_by_role('heading',name='Revisión del intento').wait_for()
    with page.expect_download() as dl:
        page.get_by_role('button',name='Incidencias CSV').click()
    check('CSV report downloads',dl.value.suggested_filename.endswith('.csv'))
    with page.expect_download() as dl:
        page.get_by_role('button',name='Informe HTML con fotos').click()
    check('HTML report downloads',dl.value.suggested_filename.endswith('.html'))
    page.screenshot(path=str(ROOT/'tests/ui-review.png'),full_page=True)
    (ROOT/'tests/ui-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'scope':'Chromium DOM with mocked IndexedDB and Apps Script API. Navigation was blocked by the environment; HTML loaded directly. No live OAuth, devices, MediaPipe, bridge or load test.'},indent=2,ensure_ascii=False))
    print(json.dumps({'passed':len(checks),'checks':checks},indent=2,ensure_ascii=False))
    browser.close()
