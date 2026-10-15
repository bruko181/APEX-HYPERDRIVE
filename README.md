# APEX HYPERDRIVE — RIVALS V4

A self-contained, original, browser-based WebGL2 racing prototype with a neon city circuit, a Bugatti-inspired hypercar, twelve competitive rivals, mobile touch controls, and a General Science physics laboratory.

## Installation
- **PC:** Extract the complete ZIP and open `index.html` in an up-to-date WebGL2-enabled browser (Chrome or Edge recommended). For best local asset loading, serve the folder using `python -m http.server 8000` and open `http://localhost:8000`.
- **Mobile:** Upload the contents of the separate `MOBILE_UPLOAD.zip` to a static web host. Open the HTTPS link on your phone in landscape orientation. Netlify Drop or another static host can serve this project.
- No JavaScript libraries or CDN dependencies are needed.

## PC controls
- **W / Up:** Accelerator
- **S / Down:** Brake
- **A / Left:** Steer left
- **D / Right:** Steer right
- **Shift / Space:** Nitro
- **Esc:** Pause / resume

## Mobile controls
Touch buttons for steering left/right, brake, accelerator, and nitro. ECO, STD, and HD rendering options are available. Mobile defaults to a lighter graphics setting.

## What's new in V4
1. **12 named competitors** with varying aggression, acceleration, top speed, tire grip, handling, and racing styles.
2. Opponent logic plans passing maneuvers, defends lane position, slows for upcoming corners, avoids nearby cars, and uses short nitro bursts where appropriate.
3. **Real leaderboard**, current race position (out of 13), current leader, nearest rival with meter gap, and rival status.
4. Opponents have continuous race progress, lap counts, individual lap times, and wheel rotation. Their positions change over time.
5. **Larger personalized photo livery** on the car's sloped rear glass and roof, plus a racing-HUD portrait displaying “I LOVE MY GIRLFRIEND.”
6. The existing stable camera, heading/yaw-based steering, collision-speed telemetry, building clearance, mobile layouts, and 15 physics validation comparisons are retained.
7. Live-position change feedback and a finishing-position result.

## Physics and assumptions
The interactive laboratory uses SI units and includes:
- `v = v₀ + at`
- `Δx = v₀t + ½at²`
- `ω = v/r`
- `θ = Δx/r`
- `I = mr²`, with a simplified thin-hoop wheel
- `aᶜ = v²/R`
- effective accelerating mass `M + 4I/r²` for the player car

The racing model is a simplified planar assisted driving model, not professional automotive vehicle dynamics. AI behavior is tactical arcade racing, not machine-learning AI.

## Quality assurance
Run (with Python and Playwright installed):
```
python qa/test_logic.py
python qa/test_regression.py
python qa/test_rivals.py
python qa/test_multilap.py
python qa/test_endurance.py
```
These tests use mock WebGL2 in the automated browser. They cover JavaScript and physics behavior, but **cannot verify actual GPU rendering quality, shader compilation on a specific device, or real FPS**. Test the game on your target Windows PC and phone before submission.

## Personal photo privacy
`assets/personalized_decal.png` contains a photograph and the message “I LOVE MY GIRLFRIEND.” If the project is hosted publicly, this file can also be publicly accessed. Obtain permission from the person pictured and use private sharing if needed.

## Credits
Original educational game code with AI-assisted development. The car is Bugatti-inspired rather than an officially licensed Bugatti vehicle. The project is not affiliated with Bugatti, Need for Speed, or Gran Turismo.
