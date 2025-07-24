import {Component} from '@angular/core';
import {LayoutComponent} from './layout/layout.component';
import {StateService} from './services/state.service';
import {ApiService} from './services/api.service'; // <-- Thêm import này

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LayoutComponent],
  template: `
    <app-layout></app-layout>`,
})
export class AppComponent {
  title = 'openems-pro-ui';

  // Inject cả 2 service vào constructor
  constructor(
    private stateService: StateService,
    private websocketService: ApiService
  ) {
  }
}
