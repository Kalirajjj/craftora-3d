import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminAuthService } from './admin-auth.service';

export interface CreatedAdminUser {
  id: number;
  username: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private http = inject(HttpClient);
  private auth = inject(AdminAuthService);

  create(username: string, password: string): Observable<CreatedAdminUser> {
    return this.http.post<CreatedAdminUser>(
      'http://localhost:8080/api/admin/users',
      { username, password },
      { headers: this.auth.authorizationHeaders() }
    );
  }
}
