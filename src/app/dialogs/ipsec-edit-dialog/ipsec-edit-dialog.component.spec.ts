import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IpsecEditDialogComponent } from './ipsec-edit-dialog.component';

describe('IpsecEditDialogComponent', () => {
  let component: IpsecEditDialogComponent;
  let fixture: ComponentFixture<IpsecEditDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IpsecEditDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IpsecEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
