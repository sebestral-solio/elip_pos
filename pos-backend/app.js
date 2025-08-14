const express = require("express");
const connectDB = require("./config/database");
const config = require("./config/config");
const globalErrorHandler = require("./middlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const app = express();


const PORT = config.port;
connectDB();

// Middlewares
app.use(cors({
    credentials: true,
    origin: ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:6001','https://pos.nxgenvarsity.com']
}))

// Special handling for Stripe webhooks - need raw body
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

// Parse JSON for all other routes
app.use(express.json()); // parse incoming request in json format
app.use(cookieParser())


// Root Endpoint
app.get("/", (req,res) => {
    res.json({message : "Hello from POS Server!"});
})

// Other Endpoints
app.use("/api/user", require("./routes/userRoute"));
app.use("/api/order", require("./routes/orderRoute"));
app.use("/api/table", require("./routes/tableRoute"));
app.use("/api/payment", require("./routes/paymentRoute"));
app.use("/api/products", require("./routes/productRoute"));
app.use("/api/stall-managers", require("./routes/stallManagerRoutes"));
app.use("/api/stalls", require("./routes/stallRoutes"));
app.use("/api/configuration", require("./routes/configurationRoute"));
app.use("/api/configuration", require("./routes/configurationRoute"));

// Global Error Handler
app.use(globalErrorHandler);


// Server
app.listen(PORT, () => {
    console.log(`☑️  POS Server is listening on port ${PORT}`);
})