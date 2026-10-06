const { auth, json } = require('./_firebase');

const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
const loginAttempts = globalThis.__omarLoginAttempts || (globalThis.__omarLoginAttempts = new Map());
function clientIp(req){ return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim(); }
function rateLimited(ip){
  const now = Date.now();
  const item = loginAttempts.get(ip) || { count: 0, start: now };
  if(now - item.start > 15 * 60 * 1000){ item.count = 0; item.start = now; }
  item.count += 1; loginAttempts.set(ip, item);
  return item.count > 10;
}
function cookie(value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `__session=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(maxAge / 1000))}${secure}`;
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const raw = (req.headers.cookie || '').match(/(?:^|;\s*)__session=([^;]+)/);
      if (!raw) return json(res, 200, { authenticated: false });
      try {
        const decoded = await auth().verifySessionCookie(decodeURIComponent(raw[1]), true);
        return json(res, 200, { authenticated: decoded.uid === process.env.ADMIN_UID });
      } catch (_) { return json(res, 200, { authenticated: false }); }
    }

    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', cookie('', 0));
      return json(res, 200, { ok: true });
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
    const ip = clientIp(req);
    if(rateLimited(ip)) return json(res, 429, { error: 'Too many login attempts' });
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) return json(res, 400, { error: 'Email and password are required' });

    const key = process.env.FIREBASE_WEB_API_KEY;
    if (!key) return json(res, 500, { error: 'Authentication is not configured' });

    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const data = await response.json();
    if (!response.ok || !data.idToken) return json(res, 401, { error: 'Invalid credentials' });

    const decoded = await auth().verifyIdToken(data.idToken, true);
    if (!process.env.ADMIN_UID || decoded.uid !== process.env.ADMIN_UID) {
      return json(res, 403, { error: 'Not authorized' });
    }

    loginAttempts.delete(ip);
    const sessionCookie = await auth().createSessionCookie(data.idToken, { expiresIn: FIVE_DAYS });
    res.setHeader('Set-Cookie', cookie(sessionCookie, FIVE_DAYS));
    return json(res, 200, { authenticated: true });
  } catch (e) {
    console.error('Auth error', e);
    return json(res, 500, { error: 'Authentication failed' });
  }
};
