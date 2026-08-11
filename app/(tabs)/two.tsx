import { Redirect } from 'expo-router';

// Superseded by app/pair.tsx — QR pairing is no longer a bottom tab (August
// 2026 mobile tab streamlining: see _layout.tsx, which also hides this route
// from the tab bar via `href: null`). This file is kept only as a redirect
// stub since this workspace doesn't allow deleting files; anything that
// still links here (old deep link, cached route, etc.) lands on the real
// pairing screen instead of a dead scanner tab.
export default function ScannerRedirect() {
  return <Redirect href="/pair" />;
}
