import 'dotenv/config';
import prisma from '../../prisma/prisma';
import { resolveDelegation } from '../services/districtResolver';
import { runIngestion } from '../ingestion/runIngestion';

/** Re-verify user→delegation mappings that are stale (default 30 days). */
const STALE_DAYS = 30;

/**
 * Delegation reconciliation — keeps constituent→member mappings TRUE over time.
 * Re-resolves users whose mapping:
 *  - was never Census-verified (fallback/unresolved signups, Census outages),
 *  - includes a member who is no longer in office (vacancy, special election,
 *    resignation — the roster ingest flips `currentMember`),
 *  - or is simply stale (redistricting, member changes we didn't catch).
 * Runs after the nightly member ingest so the roster is fresh first.
 */
export async function runDelegationReconcile() {
	return runIngestion('delegation-reconcile', async () => {
		const staleBefore = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

		const users = await prisma.user.findMany({
			where: {
				OR: [
					{ verificationSource: null },
					{ NOT: { verificationSource: 'census+roster' } },
					{ delegationVerifiedAt: null },
					{ delegationVerifiedAt: { lt: staleBefore } },
					{ members: { some: { currentMember: false } } },
				],
			},
			select: { id: true, username: true, street: true, city: true, state: true, zipcode: true },
		});

		let updated = 0;
		let unresolved = 0;
		for (const user of users) {
			const delegation = await resolveDelegation(user);
			if (!delegation || delegation.memberIds.length === 0) {
				unresolved++; // keep the existing mapping — a failed lookup must not strip members
				continue;
			}
			await prisma.user.update({
				where: { id: user.id },
				data: {
					district: delegation.resolution.district,
					derivedState: delegation.resolution.state,
					delegationVerifiedAt: new Date(),
					verificationSource: 'census+roster',
					members: { set: delegation.memberIds.map((id) => ({ id })) },
				},
			});
			updated++;
		}

		return { checked: users.length, updated, unresolved, message: `checked=${users.length} updated=${updated} unresolved=${unresolved}` };
	});
}

// CLI entry: `node dist/workers/reconcileDelegations.js` (or npm run reconcile:delegations).
if (require.main === module) {
	runDelegationReconcile()
		.then((r) => {
			console.log('Delegation reconcile complete', r);
			process.exit(0);
		})
		.catch((err) => {
			console.error('Delegation reconcile failed', err);
			process.exit(1);
		});
}
