// Superfície pública de @tauros/ui-primitives (6.3.3 §22) — exports explícitos.

export { Avatar, type AvatarProps } from './primitives/avatar/avatar.js';
export {
  Badge,
  BADGE_STATUS_PRECEDENCE,
  type BadgeProps,
  type BadgeStatus,
} from './primitives/badge/badge.js';
export { Box, type BoxOwnProps, type BoxProps, type InsetToken } from './primitives/box/box.js';
export {
  Button,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from './primitives/button/button.js';
export { Card, type CardProps } from './primitives/card/card.js';
export { Chip, type ChipProps } from './primitives/chip/chip.js';
export { Divider, type DividerProps } from './primitives/divider/divider.js';
export { Flex, type FlexOwnProps, type FlexProps } from './primitives/flex/flex.js';
export { Grid, type GridProps } from './primitives/grid/grid.js';
export { Heading, type HeadingLevel, type HeadingProps } from './primitives/heading/heading.js';
export {
  Icon,
  type IconDefinition,
  type IconProps,
  type IconSize,
} from './primitives/icon/icon.js';
export { IconButton, type IconButtonProps } from './primitives/icon-button/icon-button.js';
export { Label, type LabelProps } from './primitives/label/label.js';
export { Skeleton, type SkeletonProps } from './primitives/skeleton/skeleton.js';
export { Spacer, type SpacerProps } from './primitives/spacer/spacer.js';
export { Spinner, type SpinnerProps } from './primitives/spinner/spinner.js';
export {
  Stack,
  type GapToken,
  type StackOwnProps,
  type StackProps,
} from './primitives/stack/stack.js';
export {
  Surface,
  type SurfaceElevation,
  type SurfaceOwnProps,
  type SurfaceProps,
} from './primitives/surface/surface.js';
export { Text, type TextProps, type TextRole, type TextTone } from './primitives/text/text.js';
export { MissingAccessibleNameError } from './shared/accessibility.js';
export { cx, type ClassValue } from './shared/class-names.js';
export type { PolymorphicProps, PolymorphicRef } from './shared/polymorphic.js';
export { IncompatibleStylesElementError, injectUiStyles, taurosUiStyles } from './styles.js';

// ===== Form Components (6.3.4) =====
export { Field, type FieldProps } from './forms/field/field.js';
export { useFieldContext, type FieldContextValue } from './forms/field/field-context.js';
export { Input, type InputProps, type InputType } from './forms/input/input.js';
export { TextArea, type TextAreaProps } from './forms/textarea/text-area.js';
export {
  NumberInput,
  type NumberChange,
  type NumberInputProps,
} from './forms/number-input/number-input.js';
export {
  CurrencyInput,
  type CurrencyChange,
  type CurrencyInputProps,
} from './forms/currency-input/currency-input.js';
export { SearchInput, type SearchInputProps } from './forms/search-input/search-input.js';
export { Select, type SelectProps } from './forms/select/select.js';
export {
  MultiSelect,
  type MultiSelectOption,
  type MultiSelectProps,
} from './forms/multi-select/multi-select.js';
export { Checkbox, type CheckboxProps } from './forms/checkbox/checkbox.js';
export { Radio, RadioGroup, type RadioGroupProps, type RadioProps } from './forms/radio/radio.js';
export { Switch, type SwitchProps } from './forms/switch/switch.js';
export {
  DatePicker,
  isValidCivilDate,
  type CivilDateString,
  type DatePickerProps,
} from './forms/date-picker/date-picker.js';
export {
  isValidLocalTime,
  TimePicker,
  type LocalTimeString,
  type TimePickerProps,
} from './forms/time-picker/time-picker.js';
export {
  InvalidPinLengthError,
  PinInput,
  type PinInputProps,
} from './forms/pin-input/pin-input.js';
