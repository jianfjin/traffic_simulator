
export enum CarStatus {
    DRIVING_TO_P2,
    DRIVING_TO_P3,
    DECIDING_AT_P3,
    WAITING_AT_P3_ENTER,
    ENTERING_CAMPUS,
    DROPPING_OFF_IN_CAMPUS,
    EXITING_CAMPUS,
    WAITING_AT_P3_EXIT,
    DROPPING_OFF_AT_P3,
    DRIVING_TO_P4,
    WAITING_AT_P4,
    EXITED,
    MOVING_TO_PARK,
    PARKING,
    MOVING_FROM_PARK,
  }
  
  export enum P3TrafficState {
    ALLOWING_IN,
    TRANSITIONING_TO_OUT,
    ALLOWING_OUT,
    TRANSITIONING_TO_IN,
  }
  
  export interface SimulationSettings {
    speedMultiplier: number;
    spawnRate: number;
    totalCars: number;
    parkingCapacity: number;
    parkingProbability: number;
    p3BatchSize: number;
    p4YieldTime: number;
  }
  
  export interface PathPoint {
    x: number;
    y: number;
    length: number;
  }
  
  export interface Car {
    id: number;
    status: CarStatus;
    progress: number;
    path: PathPoint[];
    position: { x: number; y: number };
    parkingDuration: number;
    timer: number;
    wantsToPark: boolean;
    parkingSpotIndex?: number;
  }
  
  export interface SimulationMetrics {
    simulationTime: string;
    spawnedCars: number;
    exitedCars: number;
    carsParked: number;
    totalParkingSpots: number;
    waitingAtP3In: number;
    waitingAtP3Out: number;
    trafficFlow: 'Normal' | 'Congestion at P3' | 'Congestion at P4' | 'Parking Full';
  }
  
  export interface SummaryStats {
    firstParkingFullTime: string | null;
    firstCongestionTime: string | null;
    lastCongestionTime: string | null;
  }
  
  export interface SimulationState {
    isPlaying: boolean;
    isFinished: boolean;
    cars: Car[];
    parkingSpots: Array<number | null>;
    metrics: SimulationMetrics;
    summaryStats: SummaryStats;
  }