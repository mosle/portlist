import { describe, it, expect } from 'vitest';
import {
  createAppState,
  groupByDirectory,
  sortPorts,
  type AppState,
} from '../../renderer/state/app-state.js';
import type { IPortInfo, SortColumn } from '../../shared/types.js';

const mockPorts: IPortInfo[] = [
  { pid: 1, port: 3000, command: 'node', directory: '/Users/test/projectA', protocol: 'TCP' },
  { pid: 2, port: 8080, command: 'python', directory: '/Users/test/projectB', protocol: 'TCP' },
  { pid: 3, port: 4000, command: 'ruby', directory: '/Users/test/projectA', protocol: 'TCP' },
  { pid: 4, port: 5000, command: 'go', directory: '/Users/test/projectC', protocol: 'TCP' },
];

describe('App State', () => {
  describe('createAppState', () => {
    it('should create initial state', () => {
      const state = createAppState();

      expect(state.ports).toEqual([]);
      expect(state.sortColumn).toBe('port');
      expect(state.sortDirection).toBe('asc');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('groupByDirectory', () => {
    it('should group ports by directory', () => {
      const grouped = groupByDirectory(mockPorts);

      expect(grouped.size).toBe(3);
      expect(grouped.get('/Users/test/projectA')).toHaveLength(2);
      expect(grouped.get('/Users/test/projectB')).toHaveLength(1);
      expect(grouped.get('/Users/test/projectC')).toHaveLength(1);
    });

    it('should return empty map for empty ports', () => {
      const grouped = groupByDirectory([]);
      expect(grouped.size).toBe(0);
    });

    it('should preserve port info in groups', () => {
      const grouped = groupByDirectory(mockPorts);
      const projectAPorts = grouped.get('/Users/test/projectA');

      expect(projectAPorts).toBeDefined();
      expect(projectAPorts![0].command).toBe('node');
      expect(projectAPorts![1].command).toBe('ruby');
    });
  });

  describe('sortPorts', () => {
    it('should sort by port ascending', () => {
      const sorted = sortPorts(mockPorts, 'port', 'asc');

      expect(sorted[0].port).toBe(3000);
      expect(sorted[1].port).toBe(4000);
      expect(sorted[2].port).toBe(5000);
      expect(sorted[3].port).toBe(8080);
    });

    it('should sort by port descending', () => {
      const sorted = sortPorts(mockPorts, 'port', 'desc');

      expect(sorted[0].port).toBe(8080);
      expect(sorted[1].port).toBe(5000);
      expect(sorted[2].port).toBe(4000);
      expect(sorted[3].port).toBe(3000);
    });

    it('should sort by directory ascending', () => {
      const sorted = sortPorts(mockPorts, 'directory', 'asc');

      expect(sorted[0].directory).toBe('/Users/test/projectA');
      expect(sorted[1].directory).toBe('/Users/test/projectA');
      expect(sorted[2].directory).toBe('/Users/test/projectB');
      expect(sorted[3].directory).toBe('/Users/test/projectC');
    });

    it('should sort by command ascending', () => {
      const sorted = sortPorts(mockPorts, 'command', 'asc');

      expect(sorted[0].command).toBe('go');
      expect(sorted[1].command).toBe('node');
      expect(sorted[2].command).toBe('python');
      expect(sorted[3].command).toBe('ruby');
    });

    it('should sort by pid ascending', () => {
      const sorted = sortPorts(mockPorts, 'pid', 'asc');

      expect(sorted[0].pid).toBe(1);
      expect(sorted[1].pid).toBe(2);
      expect(sorted[2].pid).toBe(3);
      expect(sorted[3].pid).toBe(4);
    });

    it('should not mutate original array', () => {
      const original = [...mockPorts];
      sortPorts(mockPorts, 'port', 'desc');

      expect(mockPorts).toEqual(original);
    });
  });

  describe('sort and group interaction', () => {
    it('should sort within groups when sorting by port', () => {
      const sorted = sortPorts(mockPorts, 'port', 'asc');
      const grouped = groupByDirectory(sorted);

      const projectAPorts = grouped.get('/Users/test/projectA')!;
      expect(projectAPorts[0].port).toBe(3000);
      expect(projectAPorts[1].port).toBe(4000);
    });

    it('should sort groups when sorting by directory', () => {
      const sorted = sortPorts(mockPorts, 'directory', 'desc');
      const grouped = groupByDirectory(sorted);

      const directories = Array.from(grouped.keys());
      expect(directories[0]).toBe('/Users/test/projectC');
      expect(directories[1]).toBe('/Users/test/projectB');
      expect(directories[2]).toBe('/Users/test/projectA');
    });
  });
});
