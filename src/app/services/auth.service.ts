import {Injectable, Inject, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {Router} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, Observable, of, from, firstValueFrom} from 'rxjs';
import {filter, take, map, catchError} from 'rxjs/operators';
import {NotificationService} from './notification.service';
import {ApiService} from './api.service';
import {StateService} from './state.service';
import * as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _isLoggedIn = new BehaviorSubject<boolean>(false);
  public readonly isLoggedIn$ = this._isLoggedIn.asObservable();

  private readonly USER_COMPONENT_FACTORY_PID = 'Controller.io.openems.edge.account.config';
  private readonly DEFAULT_USERNAME = 'admin';

  constructor(
    private router: Router,
    private http: HttpClient,
    private notificationService: NotificationService,
    private apiService: ApiService,
    private stateService: StateService,
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

  private async getCorrectPasswordHash(): Promise<string | null> {
    const allComponents = await firstValueFrom(this.stateService.components$.pipe(filter(c => c !== null), take(1)));

    // Tìm component người dùng bằng ID (chính là username)
    const userComponent = allComponents[this.DEFAULT_USERNAME];

    if (userComponent && userComponent.factoryId === this.USER_COMPONENT_FACTORY_PID && userComponent.properties && userComponent.properties.alias) {
      // Mật khẩu được lưu trong trường 'alias'
      return userComponent.properties.alias;
    }

    // Nếu không có, dùng mật khẩu mặc định
    try {
      const defaultConfig = await firstValueFrom(this.http.get<any>('assets/config/app-config.json'));
      return defaultConfig?.systemInfo?.defaultUser?.passwordHash || null;
    } catch (error) {
      console.error("Could not load default config", error);
      return null;
    }
  }

  async login(credentials: { username: string, password: string }): Promise<void> {
    if (credentials.username !== this.DEFAULT_USERNAME) {
      this.notificationService.showError('Login failed: Invalid username.');
      return;
    }

    const enteredPasswordHash = this.hashPassword(credentials.password);
    const correctHash = await this.getCorrectPasswordHash();

    if (correctHash && enteredPasswordHash === correctHash) {
      this.handleLoginSuccess();
    } else {
      this.notificationService.showError('Login failed: Invalid password.');
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

    // Payload để tạo hoặc cập nhật component Bridge.Onewire
    const configToSave = {
      apply: 'true',
      factoryPid: this.USER_COMPONENT_FACTORY_PID,
      id: this.DEFAULT_USERNAME, // Component ID là username
      alias: newPasswordHash,    // Password hash được lưu vào alias
      propertylist: 'id,alias'
    };

    try {
      // Dùng hàm createComponent mới để tạo/cập nhật
      await firstValueFrom(this.apiService.createUserConfigComponent(this.USER_COMPONENT_FACTORY_PID, configToSave));
      this.notificationService.showSuccess("Password changed successfully. Please log in again.");
      return true;
    } catch (err: any) {
      this.notificationService.showError("Failed to change password: " + err.message);
      return false;
    }
  }
}
