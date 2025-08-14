const express = require("express");
const createHttpError = require("http-errors");
const {
  getStallManagers,
  getStallManagerById,
  createStallManager,
  updateStallManager,
  deleteStallManager,
  getStallManagersByAdmin,
  assignStallToManager,
  stallManagerLogin
} = require("../controllers/stallManagerController");

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
      const error = createHttpError(403, "Admin access required. Only admin users can manage stall managers.");
      return next(error);
    }

    next();
  } catch (error) {
    console.error('Admin authorization error:', error);
    const err = createHttpError(403, "Admin access required");
    next(err);
  }
};

// Input validation middleware
const validateStallManagerInput = (req, res, next) => {
  const { name, email, password } = req.body;
  const errors = [];

  // Validate name
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push("Name is required and must be a non-empty string");
  } else if (name.trim().length > 100) {
    errors.push("Name cannot exceed 100 characters");
  }

  // Validate email
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    errors.push("Email is required");
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.push("Please provide a valid email address");
    }
  }

  // Validate password (only for POST requests - creating new managers)
  if (req.method === 'POST') {
    if (!password || typeof password !== 'string' || password.length === 0) {
      errors.push("Password is required for new stall managers");
    } else if (password.length < 6) {
      errors.push("Password must be at least 6 characters long");
    }
  }

  // Validate phone if provided
  if (req.body.phone && req.body.phone.trim() !== '') {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(req.body.phone.trim())) {
      errors.push("Please provide a valid phone number");
    }
  }

  if (errors.length > 0) {
    const error = createHttpError(400, `Validation failed: ${errors.join(', ')}`);
    return next(error);
  }

  next();
};

const router = express.Router();

// Public routes (no authentication required)

// POST /api/stall-managers/login - Stall manager login
router.post("/login", stallManagerLogin);

// Protected routes (with authentication)

// GET /api/stall-managers - Get all active stall managers
router.get("/", isVerifiedUser, requireAdmin, getStallManagers);

// GET /api/stall-managers/admin - Get stall managers created by current admin
router.get("/admin", isVerifiedUser, requireAdmin, getStallManagersByAdmin);

// GET /api/stall-managers/:id - Get stall manager by ID
router.get("/:id", isVerifiedUser, requireAdmin, getStallManagerById);

// POST /api/stall-managers - Create new stall manager (admin only)
router.post("/", isVerifiedUser, requireAdmin, validateStallManagerInput, createStallManager);

// PUT /api/stall-managers/:id - Update stall manager (admin only)
router.put("/:id", isVerifiedUser, requireAdmin, validateStallManagerInput, updateStallManager);

// DELETE /api/stall-managers/:id - Soft delete stall manager (admin only)
router.delete("/:id", isVerifiedUser, requireAdmin, deleteStallManager);

// POST /api/stall-managers/:managerId/assign-stall - Assign stall to manager (admin only)
router.post("/:managerId/assign-stall", isVerifiedUser, requireAdmin, assignStallToManager);

module.exports = router;
