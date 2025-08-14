const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const { default: mongoose } = require("mongoose");
const { updateProductAvailability } = require("./productController");
const Product = require("../models/productModel");

const addOrder = async (req, res, next) => {
  try {
    // Validate inventory before placing order
    if (req.body.items && req.body.items.length > 0) {
      // Check if all products have sufficient inventory
      const inventoryCheck = await validateInventory(req.body.items);
      
      if (!inventoryCheck.valid) {
        return res.status(400).json({
          success: false,
          message: "Insufficient inventory for some items",
          invalidItems: inventoryCheck.invalidItems
        });
      }
    }
    
    const order = new Order(req.body);
    await order.save();

    // For cash payments, automatically set status to Completed since payment is received immediately
    if (req.body.paymentMethod && req.body.paymentMethod.toLowerCase() === "cash") {
      order.paymentStatus = "Completed";
      order.status = "Completed";
      await order.save();
      console.log(`💰 Cash order ${order.orderId} automatically set to Completed status (paymentMethod: ${req.body.paymentMethod})`);
    } else {
      console.log(`ℹ️ Non-cash order created with paymentMethod: ${req.body.paymentMethod}`);
    }

    // Update sold counts and product availability after order is placed
    if (req.body.items && req.body.items.length > 0) {
      // First, update sold counts for all products (both unlimited and limited)
      console.log(`📈 Updating sold counts for order ${order.orderId} with ${req.body.items.length} items`);

      const soldUpdatePromises = req.body.items.map(async (item) => {
        try {
          const product = await Product.findById(item.productId || item.id);

          if (!product) {
            console.log(`⚠️ Product not found for ID: ${item.productId || item.id}`);
            return { success: false, productId: item.productId || item.id, error: 'Product not found' };
          }

          // Update sold count for both unlimited and limited products
          const updatedProduct = await Product.findByIdAndUpdate(
            item.productId || item.id,
            { $inc: { sold: item.quantity } },
            { new: true }
          );

          if (updatedProduct) {
            const productType = updatedProduct.unlimited ? 'unlimited' : 'limited';
            console.log(`📊 ${updatedProduct.name} (${productType}): sold count increased by ${item.quantity} (total sold: ${updatedProduct.sold})`);
            return { success: true, productName: updatedProduct.name, quantitySold: item.quantity, unlimited: updatedProduct.unlimited };
          } else {
            return { success: false, productId: item.productId || item.id, error: 'Failed to update product' };
          }
        } catch (error) {
          console.error(`❌ Error updating sold count for product ${item.productId || item.id}:`, error);
          return { success: false, productId: item.productId || item.id, error: error.message };
        }
      });

      const soldUpdateResults = await Promise.all(soldUpdatePromises);
      const successfulSoldUpdates = soldUpdateResults.filter(result => result.success);
      const failedSoldUpdates = soldUpdateResults.filter(result => !result.success);

      console.log(`✅ Sold count updates completed: ${successfulSoldUpdates.length} successful, ${failedSoldUpdates.length} failed`);

      if (failedSoldUpdates.length > 0) {
        console.error(`⚠️ Failed sold count updates:`, failedSoldUpdates);
      }

      // Then, update product availability (this will skip unlimited products for availability logic)
      const updateResult = await updateProductAvailability(req.body.items);
      console.log('Availability update result:', updateResult);

      // Even if availability update fails, we still return the order
      // but log the error for administrators to handle
      if (!updateResult.success) {
        console.error('Failed to update availability after order:', updateResult.error);
      }
    }
    
    res
      .status(201)
      .json({ success: true, message: "Order created!", data: order });
  } catch (error) {
    next(error);
  }
};

// Helper function to validate inventory before placing order
const validateInventory = async (orderItems) => {
  try {
    const invalidItems = [];

    // Check each item in the order
    for (const item of orderItems) {
      const product = await Product.findById(item.id);

      // If product not found
      if (!product) {
        invalidItems.push({
          id: item.id,
          name: item.name,
          requested: item.quantity,
          available: 0,
          reason: "Product not found"
        });
        continue;
      }

      // Skip quantity validation for unlimited products - only check if available
      if (product.unlimited) {
        if (!product.available) {
          invalidItems.push({
            id: item.id,
            name: product.name,
            requested: item.quantity,
            available: "unlimited",
            reason: "Product not available"
          });
        }
        continue; // Skip quantity checks for unlimited products
      }

      // Calculate available stock (total quantity - sold) for limited products
      const availableStock = Math.max(0, (product.quantity || 0) - (product.sold || 0));

      // Quantity validation for limited products
      if (!product.available || availableStock === 0) {
        invalidItems.push({
          id: item.id,
          name: product.name,
          requested: item.quantity,
          available: availableStock,
          reason: "Product not available"
        });
      } else if (availableStock < item.quantity) {
        invalidItems.push({
          id: item.id,
          name: product.name,
          requested: item.quantity,
          available: availableStock,
          reason: "Insufficient quantity"
        });
      }
    }
    
    return {
      valid: invalidItems.length === 0,
      invalidItems
    };
  } catch (error) {
    console.error('Error validating inventory:', error);
    throw error;
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid id!");
      return next(error);
    }

    const order = await Order.findById(id);
    if (!order) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

const getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find();
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

const updateOrder = async (req, res, next) => {
  try {
    const { paymentStatus } = req.body;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid id!");
      return next(error);
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { paymentStatus },
      { new: true }
    );

    if (!order) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    res
      .status(200)
      .json({ success: true, message: "Order updated", data: order });
  } catch (error) {
    next(error);
  }
};

module.exports = { addOrder, getOrderById, getOrders, updateOrder };
