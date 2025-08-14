import React, { useState } from "react";
import { FaTerminal, FaSpinner, FaCheck } from "react-icons/fa";

const TerminalVerificationForm = ({ onVerify, loading }) => {
  const [terminalId, setTerminalId] = useState("");
  const [errors, setErrors] = useState({});

  const validateTerminalId = (id) => {
    if (!id.trim()) {
      return "Terminal ID is required";
    }
    if (!id.startsWith("tmr_")) {
      return "Terminal ID must start with 'tmr_'";
    }
    if (id.length < 10) {
      return "Terminal ID must be at least 10 characters";
    }
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form submitted with terminalId:", terminalId);
    
    const error = validateTerminalId(terminalId);
    if (error) {
      console.log("Validation error:", error);
      setErrors({ terminalId: error });
      return;
    }
    
    console.log("Validation passed, calling onVerify...");
    setErrors({});
    onVerify(terminalId);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setTerminalId(value);
    
    // Clear error when user starts typing
    if (errors.terminalId) {
      setErrors({});
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center mb-4">
        <FaTerminal className="text-blue-600 mr-3 text-xl" />
        <h3 className="text-lg font-semibold text-gray-800">
          Add New Terminal
        </h3>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="terminalId" className="block text-sm font-medium text-gray-700 mb-2">
            Terminal ID
          </label>
          <input
            type="text"
            id="terminalId"
            value={terminalId}
            onChange={handleInputChange}
            placeholder="tmr_FDOt2wlRZEdpd7"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.terminalId ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={loading}
          />
          {errors.terminalId && (
            <p className="mt-1 text-sm text-red-600">{errors.terminalId}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Enter the Stripe Terminal ID from your Stripe Dashboard
          </p>
        </div>
        
        <button
          type="submit"
          disabled={loading || !terminalId.trim()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading ? (
            <>
              <FaSpinner className="animate-spin mr-2" />
              Verifying Terminal...
            </>
          ) : (
            <>
              <FaCheck className="mr-2" />
              Verify Terminal
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default TerminalVerificationForm;
