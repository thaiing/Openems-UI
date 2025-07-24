import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PoiMeterComponent } from './poi-meter.component';

describe('PoiMeterComponent', () => {
  let component: PoiMeterComponent;
  let fixture: ComponentFixture<PoiMeterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoiMeterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PoiMeterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
