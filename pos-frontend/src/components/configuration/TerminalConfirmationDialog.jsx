import React from "react";
import { FaTerminal, FaSpinner, FaCheck, FaTimes, FaInfoCircle } from "react-icons/fa";

const TerminalConfirmationDialog = ({ terminalData, onConfirm, onCancel, loading }) => {
  if (!terminalData) return null;

  const handleConfirm = () => {
    onConfirm(terminalData);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'online':
        return 'text-green-600 bg-green-100';
      case 'offline':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <FaTerminal className="text-blue-600 mr-3 text-xl" />
            <h3 className="text-lg font-semibold text-gray-900">
              Confirm Terminal Addition
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <div className="flex items-center mb-2">
              <FaInfoCircle className="text-blue-500 mr-2" />
              <span className="text-sm text-gray-600">
                Please review the terminal details before adding
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Terminal ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Terminal ID
              </label>
              <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                {terminalData.terminalId}
              </div>
            </div>

            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Label
              </label>
              <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                {terminalData.label || "No label set"}
              </div>
            </div>

            {/* Device Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Device Type
              </label>
              <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded capitalize">
                {terminalData.deviceType || "Unknown"}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <div className="flex items-center">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(terminalData.status)}`}>
                  {terminalData.status || "Unknown"}
                </span>
              </div>
            </div>

            {/* Serial Number */}
            {terminalData.serialNumber && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Serial Number
                </label>
                <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                  {terminalData.serialNumber}
                </div>
              </div>
            )}

            {/* IP Address */}
            {terminalData.ipAddress && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IP Address
                </label>
                <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                  {terminalData.ipAddress}
                </div>
              </div>
            )}

            {/* Last Seen */}
            {terminalData.lastSeen && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Seen
                </label>
                <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                  {formatDate(terminalData.lastSeen)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Adding...
              </>
            ) : (
              <>
                <FaCheck className="mr-2" />
                Add Terminal
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TerminalConfirmationDialog;
