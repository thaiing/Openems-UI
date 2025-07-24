import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, Validators, ReactiveFormsModule} from '@angular/forms';

// Import các module của Angular Material
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select'; // Thêm
import {MatCheckboxModule} from '@angular/material/checkbox'; // Thêm

@Component({
  selector: 'app-poi-meter',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule // Thêm
  ],
  templateUrl: './poi-meter.component.html',
  styleUrls: ['./poi-meter.component.scss']
})
export class PoiMeterComponent implements OnInit {
  showAddForm = false;
  addMeterForm!: FormGroup;
  editMeterForm!: FormGroup;

  // Dữ liệu mẫu
  meters = [
    {
      id: 1,
      name: 'Main Grid Meter',
      brand: 'Schneider',
      invertPower: true,
      serialPort: 'Port 1',
      modbusId: 3,
      poi: true,
      isEditing: false
    },
    {
      id: 2,
      name: 'Sub Meter 01',
      brand: 'Siemens',
      invertPower: false,
      serialPort: 'Port 2',
      modbusId: 4,
      poi: false,
      isEditing: false
    },
  ];

  // Tùy chọn cho dropdown
  meterBrands = ['Socomec', 'Elecnova', 'Artel', 'Siemens'];
  serialPorts = ['Port 1', 'Port 2'];

  constructor(private fb: FormBuilder) {
  }

  ngOnInit(): void {
    const formControls = {
      name: ['', Validators.required],
      brand: [''],
      invertPower: [false],
      poi: [false],
      serialPort: [''],
      modbusId: ['', Validators.required]
    };
    this.addMeterForm = this.fb.group(formControls);
    this.editMeterForm = this.fb.group(formControls);
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    this.addMeterForm.reset({invertPower: false, poi: false});
  }

  // Logic để đảm bảo chỉ có 1 POI được chọn
  private updatePoiStatus(currentMeterId: number): void {
    this.meters.forEach(meter => {
      if (meter.id !== currentMeterId) {
        meter.poi = false;
      }
    });
  }

  onAddMeter(): void {
    if (this.addMeterForm.invalid) return;

    // Tìm ID lớn nhất trong mảng, nếu mảng rỗng thì bắt đầu từ 0
    const maxId = this.meters.length > 0 ? Math.max(...this.meters.map(m => m.id)) : 0;

    const newMeter = {
      id: maxId + 1, // Tạo ID mới bằng cách +1
      ...this.addMeterForm.value,
      isEditing: false
    };

    if (newMeter.poi) {
      this.updatePoiStatus(newMeter.id);
    }
    this.meters.push(newMeter);
    this.toggleAddForm();
  }

  editMeter(meter: any): void {
    this.meters.forEach(m => m.isEditing = false);
    meter.isEditing = true;
    this.editMeterForm.patchValue(meter);
  }

  cancelEdit(meter: any): void {
    meter.isEditing = false;
  }

  saveMeter(meterToUpdate: any): void {
    if (this.editMeterForm.invalid) return;
    const updatedValues = this.editMeterForm.value;
    if (updatedValues.poi) {
      this.updatePoiStatus(meterToUpdate.id);
    }
    const index = this.meters.findIndex(m => m.id === meterToUpdate.id);
    if (index !== -1) {
      this.meters[index] = {...meterToUpdate, ...updatedValues, isEditing: false};
    }
  }
}
