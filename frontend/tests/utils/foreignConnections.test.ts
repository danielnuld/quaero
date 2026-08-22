import { describe, it, expect } from "vitest";
import {
  detectForeign,
  driverFor,
  parseDbeaver,
  parseNavicat,
} from "../../src/utils/foreignConnections";

// Reading the connection lists of DBeaver and Navicat, so migrating does not
// start with retyping thirty servers. What these tests pin is the two rules the
// module exists for: passwords never come across, and an entry is only dropped
// when it is genuinely unusable — never because a version of the format spelled
// a field differently.

const DBEAVER = JSON.stringify({
  folders: { Prod: {} },
  connections: {
    "postgres-jdbc-18f2": {
      provider: "postgresql",
      driver: "postgres-jdbc",
      name: "Ventas prod",
      folder: "Prod",
      "save-password": true,
      configuration: {
        host: "db.example.com",
        port: "5432",
        database: "ventas",
        user: "app",
        password: "hunter2",
        url: "jdbc:postgresql://db.example.com:5432/ventas",
      },
    },
    "mysql8-1a2b": {
      provider: "mysql",
      name: "Local MySQL",
      configuration: { host: "127.0.0.1", port: "3306", database: "testdb" },
    },
    "sqlite-99": {
      provider: "sqlite",
      name: "Notas",
      configuration: { database: "C:/data/notas.db" },
    },
    "oracle-77": {
      provider: "oracle",
      name: "Cobranza",
      configuration: { host: "orcl.example.com", port: "1521" },
    },
  },
});

const NAVICAT = `<?xml version="1.0" encoding="UTF-8"?>
<Connections>
  <Connection ConnectionName="SIAJ" ConnType="MySQL" Host="10.0.0.9" Port="3306"
              UserName="root" Password="A3F2C1" Database="siaj" SavePassword="true"/>
  <Connection ConnectionName="Reportes" ConnType="PostgreSQL" Host="pg.example.com"
              Port="5432" UserName="reader" DefaultDatabase="reportes"
              SSH_Host="bastion.example.com" SSH_Port="2222" SSH_UserName="dnl"/>
  <Connection ConnectionName="Local" ConnType="SQLite" DatabaseFileName="/home/d/n.db"/>
  <Connection ConnectionName="Nómina" ConnType="SQL Server" Host="mssql.example.com"/>
</Connections>`;

describe("detectForeign", () => {
  it("tells the two formats apart by content, not by extension", () => {
    expect(detectForeign(DBEAVER)).toBe("dbeaver");
    expect(detectForeign(NAVICAT)).toBe("navicat");
  });

  it("does not claim our own export file", () => {
    const ours = JSON.stringify({
      version: 1,
      connections: [{ id: "c1", name: "x", driver: "mysql", params: { host: "h" } }],
    });
    expect(detectForeign(ours)).toBeNull();
    expect(detectForeign("")).toBeNull();
    expect(detectForeign("not a file")).toBeNull();
  });
});

describe("driverFor", () => {
  it("maps every spelling of an engine we ship", () => {
    expect(driverFor("postgresql")).toBe("postgres");
    expect(driverFor("MariaDB")).toBe("mysql");
    expect(driverFor("mongo db")).toBe("mongodb");
    expect(driverFor("SQLite")).toBe("sqlite");
  });

  it("says nothing for an engine we do not ship", () => {
    expect(driverFor("oracle")).toBe("");
    expect(driverFor("SQL Server")).toBe("");
    expect(driverFor("")).toBe("");
  });
});

