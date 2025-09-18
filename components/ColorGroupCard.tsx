import React from 'react';
import type { SVGColorGroup, RasterColorGroup } from '../types';
import { rgbToHex } from '../utils/colorUtils';
import { DownloadIcon, SvgFileIcon, PngFileIcon, XIcon, EditIcon } from './Icons';

interface ColorGroupCardProps {
  group: SVGColorGroup | RasterColorGroup;
  isSvgSource: boolean;
  previewDataUrl?: string; // Generated preview from parent
  onDownload: (format: 'svg' | 'png') => void;
  onDelete: () => void;
  onEdit: () => void;
  isSelected: boolean;
  onSelect: () => void;
}

export const ColorGroupCard: React.FC<ColorGroupCardProps> = ({ group, isSvgSource, previewDataUrl, onDownload, onDelete, onEdit, isSelected, onSelect }) => {
  const hexColor = rgbToHex(group.representativeColor);

  const renderPreview = () => {
    if (previewDataUrl) {
      return <img src={previewDataUrl} alt="Color group preview" className="w-full h-full object-contain" />;
    } else {
        // For raster, generating previews on the fly is expensive. Show color swatch instead.
        return <div className="w-full h-full" style={{ backgroundColor: hexColor }}></div>;
    }
  };

  return (
    <div className={`relative bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-lg transition-all hover:border-indigo-500 group ${isSelected ? 'ring-2 ring-indigo-400' : ''}`}>
       <div className="absolute top-2 left-2 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          onClick={(e) => e.stopPropagation()}
          className="h-5 w-5 rounded bg-gray-900/50 border-gray-600 text-indigo-500 focus:ring-indigo-600 cursor-pointer"
          aria-label="Select layer for merging"
        />
      </div>
      <div className="absolute top-2 right-2 z-10 flex space-x-1">
        {isSvgSource && (
           <button 
             onClick={onEdit}
             className="p-1 bg-gray-900/50 rounded-full text-gray-400 hover:bg-blue-500 hover:text-white transition-all scale-0 group-hover:scale-100"
             aria-label="Edit SVG"
           >
             <EditIcon className="w-4 h-4" />
           </button>
        )}
        <button 
          onClick={onDelete}
          className="p-1 bg-gray-900/50 rounded-full text-gray-400 hover:bg-red-500 hover:text-white transition-all scale-0 group-hover:scale-100"
          aria-label="Delete layer"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="w-full h-32 bg-gray-900/50 flex items-center justify-center p-2 border-b border-gray-700">
        {renderPreview()}
      </div>
      <div className="p-4">
        <div className="flex items-center mb-3">
          <div className="w-8 h-8 rounded-full border-2 border-gray-600" style={{ backgroundColor: hexColor }}></div>
          <div className="ml-3 font-mono text-lg text-gray-300">{hexColor}</div>
        </div>
        <div className="flex space-x-2">
          {isSvgSource && (
            <button
              onClick={() => onDownload('svg')}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-center text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-indigo-300"
            >
              <SvgFileIcon className="w-4 h-4 mr-2" />
              SVG
            </button>
          )}
          <button
            onClick={() => onDownload('png')}
            className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-center text-white bg-teal-600 rounded-lg hover:bg-teal-700 focus:ring-4 focus:outline-none focus:ring-teal-300"
          >
            <PngFileIcon className="w-4 h-4 mr-2" />
            PNG
          </button>
        </div>
      </div>
    </div>
  );
};