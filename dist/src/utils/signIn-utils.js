"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSignIn = void 0;
const react_router_dom_1 = require("react-router-dom");
const AuthProvider_1 = require("../providers/AuthProvider");
const react_hot_toast_1 = __importDefault(require("react-hot-toast"));
const api_1 = require("../api");
const handleSignIn = async (username, password) => {
    const { setUser } = (0, AuthProvider_1.useAuthInfo)();
    const navigate = (0, react_router_dom_1.useNavigate)();
    await api_1.Requests.loginUser({ username, password })
        .then(async (data) => {
        if (!data) {
            throw new Error('User not found or incorrect password');
        }
        localStorage.clear();
        localStorage.setItem('user', JSON.stringify(data.userInfo));
        localStorage.setItem('token', data.token);
        await setUser(data.userInfo);
        const userLog = await api_1.Requests.getVoteLog(data.token);
        localStorage.setItem('userLog', JSON.stringify(userLog));
        navigate('/App', {
            state: userLog
        });
    })
        .catch((err) => {
        react_hot_toast_1.default.error('No matching credentials found');
        console.error('Fetch error:', err.message);
    });
};
exports.handleSignIn = handleSignIn;
