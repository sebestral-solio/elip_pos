const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const { default: mongoose } = require("mongoose");
const { updateProductQuantities } = require("./productController");
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
    
    // Update product quantities after order is placed
    if (req.body.items && req.body.items.length > 0) {
      const updateResult = await updateProductQuantities(req.body.items);
      console.log('Inventory update result:', updateResult);
      
      // Even if inventory update fails, we still return the order
      // but log the error for administrators to handle
      if (!updateResult.success) {
        console.error('Failed to update inventory after order:', updateResult.error);
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
      
      // If product not found or not enough quantity
      if (!product) {
        invalidItems.push({
          id: item.id,
          name: item.name,
          requested: item.quantity,
          available: 0,
          reason: "Product not found"
        });
      } else if (!product.available) {
        invalidItems.push({
          id: item.id,
          name: product.name,
          requested: item.quantity,
          available: product.quantity,
          reason: "Product not available"
        });
      } else if (product.quantity < item.quantity) {
        invalidItems.push({
          id: item.id,
          name: product.name,
          requested: item.quantity,
          available: product.quantity,
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
