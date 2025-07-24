import {Injectable, Inject, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {webSocket, WebSocketSubject} from 'rxjs/webSocket';
import {Observable, Subject, tap, catchError, EMPTY, map, filter, retry, timer, firstValueFrom} from 'rxjs';
import {v4 as uuidv4} from 'uuid';
import {HttpClient, HttpHeaders} from '@angular/common/http';

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

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private socket$!: WebSocketSubject<any>;
  private messageSubject = new Subject<JsonRpcResponse>();
  public messages$ = this.messageSubject.asObservable();
  private isConnected = false;
  private edgeId = '0';

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.connect();
    }
  }

  // ---------- WEBSOCKET JSON-RPC (giữ nguyên) ----------
  private connect(): void {
    this.socket$ = webSocket({
      url: '/jsonrpc',
      deserializer: (e) => JSON.parse(e.data),
      serializer: (value) => JSON.stringify(value),
      openObserver: {
        next: () => {
          console.log('WebSocket connection established');
          this.isConnected = true;
          this.authenticate();
        }
      }
    });

    this.socket$.pipe(
      retry({delay: () => timer(5000)}),
      tap(message => console.log('WebSocket Received:', message)),
      catchError(error => {
        console.error('WebSocket Error:', error);
        return EMPTY;
      })
    ).subscribe(message => this.messageSubject.next(message));
  }

  private async authenticate(): Promise<void> {
    try {
      const result = await firstValueFrom(this.rpc('authenticateWithPassword', {
        username: 'admin',
        password: 'admin'
      }));
      console.log('Authentication successful:', result);
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
      params: {
        edgeId: this.edgeId,
        payload: {
          jsonrpc: '2.0',
          id: innerId,
          method: 'getEdgeConfig',
          params: {}
        }
      }
    };
    return this.rpc(request.method, request.params);
  }

  public updateConfig(componentId: string, properties: any): Observable<any> {
    const innerId = uuidv4();
    const request = {
      method: 'edgeRpc',
      params: {
        edgeId: this.edgeId,
        payload: {
          jsonrpc: '2.0',
          id: innerId,
          method: 'updateComponentConfig',
          params: {componentId, properties}
        }
      }
    };
    return this.rpc(request.method, request.params);
  }


  // ---------- HTTP POST LƯU SERIAL PORT (Felix - 8080) ----------
  /**
   * Lưu cấu hình Serial Port qua HTTP Felix Console (cổng 8080)
   * Sử dụng cho nút "Save" trên trang cấu hình Serial Port
   */
  /**
   * MỚI: Tạo một Serial Port mới từ Factory.
   * @param factoryPid PID của Factory, ví dụ: 'Bridge.Modbus.Serial'.
   * @param config Các thuộc tính cho port mới, quan trọng nhất là 'alias'.
   */
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

  /**
   * Cập nhật cấu hình Serial Port đã có.
   * @param fullPidPath Đường dẫn đầy đủ đến PID của component.
   * @param config Các thuộc tính cần cập nhật (KHÔNG chứa factoryPid).
   */
  updateSerialPortConfigFelix(fullPidPath: string, config: any): Observable<any> {
    const body = new URLSearchParams();
    Object.entries(config).forEach(([key, value]) => {
      body.set(key, value !== null && value !== undefined ? String(value) : '');
    });
    const headers = new HttpHeaders({'Content-Type': 'application/x-www-form-urlencoded'});
    return this.http.post(fullPidPath, body.toString(), {headers, responseType: 'text'});
  }

  /**
   * Xóa một Serial Port đã có.
   * @param fullPidPath Đường dẫn đầy đủ của PID cần xóa.
   */
  deleteSerialPort(fullPidPath: string): Observable<any> {
    const body = new URLSearchParams();
    body.set('apply', 'true');
    body.set('delete', 'true');
    const headers = new HttpHeaders({'Content-Type': 'application/x-www-form-urlencoded'});
    return this.http.post(fullPidPath, body.toString(), {headers, responseType: 'text'});
  }
}
