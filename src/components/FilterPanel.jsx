import React from 'react';
import { WasteType } from '../utils/types';

const FilterPanel = ({ isOpen, onClose, filters, updateFilters, applyFilters }) => {
  if (!isOpen) return null;

  const handleFilterChange = (key, value) => {
    updateFilters({ [key]: value });
    applyFilters();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-4 w-11/12 max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Filter Requests</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Waste Type Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Waste Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleFilterChange('wasteType', 'all')}
              className={\`px-4 py-2 rounded-md text-sm \${
                filters.wasteType === 'all'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }\`}
            >
              All Types
            </button>
            {Object.values(WasteType).map(type => (
              <button
                key={type}
                onClick={() => handleFilterChange('wasteType', type)}
                className={\`px-4 py-2 rounded-md text-sm \${
                  filters.wasteType === type
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }\`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Distance Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Maximum Distance (km): {filters.maxDistance}
          </label>
          <input
            type="range"
            min="1"
            max="20"
            value={filters.maxDistance}
            onChange={(e) => handleFilterChange('maxDistance', parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>1km</span>
            <span>20km</span>
          </div>
        </div>

        {/* Payment Type Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Type</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleFilterChange('payment', 'all')}
              className={\`px-4 py-2 rounded-md text-sm \${
                filters.payment === 'all'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }\`}
            >
              All
            </button>
            <button
              onClick={() => handleFilterChange('payment', 'cash')}
              className={\`px-4 py-2 rounded-md text-sm \${
                filters.payment === 'cash'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }\`}
            >
              Cash
            </button>
            <button
              onClick={() => handleFilterChange('payment', 'mobile')}
              className={\`px-4 py-2 rounded-md text-sm \${
                filters.payment === 'mobile'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }\`}
            >
              Mobile
            </button>
          </div>
        </div>

        {/* Priority Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleFilterChange('priority', 'all')}
              className={\`px-4 py-2 rounded-md text-sm \${
                filters.priority === 'all'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }\`}
            >
              All
            </button>
            <button
              onClick={() => handleFilterChange('priority', 'high')}
              className={\`px-4 py-2 rounded-md text-sm \${
                filters.priority === 'high'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }\`}
            >
              High
            </button>
            <button
              onClick={() => handleFilterChange('priority', 'normal')}
              className={\`px-4 py-2 rounded-md text-sm \${
                filters.priority === 'normal'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }\`}
            >
              Normal
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-green-500 text-white py-2 rounded-md hover:bg-green-600 transition-colors"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;
