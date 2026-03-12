import { WebTestExecutor } from './web-executor';
import { MobileTestExecutor } from './mobile-executor';
import * as readline from 'readline';

interface TestStep {
    action: string;
    element?: string;
    data?: string;
    expected?: string;
}

interface WebTestCase {
    id: string;
    title: string;
    url: string;
    steps: TestStep[];
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface MobileTestCase {
    id: string;
    title: string;
    appPath?: string;
    packageName?: string;
    activityName?: string;
    steps: TestStep[];
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query: string): Promise<string> {
    return new Promise(resolve => rl.question(query, resolve));
}

async function runWebTests() {
    console.log('\n🌐 WEB TEST MODE\n');

    // Example test case - you can modify or add more
    const testCase: WebTestCase = {
        id: 'TC-001',
        title: 'User Login Test',
        url: 'https://example.com',
        priority: 'HIGH',
        steps: [
            {
                action: 'Fill email field',
                element: '#email',
                data: 'test@example.com'
            },
            {
                action: 'Fill password field',
                element: '#password',
                data: 'Password123'
            },
            {
                action: 'Click login button',
                element: '#login-btn'
            },
            {
                action: 'Verify dashboard heading',
                element: 'h1',
                expected: 'Dashboard'
            }
        ]
    };

    const executor = new WebTestExecutor('./screenshots/web');

    try {
        await executor.initialize(false); // false = show browser
        await executor.executeTestCase(testCase);
        await executor.saveReport('web-test-report.md');

        console.log('\n✅ Web test execution completed!');
        console.log('📄 Check web-test-report.md for details');
        console.log('📸 Screenshots saved in ./screenshots/web/');
    } catch (error: any) {
        console.error('❌ Error:', error.message);
    } finally {
        await executor.close();
    }
}

async function runMobileTests() {
    console.log('\n📱 MOBILE TEST MODE\n');

    const platform = await question('Platform (Android/iOS): ');
    const deviceName = await question('Device name (e.g., emulator-5554): ');
    const appPath = await question('App path (optional, press enter to skip): ');

    // Example test case
    const testCase: MobileTestCase = {
        id: 'TC-M001',
        title: 'Mobile Login Test',
        priority: 'HIGH',
        steps: [
            {
                action: 'Fill email field',
                element: '~emailInput',
                data: 'test@example.com'
            },
            {
                action: 'Fill password field',
                element: '~passwordInput',
                data: 'Password123'
            },
            {
                action: 'Click login button',
                element: '~loginButton'
            },
            {
                action: 'Wait',
                data: '3'
            },
            {
                action: 'Verify home screen',
                element: '~homeScreen',
                expected: 'Welcome'
            }
        ]
    };

    const executor = new MobileTestExecutor(
        {
            platform: platform as 'Android' | 'iOS',
            deviceName,
            appPath: appPath || undefined
        },
        './screenshots/mobile'
    );

    try {
        await executor.initialize();
        await executor.executeTestCase(testCase);
        await executor.saveReport('mobile-test-report.md');

        console.log('\n✅ Mobile test execution completed!');
        console.log('📄 Check mobile-test-report.md for details');
        console.log('📸 Screenshots saved in ./screenshots/mobile/');
    } catch (error: any) {
        console.error('❌ Error:', error.message);
    } finally {
        await executor.close();
    }
}

async function showMenu() {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   🤖 QAVIRON                             ║');
    console.log('╚════════════════════════════════════════════╝\n');
    console.log('Select test platform:');
    console.log('1. 🌐 Web Testing (Playwright)');
    console.log('2. 📱 Mobile Testing (Appium)');
    console.log('3. 🚀 Both (Web + Mobile)');
    console.log('4. ❌ Exit\n');

    const choice = await question('Enter your choice (1-4): ');

    switch (choice) {
        case '1':
            await runWebTests();
            break;
        case '2':
            await runMobileTests();
            break;
        case '3':
            await runWebTests();
            await runMobileTests();
            break;
        case '4':
            console.log('\n👋 Goodbye!');
            rl.close();
            process.exit(0);
        default:
            console.log('❌ Invalid choice');
    }

    rl.close();
}

// Run the agent
showMenu().catch(error => {
    console.error('Fatal error:', error);
    rl.close();
    process.exit(1);
});
