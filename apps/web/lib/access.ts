export type SubmitAccessUser = {
  isMember: boolean;
  hasPlayPass: boolean;
};

export function hasSubmitEntitlement(user: SubmitAccessUser | null | undefined): boolean {
  return !!user && (user.isMember || user.hasPlayPass);
}
