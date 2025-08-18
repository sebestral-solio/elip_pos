import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaCheck, FaSpinner } from "react-icons/fa";
import { enqueueSnackbar } from "notistack";
import { getOrderByOrderId, verifyCheckoutSession } from "../../https";
import Invoice from "../invoice/Invoice";

const CheckoutSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);

  const sessionId = searchParams.get('session_id');
  const orderId = searchParams.get('order_id');

  useEffect(() => {
    const handleCheckoutSuccess = async () => {
      if (!sessionId || !orderId) {
        enqueueSnackbar("Invalid checkout session", { variant: "error" });
        navigate("/menu");
        return;
      }

      try {
        // Wait a moment for webhook to process
        await new Promise(resolve => setTimeout(resolve, 2000));

        // STEP 1: Verify session with Stripe directly (most secure)
        console.log(`🔍 Verifying session ${sessionId} for order ${orderId}...`);
        const verificationResponse = await verifyCheckoutSession(sessionId, orderId);

        if (!verificationResponse.data.success || !verificationResponse.data.verified) {
          console.warn("❌ Stripe session verification failed:", verificationResponse.data);
          enqueueSnackbar("Payment verification failed. This session is not valid.", { variant: "error" });
          navigate(`/checkout/cancel?order_id=${orderId}&reason=stripe_verification_failed`);
          return;
        }

        console.log("✅ Stripe session verification passed:", verificationResponse.data);

        // STEP 2: Fetch actual order data from API
        const { data } = await getOrderByOrderId(orderId);

        if (data && data.data) {
          const order = data.data;

          // STEP 3: Double-check order status (defense in depth)
          if (order.status !== "Completed" || order.paymentStatus !== "Completed") {
            console.warn("⚠️ Order status verification failed:", {
              orderId: orderId,
              orderStatus: order.status,
              paymentStatus: order.paymentStatus,
              sessionId: sessionId
            });

            enqueueSnackbar("Order status verification failed. Please contact support.", { variant: "error" });
            navigate(`/checkout/cancel?order_id=${orderId}&reason=order_status_failed`);
            return;
          }

          // STEP 4: Verify payment method
          if (order.paymentMethod !== "stripe_checkout") {
            console.warn("⚠️ Payment method mismatch:", {
              orderId: orderId,
              expectedMethod: "stripe_checkout",
              actualMethod: order.paymentMethod
            });

            enqueueSnackbar("Payment method verification failed.", { variant: "error" });
            navigate(`/checkout/cancel?order_id=${orderId}&reason=method_mismatch`);
            return;
          }

          // All verifications passed - show success
          setOrderInfo(order);
          setLoading(false);

          enqueueSnackbar("Payment verified and completed successfully!", { variant: "success" });

          // Show invoice after a short delay
          setTimeout(() => {
            setShowInvoice(true);
          }, 500);
        } else {
          throw new Error("Order data not found");
        }

      } catch (error) {
        console.error("❌ Error verifying payment:", error);
        enqueueSnackbar("Payment verification failed. Redirecting...", { variant: "error" });

        // Redirect to cancel page instead of showing fake success
        navigate(`/checkout/cancel?order_id=${orderId}&reason=verification_error`);
      }
    };

    handleCheckoutSuccess();
  }, [sessionId, orderId, navigate]);

  const handleBackToMenu = () => {
    navigate("/menu");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <FaSpinner className="animate-spin text-green-600 text-4xl mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Processing Payment...</h2>
          <p className="text-gray-600">Please wait while we confirm your payment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 text-center">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1.2, opacity: 1 }}
          transition={{ duration: 0.5, type: "spring", stiffness: 150 }}
          className="w-16 h-16 border-8 border-green-500 rounded-full flex items-center justify-center shadow-lg bg-green-500 mx-auto mb-6"
        >
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="text-3xl"
          >
            <FaCheck className="text-white" />
          </motion.span>
        </motion.div>

        <h2 className="text-2xl font-bold text-gray-800 mb-4">Payment Successful!</h2>
        <p className="text-gray-600 mb-6">
          Your order has been completed successfully.
        </p>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600">Order ID</p>
          <p className="font-mono text-lg font-semibold text-gray-800">{orderId}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleBackToMenu}
            className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            Back to Menu
          </button>
          <button
            onClick={() => setShowInvoice(true)}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            View Receipt
          </button>
        </div>
      </div>

      {showInvoice && orderInfo && (
        <Invoice orderInfo={orderInfo} setShowInvoice={setShowInvoice} />
      )}
    </div>
  );
};

export default CheckoutSuccess;
