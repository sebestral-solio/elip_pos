const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    paymentIntentId: String,
    chargeId: String,
    amount: Number,
    currency: String,
    status: String,
    paymentMethodType: String, // 'card_present', 'paynow', etc.
    paymentMethod: String,
    email: String,
    contact: String,
    receiptUrl: String,
    metadata: {
        orderId: String,
        customerName: String,
        customerPhone: String
    },
    createdAt: Date
})

const Payment = mongoose.model("Payment", paymentSchema);
module.exports = Payment;