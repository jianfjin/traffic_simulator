export interface PathPoint {
  x: number;
  y: number;
  length: number;
}

export enum CarStatus {
  WAITING_TO_SPAWN = 'WAITING_TO_SPAWN',
  DRIVING_TO_P2 = 'DRIVING_TO_P2',
  DRIVING_TO_P3 = 'DRIVING_TO_P3',
  DECIDING_AT_P3 = 'DECIDING_AT_P3',
  WAITING_AT_P3_ENTER = 'WAITING_AT_P3_ENTER',
  ENTERING_CAMPUS = 'ENTERING_CAMPUS',
  MOVING_TO_PARK = 'MOVING_TO_PARK',
  PARKING = 'PARKING',
  MOVING_FROM_PARK = 'MOVING_FROM_PARK',
  WAITING_AT_P3_EXIT = 'WAITING_AT_P3_EXIT',
  DRIVING_TO_P4 = 'DRIVING_TO_P4',
  WAITING_AT_P4 = 'WAITING_AT_P4',
  DRIVING_TO_EXIT = 'DRIVING_TO_EXIT',
  EXITED = 'EXITED',
  DROPPING_OFF_AT_P3 = 'DROPPING_OFF_AT_P3',
  DRIVING_TO_CAMPUS_DROPOFF = 'DRIVING_TO_CAMPUS_DROPOFF',
  DROPPING_OFF_IN_CAMPUS = 'DROPPING_OFF_IN_CAMPUS',
  EXITING_CAMPUS = 'EXITING_CAMPUS',
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
  joinQueueTime?: number;
}

export interface SimulationSettings {
  speedMultiplier: number;
  spawnRate: number;
  totalCars: number;
  parkingCapacity: number;
  parkingProbability: number;
  p3BatchSize: number;
  p4YieldTime: number;
  mode: 'auto' | 'human';
}

export interface SimulationMetrics {
  simulationTime: string;
  spawnedCars: number;
  exitedCars: number;
  carsParked: number;
  totalParkingSpots: number;
  waitingAtP1: number;
  waitingAtP3In: number;
  waitingAtP3Out: number;
  trafficFlow: 'Normal' | 'Congestion at P1' | 'Congestion at P3' | 'Congestion at P4' | 'Parking Full';
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

export enum P3TrafficState {
    ALLOWING_IN,
    ALLOWING_OUT,
    TRANSITIONING_TO_IN,
    TRANSITIONING_TO_OUT,
}

export enum HumanP3TrafficAction {
    ALLOW_IN = 'ALLOW_IN',
    ALLOW_OUT = 'ALLOW_OUT',
}

export enum HumanP3DecisionAction {
    DIVERT_ALL_TO_DROPOFF = 'DIVERT_ALL_TO_DROPOFF',
    USE_PARKING_PROBABILITY = 'USE_PARKING_PROBABILITY',
}

export interface HumanControls {
    p3Traffic: HumanP3TrafficAction | null;
    p3Decision: HumanP3DecisionAction;
}
