import { useState, useEffect, useRef, useCallback } from 'react';
import type { SimulationSettings, SimulationState, Car, PathPoint, SimulationMetrics, HumanControls } from '../types';
import { CarStatus, P3TrafficState, HumanP3DecisionAction } from '../types';
import { getInitialState, getPositionOnPath, getTotalPathLength } from './simulationUtils';
import { updateAutoModeLogic } from './autoControl';
import { updateHumanModeLogic } from './humanControl';
import {
  CAR_SPEED,
  PARKING_LOT_SPEED,
  CAMPUS_ENTRY_SPEED,
  CAMPUS_EXIT_SPEED,
  CRAWLING_SPEED,
  CAR_DROP_OFF_TIME,
  SIMULATED_PARKING_DURATION,
  P1_TO_P2_PATH,
  P2_TO_P3_PATH,
  P3_TO_CAMPUS_PATH,
  CAMPUS_DROPOFF_PATH,
  CAMPUS_EXIT_PATH_FROM_DROPOFF,
  createPathFromSpotToExit,
  CAMPUS_INTERNAL_EXIT_PATH,
  P3_TO_P4_PATH,
  P4_EXIT_PATH,
  createParkingSpots,
  QUEUE_SPACING,
  getExitQueuePositionFromHead,
  P1,
  P2,
  P3,
  P4,
  CAMPUS_EXIT_JUNCTION
} from '../constants';

