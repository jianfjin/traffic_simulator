import type { HumanControls } from '../types';
import { P3TrafficState, HumanP3TrafficAction } from '../types';
import { P3_TRANSITION_TIME } from '../constants';

// This function applies direct user commands to the P3 intersection state.
export const updateHumanModeLogic = (
    humanControls: HumanControls,
    p3Refs: { p3State: P3TrafficState; p3Timer: number; },
) => {
    if (humanControls.p3Traffic === HumanP3TrafficAction.ALLOW_IN) {
        if (p3Refs.p3State === P3TrafficState.ALLOWING_OUT) {
             p3Refs.p3State = P3TrafficState.TRANSITIONING_TO_IN;
             p3Refs.p3Timer = P3_TRANSITION_TIME;
        }
    } else if (humanControls.p3Traffic === HumanP3TrafficAction.ALLOW_OUT) {
        if (p3Refs.p3State === P3TrafficState.ALLOWING_IN) {
             p3Refs.p3State = P3TrafficState.TRANSITIONING_TO_OUT;
             p3Refs.p3Timer = P3_TRANSITION_TIME;
        }
    }
};
