#!/usr/bin/env node

/**
 * Comprehensive test runner for JetGit extension
 * Runs all test suites and generates detailed reports
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestSuite {
  name: string;
  pattern: string;
  timeout: number;
  description: string;
}

interface TestResults {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}

class TestRunner {
  private results: TestResults[] = [];
  private startTime: number = Date.now();

  private testSuites: TestSuite[] = [
    {
      name: 'Unit Tests',
      pattern: 'tests/unit/**/*.test.ts',
      timeout: 30000,
      description: 'Unit tests for individual components and services'
    },
    {
      name: 'Integration Tests',
      pattern: 'tests/integration/**/*.test.ts',
      timeout: 60000,
      description: 'Integration tests for component interactions'
    },
    {
      name: 'End-to-End Tests',
      pattern: 'tests/e2e/**/*.test.ts',
      timeout: 120000,
      description: 'Complete workflow tests'
    },
    {
      name: 'Performance Tests',
      pattern: 'tests/performance/**/*.test.ts',
      timeout: 180000,
      description: 'Performance and load tests'
    }
  ];

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting JetGit Extension Test Suite');
    console.log('=====================================\n');

    for (const suite of this.testSuites) {
      await this.runTestSuite(suite);
    }

    this.generateSummaryReport();
    this.generateCoverageReport();
    
    const hasFailures = this.results.some(result => result.failed > 0);
    process.exit(hasFailures ? 1 : 0);
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`📋 Running ${suite.name}`);
    console.log(`   ${suite.description}`);
    console.log(`   Pattern: ${suite.pattern}`);
    console.log(`   Timeout: ${suite.timeout}ms\n`);

    const startTime = Date.now();
    
    try {
      const command = `npx jest --testPathPattern="${suite.pattern}" --timeout=${suite.timeout} --json --coverage`;
      const output = execSync(command, { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const result = JSON.parse(output);
      const duration = Date.now() - startTime;

      const testResult: TestResults = {
        suite: suite.name,
        passed: result.numPassedTests || 0,
        failed: result.numFailedTests || 0,
        skipped: result.numPendingTests || 0,
        duration,
        coverage: result.coverageMap ? this.extractCoverage(result.coverageMap) : undefined
      };

      this.results.push(testResult);
      this.printSuiteResults(testResult);

    } catch (error: any) {
      console.error(`❌ ${suite.name} failed to run:`);
      console.error(error.message);
      
      // Try to parse partial results
      try {
        const result = JSON.parse(error.stdout || '{}');
        const testResult: TestResults = {
          suite: suite.name,
          passed: result.numPassedTests || 0,
          failed: result.numFailedTests || 0,
          skipped: result.numPendingTests || 0,
          duration: Date.now() - startTime,
        };
        this.results.push(testResult);
        this.printSuiteResults(testResult);
      } catch {
        // If we can't parse results, record as complete failure
        this.results.push({
          suite: suite.name,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: Date.now() - startTime,
        });
      }
    }

    console.log(''); // Empty line for spacing
  }

  private printSuiteResults(result: TestResults): void {
    const total = result.passed + result.failed + result.skipped;
    const passRate = total > 0 ? ((result.passed / total) * 100).toFixed(1) : '0.0';
    
    console.log(`   ✅ Passed: ${result.passed}`);
    console.log(`   ❌ Failed: ${result.failed}`);
    console.log(`   ⏭️  Skipped: ${result.skipped}`);
    console.log(`   📊 Pass Rate: ${passRate}%`);
    console.log(`   ⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
    
    if (result.coverage) {
      console.log(`   📈 Coverage: ${result.coverage.statements}% statements, ${result.coverage.branches}% branches`);
    }
  }

  private extractCoverage(coverageMap: any): TestResults['coverage'] {
    // Extract coverage summary from Jest coverage map
    const summary = coverageMap.getCoverageSummary?.() || {};
    return {
      statements: summary.statements?.pct || 0,
      branches: summary.branches?.pct || 0,
      functions: summary.functions?.pct || 0,
      lines: summary.lines?.pct || 0,
    };
  }

  private generateSummaryReport(): void {
    const totalDuration = Date.now() - this.startTime;
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0);
    const totalTests = totalPassed + totalFailed + totalSkipped;
    const overallPassRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';

    console.log('📊 Test Summary Report');
    console.log('======================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`⏭️  Skipped: ${totalSkipped}`);
    console.log(`📈 Overall Pass Rate: ${overallPassRate}%`);
    console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s\n`);

    // Suite breakdown
    console.log('📋 Suite Breakdown:');
    this.results.forEach(result => {
      const total = result.passed + result.failed + result.skipped;
      const passRate = total > 0 ? ((result.passed / total) * 100).toFixed(1) : '0.0';
      console.log(`   ${result.suite}: ${result.passed}/${total} (${passRate}%)`);
    });
    console.log('');

    // Save results to file
    const reportPath = path.join(process.cwd(), 'test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      summary: {
        totalTests,
        passed: totalPassed,
        failed: totalFailed,
        skipped: totalSkipped,
        passRate: parseFloat(overallPassRate),
        duration: totalDuration
      },
      suites: this.results,
      timestamp: new Date().toISOString()
    }, null, 2));

    console.log(`📄 Detailed results saved to: ${reportPath}`);
  }

  private generateCoverageReport(): void {
    console.log('📈 Coverage Report');
    console.log('==================');
    
    const coverageResults = this.results.filter(r => r.coverage);
    
    if (coverageResults.length === 0) {
      console.log('No coverage data available\n');
      return;
    }

    // Calculate overall coverage (weighted average)
    const totalStatements = coverageResults.reduce((sum, r) => sum + (r.coverage?.statements || 0), 0);
    const totalBranches = coverageResults.reduce((sum, r) => sum + (r.coverage?.branches || 0), 0);
    const totalFunctions = coverageResults.reduce((sum, r) => sum + (r.coverage?.functions || 0), 0);
    const totalLines = coverageResults.reduce((sum, r) => sum + (r.coverage?.lines || 0), 0);
    
    const avgStatements = (totalStatements / coverageResults.length).toFixed(1);
    const avgBranches = (totalBranches / coverageResults.length).toFixed(1);
    const avgFunctions = (totalFunctions / coverageResults.length).toFixed(1);
    const avgLines = (totalLines / coverageResults.length).toFixed(1);

    console.log(`📊 Statements: ${avgStatements}%`);
    console.log(`🌿 Branches: ${avgBranches}%`);
    console.log(`🔧 Functions: ${avgFunctions}%`);
    console.log(`📝 Lines: ${avgLines}%\n`);

    // Coverage by suite
    console.log('📋 Coverage by Suite:');
    coverageResults.forEach(result => {
      if (result.coverage) {
        console.log(`   ${result.suite}: ${result.coverage.statements}% statements, ${result.coverage.branches}% branches`);
      }
    });
    console.log('');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

export { TestRunner };