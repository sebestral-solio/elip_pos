const mongoose = require("mongoose");
const User = require("../models/userModel");
const Configuration = require("../models/configurationModel");
require("dotenv").config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected for migration");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
};

// Migration function
const migrateConfigData = async () => {
  try {
    console.log("🚀 Starting configuration data migration...");

    // Find all admin users with config data
    const adminUsers = await User.find({ 
      role: 'Admin', 
      config: { $exists: true } 
    });

    console.log(`📊 Found ${adminUsers.length} admin users with config data`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const admin of adminUsers) {
      try {
        // Check if configuration already exists
        const existingConfig = await Configuration.findOne({ adminId: admin._id });
        
        if (existingConfig) {
          console.log(`⚠️  Configuration already exists for admin: ${admin.email} - Skipping`);
          skippedCount++;
          continue;
        }

        // Create new configuration from user config data
        const newConfig = new Configuration({
          adminId: admin._id,
          taxSettings: {
            taxRate: admin.config?.taxRate || 5.25,
            platformFeeRate: admin.config?.platformFeeRate || 0,
            lastUpdated: admin.config?.lastUpdated || new Date()
          },
          terminals: [], // Start with empty terminals
          businessSettings: {
            currency: 'SGD',
            timezone: 'Asia/Singapore'
          },
          linkedUsers: admin.config?.linkedUsers || []
        });

        await newConfig.save();
        
        console.log(`✅ Migrated configuration for admin: ${admin.email}`);
        console.log(`   - Tax Rate: ${newConfig.taxSettings.taxRate}%`);
        console.log(`   - Platform Fee: ${newConfig.taxSettings.platformFeeRate}%`);
        console.log(`   - Linked Users: ${newConfig.linkedUsers.length}`);
        
        migratedCount++;

      } catch (error) {
        console.error(`❌ Error migrating config for admin ${admin.email}:`, error.message);
        errorCount++;
      }
    }

    console.log("\n📈 Migration Summary:");
    console.log(`   ✅ Successfully migrated: ${migratedCount}`);
    console.log(`   ⚠️  Skipped (already exists): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📊 Total processed: ${adminUsers.length}`);

    if (migratedCount > 0) {
      console.log("\n🎉 Migration completed successfully!");
      console.log("💡 Next steps:");
      console.log("   1. Test the application to ensure tax configuration works");
      console.log("   2. Verify that all admin users can access their tax settings");
      console.log("   3. Once confirmed, you can remove the 'config' field from User model");
    } else {
      console.log("\n✨ No migration needed - all configurations already exist or no admin users found");
    }

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
};

// Verification function to check migration results
const verifyMigration = async () => {
  try {
    console.log("\n🔍 Verifying migration results...");

    const adminUsers = await User.find({ role: 'Admin' });
    const configurations = await Configuration.find({});

    console.log(`📊 Admin users: ${adminUsers.length}`);
    console.log(`📊 Configurations: ${configurations.length}`);

    for (const admin of adminUsers) {
      const config = await Configuration.findOne({ adminId: admin._id });
      if (config) {
        console.log(`✅ ${admin.email}: Configuration exists (Tax: ${config.taxSettings.taxRate}%)`);
      } else {
        console.log(`❌ ${admin.email}: No configuration found`);
      }
    }

  } catch (error) {
    console.error("❌ Verification failed:", error);
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    
    // Run migration
    await migrateConfigData();
    
    // Verify results
    await verifyMigration();
    
    console.log("\n🏁 Migration script completed");
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Migration script failed:", error);
    process.exit(1);
  }
};

// Handle script arguments
const args = process.argv.slice(2);
if (args.includes('--verify-only')) {
  // Only run verification
  connectDB().then(verifyMigration).then(() => {
    console.log("\n🏁 Verification completed");
    process.exit(0);
  }).catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });
} else {
  // Run full migration
  main();
}

module.exports = { migrateConfigData, verifyMigration };
