export const FREE_PROJECT_LIMIT = 3;
export const FREE_NODE_LIMIT = 100;
export const timestampMs = value => typeof value?.toMillis === 'function' ? value.toMillis() : Number(value || 0);

export function monthAfter(anchor, months = 1) {
  const start = new Date(timestampMs(anchor));
  const date = new Date(start);
  date.setUTCDate(1);
  date.setUTCMonth(start.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(start.getUTCDate(), last));
  return date.getTime();
}

export function planState(plan, now = Date.now()) {
  if (plan?.mode !== 'test' || !timestampMs(plan.startedAt)) return { active: false, days: 0, renewsAt: 0 };
  const start = timestampMs(plan.startedAt);
  let end = timestampMs(plan.expiresAt);
  if (plan.autoRenew && now >= start) {
    const a = new Date(start), b = new Date(now);
    let months = Math.max(1, (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth());
    end = monthAfter(start, months);
    if (end <= now) end = monthAfter(start, months + 1);
  }
  const active = start <= now && end > now;
  return { active, days: active ? Math.ceil((end - now) / 86400000) : 0, renewsAt: end };
}

export function checkProjectLimit(count, plan) {
  if (!planState(plan).active && count >= FREE_PROJECT_LIMIT) throw Error('무료 계정은 프로젝트를 동시에 3개까지 만들 수 있습니다. 기존 프로젝트를 삭제하거나 circle+를 이용해 주세요.');
}
export function checkNodeLimit(count, plan) {
  if (!planState(plan).active && count >= FREE_NODE_LIMIT) throw Error('무료 프로젝트에는 개념을 100개까지 만들 수 있습니다. 프로젝트 소유자가 circle+를 이용하면 제한이 해제됩니다.');
}
