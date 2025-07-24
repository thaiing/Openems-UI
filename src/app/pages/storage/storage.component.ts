import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, Validators, ReactiveFormsModule} from '@angular/forms';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';

@Component({
  selector: 'app-storage',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule
  ],
  templateUrl: './storage.component.html',
  styleUrls: ['./storage.component.scss']
})
export class StorageComponent implements OnInit {
  showAddForm = false;
  addStorageForm!: FormGroup;
  editStorageForm!: FormGroup;

  // Dữ liệu mẫu
  storages = [
    {id: 1, name: 'ATESS-H5500', brand: 'ATESS', serialPort: 'Port 1', modbusId: 5, isEditing: false},
    {id: 2, name: 'GoodWe GW5048D', brand: 'GoodWe', serialPort: 'Port 2', modbusId: 6, isEditing: false},
  ];

  // Tùy chọn cho dropdown
  storageBrands = ['ATESS', 'GoodWe', 'Growatt', 'BYD'];
  serialPorts = ['Port 1', 'Port 2'];

  constructor(private fb: FormBuilder) {
  }

  ngOnInit(): void {
    const formControls = {
      name: ['', Validators.required],
      brand: [''],
      serialPort: [''],
      modbusId: ['', Validators.required]
    };
    this.addStorageForm = this.fb.group(formControls);
    this.editStorageForm = this.fb.group(formControls);
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    this.addStorageForm.reset();
  }

  onAddStorage(): void {
    if (this.addStorageForm.invalid) return;

    // Tìm ID lớn nhất trong mảng, nếu mảng rỗng thì bắt đầu từ 0
    const maxId = this.storages.length > 0 ? Math.max(...this.storages.map(s => s.id)) : 0;

    const newStorage = {
      id: maxId + 1, // Tạo ID mới bằng cách +1
      ...this.addStorageForm.value,
      isEditing: false
    };
    this.storages.push(newStorage);
    this.toggleAddForm();
  }

  editStorage(storage: any): void {
    this.storages.forEach(s => s.isEditing = false);
    storage.isEditing = true;
    this.editStorageForm.patchValue(storage);
  }

  cancelEdit(storage: any): void {
    storage.isEditing = false;
  }

  saveStorage(storageToUpdate: any): void {
    if (this.editStorageForm.invalid) return;
    const updatedValues = this.editStorageForm.value;
    const index = this.storages.findIndex(s => s.id === storageToUpdate.id);
    if (index !== -1) {
      this.storages[index] = {...storageToUpdate, ...updatedValues, isEditing: false};
    }
  }
}
