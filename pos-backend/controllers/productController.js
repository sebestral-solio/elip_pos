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

// Update product availability status based on available stock (quantity - sold)
const updateProductAvailability = async (orderItems) => {
  try {
    console.log('📦 Starting availability update for items:', orderItems);

    // Extract product IDs from order items
    const updates = orderItems.map(item => ({
      productId: item.productId, // Handle both id and productId fields
      quantity: item.quantity,
      itemName: item.name
    }));

    console.log('📋 Processing availability updates:', updates);

    // Process each product availability update
    const updateResults = await Promise.all(
      updates.map(async ({ productId, quantity, itemName }) => {
        try {
          // Find the product
          const product = await Product.findById(productId);

          if (!product) {
            console.log(`❌ Product not found: ${productId} (${itemName})`);
            return { success: false, productId, itemName, message: 'Product not found' };
          }

          // Calculate available stock (quantity - sold)
          const availableStock = Math.max(0, (product.quantity || 0) - (product.sold || 0));

          console.log(`📊 Stock info for ${product.name}: Total: ${product.quantity}, Sold: ${product.sold}, Available: ${availableStock}`);

          // Update only availability status based on available stock
          const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            {
              available: availableStock > 0
            },
            { new: true }
          );

          console.log(`✅ Updated availability for ${product.name}: ${updatedProduct.available ? 'Available' : 'Out of Stock'} (${availableStock} remaining)`);

          return {
            success: true,
            productId,
            itemName: product.name,
            totalQuantity: product.quantity,
            soldQuantity: product.sold,
            availableStock: availableStock,
            available: updatedProduct.available,
            quantityOrdered: quantity
          };
        } catch (itemError) {
          console.error(`❌ Error updating product availability ${productId}:`, itemError);
          return { success: false, productId, itemName, message: itemError.message };
        }
      })
    );

    // Log summary
    const successful = updateResults.filter(r => r.success);
    const failed = updateResults.filter(r => !r.success);

    console.log(`📈 Availability update complete: ${successful.length} successful, ${failed.length} failed`);
    if (failed.length > 0) {
      console.log('❌ Failed updates:', failed);
    }

    return { success: true, updates: updateResults, summary: { successful: successful.length, failed: failed.length } };
  } catch (error) {
    console.error('❌ Error updating product availability:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductAvailability
};
