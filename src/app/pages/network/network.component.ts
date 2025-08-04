import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {CommonModule} from '@angular/common';

import {ApiService, NetworkConfig} from '../../services/api.service';
import {NotificationService} from '../../services/notification.service';

@Component({
  selector: 'app-network',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './network.component.html',
  styleUrls: ['./network.component.scss']
})
export class NetworkComponent implements OnInit {
  networkConfigs: NetworkConfig[] = [];
  isLoading = true;
  error: string | null = null;

  networkForms: { [key: string]: FormGroup } = {};
  activeTab: 'ethernet' | '4g' = 'ethernet';

  constructor(
    private apiService: ApiService,
    private fb: FormBuilder,
    private notificationService: NotificationService
  ) {
  }

  ngOnInit(): void {
    this.loadNetworkData();
  }

  selectTab(tab: 'ethernet' | '4g'): void {
    this.activeTab = tab;
  }

  loadNetworkData(): void {
    this.isLoading = true;
    this.apiService.getNetworkConfigs().subscribe({
      next: (data) => {
        this.networkConfigs = data;
        this.buildForms();
        this.isLoading = false;
        this.error = null;
      },
      error: (err) => {
        console.error('Failed to fetch network config', err);
        this.error = 'Could not load network configuration. The backend API might be down or blocked.';
        this.isLoading = false;
        this.networkConfigs = [];
      }
    });
  }

  buildForms(): void {
    this.networkConfigs.forEach(config => {
      const form = this.fb.group({
        isDhcp: [config.isDhcp, Validators.required],
        ipAddress: [config.ipAddress, [Validators.required, Validators.pattern(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)]],
        subnetMask: [config.subnetMask, [Validators.required, Validators.pattern(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)]],
        gateway: [config.gateway, [Validators.required, Validators.pattern(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)]]
      });

      form.get('isDhcp')?.valueChanges.subscribe(isDhcpValue => {
        this.toggleStaticIpValidators(form, isDhcpValue ?? false);
      });

      this.toggleStaticIpValidators(form, config.isDhcp);
      this.networkForms[config.id] = form;
    });
  }

  toggleStaticIpValidators(form: FormGroup, isDhcp: boolean): void {
    const fields = ['ipAddress', 'subnetMask', 'gateway'];
    fields.forEach(field => {
      const control = form.get(field);
      if (isDhcp) {
        control?.disable();
      } else {
        control?.enable();
      }
    });
  }

  onSave(configId: string): void {
    const form = this.networkForms[configId];
    if (form.invalid) {
      this.notificationService.showError('Please fill in all required fields correctly.');
      form.markAllAsTouched();
      return;
    }

    const formData = form.getRawValue();
    form.disable(); // Disable form while saving

    this.apiService.setNetworkConfig(configId, formData).subscribe({
      next: (updatedConfig) => {
        this.notificationService.showSuccess(`Configuration for ${updatedConfig.displayName} was updated successfully!`);
        const index = this.networkConfigs.findIndex(c => c.id === configId);
        if (index > -1) {
          this.networkConfigs[index] = updatedConfig;
          this.networkForms[configId].patchValue(updatedConfig, {emitEvent: false});
          this.toggleStaticIpValidators(this.networkForms[configId], updatedConfig.isDhcp);
        }
        form.markAsPristine();
        form.enable();
        this.toggleStaticIpValidators(form, updatedConfig.isDhcp); // Re-apply disabled state after enabling
      },
      error: (err) => {
        console.error('Failed to save network config', err);
        this.notificationService.showError(`Error saving configuration: ${err.error?.details || err.message}`);
        form.enable();
        this.toggleStaticIpValidators(form, form.get('isDhcp')?.value);
      }
    });
  }
}
