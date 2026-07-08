import { Router } from 'express';
import 'express-async-errors';
import { resolveDistrict } from '../services/districtResolver';

const router = Router();

/**
 * Address verification for signup — replaces the old positionstack geocode
 * (rate-limited, paid, non-authoritative). The Census geocoder both validates
 * the address (it must match a real one) and returns the congressional
 * district, so the frontend can show "Verified — you're in NY-7" pre-submit.
 *
 * GET /location/verify?street=&city=&state=&zipcode=
 */
router.get('/verify', async (req, res) => {
	const { street, city, state, zipcode } = req.query;
	if (!street || !city || !state || !zipcode) {
		return res.status(400).json({ valid: false, message: 'street, city, state, zipcode are required' });
	}

	const resolution = await resolveDistrict(`${street}, ${city}, ${state} ${zipcode}`);
	if (!resolution) {
		return res.json({ valid: false });
	}
	return res.json({
		valid: true,
		matchedAddress: resolution.matchedAddress,
		state: resolution.state,
		district: resolution.district,
	});
});

export default router;
