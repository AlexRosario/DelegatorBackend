import 'dotenv/config';
import { ingestBill } from '../ingestion/ingestBill';

async function run() {
	console.log('Ingesting single bill...');
	await ingestBill({
		congress: 118,
		billType: 'hr',
		billNumber: '1',
	});
	console.log('Done');
	process.exit(0);
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
