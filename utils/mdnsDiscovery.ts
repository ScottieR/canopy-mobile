import Zeroconf, { ZeroconfService } from 'react-native-zeroconf';

export interface DiscoveredDesktop {
  ip: string;
  port: number;
}

// Matches _canopy-dispatch._tcp.local. advertised by src-tauri/src/dispatch.rs's
// start_mdns_advertisement(). type/protocol are passed separately from the
// domain by the Zeroconf API, so only "canopy-dispatch"/"tcp" is passed here.
const DISCOVERY_SERVICE_TYPE = 'canopy-dispatch';
const DISCOVERY_TIMEOUT_MS = 8_000;

/**
 * Browses the LAN for the Canopy Desktop's Bonjour/mDNS advertisement to
 * recover its current address after the IP stored at pairing time goes
 * stale (DHCP renewal, sleep/wake, network switch, router reboot).
 * Resolves null if nothing answers within the timeout, or if the native
 * Zeroconf module isn't available (e.g. running in Expo Go rather than a
 * dev client/EAS build).
 */
export function discoverDesktop(timeoutMs: number = DISCOVERY_TIMEOUT_MS): Promise<DiscoveredDesktop | null> {
  return new Promise((resolve) => {
    let settled = false;
    let zeroconf: Zeroconf;
    try {
      zeroconf = new Zeroconf();
    } catch (e) {
      console.warn('[mDNS] Zeroconf native module unavailable:', e);
      resolve(null);
      return;
    }

    const timer = setTimeout(() => finish(null), timeoutMs);

    function finish(result: DiscoveredDesktop | null) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      zeroconf.removeAllListeners();
      try {
        zeroconf.stop();
      } catch {
        // Native module may already be torn down; nothing to do.
      }
      resolve(result);
    }

    zeroconf.on('resolved', (service: ZeroconfService) => {
      const ip = service.addresses?.[0];
      if (ip && typeof service.port === 'number') {
        finish({ ip, port: service.port });
      }
    });
    zeroconf.on('error', (err: Error) => {
      console.warn('[mDNS] Discovery error:', err.message);
      finish(null);
    });

    zeroconf.scan(DISCOVERY_SERVICE_TYPE, 'tcp', 'local.');
  });
}
