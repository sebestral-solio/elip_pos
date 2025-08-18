import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updatePlatformFeeRateAsync, fetchPlatformFeeRate, clearError } from "../../redux/slices/configSlice";
import { enqueueSnackbar } from "notistack";
import { FaPercent, FaSave, FaUndo, FaSpinner, FaDollarSign } from "react-icons/fa";

const PlatformFeeConfiguration = () => {
  const dispatch = useDispatch();
  const {
    platformFeeRate: currentPlatformFeeRate,
    isAdmin,
    canModify,
    loading,
    error,
    lastUpdated
  } = useSelector((state) => state.config);

  const [platformFeeRate, setPlatformFeeRateLocal] = useState(currentPlatformFeeRate);
  const [isEditing, setIsEditing] = useState(false);

  // Fetch platform fee rate on component mount
  useEffect(() => {
    dispatch(fetchPlatformFeeRate());
  }, [dispatch]);

  // Sync local state with Redux state changes
  useEffect(() => {
    setPlatformFeeRateLocal(currentPlatformFeeRate);
  }, [currentPlatformFeeRate]);

  // Handle errors
  useEffect(() => {
    if (error) {
      enqueueSnackbar(error, { variant: "error" });
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setPlatformFeeRateLocal(currentPlatformFeeRate);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const numericRate = parseFloat(platformFeeRate);
    
    if (isNaN(numericRate) || numericRate < 0 || numericRate > 100) {
      enqueueSnackbar("Platform fee rate must be a number between 0 and 100", { variant: "error" });
      return;
    }

    try {
      await dispatch(updatePlatformFeeRateAsync(numericRate)).unwrap();
      enqueueSnackbar("Platform fee rate updated successfully!", { variant: "success" });
      setIsEditing(false);
    } catch (error) {
      // Error is handled by the useEffect above
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-green-100 p-3 rounded-lg">
          <FaDollarSign className="text-green-600 text-xl" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-gray-800">Platform Fee Configuration</h3>
          <p className="text-gray-600">Configure platform fee rates for admin reporting</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <FaSpinner className="animate-spin text-green-600 text-2xl mr-2" />
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
                You can view the current platform fee rate but cannot modify it. Only admin users can change platform fee configuration.
              </p>
            </div>
          )}

          {/* Current Platform Fee Rate Display */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-800">Current Platform Fee Rate</h4>
                <p className="text-2xl font-bold text-green-600">{currentPlatformFeeRate}%</p>
                <p className="text-sm text-gray-500">Used for admin reporting only</p>
                {lastUpdated && (
                  <p className="text-xs text-gray-400 mt-1">
                    Last updated: {new Date(lastUpdated).toLocaleString()}
                  </p>
                )}
              </div>
              {!isEditing && canModify && (
                <button
                  onClick={handleEdit}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  disabled={loading}
                >
                  Edit Rate
                </button>
              )}
            </div>
          </div>

          {/* Edit Platform Fee Rate Form */}
          {isEditing && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Platform Fee Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={platformFeeRate}
                    onChange={(e) => setPlatformFeeRateLocal(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter platform fee rate"
                    min="0"
                    max="100"
                    step="0.01"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <FaPercent className="text-gray-400" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter a value between 0 and 100 (e.g., 2.5 for 2.5%)
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <FaSave />
                  {loading ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex items-center gap-2 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <FaUndo />
                  Cancel
                </button>
              </div>
            </div>
            </div>
          )}

        {/* Platform Fee Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">Platform Fee Usage</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• Platform fee is used for admin reporting and analytics only</p>
            <p>• Does not affect customer payments or order totals</p>
            <p>• Used to calculate net revenue in the orders table</p>
            <p>• Net Revenue = Order Total - (Order Total × Platform Fee Rate ÷ 100)</p>
            <p>• Example: $100 order × {currentPlatformFeeRate}% = ${((100 * currentPlatformFeeRate) / 100).toFixed(2)} platform fee</p>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

export default PlatformFeeConfiguration;
