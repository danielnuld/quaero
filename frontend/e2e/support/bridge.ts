// Installs the bridge the frontend expects, backed by the real core.
//
// src/utils/transport.ts calls exactly one global:
//
//     globalThis.quaeroRpc(requestJson) -> Promise<response>
//
// The native shell binds it to the webview host; here it forwards to a live
// quaero-rpc process. Nothing in production changes: hasBridge() already tolerates
// the global being absent, which is what `pnpm dev` relies on.

import type { Page } from "@playwright/test";
import type { RpcClient } from "./rpc";

/** Name of the Node function exposed into the page. Prefixed to avoid clashes. */
const EXPOSED = "__quaeroE2eBridge";

export async function installBridge(page: Page, rpc: RpcClient): Promise<void> {
  await page.exposeFunction(EXPOSED, async (requestJson: string) => {
    // Returning the parsed object mirrors the native shell, whose webview_return
    // already JSON-parses the value. transport.ts accepts either shape, and this
    // stays on the shape the real thing uses.
    return rpc.forward(requestJson);
  });

  await page.addInitScript(
    ({ exposed }) => {
      const host = globalThis as unknown as Record<string, unknown>;
      host.quaeroRpc = (requestJson: string): Promise<unknown> => {
        const fn = host[exposed] as (raw: string) => Promise<unknown>;
        return fn(requestJson);
      };
    },
    { exposed: EXPOSED },
  );
}
