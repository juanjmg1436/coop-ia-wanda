import {snapshot,assert} from '../src/core.mjs';
import {Store,hash,token,timestamp} from './store.mjs';
import {publicConfig,MODELS,ProviderManager} from './providers.mjs';
import {execute} from './engine.mjs';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'};
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
const error=(msg,code)=>Object.assign(new Error(msg),{code});
async function body(req,max=700000){const size=Number(req.headers.get('content-length')||0);if(size>max)throw error('Solicitud demasiado grande',413);const reader=req.body?.getReader();if(!reader)throw error('Falta cuerpo JSON',400);const chunks=[];let total=0;for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();throw error('Solicitud demasiado grande',413);}chunks.push(value);}const data=new Uint8Array(total);let at=0;for(const c of chunks){data.set(c,at);at+=c.length;}try{return JSON.parse(new TextDecoder().decode(data));}catch{throw error('JSON inválido',400);}}
async function authenticate(req,store){const match=(req.headers.get('cookie')||'').match(/(?:^|;\s*)coop_session=([a-f0-9]{64})(?:;|$)/);if(!match)return null;const tokenHash=await hash(match[1]);return store.db.prepare('SELECT owner FROM sessions WHERE token_hash=? AND expires>?').bind(tokenHash,timestamp()).first();}
function sameOrigin(req){const url=new URL(req.url);if(req.headers.get('origin')!==url.origin||req.headers.get('x-coop-request')!=='1')throw error('Origen no autorizado',403);if(!req.headers.get('content-type')?.startsWith('application/json'))throw error('Solo JSON',415);}
async function handle(req,env,ctx={}){
  const url=new URL(req.url),path=url.pathname;
  if(!path.startsWith('/api/'))return env.ASSETS?env.ASSETS.fetch(req):new Response('COOP.IA: compilá los archivos estáticos.',{status:404});
  if(path==='/api/health'&&req.method==='GET')return json({apiAvailable:true,authConfigured:!!env.ADMIN_TOKEN_HASH&&!!env.DB,automationAvailable:false,version:'3.0.2'});
  // Retiro explícito: ningún acceso anterior puede iniciar automatizaciones.
  if(path.startsWith('/api/automation/'))throw error('La integración de automatización externa fue retirada.',410);
  if(!env.DB)throw error('Servidor sin D1. Modo guiado disponible.',503);
  const store=new Store(env.DB);
  if(req.method!=='GET')sameOrigin(req);
  if(path==='/api/login'&&req.method==='POST'){
    if(!env.ADMIN_TOKEN_HASH)throw error('Acceso administrador todavía no configurado',503);
    if(url.protocol!=='https:'&&env.LOCAL_DEV!=='true')throw error('Se requiere HTTPS',403);
    const ipHash=await hash(req.headers.get('cf-connecting-ip')||'local'),minute=Math.floor(Date.now()/60000);
    await store.reserve('login:'+ipHash+':'+minute,1,0,5,0,120);
    const input=await body(req,1000),h=await hash(String(input.accessCode||''));
    if(h!==env.ADMIN_TOKEN_HASH)throw error('Código incorrecto',401);
    await store.clean();const raw=token(),th=await hash(raw);
    await store.db.prepare('INSERT INTO sessions(token_hash,owner,expires) VALUES(?,?,?)').bind(th,th,timestamp()+3600).run();
    return json({role:'admin'},200,{'set-cookie':'coop_session='+raw+'; HttpOnly; SameSite=Strict; Path=/api; Max-Age=3600'+(url.protocol==='https:'?'; Secure':'')});
  }
  const auth=await authenticate(req,store);
  if(path==='/api/me'&&req.method==='GET')return json({role:auth?'admin':'visitor'});
  if(!auth)throw error('Autenticación de administrador requerida',401);
  if(path==='/api/logout'&&req.method==='POST'){await store.db.prepare('DELETE FROM sessions WHERE owner=?').bind(auth.owner).run();return json({ok:true},200,{'set-cookie':'coop_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0; Secure'});}
  if(path==='/api/providers'&&req.method==='GET')return json(await publicConfig(env,store));
  if(path==='/api/providers'&&req.method==='POST'){
    const c=await body(req,1500);assert(Object.hasOwn(MODELS,c.primary),'Proveedor no válido');assert(c.fallback===null||Object.hasOwn(MODELS,c.fallback)&&c.fallback!==c.primary,'Respaldo inválido');
    for(const [id,model]of Object.entries(c.models||{}))assert(Object.hasOwn(MODELS,id)&&MODELS[id].includes(model),'Modelo fuera de lista gratuita revisada');
    await store.set('providers',{primary:c.primary,fallback:c.fallback,authorized:[c.primary,...(c.fallback?[c.fallback]:[])],models:c.models||{gemini:MODELS.gemini[0],cloudflare:MODELS.cloudflare[0]}});return json(await publicConfig(env,store));
  }
  if(path==='/api/providers/test'&&req.method==='POST'){
    const task={id:'TEST-'+crypto.randomUUID(),usage:[]};if(!await store.lock('inference',task.id))throw error('Hay una ejecución en curso',409);
    try{const pm=new ProviderManager(env,store,task),value=await pm.call({system:'Devolvé el JSON solicitado.',input:'Respondé exactamente {"ok":true}.',schema:{type:'OBJECT',properties:{ok:{type:'BOOLEAN'}},required:['ok']}});assert(value?.ok===true,'Respuesta de conexión no válida');return json({verified:true,at:new Date().toISOString(),usage:task.usage});}finally{await store.unlock('inference',task.id);}
  }
  if(path==='/api/tasks'&&req.method==='GET'){
    const rows=await store.db.prepare('SELECT id,status,payload FROM tasks WHERE owner=? ORDER BY created DESC LIMIT 30').bind(auth.owner).all();return json({tasks:(rows.results||[]).map(x=>({...JSON.parse(x.payload),status:x.status}))});
  }
  if(path==='/api/tasks'&&req.method==='POST'){
    const input=await body(req);assert(input.consent===true,'Confirmá el envío de datos ficticios al servidor');assert(typeof input.instruction==='string'&&input.instruction.trim().length>=10&&input.instruction.length<=1200,'Consigna inválida');assert(/^[a-f0-9-]{36}$/.test(input.requestId),'ID de solicitud inválido');
    const asOf=new Date().toISOString().slice(0,10),data=snapshot(input.snapshot,asOf);
    const duplicate=await store.db.prepare('SELECT id FROM tasks WHERE owner=? AND request_id=?').bind(auth.owner,input.requestId).first();if(duplicate)throw error('Esta solicitud ya fue registrada: '+duplicate.id,409);
    const task={id:crypto.randomUUID(),mode:'real',scenario:null,instruction:input.instruction.trim(),status:'pendiente',created:new Date().toISOString(),asOf,source:'Transferencia explícita de ProCoop EDU; contactos omitidos',snapshotHash:await hash(JSON.stringify(data)),sourceSnapshot:data,events:[],analyses:{},usage:[],report:null,approval:null};
    if(!await store.lock('inference',task.id))throw error('Hay otra ejecución activa. Esperá a que termine.',409);
    try{await store.clean();await store.createTask(task,auth.owner,input.requestId);}catch(e){await store.unlock('inference',task.id);throw e;}
    const enc=new TextEncoder();let disconnected=false;
    const stream=new ReadableStream({
      start(controller){const send=(kind,value)=>{if(!disconnected)try{controller.enqueue(enc.encode('event: '+kind+'\ndata: '+JSON.stringify(value)+'\n\n'));}catch{disconnected=true;}};send('task',{id:task.id});
        const work=(async()=>{try{await execute(task,data,env,store,auth.owner,async ev=>{if(disconnected){await store.db.prepare("UPDATE tasks SET status='cancelada' WHERE id=?").bind(task.id).run();throw Object.assign(new Error('Conexión interrumpida'),{cancelled:true});}send('event',ev);});send('done',task);}catch(e){task.status=e.cancelled?'cancelada':'fallida';task.error=e.message?.slice(0,300)||'Ejecución fallida';await store.saveTask(task,auth.owner);send('failed',task);}finally{await store.unlock('inference',task.id);if(!disconnected)try{controller.close();}catch{}}})();ctx.waitUntil?.(work);
      },cancel(){disconnected=true;store.db.prepare("UPDATE tasks SET status='cancelada' WHERE id=?").bind(task.id).run().catch(()=>{});}
    });
    return new Response(stream,{headers:{...headers,'content-type':'text/event-stream; charset=utf-8','x-accel-buffering':'no'}});
  }
  const match=path.match(/^\/api\/tasks\/([a-f0-9-]{36})\/(approve|cancel)$/);
  if(match&&req.method==='POST'){
    const row=await store.task(match[1],auth.owner);if(!row)throw error('Tarea no encontrada en esta sesión',404);
    const task=JSON.parse(row.payload);
    if(match[2]==='cancel'){if(!['pendiente','ejecutando'].includes(row.status))throw error('La tarea ya terminó',409);task.status='cancelada';await store.db.prepare("UPDATE tasks SET status='cancelada',payload=?,updated=? WHERE id=? AND owner=?").bind(JSON.stringify(task),timestamp(),task.id,auth.owner).run();return json(task);}
    if(row.status!=='requiere_aprobacion')throw error('La tarea no está pendiente de aprobación',409);
    const input=await body(req,1500);assert(typeof input.note==='string'&&input.note.trim().length>=5&&input.note.length<=500,'Escribí una observación de revisión');task.approval={at:new Date().toISOString(),note:input.note.trim(),scope:'Informe y borradores revisados; no se ejecutaron cambios en ProCoop.'};task.status='completada';
    const updated=await store.db.prepare("UPDATE tasks SET status='completada',payload=?,updated=? WHERE id=? AND owner=? AND status='requiere_aprobacion' RETURNING id").bind(JSON.stringify(task),timestamp(),task.id,auth.owner).first();if(!updated)throw error('La tarea ya fue revisada',409);return json(task);
  }
  throw error('Ruta no encontrada',404);
}
export default {async fetch(req,env,ctx){try{return await handle(req,env,ctx);}catch(e){const status=e.code||400;return json({error:status>=500?'Servidor no disponible. Revisá la configuración o usá el modo guiado.':String(e.message||'Solicitud inválida').slice(0,300)},status);}}};
