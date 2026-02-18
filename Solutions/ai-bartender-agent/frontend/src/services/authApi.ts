const API_URL = import.meta.env.VITE_API_ENDPOINT;
const API_KEY = import.meta.env.VITE_API_KEY || '';

export interface RegisterRequest {
  username: string;
  registration_code: string;
}

export interface RegisterResponse {
  success: boolean;
  data: {
    user_key: string;
    username: string;
    access_token: string;
    refresh_token: string;
  };
  message?: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  data: {
    access_token: string;
  };
  message?: string;
}

export const registerUser = async (
  username: string,
  registrationCode: string
): Promise<RegisterResponse> => {
  const response = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Registration-Code': registrationCode,
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ username }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Registration failed' }));
    throw new Error(errorData.message || 'Registration failed');
  }

  return response.json();
};

export const refreshToken = async (refreshToken: string): Promise<RefreshTokenResponse> => {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Token refresh failed' }));
    throw new Error(errorData.message || 'Token refresh failed');
  }

  return response.json();
};
