// cap.js：启动与结束的清单规则（纯函数，不改入参）
// 启动：运行清单已满 -> 任务号进被拒绝清单（升序、去重）；未满 -> 进运行清单（升序）。
export function startOf(running, rejected, task, cap) {
  const nextRunning = running.slice();
  const nextRejected = rejected.slice();
  if (nextRunning.length >= cap) {
    if (!nextRejected.includes(task)) {
      nextRejected.push(task);
      nextRejected.sort((a, b) => a - b);
    }
  } else if (!nextRunning.includes(task)) {
    nextRunning.push(task);
    nextRunning.sort((a, b) => a - b);
  }
  return { running: nextRunning, rejected: nextRejected };
}

// 结束：把任务号从运行清单移出；不在清单里时原样返回（合法性由 caprun 判）。
export function stopOf(running, task) {
  return running.filter((t) => t !== task);
}
