/* COOP.IA: dominio compartido por navegador y Worker. Sin red ni mutaciones. */
export const VERSION = '3.0.0';
export const PROFILES = [
  {id:'alex',name:'Alex',role:'Gerente General',area:'Dirección',initials:'AL',color:'#145c91',tools:['generateManagementReport'],instruction:'Interpretá la consigna, elegí el circuito y los especialistas necesarios; consolidá evidencia sin inventar cifras.',limit:'Delega y propone; no ejecuta cambios.'},
  {id:'camila',name:'Camila',role:'Atención al Socio',area:'Atención',initials:'CA',color:'#bb683d',tools:['getMembers','getMemberAccount','getTickets'],instruction:'Analizá solicitudes ficticias, clasificá reclamos y proponé respuestas empáticas basadas en registros.',limit:'No envía mensajes ni cierra reclamos.'},
  {id:'valentina',name:'Valentina',role:'Administración y Cobranzas',area:'Administración',initials:'VA',color:'#247b74',tools:['getInvoices','getPayments','getMemberAccount','calculateArrears'],instruction:'Consultá facturas y recibos; distinguí deuda, facturación, ajustes, convenios y cobros. Entregá evidencia a Mateo.',limit:'No registra pagos, cortes ni convenios.'},
  {id:'mateo',name:'Mateo',role:'Análisis Económico y Financiero',area:'Finanzas',initials:'MA',color:'#7862aa',tools:['calculateArrears','generateManagementReport'],instruction:'Interpretá los resultados de Valentina; no recalcules con el modelo ni confundas cobranza con rentabilidad.',limit:'No afirma ganancias sin datos de costos.'},
  {id:'nicolas',name:'Nicolás',role:'Operaciones Técnicas',area:'Operaciones',initials:'NI',color:'#39758a',tools:['getTickets','getWorkOrders','groupIncidents','draftWorkOrder'],instruction:'Recibí el análisis de Camila; agrupá coincidencias observadas y prepará borradores para inspección.',limit:'No confirma causas ni reparaciones sin evidencia.'},
  {id:'sofia',name:'Sofía',role:'Calidad y Planificación',area:'Calidad',initials:'SO',color:'#957038',tools:['getTickets','groupIncidents','generateManagementReport'],instruction:'Evaluá tiempos, recurrencia y oportunidades de mejora; diferenciá propuesta de compromiso real.',limit:'No promete plazos ni recursos no registrados.'}
];
export const SCENARIOS = {
  collections:'Alex, analizá la situación de cobranzas de la cooperativa, identificá los principales problemas y prepará propuestas para mejorar la recaudación.',
  incidents:'Alex, analizá los reclamos por falta de agua, identificá incidencias relacionadas y prepará un plan de intervención.'
};
export const clone = x => JSON.parse(JSON.stringify(x));
export const norm = s => String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const text = (s,max=500) => String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,max);
export function assert(ok,msg){if(!ok)throw new Error(msg);}
export function cents(n){assert(typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e9,'Importe inválido');const v=Math.round(n*100);assert(Math.abs(v/100-n)<0.000001,'Importe con más de dos decimales');return v;}
export function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
const date = (s,fallback) => {s=String(s||fallback||'').slice(0,10);assert(validDate(s),'Fecha inválida');return s;};
const identifier = s => {assert(typeof s==='string'&&/^[A-Za-z0-9_.:-]{1,80}$/.test(s),'Identificador inválido');return s;};
const arr = (d,k,max) => {assert(Array.isArray(d[k])&&d[k].length<=max,'Colección inválida: '+k);return d[k];};
export function snapshot(raw,asOf=new Date().toISOString().slice(0,10)){
  assert(raw&&typeof raw==='object','Base inválida');assert(validDate(asOf),'Fecha de corte inválida');
  const out={schema:1,asOf,source:'ProCoop EDU · copia educativa',members:[],invoices:[],payments:[],credits:[],tickets:[],orders:[],agreements:[]};
  out.members=arr(raw,'members',500).map(m=>({id:identifier(m.id),name:'Cuenta '+identifier(m.id),barrio:text(m.barrio||'Sin zona registrada',80)}));
  const ms=new Set(out.members.map(m=>m.id));assert(ms.size===out.members.length,'Socios duplicados');
  const mid=s=>{identifier(s);assert(ms.has(s),'Socio inexistente: '+s);return s;};
  out.invoices=arr(raw,'invoices',2000).map(i=>{assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(i.period),'Período inválido');cents(i.total);return {id:identifier(i.id),memberId:mid(i.memberId),period:i.period,total:i.total,status:text(i.status,30),created:date(i.created,i.period+'-20'),due:date(i.due,i.period+'-28')};});
  const im=new Map(out.invoices.map(i=>[i.id,i]));assert(im.size===out.invoices.length,'Facturas duplicadas');
  const linked=x=>{identifier(x.invoiceId);assert(im.has(x.invoiceId)&&im.get(x.invoiceId).memberId===x.memberId,'Movimiento sin factura compatible');return x.invoiceId;};
  for(const k of ['payments','credits'])out[k]=arr({...raw,[k]:raw[k]||[]},k,3000).map(p=>{cents(p.amount);return {id:identifier(p.id),memberId:mid(p.memberId),invoiceId:linked(p),amount:p.amount,created:date(p.created)};});
  out.tickets=arr(raw,'tickets',500).map(t=>({id:identifier(t.id),memberId:mid(t.memberId),type:text(t.type,80),description:text(t.description),status:text(t.status,30),created:date(t.created),...(t.closed?{closed:date(t.closed)}:{})}));
  const tm=new Map(out.tickets.map(t=>[t.id,t]));
  out.orders=arr(raw,'orders',500).map(o=>{const ticketId=o.ticketId||null;if(ticketId)assert(tm.has(ticketId)&&tm.get(ticketId).memberId===o.memberId,'Orden sin reclamo compatible');return {id:identifier(o.id),memberId:mid(o.memberId),type:text(o.type,80),status:text(o.status,30),ticketId,created:date(o.created)};});
  out.agreements=arr({...raw,agreements:raw.agreements||[]},'agreements',500).map(a=>{assert(Array.isArray(a.invoiceIds)&&a.invoiceIds.every(id=>im.has(id)&&im.get(id).memberId===a.memberId),'Convenio inválido');return {id:identifier(a.id),memberId:mid(a.memberId),invoiceIds:[...a.invoiceIds],status:text(a.status,30)};});
  for(const k of ['invoices','payments','credits','tickets','orders','agreements'])assert(new Set(out[k].map(v=>v.id)).size===out[k].length,'Identificadores duplicados en '+k);
  for(const k of ['invoices','payments','credits','tickets','orders'])assert(out[k].every(v=>v.created<=asOf),'La fecha de corte debe incluir todos los movimientos; no se reconstruyen saldos históricos');
  return out;
}
export function createTools(data){
  const d=snapshot(data,data.asOf),ms=new Map(d.members.map(m=>[m.id,m]));
  const sum=(rows,field)=>rows.reduce((s,v)=>s+cents(v[field]),0);
  const days=(a,b)=>Math.max(0,Math.floor((Date.parse(b)-Date.parse(a))/86400000));
  const paidIndex=new Map(),creditIndex=new Map();for(const p of d.payments)paidIndex.set(p.invoiceId,(paidIndex.get(p.invoiceId)||0)+cents(p.amount));for(const c of d.credits)creditIndex.set(c.invoiceId,(creditIndex.get(c.invoiceId)||0)+cents(c.amount));
  const invoices=d.invoices.map(i=>{const paid=paidIndex.get(i.id)||0,adjustment=creditIndex.get(i.id)||0,net=cents(i.total),balance=Math.max(0,net-paid);return {...i,net:net/100,gross:(net+adjustment)/100,adjustment:adjustment/100,paid:paid/100,balance:balance/100,overpayment:Math.max(0,paid-net)/100,overdue:balance>0&&i.due<d.asOf,daysLate:balance>0?days(i.due,d.asOf):0};});
  function getMembers({memberId}={}){if(memberId)assert(ms.has(memberId),'Socio no encontrado');return clone(memberId?[ms.get(memberId)]:d.members);}
  function getInvoices({memberId,period}={}){if(memberId)assert(ms.has(memberId),'Socio no encontrado');if(period)assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(period),'Período inválido');return clone(invoices.filter(i=>(!memberId||i.memberId===memberId)&&(!period||i.period===period)));}
  function getPayments({memberId}={}){if(memberId)assert(ms.has(memberId),'Socio no encontrado');return clone(d.payments.filter(p=>!memberId||p.memberId===memberId));}
  function getMemberAccount({memberId}){assert(ms.has(memberId),'Socio no encontrado');const list=getInvoices({memberId});return {member:getMembers({memberId})[0],invoices:list,payments:getPayments({memberId}),agreements:clone(d.agreements.filter(a=>a.memberId===memberId)),balance:sum(list,'balance')/100};}
  function calculateArrears(){
    const net=sum(invoices,'net'),gross=sum(invoices,'gross'),adjustments=sum(invoices,'adjustment'),collected=sum(d.payments,'amount'),outstanding=sum(invoices,'balance'),overpayment=sum(invoices,'overpayment'),overdue=sum(invoices.filter(i=>i.overdue),'balance');
    const periods=[...new Set([...invoices.map(i=>i.period),...d.payments.map(p=>p.created.slice(0,7))])].sort().map(period=>{const rows=invoices.filter(i=>i.period===period);return {period,billed:sum(rows,'net')/100,paidForInvoices:sum(rows,'paid')/100,cashReceived:sum(d.payments.filter(p=>p.created.slice(0,7)===period),'amount')/100,outstanding:sum(rows,'balance')/100};});
    const top=d.members.map(m=>{const rows=invoices.filter(i=>i.memberId===m.id);return {...m,balance:sum(rows,'balance')/100,overdue:sum(rows.filter(i=>i.overdue),'balance')/100,maxDays:Math.max(0,...rows.map(i=>i.daysLate)),invoiceIds:rows.filter(i=>i.balance>0).map(i=>i.id)};}).filter(m=>m.balance>0).sort((a,b)=>b.overdue-a.overdue||b.balance-a.balance);
    const warnings=invoices.filter(i=>(norm(i.status)==='pagada'&&i.balance>0)||(norm(i.status)==='pendiente'&&i.balance===0)).map(i=>'Estado y movimientos no coinciden: '+i.id);
    assert(gross-adjustments-collected===outstanding-overpayment,'No concilia el saldo');
    return {asOf:d.asOf,grossBilled:gross/100,adjustments:adjustments/100,totalBilled:net/100,totalCollected:collected/100,outstanding:outstanding/100,overpayment:overpayment/100,overdue:overdue/100,pendingCount:invoices.filter(i=>i.balance>0).length,overdueCount:invoices.filter(i=>i.overdue).length,invoiceCount:invoices.length,arrearsRate:net?+(overdue/net*100).toFixed(2):null,collectionRate:net?+(collected/net*100).toFixed(2):null,agreementBalance:sum(invoices.filter(i=>i.status==='En convenio'),'balance')/100,periods,top,warnings,formula:'Morosidad por importe = saldo vencido / facturación neta × 100. Vencida: fecha de vencimiento anterior al corte. Facturación neta = total actual de las facturas; ya incluye ajustes. Los convenios no son cobros.',reconciliation:'Facturación bruta − notas de crédito − recibos = saldo pendiente − saldo a favor.'};
  }
  function getTickets({waterOnly=false,openOnly=false}={}){return clone(d.tickets.filter(t=>(!openOnly||!['resuelto','cerrado'].includes(norm(t.status)))&&(!waterOnly||/fuga|presion|agua|corte de servicio/.test(norm(t.type+' '+t.description)))).map(t=>({...t,barrio:ms.get(t.memberId).barrio,ageDays:days(t.created,t.closed||d.asOf)})));}
  function getWorkOrders(){return clone(d.orders);}
  function groupIncidents(){
    const rows=getTickets({waterOnly:true,openOnly:true}),groups=[];
    for(const t of rows.sort((a,b)=>a.created.localeCompare(b.created))){let g=groups.find(g=>g.zone===t.barrio&&days(g.firstDate,t.created)<=2);if(!g){g={id:'INC-'+String(groups.length+1).padStart(3,'0'),zone:t.barrio,firstDate:t.created,ticketIds:[],memberIds:[],maxAgeDays:0};groups.push(g);}g.ticketIds.push(t.id);if(!g.memberIds.includes(t.memberId))g.memberIds.push(t.memberId);g.maxAgeDays=Math.max(g.maxAgeDays,t.ageDays);}
    return groups.map(g=>({...g,suggestedPriority:g.ticketIds.length>=2||g.maxAgeDays>=7?'Alta':'Media',reason:g.ticketIds.length>=2?'Coinciden barrio y fechas dentro de 48 h':g.maxAgeDays>=7?'Reclamo abierto hace al menos 7 días':'Verificación técnica pendiente',relation:g.ticketIds.length>=2?'Coincidencia territorial y temporal; causa común no confirmada':'Registro individual; no hay relación comprobada',existingOrders:d.orders.filter(o=>g.ticketIds.includes(o.ticketId)).map(o=>o.id)}));
  }
  function draftWorkOrder({groupId}){const g=groupIncidents().find(g=>g.id===groupId);assert(g,'Grupo inexistente');return {id:'BOR-'+g.id,status:'Borrador',groupId,zone:g.zone,ticketIds:g.ticketIds,memberIds:g.memberIds,priority:g.suggestedPriority,title:'Inspección del suministro de agua',description:'Verificar en campo los reclamos '+g.ticketIds.join(', ')+'. No se confirma avería ni reparación.',resources:'A definir por responsable técnico después de la inspección. Sin inventario ni dotación registrados.',existingOrders:g.existingOrders,requiresApproval:true};}
  function generateManagementReport({scenario}){assert(['collections','incidents'].includes(scenario),'Escenario no admitido');return scenario==='collections'?{scenario,metrics:calculateArrears(),ledger:getInvoices()}:{scenario,tickets:getTickets({waterOnly:true,openOnly:true}),groups:groupIncidents(),orders:getWorkOrders(),drafts:groupIncidents().filter(g=>!g.existingOrders.length).map(g=>draftWorkOrder({groupId:g.id}))};}
  return Object.freeze({getMembers,getMemberAccount,getInvoices,getPayments,calculateArrears,getTickets,getWorkOrders,groupIncidents,generateManagementReport,draftWorkOrder});
}
export function runTool(agent,name,args,data,cachedTools){const p=PROFILES.find(p=>p.id===agent);assert(p&&p.tools.includes(name),'Herramienta no autorizada para '+agent);const tools=cachedTools||createTools(data);assert(Object.hasOwn(tools,name),'Herramienta inexistente');return tools[name](args||{});}
export function evidenceIds(data){return new Set([...data.members,...data.invoices,...data.payments,...data.credits,...data.tickets,...data.orders].map(v=>v.id).concat(['METRICS','PERIODS','GROUPS']));}
export function validateAnalysis(value,data){
  assert(value&&typeof value==='object'&&!Array.isArray(value),'Respuesta de modelo inválida');
  assert(typeof value.summary==='string'&&value.summary.length>0&&value.summary.length<=1600,'Resumen inválido');
  const out={summary:value.summary};
  for(const k of ['findings','recommendations','limitations']){assert(Array.isArray(value[k])&&value[k].length<=6,k+' inválido');out[k]=value[k].map(v=>{assert(typeof v==='string'&&v.length<=650,'Texto de respuesta demasiado largo');return v;});}
  const ids=evidenceIds(data);assert(Array.isArray(value.evidence)&&value.evidence.length<=12&&value.evidence.every(id=>ids.has(id)),'Referencias inexistentes en respuesta');out.evidence=[...new Set(value.evidence)];
  let narrative=[out.summary,...out.findings,...out.recommendations,...out.limitations].join(' ');
  for(const id of ids)narrative=narrative.split(id).join('');
  assert(!/[0-9$%]/.test(narrative),'La narrativa del modelo contiene cifras no verificadas. Las cifras deben permanecer en las tablas calculadas.');
  return out;
}
export function guidedRun(data,scenario){
  const tools=createTools(data),report=tools.generateManagementReport({scenario}),events=[];
  const add=(agent,type,message,extra={})=>events.push({seq:events.length+1,at:new Date().toISOString(),agent,type,message,mode:'guided',...extra});
  add('alex','route','Recorrido guiado predefinido: '+(scenario==='collections'?'cobranzas':'reclamos'));
  const analyses={};
  if(scenario==='collections'){
    const m=report.metrics;add('valentina','tool','Consulta de facturas y recibos; cálculo en centavos',{tool:'calculateArrears',result:{invoices:m.invoiceCount,pending:m.pendingCount}});
    analyses.valentina={summary:'Las cifras se obtienen de facturas y recibos de esta copia de ProCoop. Los convenios mantienen deuda.',findings:['El saldo se calcula por factura a partir de sus movimientos, no solo de su etiqueta de estado.'],recommendations:['Conciliar recibos y notas de crédito antes de iniciar acciones de cobranza.'],limitations:m.warnings,evidence:['METRICS']};
    add('valentina','handoff','Valentina entrega a Mateo los indicadores y las referencias',{to:'mateo',evidence:['METRICS','PERIODS']});
    analyses.mateo={summary:m.outstanding>0?'Existe saldo pendiente. La recuperación debe analizarse por antigüedad y por cuenta.':'No se registra saldo pendiente en esta copia.',findings:['La evolución separa facturación del período, pagos aplicados y efectivo recibido por fecha.','No hay datos suficientes para estimar utilidad o rentabilidad.'],recommendations:['Revisar primero las cuentas con mayor saldo vencido.','Proponer recordatorios y alternativas de regularización para revisión humana.'],limitations:['No se pronostica recaudación futura.'],evidence:['METRICS','PERIODS']};
    add('mateo','result','Interpretación guiada de liquidez y límites del análisis');
  }else{
    add('camila','tool','Lectura de reclamos abiertos y sus zonas',{tool:'getTickets',result:{tickets:report.tickets.length}});
    analyses.camila={summary:'Se seleccionaron reclamos abiertos relacionados con agua.',findings:['La zona procede del barrio registrado para cada cuenta.'],recommendations:['Verificar el alcance con cada socio antes de comunicar una causa.'],limitations:['Las descripciones son reportes de usuarios ficticios, no diagnósticos.'],evidence:report.tickets.slice(0,8).map(t=>t.id)};
    add('camila','handoff','Camila transfiere los reclamos a Nicolás',{to:'nicolas'});
    add('nicolas','tool','Agrupación por barrio y ventana de 48 horas',{tool:'groupIncidents',result:{groups:report.groups.length}});
    analyses.nicolas={summary:'Las coincidencias orientan una inspección. No prueban que exista una avería común.',findings:['Se revisan órdenes existentes para evitar duplicar intervenciones.'],recommendations:['Revisar los borradores y asignar recursos después de verificar disponibilidad.'],limitations:['No hay mapa hidráulico ni inventario de materiales.'],evidence:['GROUPS']};
    add('nicolas','handoff','Nicolás entrega prioridades y borradores a Sofía',{to:'sofia'});
    analyses.sofia={summary:'La prioridad sugerida considera antigüedad y cantidad de reclamos coincidentes.',findings:['Una solicitud abierta durante siete días o más recibe prioridad alta según la regla educativa.'],recommendations:['Registrar la inspección y volver a contactar al socio antes de cerrar el reclamo.'],limitations:['No se puede calcular cumplimiento de plazos contractuales: no hay SLA registrado.'],evidence:['GROUPS']};
    add('sofia','result','Revisión guiada de prioridades y seguimiento');
  }
  analyses.alex={summary:scenario==='collections'?'Revisar la deuda vencida, conciliar registros y acordar acciones de cobranza con intervención humana.':'Revisar las incidencias y autorizar únicamente los borradores que correspondan. La inspección debe confirmar el diagnóstico.',findings:[],recommendations:scenario==='collections'?['Usar los indicadores y el detalle de facturas para justificar cada decisión.']:['Mantener abiertos los reclamos hasta verificar la resolución.'],limitations:['Demostración guiada: no se ejecutó inteligencia artificial.'],evidence:scenario==='collections'?['METRICS']:['GROUPS']};
  add('alex','result','Informe consolidado pendiente de revisión humana');
  return {id:'GUIA-'+Date.now().toString(36),mode:'guided',scenario,status:'requiere_aprobacion',created:new Date().toISOString(),asOf:data.asOf,source:data.source,sourceSnapshot:clone(data),events,analyses,report,usage:[],approval:null};
}
export function reportLines(run){
  const cash=n=>'$ '+Number(n).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}),r=run.report;
  const lines=[{kind:'title',text:r.scenario==='collections'?'Informe de cobranzas':'Plan de intervención'}, {kind:'sub',text:'COOP.IA / ProCoop EDU - Wanda, Misiones'}, {kind:'note',text:run.mode==='real'?'IA REAL - Propuestas sujetas a revisión humana':'DEMOSTRACIÓN GUIADA. No se está ejecutando inteligencia artificial en tiempo real.'},{kind:'text',text:'Corte: '+run.asOf+' | Tarea: '+run.id+' | Estado: '+({requiere_aprobacion:'Requiere aprobación',completada:'Completada',fallida:'Fallida',cancelada:'Cancelada'}[run.status]||run.status)},{kind:'text',text:'Origen: '+run.source},{kind:'text',text:'Datos ficticios. Prototipo educativo independiente y no oficial.'}];
  if(r.metrics){const m=r.metrics;lines.push({kind:'heading',text:'Indicadores verificables'});for(const [label,val]of [['Facturación bruta',m.grossBilled],['Notas de crédito',m.adjustments],['Facturación neta',m.totalBilled],['Cobros registrados',m.totalCollected],['Saldo pendiente',m.outstanding],['Saldo vencido',m.overdue],['Saldo a favor',m.overpayment],['Saldo en convenio',m.agreementBalance]])lines.push({kind:'text',text:label+': '+cash(val)});
    lines.push({kind:'text',text:'Facturas pendientes: '+m.pendingCount+' | Vencidas: '+m.overdueCount+' | Morosidad: '+(m.arrearsRate===null?'No aplicable':m.arrearsRate.toLocaleString('es-AR')+'%')},{kind:'note',text:m.formula},{kind:'note',text:m.reconciliation},{kind:'heading',text:'Evolución por período'});
    m.periods.forEach(p=>lines.push({kind:'text',text:p.period+' | Facturado: '+cash(p.billed)+' | Cobros por fecha: '+cash(p.cashReceived)+' | Saldo: '+cash(p.outstanding)}));
    lines.push({kind:'heading',text:'Cuentas con saldo pendiente'});m.top.forEach(a=>lines.push({kind:'text',text:a.id+' / '+a.barrio+' | Saldo: '+cash(a.balance)+' | Vencido: '+cash(a.overdue)+' | Atraso máx.: '+a.maxDays+' días'}));
  }else{lines.push({kind:'heading',text:'Reclamos y agrupaciones'});r.tickets.forEach(t=>lines.push({kind:'text',text:t.id+' / '+t.memberId+' / '+t.barrio+' / '+t.type+' / '+t.ageDays+' días abierto'}));r.groups.forEach(g=>lines.push({kind:'text',text:g.id+' / '+g.zone+' / '+g.ticketIds.join(', ')+' / Prioridad '+g.suggestedPriority+'. '+g.reason+'. '+g.relation}));lines.push({kind:'heading',text:'Órdenes en borrador'});r.drafts.forEach(d=>lines.push({kind:'text',text:d.id+' / '+d.zone+' / '+d.description+' Recursos: '+d.resources}));if(!r.drafts.length)lines.push({kind:'text',text:'No se requieren borradores adicionales según los registros analizados.'});}
  for(const [id,a]of Object.entries(run.analyses)){lines.push({kind:'heading',text:PROFILES.find(p=>p.id===id)?.name||id},{kind:'text',text:a.summary});for(const [k,label]of [['findings','Hallazgo'],['recommendations','Propuesta'],['limitations','Límite']])a[k].forEach(t=>lines.push({kind:'text',text:label+': '+t}));lines.push({kind:'note',text:'Evidencia: '+a.evidence.join(', ')});}
  if(r.ledger){lines.push({kind:'heading',text:'Anexo: conciliación por factura'});r.ledger.forEach(i=>lines.push({kind:'text',text:i.id+' / '+i.memberId+' | Neto '+cash(i.net)+' | Cobrado '+cash(i.paid)+' | Saldo '+cash(i.balance)}));}
  lines.push({kind:'heading',text:'Trazabilidad'});run.events.forEach(ev=>lines.push({kind:'text',text:ev.seq+'. '+ev.agent+' / '+ev.type+': '+ev.message}));
  if(run.snapshotHash)lines.push({kind:'note',text:'SHA-256 del conjunto transferido: '+run.snapshotHash});
  if(run.approval)lines.push({kind:'text',text:'Revisión registrada: '+run.approval.at+'. '+run.approval.note});
  return lines;
}
