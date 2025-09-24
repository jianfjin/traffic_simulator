import { P3TrafficState, type Car } from '../types';
import { P3_TRANSITION_TIME } from '../constants';

interface AutoControlQueues {
    p3EnterQueue: Car[];
    p3ExitQueue: Car[];
}

// This function encapsulates the "automatic" P3 intersection logic.
export const updateAutoModeLogic = (
    deltaTime: number,
    p3Refs: { p3State: P3TrafficState; p3Timer: number; p3InCounter: number; p3OutCounter: number; },
    queues: AutoControlQueues
) => {
    p3Refs.p3Timer -= deltaTime;

    // Smart transition: If the current green light has no waiting cars but the other direction does,
    // shorten the timer to switch phases faster, improving traffic flow.
    if (p3Refs.p3State === P3TrafficState.ALLOWING_OUT && queues.p3ExitQueue.length === 0 && queues.p3EnterQueue.length > 0) {
        if (p3Refs.p3Timer > P3_TRANSITION_TIME) {
            p3Refs.p3Timer = P3_TRANSITION_TIME; 
        }
    }
    
    if (p3Refs.p3State === P3TrafficState.ALLOWING_IN && queues.p3EnterQueue.length === 0 && queues.p3ExitQueue.length > 0) {
        if (p3Refs.p3Timer > P3_TRANSITION_TIME) {
            p3Refs.p3Timer = P3_TRANSITION_TIME;
        }
    }

    if (p3Refs.p3Timer <= 0) {
        switch (p3Refs.p3State) {
            case P3TrafficState.ALLOWING_IN:
                p3Refs.p3State = P3TrafficState.TRANSITIONING_TO_OUT;
                p3Refs.p3Timer = P3_TRANSITION_TIME;
                p3Refs.p3InCounter = 0;
                break;
            case P3TrafficState.TRANSITIONING_TO_OUT:
                p3Refs.p3State = P3TrafficState.ALLOWING_OUT;
                // DYNAMIC TIMER: Prioritize exit queue.
                // Give 1.5s per car, with a 5s base and a 20s max.
                const outTime = Math.max(5, Math.min(20, 5 + queues.p3ExitQueue.length * 1.5));
                p3Refs.p3Timer = outTime;
                break;
            case P3TrafficState.ALLOWING_OUT:
                p3Refs.p3State = P3TrafficState.TRANSITIONING_TO_IN;
                p3Refs.p3Timer = P3_TRANSITION_TIME;
                p3Refs.p3OutCounter = 0;
                break;
            case P3TrafficState.TRANSITIONING_TO_IN:
                p3Refs.p3State = P3TrafficState.ALLOWING_IN;
                // DYNAMIC TIMER: Lower priority for entry queue.
                // Give 1s per car, with a 5s base and a 15s max.
                const inTime = Math.max(5, Math.min(15, 5 + queues.p3EnterQueue.length * 1.0));
                p3Refs.p3Timer = inTime;
                break;
        }
    }
};