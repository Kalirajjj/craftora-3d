import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { AdminComponent } from './pages/admin/admin.component';
import { customerGuard } from './guards/customer.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent) },
  { path: 'shop', loadComponent: () => import('./pages/shop/shop.component').then(m => m.ShopComponent) },
  { path: 'product/:id', loadComponent: () => import('./pages/product-details/product-details.component').then(m => m.ProductDetailsComponent) },
  { path: 'custom-order', loadComponent: () => import('./pages/custom-order/custom-order.component').then(m => m.CustomOrderComponent) },
  { path: 'track-quote', loadComponent: () => import('./pages/track-quote/track-quote.component').then(m => m.TrackQuoteComponent) },
  { path: 'account/:mode', loadComponent: () => import('./pages/account/account-access.component').then(m => m.AccountAccessComponent) },
  { path: 'account', canActivate: [customerGuard], loadComponent: () => import('./pages/account/customer-account.component').then(m => m.CustomerAccountComponent) },
  { path: 'about', loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent) },
  { path: 'contact', loadComponent: () => import('./pages/contact/contact.component').then(m => m.ContactComponent) },
  { path: 'cart', loadComponent: () => import('./pages/cart/cart.component').then(m => m.CartComponent) },
  { path: 'checkout', loadComponent: () => import('./pages/checkout/checkout.component').then(m => m.CheckoutComponent) },
  { path: 'admin/login', loadComponent: () => import('./pages/admin/auth/login/admin-login.component').then(m => m.AdminLoginComponent) },
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent) },
      { path: 'products/new', loadComponent: () => import('./pages/admin/products/create/admin-product-create.component').then(m => m.AdminProductCreateComponent) },
      { path: 'products/:id/edit', loadComponent: () => import('./pages/admin/products/create/admin-product-create.component').then(m => m.AdminProductCreateComponent) },
      { path: 'products', loadComponent: () => import('./pages/admin/products/list/admin-product-list.component').then(m => m.AdminProductListComponent) },
      { path: 'requests', loadComponent: () => import('./pages/admin/requests/admin-requests.component').then(m => m.AdminRequestsComponent) },
      { path: 'users/new', loadComponent: () => import('./pages/admin/users/create/admin-user-create.component').then(m => m.AdminUserCreateComponent) }
    ]
  },
  { path: '**', redirectTo: '' }
];
