// Middleware to accept either session-based local login or cookie-based Azure/local login
module.exports = {
  ensureLoggedIn: (req, res, next) => {
    try {
      // priority: session user
      let user = (req.session && req.session.user) || null;

      // fallback: cookie named 'user' may be a JSON string or plain email
      if (!user && req.cookies && req.cookies.user) {
        const c = req.cookies.user;
        if (typeof c === 'string') {
          try {
            user = JSON.parse(c);
          } catch (e) {
            // not JSON, treat as raw email
            user = { email: String(c) };
          }
        } else if (typeof c === 'object') {
          user = c;
        }
      }

      if (!user) {
        return res.redirect('/login');
      }

      // normalize email to lowercase when present
      if (user && user.email) user.email = String(user.email).toLowerCase();

      // attach normalized user to req and ensure session is populated
      req.user = user;
      if (req.session && !req.session.user) req.session.user = user;
      return next();
    } catch (err) {
      console.error('ensureLoggedIn error', err);
      return res.redirect('/login');
    }
  }
};
