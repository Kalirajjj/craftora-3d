import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { CustomerAuthService } from './services/customer-auth.service';
import { CartService } from './services/cart.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  private readonly customerAuth = inject(CustomerAuthService);
  private readonly cart = inject(CartService);
  ngOnInit(): void { if (this.customerAuth.isSignedIn()) this.cart.loadSavedCart(); }
}
