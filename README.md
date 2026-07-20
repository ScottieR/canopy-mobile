# Canopy Mobile

**A secure mobile companion for the local-first [Canopy](https://github.com/ScottieR/canopy) agent platform.**

> **Evaluation-only source license:** This repository is publicly available for portfolio and recruiting review. You may clone, build, and run it locally only to evaluate the author's qualifications. Commercial use, production use, redistribution, public deployment, and derivative products are prohibited. See [LICENSE](LICENSE).

Canopy Mobile pairs with the Canopy desktop app over the local network. It gives an authorized companion device access to the agents, conversations, forums, live voice sessions, sensor controls, and mini apps explicitly shared by the desktop owner.

> **Project status:** active portfolio preview. The app is under development and is not intended for production use or exposure outside a trusted local network.

## Highlights

- **QR pairing** — scan a short-lived pairing payload created by Canopy Desktop.
- **Encrypted dispatch** — the pairing token proves possession through a challenge-response exchange and derives an encrypted session key; the token is never sent over the LAN socket.
- **Scoped access** — desktop companion assignments determine the profile, experience, and agents visible on a device.
- **Mobile conversations** — each device uses its own agent conversation session rather than mirroring whichever desktop thread happens to be open.
- **Live voice and shortcuts** — launch agent voice sessions from the app or an iOS Shortcut.
- **Sandboxed mini apps** — generated HTML runs in a navigation-locked WebView with a deny-by-default Content Security Policy and a bounded message bridge.

## Prerequisites

- Node.js 22.12 or newer
- npm
- A recent iOS or Android simulator, or a device supported by Expo SDK 54
- Canopy Desktop running on a Mac reachable from the same local network

## Run locally

```bash
git clone https://github.com/ScottieR/canopy-mobile.git
cd canopy-mobile
npm ci
npm start
```

Use the Expo prompt to open the iOS simulator, Android emulator, or a compatible development device. In Canopy Desktop, open the mobile-companion pairing flow, then use the mobile app's scanner to scan the displayed QR code.

The mobile app is a companion rather than a standalone agent runtime. It will remain disconnected until it receives a valid pairing assignment from the desktop app.

## Security model

- Pairing data is stored in the platform secure store, not ordinary application storage.
- HMAC-SHA-256 proves possession of the pairing token against a server challenge.
- HKDF-SHA-256 derives a per-session key, and ChaCha20-Poly1305 authenticates and encrypts post-handshake messages.
- Directional monotonic counters reject replayed or out-of-order encrypted frames.
- Assignment revocation deletes the saved pairing data and stops automatic reconnection.
- Mini apps cannot make network requests, navigate away from `about:blank`, submit forms, load frames, or access external media.

These controls protect the mobile/desktop channel, but they do not make an untrusted LAN safe for unrelated services. Keep the desktop dispatch server scoped to its intended local network and revoke companion assignments that are no longer needed.

## Validation

```bash
npm test
npm run typecheck
npm audit --audit-level=high
```

The regression suite covers the cross-platform dispatch cryptography vectors, invalid challenge handling, mini-app Content Security Policy and navigation restrictions, and inbox action behavior. CI runs these checks on Node.js 22 and scans the complete Git history for secrets.

## Repository map

```text
app/                       Expo Router screens and navigation
components/                Shared UI and sandboxed mini-app renderer
context/                   Desktop dispatch and live-voice protocols
security/                  Pairing proof and encrypted-session primitives
__tests__/                 Node-based security and behavior regressions
assets/                    App icons, splash art, and bundled fonts
.github/workflows/         Security and regression CI
```

## License

Copyright © 2026 Scottie Ryan. All rights reserved.

Canopy Mobile is source-available solely for portfolio and recruiting evaluation; it is not open-source software. The limited permission and prohibited uses are stated in [LICENSE](LICENSE).
