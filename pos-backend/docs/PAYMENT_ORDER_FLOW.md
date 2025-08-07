# Payment to Order Flow Documentation

## Overview

This document describes the updated payment flow where orders are created automatically after successful payments, ensuring data consistency and proper inventory management.

## Flow Description

### 1. Payment Intent Creation
When a payment intent is created via `/api/payment/create-payment-intent`, the system now:

- **Accepts order data**: The endpoint now requires `orderData` containing `items` and `bills`
- **Validates inventory**: Checks if all items are available before creating payment
- **Stores order temporarily**: Saves complete order data in memory with unique `orderId`
- **Creates PaymentIntent**: Includes `orderId` in metadata for later reference

**Request Format:**
```json
{
  "amount": 25.50,
  "customerInfo": {
    "name": "John Doe",
    "phone": "+65 1234 5678"
  },
  "orderData": {
    "items": [
      {
        "id": "product_id_here",
        "name": "Product Name",
        "price": 12.50,
        "quantity": 2
      }
    ],
    "bills": {
      "total": 25.00,
      "tax": 0.50,
      "totalWithTax": 25.50
    },
    "paymentMethod": "stripe"
  }
}
```

### 2. Payment Processing
- Payment is processed via Stripe Terminal
- Webhook receives payment success notification
- System validates payment status

### 3. Order Creation (Automatic)
When payment succeeds via webhook:

1. **Retrieve order data**: Uses `orderId` from payment metadata
2. **Create order**: Saves complete order to database with:
   - All order details from temporary storage
   - Reference to payment via `paymentData` field
   - Status set to "Completed"
3. **Update inventory**: Reduces product quantities based on order items
4. **Cleanup**: Removes temporary order data

## Key Features

### Inventory Validation
- **Pre-payment check**: Validates inventory before creating payment intent
- **Post-payment update**: Updates product quantities after successful payment
- **Error handling**: Logs inventory update failures for manual review

### Data Integrity
- **Payment-Order linking**: Orders reference payments via `paymentData` field
- **Unique order IDs**: Generated as `order_{timestamp}_{random}`
- **Metadata consistency**: Order ID stored in payment metadata

### Error Handling
- **Payment success, order failure**: Logged for manual intervention
- **Inventory update failure**: Order created but inventory needs manual review
- **Expired orders**: Automatic cleanup of pending orders after 1 hour

## Database Schema Updates

### Order Model
```javascript
{
  orderId: String,              // From payment metadata
  customerDetails: {
    name: String,
    phone: String
  },
  paymentStatus: "Completed",   // Set after payment success
  orderDate: Date,
  bills: {
    total: Number,
    tax: Number,
    totalWithTax: Number
  },
  items: [{
    productId: ObjectId,
    name: String,
    price: Number,
    quantity: Number
  }],
  paymentMethod: String,
  paymentData: ObjectId         // Reference to Payment model
}
```

### Payment Model
```javascript
{
  paymentIntentId: String,
  chargeId: String,
  amount: Number,
  currency: String,
  status: String,
  paymentMethodType: String,
  paymentMethod: String,
  receiptUrl: String,
  metadata: {
    orderId: String,            // Links to order
    customerName: String,
    customerPhone: String
  },
  createdAt: Date
}
```

## API Endpoints

### New/Updated Endpoints
- `POST /api/payment/create-payment-intent` - Now accepts order data
- `GET /api/payment/pending-orders` - Debug endpoint to view pending orders

### Response Format
```json
{
  "success": true,
  "orderId": "order_1234567890_abc123def",
  "paymentIntent": {
    "id": "pi_...",
    "client_secret": "pi_..._secret_...",
    "amount": 2550,
    "currency": "SGD",
    "status": "requires_payment_method"
  },
  "reader": {
    "id": "tmr_...",
    "status": "online",
    "action": {...}
  }
}
```

## Error Scenarios

### Insufficient Inventory
```json
{
  "success": false,
  "message": "Insufficient inventory for some items",
  "invalidItems": [
    {
      "id": "product_id",
      "name": "Product Name",
      "requested": 5,
      "available": 2,
      "reason": "Insufficient quantity"
    }
  ]
}
```

### Missing Order Data
```json
{
  "success": false,
  "message": "Order data with items and bills is required"
}
```

## Monitoring and Debugging

### Console Logs
- `💳 PaymentIntent created with orderId: ...`
- `📋 Order created successfully: ...`
- `📦 Inventory update result: ...`
- `🧹 Cleaned up expired pending order: ...`

### Debug Endpoint
`GET /api/payment/pending-orders` returns all pending orders in memory.

## Migration Notes

### Existing Code Impact
- **Frontend**: Must now send `orderData` when creating payment intents
- **Order creation**: Direct order creation via `/api/order` still works for non-payment flows
- **Backward compatibility**: Existing payment flows without order data will fail validation

### Deployment Considerations
- **Memory usage**: Pending orders stored in memory (consider Redis for production)
- **Cleanup**: Automatic cleanup runs every 30 minutes
- **Error monitoring**: Monitor logs for payment/order creation failures
