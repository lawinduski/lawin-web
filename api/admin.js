const { db, json, requireAdmin } = require('./_firebase');


const PERFUME_KEYS = ['categoryId','order','available','price','discountPercent','discountAmount','isOil','name_ckb','name_ar','name_en','notes_ckb','notes_ar','notes_en','image','sizes','price_ml30','price_ml15','price_ml7'];
function cleanText(v, max){ return String(v ?? '').slice(0, max); }
function sanitizePerfume(d){
  const out = {};
  for (const k of PERFUME_KEYS) if (Object.prototype.hasOwnProperty.call(d, k)) out[k] = d[k];
  if ('categoryId' in out) out.categoryId = cleanText(out.categoryId, 120);
  for (const k of ['name_ckb','name_ar','name_en']) if (k in out) out[k] = cleanText(out[k], 200);
  for (const k of ['notes_ckb','notes_ar','notes_en']) if (k in out) out[k] = cleanText(out[k], 500);
  if ('image' in out) {
    out.image = cleanText(out.image, 1500000);
    if (out.image && !/^(?:data:image\/(jpeg|jpg|png|webp);base64,|https?:\/\/)/i.test(out.image)) out.image = '';
  }
  if ('price' in out) out.price = Math.max(0, Math.min(1000000, Number(out.price) || 0));
  if ('discountPercent' in out) out.discountPercent = Math.max(0, Math.min(99, Number(out.discountPercent) || 0));
  if ('discountAmount' in out) out.discountAmount = Math.max(0, Math.min(1000000, Number(out.discountAmount) || 0));
  if ('order' in out) out.order = Number(out.order) || 0;
  if ('available' in out) out.available = !!out.available;
  if ('isOil' in out) out.isOil = !!out.isOil;
  if (Array.isArray(out.sizes)) {
    out.sizes = out.sizes.slice(0, 20).map(x => ({ id: cleanText(x?.id, 80), label: cleanText(x?.label, 80), price: Math.max(0, Math.min(1000000, Number(x?.price) || 0)) }));
  } else if ('sizes' in out) out.sizes = [];
  return out;
}

function cleanPublicSettings(s) {
  return {
    whatsapp: String(s.whatsapp || '').slice(0, 40),
    instagram: String(s.instagram || '').slice(0, 100),
    snapchat: String(s.snapchat || '').slice(0, 100),
    tiktok: String(s.tiktok || '').slice(0, 100),
    locationUrl: String(s.locationUrl || '').slice(0, 500),
    currency: String(s.currency || '$').slice(0, 8)
  };
}

module.exports = async (req, res) => {
  try {
    await requireAdmin(req);
    const store = db();

    if (req.method === 'GET') {
      const [cats, perfumes, settingsDoc, visitsDoc] = await Promise.all([
        store.collection('categories').get(),
        store.collection('perfumes').get(),
        store.collection('settings').doc('main').get(),
        store.collection('meta').doc('visits').get()
      ]);
      const sortDocs = (docs) => [...docs].sort((a,b) => (Number(a.data()?.order) || 0) - (Number(b.data()?.order) || 0));
      const sortedCats = sortDocs(cats.docs);
      const sortedPerfumes = sortDocs(perfumes.docs);
      return json(res, 200, {
        categories: sortedCats.map(d => ({ id: d.id, ...d.data() })),
        perfumes: sortedPerfumes.map(d => ({ id: d.id, ...d.data() })),
        settings: cleanPublicSettings(settingsDoc.exists ? settingsDoc.data() : {}),
        visits: visitsDoc.exists ? Number(visitsDoc.data().count || 0) : 0
      });
    }

    const body = req.body || {};
    const resource = body.resource;
    if (resource === 'category') {
      if (req.method === 'POST') {
        const d = body.data || {};
        const ref = await store.collection('categories').add({
          name_ckb: String(d.name_ckb || '').slice(0, 200),
          name_ar: String(d.name_ar || '').slice(0, 200),
          name_en: String(d.name_en || '').slice(0, 200),
          order: Number(d.order) || 0,
          type: d.type === 'collection' ? 'collection' : 'brand',
          isCollection: d.type === 'collection',
          parentId: d.type === 'brand' ? String(d.parentId || '').slice(0, 100) : ''
        });
        return json(res, 200, { id: ref.id });
      }
      if (req.method === 'PUT') {
        const d = body.data || {};
        await store.collection('categories').doc(String(body.id)).update({
          name_ckb: String(d.name_ckb || '').slice(0, 200), name_ar: String(d.name_ar || '').slice(0, 200),
          name_en: String(d.name_en || '').slice(0, 200), order: Number(d.order) || 0,
          parentId: String(d.parentId || '').slice(0, 100)
        });
        return json(res, 200, { ok: true });
      }
      if (req.method === 'DELETE') { await store.collection('categories').doc(String(body.id)).delete(); return json(res, 200, { ok: true }); }
    }

    if (resource === 'perfume') {
      if (req.method === 'POST') {
        const ref = await store.collection('perfumes').add(sanitizePerfume(body.data || {}));
        return json(res, 200, { id: ref.id });
      }
      if (req.method === 'PUT') { await store.collection('perfumes').doc(String(body.id)).update(sanitizePerfume(body.data || {})); return json(res, 200, { ok: true }); }
      if (req.method === 'DELETE') { await store.collection('perfumes').doc(String(body.id)).delete(); return json(res, 200, { ok: true }); }
    }

    if (resource === 'settings' && req.method === 'PUT') {
      await store.collection('settings').doc('main').set(cleanPublicSettings(body.data || {}), { merge: true });
      return json(res, 200, { ok: true });
    }

    return json(res, 400, { error: 'Invalid admin operation' });
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error('Admin API error', e);
    return json(res, status, { error: status === 500 ? 'Server error' : e.message });
  }
};
