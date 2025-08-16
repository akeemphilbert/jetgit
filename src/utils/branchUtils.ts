import { Branch, BranchGroup } from '../types/git';

/**
 * Utility functions for branch operations and grouping
 */

/**
 * Common branch prefixes that should be grouped together
 */
const COMMON_PREFIXES = [
    'feature/',
    'feat/',
    'bugfix/',
    'fix/',
    'hotfix/',
    'release/',
    'develop/',
    'dev/',
    'chore/',
    'docs/',
    'test/',
    'refactor/',
    'style/',
    'perf/',
    'ci/',
    'build/'
];

/**
 * Group branches by their prefixes for hierarchical display
 * @param branches Array of branches to group
 * @returns Array of branch groups with ungrouped branches
 */
export function groupBranches(branches: Branch[]): { groups: BranchGroup[], ungrouped: Branch[] } {
    const groups: Map<string, Branch[]> = new Map();
    const ungrouped: Branch[] = [];

    for (const branch of branches) {
        const prefix = findBranchPrefix(branch.name);
        
        if (prefix) {
            if (!groups.has(prefix)) {
                groups.set(prefix, []);
            }
            groups.get(prefix)!.push(branch);
        } else {
            ungrouped.push(branch);
        }
    }

    // Convert map to BranchGroup array
    const branchGroups: BranchGroup[] = Array.from(groups.entries()).map(([prefix, branchList]) => ({
        prefix,
        branches: branchList.sort((a, b) => a.name.localeCompare(b.name)),
        isCollapsed: false
    }));

    // Sort groups by prefix
    branchGroups.sort((a, b) => a.prefix.localeCompare(b.prefix));

    // Sort ungrouped branches
    ungrouped.sort((a, b) => {
        // Put active branch first
        if (a.isActive && !b.isActive) {
            return -1;
        }
        if (!a.isActive && b.isActive) {
            return 1;
        }
        
        // Then sort alphabetically
        return a.name.localeCompare(b.name);
    });

    return { groups: branchGroups, ungrouped };
}

/**
 * Find the prefix of a branch name if it matches common patterns
 * @param branchName The branch name to analyze
 * @returns The prefix if found, null otherwise
 */
function findBranchPrefix(branchName: string): string | null {
    for (const prefix of COMMON_PREFIXES) {
        if (branchName.startsWith(prefix)) {
            return prefix;
        }
    }

    // Check for custom prefixes (any word followed by a slash)
    const customPrefixMatch = branchName.match(/^([a-zA-Z0-9_-]+)\//);
    if (customPrefixMatch) {
        const customPrefix = customPrefixMatch[1] + '/';
        // Only group if there would be multiple branches with this prefix
        // This is a simple heuristic - in practice, you might want to do a second pass
        return customPrefix;
    }

    return null;
}

/**
 * Get the display name for a branch (removes prefix for grouped branches)
 * @param branch The branch to get display name for
 * @param isGrouped Whether the branch is displayed within a group
 * @returns The display name
 */
export function getBranchDisplayName(branch: Branch, isGrouped: boolean = false): string {
    if (!isGrouped) {
        return branch.name;
    }

    const prefix = findBranchPrefix(branch.name);
    if (prefix && branch.name.startsWith(prefix)) {
        return branch.name.substring(prefix.length);
    }

    return branch.name;
}

/**
 * Filter branches by type (local or remote)
 * @param branches Array of branches to filter
 * @param type The type to filter by
 * @returns Filtered branches
 */
export function filterBranchesByType(branches: Branch[], type: 'local' | 'remote'): Branch[] {
    return branches.filter(branch => branch.type === type);
}

/**
 * Find a branch by name (supports both short name and full name)
 * @param branches Array of branches to search
 * @param name The branch name to find
 * @returns The found branch or undefined
 */
export function findBranchByName(branches: Branch[], name: string): Branch | undefined {
    return branches.find(branch => 
        branch.name === name || branch.fullName === name
    );
}

/**
 * Get the current active branch from a list of branches
 * @param branches Array of branches to search
 * @returns The active branch or undefined
 */
export function getActiveBranch(branches: Branch[]): Branch | undefined {
    return branches.find(branch => branch.isActive);
}

/**
 * Validate branch name according to Git naming rules
 * @param name The branch name to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validateBranchName(name: string): { isValid: boolean; error?: string } {
    if (!name || name.trim() === '') {
        return { isValid: false, error: 'Branch name cannot be empty' };
    }

    const trimmedName = name.trim();

    // Git branch name rules
    const invalidPatterns = [
        /\s/, // No spaces
        /\.\./, // No double dots
        /^\./, // Cannot start with dot
        /\.$/, // Cannot end with dot
        /\/\./, // No slash-dot
        /\.\// // No dot-slash
    ];

    for (const pattern of invalidPatterns) {
        if (pattern.test(trimmedName)) {
            return { isValid: false, error: 'Branch name contains invalid characters' };
        }
    }

    // Cannot be just a slash
    if (trimmedName === '/') {
        return { isValid: false, error: 'Branch name cannot be just a slash' };
    }

    // Cannot start or end with slash
    if (trimmedName.startsWith('/') || trimmedName.endsWith('/')) {
        return { isValid: false, error: 'Branch name cannot start or end with slash' };
    }

    // Cannot contain consecutive slashes
    if (trimmedName.includes('//')) {
        return { isValid: false, error: 'Branch name cannot contain consecutive slashes' };
    }

    return { isValid: true };
}