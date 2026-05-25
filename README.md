# 🐍 Snake Clash: Retro RPG Duel

An endless, action-packed 2D multiplayer Snake game inspired by Nokia classic snake and styled with retro-modern RPG effects like *Guardian Tales*. Play locally, fight a smart bot offline, or connect online via WebRTC Room Codes!

---

## 🎮 Game Modes

1. **Lokal 2-Player (Offline)**: Share a single screen/keyboard and battle to see who survives longest.
2. **VS Bot AI (Offline)**: Play solo against a smart AI snake that actively pathfinds apples and shoots ice.
3. **Mabar Online (P2P Multiplayer)**: Host a lobby to get a 4-digit code. Your friend inputs the code to join instantly with low-latency WebRTC!

---

## 🕹️ Controls

### Keyboard Layout
- **Player 1 (Green/Cyan)**:
  - Direction: `W`, `A`, `S`, `D`
  - Action (Shoot Ice Beam): `Spacebar` / `Left Shift`
- **Player 2 (Pink/Orange)**:
  - Direction: `▲`, `◀`, `▼`, `▶` (Arrow keys)
  - Action (Shoot Ice Beam): `Enter` / `Right Control`

### Mobile Layout
- Virtual D-pads (circular controls) appear automatically on touch screens.
- **Client (P2)** can play using comfortable **`W`, `A`, `S`, `D` + `Spacebar`** key mappings on their own keyboard when connected online!

---

## 🍎 Items & Buffs

- 🍎 **Red Apple**: Standard food. Grows your snake by 1, scores 1 point.
- 🟡 **Golden Apple (Spawns every 10s)**: Gives a random effect:
  - 🛡️ **Invincible**: Glow golden. Bypasses walls (wrap-around) and other snake collisions for 8s.
  - 👻 **Ghost Mode**: Semi-transparent. Bypasses snake segments for 8s.
  - 🔥 **Speed Boost**: Move 2x faster with flame particle trails for 6s.
  - 🌟 **Giant**: Instantly grow +10 segments with larger scale for 8s.
  - ❄️ **Freeze Spell**: Get a 2-second window to aim and press the **Action Key** to fire a fast ice projectile. Hits freeze the opponent for 3.5s!
  - 🌀 **Confuse**: Inverts opponent directions for 5s.
- ⚡ **Lightning Apple**: Spawns when either player eats **150** red apples. Diminishes the opponent by **30%** length and shocks them (frozen 1.5s) using chain lightning!

---

## 🚀 How to Host & Play Online

This game is serverless and runs entirely in the browser using WebRTC (via PeerJS)!

1. Open the game in your browser.
2. Choose **Mabar Online (P2P)**.
3. **Host**: Click **Buat Room**. Share the generated 4-digit room code with your friend.
4. **Client**: Click **Masuk Room**, enter the 4-digit room code, and click **Hubungkan**.
5. The game will automatically start!

---

## 🌐 Deployment to GitHub Pages

To host this game online for free:
1. Push this project folder to a GitHub repository.
2. Go to **Settings -> Pages** in your GitHub repository.
3. Under **Build and deployment**, set Source to **Deploy from a branch**.
4. Choose branch `main` and folder `/ (root)`, then click **Save**.
5. In a few minutes, your game will be online at: `https://<your-username>.github.io/<your-repo-name>/`
