import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, Validators, ReactiveFormsModule} from '@angular/forms';

// Import các module của Angular Material
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select'; // <-- Thêm module cho dropdown

@Component({
  selector: 'app-inverter',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule // <-- Khai báo ở đây
  ],
  templateUrl: './inverter.component.html',
  styleUrls: ['./inverter.component.scss']
})
export class InverterComponent implements OnInit {
  showAddForm = false;
  addInverterForm!: FormGroup;
  editInverterForm!: FormGroup;

  // Dữ liệu mặc định
  inverters = [
    {id: 1, name: 'SMA 5k', brand: 'SMA', pmax: 5, serialPort: 'Port 1', modbusId: 1, isEditing: false},
    {id: 2, name: 'ABB 10k', brand: 'ABB', pmax: 10, serialPort: 'Port 2', modbusId: 2, isEditing: false},
  ];

  // Danh sách tùy chọn cho dropdown
  inverterBrands = ['Huawei', 'Solid', 'Auxsol', 'Sungrow', 'Fronius', 'SMA', 'ABB'];
  serialPorts = ['Port 1', 'Port 2'];


  constructor(private fb: FormBuilder) {
  }

  ngOnInit(): void {
    const formControls = {
      name: ['', Validators.required],
      brand: [''],
      pmax: [''],
      serialPort: [''],
      modbusId: ['', Validators.required]
    };
    this.addInverterForm = this.fb.group(formControls);
    this.editInverterForm = this.fb.group(formControls);
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    this.addInverterForm.reset();
  }

  onAddInverter(): void {
    if (this.addInverterForm.invalid) {
      return;
    }
    // Tìm ID lớn nhất trong mảng, nếu mảng rỗng thì bắt đầu từ 0
    const maxId = this.inverters.length > 0 ? Math.max(...this.inverters.map(inv => inv.id)) : 0;

    const newInverter = {
      id: maxId + 1, // Tạo ID mới bằng cách +1
      ...this.addInverterForm.value,
      isEditing: false
    };
    this.inverters.push(newInverter);
    this.toggleAddForm();
  }

  editInverter(inverter: any): void {
    this.inverters.forEach(inv => inv.isEditing = false);
    inverter.isEditing = true;
    this.editInverterForm.patchValue(inverter);
  }

  cancelEdit(inverter: any): void {
    inverter.isEditing = false;
  }

  saveInverter(inverterToUpdate: any): void {
    if (this.editInverterForm.invalid) {
      return;
    }
    const updatedValues = this.editInverterForm.value;
    const index = this.inverters.findIndex(inv => inv.id === inverterToUpdate.id);
    if (index !== -1) {
      this.inverters[index] = {...inverterToUpdate, ...updatedValues, isEditing: false};
    }
  }
}
