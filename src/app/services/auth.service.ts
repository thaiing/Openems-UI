import {Injectable, Inject, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {Router} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, Observable, of, from, firstValueFrom} from 'rxjs';
import {map, catchError} from 'rxjs/operators';
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
  private async getCorrectPasswordHash(): Promise<{ hash: string | null, isCustom: boolean }> {
    try {
      const customConfig = await firstValueFrom(
        this.apiService.getComponentDetails(this.USER_CONFIG_PID).pipe(map((details: any) => details.properties))
      );
      const passwordHashProp = customConfig?.find((p: any) => p.key === 'passwordHash');
      if (passwordHashProp && passwordHashProp.value) {
        return {hash: passwordHashProp.value, isCustom: true}; // Trả về mật khẩu tùy chỉnh
      }
    } catch (error) {
      // Bỏ qua lỗi, sẽ dùng mật khẩu mặc định
    }

    try {
      const defaultConfig = await firstValueFrom(this.http.get<any>('assets/config/app-config.json'));
      return {hash: defaultConfig?.systemInfo?.defaultUser?.passwordHash || null, isCustom: false};
    } catch (error) {
      console.error("Could not load default config", error);
      return {hash: null, isCustom: false};
    }
  }

  // SỬA LỖI: Logic đăng nhập được viết lại hoàn toàn
  async login(credentials: { username: string, password: string }): Promise<void> {
    const enteredPasswordHash = this.hashPassword(credentials.password);
    const {hash: correctHash} = await this.getCorrectPasswordHash();

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
    const {hash: correctHash, isCustom} = await this.getCorrectPasswordHash();

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
      if (isCustom) { // Nếu đã có mật khẩu tùy chỉnh, cập nhật
        await firstValueFrom(this.apiService.updateConfigComponent(this.USER_CONFIG_PID, configToSave));
      } else { // Nếu chưa, tạo mới
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
