import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SerialConfigurationComponent } from './serial-configuration.component';

describe('SerialConfigurationComponent', () => {
  let component: SerialConfigurationComponent;
  let fixture: ComponentFixture<SerialConfigurationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SerialConfigurationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SerialConfigurationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
