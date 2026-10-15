import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {snapshot,guidedRun,reportLines} from '../src/core.mjs';
import {makePDF} from '../src/pdf.mjs';
const original=await readFile(new URL('../original/ProCoop_Wanda_Original.html',import.meta.url),'utf8');
const source=original.match(/<script>\s*'use strict';([\s\S]*?)function loadDB/)[1];
const data=snapshot(JSON.parse(JSON.stringify(vm.runInNewContext(source+';makeSeed()'))),'2026-10-11');
for(const [scenario,name]of [['collections','Cobranzas'],['incidents','Reclamos']]){
 const task=guidedRun(data,scenario);task.id='MUESTRA-'+name.toUpperCase()+'-20261011';task.created='2026-10-11T14:32:46Z';task.events.forEach(e=>e.at=task.created);
 await writeFile(new URL('../dist/Informe_'+name+'.pdf',import.meta.url),makePDF(reportLines(task)));
}
console.log('Dos informes de muestra generados desde la base original; modo guiado, corte 2026-10-11.');
