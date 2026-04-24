// In-memory cache for loadDatabase and loadWorkspaceMembers results.
// Avoids re-fetching when navigating back to a database page within the TTL.
// Invalidated on any local mutation via invalidateDatabase().

const DEFAULT_TTL_MS = 30_000;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const databaseCache = new Map<string, CacheEntry<unknown>>();
const membersCache = new Map<string, CacheEntry<unknown>>();

function isValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return entry !== undefined && Date.now() < entry.expiresAt;
}

export function getDatabaseCache<T>(databaseId: string): T | null {
  const entry = databaseCache.get(databaseId) as
    | CacheEntry<T>
    | undefined;
  return isValid(entry) ? entry.data : null;
}

export function setDatabaseCache<T>(databaseId: string, data: T): void {
  databaseCache.set(databaseId, {
    data,
    expiresAt: Date.now() + DEFAULT_TTL_MS,
  });
}

export function invalidateDatabase(databaseId: string): void {
  databaseCache.delete(databaseId);
}

export function getMembersCache<T>(workspaceId: string): T | null {
  const entry = membersCache.get(workspaceId) as
    | CacheEntry<T>
    | undefined;
  return isValid(entry) ? entry.data : null;
}

export function setMembersCache<T>(workspaceId: string, data: T): void {
  membersCache.set(workspaceId, {
    data,
    expiresAt: Date.now() + DEFAULT_TTL_MS,
  });
}

export function invalidateMembers(workspaceId: string): void {
  membersCache.delete(workspaceId);
}

/** Clear all caches. Used in tests to prevent cross-test leakage. */
export function clearAllCaches(): void {
  databaseCache.clear();
  membersCache.clear();
}
