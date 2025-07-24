import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IpsecComponent } from './ipsec.component';

describe('IpsecComponent', () => {
  let component: IpsecComponent;
  let fixture: ComponentFixture<IpsecComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IpsecComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IpsecComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
