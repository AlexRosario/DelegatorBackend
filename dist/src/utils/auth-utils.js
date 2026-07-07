"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = exports.encryptPassword = exports.getDataFromToken = exports.generateAccessToken = exports.createUnsecuredInfo = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const createUnsecuredInfo = (user) => {
    return {
        id: user.id,
        username: user.username,
        zipcode: user.zipcode,
        emailVerified: user.emailVerified,
        district: user.district,
        verificationSource: user.verificationSource,
    };
};
exports.createUnsecuredInfo = createUnsecuredInfo;
const generateAccessToken = (user) => {
    // Sign ONLY the fields the token needs. Callers pass full Prisma rows —
    // signing `user` directly would embed passwordHash in a decodable JWT.
    return jsonwebtoken_1.default.sign({ id: user.id, username: user.username, zipcode: user.zipcode }, process.env.JWT_SECRET, {
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
const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1] || '';
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
