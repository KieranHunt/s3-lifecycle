export const checkNotNull = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) {
    throw "Expected value to not be null or undefined!";
  }

  return value;
};
