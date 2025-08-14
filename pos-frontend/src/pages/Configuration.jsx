import React, { useEffect, useState } from "react";
import BottomNav from "../components/shared/BottomNav";
import TaxConfiguration from "../components/configuration/TaxConfiguration";
import StallManagerManagement from "../components/configuration/StallManagerManagement";
import TerminalAssignment from "../components/configuration/TerminalAssignment";
import { FaCog, FaPercent, FaDollarSign, FaStore, FaDesktop } from "react-icons/fa";

const Configuration = () => {
  useEffect(() => {
    document.title = "POS | Configuration";
  }, []);

  const [activeSection, setActiveSection] = useState("tax");

  const configSections = [
    { 
      id: "tax", 
      label: "Tax Configuration", 
      icon: <FaPercent />,
      description: "Configure tax rates"
    },
    { 
      id: "platform", 
      label: "Platform Fee", 
      icon: <FaDollarSign />,
      description: "Set platform fee percentages"
    },
    { 
      id: "stalls", 
      label: "Stall Management", 
      icon: <FaStore />,
      description: "Create stall IDs and assign stall numbers"
    },
    { 
      id: "terminals", 
      label: "Terminal Assignment", 
      icon: <FaDesktop />,
      description: "Assign terminals to stalls"
    }
  ];

  const renderSectionContent = () => {
    switch (activeSection) {
      case "tax":
        return <TaxConfiguration />;
      case "platform":
        return (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Platform Fee Settings</h3>
            <p className="text-gray-600">Platform fee configuration will be implemented here.</p>
          </div>
        );
      case "stalls":
        return (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">Stall Management</h3>
            <StallManagerManagement />
          </div>
        );
      case "terminals":
        return (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">Terminal Assignment</h3>
            <TerminalAssignment />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section className="bg-gray-50 h-[calc(100vh-5rem)] overflow-hidden">
      <div className="container mx-auto px-6 py-6 h-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-red-600 p-3 rounded-lg">
            <FaCog className="text-white text-2xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Configuration</h1>
            <p className="text-gray-600">Manage system settings and configurations</p>
          </div>
        </div>

        <div className="flex gap-6 h-[calc(100%-120px)]">
          {/* Left Sidebar - Configuration Sections */}
          <div className="w-80 bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Configuration Sections</h2>
            <div className="space-y-2">
              {configSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left p-4 rounded-lg transition-colors ${
                    activeSection === section.id
                      ? "bg-red-50 border-l-4 border-red-600 text-red-700"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded ${
                      activeSection === section.id ? "bg-red-100" : "bg-gray-100"
                    }`}>
                      {section.icon}
                    </div>
                    <div>
                      <div className="font-medium">{section.label}</div>
                      <div className="text-sm text-gray-500">{section.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1">
            {renderSectionContent()}
          </div>
        </div>
      </div>
      
      <BottomNav />
    </section>
  );
};

export default Configuration;
