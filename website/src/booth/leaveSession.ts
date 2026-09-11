export const leaveMessage = 'Leave this session? Your photos will be deleted from this booth. You will need to take or upload them again. Choose Cancel to keep your photos.';

export function confirmDiscard(hasPhotos: boolean, confirm: (message: string) => boolean, clear: () => void) {
  if (hasPhotos && !confirm(leaveMessage)) return false;
  clear();
  return true;
}
