import React from 'react';
import type { SimulationSettings } from '../types';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';

interface ControlPanelProps {
  settings: SimulationSettings;
  onSettingsChange: (newSettings: Partial<SimulationSettings>) => void;
  onTogglePlayPause: () => void;
  onReset: () => void;
  isPlaying: boolean;
}

const SliderControl: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  precision?: number;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, step, unit, precision, onChange }) => (
  <div className="mb-6">
    <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
    <div className="flex items-center space-x-4">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-thumb-cyan"
      />
      <span className="text-cyan-400 font-semibold w-20 text-right">{value.toFixed(precision ?? (unit ? 1 : 0))} {unit}</span>
    </div>
    <style>{`
        .range-thumb-cyan::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            background: #22d3ee;
            cursor: pointer;
            border-radius: 50%;
            border: 2px solid #fff;
        }
        .range-thumb-cyan::-moz-range-thumb {
            width: 20px;
            height: 20px;
            background: #22d3ee;
            cursor: pointer;
            border-radius: 50%;
            border: 2px solid #fff;
        }
    `}</style>
  </div>
);

export const ControlPanel: React.FC<ControlPanelProps> = ({
  settings,
  onSettingsChange,
  onTogglePlayPause,
  onReset,
  isPlaying,
}) => {
  return (
    <div className="p-4 bg-gray-800 rounded-lg h-full flex flex-col">
        <h2 className="text-xl font-bold mb-6 text-cyan-300 border-b border-gray-700 pb-2">Controls</h2>
        <SliderControl 
            label="Speed Multiplier"
            value={settings.speedMultiplier}
            min={1} max={20} step={1} unit="x"
            onChange={v => onSettingsChange({ speedMultiplier: v })}
        />
        <SliderControl 
            label="Spawn Rate (seconds/car)"
            value={settings.spawnRate}
            min={1} max={10} step={0.5} unit="s"
            onChange={v => onSettingsChange({ spawnRate: v })}
        />
        <SliderControl 
            label="Total Cars"
            value={settings.totalCars}
            min={50} max={2500} step={50}
            onChange={v => onSettingsChange({ totalCars: v })}
        />
        <SliderControl 
            label="Parking Capacity"
            value={settings.parkingCapacity}
            min={10} max={100} step={10}
            onChange={v => onSettingsChange({ parkingCapacity: v })}
        />
        <SliderControl 
            label="Parking Probability"
            value={settings.parkingProbability}
            min={0} max={1} step={0.1} precision={1}
            onChange={v => onSettingsChange({ parkingProbability: v })}
        />
        <SliderControl 
            label="P3 Batch Size (In/Out)"
            value={settings.p3BatchSize}
            min={1} max={20} step={1}
            onChange={v => onSettingsChange({ p3BatchSize: v })}
        />
        <SliderControl 
            label="P4 Yield Time"
            value={settings.p4YieldTime}
            min={1} max={10} step={0.5} unit="s"
            onChange={v => onSettingsChange({ p4YieldTime: v })}
        />

        <div className="mt-auto pt-6 flex space-x-4">
            <button
                onClick={onTogglePlayPause}
                className="flex-1 py-3 px-4 bg-cyan-600 hover:bg-cyan-500 rounded-md font-semibold text-white transition-all duration-200 flex items-center justify-center space-x-2"
            >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
            <button
                onClick={onReset}
                className="flex-1 py-3 px-4 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold text-white transition-all duration-200"
            >
                Reset
            </button>
        </div>
    </div>
  );
};