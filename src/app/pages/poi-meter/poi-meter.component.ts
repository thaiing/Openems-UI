import {Component, OnInit, OnDestroy} from '@angular/core';
import {HttpClient} from '@angular/common/http';
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
import {MatSlideToggleModule} from '@angular/material/slide-toggle';

// --- Interfaces ---
interface AppConfig {
  serialPortTemplates?: PortTemplate[];
  meterSetup?: {
    meterTypes: MeterType[];
    meterBrands: MeterBrand[];
  }
}

interface PortTemplate {
  key: string;
  displayName: string;
}

interface MeterBrand {
  name: string;
  factoryId: string;
}

interface MeterType {
  value: string;
  display: string;
}

@Component({
  selector: 'app-poi-meter',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatProgressSpinnerModule, MatSlideToggleModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule,
    MatIconModule, MatCardModule, MatTooltipModule
  ],
  templateUrl: './poi-meter.component.html',
  styleUrls: ['./poi-meter.component.scss']
})
export class PoiMeterComponent implements OnInit, OnDestroy {
  meters: any[] = [];
  serialPorts: PortTemplate[] = [];
  meterBrands: MeterBrand[] = [];
  meterTypes: MeterType[] = [];

  isLoading = true;
  isAdding = false;
  addForm!: FormGroup;
  editForm!: FormGroup;
  meterInEditing: string | null = null;

  private dataSubscription!: Subscription;

  constructor(
    private stateService: StateService,
    private apiService: ApiService,
    private http: HttpClient,
    private fb: FormBuilder
  ) {
  }

  ngOnInit(): void {
    this.addForm = this.fb.group({
      alias: ['', Validators.required],
      brand: [null, Validators.required],
      type: [null, Validators.required],
      serialPort: [null, Validators.required],
      modbusUnitId: [1, [Validators.required, Validators.min(1)]],
      invert: [false]
    });
    this.editForm = this.fb.group({
      alias: ['', Validators.required],
      type: [null, Validators.required], // Thêm type vào form sửa
      serialPort: [null, Validators.required],
      modbusUnitId: ['', [Validators.required, Validators.min(1)]],
      invert: [false]
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
      catchError((err) => {
        console.error("Không thể tải app-config.json", err);
        return of({} as AppConfig);
      })
    );

    this.dataSubscription = config$.pipe(
      tap(config => {
        this.serialPorts = config.serialPortTemplates || [];
        if (config && config.meterSetup) {
          this.meterBrands = config.meterSetup.meterBrands;
          this.meterTypes = config.meterSetup.meterTypes;
        }
      }),
      switchMap(() => forkJoin({
        felixPids: this.apiService.getFelixPids(),
        allComponents: this.stateService.components$.pipe(
          filter(components => components !== null), take(1)
        )
      }))
    ).subscribe(({felixPids, allComponents}) => {
      const pidMap = new Map<string, string>();
      felixPids
        .filter(p => this.meterBrands.some(b => b.factoryId === p.fpid))
        .forEach(p => {
          const aliasMatch = p.nameHint?.match(/\[(.*?)\]/);
          if (aliasMatch && aliasMatch[1]) {
            pidMap.set(aliasMatch[1], p.id);
          }
        });

      this.meters = Object.entries(allComponents)
        .filter(([id, config]: [string, any]) => this.meterBrands.some(b => b.factoryId === config.factoryId))
        .map(([id, config]: [string, any]) => {
          const props = config.properties;
          const longPid = pidMap.get(id);
          if (!longPid) return null;

          return {
            pid: longPid,
            componentId: id,
            alias: props.alias,
            brandName: this.meterBrands.find(b => b.factoryId === config.factoryId)?.name || config.factoryId,
            type: props.type,
            serialPort: props['modbus.id'],
            modbusUnitId: props.modbusUnitId,
            invert: props.invert
          };
        })
        .filter(meter => meter !== null);

      this.isLoading = false;
    });
  }

  getPortDisplayName(key: string): string {
    const port = this.serialPorts.find(p => p.key === key);
    return port ? port.displayName : key;
  }

  getMeterTypeDisplay(value: string): string {
    const type = this.meterTypes.find(t => t.value === value);
    return type ? type.display : value;
  }

  getAvailableMeterTypes(editingMeterType?: string): MeterType[] {
    const usedTypes = this.meters.map(m => m.type);
    return this.meterTypes.filter(t => !usedTypes.includes(t.value) || t.value === editingMeterType);
  }

  private findNextAvailableComponentId(): string {
    const existingIds = this.meters
      .map(meter => parseInt(meter.componentId.replace('meter', ''), 10))
      .filter(id => !isNaN(id)).sort((a, b) => a - b);
    let nextId = 0;
    for (const id of existingIds) {
      if (id === nextId) {
        nextId++;
      } else {
        break;
      }
    }
    return `meter${nextId}`;
  }

  showAddForm(): void {
    this.isAdding = true;
  }

  cancelAdd(): void {
    this.isAdding = false;
  }

  cancelEdit(): void {
    this.meterInEditing = null;
  }

  confirmAdd(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }
    const formValue = this.addForm.value;
    const brand = this.meterBrands.find(b => b.factoryId === formValue.brand);
    if (!brand) return;

    const componentId = this.findNextAvailableComponentId();
    const createConfig = {
      apply: 'true', factoryPid: brand.factoryId, id: componentId,
      alias: formValue.alias, enabled: 'true', type: formValue.type,
      'modbus.id': formValue.serialPort, modbusUnitId: formValue.modbusUnitId,
      invert: formValue.invert,
      propertylist: 'id,alias,enabled,type,modbus.id,modbusUnitId,invert'
    };

    this.apiService.createInverter(brand.factoryId, createConfig).subscribe({
      next: (result) => {
        if (result) {
          alert('Tạo Meter thành công!');
          this.cancelAdd();
          this.stateService.refreshState();
          setTimeout(() => this.loadData(), 1500);
        }
      },
      error: (err) => alert('Tạo Meter không thành công: ' + err.message)
    });
  }

