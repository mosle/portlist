import type { IPortInfo, Result, ScanError } from '../../shared/types.js';
import { DEFAULT_SETTINGS } from '../../shared/constants.js';

export type GetPortListFunction = () => Promise<Result<IPortInfo[], ScanError>>;

export interface PollingManagerService {
  start(): void;
  stop(): void;
  setInterval(ms: number): void;
  onUpdate(callback: (ports: IPortInfo[]) => void): () => void;
}

/**
 * Create a PollingManager service
 * @param getPortList - Function to fetch port list
 * @param initialInterval - Initial polling interval in ms
 */
export function createPollingManager(
  getPortList: GetPortListFunction,
  initialInterval: number = DEFAULT_SETTINGS.pollingInterval
): PollingManagerService {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let currentInterval = initialInterval;
  const listeners: Array<(ports: IPortInfo[]) => void> = [];

  const fetchAndNotify = async (): Promise<void> => {
    const result = await getPortList();
    if (result.success) {
      for (const listener of listeners) {
        listener(result.data);
      }
    }
  };

  const startPolling = (): void => {
    // Initial fetch
    fetchAndNotify();

    // Set up interval
    intervalId = setInterval(() => {
      fetchAndNotify();
    }, currentInterval);
  };

  return {
    start(): void {
      if (intervalId !== null) {
        return; // Already running
      }
      startPolling();
    },

    stop(): void {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },

    setInterval(ms: number): void {
      currentInterval = ms;

      // If running, restart with new interval
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = setInterval(() => {
          fetchAndNotify();
        }, currentInterval);
      }
    },

    onUpdate(callback: (ports: IPortInfo[]) => void): () => void {
      listeners.push(callback);
      return () => {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      };
    },
  };
}
