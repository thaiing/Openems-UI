import {Component, Output, EventEmitter} from '@angular/core';
import {RouterModule} from '@angular/router';
import {MatListModule} from '@angular/material/list';
import {MatIconModule} from '@angular/material/icon';
import {CommonModule} from '@angular/common'; // <-- Thêm CommonModule để dùng *ngIf

@Component({
  selector: 'app-secondary-sidebar',
  standalone: true,
  imports: [
    RouterModule,
    MatListModule,
    MatIconModule,
    CommonModule // <-- Khai báo ở đây
  ],
  templateUrl: './secondary-sidebar.component.html',
  styleUrls: ['./secondary-sidebar.component.scss']
})
export class SecondarySidebarComponent {
  @Output() linkClicked = new EventEmitter<void>();

  // Biến để theo dõi menu nào đang được mở
  public openMenu: string = '';

  // Hàm để đóng/mở menu con
  toggleSubMenu(menuName: string): void {
    if (this.openMenu === menuName) {
      this.openMenu = ''; // Nếu đang mở thì đóng lại
    } else {
      this.openMenu = menuName; // Nếu đang đóng thì mở ra
    }
  }
}
