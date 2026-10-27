#!/usr/bin/env node
// Tests des fonctions pures de Ma bibliothèque (sans dépendance, sans réseau) : node tests/pure.test.js
// Charge le code de index.html (sections Utils → Photos + helpers ISBN) dans un bac à sable, et releases.js comme module.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const REL = require(path.join(ROOT, 'releases.js'));

function slice(from, to) { const i = html.indexOf(from), j = html.indexOf(to, i + 1); if (i < 0 || j < 0) throw new Error('repère introuvable : ' + (i < 0 ? from : to)); return html.slice(i, j); }
const code = slice("'use strict';\nconst KEY", '/* ---------- Agrégats') + '\n' + slice('/* ---------- ISBN', '\nconst isFrIsbn');
const store = {};
const sandbox = {
  console, Intl, Date, Math, JSON, Map, Set, WeakMap, Promise, URL,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; } },
  document: { getElementById: () => null, addEventListener() {}, querySelectorAll: () => [] },
  window: {}, navigator: {}, setTimeout, clearTimeout, toast() {}, scheduleSync() {}, curLib: 'l1'
};
vm.createContext(sandbox);
vm.runInContext(code + '\n;globalThis.__T={baseKey,serKey,isbn13,mergeDB,normBook,normGoals,migrate,emptyDB,phKeyOk,phWanted,phPlan,phKeyOfFile,phFile,isThumb,safeImg,setDB:d=>{DB=d;},PH,applyStart,applyPage,applyFinish,applyStop,daysBetween,readDays};', sandbox, { filename: 'index.html' });
const A = sandbox.__T;

let n = 0, fail = 0;
function t(name, fn) { n++; try { fn(); } catch (e) { fail++; console.error('✗ ' + name + '\n   ' + (e && e.message)); return; } console.log('✓ ' + name); }

/* ---- baseKey : appli et releases.js doivent donner exactement la même clé ---- */
const CASES = ['One Piece', 'ONE PIECE', 'One Piece – Tome 12', 'One piece T.105', 'One Piece (Édition originale)', 'One Piece - Nouvelle édition', 'one-piece',
  'Spy×Family', 'Spy x Family', 'L’Attaque des Titans', "L'Attaque des titans", 'Astérix & Obélix', 'Dragon Ball Super, vol. 3', 'Naruto n°12', 'Naruto no 12',
  'Blue Lock', 'Les Légendaires', 'Lanfeust de Troy', '20th Century Boys', 'ドラゴンボール', '', '  ', 'Tome 3', 'Ken le survivant (Édition française) Tome 1', 'Fullmetal Alchemist T27', 'Kingdom 70'];
t('baseKey identique (index.html / releases.js) sur ' + CASES.length + ' cas', () => { for (const c of CASES) assert.strictEqual(A.baseKey(c), REL.baseKey(c), JSON.stringify(c)); });
t('baseKey : variantes One Piece → même clé', () => { const k = A.baseKey('One Piece'); for (const c of ['ONE PIECE', 'One Piece – Tome 12', 'One piece T.105', 'One Piece (Édition originale)', 'one-piece', 'One Piece - Nouvelle édition']) assert.strictEqual(A.baseKey(c), k, c); });
t('baseKey : × et x, apostrophes, & → et', () => { assert.strictEqual(A.baseKey('Spy×Family'), A.baseKey('Spy x Family')); assert.strictEqual(A.baseKey('L’Attaque des Titans'), A.baseKey("L'Attaque des titans")); assert.strictEqual(A.baseKey('Astérix & Obélix'), 'asterixetobelix'); });
t('baseKey : cache LRU cohérent (2e appel identique)', () => { for (const c of CASES) assert.strictEqual(A.baseKey(c), A.baseKey(c)); });

/* ---- ISBN ---- */
t('isbn13 : ISBN-10 → ISBN-13 (appli = releases.js)', () => {
  for (const [i10, i13] of [['2723488152', '9782723488150'], ['2-7234-8815-2', '9782723488150'], ['080442957X', '9780804429573'], ['274996217X', '9782749962177']]) { assert.strictEqual(A.isbn13(i10), i13, i10); assert.strictEqual(REL.isbn13(i10), i13, 'rel ' + i10); }
  assert.strictEqual(A.isbn13('978-2-7234-8815-0'), '9782723488150'); assert.strictEqual(REL.isbn13('2723488153'), '');
});

