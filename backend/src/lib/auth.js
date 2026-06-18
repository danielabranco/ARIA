const auth = (req, res, next) => {
  const expectedKey = process.env.ARIA_API_KEY;
  if (!expectedKey) return next(); // No key configured → open (dev mode)
  const provided = req.headers['x-aria-key'] || req.headers['x-api-key'];
  if (provided !== expectedKey) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

module.exports = { auth };
