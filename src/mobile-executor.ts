import { remote } from 'webdriverio';
import type { Browser } from 'webdriverio';
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
    appPath?: string;
    packageName?: string;
    activityName?: string;
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

interface MobileConfig {
    platform: 'Android' | 'iOS';
    deviceName: string;
    platformVersion?: string;
    appPath?: string;
    packageName?: string;
    activityName?: string;
    bundleId?: string;
}

export class MobileTestExecutor {
    private client: Browser | null = null;
    private screenshotDir: string;
    private results: TestResult[] = [];
    private config: MobileConfig;

    constructor(config: MobileConfig, screenshotDir: string = './screenshots') {
        this.config = config;
        this.screenshotDir = screenshotDir;
        this.ensureScreenshotDir();
    }

    private ensureScreenshotDir(): void {
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }
    }

    async initialize(): Promise<void> {
        console.log('🚀 Initializing Appium client...');

        const capabilities: any = {
            platformName: this.config.platform,
            'appium:deviceName': this.config.deviceName,
            'appium:automationName': this.config.platform === 'Android' ? 'UiAutomator2' : 'XCUITest',
        };

        if (this.config.platformVersion) {
            capabilities['appium:platformVersion'] = this.config.platformVersion;
        }

        if (this.config.platform === 'Android') {
            if (this.config.appPath) {
                capabilities['appium:app'] = this.config.appPath;
            }
            if (this.config.packageName) {
                capabilities['appium:appPackage'] = this.config.packageName;
            }
            if (this.config.activityName) {
                capabilities['appium:appActivity'] = this.config.activityName;
            }
        } else if (this.config.platform === 'iOS') {
            if (this.config.appPath) {
                capabilities['appium:app'] = this.config.appPath;
            }
            if (this.config.bundleId) {
                capabilities['appium:bundleId'] = this.config.bundleId;
            }
        }

        this.client = await remote({
            protocol: 'http',
            hostname: 'localhost',
            port: 4723,
            path: '/wd/hub',
            logLevel: 'error',
            capabilities
        });

        console.log('✅ Appium client ready');
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
            if (!this.client) {
                throw new Error('Appium client not initialized');
            }

            // Initial screenshot
            console.log('\n📱 Capturing initial screen state');
            const screenshot0 = await this.captureScreenshot(testCase.id, 0, 'initial');
            screenshots.push(screenshot0);

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
            if (this.client) {
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
        if (!this.client) throw new Error('Client not initialized');

        const action = step.action.toLowerCase();

        // Wait for element to exist
        if (step.element) {
            const element = await this.findElement(step.element);
            await element.waitForExist({ timeout: 10000 });
        }

        // Click / Tap
        if (action.includes('click') || action.includes('tap')) {
            if (!step.element) throw new Error('No element specified for click action');
            const element = await this.findElement(step.element);
            await element.click();
            await this.client.pause(1000); // Wait for potential transition
            return;
        }

        // Fill / Type / Enter text
        if (action.includes('fill') || action.includes('type') || action.includes('enter') || action.includes('input')) {
            if (!step.element) throw new Error('No element specified for fill action');
            if (!step.data) throw new Error('No data specified for fill action');
            const element = await this.findElement(step.element);
            await element.setValue(step.data);
            return;
        }

        // Clear text
        if (action.includes('clear')) {
            if (!step.element) throw new Error('No element specified for clear action');
            const element = await this.findElement(step.element);
            await element.clearValue();
            return;
        }

        // Swipe
        if (action.includes('swipe')) {
            const direction = step.data?.toLowerCase() || 'up';
            const { width, height } = await this.client.getWindowSize();

            if (direction === 'up') {
                await this.client.touchPerform([
                    { action: 'press', options: { x: width / 2, y: height * 0.8 } },
                    { action: 'wait', options: { ms: 100 } },
                    { action: 'moveTo', options: { x: width / 2, y: height * 0.2 } },
                    { action: 'release' }
                ]);
            } else if (direction === 'down') {
                await this.client.touchPerform([
                    { action: 'press', options: { x: width / 2, y: height * 0.2 } },
                    { action: 'wait', options: { ms: 100 } },
                    { action: 'moveTo', options: { x: width / 2, y: height * 0.8 } },
                    { action: 'release' }
                ]);
            } else if (direction === 'left') {
                await this.client.touchPerform([
                    { action: 'press', options: { x: width * 0.8, y: height / 2 } },
                    { action: 'wait', options: { ms: 100 } },
                    { action: 'moveTo', options: { x: width * 0.2, y: height / 2 } },
                    { action: 'release' }
                ]);
            } else if (direction === 'right') {
                await this.client.touchPerform([
                    { action: 'press', options: { x: width * 0.2, y: height / 2 } },
                    { action: 'wait', options: { ms: 100 } },
                    { action: 'moveTo', options: { x: width * 0.8, y: height / 2 } },
                    { action: 'release' }
                ]);
            }
            return;
        }

        // Wait
        if (action.includes('wait')) {
            const seconds = parseInt(step.data || '2');
            await this.client.pause(seconds * 1000);
            return;
        }

        // Verify / Assert
        if (action.includes('verify') || action.includes('assert') || action.includes('check')) {
            if (!step.element) throw new Error('No element specified for verification');
            if (!step.expected) throw new Error('No expected value specified for verification');

            const element = await this.findElement(step.element);
            const actualText = await element.getText();

            if (!actualText.includes(step.expected)) {
                throw new Error(`Verification failed. Expected: "${step.expected}", Actual: "${actualText}"`);
            }
            return;
        }

        // Scroll
        if (action.includes('scroll')) {
            if (step.element) {
                const element = await this.findElement(step.element);
                await element.scrollIntoView();
            } else {
                // Scroll to bottom
                await this.client.execute('mobile: scroll', { direction: 'down' });
            }
            return;
        }

        // Back button (Android)
        if (action.includes('back')) {
            if (this.config.platform === 'Android') {
                await this.client.back();
            }
            return;
        }

        throw new Error(`Unknown action: ${action}`);
    }

    private async findElement(selector: string) {
        if (!this.client) throw new Error('Client not initialized');

        // Accessibility ID (recommended)
        if (selector.startsWith('~')) {
            return await this.client.$(`~${selector.slice(1)}`);
        }
        // XPath
        else if (selector.startsWith('//') || selector.startsWith('(//')) {
            return await this.client.$(selector);
        }
        // ID
        else if (selector.includes(':id/')) {
            return await this.client.$(`id=${selector}`);
        }
        // Class name
        else if (selector.startsWith('.')) {
            return await this.client.$(selector.slice(1));
        }
        // Text (contains)
        else if (selector.startsWith('text=')) {
            const text = selector.slice(5);
            return await this.client.$(`//*[contains(@text, "${text}")]`);
        }
        // Default to accessibility ID
        else {
            return await this.client.$(`~${selector}`);
        }
    }

    private async captureScreenshot(testId: string, stepNumber: number, description: string): Promise<string> {
        if (!this.client) throw new Error('Client not initialized');

        const filename = `${testId}_step${stepNumber}_${description}.png`;
        const filepath = path.join(this.screenshotDir, filename);

        await this.client.saveScreenshot(filepath);

        console.log(`📸 Screenshot saved: ${filename}`);
        return filepath;
    }

    async close(): Promise<void> {
        if (this.client) {
            await this.client.deleteSession();
            console.log('\n🔚 Appium session closed');
        }
    }

    getResults(): TestResult[] {
        return this.results;
    }

    generateMarkdownReport(): string {
        let report = '# 📱 Mobile Test Execution Report\n\n';
        report += `**Platform:** ${this.config.platform}\n`;
        report += `**Device:** ${this.config.deviceName}\n`;
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

    async saveReport(filename: string = 'mobile-test-report.md'): Promise<void> {
        const report = this.generateMarkdownReport();
        fs.writeFileSync(filename, report);
        console.log(`\n📄 Report saved: ${filename}`);
    }
}
