# End-to-end report

## Open: offline reload renders a blank page

- Route: `/`
- Screen sizes: 390 × 844 (phone), 1024 × 768 (laptop), 1440 × 900 (desktop)
- Steps: Open the home page online, wait for the service worker to become ready and control the page, disconnect the browser, and reload.
- Expected: The cached home page renders and training remains available offline.
- Actual: The page is blank after reload. The learn-session portion cannot be reached in this run.
- Screenshots: `/tmp/chessmode-e2e/offline-phone.png`, `/tmp/chessmode-e2e/offline-laptop.png`, `/tmp/chessmode-e2e/offline-desktop.png`

The cause still needs investigation; the offline test is marked fixme while fix/offline-pwa is in progress. The screenshot is a local test artifact and is not committed.
