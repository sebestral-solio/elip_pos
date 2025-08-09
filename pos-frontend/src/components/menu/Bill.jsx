import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getTotalPrice } from "../../redux/slices/cartSlice";
import {
  addOrder,
  createPaymentIntent,
  updateTable,
  confirmPayment,
  checkPaymentStatus,
  capturePaymentIntent,
} from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { useMutation } from "@tanstack/react-query";
import { removeAllItems } from "../../redux/slices/cartSlice";
import { removeCustomer, setCustomerInfo } from "../../redux/slices/customerSlice";
import Invoice from "../invoice/Invoice";
import { FaTimes } from "react-icons/fa";

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
  const taxRate = 5.25;
  const tax = (total * taxRate) / 100;
  const totalPriceWithTax = total + tax;

  const [paymentMethod, setPaymentMethod] = useState("");
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
        if (pollCount >= 24) { // 24 polls × 5 seconds = 2 minutes
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
      if (customMessage.toLowerCase().includes('insufficient funds')) {
        errorMessage = "Payment failed: Insufficient funds. Please use a different payment method.";
      } else if (customMessage.toLowerCase().includes('card_declined') || customMessage.toLowerCase().includes('declined')) {
        errorMessage = "Payment failed: Card declined. Please try a different card or payment method.";
      } else if (customMessage.toLowerCase().includes('expired')) {
        errorMessage = "Payment failed: Card expired. Please use a different card.";
      } else if (customMessage.toLowerCase().includes('incorrect')) {
        errorMessage = "Payment failed: Incorrect card details. Please check your card information.";
      } else if (customMessage.toLowerCase().includes('timeout') || customMessage.toLowerCase().includes('terminal')) {
        errorMessage = "Payment failed at terminal. Please try again or use a different payment method.";
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
    } else {
      // If no table to update, still remove customer info
      dispatch(removeCustomer());
    }

    enqueueSnackbar("Order Placed Successfully!", {
      variant: "success",
    });
    setShowInvoice(true);
  };

  // Show customer info modal before placing order
  const handlePlaceOrderClick = () => {
    if (!paymentMethod) {
      enqueueSnackbar("Please select a payment method!", {
        variant: "warning",
      });
      return;
    }
    
    // Show customer info modal
    setShowCustomerModal(true);
  };
  
  // Actual order placement logic
  const proceedWithOrder = async () => {
    if (!paymentMethod) {
      enqueueSnackbar("Please select a payment method!", {
        variant: "warning",
      });

      return;
    }

    if (paymentMethod === "Online") {
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
        console.log(error);
        enqueueSnackbar("Payment Failed!", {
          variant: "error",
        });
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
        items: cartItems,
        table: customerData.table?.tableId,
        paymentMethod: paymentMethod,
        paymentData: {
          payment_method_type: "cash",
        },
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
      } else {
        // If no table to update, still remove customer info
        dispatch(removeCustomer());
      }

      enqueueSnackbar("Cash Order Placed!", {
        variant: "success",
      });
      setShowInvoice(true);
    },
    onError: (error) => {
      console.log('❌ Cash order creation failed:', error);
      enqueueSnackbar("Failed to create cash order", {
        variant: "error",
      });
    },
  });

  const tableUpdateMutation = useMutation({
    mutationFn: (reqData) => updateTable(reqData),
    onSuccess: (resData) => {
      console.log(resData);
      dispatch(removeCustomer());
      dispatch(removeAllItems());
    },
    onError: (error) => {
      console.log(error);
    },
  });

  return (
    <>
      <div className="absolute bottom-0 left-0 right-0 bg-[#f2f3f5] py-4 shadow-lg rounded-b-lg">
        <div className="flex items-center justify-between px-5">
          <p className="text-xs text-[black] font-medium">
            Items({cartItems.length})
          </p>
          <h1 className="text-[black] text-md font-bold">
            ₹{total.toFixed(2)}
          </h1>
        </div>
        <div className="flex items-center justify-between px-5 mt-2">
          <p className="text-xs text-[black] font-medium">Tax(5.25%)</p>
          <h1 className="text-[black] text-md font-bold">₹{tax.toFixed(2)}</h1>
        </div>
        <div className="flex items-center justify-between px-5 mt-2">
          <p className="text-xs text-[black] font-medium">
            Total With Tax
          </p>
          <h1 className="text-[black] text-md font-bold">
            ₹{totalPriceWithTax.toFixed(2)}
          </h1>
        </div>
        <div className="flex items-center gap-3 px-5 mt-4">
          <button
            onClick={() => setPaymentMethod("Cash")}
            className={`bg-[white] px-4 py-3 w-full rounded-lg text-[black] font-semibold ${
              paymentMethod === "Cash" ? "bg-[yellow] text-[black]" : ""
            }`}
          >
            Cash
          </button>
          <button
            onClick={() => setPaymentMethod("Online")}
            className={`bg-[white] px-4 py-3 w-full rounded-lg text-[black] font-semibold ${
              paymentMethod === "Online" ? "bg-[yellow] text-[black]" : ""
            }`}
          >
            Online
          </button>
        </div>

        <div className="flex items-center gap-3 px-5 mt-4">
          <button className="bg-[#025cca] px-4 py-3 w-full rounded-lg text-[#f5f5f5] font-semibold text-lg">
            Print Receipt
          </button>
          <button
            onClick={handlePlaceOrderClick}
            className="bg-[red] px-4 py-3 w-full rounded-lg text-[white] font-semibold text-lg"
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
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 text-center">
            <div className="mb-6">
              <div className="text-red-500 text-6xl mb-4">❌</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Payment Failed</h3>
              <p className="text-gray-600">{paymentError}</p>
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
