# Progressive review benchmark

Chromium, 8 logical CPUs, six single-thread workers, MultiPV 2. Times include import through the indicated stage. Each progressive result is the median of three runs. Serious agreement uses the union of serious labels in the reference and result; `n` is the count of serious labels in the depth-20 reference. The miniature has only one reference serious label.

| Game | Preview time | Final time | Preview serious (n) | Preview all | Final serious (n) | Final all |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 50 plies | 8.28s | 108.16s | 37.5% (6) | 46.0% | 42.9% (6) | 58.0% |
| 60 plies | 8.64s | 105.31s | 27.3% (22) | 61.7% | 50.0% (22) | 66.7% |
| 7 plies | 2.77s | 14.07s | 100% (1) | 100% | 50.0% (1) | 71.4% |
| Combined | — | — | 32.3% (29) | 57.3% | 48.4% (29) | 63.2% |

The stored depth-16 baseline medians are 50.0% serious and 64.1% all-label agreement. The progressive result has the same 15 serious matches but one additional serious case in the union, and one fewer matching label overall; the sample is too small to establish that quality meets the baseline. The 60-ply preview meets the 12-second timing bar.

A single progressive pool depth-16 trial took 100.16s, 74.55s and 4.51s respectively, with 35.5% serious and 53.8% all-label agreement (n=29). A cold pool 2M-node trial took 70.06s, 86.32s and 14.07s, with 50.0% serious and 69.2% all-label agreement (n=29). The progressive 2M-node pool scored better than the measured progressive depth-16 pool, but its median did not establish the requested baseline quality gate.

Build with `VITE_REVIEW_BENCHMARK=1` before running `scripts/review-benchmark.mjs` to capture the preview. Detailed per-run counts and medians: `review-progressive-report.json`. Generate the report from three benchmark files with `node scripts/review-report.mjs run1.json run2.json run3.json`.
