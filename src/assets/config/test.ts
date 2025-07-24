// ngOnInit(): void {
//   this.addForm = this.fb.group({
//     template: [null, Validators.required],
//     baudRate: ['9600', Validators.required],
//     databits: ['8', Validators.required],
//     stopbits: ['ONE', Validators.required],
//     parity: ['NONE', Validators.required]
//   });
//   this.editForm = this.fb.group({
//     baudRate: ['', Validators.required],
//     databits: ['', Validators.required],
//     stopbits: ['', Validators.required],
//     parity: ['', Validators.required]
//   });
//
//   console.log("Bắt đầu lắng nghe trực tiếp từ StateService...");
//
//   this.stateSubscription = this.stateService.components$
//     .subscribe(allComponents => {
//       console.log("StateService vừa gửi dữ liệu:", allComponents);
//
//       if (allComponents) {
//         this.ports = Object.entries(allComponents)
//           .filter(([id, config]: [string, any]) => config.factoryId === this.FACTORY_PID)
//           .map(([id, config]: [string, any]) => {
//             const props = config.properties || {};
//             return {
//               key: props.alias,
//               pid: id,
//               // Tạm thời dùng alias làm displayName vì chúng ta không có portTemplates
//               displayName: props.alias,
//               portName: props.portName,
//               baudRate: props.baudRate,
//               databits: props.databits,
//               stopbits: props.stopbits,
//               parity: props.parity,
//             };
//           })
//           .sort((a, b) => a.key.localeCompare(b.key));
//
//         console.log("Mảng ports sau khi xử lý:", this.ports);
//       } else {
//         this.ports = [];
//       }
//     });
//   // this.stateSubscription = this.http.get<any>('assets/config/app-config.json')
//   //   .pipe(
//   //     map(config => config.serialPortTemplates || []),
//   //     tap(templates => this.portTemplates = templates),
//   //     switchMap(() => this.stateService.components$)
//   //   )
//   //   .subscribe(allComponents => {
//   //     if (allComponents) {
//   //       // SỬA LỖI QUAN TRỌNG: Dùng Object.entries để đọc đúng ID và cấu hình của port
//   //       this.ports = Object.entries(allComponents)
//   //         .filter(([id, config]: [string, any]) => {
//   //           // Lọc ra những component có factoryId là 'Bridge.Modbus.Serial'
//   //           return config.factoryId === this.FACTORY_PID;
//   //         })
//   //         .map(([id, config]: [string, any]) => {
//   //           // Lấy các thuộc tính từ object 'config.properties'
//   //           const props = config.properties || {};
//   //           return {
//   //             key: props.alias,
//   //             pid: id, // id chính là key của entry, ví dụ "modbus0"
//   //             displayName: this.portTemplates.find(t => t.key === props.alias)?.displayName || props.alias,
//   //             portName: props.portName,
//   //             baudRate: props.baudRate,
//   //             databits: props.databits,
//   //             stopbits: props.stopbits,
//   //             parity: props.parity,
//   //           };
//   //         })
//   //         .sort((a, b) => a.key.localeCompare(b.key));
//   //     } else {
//   //       this.ports = []; // Đảm bảo bảng trống nếu không có dữ liệu
//   //     }
//   //   });
// }
