
import React from 'react';

interface ToleranceSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export const ToleranceSlider: React.FC<ToleranceSliderProps> = ({ value, onChange, disabled }) => {
  return (
    <div className="w-full">
      <label htmlFor="tolerance" className="block mb-2 text-sm font-medium text-gray-300">
        Color Similarity Tolerance: <span className="font-bold text-indigo-400">{value}</span>
      </label>
      <input
        id="tolerance"
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
      />
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>Precise</span>
        <span>Similar</span>
      </div>
    </div>
  );
};
