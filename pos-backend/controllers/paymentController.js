const stripe = require("stripe");
const config = require("../config/config");
const crypto = require("crypto");
const Payment = require("../models/paymentModel");
const createHttpError = require("http-errors");

// Initialize Stripe with secret key
const stripeClient = config.stripeSecretKey ? stripe(config.stripeSecretKey) : null;

const createPaymentIntent = async (req, res, next) => {
  try {
    if (!stripeClient) {
      const error = createHttpError(500, "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.");
      return next(error);
    }

    const { amount, customerInfo } = req.body;

    // Convert amount to cents (Stripe uses smallest currency unit)
    const amountInCents = Math.round(amount * 100);

    // Always support both card_present and paynow payment methods
    // This allows the terminal to handle either payment method based on customer choice
    const paymentIntentOptions = {
      amount: amountInCents,
      currency: "SGD", // Change to your preferred currency
      payment_method_types: ['card_present', 'paynow'],
      capture_method: 'automatic', // Manual capture for better control
      metadata: {
        orderId: `order_${Date.now()}`,
        customerName: customerInfo?.name || '',
        customerPhone: customerInfo?.phone || ''
      }
    };

    const paymentIntent = await stripeClient.paymentIntents.create(paymentIntentOptions);

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

    res.status(200).json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        charges: paymentIntent.charges?.data?.[0] || null
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

module.exports = {
  createPaymentIntent,
  confirmPayment,
  stripeWebhookHandler,
  getTerminalReaders,
  createTerminalLocation,
  createConnectionToken,
  checkPaymentStatus,
  capturePaymentIntent,
  processPaymentOnReader
};
