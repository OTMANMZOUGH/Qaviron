import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface TestStep {
    action: string;
    element?: string;
    data?: string;
    expected?: string;
}

interface TestCase {
    id: string;
    title: string;
    url: string;
    steps: TestStep[];
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface TestResult {
    id: string;
    title: string;
    status: 'PASS' | 'FAIL' | 'BLOCKED';
    confidence: number;
    screenshots: string[];
    error?: string;
    duration: number;
    timestamp: string;
}

export class WebTestExecutor {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private screenshotDir: string;
    private results: TestResult[] = [];

    constructor(screenshotDir: string = './screenshots') {
        this.screenshotDir = screenshotDir;
        this.ensureScreenshotDir();
    }

    private ensureScreenshotDir(): void {
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }
    }

    async initialize(headless: boolean = false): Promise<void> {
        console.log('🚀 Initializing browser...');
        this.browser = await chromium.launch({
            headless,
            args: ['--start-maximized']
        });
        this.page = await this.browser.newPage();
        console.log('✅ Browser ready');
    }

    async executeTestCase(testCase: TestCase): Promise<TestResult> {
        const startTime = Date.now();
        const screenshots: string[] = [];
        let status: 'PASS' | 'FAIL' | 'BLOCKED' = 'PASS';
        let error: string | undefined;
        let confidence = 100;

        console.log(`\n${'='.repeat(60)}`);
        console.log(`🧪 Executing: ${testCase.id} - ${testCase.title}`);
        console.log(`${'='.repeat(60)}`);

        try {
            if (!this.page) {
                throw new Error('Browser not initialized');
            }

            // Step 0: Navigate to URL
            console.log(`\n📍 Step 0: Navigate to ${testCase.url}`);
            await this.page.goto(testCase.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            const screenshot0 = await this.captureScreenshot(testCase.id, 0, 'navigate');
            screenshots.push(screenshot0);
            console.log('✅ Page loaded');

            // Execute each step
            for (let i = 0; i < testCase.steps.length; i++) {
                const step = testCase.steps[i];
                console.log(`\n📝 Step ${i + 1}: ${step.action}`);

                try {
                    await this.executeStep(step, i + 1);

                    // Capture screenshot after each step
                    const screenshotPath = await this.captureScreenshot(
                        testCase.id,
                        i + 1,
                        step.action.toLowerCase().replace(/\s+/g, '_')
                    );
                    screenshots.push(screenshotPath);

                    console.log(`✅ Step ${i + 1} completed`);
                } catch (stepError: any) {
                    console.log(`❌ Step ${i + 1} failed: ${stepError.message}`);
                    status = 'FAIL';
                    error = `Step ${i + 1} failed: ${stepError.message}`;
                    confidence = Math.max(0, confidence - 30);

                    // Capture failure screenshot
                    const failureScreenshot = await this.captureScreenshot(
                        testCase.id,
                        i + 1,
                        'FAILURE'
                    );
                    screenshots.push(failureScreenshot);
                    break;
                }
            }

        } catch (err: any) {
            status = 'BLOCKED';
            error = err.message;
            confidence = 0;
            console.log(`🚫 Test blocked: ${err.message}`);

            // Capture error screenshot
            if (this.page) {
                const errorScreenshot = await this.captureScreenshot(testCase.id, 999, 'ERROR');
                screenshots.push(errorScreenshot);
            }
        }

        const duration = Date.now() - startTime;
        const result: TestResult = {
            id: testCase.id,
            title: testCase.title,
            status,
            confidence,
            screenshots,
            error,
            duration,
            timestamp: new Date().toISOString()
        };

        this.results.push(result);

        // Print result summary
        const statusEmoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '🚫';
        console.log(`\n${statusEmoji} TEST ${status} - ${testCase.id}`);
        console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
        console.log(`🎯 Confidence: ${confidence}%`);
        console.log(`📸 Screenshots: ${screenshots.length}`);

        return result;
    }

    private async executeStep(step: TestStep, stepNumber: number): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');

        const action = step.action.toLowerCase();

        // Navigate
        if (action.includes('navigate') || action.includes('goto') || action.includes('open')) {
            if (step.data) {
                await this.page.goto(step.data, { waitUntil: 'domcontentloaded' });
            }
            return;
        }

        // Wait for element to be visible
        if (step.element) {
            await this.page.waitForSelector(step.element, { state: 'visible', timeout: 10000 });
        }

        // Click
        if (action.includes('click')) {
            if (!step.element) throw new Error('No element specified for click action');
            await this.page.click(step.element);
            await this.page.waitForTimeout(1000); // Wait for potential navigation/animation
            return;
        }

        // Fill / Type / Enter text
        if (action.includes('fill') || action.includes('type') || action.includes('enter') || action.includes('input')) {
            if (!step.element) throw new Error('No element specified for fill action');
            if (!step.data) throw new Error('No data specified for fill action');
            await this.page.fill(step.element, step.data);
            return;
        }

        // Select dropdown
        if (action.includes('select')) {
            if (!step.element) throw new Error('No element specified for select action');
            if (!step.data) throw new Error('No data specified for select action');
            await this.page.selectOption(step.element, step.data);
            return;
        }

        // Check checkbox/radio
        if (action.includes('check')) {
            if (!step.element) throw new Error('No element specified for check action');
            await this.page.check(step.element);
            return;
        }

        // Uncheck checkbox
        if (action.includes('uncheck')) {
            if (!step.element) throw new Error('No element specified for uncheck action');
            await this.page.uncheck(step.element);
            return;
        }

        // Wait
        if (action.includes('wait')) {
            const seconds = parseInt(step.data || '2');
            await this.page.waitForTimeout(seconds * 1000);
            return;
        }

        // Verify / Assert
        if (action.includes('verify') || action.includes('assert') || action.includes('check')) {
            if (!step.element) throw new Error('No element specified for verification');
            if (!step.expected) throw new Error('No expected value specified for verification');

            const element = await this.page.$(step.element);
            if (!element) throw new Error(`Element not found: ${step.element}`);

            const actualText = await element.textContent();
            if (!actualText?.includes(step.expected)) {
                throw new Error(`Verification failed. Expected: "${step.expected}", Actual: "${actualText}"`);
            }
            return;
        }

        // Scroll
        if (action.includes('scroll')) {
            if (step.element) {
                await this.page.locator(step.element).scrollIntoViewIfNeeded();
            } else {
                await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            }
            return;
        }

        throw new Error(`Unknown action: ${action}`);
    }

