// Contrato real del runtime, respuesta de prueba interna. No llama a Google.
import {ProviderManager} from './worker/providers.mjs';
export default {async fetch(){
  const old = {fetcher: globalThis.fetch};
  let legacyError;
  try {await old.fetcher('https://fixture.test/');} catch(e) {legacyError=e.message;}
  try {
    const pm=new ProviderManager({GEMINI_API_KEY:'fixture-only'},null,{usage:[]});
    const result=await pm.gemini({model:'gemini-2.5-flash-lite',system:'Contrato de prueba',input:'fixture',schema:{type:'OBJECT'}});
    return Response.json({ok:result.value.ok===true,legacyRejected:/Illegal invocation/.test(legacyError),realAI:false});
  } catch(e) {return Response.json({ok:false,error:e.message,legacyError,realAI:false},{status:500});}
}};
