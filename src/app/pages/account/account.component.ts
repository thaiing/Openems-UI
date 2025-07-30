import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {AuthService} from '../../services/auth.service';
import {NotificationService} from '../../services/notification.service';

// Custom validator để kiểm tra mật khẩu trùng khớp
export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : {passwordMismatch: true};
}

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatIconModule
  ],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss']
})
export class AccountComponent implements OnInit {
  passwordForm!: FormGroup;
  hideOldPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {
  }

  ngOnInit(): void {
    this.passwordForm = this.fb.group({
      oldPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, {validators: passwordMatchValidator});
  }

  async onChangePassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      return;
    }
    const {oldPassword, newPassword} = this.passwordForm.value;

    try {
      const success = await this.authService.changePassword(oldPassword, newPassword);
      if (success) {
        this.passwordForm.reset();
        setTimeout(() => this.authService.logout(), 2000);
      }
    } catch (error) {
      console.error(error);
    }
  }
}