describe("parseDbeaver", () => {
  const parsed = () => {
    const r = parseDbeaver(DBEAVER);
    if ("error" in r) throw new Error(r.error);
    return r;
  };

  it("reads the address of each connection, and its folder as the group", () => {
    const { connections } = parsed();
    expect(connections.map((c) => c.name)).toEqual(["Ventas prod", "Local MySQL", "Notas"]);
    expect(connections[0]).toEqual({
      id: "",
      name: "Ventas prod",
      driver: "postgres",
      group: "Prod",
      params: { host: "db.example.com", port: "5432", database: "ventas", user: "app" },
    });
  });

  it("never brings the password across, even when the file has it in the clear", () => {
    for (const c of parsed().connections) {
      expect(Object.keys(c.params)).not.toContain("password");
      expect(JSON.stringify(c)).not.toContain("hunter2");
    }
  });

  it("keeps a connection whose user is missing", () => {
    // DBeaver's user often lives in its encrypted credentials file, so half an
    // address is the normal case — and it is still worth not retyping.
    const mysql = parsed().connections[1];
    expect(mysql.params).toEqual({ host: "127.0.0.1", port: "3306", database: "testdb" });
  });

  it("puts a SQLite file in the path field, not in host", () => {
    expect(parsed().connections[2].params).toEqual({ path: "C:/data/notas.db" });
  });

  it("reports an engine it cannot map instead of guessing one", () => {
    expect(parsed().skipped).toEqual([{ name: "Cobranza", reason: "oracle" }]);
  });

  it("reads the SSH tunnel from either shape DBeaver writes it in", () => {
    const flat = JSON.stringify({
      connections: {
        a: {
          provider: "mysql",
          name: "Tunelada",
          configuration: {
            host: "10.0.0.2",
            handlers: { ssh_tunnel: { properties: { host: "jump.example.com", port: "22", user: "dnl" } } },
          },
        },
      },
    });
    const listed = JSON.stringify({
      connections: {
        a: {
          provider: "mysql",
          name: "Tunelada",
          configuration: {
            host: "10.0.0.2",
            "network-handlers": [{ id: "ssh_tunnel", properties: { host: "jump.example.com", port: "22", user: "dnl" } }],
          },
        },
      },
    });
    for (const raw of [flat, listed]) {
      const r = parseDbeaver(raw);
      if ("error" in r) throw new Error(r.error);
      expect(r.connections[0].params).toMatchObject({
        ssh_host: "jump.example.com",
        ssh_port: "22",
        ssh_user: "dnl",
      });
    }
  });

  it("refuses a file that is not one of DBeaver's", () => {
    expect(parseDbeaver("{oops")).toEqual({ error: "El archivo de DBeaver no es JSON válido." });
    expect(parseDbeaver("{}")).toEqual({ error: "El archivo de DBeaver no contiene conexiones." });
  });
});

describe("parseNavicat", () => {
  const parsed = () => {
    const r = parseNavicat(NAVICAT);
    if ("error" in r) throw new Error(r.error);
    return r;
  };

  it("reads every connection it can, with its SSH tunnel", () => {
    const { connections } = parsed();
    expect(connections.map((c) => c.name)).toEqual(["SIAJ", "Reportes", "Local"]);
    expect(connections[0]).toEqual({
      id: "",
      name: "SIAJ",
      driver: "mysql",
      params: { host: "10.0.0.9", port: "3306", database: "siaj", user: "root" },
    });
    expect(connections[1].params).toEqual({
      host: "pg.example.com",
      port: "5432",
      database: "reportes",
      user: "reader",
      ssh_host: "bastion.example.com",
      ssh_port: "2222",
      ssh_user: "dnl",
    });
  });

  it("leaves the encrypted password where it found it", () => {
    expect(JSON.stringify(parsed().connections)).not.toContain("A3F2C1");
  });

  it("puts a SQLite file in the path field", () => {
    expect(parsed().connections[2].params).toEqual({ path: "/home/d/n.db" });
  });

  it("reports an engine it cannot map", () => {
    expect(parsed().skipped).toEqual([{ name: "Nómina", reason: "SQL Server" }]);
  });

  it("refuses a file that is not one of Navicat's", () => {
    expect(parseNavicat("<Connections></Connections>")).toEqual({
      error: "El archivo de Navicat no contiene conexiones.",
    });
  });
});
