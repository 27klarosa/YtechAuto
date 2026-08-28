require("dotenv").config();
const nodemailer = require("nodemailer");

// Create a map to store the email rate limits
const limitStore = new Map();
const RATE_LIMIT = 60000; // 1 minute in milliseconds

/**
 * Escape HTML special characters to prevent HTML injection/XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text safe for HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Send an email via SMTP.
 * Applies per-recipient rate limiting.
 * @param {string} recipient - Recipient email address.
 * @param {string} subject - Email subject.
 * @param {string} html - HTML content of the message.
 * @returns {void}
 */
function sendMail(recipient, subject, html, attachments = []) {

    // Get the email user and password from the environment variable
    // If the email user or password is not set, return
    const emailPassword = process.env.EMAIL_PASSWORD;
    const emailUser = process.env.EMAIL_USER;
    if (!emailPassword || !emailUser) return Promise.resolve(false);

    // Get the current time
    // Check if the user has sent an email within the specified time period
    const currentTime = Date.now();
    if (limitStore.has(recipient) && currentTime - limitStore.get(recipient) < RATE_LIMIT) {
        console.log(`[mail] Email rejected: ${recipient} exceeded rate limit`);
        return Promise.resolve(false);
    }

    // Configure the SMTP transport
    const smtpConfig = {
        service: "dreamhost",
        host: "smtp.dreamhost.com",
        port: 465,
        secure: true,
        // The email and password to the email the SMTP server will use
        auth: {
            user: emailUser,
            pass: emailPassword,
        },
    };

    // Create the transporter using the smtpConfig
    const transporter = nodemailer.createTransport(smtpConfig);
    const mailOptions = {
        from: emailUser,
        to: recipient,
        subject: subject,
        html: html,
        attachments,
    };

    return new Promise((resolve) => {
        transporter.sendMail(mailOptions, (error) => {
            if (error) {
                console.error("Error sending email:", error);
                resolve(false);
            } else {
                console.log(`[mail] Email sent to ${recipient}`);
                limitStore.set(recipient, currentTime);
                resolve(true);
            }
        });
    });
}

// Export the sendMail function and sanitization helper
module.exports = {
    sendMail,
    escapeHtml,
    limitStore,
    RATE_LIMIT,
};