const createHttpError = require("http-errors");
const stripe = require("stripe");
const config = require("../config/config");
const Configuration = require("../models/configurationModel");

// Initialize Stripe with secret key
const stripeClient = config.stripeSecretKey ? stripe(config.stripeSecretKey) : null;

// Terminal Verification API
const verifyTerminal = async (req, res, next) => {
  const { terminalId } = req.body;
  
  try {
    console.log("Terminal verification request received:", { terminalId, userId: req.user?._id });
    
    if (!terminalId) {
      console.log("Terminal ID missing in request");
      const error = createHttpError(400, "Terminal ID is required");
      return next(error);
    }

    // Check if Stripe is configured
    if (!stripeClient) {
      console.log("Stripe client not configured");
      return res.status(500).json({
        success: false,
        message: "Stripe is not configured. Please check your environment variables."
      });
    }

    console.log("Attempting to retrieve terminal from Stripe:", terminalId);
    // 1. Check if terminal exists in Stripe
    const reader = await stripeClient.terminal.readers.retrieve(terminalId);
    
    // 2. Verify it belongs to this admin's Stripe account
    if (!reader) {
      return res.status(404).json({ 
        success: false, 
        message: "Terminal not found in your Stripe account" 
      });
    }
    
    // 3. Check if already added to system
    const config = await Configuration.findOne({ adminId: req.user._id });
    const existingTerminal = config?.terminals?.find(t => t.terminalId === terminalId);
    
    if (existingTerminal) {
      return res.status(409).json({
        success: false,
        message: "Terminal already added to your system"
      });
    }
    
    // 4. Return terminal info for confirmation
    res.json({
      success: true,
      message: "Terminal verified successfully",
      data: {
        terminalId: reader.id,
        label: reader.label,
        deviceType: reader.device_type,
        status: reader.status,
        location: reader.location,
        serialNumber: reader.serial_number,
        ipAddress: reader.ip_address,
        lastSeen: new Date(reader.last_seen_at * 1000)
      }
    });
  } catch (error) {
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        success: false,
        message: "Invalid terminal ID or Stripe error",
        error: error.message
      });
    }
    
    const httpError = createHttpError(500, "Internal server error");
    return next(httpError);
  }
};

// Add Terminal to Configuration
const addTerminal = async (req, res, next) => {
  const { terminalData } = req.body; // Data from verification step
  
  try {
    if (!terminalData) {
      const error = createHttpError(400, "Terminal data is required");
      return next(error);
    }

    // Add terminal to admin's configuration
    const updatedConfig = await Configuration.findOneAndUpdate(
      { adminId: req.user._id },
      { 
        $push: { 
          terminals: {
            ...terminalData,
            stripeData: terminalData, // Store full Stripe response
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Terminal added successfully",
      data: updatedConfig.terminals[updatedConfig.terminals.length - 1]
    });
  } catch (error) {
    const httpError = createHttpError(500, "Failed to add terminal");
    return next(httpError);
  }
};

// Get All Terminals for Admin
const getTerminals = async (req, res, next) => {
  try {
    const config = await Configuration.findOne({ adminId: req.user._id })
      .populate('terminals.assignedStallId', 'name location');

    if (!config || !config.terminals) {
      return res.json({
        success: true,
        message: "No terminals found",
        data: []
      });
    }

    res.json({
      success: true,
      message: "Terminals retrieved successfully",
      data: config.terminals
    });
  } catch (error) {
    const httpError = createHttpError(500, "Failed to retrieve terminals");
    return next(httpError);
  }
};

// Get Single Terminal
const getTerminal = async (req, res, next) => {
  const { terminalId } = req.params;

  try {
    const config = await Configuration.findOne({ adminId: req.user._id })
      .populate('terminals.assignedStallId', 'name location');

    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Configuration not found"
      });
    }

    const terminal = config.terminals.find(t => t.terminalId === terminalId);
    
    if (!terminal) {
      return res.status(404).json({
        success: false,
        message: "Terminal not found"
      });
    }

    res.json({
      success: true,
      message: "Terminal retrieved successfully",
      data: terminal
    });
  } catch (error) {
    const httpError = createHttpError(500, "Failed to retrieve terminal");
    return next(httpError);
  }
};

