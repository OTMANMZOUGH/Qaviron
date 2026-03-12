import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { WebTestExecutor } from './web-executor';
import { MobileTestExecutor } from './mobile-executor';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/screenshots', express.static(path.join(__dirname, '../screenshots')));

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

// Store active test sessions
const activeSessions = new Map<string, any>();

// API Endpoints
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'AI Test Agent is running' });
});

app.post('/api/test/web', async (req, res) => {
    const { testCase, sessionId } = req.body;

    if (!testCase || !sessionId) {
        return res.status(400).json({ error: 'Missing testCase or sessionId' });
    }

    res.json({ message: 'Test execution started', sessionId });

    // Execute test in background
    executeWebTest(testCase, sessionId);
});

app.post('/api/test/mobile', async (req, res) => {
    const { testCase, config, sessionId } = req.body;

    if (!testCase || !config || !sessionId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    res.json({ message: 'Test execution started', sessionId });

    // Execute test in background
    executeMobileTest(testCase, config, sessionId);
});

app.get('/api/screenshots/:filename', (req, res) => {
    const filename = req.params.filename;
    res.sendFile(path.join(__dirname, '../screenshots', filename));
});

// WebSocket connection
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    socket.on('start-web-test', async (data) => {
        console.log('🚀 Starting web test:', data.testCase.id);
        await executeWebTest(data.testCase, socket.id);
    });

    socket.on('start-mobile-test', async (data) => {
        console.log('🚀 Starting mobile test:', data.testCase.id);
        await executeMobileTest(data.testCase, data.config, socket.id);
    });

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
        activeSessions.delete(socket.id);
    });
});

async function executeWebTest(testCase: WebTestCase, sessionId: string) {
    const executor = new WebTestExecutor('./screenshots/web');
    activeSessions.set(sessionId, executor);

    try {
        // Emit status update
        io.to(sessionId).emit('test-status', {
            status: 'initializing',
            message: '🚀 Initializing browser...'
        });

        await executor.initialize(false);

        io.to(sessionId).emit('test-status', {
            status: 'running',
            message: `🧪 Executing test: ${testCase.id}`
        });

        // Intercept console logs and emit them
        const originalLog = console.log;
        console.log = (...args) => {
            originalLog(...args);
            io.to(sessionId).emit('test-log', {
                message: args.join(' '),
                timestamp: new Date().toISOString()
            });
        };

        const result = await executor.executeTestCase(testCase);

        console.log = originalLog; // Restore original console.log

        // Generate report
        const report = executor.generateMarkdownReport();
        await executor.saveReport(`web-test-report-${testCase.id}.md`);

        io.to(sessionId).emit('test-complete', {
            result,
            report,
            screenshots: result.screenshots
        });

        await executor.close();

    } catch (error: any) {
        io.to(sessionId).emit('test-error', {
            error: error.message,
            stack: error.stack
        });

        if (executor) {
            await executor.close();
        }
    } finally {
        activeSessions.delete(sessionId);
    }
}

async function executeMobileTest(testCase: MobileTestCase, config: any, sessionId: string) {
    const executor = new MobileTestExecutor(config, './screenshots/mobile');
    activeSessions.set(sessionId, executor);

    try {
        io.to(sessionId).emit('test-status', {
            status: 'initializing',
            message: '🚀 Initializing Appium client...'
        });

        await executor.initialize();

        io.to(sessionId).emit('test-status', {
            status: 'running',
            message: `🧪 Executing test: ${testCase.id}`
        });

        // Intercept console logs
        const originalLog = console.log;
        console.log = (...args) => {
            originalLog(...args);
            io.to(sessionId).emit('test-log', {
                message: args.join(' '),
                timestamp: new Date().toISOString()
            });
        };

        const result = await executor.executeTestCase(testCase);

        console.log = originalLog;

        // Generate report
        const report = executor.generateMarkdownReport();
        await executor.saveReport(`mobile-test-report-${testCase.id}.md`);

        io.to(sessionId).emit('test-complete', {
            result,
            report,
            screenshots: result.screenshots
        });

        await executor.close();

    } catch (error: any) {
        io.to(sessionId).emit('test-error', {
            error: error.message,
            stack: error.stack
        });

        if (executor) {
            await executor.close();
        }
    } finally {
        activeSessions.delete(sessionId);
    }
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                                                        ║');
    console.log('║      🤖 AI TEST AUTOMATION AGENT - WEB PLATFORM       ║');
    console.log('║                                                        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    console.log(`🌐 Server running at: http://localhost:${PORT}`);
    console.log(`📡 WebSocket ready for real-time updates`);
    console.log(`📸 Screenshots available at: http://localhost:${PORT}/screenshots`);
    console.log('\n✨ Open your browser and start testing!\n');
});
