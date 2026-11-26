import 'dotenv/config';
import prisma from '../../prisma/prisma';
import { resolveDelegation } from '../services/districtResolver';
import { runIngestion } from '../ingestion/runIngestion';
import { applyDelegationChange, planDelegationChange } from '../services/repTerms';

/** Re-verify user→delegation mappings that are stale (default 30 days). */
const STALE_DAYS = 30;

/**
 * Delegation reconciliation — keeps constituent→member mappings TRUE over time.
 * Re-resolves users whose mapping:
 *  - was never Census-verified (fallback/unresolved signups, Census outages),
 *  - includes a member who is no longer in office (vacancy, special election,
 *    resignation — after a complete pass, the roster ingest sets
 *    `currentMember=false` on anyone congress.gov stopped listing; see
 *    retireDepartedMembers in ingestion/ingestMembersBatch),
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
			select: {
				id: true,
				username: true,
				street: true,
				city: true,
				state: true,
				zipcode: true,
				district: true,
				derivedState: true,
				members: { select: { id: true, currentMember: true } },
			},
		});

		let updated = 0;
		let unresolved = 0;
		let pruned = 0;
		for (const user of users) {
			const delegation = await resolveDelegation(user);
			const resolved = delegation && delegation.memberIds.length > 0 ? delegation : null;
			// Classify against the STORED district/links, before anything is overwritten.
			const plan = planDelegationChange({
				linked: user.members,
				oldDistrict: user.district,
				oldState: user.derivedState,
				next: resolved
					? {
							memberIds: resolved.memberIds,
							district: resolved.resolution.district,
							state: resolved.resolution.state,
						}
					: null,
			});

			if (!resolved) {
				// A failed or empty lookup must not strip current members, but members
				// who left office still move to the user's past reps (this also covers
				// DC/territory users whose only member left, with no successor yet).
				unresolved++;
				if (plan.remove.length > 0) {
					await prisma.$transaction((tx) => applyDelegationChange(tx, user.id, plan));
					pruned++;
				}
				continue;
			}

			await prisma.$transaction(async (tx) => {
				await applyDelegationChange(tx, user.id, plan);
				await tx.user.update({
					where: { id: user.id },
					data: {
						district: resolved.resolution.district,
						derivedState: resolved.resolution.state,
						delegationVerifiedAt: new Date(),
						verificationSource: 'census+roster',
					},
				});
			});
			updated++;
		}

		return {
			checked: users.length,
			updated,
			unresolved,
			pruned,
			message: `checked=${users.length} updated=${updated} unresolved=${unresolved} pruned=${pruned}`,
		};
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
