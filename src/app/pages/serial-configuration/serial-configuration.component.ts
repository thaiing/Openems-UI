import {Component, OnInit, OnDestroy} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {Subscription, of} from 'rxjs';
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

interface PortTemplate {
  key: string;
  displayName: string;
  portName: string;
}

@Component({
  selector: 'app-serial-configuration',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatCardModule, MatTooltipModule
  ],
  templateUrl: './serial-configuration.component.html',
  styleUrls: ['./serial-configuration.component.scss']
})
export class SerialConfigurationComponent implements OnInit, OnDestroy {
  ports: any[] = [];
  portTemplates: PortTemplate[] = [];

  isAdding = false;
  addForm!: FormGroup;
  editForm!: FormGroup;
  portInEditing: string | null = null;

  private stateSubscription!: Subscription;
  readonly FACTORY_PID = 'Bridge.Modbus.Serial';

  baudRates = [9600, 19200, 38400, 57600, 115200];
  dataBitsOptions = [5, 6, 7, 8];
  stopBitsOptions = ['ONE', 'ONE_POINT_FIVE', 'TWO'];
  parityOptions = ['NONE', 'EVEN', 'ODD', 'MARK', 'SPACE'];

  constructor(
    private stateService: StateService,
    private apiService: ApiService,
    private fb: FormBuilder,
    private http: HttpClient
  ) {
  }

  ngOnInit(): void {
    this.addForm = this.fb.group({
      template: [null, Validators.required],
      baudRate: ['9600', Validators.required],
      databits: ['8', Validators.required],
      stopbits: ['ONE', Validators.required],
      parity: ['NONE', Validators.required]
    });
    this.editForm = this.fb.group({
      baudRate: ['', Validators.required],
      databits: ['', Validators.required],
      stopbits: ['', Validators.required],
      parity: ['', Validators.required]
    });

    this.stateSubscription = this.http.get<any>('assets/config/app-config.json')
      .pipe(
        catchError(error => {
          console.error('Không tải được app-config.json. Sử dụng portTemplates rỗng.', error);
          return of({serialPortTemplates: []});
        }),
        map(config => config.serialPortTemplates || []),
        tap(templates => this.portTemplates = templates),
        switchMap(() => this.stateService.components$)
      )
      .subscribe(allComponents => {
        if (allComponents) {
          this.ports = Object.entries(allComponents)
            .filter(([id, config]: [string, any]) => config.factoryId === this.FACTORY_PID)
            .map(([id, config]: [string, any]) => {
              const props = config.properties || {};
              return {
                key: props.alias,
                pid: id,
                displayName: this.portTemplates.find(t => t.key === props.alias)?.displayName || props.alias,
                portName: props.portName,
                baudRate: props.baudRate,
                databits: props.databits,
                stopbits: props.stopbits,
                parity: props.parity,
              };
            })
            .sort((a, b) => a.key.localeCompare(b.key));
        } else {
          this.ports = [];
        }
      });
  }


  ngOnDestroy(): void {
    if (this.stateSubscription) this.stateSubscription.unsubscribe();
  }

  // --- Logic Tạo Mới ---
  showAddForm(): void {
    this.isAdding = true;
    this.addForm.reset({baudRate: '9600', databits: '8', stopbits: 'ONE', parity: 'NONE'});
  }

  cancelAdd(): void {
    this.isAdding = false;
  }

  confirmAddPort(): void {
    if (this.addForm.invalid) return;

    const formValue = this.addForm.value;
    const template = this.portTemplates.find(t => t.key === formValue.template);
    if (!template) {
      alert('Vui lòng chọn một Port để tạo.');
      return;
    }

    const createConfig = {
      apply: 'true',
      factoryPid: this.FACTORY_PID,
      location: '',
      id: template.key,
      alias: template.key,
      enabled: 'true',
      portName: template.portName,
      baudRate: formValue.baudRate?.toString(),
      databits: formValue.databits?.toString(),
      stopbits: formValue.stopbits,
      parity: formValue.parity,
      enableTermination: 'false',
      delayBeforeTx: '0',
      delayAfterTx: '0',
      logVerbosity: '1',
      invalidateElementsAfterReadErrors: '1',
      propertylist: 'id,alias,enabled,portName,baudRate,databits,stopbits,parity,enableTermination,delayBeforeTx,delayAfterTx,logVerbosity,invalidateElementsAfterReadErrors'
    };

    this.apiService.createSerialPort(this.FACTORY_PID, createConfig)
      .pipe(catchError(err => {
        alert('Tạo port không thành công: ' + err.message);
        return of(null);
      }))
      .subscribe(result => {
        if (result) {
          alert('Tạo port thành công!');
          this.cancelAdd();
          this.stateService.refreshState();
        }
      });
  }

  getAvailableTemplates(): PortTemplate[] {
    const existingKeys = this.ports.map(p => p.key);
    return this.portTemplates.filter(t => !existingKeys.includes(t.key));
  }

  // --- Logic Sửa và Xóa ---
  editPort(port: any): void {
    this.portInEditing = port.key;
    this.editForm.patchValue(port);
  }

  cancelEdit(): void {
    this.portInEditing = null;
  }

  saveChanges(port: any): void {
    if (this.editForm.invalid) return;
    const formValue = this.editForm.value;

    const updateConfig = {
      apply: 'true',
      // location: '',
      // id: port.key,
      alias: port.key,
      // enabled: 'true',
      // portName: port.portName,
      baudRate: formValue.baudRate?.toString(),
      databits: formValue.databits?.toString(),
      stopbits: formValue.stopbits,
      parity: formValue.parity,
      // enableTermination: 'false',
      // delayBeforeTx: '0',
      // delayAfterTx: '0',
      // logVerbosity: '1',
      // invalidateElementsAfterReadErrors: '1',
      propertylist: 'id,alias,enabled,portName,baudRate,databits,stopbits,parity,enableTermination,delayBeforeTx,delayAfterTx,logVerbosity,invalidateElementsAfterReadErrors'
    };

    const fullPidPath = `/system/console/configMgr/${port.pid}`;
    this.apiService.updateSerialPortConfigFelix(fullPidPath, updateConfig)
      .pipe(catchError(err => {
        alert('Lưu cấu hình không thành công!\n' + (err.error || err.message));
        return of(null);
      }))
      .subscribe(result => {
        if (result) {
          this.cancelEdit();
          this.stateService.refreshState();
        }
      });
  }

  deletePort(port: any): void {
    if (confirm(`Bạn có chắc chắn muốn xóa ${port.displayName} không?`)) {
      const fullPidPath = `/system/console/configMgr/${port.pid}`;
      this.apiService.deleteSerialPort(fullPidPath)
        .subscribe(() => {
          alert('Xóa port thành công!');
          this.stateService.refreshState();
        });
    }
  }
}
