## 1. El arnés

- [x] 1.1 Playwright como `devDependency` de `frontend/`, `playwright.config.ts` y
      script `pnpm e2e`. `webServer` levanta `vite preview` sobre `dist/`, y
      `workers: 1` con el comentario `ponytail:` que nombra el techo.
- [x] 1.2 `e2e/support/rpc.ts`: proceso hijo `quaero-rpc`, una petición JSON por
      línea, respuestas **correlacionadas por `id`** (no por orden: `op.cancel` no
      se encola detrás de la consulta en curso). Si el proceso muere, las promesas
      pendientes se rechazan con motivo en vez de quedarse colgadas.
- [x] 1.3 Elección de binario por `QUAERO_RPC`/`QUAERO_DRIVERS` y el runtime de
      mingw añadido al `PATH` del hijo por el arnés, que además registra qué drivers
      cargó.
      **Un solo binario, el x86: es la arquitectura que se publica.** Llegué a
      montar un binario por motor porque el x86 no podía con MySQL 8, y eso estaba
      mal: habría dejado la suite verde mientras un usuario real no podía conectar.
      El arreglo era del build, no del arnés (ver 4.6), así que el `CorePool` y la
      selección por motor se borraron.
- [x] 1.4 `e2e/support/bridge.ts`: `page.exposeFunction` + `addInitScript` que
      asigna `window.quaeroRpc`, imitando el contrato de `transport.ts`.
- [x] 1.5 `e2e/support/state.ts`: siembra de `localStorage` (conexiones, `locale`,
      y las demás claves `quaero.*`) para que ninguna prueba herede estado.
- [x] 1.6 `e2e/support/engines.ts`: la matriz de motores con su DSN y su DDL de
      fixture. SQLite, PostgreSQL, MySQL e Informix.
- [x] 1.7 `globalSetup`: sondear cada motor (¿cargó el driver? ¿contesta la base?) y
      publicar la disponibilidad. Los no disponibles se saltan **con motivo**, y el
      mensaje incluye el comando para arrancar el contenedor.
- [x] 1.8 `QUAERO_E2E_REQUIRE`: convierte el salto en fallo para los motores
      listados, de modo que un CI verde no pueda significar «no se probó nada».
- [x] 1.9 Siembra por el núcleo, resembrando por fichero de pruebas, con los
      valores de #323/#324: acentos, la fila `C3 B1` y las de bytes 0x80–0x9F.
- [x] 1.10 Trazas y capturas al fallar, y `README.md` en `e2e/`: cómo correrla, cómo
      levantar los contenedores, cómo añadir un motor y cómo añadir un caso.
- [x] 1.11 Prueba del propio arnés: que un motor inexistente se salta y no falla, y
      que con `QUAERO_E2E_REQUIRE` sí falla. El arnés también es código.

## 2. Camino crítico por motor (fase 1)

- [ ] 2.1 Conectar desde una conexión guardada y ver el estado conectado.
- [ ] 2.2 Crear una conexión **rellenando el formulario**, que sobreviva a una
      recarga. Es el primer camino de cualquier usuario nuevo y no puede quedar
      cubierto sólo por siembra.
- [ ] 2.3 Árbol de objetos: la tabla de fixture aparece al expandir.
- [ ] 2.4 Describe de la tabla: columnas y tipos.
- [ ] 2.5 SELECT paginado: primera página, y la siguiente muestra filas distintas.
- [ ] 2.6 Una sentencia que el motor rechaza: se muestra su mensaje y la interfaz
      sigue usable, sin peticiones sin respuesta.
- [ ] 2.7 Edición transaccional: insert + update + delete + commit, verificado
      releyendo.
- [ ] 2.8 Rollback: el cambio no queda.
- [ ] 2.9 Export del resultado: el contenido lleva las mismas filas y valores.
- [ ] 2.10 Desconectar: estado desconectado y objetos ya no navegables.
- [ ] 2.11 Encoding: valores acentuados exactos, la fila `C3 B1` mostrando lo que
      la base **significa**, filtrar por un valor acentuado devolviendo sus filas, y
      export conservando los caracteres. Comparaciones por valor exacto, nunca
      «contiene acentos».
- [ ] 2.12 Anotar en este fichero cada control que no se pudo alcanzar por rol o
      etiqueta, como trabajo de accesibilidad sobre el componente. Ningún selector
      por clase CSS ni por posición.

## 3. Fases siguientes, por área (a priorizar, no comprometidas)

Agrupadas por afinidad, para poder tomar una fase entera sin volver a inventariar
los 44 componentes de `frontend/src/components`.

- [ ] 3.1 **Editor y ejecución**: `SqlEditor` (selección, sentencia bajo el cursor,
      formateo, autocompletado), `CommandPalette` (Ctrl+K y Ctrl+J), atajos y
      `ShortcutsHelp`, cancelación de consulta (`op.cancel`, el caso que obliga a
      correlacionar por `id`).
