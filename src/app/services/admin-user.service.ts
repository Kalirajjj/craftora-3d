import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminAuthService } from './admin-auth.service';
import { AppConfigService } from './app-config.service';

export interface AdminUserItem {
  id: number;
  username: string;
  role: string;
  password?: string;
  enabled: boolean;
}

export type CreatedAdminUser = AdminUserItem;

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private http = inject(HttpClient);
  private auth = inject(AdminAuthService);
  private config = inject(AppConfigService);
  private get baseUrl(): string {
    return `${this.config.apiGatewayUrl}/api/admin/users`;
  }

  getAll(): Observable<AdminUserItem[]> {
    return this.http.get<AdminUserItem[]>(this.baseUrl, {
      headers: this.auth.authorizationHeaders()
    });
  }

  create(username: string, password: string): Observable<AdminUserItem> {
    return this.http.post<AdminUserItem>(
      this.baseUrl,
      { username, password },
      { headers: this.auth.authorizationHeaders() }
    );
  }

  update(id: number, username: string, password?: string): Observable<AdminUserItem> {
    return this.http.put<AdminUserItem>(
      `${this.baseUrl}/${id}`,
      { username, password: password || '' },
      { headers: this.auth.authorizationHeaders() }
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, {
      headers: this.auth.authorizationHeaders()
    });
  }
}
