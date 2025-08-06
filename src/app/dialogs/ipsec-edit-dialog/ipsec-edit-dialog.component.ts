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

// Custom Validator: Giữ nguyên của bạn
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

    this.selectionFormGroup = this._formBuilder.group({
      category: [{value: this.data?.category || 'site-to-site', disabled: this.isEditMode}, Validators.required],
      auth_method: [this.data?.auth_method || '', Validators.required]
    });

    // Form 2: Chi tiết - Đã loại bỏ các trường không cần thiết
    this.detailsFormGroup = this._formBuilder.group({
      // === Trường chung ===
      name: [this.data?.name || '', Validators.required],
      comments: [this.data?.comments || ''],

      // === Trường cho IKEv2 Certificate (Giữ nguyên từ file của bạn) ===
      remote_address: [this.data?.remote_address || ''],
      local_traffic_selector: [this.data?.local_traffic_selector || ''],
      remote_traffic_selector: [this.data?.remote_traffic_selector || ''],
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

      // === Trường cho IKEv2 PSK (Đã đơn giản hóa) ===
      remote_gateway_ip: [this.data?.remote_gateway_ip || ''],
      pre_shared_key: [this.data?.pre_shared_key || ''],
      ike_version: [this.data?.ike_version || '2'],
      p1_encryption: [this.data?.p1_encryption || 'aes128'],
      p1_authentication: [this.data?.p1_authentication || 'sha256'],
      p1_dh_group: [this.data?.p1_dh_group || '14'],
      p1_key_lifetime: [this.data?.p1_key_lifetime || 86400],
      p1_local_id: [this.data?.p1_local_id || ''],
      p2_local_address: [this.data?.p2_local_address || ''],
      p2_remote_address: [this.data?.p2_remote_address || ''],
    });

    this.selectionFormGroup.get('auth_method')?.valueChanges.subscribe(method => {
      if (method) this.updateValidators(method);
    });

    if (this.isEditMode) {
      this.updateValidators(this.data.auth_method);
    }
  }

  updateValidators(method: string): void {
    const allFields = Object.keys(this.detailsFormGroup.controls);
    allFields.forEach(field => {
      if (field !== 'name') {
        this.detailsFormGroup.get(field)?.clearValidators();
      }
    });

    switch (method) {
      case 'ikev2-cert':
        this.detailsFormGroup.get('remote_address')?.setValidators([Validators.required]);
        this.detailsFormGroup.get('server_certificate_name')?.setValidators([Validators.required, requireKeyTypeValidator(() => this.certificates)]);
        break;
      case 'ikev2-psk':
        this.detailsFormGroup.get('remote_gateway_ip')?.setValidators([Validators.required]);
        this.detailsFormGroup.get('ike_version')?.setValidators([Validators.required]);
        this.detailsFormGroup.get('p1_encryption')?.setValidators([Validators.required]);
        this.detailsFormGroup.get('p1_authentication')?.setValidators([Validators.required]);
        this.detailsFormGroup.get('p1_dh_group')?.setValidators([Validators.required]);
        this.detailsFormGroup.get('p1_key_lifetime')?.setValidators([Validators.required, Validators.min(60)]);
        this.detailsFormGroup.get('p1_local_id')?.setValidators([Validators.required]);
        this.detailsFormGroup.get('p2_local_address')?.setValidators([Validators.required]);
        this.detailsFormGroup.get('p2_remote_address')?.setValidators([Validators.required]);

        if (!this.isEditMode) {
          this.detailsFormGroup.get('pre_shared_key')?.setValidators([Validators.required]);
        }
        break;
    }
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
      error: (err) => this.notificationService.showError(`Failed to save connection: ${err.error?.error || 'Unknown error'}`)
    });
  }
}
