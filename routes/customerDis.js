const express = require('express');
const router = express.Router();
   
router.get('/customerDis', (req, res) => {
    const userCookie = req.cookies.user;
    
    if (userCookie) {
        try {
            const user = JSON.parse(userCookie);
            const email = user.email.toLowerCase();
            
            const db = req.app.locals.db;
            
            if (!db) {
                console.error('Database connection not available');
                return res.status(500).send('Database error');
            }
            
            // Get all tickets for this user's email, ordered by date (newest first)
            db.all('SELECT * FROM tickets WHERE customerEmail = ? and stat = ? ORDER BY date DESC', [email, 'complete'], (err, tickets) => {
                if (err) {
                    console.error('Database error:', err.message);
                    return res.status(500).send('Database error');
                } 
                
                console.log(`Found ${tickets ? tickets.length : 0} ticket(s) for user ${email}`);
                
                // Render the customerDis page with all tickets
                res.render('customerDis', { 
                    user: user,
                    tickets: tickets || [],
                    userEmail: email
                });
            });
            
        } catch (error) {
            console.error('Cookie parsing error:', error);
            res.clearCookie('user');
            res.redirect('/login');
        }
    } else {
        res.redirect('/login');
    }
});

router.post('/customerDis', (req, res) => {
    // Handle any POST requests here if needed
    res.redirect('/customerDis');
});

module.exports = router;
