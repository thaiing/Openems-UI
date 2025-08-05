import {Component, Input, Output, EventEmitter} from '@angular/core';
import {CommonModule, TitleCasePipe} from '@angular/common';
import {MatTableModule} from '@angular/material/table';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatChipsModule} from '@angular/material/chips';

@Component({
  selector: 'app-ipsec-connection-list',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatButtonModule, MatIconModule, MatChipsModule],
  templateUrl: './ipsec-connection-list.component.html',
  styleUrls: ['./ipsec-connection-list.component.scss']
})
export class IpsecConnectionListComponent {
  @Input() connections: any[] = [];
  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<any>();

  displayedColumns: string[] = ['state', 'name', 'server', 'auth_type', 'conn_type', 'actions'];
}
