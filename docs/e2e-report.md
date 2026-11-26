# End-to-end report

## Previously observed: offline reload renders a blank page

- Route: `/`
- Screen sizes: 390 × 844 (phone), 1024 × 768 (laptop), 1440 × 900 (desktop)
- Steps: Open the home page online, wait for the service worker to become ready and control the page, disconnect the browser, and reload.
- Expected: The cached home page renders and training remains available offline.
- Actual: The page is blank after reload. The learn-session portion cannot be reached in this run.
- Screenshots: `/tmp/chessmode-e2e/offline-phone.png`, `/tmp/chessmode-e2e/offline-laptop.png`, `/tmp/chessmode-e2e/offline-desktop.png`

This was observed before the offline PWA changes landed on main. The original test remains fixme as requested; main’s separate offline test is preserved as `pwa-offline.spec.ts`. The screenshots are local test artifacts and are not committed.

## Open: opening book masks a losing move in review

- Route: `/review/<imported-game>`
- Screen size observed: 390 × 844 (phone)
- Steps: Paste `1. f3 e5 2. g4 Qh4# 0-1` in Matches, open the completed review, and expand Moves and key moments.
- Expected: White's move allowing immediate mate is classified as a mistake or blunder and can be retried.
- Actual: Every move is labelled Book, including `g4`; White has zero mistakes and no retry action despite 26.9% accuracy.
- Screenshot: `/tmp/chessmode-e2e/fools-mate-book-phone.png`

The retry test is marked fixme pending a product decision on how book moves should be classified. Other screen sizes have not yet been verified for this issue.

## Run and remaining coverage

After rebasing onto the updated main, `npm run test:e2e` ran all projects together: 37 passed, 0 failed, and 2 fixme per size (111 passed, 6 fixme total). Main’s separate offline PWA test passed at all three sizes. The fixmes cover the offline shell and the Fool's Mate retry described above. Imports use fixtures unless `E2E_ONLINE=1` is set.

The suite covers the main training, study, import, settings, backup, navigation, and review entry flows. Arena and Puzzles are tested through entry after unlocking, not through a completed game or solved puzzle. The route-wide overflow and browser-error checks cover the static routes listed in `navigation.spec.ts`; they do not yet cover every parameterized route or every state. Community is checked for loading, and a successful mistake retry remains unverified. These gaps mean this is not yet exhaustive feature coverage.
