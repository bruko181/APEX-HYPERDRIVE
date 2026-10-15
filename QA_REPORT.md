# RIVALS V4 — QA Report

## Test results

| Test suite | Outcome |
|---|---|
| Desktop and mobile startup/interactions | PASS; no page errors |
| Physics calculator | 15 / 15 manual comparisons matched |
| Steering yaw and heading | PASS |
| Collision speed vs angular velocity synchronization | PASS |
| Desktop, phone (390 px), narrow phone (320 px), landscape (844 × 390) controls | PASS |
| Entire course tower-clearance scan | PASS; sampled minimum ~25.55 m to tower footprint edge |
| AI overtaking decision | PASS — switched to open lane |
| AI defensive decision | PASS — defensive racer moved to guard against player |
| 12 rivals dynamic race order | PASS — rankings changed in 133-second simulation |
| 12 rivals finite AI state across simulation | PASS |
| Three consecutive full player laps | PASS; ~20.44 km, no JS errors |
| 216 course positions finite | PASS |
| High-speed physics checks | PASS |

## Remaining limitations
- WebGL2 was unavailable in the testing container, including attempts with SwiftShader. Screenshots of actual GPU-rendered 3D appearance cannot be verified here. The image is not a photorealistic car and performance on the user's device is unmeasured.
- Physics uses an assisted planar racing model and collision penalties rather than full rigid-body momentum, suspension, and vehicle damage.
- AI competitors use scripted decision policies and grip-limited speed planning, not professional racing AI. Their performance may need tuning based on player testing.
- The photo is projected on two 3D body surfaces with a separately rendered texture; how well it reads on particular phone screens still requires device testing.
- All public uploads expose the photo asset to whoever can fetch the deployed file.
- Passing tests do not establish absence of all possible bugs.
