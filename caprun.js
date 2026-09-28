// caprun.js：按处理预算处理事件，用尽后的事件压账；close 不限预算把账做完
import { startOf, stopOf } from "./cap.js";

function isPosInt(value) {
  return Number.isInteger(value) && value > 0;
}

function cloneState(state) {
  const src = state || {};
  return {
    running: Array.isArray(src.running) ? src.running.slice() : [],
    rejected: Array.isArray(src.rejected) ? src.rejected.slice() : [],
    ledger: Array.isArray(src.ledger) ? src.ledger.map((e) => e.slice()) : [],
    applied: Array.isArray(src.applied) ? src.applied.slice() : [],
    ledger_ids: Array.isArray(src.ledger_ids) ? src.ledger_ids.slice() : []
  };
}

// 结构与任务号先校验（E_BAD_EVENT 优先于 E_BAD_TASK）
function precheck(events) {
  if (!Array.isArray(events)) {
    const error = new Error("events must be an array");
    error.code = "E_BAD_EVENT";
    throw error;
  }
  for (const event of events) {
    if (event === null || typeof event !== "object" || Array.isArray(event)
      || (event.kind !== "start" && event.kind !== "stop")) {
      const error = new Error("bad event structure");
      error.code = "E_BAD_EVENT";
      throw error;
    }
    if (!isPosInt(event.task)) {
      const error = new Error("task must be a positive integer");
      error.code = "E_BAD_TASK";
      throw error;
    }
  }
}

function applyEvent(state, kind, task) {
  if (kind === "start") {
    if (state.running.indexOf(task) !== -1) {
      const error = new Error("task already running");
      error.code = "E_DUP_RUN";
      throw error;
    }
    const next = startOf(state.running, state.rejected, task, state.cap);
    state.running = next.running;
    state.rejected = next.rejected;
  } else {
    if (state.running.indexOf(task) === -1) {
      const error = new Error("task not running");
      error.code = "E_NOT_RUNNING";
      throw error;
    }
    state.running = stopOf(state.running, task);
  }
}

function keyOf(event, index) {
  return isPosInt(event.id) ? "id:" + event.id : "idx:" + index;
}

export function step(spec) {
  const events = Array.isArray(spec.events) ? spec.events : [];
  precheck(events);
  const state = cloneState(spec.state);
  state.cap = spec.cap;

  let budget = Number.isFinite(spec.budget) ? Math.max(0, Math.floor(spec.budget)) : 0;
  let served = 0;
  let judged = 0;
  const ledgerBefore = state.ledger.length;
  const appliedSet = new Set(state.applied);

  const enqueue = function (event, key) {
    if (!appliedSet.has(key)) {
      state.ledger.push([event.kind, event.task]);
      state.ledger_ids.push(key);
    }
  };

  // 待处理队列：先压着的旧账（FIFO），再这批新事件
  const queue = [];
  for (let i = 0; i < state.ledger.length; i++) {
    queue.push({ kind: state.ledger[i][0], task: state.ledger[i][1], key: state.ledger_ids[i] || "led:" + i, queued: true });
  }
  events.forEach((event, i) => queue.push({ kind: event.kind, task: event.task, key: keyOf(event, i), queued: false }));

  state.ledger = [];
  state.ledger_ids = [];

  for (const item of queue) {
    if (appliedSet.has(item.key)) continue;
    judged += 1;
    if (served >= budget) {
      enqueue({ kind: item.kind, task: item.task }, item.key);
      continue;
    }
    applyEvent(state, item.kind, item.task);
    served += 1;
    appliedSet.add(item.key);
    state.applied.push(item.key);
  }

  return {
    state,
    served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map((e) => e.slice()),
    judged,
    judged_bound: ledgerBefore + events.length
  };
}

export function close(spec) {
  const state = cloneState(spec.state);
  state.cap = spec.cap;
  let catchup = 0;
  const appliedSet = new Set(state.applied);
  const ids = state.ledger_ids;

  for (let i = 0; i < state.ledger.length; i++) {
    const entry = state.ledger[i];
    const key = ids[i] || "led:" + i;
    if (appliedSet.has(key)) continue;
    applyEvent(state, entry[0], entry[1]);
    appliedSet.add(key);
    state.applied.push(key);
    catchup += 1;
  }
  state.ledger = [];
  state.ledger_ids = [];
  return { state, catchup };
}
