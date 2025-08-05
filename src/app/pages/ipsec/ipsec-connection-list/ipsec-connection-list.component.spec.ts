import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IpsecConnectionListComponent } from './ipsec-connection-list.component';

describe('IpsecConnectionListComponent', () => {
  let component: IpsecConnectionListComponent;
  let fixture: ComponentFixture<IpsecConnectionListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IpsecConnectionListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IpsecConnectionListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
