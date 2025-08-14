const express = require("express");
const createHttpError = require("http-errors");
const {
  getStalls,
  getStallById,
  createStall,
  updateStall,
  deleteStall
} = require("../controllers/stallController");

// Import authentication middleware
const { isVerifiedUser } = require("../middlewares/tokenVerification");

// Admin authorization middleware
const requireAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      const error = createHttpError(401, "Authentication required");
      return next(error);
    }

    // Check if user has admin role (only regular users can be admins)
    if (req.userType !== 'user' || req.user.role !== 'Admin') {
      const error = createHttpError(403, "Admin access required. Only admin users can manage stalls.");
      return next(error);
    }

    next();
  } catch (error) {
    console.error('Admin authorization error:', error);
    const err = createHttpError(403, "Admin access required");
    next(err);
  }
};

// Validation middleware for stall input
const validateStallInput = (req, res, next) => {
  try {
    const { stallNumber, name } = req.body;
    const errors = [];

    // Validate stall number
    if (!stallNumber || !stallNumber.trim()) {
      errors.push("Stall number is required");
    } else if (!/^[A-Z0-9]{2,10}$/i.test(stallNumber.trim())) {
      errors.push("Stall number must be 2-10 characters, alphanumeric only");
    }

    // Validate name
    if (!name || !name.trim()) {
      errors.push("Stall name is required");
    } else if (name.trim().length > 100) {
      errors.push("Stall name cannot exceed 100 characters");
    }

    // Validate location if provided
    if (req.body.location && req.body.location.length > 200) {
      errors.push("Location cannot exceed 200 characters");
    }

    if (errors.length > 0) {
      const error = createHttpError(400, errors.join(', '));
      return next(error);
    }

    next();
  } catch (error) {
    console.error('Stall validation error:', error);
    const err = createHttpError(400, "Invalid stall data");
    next(err);
  }
};

const router = express.Router();

// Protected routes (admin only)

// GET /api/stalls - Get all stalls for current admin
router.get("/", isVerifiedUser, requireAdmin, getStalls);

// GET /api/stalls/:id - Get stall by ID
router.get("/:id", isVerifiedUser, requireAdmin, getStallById);

// POST /api/stalls - Create new stall (admin only)
router.post("/", isVerifiedUser, requireAdmin, validateStallInput, createStall);

// PUT /api/stalls/:id - Update stall (admin only)
router.put("/:id", isVerifiedUser, requireAdmin, validateStallInput, updateStall);

// DELETE /api/stalls/:id - Soft delete stall (admin only)
router.delete("/:id", isVerifiedUser, requireAdmin, deleteStall);

module.exports = router;
