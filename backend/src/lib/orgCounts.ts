// orgCounts — superseded by lib/resolvers/structureCounts (erd_v5). Kept as a
// thin re-export so any residual importer resolves to the one canonical count
// function. The old (tenantId, companyId) signature collapsed to (companyId);
// every count now derives from the ProcessNode/OrgUnit groupBy in the resolver.
export { structureCounts, invalidateStructureCounts } from './resolvers/structureCounts.js';
export type { StructureCounts } from './resolvers/structureCounts.js';
