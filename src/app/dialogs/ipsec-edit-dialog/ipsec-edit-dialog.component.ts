import {Component, Inject, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators} from '@angular/forms';
import {MatDialogRef, MAT_DIALOG_DATA, MatDialogModule} from '@angular/material/dialog';
import {MatRadioModule} from '@angular/material/radio';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatCheckboxModule} from '@angular/material/checkbox';

@Component({
  selector: 'app-ipsec-edit-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule, MatRadioModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatCheckboxModule
  ],
  templateUrl: './ipsec-edit-dialog.component.html',
  styleUrls: ['./ipsec-edit-dialog.component.scss']
})
export class IpsecEditDialogComponent implements OnInit {
  form!: FormGroup;
  isEditMode: boolean;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<IpsecEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.isEditMode = !!this.data;
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      settingsType: ['Quick'],
      // Tunnel Settings
      status: [true],
      name: ['', Validators.required],
      l2tpTunnel: ['Disabled'],
      vpnConnection: ['Site to Site'],
      remoteGateway: ['', Validators.required],
      startupMode: ['Initiate Automatically'],
      // Network Lists
      localNetworkList: this.fb.array([this.createNetworkGroup()]),
      remoteNetworkList: this.fb.array([this.createNetworkGroup()]),
      // Security
      securityType: ['Strong'],
      authMode: ['Pre-shared Key'],
      preSharedKey: ['', Validators.required]
    });

    if (this.isEditMode) {
      // Nếu là sửa, đổ dữ liệu vào form
      this.form.patchValue({
        name: this.data.name,
        remoteGateway: this.data.remoteGateway,
        //... patch các giá trị khác nếu cần
      });
    }
  }

  // Helper để tạo một network group
  createNetworkGroup(): FormGroup {
    return this.fb.group({
      enabled: [true],
      network: ['', Validators.required],
      netmask: ['24', Validators.required]
    });
  }

  // Getter cho FormArray để dễ dùng trong template
  get localNetworkList() {
    return this.form.get('localNetworkList') as FormArray;
  }

  get remoteNetworkList() {
    return this.form.get('remoteNetworkList') as FormArray;
  }

  // Hàm thêm/xóa network
  addNetwork(type: 'local' | 'remote'): void {
    if (type === 'local') this.localNetworkList.push(this.createNetworkGroup());
    else this.remoteNetworkList.push(this.createNetworkGroup());
  }

  removeNetwork(type: 'local' | 'remote', index: number): void {
    if (type === 'local') this.localNetworkList.removeAt(index);
    else this.remoteNetworkList.removeAt(index);
  }

  onSave(): void {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
