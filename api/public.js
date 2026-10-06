const { db, json, publicSettings } = require('./_firebase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const [cats, perfumes, settingsDoc] = await Promise.all([
      db().collection('categories').get(),
      db().collection('perfumes').get(),
      db().collection('settings').doc('main').get()
    ]);
    const sortDocs = (docs) => [...docs].sort((a,b) => (Number(a.data()?.order) || 0) - (Number(b.data()?.order) || 0));
    const sortedCats = sortDocs(cats.docs);
    const sortedPerfumes = sortDocs(perfumes.docs);

    // IMPORTANT: perfume images are stored as base64 in Firestore. Do not include
    // those large blobs in the initial public JSON. The browser loads each image
    // lazily from /api/image?id=... only when it is needed.
    const publicPerfumes = sortedPerfumes.map(d => {
      const data = d.data() || {};
      const { image, ...rest } = data;
      let imageUrl = '';
      if (typeof image === 'string' && image.trim()) {
        const raw = image.trim();
        imageUrl = /^https?:\/\//i.test(raw) ? raw : (/^data:image\//i.test(raw) ? `/api/image?id=${encodeURIComponent(d.id)}` : '');
      }
      return { id: d.id, ...rest, imageUrl };
    });

    res.setHeader('Cache-Control', 'private, max-age=20, stale-while-revalidate=60');
    return json(res, 200, {
      categories: sortedCats.map(d => ({ id: d.id, ...d.data() })),
      perfumes: publicPerfumes,
      settings: publicSettings(settingsDoc.exists ? settingsDoc.data() : {})
    });
  } catch (e) {
    console.error('Public data error', e);
    return json(res, 500, { error: 'Unable to load site data' });
  }
};
