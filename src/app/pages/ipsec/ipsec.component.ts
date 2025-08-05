import {Component, OnInit} from '@angular/core';
import {CommonModule, TitleCasePipe} from '@angular/common';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {MatTabsModule} from '@angular/material/tabs';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

import {ApiService} from '../../services/api.service';
import {NotificationService} from '../../services/notification.service';
import {IpsecEditDialogComponent} from '../../dialogs/ipsec-edit-dialog/ipsec-edit-dialog.component';
import {IpsecConnectionListComponent} from './ipsec-connection-list/ipsec-connection-list.component';

@Component({
  selector: 'app-ipsec',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    IpsecConnectionListComponent
  ],
  templateUrl: './ipsec.component.html',
  styleUrls: ['./ipsec.component.scss']
})
export class IpsecComponent implements OnInit {

  siteToSiteConnections: any[] = [];
  remoteAccessConnections: any[] = [];

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog,
    private notificationService: NotificationService
  ) {
  }

  ngOnInit(): void {
    this.loadConnections();
  }

  loadConnections(): void {
    this.apiService.getIpsecConnections().subscribe({
      next: (data) => {
        this.siteToSiteConnections = data.filter(c => c.conn_type === 'site-to-site');
        this.remoteAccessConnections = data.filter(c => c.conn_type === 'remote-access');
      },
      error: (err) => {
        console.error('Failed to load connections', err);
        this.notificationService.showError('Failed to load connections');
      }
    });
  }

  addConnection(category: 'site-to-site' | 'remote-access'): void {
    this.openEditDialog({category: category});
  }

  editConnection(connection: any): void {
    // Trong tương lai, bạn có thể gọi API để lấy chi tiết connection trước khi mở dialog
    this.openEditDialog(connection);
  }

  openEditDialog(data: any | null): void {
    const dialogRef = this.dialog.open(IpsecEditDialogComponent, {
      width: '850px',
      maxHeight: '90vh',
      data: data,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      // Nếu dialog trả về 'true' (lưu thành công), tải lại danh sách
      if (result) {
        this.loadConnections();
      }
    });
  }

  deleteConnection(connection: any): void {
    if (confirm(`Are you sure you want to delete the connection "${connection.name}"?`)) {
      this.apiService.deleteIpsecConnection(connection.id).subscribe({
        next: () => {
          this.notificationService.showSuccess('Connection deleted successfully');
          this.loadConnections();
        },
        error: (err) => {
          this.notificationService.showError('Failed to delete connection');
        }
      });
    }
  }
}
