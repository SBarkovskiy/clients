import { NgModule } from "@angular/core";

import { SecretsManagerSharedModule } from "../shared/sm-shared.module";

import { AccessListComponent } from "./access/access-list.component";
import { AccessTokenComponent } from "./access/access-tokens.component";
import { ServiceAccountDialogComponent } from "./dialog/service-account-dialog.component";
import { ServiceAccountComponent } from "./service-account.component";
import { ServiceAccountsListComponent } from "./service-accounts-list.component";
import { ServiceAccountsRoutingModule } from "./service-accounts-routing.module";
import { ServiceAccountsComponent } from "./service-accounts.component";

@NgModule({
  imports: [SecretsManagerSharedModule, ServiceAccountsRoutingModule],
  declarations: [
    AccessListComponent,
    AccessTokenComponent,
    ServiceAccountComponent,
    ServiceAccountDialogComponent,
    ServiceAccountsComponent,
    ServiceAccountsListComponent,
  ],
  providers: [],
})
export class ServiceAccountsModule {}
