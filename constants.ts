// FIX: Removed invalid file header text that was causing parsing errors.
import type { SimulationSettings, PathPoint } from './types';

export const DEFAULT_SETTINGS: SimulationSettings = {
  speedMultiplier: 5,
  spawnRate: 3, // seconds per car
  totalCars: 500,
  parkingCapacity: 60,
  parkingProbability: 0.5,
  p3BatchSize: 5,
  p4YieldTime: 3,
  mode: 'auto',
};

// Car properties
export const CAR_SPEED = 15; // meters per second (base speed)
export const PARKING_LOT_SPEED = 2; // Slower speed for campus area
export const CAMPUS_ENTRY_SPEED = (PARKING_LOT_SPEED / 3) * 2; // Even slower for initial entry
export const CRAWLING_SPEED = 0.8; // Very slow speed for parking maneuvers
export const CAR_LENGTH = 1.8; // Visual length for spacing, in % of canvas
export const MIN_CAR_SPACING = 0.5; // Minimum spacing, in % of canvas
export const CAR_DROP_OFF_TIME = 10; // seconds
export const SIMULATED_PARKING_DURATION = 120; // Represents 4 hours in sim time

// Intersection Logic
export const P3_TRANSITION_TIME = 2; // seconds to switch traffic direction
export const P3_OUT_QUEUE_START = { x: 57, y: 38 };
export const P3_OUT_QUEUE_DIRECTION = { x: -1, y: 0 }; // horizontal queue inside campus, moves left
export const QUEUE_SPACING = 2.5; // Spacing between cars in queue, in %

// Parking lot
export const createParkingSpots = (capacity: number): {x: number, y: number}[] => {
    if (capacity === 0) return [];
    const spots = [];
    const spotsPerRow = 25;
    for (let i = 0; i < capacity; i++) {
        const row = Math.floor(i / spotsPerRow);
        const col = i % spotsPerRow;
        spots.push({
            x: 7 + col * 1.8,
            y: 23 + row * 4,
        });
    }
    return spots;
};


// Path definitions (coordinates in %)
export const P1 = { x: 1, y: 79.5 };
export const P2 = { x: 60, y: 79.5 };
export const P3 = { x: 60, y: 41.5 };
export const P4 = { x: 1, y: 41.5 };

const CAMPUS_ENTRANCE = { x: 57, y: 41.5 };
const CAMPUS_PARKING_ENTRANCE = { x: 57, y: 28 };
const CAMPUS_EXIT_JUNCTION = { x: 57, y: 39.5 };
const CAMPUS_ENTRY_AISLE_END_X = 8;
const CAMPUS_EXIT_AISLE_Y = 33;


// Helper to calculate path lengths
const calculatePath = (points: {x: number, y: number}[]): PathPoint[] => {
    const path: PathPoint[] = [];
    for (let i = 0; i < points.length; i++) {
        let length = 0;
        if (i < points.length - 1) {
            const dx = points[i+1].x - points[i].x;
            const dy = points[i+1].y - points[i].y;
            length = Math.sqrt(dx * dx + dy * dy); 
        }
        path.push({ ...points[i], length });
    }
    return path;
};

// Define paths using the helper
export const P1_TO_P2_PATH = calculatePath([P1, P2]);
export const P2_TO_P3_PATH = calculatePath([P2, P3]);

export const P3_DROPOFF_LOOP = calculatePath([
    P3,
    { x: 63, y: 41.5 },
    { x: 70, y: 41.5 },
    { x: 70, y: 45.5 },
    { x: 63, y: 45.5 },
    { x: 63, y: 41.5 },
    P3
]);

export const P3_TO_CAMPUS_PATH = calculatePath([P3, CAMPUS_ENTRANCE, { x: 57, y: 35 }, CAMPUS_PARKING_ENTRANCE]);

// Path for cars that will drop-off: drive the full top aisle
export const CAMPUS_DROPOFF_PATH = calculatePath([CAMPUS_PARKING_ENTRANCE, { x: CAMPUS_ENTRY_AISLE_END_X, y: CAMPUS_PARKING_ENTRANCE.y }]);

// Path from the dropoff point (end of top aisle) back to the exit junction, using the one-way loop
export const CAMPUS_EXIT_PATH_FROM_DROPOFF = calculatePath([
    { x: CAMPUS_ENTRY_AISLE_END_X, y: CAMPUS_PARKING_ENTRANCE.y }, // Dropoff point
    { x: CAMPUS_ENTRY_AISLE_END_X, y: CAMPUS_EXIT_AISLE_Y },       // Go down to exit aisle
    { x: CAMPUS_EXIT_JUNCTION.x, y: CAMPUS_EXIT_AISLE_Y },    // Go right on exit aisle
    { x: CAMPUS_EXIT_JUNCTION.x, y: 35 },
    CAMPUS_EXIT_JUNCTION
]);

export const createPathFromSpotToExit = (spotPosition: {x: number, y: number}): PathPoint[] => {
    // New path: From spot, go down to exit aisle, go right on exit aisle, then to exit junction.
    return calculatePath([
        spotPosition,
        { x: spotPosition.x, y: CAMPUS_EXIT_AISLE_Y },
        { x: CAMPUS_EXIT_JUNCTION.x, y: CAMPUS_EXIT_AISLE_Y },
        { x: CAMPUS_EXIT_JUNCTION.x, y: 35 },
        CAMPUS_EXIT_JUNCTION
    ]);
};

export const P3_TO_P4_PATH = calculatePath([P3, P4]);
export const P4_EXIT_PATH = calculatePath([P4, { x: -5, y: 41.5 }]);