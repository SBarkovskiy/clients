import { BehaviorSubject, firstValueFrom, map, Observable } from "rxjs";
import { Jsonify } from "type-fest";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { KdfConfigService } from "@bitwarden/common/auth/abstractions/kdf-config.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { PasswordTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/password-token.request";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { IdentityCaptchaResponse } from "@bitwarden/common/auth/models/response/identity-captcha.response";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "@bitwarden/common/auth/models/response/identity-two-factor.response";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey } from "@bitwarden/common/types/key";

import { LoginStrategyServiceAbstraction } from "../abstractions";
import { InternalUserDecryptionOptionsServiceAbstraction } from "../abstractions/user-decryption-options.service.abstraction";
import { PasswordLoginCredentials } from "../models/domain/login-credentials";
import { CacheData } from "../services/login-strategies/login-strategy.state";

import { LoginStrategy, LoginStrategyData } from "./login.strategy";

export class PasswordLoginStrategyData implements LoginStrategyData {
  tokenRequest: PasswordTokenRequest;

  /** User's entered email obtained pre-login. Always present in MP login. */
  userEnteredEmail: string;
  /** If 2fa is required, token is returned to bypass captcha */
  captchaBypassToken?: string;
  /** The local version of the user's master key hash */
  localMasterKeyHash: string;
  /** The user's master key */
  masterKey: MasterKey;
  /**
   * Tracks if the user needs to update their password due to
   * a password that does not meet an organization's master password policy.
   */
  forcePasswordResetReason: ForceSetPasswordReason = ForceSetPasswordReason.None;

  static fromJSON(obj: Jsonify<PasswordLoginStrategyData>): PasswordLoginStrategyData {
    const data = Object.assign(new PasswordLoginStrategyData(), obj, {
      tokenRequest: PasswordTokenRequest.fromJSON(obj.tokenRequest),
      masterKey: SymmetricCryptoKey.fromJSON(obj.masterKey),
    });
    return data;
  }
}

export class PasswordLoginStrategy extends LoginStrategy {
  /** The email address of the user attempting to log in. */
  email$: Observable<string>;
  /** The master key hash used for authentication */
  serverMasterKeyHash$: Observable<string>;
  /** The local master key hash we store client side */
  localMasterKeyHash$: Observable<string | null>;

  protected cache: BehaviorSubject<PasswordLoginStrategyData>;

  constructor(
    data: PasswordLoginStrategyData,
    accountService: AccountService,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    cryptoService: CryptoService,
    apiService: ApiService,
    tokenService: TokenService,
    appIdService: AppIdService,
    platformUtilsService: PlatformUtilsService,
    messagingService: MessagingService,
    logService: LogService,
    protected stateService: StateService,
    twoFactorService: TwoFactorService,
    userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
    private passwordStrengthService: PasswordStrengthServiceAbstraction,
    private policyService: PolicyService,
    private loginStrategyService: LoginStrategyServiceAbstraction,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    kdfConfigService: KdfConfigService,
  ) {
    super(
      accountService,
      masterPasswordService,
      cryptoService,
      apiService,
      tokenService,
      appIdService,
      platformUtilsService,
      messagingService,
      logService,
      stateService,
      twoFactorService,
      userDecryptionOptionsService,
      billingAccountProfileStateService,
      kdfConfigService,
    );

    this.cache = new BehaviorSubject(data);
    this.email$ = this.cache.pipe(map((state) => state.tokenRequest.email));
    this.serverMasterKeyHash$ = this.cache.pipe(
      map((state) => state.tokenRequest.masterPasswordHash),
    );
    this.localMasterKeyHash$ = this.cache.pipe(map((state) => state.localMasterKeyHash));
  }