/* ---- mergeDB ---- */
const book = (o) => A.normBook(Object.assign({ type: 'Manga', title: '', author: 'Oda', series: 'One Piece', volume: 1, status: 'possede', read: false, lib: 'l1', addedAt: 1, updatedAt: 1 }, o));
t('mergeDB : la modification la plus récente gagne, champs inconnus conservés', () => {
  const L = A.emptyDB(), R = A.emptyDB();
  L.books = [book({ id: 'a', volume: 1, read: true, dateRead: '2026-01-01', updatedAt: 10 })];
  R.books = [book({ id: 'a', volume: 1, read: false, updatedAt: 5, futur: 'x' }), book({ id: 'b', volume: 2, updatedAt: 3, photo: 'pabcdefgh', cover: 'data:image/jpeg;base64,AAAA' })];
  R.inconnu = { garde: 1 };
  const m = A.mergeDB(L, R);
  assert.strictEqual(m.books.length, 2); assert.strictEqual(m.books.find(b => b.id === 'a').read, true);
  assert.strictEqual(m.books.find(b => b.id === 'b').photo, 'pabcdefgh'); assert.deepStrictEqual(m.inconnu, { garde: 1 });
});
t('mergeDB : suppression (tombstone) plus récente que la modification', () => {
  const L = A.emptyDB(), R = A.emptyDB(); R.books = [book({ id: 'a', updatedAt: 5 })]; L.tomb.b.a = 9;
  const m = A.mergeDB(L, R); assert.strictEqual(m.books.length, 0); assert.ok(m.tomb.b.a);
});
t('fusion de séries puis tome ajouté sous l’ancien nom → rejoint la série (alias)', () => {
  const db = A.emptyDB(); db.books = [book({ id: 'a', series: 'One Piece', volume: 1 }), book({ id: 'b', series: 'One Piece (Édition originale)', volume: 2 })];
  db.serAlias = { ['l1|' + A.baseKey('Onepiece Vf')]: { to: 'One Piece', at: 5 } };
  A.setDB(db);
  assert.strictEqual(A.serKey('Onepiece Vf', 'l1'), A.baseKey('One Piece'));
  assert.strictEqual(A.serKey('Onepiece Vf', 'l1'), REL.serKey(db, 'Onepiece Vf', 'l1'), 'releases.js suit le même alias');
  assert.strictEqual(A.serKey('Onepiece Vf', 'l2'), A.baseKey('Onepiece Vf'), 'alias limité à sa bibliothèque');
  // ancienne version qui fusionne à nouveau : la chaîne d'alias ne boucle pas
  db.serAlias['l1|' + A.baseKey('One Piece')] = { to: 'Onepiece Vf', at: 6 }; assert.ok(typeof A.serKey('One Piece', 'l1') === 'string');
});

/* ---- releases.js : dates Wikipédia et tomes ---- */
t('wDate : « 1er » et modèle {{date}}', () => {
  assert.deepStrictEqual(REL.wDate('1er mars 2026'), { d: '2026-03-01', p: 'd' });
  assert.deepStrictEqual(REL.wDate('{{date|1er|juillet|2025}}'), { d: '2025-07-01', p: 'd' });
  assert.deepStrictEqual(REL.wDate('{{date-|12 février 2027}}<ref>x</ref>'), { d: '2027-02-12', p: 'd' });
  assert.deepStrictEqual(REL.wDate('[[septembre 2026]]'), { d: '2026-09', p: 'm' });
  assert.deepStrictEqual(REL.wDate('2028'), { d: '2028', p: 'y' }); assert.strictEqual(REL.wDate('à venir'), null);
});
t('parseTomes : Japon + France (langue_2 = français), « 1er » et ISBN-10', () => {
  const wt = '{{TomeBD/Entête|langue_1=japonais|langue_2=français}}\n{{TomeBD\n|volume=1\n|sortie_1=24 décembre 1997\n|sortie_2={{date|1er|septembre|2000}}\n|isbn_2=2723488152\n}}\n{{TomeBD\n|volume=2\n|sortie_1=1998\n|sortie_2=à venir\n}}\n{{TomeBD/Pied}}';
  const v = REL.parseTomes(wt);
  assert.deepStrictEqual(v[1], { v: 1, fr: '2000-09-01', fp: 'd', isbn: '9782723488150', jp: '1997-12-24' });
  assert.deepStrictEqual(v[2], { v: 2, jp: '1998' });
});

