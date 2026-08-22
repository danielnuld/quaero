// Reading connection lists exported by OTHER database tools, so moving to Quaero
// does not start with retyping thirty servers by hand. Two formats:
//
//   - DBeaver's `data-sources.json` (the workspace file, or the one its
//     "Export connections" produces).
//   - Navicat's `.ncx` export (XML).
//
// What is imported is the ADDRESS of each connection — engine, host, port,
// database, user, and the SSH tunnel when there is one. **Passwords are never
// read**, and that is deliberate rather than a gap: both tools keep them
// encrypted in a separate store (DBeaver in `credentials-config.json`, Navicat
// in the attribute itself), and decrypting another product's credential vault to
// copy secrets into ours is not a thing this app should do quietly. Quaero's own
// export defaults to omitting passwords for the same reason. They are typed once
// at the first connect.
//
// Both parsers are deliberately tolerant. These are other people's formats,
// they differ across versions, and a strict reader that drops a connection
// because a version called a field `server` instead of `host` is worse than a
// loose one that gets it right: every logical field is looked up through a list
// of aliases, case-insensitively.

import type { Connection } from "./connections";

export type ForeignSource = "dbeaver" | "navicat";

/** An entry that was recognised but cannot be imported, and why. */
export interface SkippedConnection {
  name: string;
  reason: string;
}

export interface ForeignImport {
  source: ForeignSource;
  /** Ready to merge: no id (the merge assigns one) and no password. */
  connections: Connection[];
  skipped: SkippedConnection[];
}

/**
 * Which tool wrote this file, or null when it is neither.
 *
 * Sniffed from the content, not the extension: DBeaver's file is `.json` like
 * Quaero's own, and people rename things.
 */
export function detectForeign(raw: string): ForeignSource | null {
  const head = raw.slice(0, 4096);
  if (/<\s*Connections\b/i.test(head) || /<\s*Connection\b/i.test(head)) return "navicat";
  if (/"connections"\s*:/.test(head) && /"(provider|configuration)"\s*:/.test(raw)) {
    return "dbeaver";
  }
  return null;
}

/** Case-insensitive lookup of the first alias present and non-empty. */
function pick(src: Record<string, unknown>, aliases: string[]): string {
  const lower = new Map<string, unknown>();
  for (const [k, v] of Object.entries(src)) lower.set(k.toLowerCase(), v);
  for (const alias of aliases) {
    const v = lower.get(alias.toLowerCase());
    if (typeof v === "string" && v.trim() !== "") return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "boolean") return v ? "true" : "";
  }
  return "";
}

/** Only set a param when there is something to set: blank ≠ "not configured". */
function put(params: Record<string, string>, key: string, value: string): void {
  if (value !== "") params[key] = value;
}

/**
 * The engines Quaero ships, keyed by every name the two tools use for them.
 *
 * An engine that is missing here is not a bug to paper over: the import reports
 * it as skipped and says which engine it was, because a connection silently
 * turned into the wrong driver would fail at connect time with a message about
 * something else entirely.
 */
const ENGINES: Record<string, string> = {
  // DBeaver providers / driver ids
  postgresql: "postgres",
  postgres: "postgres",
  mysql: "mysql",
  mariadb: "mysql",
  sqlite: "sqlite",
  mongodb: "mongodb",
  mongo: "mongodb",
  informix: "informix",
  // Navicat ConnType spellings
  mysqlconn: "mysql",
  postgresqlconn: "postgres",
  mariadbconn: "mysql",
  sqliteconn: "sqlite",
  mongodbconn: "mongodb",
};

/** The Quaero driver for a foreign engine name, or "" when we do not ship it. */
export function driverFor(engine: string): string {
  return ENGINES[engine.trim().toLowerCase().replace(/[\s_-]/g, "")] ?? "";
}

/** The SSH tunnel half, shared by both readers (same field names on our side). */
function sshParams(
  params: Record<string, string>,
  host: string,
  port: string,
  user: string,
): void {
  if (host === "") return;
  put(params, "ssh_host", host);
  put(params, "ssh_port", port);
  put(params, "ssh_user", user);
  // Not the auth method: DBeaver and Navicat both point at a key file or a
  // saved password we cannot read, and guessing "agent" would send someone to a
  // failing connect. Left blank, which is our own "ask me" default.
}

/**
 * DBeaver's `data-sources.json`.
 *
 * `connections` is an object keyed by DBeaver's internal id; each entry carries a
 * `provider` (the engine), a display `name`, an optional `folder`, and a
 * `configuration` with the address. The user name lives in `configuration.user`
 * in the versions that keep it there, and in the encrypted credentials file in
 * the ones that do not — hence the alias list and the blank when it is absent.
 */
