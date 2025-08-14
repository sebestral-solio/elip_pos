import React, { useState, useEffect } from "react";
import { enqueueSnackbar } from "notistack";
import {
  verifyTerminal,
  addTerminal,
  getTerminals,
  getStalls,
  assignTerminalToStall,
  unassignTerminalFromStall,
  deleteTerminal,
  updateTerminal
} from "../../https";
import TerminalVerificationForm from "./TerminalVerificationForm";
import TerminalConfirmationDialog from "./TerminalConfirmationDialog";
import TerminalsList from "./TerminalsList";
import { FaArrowLeft, FaSpinner } from "react-icons/fa";

const TerminalAssignment = ({ onBack }) => {
  const [terminals, setTerminals] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [verifyingTerminal, setVerifyingTerminal] = useState(false);
  const [addingTerminal, setAddingTerminal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [terminalToAdd, setTerminalToAdd] = useState(null);

  // Fetch initial data
  useEffect(() => {
    fetchTerminals();
    fetchStalls();
  }, []);

  const fetchTerminals = async () => {
    try {
      setLoading(true);
      const response = await getTerminals();
      if (response.data.success) {
        setTerminals(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching terminals:", error);
      enqueueSnackbar("Failed to fetch terminals", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchStalls = async () => {
    try {
      const response = await getStalls();
      if (response.data.success) {
        setStalls(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching stalls:", error);
      enqueueSnackbar("Failed to fetch stalls", { variant: "error" });
    }
  };

  // Step 1: Verify Terminal
  const handleVerifyTerminal = async (terminalId) => {
    console.log("handleVerifyTerminal called with:", terminalId);
    try {
      setVerifyingTerminal(true);
      console.log("Making API call to verify terminal...");
      const response = await verifyTerminal({ terminalId });
      console.log("API response received:", response);
      
      if (response.data.success) {
        // Show confirmation dialog with terminal details
        setTerminalToAdd(response.data.data);
        enqueueSnackbar("Terminal verified successfully", { variant: "success" });
      } else {
        console.log("API returned success: false");
        enqueueSnackbar(response.data.message || "Terminal verification failed", { variant: "error" });
      }
    } catch (error) {
      console.error("Error verifying terminal:", error);
      const errorMessage = error.response?.data?.message || "Failed to verify terminal";
      enqueueSnackbar(errorMessage, { variant: "error" });
    } finally {
      setVerifyingTerminal(false);
    }
  };

  // Step 2: Add Terminal
  const handleAddTerminal = async (terminalData) => {
    try {
      setAddingTerminal(true);
      const response = await addTerminal({ terminalData });
      
      if (response.data.success) {
        setTerminalToAdd(null);
        await fetchTerminals(); // Refresh list
        enqueueSnackbar("Terminal added successfully", { variant: "success" });
      }
    } catch (error) {
      console.error("Error adding terminal:", error);
      const errorMessage = error.response?.data?.message || "Failed to add terminal";
      enqueueSnackbar(errorMessage, { variant: "error" });
    } finally {
      setAddingTerminal(false);
    }
  };

  // Step 3: Assign to Stall
  const handleAssignToStall = async (terminalId, stallId) => {
    try {
      const response = await assignTerminalToStall(terminalId, { stallId });
      
      if (response.data.success) {
        await fetchTerminals(); // Refresh list
        enqueueSnackbar("Terminal assigned to stall successfully", { variant: "success" });
      }
    } catch (error) {
      console.error("Error assigning terminal:", error);
      const errorMessage = error.response?.data?.message || "Failed to assign terminal";
      enqueueSnackbar(errorMessage, { variant: "error" });
    }
  };

  const handleUnassignFromStall = async (terminalId) => {
    try {
      const response = await unassignTerminalFromStall(terminalId);
      
      if (response.data.success) {
        await fetchTerminals(); // Refresh list
        enqueueSnackbar("Terminal unassigned successfully", { variant: "success" });
      }
    } catch (error) {
      console.error("Error unassigning terminal:", error);
      const errorMessage = error.response?.data?.message || "Failed to unassign terminal";
      enqueueSnackbar(errorMessage, { variant: "error" });
    }
  };

  const handleDeleteTerminal = async (terminalId) => {
    try {
      const response = await deleteTerminal(terminalId);
      
      if (response.data.success) {
        await fetchTerminals(); // Refresh list
        enqueueSnackbar("Terminal deleted successfully", { variant: "success" });
      }
    } catch (error) {
      console.error("Error deleting terminal:", error);
      const errorMessage = error.response?.data?.message || "Failed to delete terminal";
      enqueueSnackbar(errorMessage, { variant: "error" });
    }
  };

  const handleUpdateTerminal = async (terminalId, updateData) => {
    try {
      const response = await updateTerminal({ terminalId, ...updateData });
      
      if (response.data.success) {
        await fetchTerminals(); // Refresh list
        return response;
      }
    } catch (error) {
      console.error("Error updating terminal:", error);
      const errorMessage = error.response?.data?.message || "Failed to update terminal";
      throw new Error(errorMessage);
    }
  };

  const handleCancelVerification = () => {
    setTerminalToAdd(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {onBack && (
            <button
              onClick={onBack}
              className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FaArrowLeft />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold text-gray-900">Terminal Management</h2>
            <p className="text-gray-600 mt-1">
              Manage Stripe terminals and assign them to stalls
            </p>
          </div>
        </div>
        
        <div className="text-sm text-gray-500">
          {terminals.length} terminal{terminals.length !== 1 ? 's' : ''} configured
        </div>
      </div>

      {/* Terminal Verification Form */}
      <TerminalVerificationForm 
        onVerify={handleVerifyTerminal}
        loading={verifyingTerminal}
      />

      {/* Existing Terminals List */}
      <TerminalsList 
        terminals={terminals}
        stalls={stalls}
        onAssign={handleAssignToStall}
        onUnassign={handleUnassignFromStall}
        onDelete={handleDeleteTerminal}
        onUpdate={handleUpdateTerminal}
        loading={loading}
      />

      {/* Terminal Confirmation Dialog */}
      <TerminalConfirmationDialog
        terminalData={terminalToAdd}
        onConfirm={handleAddTerminal}
        onCancel={handleCancelVerification}
        loading={addingTerminal}
      />
    </div>
  );
};

export default TerminalAssignment;
