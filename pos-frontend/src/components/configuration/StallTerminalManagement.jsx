import React, { useState, useEffect } from "react";
import { enqueueSnackbar } from "notistack";
import {
  getStalls,
  createStall,
  updateStall,
  deleteStall,
  getStallManagers,
  getTerminals
} from "../../https";
import {
  FaStore,
  FaPlus,
  FaEdit,
  FaTrash,
  FaSave,
  FaTimes,
  FaSpinner,
  FaArrowLeft,
  FaTerminal,
  FaMapMarkerAlt,
  FaUser
} from "react-icons/fa";

const StallTerminalManagement = ({ selectedManager, onBack }) => {
  const [stalls, setStalls] = useState([]);
  const [stallManagers, setStallManagers] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStall, setEditingStall] = useState(null);
  
  const [formData, setFormData] = useState({
    stallNumber: "",
    name: "",
    location: "",
    managerId: selectedManager?._id || "",
    terminalId: ""
  });

  // Fetch data on component mount
  useEffect(() => {
    fetchStalls();
    fetchStallManagers();
    fetchTerminals();
  }, []);

  // Set selected manager in form when component loads
  useEffect(() => {
    if (selectedManager) {
      setFormData(prev => ({
        ...prev,
        managerId: selectedManager._id
      }));
    }
  }, [selectedManager]);

  const fetchStalls = async () => {
    setLoading(true);
    try {
      const response = await getStalls();
      setStalls(response.data.data || []);
    } catch (error) {
      console.error("Error fetching stalls:", error);
      enqueueSnackbar("Failed to fetch stalls", { variant: "error" });
      setStalls([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStallManagers = async () => {
    try {
      const response = await getStallManagers();
      setStallManagers(response.data.data || []);
    } catch (error) {
      console.error("Error fetching stall managers:", error);
      setStallManagers([]);
    }
  };

  const fetchTerminals = async () => {
    try {
      const response = await getTerminals();
      setTerminals(response.data.data || []);
    } catch (error) {
      console.error("Error fetching terminals:", error);
      setTerminals([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    const errors = [];

    if (!formData.stallNumber.trim()) {
      errors.push("Stall number is required");
    } else if (!/^[A-Z0-9]{2,10}$/i.test(formData.stallNumber.trim())) {
      errors.push("Stall number must be 2-10 characters, alphanumeric only");
    }

    if (!formData.name.trim()) {
      errors.push("Stall name is required");
    }

    if (errors.length > 0) {
      enqueueSnackbar(errors.join(", "), { variant: "error" });
      return false;
    }

    return true;
  };

  const resetForm = () => {
    setFormData({
      stallNumber: "",
      name: "",
      location: "",
      managerId: selectedManager?._id || "",
      terminalId: ""
    });
    setShowAddForm(false);
    setEditingStall(null);
  };

  const handleEdit = (stall) => {
    setFormData({
      stallNumber: stall.stallNumber,
      name: stall.name,
      location: stall.location || "",
      managerId: stall.managerId?._id || "",
      terminalId: stall.terminalId || ""
    });
    setEditingStall(stall);
    setShowAddForm(true);
  };

  const handleDelete = async (stallId) => {
    if (!window.confirm("Are you sure you want to delete this stall?")) {
      return;
    }

    setLoading(true);
    try {
      await deleteStall(stallId);
      enqueueSnackbar("Stall deleted successfully", { variant: "success" });
      fetchStalls();
    } catch (error) {
      console.error("Error deleting stall:", error);
      enqueueSnackbar("Failed to delete stall", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      if (editingStall) {
        await updateStall({
          stallId: editingStall._id,
          ...formData
        });
        enqueueSnackbar("Stall updated successfully", { variant: "success" });
      } else {
        await createStall(formData);
        enqueueSnackbar("Stall created successfully", { variant: "success" });
      }

      resetForm();
      fetchStalls();
    } catch (error) {
      console.error("Error saving stall:", error);
      enqueueSnackbar(
        editingStall ? "Failed to update stall" : "Failed to create stall",
        { variant: "error" }
      );
    } finally {
      setLoading(false);
    }
  };

  const getManagerName = (managerId) => {
    const manager = stallManagers.find(m => m._id === managerId);
    return manager ? manager.name : "Unassigned";
  };

  // Get available terminals (not assigned to any stall)
  const getAvailableTerminals = () => {
    // Get all terminal IDs that are currently assigned to stalls
    const assignedTerminalIds = stalls
      .filter(stall => stall.terminalId)
      .map(stall => stall.terminalId);
    
    // Filter out terminals that are already assigned
    return terminals.filter(terminal => 
      !assignedTerminalIds.includes(terminal._id)
    );
  };

  // Get terminal label for display
  const getTerminalLabel = (terminalId) => {
    const terminal = terminals.find(t => t._id === terminalId);
    return terminal ? (terminal.label || terminal.terminalId) : terminalId;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <FaArrowLeft size={16} />
            Back to Stall Managers
          </button>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          disabled={loading}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FaPlus size={14} />
          Add New Stall
        </button>
      </div>

      {/* Page Title */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          Stall & Terminal Management
        </h3>
        {selectedManager && (
          <p className="text-gray-600">
            Managing stalls for: <span className="font-medium text-green-600">{selectedManager.name}</span>
          </p>
        )}
      </div>

      {/* Add/Edit Stall Form */}
      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-800 mb-4">
            {editingStall ? 'Edit Stall' : 'Create New Stall'}
          </h4>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Stall Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stall Number *
                </label>
                <input
                  type="text"
                  name="stallNumber"
                  value={formData.stallNumber}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., A01, B12"
                  required
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  2-10 characters, alphanumeric only
                </p>
              </div>

              {/* Stall Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stall Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Enter stall name"
                  required
                  disabled={loading}
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location/Description
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., Ground Floor, Near Entrance"
                  disabled={loading}
                />
              </div>

              {/* Manager Assignment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign Manager
                </label>
                <select
                  name="managerId"
                  value={formData.managerId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  disabled={loading}
                >
                  <option value="">Select a manager</option>
                  {stallManagers.map((manager) => (
                    <option key={manager._id} value={manager._id}>
                      {manager.name} ({manager.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Terminal ID */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Terminal ID
                </label>
                <select
                  name="terminalId"
                  value={formData.terminalId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  disabled={loading}
                >
                  <option value="">Select a terminal (optional)</option>
                  {getAvailableTerminals().map((terminal) => (
                    <option key={terminal._id} value={terminal._id}>
                      {terminal.label || terminal.terminalId} 
                      {terminal.deviceType && ` (${terminal.deviceType})`}
                      {terminal.status && ` - ${terminal.status}`}
                    </option>
                  ))}
                  {editingStall && formData.terminalId && !getAvailableTerminals().find(t => t._id === formData.terminalId) && (
                    <option value={formData.terminalId}>
                      {getTerminalLabel(formData.terminalId)} (Currently assigned)
                    </option>
                  )}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Link an available payment terminal to this stall. Only unassigned terminals are shown.
                </p>
                {getAvailableTerminals().length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No available terminals found. All terminals are currently assigned to other stalls.
                  </p>
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <FaSpinner className="animate-spin" size={14} /> : <FaSave size={14} />}
                {loading ? 'Saving...' : (editingStall ? 'Update Stall' : 'Create Stall')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                className="flex items-center gap-2 bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaTimes size={14} />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stalls List */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h5 className="text-lg font-medium text-gray-800">
            Existing Stalls ({stalls.length})
          </h5>
        </div>

        {loading && !showAddForm ? (
          <div className="flex items-center justify-center py-8">
            <FaSpinner className="animate-spin text-green-600 text-2xl mr-2" />
            <span className="text-gray-600">Loading stalls...</span>
          </div>
        ) : stalls.length === 0 ? (
          <div className="text-center py-8">
            <FaStore className="mx-auto text-gray-400 text-4xl mb-4" />
            <h6 className="text-lg font-medium text-gray-600 mb-2">No Stalls</h6>
            <p className="text-gray-500 mb-4">Get started by adding your first stall</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Add First Stall
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {stalls.map((stall) => (
              <div key={stall._id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-full">
                        <FaStore className="text-green-600" size={16} />
                      </div>
                      <div>
                        <h6 className="font-medium text-gray-800">
                          {stall.name} ({stall.stallNumber})
                        </h6>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          {stall.location && (
                            <span className="flex items-center gap-1">
                              <FaMapMarkerAlt size={12} />
                              {stall.location}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <FaUser size={12} />
                            {getManagerName(stall.managerId?._id)}
                          </span>
                          {stall.terminalId && (
                            <span className="flex items-center gap-1">
                              <FaTerminal size={12} />
                              Terminal: {getTerminalLabel(stall.terminalId)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          Created: {new Date(stall.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      stall.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {stall.isActive ? 'Active' : 'Inactive'}
                    </span> */}
                    
                    <button
                      onClick={() => handleEdit(stall)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      disabled={loading}
                      title="Edit Stall"
                    >
                      <FaEdit size={14} />
                    </button>
                    
                    <button
                      onClick={() => handleDelete(stall._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      disabled={loading}
                      title="Delete Stall"
                    >
                      <FaTrash size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StallTerminalManagement;
