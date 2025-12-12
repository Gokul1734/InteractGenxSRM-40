import React from 'react';
import { Globe, CheckCircle, AlertTriangle } from 'lucide-react';

function SupportedSites() {
  const supportedSites = [
    { icon: '✔️', text: 'Standard websites (http://, https://)', supported: true },
    { icon: '✔️', text: 'Dynamic web applications', supported: true },
    { icon: '✔️', text: 'Sites allowing content-script injection', supported: true },
  ];

  const unsupportedSites = [
    { icon: '⚠️', text: 'Chrome Web Store', supported: false },
    { icon: '⚠️', text: 'chrome:// pages', supported: false },
    { icon: '⚠️', text: 'Browser settings pages', supported: false },
    { icon: '⚠️', text: 'Some protected banking sites', supported: false },
    { icon: '⚠️', text: 'Incognito mode (unless enabled)', supported: false },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white p-2 rounded-lg">
          <Globe className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Site Compatibility</h2>
          <p className="text-gray-600 text-sm">What sites are supported</p>
        </div>
      </div>

      {/* Supported Sites */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <h3 className="font-semibold text-gray-800">Supported</h3>
        </div>
        <div className="space-y-2">
          {supportedSites.map((site, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
              <span className="text-xl">{site.icon}</span>
              <p className="text-sm text-gray-700 flex-1">{site.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Unsupported Sites */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-gray-800">Not Supported</h3>
        </div>
        <div className="space-y-2">
          {unsupportedSites.map((site, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
              <span className="text-xl">{site.icon}</span>
              <p className="text-sm text-gray-700 flex-1">{site.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> For best results, share standard web pages and applications that allow browser extensions.
        </p>
      </div>
    </div>
  );
}

export default SupportedSites;
