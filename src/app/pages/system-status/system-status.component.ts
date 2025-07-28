import {Component, OnInit, OnDestroy} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {CommonModule} from '@angular/common';
import {Subscription, of, forkJoin, filter, take} from 'rxjs';
import {catchError, switchMap, map, tap} from 'rxjs/operators'; // SỬA LỖI: Thêm switchMap
import {StateService} from '../../services/state.service';
import {MatCardModule} from '@angular/material/card';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatIconModule} from '@angular/material/icon';
import {ApiService} from '../../services/api.service';

// --- Interfaces ---
interface TierConfig {
  maxInverters: number;
  maxTotalPowerKW: number;
}

interface AppConfig {
  systemInfo?: { serialNumber: string; };
  inverterSetup?: { currentTier: string; tiers: { [key: string]: TierConfig }; inverterBrands: any[]; };
  meterSetup?: { meterBrands: any[]; meterTypes: any[] };
  storageSetup?: { storageBrands: any[]; };
  serialPortTemplates?: any[];
}

@Component({
  selector: 'app-system-status',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './system-status.component.html',
  styleUrls: ['./system-status.component.scss']
})
export class SystemStatusComponent implements OnInit, OnDestroy {
  isLoading = true;

  // System Info
  serialNumber = 'N/A';
  activeTier: TierConfig | null = null;

  // Component Counts & Stats
  serialPortCount = 0;
  inverterCount = 0;
  totalInverterPowerKW = 0;
  meterCount = 0;
  poiMeterAlias = 'Chưa có';
  storageCount = 0;

  private dataSubscription!: Subscription;

  constructor(
    private stateService: StateService,
    private apiService: ApiService,
    private http: HttpClient
  ) {
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
  }

  loadData(): void {
    this.isLoading = true;

    const config$ = this.http.get<AppConfig>('assets/config/app-config.json').pipe(
      catchError((err) => {
        console.error("Không thể tải app-config.json", err);
        return of({} as AppConfig);
      })
    );

    this.dataSubscription = config$.pipe(
      switchMap(config => {
        this.serialNumber = config.systemInfo?.serialNumber || 'N/A';
        if (config.inverterSetup) {
          this.activeTier = config.inverterSetup.tiers[config.inverterSetup.currentTier];
        }

        return this.stateService.components$.pipe(
          filter(components => components !== null),
          take(1),
          map(allComponents => ({allComponents, config}))
        );
      })
    ).subscribe(({allComponents, config}: { allComponents: any, config: AppConfig }) => { // SỬA LỖI: Thêm kiểu dữ liệu rõ ràng
      const components = Object.entries(allComponents);

      const inverterFactoryIds = config.inverterSetup?.inverterBrands.map(b => b.factoryId) || [];
      const meterFactoryIds = config.meterSetup?.meterBrands.map(b => b.factoryId) || [];
      const storageFactoryIds = config.storageSetup?.storageBrands.map(b => b.factoryId) || [];

      this.serialPortCount = components.filter(([id, cfg]: [string, any]) => cfg.factoryId === 'Bridge.Modbus.Serial').length;

      const inverters = components.filter(([id, cfg]: [string, any]) => inverterFactoryIds.includes(cfg.factoryId));
      this.inverterCount = inverters.length;
      this.totalInverterPowerKW = inverters.reduce((sum, [id, cfg]: [string, any]) => sum + (cfg.properties.maxActivePower / 1000), 0);

      const meters = components.filter(([id, cfg]: [string, any]) => meterFactoryIds.includes(cfg.factoryId));
      this.meterCount = meters.length;

      // SỬA LỖI: Xử lý an toàn hơn
      const poiMeter = meters.find(([id, cfg]: [string, any]) => cfg.properties.type === 'GRID');
      if (poiMeter && poiMeter[1]) {
        this.poiMeterAlias = (poiMeter[1] as any).properties.alias;
      } else {
        this.poiMeterAlias = 'Chưa có';
      }

      this.storageCount = components.filter(([id, cfg]: [string, any]) => storageFactoryIds.includes(cfg.factoryId)).length;

      this.isLoading = false;
    });
  }
}