- [ ] 3.2 **Resultados**: `ResultGrid` (navegación por teclado, orden, selección,
      columnas), `RowDetail`, `ChartView`, `ExplainPlan`, `StatusBar`.
- [ ] 3.3 **Exploración de esquema**: `ObjectTree`, `ObjectListView`,
      `ObjectToolbar`, `StructureView`, `InfoPane`, `ErDiagram`, `FkBrowser`,
      `FkPicker`, `RelatedData` (el modal de #310).
- [ ] 3.4 **Edición de datos y DDL**: `TableDesigner`, `IndexManager`,
      `DataGenerator`, `RoutineExplorer`, `TriggersExplorer`, refresco del árbol
      tras DDL (la regresión de #319).
- [ ] 3.5 **Import/export y trasvase**: `ImportWizard`, exportadores (CSV, JSON,
      XLSX, HTML), `Notebook` y su export, `TransferWizard`.
- [ ] 3.6 **Wizards de comparación**: `DataDiffWizard`, `SchemaSyncWizard`.
      Los más caros de cubrir y los que más se agradecen: nadie los prueba a mano.
- [ ] 3.7 **Multi-conexión**: varias conexiones abiertas a la vez, pestañas atadas a
      la suya, color por conexión, franja de acento del área de trabajo.
- [ ] 3.8 **Persistencia y preferencias**: historial, snippets (#320/#321),
      `SettingsPanel`, tema y skin «Azul», `ConnectionManager`, import/export de
      conexiones.
- [ ] 3.9 **Administración**: `UserManager`, `ServerMonitor`, `SlowQueries`.
      Dependen del motor y de permisos; conviene decidir qué se prueba y con qué
      usuario antes de escribir nada.
- [ ] 3.10 **i18n**: la interfaz en inglés y en español, incluido que ninguna
      cadena quede sin traducir en los caminos cubiertos.
- [ ] 3.11 **MongoDB**: contenedor y entrada en la matriz.
- [ ] 3.12 **La shell nativa**, lo único que esta vía no alcanza: smoke por CDP
      contra el ejecutable real (ventana, menús, diálogos de fichero, persistencia
      de `localStorage` por origen, `UpdateModal`, enlaces externos). Decidir si
      merece la pena con la fase 1 ya hecha y medida.
- [ ] 3.13 **CI**: servicios de Postgres y MySQL, `QUAERO_E2E_REQUIRE` con los tres
      motores que sí caben, y decidir —midiendo, no adivinando— si entra en la
      puerta o queda nocturna. Informix se queda fuera por su ODBC de 32 bits.

## 4. Cierre de la fase 1 (grupo 1 cerrado; el grupo 2 queda para la fase 2)

- [x] 4.1 La suite del arnés pasa en verde con los cuatro motores listos
      (sqlite, postgres, mysql, informix), y se salta limpiamente los que no:
      verificado apuntando a un directorio de drivers vacío (4 saltados, 5 pasados)
      y con `QUAERO_E2E_REQUIRE=sqlite` (1 fallo con mensaje accionable).
- [x] 4.2 Dos ejecuciones seguidas, sin limpiar nada entre ellas, dan 9 pasadas las
      dos veces: no se arrastra estado.
- [x] 4.3 `ctest` verde y ninguna línea de producción tocada.
      **`pnpm test` tiene un fallo ajeno**: `tests/tools/packIcons.test.ts` da
      `SyntaxError` al importar `assets/icons/pack-icons.mjs`. Comprobado en un
      worktree limpio en `d450855` con instalación nueva: **ya fallaba antes**, y
      sólo en local (la pata `frontend` de CI pasa). Su propio issue, no de aquí.
- [x] 4.4 Ampliar `.rules/testing.md` con la sección de E2E y cómo correrla.
- [x] 4.5 El arnés tarda ~40 s de reloj (incluye compilar el frontend y sondear los
      cuatro motores); las 9 pruebas en sí, ~7 s. Dato para decidir 3.13 cuando la
      fase 2 esté escrita.

- [x] 4.6 **Arreglado el defecto que encontró el arnés en su primera ejecución**: el
      build x86 —la arquitectura que se publica— no podía autenticarse contra un
      MySQL 8 con configuración por defecto, porque `caching_sha2_password` (la
      autenticación por defecto desde 8.0) se compilaba como DLL aparte que no
      empaquetamos. `WITH_SSL=OFF` no era el motivo: en Windows el connector saca su
      criptografía de WinCrypt, en una rama que va **antes** de consultar
      `WITH_SSL`. Basta forzarlo a estático en `cmake/QuaeroMariaDB.cmake`, y de
      paso `sha256_password`. Verificado en vivo contra MySQL 8.4 con x86, y smoke
      12/12.
