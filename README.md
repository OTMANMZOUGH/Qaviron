# 🤖 Qaviron

An intelligent test automation framework that **actually executes** your test cases on real websites and mobile apps!

## ✨ Features 

- 🌐 **Web Testing** - Automated testing using Playwright
- 📱 **Mobile Testing** - Android & iOS testing using Appium
- 📸 **Screenshot Capture** - Automatic screenshots at every step
- 📊 **Detailed Reports** - Markdown reports with pass/fail status
- 🎯 **Confidence Scoring** - AI-powered test confidence levels
- ⚡ **Real Execution** - Not just script generation, actual test execution!

## 🚀 Quick Start 

### Prerequisites

1. **Node.js 18+** installed
2. For **Web Testing**: Nothing else needed (Playwright auto-installs browsers)
3. For **Mobile Testing**:
   - Install [Appium](http://appium.io/): `npm install -g appium`
   - Start Appium server: `appium`
   - For Android: Android Studio + Emulator or real device
   - For iOS: Xcode + Simulator (macOS only)

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

### Run the Agent

```bash
npm run test:run
```

You'll see a menu:
```
╔════════════════════════════════════════════╗
║   🤖 AI TEST AUTOMATION AGENT            ║
╚════════════════════════════════════════════╝

Select test platform:
1. 🌐 Web Testing (Playwright)
2. 📱 Mobile Testing (Appium)
3. 🚀 Both (Web + Mobile)
4. ❌ Exit
```

## 📝 How to Use

### Method 1: Quick Test (Built-in Example)

Just run the agent and select option 1 or 2. It will execute a sample test case.

### Method 2: Custom Test Cases

Edit `src/index.ts` and modify the test case:

#### Web Test Example
```typescript
const testCase: WebTestCase = {
    id: 'TC-001',
    title: 'Login to Dashboard',
    url: 'https://your-app.com/login',
    priority: 'HIGH',
    steps: [
        {
            action: 'Fill email field',
            element: '#email',
            data: 'user@example.com'
        },
        {
            action: 'Fill password field',
            element: '#password',
            data: 'MyPassword123'
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
```

#### Mobile Test Example
```typescript
const testCase: MobileTestCase = {
    id: 'TC-M001',
    title: 'Mobile Login Flow',
    priority: 'HIGH',
    steps: [
        {
            action: 'Fill email field',
            element: '~emailInput',  // ~ = accessibility ID
            data: 'user@example.com'
        },
        {
            action: 'Click login button',
            element: '~loginButton'
        },
        {
            action: 'Verify home screen',
            element: '~homeScreen',
            expected: 'Welcome'
        }
    ]
};
```

## 🎯 Supported Actions

### Common Actions
- `Navigate` / `Goto` / `Open` - Navigate to URL
- `Click` / `Tap` - Click/tap element
- `Fill` / `Type` / `Enter` / `Input` - Enter text
- `Select` - Select dropdown option
- `Check` / `Uncheck` - Toggle checkbox
- `Wait` - Wait for seconds
- `Verify` / `Assert` / `Check` - Verify text content
- `Scroll` - Scroll to element or bottom

### Mobile-Specific Actions
- `Swipe` - Swipe up/down/left/right
- `Back` - Press back button (Android)
- `Clear` - Clear text field

## 🔍 Element Selectors

### Web (CSS/XPath)
```typescript
element: '#login-btn'          // ID
element: '.submit-button'      // Class
element: 'button[type="submit"]' // Attribute
element: '//button[@id="login"]' // XPath
```

### Mobile
```typescript
element: '~loginButton'        // Accessibility ID (recommended)
element: '//android.widget.Button[@text="Login"]' // XPath
element: 'com.app:id/login'   // Resource ID
element: 'text=Login'         // Text contains
```

## 📊 Output

After execution, you'll get:

1. **Console Output** - Real-time test execution logs
2. **Screenshots** - Saved in `./screenshots/` folder
3. **Markdown Report** - Full test report with:
   - ✅ Pass/Fail status
   - 🎯 Confidence score
   - ⏱️ Execution time
   - 📸 Screenshot links
   - ❌ Error details (if failed)

### Example Report

```markdown
# 🧪 Web Test Execution Report

**Total Tests:** 1
**Passed:** ✅ 1
**Failed:** ❌ 0

| ID | Title | Status | Confidence | Duration |
|----|-------|--------|------------|----------|
| TC-001 | Login Test | ✅ PASS | 100% | 3.45s |
```

## 🛠️ Configuration

### Web Browser Settings

Edit `src/web-executor.ts`:
```typescript
await executor.initialize(false); // false = show browser, true = headless
```

### Mobile Device Settings

When running mobile tests, you'll be prompted for:
- Platform (Android/iOS)
- Device name (e.g., `emulator-5554`, `iPhone 14 Pro`)
- App path (optional)

## 📁 Project Structure

```
qaviron/
├── src/
│   ├── index.ts           # Main entry point
│   ├── web-executor.ts    # Web test executor
│   └── mobile-executor.ts # Mobile test executor
├── screenshots/           # Auto-generated screenshots
│   ├── web/
│   └── mobile/
├── package.json
└── README.md
```

## 🎓 Example Use Cases

### Test Case 1: E-commerce Checkout
```typescript
{
    id: 'TC-002',
    title: 'Complete Purchase Flow',
    url: 'https://shop.example.com',
    steps: [
        { action: 'Click', element: '.product-card' },
        { action: 'Click', element: '#add-to-cart' },
        { action: 'Click', element: '#checkout' },
        { action: 'Fill', element: '#card-number', data: '4242424242424242' },
        { action: 'Click', element: '#submit-payment' },
        { action: 'Verify', element: '.success-message', expected: 'Order confirmed' }
    ]
}
```

### Test Case 2: Form Validation
```typescript
{
    id: 'TC-003',
    title: 'Contact Form Validation',
    url: 'https://example.com/contact',
    steps: [
        { action: 'Fill', element: '#name', data: 'John Doe' },
        { action: 'Fill', element: '#email', data: 'invalid-email' },
        { action: 'Click', element: '#submit' },
        { action: 'Verify', element: '.error', expected: 'Invalid email' }
    ]
}
```

## 🐛 Troubleshooting

### Web Tests
- **Browser doesn't open**: Run `npx playwright install`
- **Element not found**: Check selector syntax, try XPath
- **Timeout errors**: Increase timeout in `web-executor.ts`

### Mobile Tests
- **Appium connection failed**: Make sure Appium server is running (`appium`)
- **Device not found**:
  - Android: Check `adb devices`
  - iOS: Check `xcrun simctl list devices`
- **Element not found**: Use Appium Inspector to find correct selectors

## 🚀 Advanced Usage

### Add Multiple Test Cases

Create an array and loop through:
```typescript
const testCases = [testCase1, testCase2, testCase3];

for (const tc of testCases) {
    await executor.executeTestCase(tc);
}
```

### Custom Screenshot Directory
```typescript
const executor = new WebTestExecutor('./my-screenshots');
```

### Parse Test Cases from CSV/Excel
(Future feature - coming soon!)

## 📄 License

MIT

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

---

**Built with ❤️ using Playwright & Appium**
