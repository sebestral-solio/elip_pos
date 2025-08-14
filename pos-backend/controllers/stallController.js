const createHttpError = require("http-errors");
const Stall = require("../models/stallModel");
const StallManager = require("../models/stallManagerModel");
const { default: mongoose } = require("mongoose");

// Get all stalls for current admin
const getStalls = async (req, res, next) => {
  try {
    const adminId = req.user._id;
    
    const stalls = await Stall.find({ 
      adminId: adminId
    })
    .populate('managerId', 'name email phone')
    .sort({ createdAt: -1 });

    console.log(`🏪 Retrieved ${stalls.length} stalls for admin ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: "Stalls retrieved successfully",
      data: stalls
    });
  } catch (error) {
    console.error('Error fetching stalls:', error);
    next(error);
  }
};

// Get stall by ID
const getStallById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(400, "Invalid stall ID format");
      return next(error);
    }

    const stall = await Stall.findById(id)
      .populate('managerId', 'name email phone')
      .populate('adminId', 'name email role');

    if (!stall) {
      const error = createHttpError(404, "Stall not found");
      return next(error);
    }

    console.log(`🏪 Retrieved stall: ${stall.name} (${stall.stallNumber})`);

    res.status(200).json({
      success: true,
      message: "Stall retrieved successfully",
      data: stall
    });
  } catch (error) {
    console.error('Error fetching stall:', error);
    next(error);
  }
};

// Create new stall
const createStall = async (req, res, next) => {
  try {
    const { stallNumber, name, location, managerId, terminalId } = req.body;

    // Validate required fields
    if (!stallNumber || !name) {
      const error = createHttpError(400, "Stall number and name are required");
      return next(error);
    }

    // Check if stall number already exists
    const existingStall = await Stall.findOne({ 
      stallNumber: stallNumber.toUpperCase().trim() 
    });
    
    if (existingStall) {
      const error = createHttpError(409, "A stall with this number already exists");
      return next(error);
    }

    // Validate manager if provided
    if (managerId) {
      if (!mongoose.Types.ObjectId.isValid(managerId)) {
        const error = createHttpError(400, "Invalid manager ID format");
        return next(error);
      }

      const manager = await StallManager.findById(managerId);
      if (!manager || !manager.isActive) {
        const error = createHttpError(404, "Manager not found or inactive");
        return next(error);
      }
    }

    // Get admin ID from authenticated user
    const adminId = req.user._id;
    
    // Create new stall
    const stallData = {
      stallNumber: stallNumber.toUpperCase().trim(),
      name: name.trim(),
      adminId
    };

    // Add optional fields
    if (location && location.trim()) {
      stallData.location = location.trim();
    }

    if (managerId) {
      stallData.managerId = managerId;
    }

    if (terminalId) {
      stallData.terminalId = terminalId;
    }

    const stall = new Stall(stallData);
    await stall.save();

    // If manager is assigned, update manager's stallIds
    if (managerId) {
      await StallManager.findByIdAndUpdate(
        managerId,
        { $addToSet: { stallIds: stall._id } }
      );
    }

    // Populate the response
    const populatedStall = await Stall.findById(stall._id)
      .populate('managerId', 'name email phone');

    console.log(`✅ New stall created by admin ${req.user.email}: ${stall.name} (${stall.stallNumber})`);

    res.status(201).json({
      success: true,
      message: "Stall created successfully",
      data: populatedStall
    });
  } catch (error) {
    console.error('Error creating stall:', error);
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
      const errorMessage = `A stall with this ${duplicateField} already exists`;
      return next(createHttpError(409, errorMessage));
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return next(createHttpError(400, validationErrors.join(', ')));
    }

    next(error);
  }
};

// Update stall
const updateStall = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stallNumber, name, location, managerId, terminalId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(400, "Invalid stall ID format");
      return next(error);
    }

    // Find existing stall
    const existingStall = await Stall.findById(id);
    if (!existingStall) {
      const error = createHttpError(404, "Stall not found");
      return next(error);
    }

    // Check if stall number is being changed and if it conflicts
    if (stallNumber && stallNumber.toUpperCase().trim() !== existingStall.stallNumber) {
      const conflictingStall = await Stall.findOne({ 
        stallNumber: stallNumber.toUpperCase().trim(),
        _id: { $ne: id }
      });
      
      if (conflictingStall) {
        const error = createHttpError(409, "A stall with this number already exists");
        return next(error);
      }
    }

    // Validate manager if provided
    if (managerId && managerId !== existingStall.managerId?.toString()) {
      if (!mongoose.Types.ObjectId.isValid(managerId)) {
        const error = createHttpError(400, "Invalid manager ID format");
        return next(error);
      }

      const manager = await StallManager.findById(managerId);
      if (!manager || !manager.isActive) {
        const error = createHttpError(404, "Manager not found or inactive");
        return next(error);
      }
    }

    // Prepare update data
    const updateData = {};
    if (stallNumber && stallNumber.trim()) updateData.stallNumber = stallNumber.toUpperCase().trim();
    if (name && name.trim()) updateData.name = name.trim();
    if (location !== undefined) updateData.location = location ? location.trim() : "";

    // Handle manager assignment
    if (managerId !== undefined) {
      const oldManagerId = existingStall.managerId;
      updateData.managerId = managerId || null;

      // Remove stall from old manager's stallIds
      if (oldManagerId && oldManagerId.toString() !== managerId) {
        await StallManager.findByIdAndUpdate(
          oldManagerId,
          { $pull: { stallIds: id } }
        );
      }

      // Add stall to new manager's stallIds
      if (managerId && managerId !== oldManagerId?.toString()) {
        await StallManager.findByIdAndUpdate(
          managerId,
          { $addToSet: { stallIds: id } }
        );
      }
    }

    // Handle terminal assignment
    if (terminalId !== undefined) {
      updateData.terminalId = terminalId || null;
    }

    // Update stall
    const updatedStall = await Stall.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('managerId', 'name email phone');

    console.log(`✅ Stall updated by admin ${req.user.email}: ${updatedStall.name} (${updatedStall.stallNumber})`);

    res.status(200).json({
      success: true,
      message: "Stall updated successfully",
      data: updatedStall
    });
  } catch (error) {
    console.error('Error updating stall:', error);
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
      const errorMessage = `A stall with this ${duplicateField} already exists`;
      return next(createHttpError(409, errorMessage));
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return next(createHttpError(400, validationErrors.join(', ')));
    }

    next(error);
  }
};

// Delete stall (soft delete)
const deleteStall = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(400, "Invalid stall ID format");
      return next(error);
    }

    // Find and delete the stall
    const stall = await Stall.findByIdAndDelete(id);

    if (!stall) {
      const error = createHttpError(404, "Stall not found");
      return next(error);
    }

    // Remove stall from manager's stallIds if assigned
    if (stall.managerId) {
      await StallManager.findByIdAndUpdate(
        stall.managerId,
        { $pull: { stallIds: id } }
      );
    }

    console.log(`🗑️ Stall soft deleted by admin ${req.user.email}: ${stall.name} (${stall.stallNumber})`);

    res.status(200).json({
      success: true,
      message: "Stall deleted successfully",
      data: stall
    });
  } catch (error) {
    console.error('Error deleting stall:', error);
    next(error);
  }
};

module.exports = {
  getStalls,
  getStallById,
  createStall,
  updateStall,
  deleteStall
};
