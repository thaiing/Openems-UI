import {Routes} from '@angular/router';

// Import tất cả các component trang
import {SystemStatusComponent} from './pages/system-status/system-status.component';
import {SerialConfigurationComponent} from './pages/serial-configuration/serial-configuration.component';
import {NetworkComponent} from './pages/network/network.component';
import {InverterComponent} from './pages/inverter/inverter.component';
import {PoiMeterComponent} from './pages/poi-meter/poi-meter.component';
import {PpcComponent} from './pages/ppc/ppc.component';
// import {VpnComponent} from './pages/vpn/vpn.component';
import {IpsecComponent} from './pages/ipsec/ipsec.component';     // <-- Thêm import
import {OpenvpnComponent} from './pages/openvpn/openvpn.component';
import {StorageComponent} from './pages/storage/storage.component';

export const routes: Routes = [
  {path: '', redirectTo: '/status', pathMatch: 'full'},
  {path: 'status', component: SystemStatusComponent, data: {title: 'Status'}}, // Trang Status vẫn có title, ta sẽ xử lý riêng
  {path: 'serial', component: SerialConfigurationComponent, data: {title: 'Serial'}},
  {path: 'network', component: NetworkComponent, data: {title: 'Network'}},
  {path: 'inverter', component: InverterComponent, data: {title: 'Inverter'}},
  {path: 'poi-meter', component: PoiMeterComponent, data: {title: 'Meter'}},
  {path: 'storage', component: StorageComponent, data: {title: 'Storage'}},
  {path: 'ppc', component: PpcComponent, data: {title: 'PPC'}},
  {path: 'ipsec', component: IpsecComponent, data: {title: 'IPSec'}},
  {path: 'openvpn', component: OpenvpnComponent, data: {title: 'OpenVPN'}},
];
