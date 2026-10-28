// Petit serveur de confirmation d’abonnement Google Play.
// Il ne stocke pas la bibliothèque. Il dit seulement si un jeton d’achat est un abonnement actif,
// puis accuse réception auprès de Google (sinon Play rembourse au bout de 3 jours).
//
// Secret (jamais dans le dépôt) : PLAY_SERVICE_ACCOUNT = JSON du compte de service Play.
// Variables (wrangler.toml) : PACKAGE_NAME, PRODUCT_ID, ALLOWED_ORIGIN.
//
// Déploiement : npm i -g wrangler && wrangler login && wrangler secret put PLAY_SERVICE_ACCOUNT && wrangler deploy
// Puis copie l’URL https://….workers.dev/verify dans BILLING_API (index.html) et republie le site.

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || 'https://blood63.github.io';
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origin);
    const url = new URL(request.url);
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return cors(json({ ok: true, service: 'premium' }), origin);
    }
    if (request.method !== 'POST' || url.pathname !== '/verify') return cors(json({ active: false, error: 'methode' }, 404), origin);
    let body;
    try { body = await request.json(); } catch (e) { return cors(json({ active: false, error: 'json' }, 400), origin); }
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
    if (token.length < 8 || token.length > 4096) return cors(json({ active: false, error: 'jeton' }, 400), origin);
    if (productId !== (env.PRODUCT_ID || 'premium_mensuel')) return cors(json({ active: false, error: 'produit' }, 400), origin);
    if (!env.PLAY_SERVICE_ACCOUNT || !env.PACKAGE_NAME) return cors(json({ active: false, error: 'config' }, 500), origin);
    try {
      const access = await googleAccessToken(env.PLAY_SERVICE_ACCOUNT);
      const pack = encodeURIComponent(env.PACKAGE_NAME);
      const tok = encodeURIComponent(token);
      const got = await fetch('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' + pack + '/purchases/subscriptionsv2/tokens/' + tok, {
        headers: { Authorization: 'Bearer ' + access, Accept: 'application/json' }
      });
      if (got.status === 404 || got.status === 410) return cors(json({ active: false }), origin);
      if (!got.ok) return cors(json({ active: false, error: 'play' }, 502), origin);
      const sub = await got.json();
      const item = (sub.lineItems || []).find(x => x && x.productId === productId);
      const until = item && item.expiryTime;
      const active = !!item && subscriptionActive(sub.subscriptionState, until);
      if (active && sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
        const ack = await fetch('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' + pack + '/purchases/subscriptions/' + encodeURIComponent(productId) + '/tokens/' + tok + ':acknowledge', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + access, 'Content-Type': 'application/json' },
          body: '{}'
        });
        if (!ack.ok && ack.status !== 400) return cors(json({ active: false, error: 'accuse' }, 502), origin);
      }
      return cors(json({ active, until: active ? (until || '') : '' }), origin);
    } catch (e) {
      return cors(json({ active: false, error: 'serveur' }, 500), origin);
    }
  }
};

function subscriptionActive(state, expiryTime) {
  const exp = expiryTime ? Date.parse(expiryTime) : 0;
  if (exp && exp < Date.now() - 5 * 60 * 1000) return false;
  return state === 'SUBSCRIPTION_STATE_ACTIVE' || state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' || (state === 'SUBSCRIPTION_STATE_CANCELED' && exp > Date.now());
}

let cached = null;
async function googleAccessToken(raw) {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;
  const sa = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  })));
  const input = header + '.' + claim;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input)));
  const assertion = input + '.' + b64url(sig);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error('oauth');
  cached = { token: j.access_token, exp: now + (j.expires_in || 3600) };
  return j.access_token;
}

function pemToDer(pem) {
  const b64 = String(pem).replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}
function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function json(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }); }
function cors(res, origin) {
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', origin);
  h.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type');
  h.set('Vary', 'Origin');
  return new Response(res.body, { status: res.status, headers: h });
}
