// react-native-zeroconf ships no TypeScript types of its own (confirmed by
// inspecting node_modules/react-native-zeroconf/dist/index.js — plain
// Babel-compiled JS, no .d.ts). This is a minimal shim covering only the
// surface mdnsDiscovery.ts actually uses.
declare module 'react-native-zeroconf' {
  import { EventEmitter } from 'events';

  export interface ZeroconfService {
    name: string;
    fullName?: string;
    host?: string;
    port: number;
    addresses: string[];
    txt?: Record<string, string>;
  }

  export default class Zeroconf extends EventEmitter {
    constructor();
    scan(type?: string, protocol?: string, domain?: string, implType?: string): void;
    stop(implType?: string): void;
    getServices(): Record<string, ZeroconfService>;
    publishService(
      type: string,
      protocol: string,
      domain: string | undefined,
      name: string,
      port: number,
      txt?: Record<string, string>,
      implType?: string
    ): void;
    unpublishService(name: string, implType?: string): void;
  }
}
