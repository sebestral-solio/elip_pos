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
    console.log('📦 Starting inventory update for items:', orderItems);

    // Extract product IDs and quantities from order items
    const updates = orderItems.map(item => ({
      productId:item.productId, // Handle both id and productId fields
      quantity: item.quantity,
      itemName: item.name
    }));

    console.log('📋 Processing updates:', updates);

    // Process each product update
    const updateResults = await Promise.all(
      updates.map(async ({ productId, quantity, itemName }) => {
        try {
          // Find the product
          const product = await Product.findById(productId);

          if (!product) {
            console.log(`❌ Product not found: ${productId} (${itemName})`);
            return { success: false, productId, itemName, message: 'Product not found' };
          }

          console.log(`📊 Current stock for ${product.name}: ${product.quantity}, ordering: ${quantity}`);

          // Calculate new quantity (ensure it doesn't go below 0)
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

          console.log(`✅ Updated ${product.name}: ${product.quantity} → ${newQuantity} (available: ${updatedProduct.available})`);

          return {
            success: true,
            productId,
            itemName: product.name,
            oldQuantity: product.quantity,
            newQuantity: updatedProduct.quantity,
            available: updatedProduct.available,
            quantityOrdered: quantity
          };
        } catch (itemError) {
          console.error(`❌ Error updating product ${productId}:`, itemError);
          return { success: false, productId, itemName, message: itemError.message };
        }
      })
    );

    // Log summary
    const successful = updateResults.filter(r => r.success);
    const failed = updateResults.filter(r => !r.success);

    console.log(`📈 Inventory update complete: ${successful.length} successful, ${failed.length} failed`);
    if (failed.length > 0) {
      console.log('❌ Failed updates:', failed);
    }

    return { success: true, updates: updateResults, summary: { successful: successful.length, failed: failed.length } };
  } catch (error) {
    console.error('❌ Error updating product quantities:', error);
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
