import * as vscode from 'vscode';

/**
 * Performance monitoring data
 */
interface PerformanceData {
    operation: string;
    duration: number;
    timestamp: number;
    metadata?: Record<string, any>;
}

/**
 * Performance statistics
 */
interface PerformanceStats {
    operation: string;
    totalOperations: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    slowOperations: number; // Operations exceeding target
    recentOperations: PerformanceData[];
}

/**
 * Performance monitoring service for tracking Git operations
 * 
 * This service monitors performance of Git operations, particularly focusing
 * on the 150ms QuickPick open time requirement. It provides:
 * - Operation timing and statistics
 * - Performance alerts for slow operations
 * - Historical performance data
 * - Performance optimization recommendations
 * 
 * @example
 * ```typescript
 * const monitor = PerformanceMonitorService.getInstance();
 * const timer = monitor.startTimer('quickpick-open');
 * // ... perform operation
 * timer.end({ repositoryCount: 5 });
 * ```
 */
export class PerformanceMonitorService implements vscode.Disposable {
    private static instance: PerformanceMonitorService | undefined;
    private readonly _performanceData = new Map<string, PerformanceData[]>();
    private readonly _disposables: vscode.Disposable[] = [];
    
    // Performance targets (in milliseconds)
    private static readonly TARGETS = {
        'quickpick-open': 150,
        'branch-fetch': 100,
        'repository-refresh': 200,
        'cache-operation': 50
    };
    
    private static readonly MAX_HISTORY_SIZE = 100;
    
    private constructor() {
        // Set up periodic performance reporting
        const reportInterval = setInterval(() => {
            this.logPerformanceReport();
        }, 5 * 60 * 1000); // Every 5 minutes
        
        this._disposables.push({
            dispose: () => clearInterval(reportInterval)
        });
    }
    
    /**
     * Gets the singleton instance
     */
    public static getInstance(): PerformanceMonitorService {
        if (!PerformanceMonitorService.instance) {
            PerformanceMonitorService.instance = new PerformanceMonitorService();
        }
        return PerformanceMonitorService.instance;
    }
    
    /**
     * Starts a performance timer for an operation
     * 
     * @param operation - The operation name to track
     * @returns Timer object with end() method
     */
    public startTimer(operation: string): PerformanceTimer {
        const startTime = performance.now();
        
        return {
            end: (metadata?: Record<string, any>) => {
                const duration = performance.now() - startTime;
                this.recordOperation(operation, duration, metadata);
                return duration;
            }
        };
    }
    
    /**
     * Records a completed operation
     * 
     * @param operation - The operation name
     * @param duration - Duration in milliseconds
     * @param metadata - Optional metadata about the operation
     */
    public recordOperation(operation: string, duration: number, metadata?: Record<string, any>): void {
        const data: PerformanceData = {
            operation,
            duration,
            timestamp: Date.now(),
            metadata
        };
        
        if (!this._performanceData.has(operation)) {
            this._performanceData.set(operation, []);
        }
        
        const operationData = this._performanceData.get(operation)!;
        operationData.push(data);
        
        // Limit history size
        if (operationData.length > PerformanceMonitorService.MAX_HISTORY_SIZE) {
            operationData.shift();
        }
        
        // Check if operation exceeded target
        const target = PerformanceMonitorService.TARGETS[operation];
        if (target && duration > target) {
            this.logSlowOperation(operation, duration, target, metadata);
        }
    }
    
    /**
     * Gets performance statistics for an operation
     * 
     * @param operation - The operation name
     * @returns Performance statistics or undefined if no data
     */
    public getStats(operation: string): PerformanceStats | undefined {
        const data = this._performanceData.get(operation);
        if (!data || data.length === 0) {
            return undefined;
        }
        
        const durations = data.map(d => d.duration);
        const target = PerformanceMonitorService.TARGETS[operation] || Infinity;
        
        return {
            operation,
            totalOperations: data.length,
            averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            minDuration: Math.min(...durations),
            maxDuration: Math.max(...durations),
            slowOperations: durations.filter(d => d > target).length,
            recentOperations: data.slice(-10) // Last 10 operations
        };
    }
    
    /**
     * Gets all performance statistics
     */
    public getAllStats(): PerformanceStats[] {
        const stats: PerformanceStats[] = [];
        
        for (const operation of this._performanceData.keys()) {
            const operationStats = this.getStats(operation);
            if (operationStats) {
                stats.push(operationStats);
            }
        }
        
        return stats.sort((a, b) => b.totalOperations - a.totalOperations);
    }
    
    /**
     * Clears performance data for an operation or all operations
     * 
     * @param operation - Optional operation name to clear, clears all if not provided
     */
    public clearData(operation?: string): void {
        if (operation) {
            this._performanceData.delete(operation);
        } else {
            this._performanceData.clear();
        }
    }
    
    /**
     * Gets performance recommendations based on collected data
     */
    public getRecommendations(): string[] {
        const recommendations: string[] = [];
        const allStats = this.getAllStats();
        
        for (const stats of allStats) {
            const target = PerformanceMonitorService.TARGETS[stats.operation];
            if (!target) continue;
            
            const slowPercentage = (stats.slowOperations / stats.totalOperations) * 100;
            
            if (slowPercentage > 20) {
                recommendations.push(
                    `${stats.operation}: ${slowPercentage.toFixed(1)}% of operations exceed ${target}ms target (avg: ${stats.averageDuration.toFixed(1)}ms)`
                );
            }
            
            if (stats.averageDuration > target * 1.5) {
                recommendations.push(
                    `${stats.operation}: Average duration (${stats.averageDuration.toFixed(1)}ms) significantly exceeds target (${target}ms)`
                );
            }
        }
        
        return recommendations;
    }
    
    /**
     * Logs a slow operation warning
     */
    private logSlowOperation(operation: string, duration: number, target: number, metadata?: Record<string, any>): void {
        const metadataStr = metadata ? ` (${JSON.stringify(metadata)})` : '';
        console.warn(`Slow ${operation}: ${duration.toFixed(1)}ms (target: ${target}ms)${metadataStr}`);
    }
    
    /**
     * Logs periodic performance report
     */
    private logPerformanceReport(): void {
        const allStats = this.getAllStats();
        if (allStats.length === 0) {
            return;
        }
        
        console.log('=== JetGit Performance Report ===');
        
        for (const stats of allStats) {
            const target = PerformanceMonitorService.TARGETS[stats.operation];
            const targetStr = target ? ` (target: ${target}ms)` : '';
            const slowPercentage = target ? (stats.slowOperations / stats.totalOperations) * 100 : 0;
            
            console.log(
                `${stats.operation}: ${stats.totalOperations} ops, ` +
                `avg: ${stats.averageDuration.toFixed(1)}ms, ` +
                `range: ${stats.minDuration.toFixed(1)}-${stats.maxDuration.toFixed(1)}ms` +
                `${targetStr}` +
                (target && slowPercentage > 0 ? `, slow: ${slowPercentage.toFixed(1)}%` : '')
            );
        }
        
        const recommendations = this.getRecommendations();
        if (recommendations.length > 0) {
            console.log('Performance Recommendations:');
            recommendations.forEach(rec => console.log(`  - ${rec}`));
        }
        
        console.log('================================');
    }
    
    /**
     * Disposes of the service
     */
    public dispose(): void {
        this._disposables.forEach(disposable => disposable.dispose());
        this._disposables.length = 0;
        this._performanceData.clear();
        PerformanceMonitorService.instance = undefined;
    }
}

/**
 * Performance timer interface
 */
interface PerformanceTimer {
    end(metadata?: Record<string, any>): number;
}