import {Injectable, Inject, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {Router} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, Observable, of, from, forkJoin, firstValueFrom} from 'rxjs';
import {switchMap, map, catchError, tap} from 'rxjs/operators';
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

  login(credentials: { username: string, password: string }): Observable<boolean> {
    const defaultConfig$ = this.http.get<any>('assets/config/app-config.json');
    const customConfig$ = this.apiService.getComponentDetails(this.USER_CONFIG_PID).pipe(
      map((details: any) => details.properties),
      catchError(() => of(null))
    );

    return forkJoin({defaultConfig: defaultConfig$, customConfig: customConfig$}).pipe(
      switchMap(({defaultConfig, customConfig}) => {
        const enteredPasswordHash = this.hashPassword(credentials.password);
        return of({defaultConfig, customConfig, enteredPasswordHash});
      }),
      map(({defaultConfig, customConfig, enteredPasswordHash}) => {
        const defaultUser = defaultConfig?.systemInfo?.defaultUser;
        if (!defaultUser) return false;

        const correctUsername = customConfig?.username?.value || defaultUser.username;
        const correctHash = customConfig?.passwordHash?.value || defaultUser.passwordHash;

        if (credentials.username === correctUsername && enteredPasswordHash === correctHash) {
          if (isPlatformBrowser(this.platformId)) {
            sessionStorage.setItem('isLoggedIn', 'true');
          }
          this._isLoggedIn.next(true);
          this.router.navigate(['/status']);
          return true;
        } else {
          return false;
        }
      })
    );
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem('isLoggedIn');
    }
    this._isLoggedIn.next(false);
    this.router.navigate(['/login']);
  }

  // SỬA LỖI: Bổ sung lại hàm này
  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    const defaultConfig = await firstValueFrom(this.http.get<any>('assets/config/app-config.json'));
    const customConfig = await firstValueFrom(this.apiService.getComponentDetails(this.USER_CONFIG_PID).pipe(
      map((details: any) => details.properties),
      catchError(() => of(null))
    ));

    const correctHash = customConfig?.passwordHash?.value || defaultConfig?.systemInfo?.defaultUser.passwordHash;

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

    await firstValueFrom(this.apiService.createOrUpdateConfig(this.USER_CONFIG_PID, configToSave));
    this.notificationService.showSuccess("Password changed successfully. Please log in again.");
    return true;
  }
}
