import prisma from '../../prisma/prisma';

/**
 * Wraps an ingestion job in an IngestionRun row: opens it "running", runs `fn`,
 * then closes it "success" (recording `fn`'s message) or "failed". Passes the
 * last successful run's start time so incremental jobs know where to resume.
 */
export async function runIngestion<T extends { message: string }>(
	job: string,
	fn: (ctx: { lastSuccessAt: Date | null }) => Promise<T>
): Promise<T> {
	const lastSuccess = await prisma.ingestionRun.findFirst({
		where: { job, status: 'success' },
		orderBy: { startedAt: 'desc' },
	});

	const run = await prisma.ingestionRun.create({ data: { job, status: 'running' } });

	try {
		const result = await fn({ lastSuccessAt: lastSuccess?.startedAt ?? null });
		await prisma.ingestionRun.update({
			where: { id: run.id },
			data: { status: 'success', endedAt: new Date(), message: result.message },
		});
		return result;
	} catch (err) {
		await prisma.ingestionRun.update({
			where: { id: run.id },
			data: { status: 'failed', endedAt: new Date(), message: (err as Error).message },
		});
		throw err;
	}
}
