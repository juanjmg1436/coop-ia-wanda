import http from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {sqliteD1} from './sqlite.mjs';
import worker from '../worker/index.mjs';
// Node 24+. Acceso solo localhost; ningún proveedor se activa sin configuración explícita.
if(existsSync('.dev.vars'))process.loadEnvFile('.dev.vars');
const DB=sqliteD1('coopia.local.sqlite');DB.exec(readFileSync('worker/schema.sql','utf8'));
const env={...process.env,DB,LOCAL_DEV:'true',ASSETS:{async fetch(req){const p=new URL(req.url).pathname;const file=p==='/'?'/index.html':p;if(!['/index.html','/_headers','/Informe_Cobranzas.pdf','/Informe_Reclamos.pdf','/Guia_Prueba.html'].includes(file))return new Response('No encontrado',{status:404});try{return new Response(readFileSync('dist'+file),{headers:{'content-type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.pdf')?'application/pdf':file.endsWith('.json')?'application/json':'text/plain'}});}catch{return new Response('Ejecutá npm run build',{status:404});}}}};
const server=http.createServer(async(req,res)=>{try{const request=new Request('http://localhost:8787'+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:ReadableStream.from(req),duplex:'half'}:{})});const response=await worker.fetch(request,env,{waitUntil:promise=>promise.catch(()=>{})});res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body){const reader=response.body.getReader();res.on('close',()=>reader.cancel().catch(()=>{}));for(;;){const {value,done}=await reader.read();if(done)break;res.write(Buffer.from(value));}}res.end();}catch{res.writeHead(500);res.end('Error local');}});
server.listen(8787,'127.0.0.1',()=>console.log('COOP.IA disponible en http://localhost:8787 (cerrar con Ctrl+C).'));
