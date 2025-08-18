const createHttpError = require("http-errors");
const StallManager = require("../models/stallManagerModel");
const Stall = require("../models/stallModel");
const { default: mongoose } = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config/config");

// Get all stall managers
const getStallManagers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = '', status = 'active' } = req.query;
    
    // Build query
    const query = {};
    
    // Filter by status
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }
    
    // Add search functionality
    if (search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count for pagination
    const totalCount = await StallManager.countDocuments(query);
    
    // Fetch stall managers with pagination 
    const stallManagers = await StallManager.find(query)
      .populate('stallIds', 'stallNumber name location')
      .populate('adminId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    console.log(`📋 Retrieved ${stallManagers.length} stall managers (page ${page}/${Math.ceil(totalCount / limit)})`);

    res.status(200).json({
      success: true,
      message: "Stall managers retrieved successfully",
      data: stallManagers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: skip + stallManagers.length < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching stall managers:', error);
    next(error);
  }
};

// Get stall manager by ID
const getStallManagerById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(400, "Invalid stall manager ID format");
      return next(error);
    }

    const stallManager = await StallManager.findById(id)
      .populate('stallIds', 'stallNumber name location isActive')
      .populate('adminId', 'name email role');

    if (!stallManager) {
      const error = createHttpError(404, "Stall manager not found");
      return next(error);
    }

    console.log(`👤 Retrieved stall manager: ${stallManager.name} (${stallManager.email})`);

    res.status(200).json({
      success: true,
      message: "Stall manager retrieved successfully",
      data: stallManager
    });
  } catch (error) {
    console.error('Error fetching stall manager:', error);
    next(error);
  }
};

// Create new stall manager
const createStallManager = async (req, res, next) => {
  try {
    const { name, email, phone, password, permissions } = req.body;

    // Check if email already exists (case-insensitive)
    const existingManager = await StallManager.findOne({ 
      email: { $regex: new RegExp(`^${email.trim()}$`, 'i') }
    });
    
    if (existingManager) {
      const error = createHttpError(409, "A stall manager with this email already exists");
      return next(error);
    }

    // Get admin ID from authenticated user
    const adminId = req.user._id;
    
    // Create new stall manager
    const stallManagerData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password.trim(),
      adminId,
      permissions: permissions || ['manage_orders', 'view_reports']
    };

    // Add phone if provided
    if (phone && phone.trim()) {
      stallManagerData.phone = phone.trim();
    }

    const stallManager = new StallManager(stallManagerData);
    await stallManager.save();

    console.log(`✅ New stall manager created by admin ${req.user.email}: ${stallManager.name} (${stallManager.email})`);

    res.status(201).json({
      success: true,
      message: "Stall manager created successfully",
      data: stallManager
    });
  } catch (error) {
    console.error('Error creating stall manager:', error);
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
      const errorMessage = `A stall manager with this ${duplicateField} already exists`;
      return next(createHttpError(409, errorMessage));
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      const errorMessage = `Validation failed: ${validationErrors.join(', ')}`;
      return next(createHttpError(400, errorMessage));
    }
    
    next(error);
  }
};

// Update stall manager
const updateStallManager = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, password, permissions, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(400, "Invalid stall manager ID format");
      return next(error);
    }

    // Find existing stall manager
    const existingManager = await StallManager.findById(id);
    if (!existingManager) {
      const error = createHttpError(404, "Stall manager not found");
      return next(error);
    }

    // Check if email is being changed and if it already exists
    if (email && email.toLowerCase().trim() !== existingManager.email) {
      const emailExists = await StallManager.findOne({ 
        email: { $regex: new RegExp(`^${email.trim()}$`, 'i') },
        _id: { $ne: id }
      });
      if (emailExists) {
        const error = createHttpError(409, "A stall manager with this email already exists");
        return next(error);
      }
    }

    // Prepare update data
    const updateData = {};
    if (name && name.trim()) updateData.name = name.trim();
    if (email && email.trim()) updateData.email = email.toLowerCase().trim();
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : "";
    if (permissions && Array.isArray(permissions)) updateData.permissions = permissions;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    // Handle password update (only if provided)
    if (password && password.trim()) {
      updateData.password = password.trim();
    }

    // Update stall manager
    const updatedManager = await StallManager.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('stallIds', 'stallNumber name location');

    console.log(`✅ Stall manager updated by admin ${req.user.email}: ${updatedManager.name} (${updatedManager.email})`);

    res.status(200).json({
      success: true,
      message: "Stall manager updated successfully",
      data: updatedManager
    });
  } catch (error) {
    console.error('Error updating stall manager:', error);
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
      const errorMessage = `A stall manager with this ${duplicateField} already exists`;
      return next(createHttpError(409, errorMessage));
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      const errorMessage = `Validation failed: ${validationErrors.join(', ')}`;
      return next(createHttpError(400, errorMessage));
    }
    
    next(error);
  }
};

