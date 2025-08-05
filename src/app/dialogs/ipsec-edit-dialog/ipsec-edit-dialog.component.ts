import {Component, Inject, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import {MatDialogModule, MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import {MatStepperModule} from '@angular/material/stepper';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatDividerModule} from '@angular/material/divider';
import {MatIconModule} from '@angular/material/icon';
import {ApiService} from '../../services/api.service';
import {NotificationService} from '../../services/notification.service';

// Custom Validator: Kiểm tra xem certificate được chọn có phải là loại 'key' không
export function requireKeyTypeValidator(getCertificates: () => any[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const selectedCertName = control.value;
    if (!selectedCertName) return null;
    const certificates = getCertificates();
    const selectedCert = certificates.find(c => c.name === selectedCertName);
    return selectedCert && selectedCert.type === 'key' ? null : {requireKeyType: true};
  };
}

@Component({
  selector: 'app-ipsec-edit-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule, MatStepperModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule, MatCheckboxModule, MatDividerModule, MatIconModule
  ],
  templateUrl: './ipsec-edit-dialog.component.html',
  styleUrls: ['./ipsec-edit-dialog.component.scss']
})
export class IpsecEditDialogComponent implements OnInit {

  selectionFormGroup!: FormGroup;
  detailsFormGroup!: FormGroup;
  certificates: any[] = [];
  selectedLocalCertIdentities: string[] = [];
  isEditMode: boolean;

  constructor(
    private _formBuilder: FormBuilder,
    private apiService: ApiService,
    private notificationService: NotificationService,
    public dialogRef: MatDialogRef<IpsecEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.isEditMode = !!data && !!data.id;
  }

  ngOnInit(): void {
    this.apiService.getCertificates().subscribe(certs => this.certificates = certs);

    // Form 1: Lựa chọn
    this.selectionFormGroup = this._formBuilder.group({
      category: [{value: this.data?.category || 'site-to-site', disabled: this.isEditMode}, Validators.required],
      auth_method: [this.data?.auth_method || '', Validators.required]
    });

    // Form 2: Chi tiết - Khởi tạo với các trường có thể có
    this.detailsFormGroup = this._formBuilder.group({
      name: [this.data?.name || '', Validators.required],
      remote_address: [this.data?.remote_address || ''],
      local_traffic_selector: [this.data?.local_traffic_selector || ''],
      remote_traffic_selector: [this.data?.remote_traffic_selector || ''],
      ike_version: [this.data?.ike_version || 'any'],
      server_address: [this.data?.server_address || ''],
      send_certificate_request: [this.data?.send_certificate_request ?? true],
      active_initiator: [this.data?.active_initiator ?? false],
      start_action: [this.data?.start_action || 'none'],
      server_certificate_name: [this.data?.server_certificate_name || ''],
      local_identity: [this.data?.local_identity || ''],
      auto_ca_select: [this.data?.auto_ca_select ?? true],
      ca_certificate_name: [this.data?.ca_certificate_name || ''],
      use_server_value: [this.data?.use_server_value ?? false],
      peer_identity: [this.data?.peer_identity || ''],
      remote_identity: [this.data?.remote_identity || ''],
      pre_shared_key: [''],
    });

    // Lắng nghe sự thay đổi để cập nhật validators
    this.selectionFormGroup.get('auth_method')?.valueChanges.subscribe(method => {
      if (method) this.updateValidators(method);
    });

    // Cập nhật validators nếu là chế độ edit
    if (this.isEditMode) {
      this.updateValidators(this.data.auth_method);
    }
  }

  updateValidators(method: string): void {
    // Trước tiên, xóa hết validators của các trường không chung
    const fieldsToClear = ['remote_address', 'local_traffic_selector', 'remote_traffic_selector', 'ike_version', 'server_address', 'start_action', 'server_certificate_name', 'local_identity', 'remote_identity', 'pre_shared_key'];
    fieldsToClear.forEach(field => {
      this.detailsFormGroup.get(field)?.clearValidators();
    });

    // Thêm validators dựa trên method được chọn
    switch (method) {
      case 'ikev2-cert':
        this.detailsFormGroup.get('remote_address')?.setValidators([Validators.required]);
        this.detailsFormGroup.get('server_certificate_name')?.setValidators([Validators.required, requireKeyTypeValidator(() => this.certificates)]);
        break;
      case 'ikev2-psk':
        this.detailsFormGroup.get('remote_address')?.setValidators([Validators.required]);
        this.detailsFormGroup.get('local_identity')?.setValidators([Validators.required]);
        this.detailsFormGroup.get('remote_identity')?.setValidators([Validators.required]);
        if (!this.isEditMode) {
          this.detailsFormGroup.get('pre_shared_key')?.setValidators([Validators.required]);
        }
        break;
    }
    // Cập nhật lại trạng thái của tất cả các trường
    this.detailsFormGroup.updateValueAndValidity();
  }

  updateIdentities(certName: string): void {
    const selectedCert = this.certificates.find(c => c.name === certName);
    this.selectedLocalCertIdentities = (selectedCert && selectedCert.identities) ? selectedCert.identities : [];

    if (this.selectedLocalCertIdentities.length > 0) {
      this.detailsFormGroup.get('local_identity')?.setValue(this.selectedLocalCertIdentities[0]);
    } else {
      this.detailsFormGroup.get('local_identity')?.setValue('');
    }
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      this.apiService.uploadCertificate(formData).subscribe({
        next: (uploadedCert) => {
          this.notificationService.showSuccess(`Certificate '${uploadedCert.name}' uploaded.`);
          this.certificates.push(uploadedCert);
          if (uploadedCert.type === 'key') {
            this.detailsFormGroup.get('server_certificate_name')?.setValue(uploadedCert.name);
          }
        },
        error: (err) => this.notificationService.showError('File upload failed.')
      });
    }
  }

  save(andUpdate: boolean = false): void {
    if (this.selectionFormGroup.invalid || this.detailsFormGroup.invalid) {
      this.notificationService.showError('Please correct the errors before saving.');
      this.selectionFormGroup.markAllAsTouched();
      this.detailsFormGroup.markAllAsTouched();
      return;
    }

    const finalData = {
      ...this.selectionFormGroup.getRawValue(),
      ...this.detailsFormGroup.value,
      id: this.data?.id,
      andUpdate: andUpdate
    };

    this.apiService.createIpsecConnection(finalData).subscribe({
      next: (res) => {
        this.notificationService.showSuccess(res.message);
        this.dialogRef.close(true);
      },
      error: (err) => this.notificationService.showError('Failed to save connection.')
    });
  }
}
