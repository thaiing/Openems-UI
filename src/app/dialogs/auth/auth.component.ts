import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';

// Import các module của Material
import {MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatTabsModule} from '@angular/material/tabs';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

// Custom validator để kiểm tra mật khẩu trùng khớp
export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : {passwordMismatch: true};
}

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule, MatTabsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule
  ],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent implements OnInit {
  loginForm!: FormGroup;
  signupForm!: FormGroup;
  hidePassword = true;
  hideConfirmPassword = true;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AuthComponent>
  ) {
  }

  ngOnInit(): void {
    // Form đăng nhập
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    // Form đăng ký
    this.signupForm = this.fb.group({
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, {validators: passwordMatchValidator}); // Áp dụng custom validator
  }

  onLoginSubmit(): void {
    if (this.loginForm.valid) {
      console.log('Login form submitted:', this.loginForm.value);
      this.dialogRef.close(); // Đóng dialog sau khi submit
    }
  }

  onSignupSubmit(): void {
    if (this.signupForm.valid) {
      console.log('Signup form submitted:', this.signupForm.value);
      this.dialogRef.close();
    }
  }
}
