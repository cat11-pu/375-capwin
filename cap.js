// cap.js：启动与结束（基线：一律原样返回）
export function startOf(running, rejected, task, cap) {
  return { running: running, rejected: rejected };
}

export function stopOf(running, task) {
  return running;
}