// Update Terminal
const updateTerminal = async (req, res, next) => {
  const { terminalId } = req.params;
  const { label, assignedStallId, isActive } = req.body;

  try {
    const config = await Configuration.findOne({ adminId: req.user._id });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Configuration not found"
      });
    }

    const terminalIndex = config.terminals.findIndex(t => t.terminalId === terminalId);
    
    if (terminalIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Terminal not found"
      });
    }

    // Update terminal fields
    if (label !== undefined) config.terminals[terminalIndex].label = label;
    if (assignedStallId !== undefined) config.terminals[terminalIndex].assignedStallId = assignedStallId;
    if (isActive !== undefined) config.terminals[terminalIndex].isActive = isActive;
    config.terminals[terminalIndex].updatedAt = new Date();

    await config.save();

    res.json({
      success: true,
      message: "Terminal updated successfully",
      data: config.terminals[terminalIndex]
    });
  } catch (error) {
    const httpError = createHttpError(500, "Failed to update terminal");
    return next(httpError);
  }
};

// Delete Terminal
const deleteTerminal = async (req, res, next) => {
  const { terminalId } = req.params;

  try {
    const config = await Configuration.findOne({ adminId: req.user._id });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Configuration not found"
      });
    }

    const terminalIndex = config.terminals.findIndex(t => t.terminalId === terminalId);
    
    if (terminalIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Terminal not found"
      });
    }

    // Remove terminal from array
    config.terminals.splice(terminalIndex, 1);
    await config.save();

    res.json({
      success: true,
      message: "Terminal deleted successfully"
    });
  } catch (error) {
    const httpError = createHttpError(500, "Failed to delete terminal");
    return next(httpError);
  }
};

// Update Terminal Status (from Stripe webhooks or periodic sync)
const updateTerminalStatus = async (req, res, next) => {
  const { terminalId } = req.params;
  const { status, lastSeen, ipAddress } = req.body;

  try {
    const config = await Configuration.findOne({ adminId: req.user._id });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Configuration not found"
      });
    }

    const terminalIndex = config.terminals.findIndex(t => t.terminalId === terminalId);
    
    if (terminalIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Terminal not found"
      });
    }

    // Update status fields
    if (status) config.terminals[terminalIndex].status = status;
    if (lastSeen) config.terminals[terminalIndex].lastSeen = new Date(lastSeen);
    if (ipAddress) config.terminals[terminalIndex].ipAddress = ipAddress;
    config.terminals[terminalIndex].updatedAt = new Date();

    await config.save();

    res.json({
      success: true,
      message: "Terminal status updated successfully",
      data: config.terminals[terminalIndex]
    });
  } catch (error) {
    const httpError = createHttpError(500, "Failed to update terminal status");
    return next(httpError);
  }
};

// Assign Terminal to Stall
const assignTerminalToStall = async (req, res, next) => {
  const { terminalId } = req.params;
  const { stallId } = req.body;
  
  try {
    if (!stallId) {
      const error = createHttpError(400, "Stall ID is required");
      return next(error);
    }

    // Import Stall model here to avoid circular dependency
    const Stall = require("../models/stallModel");

    // 1. Verify stall exists and belongs to admin
    const stall = await Stall.findById(stallId);
    if (!stall) {
      return res.status(404).json({
        success: false,
        message: "Stall not found"
      });
    }

    // 2. Check if terminal exists in admin's configuration
    const config = await Configuration.findOne({ adminId: req.user._id });
    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Configuration not found"
      });
    }

    const terminalIndex = config.terminals.findIndex(t => t.terminalId === terminalId);
    if (terminalIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Terminal not found in your configuration"
      });
    }

    // 3. Find the terminal by terminalId and get its _id
    const terminal = config.terminals.find(t => t.terminalId === terminalId);
    if (!terminal) {
      return res.status(404).json({
        success: false,
        message: "Terminal not found"
      });
    }

    // 4. Check if terminal is already assigned to another stall
    const existingStallWithTerminal = await Stall.findOne({ 
      terminalId: terminal._id,
      _id: { $ne: stallId }
    });
    
    if (existingStallWithTerminal) {
      return res.status(409).json({
        success: false,
        message: "Terminal is already assigned to another stall"
      });
    }

    // 5. Update stall with terminal reference
    await Stall.findByIdAndUpdate(stallId, {
      $set: {
        terminalId: terminal._id
      }
    });

    // 6. Get updated stall data
    const updatedStall = await Stall.findById(stallId);

    res.json({
      success: true,
      message: "Terminal assigned to stall successfully",
      data: {
        terminal: terminal,
        stall: {
          _id: updatedStall._id,
          name: updatedStall.name,
          stallNumber: updatedStall.stallNumber,
          terminalId: updatedStall.terminalId
        }
      }
    });
  } catch (error) {
    const httpError = createHttpError(500, "Failed to assign terminal to stall");
    return next(httpError);
  }
};

