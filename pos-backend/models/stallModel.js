const mongoose = require("mongoose");

const stallSchema = new mongoose.Schema({
    // Basic identification fields
    stallNumber: {
        type: String,
        required: [true, "Stall number is required"],
        unique: true,
        trim: true,
        uppercase: true,
        match: [
            /^[A-Z0-9]{2,10}$/,
            "Stall number must be 2-10 characters, alphanumeric only"
        ]
    },
    name: {
        type: String,
        required: [true, "Stall name is required"],
        trim: true,
        maxlength: [100, "Stall name cannot exceed 100 characters"]
    },
    location: {
        type: String,
        trim: true,
        maxlength: [200, "Location cannot exceed 200 characters"]
    },
    
    // Relationship fields
    managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StallManager',
        required: [true, "Manager ID is required"]
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, "Admin ID is required"]
    },
    
    // Terminal reference - points to configuration.terminals array element _id
    terminalId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },

}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
stallSchema.index({ adminId: 1 });
stallSchema.index({ managerId: 1 });
stallSchema.index({ stallNumber: 1 }, { unique: true });
stallSchema.index({ terminalId: 1 });

// Virtual for manager info
stallSchema.virtual('managerInfo', {
    ref: 'StallManager',
    localField: 'managerId',
    foreignField: '_id',
    justOne: true
});

// Static method to find stalls by admin
stallSchema.statics.findByAdmin = function(adminId) {
    return this.find({ adminId });
};

// Static method to find stalls by manager
stallSchema.statics.findByManager = function(managerId) {
    return this.find({ managerId });
};

// Pre-save middleware
stallSchema.pre('save', function(next) {
    if (this.isModified('stallNumber')) {
        this.stallNumber = this.stallNumber.toUpperCase();
    }
    next();
});

const Stall = mongoose.model("Stall", stallSchema);

module.exports = Stall;
