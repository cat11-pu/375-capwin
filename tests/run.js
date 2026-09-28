import assert from "node:assert";
import { startOf, stopOf } from "../cap.js";
import { step, close } from "../caprun.js";
import { render } from "../app.js";

const base = {
  budget: 1, cap: 2,
  state: { running: [], rejected: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "start", task: 1 }],
  bad_task_code: "E_BAD_TASK", dup_code: "E_DUP_RUN",
  no_run_code: "E_NOT_RUNNING", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("startOf returns both lists", () => {
  const got = startOf([], [], 1, 1);
  assert.ok(Array.isArray(got.running) && Array.isArray(got.rejected));
});

check("stopOf returns a list", () => {
  assert.ok(Array.isArray(stopOf([1], 1)));
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
