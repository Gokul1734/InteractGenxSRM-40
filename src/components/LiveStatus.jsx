import React from 'react';
import { Radio, Users, Monitor, Square } from 'lucide-react';

function LiveStatus({ session, isSharing, selectedTab, onStopSharing }) {
  return (
    <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg p-6 text-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">LIVE</h2>
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            </div>
            <p className="text-green-100 text-sm">Session is active</p>
          </div>
        </div>
        {isSharing && (
          <button
            onClick={onStopSharing}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all transform hover:scale-105 shadow-lg"
          >
            <Square className="w-5 h-5" />
            Stop
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Session ID */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-5 h-5" />
            <span className="text-sm font-semibold text-green-100">Session ID</span>
          </div>
          <p className="text-lg font-bold truncate">{session.id}</p>
        </div>

        {/* Viewers */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5" />
            <span className="text-sm font-semibold text-green-100">Viewers</span>
          </div>
          <p className="text-lg font-bold">{session.viewers} connected</p>
        </div>

        {/* Current Tab */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Monitor className="w-5 h-5" />
            <span className="text-sm font-semibold text-green-100">Current Tab</span>
          </div>
          <p className="text-lg font-bold truncate">
            {isSharing && selectedTab ? selectedTab.title : 'Not sharing'}
          </p>
        </div>
      </div>

      {/* Sharing Status */}
      <div className="mt-6 p-4 bg-white/10 backdrop-blur-sm rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${isSharing ? 'bg-green-300 animate-pulse' : 'bg-gray-400'}`} />
            <span className="font-semibold">
              {isSharing ? '🎥 Sharing Active' : '⏸️ Not Sharing'}
            </span>
          </div>
          {isSharing && selectedTab && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-100">{selectedTab.favicon}</span>
              <span>{selectedTab.url}</span>
            </div>
          )}
        </div>
      </div>

      {!isSharing && (
        <div className="mt-4 p-3 bg-amber-500/20 backdrop-blur-sm rounded-lg border border-amber-300/30">
          <p className="text-sm">
            ⚠️ Session is active but not sharing. Select a tab and click "Start Sharing" to begin.
          </p>
        </div>
      )}
    </div>
  );
}

export default LiveStatus;
