/* Ma bibliothèque — « Prochaines sorties » : module partagé entre l'application (navigateur) et l'action GitHub hebdomadaire.
   Sources ouvertes et légitimes uniquement : Wikipédia (API MediaWiki, modèle {{TomeBD}} + infobox) et catalogue BnF (SRU, Licence Ouverte).
   Aucune donnée personnelle ici : les séries viennent de la bibliothèque de l'utilisateur au moment de l'exécution. */
(function(root,factory){ const M=factory(); if(typeof module==='object'&&module.exports) module.exports=M; else root.MBRel=M; })(typeof self!=='undefined'?self:this,function(){
'use strict';
const VERSION=1, FILE='ma-bibliotheque-releases.json', DATA_FILE='ma-bibliotheque-data.json', LIBS=['l1','l2'];
const WP_API='https://fr.wikipedia.org/w/api.php', WP_PAGE='https://fr.wikipedia.org/wiki/', BNF_SRU='https://catalogue.bnf.fr/api/SRU';
const UA='MaBibliotheque/1.0 (https://github.com/Blood63/ma-bibliotheque; prochaines sorties, 1 requête à la fois)';

/* Clés de série : copie exacte de l'application (test d'égalité dans la suite de tests). */
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const BK=new Map();
function baseKey(s){ s=String(s||''); let k=BK.get(s); if(k!==undefined){ BK.delete(s); BK.set(s,k); return k; }
  let t=norm(s).replace(/×/g,' x ').replace(/&/g,' et ').replace(/[’'`´]/g,' ');
  t=t.replace(/\b(?:edition originale|ed\.? originale|nouvelle edition|edition francaise)\b/g,' ');
  t=t.replace(/[\s,.:;\-–—(]*\b(?:tome|t|vol|volume|n|no|numero)\.?\s*\d{1,4}\)?\s*$/,'');
  k=t.replace(/[^a-z0-9]+/g,''); if(!k) k=norm(s).replace(/\s+/g,' ');
  if(BK.size>=5000){ let n=BK.size-4000; for(const o of BK.keys()){ if(n--<=0) break; BK.delete(o); } }
  BK.set(s,k); return k; }
function serKey(db,s,lib){ let k=baseKey(s); const al=db&&db.serAlias; if(!al) return k;
  for(let i=0;i<6;i++){ const a=al[lib+'|'+k]; if(!a||!a.to) break; const n=baseKey(a.to); if(n===k) break; k=n; } return k; }
const artKey=s=>baseKey(String(s||'').replace(/^\s*(?:les?|la|l['’]|the|un|une|des)\s*/i,''));
const loose=s=>String(s||'').replace(/\b[nN](?:°|º|o\.|r\.?)\s*(?=\d)/g,'no ').replace(/\b[nN]o\s*(?=\d)/g,'no ');
const sameSeries=(a,b)=>{ const x=baseKey(a), y=baseKey(b); return !!x&&(x===y||artKey(a)===artKey(b)||baseKey(loose(a))===baseKey(loose(b))||artKey(loose(a))===artKey(loose(b))); };
const SER_QUAL=/^(?:saga|origines?|next|gold|kids|legacy|chroniques?|chronicles|univers|generations?|returns?|reborn|zero|z[ée]ro|side story|spin-?off|aventures|missions?|l[ée]gendes?|hors-s[ée]rie)$/i;
const capF=s=>s?s[0].toUpperCase()+s.slice(1):s;

/* ISBN */
function isbnClean(s){ return String(s||'').toUpperCase().replace(/[^0-9X]/g,''); }
function isbnOk13(s){ if(!/^\d{13}$/.test(s)) return false; let t=0; for(let i=0;i<13;i++) t+=(+s[i])*(i%2?3:1); return t%10===0; }
function isbn13(s){ s=isbnClean(s); if(/^\d{9}[\dX]$/.test(s)){ let t=0; for(let i=0;i<10;i++) t+=(s[i]==='X'?10:+s[i])*(10-i); if(t%11) return ''; const b='978'+s.slice(0,9); let u=0; for(let i=0;i<12;i++) u+=(+b[i])*(i%2?3:1); return b+((10-u%10)%10); } return isbnOk13(s)?s:''; }
function isbn10(i13){ if(!/^978\d{10}$/.test(i13)) return ''; const s=i13.slice(3,12); let t=0; for(let i=0;i<9;i++) t+=(10-i)*+s[i]; const c=(11-t%11)%11; return s+(c===10?'X':String(c)); }
function covers(isbn){ const i=isbn13(isbn); if(!i) return []; const o=['https://covers.openlibrary.org/b/isbn/'+i+'-M.jpg?default=false']; const t=isbn10(i); if(t) o.push('https://images-na.ssl-images-amazon.com/images/P/'+t+'.01.LZZZZZZZ.jpg'); return o; }

/* Dates : « {{date|3|décembre|2021}} », « {{date|8 avril 2026}} », « {{Date|1er|novembre|2024}} », « {{date|2026}} », texte libre. → {d:'AAAA-MM-JJ'|'AAAA-MM'|'AAAA', p:'d'|'m'|'y'} */
const MOIS={janvier:1,janv:1,fevrier:2,fevr:2,fev:2,mars:3,avril:4,avr:4,mai:5,juin:6,juillet:7,juil:7,aout:8,septembre:9,sept:9,octobre:10,oct:10,novembre:11,nov:11,decembre:12,dec:12};
function stripRefs(s){ return String(s||'').replace(/<ref[^>]*\/>/gi,'').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi,'').replace(/<!--[\s\S]*?-->/g,''); }
function wDate(s){ s=stripRefs(s); const m=s.match(/\{\{\s*date\s*\|([^{}]*)\}\}/i); let txt=m?m[1].split('|').filter(x=>!x.includes('=')).join(' '):s.replace(/<[^>]+>/g,' ').replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g,'$1');
  const toks=norm(txt).replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(Boolean); let y=0,mo=0,d=0;
  for(let i=0;i<toks.length;i++){ const t=toks[i]; if(!y&&/^(19|20)\d\d$/.test(t)) { y=+t; continue; } if(!mo&&MOIS[t]) { mo=MOIS[t]; continue; } const n=t==='1er'?1:(/^\d{1,2}(er)?$/.test(t)?parseInt(t,10):0); if(!d&&!mo&&n>=1&&n<=31) d=n; }
  if(!y) return null; const p2=n=>String(n).padStart(2,'0');
  if(mo&&d) return {d:y+'-'+p2(mo)+'-'+p2(d),p:'d'}; if(mo) return {d:y+'-'+p2(mo),p:'m'}; return {d:String(y),p:'y'}; }

/* Wikitexte : blocs de modèle équilibrés + paramètres de premier niveau */
function tplBlocks(t,name){ const out=[]; const re=new RegExp('\\{\\{\\s*'+name.replace(/[.*+?^${}()|[\]\\\/]/g,'\\$&')+'\\s*(?=[|}\\n])','gi'); let m;
  while((m=re.exec(t))){ let i=m.index, depth=0, j=i; for(;j<t.length-1;j++){ if(t[j]==='{'&&t[j+1]==='{'){ depth++; j++; } else if(t[j]==='}'&&t[j+1]==='}'){ depth--; j++; if(!depth) break; } }
    out.push(t.slice(m.index+m[0].length,j-1)); re.lastIndex=j; } return out; }
function tplParams(body){ const o={}; let depth=0, cur='', parts=[];
  for(let i=0;i<body.length;i++){ const c=body[i], n=body[i+1]; if((c==='{'&&n==='{')||(c==='['&&n==='[')){ depth++; cur+=c+n; i++; continue; } if((c==='}'&&n==='}')||(c===']'&&n===']')){ depth--; cur+=c+n; i++; continue; }
    if(c==='|'&&depth<=0){ parts.push(cur); cur=''; continue; } cur+=c; } parts.push(cur);
  for(const p of parts){ const k=p.indexOf('='); if(k>0){ o[norm(p.slice(0,k)).replace(/\s+/g,'_')]=p.slice(k+1).trim(); } } return o; }
/* Liste des tomes ({{TomeBD}}) : colonne française repérée par l'en-tête (langue_1 / langue_2) */
function parseTomes(t){ const vols={}; let fr=2, orig=1; const hd=tplBlocks(t,'TomeBD/Entête')[0];
  if(hd){ const h=tplParams(hd); const l1=norm(h.langue_1||''), l2=norm(h.langue_2||''); if(norm(h.langage_unique||'')==='oui'){ fr=1; orig=0; } else if(l1.startsWith('fran')){ fr=1; orig=2; } else if(l2.startsWith('fran')||!l2){ fr=2; orig=1; } else { fr=0; orig=1; } }
  for(const b of tplBlocks(t,'TomeBD')){ const p=tplParams(b); const vm=String(p.volume||'').match(/\d+/); if(!vm) continue; const v=+vm[0]; if(!(v>0&&v<2000)) continue;
    const uniq=norm(p.langage_unique||'')==='oui'; const fc=uniq&&!hd?1:fr, oc=uniq&&!hd?0:orig;
    const o={v}; if(fc){ const d=wDate(p['sortie_'+fc]); if(d){ o.fr=d.d; o.fp=d.p; } const i=isbn13(p['isbn_'+fc]); if(i) o.isbn=i; }
    if(oc){ const j=wDate(p['sortie_'+oc]); if(j) o.jp=j.d; }
    if(o.fr||o.isbn||o.jp) vols[v]=Object.assign(vols[v]||{},o); }
  return vols; }
/* Statut (terminée / en cours) d'après l'infobox */
function parseInfobox(t){ for(const b of tplBlocks(t,'Infobox Animation et bande dessinée asiatiques/Livre')){ const p=tplParams(b); const f=norm(p.format||''); if(f&&!/bd|manga|manhwa|manhua/.test(f)) continue;
    const last=stripRefs(p.dernier_volume||'').replace(/\s+/g,''); const nb=parseInt(String(p.nb_volumes||'').replace(/[^\d]/g,''),10)||null;
    return {status:last&&!/^[-—?]$/.test(last)?'terminee':'encours',nb}; }
  for(const b of tplBlocks(t,'Infobox Bande dessinée')){ const p=tplParams(b); const s=norm(stripRefs(p.statut||p.etat||p.situation||'')); const nb=parseInt(String(p.nombre_albums||p.albums||'').replace(/[^\d]/g,''),10)||null;
    if(/termin|fini|achev/.test(s)) return {status:'terminee',nb}; if(/en cours|cours/.test(s)) return {status:'encours',nb}; if(nb) return {status:null,nb}; }
  return null; }
function titleKey(t){ return String(t||'').replace(/^liste des (?:chapitres|volumes|tomes|albums)\s+(?:de la |de l['’]|du |des |de |d['’])?/i,'').replace(/\s*\([^)]*\)\s*/g,' ').trim(); }
const words=s=>norm(loose(s)).replace(/[^a-z0-9]+/g,' ').trim();

/* --- Réessais réseau (partagé navigateur + tâche Node) ---
   Erreurs temporaires seulement : réseau, HTTP 429/503. 3 essais max,
   attente exponentielle (base 450 ms, plafond 4 s) + jitter ; un 404/autre HTTP ne sont jamais réessayés.
   ctx.sleep / ctx.retryBase permettent aux tests de contrôler le temps. */
function retryStatus(e){ if(!e) return 0; if(+e.status) return +e.status; const m=String(e.message||e).match(/(?:HTTP\s*|GitHub\s*)(\d{3})/); return m?+m[1]:0; }
function isRetryable(e){ const st=retryStatus(e); if(st) return st===429||st===503; return true; }
async function retryFetch(ctx,kind,url){ let last; for(let a=0;a<3;a++){ try{ return await ctx[kind](url); }catch(e){ last=e; if(a===2||!isRetryable(e)) throw e;
  const base=ctx.retryBase!=null?+ctx.retryBase:450, wait=Math.min(4000,base*Math.pow(2,a))+Math.floor(Math.random()*150);
  if(ctx.sleep) await ctx.sleep(wait); else await new Promise(z=>setTimeout(z,wait)); } } throw last; }

/* --- Requêtes --- */
async function wpQuery(ctx,params){ const q=new URLSearchParams(Object.assign({format:'json',formatversion:'2',origin:'*',maxlag:'5'},params)); const r=await retryFetch(ctx,'json',WP_API+'?'+q.toString()); if(r&&r.error&&r.error.code!=='missingtitle') throw new Error('wp:'+r.error.code); return r; }
async function wpSearch(ctx,q,limit=15){ const r=await wpQuery(ctx,{action:'query',list:'search',srsearch:q,srlimit:String(limit),srprop:'size',srnamespace:'0'}); return ((r&&r.query&&r.query.search)||[]).map(x=>x.title); }
async function wpContent(ctx,titles){ if(!titles.length) return {}; const r=await wpQuery(ctx,{action:'query',prop:'revisions',rvprop:'content',rvslots:'main',titles:titles.join('|'),redirects:'1'}); const o={};
  for(const p of ((r&&r.query&&r.query.pages)||[])){ const rv=p.revisions&&p.revisions[0]; const c=rv&&(rv.slots&&rv.slots.main?rv.slots.main.content:rv.content); if(c) o[p.title]=c; } return o; }
async function fromWikipedia(ctx,name){ const w=words(name); if(!w) return null;
  const hits=(await wpSearch(ctx,'hastemplate:"TomeBD" intitle:"'+w+'"')).filter(t=>sameSeries(titleKey(t),name)).slice(0,8);
  let info=null, vols={}, pages=[];
  if(hits.length){ const c=await wpContent(ctx,hits); const pm=[]; for(const [t,txt] of Object.entries(c)){ const v=parseTomes(txt), ks=Object.keys(v).map(Number); if(ks.length){ pm.push([t,Math.max(...ks)]); for(const k in v) vols[k]=Object.assign(vols[k]||{},v[k]); } if(!info) info=parseInfobox(txt); }
    pages=pm.sort((a,b)=>b[1]-a[1]).slice(0,1).map(x=>x[0]); } // un seul lien : la page qui contient les tomes les plus récents
  if(!info){ const main=(await wpSearch(ctx,'hastemplate:"Infobox Animation et bande dessinée asiatiques/Livre" intitle:"'+w+'"',8)).find(t=>sameSeries(titleKey(t),name)&&!/^liste/i.test(t))
      ||(await wpSearch(ctx,'hastemplate:"Infobox Bande dessinée" intitle:"'+w+'"',8)).find(t=>sameSeries(titleKey(t),name));
    if(main){ const r=await wpQuery(ctx,{action:'parse',page:main,prop:'wikitext',section:'0',redirects:'1'}); const txt=r&&r.parse&&r.parse.wikitext; if(txt){ info=parseInfobox(txt); if(!pages.length) pages.push(main); } } }
  if(!pages.length&&!info) return null;
  return {vols,status:info&&info.status||null,nb:info&&info.nb||null,pages}; }
/* BnF : tomes déjà catalogués (donc parus) des 3 dernières années */
function mx(rec,tag,code){ const out=[]; const re=new RegExp('<(?:mxc:)?datafield[^>]*tag="'+tag+'"[^>]*>([\\s\\S]*?)</(?:mxc:)?datafield>','g'); let m; while((m=re.exec(rec))){ const r2=new RegExp('<(?:mxc:)?subfield code="'+code+'">([\\s\\S]*?)</(?:mxc:)?subfield>','g'); let n; while((n=r2.exec(m[1]))) out.push(xmlTxt(n[1])); } return out; }
const xmlTxt=s=>String(s).replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/[\u0098\u009c]/g,'').trim();
function bnfRecSeries(rec){ const a=mx(rec,'200','a')[0]||'', e=mx(rec,'200','e'), i=mx(rec,'200','i')[0]||'', t461=mx(rec,'461','t')[0]||'';
  const base=t461||(i&&SER_QUAL.test(a)?'':a); const q=[]; if(i&&SER_QUAL.test(a)) q.push(i+' - '+capF(a)); for(const s of e) if(SER_QUAL.test(s.trim())) q.push((t461||a)+' - '+capF(s.trim()));
  return q.length?q[0]:base; }
function parseBnf(xml,name){ const vols={}; for(const rec of String(xml||'').split(/<srw:record>/).slice(1)){ const s=bnfRecSeries(rec); if(!s||!sameSeries(s,name)) continue;
    const vs=(mx(rec,'461','v')[0]||mx(rec,'200','h')[0]||'').match(/\d+/); if(!vs) continue; const v=+vs[0]; if(!(v>0&&v<2000)) continue;
    const y=((mx(rec,'214','d')[0]||mx(rec,'210','d')[0]||'').match(/(19|20)\d\d/)||[])[0]; const o={v,out:1}; if(y) o.y=y; const i=isbn13(mx(rec,'010','a')[0]); if(i) o.isbn=i; vols[v]=Object.assign(vols[v]||{},o); }
  return vols; }
async function fromBnf(ctx,name,year){ const w=words(name); if(!w) return null; const ys=[year-2,year-1,year].join(' ');
  const q=new URLSearchParams({version:'1.2',operation:'searchRetrieve',recordSchema:'unimarcXchange',maximumRecords:'50',query:'bib.title all "'+w.replace(/"/g,'')+'" and bib.date any "'+ys+'"'});
  const x=await retryFetch(ctx,'text',BNF_SRU+'?'+q.toString()); if(x==null) return null; return {vols:parseBnf(x,name)}; }

/* --- Enrichissement optionnel Apify/web (côté serveur uniquement) ---
   Le navigateur ne reçoit JAMAIS de jeton Apify : ctx.apify n'est fourni que par la tâche GitHub
   (secret APIFY_TOKEN). Sans ctx.apify, cette section ne fait strictement rien.
   Données attendues (dataset rag-web-browser) : [{searchResult:{title,description,url},markdown|text,metadata:{title,url}}].
   On n'accepte qu'une date plausible (jour ou mois+année) rattachée au prochain tome (from+1..from+3),
   avec son URL source https. Tout échec/timeout est ignoré par l'appelant. */
const APIFY_SRC='Apify/web';
function apifyItems(data){ if(Array.isArray(data)) return data; if(data&&Array.isArray(data.items)) return data.items; if(data&&Array.isArray(data.data)) return data.data; if(data&&data.dataset&&Array.isArray(data.dataset.items)) return data.dataset.items; return []; }
const MOIS_RE='janv(?:ier)?|f[ée]vr?(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|ao[ûu]t|sept?(?:embre)?|oct(?:obre)?|nov(?:embre)?|d[ée]c(?:embre)?';
const MOIS_TXT={janv:1,janvier:1,fevr:2,fevrier:2,mars:3,avr:4,avril:4,mai:5,juin:6,juil:7,juillet:7,aout:8,sept:9,septembre:9,oct:10,octobre:10,nov:11,novembre:11,dec:12,decembre:12};
function apifyDates(txt){ const out=[]; const low=String(txt||'').toLowerCase(); let m;
  const reF=new RegExp('(\\d{1,2})(?:er)?\\s+('+MOIS_RE+')\\.?\\s+((?:19|20)\\d{2})','g');
  while((m=reF.exec(low))){ const mo=MOIS_TXT[norm(m[2]).replace(/\./g,'')]; if(mo) out.push({i:m.index,end:m.index+m[0].length,fr:m[3]+'-'+String(mo).padStart(2,'0')+'-'+String(+m[1]).padStart(2,'0'),fp:'d'}); }
  const reM=new RegExp('(?<!\\d)('+MOIS_RE+')\\.?\\s+((?:19|20)\\d{2})','g');
  while((m=reM.exec(low))){ if(out.some(d=>m.index>=d.i&&m.index<d.end)) continue; const mo=MOIS_TXT[norm(m[1]).replace(/\./g,'')]; if(mo) out.push({i:m.index,end:m.index+m[0].length,fr:m[2]+'-'+String(mo).padStart(2,'0'),fp:'m'}); }
  const reI=/(20\d{2})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?/g;
  while((m=reI.exec(low))) out.push({i:m.index,end:m.index+m[0].length,fr:m[0].slice(0,m[3]?10:7),fp:m[3]?'d':'m'});
  return out.sort((a,b)=>a.i-b.i); }
function parseApify(data,name,from,nowMs){ const next=Math.max(0,+from|0)+1, yearNow=+parisToday(nowMs||Date.now()).slice(0,4);
  const nameToks=words(name).split(' ').filter(w=>w.length>=4); let best=null;
  apifyItems(data).slice(0,8).forEach((it,idx)=>{ if(!it||typeof it!=='object') return;
    const sr=it.searchResult||{}, md=it.metadata||{}; const url=String(sr.url||it.url||md.url||md.canonicalUrl||'');
    if(!/^https:\/\//.test(url)||/apify\.com/.test(url)) return;
    const head=[sr.title||'',md.title||'',sr.description||'',md.description||''].join('\n');
    const txt=(head+'\n'+String(it.markdown||it.text||'')).slice(0,30000);
    if(nameToks.length&&!nameToks.some(w=>norm(txt).includes(w))) return;
    for(const d of apifyDates(txt)){ const yr=+d.fr.slice(0,4); if(yr<yearNow-2||yr>yearNow+3) continue;
      const win=txt.slice(Math.max(0,d.i-420),Math.min(txt.length,d.end+420)); let v=0,vd=1e9; const vre=/(?:tome|volume|vol\.?|t\.)\s*(\d{1,4})/gi; let vm;
      while((vm=vre.exec(win))){ const n=+vm[1], dist=Math.abs((Math.max(0,d.i-420)+vm.index)-d.i); if(n>=next&&n<=next+3&&dist<vd){ vd=dist; v=n; } }
      if(!v){ const th=head.match(/(?:tome|volume|vol\.?|t\.)\s*(\d{1,4})/i); if(th&&+th[1]>=next&&+th[1]<=next+3){ v=+th[1]; vd=500; } }
      if(!v&&/prochain tome|prochaine sortie/i.test(win)){ v=next; vd=600; }
      if(!v) continue;
      let score=(v===next?60:v===next+1?35:15)+(d.fp==='d'?25:12)+(/sortie|sortira|parution|publication|disponible|précommande|precommande/i.test(win)?25:0)+Math.max(0,20-vd/30)-idx*3;
      if(!best||score>best.score) best={v,fr:d.fr,fp:d.fp,url,score}; } });
  return best?{v:best.v,fr:best.fr,fp:best.fp,url:best.url}:null; }
async function apifyEnrich(ctx,item,r){ if(!ctx||typeof ctx.apify!=='function') return false;
  try{ const data=await ctx.apify(item.name+' prochain tome date de sortie'); const f=parseApify(data,item.name,item.from,ctx.now?ctx.now():Date.now()); if(!f) return false;
    const o=r.vols[f.v]||(r.vols[f.v]={v:f.v}); const rank=p=>p==='d'?3:p==='m'?2:1;
    if(o.fr&&rank(o.fp)>=rank(f.fp)) return false; /* ne remplace jamais une date BnF/Wikipédia aussi précise ou plus */
    o.fr=f.fr; o.fp=f.fp;
    o.src=APIFY_SRC; if(!r.src.some(x=>x&&x.u===f.url)) r.src.push({n:APIFY_SRC,u:f.url}); delete r.err; return true; }catch(e){ return false; } }

/* --- Séries à suivre (dans les deux bibliothèques) --- */
function watchList(db){ const g=new Map(); for(const b of (db&&db.books)||[]){ if(!b||!b.series||!String(b.series).trim()) continue; const lib=LIBS.includes(b.lib)?b.lib:'l1'; const key=serKey(db,b.series,lib); const id=lib+'|'+key;
    let x=g.get(id); if(!x){ x={lib,key,names:{},type:b.type||'',owned:[],wish:[],max:0}; g.set(id,x); } const v=b.volume==null||b.volume===''?NaN:+b.volume;
    x.names[b.series]=(x.names[b.series]||0)+1; if(b.type) x.type=x.type||b.type; if(!isFinite(v)) continue; if(b.status==='envie') x.wish.push(v); else { x.owned.push(v); if(v>x.max) x.max=v; } }
  const st=(db&&db.serStatus)||{}; const out=[];
  for(const x of g.values()){ const ns=Object.entries(x.names).sort((a,b)=>(baseKey(b[0])===x.key)-(baseKey(a[0])===x.key)||b[1]-a[1]); x.name=ns[0][0]; delete x.names; x.last=Math.floor(x.max);
    let tot=null, tt=-1; for(const [k,v] of Object.entries((db&&db.series)||{})){ if(!v||typeof v!=='object') continue; if(k!==x.key&&serKey(db,k,x.lib)!==x.key) continue; const t=+v.updatedAt||0; if(t>tt&&v.total){ tt=t; tot=+v.total||null; } }
    x.total=tot; x.user=st[x.key]&&st[x.key].s||null; if(x.last>0) out.push(x); }
  return out.sort((a,b)=>a.name.localeCompare(b.name,'fr')); }
function wanted(db){ const m=new Map(); for(const x of watchList(db)){ if(x.user==='terminee') continue; if(x.total&&x.last>=x.total&&x.user!=='encours') continue; const p=m.get(x.key); if(!p) m.set(x.key,{key:x.key,name:x.name,type:x.type,from:x.last}); else p.from=Math.min(p.from,x.last); } return [...m.values()]; }

async function fetchSeries(item,ctx){ const now=ctx.now?ctx.now():Date.now(), year=+parisToday(now).slice(0,4); // année civile de Paris, pas UTC (runners GitHub en UTC)
  const r={key:item.key,name:item.name,at:now,status:null,nb:null,vols:{},src:[]}; let ok=0, errs=0;
  try{ const w=await fromWikipedia(ctx,item.name); ok++; if(w){ r.status=w.status; r.nb=w.nb; for(const k in w.vols) r.vols[k]=w.vols[k]; for(const p of w.pages) r.src.push({n:'Wikipédia',u:WP_PAGE+encodeURIComponent(p.replace(/ /g,'_'))}); } }catch(e){ errs++; }
  try{ const b=await fromBnf(ctx,item.name,year); if(b){ ok++; let any=false; for(const k in b.vols){ const o=r.vols[k]||(r.vols[k]={v:+k}); o.out=1; if(!o.isbn&&b.vols[k].isbn) o.isbn=b.vols[k].isbn; if(!o.fr&&b.vols[k].y){ o.fr=b.vols[k].y; o.fp='y'; } any=true; }
      if(any) r.src.push({n:'BnF',u:'https://catalogue.bnf.fr/rechercher.do?motRecherche='+encodeURIComponent(item.name)}); } else errs++; }catch(e){ errs++; }
  const from=Math.max(0,(item.from|0)-1); for(const k of Object.keys(r.vols)) if(+k<=from) delete r.vols[k];
  if(!ok) r.err='réseau'; return r; }
async function refreshAll(list,ctx,o={}){ const prev=(o.prev&&o.prev.series)||{}; const res={v:VERSION,at:ctx.now?ctx.now():Date.now(),by:o.by||'app',series:{}}; let i=0, done=0, failed=0; const conc=Math.max(1,o.conc||2);
  async function worker(){ while(i<list.length){ const it=list[i++]; let r; try{ r=await fetchSeries(it,ctx); }catch(e){ r={key:it.key,name:it.name,err:'erreur'}; }
      if(r.err){ failed++; if(prev[it.key]) r=Object.assign({},prev[it.key],{err:r.err}); } res.series[it.key]=r; done++; o.onProgress&&o.onProgress(done,list.length); if(o.delay) await new Promise(z=>setTimeout(z,o.delay)); } }
  await Promise.all(Array.from({length:Math.min(conc,list.length)},worker));
  /* Apify (optionnel, serveur seulement) : uniquement les séries encore sans date/sortie connue, en série, plafonné. */
  if(ctx&&typeof ctx.apify==='function'){ const max=Math.max(0,Math.min(20,o.apifyMax!=null?+o.apifyMax:5)); let used=0;
    for(const it of list){ if(used>=max) break; const r=res.series[it.key]; if(!r||r.status==='terminee') continue;
      const known=Object.values(r.vols||{}).some(v=>v&&(v.fr||v.out)); if(known) continue; used++; if(await apifyEnrich(ctx,it,r)&&o.delay) await new Promise(z=>setTimeout(z,o.delay)); } }
  res.failed=Object.values(res.series).filter(r=>r&&r.err).length; res.count=list.length; return res; }
/* Fichier de résultats (gist) : on ne garde que des champs connus et bien formés, quoi qu'il contienne */
const DATE_RE=/^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;
function cleanSeries(k,v){ if(!v||typeof v!=='object') return null; const o={key:String(v.key||k).slice(0,200),name:String(v.name||'').slice(0,300),at:+v.at||0,status:v.status==='encours'||v.status==='terminee'?v.status:null,
    nb:Number.isInteger(+v.nb)&&+v.nb>0&&+v.nb<5000&&v.nb!==null?+v.nb:null,vols:{},src:Array.isArray(v.src)?v.src.filter(x=>x&&typeof x.u==='string'&&/^https:\/\//.test(x.u)).slice(0,10).map(x=>({n:String(x.n||'').slice(0,40),u:x.u.slice(0,600)})):[]};
  if(v.err) o.err=String(v.err).slice(0,60);
  for(const [kk,x] of Object.entries(v.vols&&typeof v.vols==='object'?v.vols:{})){ const n=+kk; if(!Number.isInteger(n)||n<1||n>4999||!x||typeof x!=='object') continue; const c={v:n};
    if(typeof x.fr==='string'&&DATE_RE.test(x.fr)){ c.fr=x.fr; c.fp=x.fr.length===10?'d':x.fr.length===7?'m':'y'; } if(typeof x.jp==='string'&&DATE_RE.test(x.jp)) c.jp=x.jp;
    const i=isbn13(x.isbn); if(i) c.isbn=i; if(x.out) c.out=1; if(x.src===APIFY_SRC) c.src=APIFY_SRC; o.vols[n]=c; }
  return o; }
function cleanRel(r){ if(!r||typeof r!=='object'||!r.series||typeof r.series!=='object') return null; const s={};
  for(const [k,v] of Object.entries(r.series)){ if(!k||k.length>200||k==='__proto__'||k==='constructor'||k==='prototype') continue; const c=cleanSeries(k,v); if(c) s[k]=c; }
  return {v:VERSION,at:+r.at||0,by:r.by==='action'?'action':'app',series:s}; }
function mergeReleases(a,b){ a=cleanRel(a); b=cleanRel(b); if(!a) return b; if(!b) return a; const s=Object.assign({},a.series); for(const [k,v] of Object.entries(b.series)){ const p=s[k]; if(!p||(v&&(+v.at||0)>(+p.at||0)&&!(v.err&&!p.err))) s[k]=v; }
  return {v:VERSION,at:Math.max(+a.at||0,+b.at||0),by:(+b.at||0)>(+a.at||0)?b.by:a.by,series:s}; }

/* --- Vue par bibliothèque : prochains tomes, « déjà sorti », cette semaine --- */
function cmpDay(o,today){ if(!o.fr) return o.out?-1:null; const t=today; if(o.fp==='d') return o.fr<t?-1:o.fr===t?0:1; if(o.fp==='m') return o.fr<t.slice(0,7)?-1:o.fr===t.slice(0,7)?0:1; return o.fr<t.slice(0,4)?-1:o.fr===t.slice(0,4)?(o.out?-1:0):1; }
function weekRange(today){ const d=new Date(today+'T12:00:00Z'); const wd=(d.getUTCDay()+6)%7; const a=new Date(d.getTime()-wd*864e5), b=new Date(a.getTime()+6*864e5); return [a.toISOString().slice(0,10),b.toISOString().slice(0,10)]; }
function viewFor(db,rel,lib,today){ const items=[]; const [w0,w1]=weekRange(today); const S=(rel&&rel.series)||{};
  for(const x of watchList(db).filter(x=>x.lib===lib)){ const r=S[x.key]||null; const own=new Set(x.owned.map(Number)), wish=new Set(x.wish.map(Number));
    let status=x.user||(r&&r.status)||null; const nb=x.total||(r&&r.nb)||null; const complete=(x.user==='terminee')||(nb&&x.last>=nb&&(status==='terminee'||x.total)&&x.user!=='encours');
    const vols=r?Object.values(r.vols||{}).filter(o=>o.v>x.last&&!own.has(o.v)).sort((a,b)=>a.v-b.v):[];
    const next=vols.filter(o=>o.fr||o.out||o.isbn).slice(0,4).map(o=>{ const c=cmpDay(o,today); const st=c===null?'tba':(c<0||(c===0&&o.fp==='d'))?'out':'soon'; const wk=o.fp==='d'&&o.fr>=w0&&o.fr<=w1; return Object.assign({},o,{st,wk,wish:wish.has(o.v)}); });
    const after=vols.find(o=>!next.includes(o)&&o.v>(next.length?next[next.length-1].v:x.last));
    const jpOnly=!next.length&&vols.find(o=>o.jp)||null;
    items.push({lib,key:x.key,name:x.name,type:x.type,last:x.last,owned:x.owned.length,status,auto:r?r.status||null:null,user:x.user,nb,complete:!!complete&&!next.length,next,jp:jpOnly?{v:jpOnly.v,d:jpOnly.jp}:null,src:r?r.src||[]:[],checked:r?r.at:null,err:r?r.err:null}); }
  return items; }
function weekCount(items){ let n=0; for(const it of items) for(const o of it.next) if(o.wk) n++; return n; }

/* --- Heure de Paris : rafraîchissement du mardi 6 h --- */
function parisParts(ms){ const f=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',weekday:'short',hourCycle:'h23'}); const o={}; for(const p of f.formatToParts(new Date(ms))) o[p.type]=p.value;
  return {y:+o.year,m:+o.month,d:+o.day,h:+o.hour,mi:+o.minute,wd:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(o.weekday)}; }
function parisToUTC(y,m,d,h,mi){ let g=Date.UTC(y,m-1,d,h,mi); for(let k=0;k<2;k++){ const p=parisParts(g); const off=Date.UTC(p.y,p.m-1,p.d,p.h,p.mi)-g; g=Date.UTC(y,m-1,d,h,mi)-off; } return g; }
function lastTuesday6(now){ const p=parisParts(now); const base=Date.UTC(p.y,p.m-1,p.d); for(let k=0;k<8;k++){ const dd=new Date(base-k*864e5); if(dd.getUTCDay()!==2) continue; const t=parisToUTC(dd.getUTCFullYear(),dd.getUTCMonth()+1,dd.getUTCDate(),6,0); if(t<=now) return t; } return now-7*864e5; }
function parisToday(now){ const p=parisParts(now); return p.y+'-'+String(p.m).padStart(2,'0')+'-'+String(p.d).padStart(2,'0'); }

return {VERSION,FILE,DATA_FILE,UA,LIBS,norm,baseKey,serKey,sameSeries,isbn13,isbn10,covers,wDate,tplBlocks,tplParams,parseTomes,parseInfobox,titleKey,parseBnf,bnfRecSeries,
  retryFetch,bkCacheSize:()=>BK.size,_bk:BK,APIFY_SRC,parseApify,apifyEnrich,fromWikipedia,fromBnf,watchList,wanted,fetchSeries,refreshAll,mergeReleases,cleanRel,viewFor,weekRange,weekCount,parisParts,parisToUTC,lastTuesday6,parisToday};
});
