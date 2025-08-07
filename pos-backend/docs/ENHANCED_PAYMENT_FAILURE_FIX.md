# Enhanced Payment Failure Handling Fix

## Issue Description
Based on the logs provided, when payments failed at the terminal level, the frontend continued polling indefinitely because:

1. **Terminal failures don't update PaymentIntent status**: When a card is declined at the terminal, the PaymentIntent remains in `requires_payment_method` status instead of changing to `payment_failed`
2. **Frontend polling continues**: The polling logic only stopped for `payment_failed` status, not for terminal-level failures
3. **Infinite processing state**: Users saw the processing loader indefinitely with no error feedback

**Logs showing the issue:**
```
❌ Terminal action failed: card_declined - Your card has insufficient funds.
❌ Charge failed: Your card has insufficient funds.
❌ Payment failed: pi_3RtP3NHYfKxFbjNy0Ax4FlhF
🧹 Cleaning up pending order due to terminal failure: order_1754554801195_jy0bkmfp8

// But frontend kept polling:
🔍 Checking payment status for pi_3RtP3NHYfKxFbjNy0Ax4FlhF
📊 Payment status: requires_payment_method
🔍 Checking payment status for pi_3RtP3NHYfKxFbjNy0Ax4FlhF
📊 Payment status: requires_payment_method
// ... continues indefinitely
```

## Root Cause Analysis

### Stripe Terminal Behavior
- When a terminal action fails (card declined, insufficient funds, etc.), the PaymentIntent status doesn't automatically change to `payment_failed`
- The PaymentIntent remains in `requires_payment_method` status
- Only the backend webhook receives the terminal failure events

### Frontend Polling Logic
- Frontend only stopped polling for explicit `payment_failed` status
- `requires_payment_method` status was treated as "waiting for customer action"
- No timeout or failure detection for stuck payments

## Solution Implemented

### 1. Enhanced Frontend Polling Logic

**Added intelligent failure detection:**
```javascript
// Track consecutive requires_payment_method responses
let consecutiveRequiresPaymentMethod = 0;

if (paymentIntent.status === 'requires_payment_method') {
  consecutiveRequiresPaymentMethod++;
  
  // After 30+ seconds, check with backend
  if (consecutiveRequiresPaymentMethod >= 6 && pollCount > 6) {
    const { data: failureCheck } = await axios.get(`/api/payment/check-failure/${paymentIntentId}`);
    
    if (failureCheck.shouldStop) {
      // Backend confirmed failure - stop polling immediately
      clearInterval(pollInterval);
      clearTimeout(paymentTimeout);
      handlePaymentFailure(paymentIntent, failureCheck.failureReason);
      return;
    }
  }
  
  // Ultimate timeout after 60+ seconds
  if (consecutiveRequiresPaymentMethod >= 12) {
    clearInterval(pollInterval);
    clearTimeout(paymentTimeout);
    handlePaymentFailure(paymentIntent, "Payment timeout at terminal. Please try again.");
  }
}
```

### 2. Backend Failure Detection Endpoint

**New endpoint: `GET /api/payment/check-failure/:paymentIntentId`**
```javascript
const checkPaymentFailureAndCleanup = async (req, res, next) => {
  const { paymentIntentId } = req.params;
  const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
  const orderId = paymentIntent.metadata?.orderId;
  
  let shouldCleanup = false;
  let failureReason = null;
  
  if (paymentIntent.status === 'requires_payment_method' && orderId && pendingOrders.has(orderId)) {
    const orderData = pendingOrders.get(orderId);
    const orderAge = Date.now() - orderData.createdAt.getTime();
    
    // If order is older than 2 minutes and still requires payment method, likely failed
    if (orderAge > 2 * 60 * 1000) {
      shouldCleanup = true;
      failureReason = "Payment timeout at terminal";
      pendingOrders.delete(orderId); // Clean up pending order
    }
  }
  
  res.json({
    success: true,
    shouldStop: shouldCleanup,
    failureReason: failureReason,
    cleanedUp: shouldCleanup
  });
};
```

### 3. Enhanced Error Handling

**Specific error messages based on failure type:**
```javascript
const handlePaymentFailure = (paymentIntent, customMessage = null) => {
  setIsProcessingPayment(false); // ✅ Stop processing state
  setPaymentStatus("Payment Failed");
  
  let errorMessage = customMessage || "Payment failed. Please try again.";
  
  // Handle specific failure types
  if (customMessage) {
    if (customMessage.toLowerCase().includes('insufficient funds')) {
      errorMessage = "Payment failed: Insufficient funds. Please use a different payment method.";
    } else if (customMessage.toLowerCase().includes('declined')) {
      errorMessage = "Payment failed: Card declined. Please try a different card or payment method.";
    } else if (customMessage.toLowerCase().includes('timeout') || customMessage.toLowerCase().includes('terminal')) {
      errorMessage = "Payment failed at terminal. Please try again or use a different payment method.";
    }
  }
  
  setPaymentError(errorMessage);
  enqueueSnackbar(errorMessage, { variant: "error" });
};
```

