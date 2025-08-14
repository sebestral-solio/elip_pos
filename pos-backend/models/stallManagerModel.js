const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const stallManagerSchema = new mongoose.Schema({
    // Authentication fields
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            "Please enter a valid email address"
        ]
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [6, "Password must be at least 6 characters long"]
    },
    
    // Personal information
    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true,
        maxlength: [100, "Name cannot exceed 100 characters"]
    },
    phone: {
        type: String,
        trim: true,
        match: [
            /^[\+]?[1-9][\d]{0,15}$/,
            "Please enter a valid phone number"
        ]
    },
    
    // Relationship fields
    stallIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Stall'
    }],
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Assuming admin is in User model
        required: [true, "Admin ID is required"]
    },
    
    // Permission and status fields
    permissions: [{
        type: String,
        enum: [
            'manage_orders',
            'manage_products', 
            'view_reports',
            'manage_staff',
            'manage_payments',
            'manage_inventory',
            'manage_settings'
        ]
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    
    // Additional fields
    role: {
        type: String,
        default: 'stall_manager',
        immutable: true
    },
    lastLogin: {
        type: Date
    },
    
    // Soft delete tracking
    deletedAt: {
        type: Date
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { 
    timestamps: true,
    toJSON: { 
        transform: function(doc, ret) {
            delete ret.password;
            return ret;
        }
    }
});

// Indexes for performance (avoid duplicate with unique: true)
stallManagerSchema.index({ adminId: 1 });
stallManagerSchema.index({ stallIds: 1 });
stallManagerSchema.index({ isActive: 1 });
stallManagerSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password
stallManagerSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return next();
    
    try {
        // Hash password with salt (consistent with User model)
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Instance method to update last login
stallManagerSchema.methods.updateLastLogin = async function() {
    this.lastLogin = new Date();
    return await this.save();
};

// Static method to find active managers
stallManagerSchema.statics.findActiveManagers = function() {
    return this.find({ isActive: true }).populate('stallIds', 'stallNumber name location');
};

// Static method to find managers by admin
stallManagerSchema.statics.findByAdmin = function(adminId) {
    return this.find({ adminId: adminId, isActive: true }).populate('stallIds');
};

// Virtual for full manager info with stalls
stallManagerSchema.virtual('stallsInfo', {
    ref: 'Stall',
    localField: 'stallIds',
    foreignField: '_id'
});

// Ensure virtual fields are serialized
stallManagerSchema.set('toJSON', { virtuals: true });
stallManagerSchema.set('toObject', { virtuals: true });

const StallManager = mongoose.model("StallManager", stallManagerSchema);

module.exports = StallManager;
