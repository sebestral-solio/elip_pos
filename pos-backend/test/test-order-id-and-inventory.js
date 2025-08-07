/**
 * Test script to verify:
 * 1. Order ID is properly displayed in receipts
 * 2. Product quantities are correctly decremented after payment
 */

const axios = require('axios');
const mongoose = require('mongoose');
const Product = require('../models/productModel');
const Order = require('../models/orderModel');
const Payment = require('../models/paymentModel');
const config = require('../config/config');

// Configuration
const BASE_URL = 'http://localhost:5000/api';

// Test helper functions
const connectDB = async () => {
  try {
    await mongoose.connect(config.databaseURI);
    console.log('📊 Connected to MongoDB for testing');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('📊 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ MongoDB disconnection failed:', error);
  }
};

const createTestProduct = async () => {
  const testProduct = new Product({
    name: "Test Burger",
    price: 15.99,
    category: "Test Food",
    available: true,
    quantity: 10,
    description: "Test product for inventory testing"
  });
  
  await testProduct.save();
  console.log(`✅ Created test product: ${testProduct.name} (ID: ${testProduct._id}) with quantity: ${testProduct.quantity}`);
  return testProduct;
};

const getProductQuantity = async (productId) => {
  const product = await Product.findById(productId);
  return product ? product.quantity : null;
};

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

const testOrderIdInPayment = async (testProduct) => {
  console.log('\n🧪 Testing Order ID in Payment Flow...');
  
  const paymentData = {
    amount: 31.98,
    customerInfo: {
      name: "Test Customer",
      phone: "+65 1234 5678"
    },
    orderData: {
      items: [
        {
          id: testProduct._id.toString(),
          productId: testProduct._id.toString(),
          name: testProduct.name,
          price: testProduct.price,
          quantity: 2
        }
      ],
      bills: {
        total: 31.98,
        tax: 1.68,
        totalWithTax: 33.66,
      },
      paymentMethod: "stripe"
    }
  };
  
  const result = await makeRequest('/payment/create-payment-intent', paymentData);
  
  if (result.success && result.data.orderId) {
    console.log('✅ Payment intent created with Order ID:', result.data.orderId);
    console.log('   Payment Intent ID:', result.data.paymentIntent.id);
    return {
      success: true,
      orderId: result.data.orderId,
      paymentIntentId: result.data.paymentIntent.id
    };
  } else {
    console.log('❌ Failed to create payment intent:', result.error);
    return { success: false };
  }
};

const testInventoryUpdate = async (testProduct) => {
  console.log('\n🧪 Testing Inventory Update...');
  
  // Get initial quantity
  const initialQuantity = await getProductQuantity(testProduct._id);
  console.log(`📊 Initial quantity for ${testProduct.name}: ${initialQuantity}`);
  
  // Simulate inventory update (this would normally happen via webhook)
  const orderItems = [
    {
      id: testProduct._id.toString(),
      productId: testProduct._id.toString(),
      name: testProduct.name,
      price: testProduct.price,
      quantity: 3
    }
  ];
  
  // Import the function directly for testing
  const { updateProductQuantities } = require('../controllers/productController');
  const updateResult = await updateProductQuantities(orderItems);
  
  // Get updated quantity
  const updatedQuantity = await getProductQuantity(testProduct._id);
  console.log(`📊 Updated quantity for ${testProduct.name}: ${updatedQuantity}`);
  
  const expectedQuantity = initialQuantity - 3;
  
  if (updateResult.success && updatedQuantity === expectedQuantity) {
    console.log(`✅ Inventory update successful: ${initialQuantity} → ${updatedQuantity} (-3)`);
    return { success: true, initialQuantity, updatedQuantity };
  } else {
    console.log(`❌ Inventory update failed. Expected: ${expectedQuantity}, Got: ${updatedQuantity}`);
    console.log('   Update result:', updateResult);
    return { success: false };
  }
};

const testPendingOrders = async () => {
  console.log('\n🧪 Testing Pending Orders...');
  
  const result = await makeRequest('/payment/pending-orders', {}, 'GET');
  
  if (result.success) {
    console.log(`✅ Pending orders retrieved: ${result.data.count} orders`);
    if (result.data.data.length > 0) {
      const sampleOrder = result.data.data[0];
      console.log(`   Sample order ID: ${sampleOrder.orderId}`);
      console.log(`   Items count: ${sampleOrder.items?.length || 0}`);
    }
    return { success: true };
  } else {
    console.log('❌ Failed to retrieve pending orders:', result.error);
    return { success: false };
  }
};

const cleanupTestData = async (testProduct) => {
  try {
    // Clean up test product
    await Product.findByIdAndDelete(testProduct._id);
    console.log('🧹 Cleaned up test product');
    
    // Clean up any test orders (optional)
    await Order.deleteMany({ 'customerDetails.name': 'Test Customer' });
    console.log('🧹 Cleaned up test orders');
    
    // Clean up any test payments (optional)
    await Payment.deleteMany({ 'metadata.customerName': 'Test Customer' });
    console.log('🧹 Cleaned up test payments');
  } catch (error) {
    console.error('⚠️ Cleanup error:', error.message);
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Testing Order ID Display and Inventory Updates');
  console.log('==================================================');
  
  let testProduct;
  let passed = 0;
  let total = 0;
  
  try {
    // Connect to database
    await connectDB();
    
    // Create test product
    testProduct = await createTestProduct();
    
    // Test 1: Order ID in payment flow
    total++;
    const paymentTest = await testOrderIdInPayment(testProduct);
    if (paymentTest.success) passed++;
    
    // Test 2: Inventory update
    total++;
    const inventoryTest = await testInventoryUpdate(testProduct);
    if (inventoryTest.success) passed++;
    
    // Test 3: Pending orders endpoint
    total++;
    const pendingTest = await testPendingOrders();
    if (pendingTest.success) passed++;
    
    // Summary
    console.log('\n📊 Test Results');
    console.log('================');
    console.log(`Passed: ${passed}/${total}`);
    console.log(`Success Rate: ${Math.round((passed/total) * 100)}%`);
    
    if (passed === total) {
      console.log('🎉 All tests passed!');
      console.log('\n✅ Verified:');
      console.log('   - Order IDs are properly generated and included in payment responses');
      console.log('   - Product quantities are correctly decremented after orders');
      console.log('   - Pending orders endpoint is working');
    } else {
      console.log('⚠️ Some tests failed. Check the logs above for details.');
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  } finally {
    // Cleanup
    if (testProduct) {
      await cleanupTestData(testProduct);
    }
    await disconnectDB();
  }
  
  console.log('\n📝 Next Steps for Manual Testing:');
  console.log('1. Add items to cart in the frontend');
  console.log('2. Complete a payment via Stripe Terminal');
  console.log('3. Check the invoice displays the Order ID');
  console.log('4. Verify product quantities decreased in the database');
};

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testOrderIdInPayment,
  testInventoryUpdate,
  testPendingOrders
};
