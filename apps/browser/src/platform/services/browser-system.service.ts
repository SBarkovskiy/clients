import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { ClearClipboardDelay } from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { BiometricStateService } from "@bitwarden/common/platform/biometrics/biometric-state.service";
import { SystemService } from "@bitwarden/common/platform/services/system.service";

import { AlarmsManagerService } from "../browser/abstractions/alarms-manager.service";

export class BrowserSystemService extends SystemService {
  private clearClipboardAlarmName = "browser-system-clear-clipboard-alarm";

  constructor(
    messagingService: MessagingService,
    platformUtilsService: PlatformUtilsService,
    reloadCallback: () => Promise<void> = null,
    stateService: StateService,
    autofillSettingsService: AutofillSettingsServiceAbstraction,
    vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    biometricStateService: BiometricStateService,
    private alarmsManagerService: AlarmsManagerService,
  ) {
    super(
      messagingService,
      platformUtilsService,
      reloadCallback,
      stateService,
      autofillSettingsService,
      vaultTimeoutSettingsService,
      biometricStateService,
    );
  }

  protected resetClearClipboardTimeout() {
    super.resetClearClipboardTimeout();
    void this.alarmsManagerService.clearAlarm(this.clearClipboardAlarmName);
  }

  protected setupClearClipboardTimeout(timeoutInSeconds: number) {
    if (timeoutInSeconds < ClearClipboardDelay.OneMinute) {
      super.setupClearClipboardTimeout(timeoutInSeconds);
      return;
    }

    void this.alarmsManagerService.setTimeoutAlarm(
      this.clearClipboardAlarmName,
      () => this.clearClipboardTimeoutFunction(),
      timeoutInSeconds / 60,
    );
  }
}
