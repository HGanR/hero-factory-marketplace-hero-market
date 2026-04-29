# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: site-builder-parity.spec.ts >> site-builder static export (golden) >> static web3 desktop matches baseline
- Location: tests/playwright/site-builder-parity.spec.ts:75:9

# Error details

```
Error: browserType.launch: Executable doesn't exist at /var/folders/rv/nl19g5ws4l5677s1q3rt8_wm0000gn/T/cursor-sandbox-cache/032a7d50f361f4952f00c4126e375244/playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-x64/chrome-headless-shell
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║                                                            ║
║     npx playwright install                                 ║
║                                                            ║
║ <3 Playwright Team                                         ║
╚════════════════════════════════════════════════════════════╝
```