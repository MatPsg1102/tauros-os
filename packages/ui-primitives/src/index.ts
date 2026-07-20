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
export { injectUiStyles, taurosUiStyles } from './styles.js';
