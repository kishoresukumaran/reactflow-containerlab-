import users from '../config/users.json';

export const authenticateUser = (username, password) => {
  const user = users.users.find(
    (u) => u.username === username && u.password === password
  );

  if (user) {
    // Return user info without sensitive data
    const { password, ...userInfo } = user;
    return {
      success: true,
      user: userInfo
    };
  }

  return {
    success: false,
    message: 'Invalid username or password'
  };
}; 