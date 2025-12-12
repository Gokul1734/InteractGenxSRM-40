import React from 'react';
import { Activity, MousePointer, Eye, Navigation, FileCode, Lock, CheckCircle } from 'lucide-react';

function TrackedActions() {
  const trackedActions = [
    { icon: <Eye className="w-5 h-5" />, label: 'Scroll Tracking', enabled: true },
    { icon: <MousePointer className="w-5 h-5" />, label: 'Mouse Movement', enabled: true },
    { icon: <Activity className="w-5 h-5" />, label: 'Click Indicators', enabled: true },
    { icon: <Navigation className="w-5 h-5" />, label: 'Navigation Tracking', enabled: true },
    { icon: <FileCode className="w-5 h-5" />, label: 'DOM Snapshot Updates', enabled: true },
  ];

  const viewerRestrictions = [
    { icon: '❌', label: 'Viewer cannot scroll' },
    { icon: '❌', label: 'Viewer cannot click' },
    { icon: '❌', label: 'Viewer cannot type' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-2 rounded-lg">
          <Activity className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Tracked Actions</h2>
          <p className="text-gray-600 text-sm">What actions are monitored</p>
        </div>
      </div>

      {/* Tracked Actions */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Active Tracking</h3>
        <div className="space-y-2">
          {trackedActions.map((action, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="text-green-600">{action.icon}</div>
                <span className="text-sm font-medium text-gray-800">{action.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <Lock className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Viewer Permissions */}
      <div className="mb-4">
        <h3 className="font-semibold text-gray-800 mb-3">Viewer Permissions</h3>
        <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-5 h-5 text-red-600" />
            <span className="font-semibold text-red-800">Read-Only Mode</span>
          </div>
          <div className="space-y-2">
            {viewerRestrictions.map((restriction, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-lg">{restriction.icon}</span>
                <span className="text-sm text-gray-700">{restriction.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 bg-indigo-50 rounded-lg">
        <p className="text-sm text-indigo-800">
          <strong>View-Only:</strong> Viewers can see everything you do in real-time but cannot interact with the page.
        </p>
      </div>
    </div>
  );
}

export default TrackedActions;
