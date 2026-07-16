"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = exports.SESSION_COOKIE_OPTIONS = exports.tokenFromRequest = exports.encryptPassword = exports.getDataFromToken = exports.generateAccessToken = exports.createUnsecuredInfo = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// PII stays server-side: no zipcode/district/address in anything the client
// stores. Features that need them (5Calls enrichment, CWC gating) read the
// user's row from the DB behind an authenticated route instead.
const createUnsecuredInfo = (user) => {
    return {
        id: user.id,
        username: user.username,
        emailVerified: user.emailVerified,
    };
};
exports.createUnsecuredInfo = createUnsecuredInfo;
const generateAccessToken = (user) => {
    // Sign ONLY the fields the token needs — a JWT is decodable base64, so
    // anything signed here is readable from localStorage. Identity only, no PII.
    return jsonwebtoken_1.default.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
        expiresIn: '1d',
    });
};
exports.generateAccessToken = generateAccessToken;
const getDataFromToken = (token) => {
    if (!token) {
        return null;
    }
    try {
        return jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
    }
    catch (error) {
        console.error('Token verification error:', error);
        return null;
    }
};
exports.getDataFromToken = getDataFromToken;
const encryptPassword = async (password) => {
    const saltRounds = 11;
    return await bcrypt_1.default.hash(password, saltRounds);
};
exports.encryptPassword = encryptPassword;
/** Session token: httpOnly cookie primarily (JS can't read it — XSS-proof),
 *  with Bearer-header fallback so pre-cookie clients keep working. */
const tokenFromRequest = (req) => req.cookies?.token || req.headers.authorization?.split(' ')[1] || '';
exports.tokenFromRequest = tokenFromRequest;
/** Options for the session cookie (set at login, cleared at logout). */
exports.SESSION_COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax',
    // CLIENT_ORIGIN is https in prod, unset (http://localhost) in dev.
    secure: (process.env.CLIENT_ORIGIN ?? '').startsWith('https'),
    maxAge: 24 * 60 * 60 * 1000, // matches the JWT's 1d expiry
};
const authenticate = async (req, res, next) => {
    const token = (0, exports.tokenFromRequest)(req);
    const data = (0, exports.getDataFromToken)(token);
    if (!data) {
        return res.status(401).json({ message: 'Invalid Token' });
    }
    const userFromJwt = await prisma.user.findUnique({
        where: { username: data?.username },
    });
    if (!userFromJwt) {
        return res.status(401).json({ message: 'User not found' });
    }
    req.user = userFromJwt;
    next();
};
exports.authenticate = authenticate;