export function parseDbeaver(raw: string): ForeignImport | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { error: "El archivo de DBeaver no es JSON válido." };
  }
  const conns = (data as { connections?: unknown } | null)?.connections;
  if (!conns || typeof conns !== "object" || Array.isArray(conns)) {
    return { error: "El archivo de DBeaver no contiene conexiones." };
  }

  // Folder ids map to their own names; DBeaver stores the folder as a path.
  const out: Connection[] = [];
  const skipped: SkippedConnection[] = [];

  for (const entry of Object.values(conns as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const cfg = (e.configuration && typeof e.configuration === "object"
      ? (e.configuration as Record<string, unknown>)
      : {}) as Record<string, unknown>;

    const name = pick(e, ["name"]) || pick(cfg, ["database", "host"]);
    if (name === "") continue;

    const engine = pick(e, ["provider", "driver"]);
    const driver = driverFor(engine);
    if (driver === "") {
      skipped.push({ name, reason: engine || "motor desconocido" });
      continue;
    }

    const params: Record<string, string> = {};
    if (driver === "sqlite") {
      put(params, "path", pick(cfg, ["database", "url", "path", "file"]));
    } else {
      put(params, "host", pick(cfg, ["host", "server"]));
      put(params, "port", pick(cfg, ["port"]));
      put(params, "database", pick(cfg, ["database"]));
      put(params, "user", pick(cfg, ["user", "userName", "username"]));
      if (driver === "informix") put(params, "server", pick(cfg, ["server", "serverName"]));
    }

    // DBeaver nests the tunnel under handlers/network-handlers in some versions
    // and flat in others; both are read the same way.
    const handler = (cfg.handlers ?? cfg["network-handlers"]) as unknown;
    const ssh = Array.isArray(handler)
      ? ((handler.find(
          (h) => typeof h === "object" && /ssh/i.test(String((h as { id?: string }).id ?? "")),
        ) ?? {}) as Record<string, unknown>)
      : handler && typeof handler === "object"
        ? ((Object.entries(handler as Record<string, unknown>).find(([k]) => /ssh/i.test(k))?.[1] ??
            {}) as Record<string, unknown>)
        : {};
    const sshProps = (ssh.properties && typeof ssh.properties === "object"
      ? (ssh.properties as Record<string, unknown>)
      : ssh) as Record<string, unknown>;
    sshParams(
      params,
      pick(sshProps, ["host", "hostName", "sshHost"]),
      pick(sshProps, ["port", "sshPort"]),
      pick(sshProps, ["user", "userName", "sshUser"]),
    );

    out.push({
      id: "",
      name,
      driver,
      params,
      ...(pick(e, ["folder"]) ? { group: pick(e, ["folder"]) } : {}),
    });
  }

  return { source: "dbeaver", connections: out, skipped };
}

/**
 * Navicat's `.ncx` export (XML).
 *
 * One `<Connection>` element per server, everything in attributes. Attribute
 * spellings drift between Navicat versions and between engines — the database
 * is `Database` here and `DatabaseFileName` there — so every field goes through
 * the alias list.
 */
export function parseNavicat(raw: string): ForeignImport | { error: string } {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(raw, "application/xml");
  } catch {
    return { error: "El archivo de Navicat no es XML válido." };
  }
  if (doc.getElementsByTagName("parsererror").length > 0) {
    return { error: "El archivo de Navicat no es XML válido." };
  }

  const nodes = Array.from(doc.getElementsByTagName("*")).filter(
    (el) => el.tagName.toLowerCase() === "connection",
  );
  if (nodes.length === 0) {
    return { error: "El archivo de Navicat no contiene conexiones." };
  }

  const out: Connection[] = [];
  const skipped: SkippedConnection[] = [];

  for (const el of nodes) {
    const attrs: Record<string, string> = {};
    for (const a of Array.from(el.attributes)) attrs[a.name] = a.value;

    const name = pick(attrs, ["ConnectionName", "Name"]);
    if (name === "") continue;

    const engine = pick(attrs, ["ConnType", "ConnectionType", "Type"]);
    const driver = driverFor(engine);
    if (driver === "") {
      skipped.push({ name, reason: engine || "motor desconocido" });
      continue;
    }

    const params: Record<string, string> = {};
    if (driver === "sqlite") {
      put(params, "path", pick(attrs, ["DatabaseFileName", "DatabaseName", "FileName", "Database"]));
    } else {
      put(params, "host", pick(attrs, ["Host", "HostName", "Server"]));
      put(params, "port", pick(attrs, ["Port"]));
      put(params, "database", pick(attrs, ["Database", "DatabaseName", "DefaultDatabase", "InitialDatabase"]));
      put(params, "user", pick(attrs, ["UserName", "User"]));
    }

    sshParams(
      params,
      pick(attrs, ["SSH_Host", "SSHHost", "SSH_HostName"]),
      pick(attrs, ["SSH_Port", "SSHPort"]),
      pick(attrs, ["SSH_UserName", "SSHUserName", "SSH_User"]),
    );

    out.push({ id: "", name, driver, params });
  }

  return { source: "navicat", connections: out, skipped };
}

/** Parse whichever of the two formats this is. */
export function parseForeign(
  raw: string,
  source: ForeignSource,
): ForeignImport | { error: string } {
  return source === "dbeaver" ? parseDbeaver(raw) : parseNavicat(raw);
}
