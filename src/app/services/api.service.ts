import {Injectable, Inject, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {webSocket, WebSocketSubject} from 'rxjs/webSocket';
import {Observable, Subject, tap, catchError, EMPTY, map, filter, retry, timer, firstValueFrom} from 'rxjs';
import {v4 as uuidv4} from 'uuid';
import {HttpClient, HttpHeaders} from '@angular/common/http';

// ====================================================================
// ĐỊNH NGHĨA CÁC INTERFACE
// ====================================================================

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params: any;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string;
  result?: any;
  error?: any;
  method?: string;
  params?: any;
}

// Interface mới cho cấu hình mạng
export interface NetworkConfig {
  id: string;
  displayName: string;
  isDhcp: boolean;
  ipAddress: string;
  subnetMask: string;
  gateway: string;
}


@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private socket$!: WebSocketSubject<any>;
  private messageSubject = new Subject<JsonRpcResponse>();
  public messages$ = this.messageSubject.asObservable();
  private isConnected = false;
  private edgeId = '0';

  // URL cho API network viết bằng Python
  private networkApiUrl = 'http://192.168.4.93:5000';

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.connect();
    }
  }

  // ====================================================================
  // PHẦN 1: Giao tiếp WebSocket (Giữ nguyên)
  // ====================================================================

  private connect(): void {
    this.socket$ = webSocket({
      url: '/jsonrpc',
      deserializer: (e) => JSON.parse(e.data),
      serializer: (value) => JSON.stringify(value),
      openObserver: {
        next: () => {
          this.isConnected = true;
          this.authenticate();
        }
      }
    });

    this.socket$.pipe(
      retry({delay: () => timer(5000)})
    ).subscribe(message => this.messageSubject.next(message));
  }

  private async authenticate(): Promise<void> {
    try {
      await firstValueFrom(this.rpc('authenticateWithPassword', {username: 'admin', password: 'admin'}));
      this.getEdgeConfig().subscribe();
    } catch (error) {
      console.error('Authentication failed:', error);
    }
  }

  public rpc(method: string, params: any = {}): Observable<any> {
    const requestId = uuidv4();
    const request: JsonRpcRequest = {jsonrpc: '2.0', id: requestId, method: method, params: params};
    if (isPlatformBrowser(this.platformId) && this.isConnected) {
      this.socket$.next(request);
    }
    return this.messageSubject.asObservable().pipe(
      filter((response: JsonRpcResponse) => response.id === requestId),
      map((response: JsonRpcResponse) => {
        if (response.error) {
          throw new Error(`RPC Error: ${response.error.message}`);
        }
        return response.result;
      })
    );
  }

  public getEdgeConfig(): Observable<any> {
    const innerId = uuidv4();
    const request = {
      method: 'edgeRpc',
      params: {edgeId: this.edgeId, payload: {jsonrpc: '2.0', id: innerId, method: 'getEdgeConfig', params: {}}}
    };
    return this.rpc(request.method, request.params);
  }

  // ====================================================================
  // PHẦN 2: Giao tiếp HTTP với Felix Console (Giữ nguyên)
  // ====================================================================

  getFelixPids(): Observable<any[]> {
    const url = '/system/console/configMgr';
    return this.http.get(url, {responseType: 'text'}).pipe(
      map(htmlString => {
        const match = htmlString.match(/var configData = (\{.*?\});/);
        if (match && match[1]) {
          try {
            const configData = JSON.parse(match[1]);
            return configData.pids || [];
          } catch (e) {
            return [];
          }
        }
        return [];
      })
    );
  }

  createSerialPort(factoryPid: string, config: any): Observable<any> {
    const url = `/system/console/configMgr/${factoryPid}`;
    const body = new URLSearchParams();
    for (const key in config) {
      if (Object.prototype.hasOwnProperty.call(config, key)) {
        body.set(key, config[key]);
      }
    }
    const headers = new HttpHeaders({'Content-Type': 'application/x-www-form-urlencoded'});
    return this.http.post(url, body.toString(), {headers, responseType: 'text'});
  }

  createInverter(factoryPid: string, config: any): Observable<any> {
    const url = `/system/console/configMgr/${factoryPid}`;
    const body = new URLSearchParams();
    for (const key in config) {
      if (Object.prototype.hasOwnProperty.call(config, key)) {
        const value = config[key];
        const finalValue = Array.isArray(value) ? value.join(',') : String(value);
        body.set(key, finalValue);
      }
    }
    const headers = new HttpHeaders({'Content-Type': 'application/x-www-form-urlencoded'});
    return this.http.post(url, body.toString(), {headers, responseType: 'text'});
  }

  updateSerialPortConfigFelix(fullPidPath: string, config: any): Observable<any> {
    const body = new URLSearchParams();
    Object.entries(config).forEach(([key, value]) => {
      body.set(key, value !== null && value !== undefined ? String(value) : '');
    });
    const headers = new HttpHeaders({'Content-Type': 'application/x-www-form-urlencoded'});
    return this.http.post(fullPidPath, body.toString(), {headers, responseType: 'text'});
  }

  deleteSerialPort(fullPidPath: string): Observable<any> {
    const body = new URLSearchParams();
    body.set('apply', 'true');
    body.set('delete', 'true');
    const headers = new HttpHeaders({'Content-Type': 'application/x-www-form-urlencoded'});
    return this.http.post(fullPidPath, body.toString(), {headers, responseType: 'text'});
  }

  getComponentDetails(pid: string): Observable<any> {
    const url = `/system/console/configMgr/${pid}.json`;
    return this.http.get(url);
  }

  updateController(pid: string, config: any): Observable<any> {
    const fullPidPath = `/system/console/configMgr/${pid}`;
    let body = new URLSearchParams();
    for (const key in config) {
      if (Object.prototype.hasOwnProperty.call(config, key)) {
        const value = config[key];
        if (key === 'enabled' && value === true) {
          body.append('enabled', 'true');
          body.append('enabled', 'false');
        } else {
          const finalValue = Array.isArray(value) ? value.join(',') : value;
          body.set(key, finalValue !== null && finalValue !== undefined ? String(finalValue) : '');
        }
      }
    }
    const headers = new HttpHeaders({'Content-Type': 'application/x-www-form-urlencoded'});
    return this.http.post(fullPidPath, body.toString(), {headers, responseType: 'text'});
  }

  createConfigComponent(pid: string, config: any): Observable<any> {
    const fullPidPath = `/system/console/configMgr/${pid}`;
    const body = new URLSearchParams();
    body.set('apply', 'true');
    body.set('propertylist', Object.keys(config).join(','));
    for (const key in config) {
      if (Object.prototype.hasOwnProperty.call(config, key)) {
        body.set(key, String(config[key]));
      }
    }
    const headers = new HttpHeaders({'Content-Type': 'application/x-www-form-urlencoded'});
    return this.http.post(fullPidPath, body.toString(), {headers, responseType: 'text'});
  }

  updateConfigComponent(pid: string, config: any): Observable<any> {
    const fullPidPath = `/system/console/configMgr/${pid}`;
    const body = new URLSearchParams();
    body.set('apply', 'true');

    const propertyList = [];
    for (const key in config) {
      if (Object.prototype.hasOwnProperty.call(config, key)) {
        body.set(`${key}.value`, String(config[key]));
        propertyList.push(key);
      }
    }
    body.set('propertylist', propertyList.join(','));

    const headers = new HttpHeaders({'Content-Type': 'application/x-www-form-urlencoded'});
    return this.http.post(fullPidPath, body.toString(), {headers, responseType: 'text'});
  }

  createUserConfigComponent(factoryPid: string, config: any): Observable<any> {
    const url = `/system/console/configMgr/${factoryPid}`;
    const body = new URLSearchParams();
    for (const key in config) {
      if (Object.prototype.hasOwnProperty.call(config, key)) {
        body.set(key, String(config[key]));
      }
    }
    const headers = new HttpHeaders({'Content-Type': 'application/x-www-form-urlencoded'});
    return this.http.post(url, body.toString(), {headers, responseType: 'text'});
  }

  // ====================================================================
  // PHẦN 3: Giao tiếp HTTP với API Network (Phần mới được thêm vào)
  // ====================================================================

  /**
   * Lấy danh sách cấu hình mạng từ backend Python.
   */
  getNetworkConfigs(): Observable<NetworkConfig[]> {
    const url = `${this.networkApiUrl}/api/network-config`;
    return this.http.get<NetworkConfig[]>(url);
  }

  /**
   * Cập nhật cấu hình mạng cho một interface cụ thể.
   * @param ifaceName Tên interface (ví dụ: 'enp2s0')
   * @param config Dữ liệu cấu hình mới
   */
  setNetworkConfig(ifaceName: string, config: Partial<NetworkConfig>): Observable<NetworkConfig> {
    const url = `${this.networkApiUrl}/api/network-config/${ifaceName}`;
    return this.http.post<NetworkConfig>(url, config);
  }

  getIpsecConnections(): Observable<any[]> {
    // Thay thế URL bằng địa chỉ API thật của bạn
    return this.http.get<any[]>('http://192.168.4.93:5001/api/connections');
  }

  createIpsecConnection(connection: any): Observable<any> {
    return this.http.post<any>('http://192.168.4.93:5001/api/connections', connection);
  }

  updateIpsecConnection(connId: string, connection: any): Observable<any> {
    return this.http.put<any>(`http://192.168.4.93:5001/api/connections/${connId}`, connection);
  }

  deleteIpsecConnection(connId: string): Observable<any> {
    return this.http.delete<any>(`http://192.168.4.93:5001/api/connections/${connId}`);
  }

  getCertificates(): Observable<any[]> {
    return this.http.get<any[]>('http://192.168.4.93:5001/api/certificates');
  }

  uploadCertificate(formData: FormData): Observable<any> {
    // API endpoint này phải khớp với endpoint trong file Python của bạn
    return this.http.post<any>('http://192.168.4.93:5001/api/certificates/upload', formData);
  }
}
