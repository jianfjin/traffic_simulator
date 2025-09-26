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
  campusCarLimit: 150,
};

// Car properties
export const CAR_SPEED = 8; // meters per second (base speed)
export const PARKING_LOT_SPEED = 4; // Slower speed for campus area
export const CAMPUS_ENTRY_SPEED = (PARKING_LOT_SPEED / 3) * 2; // Even slower for initial entry
export const CAMPUS_EXIT_SPEED = 3.6; // A very slow, deliberate speed for pulling out into traffic
export const CRAWLING_SPEED = 1.6; // Very slow speed for parking maneuvers
export const CAR_LENGTH = 1.8; // Visual length for spacing, in % of canvas
export const MIN_CAR_SPACING = 0.5; // Minimum spacing, in % of canvas
export const CAR_DROP_OFF_TIME = 10; // seconds
export const SIMULATED_PARKING_DURATION = 120; // Represents 4 hours in sim time

// Intersection Logic
export const P3_TRANSITION_TIME = 2; // seconds to switch traffic direction
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
            y: 8 + row * 4, // MOVED UP slightly to make room for queue
        });
    }
    return spots;
};


// Path definitions (coordinates in %)
export const P1 = { x: 1, y: 79.5 };
export const P2 = { x: 60, y: 79.5 };
export const P3 = { x: 60, y: 41.5 };
export const P4 = { x: 1, y: 41.5 };


// --- Campus Layout Constants ---
const CAMPUS_IN_AISLE_Y = 20;   // UPPER aisle for entry and drop-off (MOVED UP)
const CAMPUS_OUT_AISLE_Y = 34;  // LOWER aisle for the primary exit queue (MOVED DOWN)

const CAMPUS_AISLE_START_X = 57; // Right side
const CAMPUS_AISLE_END_X = 8;   // Left side

const CAMPUS_ENTRANCE = { x: 57, y: 41.5 };
const CAMPUS_MAIN_AISLE_ENTRANCE = { x: CAMPUS_AISLE_START_X, y: CAMPUS_IN_AISLE_Y }; // Path enters on the IN aisle
export const CAMPUS_EXIT_JUNCTION = { x: 57, y: 39.5 };

// The P3 exit queue now starts at the left end of the OUT aisle.
export const P3_OUT_QUEUE_START = { x: CAMPUS_AISLE_END_X, y: CAMPUS_OUT_AISLE_Y };
export const P3_OUT_QUEUE_DIRECTION = { x: 1, y: 0 };
const P3_OUT_QUEUE_END = { x: CAMPUS_AISLE_START_X, y: CAMPUS_OUT_AISLE_Y };


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

// Path from road to the start of the IN aisle (right side)
export const P3_TO_CAMPUS_PATH = calculatePath([P3, CAMPUS_ENTRANCE, { x: 57, y: 35 }, CAMPUS_MAIN_AISLE_ENTRANCE]);

// Path for drop-off: traverse the IN aisle from right to left
export const CAMPUS_DROPOFF_PATH = calculatePath([CAMPUS_MAIN_AISLE_ENTRANCE, { x: CAMPUS_AISLE_END_X, y: CAMPUS_IN_AISLE_Y }]);

// Path from the dropoff point (left end of IN aisle) to the start of the exit queue (left end of OUT aisle)
export const CAMPUS_EXIT_PATH_FROM_DROPOFF = calculatePath([
    { x: CAMPUS_AISLE_END_X, y: CAMPUS_IN_AISLE_Y },
    { x: CAMPUS_AISLE_END_X, y: CAMPUS_OUT_AISLE_Y }, // Move down to the OUT aisle
    P3_OUT_QUEUE_START
]);

// Path from parking spot to the start of the exit queue (left side of OUT aisle)
export const createPathFromSpotToExit = (spotPosition: {x: number, y: number}): PathPoint[] => {
    const spotAisleY = Math.floor(spotPosition.y / 4) * 4 + 11;

    return calculatePath([
        spotPosition,
        { x: spotPosition.x, y: CAMPUS_IN_AISLE_Y }, // Go straight down to the IN aisle
        { x: CAMPUS_AISLE_END_X, y: CAMPUS_IN_AISLE_Y }, // Go left along IN aisle
        { x: CAMPUS_AISLE_END_X, y: CAMPUS_OUT_AISLE_Y }, // Go down to OUT aisle
        P3_OUT_QUEUE_START // Join queue start
    ]);
};

// Path from the END of the internal queue (right side of OUT aisle) out to the main road
export const CAMPUS_INTERNAL_EXIT_PATH = calculatePath([
    P3_OUT_QUEUE_END,
    CAMPUS_EXIT_JUNCTION,
    P3
]);

export const P3_TO_P4_PATH = calculatePath([P3, P4]);
export const P4_EXIT_PATH = calculatePath([P4, { x: -5, y: 41.5 }]);

// --- Snake-like Exit Queue Logic ---
const EXIT_QUEUE_HEAD_X = 57; // Right side, where cars exit from
const EXIT_QUEUE_TAIL_X = 8;  // Left side, where the first line ends

const EXIT_QUEUE_ROW_SPACING = 3; // Vertical space between queue rows
const EXIT_QUEUE_LINE_1_Y = 34; // Bottom row of the queue (MOVED DOWN)

const CARS_PER_LINE = Math.floor((EXIT_QUEUE_HEAD_X - EXIT_QUEUE_TAIL_X) / QUEUE_SPACING);
const CARS_PER_LINE_COUNT = CARS_PER_LINE + 1;

export const getExitQueuePositionFromHead = (queueIndex: number): { x: number; y: number } => {
    // The queue grows backwards from the head (index 0 is the car at the front).
    const lineIndex = Math.floor(queueIndex / CARS_PER_LINE_COUNT);
    const indexOnLine = queueIndex % CARS_PER_LINE_COUNT;

    const y = EXIT_QUEUE_LINE_1_Y - lineIndex * EXIT_QUEUE_ROW_SPACING;
    let x;

    // Determine direction based on the line number (0-indexed)
    if (lineIndex % 2 === 0) {
        // Even lines (0, 2, 4...) move from right to left (backwards from head)
        x = EXIT_QUEUE_HEAD_X - indexOnLine * QUEUE_SPACING;
    } else {
        // Odd lines (1, 3, 5...) move from left to right (backwards from tail of prev line)
        x = EXIT_QUEUE_TAIL_X + indexOnLine * QUEUE_SPACING;
    }

    return { x, y };
};