// Unassign Terminal from Stall
const unassignTerminalFromStall = async (req, res, next) => {
  const { terminalId } = req.params;
  
  try {
    // Import Stall model here to avoid circular dependency
    const Stall = require("../models/stallModel");

    // 1. Get current terminal assignment
    const config = await Configuration.findOne({ adminId: req.user._id });
    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Configuration not found"
      });
    }

    const terminal = config.terminals.find(t => t.terminalId === terminalId);
    if (!terminal) {
      return res.status(404).json({
        success: false,
        message: "Terminal not found"
      });
    }

    // 2. Find stall that has this terminal assigned
    const stall = await Stall.findOne({ terminalId: terminal._id });
    if (!stall) {
      return res.status(400).json({
        success: false,
        message: "Terminal is not assigned to any stall"
      });
    }

    // 3. Remove terminal assignment from stall
    await Stall.findByIdAndUpdate(stall._id, {
      $unset: {
        terminalId: ""
      }
    });

    res.json({
      success: true,
      message: "Terminal unassigned from stall successfully"
    });
  } catch (error) {
    const httpError = createHttpError(500, "Failed to unassign terminal from stall");
    return next(httpError);
  }
};

// Get Terminal Assignments
const getTerminalAssignments = async (req, res, next) => {
  try {
    // Import Stall model here to avoid circular dependency
    const Stall = require("../models/stallModel");

    const config = await Configuration.findOne({ adminId: req.user._id });

    if (!config || !config.terminals) {
      return res.json({
        success: true,
        message: "No terminal assignments found",
        data: []
      });
    }

    // Get all stalls with terminal assignments
    const stallsWithTerminals = await Stall.find({ 
      adminId: req.user._id,
      terminalId: { $exists: true, $ne: null }
    });

    // Map terminals with their assigned stalls
    const assignedTerminals = config.terminals
      .map(terminal => {
        const assignedStall = stallsWithTerminals.find(stall => 
          stall.terminalId && stall.terminalId.toString() === terminal._id.toString()
        );
        
        if (assignedStall) {
          return {
            ...terminal.toObject(),
            assignedStall: {
              _id: assignedStall._id,
              name: assignedStall.name,
              stallNumber: assignedStall.stallNumber,
              location: assignedStall.location
            }
          };
        }
        return null;
      })
      .filter(terminal => terminal !== null);

    res.json({
      success: true,
      message: "Terminal assignments retrieved successfully",
      data: assignedTerminals
    });
  } catch (error) {
    const httpError = createHttpError(500, "Failed to retrieve terminal assignments");
    return next(httpError);
  }
};