export const useSimulationManager = (settings: SimulationSettings, humanControls: HumanControls) => {
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
        totalCongestionTime: 0,
    },
  });
  
  const animationFrameId = useRef<number | null>(null);

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
        totalCongestionTime: 0,
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

    const deltaTime = realDeltaTime * settings.speedMultiplier;
    // Define a capped delta time for campus movements to ensure smooth visuals at high speed settings.
    const campusDeltaTime = realDeltaTime * Math.min(settings.speedMultiplier, 6.0);
    p3Refs.simulationTime += deltaTime;

    const newCarsSource = [...simulationState.cars];
    let newParkingSpots = [...simulationState.parkingSpots];
    const newMetrics: Partial<SimulationMetrics> = {};
    let hasCarBypassedP3QueueThisTick = false;

    const campusCarStatuses = new Set([
        CarStatus.ENTERING_CAMPUS,
        CarStatus.MOVING_TO_PARK,
        CarStatus.PARKING,
        CarStatus.MOVING_FROM_PARK,
        CarStatus.WAITING_AT_P3_EXIT,
        CarStatus.DRIVING_TO_CAMPUS_DROPOFF,
        CarStatus.DROPPING_OFF_IN_CAMPUS,
        CarStatus.EXITING_CAMPUS,
    ]);
    const carsInCampus = newCarsSource.filter(c => campusCarStatuses.has(c.status)).length;
    newMetrics.carsInCampus = carsInCampus;

    const carBuckets: { [key in CarStatus]?: Car[] } = {};
    for (const car of newCarsSource) {
        const status = car.status;
        if (!carBuckets[status]) {
            carBuckets[status] = [];
        }
        carBuckets[status]!.push(car);
    }
    
    const p3EnterQueue = carBuckets[CarStatus.WAITING_AT_P3_ENTER]?.sort((a, b) => a.id - b.id) ?? [];
    const p3ExitQueue = carBuckets[CarStatus.WAITING_AT_P3_EXIT]?.sort((a, b) => (a.joinQueueTime ?? Infinity) - (b.joinQueueTime ?? Infinity)) ?? [];
    
    if (settings.mode === 'auto') {
        updateAutoModeLogic(deltaTime, p3Refs, { p3EnterQueue, p3ExitQueue });
    } else { 
        updateHumanModeLogic(humanControls, p3Refs);
        const isTransitioning = p3Refs.p3State === P3TrafficState.TRANSITIONING_TO_IN || p3Refs.p3State === P3TrafficState.TRANSITIONING_TO_OUT;
        if (isTransitioning) {
            updateAutoModeLogic(deltaTime, p3Refs, { p3EnterQueue: [], p3ExitQueue: []});
        }
    }

    p3Refs.spawnTimer -= deltaTime;
    if (p3Refs.spawnTimer <= 0 && p3Refs.nextCarId <= settings.totalCars) {
        const wantsToPark = Math.random() < settings.parkingProbability;
        newCarsSource.push({
            id: p3Refs.nextCarId,
            status: CarStatus.WAITING_TO_SPAWN,
            progress: 0,
            path: [],
            position: P1,
            parkingDuration: 0,
            timer: 0,
            wantsToPark,
        });
        p3Refs.nextCarId++;
        p3Refs.spawnTimer = settings.spawnRate;
        newMetrics.spawnedCars = simulationState.metrics.spawnedCars + 1;
    }

    const p1Queue = newCarsSource
        .filter(c => c.status === CarStatus.WAITING_TO_SPAWN)
        .sort((a, b) => a.id - b.id);

    if (p1Queue.length > 0) {
        const carsOnP1P2 = newCarsSource.filter(c => c.status === CarStatus.DRIVING_TO_P2);
        let isP1Blocked = false;
        if (carsOnP1P2.length > 0) {
            const lastCar = carsOnP1P2.reduce((prev, curr) => (prev.progress < curr.progress ? prev : curr));
            if (lastCar.progress < QUEUE_SPACING) {
                isP1Blocked = true;
            }
        }

        if (!isP1Blocked) {
            const carToRelease = p1Queue[0];
            carToRelease.status = CarStatus.DRIVING_TO_P2;
            carToRelease.path = P1_TO_P2_PATH;
            carToRelease.progress = 0;
            carToRelease.position = P1;
        }
    }
    
    const p4Queue = carBuckets[CarStatus.WAITING_AT_P4]?.sort((a, b) => a.id - b.id) ?? [];
    
    const p3EnterQueueIndexMap = new Map(p3EnterQueue.map((c, i) => [c.id, i]));
    const p3ExitQueueIndexMap = new Map(p3ExitQueue.map((c, i) => [c.id, i]));
    const p4QueueIndexMap = new Map(p4Queue.map((c, i) => [c.id, i]));

    const p4QueueSize = p4Queue.length;

    if (p3Refs.isP3BlockedByP4Queue) {
        if (p4QueueSize < 10) {
            p3Refs.isP3BlockedByP4Queue = false;
        }
    } else {
        if (p4QueueSize > 10) {
            p3Refs.isP3BlockedByP4Queue = true;
        }
    }

    const inboundTraffic = [
        ...(carBuckets[CarStatus.DRIVING_TO_P2] ?? []),
        ...(carBuckets[CarStatus.DRIVING_TO_P3] ?? []),
        ...p3EnterQueue
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
        if (a.status === CarStatus.WAITING_AT_P3_ENTER) return a.id - b.id;
        return a.progress - b.progress;
    });

    const leaderMap = new Map<number, Car>();
    for (let i = 0; i < inboundTraffic.length - 1; i++) {
        leaderMap.set(inboundTraffic[i].id, inboundTraffic[i + 1]);
    }
    
    const enteringCampusCars = (carBuckets[CarStatus.ENTERING_CAMPUS] ?? []).sort((a,b) => a.progress - b.progress);
    const campusLeaderMap = new Map<number, Car>();
    for (let i = 0; i < enteringCampusCars.length - 1; i++) {
        campusLeaderMap.set(enteringCampusCars[i].id, enteringCampusCars[i+1]);
    }

    const campusAisleTraffic = newCarsSource.filter(c => {
        if (c.status === CarStatus.DRIVING_TO_CAMPUS_DROPOFF || c.status === CarStatus.DROPPING_OFF_IN_CAMPUS) {
            return true;
        }
        if (c.status === CarStatus.MOVING_FROM_PARK) {
            const { segmentIndex } = getPositionOnPath(c.path, c.progress);
            // Path from spot is [spot, point_on_aisle, end_of_aisle, ...]
            // Segment 1 is the horizontal movement along the aisle.
            if (segmentIndex === 1) {
                return true;
            }
        }
        return false;
    })
    .sort((a, b) => b.position.x - a.position.x); // Sort cars from right to left

    const campusAisleLeaderMap = new Map<number, Car>();
    for (let i = 0; i < campusAisleTraffic.length - 1; i++) {
        // The car at index i+1 is the leader of car at index i
        campusAisleLeaderMap.set(campusAisleTraffic[i].id, campusAisleTraffic[i + 1]);
    }

    p3Refs.p3CarReleaseTimer -= deltaTime;
    if (p3Refs.p3CarReleaseTimer <= 0) {
        const batchSize = settings.mode === 'auto' ? settings.p3BatchSize : 999;

        if (p3Refs.p3State === P3TrafficState.ALLOWING_IN && p3Refs.p3InCounter < batchSize && carsInCampus < settings.campusCarLimit) {
            const carToRelease = p3EnterQueue[0];
            if (carToRelease) {
                carToRelease.status = CarStatus.ENTERING_CAMPUS;
                carToRelease.path = P3_TO_CAMPUS_PATH;
                carToRelease.progress = 0;
                p3Refs.p3InCounter++;
                p3Refs.p3CarReleaseTimer = 2.5;
            }
        } else if (p3Refs.p3State === P3TrafficState.ALLOWING_OUT && p3Refs.p3OutCounter < batchSize && !p3Refs.isP3BlockedByP4Queue) {
             const carToRelease = p3ExitQueue[0];
             if (carToRelease) {
                const headOfQueuePosition = getExitQueuePositionFromHead(0);
                const distance = Math.hypot(carToRelease.position.x - headOfQueuePosition.x, carToRelease.position.y - headOfQueuePosition.y);
                
                if (distance < 0.1) {
                    carToRelease.status = CarStatus.DRIVING_FROM_CAMPUS_TO_P3;
                    carToRelease.path = CAMPUS_INTERNAL_EXIT_PATH;
                    carToRelease.progress = 0;
                    p3Refs.p3OutCounter++;
                    p3Refs.p3CarReleaseTimer = 2.5;
                }
             }
        }
    }
    
    const updatedCars = newCarsSource.map(car => {
        let updatedCar = { ...car };
        
        let distanceToMove;
        const isParkingManeuver = updatedCar.status === CarStatus.MOVING_TO_PARK ||
                                   updatedCar.status === CarStatus.MOVING_FROM_PARK;

        const isCampusDriving = updatedCar.status === CarStatus.DRIVING_TO_CAMPUS_DROPOFF ||
                                updatedCar.status === CarStatus.EXITING_CAMPUS;

        if (isParkingManeuver) {
            distanceToMove = CRAWLING_SPEED * campusDeltaTime;
        } else if (updatedCar.status === CarStatus.ENTERING_CAMPUS) {
            distanceToMove = CAMPUS_ENTRY_SPEED * campusDeltaTime;
        } else if (updatedCar.status === CarStatus.DRIVING_FROM_CAMPUS_TO_P3) {
            distanceToMove = CAMPUS_EXIT_SPEED * realDeltaTime;
        } else if (isCampusDriving) {
            distanceToMove = PARKING_LOT_SPEED * campusDeltaTime;
        } else {
            distanceToMove = CAR_SPEED * deltaTime;
        }

        if (updatedCar.status === CarStatus.DRIVING_TO_P2 || updatedCar.status === CarStatus.DRIVING_TO_P3) {
            const leader = leaderMap.get(updatedCar.id);
            if (leader) {
                const dx = leader.position.x - updatedCar.position.x;
                const dy = leader.position.y - updatedCar.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                const safeDistance = QUEUE_SPACING;

                // Slow down if the leader is approaching or in the P3 queue
                if (leader.status === CarStatus.DRIVING_TO_P3 || leader.status === CarStatus.WAITING_AT_P3_ENTER) {
                    distanceToMove = Math.min(distanceToMove, (CAR_SPEED / 1.5) * deltaTime);
                }

                // Don't get closer than the safe distance
                distanceToMove = Math.max(0, Math.min(distanceToMove, distance - safeDistance));
            }
        }
        
        if (updatedCar.status === CarStatus.ENTERING_CAMPUS) {
            const leader = campusLeaderMap.get(updatedCar.id);
            if (leader) {
                const distance = leader.progress - updatedCar.progress;
                if (distance < (QUEUE_SPACING + 1)) {
                    distanceToMove = 0;
                }
            }
        }

        if (updatedCar.status === CarStatus.DRIVING_TO_CAMPUS_DROPOFF || 
           (updatedCar.status === CarStatus.MOVING_FROM_PARK && getPositionOnPath(updatedCar.path, updatedCar.progress).segmentIndex === 1)) {
            const leader = campusAisleLeaderMap.get(updatedCar.id);
            if (leader) {
                const dx = leader.position.x - updatedCar.position.x;
                const distance = Math.abs(dx);
                const safeDistance = QUEUE_SPACING;
                distanceToMove = Math.max(0, Math.min(distanceToMove, distance - safeDistance));
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
            case CarStatus.DRIVING_TO_CAMPUS_DROPOFF:
            case CarStatus.DRIVING_FROM_CAMPUS_TO_P3:
            case CarStatus.DRIVING_TO_EXIT:
                if (distanceToMove > 0) {
                    updatedCar.progress += distanceToMove;
                    hasMoved = true;
                }
                break;
            
            case CarStatus.DROPPING_OFF_AT_P3:
                updatedCar.timer -= deltaTime;
                if (updatedCar.timer <= 0 && !p3Refs.isP3BlockedByP4Queue) {
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
                    updatedCar.status = CarStatus.DRIVING_TO_EXIT;
                    updatedCar.path = P4_EXIT_PATH;
                    updatedCar.progress = 0;
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
            
            default:
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
                            const aislePoint = { x: spotPosition.x, y: updatedCar.position.y };
                            updatedCar.path = calculatePath([updatedCar.position, aislePoint, spotPosition]);
                            updatedCar.progress = 0;
                            updatedCar.parkingSpotIndex = freeSpotIndex;
                            newParkingSpots[freeSpotIndex] = updatedCar.id;
                        } else {
                            updatedCar.status = CarStatus.DRIVING_TO_CAMPUS_DROPOFF;
                            updatedCar.path = CAMPUS_DROPOFF_PATH;
                            updatedCar.progress = 0;
                        }
                    } else {
                        updatedCar.status = CarStatus.DRIVING_TO_CAMPUS_DROPOFF;
                        updatedCar.path = CAMPUS_DROPOFF_PATH;
                        updatedCar.progress = 0;
                    }
                    break;
                case CarStatus.DRIVING_TO_CAMPUS_DROPOFF:
                    updatedCar.status = CarStatus.DROPPING_OFF_IN_CAMPUS;
                    updatedCar.timer = CAR_DROP_OFF_TIME;
                    break;
                case CarStatus.MOVING_TO_PARK:
                    updatedCar.status = CarStatus.PARKING;
                    updatedCar.parkingDuration = 0;
                    break;
                case CarStatus.MOVING_FROM_PARK:
                    updatedCar.status = CarStatus.WAITING_AT_P3_EXIT;
                    updatedCar.joinQueueTime = p3Refs.simulationTime;
                    break;
                case CarStatus.EXITING_CAMPUS:
                    updatedCar.status = CarStatus.WAITING_AT_P3_EXIT;
                    updatedCar.joinQueueTime = p3Refs.simulationTime;
                    break;
                case CarStatus.DRIVING_FROM_CAMPUS_TO_P3:
                    updatedCar.status = CarStatus.DRIVING_TO_P4;
                    updatedCar.path = P3_TO_P4_PATH;
                    updatedCar.progress = 0;
                    break;
                case CarStatus.DRIVING_TO_P4:
                    updatedCar.status = CarStatus.WAITING_AT_P4;
                    updatedCar.timer = settings.p4YieldTime;
                    break;
                case CarStatus.DRIVING_TO_EXIT:
                    updatedCar.status = CarStatus.EXITED;
                    newMetrics.exitedCars = (newMetrics.exitedCars ?? simulationState.metrics.exitedCars) + 1;
                    break;
                 default:
                     break;
            }
        }
        
        if (updatedCar.status === CarStatus.DECIDING_AT_P3) {
            let carWantsToPark = updatedCar.wantsToPark;

            if (settings.mode === 'human' && humanControls.p3Decision === HumanP3DecisionAction.DIVERT_ALL_TO_DROPOFF) {
                carWantsToPark = false;
            }

            if (!carWantsToPark) {
                updatedCar.status = CarStatus.DROPPING_OFF_AT_P3;
                updatedCar.timer = CAR_DROP_OFF_TIME;
                updatedCar.position = P3;
            } else {
                const batchSize = settings.mode === 'auto' ? settings.p3BatchSize : 999;

                const canBypassQueue = p3Refs.p3State === P3TrafficState.ALLOWING_IN &&
                                       p3EnterQueue.length === 0 &&
                                       p3Refs.p3InCounter < batchSize &&
                                       !hasCarBypassedP3QueueThisTick &&
                                       carsInCampus < settings.campusCarLimit;

                if (canBypassQueue) {
                    hasCarBypassedP3QueueThisTick = true;
                    updatedCar.status = CarStatus.ENTERING_CAMPUS;
                    updatedCar.path = P3_TO_CAMPUS_PATH;
                    updatedCar.progress = 0;
                    p3Refs.p3InCounter++;
                } else {
                    updatedCar.status = CarStatus.WAITING_AT_P3_ENTER;
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
            if (queueIndex !== undefined) {
                const targetPosition = getExitQueuePositionFromHead(queueIndex);
                const currentPosition = updatedCar.position;
        
                const dx = targetPosition.x - currentPosition.x;
                const dy = targetPosition.y - currentPosition.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
        
                const queueSpeed = PARKING_LOT_SPEED * campusDeltaTime;
        
                if (distance > 0.1) { // A small threshold to prevent jittering
                    if (distance <= queueSpeed) {
                        updatedCar.position = targetPosition; // Snap to position if close enough
                    } else {
                        // Move towards the target
                        updatedCar.position.x += (dx / distance) * queueSpeed;
                        updatedCar.position.y += (dy / distance) * queueSpeed;
                    }
                }
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
    

    const previousExited = simulationState.metrics.exitedCars;
    const currentExited = newMetrics.exitedCars ?? previousExited;
    const newlyExitedCount = currentExited - previousExited;

    if (p3Refs.isP3BlockedByP4Queue && newlyExitedCount > 0) {
        for (let i = 0; i < newlyExitedCount; i++) {
            const campusExitCandidate = updatedCars
                .filter(c => c.status === CarStatus.WAITING_AT_P3_EXIT)
                .sort((a, b) => (a.joinQueueTime ?? 0) - (b.joinQueueTime ?? 0))[0];
            
            const dropoffCandidate = updatedCars
                .find(c => c.status === CarStatus.DROPPING_OFF_AT_P3 && c.timer <= 0);

            if (p3Refs.nextP3ReleaseQueue === 'campus') {
                if (campusExitCandidate) {
                    const headOfQueuePosition = getExitQueuePositionFromHead(0);
                    const distance = Math.hypot(campusExitCandidate.position.x - headOfQueuePosition.x, campusExitCandidate.position.y - headOfQueuePosition.y);
                    if (distance < 0.1) {
                        campusExitCandidate.status = CarStatus.DRIVING_FROM_CAMPUS_TO_P3;
                        campusExitCandidate.path = CAMPUS_INTERNAL_EXIT_PATH;
                        campusExitCandidate.progress = 0;
                        p3Refs.nextP3ReleaseQueue = 'dropoff';
                    }
                } else if (dropoffCandidate) {
                    dropoffCandidate.status = CarStatus.DRIVING_TO_P4;
                    dropoffCandidate.path = P3_TO_P4_PATH;
                    dropoffCandidate.progress = 0;
                    dropoffCandidate.position = getPositionOnPath(dropoffCandidate.path, 0).position;
                }
            } else { 
                if (dropoffCandidate) {
                    dropoffCandidate.status = CarStatus.DRIVING_TO_P4;
                    dropoffCandidate.path = P3_TO_P4_PATH;
                    dropoffCandidate.progress = 0;
                    dropoffCandidate.position = getPositionOnPath(dropoffCandidate.path, 0).position;
                    p3Refs.nextP3ReleaseQueue = 'campus';
                } else if (campusExitCandidate) {
                    const headOfQueuePosition = getExitQueuePositionFromHead(0);
                    const distance = Math.hypot(campusExitCandidate.position.x - headOfQueuePosition.x, campusExitCandidate.position.y - headOfQueuePosition.y);
                    if (distance < 0.1) {
                        campusExitCandidate.status = CarStatus.DRIVING_FROM_CAMPUS_TO_P3;
                        campusExitCandidate.path = CAMPUS_INTERNAL_EXIT_PATH;
                        campusExitCandidate.progress = 0;
                    }
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
    newMetrics.waitingAtP1 = updatedCars.filter(c => c.status === CarStatus.WAITING_TO_SPAWN).length;
    
    const officiallyWaitingIn = updatedCars.filter(c => c.status === CarStatus.WAITING_AT_P3_ENTER);
    let totalWaitingIn = officiallyWaitingIn.length;
    if (totalWaitingIn > 0) {
        totalWaitingIn += updatedCars.filter(c => c.status === CarStatus.DRIVING_TO_P3).length;
        totalWaitingIn += updatedCars.filter(c => c.status === CarStatus.DRIVING_TO_P2).length;
    }
    newMetrics.waitingAtP3In = totalWaitingIn;

    newMetrics.waitingAtP3Out = updatedCars.filter(c => c.status === CarStatus.WAITING_AT_P3_EXIT).length;
    const waitingAtP4 = updatedCars.filter(c => c.status === CarStatus.WAITING_AT_P4).length;

    if ((newMetrics.carsInCampus ?? 0) >= settings.campusCarLimit) {
        newMetrics.trafficFlow = 'Campus Full';
    } else if (newMetrics.waitingAtP1 > 5) {
        newMetrics.trafficFlow = 'Congestion at P1';
    } else if (newMetrics.waitingAtP3In > 5 || newMetrics.waitingAtP3Out > 5) {
        newMetrics.trafficFlow = 'Congestion at P3';
    } else if (waitingAtP4 > 5) {
        newMetrics.trafficFlow = 'Congestion at P4';
    } else if (newParkingSpots.filter(s => s === null).length === 0) {
        newMetrics.trafficFlow = 'Parking Full';
    } else {
        newMetrics.trafficFlow = 'Normal';
    }

    const { summaryStats } = p3Refs;
    const currentTimeFormatted = newMetrics.simulationTime;
    const isCongested = (newMetrics.trafficFlow === 'Congestion at P1' || newMetrics.trafficFlow === 'Congestion at P3' || newMetrics.trafficFlow === 'Congestion at P4');

    if (isCongested) {
        summaryStats.totalCongestionTime += deltaTime;
    }

    if (newMetrics.trafficFlow === 'Parking Full' && !summaryStats.firstParkingFullTime) {
        summaryStats.firstParkingFullTime = currentTimeFormatted;
    }
    if (isCongested) {
        if (!summaryStats.firstCongestionTime) {
            summaryStats.firstCongestionTime = currentTimeFormatted;
        }
        summaryStats.lastCongestionTime = currentTimeFormatted;
    }
    
    let shouldStop = false;
    if (simulationState.isPlaying && !simulationState.isFinished) {
        const allCarsSpawned = p3Refs.nextCarId > settings.totalCars;
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
        summaryStats: {
            firstParkingFullTime: summaryStats.firstParkingFullTime,
            firstCongestionTime: summaryStats.firstCongestionTime,
            lastCongestionTime: summaryStats.lastCongestionTime,
            totalCongestionTime: formatTime(summaryStats.totalCongestionTime),
        },
    }));
    
    animationFrameId.current = requestAnimationFrame(tick);
  }, [settings, simulationState, humanControls]);

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
