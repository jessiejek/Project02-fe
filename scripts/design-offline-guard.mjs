// Verification preload only; never imported by the application.
// Block outbound HTTP and TCP before Next loads any server-side data code.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';
const blocked = () => { throw new Error('Network disabled for offline design verification'); };
globalThis.fetch = async () => blocked();
http.get = blocked; http.request = blocked;
https.get = blocked; https.request = blocked;
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = args[0];
  const options = Array.isArray(first) ? first[0] : first;
  if (typeof options === 'number' || (typeof options === 'string' && /^\d+$/.test(options)) || (options && typeof options === 'object' && 'port' in options)) blocked();
  return connect.apply(this, args);
};
syncBuiltinESMExports();
