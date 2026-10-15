export default {async fetch(req){
  if(req.method!=='POST'||req.headers.get('x-goog-api-key')!=='fixture-only')return new Response('Contrato inválido',{status:400});
  const input=await req.json();
  if(input.generationConfig.responseMimeType!=='application/json')return new Response('Falta JSON',{status:400});
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:3,totalTokenCount:13}});
}};
