import React, { useState } from "react";
import { FaTerminal, FaEdit, FaTrash, FaStore, FaTimes, FaCheck, FaSpinner, FaQuestionCircle } from "react-icons/fa";
import { enqueueSnackbar } from "notistack";

const TerminalsList = ({ terminals, stalls, onDelete, onUpdate, loading }) => {
  const [editingTerminal, setEditingTerminal] = useState(null);
  const [editLabel, setEditLabel] = useState("");

  const handleEditStart = (terminal) => {
    setEditingTerminal(terminal.terminalId);
    setEditLabel(terminal.label || "");
  };

  const handleEditSave = async (terminalId) => {
    try {
      await onUpdate(terminalId, { label: editLabel });
      setEditingTerminal(null);
      setEditLabel("");
      enqueueSnackbar("Terminal updated successfully", { variant: "success" });
    } catch (error) {
      enqueueSnackbar("Failed to update terminal", { variant: "error" });
    }
  };

  const handleEditCancel = () => {
    setEditingTerminal(null);
    setEditLabel("");
  };



  const handleDelete = async (terminalId) => {
    if (window.confirm("Are you sure you want to delete this terminal? This action cannot be undone.")) {
      try {
        await onDelete(terminalId);
      } catch (error) {
        enqueueSnackbar("Failed to delete terminal", { variant: "error" });
      }
    }
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

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const getAssignedStall = (terminal) => {
    if (!terminal._id) return null;
    return stalls.find(stall => stall.terminalId === terminal._id);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <FaSpinner className="animate-spin text-2xl text-gray-400 mr-3" />
          <span className="text-gray-600">Loading terminals...</span>
        </div>
      </div>
    );
  }

  if (terminals.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <FaTerminal className="text-4xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Terminals Found</h3>
          <p className="text-gray-600">Add your first terminal using the form above.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-6 border-b">
        <h3 className="text-lg font-semibold text-gray-800">Configured Terminals</h3>
        <p className="text-sm text-gray-600 mt-1">Manage your Stripe terminals and stall assignments</p>
      </div>

      <div className="divide-y divide-gray-200">
        {terminals.map((terminal) => {
          const assignedStall = getAssignedStall(terminal);
          const isEditing = editingTerminal === terminal.terminalId;

          return (
            <div key={terminal.terminalId} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <FaTerminal className="text-blue-600 mr-2" />
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Terminal label"
                          />
                          <button
                            onClick={() => handleEditSave(terminal.terminalId)}
                            className="p-1 text-green-600 hover:text-green-800"
                          >
                            <FaCheck />
                          </button>
                          <button
                            onClick={handleEditCancel}
                            className="p-1 text-red-600 hover:text-red-800"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <h4 className="text-lg font-medium text-gray-900">
                            {terminal.label || "Unnamed Terminal"}
                          </h4>
                          <button
                            onClick={() => handleEditStart(terminal)}
                            className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                          >
                            <FaEdit className="text-sm" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Terminal ID:</span>
                      <span className="ml-2 text-gray-600 font-mono">{terminal.terminalId}</span>
                    </div>
                    
                    <div>
                      <span className="font-medium text-gray-700">Status:</span>
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(terminal.status)}`}>
                        {terminal.status || "Unknown"}
                      </span>
                    </div>

                    <div>
                      <span className="font-medium text-gray-700">Device Type:</span>
                      <span className="ml-2 text-gray-600 capitalize">{terminal.deviceType || "Unknown"}</span>
                    </div>

                    <div>
                      <span className="font-medium text-gray-700">Last Updated:</span>
                      <span className="ml-2 text-gray-600">{formatDate(terminal.updatedAt)}</span>
                    </div>

                    {terminal.serialNumber && (
                      <div>
                        <span className="font-medium text-gray-700">Serial:</span>
                        <span className="ml-2 text-gray-600 font-mono">{terminal.serialNumber}</span>
                      </div>
                    )}

                    {terminal.ipAddress && (
                      <div>
                        <span className="font-medium text-gray-700">IP Address:</span>
                        <span className="ml-2 text-gray-600 font-mono">{terminal.ipAddress}</span>
                      </div>
                    )}
                  </div>

                  {/* Stall Assignment Section */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FaStore className="text-gray-500 mr-2" />
                        <span className="font-medium text-gray-700">Stall Assignment:</span>
                      </div>
                      
                      {assignedStall ? (
                        <div className="flex items-center bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                          <FaStore className="text-green-600 mr-2" />
                          <span className="text-sm font-medium text-green-800">
                            {assignedStall.name}
                            {assignedStall.stallNumber && ` (${assignedStall.stallNumber})`}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">Not assigned to stall</span>
                          <div className="relative group">
                            <div className="flex items-center cursor-help">
                              <FaQuestionCircle className="text-gray-500 text-lg" />
                            </div>
                            {/* Tooltip */}
                            <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
                              <div className="font-medium mb-2">Terminal not assigned to any stall</div>
                              <div className="text-gray-300">
                                <div className="mb-1">To assign this terminal:</div>
                                <div className="ml-2">
                                  <div>• Go to Stall Management</div>
                                  <div>• Create or edit a stall</div>
                                  <div>• Assign this terminal during stall setup</div>
                                </div>
                              </div>
                              {/* Arrow */}
                              <div className="absolute top-0 right-4 transform -translate-y-1 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-800"></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="ml-4 flex flex-col space-y-2">
                  <button
                    onClick={() => handleDelete(terminal.terminalId)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete terminal"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TerminalsList;
