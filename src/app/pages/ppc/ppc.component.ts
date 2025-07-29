import {Component, OnInit, OnDestroy} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {Subscription, of, forkJoin, filter, take} from 'rxjs';
import {catchError, switchMap, map} from 'rxjs/operators';
import {StateService} from '../../services/state.service';
import {ApiService} from '../../services/api.service';
import {NotificationService} from '../../services/notification.service';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatRadioModule} from '@angular/material/radio';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';

@Component({
  selector: 'app-ppc',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatRadioModule, MatSlideToggleModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule
  ],
  templateUrl: './ppc.component.html',
  styleUrls: ['./ppc.component.scss']
})
export class PpcComponent implements OnInit, OnDestroy {
  isLoading = true;
  ppcForm!: FormGroup;

  totalInverterPowerW = 0;
  private allInverterComponentIds: string[] = [];
  private fixPowerLimitPid = '';
  private isWattMode = true;

  private valueChangesSub!: Subscription;
  private dataSubscription!: Subscription;
  private readonly FIX_POWER_LIMIT_FACTORY_PID = 'Controller.PvInverter.FixPowerLimit';
  private readonly FIX_POWER_LIMIT_ALIAS = 'ctrlPvInverterFixPowerLimit0';

  constructor(
    private stateService: StateService,
    private apiService: ApiService,
    private notificationService: NotificationService,
    private fb: FormBuilder
  ) {
  }

  ngOnInit(): void {
    this.ppcForm = this.fb.group({
      activePower: this.fb.group({
        enabled: [false],
        mode: ['WATT'],
        limitWatt: [{value: 0, disabled: true}, Validators.min(0)],
        limitPercent: [{value: 0, disabled: true}, [Validators.min(0), Validators.max(100)]]
      }),
      reactivePower: this.fb.group({
        enabled: [{value: false, disabled: true}],
        mode: [{value: 'KVAR', disabled: true}],
        limitKvar: [{value: 0, disabled: true}],
        limitPercent: [{value: 0, disabled: true}]
      })
    });

    this.loadData();
    this.setupFormListeners();
  }

  ngOnDestroy(): void {
    if (this.dataSubscription) this.dataSubscription.unsubscribe();
    if (this.valueChangesSub) this.valueChangesSub.unsubscribe();
  }

  loadData(): void {
    this.isLoading = true;
    if (this.dataSubscription) this.dataSubscription.unsubscribe();

    this.dataSubscription = forkJoin({
      felixPids: this.apiService.getFelixPids(),
      allComponents: this.stateService.components$.pipe(filter(c => c !== null), take(1))
    }).subscribe(({felixPids, allComponents}) => {
      const inverters = Object.entries(allComponents).filter(([id, config]: [string, any]) => id.startsWith('pvInverter'));
      this.allInverterComponentIds = inverters.map(inv => inv[0]);
      this.totalInverterPowerW = inverters.reduce((sum, [id, config]: [string, any]) => sum + (config.properties.maxActivePower || 0), 0);

      const fixPowerLimitComponentEntry = Object.entries(allComponents).find(([id, config]: [string, any]) => config.factoryId === this.FIX_POWER_LIMIT_FACTORY_PID);

      if (fixPowerLimitComponentEntry) {
        const controller = fixPowerLimitComponentEntry[1] as any;
        const alias = controller.properties.alias;
        const felixPidEntry = felixPids.find(p => p.nameHint?.includes(`[${alias}]`));
        this.fixPowerLimitPid = felixPidEntry ? felixPidEntry.id : '';

        const props = controller.properties;
        this.ppcForm.get('activePower')?.patchValue({
          enabled: props.enabled,
          limitWatt: props.powerLimit,
        }, {emitEvent: false});
        this.updatePercentFromWatt();
      } else {
        this.fixPowerLimitPid = '';
        this.ppcForm.get('activePower')?.reset({
          enabled: false, mode: 'WATT', limitWatt: 0, limitPercent: 0
        }, {emitEvent: false});
      }

      const activePowerGroup = this.ppcForm.get('activePower');
      if (activePowerGroup) {
        activePowerGroup.get('enabled')?.updateValueAndValidity({emitEvent: true});
      }

      this.isLoading = false;
      this.ppcForm.markAsPristine();
    });
  }

