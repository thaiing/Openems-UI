import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule} from '@angular/forms';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatTabsModule} from '@angular/material/tabs';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatIconModule} from '@angular/material/icon'; // SỬA LỖI: Thêm MatIconModule
import {ApiService} from '../../services/api.service';
import {NotificationService} from '../../services/notification.service';

@Component({
  selector: 'app-network',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatSlideToggleModule, MatProgressSpinnerModule,
    MatTabsModule, MatCheckboxModule, MatIconModule // SỬA LỖI: Thêm MatIconModule
  ],
  templateUrl: './network.component.html',
  styleUrls: ['./network.component.scss']
})
export class NetworkComponent implements OnInit {
  isLoading = true;
  ports: any[] = [];
  editForms: { [key: string]: FormGroup } = {};
  apnForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private notificationService: NotificationService
  ) {
  }

  ngOnInit(): void {
    this.loadNetworkData();

    // Khởi tạo form cho tab 4G
    this.apnForm = this.fb.group({
      enable: [false],
      apn: [''],
      username: [''],
      password: [''],
      server: ['']
    });
  }

  loadNetworkData(): void {
    this.isLoading = true;
    this.apiService.getNetworkConfig().subscribe({
      next: (data: any[]) => {
        this.ports = data.map(port => ({...port, isEditing: false}));
        this.ports.forEach(port => {
          this.editForms[port.id] = this.createEditForm(port);
        });
        this.isLoading = false;
      },
      error: (err) => {
        this.notificationService.showError("Failed to load network data.");
        this.isLoading = false;
      }
    });
  }

  createEditForm(portData: any): FormGroup {
    const form = this.fb.group({
      isDhcp: [portData.isDhcp],
      ipAddress: [portData.ipAddress, Validators.required],
      subnetMask: [portData.subnetMask, Validators.required],
      gateway: [portData.gateway]
    });
    this.toggleStaticFields(form, portData.isDhcp);
    form.get('isDhcp')?.valueChanges.subscribe(isDhcp => {
      this.toggleStaticFields(form, isDhcp);
    });
    return form;
  }

  toggleStaticFields(form: FormGroup, isDhcp: boolean): void {
    const fields = ['ipAddress', 'subnetMask', 'gateway'];
    fields.forEach(field => {
      if (isDhcp) {
        form.get(field)?.disable();
      } else {
        form.get(field)?.enable();
      }
    });
  }

  onSaveChanges(portId: string): void {
    const form = this.editForms[portId];
    if (form.invalid) {
      this.notificationService.showError("Please fill in all required fields.");
      return;
    }

    this.apiService.updateNetworkConfig(portId, form.value).subscribe({
      next: () => {
        this.notificationService.showSuccess(`Configuration for ${portId} saved successfully.`);
        setTimeout(() => this.loadNetworkData(), 2000);
      },
      error: (err) => {
        this.notificationService.showError(`Failed to save configuration: ${err.message}`);
      }
    });
  }

  // SỬA LỖI: Bổ sung các hàm còn thiếu
  getPortById(id: string): any {
    return this.ports.find(p => p.id === id);
  }

  editPort(port: any): void {
    port.isEditing = true;
    // Reset form về giá trị ban đầu khi bắt đầu sửa
    this.editForms[port.id].reset(port);
  }

  cancelEdit(port: any): void {
    port.isEditing = false;
  }

  // Hàm placeholder cho form 4G
  saveApn(): void {
    this.notificationService.showWarning("4G functionality is not yet implemented.");
  }
}
