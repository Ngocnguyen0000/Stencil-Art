import React, { useState, useEffect, useMemo } from 'react';
import { XIcon } from './Icons';

interface SvgEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newSvgContent: string) => void;
  initialSvgContent: string;
}

export const SvgEditModal: React.FC<SvgEditModalProps> = ({ isOpen, onClose, onSave, initialSvgContent }) => {
  const [svgCode, setSvgCode] = useState(initialSvgContent);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSvgCode(initialSvgContent);
  }, [initialSvgContent]);
  
  const dataUrl = useMemo(() => {
    try {
      const sanitized = svgCode.trim();
      // Basic validation
      if (!sanitized.startsWith('<svg') || !sanitized.endsWith('</svg>')) {
         throw new Error("Invalid SVG structure.");
      }
      const encoded = btoa(sanitized);
      setError(null);
      return `data:image/svg+xml;base64,${encoded}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid SVG code.");
      return "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="; // Transparent pixel
    }
  }, [svgCode]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    if (!error) {
      onSave(svgCode);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 transition-opacity"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl h-[90vh] bg-gray-800 rounded-lg shadow-xl text-white transform transition-all flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <h3 id="modal-title" className="text-xl font-semibold">
            Live SVG Editor
          </h3>
          <button
            type="button"
            className="text-gray-400 bg-transparent hover:bg-gray-600 hover:text-white rounded-lg text-sm p-1.5 ml-auto inline-flex items-center"
            onClick={onClose}
            aria-label="Close modal"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow min-h-0">
            <div className="flex flex-col h-full">
                <label htmlFor="svg-code-editor" className="mb-2 text-sm font-medium text-gray-300">SVG Code</label>
                <textarea
                    id="svg-code-editor"
                    value={svgCode}
                    onChange={(e) => setSvgCode(e.target.value)}
                    className="flex-grow w-full p-2 font-mono text-sm bg-gray-900 border border-gray-600 rounded-md resize-none focus:ring-indigo-500 focus:border-indigo-500"
                    spellCheck="false"
                />
            </div>
            <div className="flex flex-col h-full">
                <label className="mb-2 text-sm font-medium text-gray-300">Live Preview</label>
                <div className="flex-grow w-full flex items-center justify-center bg-gray-900/50 p-2 border border-gray-600 rounded-md bg-[url('data:image/svg+xml,%3csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2032%2032%22%20width=%2232%22%22height=%2232%22%20fill=%22none%22%3e%3cpath%20d=%22M0%200h16v16H0zM16%2016h16v16H16z%22%20fill=%22%23475569%22/%3e%3c/svg%3e')] bg-repeat">
                   {error ? (
                     <div className="text-center text-red-400 p-4">
                       <p><strong>Preview Error:</strong></p>
                       <p>{error}</p>
                     </div>
                   ) : (
                     <img src={dataUrl} alt="Live SVG preview" className="max-w-full max-h-full object-contain" />
                   )}
                </div>
            </div>
        </div>
         <div className="flex items-center justify-end p-4 border-t border-gray-700 flex-shrink-0 space-x-2">
            {error && <p className="text-sm text-red-400 mr-auto">Cannot save due to invalid SVG code.</p>}
            <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600"
                onClick={onClose}
            >
                Cancel
            </button>
            <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
                onClick={handleSave}
                disabled={!!error}
            >
                Save Changes
            </button>
        </div>
      </div>
    </div>
  );
};
