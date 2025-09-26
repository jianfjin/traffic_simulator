import React from 'react';
import type { SimulationMetrics } from '../types';

interface MetricCardProps {
    title: string;
    value: string | number;
    className?: string;
    valueClassName?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, className = '', valueClassName = '' }) => (
    <div className={`bg-gray-800 p-4 rounded-lg shadow-md flex flex-col justify-between ${className}`}>
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
    </div>
);

interface DashboardProps {
    metrics: SimulationMetrics;
}

export const Dashboard: React.FC<DashboardProps> = ({ metrics }) => {
    const getTrafficFlowColor = () => {
        switch (metrics.trafficFlow) {
            case 'Congestion at P1': return 'text-purple-400';
            case 'Congestion at P3': return 'text-red-400';
            case 'Congestion at P4': return 'text-orange-400';
            case 'Parking Full': return 'text-yellow-400';
            case 'Campus Full': return 'text-pink-400';
            default: return 'text-green-400';
        }
    };

    const getCampusCongestionColor = () => {
        if (!metrics.campusCarLimit || metrics.campusCarLimit === 0) return '';
        const ratio = metrics.carsInCampus / metrics.campusCarLimit;
        if (ratio >= 1) return 'text-red-400';
        if (ratio > 0.85) return 'text-yellow-400';
        return '';
    };
    
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <MetricCard title="Simulation Time" value={metrics.simulationTime} className="col-span-2" valueClassName="text-cyan-400 text-2xl" />
            <MetricCard title="Spawned Cars" value={metrics.spawnedCars} />
            <MetricCard title="Exited Cars" value={metrics.exitedCars} />
            <MetricCard title="Cars Parked" value={`${metrics.carsParked} / ${metrics.totalParkingSpots}`} />
            <MetricCard title="Cars in Campus" value={`${metrics.carsInCampus} / ${metrics.campusCarLimit}`} valueClassName={getCampusCongestionColor()} />
            <MetricCard title="Waiting at P1" value={metrics.waitingAtP1} />
            <MetricCard title="Waiting at P3 (In/Out)" value={`${metrics.waitingAtP3In} / ${metrics.waitingAtP3Out}`} />
            <MetricCard title="Traffic Flow" value={metrics.trafficFlow} className="col-span-2 md:col-span-4 lg:col-span-8" valueClassName={getTrafficFlowColor()} />
        </div>
    );
};