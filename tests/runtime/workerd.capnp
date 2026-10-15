using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [
    (name = "main", worker = (
      compatibilityDate = "2026-09-01",
      modules = [
        (name = "test.mjs", esModule = embed "provider.mjs"),
        (name = "worker/providers.mjs", esModule = embed "../../worker/providers.mjs"),
        (name = "worker/store.mjs", esModule = embed "../../worker/store.mjs"),
        (name = "src/core.mjs", esModule = embed "../../src/core.mjs")
      ],
      globalOutbound = "fixture"
    )),
    (name = "fixture", worker = (
      compatibilityDate = "2026-09-01",
      modules = [(name = "fixture.mjs", esModule = embed "fixture.mjs")]
    ))
  ],
  sockets = [(name = "http", address = "127.0.0.1:8791", http = (), service = "main")]
);
