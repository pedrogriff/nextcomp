import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "nextcomp",
  runtime: "node",
  logLevel: "info",
  maxDuration: 300,
  dirs: ["./app/trigger"],
});
