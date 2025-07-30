import {Routes} from '@angular/router';
import {LayoutComponent} from './layout/layout.component';
import {LoginComponent} from './pages/login/login.component';
import {authGuard} from './guards/auth.guard';
import {SystemStatusComponent} from './pages/system-status/system-status.component';
import {SerialConfigurationComponent} from './pages/serial-configuration/serial-configuration.component';
import {NetworkComponent} from './pages/network/network.component';
import {InverterComponent} from './pages/inverter/inverter.component';
import {PoiMeterComponent} from './pages/poi-meter/poi-meter.component';
import {StorageComponent} from './pages/storage/storage.component';
import {PpcComponent} from './pages/ppc/ppc.component';
import {IpsecComponent} from './pages/ipsec/ipsec.component';
import {OpenvpnComponent} from './pages/openvpn/openvpn.component';
import {AccountComponent} from './pages/account/account.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard], // ÁP DỤNG GUARD BẢO VỆ
    children: [
      {path: '', redirectTo: 'status', pathMatch: 'full'},
      {path: 'status', component: SystemStatusComponent, data: {title: 'Status'}},
      {path: 'serial', component: SerialConfigurationComponent, data: {title: 'Serial'}},
      {path: 'network', component: NetworkComponent, data: {title: 'Network'}},
      {path: 'inverter', component: InverterComponent, data: {title: 'Inverter'}},
      {path: 'poi-meter', component: PoiMeterComponent, data: {title: 'Meter'}},
      {path: 'storage', component: StorageComponent, data: {title: 'Storage'}},
      {path: 'ppc', component: PpcComponent, data: {title: 'PPC'}},
      {path: 'ipsec', component: IpsecComponent, data: {title: 'IPSec'}},
      {path: 'openvpn', component: OpenvpnComponent, data: {title: 'OpenVPN'}},
      {
        path: 'account',
        data: {title: 'Account'},
        loadComponent: () => import('./pages/account/account.component').then(m => m.AccountComponent)
      },
    ]
  },
  {path: '**', redirectTo: 'login'} // Chuyển hướng các đường dẫn lạ về trang login
];
