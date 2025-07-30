import {Injectable, Inject, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {Router} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, Observable, of, from, forkJoin, firstValueFrom} from 'rxjs'; // SỬA LỖI: Thêm firstValueFrom
import {switchMap, map, catchError, tap} from 'rxjs/operators';
import {NotificationService} from './notification.service';
import {ApiService} from './api.service';

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

  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  login(credentials: { username: string, password: string }): Observable<boolean> {
    const defaultConfig$ = this.http.get<any>('assets/config/app-config.json');
    const customConfig$ = this.apiService.getComponentDetails(this.USER_CONFIG_PID).pipe(
      map((details: any) => details.properties),
      catchError(() => of(null))
    );

    return forkJoin({defaultConfig: defaultConfig$, customConfig: customConfig$}).pipe(
      switchMap(({defaultConfig, customConfig}) =>
        from(this.hashPassword(credentials.password)).pipe(
          map(enteredPasswordHash => ({defaultConfig, customConfig, enteredPasswordHash}))
        )
      ),
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

  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    const defaultConfig = await firstValueFrom(this.http.get<any>('assets/config/app-config.json'));
    const customConfig = await firstValueFrom(this.apiService.getComponentDetails(this.USER_CONFIG_PID).pipe(
      map((details: any) => details.properties),
      catchError(() => of(null))
    ));

    const correctHash = customConfig?.passwordHash?.value || defaultConfig?.systemInfo?.defaultUser.passwordHash;

    const oldPasswordHash = await this.hashPassword(oldPassword);
    if (oldPasswordHash !== correctHash) {
      this.notificationService.showError("Old password is not correct.");
      return false;
    }

    const newPasswordHash = await this.hashPassword(newPassword);
    const configToSave = {
      username: 'admin',
      passwordHash: newPasswordHash
    };

    await firstValueFrom(this.apiService.createOrUpdateConfig(this.USER_CONFIG_PID, configToSave));
    this.notificationService.showSuccess("Password changed successfully. Please log in again.");
    return true;
  }
}
