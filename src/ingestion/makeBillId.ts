export function makeBillId(congress: number, billType: string, billNumber: string) {
	return `${congress}-${billType.toLowerCase()}-${billNumber}`;
}
