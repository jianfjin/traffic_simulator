import React from 'react';
import type { SimulationSettings, HumanControls } from '../types';
import { HumanP3TrafficAction, HumanP3DecisionAction } from '../types';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';

interface ControlPanelProps {
  settings: SimulationSettings;
  onSettingsChange: (newSettings: Partial<SimulationSettings>) => void;
  onTogglePlayPause: () => void;
  onReset: () => void;
  isPlaying: boolean;
  humanControls: HumanControls;
  onHumanControlsChange: (newControls: HumanControls) => void;
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

const HumanModeControls: React.FC<{
    humanControls: HumanControls;
    onHumanControlsChange: (newControls: HumanControls) => void;
}> = ({ humanControls, onHumanControlsChange }) => {
    
    const handleTrafficClick = (action: HumanP3TrafficAction) => {
        onHumanControlsChange({ ...humanControls, p3Traffic: action });
    };

    const handleDecisionClick = (action: HumanP3DecisionAction) => {
        onHumanControlsChange({ ...humanControls, p3Decision: action });
    };

    return (
        <div className="mt-4 p-4 border border-cyan-500 rounded-lg">
            <h3 className="text-lg font-bold mb-4 text-cyan-300">P3 Intersection Control</h3>
            <div className="space-y-3">
                <button
                    onClick={() => handleTrafficClick(HumanP3TrafficAction.ALLOW_OUT)}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 rounded-md font-semibold text-white transition-all duration-200"
                >
                    Allow Campus Exit
                </button>
                <button
                    onClick={() => handleTrafficClick(HumanP3TrafficAction.ALLOW_IN)}
                    className="w-full py-2 px-4 bg-green-600 hover:bg-green-500 rounded-md font-semibold text-white transition-all duration-200"
                >
                    Allow Campus Entry
                </button>
            </div>
             <h3 className="text-lg font-bold mt-6 mb-4 text-cyan-300">P3 Decision Logic</h3>
             <div className="space-y-3">
                <button
                    onClick={() => handleDecisionClick(HumanP3DecisionAction.DIVERT_ALL_TO_DROPOFF)}
                    className={`w-full py-2 px-4 rounded-md font-semibold text-white transition-all duration-200 ${humanControls.p3Decision === HumanP3DecisionAction.DIVERT_ALL_TO_DROPOFF ? 'bg-orange-500 ring-2 ring-white' : 'bg-orange-700 hover:bg-orange-600'}`}
                >
                    Divert All to P3 Drop-off
                </button>
                 <button
                    onClick={() => handleDecisionClick(HumanP3DecisionAction.USE_PARKING_PROBABILITY)}
                    className={`w-full py-2 px-4 rounded-md font-semibold text-white transition-all duration-200 ${humanControls.p3Decision === HumanP3DecisionAction.USE_PARKING_PROBABILITY ? 'bg-purple-500 ring-2 ring-white' : 'bg-purple-700 hover:bg-purple-600'}`}
                >
                    Use Parking Probability
                </button>
            </div>
        </div>
    );
};


export const ControlPanel: React.FC<ControlPanelProps> = ({
  settings,
  onSettingsChange,
  onTogglePlayPause,
  onReset,
  isPlaying,
  humanControls,
  onHumanControlsChange
}) => {
  const actionButtons = (
    <div className="flex space-x-4">
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
  );

  return (
    <div className="p-4 bg-gray-800 rounded-lg h-full flex flex-col">
        <h2 className="text-xl font-bold mb-6 text-cyan-300 border-b border-gray-700 pb-2">Controls</h2>
        
        <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Mode</label>
            <div className="flex bg-gray-700 rounded-md p-1">
                <button
                    onClick={() => onSettingsChange({ mode: 'auto' })}
                    className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${settings.mode === 'auto' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}
                >
                    Auto
                </button>
                <button
                    onClick={() => onSettingsChange({ mode: 'human' })}
                    className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${settings.mode === 'human' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}
                >
                    Human
                </button>
            </div>
        </div>

        <div className="flex-grow overflow-y-auto pr-2 min-h-0">
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
                min={50} max={500} step={50}
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
            
            {settings.mode === 'auto' && (
                <SliderControl 
                    label="P3 Batch Size (In/Out)"
                    value={settings.p3BatchSize}
                    min={1} max={20} step={1}
                    onChange={v => onSettingsChange({ p3BatchSize: v })}
                />
            )}
            
            <SliderControl 
                label="P4 Yield Time"
                value={settings.p4YieldTime}
                min={1} max={10} step={0.5} unit="s"
                onChange={v => onSettingsChange({ p4YieldTime: v })}
            />

            {settings.mode === 'human' && (
            <>
                <div className="my-6">
                    {actionButtons}
                </div>
                <HumanModeControls humanControls={humanControls} onHumanControlsChange={onHumanControlsChange} />
            </>
            )}
        </div>

        {settings.mode === 'auto' && (
            <div className="mt-auto pt-6">
                {actionButtons}
            </div>
        )}
    </div>
  );
};