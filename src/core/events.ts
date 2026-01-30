import { EventEmitter } from 'events';

export type EventType =
    | 'phase_start'
    | 'phase_complete'
    | 'step_progress'
    | 'error'
    | 'warning'
    | 'node_discovered'
    | 'node_status_update';

export interface EventPayload {
    timestamp: number;
    phase?: string;
    message?: string;
    data?: any;
}

export class EventSystem extends EventEmitter {
    emit(event: EventType, payload: Omit<EventPayload, 'timestamp'>) {
        return super.emit(event, { ...payload, timestamp: Date.now() });
    }

    on(event: EventType, listener: (payload: EventPayload) => void): this {
        return super.on(event, listener);
    }
}
