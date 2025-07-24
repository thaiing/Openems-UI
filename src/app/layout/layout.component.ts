import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router, NavigationEnd, RouterOutlet, ActivatedRoute} from '@angular/router';
import {filter, map, mergeMap} from 'rxjs/operators';

// Import các module của Material
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';

// Import các component con
import {SecondarySidebarComponent} from '../components/secondary-sidebar/secondary-sidebar.component';
import {AuthComponent} from '../dialogs/auth/auth.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatIconModule,
    MatButtonModule,
    SecondarySidebarComponent,
    MatDialogModule // Thêm module dialog
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent implements OnInit {
  public currentPageTitle: string = '';
  public isSidebarMobileVisible = false;
  public isSidebarDesktopCollapsed = false;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    public dialog: MatDialog // Tiêm MatDialog vào constructor
  ) {
  }

  ngOnInit(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => {
        let route = this.activatedRoute;
        while (route.firstChild) {
          route = route.firstChild;
        }
        return route;
      }),
      filter(route => route.outlet === 'primary'),
      mergeMap(route => route.data)
    ).subscribe(data => {
      this.currentPageTitle = (data['title'] && data['title'] !== 'Status') ? data['title'] : '';
    });
  }

  // Mở dialog Đăng nhập/Đăng ký
  openAuthDialog(): void {
    this.dialog.open(AuthComponent, {
      width: '450px',
    });
  }

  toggleSidebarMobile() {
    this.isSidebarMobileVisible = !this.isSidebarMobileVisible;
  }

  toggleSidebarDesktop() {
    this.isSidebarDesktopCollapsed = !this.isSidebarDesktopCollapsed;
  }

  closeMobileSidebar(): void {
    this.isSidebarMobileVisible = false;
  }
}
