import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormBuilder, FormGroup} from '@angular/forms';

// Import các module của Material
import {MatTabsModule} from '@angular/material/tabs';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatButtonModule} from '@angular/material/button';
import {MatTableModule} from '@angular/material/table';
import {MatIconModule} from '@angular/material/icon';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {IpsecEditDialogComponent} from '../../dialogs/ipsec-edit-dialog/ipsec-edit-dialog.component';

@Component({
  selector: 'app-ipsec',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatTabsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatTableModule, MatIconModule, MatDialogModule
  ],
  templateUrl: './ipsec.component.html',
  styleUrls: ['./ipsec.component.scss']
})
export class IpsecComponent implements OnInit {
  globalSettingsForm!: FormGroup;

  // Dữ liệu mẫu cho bảng IPSec Settings
  ipsecSettingsData = [
    {
      id: 1,
      status: true,
      name: 'test1',
      remoteGateway: '10.1.1.2',
      localNetwork: '192.168.127.254/24',
      remoteNetwork: '192.168.127.1/24'
    },
  ];
  ipsecSettingsDisplayedColumns: string[] = ['status', 'name', 'remoteGateway', 'localNetwork', 'remoteNetwork', 'actions'];
  ipsecSettingsDataSource = [...this.ipsecSettingsData];

  // Dữ liệu mẫu cho bảng IPSec Status
  ipsecStatusData = [
    {
      name: 'test1',
      localNetwork: '192.168.127.254/24',
      localGateway: '10.123.13.33',
      remoteNetwork: '192.168.127.1/24',
      remoteGateway: '10.1.1.2',
      keyExchange: 'Done',
      dataExchange: 'Done',
      time: '0h:0m:0s'
    },
  ];
  ipsecStatusDisplayedColumns: string[] = ['name', 'localNetwork', 'localGateway', 'remoteNetwork', 'remoteGateway', 'keyExchange', 'dataExchange', 'time'];
  ipsecStatusDataSource = [...this.ipsecStatusData];

  constructor(private fb: FormBuilder, public dialog: MatDialog) {
  }

  ngOnInit(): void {
    this.globalSettingsForm = this.fb.group({
      status: ['Enabled'],
      natT: ['Disabled'],
      eventLog: ['Disabled'],
      logDestination: ['']
    });
  }

  openEditDialog(data?: any): void {
    const dialogRef = this.dialog.open(IpsecEditDialogComponent, {
      width: '800px',
      data: data ? {...data} : null // Truyền dữ liệu vào dialog nếu là sửa
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) { // Nếu có kết quả trả về từ dialog
        if (data) {
          // Chế độ sửa
          const index = this.ipsecSettingsDataSource.findIndex(item => item.id === data.id);
          this.ipsecSettingsDataSource[index] = {...data, ...result};
        } else {
          // Chế độ thêm mới
          const newId = this.ipsecSettingsDataSource.length > 0 ? Math.max(...this.ipsecSettingsDataSource.map(item => item.id)) + 1 : 1;
          this.ipsecSettingsDataSource.push({id: newId, ...result});
        }
        this.ipsecSettingsDataSource = [...this.ipsecSettingsDataSource]; // Refresh lại table
      }
    });
  }

  deleteItem(id: number): void {
    this.ipsecSettingsDataSource = this.ipsecSettingsDataSource.filter(item => item.id !== id);
  }
}
