const createHttpError = require("http-errors");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const User = require("../models/userModel");
const StallManager = require("../models/stallManagerModel");


const isVerifiedUser = async (req, res, next) => {
    try {
        const { accessToken } = req.cookies;

        if (!accessToken) {
            const error = createHttpError(401, "Please provide token!");
            return next(error);
        }

        const decodeToken = jwt.verify(accessToken, config.accessTokenSecret);

        let user = null;
        let userType = 'user'; // default

        // Check if token has userType (for stall managers)
        if (decodeToken.userType === 'stallManager') {
            user = await StallManager.findById(decodeToken._id)
                .populate('stallIds', 'stallNumber name location');
            userType = 'stallManager';

            if (!user || !user.isActive) {
                const error = createHttpError(401, "Stall manager not found or inactive!");
                return next(error);
            }
        } else {
            // Default: look up in User model
            user = await User.findById(decodeToken._id);
            userType = 'user';

            if (!user) {
                const error = createHttpError(401, "User not found!");
                return next(error);
            }
        }

        // Add user and userType to request object
        req.user = user;
        req.userType = userType;
        next();

    } catch (error) {
        console.error('Token verification error:', error);
        const err = createHttpError(401, "Invalid Token!");
        next(err);
    }
}

module.exports = { isVerifiedUser };