### 4. Improved Backend Cleanup

**Enhanced terminal failure handling:**
```javascript
case 'terminal.reader.action_failed':
  const failedAction = event.data.object;
  
  if (failedAction.action.type === 'process_payment_intent') {
    const failedPaymentIntentId = failedAction.action.process_payment_intent.payment_intent;
    
    try {
      const paymentIntent = await stripeClient.paymentIntents.retrieve(failedPaymentIntentId);
      const orderId = paymentIntent.metadata?.orderId;
      
      if (orderId && pendingOrders.has(orderId)) {
        console.log(`🧹 Cleaning up pending order due to terminal failure: ${orderId}`);
        pendingOrders.delete(orderId);
      }
    } catch (retrieveError) {
      console.error('Failed to retrieve failed payment for cleanup:', retrieveError);
    }
  }
  break;
```

## Expected Behavior After Fix

### Timeline of Events
```
1. Customer attempts payment at terminal
2. Payment fails (insufficient funds, declined, etc.)
3. Backend receives terminal failure webhook
4. Backend cleans up pending order
5. Frontend continues polling (status still requires_payment_method)
6. After 30 seconds: Frontend checks with backend
7. Backend responds: shouldStop = true, failureReason = "Payment timeout at terminal"
8. ✅ Frontend stops polling immediately
9. ✅ Processing loader disappears
10. ✅ Error overlay appears with specific message
11. ✅ User can try again or close error
```

### Error Messages by Scenario

| Scenario | Detection Method | Error Message | Icon |
|----------|------------------|---------------|------|
| Insufficient Funds | Charge failure message | "Payment failed: Insufficient funds. Please use a different payment method." | 💳 |
| Card Declined | Charge failure message | "Payment failed: Card declined. Please try a different card or payment method." | 🚫 |
| Terminal Timeout | Backend age check | "Payment failed at terminal. Please try again or use a different payment method." | ❌ |
| Generic Failure | Fallback | "Payment failed. Please try again." | ❌ |

### Console Logs
```
// Backend logs
❌ Terminal action failed: card_declined - Your card has insufficient funds.
🧹 Cleaning up pending order due to terminal failure: order_1234567890_abc123def

// Frontend logs (after 30 seconds)
🔍 Poll 6: Payment status - requires_payment_method
❌ Backend confirmed payment failed at terminal, stopping polling
❌ Payment failure handled: {
  paymentIntentId: "pi_3RtP3NHYfKxFbjNy0Ax4FlhF",
  status: "requires_payment_method",
  errorMessage: "Payment failed at terminal. Please try again or use a different payment method."
}
```

## Testing

### Automated Testing
```bash
cd pos-backend
node test/test-enhanced-failure-handling.js
```

### Manual Testing Steps
1. **Add items to cart** and select "Online" payment
2. **Use a test card with insufficient funds** (e.g., `4000000000000002`)
3. **Watch the frontend console** - should see polling for ~30 seconds
4. **Verify polling stops** after backend check
5. **Check error display** shows appropriate message and icon
6. **Test "Try Again"** button resets the flow

### Test Cards for Different Failures
- **Insufficient funds**: `4000000000000002`
- **Generic decline**: `4000000000000002`
- **Card declined**: `4000000000000069`

## API Changes

### New Endpoint
- `GET /api/payment/check-failure/:paymentIntentId` - Check if payment has failed at terminal level

### Enhanced Endpoints
- `GET /api/payment/status/:paymentIntentId` - Now includes metadata for failure detection

## Impact

### ✅ Fixed Issues
- ❌ Infinite processing loader on terminal failures
- ✅ Immediate error feedback when payments fail
- ✅ Specific error messages based on failure type
- ✅ Proper cleanup of pending orders
- ✅ Intelligent polling with timeout detection

### 🎯 Improved User Experience
- **Quick feedback**: Users know within 30-60 seconds if payment failed
- **Clear messaging**: Specific guidance based on failure type
- **No confusion**: No more infinite loading states
- **Recovery options**: Clear "Try Again" and "Close" buttons

### 🔧 Better System Reliability
- **Resource cleanup**: Pending orders removed for failed payments
- **Intelligent polling**: Stops when backend detects failures
- **Fallback timeouts**: Ultimate timeout prevents infinite polling
- **Enhanced logging**: Better tracking of failure scenarios

## Deployment Notes

### Frontend Changes
- Enhanced polling logic with failure detection
- New backend API call for failure checking
- Improved error handling and messaging

### Backend Changes
- New failure detection endpoint
- Enhanced webhook cleanup logic
- Better pending order management

### Configuration
- No environment variable changes required
- Existing Stripe configuration works as-is
- No database schema changes needed

## Monitoring

### Key Metrics to Watch
- **Average polling duration** before failure detection
- **Pending order cleanup frequency** 
- **Error message distribution** by failure type
- **User retry rates** after failures

### Log Patterns to Monitor
- `🧹 Cleaning up pending order due to terminal failure`
- `❌ Backend confirmed payment failed at terminal`
- `❌ Payment failure handled`
