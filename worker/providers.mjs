import {assert} from '../src/core.mjs';
import {timestamp} from './store.mjs';
export const MODELS={gemini:['gemini-2.5-flash-lite'],cloudflare:['@cf/meta/llama-3.1-8b-instruct-fp8']};
const cap=(v,def,max)=>Math.min(max,Math.max(1,Number(v)||def));
// Guardar sólo categorías controladas: los cuerpos de error pueden contener
// claves, URLs o información del proyecto y nunca se devuelven al navegador.
function httpFailure(status,body={}){
  const e=body?.error||{},details=Array.isArray(e.details)?e.details:[];
  const keyError=details.some(d=>['API_KEY_INVALID','API_KEY_EXPIRED','API_KEY_SERVICE_BLOCKED','API_KEY_HTTP_REFERRER_BLOCKED','API_KEY_IP_ADDRESS_BLOCKED'].includes(d?.reason))||/API key not valid|API_KEY_INVALID|API key.*(?:expired|leaked|blocked)/i.test(String(e.message||''));
  const serviceDisabled=details.some(d=>d?.reason==='SERVICE_DISABLED');
  const zeroQuota=details.some(d=>Array.isArray(d?.violations)&&d.violations.some(v=>v?.quotaValue===0||v?.quotaValue==='0'))||/limit:\s*0(?:\D|$)/i.test(String(e.message||''));
  let category='provider_error',message='Error del proveedor. Revisá el estado del servicio.';
  if(status===429){category=zeroQuota?'quota_zero':'rate_limit';message=zeroQuota?'Google informa cuota cero para este modelo/proyecto. Revisá sus límites gratuitos en AI Studio.':'Google rechazó la solicitud por límite de uso. Revisá RPM, TPM y solicitudes diarias en AI Studio.';}
  else if(keyError||status===401){category='credential';message='Google rechazó la clave API. Revisá la clave y sus restricciones en AI Studio.';}
  else if(serviceDisabled){category='service_disabled';message='La API no está habilitada en el proyecto de Google. Revisá su configuración conservando el nivel gratuito.';}
  else if(status===403){category='permission';message='Google denegó el acceso. Revisá los permisos y restricciones de la clave y del proyecto.';}
  else if(status===404){category='model_unavailable';message='Google no encontró el modelo o no está disponible para este proyecto. Revisá su disponibilidad.';}
  else if(status===402){category='billing_required';message='Google solicita facturación. Mantené el modo guiado o un proveedor gratuito autorizado.';}
  else if(status===400){category='request_invalid';message='Google rechazó los parámetros de la solicitud. Se necesita revisar la compatibilidad del adaptador.';}
  else if(status===503||status===500){category='unavailable';message='Google informó una falla o indisponibilidad temporal del servicio.';}
  return {httpStatus:status,category,message};
}
function failureOf(err){
  if(err.diagnosis)return err.diagnosis;
  if(/Illegal invocation/.test(String(err.message)))return {httpStatus:null,category:'runtime_binding',message:'Fallo de compatibilidad de la conexión en Cloudflare. Actualizá el adaptador de COOP.IA.'};
  const status=Number(err.upstream||err.status)||(/quota|rate limit|429|neuron.*limit/i.test(String(err.message))?429:0);
  if(status)return {...httpFailure(status),message:status===429?'El proveedor informó un límite de uso. Revisá su cuota gratuita.':'El proveedor rechazó la solicitud. Revisá su configuración y estado.'};
  const timedOut=err.name==='TimeoutError'||err.name==='AbortError'||/tiempo máximo/i.test(String(err.message));
  return {httpStatus:null,category:timedOut?'timeout':'response_invalid',message:timedOut?'La solicitud excedió el tiempo de espera.':'No se recibió una respuesta JSON válida o falló la conexión con el proveedor.'};
}
function responseFailure(category,message){return Object.assign(new Error(message),{diagnosis:{httpStatus:null,category,message}});}
function pauseMessage(id,failure,until){
  const why=failure?failure.message+(failure.httpStatus?' (HTTP '+failure.httpStatus+').':''):'El motivo original no quedó registrado en la versión anterior.';
  return id+': '+why+' Pausa hasta '+new Date(until).toISOString()+'.';
}
export function limits(env){return {callsPerDay:cap(env.MAX_CALLS_PER_DAY,20,50),tokensPerDay:cap(env.MAX_RESERVED_TOKENS_PER_DAY,180000,300000),callsPerTask:6,tokensPerTask:64000,maxOutput:1024,maxInputChars:10000};}
export function freeConfirmed(env){const end=Date.parse(env.FREE_TIER_REVIEW_UNTIL||'');return env.FREE_TIER_CONFIRMED==='true'&&end>Date.now()&&end<=Date.now()+32*86400000;}
export async function config(env,store){const saved=await store.get('providers',{});return {primary:saved.primary||'gemini',fallback:saved.fallback||null,models:{gemini:MODELS.gemini[0],cloudflare:MODELS.cloudflare[0],...(saved.models||{})},authorized:saved.authorized||['gemini']};}
export async function publicConfig(env,store){const cfg=await config(env,store),today=new Date().toISOString().slice(0,10),rows=await store.db.prepare('SELECT key,calls,tokens FROM limits WHERE key LIKE ?').bind('ai-day:'+today+':%').all();const providers=[];for(const id of Object.keys(MODELS)){const blockedUntil=await store.get('blocked:'+id,0),lastFailure=await store.get('failure:'+id,null),verified=await store.get('verified:'+id,null);providers.push({id,model:cfg.models[id],credentialPresent:id==='gemini'?!!env.GEMINI_API_KEY:!!env.AI,authorized:cfg.authorized.includes(id),blockedUntil,lastFailure,connectionVerified:!!verified&&verified.model===cfg.models[id]&&!lastFailure,verifiedAt:verified?.at||null});}return {configured:freeConfirmed(env),config:cfg,limits:limits(env),usage:rows.results||[],providers,freeReviewUntil:env.FREE_TIER_REVIEW_UNTIL||null};}
export class ProviderManager {
  // El fetch nativo de Workers exige su receptor global. No almacenarlo sin enlace
  // como método de esta instancia: Node lo tolera, workerd lanza Illegal invocation.
  constructor(env,store,task,{fetcher=(...args)=>globalThis.fetch(...args)}={}){this.env=env;this.store=store;this.task=task;this.fetcher=fetcher;this.adapters=new Map();this.register('gemini',this.gemini.bind(this));this.register('cloudflare',this.cloudflare.bind(this));this.usedCalls=0;this.reserved=0;}
  register(id,adapter){assert(Object.hasOwn(MODELS,id),'Proveedor no permitido');this.adapters.set(id,adapter);}
  async gemini({model,system,input,schema}){
    let r;
    try{r=await this.fetcher('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':this.env.GEMINI_API_KEY},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:input}]}],generationConfig:{temperature:0.15,maxOutputTokens:1024,responseMimeType:'application/json',responseSchema:schema,thinkingConfig:{thinkingBudget:0}}}),signal:AbortSignal.timeout(25000)});}catch(e){const d=failureOf(e);if(['timeout','runtime_binding'].includes(d.category))throw Object.assign(new Error(d.message),{diagnosis:d});throw responseFailure('network','No se pudo conectar con Google desde el servidor. No se recibió una respuesta HTTP.');}
    if(!r.ok){let body;try{body=await r.json();}catch{}throw Object.assign(new Error('Gemini devolvió HTTP '+r.status),{upstream:r.status,diagnosis:httpFailure(r.status,body)});}
    let body;try{body=await r.json();}catch{throw responseFailure('response_invalid','Google respondió, pero el cuerpo HTTP no es JSON válido.');}
    const candidate=body?.candidates?.[0];
    if(candidate?.finishReason==='MAX_TOKENS')throw responseFailure('output_limit','Gemini alcanzó el límite de salida antes de completar el JSON. Se necesita una respuesta más breve.');
    if(candidate?.finishReason!=='STOP')throw responseFailure('response_incomplete','Google respondió sin una salida completa admitida. Revisá la consigna; no se reintenta automáticamente.');
    const txt=Array.isArray(candidate.content?.parts)?candidate.content.parts.map(x=>x.text||'').join(''):'';
    if(!txt||txt.length>=16000)throw responseFailure('response_size','Google respondió sin texto o con una salida demasiado larga.');
    let value;try{value=JSON.parse(txt);}catch{throw responseFailure('model_json_invalid','Gemini respondió, pero el contenido generado no es JSON válido.');}
    const u=body.usageMetadata;return {value,usage:u?{input:u.promptTokenCount||0,output:u.candidatesTokenCount||0,total:u.totalTokenCount||0,estimated:false}:null};
  }
  async cloudflare({model,system,input}){
    assert(this.env.AI,'Workers AI no configurado');let timer;try{const body=await Promise.race([this.env.AI.run(model,{messages:[{role:'system',content:system},{role:'user',content:input}],max_tokens:1024,temperature:0.15,response_format:{type:'json_object'}}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Workers AI excedió el tiempo máximo')),25000)})]);const txt=body.response;const value=typeof txt==='string'?JSON.parse(txt):txt;assert(value,'Workers AI no devolvió JSON');const u=body.usage;return {value,usage:u?{input:u.prompt_tokens||0,output:u.completion_tokens||0,total:u.total_tokens||0,estimated:false}:null};}finally{clearTimeout(timer);}
  }
  async call({system,input,schema,onEvent=()=>{}}){
    assert(freeConfirmed(this.env),'IA desactivada: el propietario debe confirmar un plan sin facturación y su fecha de revisión');
    const cfg=await config(this.env,this.store),lim=limits(this.env);assert(input.length<=lim.maxInputChars,'Contexto excedido');
    const order=[cfg.primary,...(cfg.fallback?[cfg.fallback]:[])].filter((id,i,a)=>a.indexOf(id)===i&&cfg.authorized.includes(id));let lastError;
    for(const id of order){
      if(!this.adapters.has(id))continue;const model=cfg.models[id];assert(MODELS[id].includes(model),'Modelo no autorizado');
      if((id==='gemini'&&!this.env.GEMINI_API_KEY)||(id==='cloudflare'&&!this.env.AI))continue;
      const blockedUntil=await this.store.get('blocked:'+id,0);
      if(blockedUntil>Date.now()){lastError=new Error(pauseMessage(id,await this.store.get('failure:'+id,null),blockedUntil));continue;}
      const reserve=new TextEncoder().encode(system+input).length+lim.maxOutput;
      assert(this.usedCalls<lim.callsPerTask&&this.reserved+reserve<=lim.tokensPerTask,'Límite de tarea alcanzado');
      const day=new Date().toISOString().slice(0,10);
      // Reservas atómicas: ningún cambio de sesión, instancia o respaldo evita el límite global.
      await this.store.reserve('ai-day:'+day+':all',1,reserve,lim.callsPerDay,lim.tokensPerDay,172800);
      await this.store.reserve('ai-day:'+day+':'+id,1,reserve,lim.callsPerDay,lim.tokensPerDay,172800);
      this.usedCalls++;this.reserved+=reserve;const callId=crypto.randomUUID();
      await onEvent({type:'model',message:'Solicitud real a '+id+' / '+model,provider:id,model,callId});
      try{
        const out=await this.adapters.get(id)({model,system,input,schema});const u=out.usage||{input:Math.ceil((system.length+input.length)/3),output:Math.ceil(JSON.stringify(out.value).length/3),total:Math.ceil((system.length+input.length+JSON.stringify(out.value).length)/3),estimated:true};
        await this.log(callId,id,model,'ok',u);await this.store.set('failure:'+id,null);await this.store.set('verified:'+id,{at:new Date().toISOString(),model});const usage={callId,provider:id,model,...u,reserved:reserve};this.task.usage.push(usage);await onEvent({type:'usage',message:'Respuesta recibida; consumo '+(u.estimated?'estimado':'informado por API'),usage});return out.value;
      }catch(err){
        await this.log(callId,id,model,'error',{input:null,output:null,total:null,estimated:true});this.task.usage.push({callId,provider:id,model,status:'error',total:null,estimated:true,reserved:reserve});
        const diagnosis=failureOf(err),status=diagnosis.httpStatus,cooldown=status===429?86400000:[401,402,403,404].includes(status)?86400000:300000,until=Date.now()+cooldown;
        const failure={...diagnosis,at:new Date().toISOString(),blockedUntil:until};
        await this.store.set('failure:'+id,failure);await this.store.set('blocked:'+id,until);lastError=new Error(pauseMessage(id,failure,until));
        await onEvent({type:'provider_error',message:lastError.message,provider:id});
        if(id!==order.at(-1))await onEvent({type:'fallback',message:'Se intentará el respaldo previamente autorizado; no se reintenta el proveedor detenido.'});
      }
    }
    throw lastError||new Error('No hay un proveedor gratuito configurado y autorizado. Usá la demostración guiada.');
  }
  async log(id,provider,model,status,u){await this.store.db.prepare('INSERT INTO calls(id,task_id,provider,model,status,input_tokens,output_tokens,total_tokens,estimated,created) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,this.task.id,provider,model,status,u.input,u.output,u.total,u.estimated?1:0,timestamp()).run();}
}
