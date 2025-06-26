import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	const user = await prisma.user.create({
		data: {
			username: 'John Doe',
			email: 'john.doe@example.com',
			passwordHash: 'hashed_password', // Replace with a valid hash
			street: '123 Main St',
			city: 'Sample City',
			state: 'Sample State',
			zipcode: '12345',
		},
	});
}

main()
	.then(() => {
		console.log('Seeding completed successfully.');
	})
	.catch((e) => {
		console.error('Error during seeding:', e);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
export default main;
