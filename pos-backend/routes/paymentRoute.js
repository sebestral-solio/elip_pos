const express = require("express");
const router = express.Router();
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const {
  createPaymentIntent,
  confirmPayment,
  stripeWebhookHandler,
  getTerminalReaders,
  createTerminalLocation,
  createConnectionToken,
  checkPaymentStatus,
  capturePaymentIntent,
  processPaymentOnReader
} = require("../controllers/paymentController");

router.route("/create-payment-intent").post(isVerifiedUser, createPaymentIntent);
router.route("/confirm-payment").post(isVerifiedUser, confirmPayment);
router.route("/webhook").post(stripeWebhookHandler);
router.route("/terminal/readers").get(isVerifiedUser, getTerminalReaders);
router.route("/terminal/location").post(isVerifiedUser, createTerminalLocation);
router.route("/connection-token").post(isVerifiedUser, createConnectionToken);
router.route("/status/:paymentIntentId").get(isVerifiedUser, checkPaymentStatus);
router.route("/capture").post(isVerifiedUser, capturePaymentIntent);
router.route("/process-on-reader").post(isVerifiedUser, processPaymentOnReader);

module.exports = router;