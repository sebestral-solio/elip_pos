require("dotenv").config();

const config = Object.freeze({
    port: process.env.PORT,
    databaseURI: process.env.MONGODB_URI,
    nodeEnv : process.env.NODE_ENV,
    accessTokenSecret: process.env.JWT_SECRET,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    stripeTerminalReaderId: process.env.STRIPE_TERMINAL_READER_ID
});

module.exports = config;
