//importer
require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const multer = require('multer');
const PORT = process.env.PORT || 3000;
const http = require('http');
const server = require('http').createServer(app);
const sqlite3 = require('sqlite3');
const fs = require('fs');

//middelware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

//Routes
const indexRouter = require('./routes/index');
const mechanicRouter = require('./routes/mechanic');
const customerRouter = require('./routes/customer');
const customerDisRouter = require('./routes/customerDis');
const mechanicDisRouter = require('./routes/mechanicDis');

app.use('/', indexRouter);
app.use('/', mechanicRouter);
app.use('/', customerRouter);
app.use('/', customerDisRouter);
app.use('/', mechanicDisRouter);


server.listen(PORT, () => {
    console.log(`Example app listening on port http://localhost:${PORT}`);
});
