// Middleware to accept either session-based local login or cookie-based Azure/local login
function normalizeUserFromCookie(cookieValue) {
  if (!cookieValue) return null;

  if (typeof cookieValue === 'string') {
    try {
      const parsed = JSON.parse(cookieValue);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) {
      // Ignore malformed JSON and treat it as a raw email value.
    }
    return { email: String(cookieValue) };
  }

  if (typeof cookieValue === 'object') {
    return cookieValue;
  }

  return null;
}

module.exports = {
  ensureLoggedIn: (req, res, next) => {
    try {
      let user = (req.session && req.session.user) || null;

      if (!user && req.cookies && req.cookies.user) {
        user = normalizeUserFromCookie(req.cookies.user);
      }

      if (!user || !(user.email || user.Email)) {
        return res.redirect('/login');
      }

      user.email = String(user.email || user.Email || '').toLowerCase();
      req.user = user;
      if (req.session && !req.session.user) req.session.user = user;
      return next();
    } catch (err) {
      console.error('ensureLoggedIn error', err);
      return res.redirect('/login');
    }
  }
};
