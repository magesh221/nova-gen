import bcrypt from 'bcrypt';

export const hashedPassword = (password) => bcrypt.hash(password, 12);
export const comparePassword = (password, passwordHash) => bcrypt.compare(password, passwordHash);
