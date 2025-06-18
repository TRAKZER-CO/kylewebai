function isAuthenticated(req, res, next) {
  if (!req.body.username) return res.status(403).json({ error: 'Login required' });
  next();
}

module.exports = { isAuthenticated };
