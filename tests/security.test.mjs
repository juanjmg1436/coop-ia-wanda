import test from 'node:test';
import a from 'node:assert/strict';
import worker from '../worker/index.mjs';
import {Store,hash} from '../worker/store.mjs';
import {ProviderManager,publicConfig} from '../worker/providers.mjs';
import {seed,database} from './helpers.mjs';
import {snapshot} from '../src/core.mjs';
const request=(path,{method='GET',cookie,data,origin='https://coop.test'}={})=>new Request('https://coop.test/api/'+path,{method,headers:{...(cookie?{cookie}:{}),...(method==='POST'?{'content-type':'application/json','x-coop-request':'1',origin}:{})},...(method==='POST'?{body:JSON.stringify(data||{})}:{})});
async function setup(){const DB=database(),accessCode='a'.repeat(64),env={DB,ADMIN_TOKEN_HASH:await hash(accessCode),FREE_TIER_CONFIRMED:'true',FREE_TIER_REVIEW_UNTIL:new Date(Date.now()+86400000).toISOString()};const store=new Store(DB);const res=await worker.fetch(request('login',{method:'POST',data:{accessCode}}),env);a.equal(res.status,200);return {DB,env,store,cookie:res.headers.get('set-cookie').split(';')[0],accessCode};}
function fixtureAI(scenario='collections',calls=[]){return {async run(model,payload){const input=JSON.parse(payload.messages[1].content);calls.push(input);let result;if(input.phase==='route')result={scenario,includeQuality:false,reason:'Circuito elegido en prueba de contrato.'};else if(input.phase==='select_tools')result={tools:scenario==='collections'?['getInvoices','getPayments','calculateArrears']:['getTickets'],reason:'Consultar registros autorizados.'};else result={summary:'Interpretación de prueba basada en evidencia recibida.',findings:['Los movimientos permiten conciliar las cuentas.'],recommendations:['Revisar los registros antes de decidir.'],limitations:['No hay datos de costos.'],evidence:[scenario==='collections'?'METRICS':'GROUPS']};return {response:JSON.stringify(result),usage:{prompt_tokens:180,completion_tokens:70,total_tokens:250}};}};}
test('Visitantes no pueden ejecutar, configurar proveedores, consultar ni aprobar tareas',async()=>{const {DB,env}=await setup();for(const [path,method]of [['tasks','POST'],['providers','POST'],['providers','GET'],['providers/test','POST'],['tasks','GET'],['tasks/'+crypto.randomUUID()+'/approve','POST']]){const r=await worker.fetch(request(path,{method}),env);a.equal(r.status,401,path);}a.equal((await DB.prepare('SELECT count(*) n FROM calls').first()).n,0);DB.close();});
test('Login protegido, cookie HttpOnly/Secure/SameSite, CSRF y expiración',async()=>{const {DB,env,cookie}=await setup();const r=await worker.fetch(request('login',{method:'POST',data:{accessCode:'a'.repeat(64)}}),env);a.match(r.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);a.match(r.headers.get('set-cookie'),/Secure/);a.equal((await worker.fetch(request('providers',{method:'POST',cookie,origin:'https://evil.test'}),env)).status,403);a.equal((await worker.fetch(request('login',{method:'POST',data:{accessCode:'bad'}}),env)).status,401);await DB.prepare('UPDATE sessions SET expires=0').run();a.equal((await worker.fetch(request('providers',{cookie}),env)).status,401);DB.close();});
test('Intentos de ingreso limitados en servidor',async()=>{const {DB,env}=await setup();let response;for(let i=0;i<6;i++)response=await worker.fetch(request('login',{method:'POST',data:{accessCode:'bad'}}),env);a.equal(response.status,429);DB.close();});
test('Cuotas atómicas concurrentes y reserva inicial sobredimensionada',async()=>{const DB=database(),s=new Store(DB);const results=await Promise.allSettled(Array.from({length:20},()=>s.reserve('test',1,50,5,250,60)));a.equal(results.filter(r=>r.status==='fulfilled').length,5);a.equal((await DB.prepare('SELECT calls FROM limits WHERE key=?').bind('test').first()).calls,5);await a.rejects(s.reserve('oversized',1,1000,5,20,60));DB.close();});
test('IA desactivada sin confirmación de plan gratuito; modelos fuera de lista bloqueados',async()=>{const DB=database(),s=new Store(DB),task={id:'test',usage:[]};let contacted=0;const p=new ProviderManager({GEMINI_API_KEY:'test'},s,task,{fetcher:async()=>{contacted++;}});await a.rejects(p.call({system:'s',input:'x',schema:{}}));a.equal(contacted,0);await s.set('providers',{primary:'gemini',authorized:['gemini'],models:{gemini:'gemini-paid'}});const p2=new ProviderManager({GEMINI_API_KEY:'test',FREE_TIER_CONFIRMED:'true',FREE_TIER_REVIEW_UNTIL:new Date(Date.now()+86400000).toISOString()},s,task,{fetcher:async()=>{contacted++;}});await a.rejects(p2.call({system:'s',input:'x',schema:{}}));a.equal(contacted,0);DB.close();});
test('Gemini: contrato REST, consumo informado, sin clave en URL ni resultados',async()=>{const DB=database(),s=new Store(DB),task={id:'contract',usage:[]};let called;const pm=new ProviderManager({GEMINI_API_KEY:'test-secret-not-real',FREE_TIER_CONFIRMED:'true',FREE_TIER_REVIEW_UNTIL:new Date(Date.now()+86400000).toISOString()},s,task,{fetcher:async(url,options)=>{called={url,options};return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}],usageMetadata:{promptTokenCount:50,candidatesTokenCount:10,totalTokenCount:60}}),{headers:{'content-type':'application/json'}});}});const value=await pm.call({system:'s',input:'x',schema:{type:'OBJECT'}});a.equal(value.ok,true);a.ok(!called.url.includes('test-secret'));a.equal(called.options.headers['x-goog-api-key'],'test-secret-not-real');a.equal(task.usage[0].total,60);a.equal(task.usage[0].estimated,false);a.ok(!JSON.stringify(task).includes('test-secret'));DB.close();});
test('429 detiene proveedor; sólo respaldo autorizado y registro de ambos intentos',async()=>{const {DB,env,store}=await setup();env.GEMINI_API_KEY='fixture';env.AI={async run(){return {response:'{"ok":true}'};}};await store.set('providers',{primary:'gemini',fallback:'cloudflare',authorized:['gemini','cloudflare'],models:{gemini:'gemini-2.5-flash-lite',cloudflare:'@cf/meta/llama-3.1-8b-instruct-fp8'}});const task={id:'fallback-test',usage:[]},events=[];const p=new ProviderManager(env,store,task,{fetcher:async()=>new Response('{}',{status:429})});const value=await p.call({system:'s',input:'x',schema:{},onEvent:ev=>events.push(ev)});a.equal(value.ok,true);a.equal(task.usage.length,2);a.ok(events.some(e=>e.type==='fallback'));a.ok(await store.get('blocked:gemini',0)>Date.now());a.equal(task.usage[1].estimated,true);DB.close();});
test('Diagnóstico 429 persiste sin secretos y la pausa no consume otra llamada',async()=>{
 const {DB,env,store}=await setup();env.GEMINI_API_KEY='never-show-this-secret';let calls=0;
 const pm=new ProviderManager(env,store,{id:'diagnostic',usage:[]},{fetcher:async()=>{calls++;return new Response(JSON.stringify({error:{message:'Quota exceeded; limit: 0; key=never-show-this-secret',details:[{violations:[{quotaValue:'0'}]}]}}),{status:429});}});
 await a.rejects(pm.call({system:'s',input:'x',schema:{}}),/cuota cero.*HTTP 429.*Pausa hasta/);
 const until=await store.get('blocked:gemini');a.ok(until>Date.now()+86300000);
 const before=await DB.prepare('SELECT * FROM limits ORDER BY key').all();
 await a.rejects(pm.call({system:'s',input:'x',schema:{}}),/cuota cero.*HTTP 429/);
 a.equal(calls,1);a.deepEqual(await DB.prepare('SELECT * FROM limits ORDER BY key').all(),before);
 const state=await publicConfig(env,store),p=state.providers[0];a.equal(p.lastFailure.category,'quota_zero');a.equal(p.connectionVerified,false);
 a.ok(!JSON.stringify(state).includes(env.GEMINI_API_KEY));a.ok(!JSON.stringify(await DB.prepare('SELECT * FROM settings').all()).includes(env.GEMINI_API_KEY));DB.close();
});
test('Clave rechazada, modelo ausente y fallo temporal tienen diagnósticos distintos',async()=>{
 for(const [status,reason,expected,word]of [[400,'API_KEY_INVALID','credential','clave'],[403,'API_KEY_HTTP_REFERRER_BLOCKED','credential','clave'],[404,'','model_unavailable','modelo'],[503,'','unavailable','temporal']]){
  const {DB,env,store}=await setup();env.GEMINI_API_KEY='private-key';const pm=new ProviderManager(env,store,{id:'reason',usage:[]},{fetcher:async()=>new Response(JSON.stringify({error:{message:'private-key',details:[{reason}]}}),{status})});
  await a.rejects(pm.call({system:'s',input:'x',schema:{}}),new RegExp(word));a.equal((await store.get('failure:gemini')).category,expected);a.ok(!JSON.stringify(await publicConfig(env,store)).includes('private-key'));DB.close();
 }
});
test('Pausa heredada conserva vencimiento y no inventa el motivo ni reinicia cuotas',async()=>{
 const {DB,env,store}=await setup();env.GEMINI_API_KEY='fixture';const until=Date.now()+86400000;await store.set('blocked:gemini',until);let calls=0;
 const pm=new ProviderManager(env,store,{id:'legacy',usage:[]},{fetcher:async()=>{calls++;throw Error('No debe llamar');}});
 await a.rejects(pm.call({system:'s',input:'x',schema:{}}),/motivo original no quedó registrado/);a.equal(calls,0);a.equal(await store.get('blocked:gemini'),until);a.equal((await DB.prepare('SELECT count(*) n FROM calls').first()).n,0);DB.close();
});
test('Respuesta posterior al vencimiento conserva consumo y registra conexión comprobada',async()=>{
 const {DB,env,store}=await setup();env.GEMINI_API_KEY='fixture';await store.set('blocked:gemini',Date.now()-1000);await store.set('failure:gemini',{category:'timeout',at:new Date(Date.now()-400000).toISOString()});
 const pm=new ProviderManager(env,store,{id:'recovered',usage:[]},{fetcher:async()=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}]}))});
 await pm.call({system:'s',input:'x',schema:{}});const p=(await publicConfig(env,store)).providers[0];a.equal(p.connectionVerified,true);a.equal(p.lastFailure,null);a.ok(p.verifiedAt);a.equal((await DB.prepare('SELECT count(*) n FROM calls').first()).n,1);DB.close();
});
for(const scenario of ['collections','incidents'])test('Circuito API completo '+scenario+' con doble de proveedor; NO es conexión real',async()=>{const {DB,env,store,cookie,accessCode}=await setup(),calls=[];env.AI=fixtureAI(scenario,calls);await store.set('providers',{primary:'cloudflare',fallback:null,authorized:['cloudflare'],models:{cloudflare:'@cf/meta/llama-3.1-8b-instruct-fp8'}});const requestId=crypto.randomUUID(),input={instruction:'Alex analizá las cobranzas y prepará un informe para revisar.',requestId,consent:true,snapshot:snapshot(seed(),new Date().toISOString().slice(0,10))};let execution;const response=await worker.fetch(request('tasks',{method:'POST',cookie,data:input}),env,{waitUntil:p=>execution=p});a.equal(response.status,200);const text=await response.text();await execution;const done=text.match(/event: done\ndata: (.+)/);a.ok(done,text.slice(-1000));const task=JSON.parse(done[1]);a.equal(task.status,'requiere_aprobacion');a.equal(task.scenario,scenario);a.ok(task.events.some(e=>e.type==='handoff'));a.ok(calls.find(c=>c.phase==='interpret').receivedFrom=== (scenario==='collections'?'valentina':'camila'));a.equal(calls.length,scenario==='collections'?4:5);a.ok(calls.find(c=>c.phase==='interpret').verifiedData);a.equal(task.usage.length,calls.length);if(scenario==='collections')a.equal(task.report.metrics.outstanding,137550);else a.ok(task.report.drafts.every(d=>d.status==='Borrador'));
 const other=await worker.fetch(request('login',{method:'POST',data:{accessCode}}),env),otherCookie=other.headers.get('set-cookie').split(';')[0];a.equal((await worker.fetch(request('tasks/'+task.id+'/approve',{method:'POST',cookie:otherCookie,data:{note:'Revisado por otra sesión'}}),env)).status,404);
 a.equal((await worker.fetch(request('tasks',{method:'POST',cookie,data:input}),env)).status,409);const approval=await worker.fetch(request('tasks/'+task.id+'/approve',{method:'POST',cookie,data:{note:'Revisé la evidencia y el informe.'}}),env);a.equal(approval.status,200);a.equal((await approval.json()).status,'completada');a.equal((await worker.fetch(request('tasks/'+task.id+'/approve',{method:'POST',cookie,data:{note:'Doble revisión'}}),env)).status,409);a.ok(!text.includes(accessCode));DB.close();});
