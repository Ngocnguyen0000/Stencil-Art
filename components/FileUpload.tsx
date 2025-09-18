
import React, { useState, useCallback } from 'react';
import { UploadCloudIcon } from './Icons';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  acceptedTypes?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, acceptedTypes = '.svg,.png,.jpg,.jpeg' }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  }, [onFileUpload]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg transition-colors duration-200 ${
          isDragging ? 'border-indigo-400 bg-gray-800' : 'border-gray-600 hover:border-gray-500'
        }`}
      >
        <UploadCloudIcon className={`w-16 h-16 mb-4 transition-transform duration-200 ${isDragging ? 'scale-110 text-indigo-400' : 'text-gray-500'}`} />
        <p className="mb-2 text-lg text-gray-400">
          <span className="font-semibold text-indigo-400">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-gray-500">SVG, PNG, JPG or JPEG</p>
        <input
          type="file"
          id="file-upload"
          className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileChange}
          accept={acceptedTypes}
        />
      </div>
    </div>
  );
};
