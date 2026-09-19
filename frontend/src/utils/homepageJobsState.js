// Pure homepage pagination logic

// Single source for page size
export const HOMEPAGE_PAGE_SIZE = 9;

/** Appends only new jobs */
export function mergeUniqueJobs(existingJobs, newJobs) {
  const seenIds = new Set(existingJobs.map((job) => job._id));
  const deduped = newJobs.filter((job) => !seenIds.has(job._id));
  return [...existingJobs, ...deduped];
}
