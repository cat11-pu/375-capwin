// caprun.js：按处理预算处理事件，用尽后的事件连着压账；收尾不限预算把账做完。
import { startOf, stopOf } from "./cap.js";

const DEFAULT_BAD_TASK = "E_BAD_TASK";
const DEFAULT_DUP_RUN = "E_DUP_RUN";
const DEFAULT_NOT_RUNNING = "E_NOT_RUNNING";
const DEFAULT_BAD_EVENT = "E_BAD_EVENT";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

// 压账对外只露 [kind, task]；id 作为不可枚举属性带上，用于重放去重与拆轮对账。
function makePair(kind, task, id) {
  const pair = [kind, task];
  if (id !== undefined && id !== null) Object.defineProperty(pair, "id", { value: id });
  return pair;
}

function cloneState(state) {
  const source = state || {};
  return {
    running: Array.isArray(source.running) ? source.running.slice() : [],
    rejected: Array.isArray(source.rejected) ? source.rejected.slice() : [],
    ledger: Array.isArray(source.ledger)
      ? source.ledger.map((entry) => makePair(entry[0], entry[1], entry.id))
      : [],
    applied: Array.isArray(source.applied) ? source.applied.slice() : []
  };
}

function isPositiveInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

// 结构与任务号先校验：结构不合法 E_BAD_EVENT，任务号非正整数 E_BAD_TASK。
function inspect(spec, event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    fail(spec.event_error_code || DEFAULT_BAD_EVENT, "事件必须是对象");
  }
  if (event.kind !== "start" && event.kind !== "stop") {
    fail(spec.event_error_code || DEFAULT_BAD_EVENT, "事件 kind 只能是 start 或 stop");
  }
  if (!isPositiveInteger(event.task)) {
    fail(spec.bad_task_code || DEFAULT_BAD_TASK, "任务号必须是正整数");
  }
}

// 先把旧账清到预算见底，再依次处理新事件；用尽后的全部连着压账（保序）。
function run(spec, limit) {
  const state = cloneState(spec.state);
  const events = Array.isArray(spec.events) ? spec.events : [];
  let budget = limit;
  let served = 0;
  let judged = 0;
  const judgedBound = state.ledger.length + events.length;
  let cursor = 0;

  // 1) 先处理上一轮压着的账。
  while (state.ledger.length > 0 && budget > 0) {
    const pair = state.ledger.shift();
    if (pair[0] === "start") {
      const next = startOf(state.running, state.rejected, pair[1], spec.cap);
      state.running = next.running;
      state.rejected = next.rejected;
    } else {
      state.running = stopOf(state.running, pair[1]);
    }
    if (pair.id !== undefined && pair.id !== null && !state.applied.includes(pair.id)) {
      state.applied.push(pair.id);
    }
    budget -= 1;
    served += 1;
    judged += 1;
  }

  // 2) 再处理本批事件。
  while (cursor < events.length && budget > 0) {
    const event = events[cursor];
    cursor += 1;
    inspect(spec, event);
    if (isPositiveInteger(event.id) && state.applied.includes(event.id)) {
      continue; // 重放不新增：已处理过的事件跳过，不花预算
    }
    if (event.kind === "start") {
      if (state.running.includes(event.task)) {
        fail(spec.dup_code || DEFAULT_DUP_RUN, "任务已在运行中");
      }
      const next = startOf(state.running, state.rejected, event.task, spec.cap);
      state.running = next.running;
      state.rejected = next.rejected;
    } else {
      if (!state.running.includes(event.task)) {
        fail(spec.no_run_code || DEFAULT_NOT_RUNNING, "任务不在运行中");
      }
      state.running = stopOf(state.running, event.task);
    }
    if (isPositiveInteger(event.id)) state.applied.push(event.id);
    budget -= 1;
    served += 1;
    judged += 1;
  }

  // 3) 预算用尽：剩下的事件连着压账（每条仍会在真正处理时再校验/判重）。
  while (cursor < events.length) {
    const event = events[cursor];
    cursor += 1;
    state.ledger.push(makePair(event.kind, event.task,
      event && isPositiveInteger(event.id) ? event.id : undefined));
  }

  return {
    state: state,
    served: served,
    judged: judged,
    judged_bound: judgedBound
  };
}

export function step(spec) {
  const result = run(spec, Math.max(0, Math.trunc(spec.budget)));
  return {
    state: result.state,
    served: result.served,
    ledger_before: result.state.ledger.length,
    ledger: result.state.ledger,
    judged: result.judged,
    judged_bound: result.judged_bound
  };
}

// 收尾：不限预算把账做完，返回补齐条数。
export function close(spec) {
  const result = run(spec, Infinity);
  return { state: result.state, catchup: result.served };
}
