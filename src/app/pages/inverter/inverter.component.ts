import {Component, OnInit, OnDestroy} from '@angular/core';
import {HttpClient, HttpClientModule} from '@angular/common/http';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {Subscription, of, forkJoin, filter, take} from 'rxjs';
import {catchError, switchMap, tap, map} from 'rxjs/operators';
import {StateService} from '../../services/state.service';
import {ApiService} from '../../services/api.service';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatCardModule} from '@angular/material/card';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';

// --- Định nghĩa Interface để code an toàn hơn ---
interface AppConfig {
  inverterSetup?: {
    currentTier: string;
    tiers: { [key: string]: TierConfig };
    inverterBrands: InverterBrand[];
  }
}

interface InverterBrand {
  name: string;
  factoryId: string;
}

interface TierConfig {
  maxInverters: number;
  maxTotalPowerKW: number;
}

@Component({
  selector: 'app-inverter',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, HttpClientModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatCardModule, MatTooltipModule
  ],
  templateUrl: './inverter.component.html',
  styleUrls: ['./inverter.component.scss']
})
export class InverterComponent implements OnInit, OnDestroy {
  inverters: any[] = [];
  serialPorts: string[] = [];
  brands: InverterBrand[] = [];
  private activeTier!: TierConfig;

  currentInverterCount = 0;
  currentTotalPowerKW = 0;

  isLoading = true;
  isAdding = false;
  addForm!: FormGroup;
  editForm!: FormGroup;
  inverterInEditing: string | null = null;

  private dataSubscription!: Subscription;

  constructor(
    private apiService: ApiService,
    private stateService: StateService,
    private http: HttpClient,
    private fb: FormBuilder
  ) {
  }

  ngOnInit(): void {
    this.addForm = this.fb.group({
      brand: [null, Validators.required],
      maxActivePower: [null, [Validators.required, Validators.min(1)]],
      modbusPort: [null, Validators.required],
      modbusUnitId: [1, [Validators.required, Validators.min(1), Validators.max(247)]],
    });

    this.editForm = this.fb.group({
      maxActivePower: [null, [Validators.required, Validators.min(1)]],
      modbusPort: [null, Validators.required],
      modbusUnitId: ['', [Validators.required, Validators.min(1), Validators.max(247)]],
    });

    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
  }

  loadData(): void {
    this.isLoading = true;
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }

    const config$ = this.http.get<AppConfig>('assets/config/app-config.json').pipe(
      catchError((err) => { // SỬA LỖI: Thêm tham số 'err'
        console.error("Không thể tải app-config.json", err);
        return of({} as AppConfig);
      })
    );

