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


}, { timestamps : true })

// Pre-save middleware for password hashing
userSchema.pre('save', async function (next) {
    // Hash password if modified
    if(this.isModified('password')){
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }



    next();
})

// Add indexes for better performance
userSchema.index({ role: 1 });
userSchema.index({ email: 1 }, { unique: true });

// Instance method to check if user is admin
userSchema.methods.isAdmin = function() {
    return this.role === 'Admin';
};



module.exports = mongoose.model("User", userSchema);