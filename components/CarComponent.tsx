import React from 'react';
import type { Car } from '../types';
import { CarStatus } from '../types';

interface CarComponentProps {
  car: Car;
}

const getCarColor = (status: CarStatus): string => {
    switch (status) {
        // FIX: Changed CarStatus.PARKED to CarStatus.PARKING to match the enum definition in types.ts.
        case CarStatus.PARKING:
            return 'bg-gray-400';
        case CarStatus.DROPPING_OFF_AT_P3:
        case CarStatus.DROPPING_OFF_IN_CAMPUS:
            return 'bg-yellow-400';
        case CarStatus.WAITING_AT_P3_ENTER:
        case CarStatus.WAITING_AT_P3_EXIT:
        case CarStatus.WAITING_AT_P4:
            return 'bg-red-500';
        default:
            return 'bg-cyan-400';
    }
}

export const CarComponent: React.FC<CarComponentProps> = React.memo(({ car }) => {
  if (car.status === CarStatus.EXITED) {
    return null; // Don't render exited cars
  }

  const style: React.CSSProperties = {
    left: `${car.position.x}%`,
    top: `${car.position.y}%`,
    transform: 'translate(-50%, -50%)',
    width: '8px',
    height: '8px',
  };

  return (
    <div
      className={`absolute ${getCarColor(car.status)} rounded-sm shadow-lg transition-all duration-100 ease-linear`}
      style={style}
    />
  );
});
