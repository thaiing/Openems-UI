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
import {NotificationService} from '../../services/notification.service';

interface PortTemplate {
  key: string;
  displayName: string;
  portName: string;
}

@Component({
  selector: 'app-serial-configuration',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, HttpClientModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatCardModule, MatTooltipModule
  ],
  templateUrl: './serial-configuration.component.html',
  styleUrls: ['./serial-configuration.component.scss']
})
export class SerialConfigurationComponent implements OnInit, OnDestroy {
  ports: any[] = [];
  portTemplates: PortTemplate[] = [];

  isLoading = true;
  isAdding = false;
  addForm!: FormGroup;
  editForm!: FormGroup;
  portInEditing: string | null = null;

  private dataSubscription!: Subscription;
  readonly FACTORY_PID = 'Bridge.Modbus.Serial';

  baudRates = [9600, 19200, 38400, 57600, 115200];
  dataBitsOptions = [5, 6, 7, 8];
  stopBitsOptions = ['ONE', 'ONE_POINT_FIVE', 'TWO'];
  parityOptions = ['NONE', 'EVEN', 'ODD', 'MARK', 'SPACE'];

  constructor(
    private notificationService: NotificationService,
    private stateService: StateService,
    private apiService: ApiService,
    private fb: FormBuilder,
    private http: HttpClient
  ) {
  }

  ngOnInit(): void {
    this.addForm = this.fb.group({
      template: [null, Validators.required], baudRate: ['9600', Validators.required],
      databits: ['8', Validators.required], stopbits: ['ONE', Validators.required],
      parity: ['NONE', Validators.required]
    });
    this.editForm = this.fb.group({
      baudRate: ['', Validators.required], databits: ['', Validators.required],
      stopbits: ['', Validators.required], parity: ['', Validators.required]
    });

    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }

