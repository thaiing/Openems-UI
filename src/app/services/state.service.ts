import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {ApiService} from './api.service';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private componentsState = new BehaviorSubject<any>(null);
  public components$ = this.componentsState.asObservable();

  constructor(private apiService: ApiService) {
    this.init();
  }

  private init(): void {
    console.log('StateService đã khởi tạo và bắt đầu lắng nghe ApiService.messages$');

    this.apiService.messages$.subscribe(message => {
      // LOG QUAN TRỌNG NHẤT: Kiểm tra xem có nhận được tin nhắn thô từ WebSocket không
      console.log('%c[StateService] ĐÃ NHẬN ĐƯỢC TIN NHẮN THÔ:', 'color: blue; font-weight: bold;', message);

      const componentsFromRpcResult = message.result?.payload?.result?.components;
      const componentsFromBroadcast = message.params?.payload?.params?.components;

      const components = componentsFromRpcResult || componentsFromBroadcast;

      if (components) {
        console.log('%c[StateService] TÌM THẤY DỮ LIỆU components. SẼ GỬI ĐI...', 'color: green; font-weight: bold;', components);
        this.componentsState.next(components);
      } else {
        console.warn('[StateService] Không tìm thấy dữ liệu "components" trong tin nhắn.');
      }
    });
  }

  public refreshState(): void {
    console.log('[StateService] Đang yêu cầu làm mới trạng thái...');
    this.apiService.getEdgeConfig().subscribe();
  }
}
