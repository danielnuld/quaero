# Contrato de drivers (vtable)

Un driver es una biblioteca compartida (`.dll`/`.so`/`.dylib`) que exporta una función de entrada conocida y devuelve una **tabla de funciones** (vtable). El núcleo carga el plugin con `LoadLibrary`/`dlopen`, resuelve el símbolo de entrada y opera contra la vtable sin conocer detalles del motor.

> Borrador de diseño. La definición final se estabiliza en el milestone **M1** (issue: *Diseñar y documentar la vtable del driver*).

## Punto de entrada

Cada plugin exporta:

```c
/* Devuelve la vtable del driver. El núcleo verifica abi_version. */
const dbc_driver_t *dbc_driver_entry(void);
```

## Esbozo de la vtable

```c
#define DBC_ABI_VERSION 1

typedef struct dbc_conn   dbc_conn;    /* opaco, definido por el driver */
typedef struct dbc_result dbc_result;  /* opaco, definido por el driver */

typedef enum {
    DBC_OK = 0,
    DBC_ERR_CONN,
    DBC_ERR_QUERY,
    DBC_ERR_PARAM,
    DBC_ERR_UNSUPPORTED,
} dbc_status;

typedef struct {
    int          abi_version;     /* debe ser DBC_ABI_VERSION */
    const char  *name;            /* "postgres", "sqlite", ... */
    const char  *display_name;    /* "PostgreSQL" */

    /* --- ciclo de vida de la conexión --- */
    dbc_status (*connect)(const char *dsn_json, dbc_conn **out);
    void       (*disconnect)(dbc_conn *c);
    const char*(*last_error)(dbc_conn *c);

    /* --- ejecución --- */
    dbc_status (*query)(dbc_conn *c, const char *sql, dbc_result **out);
    void       (*free_result)(dbc_result *r);

    /* --- lectura del result set --- */
    int          (*col_count)(dbc_result *r);
    const char  *(*col_name)(dbc_result *r, int col);
    int          (*col_type)(dbc_result *r, int col);   /* dbc_type */
    int          (*next_row)(dbc_result *r);            /* 1=hay fila, 0=fin */
    const char  *(*cell_text)(dbc_result *r, int col);  /* NULL si SQL NULL */
    long long    (*rows_affected)(dbc_result *r);

    /* --- introspección (M3) --- */
    dbc_status (*list_databases)(dbc_conn *c, dbc_result **out);
    dbc_status (*list_schemas)(dbc_conn *c, const char *db, dbc_result **out);
    dbc_status (*list_tables)(dbc_conn *c, const char *schema, dbc_result **out);
    dbc_status (*describe_table)(dbc_conn *c, const char *table, dbc_result **out);

    /* --- transacciones (M5) --- */
    dbc_status (*begin)(dbc_conn *c);
    dbc_status (*commit)(dbc_conn *c);
    dbc_status (*rollback)(dbc_conn *c);

    /* --- capacidades --- */
    unsigned int features;   /* bitmask: SSL, SSH, TX, SCHEMAS, ... */
} dbc_driver_t;
```

## Contrato de comportamiento

- **Thread-safety:** una `dbc_conn` se usa desde un solo hilo a la vez. El núcleo serializa el acceso.
- **DSN:** la cadena de conexión llega como **JSON** (`{"host":...,"port":...,"user":...}`) para no acoplar el núcleo a parámetros específicos del motor.
- **Tipos:** `col_type` devuelve un `dbc_type` neutral (INT, FLOAT, TEXT, BLOB, BOOL, DATE, TIME, TIMESTAMP, JSON, NULL). El mapeo motor→neutral lo hace el driver.
- **Errores:** ante `DBC_ERR_*`, `last_error` devuelve un mensaje legible. Nunca `abort()`.
- **Capacidades:** un motor que no soporta una operación devuelve `DBC_ERR_UNSUPPORTED`; la UI oculta la función según `features`.

## Cómo escribir un driver

Plantilla y guía paso a paso en el milestone **M8**. La idea: copiar el driver de SQLite (referencia mínima), implementar la vtable contra la librería cliente del motor, compilar como biblioteca compartida y colocarla en el directorio de plugins.
