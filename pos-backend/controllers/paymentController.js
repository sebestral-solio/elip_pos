const stripe = require("stripe");
const config = require("../config/config");
const crypto = require("crypto");
const Payment = require("../models/paymentModel");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const { updateProductQuantities } = require("./productController");
const createHttpError = require("http-errors");

// Temporary storage for pending orders (in production, consider using Redis or database)
const pendingOrders = new Map();

// Cleanup expired pending orders (older than 1 hour)
const cleanupExpiredOrders = () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [orderId, orderData] of pendingOrders.entries()) {
    if (orderData.createdAt < oneHourAgo) {
      pendingOrders.delete(orderId);
      console.log(`🧹 Cleaned up expired pending order: ${orderId}`);
    }
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

      // If product not found or not enough quantity
      if (!product) {
        invalidItems.push({
          id: item.id || item.productId,
          name: item.name,
          requested: item.quantity,
          available: 0,
          reason: "Product not found"
        });
      } else if (!product.available) {
        invalidItems.push({
          id: item.id || item.productId,
          name: product.name,
          requested: item.quantity,
          available: product.quantity,
          reason: "Product not available"
        });
      } else if (product.quantity < item.quantity) {
        invalidItems.push({
          id: item.id || item.productId,
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

// Initialize Stripe with secret key
const stripeClient = config.stripeSecretKey ? stripe(config.stripeSecretKey) : null;

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

    // Generate unique order ID
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Store order data temporarily until payment succeeds
    const completeOrderData = {
      orderId,
      customerDetails: {
        name: customerInfo?.name || '',
        phone: customerInfo?.phone || ''
      },
      paymentStatus: "Pending", // Will be updated to "Completed" after payment succeeds
      items: orderData.items,
      bills: orderData.bills,
      paymentMethod: orderData.paymentMethod || 'stripe',
      createdAt: new Date()
    };

    // Store in temporary storage
    pendingOrders.set(orderId, completeOrderData);

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

    // Process the PaymentIntent on the terminal reader
    const readerId = config.stripeTerminalReaderId;
    if (!readerId) {
      const error = createHttpError(500, "Terminal reader ID not configured. Please set STRIPE_TERMINAL_READER_ID environment variable.");
      return next(error);
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
          console.log(`💳 Payment confirmed at terminal: ${paymentIntentId}`);

          // Retrieve the PaymentIntent to get latest status (automatic capture already happened)
          try {
            const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
            console.log(`💰 Payment status: ${paymentIntent.status} - ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()}`);

            // Save payment details to database (only if succeeded)
            if (paymentIntent.status === 'succeeded') {
              const charge = paymentIntent.charges?.data?.[0];

              if (!charge) {
                console.log(`⚠️ No charge data available for PaymentIntent: ${paymentIntent.id}`);
              }

              const newPayment = new Payment({
                paymentIntentId: paymentIntent.id,
                chargeId: charge?.id || null,
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency,
                status: paymentIntent.status,
                paymentMethodType: charge?.payment_method_details?.type || 'unknown',
                paymentMethod: charge?.payment_method || null,
                receiptUrl: charge?.receipt_url || null,
                metadata: paymentIntent.metadata,
                createdAt: new Date(paymentIntent.created * 1000)
              });

              await newPayment.save();
              console.log(`💾 Payment saved to database: ${paymentIntent.id} (charge: ${charge?.id || 'none'})`);

              // Create order after successful payment
              const orderId = paymentIntent.metadata.orderId;
              if (orderId && pendingOrders.has(orderId)) {
                try {
                  const orderData = pendingOrders.get(orderId);

                  // Create the order with payment reference
                  const newOrder = new Order({
                    orderId: orderId,
                    customerDetails: orderData.customerDetails,
                    paymentStatus: "Completed",
                    orderDate: new Date(),
                    bills: orderData.bills,
                    items: orderData.items,
                    paymentMethod: orderData.paymentMethod,
                    paymentData: newPayment._id // Reference to the payment
                  });

                  await newOrder.save();
                  console.log(`📋 Order created successfully: ${orderId}`);

                  // Update product quantities after order is created
                  if (orderData.items && orderData.items.length > 0) {
                    try {
                      console.log(`📦 Starting inventory update for order ${orderId} with ${orderData.items.length} items`);
                      const updateResult = await updateProductQuantities(orderData.items);

                      if (updateResult.success) {
                        console.log(`✅ Inventory update successful for ${orderId}:`, updateResult.summary);
                        if (updateResult.updates) {
                          updateResult.updates.forEach(update => {
                            if (update.success) {
                              console.log(`  📊 ${update.itemName}: ${update.oldQuantity} → ${update.newQuantity} (-${update.quantityOrdered})`);
                            }
                          });
                        }
                      } else {
                        console.error(`⚠️ Failed to update inventory for order ${orderId}:`, updateResult.error);
                        // Order is created but inventory wasn't updated - needs manual review
                      }
                    } catch (inventoryError) {
                      console.error(`❌ Inventory update error for order ${orderId}:`, inventoryError);
                    }
                  } else {
                    console.log(`⚠️ No items found for inventory update in order ${orderId}`);
                  }

                  // Remove from pending orders
                  pendingOrders.delete(orderId);
                } catch (orderError) {
                  console.error(`❌ Failed to create order for ${orderId}:`, orderError);
                  // Payment succeeded but order creation failed - this needs manual intervention
                }
              } else {
                console.log(`⚠️ No pending order data found for orderId: ${orderId}`);
              }
            }
          } catch (retrieveError) {
            console.error('Failed to retrieve payment:', retrieveError);
          }
        }
        break;

      case 'terminal.reader.action_failed':
        const failedAction = event.data.object;
        console.log(`❌ Terminal action failed: ${failedAction.action.failure_code} - ${failedAction.action.failure_message}`);
        break;

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log(`💰 Payment succeeded: ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()}`);
        break;

      case 'payment_intent.created':
        const createdPayment = event.data.object;
        console.log(`📝 PaymentIntent created: ${createdPayment.id}`);
        break;

      case 'charge.succeeded':
        const charge = event.data.object;
        console.log(`💳 Charge succeeded: ${charge.amount / 100} ${charge.currency.toUpperCase()}`);
        break;

      case 'charge.failed':
        const failedCharge = event.data.object;
        console.log(`❌ Charge failed: ${failedCharge.failure_message || failedCharge.outcome?.seller_message || 'Unknown error'}`);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log(`❌ Payment failed: ${failedPayment.id}`);
        break;

      case 'terminal.reader.action_updated':
        const updatedAction = event.data.object;
        console.log(`🔄 Terminal action updated: ${updatedAction.action?.type} - ${updatedAction.action?.status}`);
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

    res.status(200).json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        charges: paymentIntent.charges?.data?.[0] || null,
        metadata: paymentIntent.metadata || {} // Include metadata with orderId
      }
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
    const pendingOrdersArray = Array.from(pendingOrders.entries()).map(([orderId, orderData]) => ({
      orderId,
      ...orderData
    }));

    res.status(200).json({
      success: true,
      count: pendingOrdersArray.length,
      data: pendingOrdersArray
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
    // and if there's a pending order that should be cleaned up
    let shouldCleanup = false;
    let failureReason = null;

    if (paymentIntent.status === 'requires_payment_method' && orderId && pendingOrders.has(orderId)) {
      const orderData = pendingOrders.get(orderId);
      const orderAge = Date.now() - orderData.createdAt.getTime();

      // If order is older than 2 minutes and still requires payment method, likely failed
      if (orderAge > 2 * 60 * 1000) {
        shouldCleanup = true;
        failureReason = "Payment timeout at terminal";
        console.log(`🧹 Payment likely failed - cleaning up order ${orderId} (age: ${Math.round(orderAge/1000)}s)`);
      }
    }

    if (shouldCleanup && orderId) {
      pendingOrders.delete(orderId);
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
  checkPaymentFailureAndCleanup
};
