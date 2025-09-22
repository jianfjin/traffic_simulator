import React, { useState, useCallback, useEffect } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { Dashboard } from './components/Dashboard';
import { SimulationCanvas } from './components/SimulationCanvas';
import { useSimulation } from './hooks/useSimulation';
import type { SimulationSettings } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { SummaryReport } from './components/SummaryReport';

const App: React.FC = () => {
  const [settings, setSettings] = useState<SimulationSettings>(DEFAULT_SETTINGS);
  const { simulationState, controls } = useSimulation(settings);

  const handleSettingsChange = useCallback((newSettings: Partial<SimulationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);
  
  const handleReset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <div className="flex flex-col h-screen font-sans bg-gray-900 text-gray-100">
      <header className="p-4 bg-gray-800 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-center text-cyan-400">School Traffic Simulator</h1>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-1/4 min-w-[320px] max-w-[400px] bg-gray-800 p-4 overflow-y-auto shadow-lg">
          <ControlPanel 
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onTogglePlayPause={controls.togglePlayPause}
            onReset={handleReset}
            isPlaying={simulationState.isPlaying}
          />
        </aside>
        <main className="flex-1 flex flex-col p-4 overflow-hidden">
          <Dashboard metrics={simulationState.metrics} />
          <div className="flex-1 mt-4 relative rounded-lg overflow-hidden bg-gray-700 border border-gray-600">
             <SimulationCanvas 
                cars={simulationState.cars} 
                trafficFlow={simulationState.metrics.trafficFlow}
                parkingSpots={simulationState.parkingSpots}
                parkingCapacity={settings.parkingCapacity}
             />
             {simulationState.isFinished && (
                <SummaryReport stats={simulationState.summaryStats} onClose={handleReset} />
             )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;