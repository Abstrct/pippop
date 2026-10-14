// Pip Pop's Vite config for the private devnet: the real relay (public https guilds only) swapped
// for relay-shim.mjs, which serves the same /__relay/* routes against the local mock guild and
// refuses anything non-local. HMR off so a reload never lands in the middle of a transaction.
import base from '../vite.config.ts';
import { devnetRelayPlugin } from './relay-shim.mjs';

export default {
  ...base,
  plugins: [...(base.plugins || []).flat().filter((p) => p && p.name !== 'pippop-relay' && p.name !== 'wyrmhold-relay'), devnetRelayPlugin()],
  server: { ...(base.server || {}), hmr: false },
};
