import React, { useState, useEffect } from "react";
import { enqueueSnackbar } from "notistack";
import {
  getStallManagers,
  createStallManager,
  updateStallManager,
  deleteStallManager
} from "../../https";
import {
  FaUser,
  FaPlus,
  FaEdit,
  FaTrash,
  FaSave,
  FaTimes,
  FaSpinner,
  FaEye,
  FaEyeSlash,
  FaEnvelope,
  FaPhone,
  FaStore
} from "react-icons/fa";
import StallTerminalManagement from "./StallTerminalManagement";

const StallManagerManagement = () => {
  const [stallManagers, setStallManagers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingManager, setEditingManager] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showStallManagement, setShowStallManagement] = useState(false);
  const [selectedManagerForStalls, setSelectedManagerForStalls] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: ""
  });

  // Fetch stall managers on component mount
  useEffect(() => {
    fetchStallManagers();
  }, []);

  const fetchStallManagers = async () => {
    setLoading(true);
    try {
      const response = await getStallManagers();
      setStallManagers(response.data.data || []);
    } catch (error) {
      console.error("Error fetching stall managers:", error);
      enqueueSnackbar("Failed to fetch stall managers", { variant: "error" });
      // Set empty array as fallback
      setStallManagers([]);
    } finally {
      setLoading(false);
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
    if (!formData.name.trim()) {
      enqueueSnackbar("Name is required", { variant: "error" });
      return false;
    }
    if (!formData.email.trim()) {
      enqueueSnackbar("Email is required", { variant: "error" });
      return false;
    }
    if (!editingManager && !formData.password.trim()) {
      enqueueSnackbar("Password is required for new managers", { variant: "error" });
      return false;
    }
    if (formData.password && formData.password.length < 6) {
      enqueueSnackbar("Password must be at least 6 characters", { variant: "error" });
      return false;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      enqueueSnackbar("Please enter a valid email address", { variant: "error" });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      if (editingManager) {
        await updateStallManager({
          managerId: editingManager._id,
          ...formData
        });
        enqueueSnackbar("Stall manager updated successfully", { variant: "success" });
      } else {
        await createStallManager(formData);
        enqueueSnackbar("Stall manager created successfully", { variant: "success" });
      }

      resetForm();
      fetchStallManagers();
    } catch (error) {
      console.error("Error saving stall manager:", error);
      enqueueSnackbar(
        editingManager ? "Failed to update stall manager" : "Failed to create stall manager",
        { variant: "error" }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (manager) => {
    setEditingManager(manager);
    setFormData({
      name: manager.name,
      email: manager.email,
      phone: manager.phone || "",
      password: ""
    });
    setShowAddForm(true);
  };

  const handleDelete = async (managerId) => {
    if (!window.confirm("Are you sure you want to delete this stall manager?")) {
      return;
    }

    setLoading(true);
    try {
      await deleteStallManager(managerId);
      enqueueSnackbar("Stall manager deleted successfully", { variant: "success" });
      fetchStallManagers();
    } catch (error) {
      console.error("Error deleting stall manager:", error);
      enqueueSnackbar("Failed to delete stall manager", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleManageStalls = (manager) => {
    setSelectedManagerForStalls(manager);
    setShowStallManagement(true);
  };

  const handleBackFromStallManagement = () => {
    setShowStallManagement(false);
    setSelectedManagerForStalls(null);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: ""
    });
    setShowAddForm(false);
    setEditingManager(null);
    setShowPassword(false);
  };

  // Show stall management interface if selected
  if (showStallManagement) {
    return (
      <StallTerminalManagement
        selectedManager={selectedManagerForStalls}
        onBack={handleBackFromStallManagement}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-3 rounded-lg">
            <FaUser className="text-green-600 text-xl" />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-800">Stall Manager Management</h4>
            <p className="text-gray-600">Create and manage stall managers</p>
          </div>
        </div>
        
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            disabled={loading}
          >
            <FaPlus size={14} />
            Add New Manager
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h5 className="text-lg font-medium text-gray-800">
              {editingManager ? "Edit Stall Manager" : "Add New Stall Manager"}
            </h5>
            <button
              onClick={resetForm}
              className="text-gray-500 hover:text-gray-700"
              disabled={loading}
            >
              <FaTimes size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Enter manager name"
                  required
                  disabled={loading}
                />
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter email address"
                    required
                    disabled={loading}
                  />
                  <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                </div>
              </div>

              {/* Phone Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone (Optional)
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter phone number"
                    disabled={loading}
                  />
                  <FaPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password {!editingManager && <span className="text-red-500">*</span>}
                  {editingManager && <span className="text-gray-500">(Leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder={editingManager ? "Enter new password" : "Enter password"}
                    required={!editingManager}
                    disabled={loading}
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Password must be at least 6 characters long
                </p>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <FaSpinner className="animate-spin" size={14} /> : <FaSave size={14} />}
                {loading ? 'Saving...' : (editingManager ? 'Update Manager' : 'Create Manager')}
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

      {/* Stall Managers List */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h5 className="text-lg font-medium text-gray-800">
            Existing Stall Managers ({stallManagers.length})
          </h5>
        </div>

        {loading && !showAddForm ? (
          <div className="flex items-center justify-center py-8">
            <FaSpinner className="animate-spin text-green-600 text-2xl mr-2" />
            <span className="text-gray-600">Loading stall managers...</span>
          </div>
        ) : stallManagers.length === 0 ? (
          <div className="text-center py-8">
            <FaUser className="mx-auto text-gray-400 text-4xl mb-4" />
            <h6 className="text-lg font-medium text-gray-600 mb-2">No Stall Managers</h6>
            <p className="text-gray-500 mb-4">Get started by adding your first stall manager</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Add First Manager
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {stallManagers.map((manager) => (
              <div key={manager._id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-full">
                        <FaUser className="text-green-600" size={16} />
                      </div>
                      <div>
                        <h6 className="font-medium text-gray-800">{manager.name}</h6>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <FaEnvelope size={12} />
                            {manager.email}
                          </span>
                          {manager.phone && (
                            <span className="flex items-center gap-1">
                              <FaPhone size={12} />
                              {manager.phone}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          Created: {new Date(manager.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      manager.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {manager.isActive ? 'Active' : 'Inactive'}
                    </span>

                    <button
                      onClick={() => handleManageStalls(manager)}
                      className="flex items-center gap-1 px-3 py-1 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      disabled={loading}
                      title="Manage Stalls & Terminals"
                    >
                      <FaStore size={12} />
                      Manage Stalls & Terminals
                    </button>

                    <button
                      onClick={() => handleEdit(manager)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      disabled={loading}
                      title="Edit Manager"
                    >
                      <FaEdit size={14} />
                    </button>

                    <button
                      onClick={() => handleDelete(manager._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      disabled={loading}
                      title="Delete Manager"
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

export default StallManagerManagement;
