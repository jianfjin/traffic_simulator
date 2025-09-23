import { useState, useEffect, useRef, useCallback } from 'react';
import type { SimulationSettings, SimulationState, Car, PathPoint, SimulationMetrics, SummaryStats } from '../types';
import { CarStatus, P3TrafficState } from '../types';
import {
  CAR_SPEED,
  CAR_DROP_OFF_TIME,
  SIMULATED_PARKING_DURATION,
  P3_TRANSITION_TIME,
  P1_TO_P2_PATH,
  P2_TO_P3_PATH,
  P3_TO_CAMPUS_PATH,
  CAMPUS_DROPOFF_PATH,
  CAMPUS_EXIT_PATH_FROM_DROPOFF,
  createPathFromSpotToExit,
  P3_TO_P4_PATH,
  createParkingSpots,
  QUEUE_SPACING,
  P3_OUT_QUEUE_START,
  P3_OUT_QUEUE_DIRECTION,
  P1,
  P2,
  P3,
  P4
} from '../constants';

const getInitialState = (settings: SimulationSettings): SimulationState => ({
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
    waitingAtP3In: 0,
    waitingAtP3Out: 0,
    trafficFlow: 'Normal',
  },
  summaryStats: {
    firstParkingFullTime: null,
    firstCongestionTime: null,
    lastCongestionTime: null,
  },
});

