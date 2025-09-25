import React, { useState, useCallback, useEffect } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { Dashboard } from './components/Dashboard';
import { SimulationCanvas } from './components/SimulationCanvas';
import { SummaryReport } from './components/SummaryReport';
import { DEFAULT_SETTINGS } from './constants';
import { useSimulationManager } from './hooks/useSimulationManager';
import type { SimulationSettings, HumanControls } from './types';
import { HumanP3DecisionAction } from './types';

const DESIGN_WIDTH = 1440;
const DESIGN_HEIGHT = 810;

function App() {
  const [settings, setSettings] = useState<SimulationSettings>(DEFAULT_SETTINGS);
  const [humanControls, setHumanControls] = useState<HumanControls>({
    p3Traffic: null,
    p3Decision: HumanP3DecisionAction.USE_PARKING_PROBABILITY,
  });
  const [scale, setScale] = useState(1);

  const { simulationState, controls } = useSimulationManager(settings, humanControls);

  useEffect(() => {
    const handleResize = () => {
      const scale = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
      setScale(scale);
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial scale
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSettingsChange = useCallback((newSettings: Partial<SimulationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const handleReset = useCallback(() => {
    // Resetting settings will trigger the simulation manager to reset via its useEffect hook
    setSettings({ ...DEFAULT_SETTINGS }); 
    setHumanControls({
        p3Traffic: null,
        p3Decision: HumanP3DecisionAction.USE_PARKING_PROBABILITY,
    });
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div 
            style={{
                width: DESIGN_WIDTH,
                height: DESIGN_HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: 'center',
            }}
        >
            <div className="text-white min-h-screen font-sans flex flex-col p-4 gap-4" style={{height: DESIGN_HEIGHT}}>
                <header className="flex-shrink-0">
                    <h1 className="text-3xl font-bold text-cyan-400 text-center">Traffic Simulation</h1>
                </header>
                <main className="flex-grow flex gap-4" style={{ height: 'calc(100% - 60px)' }}>
                    <div className="w-1/4 h-full overflow-y-auto">
                    <ControlPanel 
                        settings={settings}
                        onSettingsChange={handleSettingsChange}
                        onTogglePlayPause={controls.togglePlayPause}
                        onReset={handleReset}
                        isPlaying={simulationState.isPlaying}
                        humanControls={humanControls}
                        onHumanControlsChange={setHumanControls}
                    />
                    </div>
                    <div className="w-3/4 h-full flex flex-col gap-4">
                    <Dashboard metrics={simulationState.metrics} />
                    <div className="flex-grow relative">
                        <SimulationCanvas 
                            cars={simulationState.cars}
                            trafficFlow={simulationState.metrics.trafficFlow}
                            parkingSpots={simulationState.parkingSpots}
                            parkingCapacity={settings.parkingCapacity}
                        />
                    </div>
                    </div>
                </main>
                {simulationState.isFinished && (
                    <SummaryReport 
                        metrics={simulationState.metrics}
                        summaryStats={simulationState.summaryStats}
                        onClose={handleReset} 
                    />
                )}
            </div>
        </div>
    </div>
  );
}

export default App;