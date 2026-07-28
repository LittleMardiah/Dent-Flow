import axios from 'axios';

interface LoginResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    branchId?: string;
  };
}

export class AuthService {
  private static TOKEN_KEY = 'dentflow_token';
  private static REFRESH_TOKEN_KEY = 'dentflow_refresh_token';
  private static USER_KEY = 'dentflow_user';

  static async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
        { email, password }
      );
      if (response.data.token) {
        this.setTokens(response.data.token, response.data.refreshToken);
        this.setUser(response.data.user);
      }
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login gagal');
    }
  }

  static logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    window.location.href = '/login';
  }

  static setTokens(token: string, refreshToken: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static setUser(user: any): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  static getUser(): any | null {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
