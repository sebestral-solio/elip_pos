const stripe = require("stripe");
const config = require("../config/config");
const crypto = require("crypto");
const Payment = require("../models/paymentModel");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const Configuration = require("../models/configurationModel");
const { updateProductAvailability } = require("./productController");
const createHttpError = require("http-errors");

// Database persistence - no more memory storage needed

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
    console.log(`Fee rate: ${platformFeeRate}, Order total with tax: ${orderTotalWithTax}, Fee amount: ${platformFeeAmount}`);
    return platformFeeAmount;
  } catch (error) {
    console.error('Error calculating platform fee amount:', error);
    return 0; // Return 0 if calculation fails
  }
};

// Cleanup expired database records
const cleanupExpiredOrders = async () => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Clean up old pending orders (older than 1 hour)
    const expiredOrders = await Order.deleteMany({
      status: "Pending",
      createdAt: { $lt: oneHourAgo }
    });

    if (expiredOrders.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${expiredOrders.deletedCount} expired pending orders`);
    }

    // Clean up old failed payments (older than 1 hour)
    const expiredPayments = await Payment.deleteMany({
      status: "Failed",
      createdAt: { $lt: oneHourAgo }
    });

    if (expiredPayments.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${expiredPayments.deletedCount} expired failed payments`);
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
};

// Run cleanup every 30 minutes
setInterval(cleanupExpiredOrders, 30 * 60 * 1000);

