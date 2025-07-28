import {Injectable} from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  constructor(private snackBar: MatSnackBar) {
  }

  private openSnackBar(message: string, panelClass: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3500,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['custom-snackbar', panelClass]
    });
  }

  showSuccess(message: string): void {
    this.openSnackBar(message, 'success-snackbar');
  }

  showError(message: string): void {
    this.openSnackBar(message, 'error-snackbar');
  }

  // BỔ SUNG CẢNH BÁO "WARNING"
  showWarning(message: string): void {
    this.openSnackBar(message, 'warning-snackbar');
  }
}
