"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestMembersBatch = ingestMembersBatch;
const congressGovClient_1 = require("../services/congressGovClient");
const ingestMember_1 = require("./ingestMember");
const PAGE_SIZE = 250;
// Full current-member roster (~537) is cheap — one detail call each, well under
// the rate limit, so no incremental window needed. `maxPages` bounds it for
// verification slices.
async function ingestMembersBatch(opts = {}) {
    let offset = 0;
    let processed = 0;
    let failed = 0;
    let pages = 0;
    while (true) {
        const page = await (0, congressGovClient_1.getMembers)({ offset, limit: PAGE_SIZE, currentMember: true });
        const members = page.members ?? [];
        if (members.length === 0)
            break;
        for (const m of members) {
            try {
                await (0, ingestMember_1.ingestMember)(m.bioguideId);
                processed++;
            }
            catch (err) {
                failed++;
                console.error(`Failed to ingest member ${m.bioguideId}:`, err.message);
            }
        }
        pages++;
        if (opts.maxPages && pages >= opts.maxPages)
            break;
        if (!page.pagination?.next)
            break;
        offset += members.length;
    }
    return { processed, failed };
}
