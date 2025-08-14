const mongoose = require("mongoose");

const configurationSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // One config per admin
  },
  
  // Tax & Fee Configuration
  taxSettings: {
    taxRate: { type: Number, default: 5.25, min: 0, max: 100 },
    platformFeeRate: { type: Number, default: 0, min: 0, max: 100 },
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // Terminal Configuration
  terminals: [{
    terminalId: { type: String, required: true }, // tmr_FDOt2wlRZEdpd7
    label: { type: String, required: true }, // Blue Rabbit
    deviceType: String, // simulated_wisepos_e
    status: { type: String, enum: ['online', 'offline'], default: 'offline' },
    location: String, // Stripe location ID
    serialNumber: String,
    ipAddress: String,
    lastSeen: Date,
    isActive: { type: Boolean, default: true },
    assignedStallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall' },
    stripeData: mongoose.Schema.Types.Mixed, // Store full Stripe response
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],
  
  // Other Configuration
  businessSettings: {
    businessName: String,
    businessAddress: String,
    businessPhone: String,
    businessEmail: String,
    currency: { type: String, default: 'SGD' },
    timezone: { type: String, default: 'Asia/Singapore' }
  },
  
  // Linked Users (moved from userModel)
  linkedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

module.exports = mongoose.model("Configuration", configurationSchema);
