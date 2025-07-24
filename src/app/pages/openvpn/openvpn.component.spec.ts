import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OpenvpnComponent } from './openvpn.component';

describe('OpenvpnComponent', () => {
  let component: OpenvpnComponent;
  let fixture: ComponentFixture<OpenvpnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OpenvpnComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OpenvpnComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
