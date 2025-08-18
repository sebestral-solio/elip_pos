import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getTotalPrice } from "../../redux/slices/cartSlice";
import {
  addOrder,
  createPaymentIntent,
  createCheckoutSession,
  updateTable,
  confirmPayment,
  checkPaymentStatus,
  capturePaymentIntent,
} from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { useMutation } from "@tanstack/react-query";
import { removeAllItems } from "../../redux/slices/cartSlice";
import { removeCustomer, setCustomerInfo } from "../../redux/slices/customerSlice";
import { fetchTaxRate } from "../../redux/slices/configSlice";
import Invoice from "../invoice/Invoice";
import { FaTimes } from "react-icons/fa";
import { motion } from "framer-motion";
import { FaCircleXmark } from "react-icons/fa6";

function loadStripeTerminal() {
  return new Promise((resolve) => {
    if (window.StripeTerminal) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.stripe.com/terminal/v1/";
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

const Bill = () => {
  const dispatch = useDispatch();

  const customerData = useSelector((state) => state.customer);
  const cartItems = useSelector((state) => state.cart.items);
  const total = useSelector(getTotalPrice);
  const taxRate = useSelector((state) => state.config?.taxRate || 5.25);
  const tax = (total * taxRate) / 100;
  const totalPriceWithTax = total + tax;

  // Fetch tax rate when component mounts
  useEffect(() => {
    dispatch(fetchTaxRate());
  }, [dispatch]);


  const [paymentMethod, setPaymentMethod] = useState("");
  const [onlinePaymentMethod, setOnlinePaymentMethod] = useState(""); // "terminal" or "checkout"
  const [showInvoice, setShowInvoice] = useState(false);
  const [orderInfo, setOrderInfo] = useState();

  // Customer information modal state
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerName, setCustomerName] = useState(customerData.customerName || "");
  const [customerPhone, setCustomerPhone] = useState(customerData.customerPhone || "");

  // Payment processing state
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentError, setPaymentError] = useState(null);

  // Handle customer info submission
  const handleCustomerInfoSubmit = (e) => {
    e.preventDefault();

    // Validate inputs
    if (!customerName.trim()) {
      enqueueSnackbar("Please enter customer name", { variant: "warning" });
      return;
    }

    // if (!customerPhone.trim() || customerPhone.length < 10) {
    //   enqueueSnackbar("Please enter a valid phone number", { variant: "warning" });
    //   return;
    // }

    // Save customer info to Redux state
    dispatch(setCustomerInfo({ customerName, customerPhone }));

    // Close modal and proceed with order
    setShowCustomerModal(false);
    proceedWithOrder();
  };

  // Helper function to extract error message from API response
  const extractErrorMessage = (error) => {
    // Check if it's an axios error with response data
    if (error.response?.data?.message) {
      return error.response.data.message;
    }

    // Check if it's an axios error with response data error field
    if (error.response?.data?.error) {
      return error.response.data.error;
    }

    // Check if error has a message property
    if (error.message) {
      return error.message;
    }

    // Check if it's a string error
    if (typeof error === 'string') {
      return error;
    }

    // Fallback to generic message
    return "An unexpected error occurred. Please try again.";
  };

  // Payment monitoring functions
  const startPaymentMonitoring = (paymentIntentId) => {
    setIsProcessingPayment(true);
    setPaymentStatus("Processing payment at terminal...");
    setPaymentError(null);

    let paymentTimeout;
    let pollCount = 0;

    // Start polling for payment status
    const pollInterval = setInterval(async () => {
      pollCount++;
      try {
        const { data } = await checkPaymentStatus(paymentIntentId);
        const { paymentIntent, terminalFailure } = data;

        // Check for terminal failure FIRST on every poll
        if (terminalFailure && terminalFailure.failed) {
          console.log('❌ Terminal failure detected, stopping polling immediately');
          console.log('🔍 Terminal failure info:', terminalFailure);
          clearInterval(pollInterval);
          clearTimeout(paymentTimeout);
          handlePaymentFailure(paymentIntent, terminalFailure.failureMessage);
          return;
        }

        if (paymentIntent.status === 'succeeded') {
          console.log('✅ Payment succeeded, stopping polling');
          console.log('🔍 Payment Intent data:', paymentIntent);
          console.log('📋 Payment metadata:', paymentIntent.metadata);
          clearInterval(pollInterval);
          clearTimeout(paymentTimeout);
          handlePaymentSuccess(paymentIntent);
        } else if (paymentIntent.status === 'canceled') {
          // Only stop polling for explicit cancellation (user cancelled at terminal)
          console.log('❌ Payment cancelled, stopping polling');
          clearInterval(pollInterval);
          clearTimeout(paymentTimeout);
          handlePaymentCancellation(paymentIntent);
        } else if (paymentIntent.status === 'payment_failed') {
          // Payment has definitively failed - stop polling and show error
          console.log('❌ Payment failed, stopping polling');
          clearInterval(pollInterval);
          clearTimeout(paymentTimeout);

          // Get failure reason from charges if available
          const failureReason = paymentIntent.charges?.data?.[0]?.failure_message ||
                               paymentIntent.charges?.data?.[0]?.outcome?.seller_message ||
                               "Payment failed. Please try again.";

          handlePaymentFailure(paymentIntent, failureReason);
        } else if (paymentIntent.status === 'requires_capture') {
          console.log('💰 Payment requires capture, stopping polling');
          clearInterval(pollInterval);
          clearTimeout(paymentTimeout);
          handlePaymentCapture(paymentIntent);
        } else if (paymentIntent.status === 'requires_payment_method') {
          // Continue polling - waiting for customer to present payment method
          // Terminal failures are now detected immediately via terminalFailure check above
          setPaymentStatus("Waiting for payment method at terminal...");
        } else if (paymentIntent.status === 'processing') {
          setPaymentStatus("Processing payment...");
        } else {
          setPaymentStatus("Processing payment at terminal...");
        }

        // Check for absolute timeout (2 minutes)
        if (pollCount >= 50) { // 24 polls × 5 seconds = 2 minutes
          console.log('⏰ Payment polling absolute timeout (2 minutes)');
          clearInterval(pollInterval);
          clearTimeout(paymentTimeout);
          handlePaymentFailure(paymentIntent, "Payment timeout. Please try again.");
        }
        // Continue polling for other statuses (requires_payment_method, processing, etc.)
      } catch (error) {
        console.error('Error checking payment status:', error);
        // Don't stop polling on API errors - the connection might recover
        // Just update the status to indicate there's a connection issue
        setPaymentStatus("Connection issue. Retrying...");
      }
    }, 2000); // Poll every 2 seconds

    // Set timeout for payment (60 seconds)
    paymentTimeout = setTimeout(() => {
      clearInterval(pollInterval);
      handlePaymentTimeout();
    }, 60000); // Fixed: 60 seconds instead of 10 minutes
  };

  const handlePaymentSuccess = (paymentIntent) => {
    setIsProcessingPayment(false);
    setPaymentStatus("Payment successful!");

    const actualPaymentMethod = paymentIntent.charges?.payment_method_details?.type || 'card_present';
    enqueueSnackbar(`Payment successful via ${actualPaymentMethod === 'card_present' ? 'Card' : 'PayNow'}!`, { variant: "success" });

    // Create order with payment data
    createOrderWithPayment(paymentIntent);
  };

  const handlePaymentCapture = async (paymentIntent) => {
    try {
      setPaymentStatus("Capturing payment...");
      const { data } = await capturePaymentIntent({ paymentIntentId: paymentIntent.id });

      if (data.success) {
        handlePaymentSuccess(data.paymentIntent);
      } else {
        handlePaymentFailure(paymentIntent, "Failed to capture payment");
      }
    } catch (error) {
      handlePaymentFailure(paymentIntent, "Capture failed: " + error.message);
    }
  };

  const handlePaymentFailure = (paymentIntent, customMessage = null) => {
    setIsProcessingPayment(false);
    setPaymentStatus("Payment Failed");

    // Provide specific error messages based on failure reason
    let errorMessage = customMessage || "Payment failed. Please try again.";

    // Handle common failure reasons with user-friendly messages
    if (customMessage) {
      const lowerMessage = customMessage.toLowerCase();

      // Terminal assignment and configuration errors
      if (lowerMessage.includes('no terminal assigned') || lowerMessage.includes('terminal not assigned')) {
        errorMessage = customMessage; // Use exact backend message for terminal issues
      } else if (lowerMessage.includes('terminal not found') || lowerMessage.includes('terminal configuration')) {
        errorMessage = customMessage; // Use exact backend message for terminal config issues
      } else if (lowerMessage.includes('stall manager has no assigned stalls')) {
        errorMessage = customMessage; // Use exact backend message for stall assignment issues
      } else if (lowerMessage.includes('insufficient inventory') || lowerMessage.includes('insufficient quantity')) {
        errorMessage = customMessage; // Use exact backend message for inventory issues
      } else if (lowerMessage.includes('product not found') || lowerMessage.includes('product not available')) {
        errorMessage = customMessage; // Use exact backend message for product issues
      }
      // Payment processing errors
      else if (lowerMessage.includes('insufficient funds')) {
        errorMessage = "Payment failed: Insufficient funds. Please use a different payment method.";
      } else if (lowerMessage.includes('card_declined') || lowerMessage.includes('declined')) {
        errorMessage = "Payment failed: Card declined. Please try a different card or payment method.";
      } else if (lowerMessage.includes('expired')) {
        errorMessage = "Payment failed: Card expired. Please use a different card.";
      } else if (lowerMessage.includes('incorrect')) {
        errorMessage = "Payment failed: Incorrect card details. Please check your card information.";
      } else if (lowerMessage.includes('timeout')) {
        errorMessage = "Payment failed: Transaction timed out. Please try again.";
      } else {
        // For any other specific backend message, use it as-is
        errorMessage = customMessage;
      }
    }

    setPaymentError(errorMessage);
    enqueueSnackbar(errorMessage, { variant: "error" });

    console.log('❌ Payment failure handled:', {
      paymentIntentId: paymentIntent?.id,
      status: paymentIntent?.status,
      errorMessage: errorMessage
    });
  };



  const handlePaymentCancellation = (paymentIntent) => {
    setIsProcessingPayment(false);
    const errorMessage = "Payment was cancelled.";
    setPaymentError(errorMessage);
    enqueueSnackbar(errorMessage, { variant: "warning" });
  };

  const handlePaymentTimeout = () => {
    setIsProcessingPayment(false);
    setPaymentError("Payment timed out. Please try again.");
    enqueueSnackbar("Payment timed out. Customer may have abandoned the transaction.", { variant: "warning" });
  };

  const createOrderWithPayment = (paymentIntent) => {
    const actualPaymentMethod = paymentIntent.charges?.payment_method_details?.type || 'card_present';
    const orderId = paymentIntent.metadata?.orderId;

    console.log('✅ Payment succeeded, order should be automatically created by backend');
    console.log('📋 Order ID from payment metadata:', orderId);
    console.log('💳 Payment Intent ID:', paymentIntent.id);

    // Since the backend now automatically creates the order when payment succeeds,
    // we just need to handle the UI updates and cleanup

    // Create a mock order object for the invoice display
    const mockOrderData = {
      _id: orderId, // Use the orderId from payment metadata
      orderId: orderId , // Ensure orderId is always present
      customerDetails: {
        name: customerName,
        phone: customerPhone,
        guests: customerData.guests || 1,
      },
      paymentStatus: "Completed", // Payment succeeded
      bills: {
        total: total,
        tax: tax,
        totalWithTax: totalPriceWithTax,
      },
      items: cartItems,
      table: customerData.table?.tableId,
      paymentMethod: "Online",
      paymentData: {
        stripe_payment_intent_id: paymentIntent.id,
        stripe_charge_id: paymentIntent.charges?.data?.[0]?.id || null,
        payment_method_type: actualPaymentMethod,
        stripe_order_id: orderId, // Add this for the invoice display
      },
      createdAt: new Date().toISOString(),
    };

    setOrderInfo(mockOrderData);

    // Clear cart and customer info immediately after successful payment
    dispatch(removeAllItems());
    dispatch(removeCustomer());

    // Also clear local state
    setCustomerName("");
    setCustomerPhone("");

    // Only update table if there is a table assigned
    if (customerData.table?.tableId) {
      const tableData = {
        status: "Booked",
        orderId: orderId,
        tableId: customerData.table.tableId,
      };

      setTimeout(() => {
        tableUpdateMutation.mutate(tableData);
      }, 1500);
    }

    enqueueSnackbar("Order Placed Successfully!", {
      variant: "success",
    });
    setShowInvoice(true);
  };

  // Validation function to check if order can be placed
  const isOrderValid = () => {
    // Check if cart has items
    if (!cartItems || cartItems.length === 0) {
      return false;
    }

    // Check if total amount is valid (positive number)
    if (!total || total <= 0 || isNaN(total) || !isFinite(total)) {
      return false;
    }

    // Check if total with tax is valid
    if (!totalPriceWithTax || totalPriceWithTax <= 0 || isNaN(totalPriceWithTax) || !isFinite(totalPriceWithTax)) {
      return false;
    }

    return true;
  };

  // Get validation message for disabled button
  const getValidationMessage = () => {
    if (!cartItems || cartItems.length === 0) {
      return "Add items to cart to place order";
    }

    if (!total || total <= 0 || isNaN(total) || !isFinite(total)) {
      return "Invalid order total amount";
    }

    if (!totalPriceWithTax || totalPriceWithTax <= 0 || isNaN(totalPriceWithTax) || !isFinite(totalPriceWithTax)) {
      return "Invalid total amount with tax";
    }

    if (!paymentMethod) {
      return "Please select a payment method";
    }

    return "";
  };

  // Show customer info modal before placing order
  const handlePlaceOrderClick = () => {
    if (!isOrderValid()) {
      enqueueSnackbar(getValidationMessage(), {
        variant: "warning",
      });
      return;
    }

    if (!paymentMethod) {
      enqueueSnackbar("Please select a payment method!", {
        variant: "warning",
      });
      return;
    }

    if (paymentMethod === "Online" && !onlinePaymentMethod) {
      enqueueSnackbar("Please select an online payment method!", {
        variant: "warning",
      });
      return;
    }

    // Show customer info modal
    setShowCustomerModal(true);
  };
  
  // Actual order placement logic
  const proceedWithOrder = async () => {
    // Double-check order validation before proceeding
    if (!isOrderValid()) {
      enqueueSnackbar(getValidationMessage(), {
        variant: "error",
      });
      return;
    }

    if (!paymentMethod) {
      enqueueSnackbar("Please select a payment method!", {
        variant: "warning",
      });
      return;
    }

    if (paymentMethod === "Online") {
      if (onlinePaymentMethod === "terminal") {
        // Terminal payment flow (existing logic)
        try {
          // Load Stripe Terminal SDK
          const res = await loadStripeTerminal();

          if (!res) {
            enqueueSnackbar("Stripe Terminal SDK failed to load. Are you online?", {
              variant: "warning",
            });
            return;
          }

          // Create payment intent - backend will automatically support both card_present and paynow
          const reqData = {
            amount: totalPriceWithTax.toFixed(2),
            customerInfo: {
              name: customerName,
              phone: customerPhone,
            },
            orderData: {
              items: cartItems.map(item => ({
                id: item.id,
                productId: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity
              })),
              bills: {
                total: total,
                tax: tax,
                totalWithTax: totalPriceWithTax,
              },
              paymentMethod: "stripe"
            }
          };

          const { data } = await createPaymentIntent(reqData);

          // Start real-time payment monitoring
          enqueueSnackbar(`Payment created (Order: ${data.orderId}). Waiting for terminal processing...`, { variant: "info" });
          startPaymentMonitoring(data.paymentIntent.id);

        } catch (error) {
          console.log('❌ Payment creation failed:', error);

          // Extract specific error message from backend response
          const errorMessage = extractErrorMessage(error);

          // Set payment error state to show in modal
          setPaymentError(errorMessage);

          // Also show snackbar notification
          enqueueSnackbar(errorMessage, {
            variant: "error",
          });
        }
      } else if (onlinePaymentMethod === "checkout") {
        // Stripe Checkout flow (new logic)
        try {
          const reqData = {
            amount: totalPriceWithTax.toFixed(2),
            customerInfo: {
              name: customerName,
              phone: customerPhone,
            },
            orderData: {
              items: cartItems.map(item => ({
                id: item.id,
                productId: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity
              })),
              bills: {
                total: total,
                tax: tax,
                totalWithTax: totalPriceWithTax,
              },
              paymentMethod: "stripe_checkout"
            }
          };

          const { data } = await createCheckoutSession(reqData);

          // Redirect to Stripe Checkout
          enqueueSnackbar(`Redirecting to payment page (Order: ${data.orderId})...`, { variant: "info" });
          window.location.href = data.checkoutUrl;

        } catch (error) {
          console.log('❌ Checkout session creation failed:', error);

          // Extract specific error message from backend response
          const errorMessage = extractErrorMessage(error);

          // Set payment error state to show in modal
          setPaymentError(errorMessage);

          // Also show snackbar notification
          enqueueSnackbar(errorMessage, {
            variant: "error",
          });
        }
      }
    } else {
      // Cash payment - Place the order directly
      const cashOrderId = `order_cash_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const orderData = {
        orderId: cashOrderId, // Add orderId for cash orders
        customerDetails: {
          name: customerName,
          phone: customerPhone,
          guests: customerData.guests || 1,
        },
        paymentStatus: "In Progress",
        bills: {
          total: total,
          tax: tax,
          totalWithTax: totalPriceWithTax,
        },
        items: cartItems.map(item => ({
          id: item.id,
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        table: customerData.table?.tableId,
        paymentMethod: paymentMethod,
        // paymentData field omitted for cash orders - not needed since cash doesn't require Payment document reference
      };
      orderMutation.mutate(orderData);
    }
  };

  const orderMutation = useMutation({
    mutationFn: (reqData) => addOrder(reqData),
    onSuccess: (resData) => {
      const { data } = resData.data;
      console.log('📦 Cash order created - Database response:', resData);
      console.log('📋 Order data extracted:', data);
      console.log('🆔 Order ID from database:', data._id);

      setOrderInfo(data);

      // Clear cart and customer info immediately after successful order
      dispatch(removeAllItems());
      dispatch(removeCustomer());

      // Also clear local state
      setCustomerName("");
      setCustomerPhone("");

      // Only update table if there is a table assigned
      if (data.table) {
        const tableData = {
          status: "Booked",
          orderId: data._id,
          tableId: data.table,
        };

        setTimeout(() => {
          tableUpdateMutation.mutate(tableData);
        }, 1500);
      }

      enqueueSnackbar("Cash Order Placed!", {
        variant: "success",
      });
      setShowInvoice(true);
    },
    onError: (error) => {
      console.log('❌ Cash order creation failed:', error);

      // Extract specific error message from backend response
      const errorMessage = extractErrorMessage(error);

      enqueueSnackbar(errorMessage, {
        variant: "error",
      });
    },
  });

  const tableUpdateMutation = useMutation({
    mutationFn: (reqData) => updateTable(reqData),
    onSuccess: (resData) => {
      console.log(resData);
    },
    onError: (error) => {
      console.log(error);
    },
  });

  return (
    <>
      <div className="absolute bottom-0 left-0 right-0 bg-[#f2f3f5] py-4 shadow-lg rounded-b-lg" style={{borderTop: "3px solid black",}}>
        <div className="flex items-center justify-between px-5">
          <p className="text-xs text-[black] font-medium">
            Items({cartItems.length})
          </p>
          <h1 className="text-[black] text-md font-bold">
            SGD {total.toFixed(2)}
          </h1>
        </div>
        <div className="flex items-center justify-between px-5 mt-2">
          <p className="text-xs text-[black] font-medium">Tax({taxRate}%)</p>
          <h1 className="text-[black] text-md font-bold">SGD {tax.toFixed(2)}</h1>
        </div>
        <div className="flex items-center justify-between px-5 mt-2">
          <p className="text-xs text-[black] font-medium">
            Total With Tax
          </p>
          <h1 className={`text-md font-bold ${
            !isOrderValid() ? "text-red-500" : "text-[black]"
          }`}>
            SGD {totalPriceWithTax.toFixed(2)}
          </h1>
        </div>


        <div className="flex items-center gap-3 px-5 mt-4">
          <button
            onClick={() => {
              setPaymentMethod("Cash");
              setOnlinePaymentMethod(""); // Reset online payment method
            }}
            className={`bg-[white] px-4 py-3 w-full rounded-lg text-[black] font-semibold ${
              paymentMethod === "Cash" ? "bg-[yellow] text-[black]" : ""
            }`}
          >
            Cash
          </button>
          <button
            onClick={() => {
              setPaymentMethod("Online");
              setOnlinePaymentMethod(""); // Reset online payment method when switching to Online
            }}
            className={`bg-[white] px-4 py-3 w-full rounded-lg text-[black] font-semibold ${
              paymentMethod === "Online" ? "bg-[yellow] text-[black]" : ""
            }`}
          >
            Online
          </button>
        </div>

        {/* Online Payment Method Sub-options */}
        {paymentMethod === "Online" && (
          <div className="flex items-center gap-3 px-5 mt-3">
            <button
              onClick={() => setOnlinePaymentMethod("terminal")}
              className={`bg-[white] px-3 py-2 w-full rounded-lg text-[black] font-medium text-sm border ${
                onlinePaymentMethod === "terminal"
                  ? "bg-[#e3f2fd] text-[#1976d2] border-[#1976d2]"
                  : "border-gray-300"
              }`}
            >
              Tap to Pay/Swipe
            </button>
            <button
              onClick={() => setOnlinePaymentMethod("checkout")}
              className={`bg-[white] px-3 py-2 w-full rounded-lg text-[black] font-medium text-sm border ${
                onlinePaymentMethod === "checkout"
                  ? "bg-[#e8f5e8] text-[#2e7d32] border-[#2e7d32]"
                  : "border-gray-300"
              }`}
            >
              Pay Now
            </button>
          </div>
        )}

        <div className="flex  items-center gap-3 px-5 mt-4">
          <button className="bg-[#025cca] px-4 py-3 w-full rounded-lg text-[#f5f5f5] font-semibold text-lg">
            Print Receipt
          </button>
          <button
            onClick={handlePlaceOrderClick}
            disabled={!isOrderValid() || !paymentMethod || (paymentMethod === "Online" && !onlinePaymentMethod)}
            className={`px-4 py-3 w-full rounded-lg font-semibold text-lg transition-all duration-200 ${
              !isOrderValid() || !paymentMethod || (paymentMethod === "Online" && !onlinePaymentMethod)
                ? "bg-gray-400 text-gray-600 cursor-not-allowed opacity-60"
                : "bg-[red] text-[white] hover:bg-red-600 cursor-pointer"
            }`}
          >
            Place Order
          </button>
        </div>
      </div>

      {showInvoice && (
        <Invoice orderInfo={orderInfo} setShowInvoice={setShowInvoice} />
      )}
      
      {/* Customer Information Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1f1f1f] rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Customer Information</h2>
              <button 
                onClick={() => setShowCustomerModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <FaTimes />
              </button>
            </div>
            
            <form onSubmit={handleCustomerInfoSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#383737] text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter customer name"
                  required
                />
              </div>
              
              {/* <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-[#383737] text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter phone number"
                  pattern="[0-9]{10}"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Enter a 10-digit phone number</p>
              </div> */}
              
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="mr-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#025cca] text-white rounded-md hover:bg-blue-700"
                >
                  Proceed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Processing Overlay */}
      {isProcessingPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 text-center">
            <div className="mb-6">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Processing Payment</h3>
              <p className="text-gray-600">{paymentStatus}</p>
            </div>

            {/* Show error message if there's one, but keep processing */}
            {paymentError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{paymentError}</p>
              </div>
            )}

            <div className="mb-4">
              <p className="text-sm text-gray-500">
                Please complete the payment at the terminal
              </p>
            </div>

            <button
              onClick={() => {
                setIsProcessingPayment(false);
                setPaymentError("Payment cancelled by user");
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              Cancel Payment
            </button>
          </div>
        </div>
      )}

      {/* Payment Error Overlay */}
      {paymentError && !isProcessingPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-lg w-full mx-4 text-center">
            <div className="mb-6">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 1 }}
                transition={{ duration: 0.5, type: "spring", stiffness: 150 }}
                className="w-12 h-12 border-8 border-red-500 rounded-full flex items-center justify-center shadow-lg bg-red-500 mx-auto mb-4"
              >
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                  className="text-2xl"
                >
                  <FaCircleXmark className="text-white" />
                </motion.span>
              </motion.div>
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Payment Failed</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800 text-sm leading-relaxed">{paymentError}</p>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setPaymentError(null)}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setPaymentError(null);
                  // Could trigger retry logic here
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Bill;
