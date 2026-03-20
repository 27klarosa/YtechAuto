require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const router = express.Router();
const { ConfidentialClientApplication } = require("@azure/msal-node");

router.use(cookieParser());

const config = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.CLIENT_SECRET,
    }
};

const msalClient = new ConfidentialClientApplication(config);

router.get("/login", (req, res) => {
    const authUrlParams = {
        scopes: ["user.read"],
        redirectUri: process.env.REDIRECT_URI,
    };

    msalClient.getAuthCodeUrl(authUrlParams).then(url => {
        res.redirect(url);
    });
});

router.get("/auth/callback", async (req, res) => {
    const tokenRequest = {
        code: req.query.code,
        scopes: ["user.read"],
        redirectUri: process.env.REDIRECT_URI,
    };

    try {
        const response = await msalClient.acquireTokenByCode(tokenRequest);
        res.send(`Logged in! Welcome ${response.account.username}`);
        console.log(`${response.account.username}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Authentication Error");
    }
});

module.exports = router;