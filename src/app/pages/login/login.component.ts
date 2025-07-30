import {Component} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {AuthService} from '../../services/auth.service';
import {NotificationService} from '../../services/notification.service';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, MatCardModule, MatFormFieldModule,
        MatInputModule, MatButtonModule, MatIconModule
    ],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})
export class LoginComponent {
    loginForm: FormGroup;
    hidePassword = true;

    constructor(
        private fb: FormBuilder,
        private authService: AuthService
    ) {
        this.loginForm = this.fb.group({
            username: ['admin', Validators.required],
            password: ['', Validators.required]
        });
    }

    async onLogin(): Promise<void> {
        if (this.loginForm.invalid) {
            return;
        }
        await this.authService.login(this.loginForm.getRawValue());
    }
}
