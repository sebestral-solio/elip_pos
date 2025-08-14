const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    available: { type: Boolean, default: true },
    quantity: { type: Number, default: 0 },
    sold: { type: Number, default: 0, min: 0 },
    unlimited: { type: Boolean, default: false },
    image: { type: String },
    description: { type: String }
}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);
