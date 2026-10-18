// Prochaines sorties — tâche hebdomadaire (mardi ~6 h, heure de Paris).
// Lit la liste des séries dans le gist SECRET « ma-bibliotheque-data.json » de l'utilisateur et écrit « ma-bibliotheque-releases.json » dans CE MÊME gist.
// Règles : aucun nom de série / livre dans les journaux (dépôt public), aucun autre gist modifié, aucun autre fichier touché.
'use strict';
const R = require('../../releases.js');
const API = process.env.GH_API || 'https://api.github.com';
const TOKEN = process.env.GIST_TOKEN || '';
const APIFY_TOKEN = process.env.APIFY_TOKEN || ''; // optionnel : sans ce secret, l'enrichissement Apify est simplement ignoré
const APIFY_API = process.env.APIFY_API || 'https://api.apify.com';
const APIFY_MAX = Math.max(0, Math.min(10, +(process.env.APIFY_MAX || 6) || 0));
const FORCE = process.env.FORCE === 'true';
const NOW = process.env.NOW_MS ? +process.env.NOW_MS : Date.now();
const log = (...a) => console.log(...a);

async function gh(path, opt = {}) {
  const r = await fetch(API + path, { method: opt.method || 'GET', headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': R.UA, ...(opt.body ? { 'Content-Type': 'application/json' } : {}) }, body: opt.body ? JSON.stringify(opt.body) : undefined });
  if (!r.ok) { const e = new Error('GitHub ' + r.status); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json();
}
async function fileText(f) { if (!f) return null; if (f.truncated && f.raw_url) { const r = await fetch(f.raw_url, { headers: { 'User-Agent': R.UA } }); return r.ok ? r.text() : null; } return f.content; }
async function findGist() {
  for (let page = 1; page <= 30; page++) {
    const list = await gh('/gists?per_page=100&page=' + page);
    const g = (list || []).find(x => x.files && x.files[R.DATA_FILE]);
    if (g) return g; if (!list || list.length < 100) return null;
  }
  return null;
}
async function apifySearch(query) { // rag-web-browser via l'API REST Apify ; le jeton ne quitte jamais ce processus
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 70000);
  try { const r = await fetch(APIFY_API + '/v2/acts/apify~rag-web-browser/run-sync-get-dataset-items?token=' + encodeURIComponent(APIFY_TOKEN),
    { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', 'User-Agent': R.UA },
      body: JSON.stringify({ query, maxResults: 3, outputFormats: ['markdown'], requestTimeoutSecs: 40 }) });
    if (!r.ok) { const e = new Error('Apify ' + r.status); e.status = r.status; throw e; } return r.json();
  } finally { clearTimeout(t); } }
const ctx = {
  now: () => NOW,
  ...(APIFY_TOKEN ? { apify: apifySearch } : {}),
  json: async u => { const r = await fetch(u, { headers: { 'User-Agent': R.UA, Accept: 'application/json' } }); if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return r.json(); },
  text: async u => { const r = await fetch(u, { headers: { 'User-Agent': R.UA } }); if (r.status === 429 || r.status === 503) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return r.ok ? r.text() : null; },
};

(async () => {
  if (!TOKEN) { log('::warning::Secret GIST_TOKEN absent : ajoute un jeton GitHub (portée « gist » uniquement) dans Settings → Secrets and variables → Actions. Rien n’a été fait.'); return; }
  const p = R.parisParts(NOW), gate = R.lastTuesday6(NOW);
  if (!FORCE && !(p.wd === 2 && p.h >= 6)) { log('Pas mardi matin à Paris : rien à faire.'); return; }
  const meta = await findGist();
  if (!meta) { log('::warning::Aucun gist « ' + R.DATA_FILE + ' » trouvé pour ce jeton (synchronise d’abord l’application).'); return; }
  const gist = await gh('/gists/' + encodeURIComponent(meta.id));
  if (!gist.files || !gist.files[R.DATA_FILE]) { log('::error::Gist inattendu.'); process.exit(1); }
  let prev = null; try { const t = await fileText(gist.files[R.FILE]); prev = t ? JSON.parse(t) : null; } catch (e) { prev = null; }
  if (!FORCE && prev && +prev.at >= gate && prev.by === 'action') { log('Déjà actualisé ce mardi : rien à faire.'); return; }
  let db; try { db = JSON.parse(await fileText(gist.files[R.DATA_FILE])); } catch (e) { log('::error::Fichier de données illisible.'); process.exit(1); }
  const want = R.wanted(db);
  log('Séries suivies : ' + want.length);
  log(APIFY_TOKEN ? 'Apify : activé (enrichissement optionnel, max ' + APIFY_MAX + ' séries sans date connue).' : 'Apify : secret APIFY_TOKEN absent, enrichissement ignoré (comportement habituel).');
  const res = await R.refreshAll(want, ctx, { prev, by: 'action', conc: 2, delay: 150, apifyMax: APIFY_MAX });
  if (want.length && res.failed === want.length) { log('::error::Aucune source joignable (' + res.failed + ' échecs) : fichier inchangé.'); process.exit(1); }
  const merged = R.mergeReleases(prev, res); merged.at = res.at; merged.by = 'action';
  for (const k of Object.keys(merged.series)) if (!want.find(w => w.key === k)) delete merged.series[k]; // séries retirées / terminées
  await gh('/gists/' + encodeURIComponent(gist.id), { method: 'PATCH', body: { files: { [R.FILE]: { content: JSON.stringify(merged) } } } });
  let up = 0; for (const s of Object.values(merged.series)) up += Object.keys(s.vols || {}).length;
  const apifyN = Object.values(merged.series).filter(x => (x.src || []).some(y => y.n === R.APIFY_SRC)).length;
  log('Terminé : ' + want.length + ' séries, ' + up + ' tomes repérés, ' + res.failed + ' échec(s)' + (APIFY_TOKEN ? ', ' + apifyN + ' série(s) avec source Apify/web.' : '.'));
})().catch(e => { console.log('::error::' + (e.status ? 'GitHub ' + e.status + (e.status === 401 ? ' (jeton invalide ou expiré)' : '') : 'erreur') ); process.exit(1); });
