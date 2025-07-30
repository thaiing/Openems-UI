import {Injectable, Inject, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {Router} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, Observable, of, from} from 'rxjs';
import {switchMap, map, catchError} from 'rxjs/operators';
import {NotificationService} from './notification.service';
import * as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _isLoggedIn = new BehaviorSubject<boolean>(false);
  public readonly isLoggedIn$ = this._isLoggedIn.asObservable();

  constructor(
    private router: Router,
    private http: HttpClient,
    private notificationService: NotificationService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
      this._isLoggedIn.next(loggedIn);
    }
  }

  private hashPassword(password: string): string {
    return CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex);
  }

  login(credentials: { username: string, password: string }): Observable<boolean> {
    return this.http.get<any>('assets/config/app-config.json').pipe(
      map(config => {
        const defaultUser = config?.systemInfo?.defaultUser;
        if (!defaultUser || credentials.username !== defaultUser.username) {
          return false;
        }

        const enteredPasswordHash = this.hashPassword(credentials.password);

        const customPasswordHash = isPlatformBrowser(this.platformId) ? localStorage.getItem('customPasswordHash') : null;
        const correctHash = customPasswordHash || defaultUser.passwordHash;

        if (enteredPasswordHash === correctHash) {
          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('isLoggedIn', 'true');
          }
          this._isLoggedIn.next(true);
          this.router.navigate(['/status']);
          return true;
        } else {
          return false;
        }
      }),
      catchError(err => {
        console.error('Login error:', err);
        return of(false);
      })
    );
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('isLoggedIn');
    }
    this._isLoggedIn.next(false);
    this.router.navigate(['/login']);
  }
}
