
import React from 'react';

export const Loader: React.FC<{ message?: string }> = ({ message = 'Processing image...' }) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-indigo-400"></div>
      <p className="text-lg text-gray-300">{message}</p>
    </div>
  );
};
