export function calculateTimeDifference(startTime: Date, endTime: Date): string {
  const diffInMs = new Date(endTime).getTime() - new Date(startTime).getTime();
  const hours = Math.floor(diffInMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffInMs % (1000 * 60)) / 1000);
  return `${hours}h ${minutes}m ${seconds}s`;
}