// Helper function to validate inventory before placing order
const validateInventory = async (orderItems) => {
  try {
    const invalidItems = [];

    // Check each item in the order
    for (const item of orderItems) {
      const product = await Product.findById(item.id || item.productId);

      // If product not found
      if (!product) {
        invalidItems.push({
          id: item.id || item.productId,
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
            id: item.id || item.productId,
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
          id: item.id || item.productId,
          name: product.name,
          requested: item.quantity,
          available: availableStock,
          reason: "Product not available"
        });
      } else if (availableStock < item.quantity) {
        invalidItems.push({
          id: item.id || item.productId,
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

// Initialize Stripe with secret key
const stripeClient = config.stripeSecretKey ? stripe(config.stripeSecretKey) : null;

// Helper function to get terminal ID based on user type and stall assignment
const getTerminalIdForUser = async (req) => {
  console.log(`🔍 Getting terminal for user type: ${req.userType}, user ID: ${req.user?._id}`);

  if (req.userType === 'stallManager') {
    // For stall managers, get terminal from their assigned stall
    const StallManager = require("../models/stallManagerModel");
    const Stall = require("../models/stallModel");
    const Configuration = require("../models/configurationModel");

    console.log(`🔍 Looking up stall manager: ${req.user._id}`);

    // Get the stall manager with populated stall info
    const stallManager = await StallManager.findById(req.user._id).populate('stallIds');
    console.log(`🔍 Found stall manager:`, stallManager ? {
      id: stallManager._id,
      name: stallManager.name,
      stallCount: stallManager.stallIds?.length || 0
    } : 'null');

    if (!stallManager || !stallManager.stallIds || stallManager.stallIds.length === 0) {
      throw new Error("Stall manager has no assigned stalls");
    }

    // Get the first assigned stall (assuming one stall per manager for now)
    const assignedStall = stallManager.stallIds[0];
    console.log(`🔍 Assigned stall:`, assignedStall ? {
      id: assignedStall._id,
      name: assignedStall.name,
      terminalId: assignedStall.terminalId
    } : 'null');

    if (!assignedStall.terminalId) {
      throw new Error("No terminal assigned to your stall. Please contact admin to assign a terminal.");
    }

    // Get the configuration to find the actual terminal details
    const config = await Configuration.findOne({ adminId: assignedStall.adminId });
    console.log(`🔍 Configuration found:`, config ? {
      adminId: config.adminId,
      terminalCount: config.terminals?.length || 0
    } : 'null');

    if (!config || !config.terminals) {
      throw new Error("Terminal configuration not found");
    }

    // Find the terminal in configuration by _id
    const terminal = config.terminals.find(t => t._id.toString() === assignedStall.terminalId.toString());
    console.log(`🔍 Terminal found:`, terminal ? {
      id: terminal._id,
      terminalId: terminal.terminalId,
      label: terminal.label
    } : 'null');

    if (!terminal) {
      throw new Error("Terminal not found in configuration. Please contact admin.");
    }

    console.log(`💳 Using terminal ${terminal.terminalId} assigned to stall ${assignedStall.name} for stall manager ${stallManager.name}`);
    return terminal.terminalId; // This is the Stripe terminal ID

  } else {
    // For admins, use the configured default terminal
    console.log(`🔍 Using default terminal for admin user`);
    const readerId = config.stripeTerminalReaderId;
    if (!readerId) {
      throw new Error("Terminal reader ID not configured. Please set STRIPE_TERMINAL_READER_ID environment variable.");
    }
    console.log(`💳 Using default terminal: ${readerId}`);
    return readerId;
  }
};

// Set reader display with cart details
const setReaderDisplay = async (req, res, next) => {
  try {
    if (!stripeClient) {
      const error = createHttpError(500, "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.");
      return next(error);
    }

    const { orderData } = req.body;

    // Validate required order data
    if (!orderData || !orderData.items || !orderData.bills) {
      const error = createHttpError(400, "Order data with items and bills is required");
      return next(error);
    }

    // Get terminal ID for the user
    let readerId;
    try {
      readerId = await getTerminalIdForUser(req);
    } catch (terminalError) {
      console.error('Error getting terminal for user:', terminalError);
      const error = createHttpError(400, terminalError.message);
      return next(error);
    }

    // Map order items to Stripe cart line items format
    const lineItems = orderData.items.map(item => ({
      amount: Math.round((item.price || 0) * 100), // Convert to cents
      description: item.name || 'Unknown Item',
      quantity: item.quantity || 1
    }));

    // Prepare cart data for Stripe Terminal
    const cartData = {
      currency: "sgd",
      tax: Math.round((orderData.bills.tax || 0) * 100), // Convert to cents
      total: Math.round((orderData.bills.totalWithTax || 0) * 100), // Convert to cents
      line_items: lineItems
    };

    console.log(`📱 Setting reader display for terminal: ${readerId}`);
    console.log(`📱 Cart data:`, {
      currency: cartData.currency,
      tax: cartData.tax,
      total: cartData.total,
      itemCount: cartData.line_items.length
    });

    // Set the reader display
    const reader = await stripeClient.terminal.readers.setReaderDisplay(
      readerId,
      {
        type: "cart",
        cart: cartData
      }
    );

    console.log(`✅ Reader display set successfully for terminal: ${readerId}`);
    console.log(`📱 Reader status: ${reader.status}, Action status: ${reader.action?.status}`);

    res.status(200).json({
      success: true,
      message: "Reader display set successfully",
      reader: {
        id: reader.id,
        status: reader.status,
        action: reader.action
      },
      cart: cartData
    });

  } catch (error) {
    console.error('❌ Error setting reader display:', error);
    
    // Handle specific Stripe Terminal errors
    if (error.type === 'StripeInvalidRequestError') {
      if (error.code === 'terminal_reader_offline') {
        return res.status(400).json({
          success: false,
          message: "Terminal reader is offline and cannot display cart",
          error: {
            code: error.code,
            message: error.message
          }
        });
      }
    }

    next(error);
  }
};

const createPaymentIntent = async (req, res, next) => {
  try {
    if (!stripeClient) {
      const error = createHttpError(500, "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.");
      return next(error);
    }

    const { amount, customerInfo, orderData } = req.body;

    // Validate required order data
    // Validate required order data
    if (!orderData || !orderData.items || !orderData.bills) {
      console.log("Missing order data:", { orderData: !!orderData, items: !!orderData?.items, bills: !!orderData?.bills });
      const error = createHttpError(400, "Order data with items and bills is required");
      return next(error);
    }

    // Validate inventory before creating payment intent
    if (orderData.items && orderData.items.length > 0) {
      const inventoryCheck = await validateInventory(orderData.items);

      if (!inventoryCheck.valid) {
        return res.status(400).json({
          success: false,
          message: "Insufficient inventory for some items",
          invalidItems: inventoryCheck.invalidItems
        });
      }
    }

    // Convert amount to cents (Stripe uses smallest currency unit)
    const amountInCents = Math.round(amount * 100);

    // Get terminal ID and (optionally) stall information before creating the order
    // so we can include stall context on the order document
    let readerId;
    let stallInfo = null;
    try {
      readerId = await getTerminalIdForUser(req);

      // If it's a stall manager, also get stall information for order tracking
      if (req.userType === 'stallManager') {
        const StallManager = require("../models/stallManagerModel");
        const stallManager = await StallManager.findById(req.user._id).populate('stallIds');
        console.log(`Assigned stall:`, stallManager);
        if (stallManager && stallManager.stallIds && stallManager.stallIds.length > 0) {
          const assignedStall = stallManager.stallIds[0];
          stallInfo = {
            stallId: assignedStall._id,
            stallManagerId: stallManager._id,
            terminalId: readerId
          };
        }
      }
    } catch (terminalError) {
      console.error('Error getting terminal for user:', terminalError);
      const error = createHttpError(400, terminalError.message);
      return next(error);
    }

    // Generate unique order ID
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Calculate platform fee amount for reporting (does not affect customer payment)
    // Use totalWithTax (final amount customer pays) for platform fee calculation
    const orderTotalWithTax = orderData.bills?.totalWithTax || 0;
    const platformFeeAmount = await calculatePlatformFeeAmount(orderTotalWithTax, req.user._id);

    // Create order in database immediately with "Pending" status
    const newOrder = new Order({
      orderId,
      status: "Pending",
      customerDetails: {
        name: customerInfo?.name || '',
        phone: customerInfo?.phone || ''
      },
      paymentStatus: "Pending",
      orderDate: new Date(),
      items: orderData.items,
      bills: {
        ...orderData.bills,
        platformFeeAmount: platformFeeAmount
      },
      paymentMethod: orderData.paymentMethod || 'stripe',
      // Include stall information if available (for stall managers)
      ...(stallInfo && {
        stallId: stallInfo.stallId,
        stallManagerId: stallInfo.stallManagerId,
        terminalId: stallInfo.terminalId
      })
    });

    // Save order to database
    await newOrder.save();
    console.log(`📋 Order saved to database with Pending status: ${orderId}`);

    // Always support both card_present and paynow payment methods
    // This allows the terminal to handle either payment method based on customer choice
    const paymentIntentOptions = {
      amount: amountInCents,
      currency: "SGD", // Change to your preferred currency
      payment_method_types: ['card_present', 'paynow'],
      capture_method: 'automatic', // Manual capture for better control
      metadata: {
        orderId: orderId,
        customerName: customerInfo?.name || '',
        customerPhone: customerInfo?.phone || ''
      }
    };

    const paymentIntent = await stripeClient.paymentIntents.create(paymentIntentOptions);

    // Debug logging for PaymentIntent creation
    console.log(`💳 PaymentIntent created: ${paymentIntent.id}`);
    console.log(`📋 PaymentIntent metadata:`, paymentIntent.metadata);
    console.log(`🆔 Order ID in metadata: ${paymentIntent.metadata?.orderId}`);

    // Create Payment record in database with "pending" status
    const newPayment = new Payment({
      paymentIntentId: paymentIntent.id,
      status: "pending",
      amount: amount,
      currency: paymentIntent.currency,
      paymentMethodType: "stripe_terminal", // Will be updated when charge succeeds
      metadata: {
        orderId: orderId,
        customerName: customerInfo?.name || '',
        customerPhone: customerInfo?.phone || ''
      },
      chargeData: [] // Will be populated when charge.succeeded webhook fires
    });

    await newPayment.save();
    console.log(`💳 Payment record created with pending status: ${paymentIntent.id}`);
    console.log(`🔍 Stored PaymentIntent ID: "${newPayment.paymentIntentId}" (length: ${newPayment.paymentIntentId.length})`);

    // Set reader display with cart details before processing payment
    try {
      // Map order items to Stripe cart line items format
      const lineItems = orderData.items.map(item => ({
        amount: Math.round((item.price || 0) * 100), // Convert to cents
        description: item.name || 'Unknown Item',
        quantity: item.quantity || 1
      }));

      // Prepare cart data for Stripe Terminal
      const cartData = {
        currency: "sgd",
        tax: Math.round((orderData.bills.tax || 0) * 100), // Convert to cents
        total: Math.round((orderData.bills.totalWithTax || 0) * 100), // Convert to cents
        line_items: lineItems
      };

      console.log(`📱 Setting reader display for terminal: ${readerId}`);
      console.log(`📱 Cart data:`, {
        currency: cartData.currency,
        tax: cartData.tax,
        total: cartData.total,
        itemCount: cartData.line_items.length
      });

      // Set the reader display
      await stripeClient.terminal.readers.setReaderDisplay(
        readerId,
        {
          type: "cart",
          cart: cartData
        }
      );

      console.log(`✅ Reader display set successfully for terminal: ${readerId}`);
    } catch (displayError) {
      console.error('⚠️ Failed to set reader display (continuing with payment):', displayError);
      // Continue with payment processing even if display setting fails
    }

    try {
      const reader = await stripeClient.terminal.readers.processPaymentIntent(
        readerId,
        {
          payment_intent: paymentIntent.id,
          process_config: {
            enable_customer_cancellation: true,
            skip_tipping: false // Allow tipping if needed
          }
        }
      );

      console.log(`💳 PaymentIntent ${paymentIntent.id} sent to reader ${readerId}`);
      console.log(` Reader status: ${reader.status}, Action status: ${reader.action?.status}`);

      res.status(200).json({
        success: true,
        orderId: orderId,
        paymentIntent: {
          id: paymentIntent.id,
          client_secret: paymentIntent.client_secret,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status
        },
        reader: {
          id: reader.id,
          status: reader.status,
          action: reader.action
        }
      });
    } catch (readerError) {
      console.error('Failed to process payment on reader:', readerError);

      // If reader processing fails, we can still return the PaymentIntent
      // The frontend can handle this gracefully
      res.status(200).json({
        success: true,
        orderId: orderId,
        paymentIntent: {
          id: paymentIntent.id,
          client_secret: paymentIntent.client_secret,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status
        },
        warning: "PaymentIntent created but failed to send to terminal reader",
        error: readerError.message
      });
    }
  } catch (error) {
    console.log(error);
    next(error);
  }
};

const confirmPayment = async (req, res, next) => {
  try {
    if (!stripeClient) {
      const error = createHttpError(500, "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.");
      return next(error);
    }

    const { paymentIntentId } = req.body;

    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      res.json({
        success: true,
        message: "Payment confirmed successfully!",
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          charges: paymentIntent.charges.data[0]
        }
      });
    } else {
      const error = createHttpError(400, `Payment not successful. Status: ${paymentIntent.status}`);
      return next(error);
    }
  } catch (error) {
    console.log(error);
    next(error);
  }
};

const stripeWebhookHandler = async (req, res, next) => {
  try {
    if (!stripeClient) {
      const error = createHttpError(500, "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.");
      return next(error);
    }

    const sig = req.headers['stripe-signature'];
    const endpointSecret = config.stripeWebhookSecret;

    let event;

    try {
      event = stripeClient.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.log(`❌ Webhook signature verification failed.`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'terminal.reader.action_succeeded':
        const succeededAction = event.data.object;
        console.log(`✅ Terminal action succeeded: ${succeededAction.action.type}`);

        if (succeededAction.action.type === 'process_payment_intent') {
          const paymentIntentId = succeededAction.action.process_payment_intent.payment_intent;
          console.log(`💳 Terminal action succeeded for PaymentIntent: ${paymentIntentId}`);

          try {
            // Find existing Payment record that was created during PaymentIntent creation
            const existingPayment = await Payment.findOne({ paymentIntentId: paymentIntentId });

            if (existingPayment) {
              // Update Payment status from "pending" to "succeeded"
              existingPayment.status = "succeeded";
              await existingPayment.save();
              console.log(`💳 Payment status updated to succeeded: ${paymentIntentId}`);

              // Get orderId from payment metadata to update order
              const orderId = existingPayment.metadata?.orderId;
              if (orderId) {
                // Find the pending order in database
                const existingOrder = await Order.findOne({ orderId: orderId, status: "Pending" });

                if (existingOrder) {
                  // Update order status to Completed and add payment reference
                  existingOrder.status = "Completed";
                  existingOrder.paymentStatus = "Completed";
                  existingOrder.paymentData = existingPayment._id;

                  await existingOrder.save();
                  console.log(`📋 Order updated to Completed status: ${orderId}`);

                  // Update product availability after order is completed
                  if (existingOrder.items && existingOrder.items.length > 0) {
                    try {
                      console.log(`📦 Starting availability update for order ${orderId} with ${existingOrder.items.length} items`);
                      const updateResult = await updateProductAvailability(existingOrder.items);

                      if (updateResult.success) {
                        console.log(`✅ Availability update successful for ${orderId}:`, updateResult.summary);
                        if (updateResult.updates) {
                          updateResult.updates.forEach(update => {
                            if (update.success) {
                              console.log(`  📊 ${update.itemName}: Available: ${update.availableStock}, Status: ${update.available ? 'Available' : 'Out of Stock'}`);
                            }
                          });
                        }
                      } else {
                        console.error(`⚠️ Failed to update availability for order ${orderId}:`, updateResult.error);
                        // Order is completed but availability wasn't updated - needs manual review
                      }
                    } catch (availabilityError) {
                      console.error(`❌ Availability update error for order ${orderId}:`, availabilityError);
                    }
                  } else {
                    console.log(`⚠️ No items found for availability update in order ${orderId}`);
                  }
                } else {
                  console.log(`⚠️ No pending order found in database for orderId: ${orderId}`);
                }
              } else {
                console.log(`⚠️ No orderId found in payment metadata for PaymentIntent: ${paymentIntentId}`);
              }
            } else {
              console.log(`⚠️ No existing payment record found for PaymentIntent: ${paymentIntentId}`);
            }
          } catch (retrieveError) {
            console.error('Failed to retrieve payment:', retrieveError);
          }
        }
        break;

      case 'terminal.reader.action_failed':
        const failedAction = event.data.object;
        console.log(`❌ Terminal action failed: ${failedAction.action.failure_code} - ${failedAction.action.failure_message}`);

        // If it's a payment processing failure, save failure to database
        if (failedAction.action.type === 'process_payment_intent') {
          const failedPaymentIntentId = failedAction.action.process_payment_intent.payment_intent;
          console.log(`💳 Payment processing failed at terminal: ${failedPaymentIntentId}`);

          try {
            // Update existing payment record with failure details
            const paymentIntent = await stripeClient.paymentIntents.retrieve(failedPaymentIntentId);
            const failedPayment = await Payment.findOneAndUpdate(
              { paymentIntentId: failedPaymentIntentId },
              {
                status: "Failed",
                failureCode: failedAction.action.failure_code,
                failureMessage: failedAction.action.failure_message,
                metadata: paymentIntent.metadata || {},
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency
              },
              { new: true }
            );
            console.log(`📝 Saved terminal failure to database: ${failedPaymentIntentId}`);

            // Update corresponding order to Failed status
            const orderId = paymentIntent.metadata?.orderId;
            if (orderId) {
              const existingOrder = await Order.findOne({ orderId: orderId, status: "Pending" });
              if (existingOrder) {
                existingOrder.status = "Failed";
                existingOrder.paymentStatus = "Failed";
                existingOrder.paymentData = failedPayment._id;
                await existingOrder.save();
                console.log(`📋 Updated order to Failed status: ${orderId}`);
              }
            }
          } catch (error) {
            console.error('Failed to save terminal failure to database:', error);
          }
        }
        break;

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log(`💰 Payment succeeded: ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()}`);
        break;

      case 'payment_intent.created':
        const createdPayment = event.data.object;
        console.log(`📝 PaymentIntent created: ${createdPayment.id}`);

        try {
          // For checkout payments, update the PaymentIntent ID from temp ID
          // This ensures we can find the payment record when payment_intent.payment_failed fires
          if (createdPayment.metadata && Object.keys(createdPayment.metadata).length > 0) {
            const orderId = createdPayment.metadata.orderId;
            if (orderId) {
              // Find payment record with temp PaymentIntent ID
              const tempPaymentIntentId = `temp_checkout_${orderId}`;
              const existingPayment = await Payment.findOne({ paymentIntentId: tempPaymentIntentId });

              if (existingPayment && existingPayment.paymentMethodType === "stripe_checkout") {
                // Update with actual PaymentIntent ID
                existingPayment.paymentIntentId = createdPayment.id;
                await existingPayment.save();
                console.log(`🔄 Updated checkout payment record with actual PaymentIntent ID: ${createdPayment.id}`);
              }
            }
          }
        } catch (error) {
          console.error('❌ Error processing payment_intent.created webhook:', error);
        }
        break;

      case 'charge.succeeded':
        const charge = event.data.object;
        console.log(`💳 Charge succeeded: ${charge.amount / 100} ${charge.currency.toUpperCase()}`);

        try {
          // Check if this is a checkout payment by looking at the payment method details
          const isCheckoutPayment = charge.payment_method_details?.type === 'card' &&
                                   charge.payment_method_details?.card?.wallet === null &&
                                   charge.description === null;

          // Skip processing for checkout payments as they are handled by checkout.session.completed
          if (charge.invoice || charge.customer) {
            console.log(`🛒 Skipping charge.succeeded for checkout payment: ${charge.payment_intent} (handled by checkout.session.completed)`);
            break;
          }

          // Debug: Log the PaymentIntent ID from the charge
          console.log(`🔍 Looking for terminal payment record with PaymentIntent ID: "${charge.payment_intent}"`);
          console.log(`🔍 PaymentIntent ID length: ${charge.payment_intent.length}`);

          // Find existing payment record by paymentIntentId (for terminal payments only)
          const existingPayment = await Payment.findOne({
            paymentIntentId: charge.payment_intent,
            paymentMethodType: { $in: ['stripe_terminal', 'card_present', 'paynow'] }
          });

          // Debug: Log all payment records to see what's in the database
          const allPayments = await Payment.find({}, 'paymentIntentId paymentMethodType').limit(5);
          console.log(`🔍 Recent payment records in database:`, allPayments.map(p => `PI:"${p.paymentIntentId}" Type:"${p.paymentMethodType}"`));

          if (existingPayment) {
            // Extract charge details based on payment method type
            const chargeDetails = {
              chargeId: charge.id,
              status: charge.status,
              paymentMethodType: charge.payment_method_details?.type || 'unknown',
              receiptUrl: charge.receipt_url || null,
              amountCaptured: charge.amount_captured,
              createdAt: new Date(charge.created * 1000) // Convert Unix timestamp to Date
            };

            // Add charge data to the chargeData array
            existingPayment.chargeData.push(chargeDetails);
            await existingPayment.save();

            console.log(`📊 Charge data added to payment ${existingPayment.paymentIntentId}:`, {
              chargeId: chargeDetails.chargeId,
              paymentMethodType: chargeDetails.paymentMethodType,
              amountCaptured: chargeDetails.amountCaptured
            });

            // Increment sold count for products in the order
            const orderId = existingPayment.metadata?.orderId;
            if (orderId) {
              try {
                const order = await Order.findOne({ orderId: orderId });
                if (order && order.items && order.items.length > 0) {
                  console.log(`📈 Incrementing sold counts for order ${orderId} with ${order.items.length} items`);

                  // Use Promise.all for concurrent atomic updates
                  const soldUpdatePromises = order.items.map(async (item) => {
                    try {
                      // First check if product is unlimited
                      const product = await Product.findById(item.productId);

                      if (!product) {
                        console.log(`⚠️ Product not found for ID: ${item.productId}`);
                        return { success: false, productId: item.productId, error: 'Product not found' };
                      }

                      // Handle unlimited products - update sold count but skip availability logic
                      if (product.unlimited) {
                        const updatedProduct = await Product.findByIdAndUpdate(
                          item.productId,
                          { $inc: { sold: item.quantity } },
                          { new: true }
                        );

                        if (updatedProduct) {
                          console.log(`♾️ ${updatedProduct.name} (unlimited): sold count increased by ${item.quantity} (total sold: ${updatedProduct.sold})`);
                          return { success: true, productName: updatedProduct.name, quantitySold: item.quantity, unlimited: true };
                        } else {
                          console.log(`⚠️ Unlimited product not found for ID: ${item.productId}`);
                          return { success: false, productId: item.productId, error: 'Unlimited product not found' };
                        }
                      }

                      // Handle limited products - update sold count AND availability logic
                      const updatedProduct = await Product.findByIdAndUpdate(
                        item.productId,
                        { $inc: { sold: item.quantity } },
                        { new: true }
                      );

                      if (updatedProduct) {
                        console.log(`📊 ${updatedProduct.name} (limited): sold count increased by ${item.quantity} (total sold: ${updatedProduct.sold})`);
                        return { success: true, productName: updatedProduct.name, quantitySold: item.quantity, unlimited: false };
                      } else {
                        console.log(`⚠️ Limited product not found for ID: ${item.productId}`);
                        return { success: false, productId: item.productId, error: 'Limited product not found' };
                      }
                    } catch (error) {
                      console.error(`❌ Error updating sold count for product ${item.productId}:`, error);
                      return { success: false, productId: item.productId, error: error.message };
                    }
                  });

                  const soldUpdateResults = await Promise.all(soldUpdatePromises);
                  const successfulUpdates = soldUpdateResults.filter(result => result.success);
                  const failedUpdates = soldUpdateResults.filter(result => !result.success);

                  console.log(`✅ Sold count updates completed: ${successfulUpdates.length} successful, ${failedUpdates.length} failed`);

                  if (failedUpdates.length > 0) {
                    console.error(`⚠️ Failed sold count updates:`, failedUpdates);
                  }

                  // Update product availability status after sold counts are incremented
                  try {
                    const availabilityResult = await updateProductAvailability(order.items);
                    if (availabilityResult.success) {
                      console.log(`✅ Product availability updated for order ${orderId}`);
                    } else {
                      console.error(`⚠️ Failed to update product availability for order ${orderId}:`, availabilityResult.error);
                    }
                  } catch (availabilityError) {
                    console.error(`❌ Error updating product availability for order ${orderId}:`, availabilityError);
                  }
                } else {
                  console.log(`⚠️ No order found or no items in order for orderId: ${orderId}`);
                }
              } catch (error) {
                console.error(`❌ Error incrementing sold counts for order ${orderId}:`, error);
              }
            } else {
              console.log(`⚠️ No orderId found in payment metadata for charge: ${charge.id}`);
            }
          } else {
            console.log(`⚠️ No terminal payment record found for PaymentIntent: ${charge.payment_intent} (checkout payments are handled separately)`);
          }
        } catch (error) {
          console.error('❌ Error processing charge.succeeded webhook:', error);
        }
        break;

      // case 'charge.failed':
      //   const failedCharge = event.data.object;
      //   console.log(`❌ Charge failed: ${failedCharge.failure_message || failedCharge.outcome?.seller_message || 'Unknown error'}`);
      //   try {
      //     // Find existing payment record by paymentIntentId
      //     const existingPayment = await Payment.findOne({
      //       paymentIntentId: charge.payment_intent
      //     });

      //     if (existingPayment) {
      //       // Extract charge details based on payment method type
      //       const chargeDetails = {
      //         chargeId: charge.id,
      //         status: charge.status,
      //         paymentMethodType: charge.payment_method_details?.type || 'unknown',
      //         receiptUrl: charge.receipt_url || null,
      //         amountCaptured: charge.amount_captured,
      //         createdAt: new Date(charge.created * 1000) // Convert Unix timestamp to Date
      //       };

      //       // Add charge data to the chargeData array
      //       existingPayment.chargeData.push(chargeDetails);
      //       await existingPayment.save();

      //       console.log(`📊 Charge data added to payment ${existingPayment.paymentIntentId}:`, {
      //         chargeId: chargeDetails.chargeId,
      //         paymentMethodType: chargeDetails.paymentMethodType,
      //         amountCaptured: chargeDetails.amountCaptured
      //       });
      //     } else {
      //       console.log(`⚠️ No payment record found for PaymentIntent: ${charge.payment_intent}`);
      //     }
      //   } catch (error) {
      //     console.error('❌ Error processing charge.succeeded webhook:', error);
      //   }
      //   break;


      case 'charge.failed':
    const failedCharge = event.data.object;
    console.log(`❌ Charge failed: ${failedCharge.failure_message || failedCharge.outcome?.seller_message || 'Unknown error'}`);
    try {
      // Find existing payment record by paymentIntentId
      const existingPayment = await Payment.findOne({
        paymentIntentId: failedCharge.payment_intent
      });

      if (existingPayment) {
        // Extract charge details based on payment method type
        const chargeDetails = {
          chargeId: failedCharge.id,
          status: failedCharge.status,
          paymentMethodType: failedCharge.payment_method_details?.type || 'unknown',
          receiptUrl: failedCharge.receipt_url || null,
          amountCaptured: failedCharge.amount_captured,
          createdAt: new Date(failedCharge.created * 1000) // Convert Unix timestamp to Date
        };

        // Add charge data to the chargeData array
        existingPayment.chargeData.push(chargeDetails);
        await existingPayment.save();

        console.log(`📊 Charge data added to payment ${existingPayment.paymentIntentId}:`, {
          chargeId: chargeDetails.chargeId,
          paymentMethodType: chargeDetails.paymentMethodType,
          amountCaptured: chargeDetails.amountCaptured
        });
      } else {
        console.log(`⚠️ No payment record found for PaymentIntent: ${failedCharge.payment_intent}`);
      }
    } catch (error) {
      console.error('❌ Error processing charge.failed webhook:', error);
    }
    break;


      case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object;
        console.log(`❌ Payment failed: ${failedPaymentIntent.id}`);

        try {
          // Find existing Payment record by PaymentIntent ID
          const existingPayment = await Payment.findOne({ paymentIntentId: failedPaymentIntent.id });

          if (existingPayment) {
            // Only handle checkout payments, not terminal payments
            if (existingPayment.paymentMethodType === "stripe_checkout") {
              console.log(`💳 Processing checkout payment failure: ${failedPaymentIntent.id}`);

              // Extract failure details from last_payment_error
              const failureCode = failedPaymentIntent.last_payment_error?.code || 'unknown_error';
              const failureMessage = failedPaymentIntent.last_payment_error?.message || 'Payment failed';

              // Update Payment status to Failed with failure details
              existingPayment.status = "Failed";
              existingPayment.failureCode = failureCode;
              existingPayment.failureMessage = failureMessage;

              await existingPayment.save();
              console.log(`📝 Payment record updated to Failed status: ${failedPaymentIntent.id}`);

              // Get orderId from payment metadata to update order
              const orderId = existingPayment.metadata?.orderId;
              if (orderId) {
                // Find the pending order in database
                const existingOrder = await Order.findOne({ orderId: orderId, status: "Pending" });

                if (existingOrder) {
                  // Update order status to Failed
                  existingOrder.status = "Failed";
                  existingOrder.paymentStatus = "Failed";
                  existingOrder.paymentData = existingPayment._id;

                  await existingOrder.save();
                  console.log(`📋 Order updated to Failed status due to payment failure: ${orderId}`);
                } else {
                  console.log(`⚠️ No pending order found for orderId: ${orderId}`);
                }
              } else {
                console.log(`⚠️ No orderId found in payment metadata for failed payment: ${failedPaymentIntent.id}`);
              }
            } else {
              console.log(`ℹ️ Skipping non-checkout payment failure (terminal payments handled separately): ${failedPaymentIntent.id}`);
            }
          } else {
            console.log(`⚠️ No payment record found for failed PaymentIntent: ${failedPaymentIntent.id}`);
          }
        } catch (error) {
          console.error('❌ Error processing payment_intent.payment_failed webhook:', error);
        }
        break;

      case 'terminal.reader.action_updated':
        const updatedAction = event.data.object;
        console.log(`🔄 Terminal action updated: ${updatedAction.action?.type} - ${updatedAction.action?.status}`);
        break;

      case 'checkout.session.completed':
        const session = event.data.object;
        console.log(`🛒 Checkout session completed: ${session.id}`);

        try {
          // Find existing Payment record by checkout session ID
          const existingPayment = await Payment.findOne({ checkoutSessionId: session.id });

          if (existingPayment) {
            // Update Payment status from "pending" to "succeeded"
            existingPayment.status = "succeeded";
            existingPayment.paymentMethodType = "stripe_checkout";
            // Update PaymentIntent ID if not already set
            if (session.payment_intent && existingPayment.paymentIntentId.startsWith('temp_checkout_')) {
              existingPayment.paymentIntentId = session.payment_intent;
            }
            existingPayment.chargeData = [{
              chargeId: session.payment_intent || session.id,
              status: "succeeded",
              paymentMethodType: "stripe_checkout",
              receiptUrl: session.receipt_url || null,
              amountCaptured: session.amount_total,
              createdAt: new Date()
            }];
            await existingPayment.save();
            console.log(`💳 Payment status updated to succeeded:`);
            console.log(`   📋 Checkout Session ID: ${session.id}`);
            console.log(`   💰 PaymentIntent ID: ${existingPayment.paymentIntentId}`);
            console.log(`   🏪 Order ID: ${existingPayment.metadata?.orderId}`);

            // Get orderId from payment metadata to update order
            const orderId = existingPayment.metadata?.orderId || session.metadata?.orderId;
            if (orderId) {
              // Find the pending order in database
              const existingOrder = await Order.findOne({ orderId: orderId, status: "Pending" });

              if (existingOrder) {
                // Update order status to Completed and add payment reference
                existingOrder.status = "Completed";
                existingOrder.paymentStatus = "Completed";
                existingOrder.paymentData = existingPayment._id;

                await existingOrder.save();
                console.log(`📋 Order updated to Completed status: ${orderId}`);

                // Update product availability after order is completed
                if (existingOrder.items && existingOrder.items.length > 0) {
                  try {
                    console.log(`📦 Starting availability update for checkout order ${orderId} with ${existingOrder.items.length} items`);
                    const updateResult = await updateProductAvailability(existingOrder.items);

                    if (updateResult.success) {
                      console.log(`✅ Availability update successful for ${orderId}:`, updateResult.summary);
                      if (updateResult.updates) {
                        updateResult.updates.forEach(update => {
                          if (update.success) {
                            console.log(`  📊 ${update.itemName}: Available: ${update.availableStock}, Status: ${update.available ? 'Available' : 'Out of Stock'}`);
                          }
                        });
                      }
                    } else {
                      console.error(`⚠️ Failed to update availability for checkout order ${orderId}:`, updateResult.error);
                    }
                  } catch (availabilityError) {
                    console.error(`❌ Availability update error for checkout order ${orderId}:`, availabilityError);
                  }
                } else {
                  console.log(`⚠️ No items found for availability update in checkout order ${orderId}`);
                }

                // Increment sold count for products in the order
                if (existingOrder.items && existingOrder.items.length > 0) {
                  console.log(`📈 Incrementing sold counts for checkout order ${orderId} with ${existingOrder.items.length} items`);

                  const soldUpdatePromises = existingOrder.items.map(async (item) => {
                    try {
                      const product = await Product.findById(item.productId);

                      if (!product) {
                        console.log(`⚠️ Product not found for ID: ${item.productId}`);
                        return { success: false, productId: item.productId, error: 'Product not found' };
                      }

                      // Handle unlimited products - increment sold count but skip availability logic
                      if (product.unlimited) {
                        const updatedProduct = await Product.findByIdAndUpdate(
                          item.productId,
                          { $inc: { sold: item.quantity } },
                          { new: true }
                        );

                        console.log(`♾️ ${updatedProduct.name} (unlimited): sold count increased by ${item.quantity} (total sold: ${updatedProduct.sold})`);
                        return { success: true, productId: item.productId, productName: updatedProduct.name, quantitySold: item.quantity, unlimited: true };
                      }

                      // Increment sold count atomically
                      const updatedProduct = await Product.findByIdAndUpdate(
                        item.productId,
                        { $inc: { sold: item.quantity } },
                        { new: true }
                      );

                      console.log(`📊 Updated sold count for ${updatedProduct.name}: ${updatedProduct.sold} (increased by ${item.quantity})`);
                      return { success: true, productId: item.productId, newSoldCount: updatedProduct.sold };
                    } catch (error) {
                      console.error(`❌ Error updating sold count for product ${item.productId}:`, error);
                      return { success: false, productId: item.productId, error: error.message };
                    }
                  });

                  const soldUpdateResults = await Promise.all(soldUpdatePromises);
                  const successfulUpdates = soldUpdateResults.filter(result => result.success);
                  console.log(`✅ Successfully updated sold counts for ${successfulUpdates.length}/${soldUpdateResults.length} products`);
                }
              } else {
                console.log(`⚠️ No pending order found in database for orderId: ${orderId}`);
              }
            } else {
              console.log(`⚠️ No orderId found in payment metadata for checkout session: ${session.id}`);
            }
          } else {
            console.log(`⚠️ No existing payment record found for checkout session: ${session.id}`);
          }
        } catch (error) {
          console.error('❌ Error processing checkout.session.completed webhook:', error);
        }
        break;

      case 'checkout.session.expired':
        const expiredSession = event.data.object;
        console.log(`⏰ Checkout session expired: ${expiredSession.id}`);

        try {
          // Find existing Payment record by checkout session ID
          const existingPayment = await Payment.findOne({ checkoutSessionId: expiredSession.id });

          if (existingPayment) {
            // Update Payment status to "cancelled"
            existingPayment.status = "cancelled";
            await existingPayment.save();
            console.log(`💳 Payment status updated to cancelled: ${expiredSession.id}`);

            // Get orderId from payment metadata to update order
            const orderId = existingPayment.metadata?.orderId || expiredSession.metadata?.orderId;
            if (orderId) {
              // Find the pending order in database
              const existingOrder = await Order.findOne({ orderId: orderId, status: "Pending" });

              if (existingOrder) {
                // Update order status to Failed
                existingOrder.status = "Failed";
                existingOrder.paymentStatus = "Failed";
                existingOrder.paymentData = existingPayment._id;

                await existingOrder.save();
                console.log(`📋 Order updated to Failed status due to session expiry: ${orderId}`);
              }
            }
          }
        } catch (error) {
          console.error('❌ Error processing checkout.session.expired webhook:', error);
        }
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.log("❌ Webhook error:", error.message);
    res.status(400).send(`Webhook error: ${error.message}`);
  }
};

// Terminal Reader Management Functions
const getTerminalReaders = async (req, res, next) => {
  try {
    if (!stripeClient) {
      const error = createHttpError(500, "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.");
      return next(error);
    }

    const readers = await stripeClient.terminal.readers.list({
      limit: 100,
    });

    res.status(200).json({
      success: true,
      readers: readers.data
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

const createTerminalLocation = async (req, res, next) => {
  try {
    if (!stripeClient) {
      const error = createHttpError(500, "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.");
      return next(error);
    }

    const { displayName, address } = req.body;

    const location = await stripeClient.terminal.locations.create({
      display_name: displayName,
      address: address
    });

    res.status(200).json({
      success: true,
      location
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

const createConnectionToken = async (req, res, next) => {
  try {
    if (!stripeClient) {
      const error = createHttpError(500, "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.");
      return next(error);
    }

    const connectionToken = await stripeClient.terminal.connectionTokens.create();

    res.status(200).json({
      secret: connectionToken.secret
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};



// Process PaymentIntent on terminal reader
const processPaymentOnReader = async (req, res, next) => {
  try {
    if (!stripeClient) {
      const error = createHttpError(500, "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.");
      return next(error);
    }

    const { paymentIntentId, readerId } = req.body;
    const targetReaderId = readerId || config.stripeTerminalReaderId;

    if (!targetReaderId) {
      const error = createHttpError(400, "Reader ID required. Provide readerId in request or set STRIPE_TERMINAL_READER_ID environment variable.");
      return next(error);
    }

    const reader = await stripeClient.terminal.readers.processPaymentIntent(
      targetReaderId,
      {
        payment_intent: paymentIntentId,
        process_config: {
          enable_customer_cancellation: true,
          skip_tipping: false
        }
      }
    );

    console.log(`💳 PaymentIntent ${paymentIntentId} sent to reader ${targetReaderId}`);

    res.status(200).json({
      success: true,
      reader: {
        id: reader.id,
        status: reader.status,
        action: reader.action
      }
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

// Check PaymentIntent status for polling
const checkPaymentStatus = async (req, res, next) => {
  try {
    if (!stripeClient) {
      const error = createHttpError(500, "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.");
      return next(error);
    }

    const { paymentIntentId } = req.params;

    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);

    // Debug logging for metadata
    // console.log(`🔍 Checking payment status for ${paymentIntentId}`);
    // console.log(`📋 Payment metadata:`, paymentIntent.metadata);
    // console.log(`📊 Payment status: ${paymentIntent.status}`);

    // Check if this payment has failed at terminal level (from database)
    const terminalFailure = await Payment.findOne({
      paymentIntentId: paymentIntentId,
      status: "Failed"
    });

    res.status(200).json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        charges: paymentIntent.charges?.data?.[0] || null,
        metadata: paymentIntent.metadata || {} // Include metadata with orderId
      },
      terminalFailure: terminalFailure ? {
        failed: true,
        failureCode: terminalFailure.failureCode,
        failureMessage: terminalFailure.failureMessage,
        timestamp: terminalFailure.createdAt
      } : null
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

// Manual capture endpoint
const capturePaymentIntent = async (req, res, next) => {
  try {
    if (!stripeClient) {
      const error = createHttpError(500, "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.");
      return next(error);
    }

    const { paymentIntentId } = req.body;

    const capturedPayment = await stripeClient.paymentIntents.capture(paymentIntentId);

    if (capturedPayment.status === 'succeeded') {
      res.status(200).json({
        success: true,
        paymentIntent: capturedPayment
      });
    } else {
      const error = createHttpError(400, `Capture failed. Status: ${capturedPayment.status}`);
      return next(error);
    }
  } catch (error) {
    console.log(error);
    next(error);
  }
};

// Test helper for simulating card presentment
// const simulateCardPresentment = async (req, res, next) => {
//   try {
//     if (!stripeClient) {
//       const error = createHttpError(500, "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.");
//       return next(error);
//     }

//     const { readerId, paymentMethodType = 'card_present', cardNumber } = req.body;

//     // Default to Visa test card if no card number provided
//     const testCard = cardNumber || '4242424242424242';

//     const presentmentOptions = {
//       type: paymentMethodType
//     };

//     // Add card number for card_present payments
//     if (paymentMethodType === 'card_present') {
//       presentmentOptions.card_present = {
//         number: testCard
//       };
//     }

//     const result = await stripeClient.testHelpers.terminal.readers.presentPaymentMethod(
//       readerId,
//       presentmentOptions
//     );

//     res.status(200).json({
//       success: true,
//       result
//     });
//   } catch (error) {
//     console.log(error);
//     next(error);
//   }
// };

// Helper function to get pending orders (for debugging)
const getPendingOrders = async (req, res, next) => {
  try {
    const pendingOrders = await Order.find({ status: "Pending" }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: pendingOrders.length,
      data: pendingOrders
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

// Check if payment has failed at terminal and clean up
const checkPaymentFailureAndCleanup = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.params;

    if (!stripeClient) {
      const error = createHttpError(500, "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.");
      return next(error);
    }

    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
    const orderId = paymentIntent.metadata?.orderId;

    console.log(`🔍 Checking payment failure for ${paymentIntentId}, orderId: ${orderId}`);

    // Check if this payment has been stuck in requires_payment_method for too long
    // and if there's a pending order that should be marked as failed
    let shouldCleanup = false;
    let failureReason = null;

    if (paymentIntent.status === 'requires_payment_method' && orderId) {
      const existingOrder = await Order.findOne({ orderId: orderId, status: "Pending" });

      if (existingOrder) {
        const orderAge = Date.now() - existingOrder.createdAt.getTime();

        // If order is older than 2 minutes and still requires payment method, likely failed
        if (orderAge > 10 * 60 * 1000) {
          shouldCleanup = true;
          failureReason = "Payment timeout at terminal";
          console.log(`🧹 Payment likely failed - marking order as failed ${orderId} (age: ${Math.round(orderAge / 1000)}s)`);

          // Update order status to Failed
          existingOrder.status = "Failed";
          existingOrder.paymentStatus = "Failed";
          await existingOrder.save();
        }
      }
    }

    res.status(200).json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        metadata: paymentIntent.metadata
      },
      shouldStop: shouldCleanup,
      failureReason: failureReason,
      cleanedUp: shouldCleanup
    });

  } catch (error) {
    console.error('Error checking payment failure:', error);
    next(error);
  }
};

// Create Stripe Checkout Session
const createCheckoutSession = async (req, res, next) => {
  try {
    if (!stripeClient) {
      const error = createHttpError(500, "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.");
      return next(error);
    }

    const { amount, customerInfo, orderData } = req.body;

    if (!amount || !orderData) {
      const error = createHttpError(400, "Amount and order data are required");
      return next(error);
    }

    // Convert amount to cents (Stripe uses smallest currency unit)
    const amountInCents = Math.round(amount * 100);

    // Generate unique order ID
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Calculate platform fee amount for reporting (does not affect customer payment)
    // Use totalWithTax (final amount customer pays) for platform fee calculation
    const orderTotalWithTax = orderData.bills?.totalWithTax || 0;
    const platformFeeAmount = await calculatePlatformFeeAmount(orderTotalWithTax, req.user._id);

    // Create order in database immediately with "Pending" status
    const newOrder = new Order({
      orderId,
      status: "Pending",
      customerDetails: {
        name: customerInfo?.name || '',
        phone: customerInfo?.phone || ''
      },
      paymentStatus: "Pending",
      orderDate: new Date(),
      items: orderData.items,
      bills: {
        ...orderData.bills,
        platformFeeAmount: platformFeeAmount
      },
      paymentMethod: "stripe_checkout"
    });

    // Save order to database
    await newOrder.save();
    console.log(`📋 Order saved to database with Pending status: ${orderId}`);

    // Create Payment record in database with "pending" status
    const newPayment = new Payment({
      paymentIntentId: `temp_checkout_${orderId}`, // Temporary ID, will be updated with actual PaymentIntent ID
      checkoutSessionId: `temp_session_${orderId}`, // Temporary ID, will be updated with actual session ID
      status: "pending",
      amount: amount,
      currency: "SGD",
      paymentMethodType: "stripe_checkout",
      metadata: {
        orderId: orderId,
        customerName: customerInfo?.name || '',
        customerPhone: customerInfo?.phone || ''
      },
      chargeData: []
    });

    await newPayment.save();
    console.log(`💳 Payment record created with pending status for checkout session (temp IDs: ${newPayment.paymentIntentId}, ${newPayment.checkoutSessionId})`);

    // Prepare line items for Stripe Checkout
    const lineItems = orderData.items.map(item => ({
      price_data: {
        currency: 'SGD',
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Add tax as a separate line item if applicable
    if (orderData.bills.tax > 0) {
      lineItems.push({
        price_data: {
          currency: 'SGD',
          product_data: {
            name: 'Tax',
          },
          unit_amount: Math.round(orderData.bills.tax * 100),
        },
        quantity: 1,
      });
    }

    // Create Stripe Checkout Session
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ['card', 'paynow'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:6001'}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:6001'}/checkout/cancel?order_id=${orderId}`,
      customer_email: customerInfo?.email || undefined,
      metadata: {
        orderId: orderId,
        customerName: customerInfo?.name || '',
        customerPhone: customerInfo?.phone || ''
      },
      // Pass metadata to PaymentIntent as well
      payment_intent_data: {
        metadata: {
          orderId: orderId,
          customerName: customerInfo?.name || '',
          customerPhone: customerInfo?.phone || ''
        }
      },
      // Pre-fill customer information if available
      ...(customerInfo?.name && {
        customer_creation: 'if_required',
        billing_address_collection: 'auto',
      })
    });

    // Update payment record with actual session ID and PaymentIntent ID (if available)
    const updateData = {
      checkoutSessionId: session.id
    };

    // PaymentIntent might not be available immediately for some payment methods
    if (session.payment_intent) {
      updateData.paymentIntentId = session.payment_intent;
    }

    await Payment.findOneAndUpdate(
      { checkoutSessionId: `temp_session_${orderId}` },
      updateData
    );

    console.log(`🛒 Checkout session created: ${session.id} for order: ${orderId}${session.payment_intent ? ` (PaymentIntent: ${session.payment_intent})` : ''}`);

    res.status(200).json({
      success: true,
      orderId: orderId,
      sessionId: session.id,
      checkoutUrl: session.url
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    next(error);
  }
};

// Verify Stripe Checkout Session Status (Security endpoint)
const verifyCheckoutSession = async (req, res, next) => {
  try {
    if (!stripeClient) {
      const error = createHttpError(500, "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.");
      return next(error);
    }

    const { sessionId, orderId } = req.params;

    if (!sessionId || !orderId) {
      const error = createHttpError(400, "Session ID and Order ID are required");
      return next(error);
    }

    // Retrieve session from Stripe to verify its actual status
    const session = await stripeClient.checkout.sessions.retrieve(sessionId);

    // Find the payment record in our database
    const paymentRecord = await Payment.findOne({ checkoutSessionId: sessionId });

    // Find the order record
    const orderRecord = await Order.findOne({ orderId: orderId });

    if (!paymentRecord || !orderRecord) {
      const error = createHttpError(404, "Payment or order record not found");
      return next(error);
    }

    // Verify that the session belongs to this order
    if (session.metadata?.orderId !== orderId) {
      const error = createHttpError(400, "Session does not match order");
      return next(error);
    }

    // Check session status from Stripe
    const isSessionComplete = session.payment_status === 'paid' && session.status === 'complete';
    const isOrderComplete = orderRecord.status === 'Completed' && orderRecord.paymentStatus === 'Completed';
    const isPaymentSucceeded = paymentRecord.status === 'succeeded';

    console.log(`🔍 Session verification for ${sessionId}:`, {
      stripeSessionStatus: session.status,
      stripePaymentStatus: session.payment_status,
      orderStatus: orderRecord.status,
      paymentStatus: paymentRecord.status,
      isValid: isSessionComplete && isOrderComplete && isPaymentSucceeded
    });

    res.status(200).json({
      success: true,
      verified: isSessionComplete && isOrderComplete && isPaymentSucceeded,
      sessionStatus: session.status,
      paymentStatus: session.payment_status,
      orderStatus: orderRecord.status,
      paymentRecordStatus: paymentRecord.status,
      amountPaid: session.amount_total,
      currency: session.currency
    });

  } catch (error) {
    console.error('Error verifying checkout session:', error);
    next(error);
  }
};

module.exports = {
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
};
