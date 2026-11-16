import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

// The mail server in the Management Console is typed by a person (super admin only), and the
// app then connects to it and reports what happened — which could be used to probe machines
// only the server can reach (ONBOARDING_SECURITY_PLAN.md Phase 6, finding 12). So: mail ports
// only, and never an internal, loopback, link-local or cloud-metadata address.

export class MailHostNotAllowedError extends Error {}

export const MAIL_PORTS = [25, 465, 587, 2525];

const internal = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local, incl. the metadata server 169.254.169.254
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
] as const) {
  internal.addSubnet(net, prefix, 'ipv4');
}
for (const [net, prefix] of [
  ['::', 127], // :: and ::1
  ['fc00::', 7],
  ['fe80::', 10],
] as const) {
  internal.addSubnet(net, prefix, 'ipv6');
}

export function isInternalAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return internal.check(address, 'ipv4');
  if (family === 6) {
    // IPv4-mapped (::ffff:10.0.0.1) counts as its IPv4 address.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    return mapped ? internal.check(mapped[1]!, 'ipv4') : internal.check(address, 'ipv6');
  }
  return true; // not an address at all
}

type Lookup = (host: string) => Promise<{ address: string }[]>;
const defaultLookup: Lookup = (host) => dnsLookup(host, { all: true });

/** Throws MailHostNotAllowedError unless `host:port` is a mail port on a public address. Every
 * address the name resolves to must be public. */
export async function assertPublicMailHost(host: string, port: number, lookup: Lookup = defaultLookup): Promise<void> {
  if (!MAIL_PORTS.includes(port)) {
    throw new MailHostNotAllowedError(`Port ${port} is not a mail port — use ${MAIL_PORTS.join(', ')}`);
  }
  const name = host.trim().replace(/^\[|\]$/g, '');
  let addresses: string[];
  if (isIP(name)) {
    addresses = [name];
  } else {
    try {
      addresses = (await lookup(name)).map((a) => a.address);
    } catch {
      throw new MailHostNotAllowedError(`The mail server "${host}" could not be found`);
    }
  }
  if (addresses.length === 0 || addresses.some(isInternalAddress)) {
    throw new MailHostNotAllowedError(`"${host}" is not a public mail server address`);
  }
}
