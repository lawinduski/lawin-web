const { db } = require('./_firebase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Method not allowed');
  }

  const id = String(req.query?.id || '').trim();
  if (!id || !/^[A-Za-z0-9_-]{1,150}$/.test(id)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Invalid image id');
  }

  try {
    const snap = await db().collection('perfumes').doc(id).get();
    if (!snap.exists) {
      res.statusCode = 404;
      return res.end('Not found');
    }

    const image = snap.data()?.image;
    const match = typeof image === 'string'
      ? image.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i)
      : null;

    if (!match) {
      res.statusCode = 404;
      return res.end('Image not found');
    }

    const subtype = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');

    res.statusCode = 200;
    res.setHeader('Content-Type', `image/${subtype}`);
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=3600');
    res.setHeader('Content-Length', String(buffer.length));
    return res.end(buffer);
  } catch (e) {
    console.error('Public image error', e);
    res.statusCode = 500;
    return res.end('Unable to load image');
  }
};
