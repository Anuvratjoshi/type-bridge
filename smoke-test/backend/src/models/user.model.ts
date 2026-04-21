// smoke-test/backend/src/models/user.model.ts
// Simulates a typical Mongoose + TypeScript model

export type UserRole = "admin" | "moderator" | "user";

export interface UserAddress {
  street: string;
  city: string;
  country: string;
  zipCode?: string;
}

export interface UserProfile {
  bio?: string;
  avatarUrl?: string;
  website?: string;
  location?: string;
  twitter?: string;
  address?: UserAddress;
}

export interface IUser {
  _id: string;
  name: string;
  email: string;
  password: string; // should be STRIPPED
  passwordHash: string; // should be STRIPPED
  token: string; // should be STRIPPED
  refreshToken: string; // should be STRIPPED
  role: UserRole;
  isVerified: boolean;
  isActive: boolean;
  profile: UserProfile;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  lastLoginAt: Date; // should become string
  createdAt: Date; // should become string
  updatedAt: Date; // should become string
}

export interface CreateUserDTO {
  name: string;
  email: string;
  password: string; // should be STRIPPED
  role?: UserRole;
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  profile?: Partial<UserProfile>;
  isActive?: boolean;
}

export interface UserSummary {
  _id: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  isVerified: boolean;
}
