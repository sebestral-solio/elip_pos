/**
 * Quick test script to verify the payment-to-order flow fix
 * 
 * This script tests that the createPaymentIntent endpoint now properly
 * accepts orderData and creates payment intents without errors.
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';

// Test data with the new format
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

// Test data without orderData (should fail)
const testInvalidData = {
  amount: 25.50,
  customerInfo: {
    name: "Test Customer",
    phone: "+65 1234 5678"
  }
  // Missing orderData
};

// Helper function to make requests
const makeRequest = async (endpoint, data) => {
  try {
    const response = await axios.post(`${BASE_URL}${endpoint}`, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
};

// Test functions
const testValidPaymentData = async () => {
  console.log('\n🧪 Testing Valid Payment Data...');
  
  const result = await makeRequest('/payment/create-payment-intent', testPaymentData);
  
  if (result.success) {
    console.log('✅ Valid payment data accepted');
    console.log(`   Order ID: ${result.data.orderId}`);
    console.log(`   Payment Intent ID: ${result.data.paymentIntent?.id}`);
    return true;
  } else {
    console.log('❌ Valid payment data rejected');
    console.log('   Error:', result.error);
    return false;
  }
};

const testInvalidPaymentData = async () => {
  console.log('\n🧪 Testing Invalid Payment Data (missing orderData)...');
  
  const result = await makeRequest('/payment/create-payment-intent', testInvalidData);
  
  if (!result.success && result.status === 400) {
    console.log('✅ Invalid payment data correctly rejected');
    console.log('   Error message:', result.error.message || result.error);
    return true;
  } else {
    console.log('❌ Invalid payment data should have been rejected');
    console.log('   Result:', result);
    return false;
  }
};

const testPendingOrders = async () => {
  console.log('\n🧪 Testing Pending Orders Endpoint...');
  
  const result = await makeRequest('/payment/pending-orders', {});
  
  if (result.success) {
    console.log('✅ Pending orders endpoint working');
    console.log(`   Count: ${result.data.count}`);
    return true;
  } else {
    console.log('❌ Pending orders endpoint failed');
    console.log('   Error:', result.error);
    return false;
  }
};

const testServerConnection = async () => {
  console.log('\n🧪 Testing Server Connection...');
  
  try {
    const response = await axios.get(`${BASE_URL}/products`);
    console.log('✅ Server is running and accessible');
    console.log(`   Products available: ${response.data.data?.length || 0}`);
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
  console.log('🚀 Testing Payment-to-Order Flow Fix');
  console.log('====================================');
  
  let passed = 0;
  let total = 0;
  
  // Test 1: Server connection
  total++;
  if (await testServerConnection()) passed++;
  
  // Test 2: Invalid payment data (should be rejected)
  total++;
  if (await testInvalidPaymentData()) passed++;
  
  // Test 3: Valid payment data (should be accepted)
  total++;
  if (await testValidPaymentData()) passed++;
  
  // Test 4: Pending orders endpoint
  total++;
  if (await testPendingOrders()) passed++;
  
  // Summary
  console.log('\n📊 Test Results');
  console.log('================');
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Success Rate: ${Math.round((passed/total) * 100)}%`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! The payment flow fix is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the logs above for details.');
  }
  
  console.log('\n📝 Next Steps');
  console.log('=============');
  console.log('1. Test the frontend with real cart items');
  console.log('2. Complete a payment via Stripe Terminal');
  console.log('3. Verify order creation in the database');
  console.log('4. Check inventory updates');
};

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testValidPaymentData,
  testInvalidPaymentData,
  testPendingOrders,
  testServerConnection
};
