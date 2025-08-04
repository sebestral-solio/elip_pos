const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    customerDetails: {
        name: { type: String, required: false },
        phone: { type: String, required: false },
    },
    orderStatus: {
        type: String,
        default: "Completed",
        required: true
    },
    orderDate: {
        type: Date,
        default: Date.now()
    },
    bills: {
        total: { type: Number, required: true },
        tax: { type: Number, required: true },
        totalWithTax: { type: Number, required: true }
    },
    items: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
            name: { type: String, required: true },
            price: { type: Number, required: true },
            quantity: { type: Number, required: true, default: 1 }
        }
    ],
    paymentMethod: String,
    paymentData: {
        stripe_payment_intent_id: String,
        stripe_charge_id: String,
        payment_method_type: String // 'card_present', 'paynow', 'cash'
    }
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);