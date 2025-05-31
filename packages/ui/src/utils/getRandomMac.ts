export function getRandomMac() {
  const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
  return Array.from({ length: 6 }, hex).join(':')
}

export function isValidMac(mac: string): boolean {
  return /^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(mac)
}
