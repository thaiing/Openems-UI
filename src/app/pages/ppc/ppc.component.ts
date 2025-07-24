import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {Subscription} from 'rxjs';

// Import các module của Angular Material
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

@Component({
  selector: 'app-ppc',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatSlideToggleModule, MatButtonModule, MatIconModule
  ],
  templateUrl: './ppc.component.html',
  styleUrls: ['./ppc.component.scss']
})
export class PpcComponent implements OnInit {
  ppcForm!: FormGroup;
  private subscriptions = new Subscription(); // Quản lý các subscription

  constructor(private fb: FormBuilder) {
  }

  ngOnInit(): void {
    // Xây dựng form với 4 nhóm con
    this.ppcForm = this.fb.group({
      masterEnable: [true],
      activePower: this.fb.group({enabled: [true], limitValue: [1500]}),
      activePowerPercent: this.fb.group({enabled: [false], limitValue: [100]}),
      reactivePower: this.fb.group({enabled: [false], limitValue: [800]}),
      reactivePowerPercent: this.fb.group({enabled: [false], limitValue: [80]})
    });

    this.setupExclusiveToggles();
    this.setupMasterToggle();

    // Gọi lần đầu để set trạng thái ban đầu
    this.toggleAllSettings(this.ppcForm.get('masterEnable')?.value);
  }

  // --- LOGIC MỚI: TỰ ĐỘNG BẬT/TẮT ---
  setupExclusiveToggles(): void {
    // Lắng nghe thay đổi của cặp Active Power
    const activePowerSub = this.ppcForm.get('activePower.enabled')?.valueChanges.subscribe(value => {
      if (value) {
        // Nếu bật cái này, thì tắt cái Percent đi
        this.ppcForm.get('activePowerPercent.enabled')?.setValue(false, {emitEvent: false});
      }
    });

    const activePowerPercentSub = this.ppcForm.get('activePowerPercent.enabled')?.valueChanges.subscribe(value => {
      if (value) {
        // Nếu bật cái Percent, thì tắt cái này đi
        this.ppcForm.get('activePower.enabled')?.setValue(false, {emitEvent: false});
      }
    });

    // Lắng nghe thay đổi của cặp Reactive Power
    const reactivePowerSub = this.ppcForm.get('reactivePower.enabled')?.valueChanges.subscribe(value => {
      if (value) {
        this.ppcForm.get('reactivePowerPercent.enabled')?.setValue(false, {emitEvent: false});
      }
    });

    const reactivePowerPercentSub = this.ppcForm.get('reactivePowerPercent.enabled')?.valueChanges.subscribe(value => {
      if (value) {
        this.ppcForm.get('reactivePower.enabled')?.setValue(false, {emitEvent: false});
      }
    });

    // Thêm các subscription vào để quản lý
    this.subscriptions.add(activePowerSub);
    this.subscriptions.add(activePowerPercentSub);
    this.subscriptions.add(reactivePowerSub);
    this.subscriptions.add(reactivePowerPercentSub);
  }

  // Lắng nghe nút master
  setupMasterToggle(): void {
    const masterEnableSub = this.ppcForm.get('masterEnable')?.valueChanges.subscribe(isEnabled => {
      this.toggleAllSettings(isEnabled);
    });
    this.subscriptions.add(masterEnableSub);
  }

  // Bật/tắt tất cả các form con
  toggleAllSettings(isEnabled: boolean): void {
    const controls = ['activePower', 'activePowerPercent', 'reactivePower', 'reactivePowerPercent'];
    controls.forEach(controlName => {
      const control = this.ppcForm.get(controlName);
      if (isEnabled) {
        control?.enable();
      } else {
        control?.disable();
      }
    });
  }

  // Hàm xử lý khi nhấn nút Save
  onSave(): void {
    if (this.ppcForm.valid) {
      console.log('PPC Settings Saved:', this.ppcForm.getRawValue());
      // Dùng getRawValue() để lấy cả giá trị của các control đang bị disable
    }
  }

  // Hủy subscription khi component bị hủy
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