  editMeter(meter: any): void {
    this.meterInEditing = meter.componentId;
    this.editForm.patchValue({
      alias: meter.alias,
      type: meter.type,
      serialPort: meter.serialPort,
      modbusUnitId: meter.modbusUnitId,
      invert: meter.invert
    });
  }

  saveChanges(meter: any): void {
    if (this.editForm.invalid) return;
    if (!meter.pid) {
      alert('Lỗi: Không tìm thấy PID của meter.');
      return;
    }

    const formValue = this.editForm.value;
    const updateConfig = {
      apply: 'true', id: meter.componentId, alias: formValue.alias,
      enabled: 'true', type: formValue.type,
      'modbus.id': formValue.serialPort, modbusUnitId: formValue.modbusUnitId,
      invert: formValue.invert,
      propertylist: 'id,alias,enabled,type,modbus.id,modbusUnitId,invert'
    };

    const fullPidPath = `/system/console/configMgr/${meter.pid}`;
    this.apiService.updateSerialPortConfigFelix(fullPidPath, updateConfig).subscribe({
      next: (result) => {
        if (result) {
          alert('Cập nhật thành công!');
          this.cancelEdit();
          this.stateService.refreshState();
          setTimeout(() => this.loadData(), 1000);
        }
      },
      error: (err) => alert('Lưu cấu hình không thành công:\n' + (err.error || err.message))
    });
  }

  deleteMeter(meter: any): void {
    if (!meter.pid) {
      alert('Lỗi: Không tìm thấy PID của meter để xóa.');
      return;
    }
    if (confirm(`Bạn có chắc chắn muốn xóa meter "${meter.alias}" không?`)) {
      const fullPidPath = `/system/console/configMgr/${meter.pid}`;
      this.apiService.deleteSerialPort(fullPidPath).subscribe({
        next: () => {
          alert('Xóa meter thành công!');
          this.stateService.refreshState();
          setTimeout(() => this.loadData(), 1000);
        },
        error: (err) => alert('Xóa không thành công: ' + err.message)
      });
    }
  }
}
