const mongoose = require('mongoose');
const Product = require('../models/productModel');
const config = require('../config/config');

// Initial product data based on the menu items from constants/index.js
const initialProducts = [
  // Beverages
  {
    name: "Coca Cola",
    price: 60,
    category: "Beverages",
    available: true,
    quantity: 50,
    description: "Classic refreshing cola drink"
  },
  {
    name: "Pepsi",
    price: 60,
    category: "Beverages",
    available: true,
    quantity: 45,
    description: "Refreshing cola beverage"
  },
  {
    name: "Sprite",
    price: 60,
    category: "Beverages",
    available: true,
    quantity: 40,
    description: "Lemon-lime flavored soft drink"
  },
  {
    name: "Mango Lassi",
    price: 120,
    category: "Beverages",
    available: true,
    quantity: 25,
    description: "Sweet yogurt-based drink with mango flavor"
  },
  
  // Snacks
  {
    name: "French Fries",
    price: 100,
    category: "Snacks",
    available: true,
    quantity: 30,
    description: "Crispy fried potato strips"
  },
  {
    name: "Chicken Nuggets",
    price: 180,
    category: "Snacks",
    available: true,
    quantity: 25,
    description: "Crispy chicken nuggets (8 pieces)"
  },
  {
    name: "Onion Rings",
    price: 120,
    category: "Snacks",
    available: true,
    quantity: 20,
    description: "Crispy battered onion rings"
  },
  
  // Sandwiches
  {
    name: "Chicken Sandwich",
    price: 160,
    category: "Sandwiches",
    available: true,
    quantity: 15,
    description: "Grilled chicken with lettuce and mayo"
  },
  {
    name: "Veggie Sandwich",
    price: 140,
    category: "Sandwiches",
    available: true,
    quantity: 18,
    description: "Fresh vegetables with cheese and sauce"
  },
  {
    name: "Club Sandwich",
    price: 180,
    category: "Sandwiches",
    available: true,
    quantity: 12,
    description: "Triple-decker sandwich with chicken, bacon, and vegetables"
  },
  
  // Desserts
  {
    name: "Chocolate Brownie",
    price: 120,
    category: "Desserts",
    available: true,
    quantity: 20,
    description: "Rich chocolate brownie with nuts"
  },
  {
    name: "Vanilla Ice Cream",
    price: 80,
    category: "Desserts",
    available: true,
    quantity: 25,
    description: "Creamy vanilla ice cream"
  },
  {
    name: "Cheesecake",
    price: 150,
    category: "Desserts",
    available: true,
    quantity: 15,
    description: "New York style cheesecake"
  },
  
  // Salads
  {
    name: "Caesar Salad",
    price: 160,
    category: "Salads",
    available: true,
    quantity: 10,
    description: "Fresh romaine lettuce with Caesar dressing and croutons"
  },
  {
    name: "Greek Salad",
    price: 180,
    category: "Salads",
    available: true,
    quantity: 8,
    description: "Cucumber, tomatoes, olives, and feta cheese"
  }
];

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(config.databaseURI);
    console.log('MongoDB connected successfully');
    
    // Delete existing products
    await Product.deleteMany({});
    console.log('Existing products deleted');
    
    // Insert new products
    await Product.insertMany(initialProducts);
    console.log(`${initialProducts.length} products inserted successfully`);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
    
    console.log('Seed completed successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

connectDB();
