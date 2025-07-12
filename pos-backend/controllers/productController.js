const createHttpError = require("http-errors");
const Product = require("../models/productModel");
const { default: mongoose } = require("mongoose");

// Get all products
const getProducts = async (req, res, next) => {
  try {
    const products = await Product.find();
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

// Get a single product by ID
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(400, "Invalid product ID");
      return next(error);
    }

    const product = await Product.findById(id);
    if (!product) {
      const error = createHttpError(404, "Product not found");
      return next(error);
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// Create a new product
const createProduct = async (req, res, next) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res
      .status(201)
      .json({ success: true, message: "Product created!", data: product });
  } catch (error) {
    next(error);
  }
};

// Update a product
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(400, "Invalid product ID");
      return next(error);
    }

    const product = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      const error = createHttpError(404, "Product not found");
      return next(error);
    }

    res
      .status(200)
      .json({ success: true, message: "Product updated", data: product });
  } catch (error) {
    next(error);
  }
};

// Delete a product
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(400, "Invalid product ID");
      return next(error);
    }

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      const error = createHttpError(404, "Product not found");
      return next(error);
    }

    res
      .status(200)
      .json({ success: true, message: "Product deleted", data: product });
  } catch (error) {
    next(error);
  }
};

// Update product quantities after order placement
const updateProductQuantities = async (orderItems) => {
  try {
    // Extract product IDs and quantities from order items
    const updates = orderItems.map(item => ({
      productId: item.id,
      quantity: item.quantity
    }));
    
    // Process each product update
    const updateResults = await Promise.all(
      updates.map(async ({ productId, quantity }) => {
        // Find the product
        const product = await Product.findById(productId);
        
        if (!product) {
          return { success: false, productId, message: 'Product not found' };
        }
        
        // Calculate new quantity
        const newQuantity = Math.max(0, product.quantity - quantity);
        
        // Update product quantity and availability status
        const updatedProduct = await Product.findByIdAndUpdate(
          productId,
          { 
            quantity: newQuantity,
            available: newQuantity > 0 
          },
          { new: true }
        );
        
        return { 
          success: true, 
          productId, 
          oldQuantity: product.quantity,
          newQuantity: updatedProduct.quantity,
          available: updatedProduct.available
        };
      })
    );
    
    return { success: true, updates: updateResults };
  } catch (error) {
    console.error('Error updating product quantities:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductQuantities
};
