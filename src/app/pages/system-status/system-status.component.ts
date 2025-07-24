import {Component, OnInit} from '@angular/core';
import {CommonModule, NgClass} from '@angular/common';
import {ApiService} from '../../services/api.service';

// Import các module của Material
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';

@Component({
  selector: 'app-system-status',
  standalone: true,
  imports: [CommonModule, NgClass, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './system-status.component.html',
  styleUrls: ['./system-status.component.scss']
})
export class SystemStatusComponent implements OnInit {

  // Khởi tạo đối tượng với cấu trúc rỗng để giao diện không bị lỗi
  statusData: any = {
    overall: {status: 'Loading...', statusClass: 'warn'},
    systemInfo: {},
    serial: {},
    network: {},
    inverter: {},
    meter: {},
    storage: {},
    ppc: {},
    vpn: {}
  };

  constructor(private websocketService: ApiService) {
  }

  ngOnInit(): void {
    // Gọi hàm getEdgeConfig để lấy toàn bộ dữ liệu một lần
    this.websocketService.getEdgeConfig().subscribe({
      next: (response) => {
        const allComponents = response.payload?.params?.components;
        if (!allComponents) {
          console.error("Could not find 'components' in the response");
          this.statusData.overall = {status: 'Failed to load data', statusClass: 'error'};
          return;
        }

        // Trích xuất dữ liệu cho từng thẻ từ cục dữ liệu lớn
        this.extractStatusData(allComponents);
      },
      error: (err) => {
        console.error("Error fetching edge config for status page:", err);
        this.statusData.overall = {status: 'Connection Error', statusClass: 'error'};
      }
    });
  }

  // Hàm để xử lý và trích xuất dữ liệu
  private extractStatusData(components: any): void {
    // Dữ liệu giả làm fallback nếu không tìm thấy component
    const defaultData = {statusClass: 'warn', name: 'Not Found'};

    // Lấy dữ liệu từ các component cụ thể
    const modbus0 = components['modbus0']?.properties || {};
    const net0 = components['net0']?.properties || {};
    const inverter0 = components['pvInverter0']?.properties || {}; // Tên ID có thể là pvInverter0
    const meter0 = components['meter0']?.properties || {};
    const ess0 = components['ess0']?.properties || {};

    this.statusData = {
      lastUpdated: `Updated just now`,
      overall: {status: 'All Systems Normal', statusClass: 'ok'},
      systemInfo: {
        firmware: 'v3.1.2-beta', // Dữ liệu này có thể cần lấy từ kênh riêng
        serialNumber: 'MXC-2401-0084',
        uptime: 'N/A'
      },
      serial: {port: modbus0.portName || 'N/A', baudRate: modbus0.baudRate || 'N/A', statusClass: 'ok'},
      network: {ip: net0.ipv4_address || 'N/A', dhcp: net0.LinkState === 1 ? 'Enabled' : 'Disabled', statusClass: 'ok'},
      inverter: {
        name: inverter0.alias || 'Inverter 0',
        brand: 'Huawei',
        pmax: (inverter0.maxActivePower / 1000) || 'N/A',
        statusClass: 'ok'
      },
      meter: {name: meter0.alias || 'Meter 0', poi: true, invert: true, statusClass: 'ok'},
      storage: {name: ess0.alias || 'ESS 0', chargingPower: 'N/A', statusClass: 'ok'},
      ppc: {enabledModes: 'N/A', statusClass: 'ok'},
      vpn: {type: 'IPSec', status: 'Disabled', statusClass: 'warn'}
    };
  }
}
