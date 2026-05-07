module.exports = {
    ensureLoggedIn: (req, res, next) => {
        // Accept session-based login or cookie-based (local or MS) login
        let user = (req.session && req.session.user) || (req.cookies && req.cookies.user) || null;
        if (!user) return res.redirect('/login');

        // If cookie stored as JSON string, parse it
        if (typeof user === 'string') {
            try { user = JSON.parse(user); } catch (e) { user = { email: user }; }
        }

        // attach normalized user to request and ensure session is populated
        req.user = user;
        if (req.session && !req.session.user) req.session.user = user;

        return next();
    }
};