  private setupFormListeners(): void {
    const activePowerGroup = this.ppcForm.get('activePower') as FormGroup;

    activePowerGroup.get('enabled')?.valueChanges.subscribe(isEnabled => {
      const mode = activePowerGroup.get('mode')?.value;
      if (isEnabled) {
        activePowerGroup.get('mode')?.enable({emitEvent: false});
        if (mode === 'WATT') {
          activePowerGroup.get('limitWatt')?.enable({emitEvent: false});
          activePowerGroup.get('limitPercent')?.disable({emitEvent: false});
        } else {
          activePowerGroup.get('limitWatt')?.disable({emitEvent: false});
          activePowerGroup.get('limitPercent')?.enable({emitEvent: false});
        }
      } else {
        activePowerGroup.get('mode')?.disable({emitEvent: false});
        activePowerGroup.get('limitWatt')?.disable({emitEvent: false});
        activePowerGroup.get('limitPercent')?.disable({emitEvent: false});
      }
    });

    activePowerGroup.get('mode')?.valueChanges.subscribe(mode => {
      this.isWattMode = mode === 'WATT';
      if (activePowerGroup.get('enabled')?.value) {
        if (mode === 'WATT') {
          activePowerGroup.get('limitWatt')?.enable({emitEvent: false});
          activePowerGroup.get('limitPercent')?.disable({emitEvent: false});
        } else {
          activePowerGroup.get('limitWatt')?.disable({emitEvent: false});
          activePowerGroup.get('limitPercent')?.enable({emitEvent: false});
        }
      }
    });

    this.valueChangesSub = activePowerGroup.valueChanges.subscribe(() => {
      if (activePowerGroup.get('limitWatt')?.dirty) this.updatePercentFromWatt();
      if (activePowerGroup.get('limitPercent')?.dirty) this.updateWattFromPercent();
    });
  }

  private updatePercentFromWatt(): void {
    const wattControl = this.ppcForm.get('activePower.limitWatt');
    const percentControl = this.ppcForm.get('activePower.limitPercent');
    if (wattControl && percentControl && this.totalInverterPowerW > 0) {
      const percent = (wattControl.value / this.totalInverterPowerW) * 100;
      percentControl.setValue(percent.toFixed(0), {emitEvent: false});
    }
  }

  private updateWattFromPercent(): void {
    const wattControl = this.ppcForm.get('activePower.limitWatt');
    const percentControl = this.ppcForm.get('activePower.limitPercent');
    if (wattControl && percentControl && this.totalInverterPowerW > 0) {
      const watt = (percentControl.value / 100) * this.totalInverterPowerW;
      wattControl.setValue(Math.round(watt), {emitEvent: false});
    }
  }

  onSaveActivePower(): void {
    const activePowerGroup = this.ppcForm.get('activePower');
    if (!activePowerGroup) return;

    let powerLimitToSend: number;
    if (activePowerGroup.value.mode === 'PERCENT') {
      powerLimitToSend = Math.round((activePowerGroup.value.limitPercent / 100) * this.totalInverterPowerW);
    } else {
      powerLimitToSend = activePowerGroup.value.limitWatt;
    }

    if (powerLimitToSend > this.totalInverterPowerW) {
      this.notificationService.showError("Power limit cannot exceed total inverter power.");
      return;
    }

    if (this.fixPowerLimitPid) {
      // --- CẬP NHẬT controller đã có ---
      const updateConfig = {
        apply: 'true',
        alias: this.FIX_POWER_LIMIT_ALIAS,
        enabled: activePowerGroup.value.enabled,
        powerLimit: powerLimitToSend,
        'pvInverter.id': this.allInverterComponentIds,
        propertylist: 'alias,enabled,powerLimit,pvInverter.id'
      };
      this.apiService.updateController(this.fixPowerLimitPid, updateConfig).subscribe({
        next: () => {
          this.notificationService.showSuccess("Active Power settings updated successfully!");
          activePowerGroup.markAsPristine();
          setTimeout(() => this.loadData(), 1000);
        },
        error: (err: any) => this.notificationService.showError("Failed to update settings: " + err.message)
      });
    } else {
      // --- TẠO MỚI controller ---
      const createConfig = {
        apply: 'true',
        factoryPid: this.FIX_POWER_LIMIT_FACTORY_PID,
        alias: this.FIX_POWER_LIMIT_ALIAS,
        id: this.FIX_POWER_LIMIT_ALIAS,
        enabled: activePowerGroup.value.enabled,
        powerLimit: powerLimitToSend,
        'pvInverter.id': this.allInverterComponentIds,
        propertylist: 'id,alias,enabled,powerLimit,pvInverter.id'
      };
      this.apiService.createInverter(this.FIX_POWER_LIMIT_FACTORY_PID, createConfig).subscribe({
        next: () => {
          this.notificationService.showSuccess("Active Power controller created successfully!");
          activePowerGroup.markAsPristine();
          setTimeout(() => this.loadData(), 1500);
        },
        error: (err: any) => this.notificationService.showError("Failed to create controller: " + err.message)
      });
    }
  }
}