    // Dùng forkJoin để lấy templates và PIDs dài từ Felix cùng lúc
    this.dataSubscription = forkJoin({
      config: this.http.get<any>('assets/config/app-config.json').pipe(catchError(() => of({serialPortTemplates: []}))),
      felixPids: this.apiService.getFelixPids()
    }).pipe(
      // Sau khi có cả hai, mới lắng nghe dữ liệu chi tiết từ WebSocket
      switchMap(({config, felixPids}) => {
        this.portTemplates = config.serialPortTemplates || [];

        // Xây dựng "bản đồ" tra cứu từ alias -> PID dài
        const pidMap = new Map<string, string>();
        felixPids
          .filter(p => p.fpid === this.FACTORY_PID)
          .forEach(p => {
            const aliasMatch = p.nameHint?.match(/\[(.*?)\]/);
            if (aliasMatch && aliasMatch[1]) {
              pidMap.set(aliasMatch[1], p.id);
            }
          });

        // Lắng nghe dữ liệu chi tiết, chờ đến khi có dữ liệu thật (khác null)
        return this.stateService.components$.pipe(
          filter(components => components !== null),
          take(1), // Chỉ lấy 1 lần để forkJoin hoàn thành
          map(allComponents => ({allComponents, pidMap})) // Gửi cả hai đi tiếp
        );
      })
    ).subscribe(({allComponents, pidMap}) => {
      // Kết hợp hai nguồn dữ liệu để tạo ra danh sách port hoàn chỉnh
      this.ports = Object.entries(allComponents)
        .filter(([id, config]: [string, any]) => config.factoryId === this.FACTORY_PID)
        .map(([id, config]: [string, any]) => {
          const props = config.properties || {};
          const longPid = pidMap.get(id); // Tra cứu PID dài

          // Chỉ thêm port vào danh sách nếu tìm thấy PID dài tương ứng
          if (!longPid) {
            console.warn(`Không tìm thấy PID dài cho alias: ${id}`);
            return null;
          }

          return {
            key: props.alias,
            pid: longPid, // QUAN TRỌNG: Gán PID dài vào đây
            alias: id,
            displayName: this.portTemplates.find(t => t.key === props.alias)?.displayName || `Port [${props.alias}]`,
            portName: props.portName,
            baudRate: props.baudRate,
            databits: props.databits,
            stopbits: props.stopbits,
            parity: props.parity,
          };
        })
        .filter(port => port !== null); // Lọc bỏ những port không hợp lệ

      this.isLoading = false;
    });
  }

  ngOnDestroy(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
  }

  showAddForm(): void {
    this.isAdding = true;
    this.addForm.reset({baudRate: '9600', databits: '8', stopbits: 'ONE', parity: 'NONE'});
  }

  cancelAdd(): void {
    this.isAdding = false;
  }

  confirmAddPort(): void {
    if (this.addForm.invalid) {
      return;
    }
    const formValue = this.addForm.value;
    const template = this.portTemplates.find(t => t.key === formValue.template);
    if (!template) {
      this.notificationService.showError('Please select a port template to create.');
      return;
    }

    const createConfig = {
      apply: 'true', factoryPid: this.FACTORY_PID, location: '', id: template.key,
      alias: template.key, enabled: 'true', portName: template.portName,
      baudRate: formValue.baudRate?.toString(), databits: formValue.databits?.toString(),
      stopbits: formValue.stopbits, parity: formValue.parity, enableTermination: 'false',
      delayBeforeTx: '0', delayAfterTx: '0', logVerbosity: '1',
      invalidateElementsAfterReadErrors: '1',
      propertylist: 'id,alias,enabled,portName,baudRate,databits,stopbits,parity,enableTermination,delayBeforeTx,delayAfterTx,logVerbosity,invalidateElementsAfterReadErrors'
    };

    this.apiService.createSerialPort(this.FACTORY_PID, createConfig)
      .pipe(catchError(err => {
        this.notificationService.showError('Failed to create port: ' + err.message);
        return of(null);
      }))
      .subscribe(result => {
        if (result) {
          this.notificationService.showSuccess('Port created successfully!');
          this.cancelAdd();
          this.stateService.refreshState();
        }
      });
  }

  getAvailableTemplates(): PortTemplate[] {
    const existingKeys = this.ports.map(p => p.key);
    return this.portTemplates.filter(t => !existingKeys.includes(t.key));
  }

  editPort(port: any): void {
    this.portInEditing = port.key;
    this.editForm.patchValue(port);
  }

  cancelEdit(): void {
    this.portInEditing = null;
  }

  saveChanges(port: any): void {
    if (this.editForm.invalid) {
      return;
    }
    if (!port.pid) {
      alert('Lỗi: Không tìm thấy PID của port để lưu. Vui lòng thử tải lại trang.');
      return;
    }

    const formValue = this.editForm.value;
    const updateConfig = {
      apply: 'true',
      alias: port.alias,
      enabled: 'true',
      portName: port.portName,
      baudRate: formValue.baudRate?.toString(),
      databits: formValue.databits?.toString(),
      stopbits: formValue.stopbits,
      parity: formValue.parity,
      propertylist: 'alias,enabled,portName,baudRate,databits,stopbits,parity'
    };

    // ĐƯỜNG DẪN NÀY BÂY GIỜ SẼ ĐÚNG VÌ port.pid LÀ PID DÀI
    const fullPidPath = `/system/console/configMgr/${port.pid}`;

    this.apiService.updateSerialPortConfigFelix(fullPidPath, updateConfig)
      .pipe(catchError(err => {
        this.notificationService.showError('Failed to save configuration: ' + (err.error || err.message));
        return of(null);
      }))
      .subscribe(result => {
        if (result) {
          this.notificationService.showSuccess('Configuration saved successfully!');
          this.cancelEdit();
          this.stateService.refreshState();
        }
      });
  }

  deletePort(port: any): void {
    if (!port.pid) {
      alert('Lỗi: Không tìm thấy PID của port để xóa. Vui lòng thử tải lại trang.');
      return;
    }
    if (confirm(`Bạn có chắc chắn muốn xóa ${port.displayName} không?`)) {
      const fullPidPath = `/system/console/configMgr/${port.pid}`;
      this.apiService.deleteSerialPort(fullPidPath)
        .subscribe(() => {
          this.notificationService.showSuccess('Port deleted successfully!');
          this.stateService.refreshState();
        });
    }
  }
}
