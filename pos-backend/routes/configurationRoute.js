const express = require("express");
const router = express.Router();
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const {
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
  getTaxRate,
  updatePlatformFeeRate,
  getPlatformFeeRate
} = require("../controllers/configurationController");

// Terminal Verification
router.post("/terminals/verify", isVerifiedUser, verifyTerminal);

// Terminal CRUD Operations
router.post("/terminals", isVerifiedUser, addTerminal);
router.get("/terminals", isVerifiedUser, getTerminals);
router.get("/terminals/:terminalId", isVerifiedUser, getTerminal);
router.put("/terminals/:terminalId", isVerifiedUser, updateTerminal);
router.delete("/terminals/:terminalId", isVerifiedUser, deleteTerminal);

// Terminal Status Updates
router.patch("/terminals/:terminalId/status", isVerifiedUser, updateTerminalStatus);

// Terminal Assignment to Stalls
router.put("/terminals/:terminalId/assign", isVerifiedUser, assignTerminalToStall);
router.put("/terminals/:terminalId/unassign", isVerifiedUser, unassignTerminalFromStall);
router.get("/terminals/assignments", isVerifiedUser, getTerminalAssignments);

// Tax Configuration Routes
router.put("/tax-rate", isVerifiedUser, updateTaxRate);
router.get("/tax-rate", isVerifiedUser, getTaxRate);

// Platform Fee Configuration Routes
router.put("/platform-fee-rate", isVerifiedUser, updatePlatformFeeRate);
router.get("/platform-fee-rate", isVerifiedUser, getPlatformFeeRate);

module.exports = router;
