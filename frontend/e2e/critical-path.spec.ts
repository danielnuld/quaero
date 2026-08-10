// The journey that must work on every engine, driven through the interface.
//
// Each engine is its own describe block, so a failure names the engine it belongs
// to rather than leaving you to guess which of four broke.

import {
  cell,
  connect,
  disconnect,
  openFixtureTable,
  runSql,
} from "./support/app-actions";
import { describeAllEngines, expect, test } from "./support/fixtures";

describeAllEngines(["sqlite", "postgres", "mysql", "informix"], (engineName) => {
  test("connects and shows the connection as open", async ({ app }) => {
    await app.open();
    // Before connecting the interface says so, and the object actions are dead.
    await expect(app.page.getByText("Sin conexión")).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Objetos" })).toBeDisabled();

    await connect(app);

    await expect(app.page.getByRole("button", { name: /conectado/ })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Objetos" })).toBeEnabled();
  });

  test("browses to the fixture table and reads its rows", async ({ app }) => {
    await app.open();
    await connect(app);
    await openFixtureTable(app);

    await expect(cell(app.page, "Nogales")).toBeVisible();
  });

  test("shows each column with its type", async ({ app }) => {
    await app.open();
    await connect(app);
    await openFixtureTable(app);

    // The grid header names the column and its type, which is the describe a user
    // actually sees when opening a table.
    await expect(app.page.getByRole("button", { name: /^id / })).toBeVisible();
    await expect(app.page.getByRole("button", { name: /^nombre / })).toBeVisible();
  });

  test("pages through the rows", async ({ app }) => {
    await app.open();
    await connect(app);
    await openFixtureTable(app);

    const previous = app.page.getByRole("button", { name: /Anterior/ });
    const next = app.page.getByRole("button", { name: /Siguiente/ });

    // On the first page there is nothing before, and the first row is row 1.
    await expect(previous).toBeDisabled();
    await expect(cell(app.page, "Nogales")).toBeVisible();

    if (await next.isEnabled()) {
      await next.click();
      // The following page must show different rows, not the first ones again.
      await expect(cell(app.page, "Nogales")).toBeHidden();
      await expect(previous).toBeEnabled();
    }
  });

  test("reports a statement the engine rejects, and stays usable", async ({ app }) => {
    await app.open();
    await connect(app);

    await runSql(app.page, "SELECT * FROM tabla_que_no_existe_e2e");
    // The engine's own words reach the user; the interface does not hang waiting.
    await expect(app.page.getByRole("alert").first()).toBeVisible({ timeout: 20_000 });

    // Still usable: a good query afterwards works.
    await runSql(app.page, "SELECT nombre FROM e2e_items WHERE id = 1");
    await expect(cell(app.page, "Nogales")).toBeVisible({ timeout: 20_000 });
  });

  test("shows accented values exactly as the database means them", async ({ app }) => {
    await app.open();
    await connect(app);
    await openFixtureTable(app);

    const { accented, discriminator } = app.engine.encodingRows;

    // A plain accent, and then the row that separates a real fix from the look of
    // one: its bytes are valid UTF-8 for "ñ" but mean "Ã±" in a single-byte code
    // set, so a driver passing bytes through unchanged shows the wrong character.
    await expect(cell(app.page, accented)).toBeVisible();
    await expect(cell(app.page, discriminator)).toBeVisible();
    if (discriminator !== "ñ") {
      await expect(cell(app.page, "ñ")).toBeHidden();
    }
  });

  test("filters by an accented value and finds its rows", async ({ app }) => {
    await app.open();
    await connect(app);

    // Sending an accented literal is its own hazard: on Informix an unconverted
    // statement matched nothing at all, silently (#324).
    await runSql(
      app.page,
      `SELECT id, nombre FROM e2e_items WHERE nombre = '${app.engine.encodingRows.accented}'`,
    );
    await expect(cell(app.page, app.engine.encodingRows.accented)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("disconnects", async ({ app }) => {
    await app.open();
    await connect(app);
    await disconnect(app.page);

    await expect(app.page.getByText("Sin conexión")).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Objetos" })).toBeDisabled();
    expect(engineName).toBe(app.engine.name); // the block really is this engine
  });
});
