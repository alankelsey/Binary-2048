export type ResumeWriteJob<T> = {
  revision: number;
  value: T;
};

export function createResumeWriteQueue<T>() {
  let latest: ResumeWriteJob<T> | null = null;
  let committedRevision = 0;

  return {
    enqueue(value: T) {
      const revision = (latest?.revision ?? committedRevision) + 1;
      latest = { revision, value };
      return latest;
    },
    latest() {
      return latest;
    },
    flush(revision: number, write: (value: T) => void) {
      if (!latest || revision !== latest.revision || revision <= committedRevision) return null;
      const job = latest;
      write(job.value);
      committedRevision = job.revision;
      return job;
    },
    clear() {
      latest = null;
      committedRevision += 1;
    }
  };
}
