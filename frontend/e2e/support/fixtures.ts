// The API every e2e test uses. Adding a case should be writing assertions, not
// wiring a harness.
//
//     import { describeEngine, test, expect } from "./support/fixtures";
//
//     describeEngine("postgres", () => {
//       test("reads a page of rows", async ({ app }) => {
//         await app.open();
//         ...
//       });
//     });

import { test as base, expect, type Page } from "@playwright/test";

import { installBridge } from "./bridge";
import { isRequired, statusOf } from "./availability";
import {
  engineByName,
  startHint,
  type EngineName,
  type EngineSpec,
} from "./engines";
import { startRpc, type RpcClient } from "./rpc";
import { reseed } from "./seed";
import { seedBrowserState, type Locale } from "./state";

export { expect };

/** What a test gets: the page, its engine, and the live core behind both. */
export interface App {
  readonly page: Page;
  readonly engine: EngineSpec;
  readonly rpc: RpcClient;
  /** Loads the interface with the bridge installed and state pinned. */
  open(): Promise<void>;
}

interface Options {
  engineName: EngineName;
  /** The interface language. Named uiLocale because Playwright reserves `locale`
      for the browser's own locale, and redeclaring it is an error. */
  uiLocale: Locale;
  /** Pre-save this engine's connection. A test covering the form turns it off. */
  seedConnection: boolean;
}

interface Fixtures {
  app: App;
}

interface WorkerFixtures {
  rpc: RpcClient;
}

export const test = base.extend<Options & Fixtures, WorkerFixtures>({
  engineName: ["sqlite", { option: true }],
  uiLocale: ["es", { option: true }],
  seedConnection: [true, { option: true }],

  // One core process per worker: starting it costs loading five plugins, and the
  // isolation tests need is of connections and data, not of processes. One binary
  // reaches every engine, because x86 is the architecture Quaero ships.
  rpc: [
    async ({}, use) => {
      const client = await startRpc();
      await use(client);
      await client.close();
    },
    { scope: "worker" },
  ],

  app: async ({ page, rpc, engineName, uiLocale, seedConnection }, use) => {
    const engine = engineByName(engineName);

    await installBridge(page, rpc);
    await seedBrowserState(page, {
      locale: uiLocale,
      connections: seedConnection ? [engine] : [],
    });

    // An unexpected error surfacing in the interface must fail the test rather than
    // be stepped over; a console error is the cheapest signal of that.
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    const app: App = {
      page,
      engine,
      rpc,
      async open() {
        await page.goto("/");
      },
    };

    await use(app);

    expect(consoleErrors, "the page reported no unexpected errors").toEqual([]);
  },
});

/**
 * A block of tests against one engine.
 *
 * Unavailable and not required -> skipped, with the reason and the command that
 * would make it available. Unavailable and required -> a failing test, so a CI job
 * cannot go green by testing nothing.
 */
export function describeEngine(name: EngineName, body: () => void): void {
  const status = statusOf(name);

  if (!status.available && isRequired(name)) {
    test.describe(name, () => {
      test(`engine '${name}' is required but unavailable`, () => {
        throw new Error(
          `${name} is listed in QUAERO_E2E_REQUIRE but is unavailable: ` +
            `${status.reason}. Start it with: ${startHint(name)}`,
        );
      });
    });
    return;
  }

  test.describe(name, () => {
    test.skip(
      !status.available,
      `${name} unavailable: ${status.reason}. Start it with: ${startHint(name)}`,
    );
    test.use({ engineName: name });

    // Every file rebuilds its fixture, so two runs in a row start identically no
    // matter what the previous one inserted or deleted.
    test.beforeAll(async ({ rpc }) => {
      await reseed(rpc, name);
    });

    body();
  });
}

/** Runs `body` for every engine, so one file covers the whole matrix. */
export function describeAllEngines(
  names: readonly EngineName[],
  body: (name: EngineName) => void,
): void {
  for (const name of names) {
    describeEngine(name, () => body(name));
  }
}