/* ---- Photos (v4.2) ---- */
const thumb = 'data:image/jpeg;base64,/9j/AAAA', full = 'data:image/jpeg;base64,/9j/BBBBBBBB';
t('photos : clé, nom de fichier du gist, vignette', () => {
  assert.ok(A.phKeyOk('pmabcd123xyz')); assert.ok(!A.phKeyOk('../x')); assert.ok(!A.phKeyOk('PABC')); assert.ok(!A.phKeyOk(''));
  assert.strictEqual(A.phKeyOfFile(A.phFile('pmabcd123xyz')), 'pmabcd123xyz'); assert.strictEqual(A.phKeyOfFile('ma-bibliotheque-data.json'), '');
  assert.ok(A.isThumb(thumb)); assert.ok(!A.isThumb('https://x/y.jpg'));
});
t('photos : normBook garde une clé valide, efface une clé invalide, n’ajoute rien sinon', () => {
  assert.strictEqual(book({ id: 'x', photo: 'pmabcd123xyz' }).photo, 'pmabcd123xyz'); assert.strictEqual(book({ id: 'x', photo: 'bad key' }).photo, '');
  assert.ok(!('photo' in book({ id: 'x' })));
});
t('photos : plan de synchro (envoi, pas de doublon, suppression des orphelines, couverture URL = photo ignorée)', () => {
  A.PH.clear(); A.PH.set('pnew000001', full); A.PH.set('pold000002', full);
  const db = A.emptyDB(); db.books = [book({ id: 'a', photo: 'pnew000001', cover: thumb }), book({ id: 'b', photo: 'pold000002', cover: thumb }), book({ id: 'c', photo: 'purl000003', cover: 'https://x/c.jpg' })];
  const gist = { files: { 'ma-bibliotheque-data.json': {}, [A.phFile('pold000002')]: {}, [A.phFile('pgone00004')]: {}, [A.phFile('purl000003')]: {} } };
  const p = A.phPlan(gist, db);
  assert.deepStrictEqual(Object.keys(p.files).sort(), [A.phFile('pgone00004'), A.phFile('pnew000001'), A.phFile('purl000003')].sort());
  assert.strictEqual(p.files[A.phFile('pnew000001')].content, full); assert.strictEqual(p.files[A.phFile('pgone00004')], null); assert.strictEqual(p.files[A.phFile('purl000003')], null);
  assert.ok(!('ma-bibliotheque-data.json' in p.files)); assert.strictEqual(p.more, false);
  assert.deepStrictEqual([...A.phWanted(db)].sort(), ['pnew000001', 'pold000002']);
});
t('objectif : option « sans les mangas » conservée, valeur inconnue retirée', () => {
  assert.strictEqual(A.normGoals({ monthly: 4, count: 'nomanga', updatedAt: 1 }).count, 'nomanga');
  assert.ok(!('count' in A.normGoals({ monthly: 4, count: 'bizarre' }))); assert.ok(!('count' in A.normGoals({ monthly: 4 })));
});

