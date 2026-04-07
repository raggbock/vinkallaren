export const Platform = {
  OS: "web" as const,
  select: <T>(obj: { web?: T; default?: T }) => obj.web ?? obj.default,
};

export const Share = {
  share: jest.fn().mockResolvedValue({ action: "sharedAction" }),
};

export const Alert = {
  alert: jest.fn(),
};

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  flatten: (style: unknown) => style,
  hairlineWidth: 1,
};

export const Dimensions = {
  get: jest.fn().mockReturnValue({ width: 375, height: 812 }),
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
};

export const Linking = {
  openURL: jest.fn().mockResolvedValue(undefined),
  canOpenURL: jest.fn().mockResolvedValue(true),
};

export default {
  Platform,
  Share,
  Alert,
  StyleSheet,
  Dimensions,
  Linking,
};
