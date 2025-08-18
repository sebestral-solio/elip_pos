const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const { default: mongoose } = require("mongoose");
const { updateProductAvailability } = require("./productController");
const Product = require("../models/productModel");
const Configuration = require("../models/configurationModel");

// Helper function to calculate platform fee amount for reporting
// orderTotal should be the final amount customer pays (including tax)
const calculatePlatformFeeAmount = async (orderTotalWithTax, userId) => {
  try {
    // Get platform fee rate from admin configuration
    let platformFeeRate = 0;

    // Find admin configuration (either user is admin or get from stall manager's admin)
    const configuration = await Configuration.findOne({ adminId: userId });
    if (configuration) {
      platformFeeRate = configuration.taxSettings?.platformFeeRate || 0;
    }

    // Calculate platform fee amount
    const platformFeeAmount = (orderTotalWithTax * platformFeeRate) / 100;
    return platformFeeAmount;
  } catch (error) {
    console.error('Error calculating platform fee amount:', error);
    return 0; // Return 0 if calculation fails
  }
};

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

    // Calculate platform fee amount for reporting (does not affect customer payment)
    // Use totalWithTax (final amount customer pays) for platform fee calculation
    const orderTotalWithTax = req.body.bills?.totalWithTax || 0;
    const platformFeeAmount = await calculatePlatformFeeAmount(orderTotalWithTax, req.user._id);

    // Add platform fee amount to bills for reporting
    const orderData = {
      ...req.body,
      bills: {
        ...req.body.bills,
        platformFeeAmount: platformFeeAmount
      }
    };

    const order = new Order(orderData);
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
    const { stallId, stallManagerId } = req.query;
    let filter = {};

    // Determine user type and apply appropriate filtering
    if (req.userType === 'stallManager') {
      // Stall managers only see orders from their assigned stalls
      filter.stallManagerId = req.user._id;
      console.log(`🏪 Filtering orders for stall manager: ${req.user._id}`);
    } else if (req.userType === 'admin' || req.user.role === 'Admin') {
      // Admins see all orders from stalls they created
      // If query parameters are provided, filter by them
      if (stallId) {
        filter.stallId = stallId;
        console.log(`🏪 Admin filtering by stallId: ${stallId}`);
      }
      if (stallManagerId) {
        filter.stallManagerId = stallManagerId;
        console.log(`👤 Admin filtering by stallManagerId: ${stallManagerId}`);
      }
      // If no filters provided, admin sees all orders (no filter applied)
      console.log(`👑 Admin user accessing orders with filter:`, filter);
    }

    const orders = await Order.find(filter)
      .populate('stallId', 'name stallNumber location')
      .populate('stallManagerId', 'name email')
      .sort({ createdAt: -1 }); // Most recent first

    console.log(`📋 Found ${orders.length} orders for user type: ${req.userType || req.user.role}`);
    
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
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

// Get order by orderId (string ID, not MongoDB _id)
const getOrderByOrderId = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId: orderId })
      .populate('paymentData')
      .lean();

    if (!order) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    res
      .status(200)
      .json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

module.exports = { addOrder, getOrderById, getOrders, updateOrder, getOrderByOrderId };