const getPositionOnPath = (path: PathPoint[], progress: number): { position: { x: number; y: number }, segmentIndex: number } => {
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

const getTotalPathLength = (path: PathPoint[]): number => {
    return path.reduce((sum, point) => sum + point.length, 0);
};

export const useSimulation = (settings: SimulationSettings) => {
  const [simulationState, setSimulationState] = useState<SimulationState>(() => getInitialState(settings));

  const simLogicRefs = useRef({
    lastTimestamp: 0,
    simulationTime: 0,
    spawnTimer: settings.spawnRate,
    nextCarId: 1,
    p3State: P3TrafficState.ALLOWING_OUT,
    p3Timer: 5,
    p3InCounter: 0,
    p3OutCounter: 0,
    p3CarReleaseTimer: 0, // Timer for staggering car release from queues
    spotPositions: createParkingSpots(settings.parkingCapacity),
    isP3BlockedByP4Queue: false,
    nextP3ReleaseQueue: 'campus' as 'campus' | 'dropoff',
    summaryStats: {
        firstParkingFullTime: null as string | null,
        firstCongestionTime: null as string | null,
        lastCongestionTime: null as string | null,
    },
  });
  
  const animationFrameId = useRef<number>();

  const resetSimulation = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    setSimulationState(getInitialState(settings));
    simLogicRefs.current = {
      lastTimestamp: 0,
      simulationTime: 0,
      spawnTimer: settings.spawnRate,
      nextCarId: 1,
      p3State: P3TrafficState.ALLOWING_OUT,
      p3Timer: 5,
      p3InCounter: 0,
      p3OutCounter: 0,
      p3CarReleaseTimer: 0,
      spotPositions: createParkingSpots(settings.parkingCapacity),
      isP3BlockedByP4Queue: false,
      nextP3ReleaseQueue: 'campus' as 'campus' | 'dropoff',
      summaryStats: {
        firstParkingFullTime: null,
        firstCongestionTime: null,
        lastCongestionTime: null,
      },
    };
  }, [settings]);

  useEffect(() => {
    resetSimulation();
  }, [settings, resetSimulation]);

  const togglePlayPause = useCallback(() => {
    if(simulationState.isFinished) return;
    setSimulationState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, [simulationState.isFinished]);

  const tick = useCallback((timestamp: number) => {
    const p3Refs = simLogicRefs.current;
    if (!p3Refs.lastTimestamp) {
        p3Refs.lastTimestamp = timestamp;
        animationFrameId.current = requestAnimationFrame(tick);
        return;
    }

    const realDeltaTime = (timestamp - p3Refs.lastTimestamp) / 1000;
    p3Refs.lastTimestamp = timestamp;
    if (realDeltaTime > 0.1) { 
        animationFrameId.current = requestAnimationFrame(tick);
        return;
    }

    const deltaTime = realDeltaTime * settings.speedMultiplier;
    p3Refs.simulationTime += deltaTime;

    const newCarsSource = [...simulationState.cars];
    let newParkingSpots = [...simulationState.parkingSpots];
    const newMetrics: Partial<SimulationMetrics> = {};

    // --- P3 Intersection State Machine ---
    p3Refs.p3Timer -= deltaTime;
    if (p3Refs.p3Timer <= 0) {
        switch (p3Refs.p3State) {
            case P3TrafficState.ALLOWING_IN:
                p3Refs.p3State = P3TrafficState.TRANSITIONING_TO_OUT;
                p3Refs.p3Timer = P3_TRANSITION_TIME;
                p3Refs.p3InCounter = 0;
                break;
            case P3TrafficState.TRANSITIONING_TO_OUT:
                p3Refs.p3State = P3TrafficState.ALLOWING_OUT;
                p3Refs.p3Timer = 10;
                break;
            case P3TrafficState.ALLOWING_OUT:
                p3Refs.p3State = P3TrafficState.TRANSITIONING_TO_IN;
                p3Refs.p3Timer = P3_TRANSITION_TIME;
                p3Refs.p3OutCounter = 0;
                break;
            case P3TrafficState.TRANSITIONING_TO_IN:
                p3Refs.p3State = P3TrafficState.ALLOWING_IN;
                p3Refs.p3Timer = 10;
                break;
        }
    }

    // --- Car Spawning ---
    p3Refs.spawnTimer -= deltaTime;
    if (p3Refs.spawnTimer <= 0 && p3Refs.nextCarId <= settings.totalCars) {
        const wantsToPark = Math.random() < settings.parkingProbability;
        newCarsSource.push({
            id: p3Refs.nextCarId,
            status: CarStatus.DRIVING_TO_P2,
            progress: 0,
            path: P1_TO_P2_PATH,
            position: P1_TO_P2_PATH[0],
            parkingDuration: 0,
            timer: 0,
            wantsToPark,
        });
        p3Refs.nextCarId++;
        p3Refs.spawnTimer = settings.spawnRate;
        newMetrics.spawnedCars = simulationState.metrics.spawnedCars + 1;
    }

    // --- Performance Optimization: Bucket cars by status in a single pass ---
    const carBuckets: { [key in CarStatus]?: Car[] } = {};
    for (const car of newCarsSource) {
        const status = car.status;
        if (!carBuckets[status]) {
            carBuckets[status] = [];
        }
        carBuckets[status]!.push(car);
    }
    
    const p3EnterQueue = carBuckets[CarStatus.WAITING_AT_P3_ENTER]?.sort((a, b) => a.id - b.id) ?? [];
    const p3ExitQueue = carBuckets[CarStatus.WAITING_AT_P3_EXIT]?.sort((a, b) => a.id - b.id) ?? [];
    const p4Queue = carBuckets[CarStatus.WAITING_AT_P4]?.sort((a, b) => a.id - b.id) ?? [];
    
    const p3EnterQueueIndexMap = new Map(p3EnterQueue.map((c, i) => [c.id, i]));
    const p3ExitQueueIndexMap = new Map(p3ExitQueue.map((c, i) => [c.id, i]));
    const p4QueueIndexMap = new Map(p4Queue.map((c, i) => [c.id, i]));

    const hasP3ExitQueue = p3ExitQueue.length > 0;

    // --- P4 Congestion Detection ---
    const p4QueueSize = p4Queue.length;

    if (p3Refs.isP3BlockedByP4Queue) {
        // End condition: queue size is less than 10
        if (p4QueueSize < 10) {
            p3Refs.isP3BlockedByP4Queue = false;
        }
    } else {
        // Start condition: queue size is greater than 10
        if (p4QueueSize > 10) {
            p3Refs.isP3BlockedByP4Queue = true;
        }
    }

    // --- Leader Map for Inbound Traffic ---
    const inboundTraffic = [
        ...(carBuckets[CarStatus.DRIVING_TO_P2] ?? []),
        ...(carBuckets[CarStatus.DRIVING_TO_P3] ?? []),
        ...p3EnterQueue // This is already sorted by ID (arrival order)
    ];
    
    const statusOrder: { [key in CarStatus]?: number } = {
        [CarStatus.DRIVING_TO_P2]: 1,
        [CarStatus.DRIVING_TO_P3]: 2,
        [CarStatus.WAITING_AT_P3_ENTER]: 3,
    };

    inboundTraffic.sort((a, b) => {
        const orderA = statusOrder[a.status] ?? 99;
        const orderB = statusOrder[b.status] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        if (a.status === CarStatus.WAITING_AT_P3_ENTER) return a.id - b.id; // Already sorted, but for clarity
        return a.progress - b.progress;
    });

    const leaderMap = new Map<number, Car>();
    for (let i = 0; i < inboundTraffic.length - 1; i++) {
        leaderMap.set(inboundTraffic[i].id, inboundTraffic[i + 1]);
    }

    // --- Queue Processing (One car at a time) ---
    p3Refs.p3CarReleaseTimer -= deltaTime;
    if (p3Refs.p3CarReleaseTimer <= 0) {
        if (p3Refs.p3State === P3TrafficState.ALLOWING_IN && p3Refs.p3InCounter < settings.p3BatchSize) {
            const carToRelease = p3EnterQueue[0];
            if (carToRelease) {
                carToRelease.status = CarStatus.ENTERING_CAMPUS;
                carToRelease.path = P3_TO_CAMPUS_PATH;
                carToRelease.progress = 0;
                p3Refs.p3InCounter++;
                p3Refs.p3CarReleaseTimer = 1.0; // Stagger release
            }
        } else if (p3Refs.p3State === P3TrafficState.ALLOWING_OUT && p3Refs.p3OutCounter < settings.p3BatchSize && !p3Refs.isP3BlockedByP4Queue) {
             const carToRelease = p3ExitQueue[0];
             if (carToRelease) {
                carToRelease.status = CarStatus.DRIVING_TO_P4;
                carToRelease.path = P3_TO_P4_PATH;
                carToRelease.progress = 0;
                p3Refs.p3OutCounter++;
                p3Refs.p3CarReleaseTimer = 1.0; // Stagger release
             }
        }
    }
    
    // --- Car State Updates & Movement ---
    const updatedCars = newCarsSource.map(car => {
        let updatedCar = { ...car };
        
        let distanceToMove = CAR_SPEED * deltaTime;

        if (updatedCar.status === CarStatus.DRIVING_TO_P2 || updatedCar.status === CarStatus.DRIVING_TO_P3) {
            const leader = leaderMap.get(updatedCar.id);
            if (leader) {
                const dx = leader.position.x - updatedCar.position.x;
                const dy = leader.position.y - updatedCar.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                const { segmentIndex } = getPositionOnPath(updatedCar.path, updatedCar.progress);
                const currentPoint = updatedCar.path[segmentIndex];
                const nextPoint = updatedCar.path[segmentIndex + 1];
                let isDirectlyAhead = true;
                if (nextPoint) {
                    const pathVector = { x: nextPoint.x - currentPoint.x, y: nextPoint.y - currentPoint.y };
                    const toLeaderVector = { x: dx, y: dy };
                    const dotProduct = pathVector.x * toLeaderVector.x + pathVector.y * toLeaderVector.y;
                    if (dotProduct <= 0) {
                       isDirectlyAhead = false;
                    }
                }
                
                if (isDirectlyAhead && distance < 3.5) {
                    distanceToMove = 0;
                }
            }
        }

        const totalPathLength = getTotalPathLength(updatedCar.path);
        let hasMoved = false;

        switch (updatedCar.status) {
            case CarStatus.DRIVING_TO_P2:
            case CarStatus.DRIVING_TO_P3:
            case CarStatus.ENTERING_CAMPUS:
            case CarStatus.DRIVING_TO_P4:
            case CarStatus.EXITING_CAMPUS:
            case CarStatus.MOVING_TO_PARK:
            case CarStatus.MOVING_FROM_PARK:
                if (distanceToMove > 0) {
                    updatedCar.progress += distanceToMove;
                    hasMoved = true;
                }
                break;
            
            case CarStatus.DROPPING_OFF_AT_P3:
                updatedCar.timer -= deltaTime;
                if (updatedCar.timer <= 0 && !hasP3ExitQueue && !p3Refs.isP3BlockedByP4Queue) {
                    updatedCar.status = CarStatus.DRIVING_TO_P4;
                    updatedCar.path = P3_TO_P4_PATH;
                    updatedCar.progress = 0;
                }
                break;

            case CarStatus.DROPPING_OFF_IN_CAMPUS:
                updatedCar.timer -= deltaTime;
                if (updatedCar.timer <= 0) {
                    updatedCar.status = CarStatus.EXITING_CAMPUS;
                    updatedCar.path = CAMPUS_EXIT_PATH_FROM_DROPOFF;
                    updatedCar.progress = 0;
                }
                break;
            
            case CarStatus.WAITING_AT_P4:
                updatedCar.timer -= deltaTime;
                if(updatedCar.timer <= 0) {
                    updatedCar.status = CarStatus.EXITED;
                    newMetrics.exitedCars = (newMetrics.exitedCars ?? simulationState.metrics.exitedCars) + 1;
                }
                break;

            case CarStatus.PARKING:
                updatedCar.parkingDuration += deltaTime;
                if (updatedCar.parkingDuration >= SIMULATED_PARKING_DURATION) {
                    updatedCar.status = CarStatus.MOVING_FROM_PARK;
                    const spotPosition = p3Refs.spotPositions[updatedCar.parkingSpotIndex!];
                    updatedCar.path = createPathFromSpotToExit(spotPosition);
                    updatedCar.progress = 0;
                    newParkingSpots[updatedCar.parkingSpotIndex!] = null;
                    updatedCar.parkingSpotIndex = undefined;
                }
                break;
            
            default: // Waiting cars don't move on their own
                break;
        }

        if (hasMoved && updatedCar.progress >= totalPathLength) {
            updatedCar.progress = totalPathLength;
             switch (updatedCar.status) {
                case CarStatus.DRIVING_TO_P2:
                    updatedCar.status = CarStatus.DRIVING_TO_P3;
                    updatedCar.path = P2_TO_P3_PATH;
                    updatedCar.progress = 0;
                    break;
                case CarStatus.DRIVING_TO_P3:
                    updatedCar.status = CarStatus.DECIDING_AT_P3;
                    break;
                case CarStatus.ENTERING_CAMPUS:
                    if (updatedCar.wantsToPark) {
                        const freeSpotIndex = newParkingSpots.findIndex(s => s === null);
                        if (freeSpotIndex !== -1) {
                            updatedCar.status = CarStatus.MOVING_TO_PARK;
                            const spotPosition = p3Refs.spotPositions[freeSpotIndex];
                            const entrance = updatedCar.path[updatedCar.path.length-1];
                            const dist = Math.sqrt(Math.pow(spotPosition.x - entrance.x, 2) + Math.pow(spotPosition.y - entrance.y, 2));
                            updatedCar.path = [{...entrance, length: dist}, { ...spotPosition, length: 0 }];
                            updatedCar.progress = 0;
                            updatedCar.parkingSpotIndex = freeSpotIndex;
                            newParkingSpots[freeSpotIndex] = updatedCar.id;
                        } else {
                            updatedCar.status = CarStatus.DROPPING_OFF_IN_CAMPUS;
                            updatedCar.path = CAMPUS_DROPOFF_PATH;
                            updatedCar.progress = 0;
                            updatedCar.timer = CAR_DROP_OFF_TIME;
                        }
                    } else {
                        updatedCar.status = CarStatus.DROPPING_OFF_IN_CAMPUS;
                        updatedCar.path = CAMPUS_DROPOFF_PATH;
                        updatedCar.progress = 0;
                        updatedCar.timer = CAR_DROP_OFF_TIME;
                    }
                    break;
                case CarStatus.MOVING_TO_PARK:
                    updatedCar.status = CarStatus.PARKING;
                    updatedCar.parkingDuration = 0;
                    break;
                case CarStatus.MOVING_FROM_PARK:
                    updatedCar.status = CarStatus.WAITING_AT_P3_EXIT;
                    break;
                case CarStatus.EXITING_CAMPUS:
                    updatedCar.status = CarStatus.WAITING_AT_P3_EXIT;
                    break;
                case CarStatus.DRIVING_TO_P4:
                    updatedCar.status = CarStatus.WAITING_AT_P4;
                    updatedCar.timer = settings.p4YieldTime;
                    break;
                 default:
                     break;
            }
        }
        
        if (updatedCar.status === CarStatus.DECIDING_AT_P3) {
            if (!updatedCar.wantsToPark) {
                updatedCar.status = CarStatus.DROPPING_OFF_AT_P3;
                updatedCar.timer = CAR_DROP_OFF_TIME;
                updatedCar.position = P3;
            } else {
                if (hasP3ExitQueue) {
                    updatedCar.status = CarStatus.WAITING_AT_P3_ENTER;
                } else {
                    updatedCar.status = CarStatus.ENTERING_CAMPUS;
                    updatedCar.path = P3_TO_CAMPUS_PATH;
                    updatedCar.progress = 0;
                }
            }
        }

        if (hasMoved) {
            updatedCar.position = getPositionOnPath(updatedCar.path, updatedCar.progress).position;
        }
        
        if (updatedCar.status === CarStatus.WAITING_AT_P3_ENTER) {
            const queueIndex = p3EnterQueueIndexMap.get(updatedCar.id);
            if(queueIndex !== undefined) {
                const distanceFromP3 = queueIndex * QUEUE_SPACING;
                const lengthP3toP2 = P2.y - P3.y;

                if (distanceFromP3 <= lengthP3toP2) {
                    updatedCar.position = { x: P3.x, y: P3.y + distanceFromP3 };
                } else {
                    const distanceFromP2 = distanceFromP3 - lengthP3toP2;
                    updatedCar.position = { x: P2.x - distanceFromP2, y: P2.y };
                }
            }
        } else if (updatedCar.status === CarStatus.WAITING_AT_P3_EXIT) {
            const queueIndex = p3ExitQueueIndexMap.get(updatedCar.id);
            if(queueIndex !== undefined) {
                updatedCar.position = {
                    x: P3_OUT_QUEUE_START.x - P3_OUT_QUEUE_DIRECTION.x * queueIndex * QUEUE_SPACING,
                    y: P3_OUT_QUEUE_START.y - P3_OUT_QUEUE_DIRECTION.y * queueIndex * QUEUE_SPACING,
                };
            }
        } else if (updatedCar.status === CarStatus.WAITING_AT_P4) {
            const queueIndex = p4QueueIndexMap.get(updatedCar.id);
            if(queueIndex !== undefined) {
                updatedCar.position = {
                    x: P4.x + queueIndex * QUEUE_SPACING,
                    y: P4.y,
                };
            }
        }

        return updatedCar;
    }).filter(c => c.status !== CarStatus.EXITED);

    // --- P4 -> P3 Gridlock Management ---
    const previousExited = simulationState.metrics.exitedCars;
    const currentExited = newMetrics.exitedCars ?? previousExited;
    const newlyExitedCount = currentExited - previousExited;

    if (p3Refs.isP3BlockedByP4Queue && newlyExitedCount > 0) {
        for (let i = 0; i < newlyExitedCount; i++) {
            const campusExitCandidate = updatedCars
                .filter(c => c.status === CarStatus.WAITING_AT_P3_EXIT)
                .sort((a, b) => a.id - b.id)[0];
            
            const dropoffCandidate = updatedCars
                .find(c => c.status === CarStatus.DROPPING_OFF_AT_P3 && c.timer <= 0);

            if (p3Refs.nextP3ReleaseQueue === 'campus') {
                if (campusExitCandidate) {
                    campusExitCandidate.status = CarStatus.DRIVING_TO_P4;
                    campusExitCandidate.path = P3_TO_P4_PATH;
                    campusExitCandidate.progress = 0;
                    campusExitCandidate.position = getPositionOnPath(campusExitCandidate.path, 0).position;
                    p3Refs.nextP3ReleaseQueue = 'dropoff';
                } else if (dropoffCandidate) {
                    dropoffCandidate.status = CarStatus.DRIVING_TO_P4;
                    dropoffCandidate.path = P3_TO_P4_PATH;
                    dropoffCandidate.progress = 0;
                    dropoffCandidate.position = getPositionOnPath(dropoffCandidate.path, 0).position;
                    // Don't switch queue preference, as we're just filling in
                }
            } else { // nextP3ReleaseQueue === 'dropoff'
                if (dropoffCandidate) {
                    dropoffCandidate.status = CarStatus.DRIVING_TO_P4;
                    dropoffCandidate.path = P3_TO_P4_PATH;
                    dropoffCandidate.progress = 0;
                    dropoffCandidate.position = getPositionOnPath(dropoffCandidate.path, 0).position;
                    p3Refs.nextP3ReleaseQueue = 'campus';
                } else if (campusExitCandidate) {
                    campusExitCandidate.status = CarStatus.DRIVING_TO_P4;
                    campusExitCandidate.path = P3_TO_P4_PATH;
                    campusExitCandidate.progress = 0;
                    campusExitCandidate.position = getPositionOnPath(campusExitCandidate.path, 0).position;
                     // Don't switch queue preference, as we're just filling in
                }
            }
        }
    }

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    newMetrics.simulationTime = formatTime(p3Refs.simulationTime);
    newMetrics.carsParked = newParkingSpots.filter(s => s !== null).length;
    // Recalculate queue lengths from the final updated list for accuracy
    newMetrics.waitingAtP3In = updatedCars.filter(c => c.status === CarStatus.WAITING_AT_P3_ENTER).length;
    newMetrics.waitingAtP3Out = updatedCars.filter(c => c.status === CarStatus.WAITING_AT_P3_EXIT).length;
    const waitingAtP4 = updatedCars.filter(c => c.status === CarStatus.WAITING_AT_P4).length;

    if (newMetrics.waitingAtP3In > 5 || newMetrics.waitingAtP3Out > 5) {
        newMetrics.trafficFlow = 'Congestion at P3';
    } else if (waitingAtP4 > 5) {
        newMetrics.trafficFlow = 'Congestion at P4';
    } else if (newParkingSpots.filter(s => s === null).length === 0) {
        newMetrics.trafficFlow = 'Parking Full';
    } else {
        newMetrics.trafficFlow = 'Normal';
    }

    // --- Update Summary Stats ---
    const { summaryStats } = p3Refs;
    const currentTimeFormatted = newMetrics.simulationTime;

    if (newMetrics.trafficFlow === 'Parking Full' && !summaryStats.firstParkingFullTime) {
        summaryStats.firstParkingFullTime = currentTimeFormatted;
    }
    if ((newMetrics.trafficFlow === 'Congestion at P3' || newMetrics.trafficFlow === 'Congestion at P4')) {
        if (!summaryStats.firstCongestionTime) {
            summaryStats.firstCongestionTime = currentTimeFormatted;
        }
        summaryStats.lastCongestionTime = currentTimeFormatted;
    }
    
    // --- Check for simulation end condition ---
    let shouldStop = false;
    if (simulationState.isPlaying && !simulationState.isFinished) {
        const allCarsSpawned = p3Refs.nextCarId > settings.totalCars;
        // The simulation is over when all spawned cars have finally exited.
        if (allCarsSpawned && updatedCars.length === 0) {
            shouldStop = true;
        }
    }

    setSimulationState(prev => ({
        ...prev,
        isPlaying: shouldStop ? false : prev.isPlaying,
        isFinished: shouldStop ? true : prev.isFinished,
        cars: updatedCars,
        parkingSpots: newParkingSpots,
        metrics: { ...prev.metrics, ...newMetrics },
        summaryStats: { ...summaryStats },
    }));
    
    animationFrameId.current = requestAnimationFrame(tick);
  }, [settings, simulationState]);

  useEffect(() => {
    if (simulationState.isPlaying) {
      simLogicRefs.current.lastTimestamp = performance.now();
      animationFrameId.current = requestAnimationFrame(tick);
    } else {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [simulationState.isPlaying, tick]);

  return { simulationState, controls: { togglePlayPause } };
};