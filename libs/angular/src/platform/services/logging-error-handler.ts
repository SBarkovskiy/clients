import { ErrorHandler, Injectable, Injector, inject } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

@Injectable()
export class LoggingErrorHandler extends ErrorHandler {
  /**
   * When injecting services into an `ErrorHandler`, we must use the `Injector` manually to avoid circular dependency errors.
   *
   * https://stackoverflow.com/a/57115053
   */
  private injector = inject(Injector);

  override handleError(error: any): void {
    try {
      const logService = this.injector.get(LogService, null);
      logService.error(error);
    } catch {
      super.handleError(error);
    }
  }
}
