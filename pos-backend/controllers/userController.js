const createHttpError = require("http-errors");
const User = require("../models/userModel");
const Configuration = require("../models/configurationModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config/config");

const register = async (req, res, next) => {
    try {

        const { name, phone, email, password, role } = req.body;

        if(!name || !phone || !email || !password || !role){
            const error = createHttpError(400, "All fields are required!");
            return next(error);
        }

        const isUserPresent = await User.findOne({email});
        if(isUserPresent){
            const error = createHttpError(400, "User already exist!");
            return next(error);
        }


        const user = { name, phone, email, password, role };
        const newUser = User(user);
        await newUser.save();

        res.status(201).json({success: true, message: "New user created!", data: newUser});


    } catch (error) {
        next(error);
    }
}


const login = async (req, res, next) => {

    try {
        
        const { email, password } = req.body;

        if(!email || !password) {
            const error = createHttpError(400, "All fields are required!");
            return next(error);
        }

        const isUserPresent = await User.findOne({email});
        if(!isUserPresent){
            const error = createHttpError(401, "Invalid Credentials");
            return next(error);
        }

        const isMatch = await bcrypt.compare(password, isUserPresent.password);
        if(!isMatch){
            const error = createHttpError(401, "Invalid Credentials");
            return next(error);
        }

        const accessToken = jwt.sign({_id: isUserPresent._id}, config.accessTokenSecret, {
            expiresIn : '1d'
        });

        res.cookie('accessToken', accessToken, {
            maxAge: 1000 * 60 * 60 *24 * 30,
            httpOnly: true,
            sameSite: 'none',
            secure: true
        })

        res.status(200).json({success: true, message: "User login successfully!", 
            data: isUserPresent
        });


    } catch (error) {
        next(error);
    }

}

const getUserData = async (req, res, next) => {
    try {
        const userType = req.userType;

        if (userType === 'stallManager') {
            // For stall managers, return the stall manager data
            const stallManager = req.user; // Already populated from middleware
            res.status(200).json({success: true, data: stallManager});
        } else {
            // For regular users
            const user = await User.findById(req.user._id);
            res.status(200).json({success: true, data: user});
        }

    } catch (error) {
        next(error);
    }
}

const logout = async (req, res, next) => {
    try {

        res.clearCookie('accessToken');
        res.status(200).json({success: true, message: "User logout successfully!"});

    } catch (error) {
        next(error);
    }
}

// Update tax rate for admin and propagate to linked users
const updateTaxRate = async (req, res, next) => {
    try {
        const { taxRate } = req.body;
        const userId = req.user._id;

        // Validate input
        if (taxRate === undefined || taxRate === null) {
            const error = createHttpError(400, "Tax rate is required");
            return next(error);
        }

        // Validate tax rate range
        if (taxRate < 0 || taxRate > 100) {
            const error = createHttpError(400, "Tax rate must be between 0 and 100");
            return next(error);
        }

        // Get the requesting user
        const user = await User.findById(userId);
        if (!user) {
            const error = createHttpError(404, "User not found");
            return next(error);
        }

        // Check if user is admin
        if (user.role !== 'Admin') {
            const error = createHttpError(403, "Only admin users can update tax rate configuration");
            return next(error);
        }

        // Get or create configuration for admin
        let configuration = await Configuration.findOne({ adminId: userId });
        if (!configuration) {
            configuration = new Configuration({
                adminId: userId,
                taxSettings: {
                    taxRate: taxRate,
                    platformFeeRate: 0,
                    lastUpdated: new Date()
                },
                terminals: [],
                businessSettings: {
                    currency: 'SGD',
                    timezone: 'Asia/Singapore'
                },
                linkedUsers: []
            });
        } else {
            // Update existing configuration
            configuration.taxSettings.taxRate = taxRate;
            configuration.taxSettings.lastUpdated = new Date();
        }

        await configuration.save();

        // Get linked users and update their tax rates (if any)
        const linkedUserIds = configuration.linkedUsers || [];
        if (linkedUserIds.length > 0) {
            // Update all linked users' tax rates in their configurations
            const updateResult = await Configuration.updateMany(
                {
                    adminId: { $in: linkedUserIds }
                },
                {
                    $set: {
                        'taxSettings.taxRate': taxRate,
                        'taxSettings.lastUpdated': new Date()
                    }
                }
            );

            console.log(`Updated tax rate for ${updateResult.modifiedCount} linked user configurations`);
        }

        res.status(200).json({
            success: true,
            message: "Tax rate updated successfully",
            data: {
                taxRate,
                linkedUsersUpdated: linkedUserIds.length,
                lastUpdated: configuration.taxSettings.lastUpdated
            }
        });

    } catch (error) {
        console.error('Error updating tax rate:', error);
        next(error);
    }
}

// Get tax rate for current user
const getTaxRate = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const userType = req.userType;

        let taxRate = 5.25; // Default
        let isAdmin = false;
        let canModify = false;
        let lastUpdated = null;

        if (userType === 'stallManager') {
            // For stall managers, get tax rate from their admin's configuration
            const stallManager = req.user; // Already populated from middleware

            if (stallManager.adminId) {
                const adminConfig = await Configuration.findOne({ adminId: stallManager.adminId });
                if (adminConfig) {
                    taxRate = adminConfig.taxSettings?.taxRate || 5.25;
                    lastUpdated = adminConfig.taxSettings?.lastUpdated || null;
                }
            }

            isAdmin = false;
            canModify = false; // Stall managers cannot modify tax rates
        } else {
            // For regular users
            const user = await User.findById(userId);
            if (!user) {
                const error = createHttpError(404, "User not found");
                return next(error);
            }

            isAdmin = user.role === 'Admin';
            canModify = isAdmin; // Only admins can modify tax rates

            if (isAdmin) {
                // For admin users, get from their configuration
                const adminConfig = await Configuration.findOne({ adminId: userId });
                if (adminConfig) {
                    taxRate = adminConfig.taxSettings?.taxRate || 5.25;
                    lastUpdated = adminConfig.taxSettings?.lastUpdated || null;
                } else {
                    // Create default configuration if it doesn't exist
                    const newConfig = new Configuration({
                        adminId: userId,
                        taxSettings: {
                            taxRate: 5.25,
                            platformFeeRate: 0,
                            lastUpdated: new Date()
                        },
                        terminals: [],
                        businessSettings: {
                            currency: 'SGD',
                            timezone: 'Asia/Singapore'
                        },
                        linkedUsers: []
                    });
                    await newConfig.save();
                    taxRate = 5.25;
                    lastUpdated = newConfig.taxSettings.lastUpdated;
                }
            } else {
                // For non-admin users, use default or check if they have their own config
                const userConfig = await Configuration.findOne({ adminId: userId });
                if (userConfig) {
                    taxRate = userConfig.taxSettings?.taxRate || 5.25;
                    lastUpdated = userConfig.taxSettings?.lastUpdated || null;
                }
            }
        }

        res.status(200).json({
            success: true,
            data: {
                taxRate,
                isAdmin,
                canModify,
                lastUpdated
            }
        });

    } catch (error) {
        console.error('Error getting tax rate:', error);
        next(error);
    }
}

module.exports = { register, login, getUserData, logout, updateTaxRate, getTaxRate }