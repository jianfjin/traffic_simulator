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
            case 'Congestion at P3': return 'text-red-400';
            case 'Congestion at P4': return 'text-orange-400';
            case 'Parking Full': return 'text-yellow-400';
            default: return 'text-green-400';
        }
    };
    
    return (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <MetricCard title="Simulation Time" value={metrics.simulationTime} className="col-span-2 lg:col-span-2" valueClassName="text-cyan-400 text-2xl" />
            <MetricCard title="Spawned Cars" value={metrics.spawnedCars} />
            <MetricCard title="Exited Cars" value={metrics.exitedCars} />
            <MetricCard title="Cars Parked" value={`${metrics.carsParked} / ${metrics.totalParkingSpots}`} />
            <MetricCard title="Waiting at P3 (In/Out)" value={`${metrics.waitingAtP3In} / ${metrics.waitingAtP3Out}`} />
            <MetricCard title="Traffic Flow" value={metrics.trafficFlow} className="col-span-2 lg:col-span-2" valueClassName={getTrafficFlowColor()} />
        </div>
    );
};