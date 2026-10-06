const admin = require('firebase-admin');

let app;
function getApp() {
  if (app) return app;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase server credentials are not configured');
  app = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
  return app;
}

function db() { return getApp().firestore(); }
function auth() { return getApp().auth(); }

async function requireAdmin(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)__session=([^;]+)/);
  if (!match) { const e = new Error('Unauthorized'); e.status = 401; throw e; }
  let decoded;
  try { decoded = await auth().verifySessionCookie(decodeURIComponent(match[1]), true); }
  catch (_) { const e = new Error('Unauthorized'); e.status = 401; throw e; }
  const adminUid = process.env.ADMIN_UID;
  if (!adminUid || decoded.uid !== adminUid) { const e = new Error('Forbidden'); e.status = 403; throw e; }
  return decoded;
}

function json(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(data));
}

function publicSettings(data) {
  return {
    whatsapp: data.whatsapp || '',
    instagram: data.instagram || '',
    snapchat: data.snapchat || '',
    tiktok: data.tiktok || '',
    locationUrl: data.locationUrl || '',
    currency: data.currency || '$'
  };
}

module.exports = { admin, getApp, db, auth, requireAdmin, json, publicSettings };
