// cap.js：启动与结束的纯清单运算（数值按任务号升序、去重）
function sortedUnique(list) {
  return list.slice().sort((a, b) => a - b).filter((v, i, arr) => i === 0 || arr[i - 1] !== v);
}

export function startOf(running, rejected, task, cap) {
  const nextRunning = running.slice();
  const nextRejected = rejected.slice();
  if (nextRunning.indexOf(task) !== -1) {
    return { running: sortedUnique(nextRunning), rejected: sortedUnique(nextRejected) };
  }
  if (nextRunning.length >= cap) {
    if (nextRejected.indexOf(task) === -1) nextRejected.push(task);
  } else {
    nextRunning.push(task);
  }
  return { running: sortedUnique(nextRunning), rejected: sortedUnique(nextRejected) };
}

export function stopOf(running, task) {
  return sortedUnique(running.filter((v) => v !== task));
}
