# IPC Rules

The JSON-RPC contract between the C core and the webview frontend is the single
stability boundary between the two contributor communities. Reference:
[`docs/IPC.md`](../docs/IPC.md).

1. **One versioned contract.** Any change to a method's shape, or a new method,
   requires an issue and is reflected in `docs/IPC.md`. The `app.hello` handshake
   negotiates the protocol version.
2. **Pagination always.** `query.run` returns at most `limit` rows and sets
   `truncated`. Never stream a full dataset in one response.
3. **Long operations are async.** Transfer/import/export emit `progress`
   notifications and are cancellable via `op.cancel`.
4. **The core owns types.** Each column reports its neutral `type`; the frontend
   formats, it does not infer.
5. **Errors are structured.** Use the JSON-RPC `error` object with a machine code
   plus a human message; never crash the channel.
