const express = require("express");
const { addOrder, getOrders, getOrderById, updateOrder, getOrderByOrderId } = require("../controllers/orderController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const router = express.Router();


router.route("/").post(isVerifiedUser, addOrder);
router.route("/").get(isVerifiedUser, getOrders);
router.route("/by-order-id/:orderId").get(isVerifiedUser, getOrderByOrderId);
router.route("/:id").get(isVerifiedUser, getOrderById);
router.route("/:id").put(isVerifiedUser, updateOrder);

module.exports = router;