import {Component, OnInit, OnDestroy} from '@angular/core';
import {HttpClient} from '@angular/common/http'; // Chỉ cần import HttpClient
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {Subscription, of, forkJoin, filter, take} from 'rxjs';
import {catchError, switchMap, tap, map} from 'rxjs/operators';
import {StateService} from '../../services/state.service';
import {ApiService} from '../../services/api.service';
import {NotificationService} from '../../services/notification.service';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatCardModule} from '@angular/material/card';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';

// --- Interfaces ---
interface AppConfig {
  serialPortTemplates?: PortTemplate[];
  inverterSetup?: {
    currentTier: string;
    tiers: { [key: string]: TierConfig };
    inverterBrands: InverterBrand[];
  }
}

interface PortTemplate {
  key: string;
  displayName: string;
  portName: string;
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
    CommonModule, ReactiveFormsModule, MatProgressSpinnerModule, // Đã bỏ HttpClientModule
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatCardModule, MatTooltipModule
  ],
  templateUrl: './inverter.component.html',
  styleUrls: ['./inverter.component.scss']
})
export class InverterComponent implements OnInit, OnDestroy {
  inverters: any[] = [];
  serialPorts: PortTemplate[] = [];
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
    private fb: FormBuilder,
    private notificationService: NotificationService
  ) {
  }

  ngOnInit(): void {
    this.addForm = this.fb.group({
      alias: ['', Validators.required],
      brand: [null, Validators.required],
      maxActivePower: [null, [Validators.required, Validators.min(1)]],
      modbusPort: [null, Validators.required],
      modbusUnitId: [1, [Validators.required, Validators.min(1), Validators.max(247)]],
    });

    this.editForm = this.fb.group({
      alias: ['', Validators.required],
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
      catchError((err) => {
        this.notificationService.showError("Could not load app-config.json");
        return of({} as AppConfig);
      })
    );

    this.dataSubscription = config$.pipe(
      tap(config => {
        this.serialPorts = config.serialPortTemplates || [];
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
            componentId: id,
            alias: props.alias,
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

  getPortDisplayName(key: string): string {
    const port = this.serialPorts.find(p => p.key === key);
    return port ? port.displayName : key;
  }

  get isAddButtonDisabled(): boolean {
    if (!this.activeTier) return true;
    const atMaxInverters = this.currentInverterCount >= this.activeTier.maxInverters;
    const atMaxPower = this.currentTotalPowerKW >= this.activeTier.maxTotalPowerKW;
    return atMaxInverters || atMaxPower;
  }

  private findNextAvailableComponentId(): string {
    const existingIds = this.inverters
      .map(inv => parseInt(inv.componentId.replace('pvInverter', ''), 10))
      .filter(id => !isNaN(id))
      .sort((a, b) => a - b);

    let nextId = 0;
    for (const id of existingIds) {
      if (id === nextId) {
        nextId++;
      } else {
        break;
      }
    }
    return `pvInverter${nextId}`;
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
      this.notificationService.showError(`Error: Maximum inverter limit of ${this.activeTier.maxInverters} has been reached.`);
      return;
    }
    if ((newPowerW / 1000) > remainingPowerKW) {
      this.notificationService.showError(`Error: Power limit exceeded. Remaining capacity is ${remainingPowerKW.toFixed(2)} kWp.`);
      return;
    }

    const brand = this.brands.find(b => b.factoryId === formValue.brand);
    if (!brand) return;

    const componentId = this.findNextAvailableComponentId();
    const userAlias = formValue.alias;

    const createConfig = {
      apply: 'true', factoryPid: brand.factoryId, id: componentId,
      alias: userAlias, enabled: 'true', maxActivePower: newPowerW,
      'modbus.id': formValue.modbusPort, modbusUnitId: formValue.modbusUnitId,
      propertylist: 'id,alias,enabled,maxActivePower,modbus.id,modbusUnitId'
    };

    this.apiService.createInverter(brand.factoryId, createConfig).subscribe({
      next: (result) => {
        if (result) {
          this.notificationService.showSuccess('Inverter created successfully!');
          this.cancelAdd();
          this.stateService.refreshState();
          setTimeout(() => {
            this.loadData();
            this._updatePpcController(); // TỰ ĐỘNG CẬP NHẬT PPC
          }, 1500);
        }
      },
      error: (err) => this.notificationService.showError('Failed to create inverter: ' + err.message)
    });
  }

  editInverter(inverter: any): void {
    this.inverterInEditing = inverter.componentId;
    this.editForm.patchValue({
      alias: inverter.alias,
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
      this.notificationService.showError('Error: Could not find PID for this inverter.');
      return;
    }

    const formValue = this.editForm.value;
    const newPowerW = formValue.maxActivePower;
    const oldPowerW = inverter.maxActivePower;
    const powerDifferenceW = newPowerW - oldPowerW;
    const remainingPowerKW = this.activeTier.maxTotalPowerKW - this.currentTotalPowerKW;

    if ((powerDifferenceW / 1000) > remainingPowerKW) {
      this.notificationService.showError(`Error: Power limit exceeded. You can add up to ${remainingPowerKW.toFixed(2)} kWp.`);
      return;
    }

    const updateConfig = {
      apply: 'true', id: inverter.componentId, alias: formValue.alias,
      enabled: 'true', maxActivePower: formValue.maxActivePower,
      'modbus.id': formValue.modbusPort, modbusUnitId: formValue.modbusUnitId,
      propertylist: 'id,alias,enabled,maxActivePower,modbus.id,modbusUnitId'
    };

    const fullPidPath = `/system/console/configMgr/${inverter.pid}`;

    this.apiService.updateSerialPortConfigFelix(fullPidPath, updateConfig).subscribe({
      next: (result) => {
        if (result) {
          this.notificationService.showSuccess('Inverter updated successfully!');
          this.cancelEdit();
          this.stateService.refreshState();
          setTimeout(() => {
            this.loadData();
            this._updatePpcController(); // TỰ ĐỘNG CẬP NHẬT PPC
          }, 1000);
        }
      },
      error: (err) => this.notificationService.showError('Failed to save changes: ' + (err.error || err.message))
    });
  }

  deleteInverter(inverter: any): void {
    if (!inverter.pid) {
      this.notificationService.showError('Error: Could not find PID for this inverter.');
      return;
    }
    if (confirm(`Are you sure you want to delete inverter "${inverter.alias}"?`)) {
      const fullPidPath = `/system/console/configMgr/${inverter.pid}`;
      this.apiService.deleteSerialPort(fullPidPath).subscribe({
        next: () => {
          this.notificationService.showSuccess('Inverter deleted successfully!');
          this.stateService.refreshState();
          setTimeout(() => {
            this.loadData();
            this._updatePpcController(); // TỰ ĐỘNG CẬP NHẬT PPC
          }, 1000);
        },
        error: (err) => this.notificationService.showError('Failed to delete inverter: ' + err.message)
      });
    }
  }

  /**
   * MỚI: Hàm này tự động tìm controller PPC và cập nhật lại danh sách Inverter ID.
   */
  private _updatePpcController(): void {
    forkJoin({
      felixPids: this.apiService.getFelixPids(),
      allComponents: this.stateService.components$.pipe(filter(c => c !== null), take(1))
    }).subscribe(({felixPids, allComponents}) => {
      const ppcControllerEntry = Object.entries(allComponents).find(([id, config]: [string, any]) => config.factoryId === 'Controller.PvInverter.FixPowerLimit');

      // Chỉ thực hiện nếu controller PPC đã tồn tại
      if (ppcControllerEntry) {
        const controller = ppcControllerEntry[1] as any;
        const alias = controller.properties.alias;
        const pid = felixPids.find(p => p.nameHint?.includes(`[${alias}]`))?.id;

        if (pid) {
          const allInverterIds = Object.keys(allComponents).filter(id => id.startsWith('pvInverter'));
          const updateConfig = {
            apply: 'true',
            alias: controller.properties.alias,
            enabled: controller.properties.enabled,
            powerLimit: controller.properties.powerLimit,
            'pvInverter.id': allInverterIds,
            propertylist: 'alias,enabled,powerLimit,pvInverter.id'
          };

          this.apiService.updateController(pid, updateConfig).subscribe({
            next: () => console.log('PPC Controller automatically updated with new inverter list.'),
            error: (err) => console.error('Failed to automatically update PPC controller:', err)
          });
        }
      }
    });
  }
}