    private async captureScreenshot(testId: string, stepNumber: number, description: string): Promise<string> {
        if (!this.page) throw new Error('Page not initialized');

        const filename = `${testId}_step${stepNumber}_${description}.png`;
        const filepath = path.join(this.screenshotDir, filename);

        await this.page.screenshot({
            path: filepath,
            fullPage: true
        });

        console.log(`📸 Screenshot saved: ${filename}`);
        return filepath;
    }

    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            console.log('\n🔚 Browser closed');
        }
    }

    getResults(): TestResult[] {
        return this.results;
    }

    generateMarkdownReport(): string {
        let report = '# 🧪 Web Test Execution Report\n\n';
        report += `**Generated:** ${new Date().toLocaleString()}\n\n`;
        report += `**Total Tests:** ${this.results.length}\n`;

        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;
        const blocked = this.results.filter(r => r.status === 'BLOCKED').length;

        report += `**Passed:** ✅ ${passed}\n`;
        report += `**Failed:** ❌ ${failed}\n`;
        report += `**Blocked:** 🚫 ${blocked}\n\n`;

        report += '---\n\n';
        report += '## Test Results\n\n';
        report += '| ID | Title | Status | Confidence | Duration | Screenshots |\n';
        report += '|----|-------|--------|------------|----------|-------------|\n';

        for (const result of this.results) {
            const statusEmoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '🚫';
            report += `| ${result.id} | ${result.title} | ${statusEmoji} ${result.status} | ${result.confidence}% | ${(result.duration / 1000).toFixed(2)}s | ${result.screenshots.length} |\n`;
        }

        report += '\n---\n\n';
        report += '## Detailed Results\n\n';

        for (const result of this.results) {
            const statusEmoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '🚫';
            report += `### ${statusEmoji} ${result.id}: ${result.title}\n\n`;
            report += `- **Status:** ${result.status}\n`;
            report += `- **Confidence:** ${result.confidence}%\n`;
            report += `- **Duration:** ${(result.duration / 1000).toFixed(2)}s\n`;
            report += `- **Timestamp:** ${result.timestamp}\n`;

            if (result.error) {
                report += `- **Error:** \`${result.error}\`\n`;
            }

            report += '\n**Screenshots:**\n\n';
            result.screenshots.forEach((screenshot, idx) => {
                const filename = path.basename(screenshot);
                report += `${idx + 1}. 📸 \`${filename}\`\n`;
            });

            report += '\n---\n\n';
        }

        return report;
    }

    async saveReport(filename: string = 'test-report.md'): Promise<void> {
        const report = this.generateMarkdownReport();
        fs.writeFileSync(filename, report);
        console.log(`\n📄 Report saved: ${filename}`);
    }
}
