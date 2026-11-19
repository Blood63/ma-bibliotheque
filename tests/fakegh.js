// Faux GitHub réaliste : révisions, liste sans contenu, raw_url figés par révision, compteur d'octets
module.exports=function(){ const S={GIST:null,rev:0,hist:{},patches:[],bytes:0,gets:0,lists:0,raws:[]};
  const snap=()=>{ S.rev++; S.hist[S.rev]=JSON.parse(JSON.stringify(S.GIST.files)); };
  const raw=n=>'https://gist.githubusercontent.com/fake/fakegist123/raw/'+S.rev+'/'+encodeURIComponent(n);
  const full=()=>{ const files={}; for(const [n,c] of Object.entries(S.GIST.files)) files[n]={filename:n,size:c.length,content:c,truncated:false,raw_url:raw(n)}; return {id:'fakegist123',files}; };
  const meta=()=>{ const files={}; for(const [n,c] of Object.entries(S.GIST.files)) files[n]={filename:n,size:c.length,raw_url:raw(n)}; return {id:'fakegist123',files}; };
  S.set=files=>{ S.GIST={files}; snap(); };
  S.handle=req=>{ const u=req.url(); if(!/api\.github\.com|gist\.githubusercontent/.test(u)) return false;
    const m=req.method(); const H={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,PATCH,POST'};
    const send=(st,b)=>{ S.bytes+=b.length; req.respond({status:st,headers:H,body:b}); };
    if(m==='OPTIONS'){ req.respond({status:204,headers:H,body:''}); return true; }
    if(S.offline){ req.abort('internetdisconnected'); return true; }
    let mm=u.match(/raw\/(\d+)\/([^?]+)/); if(mm){ const f=S.hist[mm[1]]&&S.hist[mm[1]][decodeURIComponent(mm[2])]; S.raws.push(decodeURIComponent(mm[2])); f==null?send(404,'404: Not Found'):send(200,f); return true; }
    if(/\/gists\?per_page/.test(u)){ S.lists++; send(200,JSON.stringify(S.GIST?[{id:'othergist',files:{'x.md':{size:1,raw_url:'https://gist.githubusercontent.com/fake/o/raw/1/x.md'}}},meta()]:[])); return true; }
    if(/\/gists\/fakegist123$/.test(u)&&m==='GET'){ S.gets++; send(200,JSON.stringify(full())); return true; }
    if(/\/gists\/fakegist123$/.test(u)&&m==='PATCH'){ const b=JSON.parse(req.postData()); S.patches.push(Object.keys(b.files)); for(const [n,f] of Object.entries(b.files)){ if(f===null) delete S.GIST.files[n]; else S.GIST.files[n]=f.content; } snap(); send(200,JSON.stringify(full())); return true; }
    if(/\/gists$/.test(u)&&m==='POST'){ const b=JSON.parse(req.postData()); const files={}; for(const [n,f] of Object.entries(b.files)) if(f) files[n]=f.content; S.set(files); S.patches.push(Object.keys(b.files)); send(201,JSON.stringify(full())); return true; }
    send(404,'{}'); return true; };
  return S; };
