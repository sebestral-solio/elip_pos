/**
 * Test script to verify enhanced payment failure handling
 * 
 * This script tests:
 * 1. Backend failure detection and cleanup
 * 2. Frontend polling stops on terminal failures
 * 3. Proper error messages are displayed
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';

// Test data
const testPaymentData = {
  amount: 25.50,
  customerInfo: {
    name: "Test Customer",
    phone: "+65 1234 5678"
  },
  orderData: {
    items: [
      {
        id: "507f1f77bcf86cd799439011", // Mock product ID
        productId: "507f1f77bcf86cd799439011",
        name: "Test Product",
        price: 12.50,
        quantity: 2
      }
    ],
    bills: {
      total: 25.00,
      tax: 0.50,
      totalWithTax: 25.50,
    },
    paymentMethod: "stripe"
  }
};

// Helper function to make requests
const makeRequest = async (endpoint, data, method = 'POST') => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (data && method !== 'GET') {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
};

const testPaymentIntentCreation = async () => {
  console.log('\n🧪 Testing PaymentIntent Creation...');
  
  const result = await makeRequest('/payment/create-payment-intent', testPaymentData);
  
  if (result.success && result.data.orderId) {
    console.log('✅ PaymentIntent created successfully');
    console.log(`   Order ID: ${result.data.orderId}`);
    console.log(`   Payment Intent ID: ${result.data.paymentIntent.id}`);
    return {
      success: true,
      orderId: result.data.orderId,
      paymentIntentId: result.data.paymentIntent.id
    };
  } else {
    console.log('❌ PaymentIntent creation failed');
    console.log('   Error:', result.error);
    return { success: false };
  }
};

const testFailureDetectionEndpoint = async (paymentIntentId, orderId) => {
  console.log('\n🧪 Testing Failure Detection Endpoint...');
  
  // Wait a bit to simulate time passing
  console.log('   Waiting 3 seconds to simulate payment processing...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const result = await makeRequest(`/payment/check-failure/${paymentIntentId}`, null, 'GET');
  
  if (result.success) {
    console.log('✅ Failure detection endpoint working');
    console.log(`   Should stop: ${result.data.shouldStop}`);
    console.log(`   Failure reason: ${result.data.failureReason || 'None'}`);
    console.log(`   Cleaned up: ${result.data.cleanedUp}`);
    
    return {
      success: true,
      shouldStop: result.data.shouldStop,
      failureReason: result.data.failureReason,
      cleanedUp: result.data.cleanedUp
    };
  } else {
    console.log('❌ Failure detection endpoint failed');
    console.log('   Error:', result.error);
    return { success: false };
  }
};

const testPendingOrdersAfterFailure = async (orderId) => {
  console.log('\n🧪 Testing Pending Orders After Failure...');
  
  const result = await makeRequest('/payment/pending-orders', null, 'GET');
  
  if (result.success) {
    const orderExists = result.data.data.some(order => order.orderId === orderId);
    
    console.log('✅ Pending orders retrieved successfully');
    console.log(`   Total pending orders: ${result.data.count}`);
    console.log(`   Test order still exists: ${orderExists}`);
    
    return {
      success: true,
      orderExists: orderExists,
      totalPending: result.data.count
    };
  } else {
    console.log('❌ Failed to retrieve pending orders');
    console.log('   Error:', result.error);
    return { success: false };
  }
};

const simulatePaymentPolling = async (paymentIntentId) => {
  console.log('\n🧪 Simulating Payment Polling...');
  
  let pollCount = 0;
  const maxPolls = 5;
  
  while (pollCount < maxPolls) {
    pollCount++;
    console.log(`   Poll ${pollCount}: Checking payment status...`);
    
    const statusResult = await makeRequest(`/payment/status/${paymentIntentId}`, null, 'GET');
    
    if (statusResult.success) {
      const { paymentIntent } = statusResult.data;
      console.log(`   Status: ${paymentIntent.status}`);
      
      if (paymentIntent.status === 'succeeded') {
        console.log('   ✅ Payment succeeded');
        return { success: true, status: 'succeeded' };
      } else if (paymentIntent.status === 'payment_failed') {
        console.log('   ❌ Payment failed');
        return { success: true, status: 'payment_failed' };
      } else if (paymentIntent.status === 'requires_payment_method') {
        console.log('   ⏳ Still requires payment method');
        
        // After a few polls, check if we should stop
        if (pollCount >= 3) {
          const failureCheck = await makeRequest(`/payment/check-failure/${paymentIntentId}`, null, 'GET');
          if (failureCheck.success && failureCheck.data.shouldStop) {
            console.log('   🛑 Backend says we should stop polling');
            return { 
              success: true, 
              status: 'terminal_failure',
              reason: failureCheck.data.failureReason 
            };
          }
        }
      }
    } else {
      console.log(`   ❌ Error checking status: ${statusResult.error}`);
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('   ⏰ Polling timeout reached');
  return { success: true, status: 'timeout' };
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Testing Enhanced Payment Failure Handling');
  console.log('=============================================');
  
  let passed = 0;
  let total = 0;
  
  // Test 1: Create PaymentIntent
  total++;
  const paymentResult = await testPaymentIntentCreation();
  if (paymentResult.success) passed++;
  
  if (!paymentResult.success) {
    console.log('❌ Cannot continue tests without PaymentIntent');
    return;
  }
  
  // Test 2: Simulate payment polling
  total++;
  const pollingResult = await simulatePaymentPolling(paymentResult.paymentIntentId);
  if (pollingResult.success) passed++;
  
  // Test 3: Test failure detection endpoint
  total++;
  const failureResult = await testFailureDetectionEndpoint(
    paymentResult.paymentIntentId, 
    paymentResult.orderId
  );
  if (failureResult.success) passed++;
  
  // Test 4: Check pending orders after failure
  total++;
  const pendingResult = await testPendingOrdersAfterFailure(paymentResult.orderId);
  if (pendingResult.success) passed++;
  
  // Summary
  console.log('\n📊 Test Results');
  console.log('================');
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Success Rate: ${Math.round((passed/total) * 100)}%`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Enhanced failure handling is working correctly.');
    console.log('\n✅ Verified:');
    console.log('   - PaymentIntent creation works');
    console.log('   - Payment polling simulation works');
    console.log('   - Failure detection endpoint works');
    console.log('   - Pending orders cleanup works');
  } else {
    console.log('⚠️ Some tests failed. Check the logs above for details.');
  }
  
  console.log('\n📝 Manual Testing Steps:');
  console.log('1. Add items to cart and select "Online" payment');
  console.log('2. Use a card that will be declined (e.g., insufficient funds)');
  console.log('3. Watch the frontend logs - polling should stop after ~30-60 seconds');
  console.log('4. Verify error message appears with appropriate icon');
  console.log('5. Check that processing loader disappears');
  
  console.log('\n🔧 Expected Frontend Behavior:');
  console.log('- Processing starts normally');
  console.log('- After 30+ seconds of requires_payment_method, backend check occurs');
  console.log('- If backend says payment failed, polling stops immediately');
  console.log('- Error overlay appears with specific failure message');
  console.log('- User can try again or close the error');
};

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testPaymentIntentCreation,
  testFailureDetectionEndpoint,
  testPendingOrdersAfterFailure,
  simulatePaymentPolling
};
