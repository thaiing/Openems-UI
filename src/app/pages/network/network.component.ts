import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';

// Import các module cần thiết
import {MatTabsModule} from '@angular/material/tabs';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

@Component({
  selector: 'app-network',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './network.component.html',
  styleUrls: ['./network.component.scss']
})
export class NetworkComponent implements OnInit {
  // Dữ liệu cho tab Ethernet
  ethernetInterfaces = [
    {
      netNo: 'ETH0',
      dhcp: true,
      ip: '10.2.5.214',
      subMask: '255.255.255.0',
      gateway: '10.2.5.1',
      isEditing: false
    },
    {
      netNo: 'ETH1',
      dhcp: false,
      ip: '192.168.2.254',
      subMask: '255.255.255.0',
      gateway: '',
      isEditing: false
    }
  ];

  // FormGroup cho tab APN và cho việc sửa Ethernet
  apnForm!: FormGroup;
  ethEditForm!: FormGroup;

  constructor(private fb: FormBuilder) {
  }

  ngOnInit(): void {
    // Khởi tạo form cho tab APN
    this.apnForm = this.fb.group({
      enable: [true],
      apn: [''],
      username: [''],
      password: [''],
      server: ['www.baidu.com']
    });

    // Khởi tạo form rỗng cho việc sửa Ethernet
    this.ethEditForm = this.fb.group({
      dhcp: [false],
      ip: [''],
      subMask: [''],
      gateway: ['']
    });
  }

  // Bật chế độ sửa cho một interface
  editEth(eth: any) {
    // Đóng các mục đang sửa khác
    this.ethernetInterfaces.forEach(i => i.isEditing = false);
    // Bật chế độ sửa cho mục được chọn
    eth.isEditing = true;
    // Đổ dữ liệu của mục đó vào form sửa
    this.ethEditForm.patchValue({
      dhcp: eth.dhcp,
      ip: eth.ip,
      subMask: eth.subMask,
      gateway: eth.gateway
    });
  }

  // Lưu thay đổi cho một interface
  saveEth(ethToUpdate: any) {
    if (this.ethEditForm.valid) {
      const formValues = this.ethEditForm.value;
      const index = this.ethernetInterfaces.findIndex(e => e.netNo === ethToUpdate.netNo);
      if (index !== -1) {
        this.ethernetInterfaces[index] = {...ethToUpdate, ...formValues, isEditing: false};
      }
    }
  }

  // Hủy sửa
  cancelEthEdit(eth: any) {
    eth.isEditing = false;
  }

  // Lưu thay đổi cho APN
  saveApn() {
    if (this.apnForm.valid) {
      console.log('APN form saved:', this.apnForm.value);
      // Tại đây bạn sẽ gọi API để lưu
    }
  }
}
