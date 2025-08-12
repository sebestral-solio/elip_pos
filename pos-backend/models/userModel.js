const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
    name : {
        type: String,
        required: true,
    },

    email : {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /\S+@\S+\.\S+/.test(v);
            },
            message : "Email must be in valid format!"
        }
    },

    phone: {
        type : Number,
        required: true,
        validate: {
            validator: function (v) {
                return /\d{10}/.test(v);
            },
            message : "Phone number must be a 10-digit number!"
        }
    },

    password: {
        type: String,
        required: true,
    },

    role: {
        type: String,
        required: true
    },

    config: {
        taxRate: {
            type: Number,
            default: 5.25,
            min: [0, 'Tax rate cannot be negative'],
            max: [100, 'Tax rate cannot exceed 100%'],
            validate: {
                validator: function(v) {
                    return v >= 0 && v <= 100;
                },
                message: 'Tax rate must be between 0 and 100'
            }
        },
        platformFeeRate: {
            type: Number,
            default: 0,
            min: [0, 'Platform fee rate cannot be negative'],
            max: [100, 'Platform fee rate cannot exceed 100%'],
            validate: {
                validator: function(v) {
                    return v >= 0 && v <= 100;
                },
                message: 'Platform fee rate must be between 0 and 100'
            }
        },
        linkedUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    }
}, { timestamps : true })

// Pre-save middleware for password hashing
userSchema.pre('save', async function (next) {
    // Hash password if modified
    if(this.isModified('password')){
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }

    // Update config.lastUpdated if config fields are modified
    if(this.isModified('config.taxRate') || this.isModified('config.platformFeeRate') || this.isModified('config.linkedUsers')) {
        this.config.lastUpdated = new Date();
    }

    // Initialize config for admin users if not present
    if(this.role === 'Admin' && !this.config) {
        this.config = {
            taxRate: 5.25,
            platformFeeRate: 0,
            linkedUsers: [],
            lastUpdated: new Date()
        };
    }

    next();
})

// Add indexes for better performance
userSchema.index({ role: 1 });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ 'config.lastUpdated': 1 });

// Instance method to check if user is admin
userSchema.methods.isAdmin = function() {
    return this.role === 'Admin';
};

// Instance method to get config (only for admin users)
userSchema.methods.getConfig = function() {
    if (this.role !== 'Admin') {
        return null;
    }
    return this.config || {
        taxRate: 5.25,
        platformFeeRate: 0,
        linkedUsers: [],
        lastUpdated: new Date()
    };
};

// Instance method to update config (only for admin users)
userSchema.methods.updateConfig = function(configData) {
    if (this.role !== 'Admin') {
        throw new Error('Only admin users can have configuration settings');
    }

    if (!this.config) {
        this.config = {};
    }

    if (configData.taxRate !== undefined) {
        this.config.taxRate = configData.taxRate;
    }
    if (configData.platformFeeRate !== undefined) {
        this.config.platformFeeRate = configData.platformFeeRate;
    }
    if (configData.linkedUsers !== undefined) {
        this.config.linkedUsers = configData.linkedUsers;
    }

    this.config.lastUpdated = new Date();
    return this.save();
};

module.exports = mongoose.model("User", userSchema);