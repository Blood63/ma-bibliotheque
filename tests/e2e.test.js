/* Ma bibliothèque — tests de bout en bout (Chrome sans interface, puppeteer-core), exécutés par GitHub Actions et en local.
   Données 100 % fictives générées ici (aucune donnée personnelle), aucun réseau réel : toutes les origines externes sont simulées
   (interception des requêtes), le « GitHub » est un faux (tests/fakegh.js) — aucune écriture dans un vrai gist.
   Usage : node tests/e2e.test.js      (variables : CHROME=/usr/bin/google-chrome, TZ=Europe/Paris|UTC, PUPPETEER=puppeteer-core) */
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require(process.env.PUPPETEER || 'puppeteer-core');
const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const W = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const out = [];
const ok = (c, name, extra) => { if (c) { pass++; out.push('  ✔ ' + name); } else { fail++; out.push('  ✘ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra).slice(0, 400) : '')); } };
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const VER = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1], SWC = (swSrc.match(/const CACHE = '([^']+)'/) || [])[1];

// ---- serveur statique local (aucune dépendance)
const MIME = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.wasm':'application/wasm', '.css':'text/css'};
const server = http.createServer((q, s) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html'; const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end('404'); }
  s.writeHead(200, {'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache'}); fs.createReadStream(f).pipe(s); });

// ---- données fictives
function DBFIX(n = 60) { const now = Date.now(), D = 864e5, books = [];
  for (let i = 0; i < n; i++) books.push({id:'fx' + i, lib:i % 5 === 4 ? 'l2' : 'l1', type:i % 4 === 0 ? 'BD' : 'Livre', format:'papier', title:(i % 6 === 0 ? 'Série fictive ' + (i % 12) + ' – tome ' : 'Roman fictif n°') + i, author:'Auteur ' + (i % 7), series:i % 6 === 0 ? 'Série fictive ' + (i % 12) : '', volume:i % 6 === 0 ? (i % 5) + 1 : null,
    isbn:'', cover:'', genre:'Roman', status:i % 9 === 8 ? 'envie' : 'possede', read:i % 3 === 0, dateRead:i % 3 === 0 ? '2026-0' + (1 + i % 9) + '-1' + (i % 9) : '', rating:i % 3 === 0 ? 3 + i % 3 : 0, notes:'', summary:'Résumé fictif ' + i, addedAt:now - (n - i) * D, updatedAt:now - (n - i) * D});
  return {version:3, books, series:{}, goals:{monthly:2, yearly:24, updatedAt:1}, libs:{l1:{name:'Ma bibliothèque'}, l2:{name:'Bibliothèque 2'}}, tomb:{b:{}}, mergeLog:[]}; }

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const BASE = 'http://127.0.0.1:' + server.address().port + '/';
  const br = await puppeteer.launch({executablePath:CHROME, args:['--no-sandbox', '--disable-gpu'], headless:'new'});
  const hits = {gb:0, other:[]}; let GB_MODE = 429;
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const CORS = {'access-control-allow-origin':'*', 'access-control-allow-headers':'*'};
  async function page(ctx, GHS) { const p = await ctx.newPage(); await p.setViewport({width:390, height:844, isMobile:true, hasTouch:true}); await p.emulateTimezone(process.env.TZ || 'Europe/Paris');
    p.errs = []; p.csp = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('dialog', d => d.accept());
    p.on('console', m => { const t = m.text(); if (/Content Security Policy|violates the following/i.test(t)) p.csp.push(t.slice(0, 200)); else if (m.type() === 'error' && !/Failed to load resource|ERR_|404|429|CORS policy/.test(t)) p.errs.push(t.slice(0, 200)); });
    await p.evaluateOnNewDocument(() => { window.__v = []; document.addEventListener('securitypolicyviolation', e => window.__v.push(e.effectiveDirective + ' ' + e.blockedURI)); });
    await p.setRequestInterception(true);
    p.on('request', r => { const u = r.url(); if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
      if (GHS && GHS.handle(r)) return; const h = new URL(u).hostname;
      if (/googleapis\.com$/.test(h) && /\/books\//.test(u)) { hits.gb++; return r.respond(GB_MODE === 429 ? {status:429, headers:CORS, body:'{"error":{"code":429}}'} : {status:200, headers:CORS, body:'{"items":[]}'}); }
      hits.other.push(h);
      if (/\.(png|jpe?g|gif)(\?|$)/.test(u) || /\/couverture|\/b\/(id|isbn)\//.test(u) || /amazon/.test(h)) return r.respond({status:200, headers:{'content-type':'image/png', ...CORS}, body:PNG});
      if (/fonts\.googleapis/.test(h)) return r.respond({status:200, headers:{'content-type':'text/css', ...CORS}, body:'/* police simulée */'});
      return r.respond({status:200, headers:{'content-type':'application/json', ...CORS}, body:'{}'}); });
    return p; }
  const seed = async (p, db) => { await p.goto(BASE + 'index.html', {waitUntil:'networkidle0'}); await p.evaluate(d => { localStorage.clear(); localStorage.setItem('maBibliotheque.v1', JSON.stringify(d)); }, db || DBFIX()); await p.reload({waitUntil:'networkidle0'}); await W(500); };
  const viol = p => p.evaluate(() => window.__v.slice());
  const unnamed = p => p.evaluate(() => { const bad = []; const nm = el => { const al = (el.getAttribute('aria-label') || '').trim(); if (al) return al; const lb = el.getAttribute('aria-labelledby'); if (lb) { const t = lb.split(/\s+/).map(i => (document.getElementById(i) || {}).textContent || '').join('').trim(); if (t) return t; }
      const t = (el.textContent || '').trim(); if (t) return t; if ((el.getAttribute('title') || '').trim()) return el.getAttribute('title'); const im = el.querySelector('img[alt]'); if (im && im.alt.trim()) return im.alt; const sv = el.querySelector('svg title'); if (sv && sv.textContent.trim()) return sv.textContent;
      if (el.id && document.querySelector('label[for="' + el.id + '"]')) return 'label'; if (el.closest('label')) return 'label'; if ((el.getAttribute('placeholder') || '').trim()) return 'placeholder'; return ''; };
    for (const el of document.querySelectorAll('button,[role=button],[role=radio],[role=tab],a[href],select,input:not([type=hidden]),textarea')) { if (!el.checkVisibility({visibilityProperty:true})) continue; if (el.closest('[aria-hidden=true],[inert]')) continue; if (!nm(el)) bad.push((el.id || el.className || el.tagName) + ' ' + el.outerHTML.slice(0, 90)); } return bad; });

  // ---------- 1. Chargement, version, pages ----------
  out.push('1. Chargement, version, pages');
  { const ctx = await br.createBrowserContext(), p = await page(ctx); await seed(p);
    const st = await p.evaluate(() => ({v:APP_VERSION, n:DB.books.length, title:document.title}));
    ok(VER && st.v === VER, 'version de l\'application = version du code (' + VER + ')', st); ok(/^ma-bibliotheque-v\d+$/.test(SWC || ''), 'cache du service worker : ' + SWC); ok(st.n === 60, '60 livres fictifs chargés', st.n);
    for (const pg of ['home', 'lib', 'series', 'stats', 'data', 'home']) { await p.evaluate(x => show(x), pg); await W(250); }
    await p.evaluate(() => { openDetail(getBook('fx3')); }); await W(700); const d = await p.evaluate(() => ({open:document.body.classList.contains('detail-open'), t:document.getElementById('dTitle').textContent})); ok(d.open && /Roman fictif/.test(d.t), 'fiche détail d\'un livre ouverte', d);
    await p.keyboard.press('Escape'); await W(300);
    ok(p.errs.length === 0, 'aucune erreur JavaScript', p.errs); ok((await viol(p)).length === 0 && p.csp.length === 0, 'aucune violation CSP', [await viol(p), p.csp]); await ctx.close(); }

  // ---------- 2. CSP ----------
  out.push('2. Politique de sécurité du contenu (CSP)');
  { const ctx = await br.createBrowserContext(), p = await page(ctx); await seed(p);
    const csp = await p.evaluate(() => { const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]'); const o = {}; if (m) m.content.split(';').forEach(x => { const t = x.trim().split(/\s+/); if (t[0]) o[t[0]] = t.slice(1); }); return o; });
    ok(csp['default-src'] && csp['default-src'].join() === "'self'", 'CSP présente, default-src \'self\'', csp['default-src']);
    const C = csp['connect-src'] || []; const ORIGINS = ['https://openlibrary.org', 'https://catalogue.bnf.fr', 'https://www.sudoc.fr', 'https://www.googleapis.com', 'https://graphql.anilist.co', 'https://fr.wikipedia.org', 'https://api.github.com', 'https://gist.githubusercontent.com'];
    ok(ORIGINS.every(o => C.includes(o)), 'connect-src : toutes les sources de l\'appli (ISBN, sorties, synchro)', C); ok(!C.some(x => x === '*' || x === 'https:' || x === 'http:'), 'connect-src : sans joker', C);
    ok(csp['script-src'] && !csp['script-src'].includes("'unsafe-eval'") && !csp['script-src'].some(x => /^https?:/.test(x)) && csp['object-src'] && csp['object-src'].join() === "'none'" && csp['base-uri'] && csp['frame-src'] && csp['frame-src'].join() === "'none'", 'CSP : pas de unsafe-eval, aucun script externe, object-src none, frame-src none, base-uri', csp);
    // chaque origine déclarée est réellement joignable (aucune violation), une origine inconnue est bloquée
    const r = await p.evaluate(async O => { const res = {}; for (const o of O) { try { await fetch(o + '/sonde', {mode:'cors'}); res[o] = 'ok'; } catch (e) { res[o] = 'bloqué ' + e.message; } } return res; }, ORIGINS);
    ok(Object.values(r).every(v => v === 'ok') && (await viol(p)).length === 0, 'chaque origine déclarée est joignable sans violation CSP', [r, await viol(p)]);
    const bl = await p.evaluate(async () => { let r1 = 'ok'; try { await fetch('https://exemple-non-autorise.invalid/x?token=1'); } catch (e) { r1 = 'bloqué'; } const im = new Image(); im.src = 'http://exemple-non-autorise.invalid/a.png'; const sc = document.createElement('script'); sc.src = 'https://cdn.exemple-non-autorise.invalid/x.js'; document.head.appendChild(sc);
      await new Promise(r => setTimeout(r, 400)); return {r1, v:window.__v.slice()}; });
    ok(bl.r1 === 'bloqué' && bl.v.some(x => /^connect-src/.test(x)) && bl.v.some(x => /^img-src/.test(x)) && bl.v.some(x => /^script-src/.test(x)), 'origines inconnues bloquées : requête (connect-src), image http (img-src), script externe (script-src)', bl.v);
    // une couverture https quelconque s'affiche, la police Google aussi
    const imgOK = await p.evaluate(() => new Promise(res => { const im = new Image(); im.onload = () => res(im.naturalWidth); im.onerror = () => res(0); im.src = 'https://covers.openlibrary.org/b/isbn/9782070408504-M.jpg'; })); ok(imgOK > 0, 'couverture https (Open Library) autorisée par img-src', imgOK);
    // lecteur de code-barres WebAssembly embarqué sous CSP (wasm-unsafe-eval, 'self')
    const wasm = await p.evaluate(async () => { try { delete window.BarcodeDetector; detP = null; const d = await getDetector(); return typeof d.detect === 'function' ? 'ok' : 'pas de detect'; } catch (e) { return 'ERR ' + e.message; } });
    ok(wasm === 'ok', 'lecteur de code-barres (ZXing WebAssembly embarqué) chargé sous CSP', wasm);
    ok(!(await viol(p)).some(x => /wasm|script-src-elem 'self'/.test(x)) && p.errs.length === 0, 'CSP : le module WebAssembly n\'a déclenché aucune violation ni erreur', [await viol(p), p.errs]); await ctx.close(); }

  // ---------- 3. Google Books : pause après un 429 ----------
  out.push('3. Google Books : pause après un 429');
  { const ctx = await br.createBrowserContext(), p = await page(ctx); await seed(p); hits.gb = 0; GB_MODE = 429;
    const a = await p.evaluate(async () => { const r1 = await lookupGB('9782070408504'); return {r1, paused:gbPaused(), until:GB_COOL.until - Date.now()}; });
    ok(a.r1 === null && a.paused && a.until > 14 * 60e3 && a.until <= 3600e3 + 1000 && hits.gb === 1, 'un 429 : 1 seule requête, pause de 15 min à 1 h', [a, hits.gb]);
    const b = await p.evaluate(async () => { const x = await lookupGB('9782253006329'); const y = await searchGB('Dune', 'Herbert'); let z = null; try { z = await lookupISBN('9782070408504'); } catch (e) { z = 'ERR ' + e.message; } return {x, y, z: typeof z === 'string' ? z : 'ok'}; });
    ok(hits.gb === 1 && b.x === null && Array.isArray(b.y) && b.y.length === 0 && b.z !== undefined && !/ERR/.test(b.z), 'pendant la pause : plus aucune requête Google Books (ISBN, recherche, chaîne complète)', [hits.gb, b]);
    GB_MODE = 200; await p.evaluate(() => { GB_COOL.until = Date.now() - 1; }); const c = await p.evaluate(async () => { await lookupGB('9782070408504'); return gbPaused(); }); ok(hits.gb === 2 && c === false, 'pause écoulée : Google Books de nouveau interrogé', [hits.gb, c]);
    const keys = await p.evaluate(() => Object.keys(localStorage).filter(k => /gb|google|cool/i.test(k))); ok(keys.length === 0, 'la pause n\'est pas enregistrée (mémoire de session)', keys);
    ok(p.errs.length === 0, 'Google Books : aucune erreur JS', p.errs); await ctx.close(); }

  // ---------- 4. Accessibilité : noms des boutons ----------
  out.push('4. Accessibilité : noms accessibles');
  { const ctx = await br.createBrowserContext(), p = await page(ctx); await seed(p);
    await p.evaluate(() => { const b = document.createElement('button'); b.id = 'temoin'; document.body.appendChild(b); }); ok((await unnamed(p)).length === 1, 'témoin : le détecteur repère bien un bouton sans nom'); await p.evaluate(() => document.getElementById('temoin').remove());
    for (const pg of ['home', 'lib', 'series', 'stats', 'data']) { await p.evaluate(x => show(x), pg); await W(300); const bad = await unnamed(p); ok(bad.length === 0, 'page « ' + pg + ' » : aucun bouton / champ sans nom accessible (feuilles fermées exclues)', bad); }
    await p.evaluate(() => show('lib')); await W(200);
    await p.evaluate(() => { openDetail(getBook('fx3')); }); await W(800); let bad = await unnamed(p); ok(bad.length === 0, 'fiche détail ouverte (livre non lu) : tous les boutons ont un nom', bad);
    const names = await p.evaluate(() => ['dRead', 'dStatus', 'dCopy', 'dDel', 'dEdit', 'dClose'].map(i => [i, (document.getElementById(i).getAttribute('aria-label') || document.getElementById(i).textContent).trim()])); ok(names.every(n => n[1]), 'dRead / dStatus / dCopy / dDel / dEdit / dClose : noms présents', names);
    await p.keyboard.press('Escape'); await W(500);
    await p.evaluate(() => { openDetail(getBook('fx0')); }); await W(800); bad = await unnamed(p); ok(bad.length === 0, 'fiche détail ouverte (livre lu) : tous les boutons ont un nom', bad); await p.keyboard.press('Escape'); await W(500);
    const closed = await p.evaluate(() => { const o = {}; for (const i of ['dRead', 'dStatus', 'dCopy']) { const e = document.getElementById(i); o[i] = getComputedStyle(e).visibility; } return o; }); ok(Object.values(closed).every(v => v === 'hidden'), 'fiche fermée : ses boutons sont masqués aux lecteurs d\'écran (visibility:hidden)', closed);
    await p.evaluate(() => openAdd('manual')); await W(700); bad = await unnamed(p); ok(bad.length === 0, 'formulaire d\'ajout ouvert : tous les champs / boutons ont un nom', bad);
    ok(p.errs.length === 0, 'accessibilité : aucune erreur JS', p.errs); await ctx.close(); }

  // ---------- 5. Synchro (faux GitHub), deux appareils ----------
  out.push('5. Synchro avec un faux GitHub, deux appareils');
  { const GHS = require('./fakegh')(); const ctxA = await br.createBrowserContext(), ctxB = await br.createBrowserContext(); const A = await page(ctxA, GHS), B = await page(ctxB, GHS);
    await seed(A); await seed(B, {version:3, books:[], series:{}, goals:{monthly:2, yearly:24, updatedAt:1}, libs:{l1:{name:'Ma bibliothèque'}, l2:{name:'Bibliothèque 2'}}, tomb:{b:{}}, mergeLog:[]});
    for (const x of [A, B]) await x.evaluate(() => { saveSyncCfg({token:'ghp_test', gistId:'', lastSync:0, auto:false}); });
    ok(await A.evaluate(() => syncNow({silent:true})), 'A : première synchro (création du gist factice)'); ok(GHS.patches.length >= 1, 'A : gist factice écrit', GHS.patches.length);
    ok(await B.evaluate(() => syncNow({silent:true})) && await B.evaluate(() => DB.books.length) === 60, 'B (vide) : récupère les 60 livres');
    await B.evaluate(() => { const b = DB.books.find(x => x.id === 'fx5'); b.notes = 'modif B'; b.updatedAt = Date.now(); DB.books.push({id:'nv1', lib:'l1', type:'Livre', format:'papier', title:'Livre ajouté sur B', author:'Auteur Z', series:'', volume:null, isbn:'', cover:'', genre:'', status:'possede', read:false, dateRead:'', rating:0, notes:'', summary:'', addedAt:Date.now(), updatedAt:Date.now()}); save(); });
    await B.evaluate(() => syncNow({silent:true})); await A.evaluate(() => syncNow({silent:true}));
    const a = await A.evaluate(() => ({n:DB.books.length, n5:getBook('fx5').notes, nv:!!getBook('nv1')})); ok(a.n === 61 && a.n5 === 'modif B' && a.nv, 'A reçoit l\'ajout et la modification de B, sans doublon', a);
    await A.evaluate(() => { const i = DB.books.findIndex(x => x.id === 'fx7'); const o = DB.books.splice(i, 1)[0]; DB.tomb.b['fx7'] = Math.max(Date.now(), (o.updatedAt || 0) + 1); save(); }); await A.evaluate(() => syncNow({silent:true})); await B.evaluate(() => syncNow({silent:true}));
    ok(await B.evaluate(() => !getBook('fx7') && DB.books.length === 60), 'suppression de A propagée à B (pierre tombale)');
    ok(A.errs.length + B.errs.length === 0 && (await viol(A)).length + (await viol(B)).length === 0, 'synchro : aucune erreur JS ni violation CSP', [A.errs, B.errs, await viol(A), await viol(B)]); await ctxA.close(); await ctxB.close(); }

  // ---------- 6. Service worker et hors ligne ----------
  out.push('6. Service worker, hors ligne');
  { const ctx = await br.createBrowserContext(), p = await page(ctx); await seed(p); await p.evaluate(() => navigator.serviceWorker.ready); await p.reload({waitUntil:'networkidle0'}); await W(2000);
    const c = await p.evaluate(async () => ({ctl:!!navigator.serviceWorker.controller, keys:await caches.keys(), v:APP_VERSION}));
    ok(c.ctl && c.keys.includes(SWC) && c.keys.filter(k => /^ma-bibliotheque-v\d+$/.test(k)).length === 1, 'service worker actif, un seul cache d\'appli (' + SWC + ')', c);
    await p.setOfflineMode(true); await p.reload({waitUntil:'load'}); await W(1500);
    const o = await p.evaluate(() => ({n:DB.books.length, v:APP_VERSION, home:!!document.querySelector('#p-home.on')})); ok(o.n === 60 && o.v === VER && o.home, 'hors ligne : l\'appli se recharge avec ses données', o);
    ok(p.errs.length === 0, 'hors ligne : aucune erreur JS', p.errs); await ctx.close(); }

  await br.close(); server.close();
  console.log(out.join('\n')); console.log(`\n${pass} réussis, ${fail} échoués`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
