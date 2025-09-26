import React from 'react';
import type { SimulationMetrics, SummaryStats } from '../types';

interface SummaryReportProps {
  metrics: SimulationMetrics;
  summaryStats: SummaryStats;
  onClose: () => void;
}

const StatItem: React.FC<{ label: string; value: string | number | null }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-2 border-b border-gray-600">
    <span className="text-gray-400">{label}</span>
    <span className="font-semibold text-cyan-300">{value ?? 'N/A'}</span>
  </div>
);

export const SummaryReport: React.FC<SummaryReportProps> = ({ metrics, summaryStats, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-lg border border-cyan-500 transform animate-fade-in-up">
        <h2 className="text-3xl font-bold mb-6 text-center text-cyan-400">Simulation Complete</h2>
        
        <div className="space-y-3 mb-8">
          <StatItem label="Total Simulation Time" value={metrics.simulationTime} />
          <StatItem label="Total Cars Spawned" value={metrics.spawnedCars} />
          <StatItem label="Total Cars Exited" value={metrics.exitedCars} />
          <StatItem label="Parking Capacity" value={metrics.totalParkingSpots} />
          <StatItem label="First Time Parking Was Full" value={summaryStats.firstParkingFullTime} />
          <StatItem label="First Congestion Detected" value={summaryStats.firstCongestionTime} />
          <StatItem label="Last Congestion Detected" value={summaryStats.lastCongestionTime} />
          <StatItem label="Total Congestion Time" value={summaryStats.totalCongestionTime} />
        </div>
        
        <button
          onClick={onClose}
          className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-500 rounded-md font-semibold text-white transition-all duration-200"
        >
          Run New Simulation
        </button>
      </div>
      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};