    this.dataSubscription = config$.pipe(
      tap(config => {
        if (config && config.inverterSetup) {
          const setup = config.inverterSetup;
          this.brands = setup.inverterBrands;
          this.activeTier = setup.tiers[setup.currentTier];
        } else {
          this.activeTier = {maxInverters: 0, maxTotalPowerKW: 0};
        }
      }),
      switchMap(() => forkJoin({
        felixPids: this.apiService.getFelixPids(),
        allComponents: this.stateService.components$.pipe(
          filter(components => components !== null),
          take(1)
        )
      }))
    ).subscribe(({felixPids, allComponents}) => {
      this.serialPorts = felixPids
        .filter(p => p.fpid === 'Bridge.Modbus.Serial')
        .map(p => {
          const aliasMatch = p.nameHint?.match(/\[(.*?)\]/);
          return aliasMatch ? aliasMatch[1] : null;
        })
        .filter((alias): alias is string => alias !== null);

      const pidMap = new Map<string, string>();
      felixPids
        .filter(p => this.brands.some(b => b.factoryId === p.fpid))
        .forEach(p => {
          const aliasMatch = p.nameHint?.match(/\[(.*?)\]/);
          if (aliasMatch && aliasMatch[1]) {
            pidMap.set(aliasMatch[1], p.id);
          }
        });

      this.inverters = Object.entries(allComponents)
        .filter(([id, config]: [string, any]) => this.brands.some(b => b.factoryId === config.factoryId))
        .map(([id, config]: [string, any]) => {
          const props = config.properties;
          const longPid = pidMap.get(id);
          if (!longPid) return null;

          return {
            pid: longPid,
            alias: id,
            brandName: this.brands.find(b => b.factoryId === config.factoryId)?.name || config.factoryId,
            maxActivePower: props.maxActivePower,
            modbusPort: props['modbus.id'],
            modbusUnitId: props.modbusUnitId,
          };
        })
        .filter(inv => inv !== null);

      this.currentInverterCount = this.inverters.length;
      this.currentTotalPowerKW = this.inverters.reduce((sum, inv) => sum + (inv.maxActivePower / 1000), 0);

      this.isLoading = false;
    });
  }

  get isAddButtonDisabled(): boolean {
    if (!this.activeTier) return true;
    const atMaxInverters = this.currentInverterCount >= this.activeTier.maxInverters;
    const atMaxPower = this.currentTotalPowerKW >= this.activeTier.maxTotalPowerKW;
    return atMaxInverters || atMaxPower;
  }

  showAddForm(): void {
    this.isAdding = true;
    this.addForm.reset({modbusUnitId: 1});
  }

  cancelAdd(): void {
    this.isAdding = false;
  }

  confirmAdd(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    const formValue = this.addForm.value;
    const newPowerW = formValue.maxActivePower;
    const remainingPowerKW = this.activeTier.maxTotalPowerKW - this.currentTotalPowerKW;

    if (this.currentInverterCount >= this.activeTier.maxInverters) {
      alert(`Lỗi: Đã đạt giới hạn tối đa ${this.activeTier.maxInverters} inverter.`);
      return;
    }
    if ((newPowerW / 1000) > remainingPowerKW) {
      alert(`Lỗi: Công suất thêm vào vượt quá giới hạn. Công suất tối đa còn lại là ${remainingPowerKW.toFixed(2)} kWp.`);
      return;
    }

    const brand = this.brands.find(b => b.factoryId === formValue.brand);
    if (!brand) return;

    const nextId = this.inverters.length;
    const newAlias = `pvInverter${nextId}`;

    const createConfig = {
      apply: 'true',
      factoryPid: brand.factoryId,
      id: newAlias,
      alias: newAlias,
      enabled: 'true',
      maxActivePower: newPowerW,
      'modbus.id': formValue.modbusPort,
      modbusUnitId: formValue.modbusUnitId,
      propertylist: 'id,alias,enabled,maxActivePower,modbus.id,modbusUnitId'
    };

    this.apiService.createInverter(brand.factoryId, createConfig)
      .pipe(catchError(err => {
        alert('Tạo Inverter không thành công: ' + err.message);
        return of(null);
      }))
      .subscribe(result => {
        if (result) {
          alert('Tạo Inverter thành công!');
          this.cancelAdd();
          this.stateService.refreshState();
          setTimeout(() => this.loadData(), 1500);
        }
      });
  }

  editInverter(inverter: any): void {
    this.inverterInEditing = inverter.alias;
    this.editForm.patchValue({
      maxActivePower: inverter.maxActivePower,
      modbusPort: inverter.modbusPort,
      modbusUnitId: inverter.modbusUnitId
    });
  }

  cancelEdit(): void {
    this.inverterInEditing = null;
  }

  saveChanges(inverter: any): void {
    if (this.editForm.invalid) return;
    if (!inverter.pid) {
      alert('Lỗi: Không tìm thấy PID của inverter để lưu.');
      return;
    }

    const formValue = this.editForm.value;

    // SỬA LỖI: Thêm logic kiểm tra giới hạn công suất khi Sửa
    const newPowerW = formValue.maxActivePower;
    const oldPowerW = inverter.maxActivePower;
    const powerDifferenceW = newPowerW - oldPowerW;
    const remainingPowerKW = this.activeTier.maxTotalPowerKW - this.currentTotalPowerKW;

    if ((powerDifferenceW / 1000) > remainingPowerKW) {
      alert(`Lỗi: Công suất chỉnh sửa vượt quá giới hạn. Công suất tối đa có thể thêm là ${remainingPowerKW.toFixed(2)} kWp.`);
      return;
    }

    const updateConfig = {
      apply: 'true',
      alias: inverter.alias,
      enabled: 'true',
      maxActivePower: formValue.maxActivePower,
      'modbus.id': formValue.modbusPort,
      modbusUnitId: formValue.modbusUnitId,
      propertylist: 'alias,enabled,maxActivePower,modbus.id,modbusUnitId'
    };

    const fullPidPath = `/system/console/configMgr/${inverter.pid}`;

    this.apiService.updateSerialPortConfigFelix(fullPidPath, updateConfig)
      .pipe(catchError(err => {
        alert('Lưu cấu hình không thành công:\n' + (err.error || err.message));
        return of(null);
      }))
      .subscribe(result => {
        if (result) {
          alert('Cập nhật thành công!');
          this.cancelEdit();
          this.stateService.refreshState();
          setTimeout(() => this.loadData(), 1000);
        }
      });
  }

  deleteInverter(inverter: any): void {
    if (!inverter.pid) {
      alert('Lỗi: Không tìm thấy PID của inverter để xóa.');
      return;
    }
    if (confirm(`Bạn có chắc chắn muốn xóa inverter "${inverter.alias}" không?`)) {
      const fullPidPath = `/system/console/configMgr/${inverter.pid}`;
      this.apiService.deleteSerialPort(fullPidPath)
        .subscribe({ // SỬA LỖI: Dùng cú pháp an toàn hơn
          next: () => {
            alert('Xóa inverter thành công!');
            this.stateService.refreshState();
            setTimeout(() => this.loadData(), 1000);
          },
          error: (err) => {
            alert('Xóa không thành công: ' + err.message);
          }
        });
    }
  }
}
