import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormBuilder, FormGroup} from '@angular/forms';

// Import các module của Angular Material
import {MatTabsModule} from '@angular/material/tabs';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

@Component({
  selector: 'app-openvpn',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './openvpn.component.html',
  styleUrls: ['./openvpn.component.scss']
})
export class OpenvpnComponent implements OnInit {
  settingsForm!: FormGroup;
  selectedFileName: string | null = null;

  // Dữ liệu mẫu cho tab Status
  connectionStatus = {
    status: 'Connected',
    description: 'VPN to Head Office',
    serverAddress: '103.22.11.5',
    clientIp: '10.8.0.5',
    duration: '0h:15m:32s',
    dataReceived: '15.2 MB',
    dataSent: '4.8 MB',
    lastConnection: '2025-07-15 14:30:00'
  };

  constructor(private fb: FormBuilder) {
  }

  ngOnInit(): void {
    // Khởi tạo form cho tab Settings
    this.settingsForm = this.fb.group({
      status: ['Enabled'],
      description: ['VPN to Head Office'],
      profile: [null], // Dùng để lưu file
      username: [''],
      password: ['']
    });
  }

  // Xử lý khi người dùng chọn file
  onFileSelected(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    let fileList: FileList | null = element.files;
    if (fileList && fileList.length > 0) {
      const file = fileList[0];
      this.settingsForm.patchValue({profile: file});
      this.selectedFileName = file.name;
    }
  }

  // Hàm trigger click cho input file ẩn
  triggerFileInput(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  // Xử lý khi lưu
  onSave(): void {
    if (this.settingsForm.valid) {
      console.log('OpenVPN Settings Saved:', this.settingsForm.value);
      // Logic gọi API để lưu
    }
  }
}