test('Base manipulada rechazada antes de ejecutar modelos',async()=>{const {DB,env,cookie}=await setup(),s=seed();s.invoices[0].total=-100;const r=await worker.fetch(request('tasks',{method:'POST',cookie,data:{instruction:'Analizar esta base ficticia',requestId:crypto.randomUUID(),consent:true,snapshot:s}}),env);a.equal(r.status,400);a.equal((await DB.prepare('SELECT count(*) n FROM calls').first()).n,0);DB.close();});
test('Gemini distingue transporte, JSON HTTP, salida truncada y JSON del modelo sin filtrar errores',async()=>{
 const cases=[
  [async()=>{throw new TypeError('fetch failed: private-key');},'network'],
  [async()=>{throw new TypeError('Illegal invocation: private-key');},'runtime_binding'],
  [async()=>new Response('<html>private-key</html>'),'response_invalid'],
  [async()=>Response.json({candidates:[{finishReason:'MAX_TOKENS'}]}),'output_limit'],
  [async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'private-key'}]}}]}),'model_json_invalid']
 ];
 for(const [fetcher,category]of cases){const {DB,env,store}=await setup();env.GEMINI_API_KEY='private-key';const pm=new ProviderManager(env,store,{id:'diagnosis',usage:[]},{fetcher});await a.rejects(pm.call({system:'s',input:'x',schema:{}}));a.equal((await store.get('failure:gemini')).category,category);a.ok(!JSON.stringify(await publicConfig(env,store)).includes('private-key'));DB.close();}
});
test('Gemini usa el receptor global de fetch como exige el runtime de Workers',async()=>{
 const original=globalThis.fetch;let seen;
 globalThis.fetch=async function(){seen=this;if(this!==globalThis)throw new TypeError('Illegal invocation');return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}]});};
 try{const pm=new ProviderManager({GEMINI_API_KEY:'fixture'},null,{usage:[]});const out=await pm.gemini({model:'gemini-2.5-flash-lite',system:'s',input:'x',schema:{}});a.equal(out.value.ok,true);a.equal(seen,globalThis);}finally{globalThis.fetch=original;}
});
test('Automatización retirada: accesos anteriores no ejecutan modelos ni modifican datos',async()=>{
 const {DB,env,store,cookie}=await setup();
 const formerKey='b'.repeat(64);await store.set('n8n',{enabled:true,realAllowed:true,tokenHash:await hash(formerKey),expiresAt:new Date(Date.now()+86400000).toISOString()});
 const before=await DB.prepare('SELECT * FROM settings').all();
 for(const endpoint of ['run','status','config'])for(const method of ['GET','POST']){
  const r=request('automation/'+endpoint,{method,cookie,data:{scenario:'collections',mode:'real'}});r.headers.set('authorization','Bearer '+formerKey);
  const response=await worker.fetch(r,env);a.equal(response.status,410);a.match((await response.json()).error,/retirada/);
 }
 a.deepEqual(await DB.prepare('SELECT * FROM settings').all(),before);
 a.equal((await DB.prepare('SELECT count(*) n FROM calls').first()).n,0);
 a.equal((await DB.prepare('SELECT count(*) n FROM tasks').first()).n,0);
 const health=await (await worker.fetch(request('health'),env)).json();a.equal(health.automationAvailable,false);a.equal(health.version,'3.0.2');DB.close();
});
