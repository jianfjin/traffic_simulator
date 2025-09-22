import React from 'react';
import type { SummaryStats } from '../types';

// Helper to parse HH:MM:SS into seconds
const timeToSeconds = (timeStr: string): number => {
    const [h, m, s] = timeStr.split(':').map(Number);
    return h * 3600 + m * 60 + s;
};

// Helper to format seconds into HH:MM:SS
const secondsToTime = (totalSeconds: number): string => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

interface SummaryReportProps {
    stats: SummaryStats;
    onClose: () => void;
}

export const SummaryReport: React.FC<SummaryReportProps> = ({ stats, onClose }) => {
    let congestionDuration = 'N/A';
    if (stats.firstCongestionTime && stats.lastCongestionTime) {
        const startSeconds = timeToSeconds(stats.firstCongestionTime);
        const endSeconds = timeToSeconds(stats.lastCongestionTime);
        const durationSeconds = endSeconds - startSeconds;
        congestionDuration = secondsToTime(durationSeconds);
    }
    
    return (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-gray-800 rounded-lg shadow-2xl p-8 max-w-lg w-full border border-cyan-500">
                <h2 className="text-3xl font-bold text-cyan-400 mb-6 text-center">Simulation Complete</h2>
                <div className="space-y-4 text-lg">
                    <div className="flex justify-between p-3 bg-gray-700 rounded-md">
                        <span className="font-semibold text-gray-300">First Time Parking Full:</span>
                        <span className="font-bold text-yellow-400">{stats.firstParkingFullTime ?? 'N/A'}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-700 rounded-md">
                        <span className="font-semibold text-gray-300">First Congestion Occurred:</span>
                        <span className="font-bold text-orange-400">{stats.firstCongestionTime ?? 'N/A'}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-700 rounded-md">
                        <span className="font-semibold text-gray-300">Last Congestion Cleared:</span>
                        <span className="font-bold text-orange-400">{stats.lastCongestionTime ?? 'N/A'}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-700 rounded-md">
                        <span className="font-semibold text-gray-300">Total Congestion Duration:</span>
                        <span className="font-bold text-red-400">{congestionDuration}</span>
                    </div>
                </div>
                <div className="mt-8 text-center">
                    <button
                        onClick={onClose}
                        className="py-3 px-8 bg-cyan-600 hover:bg-cyan-500 rounded-md font-semibold text-white transition-all duration-200"
                    >
                        Run New Simulation
                    </button>
                </div>
            </div>
             <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};