// Ejecutar después de extraer la actualización. No modifica D1, secretos ni wrangler.jsonc.
// Conserva copia local de cada archivo retirado antes de eliminarlo.
import {copyFile,mkdir,lstat,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const backup=path.join(root,'artifacts','respaldo-integracion-'+new Date().toISOString().replace(/[:.]/g,'-'));
const obsolete=['worker/automation.mjs','scripts/n8n-workflows.mjs','tests/automation.test.mjs','docs/Guia_n8n.html','dist/Guia_n8n.html','dist/COOPIA_Actualizar_n8n.zip','integrations/n8n/COOPIA_Cobranzas.json','integrations/n8n/COOPIA_Reclamos.json','dist/n8n/COOPIA_Cobranzas.json','dist/n8n/COOPIA_Reclamos.json'];
let removed=0;
for(const relative of obsolete){
  const source=path.join(root,relative);
  let info;try{info=await lstat(source);}catch(e){if(e.code==='ENOENT')continue;throw e;}
  if(!info.isFile()||info.isSymbolicLink())throw new Error('Archivo no regular; revisar manualmente: '+relative);
  const destination=path.join(backup,relative);await mkdir(path.dirname(destination),{recursive:true});
  await copyFile(source,destination);await unlink(source);removed++;
}
console.log(removed?'Archivos anteriores retirados: '+removed+'. Respaldo: '+backup:'No quedan archivos de la integración anterior.');
console.log('Configuración y secretos conservados. Siguiente paso: npx wrangler@4 deploy');
