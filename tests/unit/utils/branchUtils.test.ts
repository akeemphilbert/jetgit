import {
  groupBranches,
  getBranchDisplayName,
  filterBranchesByType,
  findBranchByName,
  getActiveBranch,
  validateBranchName
} from '../../../src/utils/branchUtils';
import { Branch } from '../../../src/types/git';

describe('branchUtils', () => {
  const mockBranches: Branch[] = [
    {
      name: 'main',
      fullName: 'main',
      type: 'local',
      isActive: true
    },
    {
      name: 'auth-system',
      fullName: 'feature/auth-system',
      type: 'local',
      isActive: false
    },
    {
      name: 'user-profile',
      fullName: 'feature/user-profile',
      type: 'local',
      isActive: false
    },
    {
      name: 'login-issue',
      fullName: 'bugfix/login-issue',
      type: 'local',
      isActive: false
    },
    {
      name: 'critical-patch',
      fullName: 'hotfix/critical-patch',
      type: 'local',
      isActive: false
    },
    {
      name: 'develop',
      fullName: 'origin/develop',
      type: 'remote',
      isActive: false
    },
    {
      name: 'main',
      fullName: 'origin/main',
      type: 'remote',
      isActive: false
    }
  ];

  describe('groupBranches', () => {
    it('should group branches by common prefixes', () => {
      const branches = [
        { name: 'feature/auth', fullName: 'feature/auth', type: 'local' as const, isActive: false },
        { name: 'feature/ui', fullName: 'feature/ui', type: 'local' as const, isActive: false },
        { name: 'bugfix/login', fullName: 'bugfix/login', type: 'local' as const, isActive: false },
        { name: 'main', fullName: 'main', type: 'local' as const, isActive: true }
      ];

      const result = groupBranches(branches);

      expect(result.groups).toHaveLength(2);
      expect(result.groups[0].prefix).toBe('bugfix/');
      expect(result.groups[0].branches).toHaveLength(1);
      expect(result.groups[1].prefix).toBe('feature/');
      expect(result.groups[1].branches).toHaveLength(2);
      expect(result.ungrouped).toHaveLength(1);
      expect(result.ungrouped[0].name).toBe('main');
    });

    it('should handle branches without common prefixes', () => {
      const branches = [
        { name: 'main', fullName: 'main', type: 'local' as const, isActive: true },
        { name: 'develop', fullName: 'develop', type: 'local' as const, isActive: false },
        { name: 'staging', fullName: 'staging', type: 'local' as const, isActive: false }
      ];

      const result = groupBranches(branches);

      expect(result.groups).toHaveLength(0);
      expect(result.ungrouped).toHaveLength(3);
      expect(result.ungrouped[0].name).toBe('main'); // Active branch first
    });

    it('should sort branches within groups alphabetically', () => {
      const branches = [
        { name: 'feature/zebra', fullName: 'feature/zebra', type: 'local' as const, isActive: false },
        { name: 'feature/alpha', fullName: 'feature/alpha', type: 'local' as const, isActive: false },
        { name: 'feature/beta', fullName: 'feature/beta', type: 'local' as const, isActive: false }
      ];

      const result = groupBranches(branches);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].branches[0].name).toBe('feature/alpha');
      expect(result.groups[0].branches[1].name).toBe('feature/beta');
      expect(result.groups[0].branches[2].name).toBe('feature/zebra');
    });

    it('should put active branch first in ungrouped branches', () => {
      const branches = [
        { name: 'zebra', fullName: 'zebra', type: 'local' as const, isActive: false },
        { name: 'main', fullName: 'main', type: 'local' as const, isActive: true },
        { name: 'alpha', fullName: 'alpha', type: 'local' as const, isActive: false }
      ];

      const result = groupBranches(branches);

      expect(result.ungrouped[0].name).toBe('main');
      expect(result.ungrouped[0].isActive).toBe(true);
    });

    it('should handle custom prefixes', () => {
      const branches = [
        { name: 'custom/branch1', fullName: 'custom/branch1', type: 'local' as const, isActive: false },
        { name: 'custom/branch2', fullName: 'custom/branch2', type: 'local' as const, isActive: false }
      ];

      const result = groupBranches(branches);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].prefix).toBe('custom/');
      expect(result.groups[0].branches).toHaveLength(2);
    });

    it('should handle empty branch array', () => {
      const result = groupBranches([]);

      expect(result.groups).toHaveLength(0);
      expect(result.ungrouped).toHaveLength(0);
    });
  });

  describe('getBranchDisplayName', () => {
    it('should return full name when not grouped', () => {
      const branch = { name: 'feature/auth', fullName: 'feature/auth', type: 'local' as const, isActive: false };
      
      const result = getBranchDisplayName(branch, false);
      
      expect(result).toBe('feature/auth');
    });

    it('should return name without prefix when grouped', () => {
      const branch = { name: 'feature/auth', fullName: 'feature/auth', type: 'local' as const, isActive: false };
      
      const result = getBranchDisplayName(branch, true);
      
      expect(result).toBe('auth');
    });

    it('should return full name when grouped but no prefix found', () => {
      const branch = { name: 'main', fullName: 'main', type: 'local' as const, isActive: false };
      
      const result = getBranchDisplayName(branch, true);
      
      expect(result).toBe('main');
    });
  });

  describe('filterBranchesByType', () => {
    it('should filter local branches', () => {
      const result = filterBranchesByType(mockBranches, 'local');
      
      expect(result).toHaveLength(5);
      expect(result.every(branch => branch.type === 'local')).toBe(true);
    });

    it('should filter remote branches', () => {
      const result = filterBranchesByType(mockBranches, 'remote');
      
      expect(result).toHaveLength(2);
      expect(result.every(branch => branch.type === 'remote')).toBe(true);
    });

    it('should handle empty array', () => {
      const result = filterBranchesByType([], 'local');
      
      expect(result).toHaveLength(0);
    });
  });

  describe('findBranchByName', () => {
    it('should find branch by name', () => {
      const result = findBranchByName(mockBranches, 'main');
      
      expect(result).toBeDefined();
      expect(result!.name).toBe('main');
      expect(result!.type).toBe('local');
    });

    it('should find branch by full name', () => {
      const result = findBranchByName(mockBranches, 'origin/develop');
      
      expect(result).toBeDefined();
      expect(result!.name).toBe('develop');
      expect(result!.fullName).toBe('origin/develop');
    });

    it('should return undefined when branch not found', () => {
      const result = findBranchByName(mockBranches, 'non-existent');
      
      expect(result).toBeUndefined();
    });

    it('should handle empty array', () => {
      const result = findBranchByName([], 'main');
      
      expect(result).toBeUndefined();
    });
  });

  describe('getActiveBranch', () => {
    it('should return the active branch', () => {
      const result = getActiveBranch(mockBranches);
      
      expect(result).toBeDefined();
      expect(result!.name).toBe('main');
      expect(result!.isActive).toBe(true);
    });

    it('should return undefined when no active branch', () => {
      const branchesWithoutActive = mockBranches.map(branch => ({ ...branch, isActive: false }));
      
      const result = getActiveBranch(branchesWithoutActive);
      
      expect(result).toBeUndefined();
    });

    it('should handle empty array', () => {
      const result = getActiveBranch([]);
      
      expect(result).toBeUndefined();
    });
  });

  describe('validateBranchName', () => {
    it('should validate correct branch names', () => {
      const validNames = [
        'main',
        'feature/auth',
        'bugfix/login-issue',
        'release/v1.0.0',
        'user_feature',
        'test-branch'
      ];

      validNames.forEach(name => {
        const result = validateBranchName(name);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject empty or whitespace-only names', () => {
      const invalidNames = ['', '   ', '\t', '\n'];

      invalidNames.forEach(name => {
        const result = validateBranchName(name);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Branch name cannot be empty');
      });
    });

    it('should reject names with spaces', () => {
      const result = validateBranchName('branch with spaces');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Branch name contains invalid characters');
    });

    it('should reject names with double dots', () => {
      const result = validateBranchName('branch..name');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Branch name contains invalid characters');
    });

    it('should reject names starting with dot', () => {
      const result = validateBranchName('.branch');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Branch name contains invalid characters');
    });

    it('should reject names ending with dot', () => {
      const result = validateBranchName('branch.');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Branch name contains invalid characters');
    });

    it('should reject names with slash-dot patterns', () => {
      const invalidNames = ['branch/.name', 'branch./name'];

      invalidNames.forEach(name => {
        const result = validateBranchName(name);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Branch name contains invalid characters');
      });
    });

    it('should reject names that are just a slash', () => {
      const result = validateBranchName('/');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Branch name cannot be just a slash');
    });

    it('should reject names starting or ending with slash', () => {
      const invalidNames = ['/branch', 'branch/'];

      invalidNames.forEach(name => {
        const result = validateBranchName(name);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Branch name cannot start or end with slash');
      });
    });

    it('should reject names with consecutive slashes', () => {
      const result = validateBranchName('branch//name');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Branch name cannot contain consecutive slashes');
    });

    it('should handle trimming whitespace', () => {
      const result = validateBranchName('  valid-branch  ');
      
      expect(result.isValid).toBe(true);
    });
  });
});