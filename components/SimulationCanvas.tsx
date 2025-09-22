import React from 'react';
import type { Car, SimulationMetrics } from '../types';
import { CarComponent } from './CarComponent';
import { MapBackground } from './MapBackground';
import { createParkingSpots } from '../constants';

interface SimulationCanvasProps {
  cars: Car[];
  trafficFlow: SimulationMetrics['trafficFlow'];
  parkingSpots: Array<number | null>;
  parkingCapacity: number;
}

const P3CongestionIndicator: React.FC = () => (
  <div 
    className="absolute rounded-full pointer-events-none"
    style={{
      left: '60%', 
      top: '41.5%', 
      transform: 'translate(-50%, -50%)',
      width: '40px',
      height: '40px',
    }}
  >
    <div className="w-full h-full bg-red-500/30 rounded-full animate-ping"></div>
     <div className="absolute top-0 left-0 w-full h-full border-2 border-red-500 rounded-full"></div>
  </div>
);

const P4CongestionIndicator: React.FC = () => (
  <div 
    className="absolute rounded-full pointer-events-none"
    style={{
      left: '2.5%', 
      top: '41.5%', 
      transform: 'translate(-50%, -50%)',
      width: '40px',
      height: '40px',
    }}
  >
    <div className="w-full h-full bg-orange-500/30 rounded-full animate-ping"></div>
     <div className="absolute top-0 left-0 w-full h-full border-2 border-orange-500 rounded-full"></div>
  </div>
);


export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ cars, trafficFlow, parkingSpots, parkingCapacity }) => {
  const spotPositions = createParkingSpots(parkingCapacity);

  return (
    <div
      className="w-full h-full bg-gray-700 relative overflow-hidden"
    >
      <MapBackground />
      {/* Render parking spots */}
      {spotPositions.map((pos, index) => (
          <div
            key={`spot-${index}`}
            className={`absolute rounded-sm ${parkingSpots[index] !== null ? 'bg-cyan-500 opacity-80' : 'bg-gray-600 opacity-50'}`}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: '1.2%',
              height: '3%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}

      {trafficFlow === 'Congestion at P3' && <P3CongestionIndicator />}
      {trafficFlow === 'Congestion at P4' && <P4CongestionIndicator />}
      <div className="absolute top-0 left-0 w-full h-full">
        {cars.map(car => (
          <CarComponent key={car.id} car={car} />
        ))}
      </div>
       {/* Point markers for context */}
       <div className="absolute w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg pointer-events-none" style={{ left: '1%', top: '76%' }}>1</div>
       <div className="absolute w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg pointer-events-none" style={{ left: '59%', top: '76%' }}>2</div>
       <div className="absolute w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg pointer-events-none" style={{ left: '59%', top: '38%' }}>3</div>
       <div className="absolute w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg pointer-events-none" style={{ left: '4%', top: '38%' }}>4</div>
    </div>
  );
};
