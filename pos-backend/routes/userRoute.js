const express = require("express");
const { register, login, getUserData, logout, updateTaxRate, getTaxRate } = require("../controllers/userController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const router = express.Router();


// Authentication Routes
router.route("/register").post(register);
router.route("/login").post(login);
router.route("/logout").post(isVerifiedUser, logout)

router.route("/").get(isVerifiedUser , getUserData);

// Configuration Routes
router.route("/config/tax-rate").put(isVerifiedUser, updateTaxRate);
router.route("/config/tax-rate").get(isVerifiedUser, getTaxRate);

module.exports = router;