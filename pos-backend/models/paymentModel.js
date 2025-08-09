const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    paymentIntentId: {
        type: String,
        required: true,
        unique: true
    },
    chargeId: String,
    amount: Number,
    currency: String,
    status: {
        type: String,
        enum: ["succeeded", "failed", "pending", "cancelled"],
        required: true
    },
    paymentMethodType: String, // 'card_present', 'paynow', etc.
    paymentMethod: String,
    email: String,
    contact: String,
    receiptUrl: String,
    failureCode: String, // For terminal failures
    failureMessage: String, // For terminal failures
    metadata: {
        orderId: String,
        customerName: String,
        customerPhone: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true })

const Payment = mongoose.model("Payment", paymentSchema);
module.exports = Payment;