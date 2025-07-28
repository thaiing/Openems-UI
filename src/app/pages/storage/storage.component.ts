import {Component, OnInit, OnDestroy} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {Subscription, of, forkJoin, filter, take} from 'rxjs';
import {catchError, switchMap, tap, map} from 'rxjs/operators';
import {StateService} from '../../services/state.service';
import {ApiService} from '../../services/api.service';
import {NotificationService} from '../../services/notification.service'; // Thêm vào
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
  storageSetup?: {
    storageBrands: StorageBrand[];
  }
}

interface PortTemplate {
  key: string;
  displayName: string;
}

interface StorageBrand {
  name: string;
  factoryId: string;
}

@Component({
  selector: 'app-storage',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule,
    MatIconModule, MatCardModule, MatTooltipModule
  ],
  templateUrl: './storage.component.html',
  styleUrls: ['./storage.component.scss']
})
export class StorageComponent implements OnInit, OnDestroy {
  storageDevices: any[] = [];
  serialPorts: PortTemplate[] = [];
  storageBrands: StorageBrand[] = [];

  isLoading = true;
  isAdding = false;
  addForm!: FormGroup;
  editForm!: FormGroup;
  storageInEditing: string | null = null;

  private dataSubscription!: Subscription;

  constructor(
    private stateService: StateService,
    private apiService: ApiService,
    private http: HttpClient,
    private fb: FormBuilder,
    private notificationService: NotificationService // Thêm vào
  ) {
  }

  ngOnInit(): void {
    this.addForm = this.fb.group({
      alias: ['', Validators.required],
      brand: [null, Validators.required],
      serialPort: [null, Validators.required],
      modbusUnitId: [1, [Validators.required, Validators.min(1)]],
    });
    this.editForm = this.fb.group({
      alias: ['', Validators.required],
      serialPort: [null, Validators.required],
      modbusUnitId: ['', [Validators.required, Validators.min(1)]],
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
        if (config && config.storageSetup) {
          this.storageBrands = config.storageSetup.storageBrands;
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
        .filter(p => this.storageBrands.some(b => b.factoryId === p.fpid))
        .forEach(p => {
          const aliasMatch = p.nameHint?.match(/\[(.*?)\]/);
          if (aliasMatch && aliasMatch[1]) {
            pidMap.set(aliasMatch[1], p.id);
          }
        });

      this.storageDevices = Object.entries(allComponents)
        .filter(([id, config]: [string, any]) => this.storageBrands.some(b => b.factoryId === config.factoryId))
        .map(([id, config]: [string, any]) => {
          const props = config.properties;
          const longPid = pidMap.get(id);
          if (!longPid) return null;

          return {
            pid: longPid,
            componentId: id,
            alias: props.alias,
            brandName: this.storageBrands.find(b => b.factoryId === config.factoryId)?.name || config.factoryId,
            serialPort: props['modbus.id'],
            modbusUnitId: props.modbusUnitId,
          };
        })
        .filter(device => device !== null);

      this.isLoading = false;
    });
  }

  getPortDisplayName(key: string): string {
    const port = this.serialPorts.find(p => p.key === key);
    return port ? port.displayName : key;
  }

  private findNextAvailableComponentId(): string {
    const existingIds = this.storageDevices
      .map(device => parseInt(device.componentId.replace(/\D/g, ''), 10))
      .filter(id => !isNaN(id)).sort((a, b) => a - b);
    let nextId = 0;
    for (const id of existingIds) {
      if (id === nextId) {
        nextId++;
      } else {
        break;
      }
    }
    return `battery${nextId}`;
  }

  showAddForm(): void {
    this.isAdding = true;
    this.addForm.reset({modbusUnitId: 1});
  }

  cancelAdd(): void {
    this.isAdding = false;
  }

  cancelEdit(): void {
    this.storageInEditing = null;
  }

  confirmAdd(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }
    const formValue = this.addForm.value;
    const brand = this.storageBrands.find(b => b.factoryId === formValue.brand);
    if (!brand) return;

    const componentId = this.findNextAvailableComponentId();
    const createConfig = {
      apply: 'true',
      factoryPid: brand.factoryId,
      id: componentId,
      alias: formValue.alias,
      enabled: 'true',
      'modbus.id': formValue.serialPort,
      modbusUnitId: formValue.modbusUnitId,
      propertylist: 'id,alias,enabled,modbus.id,modbusUnitId'
    };

    this.apiService.createInverter(brand.factoryId, createConfig).subscribe({
      next: (result) => {
        if (result) {
          this.notificationService.showSuccess('Storage created successfully!');
          this.cancelAdd();
          this.stateService.refreshState();
          setTimeout(() => this.loadData(), 1500);
        }
      },
      error: (err) => this.notificationService.showError('Failed to create storage: ' + err.message)
    });
  }

  editStorage(device: any): void {
    this.storageInEditing = device.componentId;
    this.editForm.patchValue({
      alias: device.alias,
      serialPort: device.serialPort,
      modbusUnitId: device.modbusUnitId,
    });
  }

  saveChanges(device: any): void {
    if (this.editForm.invalid) return;
    if (!device.pid) {
      this.notificationService.showError('Error: Could not find PID for this device.');
      return;
    }

    const formValue = this.editForm.value;
    const updateConfig = {
      apply: 'true',
      id: device.componentId,
      alias: formValue.alias,
      enabled: 'true',
      'modbus.id': formValue.serialPort,
      modbusUnitId: formValue.modbusUnitId,
      propertylist: 'id,alias,enabled,modbus.id,modbusUnitId'
    };

    const fullPidPath = `/system/console/configMgr/${device.pid}`;
    this.apiService.updateSerialPortConfigFelix(fullPidPath, updateConfig).subscribe({
      next: (result) => {
        if (result) {
          this.notificationService.showSuccess('Storage updated successfully!');
          this.cancelEdit();
          this.stateService.refreshState();
          setTimeout(() => this.loadData(), 1000);
        }
      },
      error: (err) => this.notificationService.showError('Failed to save changes: ' + (err.error || err.message))
    });
  }

  deleteStorage(device: any): void {
    if (!device.pid) {
      this.notificationService.showError('Error: Could not find PID for this device.');
      return;
    }
    if (confirm(`Are you sure you want to delete "${device.alias}"?`)) {
      const fullPidPath = `/system/console/configMgr/${device.pid}`;
      this.apiService.deleteSerialPort(fullPidPath).subscribe({
        next: () => {
          this.notificationService.showSuccess('Storage deleted successfully!');
          this.stateService.refreshState();
          setTimeout(() => this.loadData(), 1000);
        },
        error: (err) => this.notificationService.showError('Failed to delete storage: ' + err.message)
      });
    }
  }
}
