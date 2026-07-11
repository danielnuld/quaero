# PostgreSQL driver.
#
# The driver plugin links libpq (the PostgreSQL C client). It is built only when
# libpq is found, so a checkout without the client lib (and CI runners where it
# is not installed) still configures and builds green — the plugin is simply
# absent there. The pure helpers (type mapping, identifier quoting, DML) never
# depend on libpq and are always built and unit-tested.

# --- pure unit tests (always) ---------------------------------------------
if(BUILD_TESTING)
  add_executable(postgres_types_test
    tests/types_test.c
    src/utils/types.c)
  target_include_directories(postgres_types_test PRIVATE
    src/utils ${CMAKE_SOURCE_DIR}/core/include)
  quaero_set_warnings(postgres_types_test)
  add_test(NAME postgres_types_test COMMAND postgres_types_test)

  add_executable(postgres_identifier_test
    tests/identifier_test.c
    src/utils/identifier.c)
  target_include_directories(postgres_identifier_test PRIVATE src/utils)
  quaero_set_warnings(postgres_identifier_test)
  add_test(NAME postgres_identifier_test COMMAND postgres_identifier_test)

  add_executable(postgres_dml_test
    tests/dml_test.c
    src/utils/dml.c)
  target_include_directories(postgres_dml_test PRIVATE
    src/utils ${CMAKE_SOURCE_DIR}/core/include)
  quaero_set_warnings(postgres_dml_test)
  add_test(NAME postgres_dml_test COMMAND postgres_dml_test)
endif()

# --- driver plugin (only when libpq is available) -------------------------
# Discover libpq. pg_config, when present, points at the active PostgreSQL
# install (including the one Strawberry Perl bundles on Windows); use it as a
# hint, then fall back to CMake's default search paths.
find_program(PG_CONFIG NAMES pg_config)
if(PG_CONFIG)
  execute_process(COMMAND ${PG_CONFIG} --includedir
    OUTPUT_VARIABLE _pg_incdir OUTPUT_STRIP_TRAILING_WHITESPACE ERROR_QUIET)
  execute_process(COMMAND ${PG_CONFIG} --libdir
    OUTPUT_VARIABLE _pg_libdir OUTPUT_STRIP_TRAILING_WHITESPACE ERROR_QUIET)
endif()

find_path(PG_INCLUDE_DIR NAMES libpq-fe.h
  HINTS ${_pg_incdir} PATH_SUFFIXES postgresql)
find_library(PG_LIBRARY NAMES pq libpq
  HINTS ${_pg_libdir})

if(PG_INCLUDE_DIR AND PG_LIBRARY)
  add_library(postgres_driver MODULE
    src/entry.c
    src/connection.c
    src/query.c
    src/metadata.c
    src/ddl.c
    src/edit.c
    src/utils/types.c
    src/utils/identifier.c
    src/utils/dml.c)
  target_include_directories(postgres_driver PRIVATE
    src ${CMAKE_SOURCE_DIR}/core/include)
  # cjson supplies cJSON.h (used for DSN parsing); linking it propagates its
  # include dir, exactly as the SQLite/MySQL drivers do.
  target_link_libraries(postgres_driver PRIVATE cjson)
  # libpq headers are third-party: include them as SYSTEM so they are not subject
  # to the strict -Werror policy applied to our own code.
  target_include_directories(postgres_driver SYSTEM PRIVATE ${PG_INCLUDE_DIR})
  target_link_libraries(postgres_driver PRIVATE ${PG_LIBRARY})

  # A static libpq (.a) needs its transitive dependencies spelled out: OpenSSL
  # (TLS transport) plus, on Windows, the socket/security/LDAP system libraries
  # libpq calls into. A shared libpq resolves these itself, so this is skipped.
  get_filename_component(_pg_lib_ext "${PG_LIBRARY}" EXT)
  if(_pg_lib_ext STREQUAL ".a")
    find_library(PG_SSL_LIBRARY NAMES ssl libssl HINTS ${_pg_libdir})
    find_library(PG_CRYPTO_LIBRARY NAMES crypto libcrypto HINTS ${_pg_libdir})
    if(PG_SSL_LIBRARY AND PG_CRYPTO_LIBRARY)
      target_link_libraries(postgres_driver PRIVATE
        ${PG_SSL_LIBRARY} ${PG_CRYPTO_LIBRARY})
    endif()
    if(WIN32)
      target_link_libraries(postgres_driver PRIVATE
        ws2_32 secur32 crypt32 wldap32 gdi32 advapi32)
    endif()
  endif()

  set_target_properties(postgres_driver PROPERTIES PREFIX "" OUTPUT_NAME "postgres")
  quaero_set_warnings(postgres_driver)
  message(STATUS "PostgreSQL driver: using ${PG_LIBRARY} (headers ${PG_INCLUDE_DIR})")
else()
  message(STATUS "PostgreSQL driver: libpq not found; plugin not built")
endif()
