import React, { useState, useCallback, useEffect } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { Dashboard } from './components/Dashboard';
import { SimulationCanvas } from './components/SimulationCanvas';
import { useSimulationManager } from './hooks/useSimulationManager';
import type { SimulationSettings, HumanControls } from './types';
import { HumanP3DecisionAction } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { SummaryReport } from './components/SummaryReport';

const App: React.FC = () => {
  const [settings, setSettings] = useState<SimulationSettings>(DEFAULT_SETTINGS);
  const [humanControls, setHumanControls] = useState<HumanControls>({
      p3Traffic: null,
      p3Decision: HumanP3DecisionAction.USE_PARKING_PROBABILITY,
  });
  const [resetKey, setResetKey] = useState(0);

  const { simulationState, controls } = useSimulationManager(settings, humanControls, resetKey);

  const handleSettingsChange = useCallback((newSettings: Partial<SimulationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);
  
  const handleReset = useCallback(() => {
    setResetKey(k => k + 1);
    setSettings(DEFAULT_SETTINGS);
    setHumanControls({
        p3Traffic: null,
        p3Decision: HumanP3DecisionAction.USE_PARKING_PROBABILITY,
    });
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
            humanControls={humanControls}
            onHumanControlsChange={setHumanControls}
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