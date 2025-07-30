import {Injectable, Inject, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {Router} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, Observable, of, from, forkJoin, firstValueFrom} from 'rxjs';
import {switchMap, map, catchError} from 'rxjs/operators';
import {NotificationService} from './notification.service';
import {ApiService} from './api.service';
import * as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _isLoggedIn = new BehaviorSubject<boolean>(false);
  public readonly isLoggedIn$ = this._isLoggedIn.asObservable();

  private readonly USER_CONFIG_PID = 'com.maxicom.userconfig';

  constructor(
    private router: Router,
    private http: HttpClient,
    private notificationService: NotificationService,
    private apiService: ApiService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      const loggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
      this._isLoggedIn.next(loggedIn);
    }
  }

  private hashPassword(password: string): string {
    return CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex);
  }

  // HÀM MỚI: Lấy mật khẩu đúng (ưu tiên backend)
  private async getCorrectPasswordHash(): Promise<string | null> {
    try {
      const customConfigProperties = await firstValueFrom(
        this.apiService.getComponentDetails(this.USER_CONFIG_PID).pipe(map((details: any) => details.properties))
      );
      // SỬA LỖI: Đọc mật khẩu từ mảng properties một cách chính xác
      const passwordHashProp = customConfigProperties?.find((p: any) => p.key === 'passwordHash');
      if (passwordHashProp && passwordHashProp.value) {
        return passwordHashProp.value; // Trả về mật khẩu tùy chỉnh nếu có
      }
    } catch (error) {
      // Bỏ qua lỗi, sẽ dùng mật khẩu mặc định
    }

    try {
      // Chỉ chạy đến đây nếu không có mật khẩu tùy chỉnh
      const defaultConfig = await firstValueFrom(this.http.get<any>('assets/config/app-config.json'));
      return defaultConfig?.systemInfo?.defaultUser?.passwordHash || null;
    } catch (error) {
      console.error("Could not load default config", error);
      return null;
    }
  }

  async login(credentials: { username: string, password: string }): Promise<void> {
    const enteredPasswordHash = this.hashPassword(credentials.password);
    const correctHash = await this.getCorrectPasswordHash();

    if (correctHash && enteredPasswordHash === correctHash) {
      this.handleLoginSuccess();
    } else {
      this.notificationService.showError('Login failed: Invalid username or password.');
    }
  }

  private handleLoginSuccess(): void {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.setItem('isLoggedIn', 'true');
    }
    this._isLoggedIn.next(true);
    this.router.navigate(['/status']);
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem('isLoggedIn');
    }
    this._isLoggedIn.next(false);
    this.router.navigate(['/login']);
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    const correctHash = await this.getCorrectPasswordHash();

    const oldPasswordHash = this.hashPassword(oldPassword);
    if (oldPasswordHash !== correctHash) {
      this.notificationService.showError("Old password is not correct.");
      return false;
    }

    const newPasswordHash = this.hashPassword(newPassword);
    const configToSave = {
      username: 'admin',
      passwordHash: newPasswordHash
    };

    try {
      const customConfigExists = !!(await firstValueFrom(this.apiService.getComponentDetails(this.USER_CONFIG_PID).pipe(map(() => true), catchError(() => of(false)))));

      if (customConfigExists) {
        await firstValueFrom(this.apiService.updateConfigComponent(this.USER_CONFIG_PID, configToSave));
      } else {
        await firstValueFrom(this.apiService.createConfigComponent(this.USER_CONFIG_PID, configToSave));
      }
      this.notificationService.showSuccess("Password changed successfully. Please log in again.");
      return true;
    } catch (err: any) {
      this.notificationService.showError("Failed to change password: " + err.message);
      return false;
    }
  }
}
