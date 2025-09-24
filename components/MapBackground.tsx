// FIX: Removed invalid file header text that was causing parsing errors.
import React from 'react';

const MapElement: React.FC<{ style: React.CSSProperties; className?: string; children?: React.ReactNode }> = ({ style, className = '', children }) => (
  <div className={`absolute ${className}`} style={style}>{children}</div>
);

export const MapBackground: React.FC = () => {
  return (
    <div className="absolute w-full h-full bg-green-800">
      {/* Roads */}
      <MapElement style={{ left: '0%', top: '39%', width: '62%', height: '5%' }} className="bg-gray-500" />
      <MapElement style={{ left: '60%', top: '39%', width: '2%', height: '40%' }} className="bg-gray-500" />
      <MapElement style={{ left: '0%', top: '77%', width: '62%', height: '5%' }} className="bg-gray-500" />
      <MapElement style={{ left: '0%', top: '0%', width: '2%', height: '82%' }} className="bg-gray-500" />

      {/* Campus Area (Left) */}
      <MapElement style={{ left: '4%', top: '5%', width: '54%', height: '32%' }} className="bg-gray-600 rounded-lg shadow-lg" />
      
      {/* Campus Building (Top part of campus area) */}
      <MapElement style={{ left: '6%', top: '8%', width: '50%', height: '12%' }} className="bg-gray-400 rounded-md" />

      {/* Parking Lot (Bottom part of campus area) */}
      <MapElement style={{ left: '6%', top: '22%', width: '50%', height: '13%' }} className="bg-gray-500 border-2 border-dashed border-yellow-400 rounded-md" />
      
      {/* One-way Aisles */}
      {/* Top entry aisle */}
      <MapElement style={{ left: '8%', top: '27%', width: '47%', height: '2.5%' }} className="bg-gray-400 opacity-60" />
      {/* Bottom exit aisle */}
      <MapElement style={{ left: '8%', top: '32%', width: '47%', height: '2.5%' }} className="bg-gray-400 opacity-60" />

      {/* School Area (Right) */}
      <MapElement style={{ left: '68%', top: '5%', width: '30%', height: '32%' }} className="bg-gray-600 rounded-lg shadow-lg flex items-center justify-center">
        <span className="text-gray-400 text-4xl font-bold opacity-75">School</span>
      </MapElement>
    </div>
  );
};