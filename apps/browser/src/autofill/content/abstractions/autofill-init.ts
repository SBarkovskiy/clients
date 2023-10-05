import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import AutofillScript from "../../models/autofill-script";

type AutofillExtensionMessage = {
  command: string;
  tab?: chrome.tabs.Tab;
  sender?: string;
  fillScript?: AutofillScript;
  ciphers?: any;
  data?: {
    authStatus?: AuthenticationStatus;
    isFocusingFieldElement?: boolean;
    isOverlayCiphersPopulated?: boolean;
    direction?: "previous" | "next";
    isOpeningFullOverlay?: boolean;
  };
};

type AutofillExtensionMessageParam = { message: AutofillExtensionMessage };

type AutofillExtensionMessageHandlers = {
  [key: string]: CallableFunction;
  collectPageDetails: ({ message }: AutofillExtensionMessageParam) => void;
  collectPageDetailsImmediately: ({ message }: AutofillExtensionMessageParam) => void;
  fillForm: ({ message }: AutofillExtensionMessageParam) => void;
  openAutofillOverlay: ({ message }: AutofillExtensionMessageParam) => void;
  closeAutofillOverlay: () => void;
  redirectOverlayFocusOut: ({ message }: AutofillExtensionMessageParam) => void;
  bgUnlockPopoutOpened: () => void;
};

interface AutofillInit {
  init(): void;
}

export { AutofillExtensionMessage, AutofillExtensionMessageHandlers, AutofillInit };
