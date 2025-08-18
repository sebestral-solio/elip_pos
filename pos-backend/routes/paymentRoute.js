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
  processPaymentOnReader,
  getPendingOrders,
  checkPaymentFailureAndCleanup,
  createCheckoutSession,
  verifyCheckoutSession,
  setReaderDisplay
} = require("../controllers/paymentController");

router.route("/create-payment-intent").post(isVerifiedUser, createPaymentIntent);
router.route("/create-checkout-session").post(isVerifiedUser, createCheckoutSession);
router.route("/verify-checkout/:sessionId/:orderId").get(isVerifiedUser, verifyCheckoutSession);
router.route("/confirm-payment").post(isVerifiedUser, confirmPayment);
router.route("/webhook").post(stripeWebhookHandler);
router.route("/terminal/readers").get(isVerifiedUser, getTerminalReaders);
router.route("/terminal/location").post(isVerifiedUser, createTerminalLocation);
router.route("/connection-token").post(isVerifiedUser, createConnectionToken);
router.route("/status/:paymentIntentId").get(isVerifiedUser, checkPaymentStatus);
router.route("/capture").post(isVerifiedUser, capturePaymentIntent);
router.route("/process-on-reader").post(isVerifiedUser, processPaymentOnReader);
router.route("/pending-orders").get(isVerifiedUser, getPendingOrders);
router.route("/check-failure/:paymentIntentId").get(isVerifiedUser, checkPaymentFailureAndCleanup);
router.route("/set-reader-display").post(isVerifiedUser, setReaderDisplay);

module.exports = router;