  override async logIn(credentials: PasswordLoginCredentials) {
    const { email, masterPassword, captchaToken, twoFactor } = credentials;

    const data = new PasswordLoginStrategyData();
    data.masterKey = await this.loginStrategyService.makePreloginKey(masterPassword, email);
    data.userEnteredEmail = email;

    // Hash the password early (before authentication) so we don't persist it in memory in plaintext
    data.localMasterKeyHash = await this.cryptoService.hashMasterKey(
      masterPassword,
      data.masterKey,
      HashPurpose.LocalAuthorization,
    );
    const serverMasterKeyHash = await this.cryptoService.hashMasterKey(
      masterPassword,
      data.masterKey,
    );

    data.tokenRequest = new PasswordTokenRequest(
      email,
      serverMasterKeyHash,
      captchaToken,
      await this.buildTwoFactor(twoFactor, email),
      await this.buildDeviceRequest(),
    );

    this.cache.next(data);

    const [authResult, identityResponse] = await this.startLogIn();

    if (identityResponse instanceof IdentityCaptchaResponse) {
      return authResult;
    }

    const masterPasswordPolicyOptions =
      this.getMasterPasswordPolicyOptionsFromResponse(identityResponse);

    // The identity result can contain master password policies for the user's organizations
    if (masterPasswordPolicyOptions?.enforceOnLogin) {
      // If there is a policy active, evaluate the supplied password before its no longer in memory
      const meetsRequirements = this.evaluateMasterPassword(
        credentials,
        masterPasswordPolicyOptions,
      );
      if (meetsRequirements) {
        return authResult;
      }

      if (identityResponse instanceof IdentityTwoFactorResponse) {
        // Save the flag to this strategy for use in 2fa login as the master password is about to pass out of scope
        this.cache.next({
          ...this.cache.value,
          forcePasswordResetReason: ForceSetPasswordReason.WeakMasterPassword,
        });
      } else {
        // Authentication was successful, save the force update password options with the state service
        await this.masterPasswordService.setForceSetPasswordReason(
          ForceSetPasswordReason.WeakMasterPassword,
          authResult.userId, // userId is only available on successful login
        );
        authResult.forcePasswordReset = ForceSetPasswordReason.WeakMasterPassword;
      }
    }
    return authResult;
  }

  override async logInTwoFactor(
    twoFactor: TokenTwoFactorRequest,
    captchaResponse: string,
  ): Promise<AuthResult> {
    const data = this.cache.value;
    data.tokenRequest.captchaResponse = captchaResponse ?? data.captchaBypassToken;
    this.cache.next(data);

    const result = await super.logInTwoFactor(twoFactor);

    // 2FA was successful, save the force update password options with the state service if defined
    const forcePasswordResetReason = this.cache.value.forcePasswordResetReason;
    if (
      !result.requiresTwoFactor &&
      !result.requiresCaptcha &&
      forcePasswordResetReason != ForceSetPasswordReason.None
    ) {
      await this.masterPasswordService.setForceSetPasswordReason(
        forcePasswordResetReason,
        result.userId,
      );
      result.forcePasswordReset = forcePasswordResetReason;
    }

    return result;
  }

  protected override async setMasterKey(response: IdentityTokenResponse, userId: UserId) {
    const { masterKey, localMasterKeyHash } = this.cache.value;
    await this.masterPasswordService.setMasterKey(masterKey, userId);
    await this.masterPasswordService.setMasterKeyHash(localMasterKeyHash, userId);
  }

  protected override async setUserKey(
    response: IdentityTokenResponse,
    userId: UserId,
  ): Promise<void> {
    // If migration is required, we won't have a user key to set yet.
    if (this.encryptionKeyMigrationRequired(response)) {
      return;
    }
    await this.cryptoService.setMasterKeyEncryptedUserKey(response.key, userId);

    const masterKey = await firstValueFrom(this.masterPasswordService.masterKey$(userId));
    if (masterKey) {
      const userKey = await this.cryptoService.decryptUserKeyWithMasterKey(masterKey);
      await this.cryptoService.setUserKey(userKey, userId);
    }
  }

  protected override async setPrivateKey(response: IdentityTokenResponse): Promise<void> {
    await this.cryptoService.setPrivateKey(
      response.privateKey ?? (await this.createKeyPairForOldAccount()),
    );
  }

  protected override encryptionKeyMigrationRequired(response: IdentityTokenResponse): boolean {
    return !response.key;
  }

  private getMasterPasswordPolicyOptionsFromResponse(
    response: IdentityTokenResponse | IdentityTwoFactorResponse,
  ): MasterPasswordPolicyOptions {
    if (response == null) {
      return null;
    }
    return MasterPasswordPolicyOptions.fromResponse(response.masterPasswordPolicy);
  }

  private evaluateMasterPassword(
    { masterPassword, email }: PasswordLoginCredentials,
    options: MasterPasswordPolicyOptions,
  ): boolean {
    const passwordStrength = this.passwordStrengthService.getPasswordStrength(
      masterPassword,
      email,
    )?.score;

    return this.policyService.evaluateMasterPassword(passwordStrength, masterPassword, options);
  }

  exportCache(): CacheData {
    return {
      password: this.cache.value,
    };
  }
}
