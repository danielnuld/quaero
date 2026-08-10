// The handful of interface actions every critical-path test needs, written once.
//
// Locators go by role, accessible name or the tooltip a user sees — never by CSS
// class for identity, which breaks on the next refactor and tests nothing anyone
// can perceive. Where the interface has no accessible handle at all, it is noted
// here and recorded as accessibility work in the change's tasks.md rather than
// papered over.

import { expect, type Page } from "@playwright/test";

import type { App } from "./fixtures";

/** Opens the saved connection through the sidebar, as a user would. */
export async function connect(app: App): Promise<void> {
  const { page, engine } = app;
  await page.getByRole("button", { name: "Elegir conexión" }).click();
  // Wait for the popover itself, not for time: the list renders inside it.
  await page.getByRole("button", { name: /Nueva conexión/ }).waitFor();
  await page.getByRole("button", { name: new RegExp(engine.label) }).click();
  // "Desconectar" only exists once a connection is open, so it is the signal.
  await page.getByRole("button", { name: "Desconectar" }).waitFor();
}

export async function disconnect(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Desconectar" }).click();
}

/**
 * Expands the tree down to the fixture table and opens its data tab.
 *
 * ACCESSIBILITY GAP: tree rows are plain <div>s with an onClick — no
 * role="treeitem", no tabIndex — so they cannot be reached by keyboard or by a
 * screen reader, and getByRole cannot see them. They do carry title={nodeLabel},
 * which is at least something a user perceives, so that is what these locators
 * use. Fixing the tree is recorded as task 2.12.
 */
export async function openFixtureTable(app: App): Promise<void> {
  const { page, engine } = app;
  const row = (name: string) => page.getByTitle(name, { exact: true }).first();
  const table = row("e2e_items");

  // Expand only what is still closed: PostgreSQL opens its active database for
  // you, and clicking an expanded node would collapse it again.
  for (const container of engine.treePath) {
    if (await table.count()) {
      break;
    }
    await row(container).waitFor();
    await row(container).click();
  }

  await table.waitFor();
  await table.click();

  // The grid is up once the first fixture row is on screen.
  await expect(page.getByText("Nogales").first()).toBeVisible();
}

/**
 * Runs `sql` through the editor.
 *
 * ACCESSIBILITY GAP: the SQL editor's textbox has no accessible name, so it cannot
 * be told apart from the object filter by role — getByRole("textbox").first()
 * silently typed the query into the filter box. Until the editor gets an
 * aria-label (recorded as task 2.12) it is reached by its CodeMirror container.
 */
export async function runSql(page: Page, sql: string): Promise<void> {
  const editor = page.locator(".cm-content").first();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(sql);
  // Typing opens the completion popup, which swallows the click on Ejecutar.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
}

/**
 * A cell holding exactly `value`.
 *
 * ACCESSIBILITY GAP: the result grid exposes no table/grid role and its cells no
 * roles either, so there is nothing to scope by except the value itself. Asserting
 * an exact string is the right thing for encoding regardless — `ñ` versus `Ã±` is
 * the whole difference between a fix and the look of one — but it means these
 * locators cannot say "in the grid". Recorded as task 2.12.
 */
export function cell(page: Page, value: string) {
  return page.getByText(value, { exact: true });
}
