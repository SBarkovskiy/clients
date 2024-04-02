import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { Input, HostBinding, Component } from "@angular/core";

import { ButtonLikeAbstraction, ButtonType } from "../shared/button-like.abstraction";

const focusRing = [
  "focus-visible:tw-ring",
  "focus-visible:tw-ring-offset-2",
  "focus-visible:tw-ring-primary-700",
  "focus-visible:tw-z-10",
];

const buttonStyles: Record<ButtonType, string[]> = {
  primary: [
    "tw-border-primary-500",
    "tw-bg-primary-500",
    "!tw-text-contrast",
    "hover:tw-bg-primary-300",
    "hover:tw-border-primary-300",
    "disabled:tw-bg-secondary-500",
    "disabled:tw-border-secondary-500",
    "disabled:!tw-text-main/60",
    // this was causing a real tiny gap between the bg and border at this border radius
    // "disabled:tw-bg-clip-padding",
    "disabled:tw-cursor-not-allowed",
    ...focusRing,
  ],
  secondary: [
    "tw-bg-transparent",
    "tw-border-primary-700",
    "!tw-text-primary-700",
    "hover:tw-bg-transparent",
    "hover:tw-border-primary-300",
    "hover:!tw-text-primary-300",
    "disabled:tw-bg-secondary-500",
    "disabled:tw-border-secondary-500",
    "disabled:!tw-text-main/60",
    "disabled:tw-cursor-not-allowed",
    ...focusRing,
  ],
  danger: [
    "tw-bg-transparent",
    "tw-border-danger-500",
    "!tw-text-danger",
    "hover:tw-border-danger-700",
    "hover:!tw-text-danger-700",
    "disabled:tw-bg-secondary-500",
    "disabled:tw-border-secondary-500",
    "disabled:!tw-text-main/60",
    "disabled:tw-cursor-not-allowed",
    ...focusRing,
  ],
  unstyled: [],
};

@Component({
  selector: "button[bitButton], a[bitButton]",
  templateUrl: "button.component.html",
  providers: [{ provide: ButtonLikeAbstraction, useExisting: ButtonComponent }],
})
export class ButtonComponent implements ButtonLikeAbstraction {
  @HostBinding("class") get classList() {
    return [
      "tw-font-semibold",
      "tw-py-1.5",
      "tw-px-3",
      "tw-rounded-3xl",
      "tw-transition",
      "tw-border-2",
      "tw-border-solid",
      "tw-text-center",
      "hover:tw-no-underline",
      "focus:tw-outline-none",
    ]
      .concat(this.block ? ["tw-w-full", "tw-block"] : ["tw-inline-block"])
      .concat(buttonStyles[this.buttonType ?? "secondary"]);
  }

  @HostBinding("attr.disabled")
  get disabledAttr() {
    const disabled = this.disabled != null && this.disabled !== false;
    return disabled || this.loading ? true : null;
  }

  @Input() buttonType: ButtonType;

  private _block = false;

  @Input()
  get block(): boolean {
    return this._block;
  }

  set block(value: boolean | "") {
    this._block = coerceBooleanProperty(value);
  }

  @Input() loading = false;

  @Input() disabled = false;

  setButtonType(value: "primary" | "secondary" | "danger" | "unstyled") {
    this.buttonType = value;
  }
}
