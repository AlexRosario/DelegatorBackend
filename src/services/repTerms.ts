import type { Prisma, RepEndReason } from '@prisma/client';

/**
 * Rep history bookkeeping. `User.members` (_UserMembers) is the CURRENT
 * delegation; `UserRepTerm` records every span a member represented a user.
 * Every change to the current set goes through applyDelegationChange so the
 * two never drift.
 */

export type LinkedMember = { id: string; currentMember: boolean };

export type DelegationPlan = {
	add: string[];
	remove: { id: string; reason: RepEndReason }[];
};

/**
 * Decide how a user's current delegation should change.
 *
 * `next` is the fresh resolution, or null when it failed or came back empty
 * (Census outage, or a DC/territory seat with no delegate seated). In that
 * case we can't know who the reps ARE, but we do know who left office, so
 * only non-current members are removed. Everyone else is kept rather than
 * stripped on a failed lookup.
 *
 * Reason for each removal:
 *  - member no longer on the roster            → LEFT_OFFICE
 *  - still serving, user's district/state moved → REDISTRICTED
 *  - anything else (roster correction, unknown prior district) → OTHER
 * MOVED is reserved for an address-change flow, which doesn't exist yet.
 */
export function planDelegationChange(input: {
	linked: LinkedMember[];
	oldDistrict: number | null;
	oldState: string | null;
	next: { memberIds: string[]; district: number; state: string } | null;
}): DelegationPlan {
	const { linked, oldDistrict, oldState, next } = input;

	if (!next || next.memberIds.length === 0) {
		return {
			add: [],
			remove: linked.filter((m) => !m.currentMember).map((m) => ({ id: m.id, reason: 'LEFT_OFFICE' })),
		};
	}

	const nextIds = new Set(next.memberIds);
	const linkedIds = new Set(linked.map((m) => m.id));
	const districtChanged =
		oldDistrict !== null && oldState !== null && (oldDistrict !== next.district || oldState !== next.state);

	return {
		add: next.memberIds.filter((id) => !linkedIds.has(id)),
		remove: linked
			.filter((m) => !nextIds.has(m.id))
			.map((m) => ({
				id: m.id,
				reason: !m.currentMember ? 'LEFT_OFFICE' : districtChanged ? 'REDISTRICTED' : 'OTHER',
			})),
	};
}

/** Apply a plan inside a transaction: relation + spans move together. */
export async function applyDelegationChange(
	tx: Prisma.TransactionClient,
	userId: number,
	plan: DelegationPlan,
	now: Date = new Date()
) {
	if (plan.add.length > 0) {
		await tx.userRepTerm.createMany({
			data: plan.add.map((memberId) => ({ userId, memberId, startedAt: now })),
		});
	}
	for (const { id, reason } of plan.remove) {
		await tx.userRepTerm.updateMany({
			where: { userId, memberId: id, endedAt: null },
			data: { endedAt: now, endReason: reason },
		});
	}
	if (plan.add.length > 0 || plan.remove.length > 0) {
		await tx.user.update({
			where: { id: userId },
			data: {
				members: {
					connect: plan.add.map((id) => ({ id })),
					disconnect: plan.remove.map((r) => ({ id: r.id })),
				},
			},
		});
	}
}
