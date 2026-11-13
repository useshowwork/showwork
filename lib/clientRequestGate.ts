/** Share overlapping reads so polling/focus cannot continually supersede a slow request. */
export function createClientRequestGate() {
  const pending = new Map<string, Promise<unknown>>();
  function run<T>(key: string, read: () => Promise<T>, afterCurrent = false): Promise<T> {
    const current = pending.get(key);
    if (current) {
      return afterCurrent
        ? current.catch(() => undefined).then(() => run(key, read))
        : current as Promise<T>;
    }
    const request = read();
    pending.set(key, request);
    const release = () => { if (pending.get(key) === request) pending.delete(key); };
    void request.then(release, release);
    return request;
  }
  return { run, clear: () => pending.clear() };
}