/* ---- v4.4 : lecture en cours, journal facultatif, citations, envies ---- */
const nb = o => A.normBook(Object.assign({ id: 'x', title: 'T', author: 'A', type: 'Livre', status: 'possede', addedAt: 1, updatedAt: 1 }, o));
t('v4.4 : un ancien livre reste strictement identique (aucune clé ajoutée)', () => {
  const old = { id: 'o', title: 'Vieux', author: 'A', type: 'Livre', status: 'possede', read: true, dateRead: '2024-05-01', rating: 4, addedAt: 5, updatedAt: 9 };
  const k0 = Object.keys(A.normBook(JSON.parse(JSON.stringify(old)))).sort();
  for (const k of ['pages', 'reading', 'readStart', 'endExact', 'quotes', 'reads', 'prio', 'price', 'url']) assert.ok(!k0.includes(k), k);
  const a = A.normBook(JSON.parse(JSON.stringify(old))); assert.deepStrictEqual(A.normBook(JSON.parse(JSON.stringify(a))), a);
});
t('v4.4 : normBook garde les champs valides et retire les invalides', () => {
  const b = nb({ pages: '320', prio: '2', price: '8,5', url: ' https://exemple.org/x ', readStart: '2026-10-01', reading: { since: '2026-10-02', page: 12, at: 5 }, quotes: [{ text: ' Bonjour ', page: 3 }, { text: '  ' }, null] });
  assert.strictEqual(b.pages, 320); assert.strictEqual(b.prio, 2); assert.strictEqual(b.price, 8.5); assert.strictEqual(b.url, 'https://exemple.org/x');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(b.reading)), { since: '2026-10-02', page: 12, at: 5 }); assert.strictEqual(b.quotes.length, 1); assert.strictEqual(b.quotes[0].text, 'Bonjour'); assert.strictEqual(b.quotes[0].page, 3); assert.ok(b.quotes[0].id);
  const m = nb({ pages: -4, prio: 7, price: -1, url: 'javascript:alert(1)', readStart: 'hier', reading: 'x', quotes: 'x', reads: 3, endExact: true });
  for (const k of ['pages', 'prio', 'price', 'url', 'readStart', 'reading', 'quotes', 'reads', 'endExact']) assert.ok(!(k in m), k);
});
t('v4.4 : « en cours » disparaît si le livre est lu, sauf relecture ; jour de fin exact seulement si lu et daté', () => {
  assert.ok(!('reading' in nb({ read: true, dateRead: '2026-01-01', reading: { since: '', page: 1, at: 1 } })));
  assert.ok(nb({ read: true, dateRead: '2026-01-01', reading: { since: '', page: 1, at: 1, re: 1 } }).reading.re);
  assert.ok(!('endExact' in nb({ read: false, endExact: true }))); assert.ok(!('endExact' in nb({ read: true, dateRead: '', endExact: true }))); assert.strictEqual(nb({ read: true, dateRead: '2026-01-05', endExact: true }).endExact, true);
});
t('v4.4 : démarrer, avancer, terminer (premier passage), sans date ni pages', () => {
  const b = nb({}); assert.ok(A.applyStart(b, '', 10, false)); assert.ok(!A.applyStart(b, '', 11, false)); assert.strictEqual(b.reading.page, 0);
  A.applyPage(b, 25, 12); assert.strictEqual(b.reading.page, 25); b.pages = 40; A.applyPage(b, 99, 13); assert.strictEqual(b.reading.page, 40);
  assert.ok(A.applyFinish(b, '2026-10-27', true, 5, 20)); assert.ok(b.read && b.dateRead === '2026-10-27' && b.endExact === true && b.rating === 5 && !b.reading && !b.readStart);
  const c = nb({}); A.applyStart(c, '2026-10-01', 1, false); A.applyFinish(c, '2026-10-01', false, 0, 2); assert.ok(c.read && !c.endExact && c.readStart === '2026-10-01'); assert.strictEqual(A.readDays(c), null);
  const d = nb({}); A.applyStart(d, '', 1, false); A.applyFinish(d, '', false, 0, 2); assert.ok(d.read && d.dateRead === '' && !('readStart' in d) && !d.rating);
});
t('v4.4 : durée et rythme seulement quand début et fin exacts existent (minimum 1 jour)', () => {
  const b = nb({ read: true, dateRead: '2026-10-11', endExact: true, readStart: '2026-10-01' }); assert.strictEqual(A.readDays(b), 10);
  assert.strictEqual(A.readDays(nb({ read: true, dateRead: '2026-10-01', endExact: true, readStart: '2026-10-01' })), 1);
  assert.strictEqual(A.readDays(nb({ read: true, dateRead: '2026-10-01', readStart: '2026-09-01' })), null); assert.strictEqual(A.readDays(nb({ read: true, dateRead: '2026-09-01', endExact: true })), null);
  assert.strictEqual(A.readDays(nb({ read: true, dateRead: '2026-09-01', endExact: true, readStart: '2026-10-01' })), null);
  assert.strictEqual(A.daysBetween('2026-02-28', '2026-03-01'), 1); assert.strictEqual(A.daysBetween('', '2026-03-01'), null);
});
t('v4.4 : relecture = historique, le livre reste « lu » avec sa date', () => {
  const b = nb({ read: true, dateRead: '2025-03-01' }); assert.ok(!A.applyStart(b, '', 1, false)); assert.ok(A.applyStart(b, '2026-10-01', 2, true));
  A.applyFinish(b, '2026-10-20', true, 0, 3); assert.ok(b.read && b.dateRead === '2025-03-01' && !b.reading); assert.deepStrictEqual(JSON.parse(JSON.stringify(b.reads)), [{ end: '2026-10-20', start: '2026-10-01', exact: 1 }]);
  assert.strictEqual(A.normBook(JSON.parse(JSON.stringify(b))).reads.length, 1);
});
t('v4.4 : mergeDB garde les nouveaux champs du livre le plus récent', () => {
  const mk = (o, u) => A.normBook(Object.assign({ id: 'm', title: 'M', author: 'A', type: 'Livre', status: 'possede', addedAt: 1, updatedAt: u }, o));
  const L = A.emptyDB(), R = A.emptyDB(); L.books = [mk({}, 5)]; R.books = [mk({ reading: { since: '', page: 7, at: 9 }, pages: 100, quotes: [{ id: 'q', text: 'hello', at: 1 }] }, 8)];
  const m = A.mergeDB(L, R).books[0]; assert.strictEqual(m.reading.page, 7); assert.strictEqual(m.pages, 100); assert.strictEqual(m.quotes[0].text, 'hello');
  const m2 = A.mergeDB(R, L).books[0]; assert.strictEqual(m2.reading.page, 7);
});

console.log('\n' + (n - fail) + ' / ' + n + ' tests OK');
process.exit(fail ? 1 : 0);
