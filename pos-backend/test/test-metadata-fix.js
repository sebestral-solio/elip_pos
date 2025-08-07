/**
 * Test script to verify that PaymentIntent metadata (including orderId) 
 * is properly returned in the checkPaymentStatus API response
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
  console.log('\n🧪 Testing PaymentIntent Creation with Metadata...');
  
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

const testPaymentStatusWithMetadata = async (paymentIntentId, expectedOrderId) => {
  console.log('\n🧪 Testing Payment Status API with Metadata...');
  
  const result = await makeRequest(`/payment/status/${paymentIntentId}`, null, 'GET');
  
  if (result.success) {
    const { paymentIntent } = result.data;
    
    console.log('✅ Payment status retrieved successfully');
    console.log(`   Payment Intent ID: ${paymentIntent.id}`);
    console.log(`   Status: ${paymentIntent.status}`);
    console.log(`   Metadata:`, paymentIntent.metadata);
    
    if (paymentIntent.metadata && paymentIntent.metadata.orderId) {
      console.log(`   Order ID from metadata: ${paymentIntent.metadata.orderId}`);
      
      if (paymentIntent.metadata.orderId === expectedOrderId) {
        console.log('✅ Order ID matches expected value');
        return { success: true, metadata: paymentIntent.metadata };
      } else {
        console.log(`❌ Order ID mismatch. Expected: ${expectedOrderId}, Got: ${paymentIntent.metadata.orderId}`);
        return { success: false, reason: 'Order ID mismatch' };
      }
    } else {
      console.log('❌ No metadata or orderId found in payment status response');
      return { success: false, reason: 'Missing metadata' };
    }
  } else {
    console.log('❌ Failed to retrieve payment status');
    console.log('   Error:', result.error);
    return { success: false, reason: 'API error' };
  }
};

const testServerConnection = async () => {
  console.log('\n🧪 Testing Server Connection...');
  
  try {
    const response = await axios.get(`${BASE_URL}/products`);
    console.log('✅ Server is running and accessible');
    return true;
  } catch (error) {
    console.log('❌ Server connection failed');
    console.log('   Error:', error.message);
    console.log('   Make sure the server is running on port 5000');
    return false;
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Testing PaymentIntent Metadata Fix');
  console.log('=====================================');
  
  let passed = 0;
  let total = 0;
  
  // Test 1: Server connection
  total++;
  if (await testServerConnection()) passed++;
  
  // Test 2: Create PaymentIntent with metadata
  total++;
  const paymentResult = await testPaymentIntentCreation();
  if (paymentResult.success) passed++;
  
  // Test 3: Check payment status includes metadata
  if (paymentResult.success) {
    total++;
    const statusResult = await testPaymentStatusWithMetadata(
      paymentResult.paymentIntentId, 
      paymentResult.orderId
    );
    if (statusResult.success) passed++;
  }
  
  // Summary
  console.log('\n📊 Test Results');
  console.log('================');
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Success Rate: ${Math.round((passed/total) * 100)}%`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! The metadata fix is working correctly.');
    console.log('\n✅ Verified:');
    console.log('   - PaymentIntent is created with orderId in metadata');
    console.log('   - checkPaymentStatus API returns metadata including orderId');
    console.log('   - Frontend should now receive orderId from payment metadata');
  } else {
    console.log('⚠️ Some tests failed. Check the logs above for details.');
  }
  
  console.log('\n📝 Next Steps');
  console.log('=============');
  console.log('1. Test the frontend payment flow');
  console.log('2. Check browser console for orderId logs');
  console.log('3. Verify order receipt shows proper Order ID');
  console.log('4. Complete a payment via Stripe Terminal to test end-to-end');
};

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testPaymentIntentCreation,
  testPaymentStatusWithMetadata,
  testServerConnection
};
