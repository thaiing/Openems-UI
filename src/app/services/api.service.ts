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

  // HÀM QUAN TRỌNG ĐỂ LẤY PID DÀI
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
}
