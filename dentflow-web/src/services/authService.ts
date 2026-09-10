import axios from 'axios';

interface LoginResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      branchId?: string;
    };
    token: string;
    refreshToken: string;
    role: string;
    redirectUrl: string;
  };
}

export class AuthService {
  private static TOKEN_KEY = 'dentflow_token';
  private static REFRESH_TOKEN_KEY = 'dentflow_refresh_token';
  private static USER_KEY = 'dentflow_user';

  static async login(email: string, password: string): Promise<LoginResponse['data']> {
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
        { email, password }
      );
      const data = response.data?.data ?? response.data;
      if (data.token) {
        this.setTokens(data.token, data.refreshToken);
        this.setUser({ ...data.user, role: data.role });
      }
      return data;
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