// Delete stall manager (soft delete)
const deleteStallManager = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(400, "Invalid stall manager ID format");
      return next(error);
    }

    // Find and soft delete (set isActive to false)
    const stallManager = await StallManager.findByIdAndUpdate(
      id,
      { 
        isActive: false,
        // Optionally add deletion timestamp
        deletedAt: new Date(),
        deletedBy: req.user._id
      },
      { new: true }
    );

    if (!stallManager) {
      const error = createHttpError(404, "Stall manager not found");
      return next(error);
    }

    console.log(`🗑️ Stall manager soft deleted by admin ${req.user.email}: ${stallManager.name} (${stallManager.email})`);

    res.status(200).json({
      success: true,
      message: "Stall manager deleted successfully",
      data: stallManager
    });
  } catch (error) {
    console.error('Error deleting stall manager:', error);
    next(error);
  }
};

// Get stall managers by admin
const getStallManagersByAdmin = async (req, res, next) => {
  try {
    const adminId = req.user._id;
    
    const stallManagers = await StallManager.find({ 
      adminId: adminId,
      isActive: true 
    })
    .populate('stallIds', 'stallNumber name location')
    .sort({ createdAt: -1 });

    console.log(`📋 Retrieved ${stallManagers.length} stall managers for admin ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: "Admin's stall managers retrieved successfully",
      data: stallManagers
    });
  } catch (error) {
    console.error('Error fetching admin stall managers:', error);
    next(error);
  }
};

// Assign stall to manager
const assignStallToManager = async (req, res, next) => {
  try {
    const { managerId } = req.params;
    const { stallId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(managerId) || !mongoose.Types.ObjectId.isValid(stallId)) {
      const error = createHttpError(400, "Invalid manager ID or stall ID format");
      return next(error);
    }

    const stallManager = await StallManager.findById(managerId);
    if (!stallManager) {
      const error = createHttpError(404, "Stall manager not found");
      return next(error);
    }

    if (!stallManager.isActive) {
      const error = createHttpError(400, "Cannot assign stall to inactive manager");
      return next(error);
    }

    // Add stall to manager's stallIds if not already present
    if (!stallManager.stallIds.includes(stallId)) {
      stallManager.stallIds.push(stallId);
      await stallManager.save();
    }

    const updatedManager = await StallManager.findById(managerId)
      .populate('stallIds', 'stallNumber name location');

    console.log(`🏪 Stall assigned to manager by admin ${req.user.email}: ${updatedManager.name}`);

    res.status(200).json({
      success: true,
      message: "Stall assigned to manager successfully",
      data: updatedManager
    });
  } catch (error) {
    console.error('Error assigning stall to manager:', error);
    next(error);
  }
};

// Stall Manager Login
const stallManagerLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      const error = createHttpError(400, "Email and password are required!");
      return next(error);
    }

    // Find stall manager by email (case-insensitive)
    const stallManager = await StallManager.findOne({
      email: { $regex: new RegExp(`^${email.trim()}$`, 'i') },
      isActive: true
    }).populate('stallIds', 'stallNumber name location');

    if (!stallManager) {
      const error = createHttpError(401, "Invalid credentials");
      return next(error);
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, stallManager.password);
    if (!isMatch) {
      const error = createHttpError(401, "Invalid credentials");
      return next(error);
    }

    // Update last login
    await stallManager.updateLastLogin();

    // Generate JWT token (same structure as user login)
    const accessToken = jwt.sign(
      {
        _id: stallManager._id,
        userType: 'stallManager' // Add userType to distinguish in middleware
      },
      config.accessTokenSecret,
      { expiresIn: '1d' }
    );

    // Set cookie (same as user login)
    res.cookie('accessToken', accessToken, {
      maxAge: 1000 * 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: 'none',
      secure: true
    });

    console.log(`🔐 Stall manager login successful: ${stallManager.name} (${stallManager.email})`);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        _id: stallManager._id,
        name: stallManager.name,
        email: stallManager.email,
        phone: stallManager.phone,
        role: stallManager.role, // 'stall_manager'
        permissions: stallManager.permissions,
        stallIds: stallManager.stallIds,
        lastLogin: stallManager.lastLogin
      }
    });
  } catch (error) {
    console.error('Error during stall manager login:', error);
    next(error);
  }
};

module.exports = {
  getStallManagers,
  getStallManagerById,
  createStallManager,
  updateStallManager,
  deleteStallManager,
  getStallManagersByAdmin,
  assignStallToManager,
  stallManagerLogin
};
