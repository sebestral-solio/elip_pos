import React, { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaCircleXmark } from "react-icons/fa6";
import { enqueueSnackbar } from "notistack";

const CheckoutCancel = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const orderId = searchParams.get('order_id');
  const reason = searchParams.get('reason');

  useEffect(() => {
    // Show appropriate message based on failure reason
    const messages = {
      'verification_failed': 'Payment verification failed. The payment was not completed.',
      'stripe_verification_failed': 'Payment verification failed with Stripe. This session is invalid.',
      'order_status_failed': 'Order status verification failed. Please contact support.',
      'method_mismatch': 'Payment method verification failed.',
      'verification_error': 'Payment verification error occurred.',
      'default': 'Payment was cancelled. You can try again.'
    };

    const message = messages[reason] || messages['default'];
    const variant = reason && reason !== 'default' ? 'error' : 'warning';

    enqueueSnackbar(message, { variant });
  }, [reason]);

  const handleBackToMenu = () => {
    navigate("/menu");
  };

  const handleTryAgain = () => {
    // Navigate back to menu where user can place order again
    navigate("/menu");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 text-center">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1.2, opacity: 1 }}
          transition={{ duration: 0.5, type: "spring", stiffness: 150 }}
          className="w-16 h-16 border-8 border-red-500 rounded-full flex items-center justify-center shadow-lg bg-red-500 mx-auto mb-6"
        >
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="text-3xl"
          >
            <FaCircleXmark className="text-white" />
          </motion.span>
        </motion.div>

        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          {reason && reason.includes('verification') ? 'Payment Verification Failed' : 'Payment Cancelled'}
        </h2>
        <p className="text-gray-600 mb-6">
          {reason && reason.includes('verification')
            ? 'The payment could not be verified as legitimate. No charges were made to your account.'
            : 'Your payment was cancelled. No charges were made to your account.'
          }
        </p>
        
        {orderId && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">Order ID</p>
            <p className="font-mono text-lg font-semibold text-gray-800">{orderId}</p>
            <p className="text-xs text-red-600 mt-1">
              Order status: {reason && reason.includes('verification') ? 'Verification Failed' : 'Cancelled'}
            </p>
            {reason && (
              <p className="text-xs text-gray-500 mt-1">Reason: {reason.replace(/_/g, ' ')}</p>
            )}
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-amber-800 text-sm">
            Don't worry! You can go back to the menu and place your order again. 
            Your cart items may still be available.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleBackToMenu}
            className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            Back to Menu
          </button>
          <button
            onClick={handleTryAgain}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutCancel;
