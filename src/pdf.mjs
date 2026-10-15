import {FONTS} from './fonts.mjs';
// PDF 1.4 autónomo, con fuentes PDF estándar y codificación WinAnsi.
// No usa servicios externos ni bibliotecas cargadas desde CDN.
function latin(s){return String(s).replace(/[−–—]/g,'-').replace(/×/g,'x').replace(/→/g,'>').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/…/g,'...').replace(/[^\x20-\x7e\xa0-\xff]/g,' ');}
const literal=s=>latin(s).replace(/([\\()])/g,'\\$1');
function width(s,size){return [...latin(s)].reduce((n,ch)=>n+Math.max(FONTS.regular.widths[ch.charCodeAt(0)-32]||600,FONTS.bold.widths[ch.charCodeAt(0)-32]||600)*size/1000,0);}
function wrap(text,size,max=487){const words=latin(text).split(/\s+/),lines=[];let current='';for(let word of words){while(width(word,size)>max){let n=Math.floor(max/(size*.7));while(width(word.slice(0,n),size)>max)n--;if(current){lines.push(current);current='';}lines.push(word.slice(0,n));word=word.slice(n);}const next=current?current+' '+word:word;if(width(next,size)>max){lines.push(current);current=word;}else current=next;}if(current)lines.push(current);return lines;}
export function makePDF(records){
  const pages=[];let ops='',y=733,page=0;
  const write=(text,x,yy,size=10,bold=false,color='0.13 0.22 0.29')=>{ops+=`${color} rg BT /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${x} ${yy} Tm (${literal(text)}) Tj ET\n`;};
  const start=()=>{page++;ops='';ops+='0.065 0.19 0.29 rg 0 768 595 74 re f\n';write('COOP.IA',50,803,22,true,'1 1 1');write('CENTRO INTELIGENTE DE GESTIÓN COOPERATIVA',50,783,8,false,'0.73 0.86 0.90');y=735;};
  const finish=()=>{ops+='0.81 0.86 0.89 RG 50 52 m 545 52 l S\n';write('ProCoop EDU / Datos ficticios / Independiente y no oficial',50,36,8,false,'0.40 0.49 0.55');write('Página '+page,496,36,8,false,'0.40 0.49 0.55');pages.push(ops);};
  start();
  for(const rec of records){const kind=rec.kind||'text',size=kind==='title'?23:kind==='heading'?13:kind==='sub'?11:kind==='note'?9:10,leading=size*1.35,bold=['title','heading'].includes(kind),space=kind==='title'?13:kind==='heading'?10:5,lines=wrap(rec.text,size);if(y<90+(kind==='heading'?55:leading)){finish();start();}if(kind==='heading'){y-=10;ops+=`0.12 0.48 0.51 rg 50 ${y-3} 3 17 re f\n`;}
    for(const ln of lines){if(y-leading<72){finish();start();}write(ln,kind==='heading'?60:50,y,size,bold,kind==='note'?'0.35 0.44 0.50':'0.13 0.22 0.29');y-=leading;}y-=space;
  }
  finish();
  const objects=[];const add=v=>{objects.push(v);return objects.length;};
  add('<< /Type /Catalog /Pages 2 0 R >>');add('');add('');add('');
  for(const [key,fontId] of [['regular',3],['bold',4]]){const f=FONTS[key],bytes=atob(f.data),stream=add(`<< /Length ${bytes.length} /Length1 ${bytes.length} >>\nstream\n${bytes}\nendstream`),descriptor=add(`<< /Type /FontDescriptor /FontName /${f.name} /Flags 32 /FontBBox [${f.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${f.ascent} /Descent ${f.descent} /CapHeight ${f.ascent} /StemV 80 /FontFile2 ${stream} 0 R >>`);objects[fontId-1]=`<< /Type /Font /Subtype /TrueType /BaseFont /${f.name} /FirstChar 32 /LastChar 255 /Widths [${f.widths.join(' ')}] /FontDescriptor ${descriptor} 0 R /Encoding /WinAnsiEncoding >>`;}

  const ids=[];for(const content of pages){const streamId=add(`<< /Length ${content.length} >>\nstream\n${content}endstream`);ids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`));}objects[1]=`<< /Type /Pages /Kids [${ids.map(id=>id+' 0 R').join(' ')}] /Count ${ids.length} >>`;
  let pdf='%PDF-1.4\n%\xe2\xe3\xcf\xd3\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});const xref=pdf.length;pdf+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'+offsets.slice(1).map(v=>String(v).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';return Uint8Array.from(pdf,ch=>ch.charCodeAt(0));
}
