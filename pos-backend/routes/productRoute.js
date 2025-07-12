const express = require("express");
const { 
  getProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct 
} = require("../controllers/productController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const router = express.Router();

// Public route to get all products
router.route("/").get(getProducts);
router.route("/:id").get(getProductById);

// Protected routes for admin operations
router.route("/").post(isVerifiedUser, createProduct);
router.route("/:id").put(isVerifiedUser, updateProduct);
router.route("/:id").delete(isVerifiedUser, deleteProduct);

module.exports = router;
