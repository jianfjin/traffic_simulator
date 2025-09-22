import { useState, useEffect, useRef, useCallback } from 'react';
import type { SimulationSettings, SimulationState, Car, PathPoint, SimulationMetrics, SummaryStats } from '../types';
import { CarStatus, P3TrafficState } from '../types';
import {
  CAR_SPEED,
  CAR_DROP_OFF_TIME,
  SIMULATED_PARKING_DURATION,
  P3_TRANSITION_TIME,
  P4_YIELD_TIME,
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
  P3
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

    // --- Queue Processing (One car at a time) ---
    p3Refs.p3CarReleaseTimer -= deltaTime;
    if (p3Refs.p3CarReleaseTimer <= 0) {
        if (p3Refs.p3State === P3TrafficState.ALLOWING_IN && p3Refs.p3InCounter < settings.p3BatchSize) {
            const carToRelease = newCarsSource.find(c => c.status === CarStatus.WAITING_AT_P3_ENTER);
            if (carToRelease) {
                carToRelease.status = CarStatus.ENTERING_CAMPUS;
                carToRelease.path = P3_TO_CAMPUS_PATH;
                carToRelease.progress = 0;
                p3Refs.p3InCounter++;
                p3Refs.p3CarReleaseTimer = 1.0; // Stagger release
            }
        } else if (p3Refs.p3State === P3TrafficState.ALLOWING_OUT && p3Refs.p3OutCounter < settings.p3BatchSize) {
             const carToRelease = newCarsSource.find(c => c.status === CarStatus.WAITING_AT_P3_EXIT);
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
            let closestDistanceAhead = Infinity;
            for (const otherCar of newCarsSource) {
                if (otherCar.id === updatedCar.id) continue;

                const isLogicallyAhead = 
                    (updatedCar.status === CarStatus.DRIVING_TO_P2 && [CarStatus.DRIVING_TO_P2, CarStatus.DRIVING_TO_P3, CarStatus.WAITING_AT_P3_ENTER].includes(otherCar.status)) ||
                    (updatedCar.status === CarStatus.DRIVING_TO_P3 && [CarStatus.DRIVING_TO_P3, CarStatus.WAITING_AT_P3_ENTER].includes(otherCar.status));

                if (!isLogicallyAhead) continue;
                if (otherCar.status === updatedCar.status && otherCar.progress <= updatedCar.progress) continue;
                
                const dx = otherCar.position.x - updatedCar.position.x;
                const dy = otherCar.position.y - updatedCar.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                const { segmentIndex } = getPositionOnPath(updatedCar.path, updatedCar.progress);
                const currentPoint = updatedCar.path[segmentIndex];
                const nextPoint = updatedCar.path[segmentIndex + 1];
                if (nextPoint) {
                    const pathVector = { x: nextPoint.x - currentPoint.x, y: nextPoint.y - currentPoint.y };
                    const toOtherCarVector = { x: dx, y: dy };
                    const dotProduct = pathVector.x * toOtherCarVector.x + pathVector.y * toOtherCarVector.y;
                    if (dotProduct > 0 && distance < closestDistanceAhead) {
                        closestDistanceAhead = distance;
                    }
                }
            }
            if (closestDistanceAhead < 3.5) {
                distanceToMove = 0;
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
                const isExitQueuePresentForDropoff = newCarsSource.some(c => c.id !== updatedCar.id && c.status === CarStatus.WAITING_AT_P3_EXIT);
                if (updatedCar.timer <= 0 && !isExitQueuePresentForDropoff) {
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
                    newMetrics.exitedCars = (simulationState.metrics.exitedCars || 0) + 1;
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
                    updatedCar.timer = P4_YIELD_TIME;
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
                 const isExitQueuePresent = newCarsSource.some(c => c.id !== updatedCar.id && c.status === CarStatus.WAITING_AT_P3_EXIT);
                if (isExitQueuePresent) {
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
            const queueIndex = newCarsSource.filter(c => c.id < updatedCar.id && c.status === CarStatus.WAITING_AT_P3_ENTER).length;
            const distanceFromP3 = queueIndex * QUEUE_SPACING;
            const lengthP3toP2 = P2.y - P3.y;

            if (distanceFromP3 <= lengthP3toP2) {
                updatedCar.position = { x: P3.x, y: P3.y + distanceFromP3 };
            } else {
                const distanceFromP2 = distanceFromP3 - lengthP3toP2;
                updatedCar.position = { x: P2.x - distanceFromP2, y: P2.y };
            }

        } else if (updatedCar.status === CarStatus.WAITING_AT_P3_EXIT) {
            const queueIndex = newCarsSource.filter(c => c.id < updatedCar.id && c.status === CarStatus.WAITING_AT_P3_EXIT).length;
            updatedCar.position = {
                x: P3_OUT_QUEUE_START.x - P3_OUT_QUEUE_DIRECTION.x * queueIndex * QUEUE_SPACING,
                y: P3_OUT_QUEUE_START.y - P3_OUT_QUEUE_DIRECTION.y * queueIndex * QUEUE_SPACING,
            };
        }

        return updatedCar;
    }).filter(c => c.status !== CarStatus.EXITED);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    newMetrics.simulationTime = formatTime(p3Refs.simulationTime);
    newMetrics.carsParked = newParkingSpots.filter(s => s !== null).length;
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
        const nonParkedCars = updatedCars.filter(c => c.status !== CarStatus.PARKING);
        if (allCarsSpawned && nonParkedCars.length === 0) {
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