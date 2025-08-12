import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateTaxRateAsync, fetchTaxRate, clearError } from "../../redux/slices/configSlice";
import { enqueueSnackbar } from "notistack";
import { FaPercent, FaSave, FaUndo, FaSpinner } from "react-icons/fa";

const TaxConfiguration = () => {
  const dispatch = useDispatch();
  const {
    taxRate: currentTaxRate,
    isAdmin,
    canModify,
    loading,
    error,
    lastUpdated
  } = useSelector((state) => state.config);

  const [taxRate, setTaxRateLocal] = useState(currentTaxRate);
  const [isEditing, setIsEditing] = useState(false);

  // Fetch tax rate on component mount
  useEffect(() => {
    dispatch(fetchTaxRate());
  }, [dispatch]);

  // Sync local state with Redux state changes
  useEffect(() => {
    setTaxRateLocal(currentTaxRate);
  }, [currentTaxRate]);

  // Handle errors
  useEffect(() => {
    if (error) {
      enqueueSnackbar(error, { variant: "error" });
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleSave = async () => {
    // Validate tax rate
    const rate = parseFloat(taxRate);

    if (isNaN(rate)) {
      enqueueSnackbar("Please enter a valid tax rate", { variant: "error" });
      return;
    }

    if (rate < 0) {
      enqueueSnackbar("Tax rate cannot be negative", { variant: "error" });
      return;
    }

    if (rate > 100) {
      enqueueSnackbar("Tax rate cannot exceed 100%", { variant: "error" });
      return;
    }

    // Check if user can modify (admin only)
    if (!canModify) {
      enqueueSnackbar("Only admin users can modify tax rates", { variant: "error" });
      return;
    }

    try {
      // Update via backend API
      await dispatch(updateTaxRateAsync(rate)).unwrap();
      setIsEditing(false);
      enqueueSnackbar(`Tax rate updated to ${rate}%`, { variant: "success" });
    } catch (error) {
      // Error is handled by the useEffect above
      console.error('Failed to update tax rate:', error);
    }
  };

  const handleCancel = () => {
    setTaxRateLocal(currentTaxRate);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 p-3 rounded-lg">
          <FaPercent className="text-blue-600 text-xl" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-gray-800">Tax Configuration</h3>
          <p className="text-gray-600">Configure tax rates</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <FaSpinner className="animate-spin text-blue-600 text-2xl mr-2" />
          <span className="text-gray-600">Loading configuration...</span>
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* Admin Access Notice */}
          {!canModify && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2">View Only Access</h4>
              <p className="text-sm text-yellow-700">
                You can view the current tax rate but cannot modify it. Only admin users can change tax configuration.
              </p>
            </div>
          )}

          {/* Current Tax Rate Display */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-800">Current Tax Rate</h4>
                <p className="text-2xl font-bold text-blue-600">{currentTaxRate}%</p>
                <p className="text-sm text-gray-500">Applied to all orders</p>
                {lastUpdated && (
                  <p className="text-xs text-gray-400 mt-1">
                    Last updated: {new Date(lastUpdated).toLocaleString()}
                  </p>
                )}
              </div>
              {!isEditing && canModify && (
                <button
                  onClick={handleEdit}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  disabled={loading}
                >
                  Edit Rate
                </button>
              )}
            </div>
          </div>

        {/* Tax Rate Editor */}
        {isEditing && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-4">Update Tax Rate</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRateLocal(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter tax rate"
                    min="0"
                    max="100"
                    step="0.01"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <FaPercent className="text-gray-400" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter a value between 0 and 100 (e.g., 5.25 for 5.25%)
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <FaSpinner className="animate-spin" size={14} /> : <FaSave size={14} />}
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex items-center gap-2 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaUndo size={14} />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tax Rate Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">How Tax Calculation Works</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• Tax is calculated as: (Order Total × Tax Rate) ÷ 100</p>
            <p>• Example: $100 order × {currentTaxRate}% = ${((100 * currentTaxRate) / 100).toFixed(2)} tax</p>
            <p>• Final total: $100 + ${((100 * currentTaxRate) / 100).toFixed(2)} = ${(100 + (100 * currentTaxRate) / 100).toFixed(2)}</p>
            <p>• Changes apply immediately to all new orders</p>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

export default TaxConfiguration;