// Update tax rate for admin user
const updateTaxRate = async (req, res, next) => {
    try {
        const { taxRate } = req.body;
        const userId = req.user._id;

        // Validate input
        if (taxRate === undefined || taxRate === null) {
            const error = createHttpError(400, "Tax rate is required");
            return next(error);
        }

        // Validate tax rate range
        if (taxRate < 0 || taxRate > 100) {
            const error = createHttpError(400, "Tax rate must be between 0 and 100");
            return next(error);
        }

        // Get the requesting user
        const User = require("../models/userModel");
        const user = await User.findById(userId);
        if (!user) {
            const error = createHttpError(404, "User not found");
            return next(error);
        }

        // Check if user is admin
        if (user.role !== 'Admin') {
            const error = createHttpError(403, "Only admin users can update tax rate configuration");
            return next(error);
        }

        // Get or create configuration for admin
        let configuration = await Configuration.findOne({ adminId: userId });
        if (!configuration) {
            configuration = new Configuration({
                adminId: userId,
                taxSettings: {
                    taxRate: taxRate,
                    platformFeeRate: 0,
                    lastUpdated: new Date()
                },
                terminals: [],
                businessSettings: {
                    currency: 'SGD',
                    timezone: 'Asia/Singapore'
                },
                linkedUsers: []
            });
        } else {
            // Update existing configuration
            configuration.taxSettings.taxRate = taxRate;
            configuration.taxSettings.lastUpdated = new Date();
        }

        await configuration.save();

        // Get linked users and update their tax rates (if any)
        const linkedUserIds = configuration.linkedUsers || [];
        if (linkedUserIds.length > 0) {
            // Update all linked users' tax rates in their configurations
            const updateResult = await Configuration.updateMany(
                {
                    adminId: { $in: linkedUserIds }
                },
                {
                    $set: {
                        'taxSettings.taxRate': taxRate,
                        'taxSettings.lastUpdated': new Date()
                    }
                }
            );

            console.log(`Updated tax rate for ${updateResult.modifiedCount} linked user configurations`);
        }

        res.status(200).json({
            success: true,
            message: "Tax rate updated successfully",
            data: {
                taxRate,
                linkedUsersUpdated: linkedUserIds.length,
                lastUpdated: configuration.taxSettings.lastUpdated
            }
        });

    } catch (error) {
        console.error('Error updating tax rate:', error);
        next(error);
    }
};

// Get tax rate for current user
const getTaxRate = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const userType = req.userType;

        let taxRate = 5.25; // Default
        let isAdmin = false;
        let canModify = false;
        let lastUpdated = null;

        if (userType === 'stallManager') {
            // For stall managers, get tax rate from their admin's configuration
            const stallManager = req.user; // Already populated from middleware

            if (stallManager.adminId) {
                const adminConfig = await Configuration.findOne({ adminId: stallManager.adminId });
                if (adminConfig) {
                    taxRate = adminConfig.taxSettings?.taxRate || 5.25;
                    lastUpdated = adminConfig.taxSettings?.lastUpdated || null;
                }
            }

            isAdmin = false;
            canModify = false; // Stall managers cannot modify tax rates
        } else {
            // For regular users
            const User = require("../models/userModel");
            const user = await User.findById(userId);
            if (!user) {
                const error = createHttpError(404, "User not found");
                return next(error);
            }

            isAdmin = user.role === 'Admin';
            canModify = isAdmin; // Only admins can modify tax rates

            if (isAdmin) {
                // For admin users, get from their configuration
                const adminConfig = await Configuration.findOne({ adminId: userId });
                if (adminConfig) {
                    taxRate = adminConfig.taxSettings?.taxRate || 5.25;
                    lastUpdated = adminConfig.taxSettings?.lastUpdated || null;
                } else {
                    // Create default configuration if it doesn't exist
                    const newConfig = new Configuration({
                        adminId: userId,
                        taxSettings: {
                            taxRate: 5.25,
                            platformFeeRate: 0,
                            lastUpdated: new Date()
                        },
                        terminals: [],
                        businessSettings: {
                            currency: 'SGD',
                            timezone: 'Asia/Singapore'
                        },
                        linkedUsers: []
                    });
                    await newConfig.save();
                    taxRate = 5.25;
                    lastUpdated = newConfig.taxSettings.lastUpdated;
                }
            } else {
                // For non-admin users, use default or check if they have their own config
                const userConfig = await Configuration.findOne({ adminId: userId });
                if (userConfig) {
                    taxRate = userConfig.taxSettings?.taxRate || 5.25;
                    lastUpdated = userConfig.taxSettings?.lastUpdated || null;
                }
            }
        }

        res.status(200).json({
            success: true,
            data: {
                taxRate,
                isAdmin,
                canModify,
                lastUpdated
            }
        });

    } catch (error) {
        console.error('Error getting tax rate:', error);
        next(error);
    }
};

module.exports = {
  verifyTerminal,
  addTerminal,
  getTerminals,
  getTerminal,
  updateTerminal,
  deleteTerminal,
  updateTerminalStatus,
  assignTerminalToStall,
  unassignTerminalFromStall,
  getTerminalAssignments,
  updateTaxRate,
  getTaxRate
};
