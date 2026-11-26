# End-to-end report

## Open: offline reload renders a blank page

- Route: `/`
- Screen size: 390 × 844 (phone)
- Steps: Open the home page online, wait for the service worker to become ready and control the page, disconnect the browser, and reload.
- Expected: The cached home page renders and training remains available offline.
- Actual: The page is blank after reload. The learn-session portion cannot be reached in this run.
- Screenshot: `/tmp/chessmode-e2e/offline-phone.png`

The other viewport sizes and the cause still need investigation. The screenshot is a local test artifact and is not committed.
