const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ["Pending", "Completed", "Failed"],
        default: "Pending",
        required: true
    },
    customerDetails: {
        name: { type: String, required: false },
        phone: { type: String, required: false },
    },
    paymentStatus: {
        type: String,
        default: "Pending",
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
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Payment'
}

}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);