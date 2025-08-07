/**
 * Test script for Payment-to-Order flow
 * 
 * This script tests the integration between payment creation and order creation
 * to ensure that orders are properly created after successful payments.
 * 
 * To run this test:
 * 1. Ensure the server is running
 * 2. Have valid Stripe configuration
 * 3. Have some products in the database
 * 4. Run: node test/payment-order-flow.test.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_TOKEN = 'your_test_jwt_token_here'; // Replace with valid JWT token

// Test data
const testOrderData = {
  amount: 25.50,
  customerInfo: {
    name: "Test Customer",
    phone: "+65 1234 5678"
  },
  orderData: {
    items: [
      {
        id: "product_id_here", // Replace with actual product ID
        name: "Test Product",
        price: 12.50,
        quantity: 2
      }
    ],
    bills: {
      total: 25.00,
      tax: 0.50,
      totalWithTax: 25.50
    },
    paymentMethod: "stripe"
  }
};

// Helper function to make authenticated requests
const makeRequest = async (method, endpoint, data = null) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error in ${method} ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
};

// Test functions
const testCreatePaymentIntent = async () => {
  console.log('\n🧪 Testing Payment Intent Creation...');
  
  try {
    const result = await makeRequest('POST', '/payment/create-payment-intent', testOrderData);
    
    if (result.success && result.orderId && result.paymentIntent) {
      console.log('✅ Payment Intent created successfully');
      console.log(`   Order ID: ${result.orderId}`);
      console.log(`   Payment Intent ID: ${result.paymentIntent.id}`);
      return result;
    } else {
      console.log('❌ Payment Intent creation failed');
      console.log('   Response:', result);
      return null;
    }
  } catch (error) {
    console.log('❌ Payment Intent creation error:', error.message);
    return null;
  }
};

const testPendingOrders = async () => {
  console.log('\n🧪 Testing Pending Orders Endpoint...');
  
  try {
    const result = await makeRequest('GET', '/payment/pending-orders');
    
    if (result.success) {
      console.log('✅ Pending orders retrieved successfully');
      console.log(`   Count: ${result.count}`);
      if (result.data.length > 0) {
        console.log('   Sample order:', result.data[0].orderId);
      }
      return result;
    } else {
      console.log('❌ Failed to retrieve pending orders');
      return null;
    }
  } catch (error) {
    console.log('❌ Pending orders error:', error.message);
    return null;
  }
};

const testGetProducts = async () => {
  console.log('\n🧪 Testing Products Endpoint...');
  
  try {
    const result = await makeRequest('GET', '/products');
    
    if (result.success && result.data.length > 0) {
      console.log('✅ Products retrieved successfully');
      console.log(`   Count: ${result.data.length}`);
      console.log(`   Sample product: ${result.data[0].name} (ID: ${result.data[0]._id})`);
      
      // Update test data with real product ID
      testOrderData.orderData.items[0].id = result.data[0]._id;
      testOrderData.orderData.items[0].name = result.data[0].name;
      testOrderData.orderData.items[0].price = result.data[0].price;
      
      return result;
    } else {
      console.log('❌ No products found or failed to retrieve products');
      return null;
    }
  } catch (error) {
    console.log('❌ Products error:', error.message);
    return null;
  }
};

const testInvalidOrderData = async () => {
  console.log('\n🧪 Testing Invalid Order Data...');
  
  const invalidData = {
    amount: 25.50,
    customerInfo: {
      name: "Test Customer",
      phone: "+65 1234 5678"
    }
    // Missing orderData
  };
  
  try {
    const result = await makeRequest('POST', '/payment/create-payment-intent', invalidData);
    console.log('❌ Should have failed but succeeded:', result);
    return false;
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Correctly rejected invalid order data');
      return true;
    } else {
      console.log('❌ Unexpected error:', error.message);
      return false;
    }
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Starting Payment-to-Order Flow Tests');
  console.log('=====================================');
  
  let passed = 0;
  let total = 0;
  
  // Test 1: Get products (to get valid product IDs)
  total++;
  const products = await testGetProducts();
  if (products) passed++;
  
  // Test 2: Test invalid order data
  total++;
  const invalidTest = await testInvalidOrderData();
  if (invalidTest) passed++;
  
  // Test 3: Create payment intent with valid data
  total++;
  const paymentIntent = await testCreatePaymentIntent();
  if (paymentIntent) passed++;
  
  // Test 4: Check pending orders
  total++;
  const pendingOrders = await testPendingOrders();
  if (pendingOrders) passed++;
  
  // Summary
  console.log('\n📊 Test Results');
  console.log('================');
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Success Rate: ${Math.round((passed/total) * 100)}%`);
  
  if (passed === total) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check the logs above.');
  }
  
  // Instructions for manual testing
  console.log('\n📝 Manual Testing Instructions');
  console.log('==============================');
  console.log('1. Use Stripe Terminal to complete a payment');
  console.log('2. Check the server logs for order creation');
  console.log('3. Verify the order appears in the database');
  console.log('4. Check that inventory was updated');
  console.log('5. Verify the order has a paymentData reference');
};

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testCreatePaymentIntent,
  testPendingOrders,
  testGetProducts,
  testInvalidOrderData
};
