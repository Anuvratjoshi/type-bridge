// smoke-test/backend/src/dtos/auth.dto.ts

export interface LoginDTO {
  email: string;
  password: string; // should be STRIPPED
}

export interface LoginResponse {
  accessToken: string; // should be STRIPPED
  refreshToken: string; // should be STRIPPED
  user: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "user";
  };
}

/** @type-bridge-ignore */
export interface InternalServerMetadata {
  dbConnectionString: string;
  redisUrl: string;
}
