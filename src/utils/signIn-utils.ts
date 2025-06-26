import { useNavigate } from 'react-router-dom';
import { useAuthInfo } from '../providers/AuthProvider';
import toast from 'react-hot-toast';
import { Requests } from '../api';

export const handleSignIn = async (username: string, password: string) => {
  const { setUser } = useAuthInfo();
  const navigate = useNavigate();
  await Requests.loginUser({ username, password })
    .then(async (data) => {
      if (!data) {
        throw new Error('User not found or incorrect password');
      }
      localStorage.clear();
      localStorage.setItem('user', JSON.stringify(data.userInfo));
      localStorage.setItem('token', data.token);

      await setUser(data.userInfo);
      const userLog = await Requests.getVoteLog(data.token);
      localStorage.setItem('userLog', JSON.stringify(userLog));

      navigate('/App', {
        state: userLog
      });
    })
    .catch((err) => {
      toast.error('No matching credentials found');
      console.error('Fetch error:', err.message);
    });
};
