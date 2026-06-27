# Protocolo IPC — núcleo ↔ frontend

El frontend (webview) y el núcleo (C) se comunican con **JSON-RPC 2.0** sobre el mecanismo `webview_bind`/`webview_eval` de la librería `webview`. Es la **única** frontera entre ambos mundos y se versiona con cuidado.

> Borrador. Se estabiliza en el milestone **M0** (issue: *Definir el contrato IPC*).

## Forma de los mensajes

**Petición** (frontend → núcleo):

```json
{ "jsonrpc": "2.0", "id": 42, "method": "query.run",
  "params": { "connId": "c1", "sql": "SELECT * FROM users", "limit": 1000 } }
```

**Respuesta** (núcleo → frontend):

```json
{ "jsonrpc": "2.0", "id": 42,
  "result": { "columns": [...], "rows": [...], "truncated": false } }
```

**Error**:

```json
{ "jsonrpc": "2.0", "id": 42,
  "error": { "code": -32000, "message": "no se pudo conectar", "data": {...} } }
```

**Evento/notificación** (núcleo → frontend, sin `id`) para progreso de operaciones largas (transfer, import):

```json
{ "jsonrpc": "2.0", "method": "progress",
  "params": { "op": "transfer", "done": 12000, "total": 50000 } }
```

## Métodos (esbozo, crece por milestone)

| Método | Fase | Descripción |
|---|---|---|
| `conn.list` / `conn.save` / `conn.delete` | M2 | Gestión de conexiones guardadas |
| `conn.open` / `conn.close` | M1/M2 | Abrir/cerrar conexión activa |
| `query.run` | M1 | Ejecutar SQL, devolver result set paginado |
| `schema.tree` | M3 | Árbol de objetos (bases/esquemas/tablas) |
| `schema.describe` | M3 | Estructura de una tabla |
| `schema.ddl` | M3 | DDL `CREATE` de un objeto |
| `row.update` / `row.insert` / `row.delete` | M5 | Edición de datos |
| `tx.begin` / `tx.commit` / `tx.rollback` | M5 | Transacciones |
| `data.export` / `data.import` | M6 | Import/Export |
| `data.transfer` / `schema.diff` / `data.diff` | M7 | Transferencia y sincronización |

## Reglas

1. **Paginación siempre.** `query.run` devuelve como máximo `limit` filas y marca `truncated`. La UI pide más bajo demanda. Nunca se vuelca un dataset completo de golpe.
2. **El núcleo es la fuente de verdad de los tipos.** Cada columna lleva su `type` neutral; el frontend formatea, no infiere.
3. **Operaciones largas son asíncronas** y emiten `progress`; pueden cancelarse con `op.cancel`.
4. **Versionado:** el handshake inicial (`app.hello`) negocia la versión del protocolo.
