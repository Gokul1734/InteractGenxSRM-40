import React from 'react';
import { Monitor, CheckCircle, AlertTriangle } from 'lucide-react';

function ShareableTabs({ tabs, selectedTab, onTabSelect }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white p-2 rounded-lg">
          <Monitor className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Available Tabs</h2>
          <p className="text-gray-600 text-sm">What tabs can be shared</p>
        </div>
      </div>

      <div className="space-y-3">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => tab.shareable && onTabSelect(tab)}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedTab?.id === tab.id
                ? 'border-blue-500 bg-blue-50'
                : tab.shareable
                ? 'border-gray-200 hover:border-gray-300 cursor-pointer'
                : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Favicon */}
              <div className="text-2xl">{tab.favicon}</div>

              {/* Tab Info */}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-800 truncate">{tab.title}</h4>
                <p className="text-sm text-gray-600 truncate">{tab.url}</p>
              </div>

              {/* Status Badge */}
              <div className="flex-shrink-0">
                {tab.shareable ? (
                  <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                    <CheckCircle className="w-4 h-4" />
                    Shareable
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                    <AlertTriangle className="w-4 h-4" />
                    Restricted
                  </div>
                )}
              </div>
            </div>

            {selectedTab?.id === tab.id && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <span className="text-sm text-blue-600 font-semibold">
                  ✓ Currently selected
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-purple-50 rounded-lg">
        <p className="text-sm text-purple-800">
          <strong>Note:</strong> Only one tab can be shared at a time. Switch tabs anytime during an active session.
        </p>
      </div>
    </div>
  );
}

export default ShareableTabs;
