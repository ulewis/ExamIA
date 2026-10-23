/* Unit tests with in-memory Apps Script doubles. No Google account is contacted. */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
let clock=Date.now(),fetched=0,tests=0;
const props={APP_URL:'https://ulewis.github.io/ExamIA/',DB_ID:'test-db',EVIDENCE_FOLDER_ID:'private-folder',SESSION_SECRET:'test-secret-not-production',OAUTH_CLIENT_ID:'test-client',OAUTH_CLIENT_SECRET:'test-client-secret',WEB_APP_URL:'https://script.google.com/macros/s/TEST/exec'};
const tables=new Map(),files=new Map(),cache=new Map();
class Range {
 constructor(sh,r,c,n=1,m=1){Object.assign(this,{sh,r,c,n,m});}
 getRow(){return this.r;}
 getValue(){return this.getValues()[0][0];}
 getValues(){return Array.from({length:this.n},(_,i)=>Array.from({length:this.m},(_,j)=>this.sh.rows[this.r+i-1]?.[this.c+j-1]??''));}
 setValues(values){values.forEach((row,i)=>{this.sh.rows[this.r+i-1]??=[];row.forEach((v,j)=>this.sh.rows[this.r+i-1][this.c+j-1]=v);});return this;}
 createTextFinder(query){const range=this;return {query,regex:false,exact:false,matchEntireCell(x){this.exact=x;return this;},useRegularExpression(x){this.regex=x;return this;},findAll(){const matches=[];range.getValues().forEach((r,i)=>{const value=String(r[0]);if(this.regex?new RegExp(this.query).test(value):this.exact?value===this.query:value.includes(this.query))matches.push(new Range(range.sh,range.r+i,range.c));});return matches;},findNext(){return this.findAll()[0]||null;}};}
}
class Sheet {constructor(name){this.name=name;this.rows=[['id','json']];}getLastRow(){return this.rows.length;}getRange(...args){return new Range(this,...args);}}
function table(name){if(!tables.has(name))tables.set(name,new Sheet(name));return tables.get(name);}
function blob(bytes,mime,name){const b=Buffer.isBuffer(bytes)?bytes:typeof bytes==='string'?Buffer.from(bytes):Buffer.from(bytes.map(v=>v&255));return {getBytes:()=>[...b],getDataAsString:()=>b.toString(),mime,name};}
const context={console,Date:class extends Date{static now(){return clock;}},Set,Map,JSON,Object,Array,Number,String,Math,RegExp,Error,
 PropertiesService:{getScriptProperties:()=>({getProperties:()=>({...props}),getProperty:k=>props[k],setProperty:(k,v)=>props[k]=v})},
 SpreadsheetApp:{openById:()=>({getSheetByName:table})},
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
 Utilities:{getUuid:()=>crypto.randomUUID(),base64EncodeWebSafe:x=>Buffer.from(typeof x==='string'?x:x.map(v=>v&255)).toString('base64url'),base64Encode:x=>Buffer.from(x.map(v=>v&255)).toString('base64'),base64Decode:x=>[...Buffer.from(x,'base64')],base64DecodeWebSafe:x=>[...Buffer.from(x,'base64url')],newBlob:blob,computeHmacSha256Signature:(s,k)=>[...crypto.createHmac('sha256',k).update(s).digest()],computeDigest:(_,s)=>[...crypto.createHash('sha256').update(s).digest()],DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'}},
 DriveApp:{getFolderById:()=>({createFile:b=>{const key=crypto.randomUUID();const f={blob:b,trashed:false,getId:()=>key,getBlob:()=>b,setTrashed(v){this.trashed=v;}};files.set(key,f);return f;}}),getFileById:key=>files.get(key)},
 CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
 UrlFetchApp:{fetch:()=>{fetched++;return {getResponseCode:()=>400,getContentText:()=>'{'+'"error":"fake"'+'}'};}},
 HtmlService:{createHtmlOutput:html=>({html,setTitle(){return this;}})}
};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8'),context);
const run=code=>vm.runInContext(code,context);
function put(table,id,value){context.write_(table,id,value);}
function user(email,role){const u={email,sub:'google-'+email,name:email,role,active:true,revision:1};put('Users',email,u);return {u,token:context.session_(u)};}
const admin=user('admin@upch.pe','administrador'),prof=user('prof@upch.pe','docente'),other=user('other@upch.pe','docente'),student=user('student@upch.pe','estudiante'),stranger=user('stranger@upch.pe','estudiante');
function call(who,action,payload={}){return context.rpc({token:who.token,action,payload});}
function ok(who,action,payload={}){const r=call(who,action,payload);assert.equal(r.ok,true,r.error);return r.data;}
function denied(who,action,payload={}){assert.equal(call(who,action,payload).ok,false);}
function test(name,fn){fn();tests++;console.log('PASS '+name);}
const q1=crypto.randomUUID(),q2=crypto.randomUUID(),exam={id:crypto.randomUUID(),revision:0,title:'Prueba',course:'Curso',minutes:10,published:true,resultsReleased:false,students:['student@upch.pe'],settings:{camera:true,images:true,interval:30},questions:[{id:q1,type:'choice',text:'A o B',options:['A','B'],correct:1,points:5},{id:q2,type:'text',text:'Explique',points:5}]};
let e,a;
test('reject unauthenticated request',()=>denied({token:''},'me'));
test('reject tampered HMAC session',()=>denied({token:student.token.slice(0,-1)+'!'},'me'));
test('student cannot promote themselves',()=>denied(student,'setUser',{email:student.u.email,role:'administrador',active:true}));
test('student cannot create exams',()=>denied(student,'saveExam',{exam}));
test('teacher creates a versioned exam',()=>{e=ok(prof,'saveExam',{exam});assert.equal(e.owner,prof.u.email);assert.equal(e.revision,1);});
test('roster isolates exams from outsiders',()=>assert.equal(ok(stranger,'exams').length,0));
test('student listing removes answer keys and roster',()=>{const x=ok(student,'exams')[0];assert.equal(x.questions[0].correct,undefined);assert.equal(x.students,undefined);});
test('other teacher cannot overwrite the exam',()=>denied(other,'saveExam',{exam:e}));
test('stale revisions cannot overwrite changes',()=>denied(prof,'saveExam',{exam}));
test('student cannot start another course exam',()=>denied(stranger,'start',{examId:e.id,revision:e.revision,consent:true}));
test('start requires explicit notice acceptance',()=>denied(student,'start',{examId:e.id,revision:e.revision,consent:false}));
test('start rejects a changed consent revision',()=>denied(student,'start',{examId:e.id,revision:0,consent:true}));
test('server creates the deadline and redacts keys',()=>{a=ok(student,'start',{examId:e.id,revision:e.revision,consent:true});assert.equal(a.deadlineAt,clock+600000);assert.equal(a.exam.questions[0].correct,undefined);});
test('repeated start is idempotent',()=>assert.equal(ok(student,'start',{examId:e.id,consent:true}).id,a.id));
test('only the attempt owner may sync',()=>denied(other,'sync',{attemptId:a.id,seq:1,answers:{},events:[]}));
const ev={id:crypto.randomUUID(),type:'paste',label:'Acción pegar',at:clock,detail:'Solo longitud',characters:20};
test('sync stores responses and event receipt',()=>{ok(student,'sync',{attemptId:a.id,seq:1,answers:{[q1]:1,[q2]:'Texto'},events:[ev]});assert.equal(context.read_('Attempts',a.id).eventCount,1);});
test('retried sequence does not overwrite newer answers',()=>{ok(student,'sync',{attemptId:a.id,seq:1,answers:{[q1]:0},events:[ev]});assert.equal(context.read_('Answers',a.id).answers[q1],1);assert.equal(context.read_('Attempts',a.id).eventCount,1);});
test('whole batch validates before any writes',()=>{denied(student,'sync',{attemptId:a.id,seq:2,answers:{[q1]:0},events:[{...ev,at:'bad'}]});assert.equal(context.read_('Answers',a.id).answers[q1],1);});
test('invalid alternatives are rejected',()=>denied(student,'sync',{attemptId:a.id,seq:2,answers:{[q1]:50},events:[]}));
test('student cannot read teacher review',()=>denied(student,'review',{attemptId:a.id}));
test('unrelated teacher cannot read evidence',()=>denied(other,'review',{attemptId:a.id}));
let evidenceId=crypto.randomUUID();const image={attemptId:a.id,id:evidenceId,eventId:ev.id,kind:'camera',at:clock,data:Buffer.from([255,216,255,0,0,255,217]).toString('base64')};
test('JPEG upload stores a private file once',()=>{ok(student,'upload',image);ok(student,'upload',image);assert.equal(files.size,1);assert.equal(context.read_('Attempts',a.id).imageCount,1);});
test('non-JPEG payload rejected',()=>denied(student,'upload',{...image,id:crypto.randomUUID(),data:Buffer.from('<script>').toString('base64')}));
test('unconfigured screen image rejected',()=>denied(student,'upload',{...image,id:crypto.randomUUID(),kind:'screen'}));
test('student cannot download evidence',()=>denied(student,'image',{attemptId:a.id,id:evidenceId}));
test('unrelated teacher cannot download evidence',()=>denied(other,'image',{attemptId:a.id,id:evidenceId}));
test('authorized teacher can retrieve image',()=>assert.equal(ok(prof,'image',{attemptId:a.id,id:evidenceId}).data,image.data));
test('editing exam does not change an existing attempt key',()=>{e=ok(prof,'saveExam',{exam:{...e,questions:[{...e.questions[0],correct:0},e.questions[1]]}});assert.equal(ok(student,'prepare',{examId:e.id}).exam.revision,1);});
test('late responses are rejected, saved responses graded',()=>{clock=a.deadlineAt+1;const result=ok(student,'submit',{attemptId:a.id,seq:3,answers:{[q1]:0,[q2]:'Late'},events:[]});assert.equal(result.status,'expired');assert.equal(result.score,undefined);const stored=context.read_('Attempts',a.id);assert.equal(stored.score.total,5);assert.equal(context.read_('Answers',a.id).answers[q2],'Texto');});
test('submission retry preserves receipt',()=>{const r1=ok(student,'submit',{attemptId:a.id,seq:4,answers:{},events:[]});const r2=ok(student,'submit',{attemptId:a.id,seq:5,answers:{},events:[]});assert.equal(r1.receipt,r2.receipt);});
test('student cannot write a grade',()=>denied(student,'grade',{attemptId:a.id,manual:{[q2]:5},state:'Pendiente',note:''}));
test('manual marks are bounded',()=>denied(prof,'grade',{attemptId:a.id,manual:{[q2]:6},state:'Pendiente',note:''}));
test('teacher grading combines automatic and manual points',()=>{const score=ok(prof,'grade',{attemptId:a.id,manual:{[q2]:4},state:'Justificada',note:'Revisado'});assert.equal(score.total,9);assert.equal(score.pending,0);});
test('student results remain hidden until published',()=>assert.equal(ok(student,'attempts')[0].score,undefined));
test('published results visible to owner only',()=>{e=ok(prof,'saveExam',{exam:{...e,resultsReleased:true}});assert.equal(ok(student,'attempts')[0].score.total,9);assert.equal(ok(stranger,'attempts').length,0);});
test('admin authorizes teacher; old sessions revoked',()=>{ok(admin,'setUser',{email:other.u.email,role:'docente',active:false});denied(other,'me');});
test('admin cannot lock themselves out',()=>denied(admin,'setUser',{email:admin.u.email,role:'estudiante',active:false}));
test('prototype keys are not accepted as question IDs',()=>denied(prof,'saveExam',{exam:{...e,questions:[{...e.questions[0],id:'__proto__'}]}}));
test('spreadsheet formula-like emails rejected',()=>denied(admin,'setUser',{email:'=bad@upch.pe',role:'estudiante',active:true}));
test('unknown route rejected',()=>denied(student,'__proto__'));
test('expired images inaccessible and moved to trash',()=>{clock+=8*86400000;prof.token=context.session_(prof.u);denied(prof,'image',{attemptId:a.id,id:evidenceId});assert.equal(context.purgeEvidence_().trashed,1);assert.equal([...files.values()][0].trashed,true);});
test('expired session rejected',()=>denied(student,'me'));
test('OAuth callback with unknown state never calls token endpoint',()=>{assert.throws(()=>context.callback_('code','a'.repeat(64)));assert.equal(fetched,0);});
test('OAuth state consumed before a failed exchange',()=>{cache.set('oauth:'+'b'.repeat(64),JSON.stringify({nonce:'n',verifier:'v'}));assert.throws(()=>context.callback_('code','b'.repeat(64)));assert.equal(cache.has('oauth:'+'b'.repeat(64)),false);});
console.log(`\n${tests} backend checks passed. Google deployment, OAuth and browser devices are NOT exercised.`);
