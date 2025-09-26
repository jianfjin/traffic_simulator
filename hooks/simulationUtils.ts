import type { SimulationSettings, SimulationState, PathPoint } from '../types';

export const getInitialState = (settings: SimulationSettings): SimulationState => ({
  isPlaying: false,
  isFinished: false,
  cars: [],
  parkingSpots: Array(settings.parkingCapacity).fill(null),
  metrics: {
    simulationTime: '00:00:00',
    spawnedCars: 0,
    exitedCars: 0,
    carsParked: 0,
    totalParkingSpots: settings.parkingCapacity,
    carsInCampus: 0,
    campusCarLimit: settings.campusCarLimit,
    waitingAtP1: 0,
    waitingAtP3In: 0,
    waitingAtP3Out: 0,
    trafficFlow: 'Normal',
  },
  summaryStats: {
    firstParkingFullTime: null,
    firstCongestionTime: null,
    lastCongestionTime: null,
    totalCongestionTime: null,
  },
});

export const getPositionOnPath = (path: PathPoint[], progress: number): { position: { x: number; y: number }, segmentIndex: number } => {
  let accumulatedLength = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    if (progress >= accumulatedLength && progress <= accumulatedLength + segment.length) {
      const segmentProgress = progress - accumulatedLength;
      const fraction = segment.length > 0 ? segmentProgress / segment.length : 0;
      const nextPoint = path[i + 1];
      const x = segment.x + (nextPoint.x - segment.x) * fraction;
      const y = segment.y + (nextPoint.y - segment.y) * fraction;
      return { position: { x, y }, segmentIndex: i };
    }
    accumulatedLength += segment.length;
  }
  const lastPoint = path[path.length - 1];
  return { position: { x: lastPoint.x, y: lastPoint.y }, segmentIndex: path.length - 2 };
};

export const getTotalPathLength = (path: PathPoint[]): number => {
    return path.reduce((sum, point) => sum + point.length, 0);
};